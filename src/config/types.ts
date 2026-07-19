/**
 * 配置类型定义 (Scaffold)
 *
 * 说明：
 * - 这是“通用脚手架”版本的最小配置类型集合
 * - 仅包含核心服务 (ConfigService / SceneBuilder / ModelPool 等) 需要的类型
 * - 具体游戏可在不破坏目录结构的前提下逐步扩展
 */

import type {
  EditorSceneArtistMaterialProfile,
  EditorSceneCameraRig,
  EditorSceneColorRgb,
  EditorSceneDirectionalLight,
  EditorSceneHemisphericLight,
  EditorSceneMaterialAlphaMode,
  EditorSceneMaterialAlphaProfile,
  EditorSceneMaterialAsset,
  EditorSceneMaterialAssetKind,
  EditorSceneMaterialAssetOrigin,
  EditorSceneMaterialAssetOriginType,
  EditorSceneMaterialBaseColorProfile,
  EditorSceneMaterialEmissionProfile,
  EditorSceneMaterialLightingModel,
  EditorSceneMaterialMetallicRoughnessProfile,
  EditorSceneMaterialNormalProfile,
  EditorSceneMaterialOcclusionProfile,
  EditorSceneMaterialTextureRef,
  EditorSceneVec3,
  PlayableEditorRuntimeGroupNode,
  PlayableEditorRuntimeGroundDecalColor,
  PlayableEditorRuntimeGroundDecalColorLayer,
  PlayableEditorRuntimeGroundDecalConfig,
  PlayableEditorRuntimeGroundDecalLayer,
  PlayableEditorRuntimeGroundDecalLayerBase,
  PlayableEditorRuntimeGroundDecalLayerRole,
  PlayableEditorRuntimeGroundDecalMaskConfig,
  PlayableEditorRuntimeGroundDecalProgressLayer,
  PlayableEditorRuntimeGroundDecalRect,
  PlayableEditorRuntimeGroundDecalRenderingConfig,
  PlayableEditorRuntimeGroundDecalTextLayer,
  PlayableEditorRuntimeGroundDecalTextureLayer,
  PlayableEditorRuntimeGroundDecalUiKind,
  PlayableEditorRuntimeInstanceNode,
  PlayableEditorRuntimeMaterialBindingConfig,
  PlayableEditorRuntimeMaterialSlotConfig,
  PlayableEditorRuntimeNodeBase,
  PlayableEditorRuntimeNodeRenderingConfig,
  PlayableEditorRuntimeNodeVisualOverrides,
  PlayableEditorRuntimePrimitiveNode,
  PlayableEditorRuntimeSceneAssetConfig,
  PlayableEditorRuntimeSceneAssetConfigV2,
  PlayableEditorRuntimeSceneAssetConfigV3,
  PlayableEditorRuntimeSceneConfig,
  PlayableEditorRuntimeSceneConfigV2,
  PlayableEditorRuntimeSceneConfigV3,
  PlayableEditorRuntimeSceneDocument,
  PlayableEditorRuntimeSceneMarkerGeometry,
  PlayableEditorRuntimeSceneMarkerTargetRef,
  PlayableEditorRuntimeSharedMaterialConfig,
  PlayableEditorRuntimeTransformConfig,
  PlayableEditorRuntimeTransformNode,
  PlayableEditorRuntimeTransformType,
  PlayableEditorSceneCompiledArtifactProvenance,
  PlayableEditorSceneRuntimeSourceBinding,
} from '@fps-games/editor/playable-sdk';

// ============================================================
// 基础类型
// ============================================================

export type Position3D = EditorSceneVec3;

export interface PositionXZ {
  x: number;
  z: number;
}

export type Scale3D = EditorSceneVec3;

export type ColorRGB = EditorSceneColorRgb;

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
export type TransformConfig = PlayableEditorRuntimeTransformConfig;

export type TransformType = PlayableEditorRuntimeTransformType;

export type ScenePrimitiveShape = 'cube' | 'sphere' | 'plane' | 'capsule';

export type SceneCameraProjection = 'orthographic' | 'perspective';

