/**
 * 配置类型定义 (Scaffold)
 *
 * 说明：
 * - 这是“通用脚手架”版本的最小配置类型集合
 * - 仅包含核心服务 (ConfigService / SceneBuilder / ModelPool 等) 需要的类型
 * - 具体游戏可在不破坏目录结构的前提下逐步扩展
 */

// ============================================================
// 基础类型
// ============================================================

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface PositionXZ {
  x: number;
  z: number;
}

export interface Scale3D {
  x: number;
  y: number;
  z: number;
}

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface ColorRGBA extends ColorRGB {
  a: number;
}

/**
 * TransformConfig
 *
 * 统一的变换配置：
 * - rotationDeg 用角度便于策划配置
 * - rotation 用弧度（如果你更偏好在配置里写弧度，可以使用该字段）
 */
export interface TransformConfig {
  position?: Position3D;
  rotationDeg?: Position3D;
  rotation?: Position3D;
  /** 统一缩放（number）或三维缩放（Scale3D） */
  scale?: number | Scale3D;
}

export type TransformType = 'plain' | 'light' | 'camera' | 'groundDecal';

export type ScenePrimitiveShape = 'cube' | 'sphere' | 'plane' | 'capsule';

export type SceneCameraProjection = 'orthographic' | 'perspective';

export interface SceneCameraRigConfig {
  projection?: SceneCameraProjection;
  alpha: number;
  beta: number;
  radius: number;
  orthoSize: number;
  fov?: number;
  targetOffset?: Position3D;
  minZ?: number;
  maxZ?: number;
  lowerBetaLimit?: number;
  upperBetaLimit?: number;
  lowerRadiusLimit?: number;
  upperRadiusLimit?: number;
  inertia?: number;
  targetScreenOffset?: {
    x: number;
    y: number;
  };
}

export interface SceneDirectionalLightConfig {
  type: 'directional';
  intensity: number;
  direction: Position3D;
  diffuseColor?: ColorRGB;
}

export interface SceneHemisphericLightConfig {
  type: 'hemispheric';
  intensity: number;
  diffuseColor?: ColorRGB;
  groundColor?: ColorRGB;
}

export type SceneLightConfig = SceneHemisphericLightConfig | SceneDirectionalLightConfig;

// ============================================================
// World Bounds
// ============================================================

