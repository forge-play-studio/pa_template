/**
 * ShadowService - 阴影管理服务
 *
 * 职责：管理场景阴影系统，包括 CSM 阴影和阴影投射/接收配置
 * 移植自旧系统的 ShadowManager
 */

import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Observer } from '@babylonjs/core/Misc/observable';
import { Scene } from '@babylonjs/core/scene';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import {
  createBlobShadowSystem,
  createPlanarShadowSystem,
  createStaticProjectedShadowBakeHashes,
  createStaticProjectedShadowArtifactSystem,
  type BlobShadowOptions,
  type PlanarShadowOptions,
  type StaticProjectedShadowArtifact,
  type StaticProjectedShadowArtifactHashInput,
  type StaticProjectedShadowArtifactOptions,
  type StaticProjectedShadowArtifactSystem,
  type StaticProjectedShadowOptions,
  type EditorShadowResolvedPlan,
  type EditorShadowSettings,
} from '@fps-games/editor/playable-sdk';
import {
  createBlobShadowOptionsFromRenderingProfile,
  createPlanarShadowOptionsFromRenderingProfile,
  createStaticProjectedShadowOptionsFromRenderingProfile,
  normalizeRenderingProfile,
  type NormalizedRenderingProfile,
} from '../rendering/rendering-profile';

// 副作用导入：注册阴影场景组件
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';

// 导入配置
import renderingConfig from '../config/rendering.json';
import { configService } from '../config/ConfigService';

// ============================================================
// 类型定义
// ============================================================

interface ColorConfig {
  r: number;
  g: number;
  b: number;
}

interface ShadowSettings {
  mapSize: number;
  darkness: number;
  blurKernel: number;
  bias: number;
  normalBias: number;
  useBlurExponentialShadowMap: boolean;
  shadowMinZ: number;
  shadowMaxZ: number;
  shadowColor: ColorConfig;
}

interface CSMSettings {
  numCascades: number;
  lambda: number;
  cascadeBlendPercentage: number;
  stabilizeCascades: boolean;
}

interface ShadowOrtho {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface ShadowsConfig {
  defaultMode: SceneShadowMode;
  enabled: boolean;
  useCsm: boolean;
  useBlobShadow: boolean;
  settings: ShadowSettings;
  blobSettings: {
    opacity: number;
    yOffset: number;
    sizeMultiplier: number;
    minSize: number;
  };
  shadowRange: {
    minZ: number;
    maxZ: number;
  };
  shadowOrtho: ShadowOrtho;
  csm: CSMSettings;
  planar: NormalizedRenderingProfile['shadows']['planar'];
  blob: NormalizedRenderingProfile['shadows']['blob'];
  staticProjected: NormalizedRenderingProfile['shadows']['staticProjected'];
}

interface ShadowMeshesConfig {
  shadowReceivers: string[];
  shadowCasters: string[];
  excludeFromShadow: string[];
}

interface RuntimePlanarShadowSystem {
  initialize(): void;
  refresh(): void;
  setOptions(options: Partial<PlanarShadowOptions>): void;
  addCaster(mesh: unknown): void;
  removeCaster(mesh: unknown): void;
  addReceiver(mesh: unknown): void;
  removeReceiver(mesh: unknown): void;
  dispose(): void;
}

interface RuntimeBlobShadowSystem {
  initialize(): void;
  refresh(): void;
  setOptions(options: Partial<BlobShadowOptions>): void;
  addCaster(mesh: unknown): void;
  removeCaster(mesh: unknown): void;
  dispose(): void;
}

type RuntimeStaticProjectedShadowArtifactSystem = Pick<
  StaticProjectedShadowArtifactSystem,
  'initialize' | 'setArtifact' | 'setOptions' | 'refreshBindings' | 'dispose'
>;

type SceneShadowMode = 'none' | 'blob' | 'static' | 'planar' | 'dynamic';
type ShadowServiceMode = 'none' | 'blob' | 'static' | 'legacy' | 'planar' | 'mixed';
const SHADOW_DEBUG_STORAGE_KEY = 'fps.shadow.debug';

// ============================================================
// ShadowService 类
// ============================================================

/**
 * ShadowService
 *
 * 管理场景阴影系统
 */
export class ShadowService {
  private scene: Scene;
  private camera: Camera | null;
  private light: DirectionalLight;
  private shadowGenerator: ShadowGenerator | null = null;
  private blobShadowSystem: RuntimeBlobShadowSystem | null = null;
  private staticProjectedShadowArtifactSystem: RuntimeStaticProjectedShadowArtifactSystem | null = null;
  private planarShadowSystem: RuntimePlanarShadowSystem | null = null;
  private renderingProfile: NormalizedRenderingProfile;
  private config: ShadowsConfig;
  private meshConfig: ShadowMeshesConfig;
  private shadowReceivers: string[];
  private excluded: string[];
  private newMeshObserver: Observer<AbstractMesh> | null = null;
  private mode: ShadowServiceMode = 'none';