export interface SceneCameraRigConfig extends EditorSceneCameraRig {
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

export type SceneDirectionalLightConfig = EditorSceneDirectionalLight;

export type SceneHemisphericLightConfig = EditorSceneHemisphericLight;

export type SceneLightConfig = SceneHemisphericLightConfig | SceneDirectionalLightConfig;

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

export type SceneAssetMaterialSlotConfig = PlayableEditorRuntimeMaterialSlotConfig;

export type SceneAssetConfigV2 = PlayableEditorRuntimeSceneAssetConfigV2<
  SceneAssetDefaults,
  AssetExternalRef,
  SceneAssetMaterialMode
>;

export type SceneAssetConfigV3 = PlayableEditorRuntimeSceneAssetConfigV3<
  SceneAssetDefaults,
  AssetExternalRef,
  SceneAssetMaterialMode
>;

export type SceneAssetConfig = PlayableEditorRuntimeSceneAssetConfig<
  SceneAssetDefaults,
  AssetExternalRef,
  SceneAssetMaterialMode
>;

export type SceneCompiledArtifactProvenance = PlayableEditorSceneCompiledArtifactProvenance;

export type SceneRuntimeSourceBinding = PlayableEditorSceneRuntimeSourceBinding;

export type SceneNodeRenderingConfig = PlayableEditorRuntimeNodeRenderingConfig;

export type SceneNodeBase = PlayableEditorRuntimeNodeBase;

export type SceneGroupNode = PlayableEditorRuntimeGroupNode;

export interface MaterialTextureOverrideConfig {
  url?: string;
  level?: number;
}

export type ArtistMaterialTextureRef = EditorSceneMaterialTextureRef;

export type ArtistMaterialAlphaMode = EditorSceneMaterialAlphaMode;
export type ArtistMaterialLightingModel = EditorSceneMaterialLightingModel;

export type ArtistBaseColorProfile = EditorSceneMaterialBaseColorProfile;

export type ArtistNormalProfile = EditorSceneMaterialNormalProfile;

export type ArtistMetallicRoughnessProfile = EditorSceneMaterialMetallicRoughnessProfile;

export type ArtistOcclusionProfile = EditorSceneMaterialOcclusionProfile;

export type ArtistEmissionProfile = EditorSceneMaterialEmissionProfile;

export type ArtistAlphaProfile = EditorSceneMaterialAlphaProfile;

export type ArtistMaterialProfile = EditorSceneArtistMaterialProfile;

export type SceneMaterialAssetKind = Extract<EditorSceneMaterialAssetKind, 'pbr' | 'standard'>;
export type SceneMaterialAssetSystemPreset = 'default-pbr' | 'default-standard';

export interface SceneMaterialAssetSystemConfig {
  readonly?: boolean;
  preset?: SceneMaterialAssetSystemPreset;
}

export type SceneMaterialAssetOriginType = Extract<
  EditorSceneMaterialAssetOriginType,
  'imported' | 'created' | 'duplicated' | 'preset'
>;

export type SceneMaterialAssetOriginConfig = EditorSceneMaterialAssetOrigin;

export interface SceneMaterialAssetConfig extends EditorSceneMaterialAsset<ArtistMaterialProfile> {
  name: string;
  profile: ArtistMaterialProfile;
  materialKind?: SceneMaterialAssetKind;
  system?: SceneMaterialAssetSystemConfig;
  origin?: SceneMaterialAssetOriginConfig;
}

export type SceneNodeMaterialBindingConfig = PlayableEditorRuntimeMaterialBindingConfig<ArtistMaterialProfile>;

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
  occlusionTexture?: MaterialTextureOverrideConfig;
  emissiveTexture?: MaterialTextureOverrideConfig;
  opacityTexture?: MaterialTextureOverrideConfig;
  pbr?: PbrMaterialLightingOverrideConfig;
  standard?: StandardMaterialLightingOverrideConfig;
}

export type SceneMaterialScope = 'sharedAsset' | 'nodeMaterial';

export interface SceneSharedMaterialConfig extends PlayableEditorRuntimeSharedMaterialConfig {
  scope?: SceneMaterialScope;
  properties: MaterialOverrideConfig;
}

export interface OutlineOverrideConfig {
  renderOutline?: boolean;
  outlineWidth?: number;
  outlineColor?: ColorRGB;
}

export interface SceneNodeVisualOverrides extends PlayableEditorRuntimeNodeVisualOverrides {
  materialBinding?: SceneNodeMaterialBindingConfig;
  materialSlotBindings?: Record<string, SceneNodeMaterialBindingConfig>;
  material?: MaterialOverrideConfig;
  childTransforms?: Record<string, TransformConfig>;
  outline?: OutlineOverrideConfig;
  childOutlines?: Record<string, OutlineOverrideConfig>;
}

export interface SceneInstanceNode extends Omit<PlayableEditorRuntimeInstanceNode, 'overrides'> {
  overrides?: SceneNodeVisualOverrides;
}

export interface ScenePrimitiveNode extends Omit<PlayableEditorRuntimePrimitiveNode, 'primitive' | 'overrides'> {
  primitive: {
    shape: ScenePrimitiveShape;
  };
  overrides?: SceneNodeVisualOverrides;
}