export interface WorldBoundsConfig {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// ============================================================
// Scene VFX (可选)
// ============================================================

export interface SceneVfxConfig {
  /** effectId -> effect */
  effects: Record<string, SceneVfxEffectConfig>;
}

export interface SceneVfxEffectConfig {
  enabled?: boolean;
  position: Position3D;
  rotationDeg?: Position3D;
  systems: Record<string, SceneVfxParticleSystemConfig>;
}

export interface SceneVfxParticleSystemConfig {
  enabled?: boolean;
  capacity?: number;
  textureId?: string;
}

// ============================================================
// Scene JSON
// ============================================================

export interface SceneAssetDefaults {
  transform?: TransformConfig;
  outline?: OutlineOverrideConfig;
  childOutlines?: Record<string, OutlineOverrideConfig>;
}

export type SceneAssetMaterialMode = 'shared' | 'instance';

export interface AssetExternalRef {
  platformAssetId?: string;
  assetPath?: string;
  assetUrl?: string;
  [key: string]: unknown;
}

export interface SceneAssetConfig {
  id: string;
  guid?: string;
  type: 'glb';
  external?: AssetExternalRef;
  displayName?: string;
  category?: string;
  warmupCount?: number;
  singleton?: boolean;
  materialMode?: SceneAssetMaterialMode;
  defaults?: SceneAssetDefaults;
  metadata?: Record<string, unknown>;
}

export type SceneAuthoringSourceType = 'scene' | 'effect' | 'material' | 'gameplay-config' | 'code';

export interface SceneAuthoringSourceRef {
  sourceId: string;
  sourceType: SceneAuthoringSourceType | string;
  revision?: number;
}

export interface SceneCompiledArtifactProvenance extends SceneAuthoringSourceRef {
  compilerId: string;
  compilerVersion: string;
  compiledAt: string;
}

export interface SceneRuntimeSourceBinding extends SceneAuthoringSourceRef {
  objectGuid?: string;
  objectId?: string;
  component?: string;
  propertyPath?: string;
}

export interface SceneNodeBase {
  id: string;
  name?: string;
  kind: 'group' | 'instance' | 'transform' | 'primitive';
  parentId?: string;
  enabled?: boolean;
  transform?: TransformConfig;
  source?: SceneRuntimeSourceBinding;
}

export interface SceneGroupNode extends SceneNodeBase {
  kind: 'group';
}

export interface MaterialTextureOverrideConfig {
  url?: string;
}

export interface ArtistMaterialTextureRef {
  url?: string;
  textureAssetId?: string;
}

export interface ArtistBaseColorProfile {
  color?: ColorRGB;
  texture?: ArtistMaterialTextureRef;
  brightness?: number;
  saturation?: number;
  contrast?: number;
  hue?: number;
}

export interface ArtistEmissionProfile {
  color?: ColorRGB;
  intensity?: number;
  maskTexture?: ArtistMaterialTextureRef;
}

export interface ArtistMaterialProfile {
  baseColor?: ArtistBaseColorProfile;
  metallic?: number;
  roughness?: number;
  emission?: ArtistEmissionProfile;
}

export type SceneMaterialAssetKind = 'pbr' | 'standard';
export type SceneMaterialAssetSystemPreset = 'default-pbr' | 'default-standard';

export interface SceneMaterialAssetSystemConfig {
  readonly?: boolean;
  preset?: SceneMaterialAssetSystemPreset;
}

export type SceneMaterialAssetOriginType = 'imported' | 'created' | 'duplicated' | 'preset';

export interface SceneMaterialAssetOriginConfig {
  type: SceneMaterialAssetOriginType;
  sourceAssetGuid?: string;
  sourceAssetId?: string;
  sourceSlotId?: string;
  sourceMaterialIndex?: number;
  sourceMaterialName?: string;
  sourceMaterialAssetId?: string;
}

export interface SceneMaterialAssetConfig {
  id: string;
  guid?: string;
  name: string;
  profile: ArtistMaterialProfile;
  materialKind?: SceneMaterialAssetKind;
  system?: SceneMaterialAssetSystemConfig;
  origin?: SceneMaterialAssetOriginConfig;
}

export interface SceneNodeMaterialBindingConfig {
  materialAssetId?: string;
  override?: ArtistMaterialProfile;
}

export interface PbrMaterialLightingOverrideConfig {
  albedoColor?: ColorRGB;
  baseWeight?: number;
  reflectivityColor?: ColorRGB;
  microSurface?: number;
  emissiveColor?: ColorRGB;
  ambientColor?: ColorRGB;
  lightFalloff?: number;
  directIntensity?: number;
  emissiveIntensity?: number;
  environmentIntensity?: number;
  specularIntensity?: number;
  metallicF0Factor?: number;
  indexOfRefraction?: number;
}

export interface StandardMaterialLightingOverrideConfig {
  diffuseColor?: ColorRGB;
  specularColor?: ColorRGB;
  specularPower?: number;
  emissiveColor?: ColorRGB;
  ambientColor?: ColorRGB;
  useSpecularOverAlpha?: boolean;
}

export interface MaterialOverrideConfig {
  albedoColor?: ColorRGB;
  diffuseColor?: ColorRGB;
  emissiveColor?: ColorRGB;
  metallic?: number;
  roughness?: number;
  contrast?: number;
  brightness?: number;
  saturation?: number;
  hue?: number;
  colorDensity?: number;
  alpha?: number;
  alphaCutOff?: number;
  transparencyMode?: number;
  backFaceCulling?: boolean;
  albedoTexture?: MaterialTextureOverrideConfig;
  normalTexture?: MaterialTextureOverrideConfig;
  metallicTexture?: MaterialTextureOverrideConfig;
  pbr?: PbrMaterialLightingOverrideConfig;
  standard?: StandardMaterialLightingOverrideConfig;
}

export type SceneMaterialScope = 'sharedAsset' | 'nodeMaterial';

export interface SceneSharedMaterialConfig {
  id: string;
  scope?: SceneMaterialScope;
  assetId?: string;
  nodeId?: string;
  materialName: string;
  ownerNodePath?: string;
  type?: string;
  properties: MaterialOverrideConfig;
}

export interface OutlineOverrideConfig {
  renderOutline?: boolean;
  outlineWidth?: number;
  outlineColor?: ColorRGB;
}

export interface SceneNodeVisualOverrides {
  materialBinding?: SceneNodeMaterialBindingConfig;
  materialSlotBindings?: Record<string, SceneNodeMaterialBindingConfig>;
  childMaterialBindings?: Record<string, SceneNodeMaterialBindingConfig>;
  material?: MaterialOverrideConfig;
  childMaterials?: Record<string, MaterialOverrideConfig>;
  childTransforms?: Record<string, TransformConfig>;
  outline?: OutlineOverrideConfig;
  childOutlines?: Record<string, OutlineOverrideConfig>;
}

export interface SceneInstanceNode extends SceneNodeBase {
  kind: 'instance';
  instance: {
    assetId: string;
  };
  overrides?: SceneNodeVisualOverrides;
}

export interface ScenePrimitiveNode extends SceneNodeBase {
  kind: 'primitive';
  primitive: {
    shape: ScenePrimitiveShape;
  };
  overrides?: SceneNodeVisualOverrides;
}

export interface SceneTransformNode extends SceneNodeBase {
  kind: 'transform';
  transformType?: TransformType;
  overrides?: SceneNodeVisualOverrides;
  groundDecal?: {
    size: {
      width: number;
      depth: number;
    };
    textureId?: string;
    color?: ColorRGB;
    alphaIndex?: number;
    diffuseTextureLevel?: number;
    emissiveTextureLevel?: number;
  };
  camera?: SceneCameraRigConfig;
  light?: SceneLightConfig;
}

export type SceneNodeConfig = SceneGroupNode | SceneInstanceNode | SceneTransformNode | ScenePrimitiveNode;

export interface SceneDocumentScene {
  rootId: string;
  assets: SceneAssetConfig[];
  nodes: SceneNodeConfig[];
  materialAssets?: SceneMaterialAssetConfig[];
  materials: SceneSharedMaterialConfig[];
  textures: Record<string, unknown>[];
}

export interface LayoutPlaceholderSurfaceConfig {
  id: string;
  position: { x: number; z: number };
  size: { width: number; depth: number };
  color: ColorRGB;
  textureId?: string;
}

export interface GroundOverlayPlaneConfig {
  id: string;
  position: { x: number; y?: number; z: number };
  size: { width: number; depth: number };
  scaling?: { x: number; y: number; z: number };
  color: ColorRGB;
  textureId?: string;
}

// ============================================================
// Gameplay Contract
// ============================================================

export type GameplayObjectType = string;

export interface GameplayCostConfig {
  resourceType: string;
  amount: number;
}

export interface GameplayBindingConfig {
  id: string;
  scenePath?: string;
  entityId?: string;
  entityName?: string;
  logicType?: GameplayObjectType;
  initialEnabled?: boolean;
  assetRef?: string;
  resourceType?: string;
  acceptsResourceTypes?: string[];
  producesResourceTypes?: string[];
  capacity?: number;
  processTimeSec?: number;
  cost?: GameplayCostConfig[];
  dependsOn?: string[];
  unlocks?: string[];
  runtimeParent?: string;
  spawnRootId?: string;
  pathPointIds?: string[];
  workerRole?: string;
  tags?: string[];
  notes?: string;
}

export interface SceneZoneConfig {
  id: string;
  location: PositionXZ;
  size: { width: number; depth: number };
  rotationDeg?: number;
  meta?: string;
}

export interface SceneGameplayConfig {
  worldBounds?: WorldBoundsConfig;
  gameplayBindings?: GameplayBindingConfig[];
  zones?: SceneZoneConfig[];
  tuning?: {
    sceneVfx?: SceneVfxConfig;
  };
  layoutPlaceholderSurfaces?: LayoutPlaceholderSurfaceConfig[];
  groundOverlayPlanes?: GroundOverlayPlaneConfig[];
  [key: string]: unknown;
}

export interface SceneRenderConfig {
  [key: string]: unknown;
}

export interface SceneConfigMeta extends Record<string, unknown> {
  generatedFrom?: SceneCompiledArtifactProvenance;
}

// ============================================================
// Root Config Files
// ============================================================

export interface SceneConfig {
  schemaVersion?: number;
  meta?: SceneConfigMeta;
  gameplay?: SceneGameplayConfig;
  scene?: SceneDocumentScene;
  render?: SceneRenderConfig;
}

export interface GameConfig {
  meta?: Record<string, unknown>;
}