  constructor(scene: Scene, light: DirectionalLight, camera?: Camera | null) {
    this.scene = scene;
    this.light = light;
    this.camera = camera || null;
    this.renderingProfile = normalizeRenderingProfile(renderingConfig);
    this.config = this.renderingProfile.shadows;
    this.meshConfig = this.renderingProfile.shadowMeshes;
    this.shadowReceivers = this.meshConfig.shadowReceivers || [];
    this.excluded = this.meshConfig.excludeFromShadow || [];
  }

  // ============================================================
  // 公共方法
  // ============================================================

  /**
   * 初始化阴影系统
   */
  initialize(): void {
    this.logShadowDebug('service.initialize.start', {
      configEnabled: this.config.enabled,
      defaultMode: this.config.defaultMode,
      blobEnabled: this.config.blob.enabled,
      staticProjectedEnabled: this.config.staticProjected.enabled,
      planarEnabled: this.isPlanarEnabled(),
      meshCount: this.scene.meshes.length,
    });
    if (this.config.blob.enabled) this.initializeBlobShadows();
    if (this.config.staticProjected.enabled) this.initializeStaticProjectedShadows();
    if (this.isPlanarEnabled()) this.initializePlanarShadows();
    if (this.config.enabled) this.initializeLegacyShadows();
    else this.scene.shadowsEnabled = false;

    this.mode = this.resolveServiceMode();
    this.applyShadowMeshes();
    this.attachNewMeshObserver();
    this.logShadowDebug('service.initialize.complete', {
      mode: this.mode,
      shadowsEnabled: this.scene.shadowsEnabled,
      shadowGenerator: this.describeShadowGenerator(),
    });
  }

  private initializeLegacyShadows(): void {
    this.scene.shadowsEnabled = true;

    // 确保光源不被父节点影响（对阴影关键）
    this.light.parent = null;
    this.light.shadowEnabled = true;

    const settings = this.config.settings;
    const csm = this.config.csm;
    const useCsm = this.config.useCsm ?? true;
    const useBlur = settings.useBlurExponentialShadowMap;

    // 创建阴影生成器（优先 CSM，不支持时回退）
    if (useCsm && CascadedShadowGenerator.IsSupported) {
      const csmGenerator = new CascadedShadowGenerator(
        settings.mapSize,
        this.light,
        undefined,
        this.camera || undefined
      );

      csmGenerator.shadowMaxZ = settings.shadowMaxZ;

      if (csm.numCascades !== undefined) {
        csmGenerator.numCascades = csm.numCascades;
      }
      if (csm.lambda !== undefined) {
        csmGenerator.lambda = csm.lambda;
      }
      if (csm.cascadeBlendPercentage !== undefined) {
        csmGenerator.cascadeBlendPercentage = csm.cascadeBlendPercentage;
      }
      if (csm.stabilizeCascades !== undefined) {
        csmGenerator.stabilizeCascades = csm.stabilizeCascades;
      }

      csmGenerator.usePercentageCloserFiltering = true;
      csmGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;

      this.shadowGenerator = csmGenerator;
    } else {
      this.shadowGenerator = new ShadowGenerator(settings.mapSize, this.light);
    }

    if (!this.shadowGenerator) {
      return;
    }

    // 应用模糊设置
    if (useBlur) {
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = settings.blurKernel;
    }

    // 应用其他设置
    this.shadowGenerator.setDarkness(settings.darkness);
    this.shadowGenerator.bias = settings.bias;
    this.shadowGenerator.normalBias = settings.normalBias;

    // 设置光源阴影范围
    this.light.shadowMinZ = settings.shadowMinZ;
    this.light.shadowMaxZ = settings.shadowMaxZ;

    // 配置方向光的正交投影边界
    this.light.orthoLeft = this.config.shadowOrtho.left;
    this.light.orthoRight = this.config.shadowOrtho.right;
    this.light.orthoTop = this.config.shadowOrtho.top;
    this.light.orthoBottom = this.config.shadowOrtho.bottom;

    this.logShadowDebug('service.legacyGenerator.ready', {
      useCsm: this.shadowGenerator instanceof CascadedShadowGenerator,
      settings,
      light: this.describeDirectionalLight(),
      generator: this.describeShadowGenerator(),
    });
  }

