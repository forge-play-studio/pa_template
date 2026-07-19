/**
 * SceneBuilder - 场景构建服务 (Scaffold)
 *
 * 职责：
 * - 创建基础场景环境（相机/灯光/渲染管线/阴影）
 * - 从配置加载场景实例（可选：GLB 场景/道具）
 *
 * 注意：这是“去业务化”的脚手架版本：
 * - 不包含 zones / interactionSlots 等强业务绑定能力
 * - 这些能力应在具体游戏项目中按需扩展（保持文件名/入口一致，可迁移）
 */

import { Scene } from '@babylonjs/core/scene';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
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
import { createGroundDecalUiDynamicTexture, isGroundDecalUiConfig } from './GroundDecalUiService';
import { applyMaterialDebugAdjustments } from '../utils/materialDebugAdjust';

import renderingConfig from '../config/rendering.json';
import {
  configService,
  resolveSceneAssetRuntimeUrl,
  type ArtistMaterialProfile,
  type ColorRGB,
  type GroundDecalUiConfig,
  type MaterialOverrideConfig,
  type OutlineOverrideConfig,
  type SceneAssetConfig,
  type SceneAssetMaterialMode,
  type SceneCameraProjection,
  type SceneCameraRigConfig,
  type SceneDirectionalLightConfig,
  type SceneHemisphericLightConfig,
  type SceneInstanceNode,
  type SceneMaterialAssetKind,
  type SceneNodeMaterialBindingConfig,
  type ScenePrimitiveNode,
  type SceneSharedMaterialConfig,
  type SceneNodeConfig,
  type SceneRuntimeSourceBinding,
  type SceneTransformNode,
  type TransformConfig,
} from '../config';
import {
  applyBabylonRenderingToNodeTree,
  applyArtistMaterialProfileToRuntimeMaterial as applyPlayableArtistMaterialProfileToRuntimeMaterial,
  applyPlayableBabylonOutlineOverrideToRuntimeNode,
  applyMaterialValueToRuntimeMaterial,
  createMaterialSlotOwnerPathMatchKey,
  normalizeMaterialSlotOwnerPath,
  resolveEditorSceneGameObjectRendering,
  resolveEditorSceneArtistMaterialBinding,
  resolveMaterialRuntimeKind,
  resolveMaterialOwnerNode,
  resolveMaterialSlotOwnerNodes,
} from '@fps-games/editor/playable-sdk';
import {
  createBabylonShadowMapExperimentSystem,
  readBabylonRuntimeShadowObjectsRecoveryOwner,
  type BabylonShadowMapExperimentSystem,
  type BabylonRuntimeShadowObjectsOwner,
  type BabylonRuntimeShadowObjectsRegistration,
  type ShadowMapExperimentActivityKind,
} from '@fps-games/editor/playable-runtime/babylon';

const BABYLON_MATERIAL_RUNTIME = { Color3, MaterialPluginBase, Texture };

const DEFAULT_CAMERA_FOV = 0.85;

/** 场景环境构建结果 */
export interface SceneEnvironment {
  camera: ArcRotateCamera;
  hemisphericLight: HemisphericLight;
  directionalLight: DirectionalLight;
  renderingService: RenderingService;
  shadowService: ShadowService | null;
}

export interface SceneRuntimeLightState<TLightConfig extends SceneHemisphericLightConfig | SceneDirectionalLightConfig> {
  light: TLightConfig;
  enabled: boolean;
  source?: SceneRuntimeSourceBinding;
}

export type SceneShadowCasterActivityKind = ShadowMapExperimentActivityKind;

export interface SceneShadowCasterActivityController {
  setActive(active: boolean): boolean;
  invalidate(): boolean;
  dispose(): void;
}

export type SceneRuntimeShadowObjectsRegistration = BabylonRuntimeShadowObjectsRegistration;
export type SceneRuntimeShadowObjectsOwner = BabylonRuntimeShadowObjectsOwner;

export function readSceneRuntimeShadowObjectsRecoveryOwner(
  error: unknown,
): SceneRuntimeShadowObjectsOwner | null {
  return readBabylonRuntimeShadowObjectsRecoveryOwner(error);
}

type SceneBuilderMaterialSlotSourceDescriptor = {
  slotId?: string;
  ownerNodePath: string;
  label?: string;
  nodeIndex?: number;
  nodeIndexPath?: number[];
  meshIndex?: number;
  primitiveIndex?: number;
  sourceMaterialIndex?: number;
  sourceMaterialIndices?: number[];
  sourceMeshName?: string;
  materialName?: string;
  materialNames?: string[];
};

type SceneBuilderMaterialSlotTarget = {
  material: any;
};

export class SceneBuilder {
  private scene: Scene;
  private assetLoader: AssetLoader;
  private modelPool: ModelPool | null = null;

  private root: TransformNode;
  readonly sceneNodeRuntimes = new Map<string, TransformNode>();
  private sceneNodeMaterialScopeRoots = new Map<string, TransformNode>();
  private sceneNodeCleanup = new Map<string, (() => void) | null>();
  private sceneNodeAnimationGroups = new Map<string, AnimationGroup[]>();
  private sceneAssetConfigs = new Map<string, SceneAssetConfig>();
  private sceneAssetRuntimeUrlIds = new Set<string>();
  private readonly sceneAssetRuntimeUrlOwner = {};
  private selectedCameraRig: SceneCameraRigConfig | null = null;
  private hemisphericLight: HemisphericLight | null = null;
  private directionalLight: DirectionalLight | null = null;
  private selectedHemisphericLight: SceneHemisphericLightConfig | null = null;
  private selectedDirectionalLight: SceneDirectionalLightConfig | null = null;
  private selectedHemisphericLightEnabled = true;
  private selectedDirectionalLightEnabled = true;
  private hemisphericLightSource: SceneRuntimeSourceBinding | undefined;
  private directionalLightSource: SceneRuntimeSourceBinding | undefined;
  private shadowService: ShadowService | null = null;
  private shadowMapExperimentSystem: BabylonShadowMapExperimentSystem | null = null;

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
    const url = resolveSceneAssetRuntimeUrl(asset);
    if (url) {
      this.sceneAssetRuntimeUrlIds.add(asset.id);
      this.assetLoader.registerOwnedRuntimeModelUrl(asset.id, url, this.sceneAssetRuntimeUrlOwner);
    } else if (this.sceneAssetRuntimeUrlIds.has(asset.id)) {
      this.assetLoader.unregisterOwnedRuntimeModelUrl(asset.id, this.sceneAssetRuntimeUrlOwner);
      this.sceneAssetRuntimeUrlIds.delete(asset.id);
    }
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
    const shadowMapExperimentEntry = configService.getSceneConfig().plugins?.find(
      entry => entry.pluginId === 'fps.shadow-map-experiment',
    );
    this.shadowMapExperimentSystem = createBabylonShadowMapExperimentSystem(this.scene);
    this.shadowMapExperimentSystem.setPlan((shadowMapExperimentEntry?.data ?? null) as never);

    const shadowMapExperimentEnabled = (
      shadowMapExperimentEntry?.data as { enabled?: unknown } | null | undefined
    )?.enabled === true;
    const shadowService = shadowMapExperimentEnabled
      ? null
      : new ShadowService(this.scene, directionalLight, camera);
    shadowService?.initialize();
    this.shadowService = shadowService;

    // 5) 默认地面（让脚手架“开箱即有东西可见”）
    this.buildDefaultGround();
    this.buildLayoutPlaceholderSurfaces();

