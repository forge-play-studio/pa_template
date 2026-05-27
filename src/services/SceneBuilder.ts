/**
 * SceneBuilder - 场景构建服务 (Scaffold)
 *
 * 职责：
 * - 创建基础场景环境（相机/灯光/渲染管线/阴影）
 * - 从配置加载场景实例（可选：GLB 场景/道具）
 *
 * 注意：这是“去业务化”的脚手架版本：
 * - 不包含 zones / interactionSlots / decals 等强场景绑定能力
 * - 这些能力应在具体游戏项目中按需扩展（保持文件名/入口一致，可迁移）
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { resolveTextureAssetUrl } from '../assets/index';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';

import { AssetLoader } from './AssetLoader';
import { ModelPool } from './ModelPool';
import { RenderingService } from './RenderingService';
import { ShadowService } from './ShadowService';
import { applyMaterialDebugAdjustments } from '../utils/materialDebugAdjust';

import renderingConfig from '../config/rendering.json';
import {
  configService,
  type ColorRGB,
  type MaterialOverrideConfig,
  type OutlineOverrideConfig,
  type SceneAssetConfig,
  type SceneAssetMaterialMode,
  type SceneCameraProjection,
  type SceneCameraRigConfig,
  type SceneDirectionalLightConfig,
  type SceneInstanceNode,
  type ScenePrimitiveNode,
  type SceneSharedMaterialConfig,
  type SceneNodeConfig,
  type SceneRuntimeSourceBinding,
  type SceneTransformNode,
  type TransformConfig,
} from '../config';
import {
  applyMaterialValueToRuntimeMaterial,
  applyMaterialValueToRuntimeNode,
  resolveMaterialRuntimeKind,
  resolveMaterialOwnerNode,
  resolveOutlineTarget,
} from '@fps-games/editor-babylon';

const DEFAULT_CAMERA_FOV = 0.85;
const DEFAULT_CAMERA_LOWER_BETA_LIMIT = 0.1;
const DEFAULT_CAMERA_UPPER_BETA_LIMIT = 1.45;
const DEFAULT_CAMERA_RADIUS_LIMIT_FACTOR_MIN = 0.25;
const DEFAULT_CAMERA_RADIUS_LIMIT_FACTOR_MAX = 4;
const MIN_CAMERA_RADIUS_LIMIT = 0.1;

/** 场景环境构建结果 */
export interface SceneEnvironment {
  camera: ArcRotateCamera;
  hemisphericLight: HemisphericLight;
  directionalLight: DirectionalLight;
  renderingService: RenderingService;
  shadowService: ShadowService;
}

export class SceneBuilder {
  private scene: Scene;
  private assetLoader: AssetLoader;
  private modelPool: ModelPool | null = null;

  private root: TransformNode;
  readonly sceneNodeRuntimes = new Map<string, TransformNode>();
  private sceneNodeCleanup = new Map<string, (() => void) | null>();
  private sceneAssetConfigs = new Map<string, SceneAssetConfig>();
  private selectedCameraRig: SceneCameraRigConfig | null = null;

  constructor(scene: Scene, assetLoader: AssetLoader, modelPool?: ModelPool) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.modelPool = modelPool ?? null;

