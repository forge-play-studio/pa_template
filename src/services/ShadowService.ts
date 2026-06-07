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
  createStaticProjectedShadowSystem,
  type BlobShadowOptions,
  type PlanarShadowOptions,
  type StaticProjectedShadowOptions,
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

interface RuntimeStaticProjectedShadowSystem {
  initialize(): void;
  refresh(): void;
  setOptions(options: Partial<StaticProjectedShadowOptions>): void;
  addCaster(mesh: unknown): void;
  removeCaster(mesh: unknown): void;
  invalidateCaster(mesh: unknown): void;
  dispose(): void;
}

type SceneShadowMode = 'none' | 'blob' | 'static' | 'planar' | 'dynamic';
type ShadowServiceMode = 'none' | 'blob' | 'static' | 'legacy' | 'planar' | 'mixed';

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
  private staticProjectedShadowSystem: RuntimeStaticProjectedShadowSystem | null = null;
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
    if (this.config.blob.enabled) this.initializeBlobShadows();
    if (this.config.staticProjected.enabled) this.initializeStaticProjectedShadows();
    if (this.isPlanarEnabled()) this.initializePlanarShadows();
    if (this.config.enabled) this.initializeLegacyShadows();
    else this.scene.shadowsEnabled = false;

    this.mode = this.resolveServiceMode();
    this.applyShadowMeshes();
    this.attachNewMeshObserver();
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

  }

  /**
   * 刷新阴影网格配置
   *
   * 在场景模型加载后调用
   */
  refreshShadowMeshes(): void {
    this.applyShadowMeshes();
    this.blobShadowSystem?.refresh();
    this.staticProjectedShadowSystem?.refresh();
    this.planarShadowSystem?.refresh();
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
    this.staticProjectedShadowSystem = createStaticProjectedShadowSystem(
      this.scene as any,
      this.light as any,
      this.createStaticProjectedShadowOptions(),
    ) as unknown as RuntimeStaticProjectedShadowSystem;
    this.staticProjectedShadowSystem.initialize();
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
      return;
    }

    const receiveShadows = this.isShadowReceiver(mesh.name);
    mesh.receiveShadows = receiveShadows && !!this.shadowGenerator;
    if (this.planarShadowSystem) {
      if (receiveShadows) this.planarShadowSystem.addReceiver(mesh);
      else this.planarShadowSystem.removeReceiver(mesh);
    }

    const mode = this.resolveMeshShadowMode(mesh);
    if (mode === 'blob') {
      this.blobShadowSystem?.addCaster(mesh);
      return;
    }
    if (mode === 'static') {
      this.staticProjectedShadowSystem?.addCaster(mesh);
      return;
    }
    if (mode === 'planar') {
      this.planarShadowSystem?.addCaster(mesh);
      return;
    }
    if (mode === 'dynamic' && this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(mesh, true);
    }
  }

  private removeMeshFromShadowSystems(mesh: AbstractMesh): void {
    this.blobShadowSystem?.removeCaster(mesh);
    this.staticProjectedShadowSystem?.removeCaster(mesh);
    this.planarShadowSystem?.removeCaster(mesh);
    this.planarShadowSystem?.removeReceiver(mesh);
    this.shadowGenerator?.removeShadowCaster(mesh, true);
  }

  /**
   * 检查网格是否为阴影接收者
   */
  private isShadowReceiver(name: string): boolean {
    return this.isNameMatched(name, this.shadowReceivers);
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
    const mode = this.readMeshShadowMode(mesh);
    if (!mode || mode === 'default') return this.config.defaultMode ?? 'static';
    return mode;
  }

  private readMeshShadowMode(mesh: AbstractMesh): SceneShadowMode | 'default' | null {
    for (const node of this.walkNodeAndParents(mesh)) {
      const mode = this.readEditorProjectionMetadata(node)?.shadowMode;
      if (mode === 'default' || mode === 'none' || mode === 'blob' || mode === 'static' || mode === 'planar' || mode === 'dynamic') {
        return mode;
      }
    }
    return null;
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

  private isPlanarEnabled(): boolean {
    return this.renderingProfile.shadows.planar.enabled;
  }

  private resolveServiceMode(): ShadowServiceMode {
    const modes: ShadowServiceMode[] = [];
    if (this.blobShadowSystem) modes.push('blob');
    if (this.staticProjectedShadowSystem) modes.push('static');
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

    if (this.staticProjectedShadowSystem) {
      this.staticProjectedShadowSystem.dispose();
      this.staticProjectedShadowSystem = null;
    }

    if (this.planarShadowSystem) {
      this.planarShadowSystem.dispose();
      this.planarShadowSystem = null;
    }

  }
}