    return { camera, hemisphericLight, directionalLight, renderingService, shadowService };
  }

  private createCamera(): ArcRotateCamera {
    const cameraNode = configService.getSceneCameraNode();
    const cameraRig = cloneCameraRig(cameraNode?.camera ?? this.resolveFallbackCameraRig());
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
    const nextRig = cloneCameraRig(cameraRig);
    this.selectedCameraRig = cloneCameraRig(nextRig);
    this.relaxCameraLimitsForRigAssignment(camera);
    this.applyCameraRuntimeProperties(camera, nextRig, target ?? camera.target.clone());
  }

  setSelectedCameraTargetOffset(target: Vector3): SceneCameraRigConfig {
    const cameraRig = cloneCameraRig(this.selectedCameraRig ?? this.resolveCameraRig());
    cameraRig.targetOffset = { x: target.x, y: target.y, z: target.z };
    this.selectedCameraRig = cloneCameraRig(cameraRig);
    return cloneCameraRig(cameraRig);
  }

  getSelectedCameraRig(): SceneCameraRigConfig {
    const cameraRig = this.selectedCameraRig ?? this.resolveCameraRig();
    return cloneCameraRig(cameraRig);
  }

  getSelectedCameraOrthoSize(): number {
    const cameraRig = this.selectedCameraRig ?? this.resolveCameraRig();
    return cameraRig.orthoSize;
  }

  getRuntimeHemisphericLight(): HemisphericLight | null {
    return this.hemisphericLight;
  }

  getRuntimeDirectionalLight(): DirectionalLight | null {
    return this.directionalLight;
  }

  getShadowMapExperimentEvidence() {
    return this.shadowMapExperimentSystem?.getEvidence() ?? null;
  }

  registerShadowCasterActivitySource(input: {
    entityId: string;
    kind: SceneShadowCasterActivityKind;
    sourceId: string;
  }): SceneShadowCasterActivityController | null {
    const system = this.shadowMapExperimentSystem;
    if (!system) return null;
    return system.registerCasterActivitySource(input);
  }

  registerRuntimeShadowObjects(
    input: SceneRuntimeShadowObjectsRegistration,
  ): SceneRuntimeShadowObjectsOwner | null {
    const system = this.shadowMapExperimentSystem;
    return system?.registerRuntimeShadowObjects(input) ?? null;
  }

  getSelectedHemisphericLightState(): SceneRuntimeLightState<SceneHemisphericLightConfig> {
    const fallback = this.resolveHemisphericLightSource();
    return {
      light: cloneSceneHemisphericLight(this.selectedHemisphericLight ?? fallback.light),
      enabled: this.selectedHemisphericLight == null ? fallback.enabled : this.selectedHemisphericLightEnabled,
      ...(this.hemisphericLightSource ? { source: structuredClone(this.hemisphericLightSource) } : {}),
    };
  }

  getSelectedDirectionalLightState(): SceneRuntimeLightState<SceneDirectionalLightConfig> {
    const fallback = this.resolveDirectionalLightSource();
    return {
      light: cloneSceneDirectionalLight(this.selectedDirectionalLight ?? fallback.light),
      enabled: this.selectedDirectionalLight == null ? fallback.enabled : this.selectedDirectionalLightEnabled,
      ...(this.directionalLightSource ? { source: structuredClone(this.directionalLightSource) } : {}),
    };
  }

  applyHemisphericLight(light: SceneHemisphericLightConfig, options: { enabled?: boolean } = {}): void {
    const nextLight = cloneSceneHemisphericLight(light);
    this.selectedHemisphericLight = nextLight;
    if (options.enabled !== undefined) this.selectedHemisphericLightEnabled = options.enabled;

    const runtimeLight = this.hemisphericLight;
    if (!runtimeLight) return;
    runtimeLight.intensity = nextLight.intensity;
    runtimeLight.setEnabled(this.selectedHemisphericLightEnabled);
    if (nextLight.diffuseColor) {
      runtimeLight.diffuse = toColor3(nextLight.diffuseColor);
    }
    if (nextLight.groundColor) {
      runtimeLight.groundColor = toColor3(nextLight.groundColor);
    }
  }

  applyDirectionalLight(light: SceneDirectionalLightConfig, options: { enabled?: boolean } = {}): void {
    const nextLight = cloneSceneDirectionalLight(light);
    this.selectedDirectionalLight = nextLight;
    if (options.enabled !== undefined) this.selectedDirectionalLightEnabled = options.enabled;

    const runtimeLight = this.directionalLight;
    if (!runtimeLight) return;
    runtimeLight.intensity = nextLight.intensity;
    runtimeLight.direction = new Vector3(nextLight.direction.x, nextLight.direction.y, nextLight.direction.z);
    runtimeLight.setEnabled(this.selectedDirectionalLightEnabled);
    this.shadowService?.setDirectionalLightEnabled(this.selectedDirectionalLightEnabled);
    if (nextLight.diffuseColor) {
      runtimeLight.diffuse = toColor3(nextLight.diffuseColor);
    }
  }

  private getCameraRigTarget(cameraRig: SceneCameraRigConfig, fallback?: Vector3): Vector3 {
    const targetOffset = getCameraTargetOffset(cameraRig);
    if (targetOffset) return new Vector3(targetOffset.x, targetOffset.y, targetOffset.z);
    if (fallback) return fallback.clone();
    return this.resolveFallbackCameraTarget();
  }

  private applyCameraRuntimeProperties(camera: ArcRotateCamera, cameraRig: SceneCameraRigConfig, target: Vector3): void {
    camera.alpha = cameraRig.alpha;
    camera.beta = cameraRig.beta;
    camera.radius = cameraRig.radius;
    camera.target = target;
    camera.lowerAlphaLimit = cameraRig.alpha;
    camera.upperAlphaLimit = cameraRig.alpha;
    camera.lowerBetaLimit = cameraRig.lowerBetaLimit ?? cameraRig.beta;
    camera.upperBetaLimit = cameraRig.upperBetaLimit ?? cameraRig.beta;
    camera.lowerRadiusLimit = cameraRig.lowerRadiusLimit ?? cameraRig.radius;
    camera.upperRadiusLimit = cameraRig.upperRadiusLimit ?? cameraRig.radius;
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
    const hemispheric = this.resolveHemisphericLightSource();
    this.selectedHemisphericLight = cloneSceneHemisphericLight(hemispheric.light);
    this.selectedHemisphericLightEnabled = hemispheric.enabled;
    this.hemisphericLightSource = hemispheric.source ? structuredClone(hemispheric.source) : undefined;

    const hemi = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene);
    this.hemisphericLight = hemi;
    this.attachRuntimeLightMetadata(hemi, 'hemispheric', hemispheric.source);
    this.applyHemisphericLight(hemispheric.light, { enabled: hemispheric.enabled });

    const sun = this.resolveDirectionalLightSource();
    this.selectedDirectionalLight = cloneSceneDirectionalLight(sun.light);
    this.selectedDirectionalLightEnabled = sun.enabled;
    this.directionalLightSource = sun.source ? structuredClone(sun.source) : undefined;

    const dir = new DirectionalLight(
      'dirLight',
      new Vector3(sun.light.direction.x, sun.light.direction.y, sun.light.direction.z),
      this.scene,
    );
    if (sun.source?.objectId) dir.id = sun.source.objectId;
    this.directionalLight = dir;
    this.attachRuntimeLightMetadata(dir, 'directional', sun.source);
    this.applyDirectionalLight(sun.light, { enabled: sun.enabled });

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

  private attachRuntimeLightMetadata(
    light: HemisphericLight | DirectionalLight,
    lightType: SceneHemisphericLightConfig['type'] | SceneDirectionalLightConfig['type'],
    source?: SceneRuntimeSourceBinding,
  ): void {
    if (!source) return;
    const metadata = light.metadata && typeof light.metadata === 'object' ? light.metadata : {};
    light.metadata = {
      ...metadata,
      ...(source.objectId ? { nodeId: source.objectId } : {}),
      __fpsEditor: {
        sourceId: source.sourceId,
        ...(source.objectGuid ? { objectGuid: source.objectGuid } : {}),
        ...(source.objectId ? { objectId: source.objectId } : {}),
        propertyPath: 'light',
        lightType,
      },
    };
  }

  private resolveFallbackCameraRig(): SceneCameraRigConfig {
    const camCfg = (renderingConfig as any).globalVolume?.camera ?? {};
    const target = readPosition3D(camCfg.target);
    return {
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
    };
  }

  private resolveFallbackCameraTarget(): Vector3 {
    const camCfg = (renderingConfig as any).globalVolume?.camera ?? {};
    const target = readPosition3D(camCfg.target);
    if (!target) return new Vector3(0, 0, 0);
    return new Vector3(target.x, target.y, target.z);
  }

  private resolveDirectionalLightSource(): SceneRuntimeLightState<SceneDirectionalLightConfig> {
    const node = configService.getSceneDirectionalLightNode();
    if (node?.light?.type === 'directional') {
      return {
        light: node.light,
        enabled: node.enabled !== false,
        ...(node.source ? { source: node.source } : {}),
      };
    }
    return {
      light: this.resolveFallbackDirectionalLight(),
      enabled: true,
    };
  }

  private resolveHemisphericLightSource(): SceneRuntimeLightState<SceneHemisphericLightConfig> {
    const node = configService.getSceneHemisphericLightNode();
    if (node?.light?.type === 'hemispheric') {
      return {
        light: node.light,
        enabled: node.enabled !== false,
        ...(node.source ? { source: node.source } : {}),
      };
    }
    return {
      light: this.resolveFallbackHemisphericLight(),
      enabled: true,
    };
  }

  private resolveFallbackHemisphericLight(): SceneHemisphericLightConfig {
    const lightsCfg = (renderingConfig as any).globalVolume?.lights ?? {};
    const hemispheric = lightsCfg.hemispheric ?? {};
    const diffuseColor = readColorRGB(hemispheric.diffuseColor ?? hemispheric.skyLightColor);
    const groundColor = readColorRGB(hemispheric.groundColor);
    return {
      type: 'hemispheric',
      intensity: readNonNegativeFiniteNumber(hemispheric.intensity, 0.8),
      ...(diffuseColor ? { diffuseColor } : {}),
      ...(groundColor ? { groundColor } : {}),
    };
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
    this.sceneNodeMaterialScopeRoots.set(configService.getSceneRootId(), this.root);
    this.sceneNodeCleanup.set(configService.getSceneRootId(), null);

    const nodes = configService.getSceneNodes();
    if (nodes.length === 0) return;

    await this.buildSceneNodePass(nodes);
  }

  getSceneNodeRuntime(id: string): TransformNode | undefined {
    return this.sceneNodeRuntimes.get(id);
  }

  getSceneNodeMaterialScopeRoot(id: string): TransformNode | undefined {
    return this.sceneNodeMaterialScopeRoots.get(id) ?? this.sceneNodeRuntimes.get(id);
  }

  getSceneNodeAnimationGroups(id: string): AnimationGroup[] {
    return this.sceneNodeAnimationGroups.get(id) ?? [];
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
    this.sceneNodeMaterialScopeRoots.delete(id);
    this.sceneNodeCleanup.delete(id);
    this.sceneNodeAnimationGroups.delete(id);
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
    this.attachSceneNodeMetadata(
      runtimeNode,
      nodeConfig.id,
      nodeConfig.source,
      nodeConfig.shadow,
      nodeConfig.shadowPlan,
    );
    this.applyTransform(runtimeNode, nodeConfig.transform);
    runtimeNode.parent = parent;
    runtimeNode.setEnabled(nodeConfig.enabled !== false);
    this.sceneNodeRuntimes.set(nodeConfig.id, runtimeNode);
    this.sceneNodeMaterialScopeRoots.set(nodeConfig.id, runtimeNode);

    if (nodeConfig.kind === 'transform') {
      this.attachTransformRuntime(nodeConfig, runtimeNode);
      this.applySceneNodeRendering(nodeConfig, runtimeNode);
      this.applyNodeMaterialEntries(nodeConfig, runtimeNode);
      this.applySceneNodeOverrides(nodeConfig, runtimeNode);
      this.sceneNodeCleanup.set(nodeConfig.id, null);
      return runtimeNode;
    }

    if (nodeConfig.kind === 'primitive') {
      this.applySceneNodeRendering(nodeConfig, runtimeNode);
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
    const rootName = nodeConfig.name ?? nodeConfig.id;
    const shape = nodeConfig.primitive.shape;
    const meshName = `${nodeConfig.id}.${shape ?? 'primitive'}Projection`;
    const root = new TransformNode(`${nodeConfig.id}.projection`, this.scene);
    root.id = nodeConfig.id;
    root.name = rootName;
    const mesh = shape === 'sphere'
      ? builder.CreateSphere?.(meshName, { diameter: 1, segments: 32 }, this.scene)
      : shape === 'plane'
        ? builder.CreateGround?.(meshName, { width: 1, height: 1, subdivisions: 1 }, this.scene)
        : shape === 'capsule'
          ? builder.CreateCapsule?.(meshName, { height: 2, radius: 0.5, tessellation: 24, subdivisions: 8 }, this.scene)
            ?? builder.CreateCylinder?.(meshName, { height: 2, diameter: 1, tessellation: 24 }, this.scene)
          : builder.CreateBox?.(meshName, { size: 1 }, this.scene);
    const runtimeMesh = mesh as (TransformNode & { material?: unknown; metadata?: unknown }) | undefined;
    if (!runtimeMesh) return root;
    runtimeMesh.parent = root;
    runtimeMesh.metadata = {
      ...(runtimeMesh.metadata && typeof runtimeMesh.metadata === 'object' ? runtimeMesh.metadata : {}),
      editorProjection: {
        nodeId: nodeConfig.id,
        runtimeKind: 'primitive',
        primitiveShape: shape,
        ...(nodeConfig.shadow ? { shadow: structuredClone(nodeConfig.shadow) } : {}),
        ...(nodeConfig.shadowPlan ? { shadowPlan: structuredClone(nodeConfig.shadowPlan) } : {}),
      },
    };
    const materialKind = this.resolvePrimitiveMaterialKind(nodeConfig);
    const material = materialKind === 'standard'
      ? new StandardMaterial(`${nodeConfig.id}_primitive_mat`, this.scene)
      : new PBRMaterial(`${nodeConfig.id}_primitive_mat`, this.scene);
    if ('albedoColor' in material) material.albedoColor = new Color3(0.72, 0.74, 0.76);
    else material.diffuseColor = new Color3(0.72, 0.74, 0.76);
    if ('specularColor' in material) material.specularColor = new Color3(0.12, 0.14, 0.16);
    if ('metallic' in material) material.metallic = 0;
    if ('roughness' in material) material.roughness = 1;
    if (shape === 'plane') material.backFaceCulling = false;
    runtimeMesh.material = material;
    (root as any).material = material;
    return root;
  }

  private resolvePrimitiveMaterialKind(nodeConfig: ScenePrimitiveNode): SceneMaterialAssetKind {
    return this.resolveMaterialBindingKind(nodeConfig.overrides?.materialBinding) ?? 'pbr';
  }

  private resolveMaterialBindingKind(binding: SceneNodeMaterialBindingConfig | undefined): SceneMaterialAssetKind | null {
    if (!binding) return null;
    return resolveEditorSceneArtistMaterialBinding(this.getMaterialAssetCatalog(), binding).materialAssetKind;
  }

  private async attachInstanceAssetAsync(
    nodeConfig: SceneInstanceNode,
    runtimeNode: TransformNode,
  ): Promise<TransformNode | null> {
    let attached: { asset: SceneAssetConfig; modelNode: TransformNode; animations: AnimationGroup[]; cleanup: () => void } | null = null;
    try {
      attached = await this.createSceneAssetRuntime(nodeConfig, 'async');
    } catch (error) {
      console.warn(`[SceneBuilder] Failed to attach scene asset for node "${nodeConfig.id}"`, error);
    }
    if (!attached) {
      this.sceneNodeRuntimes.delete(nodeConfig.id);
      this.sceneNodeMaterialScopeRoots.delete(nodeConfig.id);
      runtimeNode.dispose();
      return null;
    }

    attached.modelNode.parent = runtimeNode;
    this.sceneNodeAnimationGroups.set(nodeConfig.id, attached.animations);
    this.applyTransform(attached.modelNode, attached.asset.defaults?.transform);
    this.applyChildTransforms(attached.modelNode, nodeConfig.overrides?.childTransforms);
    this.applySharedMaterialOverrides(attached.asset, attached.modelNode);
    const restoreRendering = this.applySceneNodeRendering(nodeConfig, runtimeNode, attached.modelNode);
    this.sceneNodeMaterialScopeRoots.set(nodeConfig.id, attached.modelNode);
    this.applyNodeMaterialEntries(nodeConfig, attached.modelNode);
    this.applySharedOutlineOverrides(attached.asset, attached.modelNode);
    this.applySceneNodeOverrides(nodeConfig, runtimeNode, attached.asset, attached.modelNode);
    this.sceneNodeCleanup.set(nodeConfig.id, () => {
      restoreRendering?.();
      attached.cleanup();
    });
    return runtimeNode;
  }

  private attachInstanceAssetSync(
    nodeConfig: SceneInstanceNode,
    runtimeNode: TransformNode,
  ): TransformNode | null {
    let attached: { asset: SceneAssetConfig; modelNode: TransformNode; animations: AnimationGroup[]; cleanup: () => void } | null = null;
    try {
      attached = this.createSceneAssetRuntime(nodeConfig, 'sync');
    } catch (error) {
      console.warn(`[SceneBuilder] Failed to attach scene asset for node "${nodeConfig.id}"`, error);
    }
    if (!attached) {
      this.sceneNodeRuntimes.delete(nodeConfig.id);
      this.sceneNodeMaterialScopeRoots.delete(nodeConfig.id);
      runtimeNode.dispose();
      return null;
    }

    attached.modelNode.parent = runtimeNode;
    this.sceneNodeAnimationGroups.set(nodeConfig.id, attached.animations);
    this.applyTransform(attached.modelNode, attached.asset.defaults?.transform);
    this.applyChildTransforms(attached.modelNode, nodeConfig.overrides?.childTransforms);
    this.applySharedMaterialOverrides(attached.asset, attached.modelNode);
    const restoreRendering = this.applySceneNodeRendering(nodeConfig, runtimeNode, attached.modelNode);
    this.sceneNodeMaterialScopeRoots.set(nodeConfig.id, attached.modelNode);
    this.applyNodeMaterialEntries(nodeConfig, attached.modelNode);
    this.applySharedOutlineOverrides(attached.asset, attached.modelNode);
    this.applySceneNodeOverrides(nodeConfig, runtimeNode, attached.asset, attached.modelNode);
    this.sceneNodeCleanup.set(nodeConfig.id, () => {
      restoreRendering?.();
      attached.cleanup();
    });
    return runtimeNode;
  }

  private async createSceneAssetRuntime(
    nodeConfig: SceneInstanceNode,
    mode: 'async',
  ): Promise<{ asset: SceneAssetConfig; modelNode: TransformNode; animations: AnimationGroup[]; cleanup: () => void } | null>;
  private createSceneAssetRuntime(
    nodeConfig: SceneInstanceNode,
    mode: 'sync',
  ): { asset: SceneAssetConfig; modelNode: TransformNode; animations: AnimationGroup[]; cleanup: () => void } | null;
  private createSceneAssetRuntime(
    nodeConfig: SceneInstanceNode,
    mode: 'async' | 'sync',
  ): Promise<{ asset: SceneAssetConfig; modelNode: TransformNode; animations: AnimationGroup[]; cleanup: () => void } | null> | { asset: SceneAssetConfig; modelNode: TransformNode; animations: AnimationGroup[]; cleanup: () => void } | null {
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
  ): Promise<{ asset: SceneAssetConfig; modelNode: TransformNode; animations: AnimationGroup[]; cleanup: () => void } | null> {
    if (asset.singleton && this.modelPool) {
      const pooled = await this.modelPool.acquireOnce(asset.id);
      pooled.node.setEnabled(true);
      return {
        asset,
        modelNode: pooled.node,
        animations: pooled.animations,
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
        animations: pooled.animations,
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
      animations: [],
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
  ): { asset: SceneAssetConfig; modelNode: TransformNode; animations: AnimationGroup[]; cleanup: () => void } | null {
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
      animations: pooled.animations,
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
    if (overrides?.materialBinding) return true;
    if (Object.keys(overrides?.materialSlotBindings ?? {}).length > 0) return true;
    if (overrides?.material) return true;

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
    const runtimeOptions = { babylon: BABYLON_MATERIAL_RUNTIME };
    const albedoColor = properties.albedoColor ?? properties.diffuseColor;
    if (albedoColor) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.albedoColor', albedoColor, runtimeOptions);
    }
    if (properties.emissiveColor) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.emissiveColor', properties.emissiveColor, runtimeOptions);
    }
    if (properties.metallic !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.metallic', properties.metallic, runtimeOptions);
    }
    if (properties.roughness !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.roughness', properties.roughness, runtimeOptions);
    }
    if (properties.alpha !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.alpha', properties.alpha, runtimeOptions);
    }
    if (properties.alphaCutOff !== undefined && 'alphaCutOff' in material) {
      material.alphaCutOff = properties.alphaCutOff;
    }
    if (properties.transparencyMode !== undefined && 'transparencyMode' in material) {
      material.transparencyMode = properties.transparencyMode;
    }
    if (properties.backFaceCulling !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.backFaceCulling', properties.backFaceCulling, runtimeOptions);
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
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.albedoTexture.url', properties.albedoTexture?.url ?? null, runtimeOptions);
    }
    if (properties.normalTexture !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.normalTexture.url', properties.normalTexture?.url ?? null, runtimeOptions);
    }
    if (properties.metallicTexture !== undefined) {
      applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.metallicTexture.url', properties.metallicTexture?.url ?? null, runtimeOptions);
    }
    this.applyTypedMaterialLightingOverride(material, properties);
  }

  private applyTypedMaterialLightingOverride(material: any, override: MaterialOverrideConfig): void {
    const runtimeOptions = { babylon: BABYLON_MATERIAL_RUNTIME };
    const materialRuntimeKind = resolveMaterialRuntimeKind(material);
    if (materialRuntimeKind === 'pbr' && override.pbr) {
      const pbr = override.pbr;
      if (pbr.albedoColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.albedoColor', pbr.albedoColor, runtimeOptions);
      }
      if (pbr.baseWeight !== undefined) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.baseWeight', pbr.baseWeight, runtimeOptions);
      }
      if (pbr.reflectivityColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.reflectivityColor', pbr.reflectivityColor, runtimeOptions);
      }
      if (pbr.microSurface !== undefined) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.microSurface', pbr.microSurface, runtimeOptions);
      }
      if (pbr.emissiveColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.emissiveColor', pbr.emissiveColor, runtimeOptions);
      }
      if (pbr.ambientColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.ambientColor', pbr.ambientColor, runtimeOptions);
      }
      if (pbr.lightFalloff !== undefined) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.pbr.lightFalloff', pbr.lightFalloff, runtimeOptions);
      }
      return;
    }

    if (materialRuntimeKind === 'standard' && override.standard) {
      const standard = override.standard;
      if (standard.diffuseColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.diffuseColor', standard.diffuseColor, runtimeOptions);
      }
      if (standard.specularColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.specularColor', standard.specularColor, runtimeOptions);
      }
      if (standard.specularPower !== undefined) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.specularPower', standard.specularPower, runtimeOptions);
      }
      if (standard.emissiveColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.emissiveColor', standard.emissiveColor, runtimeOptions);
      }
      if (standard.ambientColor) {
        applyMaterialValueToRuntimeMaterial(material, this.scene, 'material.standard.ambientColor', standard.ambientColor, runtimeOptions);
      }
      if (standard.useSpecularOverAlpha !== undefined) {
        applyMaterialValueToRuntimeMaterial(
          material,
          this.scene,
          'material.standard.useSpecularOverAlpha',
          standard.useSpecularOverAlpha,
          runtimeOptions,
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
    if (nodeConfig.marker) {
      const marker = structuredClone(nodeConfig.marker);
      (runtimeNode as any).marker = marker;
      runtimeNode.metadata = {
        ...(runtimeNode.metadata && typeof runtimeNode.metadata === 'object' ? runtimeNode.metadata : {}),
        sceneMarker: marker,
      };
    }

    if (
      nodeConfig.transformType === 'groundDecal'
      && nodeConfig.groundDecal
      && isGroundDecalUiConfig(nodeConfig.groundDecal)
    ) {
      this.attachGroundDecalUiRuntime(nodeConfig, runtimeNode, nodeConfig.groundDecal);
    }
  }

  private attachGroundDecalUiRuntime(
    nodeConfig: SceneTransformNode,
    runtimeNode: TransformNode,
    decal: GroundDecalUiConfig,
  ): void {
    const mesh = runtimeNode as any;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.alphaIndex = decal.rendering?.alphaIndex ?? 100;
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      disableBlobShadow: true,
      disableStaticProjectedShadow: true,
      disablePlanarShadow: true,
      groundDecalUi: {
        nodeId: nodeConfig.id,
        uiKind: decal.uiKind,
      },
    };

    const mat = new StandardMaterial(`${nodeConfig.id}_ground_decal_ui_mat`, this.scene);
    const { texture } = createGroundDecalUiDynamicTexture(`${nodeConfig.id}_ground_decal_ui_texture`, this.scene, decal);
    mat.diffuseTexture = texture;
    mat.useAlphaFromDiffuseTexture = true;
    mat.diffuseColor = new Color3(1, 1, 1);
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.specularColor = new Color3(0, 0, 0);
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    if (typeof decal.rendering?.diffuseTextureLevel === 'number' && Number.isFinite(decal.rendering.diffuseTextureLevel)) {
      mat.diffuseTexture.level = decal.rendering.diffuseTextureLevel;
    }
    if (
      typeof decal.rendering?.emissiveTextureLevel === 'number'
      && Number.isFinite(decal.rendering.emissiveTextureLevel)
      && decal.rendering.emissiveTextureLevel > 0
    ) {
      mat.emissiveTexture = texture;
      mat.emissiveTexture.level = decal.rendering.emissiveTextureLevel;
    }
    mesh.material = mat;
  }

  private applySceneNodeRendering(
    nodeConfig: SceneInstanceNode | SceneTransformNode | ScenePrimitiveNode,
    rootNode: TransformNode,
    contentRoot?: TransformNode | null,
  ): (() => void) | null {
    const rendering = resolveEditorSceneGameObjectRendering({
      rendering: nodeConfig.rendering,
    });
    if (!rendering) return null;
    if (typeof rendering.renderingGroupId === 'number') {
      (rootNode as any).renderingGroupId = rendering.renderingGroupId;
    }
    if (typeof rendering.alphaIndex === 'number') {
      (rootNode as any).alphaIndex = rendering.alphaIndex;
    }
    return applyBabylonRenderingToNodeTree(rootNode, rendering, contentRoot);
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
    const nextAssetIds = new Set<string>();
    this.sceneAssetConfigs.clear();
    for (const asset of configService.getSceneAssets()) {
      nextAssetIds.add(asset.id);
      this.upsertSceneAssetConfig(asset);
    }
    for (const assetId of this.sceneAssetRuntimeUrlIds) {
      if (nextAssetIds.has(assetId)) continue;
      this.assetLoader.unregisterOwnedRuntimeModelUrl(assetId, this.sceneAssetRuntimeUrlOwner);
      this.sceneAssetRuntimeUrlIds.delete(assetId);
    }
  }

  private attachSceneNodeMetadata(
    node: TransformNode,
    nodeId: string,
    source?: SceneRuntimeSourceBinding,
    shadow?: SceneNodeConfig['shadow'],
    shadowPlan?: SceneNodeConfig['shadowPlan'],
  ): void {
    const metadata = node.metadata && typeof node.metadata === 'object' ? node.metadata : {};
    const editorProjection = metadata.editorProjection
      && typeof metadata.editorProjection === 'object'
      && !Array.isArray(metadata.editorProjection)
      ? metadata.editorProjection as Record<string, unknown>
      : {};
    const nextMetadata: Record<string, unknown> = {
      ...metadata,
      sceneNodeId: nodeId,
      nodeId,
      editorProjection: {
        ...editorProjection,
        nodeId,
        ...(shadow ? { shadow: structuredClone(shadow) } : {}),
        ...(shadowPlan ? { shadowPlan: structuredClone(shadowPlan) } : {}),
      },
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
    this.sceneNodeMaterialScopeRoots.clear();
    this.sceneNodeCleanup.clear();
    this.sceneNodeAnimationGroups.clear();
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
    materialScopeRoot: TransformNode = rootNode,
  ): void {
    const overrides = nodeConfig.overrides;
    if (!overrides) return;

    if (nodeConfig.kind === 'transform' || nodeConfig.kind === 'primitive') {
      this.applyChildTransforms(rootNode, overrides.childTransforms);
    }

    if (overrides.materialBinding) {
      this.applyMaterialBinding(materialScopeRoot, '', overrides.materialBinding, nodeConfig.id, asset);
    }

    for (const [slotId, materialBinding] of Object.entries(overrides.materialSlotBindings ?? {})) {
      const materialSlot = this.resolveSceneAssetMaterialSlot(asset, slotId, materialBinding);
      if (!materialSlot) {
        if (this.shouldSkipStaleImportedMaterialSlotBinding(asset, slotId, materialBinding)) continue;
        this.logMaterialSlotOwnerResolutionFailure(materialScopeRoot, {
          sceneNodeId: nodeConfig.id,
          asset,
          slotId,
          ownerNodePath: '',
          materialAssetId: readSceneNodeMaterialBindingAssetId(materialBinding),
          projectionNodeId: nodeConfig.id,
          reason: 'slot-descriptor-not-found',
        });
        continue;
      }
      this.applyMaterialSlotBinding(materialScopeRoot, materialSlot, materialBinding, nodeConfig.id, asset);
    }

    if (overrides.material) {
      this.applyMaterialOverride(materialScopeRoot, '', overrides.material, nodeConfig.id, asset);
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
    const ownerNodes = this.resolveMaterialOverrideOwnerNodes(rootNode, ownerNodePath);
    if (ownerNodes.length === 0) return;

    for (const ownerNode of ownerNodes) {
      if (asset && this.shouldShareAssetMaterials(asset)) {
        this.detachOverrideMaterial(ownerNode, sceneNodeId, ownerNodePath);
      }
      this.applyMaterialPropertiesToRuntimeMaterial(ownerNode.material, override);
    }
  }

  private applyMaterialBinding(
    rootNode: TransformNode,
    ownerNodePath: string,
    binding: SceneNodeMaterialBindingConfig,
    sceneNodeId: string,
    asset?: SceneAssetConfig,
  ): void {
    const ownerNodes = this.resolveMaterialOverrideOwnerNodes(rootNode, ownerNodePath);
    if (ownerNodes.length === 0) return;

    const { profile } = resolveEditorSceneArtistMaterialBinding(this.getMaterialAssetCatalog(), binding);
    if (Object.keys(profile).length === 0) return;

    for (const ownerNode of ownerNodes) {
      if (asset && this.shouldShareAssetMaterials(asset)) {
        this.detachOverrideMaterial(ownerNode, sceneNodeId, ownerNodePath);
      }
      this.applyArtistMaterialProfileToRuntimeMaterial(ownerNode.material, profile);
    }
  }

  private applyMaterialSlotBinding(
    rootNode: TransformNode,
    materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
    binding: SceneNodeMaterialBindingConfig,
    sceneNodeId: string,
    asset?: SceneAssetConfig,
  ): void {
    const ownerNodes = this.resolveMaterialSlotBindingOwnerNodes(rootNode, materialSlot, {
      sceneNodeId,
      asset,
      materialAssetId: readSceneNodeMaterialBindingAssetId(binding),
    });
    if (ownerNodes.length === 0) return;

    const { profile } = resolveEditorSceneArtistMaterialBinding(this.getMaterialAssetCatalog(), binding);
    if (Object.keys(profile).length === 0) return;

    for (const ownerNode of ownerNodes) {
      const target = this.resolveMaterialSlotRuntimeMaterialTarget(ownerNode, materialSlot, {
        sceneNodeId,
        detachSharedMaterial: !!asset && this.shouldShareAssetMaterials(asset),
        primitiveSingleMaterialFallbackAllowed:
          ownerNodes.length === 1 && this.isSinglePrimitiveSceneAssetMaterialSlot(asset, materialSlot, sceneNodeId),
      });
      if (!target) continue;
      this.applyArtistMaterialProfileToRuntimeMaterial(target.material, profile);
    }
  }

  private resolveMaterialSlotRuntimeMaterialTarget(
    ownerNode: any,
    materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
    context: {
      sceneNodeId: string;
      detachSharedMaterial: boolean;
      primitiveSingleMaterialFallbackAllowed: boolean;
    },
  ): SceneBuilderMaterialSlotTarget | null {
    if (!ownerNode?.material) return null;
    let material = ownerNode.material;
    if (materialSlot.primitiveIndex == null) {
      if (context.detachSharedMaterial) {
        this.detachOverrideMaterial(ownerNode, context.sceneNodeId, materialSlot.ownerNodePath);
      }
      return { material: ownerNode.material };
    }
    if (!Array.isArray(material?.subMaterials)) {
      if (!isSceneBuilderRuntimeSplitPrimitiveOwnerNode(ownerNode, materialSlot)
        && (materialSlot.primitiveIndex !== 0 || !context.primitiveSingleMaterialFallbackAllowed)) return null;
      if (context.detachSharedMaterial) {
        this.detachOverrideMaterial(ownerNode, context.sceneNodeId, materialSlot.ownerNodePath);
      }
      return { material: ownerNode.material };
    }
    if (context.detachSharedMaterial) {
      this.detachOverrideMaterial(ownerNode, context.sceneNodeId, materialSlot.ownerNodePath);
      material = ownerNode.material;
    }
    const subMaterial = this.detachMaterialSlotPrimitiveSubMaterial(material, materialSlot, context.sceneNodeId);
    return subMaterial ? { material: subMaterial } : null;
  }

  private detachMaterialSlotPrimitiveSubMaterial(
    material: any,
    materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
    sceneNodeId: string,
  ): any | null {
    if (!Array.isArray(material?.subMaterials)) return null;
    const primitiveIndex = materialSlot.primitiveIndex;
    if (primitiveIndex == null || primitiveIndex < 0 || primitiveIndex >= material.subMaterials.length) return null;
    const subMaterial = material.subMaterials[primitiveIndex];
    if (!subMaterial || typeof subMaterial !== 'object' || typeof subMaterial.clone !== 'function') return null;
    const cloneName = createSceneBuilderMaterialSlotSubMaterialName(subMaterial, materialSlot, sceneNodeId, primitiveIndex);
    const clonedSubMaterial = subMaterial.clone(cloneName);
    if (!clonedSubMaterial) return null;
    material.subMaterials[primitiveIndex] = clonedSubMaterial;
    return clonedSubMaterial;
  }

  private getMaterialAssetCatalog(): { scene: { materialAssets: NonNullable<ReturnType<typeof configService.getSceneDocument>['scene']>['materialAssets'] } } {
    return {
      scene: {
        materialAssets: configService.getSceneDocument().scene?.materialAssets ?? [],
      },
    };
  }

  private resolveSceneAssetMaterialSlot(
    asset: SceneAssetConfig | undefined,
    slotId: string,
    binding?: SceneNodeMaterialBindingConfig,
  ): SceneBuilderMaterialSlotSourceDescriptor | null {
    const normalizedSlotId = typeof slotId === 'string' ? slotId.trim() : '';
    if (!asset || !normalizedSlotId) return null;
    const materialSlots = readSceneBuilderAssetMaterialSlots(asset);
    for (const materialSlot of materialSlots) {
      if (!isRecord(materialSlot)) continue;
      const record = materialSlot;
      if (typeof record.slotId !== 'string' || record.slotId.trim() !== normalizedSlotId) continue;
      return readOptionalSceneBuilderMaterialSlotSourceDescriptor(record, normalizedSlotId);
    }
    const origin = this.readMaterialBindingImportedOrigin(asset, binding);
    if (!origin) return null;
    if (origin.sourceSlotId && origin.sourceSlotId !== normalizedSlotId) return null;
    const candidates: SceneBuilderMaterialSlotSourceDescriptor[] = [];
    for (const rawSlot of materialSlots) {
      const candidateSlotId = isRecord(rawSlot) && typeof rawSlot.slotId === 'string' ? rawSlot.slotId.trim() : '';
      const descriptor = readOptionalSceneBuilderMaterialSlotSourceDescriptor(rawSlot, candidateSlotId);
      if (!descriptor) continue;
      if (!collectSceneBuilderMaterialSlotSourceMaterialIndices(descriptor).includes(origin.sourceMaterialIndex)) continue;
      candidates.push(descriptor);
    }
    return candidates.length === 1 ? candidates[0] : null;
  }

  private shouldSkipStaleImportedMaterialSlotBinding(
    asset: SceneAssetConfig | undefined,
    slotId: string,
    binding: SceneNodeMaterialBindingConfig | undefined,
  ): boolean {
    if (!asset) return false;
    const normalizedSlotId = typeof slotId === 'string' ? slotId.trim() : '';
    if (!normalizedSlotId) return false;
    const origin = this.readMaterialBindingImportedOrigin(asset, binding);
    return !!origin?.sourceSlotId && origin.sourceSlotId !== normalizedSlotId;
  }

  private readMaterialBindingImportedOrigin(
    asset: SceneAssetConfig,
    binding: SceneNodeMaterialBindingConfig | undefined,
  ): { sourceMaterialIndex: number; sourceSlotId?: string } | null {
    const materialAssetId = readSceneNodeMaterialBindingAssetId(binding);
    if (!materialAssetId) return null;
    const materialAsset = (this.getMaterialAssetCatalog().scene.materialAssets ?? []).find(entry => entry?.id === materialAssetId);
    if (!isRecord(materialAsset?.origin) || materialAsset.origin.type !== 'imported') return null;
    const sourceMaterialIndex = materialAsset.origin.sourceMaterialIndex;
    if (!Number.isInteger(sourceMaterialIndex)) return null;
    const sourceAssetGuid = typeof materialAsset.origin.sourceAssetGuid === 'string' ? materialAsset.origin.sourceAssetGuid.trim() : '';
    const sourceAssetId = typeof materialAsset.origin.sourceAssetId === 'string' ? materialAsset.origin.sourceAssetId.trim() : '';
    const matchesGuid = !!asset.guid && !!sourceAssetGuid && sourceAssetGuid === asset.guid;
    const matchesId = !!asset.id && !!sourceAssetId && sourceAssetId === asset.id;
    if ((sourceAssetGuid || sourceAssetId) && !matchesGuid && !matchesId) return null;
    if (!sourceAssetGuid && !sourceAssetId && (asset.guid || asset.id)) return null;
    const sourceSlotId = typeof materialAsset.origin.sourceSlotId === 'string' ? materialAsset.origin.sourceSlotId.trim() : '';
    return {
      sourceMaterialIndex: sourceMaterialIndex as number,
      ...(sourceSlotId ? { sourceSlotId } : {}),
    };
  }

  private isSinglePrimitiveSceneAssetMaterialSlot(
    asset: SceneAssetConfig | undefined,
    materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
    sceneNodeId: string,
  ): boolean {
    if (!asset || materialSlot.primitiveIndex !== 0) return false;
    const rawSlots = readSceneBuilderAssetMaterialSlots(asset);
    if (rawSlots.length === 0) return false;
    const resolveContext = { projectionNodeId: sceneNodeId };
    const slotKey = createMaterialSlotOwnerPathMatchKey(materialSlot.ownerNodePath, resolveContext);
    const matchingPrimitiveSlots: SceneBuilderMaterialSlotSourceDescriptor[] = [];
    for (const rawSlot of rawSlots) {
      const slotId = isRecord(rawSlot) && typeof rawSlot.slotId === 'string' ? rawSlot.slotId.trim() : '';
      const descriptor = readOptionalSceneBuilderMaterialSlotSourceDescriptor(rawSlot, slotId);
      if (!descriptor || descriptor.primitiveIndex == null) continue;
      if (createMaterialSlotOwnerPathMatchKey(descriptor.ownerNodePath, resolveContext) !== slotKey) continue;
      if (!isSceneBuilderMaterialSlotSameMesh(descriptor, materialSlot)) continue;
      matchingPrimitiveSlots.push(descriptor);
    }
    return matchingPrimitiveSlots.length === 1 && matchingPrimitiveSlots[0]?.primitiveIndex === 0;
  }

  private resolveMaterialSlotBindingOwnerNodes(
    rootNode: TransformNode,
    materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
    context: {
      sceneNodeId: string;
      asset?: SceneAssetConfig;
      materialAssetId: string | null;
    },
  ): any[] {
    const ownerNodes = resolveMaterialSlotOwnerNodes(rootNode, materialSlot, {
      projectionNodeId: context.sceneNodeId,
    })
      .filter((ownerNode: any) => !!ownerNode?.material);
    if (ownerNodes.length > 0) return ownerNodes;

    const fallbackOwnerNodes = this.resolveMaterialSlotBindingFallbackOwnerNodes(rootNode, materialSlot, context);
    if (fallbackOwnerNodes.length > 0) return fallbackOwnerNodes;

    this.logMaterialSlotOwnerResolutionFailure(rootNode, {
      sceneNodeId: context.sceneNodeId,
      asset: context.asset,
      slotId: materialSlot.slotId ?? '',
      ownerNodePath: materialSlot.ownerNodePath,
      materialAssetId: context.materialAssetId,
      projectionNodeId: context.sceneNodeId,
      reason: 'owner-node-not-found',
    });
    return [];
  }

  private resolveMaterialSlotBindingFallbackOwnerNodes(
    rootNode: TransformNode,
    materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
    context: {
      sceneNodeId: string;
      asset?: SceneAssetConfig;
    },
  ): any[] {
    const candidates = collectMaterialOwnerCandidateNodes(rootNode);
    if (candidates.length === 0) return [];
    const expectedNames = collectSceneBuilderMaterialSlotOwnerFallbackNames(materialSlot, context.asset);
    const namedMatches = candidates.filter((candidate: any) => {
      const candidateNames = collectRuntimeNodeMatchNames(candidate);
      return candidateNames.some(candidateName => expectedNames.has(candidateName));
    });
    if (namedMatches.length === 1) return namedMatches;
    return [];
  }

  private resolveMaterialOverrideOwnerNodes(rootNode: TransformNode, ownerNodePath: string): any[] {
    const ownerNode = resolveMaterialOwnerNode(rootNode, ownerNodePath);
    if (!ownerNode) return [];
    if ((ownerNode as any).material) return [ownerNode];
    const childMeshes = typeof (ownerNode as any).getChildMeshes === 'function'
      ? (ownerNode as any).getChildMeshes(false)
      : [];
    return childMeshes.filter((mesh: any) => !!mesh?.material);
  }

  private logMaterialSlotOwnerResolutionFailure(
    rootNode: TransformNode,
    diagnostic: {
      sceneNodeId: string;
      asset?: SceneAssetConfig;
      slotId: string;
      ownerNodePath: string;
      materialAssetId: string | null;
      projectionNodeId: string;
      reason: string;
    },
  ): void {
    if (!shouldLogSceneBuilderMaterialDiagnostics()) return;
    const resolveContext = { projectionNodeId: diagnostic.projectionNodeId };
    const normalizedOwnerPath = normalizeMaterialSlotOwnerPath(diagnostic.ownerNodePath, resolveContext);
    console.warn('[SceneBuilder] Material slot owner node not found', {
      reason: diagnostic.reason,
      nodeId: diagnostic.sceneNodeId,
      assetId: diagnostic.asset?.id ?? null,
      slotId: diagnostic.slotId || null,
      ownerNodePath: diagnostic.ownerNodePath || null,
      normalizedOwnerPath,
      matchKey: createMaterialSlotOwnerPathMatchKey(diagnostic.ownerNodePath, resolveContext),
      candidateMeshNames: collectMaterialOwnerCandidateNames(rootNode),
      materialAssetId: diagnostic.materialAssetId,
    });
  }

  private applyArtistMaterialProfileToRuntimeMaterial(material: any, profile: ArtistMaterialProfile): void {
    const textureUrlResolverKey = `resolve${'Texture'}Url`;
    applyPlayableArtistMaterialProfileToRuntimeMaterial(material, this.scene, profile as any, {
      babylon: BABYLON_MATERIAL_RUNTIME,
      [textureUrlResolverKey]: resolveSceneBuilderMaterialTextureAssetUrl,
    } as any);
  }

  private applyOutlineOverride(entity: TransformNode, override: OutlineOverrideConfig): void {
    applyPlayableBabylonOutlineOverrideToRuntimeNode(entity, override);
  }

  dispose(): void {
    const errors: unknown[] = [];
    try {
      this.clearSceneRuntime();
    } catch (error) {
      errors.push(error);
    }
    for (const assetId of [...this.sceneAssetRuntimeUrlIds]) {
      try {
        this.assetLoader.unregisterOwnedRuntimeModelUrl(assetId, this.sceneAssetRuntimeUrlOwner);
        this.sceneAssetRuntimeUrlIds.delete(assetId);
      } catch (error) {
        errors.push(error);
      }
    }
    this.shadowService = null;
    try {
      this.shadowMapExperimentSystem?.dispose();
      this.shadowMapExperimentSystem = null;
    } catch (error) {
      errors.push(error);
    }
    try {
      if (!this.root.isDisposed()) this.root.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, '[SceneBuilder] dispose failed');
    }
  }
}