  /**
   * 刷新阴影网格配置
   *
   * 在场景模型加载后调用
   */
  refreshShadowMeshes(): void {
    this.applyShadowMeshes();
    this.blobShadowSystem?.refresh();
    this.staticProjectedShadowArtifactSystem?.setOptions(this.createStaticProjectedShadowArtifactOptions());
    this.staticProjectedShadowArtifactSystem?.setArtifact(
      configService.getStaticShadowArtifact() as StaticProjectedShadowArtifact | null,
    );
    this.staticProjectedShadowArtifactSystem?.refreshBindings();
    this.planarShadowSystem?.refresh();
    this.logShadowDebug('service.refreshShadowMeshes', {
      mode: this.mode,
      meshCount: this.scene.meshes.length,
      shadowGenerator: this.describeShadowGenerator(),
    });
  }

  /**
   * 获取阴影生成器实例
   */
  getShadowGenerator(): ShadowGenerator | null {
    return this.shadowGenerator;
  }

  getShadowMode(): ShadowServiceMode {
    return this.mode;
  }

  setDirectionalLightEnabled(enabled: boolean): void {
    if (!this.planarShadowSystem || !this.isPlanarEnabled()) return;
    this.planarShadowSystem.setOptions({ enabled });
  }

  /**
   * 手动添加阴影投射者
   */
  addShadowCaster(mesh: AbstractMesh): void {
    this.applyShadowToMesh(mesh);
  }

  /**
   * 手动移除阴影投射者
   */
  removeShadowCaster(mesh: AbstractMesh): void {
    this.removeMeshFromShadowSystems(mesh);
  }