export type SceneMarkerBoxGeometryConfig = Extract<PlayableEditorRuntimeSceneMarkerGeometry, { kind: 'box' }>;
export type SceneMarkerPointGeometryConfig = Extract<PlayableEditorRuntimeSceneMarkerGeometry, { kind: 'point' }>;
export type SceneMarkerObjectBoundsGeometryConfig = Extract<PlayableEditorRuntimeSceneMarkerGeometry, { kind: 'object-bounds' }>;
export type SceneMarkerPolyhedronGeometryConfig = Extract<PlayableEditorRuntimeSceneMarkerGeometry, { kind: 'polyhedron' }>;
export type SceneMarkerGeometryConfig = PlayableEditorRuntimeSceneMarkerGeometry;
export type SceneMarkerTargetRefConfig = PlayableEditorRuntimeSceneMarkerTargetRef;
export type SceneMarkerLocalFrameConfig = NonNullable<SceneMarkerConfig['semanticFrame']>;
export type SceneMarkerConfig = NonNullable<PlayableEditorRuntimeTransformNode['marker']>;

export type GroundDecalUiKind = PlayableEditorRuntimeGroundDecalUiKind;
export type GroundDecalUiLayerRole = PlayableEditorRuntimeGroundDecalLayerRole;
export type GroundDecalUiRect = PlayableEditorRuntimeGroundDecalRect;
export type GroundDecalUiColor = PlayableEditorRuntimeGroundDecalColor;
export type GroundDecalUiLayerBase = PlayableEditorRuntimeGroundDecalLayerBase;
export type GroundDecalUiTextureLayer = PlayableEditorRuntimeGroundDecalTextureLayer;
export type GroundDecalUiColorLayer = PlayableEditorRuntimeGroundDecalColorLayer;
export type GroundDecalUiTextLayer = PlayableEditorRuntimeGroundDecalTextLayer;
export type GroundDecalUiProgressLayer = PlayableEditorRuntimeGroundDecalProgressLayer;
export type GroundDecalUiLayer = PlayableEditorRuntimeGroundDecalLayer;
export type GroundDecalUiMaskConfig = PlayableEditorRuntimeGroundDecalMaskConfig;
export type GroundDecalUiRenderingConfig = PlayableEditorRuntimeGroundDecalRenderingConfig;
export type GroundDecalUiConfig = PlayableEditorRuntimeGroundDecalConfig;

export interface SceneTransformNode extends PlayableEditorRuntimeTransformNode {
  kind: 'transform';
  transformType?: TransformType;
  overrides?: SceneNodeVisualOverrides;
  marker?: SceneMarkerConfig;
  groundDecal?: GroundDecalUiConfig;
  camera?: SceneCameraRigConfig;
  light?: SceneLightConfig;
  [key: string]: unknown;
}

export type SceneNodeConfig = SceneGroupNode | SceneInstanceNode | SceneTransformNode | ScenePrimitiveNode;

export type SceneDocumentSceneV2 = PlayableEditorRuntimeSceneDocument<
  SceneAssetConfigV2,
  SceneNodeConfig,
  SceneMaterialAssetConfig
> & {
  materials: SceneSharedMaterialConfig[];
};

export type SceneDocumentSceneV3 = PlayableEditorRuntimeSceneDocument<
  SceneAssetConfigV3,
  SceneNodeConfig,
  SceneMaterialAssetConfig
> & {
  materials: SceneSharedMaterialConfig[];
};

export type SceneDocumentScene = SceneDocumentSceneV2 | SceneDocumentSceneV3;

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
  gameplayBindings?: GameplayBindingConfig[];
  zones?: SceneZoneConfig[];
  tuning?: Record<string, unknown>;
  layoutPlaceholderSurfaces?: LayoutPlaceholderSurfaceConfig[];
  groundOverlayPlanes?: GroundOverlayPlaneConfig[];
  [key: string]: unknown;
}

export interface SceneRenderConfig {
  [key: string]: unknown;
}

export interface SceneConfigMeta extends NonNullable<PlayableEditorRuntimeSceneConfig['meta']> {
  generatedFrom?: SceneCompiledArtifactProvenance;
}

// ============================================================
// Root Config Files
// ============================================================

interface SceneConfigProjectExtensions {
  meta?: SceneConfigMeta;
  gameplay?: SceneGameplayConfig;
  render?: SceneRenderConfig;
}

export type SceneConfig =
  | (PlayableEditorRuntimeSceneConfigV2<SceneDocumentSceneV2> & SceneConfigProjectExtensions)
  | (PlayableEditorRuntimeSceneConfigV3<SceneDocumentSceneV3> & SceneConfigProjectExtensions);

export interface GameConfig {
  meta?: Record<string, unknown>;
}
