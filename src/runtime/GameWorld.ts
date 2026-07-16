/**
 * GameWorld owns one complete gameplay lifetime.
 *
 * The host decides when the world starts and ends. The world owns gameplay
 * resources, frame ordering and rendering, but knows nothing about editor UI,
 * development switching or browser-entry policy.
 */
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';

import '@babylonjs/core/Animations/animatable';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Materials/Textures/texture';
import '@babylonjs/loaders/glTF';

import { PROJECT_VFX_BUDGET, PROJECT_VFX_REGISTRATIONS } from '../assets/vfx';
import { configService, PROJECT_GAMEPLAY_CONFIG, resolveSceneAssetRuntimeUrl } from '../config';
import { SimplePlayer } from '../entities';
import { createProjectGameplayRuntime } from '../gameplay';
import type { GameplayModule, ProjectGameplayRuntime } from '../gameplay';
import {
  AssetLoader,
  AudioService,
  InputService,
  MaterialConfigService,
  ModelAnimationService,
  ModelPool,
  playableAnalyticsService,
  playableCtaService,
  RenderingService,
  SceneBuilder,
  ShadowService,
  VfxService,
} from '../services';
import type { PlayableAnalyticsService, PlayableCtaService } from '../services';
import { ZoneSystem } from '../systems';
import {
  FrameClock,
  FrameDirector,
  FramePump,
  RenderCoordinator,
} from './frame';
import {
  disposeProjectRuntimePlugins,
  startProjectRuntimePlugins,
} from './integrations/fps-runtime/runtime-plugin-host';
import { ResourceScope } from './lifecycle/ResourceScope';

export interface GameWorldOptions {
  canvasId: string;
  debug?: boolean;
  enableAudio?: boolean;
}

export type GameWorldState =
  | 'new'
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'destroying'
  | 'destroyed'
  | 'failed';

function installBabylonDebugMarkerFallbacks(): void {
  const prototype = Engine.prototype as Engine & Record<string, unknown>;
  if (!prototype._debugPushGroup) prototype._debugPushGroup = () => undefined;
  if (!prototype._debugPopGroup) prototype._debugPopGroup = () => undefined;
  if (!prototype._debugInsertMarker) prototype._debugInsertMarker = () => undefined;
}

export class GameWorld {
  private readonly resources = new ResourceScope();
  private readonly enableAudio: boolean;
  private stateValue: GameWorldState = 'new';
  private simulationPaused = false;

  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private camera: ArcRotateCamera | null = null;

  private frameClock: FrameClock | null = null;
  private framePump: FramePump | null = null;
  private renderCoordinator: RenderCoordinator | null = null;

  private assetLoader: AssetLoader | null = null;
  private modelPool: ModelPool | null = null;
  private modelAnimationService: ModelAnimationService | null = null;
  private audioService: AudioService | null = null;
  private inputService: InputService | null = null;
  private sceneBuilder: SceneBuilder | null = null;
  private renderingService: RenderingService | null = null;
  private materialConfigService: MaterialConfigService | null = null;
  private shadowService: ShadowService | null = null;
  private vfxService: VfxService | null = null;
  private zoneSystem: ZoneSystem | null = null;
  private player: SimplePlayer | null = null;

  private readonly analyticsService: PlayableAnalyticsService = playableAnalyticsService;
  private readonly ctaService: PlayableCtaService = playableCtaService;
  private gameplayModules: GameplayModule[] = [];
  private initializedGameplayModules: GameplayModule[] = [];
  private projectGameplayRuntime: ProjectGameplayRuntime | null = null;

  private readonly resizeHandler = (): void => {
    this.handleDevicePixelRatio();
    this.engine?.resize();
    if (this.camera) this.sceneBuilder?.updateCameraProjection(this.camera);
  };

  private readonly visibilityHandler = (): void => {
    this.frameClock?.resetTime();
  };

  constructor(private readonly options: GameWorldOptions) {
    this.enableAudio = options.enableAudio ?? false;
  }

  get state(): GameWorldState {
    return this.stateValue;
  }

