/**
 * ShadowService - 阴影管理服务
 *
 * 职责：桥接 SDK Shadow V2 runtime resolver 与项目阴影系统生命周期
 */

import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Observer } from '@babylonjs/core/Misc/observable';
import { Scene } from '@babylonjs/core/scene';
import {
  createBlobShadowSystem,
  createDynamicShadowSystem,
  createPlanarShadowSystem,
  createStaticProjectedShadowBakeHashes,
  createStaticProjectedShadowArtifactSystem,
  readEditorShadowRuntimePlan,
  readEditorShadowSettings,
  resolveEditorShadowRuntimeState,
  type BlobShadowOptions,
  type DynamicShadowParams,
  type PlanarShadowOptions,
  type StaticProjectedShadowArtifact,
  type StaticProjectedShadowArtifactHashInput,
  type StaticProjectedShadowArtifactOptions,
  type StaticProjectedShadowArtifactSystem,
  type StaticProjectedShadowOptions,
  type EditorShadowRuntimeCasterState,
  type EditorShadowRuntimeMaterialLightingModel,
  type EditorShadowRuntimeReceiverState,
  type EditorShadowRuntimeState,
  type EditorShadowRuntimeTarget,
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
interface RuntimeDynamicShadowSystem {
  initialize(): void;
  addCaster(mesh: unknown): boolean;
  removeCaster(mesh: unknown): void;
  addReceiver(mesh: unknown): void;
  removeReceiver(mesh: unknown): void;
  setCamera(camera: unknown): void;
  setOptions(options: {
    enabled?: boolean;
    camera?: unknown;
    params?: DynamicShadowParams;
  }): void;
  refresh(): void;
  getShadowGenerator(): RuntimeDynamicShadowGenerator;
  getDiagnostics(): unknown;
  dispose(): void;
}

type SceneShadowMode = 'none' | 'blob' | 'static' | 'planar' | 'dynamic';
type RuntimeDynamicShadowSystemFactory = (
  scene: unknown,
  directionalLight: unknown,
  options: {
    enabled: boolean;
    camera?: unknown;
    params: DynamicShadowParams;
  },
) => RuntimeDynamicShadowSystem;
type RuntimeDynamicShadowGenerator = {
  getClassName?: () => string;
  getShadowMap?: () => { getSize?: () => unknown; renderList?: AbstractMesh[] } | null;
  getDarkness?: () => number;
  bias?: number;
  normalBias?: number;
  useBlurExponentialShadowMap?: boolean;
  blurKernel?: number;
} | null;
type ShadowServiceMode = 'none' | 'blob' | 'static' | 'dynamic' | 'planar' | 'mixed';
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
  private dynamicShadowSystem: RuntimeDynamicShadowSystem | null = null;
  private blobShadowSystem: RuntimeBlobShadowSystem | null = null;
  private staticProjectedShadowArtifactSystem: RuntimeStaticProjectedShadowArtifactSystem | null = null;
  private planarShadowSystem: RuntimePlanarShadowSystem | null = null;
  private readonly dynamicReceiverMeshes = new Set<AbstractMesh>();
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
    if (!this.config.enabled) this.scene.shadowsEnabled = false;

    this.mode = this.resolveServiceMode();
    this.applyShadowMeshes();
    this.attachNewMeshObserver();
    this.logShadowDebug('service.initialize.complete', {
      mode: this.mode,
      shadowsEnabled: this.scene.shadowsEnabled,
      shadowGenerator: this.describeShadowGenerator(),
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
  getShadowGenerator(): RuntimeDynamicShadowGenerator {
    return this.dynamicShadowSystem?.getShadowGenerator() ?? null;
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
    this.reconcileDynamicReceivers(this.resolveShadowRuntimeState(), new Set([this.readMeshRuntimeTargetId(mesh)]));
  }

  /**
   * 设置网格为阴影接收者
   */
  setShadowReceiver(mesh: AbstractMesh, receive: boolean): void {
    if (this.planarShadowSystem) {
      if (receive) this.planarShadowSystem.addReceiver(mesh);
      else this.planarShadowSystem.removeReceiver(mesh);
    }
    if (this.dynamicShadowSystem?.getShadowGenerator()) {
      if (receive) this.dynamicShadowSystem.addReceiver(mesh);
      else this.dynamicShadowSystem.removeReceiver(mesh);
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
    const runtimeState = this.resolveShadowRuntimeState();
    for (const mesh of this.scene.meshes) {
      this.applyShadowToMeshWithRuntimeState(mesh, runtimeState);
    }
    this.reconcileDynamicReceivers(runtimeState);
    this.dynamicShadowSystem?.refresh();
    this.logRuntimeDiagnostics(runtimeState);
  }

  /**
   * 应用阴影配置到单个网格
   */
  private applyShadowToMesh(mesh: AbstractMesh): void {
    const runtimeState = this.resolveShadowRuntimeState();
    this.applyShadowToMeshWithRuntimeState(mesh, runtimeState);
    this.reconcileDynamicReceivers(runtimeState);
    this.dynamicShadowSystem?.refresh();
    this.logRuntimeDiagnostics(runtimeState);
  }

  private applyShadowToMeshWithRuntimeState(mesh: AbstractMesh, runtimeState: EditorShadowRuntimeState): void {
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

    const targetId = this.readMeshRuntimeTargetId(mesh);
    const caster = runtimeState.casters.find(entry => entry.targetId === targetId) ?? null;
    const mode = caster ? this.resolveShadowModeFromRuntimeCaster(caster) : 'none';
    const receiverBindings = this.findRuntimeReceiverBindings(runtimeState, targetId);
    const receiveShadows = this.applyRuntimeReceiverBindings(mesh, receiverBindings);
    const canRenderCaster = !!caster && this.canRenderRuntimeCaster(caster);
    const dynamicReady = mode === 'dynamic'
      ? canRenderCaster && this.ensureDynamicShadowSystem(caster.params)
      : this.dynamicShadowSystem?.getShadowGenerator() != null;

    this.logShadowDebug('service.mesh.apply', this.describeMeshShadowDecision(mesh, {
      mode,
      receiveShadows,
      dynamicReady,
    }));

    if (!canRenderCaster) {
      this.logShadowDebug('service.caster.skippedNoReceiver', this.describeMeshShadowDecision(mesh, {
        mode,
        receiveShadows,
        dynamicReady,
      }));
      return;
    }

    if (!caster) return;
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
    if (mode === 'dynamic' && this.dynamicShadowSystem) {
      this.dynamicShadowSystem.addCaster(mesh);
      this.logShadowDebug('service.dynamicPlan.apply', {
        mesh: this.describeMesh(mesh),
        plan: this.describeResolvedPlan(caster.plan),
        diagnostics: caster.diagnostics,
        generator: this.describeShadowGenerator(),
      });
    }
  }

  private reconcileDynamicReceivers(
    runtimeState: EditorShadowRuntimeState,
    excludedCasterTargetIds: ReadonlySet<string> = new Set(),
  ): void {
    if (!this.dynamicShadowSystem?.getShadowGenerator()) return;
    const nextReceivers = new Set<AbstractMesh>();
    for (const caster of runtimeState.casters) {
      if (excludedCasterTargetIds.has(caster.targetId)) continue;
      if (caster.backend !== 'dynamic-map') continue;
      for (const receiver of caster.receivers) {
        if (!receiver.receiveDynamicShadows) continue;
        const receiverMesh = this.findMeshByRuntimeTargetId(receiver.targetId);
        if (receiverMesh) nextReceivers.add(receiverMesh);
      }
    }
    for (const mesh of this.dynamicReceiverMeshes) {
      if (!nextReceivers.has(mesh)) this.dynamicShadowSystem.removeReceiver(mesh);
    }
    for (const mesh of nextReceivers) {
      this.dynamicShadowSystem.addReceiver(mesh);
    }
    this.dynamicReceiverMeshes.clear();
    for (const mesh of nextReceivers) this.dynamicReceiverMeshes.add(mesh);
  }

  private removeMeshFromShadowSystems(mesh: AbstractMesh): void {
    this.blobShadowSystem?.removeCaster(mesh);
    this.planarShadowSystem?.removeCaster(mesh);
    this.planarShadowSystem?.removeReceiver(mesh);
    this.dynamicShadowSystem?.removeCaster(mesh);
    this.dynamicShadowSystem?.removeReceiver(mesh);
    this.dynamicReceiverMeshes.delete(mesh);
  }

  /**
   * 检查网格是否为阴影接收者
   */
  isShadowReceiver(mesh: AbstractMesh): boolean {
    const runtimeState = this.resolveShadowRuntimeState();
    return this.findRuntimeReceiverBindings(runtimeState, this.readMeshRuntimeTargetId(mesh))
      .some(binding => binding.receiver.receiveShadows);
  }

  canRenderShadowCaster(mesh: AbstractMesh, mode: SceneShadowMode): boolean {
    if (mode !== 'blob' && mode !== 'planar' && mode !== 'dynamic') return true;
    const runtimeState = this.resolveShadowRuntimeState();
    const caster = runtimeState.casters.find(entry => entry.targetId === this.readMeshRuntimeTargetId(mesh));
    return !!caster && this.canRenderRuntimeCaster(caster);
  }

  private resolveShadowRuntimeState(): EditorShadowRuntimeState {
    return resolveEditorShadowRuntimeState({
      targets: this.scene.meshes.map(mesh => this.createShadowRuntimeTarget(mesh)),
      fallbackMode: this.config.defaultMode === 'planar' ? 'projected' : this.config.defaultMode,
      legacyReceiverPatterns: this.shadowReceivers,
    });
  }

  private createShadowRuntimeTarget(mesh: AbstractMesh): EditorShadowRuntimeTarget {
    const projection = this.readEditorProjectionMetadata(mesh);
    const nodeIds = this.readMeshProjectionNodeIds(mesh);
    return {
      id: this.readMeshRuntimeTargetId(mesh),
      name: mesh.name,
      nodeIds,
      ...(typeof projection?.rootNodeId === 'string' ? { rootNodeId: projection.rootNodeId } : {}),
      active: !(typeof mesh.isDisposed === 'function' && mesh.isDisposed()) && !this.isGeneratedShadowExcluded(mesh),
      visible: mesh.isVisible !== false,
      shadowMode: this.readMeshShadowMode(mesh),
      shadow: this.readMeshShadowReceiveSettings(mesh),
      shadowPlan: this.readMeshShadowPlan(mesh),
      materialLightingModel: this.readMeshMaterialLightingModel(mesh),
    };
  }

  private readMeshRuntimeTargetId(mesh: AbstractMesh): string {
    const projection = this.readEditorProjectionMetadata(mesh);
    const nodeId = projection?.nodeId;
    if (typeof nodeId === 'string' && nodeId.trim()) return nodeId.trim();
    const id = (mesh as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id.trim();
    return mesh.name;
  }

  private findRuntimeReceiverBindings(
    runtimeState: EditorShadowRuntimeState,
    targetId: string,
  ): Array<{ caster: EditorShadowRuntimeCasterState; receiver: EditorShadowRuntimeReceiverState }> {
    const bindings: Array<{ caster: EditorShadowRuntimeCasterState; receiver: EditorShadowRuntimeReceiverState }> = [];
    const seen = new Set<string>();
    for (const caster of runtimeState.casters) {
      for (const receiver of caster.receivers) {
        if (receiver.targetId !== targetId) continue;
        const key = `${caster.targetId}:${receiver.targetId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bindings.push({ caster, receiver });
      }
    }
    return bindings;
  }

  private applyRuntimeReceiverBindings(
    mesh: AbstractMesh,
    bindings: Array<{ caster: EditorShadowRuntimeCasterState; receiver: EditorShadowRuntimeReceiverState }>,
  ): boolean {
    let dynamicReceiveShadows = false;
    let planarReceiveShadows = false;
    for (const binding of bindings) {
      if (!binding.receiver.receiveShadows) continue;
      if (binding.caster.backend === 'dynamic-map') {
        if (binding.receiver.receiveDynamicShadows) dynamicReceiveShadows = true;
        continue;
      }
      if (binding.caster.backend === 'projected') planarReceiveShadows = true;
    }
    if (this.planarShadowSystem) {
      if (planarReceiveShadows) this.planarShadowSystem.addReceiver(mesh);
      else this.planarShadowSystem.removeReceiver(mesh);
    }
    if (this.dynamicShadowSystem?.getShadowGenerator()) {
      if (dynamicReceiveShadows) this.dynamicShadowSystem.addReceiver(mesh);
      else this.dynamicShadowSystem.removeReceiver(mesh);
    }
    return planarReceiveShadows || dynamicReceiveShadows;
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
      if (this.isRuntimeVfxShadowExcludedNode(node)) return true;
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

  private isRuntimeVfxShadowExcludedNode(node: unknown): boolean {
    const name = this.readNodeName(node).toLowerCase();
    if (name.startsWith('vfx_') || name.startsWith('vfx_package_')) return true;

    const metadata = this.readMetadata(node);
    if (metadata?.runtimeVfx === true || metadata?.effectPackage != null) return true;

    const projection = this.readEditorProjectionMetadata(node);
    if (
      projection?.runtimeVfx === true
      || projection?.effectPackage != null
      || projection?.runtimeKind === 'vfx'
      || projection?.runtimeKind === 'effectPackage'
    ) {
      return true;
    }

    return false;
  }

  resolveMeshShadowMode(mesh: AbstractMesh): SceneShadowMode {
    const runtimeState = this.resolveShadowRuntimeState();
    const caster = runtimeState.casters.find(entry => entry.targetId === this.readMeshRuntimeTargetId(mesh));
    return caster ? this.resolveShadowModeFromRuntimeCaster(caster) : 'none';
  }

  private resolveShadowModeFromRuntimeCaster(caster: EditorShadowRuntimeCasterState): SceneShadowMode {
    if (caster.backend === 'none' || caster.mode === 'none') return 'none';
    if (caster.backend === 'projected' || caster.mode === 'projected') return 'planar';
    if (caster.backend === 'dynamic-map' || caster.mode === 'dynamic') return 'dynamic';
    if (caster.backend === 'static-baked' || caster.mode === 'static') return 'static';
    if (caster.backend === 'blob' || caster.mode === 'blob') return 'blob';
    return 'none';
  }

  private canRenderRuntimeCaster(caster: EditorShadowRuntimeCasterState): boolean {
    const mode = this.resolveShadowModeFromRuntimeCaster(caster);
    if (mode !== 'blob' && mode !== 'planar' && mode !== 'dynamic') return true;
    return caster.receiverTargetIds.length > 0;
  }

  private ensureDynamicShadowSystem(params?: Partial<DynamicShadowParams>): boolean {
    const resolvedParams = this.createDynamicShadowParams(params);
    if (!this.dynamicShadowSystem) {
      const createRuntimeDynamicShadowSystem = createDynamicShadowSystem as unknown as RuntimeDynamicShadowSystemFactory;
      this.dynamicShadowSystem = createRuntimeDynamicShadowSystem(
        this.scene,
        this.light,
        {
          enabled: true,
          camera: this.camera,
          params: resolvedParams,
        },
      ) as unknown as RuntimeDynamicShadowSystem;
      this.dynamicShadowSystem.initialize();
    } else {
      this.dynamicShadowSystem.setCamera(this.camera);
      this.dynamicShadowSystem.setOptions({
        enabled: true,
        params: resolvedParams,
      });
    }
    this.mode = this.resolveServiceMode();
    const ready = this.dynamicShadowSystem.getShadowGenerator() != null;
    if (!ready) {
      this.logShadowDebug('service.dynamicSystem.unavailable', {
        mode: this.mode,
        shadowsEnabled: this.scene.shadowsEnabled,
      });
      return false;
    }
    this.logShadowDebug('service.dynamicSystem.ready', {
      mode: this.mode,
      light: this.describeDirectionalLight(),
      generator: this.describeShadowGenerator(),
      diagnostics: this.dynamicShadowSystem.getDiagnostics(),
    });
    return true;
  }

  private createDynamicShadowParams(params?: Partial<DynamicShadowParams>): DynamicShadowParams {
    const settings = this.config.settings;
    return {
      opacity: this.clamp01(params?.opacity ?? 1 - settings.darkness),
      softness: this.clamp01(params?.softness ?? 0.4),
      bias: this.readFiniteNumber(params?.bias, settings.bias),
      normalBias: this.readFiniteNumber(params?.normalBias, settings.normalBias),
      maxDistance: this.readPositiveNumber(params?.maxDistance, settings.shadowMaxZ),
      resolution: this.readDynamicShadowResolution(params?.resolution ?? settings.mapSize),
      cascadeCount: this.readDynamicShadowCascadeCount(params?.cascadeCount ?? this.config.csm.numCascades),
      blurKernel: Math.max(0, Math.round(this.readFiniteNumber(params?.blurKernel, settings.blurKernel))),
    };
  }

  private findMeshByRuntimeTargetId(targetId: string): AbstractMesh | null {
    return this.scene.meshes.find(mesh => this.readMeshRuntimeTargetId(mesh) === targetId) ?? null;
  }

  private readMeshMaterialLightingModel(mesh: AbstractMesh): EditorShadowRuntimeMaterialLightingModel {
    const material = (mesh as { material?: unknown }).material as {
      unlit?: unknown;
      disableLighting?: unknown;
    } | null | undefined;
    if (material?.unlit === true || material?.disableLighting === true) return 'unlit';
    if (material?.unlit === false || material?.disableLighting === false) return 'lit';
    for (const node of this.walkNodeAndParents(mesh)) {
      const metadata = this.readMetadata(node);
      const projection = this.readEditorProjectionMetadata(node);
      const candidates = [
        metadata?.lightingModel,
        this.readObject(metadata?.material)?.lightingModel,
        this.readObject(this.readObject(metadata?.material)?.profile)?.lightingModel,
        projection?.lightingModel,
        this.readObject(projection?.material)?.lightingModel,
        this.readObject(projection?.materialProfile)?.lightingModel,
      ];
      for (const value of candidates) {
        if (value === 'lit' || value === 'unlit') return value;
      }
    }
    return 'unknown';
  }

  private logRuntimeDiagnostics(runtimeState: EditorShadowRuntimeState): void {
    if (runtimeState.diagnostics.length === 0) return;
    this.logShadowDebug('service.runtimeDiagnostics', {
      diagnostics: runtimeState.diagnostics,
    });
  }

  private readFiniteNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private readPositiveNumber(value: unknown, fallback: number): number {
    const number = this.readFiniteNumber(value, fallback);
    return number > 0 ? number : fallback;
  }

  private readDynamicShadowResolution(value: unknown): DynamicShadowParams['resolution'] {
    return value === 512 || value === 1024 || value === 2048 || value === 4096 ? value : 1024;
  }

  private readDynamicShadowCascadeCount(value: unknown): DynamicShadowParams['cascadeCount'] {
    return value === 1 || value === 2 || value === 4 ? value : 1;
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
    const shadowGenerator = this.getShadowGenerator();
    if (!shadowGenerator) return null;
    return {
      className: shadowGenerator.getClassName?.(),
      mapSize: shadowGenerator.getShadowMap?.()?.getSize?.(),
      darkness: shadowGenerator.getDarkness?.(),
      bias: shadowGenerator.bias,
      normalBias: shadowGenerator.normalBias,
      useBlurExponentialShadowMap: shadowGenerator.useBlurExponentialShadowMap,
      blurKernel: shadowGenerator.blurKernel,
      renderList: (shadowGenerator.getShadowMap?.()?.renderList ?? []).map(mesh => this.describeMesh(mesh)),
      dynamicDiagnostics: this.dynamicShadowSystem?.getDiagnostics(),
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

  private readMeshShadowReceiveSettings(mesh: AbstractMesh): EditorShadowSettings | null {
    for (const node of this.walkNodeAndParents(mesh)) {
      const settings = this.readMeshShadowSettingsFromProjection(node);
      if (settings) return settings;
    }
    return null;
  }

  private readMeshShadowSettingsFromProjection(node: unknown): EditorShadowSettings | null {
    return readEditorShadowSettings(this.readEditorProjectionMetadata(node)?.shadow) ?? null;
  }

  private readMeshShadowPlan(mesh: AbstractMesh): EditorShadowResolvedPlan | null {
    for (const node of this.walkNodeAndParents(mesh)) {
      const plan = readEditorShadowRuntimePlan(this.readEditorProjectionMetadata(node)?.shadowPlan);
      if (plan) return plan;
    }
    return null;
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

  private readNodeName(node: unknown): string {
    return typeof (node as { name?: unknown })?.name === 'string'
      ? (node as { name: string }).name
      : '';
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
    if (this.dynamicShadowSystem?.getShadowGenerator()) modes.push('dynamic');
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

    if (this.dynamicShadowSystem) {
      this.dynamicShadowSystem.dispose();
      this.dynamicShadowSystem = null;
    }
    this.dynamicReceiverMeshes.clear();

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