    this.root = new TransformNode('scene_builder_root', scene);
  }

  setModelPool(pool: ModelPool): void {
    this.modelPool = pool;
  }

  registerRuntimeModelUrl(assetId: string, url: string): void {
    this.assetLoader.registerRuntimeModelUrl(assetId, url);
  }

  upsertSceneAssetConfig(asset: SceneAssetConfig): void {
    this.sceneAssetConfigs.set(asset.id, asset);
  }

  async preloadSceneAsset(asset: SceneAssetConfig): Promise<void> {
    this.upsertSceneAssetConfig(asset);
    await this.assetLoader.loadAssetContainer(asset.id);
  }

  getRootNode(): TransformNode {
    return this.root;
  }

  // ============================================================
  // 环境构建
  // ============================================================

  buildSceneEnvironment(): SceneEnvironment {
    // 1) Camera
    const camera = this.createCamera();
    this.enforceMainCamera(camera);

    // 2) Lights
    const { hemisphericLight, directionalLight } = this.createLights();

    // 3) Rendering pipeline
    const renderingService = new RenderingService(this.scene);
    renderingService.initialize([camera]);

    // 4) Shadows (可通过 rendering.json 开关)
    const shadowService = new ShadowService(this.scene, directionalLight, camera);
    shadowService.initialize();

    // 5) 默认地面（让脚手架“开箱即有东西可见”）
    this.buildDefaultGround();
    this.buildLayoutPlaceholderSurfaces();

    return { camera, hemisphericLight, directionalLight, renderingService, shadowService };
  }

  private createCamera(): ArcRotateCamera {
    const cameraNode = configService.getSceneCameraNode();
    const cameraRig = applyCameraRigLimitDefaults(cloneCameraRig(cameraNode?.camera ?? this.resolveFallbackCameraRig()));
    this.selectedCameraRig = cloneCameraRig(cameraRig);
    const target = this.getCameraRigTarget(cameraRig);

    const camera = new ArcRotateCamera(
      'mainCamera',
      cameraRig.alpha,
      cameraRig.beta,
      cameraRig.radius,
      target,
      this.scene
    );

    this.attachMainCameraMetadata(camera, cameraNode?.source);
    this.applyCameraRuntimeProperties(camera, cameraRig, target);

    return camera;
  }

  updateCameraProjection(camera: ArcRotateCamera): void {
    const cameraRig = this.selectedCameraRig ?? this.resolveCameraRig();
    const projection = resolveCameraProjection(cameraRig.projection);
    if (projection === 'perspective') {
      camera.mode = Camera.PERSPECTIVE_CAMERA;
      camera.fov = resolveCameraFov(cameraRig.fov);
      return;
    }

    camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    const orthoSize = cameraRig.orthoSize;
    const engine = this.scene.getEngine();
    const width = Math.max(1, engine.getRenderWidth());
    const height = Math.max(1, engine.getRenderHeight());
    const halfH = orthoSize;
    const halfW = orthoSize * (width / height);
    camera.orthoLeft = -halfW;
    camera.orthoRight = halfW;
    camera.orthoBottom = -halfH;
    camera.orthoTop = halfH;
  }

  applyCameraRig(camera: ArcRotateCamera, cameraRig: SceneCameraRigConfig, target?: Vector3): void {
    const nextRig = applyCameraRigLimitDefaults(cloneCameraRig(cameraRig));
    this.selectedCameraRig = cloneCameraRig(nextRig);
    this.relaxCameraLimitsForRigAssignment(camera);
    this.applyCameraRuntimeProperties(camera, nextRig, target ?? camera.target.clone());
  }

  getSelectedCameraRig(): SceneCameraRigConfig {
    const cameraRig = this.selectedCameraRig ?? this.resolveCameraRig();
    return cloneCameraRig(cameraRig);
  }

  getSelectedCameraOrthoSize(): number {
    const cameraRig = this.selectedCameraRig ?? this.resolveCameraRig();
    return cameraRig.orthoSize;
  }

  private getCameraRigTarget(cameraRig: SceneCameraRigConfig, fallback?: Vector3): Vector3 {
    const targetOffset = getCameraTargetOffset(cameraRig);
    if (targetOffset) return new Vector3(targetOffset.x, targetOffset.y, targetOffset.z);
    if (fallback) return fallback.clone();
    return this.resolveFallbackCameraTarget();
  }

  private applyCameraRuntimeProperties(camera: ArcRotateCamera, cameraRig: SceneCameraRigConfig, target: Vector3): void {
    const betaLimits = resolveCameraBetaLimitDefaults(cameraRig.beta, cameraRig.lowerBetaLimit, cameraRig.upperBetaLimit);
    const radiusLimits = resolveCameraRadiusLimitDefaults(cameraRig.radius, cameraRig.lowerRadiusLimit, cameraRig.upperRadiusLimit);
    camera.target = target;
    camera.alpha = cameraRig.alpha;
    camera.beta = cameraRig.beta;
    camera.radius = cameraRig.radius;
    camera.lowerAlphaLimit = cameraRig.alpha;
    camera.upperAlphaLimit = cameraRig.alpha;
    camera.lowerBetaLimit = betaLimits.lower;
    camera.upperBetaLimit = betaLimits.upper;
    camera.lowerRadiusLimit = radiusLimits.lower;
    camera.upperRadiusLimit = radiusLimits.upper;
    camera.minZ = cameraRig.minZ ?? 1;
    camera.maxZ = cameraRig.maxZ ?? 10000;
    camera.inertia = cameraRig.inertia ?? 0.9;
    const screenOffset = cameraRig.targetScreenOffset ?? { x: 0, y: 0 };
    camera.targetScreenOffset = new Vector2(screenOffset.x, screenOffset.y);
    this.updateCameraProjection(camera);
  }

  private relaxCameraLimitsForRigAssignment(camera: ArcRotateCamera): void {
    camera.lowerAlphaLimit = null;
    camera.upperAlphaLimit = null;
    camera.lowerBetaLimit = null;
    camera.upperBetaLimit = null;
    camera.lowerRadiusLimit = null;
    camera.upperRadiusLimit = null;
  }

  private enforceMainCamera(camera: ArcRotateCamera): void {
    this.scene.activeCamera = camera;
    if (!this.scene.activeCameras) {
      this.scene.activeCameras = [];
    }
    this.scene.activeCameras.length = 0;
    this.scene.activeCameras.push(camera);
  }

  private createLights(): { hemisphericLight: HemisphericLight; directionalLight: DirectionalLight } {
    const lightsCfg = (renderingConfig as any).globalVolume?.lights ?? {};

    const hemi = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    hemi.intensity = lightsCfg.hemispheric?.intensity ?? 0.8;
    const hemiDiffuse = lightsCfg.hemispheric?.diffuseColor ?? lightsCfg.hemispheric?.skyLightColor;
    if (hemiDiffuse) {
      hemi.diffuse = new Color3(hemiDiffuse.r, hemiDiffuse.g, hemiDiffuse.b);
    }

    const sun = this.resolveDirectionalLight();
    const dir = new DirectionalLight(
      'dirLight',
      new Vector3(sun.direction.x, sun.direction.y, sun.direction.z),
      this.scene,
    );
    dir.intensity = sun.intensity;
    if (sun.diffuseColor) {
      dir.diffuse = new Color3(sun.diffuseColor.r, sun.diffuseColor.g, sun.diffuseColor.b);
    }

    return { hemisphericLight: hemi, directionalLight: dir };
  }

  private resolveCameraRig(): SceneCameraRigConfig {
    return cloneCameraRig(configService.getSceneCameraRig() ?? this.resolveFallbackCameraRig());
  }

  private attachMainCameraMetadata(camera: ArcRotateCamera, source?: SceneRuntimeSourceBinding): void {
    if (!source) return;
    const metadata = camera.metadata && typeof camera.metadata === 'object' ? camera.metadata : {};
    camera.metadata = {
      ...metadata,
      __fpsEditor: {
        sourceId: source.sourceId,
        ...(source.objectGuid ? { objectGuid: source.objectGuid } : {}),
        ...(source.objectId ? { objectId: source.objectId } : {}),
        propertyPath: 'camera',
      },
    };
  }

  private resolveFallbackCameraRig(): SceneCameraRigConfig {
    const camCfg = (renderingConfig as any).globalVolume?.camera ?? {};
    const target = readPosition3D(camCfg.target);
    return applyCameraRigLimitDefaults({
      projection: readCameraProjection(camCfg.projection),
      alpha: readFiniteNumber(camCfg.alpha, Math.PI / 4),
      beta: readFiniteNumber(camCfg.beta, Math.PI / 4),
      radius: readPositiveFiniteNumber(camCfg.radius, 14),
      orthoSize: readPositiveFiniteNumber(camCfg.orthoSizeDesktop, 10),
      fov: readOptionalPositiveFiniteNumber(camCfg.fov) ?? DEFAULT_CAMERA_FOV,
      ...(target ? { targetOffset: target } : {}),
      minZ: readOptionalPositiveFiniteNumber(camCfg.minZ) ?? 1,
      maxZ: readOptionalPositiveFiniteNumber(camCfg.maxZ) ?? 10000,
      lowerBetaLimit: readFiniteNumber(camCfg.lowerBetaLimit, readFiniteNumber(camCfg.beta, Math.PI / 4)),
      upperBetaLimit: readFiniteNumber(camCfg.upperBetaLimit, readFiniteNumber(camCfg.beta, Math.PI / 4)),
      lowerRadiusLimit: readOptionalPositiveFiniteNumber(camCfg.lowerRadiusLimit) ?? readPositiveFiniteNumber(camCfg.radius, 14),
      upperRadiusLimit: readOptionalPositiveFiniteNumber(camCfg.upperRadiusLimit) ?? readPositiveFiniteNumber(camCfg.radius, 14),
      inertia: readOptionalUnitNumber(camCfg.inertia) ?? 0.9,
      targetScreenOffset: readPosition2D(camCfg.targetScreenOffset) ?? { x: 0, y: 0 },
    });
  }

  private resolveFallbackCameraTarget(): Vector3 {
    const camCfg = (renderingConfig as any).globalVolume?.camera ?? {};
    const target = readPosition3D(camCfg.target);
    if (!target) return new Vector3(0, 0, 0);
    return new Vector3(target.x, target.y, target.z);
  }

  private resolveDirectionalLight(): SceneDirectionalLightConfig {
    return configService.getSceneDirectionalLight() ?? this.resolveFallbackDirectionalLight();
  }

  private resolveFallbackDirectionalLight(): SceneDirectionalLightConfig {
    const lightsCfg = (renderingConfig as any).globalVolume?.lights ?? {};
    const directional = lightsCfg.directional ?? {};
    const direction = directional.direction ?? {};
    const diffuseColor = readColorRGB(directional.diffuseColor);
    return {
      type: 'directional',
      intensity: readNonNegativeFiniteNumber(directional.intensity, 1.2),
      direction: {
        x: readFiniteNumber(direction.x, -0.3),
        y: readFiniteNumber(direction.y, -1),
        z: readFiniteNumber(direction.z, -0.2),
      },
      ...(diffuseColor ? { diffuseColor } : {}),
    };
  }

  private buildDefaultGround(): void {
    // Temporary scaffold meshes are intentionally disabled.
    // Keep gameplay logic while allowing first real scene import.
  }

  private buildLayoutPlaceholderSurfaces(): void {
    const overlays = configService.getGroundOverlayPlanes();
    for (const overlay of overlays) {
      const mesh = MeshBuilder.CreateBox(overlay.id, {
        width: overlay.size.width,
        depth: overlay.size.depth,
        height: 0.04,
      }, this.scene);
      const overlayY = Number((overlay as any).position?.y ?? 0.02);
      mesh.position.set(overlay.position.x, overlayY, overlay.position.z);
      if (overlay.scaling) {
        mesh.scaling.set(overlay.scaling.x, overlay.scaling.y, overlay.scaling.z);
      }
      mesh.parent = this.root;

      const mat = new StandardMaterial(`${overlay.id}_mat`, this.scene);
      mat.diffuseColor = new Color3(overlay.color.r, overlay.color.g, overlay.color.b);
      mat.specularColor = new Color3(0, 0, 0);
      
      const textureUrl = overlay.textureId ? resolveTextureAssetUrl(overlay.textureId) : undefined;
      if (textureUrl) {
        const texture = new Texture(textureUrl, this.scene);
        texture.hasAlpha = true;
        mat.diffuseTexture = texture;
        mat.useAlphaFromDiffuseTexture = true;
        mat.diffuseColor = new Color3(1, 1, 1);
        mat.backFaceCulling = false;
      }

      mesh.material = mat;
    }
  }

  // ============================================================
  // 场景文档加载
  // ============================================================

  async loadSceneFromDocument(): Promise<void> {
    this.clearSceneRuntime();
    this.syncSceneAssetIndex();
    this.attachSceneNodeMetadata(this.root, configService.getSceneRootId());
    this.root.name = configService.getSceneRootId();
    this.root.id = configService.getSceneRootId();
    this.root.setEnabled(true);
    this.sceneNodeRuntimes.set(configService.getSceneRootId(), this.root);
    this.sceneNodeCleanup.set(configService.getSceneRootId(), null);

    const nodes = configService.getSceneNodes();
    if (nodes.length === 0) return;

    await this.buildSceneNodePass(nodes);
  }

  getSceneNodeRuntime(id: string): TransformNode | undefined {
    return this.sceneNodeRuntimes.get(id);
  }

  /**
   * 编辑器运行时可调用的最小增量接口。
   *
   * 新项目复制脚手架后，如果要支持 duplicate / undo / redo 等能力，
   * 至少需要让这个方法在自己的 SceneBuilder 上成立。
   */
  addSceneNodeFromConfig(nodeConfig: SceneNodeConfig, parent?: TransformNode | null): TransformNode | null {
    return this.buildSceneNodeRuntime(nodeConfig, 'sync', parent ?? undefined);
  }

  removeSceneNode(id: string): boolean {
    const node = this.sceneNodeRuntimes.get(id);
    if (!node || node === this.root) return false;

    const childIds = [...this.sceneNodeRuntimes.entries()]
      .filter(([, runtimeNode]) => runtimeNode.parent === node)
      .map(([childId]) => childId);
    for (const childId of childIds) {
      this.removeSceneNode(childId);
    }

    const cleanup = this.sceneNodeCleanup.get(id) ?? null;
    this.sceneNodeRuntimes.delete(id);
    this.sceneNodeCleanup.delete(id);
    node.parent = null;
    cleanup?.();
    node.dispose();
    return true;
  }

  private async addInitialSceneNode(nodeConfig: SceneNodeConfig): Promise<void> {
    await this.buildSceneNodeRuntime(nodeConfig, 'async');
  }

  private async buildSceneNodePass(nodeConfigs: SceneNodeConfig[]): Promise<void> {
    const pending = [...nodeConfigs];

    while (pending.length > 0) {
      let progressed = false;

      for (let index = 0; index < pending.length;) {
        const nodeConfig = pending[index];
        if (nodeConfig.parentId && !this.sceneNodeRuntimes.has(nodeConfig.parentId)) {
          index += 1;
          continue;
        }

        await this.addInitialSceneNode(nodeConfig);
        pending.splice(index, 1);
        progressed = true;
      }

      if (progressed) continue;

      for (const nodeConfig of pending) {
        console.warn(
          `[SceneBuilder] Parent "${nodeConfig.parentId}" not ready for node "${nodeConfig.id}", falling back to scene root.`,
        );
        await this.addInitialSceneNode({ ...nodeConfig, parentId: undefined });
      }
      pending.length = 0;
    }
  }

  private buildSceneNodeRuntime(
    nodeConfig: SceneNodeConfig,
    mode: 'async',
    parentOverride?: TransformNode | null,
  ): Promise<TransformNode | null>;
  private buildSceneNodeRuntime(
    nodeConfig: SceneNodeConfig,
    mode: 'sync',
    parentOverride?: TransformNode | null,
  ): TransformNode | null;
  private buildSceneNodeRuntime(
    nodeConfig: SceneNodeConfig,
    mode: 'async' | 'sync',
    parentOverride?: TransformNode | null,
  ): Promise<TransformNode | null> | TransformNode | null {
    const parent = parentOverride ?? this.resolveParentRuntime(nodeConfig.parentId);
    if (!parent) return null;

    const runtimeNode = this.createRuntimeNode(nodeConfig);
    runtimeNode.id = nodeConfig.id;
    this.attachSceneNodeMetadata(runtimeNode, nodeConfig.id, nodeConfig.source);
    this.applyTransform(runtimeNode, nodeConfig.transform);
    runtimeNode.parent = parent;
    runtimeNode.setEnabled(nodeConfig.enabled !== false);
    this.sceneNodeRuntimes.set(nodeConfig.id, runtimeNode);

    if (nodeConfig.kind === 'transform') {
      this.attachTransformRuntime(nodeConfig, runtimeNode);
      this.applyNodeMaterialEntries(nodeConfig, runtimeNode);
      this.applySceneNodeOverrides(nodeConfig, runtimeNode);
      this.sceneNodeCleanup.set(nodeConfig.id, null);
      return runtimeNode;
    }

    if (nodeConfig.kind === 'primitive') {
      this.applyNodeMaterialEntries(nodeConfig, runtimeNode);
      this.applySceneNodeOverrides(nodeConfig, runtimeNode);
      this.sceneNodeCleanup.set(nodeConfig.id, null);
      return runtimeNode;
    }

    if (nodeConfig.kind !== 'instance') {
      this.sceneNodeCleanup.set(nodeConfig.id, null);
      return runtimeNode;
    }

    if (mode === 'async') {
      return this.attachInstanceAssetAsync(nodeConfig, runtimeNode);
    }

    return this.attachInstanceAssetSync(nodeConfig, runtimeNode);
  }

  private createRuntimeNode(nodeConfig: SceneNodeConfig): TransformNode {
    if (nodeConfig.kind === 'transform' && nodeConfig.transformType === 'groundDecal' && nodeConfig.groundDecal) {
      return MeshBuilder.CreateGround(nodeConfig.name ?? nodeConfig.id, {
        width: nodeConfig.groundDecal.size.width,
        height: nodeConfig.groundDecal.size.depth,
      }, this.scene) as unknown as TransformNode;
    }

    if (nodeConfig.kind === 'primitive') {
      return this.createPrimitiveRuntimeNode(nodeConfig);
    }

    return new TransformNode(nodeConfig.name ?? nodeConfig.id, this.scene);
  }

  private createPrimitiveRuntimeNode(nodeConfig: ScenePrimitiveNode): TransformNode {
    const builder = MeshBuilder as unknown as {
      CreateBox?: typeof MeshBuilder.CreateBox;
      CreateSphere?: typeof MeshBuilder.CreateSphere;
      CreateGround?: typeof MeshBuilder.CreateGround;
      CreateCapsule?: (name: string, options: Record<string, unknown>, scene: Scene) => unknown;
      CreateCylinder?: typeof MeshBuilder.CreateCylinder;
    };
    const name = nodeConfig.name ?? nodeConfig.id;
    const shape = nodeConfig.primitive.shape;
    const mesh = shape === 'sphere'
      ? builder.CreateSphere?.(name, { diameter: 1, segments: 32 }, this.scene)
      : shape === 'plane'
        ? builder.CreateGround?.(name, { width: 1, height: 1, subdivisions: 1 }, this.scene)
        : shape === 'capsule'
          ? builder.CreateCapsule?.(name, { height: 2, radius: 0.5, tessellation: 24, subdivisions: 8 }, this.scene)
            ?? builder.CreateCylinder?.(name, { height: 2, diameter: 1, tessellation: 24 }, this.scene)
          : builder.CreateBox?.(name, { size: 1 }, this.scene);
    const runtimeNode = (mesh ?? new TransformNode(name, this.scene)) as TransformNode;
    const material = new StandardMaterial(`${nodeConfig.id}_primitive_mat`, this.scene);
    material.diffuseColor = new Color3(0.72, 0.74, 0.76);
    material.specularColor = new Color3(0.12, 0.14, 0.16);
    if (shape === 'plane') material.backFaceCulling = false;
    (runtimeNode as any).material = material;
    return runtimeNode;
  }

  private async attachInstanceAssetAsync(
    nodeConfig: SceneInstanceNode,
    runtimeNode: TransformNode,
  ): Promise<TransformNode | null> {
    let attached: { asset: SceneAssetConfig; modelNode: TransformNode; cleanup: () => void } | null = null;
    try {
      attached = await this.createSceneAssetRuntime(nodeConfig, 'async');
    } catch (error) {
      console.warn(`[SceneBuilder] Failed to attach scene asset for node "${nodeConfig.id}"`, error);
    }
    if (!attached) {
      this.sceneNodeRuntimes.delete(nodeConfig.id);
      runtimeNode.dispose();
      return null;
    }

    attached.modelNode.parent = runtimeNode;
    this.applyTransform(attached.modelNode, attached.asset.defaults?.transform);
    this.applyChildTransforms(attached.modelNode, nodeConfig.overrides?.childTransforms);
    this.applySharedMaterialOverrides(attached.asset, attached.modelNode);
    this.applyNodeMaterialEntries(nodeConfig, runtimeNode);
    this.applySharedOutlineOverrides(attached.asset, attached.modelNode);
    this.applySceneNodeOverrides(nodeConfig, runtimeNode, attached.asset);
    this.sceneNodeCleanup.set(nodeConfig.id, attached.cleanup);
    return runtimeNode;
  }

  private attachInstanceAssetSync(
    nodeConfig: SceneInstanceNode,
    runtimeNode: TransformNode,
  ): TransformNode | null {
    let attached: { asset: SceneAssetConfig; modelNode: TransformNode; cleanup: () => void } | null = null;
    try {
      attached = this.createSceneAssetRuntime(nodeConfig, 'sync');
    } catch (error) {
      console.warn(`[SceneBuilder] Failed to attach scene asset for node "${nodeConfig.id}"`, error);
    }
    if (!attached) {
      this.sceneNodeRuntimes.delete(nodeConfig.id);
      runtimeNode.dispose();
      return null;
    }

    attached.modelNode.parent = runtimeNode;
    this.applyTransform(attached.modelNode, attached.asset.defaults?.transform);
    this.applyChildTransforms(attached.modelNode, nodeConfig.overrides?.childTransforms);
    this.applySharedMaterialOverrides(attached.asset, attached.modelNode);
    this.applyNodeMaterialEntries(nodeConfig, runtimeNode);
    this.applySharedOutlineOverrides(attached.asset, attached.modelNode);
    this.applySceneNodeOverrides(nodeConfig, runtimeNode, attached.asset);
    this.sceneNodeCleanup.set(nodeConfig.id, attached.cleanup);
    return runtimeNode;
  }

  private async createSceneAssetRuntime(
    nodeConfig: SceneInstanceNode,
    mode: 'async',
  ): Promise<{ asset: SceneAssetConfig; modelNode: TransformNode; cleanup: () => void } | null>;
  private createSceneAssetRuntime(
    nodeConfig: SceneInstanceNode,
    mode: 'sync',
  ): { asset: SceneAssetConfig; modelNode: TransformNode; cleanup: () => void } | null;
  private createSceneAssetRuntime(
    nodeConfig: SceneInstanceNode,
    mode: 'async' | 'sync',
  ): Promise<{ asset: SceneAssetConfig; modelNode: TransformNode; cleanup: () => void } | null> | { asset: SceneAssetConfig; modelNode: TransformNode; cleanup: () => void } | null {
    const asset = this.sceneAssetConfigs.get(nodeConfig.instance.assetId) ?? configService.getSceneAssetById(nodeConfig.instance.assetId);
    if (!asset) {
      console.warn(`[SceneBuilder] Missing scene asset "${nodeConfig.instance.assetId}" for node "${nodeConfig.id}"`);
      return mode === 'async' ? Promise.resolve(null) : null;
    }

    if (mode === 'async') {
      return this.createSceneAssetRuntimeAsync(asset, nodeConfig);
    }

    return this.createSceneAssetRuntimeSync(asset, nodeConfig.id, nodeConfig);
  }

  private async createSceneAssetRuntimeAsync(
    asset: SceneAssetConfig,
    nodeConfig?: SceneInstanceNode,
  ): Promise<{ asset: SceneAssetConfig; modelNode: TransformNode; cleanup: () => void } | null> {
    if (asset.singleton && this.modelPool) {
      const pooled = await this.modelPool.acquireOnce(asset.id);
      pooled.node.setEnabled(true);
      return {
        asset,
        modelNode: pooled.node,
        cleanup: () => {
          pooled.node.parent = null;
          pooled.node.setEnabled(false);
        },
      };
    }

    const requiresUniqueMaterialRuntime = nodeConfig ? this.requiresUniqueMaterialRuntime(nodeConfig) : false;

    if (this.shouldShareAssetMaterials(asset) && this.modelPool) {
      await this.assetLoader.loadAssetContainer(asset.id);
      const pooled = requiresUniqueMaterialRuntime
        ? this.modelPool.acquireUnique(asset.id)
        : this.modelPool.acquire(asset.id);
      pooled.node.setEnabled(true);
      return {
        asset,
        modelNode: pooled.node,
        cleanup: () => {
          pooled.node.parent = null;
          if (requiresUniqueMaterialRuntime) {
            pooled.node.dispose();
            pooled.animations.forEach((anim) => anim.dispose());
            return;
          }
          this.modelPool?.release(pooled);
        },
      };
    }

    const modelNode = await this.assetLoader.loadModel(asset.id);
    return {
      asset,
      modelNode,
      cleanup: () => {
        modelNode.parent = null;
        modelNode.dispose();
      },
    };
  }

  private createSceneAssetRuntimeSync(
    asset: SceneAssetConfig,
    sceneNodeId: string,
    nodeConfig?: SceneInstanceNode,
  ): { asset: SceneAssetConfig; modelNode: TransformNode; cleanup: () => void } | null {
    if (!this.modelPool) return null;

    const requiresUniqueMaterialRuntime = nodeConfig ? this.requiresUniqueMaterialRuntime(nodeConfig) : false;
    const pooled = requiresUniqueMaterialRuntime
      ? this.modelPool.acquireUnique(asset.id)
      : this.modelPool.acquire(asset.id);
    pooled.node.setEnabled(true);
    const restoreMaterials = this.shouldShareAssetMaterials(asset)
      ? null
      : this.cloneInstanceMaterials(pooled.node, sceneNodeId);
    return {
      asset,
      modelNode: pooled.node,
      cleanup: () => {
        pooled.node.parent = null;
        restoreMaterials?.();
        if (requiresUniqueMaterialRuntime) {
          pooled.node.dispose();
          pooled.animations.forEach((anim) => anim.dispose());
          return;
        }
        this.modelPool?.release(pooled);
      },
    };
  }

  private requiresUniqueMaterialRuntime(nodeConfig: SceneInstanceNode): boolean {
    const overrides = nodeConfig.overrides;
    if (overrides?.material) return true;
    if (Object.keys(overrides?.childMaterials ?? {}).length > 0) return true;

    const materialEntries = configService.getSceneDocument().scene?.materials ?? [];
    return materialEntries.some((entry) => {
      if ((entry as any)?.scope === 'sharedAsset') return false;
      if ((entry as any)?.assetId) return false;
      return (entry as any)?.nodeId === nodeConfig.id;
    });
  }

  private shouldShareAssetMaterials(asset: SceneAssetConfig): boolean {
    return this.getAssetMaterialMode(asset) === 'shared';
  }

  private getAssetMaterialMode(asset: SceneAssetConfig): SceneAssetMaterialMode {
    return asset.materialMode === 'instance' ? 'instance' : 'shared';
  }

  private cloneInstanceMaterials(root: TransformNode, sceneNodeId: string): () => void {
    const materialMap = new Map<any, any>();
    const assignments: Array<{ node: any; sourceMaterial: any; clonedMaterial: any }> = [];
    const nodes: any[] = [root as any, ...(root.getChildMeshes(false) as any[])];

    for (const node of nodes) {
      const sourceMaterial = node?.material;
      if (!sourceMaterial || typeof sourceMaterial.clone !== 'function') continue;

      let clonedMaterial = materialMap.get(sourceMaterial) ?? null;
      if (!clonedMaterial) {
        const baseName = String(sourceMaterial.name ?? sourceMaterial.id ?? 'material');
        clonedMaterial = sourceMaterial.clone(`${baseName}_inst_${sceneNodeId}`);
        if (!clonedMaterial) continue;
        materialMap.set(sourceMaterial, clonedMaterial);
      }

      assignments.push({ node, sourceMaterial, clonedMaterial });
      node.material = clonedMaterial;
    }

    return () => {
      for (const { node, sourceMaterial } of assignments) {
        node.material = sourceMaterial;
      }
      for (const clonedMaterial of materialMap.values()) {
        clonedMaterial.dispose?.();
      }
    };
  }

  private collectMaterialNodes(rootNode: TransformNode): any[] {
    return [rootNode as any, ...(rootNode.getChildMeshes(false) as any[])];
  }

  private normalizeSharedOwnerNodePath(ownerNodePath: string): string {
    if (!ownerNodePath) return '';
    return ownerNodePath
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        const trimmed = segment.trim();
        if (!trimmed) return '';
        const suffix = trimmed.includes(':') ? trimmed.slice(trimmed.lastIndexOf(':') + 1) : trimmed;
        return suffix.trim();
      })
      .filter(Boolean)
      .join('/');
  }

  private applySharedMaterialOverrides(asset: SceneAssetConfig, rootNode: TransformNode): void {
    if (!this.shouldShareAssetMaterials(asset)) return;
    const sharedMaterials = configService.getSceneDocument().scene?.materials ?? [];
    for (const sharedMaterial of sharedMaterials) {
      if ((sharedMaterial as any)?.scope === 'nodeMaterial') continue;
      if ((sharedMaterial as any)?.nodeId) continue;
      if ((sharedMaterial as any)?.assetId !== asset.id) continue;
      this.applySharedMaterialOverride(rootNode, sharedMaterial as any);
    }
  }

  private applyNodeMaterialEntries(nodeConfig: SceneNodeConfig, rootNode: TransformNode): void {
    const materialEntries = configService.getSceneDocument().scene?.materials ?? [];
    for (const materialEntry of materialEntries) {
      if ((materialEntry as any)?.scope === 'sharedAsset') continue;
      if ((materialEntry as any)?.assetId) continue;
      if ((materialEntry as any)?.nodeId !== nodeConfig.id) continue;
      this.applyNodeMaterialEntry(rootNode, materialEntry as any);
    }
  }

  private applySharedOutlineOverrides(asset: SceneAssetConfig, rootNode: TransformNode): void {
    const defaults = asset.defaults;
    if (!defaults) return;
    if (defaults.outline) {
      this.applyOutlineOverride(rootNode, defaults.outline);
    }
    for (const [ownerNodePath, outlineOverride] of Object.entries(defaults.childOutlines ?? {})) {
      const normalizedOwnerNodePath = this.normalizeSharedOwnerNodePath(ownerNodePath);
      const ownerNode = resolveMaterialOwnerNode(rootNode, normalizedOwnerNodePath || ownerNodePath);
      if (!ownerNode) continue;
      this.applyOutlineOverride(ownerNode, outlineOverride);
    }
  }

  private applySharedMaterialOverride(rootNode: TransformNode, sharedMaterial: {
    ownerNodePath?: string;
    materialName?: string;
    properties?: MaterialOverrideConfig;
  }): void {
    const materialName = typeof sharedMaterial.materialName === 'string' ? sharedMaterial.materialName.trim() : '';
    const ownerNodePath = typeof sharedMaterial.ownerNodePath === 'string' ? sharedMaterial.ownerNodePath.trim() : '';
    const properties = sharedMaterial.properties;
    if (!materialName || !properties) return;

    if (ownerNodePath) {
      const ownerNode = this.resolveNodeMaterialOwner(rootNode, ownerNodePath);
      if (!ownerNode?.material) return;
      this.applyMaterialPropertiesToRuntimeMaterial(ownerNode.material, properties);
      return;
    }

    for (const node of this.collectMaterialNodes(rootNode)) {
      const material = node?.material;
      if (!material || material.name !== materialName) continue;
      this.applyMaterialPropertiesToRuntimeMaterial(material, properties);
    }
  }

  private applyNodeMaterialEntry(
    rootNode: TransformNode,
    materialEntry: Pick<SceneSharedMaterialConfig, 'ownerNodePath' | 'materialName' | 'properties'>,
  ): void {
    const materialName = typeof materialEntry.materialName === 'string' ? materialEntry.materialName.trim() : '';
    const ownerNodePath = typeof materialEntry.ownerNodePath === 'string' ? materialEntry.ownerNodePath.trim() : '';
    const properties = materialEntry.properties;
    if (!materialName || !properties) return;

    const ownerNode = ownerNodePath
      ? this.resolveNodeMaterialOwner(rootNode, ownerNodePath)
      : this.collectMaterialNodes(rootNode).find((node) => node?.material?.name === materialName)
        ?? this.collectMaterialNodes(rootNode).find((node) => !!node?.material)
        ?? null;
    if (!ownerNode?.material) return;

    this.applyMaterialPropertiesToRuntimeMaterial(ownerNode.material, properties);
  }

  private applyMaterialPropertiesToRuntimeMaterial(material: any, properties: MaterialOverrideConfig): void {
    const albedoColor = properties.albedoColor ?? properties.diffuseColor;
    if (albedoColor) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.albedoColor', albedoColor);
    }
    if (properties.emissiveColor) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.emissiveColor', properties.emissiveColor);
    }
    if (properties.metallic !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.metallic', properties.metallic);
    }
    if (properties.roughness !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.roughness', properties.roughness);
    }
    if (properties.alpha !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.alpha', properties.alpha);
    }
    if (properties.alphaCutOff !== undefined && 'alphaCutOff' in material) {
      material.alphaCutOff = properties.alphaCutOff;
    }
    if (properties.transparencyMode !== undefined && 'transparencyMode' in material) {
      material.transparencyMode = properties.transparencyMode;
    }
    if (properties.backFaceCulling !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.backFaceCulling', properties.backFaceCulling);
    }
    if (
      properties.contrast !== undefined
      || properties.brightness !== undefined
      || properties.saturation !== undefined
      || properties.hue !== undefined
      || properties.colorDensity !== undefined
      || properties.metallic !== undefined
      || properties.roughness !== undefined
      || properties.alpha !== undefined
      || properties.alphaCutOff !== undefined
      || properties.transparencyMode !== undefined
    ) {
      applyMaterialDebugAdjustments(material, properties);
    }
    if (properties.albedoTexture !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.albedoTexture.url', properties.albedoTexture?.url ?? null);
    }
    if (properties.normalTexture !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.normalTexture.url', properties.normalTexture?.url ?? null);
    }
    if (properties.metallicTexture !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.metallicTexture.url', properties.metallicTexture?.url ?? null);
    }
    this.applyTypedMaterialLightingOverride(material, properties);
  }

  private applyTypedMaterialLightingOverride(material: any, override: MaterialOverrideConfig): void {
    const materialRuntimeKind = resolveMaterialRuntimeKind(material);
    if (materialRuntimeKind === 'pbr' && override.pbr) {
      const pbr = override.pbr;
      if (pbr.albedoColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.albedoColor', pbr.albedoColor);
      }
      if (pbr.baseWeight !== undefined) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.baseWeight', pbr.baseWeight);
      }
      if (pbr.reflectivityColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.reflectivityColor', pbr.reflectivityColor);
      }
      if (pbr.microSurface !== undefined) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.microSurface', pbr.microSurface);
      }
      if (pbr.emissiveColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.emissiveColor', pbr.emissiveColor);
      }
      if (pbr.ambientColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.ambientColor', pbr.ambientColor);
      }
      if (pbr.lightFalloff !== undefined) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.lightFalloff', pbr.lightFalloff);
      }
      return;
    }

    if (materialRuntimeKind === 'standard' && override.standard) {
      const standard = override.standard;
      if (standard.diffuseColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.diffuseColor', standard.diffuseColor);
      }
      if (standard.specularColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.specularColor', standard.specularColor);
      }
      if (standard.specularPower !== undefined) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.specularPower', standard.specularPower);
      }
      if (standard.emissiveColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.emissiveColor', standard.emissiveColor);
      }
      if (standard.ambientColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.ambientColor', standard.ambientColor);
      }
      if (standard.useSpecularOverAlpha !== undefined) {
        applyMaterialValueToRuntimeMaterial(
          material,
          this.scene,
          'material.standard.useSpecularOverAlpha',
          standard.useSpecularOverAlpha,
        );
      }
    }
  }

  private detachOverrideMaterial(node: any, sceneNodeId: string, ownerNodePath: string): void {
    const sourceMaterial = node?.material;
    if (!sourceMaterial || typeof sourceMaterial.clone !== 'function') return;
    const cloneSuffix = ownerNodePath ? `${sceneNodeId}_${ownerNodePath.replace(/[^a-zA-Z0-9_-]+/g, '_')}` : sceneNodeId;
    const baseName = String(sourceMaterial.name ?? sourceMaterial.id ?? 'material');
    const clonedMaterial = sourceMaterial.clone(`${baseName}_override_${cloneSuffix}`);
    if (!clonedMaterial) return;
    node.material = clonedMaterial;
  }

  private resolveParentRuntime(parentId?: string): TransformNode {
    if (!parentId) return this.root;
    return this.sceneNodeRuntimes.get(parentId) ?? this.root;
  }

  private attachTransformRuntime(nodeConfig: SceneTransformNode, runtimeNode: TransformNode): void {
    if (nodeConfig.transformType !== 'groundDecal' || !nodeConfig.groundDecal) return;

    if (typeof nodeConfig.groundDecal.alphaIndex === 'number' && Number.isFinite(nodeConfig.groundDecal.alphaIndex)) {
      (runtimeNode as any).alphaIndex = nodeConfig.groundDecal.alphaIndex;
    }

    const mat = new StandardMaterial(`${nodeConfig.id}_mat`, this.scene);
    const color = nodeConfig.groundDecal.color ?? { r: 1, g: 1, b: 1 };
    mat.diffuseColor = new Color3(color.r, color.g, color.b);
    mat.specularColor = new Color3(0, 0, 0);
    mat.backFaceCulling = false;

    const textureUrl = nodeConfig.groundDecal.textureId ? resolveTextureAssetUrl(nodeConfig.groundDecal.textureId) : undefined;
    if (textureUrl) {
      const texture = new Texture(textureUrl, this.scene);
      texture.hasAlpha = true;
      // Ground decal 是 XZ 平面；图片像素行方向与地面 UV 的 V 轴相反。
      // 在贴图层翻转 V 轴，而不是设置 mesh rotation，避免破坏地贴朝向语义。
      texture.vScale = -1;
      texture.vOffset = 1;
      mat.diffuseTexture = texture;
      if (typeof nodeConfig.groundDecal.diffuseTextureLevel === 'number' && Number.isFinite(nodeConfig.groundDecal.diffuseTextureLevel)) {
        mat.diffuseTexture.level = nodeConfig.groundDecal.diffuseTextureLevel;
      }
      mat.useAlphaFromDiffuseTexture = true;
      mat.diffuseColor = new Color3(1, 1, 1);
      if (typeof nodeConfig.groundDecal.emissiveTextureLevel === 'number' && Number.isFinite(nodeConfig.groundDecal.emissiveTextureLevel)) {
        mat.emissiveTexture = mat.emissiveTexture ?? texture;
        mat.emissiveTexture.level = nodeConfig.groundDecal.emissiveTextureLevel;
      }
    }

    (runtimeNode as any).material = mat;
  }

  private resolveNodeMaterialOwner(rootNode: TransformNode, ownerNodePath: string): any | null {
    const normalizedOwnerNodePath = this.normalizeSharedOwnerNodePath(ownerNodePath);
    const resolved = resolveMaterialOwnerNode(rootNode, normalizedOwnerNodePath || ownerNodePath);
    if (resolved) return resolved;

    const normalizedTarget = (normalizedOwnerNodePath || ownerNodePath).trim();
    const rootName = String((rootNode as any)?.name ?? '').trim();
    const rootId = String((rootNode as any)?.id ?? '').trim();
    if (!normalizedTarget) return null;
    if (normalizedTarget === `${rootName}_mesh` || normalizedTarget === `${rootId}_mesh`) {
      return rootNode as any;
    }
    return null;
  }

  private syncSceneAssetIndex(): void {
    this.sceneAssetConfigs.clear();
    for (const asset of configService.getSceneAssets()) {
      this.sceneAssetConfigs.set(asset.id, asset);
    }
  }

  private attachSceneNodeMetadata(node: TransformNode, nodeId: string, source?: SceneRuntimeSourceBinding): void {
    const metadata = node.metadata && typeof node.metadata === 'object' ? node.metadata : {};
    const nextMetadata: Record<string, unknown> = {
      ...metadata,
      sceneNodeId: nodeId,
      nodeId,
    };
    if (source) {
      nextMetadata.sourceBinding = structuredClone(source);
    }
    node.metadata = nextMetadata;
  }

  private applyChildTransforms(root: TransformNode, transforms?: Record<string, TransformConfig>): void {
    if (!transforms) return;

    let appliedCount = 0;
    let missingCount = 0;
    for (const [ownerNodePath, transform] of Object.entries(transforms)) {
      const child = resolveMaterialOwnerNode(root, ownerNodePath)
        ?? root.getChildTransformNodes(false).find((node) => node.name === ownerNodePath)
        ?? root.getChildMeshes(false).find((node) => node.name === ownerNodePath);
      if (!child) {
        missingCount += 1;
        console.warn('[ProjectEditor][SceneBuilder] child transform target not found', {
          rootName: root.name,
          ownerNodePath,
        });
        continue;
      }
      this.applyTransform(child as TransformNode, transform, { reset: false });
      appliedCount += 1;
    }
    if (appliedCount > 0 || missingCount > 0) {
      console.log('[ProjectEditor][SceneBuilder] child transforms applied', {
        rootName: root.name,
        total: Object.keys(transforms).length,
        appliedCount,
        missingCount,
      });
    }
  }

  private clearSceneRuntime(): void {
    const runtimeIds = [...this.sceneNodeRuntimes.keys()].filter((id) => this.sceneNodeRuntimes.get(id) !== this.root);
    runtimeIds.reverse();
    for (const nodeId of runtimeIds) {
      this.removeSceneNode(nodeId);
    }

    this.sceneNodeRuntimes.clear();
    this.sceneNodeCleanup.clear();
    this.sceneAssetConfigs.clear();
    this.root.parent = null;
  }

  private applyTransform(node: TransformNode, transform?: TransformConfig, options?: { reset?: boolean }): void {
    const reset = options?.reset ?? true;
    if (reset) {
      node.position.set(0, 0, 0);
      node.rotation.set(0, 0, 0);
      node.scaling.setAll(1);
    }

    if (!transform) return;

    if (transform.position) {
      node.position.set(transform.position.x, transform.position.y, transform.position.z);
    }

    // rotationDeg 优先
    if (transform.rotationDeg) {
      const r = transform.rotationDeg;
      node.rotationQuaternion = null;
      node.rotation.set((r.x * Math.PI) / 180, (r.y * Math.PI) / 180, (r.z * Math.PI) / 180);
    } else if (transform.rotation) {
      const r = transform.rotation;
      node.rotationQuaternion = null;
      node.rotation.set(r.x ?? 0, r.y ?? 0, r.z ?? 0);
    }

    if (transform.scale !== undefined) {
      if (typeof transform.scale === 'number') {
        node.scaling.setAll(transform.scale);
      } else {
        node.scaling.set(transform.scale.x, transform.scale.y, transform.scale.z);
      }
    }
  }

  private applySceneNodeOverrides(
    nodeConfig: SceneInstanceNode | SceneTransformNode | ScenePrimitiveNode,
    rootNode: TransformNode,
    asset?: SceneAssetConfig,
  ): void {
    const overrides = nodeConfig.overrides;
    if (!overrides) return;

    if (nodeConfig.kind === 'transform' || nodeConfig.kind === 'primitive') {
      this.applyChildTransforms(rootNode, overrides.childTransforms);
    }

    if (overrides.material) {
      this.applyMaterialOverride(rootNode, '', overrides.material, nodeConfig.id, asset);
    }

    for (const [ownerNodePath, materialOverride] of Object.entries(overrides.childMaterials ?? {})) {
      this.applyMaterialOverride(rootNode, ownerNodePath, materialOverride, nodeConfig.id, asset);
    }

    if (overrides.outline) {
      this.applyOutlineOverride(rootNode, overrides.outline);
    }

    for (const [ownerNodePath, outlineOverride] of Object.entries(overrides.childOutlines ?? {})) {
      const ownerNode = resolveMaterialOwnerNode(rootNode, ownerNodePath);
      if (!ownerNode) continue;
      this.applyOutlineOverride(ownerNode, outlineOverride);
    }
  }

  private applyMaterialOverride(
    rootNode: TransformNode,
    ownerNodePath: string,
    override: MaterialOverrideConfig,
    sceneNodeId: string,
    asset?: SceneAssetConfig,
  ): void {
    const ownerNode = resolveMaterialOwnerNode(rootNode, ownerNodePath)
      ?? (!ownerNodePath ? rootNode.getChildMeshes(false).find((mesh) => !!(mesh as any)?.material) ?? null : null);
    if (!ownerNode) return;
    if (asset && this.shouldShareAssetMaterials(asset)) {
      this.detachOverrideMaterial(ownerNode, sceneNodeId, ownerNodePath);
    }

    const albedoColor = override.albedoColor ?? override.diffuseColor;
    if (albedoColor) {
      applyMaterialValueToRuntimeNode(ownerNode, this.scene, 'material.albedoColor', albedoColor);
    }
    if (override.emissiveColor) {
      applyMaterialValueToRuntimeNode(ownerNode, this.scene, 'material.emissiveColor', override.emissiveColor);
    }
    if (override.metallic !== undefined) {
      applyMaterialValueToRuntimeNode(ownerNode, this.scene, 'material.metallic', override.metallic);
    }
    if (override.roughness !== undefined) {
      applyMaterialValueToRuntimeNode(ownerNode, this.scene, 'material.roughness', override.roughness);
    }
    if (override.alpha !== undefined) {
      applyMaterialValueToRuntimeNode(ownerNode, this.scene, 'material.alpha', override.alpha);
    }
    if (override.backFaceCulling !== undefined) {
      applyMaterialValueToRuntimeNode(ownerNode, this.scene, 'material.backFaceCulling', override.backFaceCulling);
    }
    if (override.albedoTexture !== undefined) {
      applyMaterialValueToRuntimeNode(ownerNode, this.scene, 'material.albedoTexture.url', override.albedoTexture?.url ?? null);
    }
    if (override.normalTexture !== undefined) {
      applyMaterialValueToRuntimeNode(ownerNode, this.scene, 'material.normalTexture.url', override.normalTexture?.url ?? null);
    }
    if (override.metallicTexture !== undefined) {
      applyMaterialValueToRuntimeNode(ownerNode, this.scene, 'material.metallicTexture.url', override.metallicTexture?.url ?? null);
    }
    this.applyTypedMaterialLightingOverride((ownerNode as any)?.material, override);
  }

  private applyOutlineOverride(entity: TransformNode, override: OutlineOverrideConfig): void {
    const { target } = resolveOutlineTarget(entity);
    if (!target) return;

    if (override.renderOutline !== undefined) {
      (target as any).renderOutline = override.renderOutline;
    }
    if (override.outlineWidth !== undefined) {
      (target as any).outlineWidth = override.outlineWidth;
    }
    if (override.outlineColor) {
      const color = override.outlineColor;
      const current = (target as any).outlineColor;
      if (current?.copyFromFloats) {
        current.copyFromFloats(color.r, color.g, color.b);
      } else {
        (target as any).outlineColor = new Color3(color.r, color.g, color.b);
      }
    }
  }

  dispose(): void {
    this.clearSceneRuntime();
    this.root.dispose();
  }
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readPositiveFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function readOptionalPositiveFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function readCameraProjection(value: unknown): SceneCameraProjection {
  return value === 'perspective' ? 'perspective' : 'orthographic';
}