function resolveSceneBuilderMaterialTextureAssetUrl(
  texture: { textureAssetId?: string | null; url?: string | null } | null | undefined,
): string | null {
  if (!texture || typeof texture !== 'object') return null;
  const textureAssetId = typeof texture.textureAssetId === 'string' ? texture.textureAssetId.trim() : '';
  if (textureAssetId) return resolveTextureAssetUrl(textureAssetId) ?? null;
  const textureUrl = typeof texture.url === 'string' ? texture.url.trim() : '';
  return textureUrl || null;
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readSceneBuilderMaterialSlotSourceDescriptor(
  record: Record<string, unknown>,
  slotId: string,
  ownerNodePath: string,
): SceneBuilderMaterialSlotSourceDescriptor {
  return {
    slotId,
    ownerNodePath,
    ...readOptionalStringProperty(record, 'label'),
    ...readOptionalIntegerProperty(record, 'nodeIndex'),
    ...readOptionalIntegerArrayProperty(record, 'nodeIndexPath'),
    ...readOptionalIntegerProperty(record, 'meshIndex'),
    ...readOptionalIntegerProperty(record, 'primitiveIndex'),
    ...readOptionalIntegerProperty(record, 'sourceMaterialIndex'),
    ...readOptionalIntegerArrayProperty(record, 'sourceMaterialIndices'),
    ...readOptionalStringProperty(record, 'sourceMeshName'),
    ...readOptionalStringProperty(record, 'materialName'),
    ...readOptionalStringArrayProperty(record, 'materialNames'),
  };
}

function createSceneBuilderMaterialSlotSubMaterialName(
  material: any,
  materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
  sceneNodeId: string,
  primitiveIndex: number,
): string {
  const baseName = String(material?.name ?? material?.id ?? 'material');
  const slotKey = materialSlot.slotId || materialSlot.ownerNodePath || `primitive_${primitiveIndex}`;
  const suffix = `${sceneNodeId}_${slotKey}`.replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `${baseName}_slot_${suffix}_sub${primitiveIndex}`;
}

function isSceneBuilderMaterialSlotSameMesh(
  left: SceneBuilderMaterialSlotSourceDescriptor,
  right: SceneBuilderMaterialSlotSourceDescriptor,
): boolean {
  if (left.meshIndex != null || right.meshIndex != null) {
    return left.meshIndex === right.meshIndex;
  }
  return true;
}

function collectSceneBuilderMaterialSlotSourceMaterialIndices(
  materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
): number[] {
  if (materialSlot.sourceMaterialIndices?.length) {
    return [...new Set(materialSlot.sourceMaterialIndices.filter((value): value is number => Number.isInteger(value)))];
  }
  return Number.isInteger(materialSlot.sourceMaterialIndex) ? [materialSlot.sourceMaterialIndex as number] : [];
}

function readSceneNodeMaterialBindingAssetId(binding: SceneNodeMaterialBindingConfig | undefined): string | null {
  const materialAssetId = typeof binding?.materialAssetId === 'string' ? binding.materialAssetId.trim() : '';
  return materialAssetId || null;
}

function collectMaterialOwnerCandidateNodes(rootNode: TransformNode): any[] {
  const candidates = typeof (rootNode as any).getChildMeshes === 'function'
    ? (rootNode as any).getChildMeshes(false)
    : [];
  return candidates.filter((node: any) => !!node?.material);
}

function collectMaterialOwnerCandidateNames(rootNode: TransformNode): string[] {
  return collectMaterialOwnerCandidateNodes(rootNode)
    .map((node: any) => readRuntimeNodeDisplayName(node))
    .filter((name: string | null): name is string => !!name)
    .slice(0, 80);
}

function collectSceneBuilderMaterialSlotOwnerFallbackNames(
  materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
  asset: SceneAssetConfig | undefined,
): Set<string> {
  const names = new Set<string>();
  const baseNames = [
    materialSlot.ownerNodePath,
    readMaterialSlotOwnerPathLastSegment(materialSlot.ownerNodePath),
    stripPrimitiveSuffix(materialSlot.label),
    materialSlot.label,
    materialSlot.sourceMeshName,
    readSceneBuilderAssetAnalysisMeshName(asset, materialSlot.meshIndex),
  ];
  for (const name of baseNames) {
    addSceneBuilderMaterialSlotFallbackName(names, name);
    if (materialSlot.primitiveIndex != null) {
      addSceneBuilderMaterialSlotFallbackName(names, appendPrimitiveOwnerSuffix(name, materialSlot.primitiveIndex));
    }
  }
  return names;
}

function addSceneBuilderMaterialSlotFallbackName(names: Set<string>, value: string | null | undefined): void {
  const normalized = normalizeRuntimeMaterialOwnerName(value);
  if (normalized) names.add(normalized);
}

function collectRuntimeNodeMatchNames(node: any): string[] {
  const rawNames = [
    typeof node?.name === 'string' ? node.name : null,
    typeof node?.id === 'string' ? node.id : null,
    readRuntimeNodeDisplayName(node),
  ];
  const names = new Set<string>();
  for (const rawName of rawNames) {
    addSceneBuilderMaterialSlotFallbackName(names, rawName);
    for (const tailName of collectRuntimeMaterialOwnerTailNames(rawName)) {
      addSceneBuilderMaterialSlotFallbackName(names, tailName);
    }
  }
  return [...names];
}

function readRuntimeNodeDisplayName(node: any): string | null {
  const name = typeof node?.name === 'string' ? node.name.trim() : '';
  const id = typeof node?.id === 'string' ? node.id.trim() : '';
  if (name && id && name !== id) return `${name} (${id})`;
  return name || id || null;
}

function readMaterialSlotOwnerPathLastSegment(ownerNodePath: string): string | null {
  const segments = ownerNodePath.split('/').map(segment => segment.trim()).filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] ?? null : null;
}