  /**
   * 设置网格为阴影接收者
   */
  setShadowReceiver(mesh: AbstractMesh, receive: boolean): void {
    if (this.planarShadowSystem) {
      if (receive) this.planarShadowSystem.addReceiver(mesh);
      else this.planarShadowSystem.removeReceiver(mesh);
    }
    mesh.receiveShadows = receive;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 监听新网格添加
   */
  private attachNewMeshObserver(): void {
    this.newMeshObserver = this.scene.onNewMeshAddedObservable.add((mesh) => {
      queueMicrotask(() => {
        if (mesh.isDisposed()) return;
        this.applyShadowToMesh(mesh);
      });
    });
  }

  private initializeBlobShadows(): void {
    this.blobShadowSystem = createBlobShadowSystem(
      this.scene as any,
      this.createBlobShadowOptions(),
    ) as unknown as RuntimeBlobShadowSystem;
    this.blobShadowSystem.initialize();
  }

  private initializeStaticProjectedShadows(): void {
    this.light.parent = null;
    this.staticProjectedShadowArtifactSystem = createStaticProjectedShadowArtifactSystem(
      this.scene as any,
      configService.getStaticShadowArtifact() as StaticProjectedShadowArtifact | null,
      this.createStaticProjectedShadowArtifactOptions(),
    ) as unknown as RuntimeStaticProjectedShadowArtifactSystem;
    this.staticProjectedShadowArtifactSystem.initialize();
  }

  private initializePlanarShadows(): void {
    this.light.parent = null;
    this.planarShadowSystem = createPlanarShadowSystem(
      this.scene as any,
      this.light as any,
      this.createPlanarShadowOptions(),
    ) as unknown as RuntimePlanarShadowSystem;
    this.planarShadowSystem.initialize();
  }

  /**
   * 应用阴影配置到所有网格
   */
  private applyShadowMeshes(): void {
    for (const mesh of this.scene.meshes) {
      this.applyShadowToMesh(mesh);
    }
  }

  /**
   * 应用阴影配置到单个网格
   */
  private applyShadowToMesh(mesh: AbstractMesh): void {
    this.removeMeshFromShadowSystems(mesh);
    if (this.isGeneratedShadowExcluded(mesh)) {
      mesh.receiveShadows = false;
      this.logShadowDebug('service.mesh.excluded', this.describeMeshShadowDecision(mesh, {
        mode: 'none',
        receiveShadows: false,
        dynamicReady: false,
      }));
      return;
    }

    const mode = this.resolveMeshShadowMode(mesh);
    const dynamicReady = mode === 'dynamic'
      ? this.ensureDynamicShadowGenerator()
      : !!this.shadowGenerator;
    const receiveShadows = this.isShadowReceiver(mesh);
    mesh.receiveShadows = receiveShadows && dynamicReady;
    this.logShadowDebug('service.mesh.apply', this.describeMeshShadowDecision(mesh, {
      mode,
      receiveShadows,
      dynamicReady,
    }));
    if (this.planarShadowSystem) {
      if (receiveShadows) this.planarShadowSystem.addReceiver(mesh);
      else this.planarShadowSystem.removeReceiver(mesh);
    }

    if (mode === 'blob') {
      this.blobShadowSystem?.addCaster(mesh);
      return;
    }
    if (mode === 'static') {
      return;
    }
    if (mode === 'planar') {
      this.planarShadowSystem?.addCaster(mesh);
      return;
    }
    if (mode === 'dynamic' && this.shadowGenerator) {
      this.applyDynamicShadowGeneratorPlan(mesh);
      this.shadowGenerator.addShadowCaster(mesh, true);
      this.refreshDynamicShadowReceivers();
    }
  }

  private removeMeshFromShadowSystems(mesh: AbstractMesh): void {
    this.blobShadowSystem?.removeCaster(mesh);
    this.planarShadowSystem?.removeCaster(mesh);
    this.planarShadowSystem?.removeReceiver(mesh);
    this.shadowGenerator?.removeShadowCaster(mesh, true);
  }

  /**
   * 检查网格是否为阴影接收者
   */
  private isShadowReceiver(mesh: AbstractMesh): boolean {
    const receive = this.readMeshShadowReceive(mesh);
    if (receive === 'none') return false;
    if (receive === 'enabled' || receive === 'auto') return true;
    const nodeIds = this.readMeshProjectionNodeIds(mesh);
    if (nodeIds.length > 0 && this.scene.meshes.some(candidate => {
      const plan = this.readMeshShadowPlan(candidate);
      if (!plan || plan.backend === 'none') return false;
      return nodeIds.some(nodeId => plan.receiverIds.includes(nodeId));
    })) {
      return true;
    }
    return this.isNameMatched(mesh.name, this.shadowReceivers);
  }

  /**
   * 检查网格是否被排除
   */
  private isExcluded(name: string): boolean {
    return this.isNameMatched(name, this.excluded);
  }

  private isGeneratedShadowExcluded(mesh: AbstractMesh): boolean {
    if (this.isExcluded(mesh.name)) return true;
    for (const node of this.walkNodeAndParents(mesh)) {
      const metadata = this.readMetadata(node);
      if (
        metadata?.blobShadowInternal === true
        || metadata?.staticProjectedShadowInternal === true
        || metadata?.planarShadowInternal === true
      ) return true;
      const projection = this.readEditorProjectionMetadata(node);
      if (projection?.runtimeKind === 'camera' || projection?.runtimeKind === 'light') return true;
      if (
        metadata?.disableBlobShadow === true
        && metadata?.disableStaticProjectedShadow === true
        && metadata?.disablePlanarShadow === true
        && projection?.nodeId !== 'root'
        && projection?.helperKind !== 'root'
      ) {
        return true;
      }
    }
    return false;
  }

  private resolveMeshShadowMode(mesh: AbstractMesh): SceneShadowMode {
    const plan = this.readMeshShadowPlan(mesh);
    if (plan) return this.resolveShadowModeFromPlan(plan);
    const mode = this.readMeshShadowMode(mesh);
    if (!mode || mode === 'default') return this.config.defaultMode ?? 'none';
    return mode;
  }

  private resolveShadowModeFromPlan(plan: EditorShadowResolvedPlan): SceneShadowMode {
    if (plan.backend === 'none' || plan.mode === 'none') return 'none';
    if (plan.mode === 'projected' || plan.backend === 'projected') return 'planar';
    if (plan.mode === 'dynamic' || plan.backend === 'dynamic-map') return 'dynamic';
    if (plan.mode === 'static' || plan.backend === 'static-baked') return 'static';
    if (plan.mode === 'blob' || plan.backend === 'blob') return 'blob';
    return 'none';
  }

  private ensureDynamicShadowGenerator(): boolean {
    if (this.shadowGenerator) return true;
    this.initializeLegacyShadows();
    this.mode = this.resolveServiceMode();
    if (!this.shadowGenerator) {
      this.logShadowDebug('service.dynamicGenerator.unavailable', {
        mode: this.mode,
        shadowsEnabled: this.scene.shadowsEnabled,
      });
      return false;
    }
    this.refreshDynamicShadowReceivers();
    this.logShadowDebug('service.dynamicGenerator.ready', {
      mode: this.mode,
      light: this.describeDirectionalLight(),
      generator: this.describeShadowGenerator(),
    });
    return true;
  }

  private refreshDynamicShadowReceivers(): void {
    if (!this.shadowGenerator) return;
    for (const mesh of this.scene.meshes) {
      if (typeof mesh.isDisposed === 'function' && mesh.isDisposed()) continue;
      if (this.isGeneratedShadowExcluded(mesh)) continue;
      mesh.receiveShadows = this.isShadowReceiver(mesh);
    }
  }

  private applyDynamicShadowGeneratorPlan(mesh: AbstractMesh): void {
    if (!this.shadowGenerator) return;
    const plan = this.readMeshShadowPlan(mesh);
    const params = plan?.params;
    this.configureDynamicShadowGeneratorFilter();
    if (params) {
      if (typeof this.shadowGenerator.setDarkness === 'function') {
        this.shadowGenerator.setDarkness(this.clamp01(1 - params.opacity));
      }
      this.shadowGenerator.bias = params.bias;
      this.shadowGenerator.normalBias = params.normalBias;
      if (Number.isFinite(params.blurKernel)) {
        this.shadowGenerator.blurKernel = params.blurKernel;
      }
    }
    this.logShadowDebug('service.dynamicPlan.apply', {
      mesh: this.describeMesh(mesh),
      plan: this.describeResolvedPlan(plan),
      generator: this.describeShadowGenerator(),
    });
  }

  private configureDynamicShadowGeneratorFilter(): void {
    if (!this.shadowGenerator) return;
    this.shadowGenerator.useBlurExponentialShadowMap = false;
    this.shadowGenerator.useKernelBlur = false;
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
  }

  private clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }

  private describeMeshShadowDecision(mesh: AbstractMesh, decision: {
    mode: SceneShadowMode;
    receiveShadows: boolean;
    dynamicReady: boolean;
  }): Record<string, unknown> {
    return {
      mesh: this.describeMesh(mesh),
      decision,
      plan: this.describeResolvedPlan(this.readMeshShadowPlan(mesh)),
      shadowMode: this.readMeshShadowMode(mesh),
      receive: this.readMeshShadowReceive(mesh),
    };
  }

  private describeMesh(mesh: AbstractMesh): Record<string, unknown> {
    const projection = this.readEditorProjectionMetadata(mesh);
    return {
      name: mesh.name,
      id: mesh.id,
      nodeId: projection?.nodeId,
      rootNodeId: projection?.rootNodeId,
      enabled: typeof mesh.isEnabled === 'function' ? mesh.isEnabled() : true,
      visible: mesh.isVisible,
      receiveShadows: mesh.receiveShadows,
    };
  }

  private describeResolvedPlan(plan: EditorShadowResolvedPlan | null): Record<string, unknown> | null {
    if (!plan) return null;
    return {
      casterId: plan.casterId,
      receiverIds: plan.receiverIds,
      lightId: plan.lightId,
      backend: plan.backend,
      mode: plan.mode,
      quality: plan.quality,
      params: plan.params,
      stale: plan.stale,
      diagnostics: plan.diagnostics,
    };
  }