function resolveCameraProjection(value: unknown): SceneCameraProjection {
  return value === 'perspective' ? 'perspective' : 'orthographic';
}

function resolveCameraFov(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : DEFAULT_CAMERA_FOV;
}

function readOptionalUnitNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
}

function readPosition3D(value: unknown): { x: number; y: number; z: number } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.x !== 'number' || !Number.isFinite(record.x)) return undefined;
  if (typeof record.y !== 'number' || !Number.isFinite(record.y)) return undefined;
  if (typeof record.z !== 'number' || !Number.isFinite(record.z)) return undefined;
  return { x: record.x, y: record.y, z: record.z };
}

function readPosition2D(value: unknown): { x: number; y: number } | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.x !== 'number' || !Number.isFinite(record.x)) return undefined;
  if (typeof record.y !== 'number' || !Number.isFinite(record.y)) return undefined;
  return { x: record.x, y: record.y };
}

function getCameraTargetOffset(cameraRig: SceneCameraRigConfig): { x: number; y: number; z: number } | undefined {
  return readPosition3D(cameraRig.targetOffset);
}

function cloneCameraRig(cameraRig: SceneCameraRigConfig): SceneCameraRigConfig {
  return {
    ...cameraRig,
    ...(cameraRig.targetOffset ? { targetOffset: { ...cameraRig.targetOffset } } : {}),
    ...(cameraRig.targetScreenOffset ? { targetScreenOffset: { ...cameraRig.targetScreenOffset } } : {}),
  };
}

