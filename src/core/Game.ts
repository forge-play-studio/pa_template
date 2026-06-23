/**
 * Game - 游戏主类 (Scaffold)
 *
 * 职责：
 * - 初始化 Babylon Engine/Scene
 * - 初始化服务层（AssetLoader / ModelPool / RenderingService 等）
 * - 初始化系统/实体/UI
 * - 驱动游戏循环（update + render）
 *
 * 说明：
 * - 这是“通用脚手架”版本，已剔除强绑定业务的 gameplay 模块
 * - 当前基座仅保留 service/system/ui/entity 的最小闭环
 */

import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';

// Polyfill: 修复 BabylonJS 8.x 中 _debugPushGroup 不存在的问题
if (!(Engine.prototype as any)._debugPushGroup) {
  (Engine.prototype as any)._debugPushGroup = function () { };
}
if (!(Engine.prototype as any)._debugPopGroup) {
  (Engine.prototype as any)._debugPopGroup = function () { };
}
if (!(Engine.prototype as any)._debugInsertMarker) {
  (Engine.prototype as any)._debugInsertMarker = function () { };
}

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

// 副作用导入 - glTF 加载器
import '@babylonjs/loaders/glTF';
// 副作用导入 - 动画系统
import '@babylonjs/core/Animations/animatable';
// 副作用导入 - 材质系统
import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
// 副作用导入 - 纹理系统
import '@babylonjs/core/Materials/Textures/texture';
// 服务
import {
  AssetLoader,
  ModelPool,
  AnimationService,
  AudioService,
  InputService,
  SceneBuilder,
  MaterialConfigService,
  RenderingService,
  ShadowService,
  SceneVfxService,
  playableAnalyticsService,
  playableCtaService,
  configValidator,
} from '../services';
import type { PlayableAnalyticsService, PlayableCtaService } from '../services';
import { ZoneSystem } from '../systems';

// 实体 / UI（脚手架）
import { SimplePlayer } from '../entities';

import { configService, PROJECT_GAMEPLAY_CONFIG } from '../config';
import type { SceneConfig } from '../config';
import { createProjectGameplayRuntime } from '../gameplay';
import type { GameplayModule, ProjectGameplayRuntime } from '../gameplay';

export interface GameOptions {
  canvasId: string;
  debug?: boolean;
  enableAudio?: boolean;
}