function stripPrimitiveSuffix(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const stripped = value.replace(/\s*\/\s*Primitive\s+\d+\s*$/i, '').trim();
  return stripped || null;
}

function appendPrimitiveOwnerSuffix(value: string | null | undefined, primitiveIndex: number): string | null {
  if (typeof value !== 'string') return null;
  const baseName = stripPrimitiveSuffix(value) ?? value.trim();
  return baseName ? `${baseName}_primitive${primitiveIndex}` : null;
}

function isSceneBuilderRuntimeSplitPrimitiveOwnerNode(
  ownerNode: any,
  materialSlot: SceneBuilderMaterialSlotSourceDescriptor,
): boolean {
  if (materialSlot.primitiveIndex == null) return false;
  const primitiveNames = new Set<string>();
  for (const baseName of [
    materialSlot.ownerNodePath,
    readMaterialSlotOwnerPathLastSegment(materialSlot.ownerNodePath),
    stripPrimitiveSuffix(materialSlot.label),
    materialSlot.label,
    materialSlot.sourceMeshName,
  ]) {
    addSceneBuilderMaterialSlotFallbackName(
      primitiveNames,
      appendPrimitiveOwnerSuffix(baseName, materialSlot.primitiveIndex),
    );
  }
  return collectRuntimeNodeMatchNames(ownerNode).some(name => primitiveNames.has(name));
}