function applyCameraRigLimitDefaults(cameraRig: SceneCameraRigConfig): SceneCameraRigConfig {
  const betaLimits = resolveCameraBetaLimitDefaults(cameraRig.beta, cameraRig.lowerBetaLimit, cameraRig.upperBetaLimit);
  const radiusLimits = resolveCameraRadiusLimitDefaults(cameraRig.radius, cameraRig.lowerRadiusLimit, cameraRig.upperRadiusLimit);
  return {
    ...cameraRig,
    lowerBetaLimit: betaLimits.lower,
    upperBetaLimit: betaLimits.upper,
    lowerRadiusLimit: radiusLimits.lower,
    upperRadiusLimit: radiusLimits.upper,
  };
}

function resolveCameraBetaLimitDefaults(
  beta: number,
  lower: number | undefined,
  upper: number | undefined,
): { lower: number; upper: number } {
  let nextLower = Number.isFinite(lower) ? lower as number : DEFAULT_CAMERA_LOWER_BETA_LIMIT;
  let nextUpper = Number.isFinite(upper) ? upper as number : DEFAULT_CAMERA_UPPER_BETA_LIMIT;
  if (isLockedToCurrentValue(nextLower, nextUpper, beta)) {
    nextLower = DEFAULT_CAMERA_LOWER_BETA_LIMIT;
    nextUpper = DEFAULT_CAMERA_UPPER_BETA_LIMIT;
  }
  if (nextUpper < nextLower) [nextLower, nextUpper] = [nextUpper, nextLower];
  if (beta < nextLower) nextLower = beta;
  if (beta > nextUpper) nextUpper = beta;
  return { lower: nextLower, upper: nextUpper };
}