  private describeDirectionalLight(): Record<string, unknown> {
    return {
      name: this.light.name,
      id: this.light.id,
      enabled: typeof this.light.isEnabled === 'function' ? this.light.isEnabled() : true,
      intensity: this.light.intensity,
      position: describeShadowVec3(this.light.position),
      direction: describeShadowVec3(this.light.direction),
      orthoLeft: this.light.orthoLeft,
      orthoRight: this.light.orthoRight,
      orthoTop: this.light.orthoTop,
      orthoBottom: this.light.orthoBottom,
      shadowMinZ: this.light.shadowMinZ,
      shadowMaxZ: this.light.shadowMaxZ,
    };
  }

  private describeShadowGenerator(): Record<string, unknown> | null {
    if (!this.shadowGenerator) return null;
    return {
      className: this.shadowGenerator.getClassName?.(),
      mapSize: this.shadowGenerator.getShadowMap?.()?.getSize?.(),
      darkness: this.shadowGenerator.getDarkness?.(),
      bias: this.shadowGenerator.bias,
      normalBias: this.shadowGenerator.normalBias,
      useBlurExponentialShadowMap: this.shadowGenerator.useBlurExponentialShadowMap,
      blurKernel: this.shadowGenerator.blurKernel,
      renderList: (this.shadowGenerator.getShadowMap?.()?.renderList ?? []).map(mesh => this.describeMesh(mesh)),
    };
  }

  private logShadowDebug(event: string, details: Record<string, unknown>): void {
    if (!isShadowDebugLoggingEnabled()) return;
    try {
      console.info('[fps-shadow-debug]', event, `json=${stringifyShadowDebugDetails(details)}`, details);
    } catch {
      // Debug logging must never affect gameplay/runtime rendering.
    }
  }

  private readMeshShadowMode(mesh: AbstractMesh): SceneShadowMode | 'default' | null {
    for (const node of this.walkNodeAndParents(mesh)) {
      const mode = this.readEditorProjectionMetadata(node)?.shadowMode;
      if (mode === 'default' || mode === 'none' || mode === 'blob' || mode === 'static' || mode === 'planar' || mode === 'dynamic') {
        return mode;
      }
      const shadowMode = this.readMeshShadowSettingsFromProjection(node)?.mode;
      if (shadowMode === 'none' || shadowMode === 'blob' || shadowMode === 'static' || shadowMode === 'dynamic') return shadowMode;
      if (shadowMode === 'projected') return 'planar';
    }
    return null;
  }

  private readMeshShadowReceive(mesh: AbstractMesh): EditorShadowSettings['receive'] | null {
    for (const node of this.walkNodeAndParents(mesh)) {
      const receive = this.readMeshShadowSettingsFromProjection(node)?.receive;
      if (receive === 'enabled' || receive === 'auto' || receive === 'none') return receive;
    }
    return null;
  }

  private readMeshShadowSettingsFromProjection(node: unknown): EditorShadowSettings | null {
    const shadow = this.readObject(this.readEditorProjectionMetadata(node)?.shadow);
    if (!shadow) return null;
    const settings: EditorShadowSettings = {};
    if (shadow.cast === 'inherit' || shadow.cast === 'none' || shadow.cast === 'enabled' || shadow.cast === 'auto') {
      settings.cast = shadow.cast;
    }
    if (shadow.receive === 'inherit' || shadow.receive === 'none' || shadow.receive === 'enabled' || shadow.receive === 'auto') {
      settings.receive = shadow.receive;
    }
    if (
      shadow.mode === 'inherit'
      || shadow.mode === 'none'
      || shadow.mode === 'dynamic'
      || shadow.mode === 'static'
      || shadow.mode === 'blob'
      || shadow.mode === 'projected'
      || shadow.mode === 'auto'
    ) {
      settings.mode = shadow.mode;
    }
    return Object.keys(settings).length > 0 ? settings : null;
  }