function collectRuntimeMaterialOwnerTailNames(value: string | null | undefined): string[] {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return [];
  const names = new Set<string>();
  const withoutClonePrefix = raw.replace(/^Clone of\s+/i, '').trim();
  for (const candidate of [raw, withoutClonePrefix]) {
    const colonTail = candidate.includes(':') ? candidate.split(':').pop() : '';
    const dotTail = candidate.includes('.') ? candidate.split('.').pop() : '';
    if (colonTail) names.add(colonTail);
    if (dotTail) names.add(dotTail);
  }
  return [...names];
}

function readSceneBuilderAssetAnalysisMeshName(
  asset: SceneAssetConfig | undefined,
  meshIndex: number | undefined,
): string | null {
  if (!Number.isInteger(meshIndex)) return null;
  if (Array.isArray(asset?.materialSlots)) return null;
  const assetAnalysis = isRecord(asset?.metadata?.assetAnalysis) ? asset.metadata.assetAnalysis : null;
  const meshes = Array.isArray(assetAnalysis?.meshes) ? assetAnalysis.meshes : [];
  const mesh = meshes.find((entry): entry is Record<string, unknown> => (
    isRecord(entry) && entry.meshIndex === meshIndex
  ));
  return typeof mesh?.name === 'string' ? mesh.name : null;
}

