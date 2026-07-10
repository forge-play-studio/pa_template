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
import { createDeterminismContext } from './determinism';
import type { DeterminismContext } from './determinism';
import { DEFAULT_ENGINE_RENDER_DELTA_TIME_SECONDS, pinEngineDeltaTimeForFrame } from './engine-clock';
import { createProjectGameplayRuntime } from '../gameplay';
import type { GameplayModule, ProjectGameplayRuntime } from '../gameplay';
import type { EffectPackageService } from '@fps-games/vfx';
import type { VfxParamValues, VfxSpawnTransform } from '../assets/vfx';

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
  private frame = 0;
  private currentFrameDeltaTime: number | null = null;
  private lastFrameDeltaTime = 0;
  /** Simulated dt (ms) handed to Babylon's animation clock each render. See installDeterministicAnimationClock(). */
  private animationDeltaMs = DEFAULT_ENGINE_RENDER_DELTA_TIME_SECONDS * 1000;
  private dtOverride: (() => number) | null = null;
  private suppressPausedRender = false;
  private enableAudio: boolean;
  private determinism: DeterminismContext;

  constructor(options: GameOptions) {
    const el = document.getElementById(options.canvasId);
    if (!el || !(el instanceof HTMLCanvasElement)) {
      throw new Error(`Canvas with id "${options.canvasId}" not found`);
    }
    this.canvas = el;

    this.enableAudio = options.enableAudio ?? false;
    this.determinism = createDeterminismContext(resolveSeedFromUrl(window.location.search));

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });

    this.scene = new Scene(this.engine);
    this.installDeterministicAnimationClock();
    // 动画时钟从构造起就冻结,直到 start()/resume()。init() 期间的 VFX warmup / 阴影预热 render
    // 同样会推进 Scene._animate(),而它们的次数与真实时间挂钩 → frame-0 的动画相位不可复现。
    this.scene.animationsEnabled = false;
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

    // 16) First-use warmups
    await this.warmupVfxFirstUsePaths();

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

  private async warmupVfxFirstUsePaths(): Promise<void> {
    if (!this.sceneVfxService) return;
    try {
      await this.sceneVfxService.warmupRegisteredEffectPackages();
      await this.scene.whenReadyAsync(false);
      await this.renderWarmupFrame();
      await this.renderWarmupFrame();
    } catch (error) {
      console.warn('[Game] VFX first-use warmup skipped:', error);
    }
  }

  private async renderWarmupFrame(): Promise<void> {
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
        return;
      }
      window.setTimeout(resolve, 0);
    });
    this.renderWithPinnedEngineDelta(this.lastFrameDeltaTime || DEFAULT_ENGINE_RENDER_DELTA_TIME_SECONDS);
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
      determinism: this.determinism,
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
    this.scene.animationsEnabled = !this.isPaused;
    this.lastTime = performance.now();

    this.engine.runRenderLoop(() => {
      this.gameLoop();
    });
  }

  pause(): void {
    this.isPaused = true;
    this.scene.animationsEnabled = false;
  }

  resume(): void {
    this.isPaused = false;
    this.scene.animationsEnabled = true;
    this.lastTime = performance.now();
  }

  stop(): void {
    this.isRunning = false;
    this.engine.stopRenderLoop();
  }

  private gameLoop(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const deltaTime = this.dtOverride?.() ?? (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (!this.isPaused) {
      this.advanceFrame(deltaTime, true);
    } else {
      this.currentFrameDeltaTime = null;
    }

    if (!(this.isPaused && this.suppressPausedRender)) {
      this.renderWithPinnedEngineDelta(deltaTime);
    }
  }

  stepFrame(deltaTime: number): void {
    if (!this.isPaused) {
      throw new Error('Game.stepFrame(dt) requires the game to be paused.');
    }
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      throw new Error(`Game.stepFrame(dt) requires a finite non-negative dt, got ${deltaTime}.`);
    }
    // 让 `scene.animationsEnabled` 覆盖 update **和** render 全程,与实时循环完全一致。
    // update() 期间保持 false 会让系统在回放里观察到与录制时不同的场景状态。
    const animationsEnabled = this.scene.animationsEnabled;
    this.scene.animationsEnabled = true;
    try {
      this.advanceFrame(deltaTime, true);
      this.renderWithPinnedEngineDelta(deltaTime);
    } finally {
      this.scene.animationsEnabled = animationsEnabled;
    }
  }

  setDtOverride(override: (() => number) | null): void {
    this.dtOverride = override;
  }

  setSuppressPausedRender(flag: boolean): void {
    this.suppressPausedRender = flag;
  }

  getFrameCount(): number {
    return this.frame;
  }

  getCurrentFrameDeltaTime(): number | null {
    return this.currentFrameDeltaTime;
  }

  getLastFrameDeltaTime(): number {
    return this.lastFrameDeltaTime;
  }

  getPaused(): boolean {
    return this.isPaused;
  }

  isGameplaySettled(): boolean {
    return this.gameplayModules.every((module) => module.isBootSettled?.() !== false);
  }

  getDeterminismContext(): DeterminismContext {
    return this.determinism;
  }

  private advanceFrame(deltaTime: number, shouldUpdate: boolean): void {
    this.currentFrameDeltaTime = deltaTime;
    try {
      if (shouldUpdate) {
        // Babylon 的 render loop 会在我们的回调**之前**调 `engine.beginFrame()`,把 `engine._deltaTime`
        // 覆写成**真实**瞬时帧时长。而 `stepFrame()` 由普通 JS 循环驱动,没有 beginFrame(),
        // `_deltaTime` 还留着上一帧钉进去的值。任何读 `engine.getDeltaTime()` 的代码(直接或经 Babylon)
        // 因此在录制与回放里读到不同的数。update 期间也钉住,不只渲染时钉。
        this.animationDeltaMs = pinEngineDeltaTimeForFrame(
          this.engine,
          deltaTime || DEFAULT_ENGINE_RENDER_DELTA_TIME_SECONDS,
        );
        this.determinism.advance(deltaTime);
        this.update(deltaTime);
      }
    } finally {
      this.lastFrameDeltaTime = deltaTime;
      this.currentFrameDeltaTime = null;
      this.frame++;
    }
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

  private renderWithPinnedEngineDelta(deltaTime: number): void {
    this.animationDeltaMs = pinEngineDeltaTimeForFrame(
      this.engine,
      deltaTime || DEFAULT_ENGINE_RENDER_DELTA_TIME_SECONDS,
    );
    this.scene.render();
  }

  /**
   * Babylon 的 `Scene._animate()` 用 `PrecisionDate.Now` 自己算 dt(见 8.52.1
   * `Animations/animatable.core.js`),`engine._deltaTime` 根本够不着它 —— 于是动画组按机器
   * 实际帧率老化,而不是按模拟时钟。任何**由动画驱动的玩法事件**(动画播完 →
   * `onAnimationGroupEndObservable` → 结算)因此不可复现。
   *
   * 实例级 shim:`_animate()` 未显式传参时喂入本帧的模拟 dt。正常游玩时 sim dt == 真实 dt,
   * 画面无差别;stepFrame 回放时它就是录制的那一帧 dt。
   */
  private installDeterministicAnimationClock(): void {
    const scene = this.scene as unknown as { _animate(customDeltaTime?: number): void };
    const originalAnimate = scene._animate.bind(this.scene);
    scene._animate = (customDeltaTime?: number): void => {
      originalAnimate(customDeltaTime ?? this.animationDeltaMs);
    };
  }


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

  getAudioService(): AudioService | null {
    return this.audioService;
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

  getSceneVfxService(): SceneVfxService | null {
    return this.sceneVfxService;
  }

  getEffectPackageService(): EffectPackageService | null {
    return this.sceneVfxService?.getEffectPackageService() ?? null;
  }

  playEffectPackage(effectId: string, params: Partial<VfxParamValues> = {}, spawnTransform?: VfxSpawnTransform | Vector3) {
    return this.sceneVfxService?.playEffectPackage(effectId, params, spawnTransform) ?? null;
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
    this.dtOverride = null;

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

function resolveSeedFromUrl(search: string): number {
  const params = new URLSearchParams(search);
  const raw = params.get('seed');
  if (raw == null || raw.trim() === '') return 1;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return numeric >>> 0;
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