export class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;

  // Camera
  private camera: ArcRotateCamera | null = null;

  // Services
  private assetLoader: AssetLoader | null = null;
  private modelPool: ModelPool | null = null;
  private animationService: AnimationService | null = null;
  private audioService: AudioService | null = null;
  private sceneBuilder: SceneBuilder | null = null;
  private renderingService: RenderingService | null = null;
  private materialConfigService: MaterialConfigService | null = null;
  private shadowService: ShadowService | null = null;
  private sceneVfxService: SceneVfxService | null = null;
  private zoneSystem: ZoneSystem | null = null;
  private analyticsService: PlayableAnalyticsService = playableAnalyticsService;
  private ctaService: PlayableCtaService = playableCtaService;

  // Input
  private inputService: InputService | null = null;

  // Entities
  private player: SimplePlayer | null = null;

  // Project gameplay modules
  private gameplayModules: GameplayModule[] = [];
  private projectGameplayRuntime: ProjectGameplayRuntime | null = null;

  // Loop state
  private isRunning = false;
  private isPaused = false;
  private lastTime = 0;
  private enableAudio: boolean;

  constructor(options: GameOptions) {
    const el = document.getElementById(options.canvasId);
    if (!el || !(el instanceof HTMLCanvasElement)) {
      throw new Error(`Canvas with id "${options.canvasId}" not found`);
    }
    this.canvas = el;

    this.enableAudio = options.enableAudio ?? false;

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });

    this.scene = new Scene(this.engine);
    // 强制使用右手坐标系：项目默认接入 glb/glTF 模型，不要改成左手系。
    this.scene.useRightHandedSystem = true;
    this.scene.clearColor = new Color4(0.06, 0.06, 0.08, 1);

    this.setupResizeHandler();
    this.handleDevicePixelRatio();

  }

  // ============================================================
  // Init
  // ============================================================

  async init(): Promise<void> {
    // 1) AssetLoader
    this.assetLoader = new AssetLoader(this.scene);

    // 2) SceneBuilder (camera/lights/pipeline)
    this.sceneBuilder = new SceneBuilder(this.scene, this.assetLoader);
    const env = this.sceneBuilder.buildSceneEnvironment();
    this.camera = env.camera;
    this.renderingService = env.renderingService;
    this.shadowService = env.shadowService;

    // 3) Other services
    this.animationService = new AnimationService();
    this.modelPool = new ModelPool(this.scene, this.assetLoader);
    this.sceneBuilder.setModelPool(this.modelPool);

    // 4) Preload models declared in scene.assets (可选)
    await this.preloadModelsFromConfig();

    // 5) Load scene document (可选)
    await this.sceneBuilder.loadSceneFromDocument();

    // 6) Apply materials config (可选)
    this.materialConfigService = new MaterialConfigService(this.scene);
    this.materialConfigService.applyAllConfigs();
    this.materialConfigService.logMissingMaterials();
    this.modelPool.setMaterialConfigService(this.materialConfigService);

    // 7) Warm up pooled model instances declared in scene.assets
    this.warmupModelsFromConfig();

    // 8) Refresh shadows after scene loaded
    this.shadowService.refreshShadowMeshes();

    // 9) Input
    this.initInput();

    // 10) Entities
    this.createPlayer();

    // 11) Zone interactions
    this.initZoneSystem();

    // 12) Scene VFX (optional)
    this.sceneVfxService = new SceneVfxService(this.scene);
    this.sceneVfxService.initFromConfig();

    // 13) Config validation (DEV)
    if (import.meta.env.DEV) {
      configValidator.validate();
    }

    // 14) Audio (optional)
    if (this.enableAudio) {
      this.audioService = new AudioService(this.scene);
      await this.audioService.preload();
      this.audioService.setupUnlockListener();
    }

    // 15) Project gameplay modules
    await this.initGameplayModules();

  }

  private async preloadModelsFromConfig(): Promise<void> {
    if (!this.assetLoader) return;

    const modelIds = [...new Set(
      configService
        .getSceneAssets()
        .map((asset) => asset.id)
        .filter((assetId): assetId is string => typeof assetId === 'string' && assetId.length > 0),
    )];
    if (modelIds.length === 0) return;

    // AssetLoader 需要先创建灯光（已在 buildSceneEnvironment 完成）
    await this.assetLoader.preload(modelIds);
  }

  private warmupModelsFromConfig(): void {
    if (!this.modelPool) return;
    this.modelPool.warmupFromSceneAssets(configService.getSceneAssets());
  }

  private initInput(): void {
    this.inputService = new InputService();
  }

  private createPlayer(): void {
    const startPos = new Vector3(0, 0.35, 0);
    this.player = new SimplePlayer(this.scene, this.inputService, {
      position: startPos,
      speed: PROJECT_GAMEPLAY_CONFIG.threeC.player.speed,
      radius: PROJECT_GAMEPLAY_CONFIG.threeC.player.radius,
    });

    // 摄像机跟随（ArcRotateCamera：target 跟随）
    if (this.camera) {
      this.camera.target = this.player.position;
    }
  }

  private initZoneSystem(): void {
    this.zoneSystem = new ZoneSystem({
      sceneConfig: configService.getSceneConfig(),
      getPlayer: () => this.player,
    });
  }

  private async initGameplayModules(): Promise<void> {
    if (
      !this.assetLoader ||
      !this.animationService ||
      !this.inputService ||
      !this.materialConfigService ||
      !this.modelPool ||
      !this.renderingService ||
      !this.sceneBuilder ||
      !this.sceneVfxService ||
      !this.shadowService ||
      !this.player ||
      !this.zoneSystem
    ) {
      return;
    }

    this.projectGameplayRuntime = createProjectGameplayRuntime({
      scene: this.scene,
      camera: this.camera,
      assetLoader: this.assetLoader,
      animationService: this.animationService,
      audioService: this.audioService,
      inputService: this.inputService,
      materialConfigService: this.materialConfigService,
      modelPool: this.modelPool,
      renderingService: this.renderingService,
      sceneBuilder: this.sceneBuilder,
      sceneVfxService: this.sceneVfxService,
      shadowService: this.shadowService,
      analytics: this.analyticsService,
      cta: this.ctaService,
      player: this.player,
      zoneSystem: this.zoneSystem,
    });
    this.gameplayModules = this.projectGameplayRuntime.modules;

    for (const module of this.gameplayModules) {
      await module.init?.();
    }
  }

  // ============================================================
  // Loop
  // ============================================================

  start(): void {
    if (this.isRunning) return;

    (window as any).game = this;
    this.isRunning = true;
    this.lastTime = performance.now();

    this.engine.runRenderLoop(() => {
      this.gameLoop();
    });
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  stop(): void {
    this.isRunning = false;
    this.engine.stopRenderLoop();
  }

  private gameLoop(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (!this.isPaused) {
      this.update(deltaTime);
    }

    this.scene.render();
  }

  private update(deltaTime: number): void {
    // Entities
    this.player?.update(deltaTime);
    this.zoneSystem?.update(deltaTime);
    for (const module of this.gameplayModules) {
      module.update?.(deltaTime);
    }
  }

  // ============================================================
  // Utilities
  // ============================================================

  private handleDevicePixelRatio(): void {
    const ratio = window.devicePixelRatio || 1;
    this.engine.setHardwareScalingLevel(1 / ratio);
  }

  private setupResizeHandler(): void {
    window.addEventListener('resize', () => {
      this.handleDevicePixelRatio();
      this.engine.resize();
      if (this.camera) {
        this.sceneBuilder?.updateCameraProjection(this.camera);
      }
    });
  }

  // ============================================================
  // Public accessors
  // ============================================================

  getScene(): Scene {
    return this.scene;
  }

  getEngine(): Engine {
    return this.engine;
  }

  getCamera(): ArcRotateCamera | null {
    return this.camera;
  }

  getPlayer(): SimplePlayer | null {
    return this.player;
  }

  getSceneBuilder(): SceneBuilder | null {
    return this.sceneBuilder;
  }

  getShadowService(): ShadowService | null {
    return this.shadowService;
  }

  getInputService(): InputService | null {
    return this.inputService;
  }

  getZoneSystem(): ZoneSystem | null {
    return this.zoneSystem;
  }

  getProjectGameplayRuntime(): ProjectGameplayRuntime | null {
    return this.projectGameplayRuntime;
  }

  getSceneNodeRuntime(id: string): any | null {
    return this.sceneBuilder?.getSceneNodeRuntime(id) ?? null;
  }

  /**
   * AnimationService 访问入口（脚手架保留：具体项目可在 entity/system 中使用）
   */
  getAnimationService(): AnimationService | null {
    return this.animationService;
  }

  onEditorDocumentCommitted(sceneConfig: SceneConfig): void {
    configService.replaceSceneConfig(sceneConfig);
    this.zoneSystem?.reloadFromSceneConfig(sceneConfig);
  }

  // ============================================================
  // Dispose
  // ============================================================

  dispose(): void {
    this.stop();

    for (let i = this.gameplayModules.length - 1; i >= 0; i--) {
      this.gameplayModules[i].dispose?.();
    }
    this.gameplayModules = [];
    this.projectGameplayRuntime = null;

    this.player?.dispose();
    this.player = null;

    this.inputService?.dispose();
    this.inputService = null;

    this.audioService?.dispose();
    this.audioService = null;

    this.sceneVfxService?.dispose();
    this.sceneVfxService = null;

    this.zoneSystem?.dispose();
    this.zoneSystem = null;

    this.renderingService?.dispose();
    this.renderingService = null;

    this.materialConfigService?.dispose();
    this.materialConfigService = null;

    this.shadowService?.dispose();
    this.shadowService = null;

    this.modelPool?.dispose();
    this.modelPool = null;

    this.sceneBuilder?.dispose();
    this.sceneBuilder = null;

    this.assetLoader = null;
    this.animationService = null;

    this.scene.dispose();
    this.engine.dispose();
  }
}