function resolveCameraRadiusLimitDefaults(
  radius: number,
  lower: number | undefined,
  upper: number | undefined,
): { lower: number; upper: number } {
  const defaultLower = Math.max(MIN_CAMERA_RADIUS_LIMIT, radius * DEFAULT_CAMERA_RADIUS_LIMIT_FACTOR_MIN);
  const defaultUpper = Math.max(radius + 1, radius * DEFAULT_CAMERA_RADIUS_LIMIT_FACTOR_MAX);
  let nextLower = Number.isFinite(lower) && (lower as number) > 0 ? lower as number : defaultLower;
  let nextUpper = Number.isFinite(upper) && (upper as number) > 0 ? upper as number : defaultUpper;
  if (isLockedToCurrentValue(nextLower, nextUpper, radius)) {
    nextLower = defaultLower;
    nextUpper = defaultUpper;
  }
  if (nextUpper < nextLower) [nextLower, nextUpper] = [nextUpper, nextLower];
  if (radius < nextLower) nextLower = Math.max(MIN_CAMERA_RADIUS_LIMIT, radius);
  if (radius > nextUpper) nextUpper = radius;
  return { lower: nextLower, upper: nextUpper };
}

function isLockedToCurrentValue(lower: number, upper: number, value: number): boolean {
  return Math.abs(lower - upper) <= 0.000001 && Math.abs(lower - value) <= 0.000001;
}

function readNonNegativeFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function readColorRGB(value: unknown): ColorRGB | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    typeof record.r !== 'number'
    || !Number.isFinite(record.r)
    || typeof record.g !== 'number'
    || !Number.isFinite(record.g)
    || typeof record.b !== 'number'
    || !Number.isFinite(record.b)
  ) {
    return undefined;
  }
  return { r: record.r, g: record.g, b: record.b };
}