  private readMeshShadowPlan(mesh: AbstractMesh): EditorShadowResolvedPlan | null {
    for (const node of this.walkNodeAndParents(mesh)) {
      const plan = this.readShadowPlan(this.readEditorProjectionMetadata(node)?.shadowPlan);
      if (plan) return plan;
    }
    return null;
  }

  private readShadowPlan(value: unknown): EditorShadowResolvedPlan | null {
    const plan = this.readObject(value);
    if (!plan) return null;
    if (typeof plan.casterId !== 'string') return null;
    if (!Array.isArray(plan.receiverIds) || !plan.receiverIds.every(entry => typeof entry === 'string')) return null;
    if (
      plan.backend !== 'none'
      && plan.backend !== 'dynamic-map'
      && plan.backend !== 'static-baked'
      && plan.backend !== 'blob'
      && plan.backend !== 'projected'
    ) return null;
    if (
      plan.mode !== 'none'
      && plan.mode !== 'dynamic'
      && plan.mode !== 'static'
      && plan.mode !== 'blob'
      && plan.mode !== 'projected'
    ) return null;
    if (plan.quality !== 'low' && plan.quality !== 'medium' && plan.quality !== 'high' && plan.quality !== 'ultra') return null;
    if (!this.readObject(plan.params)) return null;
    if (!Array.isArray(plan.diagnostics)) return null;
    return plan as unknown as EditorShadowResolvedPlan;
  }

  private readMeshProjectionNodeIds(mesh: AbstractMesh): string[] {
    const ids: string[] = [];
    for (const node of this.walkNodeAndParents(mesh)) {
      const projection = this.readEditorProjectionMetadata(node);
      const nodeId = projection?.nodeId;
      const rootNodeId = projection?.rootNodeId;
      if (typeof nodeId === 'string' && !ids.includes(nodeId)) ids.push(nodeId);
      if (typeof rootNodeId === 'string' && !ids.includes(rootNodeId)) ids.push(rootNodeId);
    }
    return ids;
  }

  private walkNodeAndParents(mesh: AbstractMesh): unknown[] {
    const nodes: unknown[] = [];
    const seen = new Set<unknown>();
    let cursor: unknown = mesh;
    while (cursor && typeof cursor === 'object' && !seen.has(cursor)) {
      nodes.push(cursor);
      seen.add(cursor);
      cursor = (cursor as { parent?: unknown }).parent;
    }
    return nodes;
  }

  private readEditorProjectionMetadata(node: unknown): Record<string, unknown> | null {
    return this.readObject(this.readMetadata(node)?.editorProjection);
  }

  private readMetadata(node: unknown): Record<string, unknown> | null {
    return this.readObject((node as { metadata?: unknown })?.metadata);
  }

  private readObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  /**
   * 模糊匹配网格名称
   */
  private isNameMatched(name: string, candidates: string[]): boolean {
    for (const candidate of candidates) {
      if (name === candidate || name.includes(candidate)) {
        return true;
      }
    }
    return false;
  }

  private createPlanarShadowOptions(): Partial<PlanarShadowOptions> {
    const sceneRootId = configService.getSceneRootId();
    return createPlanarShadowOptionsFromRenderingProfile(this.renderingProfile, {
      enabled: this.light.isEnabled(),
      autoDetectAllCasters: false,
      additionalCasterIncludePatterns: [sceneRootId, 'scene_builder_root'],
      additionalExcludePatterns: this.excluded,
      additionalReceiverPatterns: this.shadowReceivers,
      additionalRootBoundaryPatterns: [sceneRootId, 'scene_builder_root'],
    });
  }

  private createBlobShadowOptions(): Partial<BlobShadowOptions> {
    const sceneRootId = configService.getSceneRootId();
    return createBlobShadowOptionsFromRenderingProfile(this.renderingProfile, {
      enabled: this.config.blob.enabled,
      autoDetectAllCasters: false,
      additionalCasterIncludePatterns: [],
      additionalExcludePatterns: this.excluded,
      additionalRootBoundaryPatterns: [sceneRootId, 'scene_builder_root'],
    });
  }