  async init(): Promise<void> {
    if (this.stateValue !== 'new') {
      throw new Error(`GameWorld.init() requires state "new", received "${this.stateValue}".`);
    }
    this.stateValue = 'initializing';

    try {
      installBabylonDebugMarkerFallbacks();
      await startProjectRuntimePlugins();
      this.resources.defer(() => disposeProjectRuntimePlugins());

      const canvas = document.getElementById(this.options.canvasId);
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error(`Canvas with id "${this.options.canvasId}" not found`);
      }
      const engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true,
      });
      this.engine = engine;
      this.resources.defer(() => engine.dispose());

      const scene = new Scene(engine);
      this.scene = scene;
      this.resources.defer(() => scene.dispose());
      scene.useRightHandedSystem = true;
      scene.clearColor = new Color4(0.06, 0.06, 0.08, 1);

      window.addEventListener('resize', this.resizeHandler);
      document.addEventListener('visibilitychange', this.visibilityHandler);
      this.resources.defer(() => {
        window.removeEventListener('resize', this.resizeHandler);
        document.removeEventListener('visibilitychange', this.visibilityHandler);
      });
      this.handleDevicePixelRatio();

      this.frameClock = new FrameClock({ maxDeltaSeconds: 0.1 });
      this.renderCoordinator = new RenderCoordinator(scene);
      const frameDirector = new FrameDirector({
        update: frame => this.update(frame.deltaSeconds),
        render: frame => this.renderCoordinator?.renderFrame(frame),
      });
      this.framePump = new FramePump({
        engine,
        clock: this.frameClock,
        director: frameDirector,
        isSimulationPaused: () => this.simulationPaused,
      });

      await this.initRuntimeServices(scene);
      this.stateValue = 'ready';
    } catch (initializationError) {
      this.stateValue = 'failed';
      try {
        await this.resources.dispose();
      } catch (cleanupError) {
        this.clearRuntimeReferences();
        throw new AggregateError(
          [initializationError, cleanupError],
          'GameWorld initialization and rollback failed.',
        );
      }
      this.clearRuntimeReferences();
      throw initializationError;
    }
  }

  start(): void {
    if (this.stateValue === 'running') return;
    if (this.stateValue !== 'ready') {
      throw new Error(`GameWorld.start() requires state "ready", received "${this.stateValue}".`);
    }
    this.simulationPaused = false;
    if (!this.framePump) throw new Error('GameWorld frame pump is not initialized.');
    this.framePump.start();
    this.stateValue = 'running';
  }

  pause(): void {
    if (this.stateValue !== 'running') return;
    this.simulationPaused = true;
    this.stateValue = 'paused';
  }

  resume(): void {
    if (this.stateValue !== 'paused') return;
    this.simulationPaused = false;
    this.frameClock?.resetTime();
    this.stateValue = 'running';
  }

  async destroy(): Promise<void> {
    if (this.stateValue === 'destroyed') return;
    if (this.stateValue === 'initializing') {
      throw new Error('GameWorld.destroy() during init() is not supported.');
    }
    if (this.stateValue === 'new') {
      this.stateValue = 'destroyed';
      return;
    }

    this.stateValue = 'destroying';
    this.simulationPaused = true;
    this.framePump?.stop();
    try {
      await this.resources.dispose();
    } finally {
      this.clearRuntimeReferences();
      this.stateValue = 'destroyed';
    }
  }

  private async initRuntimeServices(scene: Scene): Promise<void> {
    const assetLoader = new AssetLoader(scene);
    this.assetLoader = assetLoader;
    this.resources.defer(() => assetLoader.clearCache());

    const sceneBuilder = new SceneBuilder(scene, assetLoader);
    this.sceneBuilder = sceneBuilder;
    this.resources.defer(() => sceneBuilder.dispose());
    const environment = sceneBuilder.buildSceneEnvironment();
    this.camera = environment.camera;
    this.renderingService = environment.renderingService;
    this.shadowService = environment.shadowService;
    this.resources.defer(() => environment.renderingService.dispose());
    this.resources.defer(() => environment.shadowService.dispose());

    this.modelAnimationService = new ModelAnimationService();

    const modelPool = new ModelPool(scene, assetLoader);
    this.modelPool = modelPool;
    this.resources.defer(() => modelPool.dispose());
    sceneBuilder.setModelPool(modelPool);

    await this.preloadModelsFromConfig();
    await sceneBuilder.loadSceneFromDocument();

    const materialConfigService = new MaterialConfigService(scene);
    this.materialConfigService = materialConfigService;
    this.resources.defer(() => materialConfigService.dispose());
    materialConfigService.applyAllConfigs();
    materialConfigService.logMissingMaterials();
    modelPool.setMaterialConfigService(materialConfigService);

    this.warmupModelsFromConfig();
    environment.shadowService.refreshShadowMeshes();

    const inputService = new InputService();
    this.inputService = inputService;
    this.resources.defer(() => inputService.dispose());

    const player = new SimplePlayer(scene, inputService, {
      position: new Vector3(0, 0.35, 0),
      speed: PROJECT_GAMEPLAY_CONFIG.threeC.player.speed,
      radius: PROJECT_GAMEPLAY_CONFIG.threeC.player.radius,
    });
    this.player = player;
    this.resources.defer(() => player.dispose());
    if (this.camera) this.camera.target = player.position;

    const zoneSystem = new ZoneSystem({
      sceneConfig: configService.getSceneConfig(),
      getPlayer: () => this.player,
    });
    this.zoneSystem = zoneSystem;
    this.resources.defer(() => zoneSystem.dispose());

    const vfxService = new VfxService({
      scene,
      budget: PROJECT_VFX_BUDGET,
      renderWarmupFrame: () => this.renderCoordinator!.renderOnce(),
    });
    this.vfxService = vfxService;
    this.resources.defer(() => vfxService.dispose());
    vfxService.registerAll(PROJECT_VFX_REGISTRATIONS);
    await vfxService.init();

    if (this.enableAudio) {
      const audioService = new AudioService(scene);
      this.audioService = audioService;
      this.resources.defer(() => audioService.dispose());
      await audioService.preload();
      audioService.setupUnlockListener();
    }

    await this.initGameplayModules();
  }

  private async preloadModelsFromConfig(): Promise<void> {
    if (!this.assetLoader) return;
    const sceneAssets = configService.getSceneAssets();
    for (const asset of sceneAssets) {
      const url = resolveSceneAssetRuntimeUrl(asset);
      if (url) this.assetLoader.registerRuntimeModelUrl(asset.id, url);
    }
    const modelIds = [...new Set(
      sceneAssets
        .map(asset => asset.id)
        .filter((assetId): assetId is string => typeof assetId === 'string' && assetId.length > 0),
    )];
    if (modelIds.length > 0) await this.assetLoader.preload(modelIds);
  }

  private warmupModelsFromConfig(): void {
    this.modelPool?.warmupFromSceneAssets(configService.getSceneAssets());
  }

  private async initGameplayModules(): Promise<void> {
    if (
      !this.scene ||
      !this.assetLoader ||
      !this.modelAnimationService ||
      !this.inputService ||
      !this.materialConfigService ||
      !this.modelPool ||
      !this.renderingService ||
      !this.sceneBuilder ||
      !this.vfxService ||
      !this.shadowService ||
      !this.player ||
      !this.zoneSystem
    ) {
      throw new Error('GameWorld runtime services are incomplete.');
    }

    this.projectGameplayRuntime = createProjectGameplayRuntime({
      scene: this.scene,
      camera: this.camera,
      assetLoader: this.assetLoader,
      modelAnimationService: this.modelAnimationService,
      audioService: this.audioService,
      inputService: this.inputService,
      materialConfigService: this.materialConfigService,
      modelPool: this.modelPool,
      renderingService: this.renderingService,
      sceneBuilder: this.sceneBuilder,
      vfxService: this.vfxService,
      shadowService: this.shadowService,
      analytics: this.analyticsService,
      cta: this.ctaService,
      player: this.player,
      zoneSystem: this.zoneSystem,
    });
    this.gameplayModules = this.projectGameplayRuntime.modules;
    this.resources.defer(() => {
      const errors: unknown[] = [];
      for (let index = this.initializedGameplayModules.length - 1; index >= 0; index -= 1) {
        try {
          this.initializedGameplayModules[index].dispose?.();
        } catch (error) {
          errors.push(error);
        }
      }
      this.initializedGameplayModules = [];
      this.gameplayModules = [];
      this.projectGameplayRuntime = null;
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, 'Gameplay module disposal failed.');
    });

    for (const module of this.gameplayModules) {
      this.initializedGameplayModules.push(module);
      await module.init?.();
    }
  }

  private update(deltaSeconds: number): void {
    this.player?.update(deltaSeconds);
    this.zoneSystem?.update(deltaSeconds);
    for (const module of this.gameplayModules) module.update?.(deltaSeconds);
  }

  private handleDevicePixelRatio(): void {
    const ratio = window.devicePixelRatio || 1;
    this.engine?.setHardwareScalingLevel(1 / ratio);
  }

  private clearRuntimeReferences(): void {
    this.engine = null;
    this.scene = null;
    this.camera = null;
    this.frameClock = null;
    this.framePump = null;
    this.renderCoordinator = null;
    this.assetLoader = null;
    this.modelPool = null;
    this.modelAnimationService = null;
    this.audioService = null;
    this.inputService = null;
    this.sceneBuilder = null;
    this.renderingService = null;
    this.materialConfigService = null;
    this.shadowService = null;
    this.vfxService = null;
    this.zoneSystem = null;
    this.player = null;
    this.gameplayModules = [];
    this.initializedGameplayModules = [];
    this.projectGameplayRuntime = null;
  }

  getScene(): Scene {
    if (!this.scene) throw new Error('GameWorld scene is not initialized.');
    return this.scene;
  }

  getEngine(): Engine {
    if (!this.engine) throw new Error('GameWorld engine is not initialized.');
    return this.engine;
  }

  getCamera(): ArcRotateCamera | null { return this.camera; }
  getPlayer(): SimplePlayer | null { return this.player; }
  getSceneBuilder(): SceneBuilder | null { return this.sceneBuilder; }
  getShadowService(): ShadowService | null { return this.shadowService; }
  getInputService(): InputService | null { return this.inputService; }
  getAudioService(): AudioService | null { return this.audioService; }
  getZoneSystem(): ZoneSystem | null { return this.zoneSystem; }
  getProjectGameplayRuntime(): ProjectGameplayRuntime | null { return this.projectGameplayRuntime; }
  getSceneNodeRuntime(id: string): any | null {
    return this.sceneBuilder?.getSceneNodeRuntime(id) ?? null;
  }
  getVfxService(): VfxService | null { return this.vfxService; }
  getModelAnimationService(): ModelAnimationService | null { return this.modelAnimationService; }
}