function readSceneBuilderAssetMaterialSlots(asset: SceneAssetConfig): unknown[] {
  if (Array.isArray(asset.materialSlots)) return asset.materialSlots;
  return Array.isArray(asset.metadata?.materialSlots) ? asset.metadata.materialSlots : [];
}

function normalizeRuntimeMaterialOwnerName(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  return createMaterialSlotOwnerPathMatchKey(trimmed);
}

function shouldLogSceneBuilderMaterialDiagnostics(): boolean {
  const meta = import.meta as unknown as { env?: { DEV?: boolean; PROD?: boolean; MODE?: string } };
  if (meta.env?.DEV === true) return true;
  if (meta.env?.PROD === true) return false;
  if (meta.env?.MODE === 'production') return false;
  return true;
}

function readOptionalStringProperty(
  record: Record<string, unknown>,
  key: string,
): Record<string, string> {
  const value = typeof record[key] === 'string' ? record[key].trim() : '';
  return value ? { [key]: value } : {};
}

function readOptionalStringArrayProperty(
  record: Record<string, unknown>,
  key: string,
): Record<string, string[]> {
  const values = Array.isArray(record[key])
    ? record[key].map(value => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
    : [];
  return values.length > 0 ? { [key]: values } : {};
}

function readOptionalIntegerProperty(
  record: Record<string, unknown>,
  key: string,
): Record<string, number> {
  const value = record[key];
  return Number.isInteger(value) ? { [key]: value as number } : {};
}

function readOptionalIntegerArrayProperty(
  record: Record<string, unknown>,
  key: string,
): Record<string, number[]> {
  const values = Array.isArray(record[key])
    ? record[key].filter((value): value is number => Number.isInteger(value))
    : [];
  return values.length > 0 ? { [key]: values } : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readOptionalSceneBuilderMaterialSlotSourceDescriptor(
  rawSlot: unknown,
  slotId: string,
): SceneBuilderMaterialSlotSourceDescriptor | null {
  if (!isRecord(rawSlot)) return null;
  const ownerNodePath = typeof rawSlot.ownerNodePath === 'string'
    ? rawSlot.ownerNodePath.trim()
    : typeof rawSlot.path === 'string'
      ? rawSlot.path.trim()
      : '';
  if (!ownerNodePath) return null;
  return readSceneBuilderMaterialSlotSourceDescriptor(rawSlot, slotId, ownerNodePath);
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

function cloneSceneDirectionalLight(light: SceneDirectionalLightConfig): SceneDirectionalLightConfig {
  return {
    ...light,
    direction: { ...light.direction },
    ...(light.diffuseColor ? { diffuseColor: { ...light.diffuseColor } } : {}),
  };
}

function cloneSceneHemisphericLight(light: SceneHemisphericLightConfig): SceneHemisphericLightConfig {
  return {
    ...light,
    ...(light.diffuseColor ? { diffuseColor: { ...light.diffuseColor } } : {}),
    ...(light.groundColor ? { groundColor: { ...light.groundColor } } : {}),
  };
}

function toColor3(color: ColorRGB): Color3 {
  return new Color3(color.r, color.g, color.b);
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