  private createStaticProjectedShadowOptions(): Partial<StaticProjectedShadowOptions> {
    const sceneRootId = configService.getSceneRootId();
    return createStaticProjectedShadowOptionsFromRenderingProfile(this.renderingProfile, {
      enabled: this.config.staticProjected.enabled,
      autoDetectAllCasters: false,
      additionalCasterIncludePatterns: [],
      additionalExcludePatterns: this.excluded,
      additionalRootBoundaryPatterns: [sceneRootId, 'scene_builder_root'],
    });
  }

  private createStaticProjectedShadowArtifactOptions(): Partial<StaticProjectedShadowArtifactOptions> {
    const options = this.createStaticProjectedShadowOptions();
    return {
      enabled: options.enabled ?? this.config.staticProjected.enabled,
      appearance: options.appearance,
      bake: {
        blur: options.bake?.blur,
      },
      expectedHashes: this.createStaticProjectedShadowExpectedHashes(options),
      debug: options.debug,
    };
  }

  private createStaticProjectedShadowExpectedHashes(
    options: Partial<StaticProjectedShadowOptions>,
  ): StaticProjectedShadowArtifactHashInput | null {
    try {
      return createStaticProjectedShadowBakeHashes({
        scene: this.scene as any,
        directionalLight: this.light as any,
        options,
      });
    } catch (error) {
      if (options.debug) {
        console.warn('[ShadowService] Failed to validate static shadow artifact hashes.', error);
      }
      return null;
    }
  }

  private isPlanarEnabled(): boolean {
    return this.renderingProfile.shadows.planar.enabled;
  }

  private resolveServiceMode(): ShadowServiceMode {
    const modes: ShadowServiceMode[] = [];
    if (this.blobShadowSystem) modes.push('blob');
    if (this.staticProjectedShadowArtifactSystem) modes.push('static');
    if (this.planarShadowSystem) modes.push('planar');
    if (this.shadowGenerator) modes.push('legacy');
    if (modes.length === 0) return 'none';
    if (modes.length === 1) return modes[0];
    return 'mixed';
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this.newMeshObserver) {
      this.scene.onNewMeshAddedObservable.remove(this.newMeshObserver);
      this.newMeshObserver = null;
    }

    if (this.shadowGenerator) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = null;
    }

    if (this.blobShadowSystem) {
      this.blobShadowSystem.dispose();
      this.blobShadowSystem = null;
    }

    if (this.staticProjectedShadowArtifactSystem) {
      this.staticProjectedShadowArtifactSystem.dispose();
      this.staticProjectedShadowArtifactSystem = null;
    }

    if (this.planarShadowSystem) {
      this.planarShadowSystem.dispose();
      this.planarShadowSystem = null;
    }

  }
}

function describeShadowVec3(value: unknown): { x: number; y: number; z: number } | null {
  const vec = value as { x?: unknown; y?: unknown; z?: unknown } | null | undefined;
  return typeof vec?.x === 'number'
    && typeof vec.y === 'number'
    && typeof vec.z === 'number'
    && Number.isFinite(vec.x)
    && Number.isFinite(vec.y)
    && Number.isFinite(vec.z)
    ? { x: vec.x, y: vec.y, z: vec.z }
    : null;
}

function stringifyShadowDebugDetails(details: Record<string, unknown>): string {
  try {
    return JSON.stringify(details);
  } catch {
    return '{"error":"shadowDebugDetailsNotSerializable"}';
  }
}

function isShadowDebugLoggingEnabled(): boolean {
  const global = globalThis as {
    __FPS_SHADOW_DEBUG__?: unknown;
    localStorage?: { getItem?: (key: string) => string | null };
    location?: { search?: string };
    process?: { env?: Record<string, string | undefined> };
  };
  if (global.__FPS_SHADOW_DEBUG__ === true) return true;
  const env = global.process?.env?.FPS_SHADOW_DEBUG;
  if (env === '1' || env === 'true') return true;
  try {
    const search = global.location?.search ?? '';
    if (/(?:[?&])fpsShadowDebug(?:=1|=true|&|$)/.test(search)) return true;
  } catch {}
  try {
    const stored = global.localStorage?.getItem?.(SHADOW_DEBUG_STORAGE_KEY);
    return stored === '1' || stored === 'true';
  } catch {
    return false;
  }
}
