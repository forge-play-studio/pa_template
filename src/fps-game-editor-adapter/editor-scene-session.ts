import {
  type DocumentCommand,
  type EditorPlacementHit,
  type EditorTransformSnapshot,
  type InspectorObject,
  type InspectorProperty,
  type InspectorSection,
  type InspectorValidationResult,
  type RuntimePatch,
  type SceneGraphCreateGroupIntent,
  type SceneGraphCreatePrimitiveIntent,
  type SceneGraphDeleteIntent,
  type SceneGraphDropIntent,
  type SceneGraphGroupSelectionIntent,
  type SceneGraphMoveIntent,
  type SceneGraphRenameIntent,
  type SceneGraphTreeItem,
  type SceneGraphValidationResult,
  type SerializedMultiObject,
  type SerializedObject,
  type SerializedPropertyPatch,
  combineEditorTransforms,
  createIdentityEditorTransform,
  getTopLevelSceneGraphNodeIds,
  toEditorLocalTransformFromWorld,
} from '@fps-games/editor/playable-sdk';
import {
  callEditorSceneRuntimeMethod as callPlayableEditorSceneRuntimeMethod,
  addEditorSceneMaterialAssetAndBind as addPlayableEditorSceneMaterialAssetAndBind,
  addAssetLibraryItemToEditorSceneDocument as addPlayableAssetLibraryItemToEditorSceneDocument,
  canEditorSceneGameObjectHaveChildren as canPlayableEditorSceneGameObjectHaveChildren,
  collectEditorSceneSubtreeIdList as collectPlayableEditorSceneSubtreeIdList,
  createEditorSceneAssetFromLibraryItem as createPlayableEditorSceneAssetFromLibraryItem,
  createEditorSceneAssetPlacementPatch as createPlayableEditorSceneAssetPlacementPatch,
  createEditorSceneDocumentInspectorProperty as createPlayableEditorSceneDocumentInspectorProperty,
  createEditorSceneDocumentInspectorSections as createPlayableEditorSceneDocumentInspectorSections,
  createEditorSceneCreateGroupPatch as createPlayableEditorSceneCreateGroupPatch,
  createEditorSceneCreatePrimitivePatch as createPlayableEditorSceneCreatePrimitivePatch,
  createEditorSceneDeleteSubtreePatch as createPlayableEditorSceneDeleteSubtreePatch,
  createEditorSceneDuplicateSelectionPatch as createPlayableEditorSceneDuplicateSelectionPatch,
  createEditorSceneGroupSelectionPatch as createPlayableEditorSceneGroupSelectionPatch,
  createEditorSceneGameObjectsFieldPatch as createPlayableEditorSceneGameObjectsFieldPatch,
  createEditorSceneHierarchyMovePatch as createPlayableEditorSceneHierarchyMovePatch,
  createEditorSceneSerializedMultiTransformPatch as createPlayableEditorSceneSerializedMultiTransformPatch,
  createEditorSceneCreatedMaterialAsset as createPlayableEditorSceneCreatedMaterialAsset,
  createEditorSceneDuplicatedMaterialAssetCopy as createPlayableEditorSceneDuplicatedMaterialAssetCopy,
  createEditorSceneDuplicateMaterialAssetForBindingPatch as createPlayableEditorSceneDuplicateMaterialAssetForBindingPatch,
  createEditorSceneMaterialAssetFieldInspectorPropertyInput as createPlayableEditorSceneMaterialAssetFieldInspectorPropertyInput,
  createEditorSceneMaterialBrowserAssetItems as createPlayableEditorSceneMaterialBrowserAssetItems,
  createEditorSceneMaterialBindingSummary as createPlayableEditorSceneMaterialBindingSummary,
  createEditorSceneMaterialPickerControlOptions as createPlayableEditorSceneMaterialPickerControlOptions,
  createEditorSceneDuplicatedPrefabDefinition as createPlayableEditorSceneDuplicatedPrefabDefinition,
  createEditorScenePrefabDefinitionFromAsset as createPlayableEditorScenePrefabDefinitionFromAsset,
  createEditorScenePrefabDefinitionFromGameObject as createPlayableEditorScenePrefabDefinitionFromGameObject,
  createEditorSceneReadonlyInspectorProperty as createPlayableEditorSceneReadonlyInspectorProperty,
  createEditorSceneReadonlyInspectorSection as createPlayableEditorSceneReadonlyInspectorSection,
  createEditorSceneReadonlyVector3Properties as createPlayableEditorSceneReadonlyVector3Properties,
  createEditorSceneRenamePatch as createPlayableEditorSceneRenamePatch,
  createEditorSceneReparentPatch as createPlayableEditorSceneReparentPatch,
  createEditorSceneRuntimeInspectorSnapshot as createPlayableEditorSceneRuntimeInspectorSnapshot,
  createEditorSceneRuntimeInspectorSections as createPlayableEditorSceneRuntimeInspectorSections,
  createEditorSceneRuntimePreviewNode as createPlayableEditorSceneRuntimePreviewNode,
  createEditorSceneSerializedMultiInspectorObject as createPlayableEditorSceneSerializedMultiInspectorObject,
  createEditorSceneSerializedMultiObject as createPlayableEditorSceneSerializedMultiObject,
  createEditorSceneSerializedObject as createPlayableEditorSceneSerializedObject,
  createEditorSceneTexturePickerControlOptions as createPlayableEditorSceneTexturePickerControlOptions,
  createUniqueEditorSceneId as createPlayableUniqueEditorSceneId,
  deleteEditorSceneMaterialAsset as deletePlayableEditorSceneMaterialAsset,
  degreesToEditorSceneRadians as degreesToPlayableEditorSceneRadians,
  describeEditorSceneRuntimeObject as describePlayableEditorSceneRuntimeObject,
  ensureEditorSceneGameObjectGuids as ensurePlayableEditorSceneGameObjectGuids,
  getEditorSceneGameObjectWorldTransform as getPlayableEditorSceneGameObjectWorldTransform,
  getEditorSceneMaterialAssetDisplayName as getPlayableEditorSceneMaterialAssetDisplayName,
  getEditorSceneHierarchyItems as getPlayableEditorSceneHierarchyItems,
  findEditorSceneMaterialAsset as findPlayableEditorSceneMaterialAsset,
  findEditorSceneInspectorTextureAsset as findPlayableEditorSceneInspectorTextureAsset,
  EDITOR_SCENE_SHADOW_INSPECTOR_LANGUAGE_PATH as PLAYABLE_EDITOR_SCENE_SHADOW_INSPECTOR_LANGUAGE_PATH,
  isEditorSceneCameraGameObject as isPlayableEditorSceneCameraGameObject,
  isEditorSceneArtistMaterialPatchPath as isPlayableEditorSceneArtistMaterialPatchPath,
  isEditorSceneGroupLikeGameObject as isPlayableEditorSceneGroupLikeGameObject,
  isEditorSceneMaterialBindingPath as isPlayableEditorSceneMaterialBindingPath,
  isEditorSceneMaterialAssetReadonlyForInspector as isPlayableEditorSceneMaterialAssetReadonlyForInspector,
  isEditorScenePrefabAsset as isPlayableEditorScenePrefabAsset,
  isEditorScenePrefabCoreMaterialOverridePath as isPlayableEditorScenePrefabCoreMaterialOverridePath,
  isEditorScenePrefabOverridePath as isPlayableEditorScenePrefabOverridePath,
  isEditorSceneRootGameObject as isPlayableEditorSceneRootGameObject,
  isEditorSceneRootGameObjectId as isPlayableEditorSceneRootGameObjectId,
  isEditorSceneShadowMode as isPlayableEditorSceneShadowMode,
  migrateEditorSceneDocumentRenderingAlphaIndex as migratePlayableEditorSceneDocumentRenderingAlphaIndex,
  normalizeEditorSceneFieldInspectorValue as normalizePlayableEditorSceneFieldInspectorValue,
  normalizeEditorSceneHierarchyDocument as normalizePlayableEditorSceneHierarchyDocument,
  normalizeEditorSceneMaterialAssetValue as normalizePlayableEditorSceneMaterialAssetValue,
  normalizeEditorSceneMaterialSlotOwnerPath as normalizePlayableEditorSceneMaterialSlotOwnerPath,
  radiansToEditorSceneDegrees as radiansToPlayableEditorSceneDegrees,
  readEditorScenePrefabOverrideMaterialPath as readPlayableEditorScenePrefabOverrideMaterialPath,
  parseEditorSceneDuplicateMaterialAssetValue as parsePlayableEditorSceneDuplicateMaterialAssetValue,
  parseEditorSceneMaterialAssetFieldPath as parsePlayableEditorSceneMaterialAssetFieldPath,
  patchEditorScenePrefabOverride as patchPlayableEditorScenePrefabOverride,
  patchEditorSceneMaterialAssetField as patchPlayableEditorSceneMaterialAssetField,
  collectEditorSceneChildMaterialSlots as collectPlayableEditorSceneChildMaterialSlots,
  collectEditorSceneMaterialAssetBindingIds as collectPlayableEditorSceneMaterialAssetBindingIds,
  readEditorSceneAssetMaterialSlots as readPlayableEditorSceneAssetMaterialSlots,
  readEditorSceneMaterialSlotDescriptor as readPlayableEditorSceneMaterialSlotDescriptor,
  readEditorSceneInspectorVec3 as readPlayableEditorSceneInspectorVec3,
  readEditorSceneRuntimeBoolean as readPlayableEditorSceneRuntimeBoolean,
  readEditorSceneRuntimeClassName as readPlayableEditorSceneRuntimeClassName,
  readEditorSceneRuntimeNumber as readPlayableEditorSceneRuntimeNumber,
  readEditorSceneRuntimeString as readPlayableEditorSceneRuntimeString,
  readEditorSceneRuntimeValue as readPlayableEditorSceneRuntimeValue,
  readEditorSceneTransformVector as readPlayableEditorSceneTransformVector,
  reduceEditorSceneDocumentMutation as reducePlayableEditorSceneDocumentMutation,
  resolveEditorSceneMaterialAssetIntegrity as resolvePlayableEditorSceneMaterialAssetIntegrity,
  resolveEditorSceneMaterialAssetKind as resolvePlayableEditorSceneMaterialAssetKind,
  resolveEditorSceneMaterialAssetDeleteState as resolvePlayableEditorSceneMaterialAssetDeleteState,
  resolveEditorSceneMaterialSlotReimportDiff as resolvePlayableEditorSceneMaterialSlotReimportDiff,
  resolveEditorScenePrefabInstanceRelation as resolvePlayableEditorScenePrefabInstanceRelation,
  resolveEditorScenePrefabSourceAssetId as resolvePlayableEditorScenePrefabSourceAssetId,
  roundEditorSceneInspectorNumber as roundPlayableEditorSceneInspectorNumber,
  sanitizeEditorSceneId as sanitizePlayableEditorSceneId,
  applyEditorSceneJsonFieldPatch as applyPlayableEditorSceneJsonFieldPatch,
  toEditorSceneLocalTransformFromWorld as toPlayableEditorSceneLocalTransformFromWorld,
  toEditorSceneInspectorSafeValue as toPlayableEditorSceneInspectorSafeValue,
  applyEditorSceneSerializedPropertyPatch as applyPlayableEditorSceneSerializedPropertyPatch,
  patchEditorSceneGameObjectField as patchPlayableEditorSceneGameObjectField,
  patchEditorSceneGameObjectsField as patchPlayableEditorSceneGameObjectsField,
  validateEditorSceneMaterialAssetFieldValue as validatePlayableEditorSceneMaterialAssetFieldValue,
  validateEditorSceneFieldInspectorValue as validatePlayableEditorSceneFieldInspectorValue,
  validateEditorSceneGroupSelection as validatePlayableEditorSceneGroupSelection,
  validateEditorSceneHierarchyMove as validatePlayableEditorSceneHierarchyMove,
  validateEditorSceneReparent as validatePlayableEditorSceneReparent,
  type EditorSceneDocumentMutationOptions as PlayableEditorSceneDocumentMutationOptions,
  type EditorSceneDocumentMutationPatch as PlayableEditorSceneDocumentMutationPatch,
  type EditorSceneFieldMutationOptions as PlayableEditorSceneFieldMutationOptions,
  type EditorSceneFieldInspectorExtraValidator as PlayableEditorSceneFieldInspectorExtraValidator,
  type EditorSceneHierarchyPatch as PlayableEditorSceneHierarchyPatch,
  type EditorSceneInspectorSourceTag as PlayableEditorSceneInspectorSourceTag,
  type EditorScenePrefabDefaults as PlayableEditorScenePrefabDefaults,
  type EditorSceneReadonlyInspectorPropertyInput as PlayableEditorSceneReadonlyInspectorPropertyInput,
  type EditorSceneReadonlyInspectorSectionInput as PlayableEditorSceneReadonlyInspectorSectionInput,
  type EditorSceneRuntimeInspectorSnapshot as PlayableEditorSceneRuntimeInspectorSnapshot,
  type EditorSceneSerializedPropertyValidator as PlayableEditorSceneSerializedPropertyValidator,
  type PlayableLocalEditorMultiPropertyCapabilityInput,
  type PlayableLocalEditorMultiPropertyPatchInput,
} from '@fps-games/editor/playable-sdk';
import type {
  EditorSceneAsset,
  EditorSceneAssetLibraryItem,
  EditorSceneCameraInspectorLanguage,
  EditorSceneCameraRig,
  EditorSceneDocument,
  EditorSceneDirectionalLight,
  EditorSceneGameObject,
  EditorSceneHemisphericLight,
  EditorSceneLightInspectorLanguage,
  EditorSceneLight,
  EditorSceneVec3,
} from './editor-scene-document';
import type {
  ArtistMaterialProfile,
  MaterialOverrideConfig,
  OutlineOverrideConfig,
  SceneCameraProjection,
  SceneConfig,
  SceneMaterialAssetConfig,
  SceneNodeMaterialBindingConfig,
  SceneNodeConfig,
  ScenePrimitiveShape,
} from '../config';
import {
  getEditorSceneAuthoringSourceRef,
  EDITOR_SCENE_SOURCE_ID,
  EDITOR_SCENE_SOURCE_TYPE,
} from './editor-authoring-source';
import {
  findEditorSceneModelRenderer,
  findEditorSceneTransform,
  readEditorSceneNodeKind,
} from './editor-scene-document';
import { resolveSceneNodeFieldSchema } from './scene-node-field-schema';
import {
  DEFAULT_DIRECTIONAL_LIGHT_DIRECTION,
  LIGHT_DIRECTION_ELEVATION_ANGLE_PATH,
  LIGHT_DIRECTION_ELEVATION_MAX_DEG,
  LIGHT_DIRECTION_ELEVATION_MIN_DEG,
  LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH,
  LIGHT_DIRECTION_HORIZONTAL_MAX_DEG,
  LIGHT_DIRECTION_HORIZONTAL_MIN_DEG,
  createDirectionalLightDirectionFromAngles,
  isDirectionalLightAnglePath,
  normalizeDirectionVector,
  normalizeDirectionalLightAngleValue,
  readDirectionalLightAngles,
} from './editor-lighting-utils';
import { getActiveRenderingProfile } from '../rendering/editor-rendering-profile-store';

export type EditorSceneDocumentPatch =
  | PlayableEditorSceneDocumentMutationPatch<EditorSceneGameObject>
  | {
    kind: 'game-object.rendering-alpha-index-migration';
    targetIds: string[];
    renderingGroupId: 0 | 1 | 2 | 3;
    fromAlphaIndex: number;
    toAlphaIndex: number;
  }
  | {
    kind: 'scene.material-asset.field';
    materialAssetId: string;
    path: string;
    value: unknown;
  }
  | {
    kind: 'scene.material-asset.create';
    materialAsset: SceneMaterialAssetConfig;
  }
  | {
    kind: 'scene.material-asset.delete';
    materialAssetId: string;
  }
  | {
    kind: 'scene.material-asset.duplicate-and-bind';
    targetId: string;
    bindingPath: string;
    materialAsset: SceneMaterialAssetConfig;
  }
  | {
    kind: 'scene.prefab-material-asset.duplicate-and-bind';
    assetId: string;
    bindingPath: string;
    materialAsset: SceneMaterialAssetConfig;
  }
  | {
    kind: 'scene.prefab-asset.create';
    sourceAsset?: EditorSceneAsset;
    prefabAsset: EditorSceneAsset;
  }
  | {
    kind: 'scene.prefab-asset.create-from-game-object';
    prefabAsset: EditorSceneAsset;
    sourceGameObjectId: string;
  }
  | {
    kind: 'scene.prefab-asset.duplicate';
    prefabAsset: EditorSceneAsset;
    sourcePrefabAssetId: string;
  }
  | {
    kind: 'scene.prefab-asset.field';
    assetId: string;
    path: string;
    value: unknown;
  };

function coerceEditorSceneHierarchyPatchResult<TResult extends { patch: PlayableEditorSceneHierarchyPatch }>(
  result: TResult | null,
): (Omit<TResult, 'patch'> & { patch: EditorSceneDocumentPatch }) | null {
  if (!result) return null;
  return {
    ...result,
    patch: result.patch as EditorSceneDocumentPatch,
  };
}

export const EDITOR_SCENE_MAIN_CAMERA_ID = 'main_camera';
export const EDITOR_SCENE_ENVIRONMENT_LIGHT_ID = 'environment_light';
export const EDITOR_SCENE_SUN_LIGHT_ID = 'sun_light';
const EDITOR_SCENE_ROOT_ID = 'root';
const EDITOR_SCENE_ROOT_TRANSFORM = createIdentityEditorTransform();
const EDITOR_SCENE_GAME_OBJECT_GUID_PREFIX = 'go_';
const CREATE_CHILD_MATERIAL_SLOT_PATH = 'overrides.childMaterialBindings.$create.ownerNodePath';
const MATERIAL_ASSET_FIELD_PATH_PREFIX = 'scene.materialAssets.';
const INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE = Symbol('invalid-editor-scene-prefab-field-value');
const ASSET_MESH_SELECTION_SEPARATOR = '::assetMesh::';
const PREFAB_STAGE_ENVIRONMENT_LIGHT_NODE_ID = 'prefab-stage:environment-light';
const PREFAB_STAGE_DIRECTIONAL_LIGHT_NODE_ID = 'prefab-stage:directional-light';
const DEFAULT_PBR_MATERIAL_ASSET_ID = 'mat_default_pbr';
const DEFAULT_STANDARD_MATERIAL_ASSET_ID = 'mat_default_standard';
const DEFAULT_PBR_MATERIAL_ASSET_GUID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_STANDARD_MATERIAL_ASSET_GUID = '00000000-0000-4000-8000-000000000002';
const DEFAULT_ARTIST_MATERIAL_ASSET_ID = DEFAULT_PBR_MATERIAL_ASSET_ID;
const EDITOR_SCENE_SERIALIZED_MULTI_FIELD_PATCH_PATHS = new Set<string>([
  'enabled',
  'shadowMode',
  PLAYABLE_EDITOR_SCENE_SHADOW_INSPECTOR_LANGUAGE_PATH,
]);
const DEFAULT_PBR_MATERIAL_ASSET: SceneMaterialAssetConfig = {
  id: DEFAULT_PBR_MATERIAL_ASSET_ID,
  guid: DEFAULT_PBR_MATERIAL_ASSET_GUID,
  name: 'Default PBR Material',
  materialKind: 'pbr',
  system: {
    readonly: true,
    preset: 'default-pbr',
  },
  origin: { type: 'preset' },
  profile: {
    lightingModel: 'lit',
    baseColor: {
      color: { r: 1, g: 1, b: 1 },
      brightness: 1,
      saturation: 1,
      contrast: 1,
      hue: 0,
    },
    metallic: 0,
    roughness: 1,
    emission: {
      color: { r: 0, g: 0, b: 0 },
      intensity: 0,
    },
  },
};
const DEFAULT_STANDARD_MATERIAL_ASSET: SceneMaterialAssetConfig = {
  id: DEFAULT_STANDARD_MATERIAL_ASSET_ID,
  guid: DEFAULT_STANDARD_MATERIAL_ASSET_GUID,
  name: 'Default Standard Material',
  materialKind: 'standard',
  system: {
    readonly: true,
    preset: 'default-standard',
  },
  origin: { type: 'preset' },
  profile: {
    lightingModel: 'lit',
    baseColor: {
      color: { r: 1, g: 1, b: 1 },
      brightness: 1,
      saturation: 1,
      contrast: 1,
      hue: 0,
    },
    emission: {
      color: { r: 0, g: 0, b: 0 },
      intensity: 0,
    },
  },
};

export const DEFAULT_EDITOR_SCENE_CAMERA: EditorSceneCameraRig = {
  projection: 'orthographic',
  alpha: 3.9269908169872414,
  beta: 0.8,
  radius: 14,
  orthoSize: 6,
  fov: 0.85,
  targetOffset: { x: 0, y: 0, z: 0 },
  minZ: 1,
  maxZ: 10000,
  lowerBetaLimit: 0.8,
  upperBetaLimit: 0.8,
  lowerRadiusLimit: 14,
  upperRadiusLimit: 14,
  inertia: 0.9,
  targetScreenOffset: { x: 0, y: 0 },
  inspectorLanguage: 'zh',
};

export const DEFAULT_EDITOR_SCENE_SUN_LIGHT: EditorSceneDirectionalLight = {
  type: 'directional',
  intensity: 2,
  direction: { ...DEFAULT_DIRECTIONAL_LIGHT_DIRECTION },
  diffuseColor: { r: 1, g: 1, b: 1 },
  inspectorLanguage: 'zh',
};

export const DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT: EditorSceneHemisphericLight = {
  type: 'hemispheric',
  intensity: 0.8,
  diffuseColor: { r: 1, g: 1, b: 1 },
  groundColor: { r: 0.48, g: 0.52, b: 0.62 },
  inspectorLanguage: 'zh',
};

type CameraInspectorText = {
  title: string;
  summaryOrthographic: string;
  summaryPerspective: string;
  language: string;
  projection: string;
  projectionOrthographic: string;
  projectionPerspective: string;
  alpha: string;
  beta: string;
  radius: string;
  orthoSize: string;
  fov: string;
  targetOffset: string;
  nearClip: string;
  farClip: string;
  minBeta: string;
  maxBeta: string;
  minRadius: string;
  maxRadius: string;
  inertia: string;
  screenOffset: string;
  rawCamera: string;
};

const CAMERA_INSPECTOR_TEXT: Record<EditorSceneCameraInspectorLanguage, CameraInspectorText> = {
  zh: {
    title: '摄像机',
    summaryOrthographic: 'ArcRotate 正交',
    summaryPerspective: 'ArcRotate 透视',
    language: '语言',
    projection: '投影模式',
    projectionOrthographic: '正交',
    projectionPerspective: '透视',
    alpha: 'Alpha',
    beta: 'Beta',
    radius: '半径',
    orthoSize: '正交尺寸',
    fov: '视野角度',
    targetOffset: '目标偏移',
    nearClip: '近裁剪',
    farClip: '远裁剪',
    minBeta: '最小 Beta',
    maxBeta: '最大 Beta',
    minRadius: '最小半径',
    maxRadius: '最大半径',
    inertia: '惯性',
    screenOffset: '屏幕偏移',
    rawCamera: '原始摄像机',
  },
  en: {
    title: 'Camera',
    summaryOrthographic: 'ArcRotate Orthographic',
    summaryPerspective: 'ArcRotate Perspective',
    language: 'Language',
    projection: 'Projection',
    projectionOrthographic: 'Orthographic',
    projectionPerspective: 'Perspective',
    alpha: 'Alpha',
    beta: 'Beta',
    radius: 'Radius',
    orthoSize: 'Ortho Size',
    fov: 'FOV',
    targetOffset: 'Target Offset',
    nearClip: 'Near Clip',
    farClip: 'Far Clip',
    minBeta: 'Min Beta',
    maxBeta: 'Max Beta',
    minRadius: 'Min Radius',
    maxRadius: 'Max Radius',
    inertia: 'Inertia',
    screenOffset: 'Screen Offset',
    rawCamera: 'Raw Camera',
  },
};

const CAMERA_LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
];

type ArtistMaterialInspectorLanguage = EditorSceneCameraInspectorLanguage;

type ArtistMaterialInspectorText = {
  title: string;
  slotTitle: string;
  language: string;
  materialAsset: string;
  materialCard: string;
  inheritNone: string;
  defaultMaterial: string;
  defaultMaterialMeta: string;
  defaultStandardMaterial: string;
  defaultStandardMaterialMeta: string;
  defaultMaterialReadOnly: string;
  replace: string;
  batchReplaceUnsupported: string;
  duplicateForObject: string;
  materialPickerTitle: string;
  texturePickerTitle: string;
  assetProfile: string;
  assetProfileEmpty: string;
  assetName: string;
  assetKind: string;
  assetKindPbr: string;
  assetKindStandard: string;
  assetLightingModel: string;
  assetLightingModelLit: string;
  assetLightingModelUnlit: string;
  assetBaseColor: string;
  assetBaseTexture: string;
  assetBrightness: string;
  assetSaturation: string;
  assetContrast: string;
  assetHue: string;
  assetNormalTexture: string;
  assetNormalStrength: string;
  assetMetallic: string;
  assetRoughness: string;
  assetMetallicRoughnessTexture: string;
  assetOcclusionTexture: string;
  assetOcclusionStrength: string;
  assetEmissionColor: string;
  assetEmissionIntensity: string;
  assetEmissionTexture: string;
  assetEmissionMaskUrl: string;
  assetAlphaMode: string;
  assetAlphaModeOpaque: string;
  assetAlphaModeMask: string;
  assetAlphaModeBlend: string;
  assetAlphaOpacity: string;
  assetAlphaCutoff: string;
  assetAlphaTexture: string;
  createSlotMaterial: string;
  slotList: string;
  slotId: string;
  slotOwnerPath: string;
  slotMaterialAsset: string;
  slotSourceMaterial: string;
  slotBindingPath: string;
  reimportConflicts: string;
  legacySlotRaw: string;
  summaryAsset: (name: string) => string;
  summaryMissingAsset: string;
  summaryLegacyData: string;
  summaryInherit: string;
  summaryAddSlot: string;
  summarySlotCount: (count: number) => string;
  formatUsageCount: (count: number) => string;
  formatMaterialEditImpact: (count: number) => string;
  formatDuplicateMaterialImpact: (count: number) => string;
  formatReimportConflictSummary: (count: number) => string;
  tooltips: ArtistMaterialTooltipText;
};

type ArtistMaterialTooltipText = Record<
  | 'language'
  | 'materialAsset'
  | 'baseTexture'
  | 'assetProfile'
  | 'assetName'
  | 'assetKind'
  | 'lightingModel'
  | 'baseColor'
  | 'duplicateForObject'
  | 'brightness'
  | 'saturation'
  | 'contrast'
  | 'hue'
  | 'normalTexture'
  | 'normalStrength'
  | 'metallic'
  | 'roughness'
  | 'metallicRoughnessTexture'
  | 'occlusionTexture'
  | 'occlusionStrength'
  | 'emissionColor'
  | 'emissionIntensity'
  | 'emissionTexture'
  | 'emissionMaskUrl'
  | 'alphaMode'
  | 'alphaOpacity'
  | 'alphaCutoff'
  | 'alphaTexture'
  | 'createSlotMaterial'
  | 'slotList'
  | 'slotOwnerPath'
  | 'reimportConflicts'
  | 'legacySlotRaw',
  string
>;

const ARTIST_MATERIAL_INSPECTOR_TEXT: Record<ArtistMaterialInspectorLanguage, ArtistMaterialInspectorText> = {
  zh: {
    title: '美术材质',
    slotTitle: '材质槽',
    language: '语言',
    materialAsset: '材质资产',
    materialCard: '当前材质',
    inheritNone: '继承 / 无',
    defaultMaterial: '默认 PBR 材质',
    defaultMaterialMeta: 'BabylonJS 默认 PBR 材质',
    defaultStandardMaterial: '默认 Standard 材质',
    defaultStandardMaterialMeta: 'BabylonJS 默认 Standard 材质',
    defaultMaterialReadOnly: '系统默认材质为只读；请选择可编辑材质球后调整参数。',
    replace: '替换',
    batchReplaceUnsupported: '多选统一替换材质暂未接入；请先单选对象替换材质。',
    duplicateForObject: '复制',
    materialPickerTitle: '选择材质资产',
    texturePickerTitle: '选择贴图资产',
    assetProfile: '资产参数',
    assetProfileEmpty: '选择材质资产后可编辑资产参数',
    assetName: '资产名称',
    assetKind: '材质类型',
    assetKindPbr: 'PBR 标准材质球',
    assetKindStandard: 'Standard 标准材质球',
    assetLightingModel: '光照模型',
    assetLightingModelLit: '受光照',
    assetLightingModelUnlit: '不受光照',
    assetBaseColor: '基础色',
    assetBaseTexture: '基础贴图',
    assetBrightness: '贴图亮度',
    assetSaturation: '贴图饱和度',
    assetContrast: '贴图对比度',
    assetHue: '贴图色相',
    assetNormalTexture: '法线贴图',
    assetNormalStrength: '法线强度',
    assetMetallic: '金属度',
    assetRoughness: '粗糙度',
    assetMetallicRoughnessTexture: '金属粗糙贴图',
    assetOcclusionTexture: 'AO 贴图',
    assetOcclusionStrength: 'AO 强度',
    assetEmissionColor: '自发光色',
    assetEmissionIntensity: '自发光强度',
    assetEmissionTexture: '自发光贴图',
    assetEmissionMaskUrl: '遮罩贴图',
    assetAlphaMode: '透明模式',
    assetAlphaModeOpaque: '不透明',
    assetAlphaModeMask: '遮罩',
    assetAlphaModeBlend: '半透明',
    assetAlphaOpacity: '不透明度',
    assetAlphaCutoff: 'Alpha 阈值',
    assetAlphaTexture: 'Alpha 贴图',
    createSlotMaterial: '添加材质槽',
    slotList: '槽列表',
    slotId: '槽 ID',
    slotOwnerPath: '槽节点路径',
    slotMaterialAsset: '槽材质资产',
    slotSourceMaterial: '源材质',
    slotBindingPath: '绑定路径',
    reimportConflicts: '重导入材质冲突',
    legacySlotRaw: '旧槽材质原始值',
    summaryAsset: (name) => `资产：${name}`,
    summaryMissingAsset: '资产缺失',
    summaryLegacyData: '旧数据',
    summaryInherit: '继承',
    summaryAddSlot: '添加槽',
    summarySlotCount: (count) => `${count} 个槽`,
    formatUsageCount: (count) => (count > 0 ? `被 ${count} 处使用` : '未被使用'),
    formatMaterialEditImpact: (count) => {
      if (count <= 0) return '当前未被场景使用，修改只会改变材质资产本身。';
      if (count === 1) return '修改会影响当前绑定。';
      return `共享材质，修改会影响 ${count} 处绑定。`;
    },
    formatDuplicateMaterialImpact: (count) => {
      if (count <= 0) return '复制后创建一个可独立编辑的材质资产。';
      if (count === 1) return '复制后当前对象或槽会使用独立材质。';
      return `复制后当前对象或槽会使用独立材质，原 ${count} 处共享绑定不被继续修改。`;
    },
    formatReimportConflictSummary: (count) => `检测到 ${count} 个材质槽重导入差异；已保留现有绑定，需人工确认不可匹配项。`,
    tooltips: {
      language: '切换美术材质 Inspector 的显示语言。',
      materialAsset: '选择项目级共享材质资产，或使用只读的默认 PBR 材质。',
      baseTexture: '选择项目贴图作为基础贴图。贴图调色参数会先作用于这张贴图。',
      assetProfile: '共享材质资产的参数会影响所有绑定该资产的节点。',
      assetName: '材质资产名称只用于展示；绑定使用稳定材质 ID，不受重命名影响。',
      assetKind: '材质球类型决定运行时使用 PBRMaterial 或 StandardMaterial。',
      lightingModel: '受光照材质会响应环境光和直射光；不受光照材质适合 UI、特效、图标和导视标记。',
      baseColor: '基础色作为颜色因子，会在基础贴图完成调色后参与相乘。修改共享材质资产会影响所有绑定该材质球的节点。',
      duplicateForObject: '复制当前材质球为这个对象或槽的独立材质，然后自动替换绑定。',
      brightness: '基础贴图亮度倍率，1 为不改变；仅在有基础贴图时影响贴图。',
      saturation: '基础贴图饱和度倍率，1 为不改变；仅在有基础贴图时影响贴图。',
      contrast: '基础贴图对比度倍率，1 为不改变；仅在有基础贴图时影响贴图。',
      hue: '基础贴图色相偏移，单位为度；仅在有基础贴图时影响贴图。',
      normalTexture: '选择法线贴图，运行时应用到 PBR/Standard 材质的 bump/normal 通道。',
      normalStrength: '法线强度，1 为贴图原始强度。',
      metallic: '金属度，范围 0 到 1。',
      roughness: '粗糙度，范围 0 到 1。',
      metallicRoughnessTexture: '选择金属粗糙贴图。PBR 运行时按 GLB 常用约定读取蓝色金属度、绿色粗糙度。',
      occlusionTexture: '选择环境遮蔽 AO 贴图，只对 PBR 材质生效。',
      occlusionStrength: 'AO 强度，1 为贴图原始强度。',
      emissionColor: '自发光颜色，会与强度相乘。',
      emissionIntensity: '自发光强度，0 表示无自发光。',
      emissionTexture: '选择自发光贴图；若未设置则兼容使用旧遮罩贴图。',
      emissionMaskUrl: '选择灰度贴图作为自发光强度遮罩。',
      alphaMode: '透明模式：不透明、Alpha Test 遮罩或 Alpha Blend 半透明。',
      alphaOpacity: '材质整体不透明度，1 为完全不透明。',
      alphaCutoff: '遮罩模式的 Alpha 截断阈值。',
      alphaTexture: '选择 Alpha/Opacity 贴图。',
      createSlotMaterial: '输入 GLB 子节点或 mesh 的 ownerNodePath 来添加槽绑定，初始使用默认 PBR 材质。',
      slotList: '根节点上的材质槽为只读总览。',
      slotOwnerPath: '材质槽定位到的子节点或 mesh 路径。',
      reimportConflicts: '模型重导入后无法自动匹配或源材质变化的槽。现有绑定会保留，不会静默删除或覆盖。',
      legacySlotRaw: '旧 childMaterials 配置只读展示；新编辑入口请使用槽材质资产。',
    },
  },
  en: {
    title: 'Artist Material',
    slotTitle: 'Material Slots',
    language: 'Language',
    materialAsset: 'Material Asset',
    materialCard: 'Current Material',
    inheritNone: 'Inherit / None',
    defaultMaterial: 'Default PBR Material',
    defaultMaterialMeta: 'BabylonJS-style default PBR material',
    defaultStandardMaterial: 'Default Standard Material',
    defaultStandardMaterialMeta: 'BabylonJS-style default Standard material',
    defaultMaterialReadOnly: 'The system default material is read-only. Choose an editable material asset to adjust parameters.',
    replace: 'Replace',
    batchReplaceUnsupported: 'Batch material replacement is not wired yet. Select one object to replace its material.',
    duplicateForObject: 'Copy',
    materialPickerTitle: 'Select Material Asset',
    texturePickerTitle: 'Select Texture Asset',
    assetProfile: 'Asset Profile',
    assetProfileEmpty: 'Select a material asset to edit asset parameters',
    assetName: 'Asset Name',
    assetKind: 'Material Kind',
    assetKindPbr: 'PBR standard material',
    assetKindStandard: 'Standard material',
    assetLightingModel: 'Lighting Model',
    assetLightingModelLit: 'Lit',
    assetLightingModelUnlit: 'Unlit',
    assetBaseColor: 'Base Color',
    assetBaseTexture: 'Base Texture',
    assetBrightness: 'Texture Brightness',
    assetSaturation: 'Texture Saturation',
    assetContrast: 'Texture Contrast',
    assetHue: 'Texture Hue',
    assetNormalTexture: 'Normal Texture',
    assetNormalStrength: 'Normal Strength',
    assetMetallic: 'Metallic',
    assetRoughness: 'Roughness',
    assetMetallicRoughnessTexture: 'Metallic-Roughness Texture',
    assetOcclusionTexture: 'AO Texture',
    assetOcclusionStrength: 'AO Strength',
    assetEmissionColor: 'Emission Color',
    assetEmissionIntensity: 'Emission Intensity',
    assetEmissionTexture: 'Emission Texture',
    assetEmissionMaskUrl: 'Mask Texture',
    assetAlphaMode: 'Alpha Mode',
    assetAlphaModeOpaque: 'Opaque',
    assetAlphaModeMask: 'Mask',
    assetAlphaModeBlend: 'Blend',
    assetAlphaOpacity: 'Opacity',
    assetAlphaCutoff: 'Alpha Cutoff',
    assetAlphaTexture: 'Alpha Texture',
    createSlotMaterial: 'Add Material Slot',
    slotList: 'Slot List',
    slotId: 'Slot ID',
    slotOwnerPath: 'Slot Owner Path',
    slotMaterialAsset: 'Slot Material Asset',
    slotSourceMaterial: 'Source Material',
    slotBindingPath: 'Binding Path',
    reimportConflicts: 'Reimport Material Conflicts',
    legacySlotRaw: 'Legacy Slot Raw',
    summaryAsset: (name) => `Asset: ${name}`,
    summaryMissingAsset: 'Missing asset',
    summaryLegacyData: 'Legacy data',
    summaryInherit: 'Inherit',
    summaryAddSlot: 'Add slot',
    summarySlotCount: (count) => `${count} slot${count === 1 ? '' : 's'}`,
    formatUsageCount: (count) => (count > 0 ? `Used in ${count} place${count === 1 ? '' : 's'}` : 'Unused'),
    formatMaterialEditImpact: (count) => {
      if (count <= 0) return 'This material is not used in the scene; edits only change the asset.';
      if (count === 1) return 'Edits affect the current binding.';
      return `Shared material: edits affect ${count} bindings.`;
    },
    formatDuplicateMaterialImpact: (count) => {
      if (count <= 0) return 'Copying creates an independently editable material asset.';
      if (count === 1) return 'After copying, the current object or slot uses an independent material.';
      return `After copying, the current object or slot uses an independent material; the original ${count} shared bindings are left unchanged.`;
    },
    formatReimportConflictSummary: (count) => `${count} material slot reimport difference${count === 1 ? '' : 's'} detected. Existing bindings are preserved until unmatched items are resolved.`,
    tooltips: {
      language: 'Switch the artist material Inspector language.',
      materialAsset: 'Choose a project-level shared material asset, or use the read-only Default PBR material.',
      baseTexture: 'Choose a project texture as the base texture. Texture adjustment parameters are applied to this texture first.',
      assetProfile: 'Shared asset parameters affect every node bound to this material asset.',
      assetName: 'Material asset names are display-only for bindings; stable material IDs survive renames.',
      assetKind: 'The material kind controls whether runtime projection uses PBRMaterial or StandardMaterial.',
      lightingModel: 'Lit materials respond to environment and directional lights; unlit materials are useful for UI, VFX, icons, and markers.',
      baseColor: 'Base color is the final color factor multiplied after base texture adjustment. Editing the shared material asset affects every bound node.',
      duplicateForObject: 'Copy the current material as an independent material for this object or slot, then bind it automatically.',
      brightness: 'Base texture brightness multiplier. It only affects materials with a base texture; 1 leaves the texture unchanged.',
      saturation: 'Base texture saturation multiplier. It only affects materials with a base texture; 1 leaves the texture unchanged.',
      contrast: 'Base texture contrast multiplier. It only affects materials with a base texture; 1 leaves the texture unchanged.',
      hue: 'Base texture hue offset in degrees. It only affects materials with a base texture.',
      normalTexture: 'Choose a normal map applied to the runtime bump/normal channel for PBR and Standard materials.',
      normalStrength: 'Normal strength. 1 keeps the texture at original strength.',
      metallic: 'Metallic value from 0 to 1.',
      roughness: 'Roughness value from 0 to 1.',
      metallicRoughnessTexture: 'Choose a metallic-roughness texture. PBR runtime reads blue as metallic and green as roughness by the common GLB convention.',
      occlusionTexture: 'Choose an ambient occlusion texture. Applies to PBR materials.',
      occlusionStrength: 'Ambient occlusion strength. 1 keeps the texture at original strength.',
      emissionColor: 'Emission color multiplied by emission intensity.',
      emissionIntensity: 'Emission intensity. 0 means no emission.',
      emissionTexture: 'Choose an emissive texture. If empty, the legacy mask texture remains the fallback.',
      emissionMaskUrl: 'Choose a grayscale texture to modulate emission intensity.',
      alphaMode: 'Alpha mode: opaque, alpha-test mask, or alpha-blend transparency.',
      alphaOpacity: 'Overall material opacity. 1 is fully opaque.',
      alphaCutoff: 'Alpha-test cutoff threshold for mask mode.',
      alphaTexture: 'Choose an alpha/opacity texture.',
      createSlotMaterial: 'Enter a GLB child node or mesh ownerNodePath to add a slot binding with the Default PBR material.',
      slotList: 'Material slots on the root object are a readonly overview.',
      slotOwnerPath: 'Child node or mesh path targeted by this material slot.',
      reimportConflicts: 'Slots whose source material changed or could not be matched after model reimport. Existing bindings are preserved instead of being silently deleted or overwritten.',
      legacySlotRaw: 'Readonly legacy childMaterials config. Use slot material assets for new edits.',
    },
  },
};

export interface EditorSceneInspectorTextureAsset {
  id: string;
  label: string;
  url: string;
  meta?: string;
}

export interface EditorSceneInspectorContext {
  textureAssets?: readonly EditorSceneInspectorTextureAsset[];
}

const MATERIAL_LANGUAGE_OPTIONS = CAMERA_LANGUAGE_OPTIONS;

function createMaterialLightingModelOptions(text: ArtistMaterialInspectorText): Array<{ label: string; value: 'lit' | 'unlit' }> {
  return [
    { label: text.assetLightingModelLit, value: 'lit' },
    { label: text.assetLightingModelUnlit, value: 'unlit' },
  ];
}

function createMaterialAlphaModeOptions(text: ArtistMaterialInspectorText): Array<{ label: string; value: 'opaque' | 'mask' | 'blend' }> {
  return [
    { label: text.assetAlphaModeOpaque, value: 'opaque' },
    { label: text.assetAlphaModeMask, value: 'mask' },
    { label: text.assetAlphaModeBlend, value: 'blend' },
  ];
}

function getCameraInspectorText(language: EditorSceneCameraInspectorLanguage): CameraInspectorText {
  return CAMERA_INSPECTOR_TEXT[language] ?? CAMERA_INSPECTOR_TEXT.zh;
}

function getArtistMaterialInspectorText(language: ArtistMaterialInspectorLanguage): ArtistMaterialInspectorText {
  return ARTIST_MATERIAL_INSPECTOR_TEXT[language] ?? ARTIST_MATERIAL_INSPECTOR_TEXT.zh;
}

function readArtistMaterialInspectorLanguage(gameObject: EditorSceneGameObject): ArtistMaterialInspectorLanguage {
  return gameObject.metadata?.artistMaterialInspectorLanguage === 'en' ? 'en' : 'zh';
}

function createCameraProjectionOptions(text: CameraInspectorText): Array<{ label: string; value: SceneCameraProjection }> {
  return [
    { label: text.projectionOrthographic, value: 'orthographic' },
    { label: text.projectionPerspective, value: 'perspective' },
  ];
}

type LightInspectorText = {
  hemisphericTitle: string;
  directionalTitle: string;
  hemisphericSummary: string;
  directionalSummary: string;
  language: string;
  type: string;
  typeHemispheric: string;
  typeDirectional: string;
  intensity: string;
  skyLightColor: string;
  groundColor: string;
  lightColor: string;
  horizontalAngle: string;
  elevationAngle: string;
  shadowsTitle: string;
  shadowsSummary: string;
  shadowSystem: string;
  shadowEnabled: string;
  shadowOpacity: string;
  shadowLength: string;
  shadowFollowDirectional: string;
  openShadows: string;
  rawLight: string;
  tooltips: {
    language: string;
    type: string;
    intensity: string;
    skyLightColor: string;
    groundColor: string;
    lightColor: string;
    horizontalAngle: string;
    elevationAngle: string;
    shadowSystem: string;
    shadowEnabled: string;
    shadowOpacity: string;
    shadowLength: string;
    openShadows: string;
    rawLight: string;
  };
};

const LIGHT_INSPECTOR_TEXT: Record<EditorSceneLightInspectorLanguage, LightInspectorText> = {
  zh: {
    hemisphericTitle: '环境光',
    directionalTitle: '直射光',
    hemisphericSummary: 'Hemispheric',
    directionalSummary: 'Directional',
    language: '语言',
    type: '类型',
    typeHemispheric: '环境光',
    typeDirectional: '直射光',
    intensity: '强度',
    skyLightColor: '天空光颜色',
    groundColor: '地面颜色',
    lightColor: '光照颜色',
    horizontalAngle: '水平角',
    elevationAngle: '高度角',
    shadowsTitle: '阴影',
    shadowsSummary: 'Planar Main / 跟随直射光',
    shadowSystem: '系统',
    shadowEnabled: '启用',
    shadowOpacity: '不透明度',
    shadowLength: '阴影长度',
    shadowFollowDirectional: 'Planar Main / 跟随直射光',
    openShadows: '打开阴影设置',
    rawLight: '原始光源数据',
    tooltips: {
      language: '切换此光源检查器的属性显示语言。该字段只用于编辑器，不会导出到运行时。',
      type: '系统光源类型只读。对应 BabylonJS 的 HemisphericLight 或 DirectionalLight。',
      intensity: '光源强度，必须是非负数。BabylonJS 不设置硬上限；白色材质在较高强度下通常已经接近显示饱和，继续增大视觉变化会不明显。',
      skyLightColor: '环境光来自天空方向的漫反射颜色，对应 BabylonJS HemisphericLight.diffuse。',
      groundColor: '环境光来自地面反射方向的颜色，对应 BabylonJS HemisphericLight.groundColor。',
      lightColor: '直射光颜色，对应 BabylonJS DirectionalLight.diffuse。',
      horizontalAngle: '直射光在 XZ 平面内的朝向角度。编辑器会把它转换为 BabylonJS DirectionalLight.direction。',
      elevationAngle: '直射光相对地平线的高度角；90 度表示从正上方照下。编辑器会把它转换为 BabylonJS DirectionalLight.direction。',
      shadowSystem: '阴影系统只读摘要。Planar 阴影方向来自当前直射光，完整参数在 Rendering 面板调整。',
      shadowEnabled: '当前项目级 Planar 阴影是否启用。这里仅显示摘要，不在光源 Inspector 中编辑。',
      shadowOpacity: '当前项目级 Planar 阴影不透明度。完整参数在 Rendering 面板调整。',
      shadowLength: '根据直射光方向估算的平面阴影长度倍率；高度角越低，阴影越长。',
      openShadows: '切换到右侧 Rendering 面板，编辑项目级阴影设置。',
      rawLight: '编辑器文档中的光源原始数据，只读显示。',
    },
  },
  en: {
    hemisphericTitle: 'Environment Light',
    directionalTitle: 'Directional Light',
    hemisphericSummary: 'Hemispheric',
    directionalSummary: 'Directional',
    language: 'Language',
    type: 'Type',
    typeHemispheric: 'Environment Light',
    typeDirectional: 'Directional Light',
    intensity: 'Intensity',
    skyLightColor: 'Sky Light Color',
    groundColor: 'Ground Color',
    lightColor: 'Light Color',
    horizontalAngle: 'Horizontal Angle',
    elevationAngle: 'Elevation Angle',
    shadowsTitle: 'Shadows',
    shadowsSummary: 'Planar Main / Follow Directional Light',
    shadowSystem: 'System',
    shadowEnabled: 'Enabled',
    shadowOpacity: 'Opacity',
    shadowLength: 'Shadow Length',
    shadowFollowDirectional: 'Planar Main / Follow Directional Light',
    openShadows: 'Open Shadows',
    rawLight: 'Raw Light Data',
    tooltips: {
      language: 'Switches the display language for this light inspector. This editor-only field is not exported to runtime.',
      type: 'Read-only system light type. Maps to BabylonJS HemisphericLight or DirectionalLight.',
      intensity: 'Light intensity. Must be a non-negative number. BabylonJS does not impose a hard upper limit; white surfaces often saturate at high intensity, so further increases may look subtle.',
      skyLightColor: 'Diffuse sky color for the environment light. Maps to BabylonJS HemisphericLight.diffuse.',
      groundColor: 'Ground bounce color for the environment light. Maps to BabylonJS HemisphericLight.groundColor.',
      lightColor: 'Directional light color. Maps to BabylonJS DirectionalLight.diffuse.',
      horizontalAngle: 'Directional light heading in the XZ plane. The editor converts it to BabylonJS DirectionalLight.direction.',
      elevationAngle: 'Directional light elevation above the horizon; 90 degrees points straight down. The editor converts it to BabylonJS DirectionalLight.direction.',
      shadowSystem: 'Read-only shadow system summary. Planar shadow direction follows this Directional Light; edit full settings in Rendering.',
      shadowEnabled: 'Whether the project-level planar shadow system is enabled. This is summary-only in the light Inspector.',
      shadowOpacity: 'Current project-level planar shadow opacity. Edit full settings in Rendering.',
      shadowLength: 'Estimated planar shadow length multiplier from this light direction. Lower elevation makes longer shadows.',
      openShadows: 'Switches the right dock to the Rendering panel for project-level shadow settings.',
      rawLight: 'Read-only raw light data from the editor document.',
    },
  },
};

const LIGHT_LANGUAGE_OPTIONS = CAMERA_LANGUAGE_OPTIONS;

function getLightInspectorText(language: EditorSceneLightInspectorLanguage): LightInspectorText {
  return LIGHT_INSPECTOR_TEXT[language] ?? LIGHT_INSPECTOR_TEXT.zh;
}

function getLightInspectorLanguage(light: EditorSceneLight): EditorSceneLightInspectorLanguage {
  return light.inspectorLanguage === 'en' ? 'en' : 'zh';
}

function createEditorSceneGameObjectGuid(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${EDITOR_SCENE_GAME_OBJECT_GUID_PREFIX}${uuid}`;
  const random = Math.random().toString(36).slice(2, 12);
  const timestamp = Date.now().toString(36);
  return `${EDITOR_SCENE_GAME_OBJECT_GUID_PREFIX}${timestamp}_${random}`;
}

function isEditorSceneRootGameObjectId(gameObjectId: string | null | undefined): boolean {
  return isPlayableEditorSceneRootGameObjectId(gameObjectId);
}

function isEditorSceneRootGameObject(gameObject: EditorSceneGameObject): boolean {
  return isPlayableEditorSceneRootGameObject(gameObject);
}

function isEditorSceneRootTransformPath(targetId: string, path: string): boolean {
  return isEditorSceneRootGameObjectId(targetId)
    && /^transform(?:\.(position|rotation|scale)(?:\.(x|y|z))?)?$/.test(path);
}

function createEditorSceneRootTransformComponent(): EditorSceneGameObject['components'][number] {
  return {
    type: 'Transform',
    position: { ...EDITOR_SCENE_ROOT_TRANSFORM.position },
    rotation: { ...EDITOR_SCENE_ROOT_TRANSFORM.rotation },
    scale: { ...EDITOR_SCENE_ROOT_TRANSFORM.scale },
  };
}

function normalizeEditorSceneRootTransformDocument(document: EditorSceneDocument): EditorSceneDocument {
  const root = document.scene.gameObjects.find(isEditorSceneRootGameObject);
  if (!root) return document;
  const rootLocalTransform = readRawGameObjectLocalTransform(root);
  const bakeRootTransformIntoChildren = !!findEditorSceneTransform(root)
    && !isIdentityEditorTransform(rootLocalTransform);
  let changed = false;
  const gameObjects = document.scene.gameObjects.map((gameObject) => {
    if (isEditorSceneRootGameObject(gameObject)) {
      const next = normalizeEditorSceneRootGameObject(gameObject);
      changed = changed || next !== gameObject;
      return next;
    }
    if (!bakeRootTransformIntoChildren || gameObject.parentId !== EDITOR_SCENE_ROOT_ID) return gameObject;
    const childTransform = findEditorSceneTransform(gameObject);
    if (!childTransform) return gameObject;
    const bakedTransform = combineEditorTransforms(rootLocalTransform, readRawGameObjectLocalTransform(gameObject));
    if (!bakedTransform) return gameObject;
    const next = patchEditorSceneGameObjectLocalTransform(gameObject, bakedTransform);
    changed = changed || next !== gameObject;
    return next;
  });
  return changed
    ? {
        ...document,
        scene: {
          ...document.scene,
          gameObjects,
        },
      }
    : document;
}

function normalizeEditorSceneRootGameObject(gameObject: EditorSceneGameObject): EditorSceneGameObject {
  let hasTransform = false;
  const components = gameObject.components.map((component) => {
    if (component.type !== 'Transform') return component;
    hasTransform = true;
    return createEditorSceneRootTransformComponent();
  });
  if (!hasTransform) components.unshift(createEditorSceneRootTransformComponent());

  const next: EditorSceneGameObject = {
    ...gameObject,
    components,
  };
  delete next.parentId;
  return shallowEditorSceneGameObjectsEqual(next, gameObject) ? gameObject : next;
}

export function ensureEditorSceneGameObjectGuids(document: EditorSceneDocument): EditorSceneDocument {
  return ensurePlayableEditorSceneGameObjectGuids(document) as EditorSceneDocument;
}

function patchEditorSceneGameObjectLocalTransform(
  gameObject: EditorSceneGameObject,
  transform: EditorTransformSnapshot,
): EditorSceneGameObject {
  const next = {
    ...gameObject,
    components: gameObject.components.map((component) => {
      if (component.type !== 'Transform') return component;
      return {
        ...component,
        position: { ...transform.position },
        rotation: { ...transform.rotation },
        scale: { ...transform.scale },
      };
    }),
  };
  return shallowEditorSceneGameObjectsEqual(next, gameObject) ? gameObject : next;
}

export function reduceEditorSceneDocument(
  document: EditorSceneDocument,
  command: DocumentCommand<EditorSceneDocument, EditorSceneDocumentPatch>,
): EditorSceneDocument {
  return ensureEditorSceneGameObjectGuids(
    normalizeEditorSceneRootTransformDocument(
      reduceEditorSceneDocumentUnchecked(document, command),
    ),
  );
}

function reduceEditorSceneDocumentUnchecked(
  document: EditorSceneDocument,
  command: DocumentCommand<EditorSceneDocument, EditorSceneDocumentPatch>,
): EditorSceneDocument {
  if (command.type !== 'document.replace') {
    if (command.patch.kind === 'scene.material-asset.field') {
      return patchEditorSceneMaterialAssetField(
        document,
        command.patch.materialAssetId,
        command.patch.path,
        command.patch.value,
      );
    }
    if (command.patch.kind === 'scene.material-asset.create') {
      return addEditorSceneMaterialAsset(
        document,
        command.patch.materialAsset,
      );
    }
    if (command.patch.kind === 'scene.material-asset.delete') {
      return deleteEditorSceneMaterialAsset(
        document,
        command.patch.materialAssetId,
      );
    }
    if (command.patch.kind === 'scene.material-asset.duplicate-and-bind') {
      return addEditorSceneMaterialAssetAndBind(
        document,
        command.patch.targetId,
        command.patch.bindingPath,
        command.patch.materialAsset,
      );
    }
    if (command.patch.kind === 'scene.prefab-material-asset.duplicate-and-bind') {
      return addEditorSceneMaterialAssetAndBindPrefab(
        document,
        command.patch.assetId,
        command.patch.bindingPath,
        command.patch.materialAsset,
      );
    }
    if (command.patch.kind === 'scene.prefab-asset.create') {
      return addEditorScenePrefabAsset(
        document,
        command.patch.prefabAsset,
        command.patch.sourceAsset,
      );
    }
    if (command.patch.kind === 'scene.prefab-asset.create-from-game-object') {
      return addEditorScenePrefabAsset(
        document,
        command.patch.prefabAsset,
      );
    }
    if (command.patch.kind === 'scene.prefab-asset.duplicate') {
      return addEditorScenePrefabAsset(
        document,
        command.patch.prefabAsset,
        undefined,
        { allowDuplicateSource: true },
      );
    }
    if (command.patch.kind === 'scene.prefab-asset.field') {
      return patchEditorScenePrefabAssetField(
        document,
        command.patch.assetId,
        command.patch.path,
        command.patch.value,
      );
    }
    if (command.patch.kind === 'game-object.rendering-alpha-index-migration') {
      return patchEditorSceneRenderingAlphaIndexMigration(document, command.patch);
    }
  }
  return reducePlayableEditorSceneDocumentMutation(
    document,
    command as DocumentCommand<EditorSceneDocument, PlayableEditorSceneDocumentMutationPatch<EditorSceneGameObject>>,
    createEditorSceneDocumentMutationOptions(),
  );
}

function patchEditorSceneRenderingAlphaIndexMigration(
  document: EditorSceneDocument,
  patch: Extract<EditorSceneDocumentPatch, { kind: 'game-object.rendering-alpha-index-migration' }>,
): EditorSceneDocument {
  return migratePlayableEditorSceneDocumentRenderingAlphaIndex({
    document,
    targetIds: patch.targetIds,
    renderingGroupId: patch.renderingGroupId,
    fromAlphaIndex: patch.fromAlphaIndex,
    toAlphaIndex: patch.toAlphaIndex,
  });
}

function createEditorSceneDocumentMutationOptions(): PlayableEditorSceneDocumentMutationOptions<EditorSceneDocument, EditorSceneGameObject> {
  return {
    field: EDITOR_SCENE_FIELD_MUTATION_OPTIONS,
    serializedProperty: {
      validateField: validateEditorSceneSerializedPropertyField,
    },
    assetPlacement: {
      createGameObjectGuid: () => createEditorSceneGameObjectGuid(),
      resolveLocalTransform: ({ document: targetDocument, parentId, worldTransform }) => (
        toLocalTransformForParent(targetDocument as EditorSceneDocument, parentId, worldTransform)
      ),
    },
    isProtectedDuplicateSource: (gameObject) => isEditorSceneProtectedSystemGameObject(gameObject),
    isProtectedDeleteTarget: (gameObject) => isEditorSceneProtectedSystemGameObject(gameObject),
  };
}

export function isEditorSceneGroupLikeGameObject(gameObject: EditorSceneGameObject): boolean {
  return isPlayableEditorSceneGroupLikeGameObject(gameObject);
}

export function canEditorSceneGameObjectHaveChildren(gameObject: EditorSceneGameObject): boolean {
  return canPlayableEditorSceneGameObjectHaveChildren(gameObject);
}

export function isEditorSceneCameraGameObject(gameObject: EditorSceneGameObject): boolean {
  return isPlayableEditorSceneCameraGameObject(gameObject);
}

export function isEditorSceneLightGameObject(gameObject: EditorSceneGameObject): boolean {
  return readEditorSceneNodeKind(gameObject) === 'transform'
    && (gameObject.transformType === 'light' || !!gameObject.light);
}

function isEditorSceneProtectedSystemGameObject(gameObject: EditorSceneGameObject): boolean {
  return gameObject.id === EDITOR_SCENE_MAIN_CAMERA_ID
    || gameObject.id === EDITOR_SCENE_ENVIRONMENT_LIGHT_ID
    || gameObject.id === EDITOR_SCENE_SUN_LIGHT_ID
    || isEditorSceneCameraGameObject(gameObject)
    || isEditorSceneLightGameObject(gameObject);
}

function isEditorSceneProtectedSystemGameObjectId(document: EditorSceneDocument, id: string | undefined): boolean {
  if (!id) return false;
  const gameObject = findEditorSceneGameObject(document, id);
  return !!gameObject && isEditorSceneProtectedSystemGameObject(gameObject);
}

export function ensureEditorSceneEnvironmentDefaults(document: EditorSceneDocument): EditorSceneDocument {
  const documentWithGuids = ensureEditorSceneGameObjectGuids(document);
  const rootId = resolveEditorSceneRootContainerId(documentWithGuids);
  let cameraSeen = false;
  let environmentLightSeen = false;
  let sunLightSeen = false;
  let changed = documentWithGuids !== document;
  let materialAssets = ensureDefaultEditorSceneMaterialAssets(documentWithGuids.scene.materialAssets ?? []);
  changed = changed || materialAssets !== documentWithGuids.scene.materialAssets;
  let gameObjects = documentWithGuids.scene.gameObjects.map((gameObject) => {
    if (gameObject.id === EDITOR_SCENE_ENVIRONMENT_LIGHT_ID) {
      environmentLightSeen = true;
      const next = normalizeEditorSceneSystemLightGameObject(gameObject, 'hemispheric');
      changed = changed || next !== gameObject;
      return next;
    }
    if (gameObject.id === EDITOR_SCENE_SUN_LIGHT_ID) {
      sunLightSeen = true;
      const next = normalizeEditorSceneSystemLightGameObject(gameObject, 'directional');
      changed = changed || next !== gameObject;
      return next;
    }
    if (isEditorSceneCameraGameObject(gameObject)) {
      if (!cameraSeen) {
        cameraSeen = true;
        const next = normalizeEditorSceneCameraGameObject(gameObject);
        changed = changed || next !== gameObject;
        return next;
      }
      changed = true;
      return normalizeEditorScenePlainTransformGameObject(gameObject);
    }
    if (isEditorSceneLightGameObject(gameObject)) {
      const next = normalizeEditorScenePlainTransformGameObject(gameObject);
      changed = true;
      return next;
    }
    return gameObject;
  });

  const usedIds = new Set(gameObjects.map((gameObject) => gameObject.id));
  if (!cameraSeen) {
    changed = true;
    gameObjects.push(createDefaultEditorSceneCameraGameObject(rootId, usedIds));
  }
  if (!environmentLightSeen) {
    changed = true;
    gameObjects.push(createDefaultEditorSceneEnvironmentLightGameObject(rootId, usedIds));
  }
  if (!sunLightSeen) {
    changed = true;
    gameObjects.push(createDefaultEditorSceneSunLightGameObject(rootId, usedIds));
  }

  const migratedSlotBindings = migrateEditorSceneMaterialSlotBindings(documentWithGuids, gameObjects);
  gameObjects = migratedSlotBindings.gameObjects;
  changed = changed || migratedSlotBindings.changed;

  const reimportSlotBindings = reconcileEditorSceneMaterialSlotReimportBindings(
    {
      ...documentWithGuids,
      scene: {
        ...documentWithGuids.scene,
        gameObjects,
        materialAssets,
      },
    },
    gameObjects,
  );
  gameObjects = reimportSlotBindings.gameObjects;
  changed = changed || reimportSlotBindings.changed;

  const importedMaterialDefaults = ensureImportedEditorSceneMaterialDefaults(documentWithGuids, materialAssets, gameObjects);
  materialAssets = importedMaterialDefaults.materialAssets;
  gameObjects = importedMaterialDefaults.gameObjects;
  changed = changed || importedMaterialDefaults.changed;

  return changed
    ? {
        ...documentWithGuids,
        scene: {
          ...documentWithGuids.scene,
          gameObjects,
          materialAssets,
        },
      }
    : documentWithGuids;
}

export function repairEditorSceneMaterialAssetsFromSceneConfig(
  document: EditorSceneDocument,
  sceneConfig: SceneConfig | null | undefined,
): EditorSceneDocument {
  const integrity = resolvePlayableEditorSceneMaterialAssetIntegrity(document);
  if (integrity.ok) return document;
  const runtimeMaterialAssets = Array.isArray(sceneConfig?.scene?.materialAssets)
    ? sceneConfig.scene.materialAssets
    : [];
  if (runtimeMaterialAssets.length === 0) return document;
  const existingIds = new Set((document.scene.materialAssets ?? []).map(materialAsset => materialAsset.id));
  const recoveredMaterialAssets: SceneMaterialAssetConfig[] = [];
  for (const materialAssetId of integrity.missingMaterialAssetIds) {
    if (existingIds.has(materialAssetId)) continue;
    const runtimeMaterialAsset = runtimeMaterialAssets.find(materialAsset => materialAsset.id === materialAssetId);
    if (!runtimeMaterialAsset) continue;
    existingIds.add(materialAssetId);
    recoveredMaterialAssets.push(structuredClone(runtimeMaterialAsset));
  }
  if (recoveredMaterialAssets.length === 0) return document;
  return {
    ...document,
    scene: {
      ...document.scene,
      materialAssets: [
        ...(document.scene.materialAssets ?? []),
        ...recoveredMaterialAssets,
      ],
    },
  };
}

export function assertEditorSceneMaterialAssetIntegrity(document: EditorSceneDocument): void {
  const integrity = resolvePlayableEditorSceneMaterialAssetIntegrity(document);
  if (integrity.ok) return;
  const error = new Error(`editor_scene_material_assets_missing: ${integrity.missingMaterialAssetIds.join(', ')}`);
  (error as Error & { details?: unknown }).details = {
    missingMaterialAssetIds: integrity.missingMaterialAssetIds,
    missingReferences: integrity.missingReferences.map((usage) => ({
      materialAssetId: usage.materialAssetId,
      gameObjectId: usage.gameObjectId,
      bindingPath: usage.bindingPath,
      label: usage.label,
      kind: usage.kind,
      ...(usage.slotId ? { slotId: usage.slotId } : {}),
      ...(usage.ownerNodePath ? { ownerNodePath: usage.ownerNodePath } : {}),
    })),
  };
  throw error;
}

function migrateEditorSceneMaterialSlotBindings(
  document: EditorSceneDocument,
  gameObjects: readonly EditorSceneGameObject[],
): { gameObjects: EditorSceneGameObject[]; changed: boolean } {
  let changed = false;
  const nextGameObjects = gameObjects.map((gameObject) => {
    const renderer = findEditorSceneModelRenderer(gameObject);
    const childMaterialBindings = gameObject.overrides?.childMaterialBindings;
    if (!renderer || !childMaterialBindings) return gameObject;
    const asset = document.assets.find((entry) => entry.id === renderer.assetId);
    const slots = collectEditorSceneMaterialSlotMigrationDescriptors(asset);
    if (slots.length === 0) return gameObject;

    let nextGameObject = gameObject;
    for (const slot of slots) {
      const legacy = findEditorSceneLegacyMaterialSlotBinding(nextGameObject.overrides?.childMaterialBindings, slot.ownerNodePath);
      const legacyBinding = legacy?.binding;
      if (!legacyBinding || nextGameObject.overrides?.materialSlotBindings?.[slot.slotId]) continue;
      nextGameObject = structuredClone(nextGameObject);
      nextGameObject.overrides = nextGameObject.overrides ?? {};
      nextGameObject.overrides.materialSlotBindings = nextGameObject.overrides.materialSlotBindings ?? {};
      nextGameObject.overrides.materialSlotBindings[slot.slotId] = structuredClone(legacyBinding);
      delete nextGameObject.overrides.childMaterialBindings?.[legacy.ownerNodePath];
      if (nextGameObject.overrides.childMaterialBindings && Object.keys(nextGameObject.overrides.childMaterialBindings).length === 0) {
        delete nextGameObject.overrides.childMaterialBindings;
      }
      changed = true;
    }
    return nextGameObject;
  });
  return { gameObjects: nextGameObjects, changed };
}

function reconcileEditorSceneMaterialSlotReimportBindings(
  document: EditorSceneDocument,
  gameObjects: readonly EditorSceneGameObject[],
): { gameObjects: EditorSceneGameObject[]; changed: boolean } {
  let changed = false;
  const nextGameObjects = gameObjects.map((gameObject) => {
    const diff = resolvePlayableEditorSceneMaterialSlotReimportDiff(document, gameObject);
    if (diff.bindingRemaps.length === 0) return gameObject;
    let nextGameObject = gameObject;
    for (const remap of diff.bindingRemaps) {
      const sourceBinding = nextGameObject.overrides?.materialSlotBindings?.[remap.fromSlotId];
      if (!sourceBinding || nextGameObject.overrides?.materialSlotBindings?.[remap.toSlotId]) continue;
      nextGameObject = structuredClone(nextGameObject);
      nextGameObject.overrides = nextGameObject.overrides ?? {};
      nextGameObject.overrides.materialSlotBindings = nextGameObject.overrides.materialSlotBindings ?? {};
      nextGameObject.overrides.materialSlotBindings[remap.toSlotId] = structuredClone(sourceBinding);
      delete nextGameObject.overrides.materialSlotBindings[remap.fromSlotId];
      if (Object.keys(nextGameObject.overrides.materialSlotBindings).length === 0) {
        delete nextGameObject.overrides.materialSlotBindings;
      }
      changed = true;
    }
    return nextGameObject;
  });
  return { gameObjects: nextGameObjects, changed };
}

function collectEditorSceneMaterialSlotMigrationDescriptors(
  asset: EditorSceneDocument['assets'][number] | undefined,
): Array<{ slotId: string; ownerNodePath: string }> {
  const rawSlots = Array.isArray(asset?.metadata?.materialSlots) ? asset.metadata.materialSlots : [];
  const slots: Array<{ slotId: string; ownerNodePath: string }> = [];
  for (const rawSlot of rawSlots) {
    if (!rawSlot || typeof rawSlot !== 'object' || Array.isArray(rawSlot)) continue;
    const record = rawSlot as Record<string, unknown>;
    const slotId = typeof record.slotId === 'string' ? record.slotId.trim() : '';
    const ownerNodePath = normalizePlayableEditorSceneMaterialSlotOwnerPath(
      typeof record.ownerNodePath === 'string'
        ? record.ownerNodePath
        : typeof record.path === 'string'
          ? record.path
          : '',
    );
    if (slotId && ownerNodePath) slots.push({ slotId, ownerNodePath });
  }
  return slots;
}

function findEditorSceneLegacyMaterialSlotBinding(
  childMaterialBindings: Record<string, SceneNodeMaterialBindingConfig | undefined> | undefined,
  ownerNodePath: string,
): { ownerNodePath: string; binding: SceneNodeMaterialBindingConfig } | null {
  if (!childMaterialBindings) return null;
  const exact = childMaterialBindings[ownerNodePath];
  if (exact) return { ownerNodePath, binding: exact };
  const normalizedOwnerNodePath = normalizePlayableEditorSceneMaterialSlotOwnerPath(ownerNodePath);
  for (const [legacyOwnerNodePath, binding] of Object.entries(childMaterialBindings)) {
    if (!binding) continue;
    if (normalizePlayableEditorSceneMaterialSlotOwnerPath(legacyOwnerNodePath) === normalizedOwnerNodePath) {
      return { ownerNodePath: legacyOwnerNodePath, binding };
    }
  }
  return null;
}

function ensureImportedEditorSceneMaterialDefaults(
  document: EditorSceneDocument,
  materialAssets: readonly SceneMaterialAssetConfig[],
  gameObjects: readonly EditorSceneGameObject[],
): {
  materialAssets: SceneMaterialAssetConfig[];
  gameObjects: EditorSceneGameObject[];
  changed: boolean;
} {
  let changed = false;
  const nextMaterialAssets = [...materialAssets];
  const materialAssetIds = new Set(nextMaterialAssets.map(materialAsset => materialAsset.id));
  const assetById = new Map(document.assets.map(asset => [asset.id, asset]));
  const nextGameObjects = gameObjects.map((gameObject) => {
    const renderer = findEditorSceneModelRenderer(gameObject);
    if (!renderer || readEditorSceneNodeKind(gameObject) === 'primitive') return gameObject;
    const sourceAsset = assetById.get(renderer.assetId);
    if (!sourceAsset) return gameObject;
    const slots = collectEditorSceneChildMaterialSlots(document, gameObject)
      .filter(slot => collectEditorSceneSlotSourceMaterialIndices(slot).length > 0);
    if (slots.length === 0) return gameObject;

    let nextGameObject = gameObject;
    for (const slot of slots) {
      const sourceMaterialIndices = collectEditorSceneSlotSourceMaterialIndices(slot);
      const importedMaterialIds = sourceMaterialIndices.map((sourceMaterialIndex) => {
        const importedMaterial = createImportedEditorSceneMaterialAsset(sourceAsset, slot, sourceMaterialIndex);
        if (!materialAssetIds.has(importedMaterial.id)) {
          materialAssetIds.add(importedMaterial.id);
          nextMaterialAssets.push(importedMaterial);
          changed = true;
        }
        return importedMaterial.id;
      });
      const defaultMaterialAssetId = importedMaterialIds[0];
      if (!defaultMaterialAssetId || getEditorSceneSlotMaterialBinding(nextGameObject, slot)?.materialAssetId) {
        continue;
      }
      nextGameObject = bindDefaultEditorSceneSlotMaterial(nextGameObject, slot, defaultMaterialAssetId);
      changed = true;
    }
    return nextGameObject;
  });

  return {
    materialAssets: nextMaterialAssets,
    gameObjects: nextGameObjects,
    changed,
  };
}

function createImportedEditorSceneMaterialAsset(
  sourceAsset: EditorSceneDocument['assets'][number],
  slot: EditorSceneChildMaterialSlot,
  sourceMaterialIndex: number,
): SceneMaterialAssetConfig {
  const sourceAssetGuid = sourceAsset.guid ?? sourceAsset.id;
  const guid = createStableEditorSceneMaterialAssetGuid(`imported:${sourceAssetGuid}:${sourceMaterialIndex}`);
  const materialName = getEditorSceneSlotSourceMaterialName(slot, sourceMaterialIndex)
    ?? `${sourceAsset.displayName ?? sourceAsset.id} Material ${sourceMaterialIndex + 1}`;
  const sourceProfile = getEditorSceneSlotSourceMaterialProfile(slot, sourceMaterialIndex)?.profile;
  return {
    id: createEditorSceneMaterialAssetId(guid),
    guid,
    name: materialName,
    materialKind: 'pbr',
    origin: {
      type: 'imported',
      sourceAssetGuid,
      sourceAssetId: sourceAsset.id,
      ...(slot.slotId ? { sourceSlotId: slot.slotId } : {}),
      sourceMaterialIndex,
      sourceMaterialName: materialName,
    },
    profile: mergeEditorSceneImportedMaterialProfile(sourceProfile),
  };
}

function mergeEditorSceneImportedMaterialProfile(sourceProfile: ArtistMaterialProfile | null | undefined): ArtistMaterialProfile {
  const baseProfile = structuredClone(DEFAULT_PBR_MATERIAL_ASSET.profile);
  if (!sourceProfile || typeof sourceProfile !== 'object') return baseProfile;
  const nextProfile: ArtistMaterialProfile = {
    ...baseProfile,
    ...structuredClone(sourceProfile),
  };
  nextProfile.baseColor = {
    ...(baseProfile.baseColor ?? {}),
    ...(sourceProfile.baseColor ?? {}),
  };
  if (baseProfile.normal || sourceProfile.normal) {
    nextProfile.normal = {
      ...(baseProfile.normal ?? {}),
      ...(sourceProfile.normal ?? {}),
    };
  }
  if (baseProfile.metallicRoughness || sourceProfile.metallicRoughness) {
    nextProfile.metallicRoughness = {
      ...(baseProfile.metallicRoughness ?? {}),
      ...(sourceProfile.metallicRoughness ?? {}),
    };
  }
  if (baseProfile.occlusion || sourceProfile.occlusion) {
    nextProfile.occlusion = {
      ...(baseProfile.occlusion ?? {}),
      ...(sourceProfile.occlusion ?? {}),
    };
  }
  nextProfile.emission = {
    ...(baseProfile.emission ?? {}),
    ...(sourceProfile.emission ?? {}),
  };
  if (baseProfile.alpha || sourceProfile.alpha) {
    nextProfile.alpha = {
      ...(baseProfile.alpha ?? {}),
      ...(sourceProfile.alpha ?? {}),
    };
  }
  return nextProfile;
}

function createEditorSceneMaterialAssetId(guid: string): string {
  const token = String(guid ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return `mat_${token || 'material'}`;
}

function createStableEditorSceneMaterialAssetGuid(seed: string): string {
  const normalizedSeed = String(seed ?? '').trim() || 'material';
  const hex = [0, 1, 2, 3]
    .map(index => hashEditorSceneMaterialIdentitySeed(`${normalizedSeed}\0${index}`))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function hashEditorSceneMaterialIdentitySeed(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function bindDefaultEditorSceneSlotMaterial(
  gameObject: EditorSceneGameObject,
  slot: EditorSceneChildMaterialSlot,
  materialAssetId: string,
): EditorSceneGameObject {
  const next = structuredClone(gameObject);
  next.overrides = next.overrides ?? {};
  if (slot.slotId) {
    next.overrides.materialSlotBindings = next.overrides.materialSlotBindings ?? {};
    next.overrides.materialSlotBindings[slot.slotId] = {
      ...(next.overrides.materialSlotBindings[slot.slotId] ?? {}),
      materialAssetId,
    };
  } else {
    next.overrides.childMaterialBindings = next.overrides.childMaterialBindings ?? {};
    next.overrides.childMaterialBindings[slot.ownerNodePath] = {
      ...(next.overrides.childMaterialBindings[slot.ownerNodePath] ?? {}),
      materialAssetId,
    };
  }
  return next;
}

function collectEditorSceneSlotSourceMaterialIndices(slot: EditorSceneChildMaterialSlot): number[] {
  if (slot.sourceMaterialIndices?.length) {
    return [...new Set(slot.sourceMaterialIndices.filter((value): value is number => Number.isInteger(value)))];
  }
  const sourceMaterialIndex = slot.sourceMaterialIndex;
  return typeof sourceMaterialIndex === 'number' && Number.isInteger(sourceMaterialIndex) ? [sourceMaterialIndex] : [];
}

function getEditorSceneSlotSelectionKey(slot: EditorSceneChildMaterialSlot): string {
  return slot.slotId || slot.ownerNodePath;
}

function getEditorSceneSlotMaterialBindingPath(slot: EditorSceneChildMaterialSlot): string {
  return slot.slotId
    ? `overrides.materialSlotBindings.${slot.slotId}.materialAssetId`
    : `overrides.childMaterialBindings.${slot.ownerNodePath}.materialAssetId`;
}

function getEditorSceneSlotMaterialBinding(
  gameObject: EditorSceneGameObject,
  slot: EditorSceneChildMaterialSlot,
): SceneNodeMaterialBindingConfig | undefined {
  const slotBinding = slot.slotId ? gameObject.overrides?.materialSlotBindings?.[slot.slotId] : undefined;
  return slotBinding ?? gameObject.overrides?.childMaterialBindings?.[slot.ownerNodePath];
}

function getEditorSceneSlotLegacyMaterial(
  gameObject: EditorSceneGameObject,
  slot: EditorSceneChildMaterialSlot,
): MaterialOverrideConfig | undefined {
  return gameObject.overrides?.childMaterials?.[slot.ownerNodePath];
}

function getEditorSceneSlotSourceMaterialName(
  slot: EditorSceneChildMaterialSlot,
  sourceMaterialIndex: number,
): string | null {
  const indices = slot.sourceMaterialIndices ?? [];
  const names = slot.materialNames ?? [];
  const index = indices.findIndex(value => value === sourceMaterialIndex);
  const name = index >= 0 ? names[index] : sourceMaterialIndex === slot.sourceMaterialIndex ? slot.materialName : null;
  if (typeof name === 'string' && name.trim()) return name.trim();
  const sourceProfileName = getEditorSceneSlotSourceMaterialProfile(slot, sourceMaterialIndex)?.materialName;
  return typeof sourceProfileName === 'string' && sourceProfileName.trim() ? sourceProfileName.trim() : null;
}

function getEditorSceneSlotSourceMaterialProfile(
  slot: EditorSceneChildMaterialSlot,
  sourceMaterialIndex: number,
): EditorSceneSourceMaterialProfile | null {
  return slot.sourceMaterialProfiles?.find((profile) => profile.sourceMaterialIndex === sourceMaterialIndex) ?? null;
}

function ensureDefaultEditorSceneMaterialAssets(
  materialAssets: readonly SceneMaterialAssetConfig[],
): SceneMaterialAssetConfig[] {
  const defaults = [
    createDefaultPbrEditorSceneMaterialAsset(),
    createDefaultStandardEditorSceneMaterialAsset(),
  ];
  const defaultIds = new Set(defaults.map((materialAsset) => materialAsset.id));
  const nextAssets = [
    ...defaults,
    ...materialAssets.filter((materialAsset) => !defaultIds.has(materialAsset.id)),
  ];
  return JSON.stringify(nextAssets) === JSON.stringify(materialAssets)
    ? materialAssets as SceneMaterialAssetConfig[]
    : nextAssets;
}

function createDefaultPbrEditorSceneMaterialAsset(): SceneMaterialAssetConfig {
  return structuredClone(DEFAULT_PBR_MATERIAL_ASSET);
}

function createDefaultStandardEditorSceneMaterialAsset(): SceneMaterialAssetConfig {
  return structuredClone(DEFAULT_STANDARD_MATERIAL_ASSET);
}

function isDefaultEditorSceneMaterialAsset(materialAsset: SceneMaterialAssetConfig | null | undefined): boolean {
  return getDefaultEditorSceneMaterialPreset(materialAsset) != null;
}

function getDefaultEditorSceneMaterialPreset(
  materialAsset: SceneMaterialAssetConfig | null | undefined,
): 'default-pbr' | 'default-standard' | null {
  if (materialAsset?.system?.preset === 'default-pbr' || materialAsset?.id === DEFAULT_PBR_MATERIAL_ASSET_ID) {
    return 'default-pbr';
  }
  if (materialAsset?.system?.preset === 'default-standard' || materialAsset?.id === DEFAULT_STANDARD_MATERIAL_ASSET_ID) {
    return 'default-standard';
  }
  return null;
}

export function getEditorSceneHierarchyItems(document: EditorSceneDocument): SceneGraphTreeItem[] {
  const items = getPlayableEditorSceneHierarchyItems(document);
  const gameObjectsById = new Map(document.scene.gameObjects.map(gameObject => [gameObject.id, gameObject]));
  const result: SceneGraphTreeItem[] = [];
  for (const item of items) {
    result.push(item);
    const gameObject = gameObjectsById.get(item.id);
    if (!gameObject || readEditorSceneNodeKind(gameObject) === 'primitive') continue;
    const slots = collectEditorSceneChildMaterialSlots(document, gameObject);
    for (const [slotIndex, slot] of slots.entries()) {
      const assetMeshId = createEditorSceneAssetMeshSelectionId(gameObject.id, getEditorSceneSlotSelectionKey(slot));
      result.push({
        id: assetMeshId,
        label: slot.label || formatEditorSceneMaterialSlotLabel(
          slot.ownerNodePath,
          slotIndex,
          getArtistMaterialInspectorText(readArtistMaterialInspectorLanguage(gameObject)),
        ),
        parentId: gameObject.id,
        role: 'object',
        icon: 'material-slot',
        selectable: true,
        protected: false,
        canHaveChildren: false,
        renamable: false,
        deletable: false,
        draggable: false,
      });
    }
  }
  return result;
}

export function normalizeEditorSceneHierarchyDocument(document: EditorSceneDocument): EditorSceneDocument {
  return normalizePlayableEditorSceneHierarchyDocument(document) as EditorSceneDocument;
}

export function createEditorSceneBrowserAssetItems(document: EditorSceneDocument) {
  return [
    ...createPlayableEditorSceneMaterialBrowserAssetItems(document),
    ...document.assets
      .filter(isPlayableEditorScenePrefabAsset)
      .map(asset => ({
        id: `prefab:${asset.id}`,
        guid: asset.guid,
        assetId: asset.id,
        type: 'prefab' as const,
        kind: 'prefab' as const,
        label: asset.displayName ?? asset.id,
        displayName: asset.displayName ?? asset.id,
        category: asset.category ?? 'Prefab',
        meta: asset.prefab.sourceAssetId,
        origin: 'project' as const,
        placeable: true,
        prefab: {
          id: asset.id,
          name: asset.displayName ?? asset.id,
          sourceAssetId: asset.prefab.sourceAssetId,
          sourceAssetGuid: asset.prefab.sourceAssetGuid,
          ...(asset.prefab.defaults ? { defaults: structuredClone(asset.prefab.defaults) } : {}),
          ...(asset.prefab.overrides ? { overrides: structuredClone(asset.prefab.overrides) } : {}),
        },
      })),
  ];
}

export function createEditorSceneRenamePatch(
  document: EditorSceneDocument,
  intent: SceneGraphRenameIntent,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string } | null {
  return coerceEditorSceneHierarchyPatchResult(
    createPlayableEditorSceneRenamePatch(document, intent),
  ) as { patch: EditorSceneDocumentPatch; label: string; changedId: string } | null;
}

export function createEditorSceneCreateGroupPatch(
  document: EditorSceneDocument,
  intent: SceneGraphCreateGroupIntent,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string } | null {
  return coerceEditorSceneHierarchyPatchResult(
    createPlayableEditorSceneCreateGroupPatch(document, intent),
  ) as { patch: EditorSceneDocumentPatch; label: string; createdId: string } | null;
}

export function createEditorSceneCreatePrimitivePatch(
  document: EditorSceneDocument,
  intent: SceneGraphCreatePrimitiveIntent,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string; changedIds: string[] } | null {
  return coerceEditorSceneHierarchyPatchResult(
    createPlayableEditorSceneCreatePrimitivePatch(document, intent),
  ) as { patch: EditorSceneDocumentPatch; label: string; createdId: string; changedIds: string[] } | null;
}

export function createEditorSceneDeleteSubtreePatch(
  document: EditorSceneDocument,
  intent: SceneGraphDeleteIntent,
): { patch: EditorSceneDocumentPatch; label: string; deletedIds: string[]; fallbackSelectionId: string | null } | null {
  const deletedIds = collectEditorSceneSubtreeIdList(document, intent.ids);
  if (document.scene.gameObjects.some((gameObject) => deletedIds.includes(gameObject.id) && isEditorSceneProtectedSystemGameObject(gameObject))) {
    return null;
  }
  return coerceEditorSceneHierarchyPatchResult(
    createPlayableEditorSceneDeleteSubtreePatch(document, intent),
  ) as {
    patch: EditorSceneDocumentPatch;
    label: string;
    deletedIds: string[];
    fallbackSelectionId: string | null;
  } | null;
}

export function collectEditorSceneSubtreeIdList(document: EditorSceneDocument, rootIds: string[]): string[] {
  return collectPlayableEditorSceneSubtreeIdList(document, rootIds);
}

export function validateEditorSceneReparent(
  document: EditorSceneDocument,
  intent: SceneGraphDropIntent,
): SceneGraphValidationResult {
  const dragged = findEditorSceneGameObject(document, intent.draggedId);
  const target = findEditorSceneGameObject(document, intent.targetId);
  if (dragged && isEditorSceneProtectedSystemGameObject(dragged)) return { ok: false, reason: 'Protected system GameObject cannot be reparented.' };
  if (target && isEditorSceneProtectedSystemGameObject(target)) return { ok: false, reason: 'Protected system GameObject cannot have children.' };
  return validatePlayableEditorSceneReparent(document, intent);
}

export function createEditorSceneReparentPatch(
  document: EditorSceneDocument,
  intent: SceneGraphDropIntent,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  return coerceEditorSceneHierarchyPatchResult(
    createPlayableEditorSceneReparentPatch(document, intent),
  ) as { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null;
}

export function validateEditorSceneHierarchyMove(
  document: EditorSceneDocument,
  intent: SceneGraphMoveIntent,
): SceneGraphValidationResult {
  const hierarchy = getEditorSceneHierarchyItems(document);
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  if (ids.some((id) => isEditorSceneProtectedSystemGameObjectId(document, id))) {
    return { ok: false, reason: 'Protected system GameObject cannot be moved.' };
  }
  const parentId = resolveEditorSceneMoveParentId(document, intent);
  if (isEditorSceneProtectedSystemGameObjectId(document, parentId)) {
    return { ok: false, reason: 'Protected system GameObject cannot have children.' };
  }
  return validatePlayableEditorSceneHierarchyMove(document, intent);
}

export function createEditorSceneHierarchyMovePatch(
  document: EditorSceneDocument,
  intent: SceneGraphMoveIntent,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  return coerceEditorSceneHierarchyPatchResult(
    createPlayableEditorSceneHierarchyMovePatch(document, intent),
  ) as { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null;
}

function resolveEditorSceneMoveParentId(document: EditorSceneDocument, intent: SceneGraphMoveIntent): string | undefined {
  if (intent.placement === 'root') return resolveEditorSceneRootContainerId(document);
  if (intent.placement === 'inside' && intent.targetId) return intent.targetId;
  const target = intent.targetId ? findEditorSceneGameObject(document, intent.targetId) : null;
  return intent.parentId ?? target?.parentId ?? resolveEditorSceneRootContainerId(document);
}

export function validateEditorSceneGroupSelection(
  document: EditorSceneDocument,
  intent: SceneGraphGroupSelectionIntent,
): SceneGraphValidationResult {
  const hierarchy = getEditorSceneHierarchyItems(document);
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  if (ids.some((id) => isEditorSceneProtectedSystemGameObjectId(document, id))) {
    return { ok: false, reason: 'Protected system GameObject cannot be grouped.' };
  }
  const parentId = resolveEditorSceneGroupSelectionParentId(document, intent.parentId ?? null);
  if (isEditorSceneProtectedSystemGameObjectId(document, parentId)) {
    return { ok: false, reason: 'Protected system GameObject cannot have children.' };
  }
  return validatePlayableEditorSceneGroupSelection(document, intent);
}

export function createEditorSceneGroupSelectionPatch(
  document: EditorSceneDocument,
  intent: SceneGraphGroupSelectionIntent,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string; changedIds: string[] } | null {
  return coerceEditorSceneHierarchyPatchResult(
    createPlayableEditorSceneGroupSelectionPatch(document, intent),
  ) as { patch: EditorSceneDocumentPatch; label: string; createdId: string; changedIds: string[] } | null;
}

function resolveEditorSceneGroupSelectionParentId(document: EditorSceneDocument, parentId: string | null): string | undefined {
  const parent = parentId ? findEditorSceneGameObject(document, parentId) : null;
  return parent && canEditorSceneGameObjectHaveChildren(parent)
    ? parent.id
    : resolveEditorSceneRootContainerId(document);
}

export function createEditorSceneDuplicateSelectionPatch(input: {
  document: EditorSceneDocument;
  targetIds: string[];
  activeId: string | null;
}): { patch: EditorSceneDocumentPatch; label: string; createdIds: string[]; activeId: string | null; changedIds: string[] } | null {
  const targetIds = input.targetIds.filter((targetId) => {
    const source = findEditorSceneGameObject(input.document, targetId);
    return !!source && !isEditorSceneProtectedSystemGameObject(source);
  });
  return coerceEditorSceneHierarchyPatchResult(
    createPlayableEditorSceneDuplicateSelectionPatch({ ...input, targetIds }),
  ) as {
    patch: EditorSceneDocumentPatch;
    label: string;
    createdIds: string[];
    activeId: string | null;
    changedIds: string[];
  } | null;
}

export function createEditorScenePlacedAssetPatch(input: {
  document: EditorSceneDocument;
  asset: EditorSceneAssetLibraryItem;
  hit: EditorPlacementHit;
}): { patch: EditorSceneDocumentPatch; label: string; createdId: string; changedIds: string[] } {
  const result = createPlayableEditorSceneAssetPlacementPatch(input);
  return {
    ...result,
    patch: result.patch as EditorSceneDocumentPatch,
  };
}

export function getEditorSceneGameObjectWorldTransform(
  document: EditorSceneDocument,
  gameObjectId: string,
): EditorTransformSnapshot | null {
  return getPlayableEditorSceneGameObjectWorldTransform(document, gameObjectId);
}

export function toEditorSceneLocalTransformFromWorld(
  document: EditorSceneDocument,
  gameObjectId: string,
  worldTransform: EditorTransformSnapshot,
): EditorTransformSnapshot | null {
  return toPlayableEditorSceneLocalTransformFromWorld(document, gameObjectId, worldTransform);
}

export function createEditorScenePatchFromRuntimePatch(
  document: EditorSceneDocument,
  runtimePatch: RuntimePatch,
): { patch: EditorSceneDocumentPatch; label: string } | null {
  const sourceRef = getEditorSceneAuthoringSourceRef(document);
  const binding = runtimePatch.sourceBinding;
  if (!runtimePatch.applyable || !binding) return null;
  if (runtimePatch.applyTarget !== EDITOR_SCENE_SOURCE_TYPE) return null;
  if (binding.sourceId !== EDITOR_SCENE_SOURCE_ID || binding.sourceType !== EDITOR_SCENE_SOURCE_TYPE) return null;
  if (binding.sourceId !== sourceRef.sourceId || binding.sourceType !== sourceRef.sourceType) return null;
  const gameObjectId = binding.objectId;
  if (!gameObjectId || !document.scene.gameObjects.some((gameObject) => gameObject.id === gameObjectId)) return null;
  if (isEditorSceneRootGameObjectId(gameObjectId)) return null;
  const after = runtimePatch.after;
  if (!isEditorTransformSnapshot(after)) return null;
  return {
    label: runtimePatch.label ?? `Apply runtime transform ${gameObjectId}`,
    patch: {
      kind: 'game-object.transform',
      targetId: gameObjectId,
      transform: after,
    },
  };
}

export function getEditorSceneSerializedObject(
  document: EditorSceneDocument,
  gameObjectId: string,
): SerializedObject<EditorSceneDocument> | null {
  return createPlayableEditorSceneSerializedObject<EditorSceneDocument>({
    document,
    targetId: gameObjectId,
    validateField: validateEditorSceneSerializedPropertyField,
  });
}

export function getEditorSceneSerializedMultiObject(
  document: EditorSceneDocument,
  gameObjectIds: string[],
  activeId: string | null,
): SerializedMultiObject<EditorSceneDocument> | null {
  return createPlayableEditorSceneSerializedMultiObject<EditorSceneDocument>({
    document,
    targetIds: gameObjectIds,
    activeId,
  });
}

export function getEditorSceneInspectorObject(
  document: EditorSceneDocument,
  gameObjectId: string,
  context: EditorSceneInspectorContext = {},
): InspectorObject<EditorSceneDocument> | null {
  const assetMeshTarget = resolveEditorSceneAssetMeshSelectionTarget(document, gameObjectId);
  if (assetMeshTarget) {
    return createEditorSceneAssetMeshInspectorObject(document, assetMeshTarget, context);
  }
  const gameObject = findEditorSceneGameObject(document, gameObjectId);
  if (!gameObject) return null;
  return {
    targetIds: [gameObject.id],
    activeId: gameObject.id,
    label: gameObject.name ?? gameObject.id,
    document,
    selection: {
      targetIds: [gameObject.id],
      activeId: gameObject.id,
      targetKind: readEditorSceneNodeKind(gameObject),
      document,
    },
    sections: createEditorSceneInspectorSections(document, gameObject, context),
  };
}

export function getEditorSceneInspectorMultiObject(
  document: EditorSceneDocument,
  gameObjectIds: string[],
  activeId: string | null,
): InspectorObject<EditorSceneDocument> | null {
  return createPlayableEditorSceneSerializedMultiInspectorObject<EditorSceneDocument>({
    document,
    selectedIds: gameObjectIds,
    activeId,
  });
}

export interface EditorSceneInspectorPropertyPatchInput {
  document: EditorSceneDocument;
  targetId: string;
  path: string;
  value: unknown;
}

export interface EditorSceneAssetActionPatchInput {
  actionId: string;
  assetId?: string;
  browserAssetId?: string;
  assetKind?: string;
  asset?: EditorSceneAssetLibraryItem | null;
  activeId: string | null;
  selectedIds?: readonly string[];
  document: EditorSceneDocument;
  fieldPath?: string;
  value?: unknown;
}

export interface EditorSceneRuntimeInspectorContext {
  document: EditorSceneDocument;
  targetIds?: string[];
  activeId: string | null;
  projectionNode?: unknown | null;
  projectedRoot?: unknown;
}

export type EditorSceneInspectorSourceTag = PlayableEditorSceneInspectorSourceTag;

export interface EditorSceneReadonlyInspectorPropertyInput
  extends PlayableEditorSceneReadonlyInspectorPropertyInput<EditorSceneDocument> {}

export interface EditorSceneReadonlyInspectorSectionInput
  extends PlayableEditorSceneReadonlyInspectorSectionInput<EditorSceneDocument> {}

export function createEditorSceneReadonlyInspectorSection(
  input: EditorSceneReadonlyInspectorSectionInput,
): InspectorSection<EditorSceneDocument> | null {
  return createPlayableEditorSceneReadonlyInspectorSection<EditorSceneDocument>(input);
}

export function createEditorSceneReadonlyInspectorProperty(
  input: EditorSceneReadonlyInspectorPropertyInput,
): InspectorProperty<EditorSceneDocument> | null {
  return createPlayableEditorSceneReadonlyInspectorProperty<EditorSceneDocument>(input);
}

export function createEditorSceneReadonlyVector3Properties(input: {
  basePath: string;
  label: string;
  value: unknown;
  order?: number;
  persistence?: InspectorProperty<EditorSceneDocument>['persistence'];
  source?: EditorSceneInspectorSourceTag;
  tags?: readonly string[];
  effect?: InspectorProperty<EditorSceneDocument>['effect'];
  disabledReason?: string;
}): InspectorProperty<EditorSceneDocument>[] {
  return createPlayableEditorSceneReadonlyVector3Properties<EditorSceneDocument>(input);
}

export function readEditorSceneInspectorVec3(value: unknown): EditorSceneVec3 | null {
  return readPlayableEditorSceneInspectorVec3(value);
}

export function readEditorSceneRuntimeValue(value: unknown, key: string): unknown {
  return readPlayableEditorSceneRuntimeValue(value, key);
}

export function readEditorSceneRuntimeString(value: unknown, key: string): string | null {
  return readPlayableEditorSceneRuntimeString(value, key);
}

export function readEditorSceneRuntimeNumber(value: unknown, key: string): number | null {
  return readPlayableEditorSceneRuntimeNumber(value, key);
}

export function readEditorSceneRuntimeBoolean(value: unknown, key: string): boolean | null {
  return readPlayableEditorSceneRuntimeBoolean(value, key);
}

export function callEditorSceneRuntimeMethod(value: unknown, key: string, args: readonly unknown[] = []): unknown {
  return callPlayableEditorSceneRuntimeMethod(value, key, args);
}

export function readEditorSceneRuntimeClassName(value: unknown): string | null {
  return readPlayableEditorSceneRuntimeClassName(value);
}

export function describeEditorSceneRuntimeObject(value: unknown): string | null {
  return describePlayableEditorSceneRuntimeObject(value);
}

export function toEditorSceneInspectorSafeValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  return toPlayableEditorSceneInspectorSafeValue(value, seen, depth);
}

export function getEditorSceneRuntimeInspectorSections(
  context: EditorSceneRuntimeInspectorContext,
): InspectorSection<EditorSceneDocument>[] {
  if (!context.activeId) return [];
  const gameObject = findEditorSceneGameObject(context.document, context.activeId);
  if (!gameObject) return [];
  if (context.targetIds && context.targetIds.length !== 1) return [];
  const renderer = findEditorSceneModelRenderer(gameObject);
  const runtime = createEditorSceneRuntimeInspectorSnapshot(context);
  const sourceRef = getEditorSceneAuthoringSourceRef(context.document);
  return createPlayableEditorSceneRuntimeInspectorSections<EditorSceneDocument>({
    runtime,
    binding: {
      sourceId: sourceRef.sourceId,
      sourceType: sourceRef.sourceType,
      objectId: gameObject.id,
      component: renderer ? 'ModelRenderer' : readEditorSceneNodeKind(gameObject) === 'transform' ? 'Transform' : 'GameObject',
      projectionNodeId: readEditorSceneRuntimeString(context.projectionNode, 'id') ?? null,
      projectionName: readEditorSceneRuntimeString(context.projectionNode, 'name') ?? null,
      projectionParentId: readEditorSceneRuntimeString(context.projectionNode, 'parentId') ?? null,
      projectionAssetId: readProjectionAssetId(context.projectionNode),
    },
    projectionAssetMetadata: readProjectionAssetMetadata(context.projectionNode),
  });
}

type EditorSceneRuntimeInspectorSnapshot = PlayableEditorSceneRuntimeInspectorSnapshot;

function createEditorSceneRuntimeInspectorSnapshot(
  context: EditorSceneRuntimeInspectorContext,
): EditorSceneRuntimeInspectorSnapshot {
  return createPlayableEditorSceneRuntimeInspectorSnapshot({
    projectedRoot: context.projectedRoot,
    projectionNode: context.projectionNode ?? null,
  });
}

function readProjectionAssetId(projectionNode: unknown): string | null {
  const asset = readEditorSceneRuntimeValue(projectionNode, 'asset');
  return readEditorSceneRuntimeString(asset, 'assetId') ?? readEditorSceneRuntimeString(asset, 'id');
}

function readProjectionAssetMetadata(projectionNode: unknown): unknown {
  return readEditorSceneRuntimeValue(readEditorSceneRuntimeValue(projectionNode, 'asset'), 'metadata');
}
export function createEditorSceneInspectorPropertyPatch(
  input: EditorSceneInspectorPropertyPatchInput,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[]; reprojectIds?: string[] } | null {
  const assetMeshTarget = resolveEditorSceneAssetMeshSelectionTarget(input.document, input.targetId);
  const gameObject = assetMeshTarget?.gameObject ?? findEditorSceneGameObject(input.document, input.targetId);
  if (!gameObject) return null;
  const path = input.path;
  const value = normalizeEditorSceneInspectorValue(path, input.value);
  const targetId = gameObject.id;
  if (path === CREATE_CHILD_MATERIAL_SLOT_PATH) {
    return createEditorSceneCreateChildMaterialSlotPatch(gameObject, value);
  }
  const duplicateMaterialAssetId = parseDuplicateMaterialAssetValue(value);
  if (duplicateMaterialAssetId && isEditorSceneMaterialBindingPath(path)) {
    return createEditorSceneDuplicateMaterialAssetForBindingPatch(input.document, gameObject, path, duplicateMaterialAssetId);
  }
  const materialAssetFieldPath = parseEditorSceneMaterialAssetFieldPath(path);
  if (materialAssetFieldPath) {
    const normalizedMaterialAssetValue = normalizeEditorSceneMaterialAssetValue(materialAssetFieldPath.fieldPath, value);
    if (!input.document.scene.materialAssets?.some(materialAsset => materialAsset.id === materialAssetFieldPath.materialAssetId)) return null;
    if (!validateEditorSceneMaterialAssetFieldValue(materialAssetFieldPath.fieldPath, normalizedMaterialAssetValue)) return null;
    const changedIds = collectEditorSceneMaterialAssetBindingIds(input.document, materialAssetFieldPath.materialAssetId);
    if (!changedIds.includes(targetId)) changedIds.push(targetId);
    return {
      label: `Patch material asset ${materialAssetFieldPath.materialAssetId} ${materialAssetFieldPath.fieldPath}`,
      patch: {
        kind: 'scene.material-asset.field',
        materialAssetId: materialAssetFieldPath.materialAssetId,
        path: materialAssetFieldPath.fieldPath,
        value: normalizedMaterialAssetValue,
      },
      changedId: targetId,
      changedIds,
      ...(materialAssetFieldPath.fieldPath.startsWith('profile.') ? { reprojectIds: changedIds } : {}),
    };
  }
  if (assetMeshTarget && !isEditorSceneAssetMeshWritablePath(path)) return null;
  if (isEditorSceneRootTransformPath(targetId, path)) return null;
  if (!validateEditorSceneInspectorValue(input.document, gameObject, path, value).ok) return null;
  if (isBlockedEditorSceneSystemFieldPatch(input.document, targetId, path, value)) return null;
  const changedIds = path.startsWith('transform.')
    ? collectEditorSceneSubtreeIdList(input.document, [targetId])
    : [targetId];
  const reprojectIds = isEditorSceneProjectionShapePath(path) || isEditorSceneArtistMaterialPatchPath(path)
    ? [targetId]
    : undefined;
  return {
    label: `Patch ${targetId} ${path}`,
    patch: {
      kind: 'game-object.field',
      targetId,
      path,
      value,
    },
    changedId: targetId,
    changedIds,
    ...(reprojectIds ? { reprojectIds } : {}),
  };
}

export function canCreateEditorSceneSerializedMultiPropertyPatch(
  input: PlayableLocalEditorMultiPropertyCapabilityInput<EditorSceneDocument>,
): boolean {
  if (isEditorSceneSerializedMultiTransformPatchPath(input.path)) return input.targetIds.length > 0;
  if (!EDITOR_SCENE_SERIALIZED_MULTI_FIELD_PATCH_PATHS.has(input.path)) return false;
  return collectEditorSceneSerializedMultiFieldPatchTargetIds(
    input.document,
    input.targetIds,
    input.path,
  ).length > 0;
}

export function createEditorSceneSerializedMultiPropertyPatch(
  input: PlayableLocalEditorMultiPropertyPatchInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[]; reprojectIds?: string[] } | null {
  if (!canCreateEditorSceneSerializedMultiPropertyPatch(input)) return null;
  const targetIds = collectEditorSceneSerializedMultiFieldPatchTargetIds(
    input.document,
    input.targetIds,
    input.path,
  );
  if (targetIds.length === 0) return null;
  if (targetIds.some((targetId) => !createEditorSceneInspectorPropertyPatch({
    document: input.document,
    targetId,
    path: input.path,
    value: input.value,
  }))) return null;
  if (isEditorSceneSerializedMultiTransformPatchPath(input.path)) {
    const result = createPlayableEditorSceneSerializedMultiTransformPatch({
      document: input.document,
      targetIds,
      path: input.path,
      value: input.value,
    });
    if (!result) return null;
    return {
      ...result,
      patch: result.patch as EditorSceneDocumentPatch,
    };
  }

  const value = normalizeEditorSceneInspectorValue(input.path, input.value);
  return {
    label: `Patch ${input.path} on ${targetIds.length} objects`,
    patch: createPlayableEditorSceneGameObjectsFieldPatch({
      targetIds,
      path: input.path,
      value,
    }) as EditorSceneDocumentPatch,
    changedIds: targetIds,
  };
}

function isEditorSceneSerializedMultiTransformPatchPath(path: string): boolean {
  return /^transform\.(position|rotation|scale)\.(x|y|z)$/.test(path);
}

function collectEditorSceneSerializedMultiFieldPatchTargetIds(
  document: EditorSceneDocument,
  targetIds: readonly string[],
  path: string,
): string[] {
  const uniqueTargetIds = Array.from(new Set(targetIds.filter(Boolean)));
  if (path === 'shadowMode' || path === PLAYABLE_EDITOR_SCENE_SHADOW_INSPECTOR_LANGUAGE_PATH) {
    return uniqueTargetIds.filter((targetId) => {
      const gameObject = findEditorSceneGameObject(document, targetId);
      return !!gameObject && canEditEditorSceneSerializedMultiShadowTarget(gameObject);
    });
  }
  return uniqueTargetIds;
}

function canEditEditorSceneSerializedMultiShadowTarget(gameObject: EditorSceneGameObject): boolean {
  if (isEditorSceneRootGameObject(gameObject)) return false;
  if (isEditorSceneCameraGameObject(gameObject) || isEditorSceneLightGameObject(gameObject)) return false;
  const nodeKind = readEditorSceneNodeKind(gameObject);
  return nodeKind === 'instance' || nodeKind === 'primitive' || nodeKind === 'transform';
}

export function createEditorSceneAssetActionPatch(
  input: EditorSceneAssetActionPatchInput,
): { patch: EditorSceneDocumentPatch; label: string; changedId?: string; createdId?: string; changedIds?: string[]; reprojectIds?: string[] } | null {
  if (input.actionId === 'asset.create-material') {
    const materialAsset = createEditorSceneCreatedMaterialAsset(
      input.document,
      typeof input.value === 'string' ? input.value : undefined,
    );
    return {
      label: `Create material ${materialAsset.name ?? materialAsset.id}`,
      patch: {
        kind: 'scene.material-asset.create',
        materialAsset,
      },
      createdId: materialAsset.id,
    };
  }
  if (input.actionId === 'asset.duplicate-material') {
    if (!input.assetId) return null;
    const sourceMaterialAsset = findEditorSceneMaterialAsset(input.document, input.assetId);
    if (!sourceMaterialAsset) return null;
    const materialAsset = createEditorSceneDuplicatedMaterialAssetCopy(input.document, sourceMaterialAsset);
    return {
      label: `Duplicate material ${sourceMaterialAsset.name ?? sourceMaterialAsset.id}`,
      patch: {
        kind: 'scene.material-asset.create',
        materialAsset,
      },
      createdId: materialAsset.id,
    };
  }
  if (input.actionId === 'asset.delete-material') {
    if (!input.assetId) return null;
    const deleteState = resolveEditorSceneMaterialAssetDeleteState(input.document, input.assetId);
    if (!deleteState.ok) return null;
    return {
      label: `Delete material ${deleteState.materialAsset.name ?? deleteState.materialAsset.id}`,
      patch: {
        kind: 'scene.material-asset.delete',
        materialAssetId: input.assetId,
      },
    };
  }
  if (input.actionId === 'asset.apply-material') {
    if (!input.assetId) return null;
    if (!input.activeId) return null;
    const assetMeshTarget = resolveEditorSceneAssetMeshSelectionTarget(input.document, input.activeId);
    if (assetMeshTarget) {
      return {
        label: `Apply material ${input.assetId} to ${assetMeshTarget.label}`,
        patch: {
          kind: 'game-object.field',
          targetId: assetMeshTarget.rootGameObjectId,
          path: assetMeshTarget.materialBindingPath,
          value: input.assetId,
        },
        changedId: assetMeshTarget.rootGameObjectId,
        changedIds: [assetMeshTarget.rootGameObjectId],
        reprojectIds: [assetMeshTarget.rootGameObjectId],
      };
    }
    return {
      label: `Apply material ${input.assetId}`,
      patch: {
        kind: 'game-object.field',
        targetId: input.activeId,
        path: 'overrides.materialBinding.materialAssetId',
        value: input.assetId,
      },
      changedId: input.activeId,
      changedIds: [input.activeId],
      reprojectIds: [input.activeId],
    };
  }
  if (input.actionId === 'asset.create-prefab') {
    return createEditorSceneCreatePrefabAssetPatch(input);
  }
  if (input.actionId === 'asset.create-prefab-from-game-object') {
    return createEditorSceneCreatePrefabAssetFromGameObjectPatch(input);
  }
  if (input.actionId === 'asset.duplicate-prefab') {
    return createEditorSceneDuplicatePrefabAssetPatch(input);
  }
  if (input.actionId === 'asset.edit-prefab-field') {
    return createEditorSceneEditPrefabAssetFieldPatch(input);
  }
  if (input.actionId !== 'asset.edit-material-field') return null;
  if (!input.assetId) return null;
  const materialAsset = findEditorSceneMaterialAsset(input.document, input.assetId);
  if (!materialAsset || isReadonlyEditorSceneMaterialAsset(materialAsset)) return null;
  const fieldPath = typeof input.fieldPath === 'string' ? input.fieldPath.trim() : '';
  if (fieldPath !== 'name' && !fieldPath.startsWith('profile.')) return null;
  const normalizedValue = normalizeEditorSceneMaterialAssetValue(fieldPath, input.value);
  if (!validateEditorSceneMaterialAssetFieldValue(fieldPath, normalizedValue)) return null;
  const changedIds = collectEditorSceneMaterialAssetBindingIds(input.document, input.assetId);
  const reprojectIds = fieldPath.startsWith('profile.') ? changedIds : undefined;
  return {
    label: `Edit material ${materialAsset.name} ${fieldPath}`,
    patch: {
      kind: 'scene.material-asset.field',
      materialAssetId: input.assetId,
      path: fieldPath,
      value: normalizedValue,
    },
    changedId: input.activeId ?? changedIds[0],
    changedIds,
    ...(reprojectIds ? { reprojectIds } : {}),
  };
}

function createEditorSceneCreatePrefabAssetPatch(
  input: EditorSceneAssetActionPatchInput,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string } | null {
  const source = resolveEditorScenePrefabSourceAssetForAction(input);
  if (!source) return null;
  if (findEditorScenePrefabAssetForSource(input.document, source.asset)) return null;

  const prefabAsset = createPlayableEditorScenePrefabDefinitionFromAsset(source.asset, {
    id: createEditorScenePrefabAssetId(input.document, source.asset),
    guid: createEditorScenePrefabAssetGuid(),
    displayName: createEditorScenePrefabAssetDisplayName(source.asset),
    metadata: {
      sourceAssetId: source.asset.id,
    },
  }) as EditorSceneAsset;

  return {
    label: `Create prefab ${prefabAsset.displayName ?? prefabAsset.id}`,
    patch: {
      kind: 'scene.prefab-asset.create',
      ...(source.shouldAddSourceAsset ? { sourceAsset: source.asset } : {}),
      prefabAsset,
    },
    createdId: prefabAsset.id,
  };
}

function createEditorSceneCreatePrefabAssetFromGameObjectPatch(
  input: EditorSceneAssetActionPatchInput,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string; changedId: string } | null {
  const gameObjectId = readNonEmptyEditorSceneString(input.activeId);
  if (!gameObjectId) return null;
  const prefabAsset = createPlayableEditorScenePrefabDefinitionFromGameObject(input.document, gameObjectId, {
    guid: createEditorScenePrefabAssetGuid(),
    metadata: {
      sourceGameObjectId: gameObjectId,
    },
  }) as EditorSceneAsset | null;
  if (!prefabAsset) return null;
  if (findEditorScenePrefabAssetForSource(input.document, prefabAsset)) return null;

  return {
    label: `Create prefab ${prefabAsset.displayName ?? prefabAsset.id} from ${gameObjectId}`,
    patch: {
      kind: 'scene.prefab-asset.create-from-game-object',
      prefabAsset,
      sourceGameObjectId: gameObjectId,
    },
    createdId: prefabAsset.id,
    changedId: gameObjectId,
  };
}

function createEditorSceneDuplicatePrefabAssetPatch(
  input: EditorSceneAssetActionPatchInput,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string } | null {
  const prefabAssetId = readNonEmptyEditorSceneString(input.assetId);
  if (!prefabAssetId) return null;
  const sourcePrefabAsset = findEditorScenePrefabAsset(input.document, prefabAssetId);
  if (!sourcePrefabAsset) return null;
  const prefabAsset = createPlayableEditorSceneDuplicatedPrefabDefinition(input.document, sourcePrefabAsset.id, {
    guid: createEditorScenePrefabAssetGuid(),
    metadata: {
      sourcePrefabAssetId: sourcePrefabAsset.id,
    },
  }) as EditorSceneAsset | null;
  if (!prefabAsset) return null;

  return {
    label: `Duplicate prefab ${sourcePrefabAsset.displayName ?? sourcePrefabAsset.id}`,
    patch: {
      kind: 'scene.prefab-asset.duplicate',
      prefabAsset,
      sourcePrefabAssetId: sourcePrefabAsset.id,
    },
    createdId: prefabAsset.id,
  };
}

function createEditorSceneEditPrefabAssetFieldPatch(
  input: EditorSceneAssetActionPatchInput,
): { patch: EditorSceneDocumentPatch; label: string; changedId?: string; createdId?: string } | null {
  const assetId = readNonEmptyEditorSceneString(input.assetId);
  if (!assetId) return null;
  const prefabAsset = findEditorScenePrefabAsset(input.document, assetId);
  if (!prefabAsset) return null;
  const fieldPath = readNonEmptyEditorSceneString(input.fieldPath);
  if (!fieldPath) return null;
  const duplicateMaterialAssetId = parseDuplicateMaterialAssetValue(input.value);
  if (duplicateMaterialAssetId) {
    return createEditorSceneDuplicateMaterialAssetForPrefabBindingPatch(
      input.document,
      prefabAsset,
      fieldPath,
      duplicateMaterialAssetId,
    );
  }
  const normalizedValue = normalizeEditorScenePrefabAssetFieldValue(fieldPath, input.value);
  if (normalizedValue === INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE) return null;
  return {
    label: `Edit prefab ${prefabAsset.displayName ?? prefabAsset.id} ${fieldPath}`,
    patch: {
      kind: 'scene.prefab-asset.field',
      assetId: prefabAsset.id,
      path: fieldPath,
      value: normalizedValue,
    },
    changedId: input.activeId ?? undefined,
  };
}

function createEditorSceneCreateChildMaterialSlotPatch(
  gameObject: EditorSceneGameObject,
  value: unknown,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[]; reprojectIds?: string[] } | null {
  if (typeof value !== 'string') return null;
  const ownerNodePath = value.trim().replace(/^\/+|\/+$/g, '');
  if (!ownerNodePath) return null;
  const bindingPath = `overrides.childMaterialBindings.${ownerNodePath}.materialAssetId`;
  if (!resolveSceneNodeFieldSchema(bindingPath, readEditorSceneNodeKind(gameObject))) return null;
  return {
    label: `Bind default material slot ${ownerNodePath}`,
    patch: {
      kind: 'game-object.field',
      targetId: gameObject.id,
      path: bindingPath,
      value: DEFAULT_ARTIST_MATERIAL_ASSET_ID,
    },
    changedId: gameObject.id,
    changedIds: [gameObject.id],
    reprojectIds: [gameObject.id],
  };
}

function createEditorSceneDuplicateMaterialAssetForBindingPatch(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  bindingPath: string,
  sourceMaterialAssetId: string,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[]; reprojectIds?: string[] } | null {
  const result = createPlayableEditorSceneDuplicateMaterialAssetForBindingPatch({
    document,
    gameObject,
    bindingPath,
    sourceMaterialAssetId,
    isBindingPathAllowed: path => isEditorSceneMaterialBindingPath(path)
      && (
        !!resolveSceneNodeFieldSchema(path, readEditorSceneNodeKind(gameObject))
        || path.startsWith('overrides.materialSlotBindings.')
        || path.startsWith('overrides.childMaterialBindings.')
      ),
  });
  if (!result) return null;
  const sourceMaterialAsset = findEditorSceneMaterialAsset(document, sourceMaterialAssetId);
  return {
    label: `Duplicate material ${sourceMaterialAsset?.name ?? sourceMaterialAssetId} for ${gameObject.name ?? gameObject.id}`,
    patch: result.patch as EditorSceneDocumentPatch,
    changedId: result.changedId,
    changedIds: result.changedIds,
    reprojectIds: result.reprojectIds,
  };
}

function createEditorSceneDuplicateMaterialAssetForPrefabBindingPatch(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset,
  bindingPath: string,
  sourceMaterialAssetId: string,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; createdId: string } | null {
  const materialPath = readPlayableEditorScenePrefabOverrideMaterialPath(bindingPath);
  if (!materialPath || !isEditorSceneMaterialBindingPath(materialPath)) return null;
  const sourceMaterialAsset = findEditorSceneMaterialAsset(document, sourceMaterialAssetId);
  if (!sourceMaterialAsset) return null;
  const prefabName = prefabAsset.displayName ?? prefabAsset.id;
  const sourceName = sourceMaterialAsset.name ?? sourceMaterialAsset.id;
  const materialAsset = createEditorSceneDuplicatedMaterialAssetCopy(
    document,
    sourceMaterialAsset,
    `${prefabName} - ${sourceName}`,
  );
  return {
    label: `Duplicate material ${sourceName} for prefab ${prefabName}`,
    patch: {
      kind: 'scene.prefab-material-asset.duplicate-and-bind',
      assetId: prefabAsset.id,
      bindingPath,
      materialAsset,
    },
    changedId: prefabAsset.id,
    createdId: materialAsset.id,
  };
}

function collectEditorSceneMaterialAssetBindingIds(
  document: EditorSceneDocument,
  materialAssetId: string,
): string[] {
  return collectPlayableEditorSceneMaterialAssetBindingIds(document, materialAssetId);
}

function isEditorTransformSnapshot(value: unknown): value is EditorTransformSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EditorTransformSnapshot>;
  return isVec3(candidate.position) && isVec3(candidate.rotation) && isVec3(candidate.scale);
}

function findEditorSceneGameObject(
  document: EditorSceneDocument,
  gameObjectId: string,
): EditorSceneGameObject | null {
  return document.scene.gameObjects.find((gameObject) => gameObject.id === gameObjectId) ?? null;
}

type EditorSceneAssetMeshSelectionTarget = {
  id: string;
  rootGameObjectId: string;
  slotSelectionKey: string;
  slotId?: string;
  ownerNodePath: string;
  materialBindingPath: string;
  label: string;
  gameObject: EditorSceneGameObject;
  slot: EditorSceneChildMaterialSlot;
};

function createEditorSceneAssetMeshSelectionId(
  rootGameObjectId: string,
  slotSelectionKey: string,
): string {
  return `${rootGameObjectId}${ASSET_MESH_SELECTION_SEPARATOR}${encodeURIComponent(slotSelectionKey)}`;
}

function parseEditorSceneAssetMeshSelectionId(value: string): { rootGameObjectId: string; slotSelectionKey: string } | null {
  const separatorIndex = value.indexOf(ASSET_MESH_SELECTION_SEPARATOR);
  if (separatorIndex < 0) return null;
  const rootGameObjectId = value.slice(0, separatorIndex);
  const encodedSlotSelectionKey = value.slice(separatorIndex + ASSET_MESH_SELECTION_SEPARATOR.length);
  if (!rootGameObjectId || !encodedSlotSelectionKey) return null;
  try {
    const slotSelectionKey = decodeURIComponent(encodedSlotSelectionKey).trim().replace(/^\/+|\/+$/g, '');
    return slotSelectionKey ? { rootGameObjectId, slotSelectionKey } : null;
  } catch {
    return null;
  }
}

function resolveEditorSceneAssetMeshSelectionTarget(
  document: EditorSceneDocument,
  id: string,
): EditorSceneAssetMeshSelectionTarget | null {
  const parsed = parseEditorSceneAssetMeshSelectionId(id);
  if (!parsed) return null;
  const gameObject = findEditorSceneGameObject(document, parsed.rootGameObjectId);
  if (!gameObject) return null;
  const slots = collectEditorSceneChildMaterialSlots(document, gameObject);
  const slot = slots.find(candidate => getEditorSceneSlotSelectionKey(candidate) === parsed.slotSelectionKey)
    ?? slots.find(candidate => candidate.ownerNodePath === parsed.slotSelectionKey)
    ?? null;
  if (!slot) return null;
  const slotIndex = Math.max(0, slots.indexOf(slot));
  const text = getArtistMaterialInspectorText(readArtistMaterialInspectorLanguage(gameObject));
  const label = slot.label || formatEditorSceneMaterialSlotLabel(slot.ownerNodePath, slotIndex, text);
  return {
    id,
    rootGameObjectId: parsed.rootGameObjectId,
    slotSelectionKey: parsed.slotSelectionKey,
    ...(slot.slotId ? { slotId: slot.slotId } : {}),
    ownerNodePath: slot.ownerNodePath,
    materialBindingPath: getEditorSceneSlotMaterialBindingPath(slot),
    label,
    gameObject,
    slot,
  };
}

function isEditorSceneAssetMeshWritablePath(path: string): boolean {
  return path.startsWith('overrides.materialSlotBindings.')
    || path.startsWith('overrides.childMaterialBindings.')
    || parseEditorSceneMaterialAssetFieldPath(path) != null;
}

function createEditorSceneAssetMeshInspectorObject(
  document: EditorSceneDocument,
  target: EditorSceneAssetMeshSelectionTarget,
  context: EditorSceneInspectorContext,
): InspectorObject<EditorSceneDocument> {
  return {
    targetIds: [target.id],
    activeId: target.id,
    label: target.label,
    document,
    selection: {
      targetIds: [target.id],
      activeId: target.id,
      targetKind: 'assetMesh',
      document,
      capabilities: ['material'],
    },
    sections: createEditorSceneAssetMeshInspectorSections(document, target, context),
  };
}

function resolveEditorSceneRootContainerId(document: EditorSceneDocument): string | undefined {
  return document.scene.gameObjects.find((gameObject) => gameObject.id === EDITOR_SCENE_ROOT_ID && canEditorSceneGameObjectHaveChildren(gameObject))?.id
    ?? document.scene.gameObjects.find((gameObject) => !gameObject.parentId && canEditorSceneGameObjectHaveChildren(gameObject))?.id;
}

function toLocalTransformForParent(
  document: EditorSceneDocument,
  parentId: string | undefined,
  world: EditorTransformSnapshot,
): EditorTransformSnapshot | null {
  const parentWorld = parentId ? getEditorSceneGameObjectWorldTransform(document, parentId) : createIdentityEditorTransform();
  return parentWorld ? toLocalTransformFromParentWorld(parentWorld, world) : null;
}

function toLocalTransformFromParentWorld(
  parentWorld: EditorTransformSnapshot,
  world: EditorTransformSnapshot,
): EditorTransformSnapshot | null {
  return toEditorLocalTransformFromWorld(parentWorld, world);
}

function readRawGameObjectLocalTransform(gameObject: EditorSceneGameObject): EditorTransformSnapshot {
  const transform = findEditorSceneTransform(gameObject);
  if (!transform) return identityTransform();
  return {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...readTransformVector(transform, 'scale') },
  };
}

function identityTransform(): EditorTransformSnapshot {
  return createIdentityEditorTransform();
}

function isIdentityEditorTransform(transform: EditorTransformSnapshot): boolean {
  return transformsEqual(transform, EDITOR_SCENE_ROOT_TRANSFORM);
}

function transformsEqual(left: EditorTransformSnapshot, right: EditorTransformSnapshot): boolean {
  return vectorsEqual(left.position, right.position)
    && vectorsEqual(left.rotation, right.rotation)
    && vectorsEqual(left.scale, right.scale);
}

function vectorsEqual(left: EditorSceneVec3, right: EditorSceneVec3): boolean {
  return Math.abs(left.x - right.x) < 0.000001
    && Math.abs(left.y - right.y) < 0.000001
    && Math.abs(left.z - right.z) < 0.000001;
}

function isVec3(value: unknown): value is EditorSceneVec3 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EditorSceneVec3>;
  return typeof candidate.x === 'number'
    && Number.isFinite(candidate.x)
    && typeof candidate.y === 'number'
    && Number.isFinite(candidate.y)
    && typeof candidate.z === 'number'
    && Number.isFinite(candidate.z);
}

function createEditorSceneInspectorSections(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  context: EditorSceneInspectorContext = {},
): InspectorSection<EditorSceneDocument>[] {
  const nodeKind = readEditorSceneNodeKind(gameObject);
  const sections = createPlayableEditorSceneDocumentInspectorSections<EditorSceneDocument, EditorSceneGameObject, SceneNodeConfig['kind']>({
    document,
    gameObject,
    nodeKind,
    extraValidators: PROJECT_EDITOR_SCENE_INSPECTOR_EXTRA_VALIDATORS,
    rootTransform: EDITOR_SCENE_ROOT_TRANSFORM,
    renderingProfile: getActiveRenderingProfile(),
  });
  if (nodeKind === 'transform' && (gameObject.transformType === 'groundDecal' || gameObject.groundDecal)) {
    sections.push({
      id: 'groundDecal',
      title: 'Ground Decal',
      order: 40,
      placement: 'body',
      summary: gameObject.groundDecal ? 'Configured' : 'Defaults',
      persistence: 'document',
      collapsedByDefault: true,
      properties: createGroundDecalInspectorProperties(nodeKind, gameObject.groundDecal),
    });
  }
  if (nodeKind === 'transform' && isEditorSceneCameraGameObject(gameObject)) {
    const cameraRig = mergeEditorSceneCameraDefaults(gameObject.camera);
    const cameraText = getCameraInspectorText(cameraRig.inspectorLanguage ?? 'zh');
    sections.push({
      id: 'camera',
      title: cameraText.title,
      order: 42,
      placement: 'body',
      summary: cameraRig.projection === 'perspective' ? cameraText.summaryPerspective : cameraText.summaryOrthographic,
      persistence: 'document',
      collapsedByDefault: false,
      properties: createCameraInspectorProperties(nodeKind, gameObject.camera),
    });
  }
  if (nodeKind === 'transform' && isEditorSceneLightGameObject(gameObject)) {
    const light = mergeEditorSceneLightDefaults(
      gameObject.light,
      gameObject.id === EDITOR_SCENE_ENVIRONMENT_LIGHT_ID ? 'hemispheric' : 'directional',
    );
    const lightText = getLightInspectorText(getLightInspectorLanguage(light));
    sections.push({
      id: 'light',
      title: light.type === 'hemispheric' ? lightText.hemisphericTitle : lightText.directionalTitle,
      order: 44,
      placement: 'body',
      summary: light.type === 'hemispheric' ? lightText.hemisphericSummary : lightText.directionalSummary,
      persistence: 'document',
      collapsedByDefault: false,
      properties: createLightInspectorProperties(nodeKind, light),
    });
    if (light.type === 'directional') {
      const shadowSummarySection = createDirectionalLightShadowSummaryInspectorSection(light, lightText);
      if (shadowSummarySection) sections.push(shadowSummarySection);
    }
  }
  const prefabInstanceSection = createEditorScenePrefabInstanceInspectorSection(document, gameObject);
  if (prefabInstanceSection) sections.push(prefabInstanceSection);
  if (nodeKind === 'instance' || nodeKind === 'primitive' || (nodeKind === 'transform' && !isEditorSceneCameraGameObject(gameObject) && !isEditorSceneLightGameObject(gameObject))) {
    sections.push(...createArtistMaterialInspectorSections(document, gameObject, nodeKind, context));
    const outlineEffect = gameObject.overrides?.outline ? 'active' : 'default';
    const outlineDisabledReason = outlineEffect === 'default' ? OUTLINE_DEFAULT_DISABLED_REASON : undefined;
    const outlinePersistence = outlineEffect === 'default' ? 'readonly' : 'document';
    sections.push({
      id: 'outline',
      title: 'Outline',
      order: 60,
      placement: 'body',
      summary: gameObject.overrides?.outline ? 'Configured' : 'Defaults',
      persistence: outlinePersistence,
      effect: outlineEffect,
      disabledReason: outlineDisabledReason,
      collapsedByDefault: true,
      properties: markInspectorPropertiesEffect(
        createOutlineInspectorProperties(nodeKind, gameObject.overrides?.outline),
        outlineEffect,
        outlineDisabledReason,
      ),
    });
  }
  return sections.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}

function createEditorScenePrefabInstanceInspectorSection(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): InspectorSection<EditorSceneDocument> | null {
  const relation = resolvePlayableEditorScenePrefabInstanceRelation(document, gameObject.id);
  if (!relation.prefab) return null;
  const diagnostics = relation.diagnostics;
  const severity = resolveEditorScenePrefabRelationSeverity(diagnostics);
  const definitionLabel = relation.definition?.displayName ?? relation.definition?.id ?? relation.prefab.prefabId;
  const sourceAssetId = relation.sourceAsset?.id
    ?? relation.prefab.sourceAssetId
    ?? resolvePlayableEditorScenePrefabSourceAssetId(relation.definition ?? undefined)
    ?? '';
  const sourceLabel = relation.sourceAsset?.displayName ?? (sourceAssetId || 'Missing source asset');
  const status = formatEditorScenePrefabRelationStatus(diagnostics);
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.relation.status',
    label: 'Status',
    value: status,
    order: 0,
    source: 'Derived',
    effect: severity === 'error' ? 'unsupported' : 'derived',
    disabledReason: severity === 'ok' ? undefined : formatEditorScenePrefabRelationDiagnostics(diagnostics),
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.relation.definition',
    label: 'Prefab Definition',
    value: definitionLabel,
    order: 1,
    source: 'Document',
    effect: relation.definition ? 'derived' : 'unsupported',
    disabledReason: relation.definition ? relation.prefab.prefabId : `Missing prefab definition: ${relation.prefab.prefabId}`,
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.relation.source',
    label: 'Source Model',
    value: sourceLabel,
    order: 2,
    source: 'Document',
    effect: relation.sourceAsset ? 'derived' : 'unsupported',
    disabledReason: relation.sourceAsset ? sourceAssetId : `Missing source asset: ${sourceAssetId || 'unknown'}`,
  });
  if (relation.prefab.sourceAssetId) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.relation.instanceSource',
      label: 'Instance Source',
      value: relation.prefab.sourceAssetId,
      order: 3,
      source: 'Document',
      effect: 'derived',
    });
  }
  if (relation.prefab.prefabGuid) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.relation.prefabGuid',
      label: 'Prefab GUID',
      value: relation.prefab.prefabGuid,
      order: 4,
      source: 'Document',
      effect: 'derived',
    });
  }
  if (diagnostics.length > 0) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.relation.diagnostics',
      label: 'Diagnostics',
      value: formatEditorScenePrefabRelationDiagnostics(diagnostics),
      order: 5,
      source: 'Derived',
      effect: severity === 'error' ? 'unsupported' : 'derived',
    });
  }
  properties.push(createEditorScenePrefabRelationActionProperty({
    path: 'prefab.actions.editDefinition',
    label: 'Edit Prefab',
    actionId: 'prefab.edit-definition',
    params: {
      assetId: relation.definition?.id ?? relation.prefab.prefabId,
      browserAssetId: relation.definition ? `prefab:${relation.definition.id}` : undefined,
    },
    order: 20,
    icon: 'prefab',
    disabledReason: relation.definition ? undefined : 'Prefab definition is missing.',
  }));
  properties.push(createEditorScenePrefabRelationActionProperty({
    path: 'prefab.actions.selectDefinition',
    label: 'Select Prefab Asset',
    actionId: 'prefab.select-definition',
    params: {
      assetId: relation.definition?.id ?? relation.prefab.prefabId,
      browserAssetId: relation.definition ? `prefab:${relation.definition.id}` : undefined,
    },
    order: 21,
    icon: 'asset',
    disabledReason: relation.definition ? undefined : 'Prefab definition is missing.',
  }));
  properties.push(createEditorScenePrefabRelationActionProperty({
    path: 'prefab.actions.pingSource',
    label: 'Ping Source Model',
    actionId: 'prefab.ping-source',
    params: {
      assetId: sourceAssetId,
      browserAssetId: relation.sourceAsset?.id,
    },
    order: 22,
    icon: 'asset',
    disabledReason: relation.sourceAsset ? undefined : 'Source model asset is missing.',
  }));
  return {
    id: 'prefab-instance',
    title: 'Prefab',
    order: 45,
    placement: 'body',
    summary: status,
    persistence: 'readonly',
    effect: severity === 'error' ? 'unsupported' : 'derived',
    disabledReason: severity === 'ok' ? undefined : formatEditorScenePrefabRelationDiagnostics(diagnostics),
    collapsedByDefault: false,
    properties,
  };
}

function createEditorScenePrefabRelationActionProperty(input: {
  path: string;
  label: string;
  actionId: string;
  params: Record<string, unknown>;
  order: number;
  icon: string;
  disabledReason?: string;
}): InspectorProperty<EditorSceneDocument> {
  return {
    path: input.path,
    label: input.label,
    valueType: 'string',
    control: 'custom',
    customControl: 'inspector-action-button',
    controlOptions: {
      actionId: input.actionId,
      label: input.label,
      icon: input.icon,
      params: input.params,
      disabled: !!input.disabledReason,
    },
    value: input.actionId,
    readOnly: false,
    persistence: 'readonly',
    commitMode: 'immediate',
    order: input.order,
    tags: ['Prefab', 'Action'],
    tooltip: input.disabledReason ?? input.label,
    effect: input.disabledReason ? 'unsupported' : 'active',
    disabledReason: input.disabledReason,
  };
}

function resolveEditorScenePrefabRelationSeverity(
  diagnostics: readonly { severity: 'info' | 'warning' | 'error' }[],
): 'ok' | 'info' | 'warning' | 'error' {
  if (diagnostics.some(diagnostic => diagnostic.severity === 'error')) return 'error';
  if (diagnostics.some(diagnostic => diagnostic.severity === 'warning')) return 'warning';
  if (diagnostics.some(diagnostic => diagnostic.severity === 'info')) return 'info';
  return 'ok';
}

function formatEditorScenePrefabRelationStatus(
  diagnostics: readonly { severity: 'info' | 'warning' | 'error' }[],
): string {
  const errors = diagnostics.filter(diagnostic => diagnostic.severity === 'error').length;
  if (errors > 0) return errors === 1 ? 'Error' : `${errors} errors`;
  const warnings = diagnostics.filter(diagnostic => diagnostic.severity === 'warning').length;
  if (warnings > 0) return warnings === 1 ? 'Warning' : `${warnings} warnings`;
  const infos = diagnostics.filter(diagnostic => diagnostic.severity === 'info').length;
  if (infos > 0) return infos === 1 ? 'Ready · 1 info' : `Ready · ${infos} info`;
  return 'Ready';
}

function formatEditorScenePrefabRelationDiagnostics(
  diagnostics: readonly { severity: 'info' | 'warning' | 'error'; code: string; message: string }[],
): string {
  return diagnostics.length > 0
    ? diagnostics.map(diagnostic => `${diagnostic.severity.toUpperCase()} ${diagnostic.code}: ${diagnostic.message}`).join('\n')
    : 'No prefab relation diagnostics.';
}

function createGroundDecalInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  groundDecal: EditorSceneGameObject['groundDecal'],
): InspectorProperty<EditorSceneDocument>[] {
  const decal = groundDecal ?? createDefaultGroundDecal();
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.size.width',
      label: 'Width',
      valueType: 'number',
      control: 'number',
      value: decal.size.width,
      commitMode: 'live',
      order: 0,
      min: 0.001,
      step: 0.1,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.size.depth',
      label: 'Depth',
      valueType: 'number',
      control: 'number',
      value: decal.size.depth,
      commitMode: 'live',
      order: 1,
      min: 0.001,
      step: 0.1,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.textureId',
      label: 'Texture ID',
      valueType: 'string',
      control: 'string',
      value: decal.textureId ?? '',
      commitMode: 'blur',
      order: 2,
      coerce: (value: unknown) => normalizeEditorSceneInspectorValue('groundDecal.textureId', value),
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.color',
      label: 'Color',
      valueType: 'color',
      control: 'color',
      value: decal.color ?? { r: 1, g: 1, b: 1 },
      commitMode: 'immediate',
      order: 3,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.alphaIndex',
      label: 'Alpha Index',
      valueType: 'number',
      control: 'number',
      value: decal.alphaIndex ?? 0,
      commitMode: 'live',
      order: 4,
      step: 1,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.diffuseTextureLevel',
      label: 'Diffuse Level',
      valueType: 'number',
      control: 'number',
      value: decal.diffuseTextureLevel ?? 1,
      commitMode: 'live',
      order: 5,
      step: 0.05,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'groundDecal.emissiveTextureLevel',
      label: 'Emissive Level',
      valueType: 'number',
      control: 'number',
      value: decal.emissiveTextureLevel ?? 0,
      commitMode: 'live',
      order: 6,
      step: 0.05,
    }),
  ];
  appendReadonlyInspectorProperty(properties, {
    path: 'groundDecal.raw',
    label: 'Raw Ground Decal',
    value: groundDecal ?? 'not configured',
    order: properties.length,
    source: 'Document',
    tags: ['Raw'],
  });
  return properties;
}

function createCameraInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  camera: EditorSceneGameObject['camera'],
): InspectorProperty<EditorSceneDocument>[] {
  const rig = mergeEditorSceneCameraDefaults(camera);
  const language = rig.inspectorLanguage ?? 'zh';
  const text = getCameraInspectorText(language);
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  let order = 0;

  properties.push(createDocumentInspectorProperty(null, nodeKind, {
    path: 'camera.inspectorLanguage',
    label: text.language,
    valueType: 'enum',
    control: 'enum',
    value: language,
    commitMode: 'immediate',
    order,
    options: CAMERA_LANGUAGE_OPTIONS,
    controlOptions: { variant: 'segmented' },
  }));
  order += 1;

  properties.push(createDocumentInspectorProperty(null, nodeKind, {
    path: 'camera.projection',
    label: text.projection,
    valueType: 'enum',
    control: 'enum',
    value: rig.projection ?? 'orthographic',
    commitMode: 'immediate',
    order,
    options: createCameraProjectionOptions(text),
    controlOptions: { variant: 'segmented' },
  }));
  order += 1;

  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.alpha', label: text.alpha, value: rig.alpha, order, step: 0.01 }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.beta', label: text.beta, value: rig.beta, order, step: 0.01 }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.radius', label: text.radius, value: rig.radius, order, min: 0.001, step: 0.1 }));
  order += 1;

  if ((rig.projection ?? 'orthographic') === 'perspective') {
    properties.push(createCameraNumberInspectorProperty(nodeKind, {
      path: 'camera.fov',
      label: text.fov,
      value: roundForInspector(radiansToDegrees(rig.fov ?? 0.85)),
      order,
      min: 1,
      max: 179,
      step: 1,
      coerce: (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? degreesToRadians(value) : value,
    }));
  } else {
    properties.push(createCameraNumberInspectorProperty(nodeKind, {
      path: 'camera.orthoSize',
      label: text.orthoSize,
      value: rig.orthoSize,
      order,
      min: 0.001,
      step: 0.1,
    }));
  }
  order += 1;

  for (const axis of ['x', 'y', 'z'] as const) {
    properties.push(createCameraNumberInspectorProperty(nodeKind, {
      path: `camera.targetOffset.${axis}`,
      label: `${text.targetOffset} ${axis.toUpperCase()}`,
      value: rig.targetOffset?.[axis] ?? 0,
      order,
      step: 0.05,
    }));
    order += 1;
  }

  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.minZ', label: text.nearClip, value: rig.minZ ?? 1, order, min: 0.001, step: 0.1 }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.maxZ', label: text.farClip, value: rig.maxZ ?? 10000, order, min: 0.001, step: 1 }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.lowerBetaLimit', label: text.minBeta, value: rig.lowerBetaLimit ?? rig.beta, order, step: 0.01 }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.upperBetaLimit', label: text.maxBeta, value: rig.upperBetaLimit ?? rig.beta, order, step: 0.01 }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.lowerRadiusLimit', label: text.minRadius, value: rig.lowerRadiusLimit ?? rig.radius, order, min: 0.001, step: 0.1 }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.upperRadiusLimit', label: text.maxRadius, value: rig.upperRadiusLimit ?? rig.radius, order, min: 0.001, step: 0.1 }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, { path: 'camera.inertia', label: text.inertia, value: rig.inertia ?? 0.9, order, min: 0, max: 1, step: 0.05 }));
  order += 1;

  for (const axis of ['x', 'y'] as const) {
    properties.push(createCameraNumberInspectorProperty(nodeKind, {
      path: `camera.targetScreenOffset.${axis}`,
      label: `${text.screenOffset} ${axis.toUpperCase()}`,
      value: rig.targetScreenOffset?.[axis] ?? 0,
      order,
      step: 0.01,
    }));
    order += 1;
  }

  appendReadonlyInspectorProperty(properties, {
    path: 'camera.raw',
    label: text.rawCamera,
    value: camera ?? 'defaults',
    order: properties.length,
    source: 'Document',
    tags: ['Raw'],
  });
  return properties;
}

function createCameraNumberInspectorProperty(
  nodeKind: SceneNodeConfig['kind'],
  input: {
    path: string;
    label: string;
    value: number;
    order: number;
    min?: number;
    max?: number;
    step?: number;
    coerce?: (value: unknown) => unknown;
  },
): InspectorProperty<EditorSceneDocument> {
  return createDocumentInspectorProperty(null, nodeKind, {
    path: input.path,
    label: input.label,
    valueType: 'number',
    control: 'number',
    value: input.value,
    commitMode: 'live',
    order: input.order,
    min: input.min,
    max: input.max,
    step: input.step ?? 0.05,
    coerce: input.coerce,
  });
}

function createLightInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  light: EditorSceneLight,
): InspectorProperty<EditorSceneDocument>[] {
  const language = getLightInspectorLanguage(light);
  const text = getLightInspectorText(language);
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'light.inspectorLanguage',
      label: text.language,
      valueType: 'enum',
      control: 'enum',
      value: language,
      commitMode: 'immediate',
      order: 0,
      options: LIGHT_LANGUAGE_OPTIONS,
      controlOptions: { variant: 'segmented' },
      tooltip: text.tooltips.language,
    }),
    createEditorSceneReadonlyInspectorProperty({
      path: 'light.type',
      label: text.type,
      value: light.type === 'hemispheric' ? text.typeHemispheric : text.typeDirectional,
      order: 1,
      source: 'Document',
      tooltip: text.tooltips.type,
    })!,
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'light.intensity',
      label: text.intensity,
      valueType: 'number',
      control: 'number',
      value: light.intensity,
      commitMode: 'live',
      order: 2,
      min: 0,
      step: 0.05,
      tooltip: text.tooltips.intensity,
    }),
  ];
  let order = 3;
  if (light.type === 'hemispheric') {
    properties.push(createDocumentInspectorProperty(null, nodeKind, {
      path: 'light.diffuseColor',
      label: text.skyLightColor,
      valueType: 'color',
      control: 'color',
      value: light.diffuseColor ?? { r: 1, g: 1, b: 1 },
      commitMode: 'immediate',
      order,
      tooltip: text.tooltips.skyLightColor,
    }));
    order += 1;
    properties.push(createDocumentInspectorProperty(null, nodeKind, {
      path: 'light.groundColor',
      label: text.groundColor,
      valueType: 'color',
      control: 'color',
      value: light.groundColor ?? DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT.groundColor,
      commitMode: 'immediate',
      order,
      tooltip: text.tooltips.groundColor,
    }));
    order += 1;
  } else {
    const angles = readDirectionalLightAngles(light.direction);
    properties.push(createDocumentInspectorProperty(null, nodeKind, {
      path: LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH,
      label: text.horizontalAngle,
      valueType: 'number',
      control: 'number',
      value: angles.horizontalAngleDeg,
      commitMode: 'live',
      order,
      min: LIGHT_DIRECTION_HORIZONTAL_MIN_DEG,
      max: LIGHT_DIRECTION_HORIZONTAL_MAX_DEG,
      step: 1,
      coerce: (value: unknown) => normalizeEditorSceneInspectorValue(LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH, value),
      tooltip: text.tooltips.horizontalAngle,
    }));
    order += 1;
    properties.push(createDocumentInspectorProperty(null, nodeKind, {
      path: LIGHT_DIRECTION_ELEVATION_ANGLE_PATH,
      label: text.elevationAngle,
      valueType: 'number',
      control: 'number',
      value: angles.elevationAngleDeg,
      commitMode: 'live',
      order,
      min: LIGHT_DIRECTION_ELEVATION_MIN_DEG,
      max: LIGHT_DIRECTION_ELEVATION_MAX_DEG,
      step: 1,
      coerce: (value: unknown) => normalizeEditorSceneInspectorValue(LIGHT_DIRECTION_ELEVATION_ANGLE_PATH, value),
      tooltip: text.tooltips.elevationAngle,
    }));
    order += 1;
    properties.push(createDocumentInspectorProperty(null, nodeKind, {
      path: 'light.diffuseColor',
      label: text.lightColor,
      valueType: 'color',
      control: 'color',
      value: light.diffuseColor ?? { r: 1, g: 1, b: 1 },
      commitMode: 'immediate',
      order,
      tooltip: text.tooltips.lightColor,
    }));
    order += 1;
  }
  appendReadonlyInspectorProperty(properties, {
    path: 'light.raw',
    label: text.rawLight,
    value: light ?? 'defaults',
    order: properties.length,
    source: 'Document',
    tags: ['Raw'],
    tooltip: text.tooltips.rawLight,
  });
  return properties;
}

function createDirectionalLightShadowSummaryInspectorSection(
  light: EditorSceneDirectionalLight,
  text: LightInspectorText,
): InspectorSection<EditorSceneDocument> | null {
  const planar = getActiveRenderingProfile().shadows.planar;
  return createEditorSceneReadonlyInspectorSection({
    id: 'lightShadows',
    title: text.shadowsTitle,
    order: 46,
    summary: text.shadowsSummary,
    collapsedByDefault: false,
    tags: ['Rendering', 'Derived'],
    properties: [
      createEditorSceneReadonlyInspectorProperty({
        path: 'rendering.shadows.summary.system',
        label: text.shadowSystem,
        value: text.shadowFollowDirectional,
        order: 0,
        source: 'Document',
        tags: ['Rendering'],
        tooltip: text.tooltips.shadowSystem,
        effect: 'derived',
      }),
      createEditorSceneReadonlyInspectorProperty({
        path: 'rendering.shadows.summary.enabled',
        label: text.shadowEnabled,
        value: planar.enabled,
        order: 1,
        source: 'Document',
        tags: ['Rendering'],
        tooltip: text.tooltips.shadowEnabled,
        effect: 'derived',
      }),
      createEditorSceneReadonlyInspectorProperty({
        path: 'rendering.shadows.summary.opacity',
        label: text.shadowOpacity,
        value: roundForInspector(planar.appearance.color.a),
        order: 2,
        source: 'Document',
        tags: ['Rendering'],
        tooltip: text.tooltips.shadowOpacity,
        effect: 'derived',
      }),
      createEditorSceneReadonlyInspectorProperty({
        path: 'rendering.shadows.summary.length',
        label: text.shadowLength,
        value: formatShadowLengthMultiplier(readDirectionalShadowLengthMultiplier(light.direction)),
        order: 3,
        source: 'Document',
        tags: ['Rendering'],
        tooltip: text.tooltips.shadowLength,
        effect: 'derived',
      }),
      createOpenRenderingPanelInspectorProperty(text),
    ],
  });
}

function createOpenRenderingPanelInspectorProperty(
  text: LightInspectorText,
): InspectorProperty<EditorSceneDocument> {
  return {
    path: 'rendering.shadows.summary.open',
    label: text.openShadows,
    valueType: 'string',
    control: 'custom',
    customControl: 'open-right-dock-tab',
    controlOptions: {
      targetTab: 'rendering',
      label: text.openShadows,
      icon: 'world',
    },
    value: text.openShadows,
    readOnly: true,
    persistence: 'readonly',
    commitMode: 'immediate',
    order: 4,
    tags: ['Rendering'],
    tooltip: text.tooltips.openShadows,
    effect: 'active',
  };
}

function readDirectionalShadowLengthMultiplier(direction: EditorSceneVec3 | undefined): number {
  const normalized = normalizeDirectionVector(direction, DEFAULT_DIRECTIONAL_LIGHT_DIRECTION);
  const vertical = Math.abs(normalized.y);
  if (vertical <= 0.000001) return 999;
  return Math.min(999, Math.hypot(normalized.x, normalized.z) / vertical);
}

function formatShadowLengthMultiplier(value: number): string {
  return `x${roundForInspector(value)}`;
}

function createArtistMaterialInspectorSections(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  nodeKind: SceneNodeConfig['kind'],
  context: EditorSceneInspectorContext = {},
): InspectorSection<EditorSceneDocument>[] {
  const sections: InspectorSection<EditorSceneDocument>[] = [];
  const language = readArtistMaterialInspectorLanguage(gameObject);
  const text = getArtistMaterialInspectorText(language);
  const rootBinding = gameObject.overrides?.materialBinding;
  const rootAsset = findEditorSceneMaterialAsset(document, rootBinding?.materialAssetId ?? '');
  const hasDetectedSlots = hasDetectedModelMaterialSlots(document, gameObject);
  const hasReadonlyReimportConflicts = nodeKind !== 'primitive'
    && hasReadonlyEditorSceneMaterialSlotReimportIssues(
      resolvePlayableEditorSceneMaterialSlotReimportDiff(document, gameObject),
    );
  if (!hasDetectedSlots) {
    sections.push({
      id: 'artistMaterial',
      title: text.title,
      order: 46,
      placement: 'body',
      summary: createArtistMaterialBindingSummary(rootBinding, rootAsset, text),
      persistence: 'document',
      collapsedByDefault: false,
      properties: [
        createMaterialLanguageInspectorProperty(nodeKind, text, language, 0),
        createMaterialAssetSelectorInspectorProperty(document, nodeKind, {
          path: 'overrides.materialBinding.materialAssetId',
          label: text.materialCard,
          value: rootBinding?.materialAssetId ?? '',
          order: 1,
          text,
          currentAsset: rootAsset,
        }),
        ...createArtistMaterialAssetInspectorProperties(document, rootAsset, text, 10, context),
      ],
    });
  }

  const slotProperties = nodeKind === 'primitive'
    ? []
    : hasDetectedSlots || hasReadonlyReimportConflicts
      ? createReadonlyMaterialSlotListInspectorProperties(document, gameObject, text)
      : createChildMaterialBindingInspectorProperties(document, gameObject, nodeKind, context);
  if (slotProperties.length > 0) {
    sections.push({
      id: 'artistMaterialSlots',
      title: text.slotTitle,
      order: 48,
      placement: 'body',
      summary: createChildMaterialBindingSummary(document, gameObject, text),
      persistence: hasDetectedSlots || hasReadonlyReimportConflicts ? 'readonly' : 'document',
      collapsedByDefault: !(hasDetectedSlots || hasReadonlyReimportConflicts),
      properties: slotProperties,
    });
  }
  return sections;
}

function createEditorSceneAssetMeshInspectorSections(
  document: EditorSceneDocument,
  target: EditorSceneAssetMeshSelectionTarget,
  context: EditorSceneInspectorContext = {},
): InspectorSection<EditorSceneDocument>[] {
  const gameObject = target.gameObject;
  const nodeKind = readEditorSceneNodeKind(gameObject);
  const text = getArtistMaterialInspectorText(readArtistMaterialInspectorLanguage(gameObject));
  const binding = getEditorSceneSlotMaterialBinding(gameObject, target.slot);
  const legacy = getEditorSceneSlotLegacyMaterial(gameObject, target.slot);
  const materialAsset = findEditorSceneMaterialAsset(document, binding?.materialAssetId ?? '');
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createMaterialAssetSelectorInspectorProperty(document, nodeKind, {
      path: target.materialBindingPath,
      label: target.label,
      value: binding?.materialAssetId ?? '',
      order: 0,
      text,
      currentAsset: materialAsset,
    }),
    ...createArtistMaterialAssetInspectorProperties(document, materialAsset, text, 10, context),
  ];
  if (legacy) {
    appendReadonlyInspectorProperty(properties, {
      path: `overrides.childMaterials.${target.ownerNodePath}.raw`,
      label: text.legacySlotRaw,
      value: legacy,
      order: 1000,
      source: 'Document',
      tags: ['Legacy', 'Advanced', 'Raw'],
      tooltip: text.tooltips.legacySlotRaw,
    });
  }
  return [
    {
      id: 'assetMesh',
      title: 'Asset Mesh',
      order: 10,
      placement: 'summary',
      persistence: 'readonly',
      properties: [
        createReadonlyInspectorProperty('assetMesh.parent', 'Parent GameObject', gameObject.name ?? gameObject.id, 0),
        createReadonlyInspectorProperty('assetMesh.slotId', 'Slot ID', target.slotId ?? '', 1),
        createReadonlyInspectorProperty('assetMesh.ownerNodePath', 'Owner Node Path', target.ownerNodePath, 2),
      ],
    },
    {
      id: 'artistMaterialSlot',
      title: text.slotTitle,
      order: 46,
      placement: 'body',
      summary: createArtistMaterialBindingSummary(binding, materialAsset, text),
      persistence: 'document',
      collapsedByDefault: false,
      properties,
    },
  ];
}

function createArtistMaterialBindingSummary(
  binding: SceneNodeMaterialBindingConfig | undefined,
  materialAsset: SceneMaterialAssetConfig | null,
  text: ArtistMaterialInspectorText,
): string {
  const summary = createPlayableEditorSceneMaterialBindingSummary(binding, materialAsset);
  if (summary.state === 'asset' && summary.materialAsset) return text.summaryAsset(summary.materialAsset.name ?? summary.materialAsset.id);
  if (summary.state === 'missing-asset') return text.summaryMissingAsset;
  if (summary.state === 'override') return text.summaryLegacyData;
  return text.summaryInherit;
}

function createChildMaterialBindingSummary(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  text: ArtistMaterialInspectorText,
): string {
  const count = collectEditorSceneChildMaterialSlots(document, gameObject).length;
  return count > 0 ? text.summarySlotCount(count) : text.summaryAddSlot;
}

function createChildMaterialBindingInspectorProperties(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  nodeKind: SceneNodeConfig['kind'],
  context: EditorSceneInspectorContext = {},
): InspectorProperty<EditorSceneDocument>[] {
  const text = getArtistMaterialInspectorText(readArtistMaterialInspectorLanguage(gameObject));
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createAddChildMaterialSlotInspectorProperty(document, nodeKind, text),
  ];
  const materialSlots = collectEditorSceneChildMaterialSlots(document, gameObject);
  materialSlots.forEach((slot, slotIndex) => {
    const ownerNodePath = slot.ownerNodePath;
    const binding = getEditorSceneSlotMaterialBinding(gameObject, slot);
    const legacy = getEditorSceneSlotLegacyMaterial(gameObject, slot);
    const materialAsset = findEditorSceneMaterialAsset(document, binding?.materialAssetId ?? '');
    const baseOrder = (slotIndex + 1) * 100;
    properties.push(createMaterialAssetSelectorInspectorProperty(document, nodeKind, {
      path: getEditorSceneSlotMaterialBindingPath(slot),
      label: slot.label || formatEditorSceneMaterialSlotLabel(ownerNodePath, slotIndex, text),
      value: binding?.materialAssetId ?? '',
      order: baseOrder,
      text,
      currentAsset: materialAsset,
    }));
    if (legacy) {
      appendReadonlyInspectorProperty(properties, {
        path: `overrides.childMaterials.${ownerNodePath}.raw`,
        label: text.legacySlotRaw,
        value: legacy,
        order: baseOrder + 2,
        source: 'Document',
        tags: ['Legacy', 'Advanced', 'Raw'],
        tooltip: text.tooltips.legacySlotRaw,
      });
    }
    properties.push(...createArtistMaterialAssetInspectorProperties(document, materialAsset, text, baseOrder + 10, context));
  });
  return properties;
}

function createReadonlyMaterialSlotListInspectorProperties(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  text: ArtistMaterialInspectorText,
): InspectorProperty<EditorSceneDocument>[] {
  const slots = collectEditorSceneChildMaterialSlots(document, gameObject);
  if (slots.length === 0) return [];
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  const reimportDiff = resolvePlayableEditorSceneMaterialSlotReimportDiff(document, gameObject);
  if (reimportDiff.issues.length > 0) {
    properties.push(createReadonlyInspectorProperty(
      'asset.materialSlots.reimportConflicts',
      text.reimportConflicts,
      formatEditorSceneMaterialSlotReimportIssues(reimportDiff.issues, text),
      -1,
      text.tooltips.reimportConflicts,
    ));
  }
  properties.push({
    path: 'asset.materialSlots',
    label: text.slotList,
    valueType: 'object',
    control: 'custom',
    customControl: 'material-slot-list',
    value: {
      count: slots.length,
      slots: slots.map((slot, slotIndex) => createReadonlyMaterialSlotListItem(document, gameObject, slot, slotIndex, text)),
    },
    readOnly: true,
    persistence: 'readonly',
    commitMode: 'immediate',
    order: 0,
    controlOptions: {
      labels: {
        material: text.slotMaterialAsset,
        slotId: text.slotId,
        ownerNodePath: text.slotOwnerPath,
        sourceMaterial: text.slotSourceMaterial,
        bindingPath: text.slotBindingPath,
      },
      slots: slots.map((slot, slotIndex) => createReadonlyMaterialSlotListItem(document, gameObject, slot, slotIndex, text)),
    },
    tags: ['ArtistMaterial', 'MaterialSlot', 'Readonly'],
    tooltip: text.tooltips.slotList,
    document,
  });
  return properties;
}

function hasReadonlyEditorSceneMaterialSlotReimportIssues(
  diff: ReturnType<typeof resolvePlayableEditorSceneMaterialSlotReimportDiff>,
): boolean {
  return diff.issues.some(issue => issue.reason !== 'unmatched-legacy-binding');
}

function formatEditorSceneMaterialSlotReimportIssues(
  issues: ReturnType<typeof resolvePlayableEditorSceneMaterialSlotReimportDiff>['issues'],
  text: ArtistMaterialInspectorText,
): string {
  const lines = issues.map((issue) => {
    const target = issue.label || issue.ownerNodePath || issue.slotId || issue.previousSlotId || issue.bindingPath || 'slot';
    if (issue.reason === 'source-material-changed') {
      const from = issue.previousSourceMaterialIndex == null ? '?' : `#${issue.previousSourceMaterialIndex}`;
      const to = issue.sourceMaterialIndex == null ? '?' : `#${issue.sourceMaterialIndex}`;
      return `${target}: source material ${from} -> ${to}; ${issue.materialAssetId ?? text.inheritNone}`;
    }
    if (issue.reason === 'slot-removed') {
      return `${target}: removed slot; ${issue.materialAssetId ?? text.inheritNone}`;
    }
    if (issue.reason === 'unmatched-legacy-binding') {
      return `${target}: unmatched legacy binding; ${issue.materialAssetId ?? text.inheritNone}`;
    }
    if (issue.reason === 'slot-added') {
      return `${target}: added slot without binding`;
    }
    return `${target}: ${issue.status}`;
  });
  return [
    text.formatReimportConflictSummary(issues.length),
    ...lines,
  ].join('\n');
}

function createReadonlyMaterialSlotListItem(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  slot: EditorSceneChildMaterialSlot,
  slotIndex: number,
  text: ArtistMaterialInspectorText,
): Record<string, unknown> {
  const binding = getEditorSceneSlotMaterialBinding(gameObject, slot);
  const materialAsset = findEditorSceneMaterialAsset(document, binding?.materialAssetId ?? '');
  const materialOptions = createMaterialAssetPickerControlOptions(document, materialAsset, text, binding?.materialAssetId ?? '');
  const sourceMaterialIndex = slot.sourceMaterialIndex ?? slot.sourceMaterialIndices?.[0];
  const sourceMaterialName = sourceMaterialIndex == null ? null : getEditorSceneSlotSourceMaterialName(slot, sourceMaterialIndex);
  return {
    key: getEditorSceneSlotSelectionKey(slot),
    label: slot.label || formatEditorSceneMaterialSlotLabel(slot.ownerNodePath, slotIndex, text),
    selectionTargetId: createEditorSceneAssetMeshSelectionId(gameObject.id, getEditorSceneSlotSelectionKey(slot)),
    ...(slot.slotId ? { slotId: slot.slotId } : {}),
    ownerNodePath: slot.ownerNodePath,
    materialAssetId: binding?.materialAssetId ?? '',
    materialLabel: materialOptions.currentLabel ?? text.inheritNone,
    materialMeta: materialOptions.currentMeta ?? text.summaryInherit,
    ...(materialOptions.currentPreview ? { materialPreview: materialOptions.currentPreview } : {}),
    ...(sourceMaterialIndex == null ? {} : { sourceMaterialIndex }),
    ...(sourceMaterialName ? { sourceMaterialName } : {}),
    bindingPath: getEditorSceneSlotMaterialBindingPath(slot),
  };
}

type EditorSceneChildMaterialSlot = {
  slotId?: string;
  ownerNodePath: string;
  label?: string;
  nodeIndex?: number;
  meshIndex?: number;
  sourceMaterialIndex?: number;
  sourceMaterialIndices?: number[];
  materialName?: string;
  materialNames?: string[];
  sourceMaterialProfiles?: EditorSceneSourceMaterialProfile[];
};

type EditorSceneSourceMaterialProfile = {
  sourceMaterialIndex: number;
  materialName?: string;
  profile?: ArtistMaterialProfile;
  textureHints?: Array<{
    profilePath: string;
    reason: string;
    textureIndex?: number;
    imageIndex?: number;
    bufferView?: number;
    mimeType?: string;
    uri?: string;
  }>;
};

function collectEditorSceneChildMaterialSlots(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): EditorSceneChildMaterialSlot[] {
  return collectPlayableEditorSceneChildMaterialSlots(document, gameObject) as EditorSceneChildMaterialSlot[];
}

function hasDetectedModelMaterialSlots(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): boolean {
  return readPlayableEditorSceneAssetMaterialSlots(document, gameObject).length > 0;
}

function formatEditorSceneMaterialSlotLabel(
  ownerNodePath: string,
  slotIndex: number,
  text: ArtistMaterialInspectorText,
): string {
  const suffix = ownerNodePath.split('/').filter(Boolean).pop() ?? ownerNodePath;
  return `${text.slotMaterialAsset} ${slotIndex + 1}: ${suffix}`;
}

function createAddChildMaterialSlotInspectorProperty(
  document: EditorSceneDocument,
  nodeKind: SceneNodeConfig['kind'],
  text: ArtistMaterialInspectorText,
): InspectorProperty<EditorSceneDocument> {
  return {
    path: CREATE_CHILD_MATERIAL_SLOT_PATH,
    label: text.createSlotMaterial,
    valueType: 'string',
    control: 'string',
    value: '',
    readOnly: false,
    persistence: 'document',
    commitMode: 'blur',
    order: 0,
    placeholder: 'Owner/ChildMesh',
    tooltip: text.tooltips.createSlotMaterial,
    tags: ['ArtistMaterial', 'Slot'],
    document,
    validate: (value) => (
      typeof value === 'string' && value.trim()
        ? { ok: true, value: value.trim() }
        : { ok: false, message: 'Enter a child ownerNodePath.' }
    ),
    coerce: (value) => (typeof value === 'string' ? value.trim() : value),
    effect: nodeKind === 'group' ? 'unsupported' : undefined,
    disabledReason: nodeKind === 'group' ? 'Groups do not own material slots.' : undefined,
  };
}

function createMaterialLanguageInspectorProperty(
  nodeKind: SceneNodeConfig['kind'],
  text: ArtistMaterialInspectorText,
  language: ArtistMaterialInspectorLanguage,
  order: number,
): InspectorProperty<EditorSceneDocument> {
  return createDocumentInspectorProperty(null, nodeKind, {
    path: 'metadata.artistMaterialInspectorLanguage',
    label: text.language,
    valueType: 'enum',
    control: 'enum',
    value: language,
    commitMode: 'immediate',
    order,
    options: MATERIAL_LANGUAGE_OPTIONS,
    controlOptions: { variant: 'segmented' },
    tooltip: text.tooltips.language,
  });
}

function createMaterialAssetSelectorInspectorProperty(
  document: EditorSceneDocument,
  nodeKind: SceneNodeConfig['kind'],
  input: {
    path: string;
    label: string;
    value: string;
    order: number;
    text: ArtistMaterialInspectorText;
    currentAsset?: SceneMaterialAssetConfig | null;
  },
): InspectorProperty<EditorSceneDocument> {
  const currentAsset = input.currentAsset ?? findEditorSceneMaterialAsset(document, input.value);
  return {
    path: input.path,
    label: input.label,
    valueType: 'string',
    control: 'custom',
    customControl: 'asset-picker-card',
    value: input.value,
    readOnly: false,
    persistence: 'document',
    commitMode: 'change',
    order: input.order,
    controlOptions: createMaterialAssetPickerControlOptions(document, currentAsset, input.text, input.value),
    tooltip: input.text.tooltips.materialAsset,
    tags: ['ArtistMaterial', 'MaterialAsset'],
    document,
    validate: (value) => {
      const duplicateMaterialAssetId = parseDuplicateMaterialAssetValue(value);
      if (duplicateMaterialAssetId && hasEditorSceneMaterialAsset(document, duplicateMaterialAssetId)) {
        return { ok: true, value };
      }
      if (value == null || value === '') return { ok: true, value };
      if (typeof value === 'string' && hasEditorSceneMaterialAsset(document, value)) return { ok: true, value };
      return { ok: false, message: `Material asset not found: ${String(value)}` };
    },
    coerce: (value) => (typeof value === 'string' ? value.trim() : value),
    effect: nodeKind === 'group' ? 'unsupported' : undefined,
    disabledReason: nodeKind === 'group' ? 'Groups do not own materials.' : undefined,
  };
}

function createMaterialAssetPickerControlOptions(
  document: EditorSceneDocument,
  currentAsset: SceneMaterialAssetConfig | null,
  text: ArtistMaterialInspectorText,
  currentValue: string,
): Record<string, unknown> {
  return {
    ...createPlayableEditorSceneMaterialPickerControlOptions({
      materialAssets: document.scene.materialAssets ?? [],
      currentAsset,
      currentValue,
      pickerText: createEditorSceneMaterialPickerText(text),
      displayText: createEditorSceneMaterialDisplayText(text),
      document,
      ownershipText: createEditorSceneMaterialOwnershipText(text),
    }),
    actionDisabledReason: text.batchReplaceUnsupported,
  };
}

function getEditorSceneMaterialAssetDisplayName(
  materialAsset: SceneMaterialAssetConfig,
  text: ArtistMaterialInspectorText,
): string {
  return getPlayableEditorSceneMaterialAssetDisplayName(
    materialAsset,
    createEditorSceneMaterialDisplayText(text),
  );
}

function createEditorSceneMaterialPickerText(text: ArtistMaterialInspectorText) {
  return {
    materialPickerTitle: text.materialPickerTitle,
    replace: text.replace,
    duplicateForObject: text.duplicateForObject,
    duplicateForObjectTooltip: text.tooltips.duplicateForObject,
    summaryMissingAsset: text.summaryMissingAsset,
    summaryInherit: text.summaryInherit,
    inheritNone: text.inheritNone,
  };
}

function createEditorSceneMaterialOwnershipText(text: ArtistMaterialInspectorText) {
  return {
    formatUsageCount: text.formatUsageCount,
    formatEditImpact: text.formatMaterialEditImpact,
    formatDuplicateImpact: text.formatDuplicateMaterialImpact,
  };
}

function createEditorSceneMaterialDisplayText(text: ArtistMaterialInspectorText) {
  return {
    defaultMaterial: text.defaultMaterial,
    defaultStandardMaterial: text.defaultStandardMaterial,
    defaultMaterialMeta: text.defaultMaterialMeta,
    defaultStandardMaterialMeta: text.defaultStandardMaterialMeta,
    formatMaterialMeta: (materialAssetId: string) => `Material - ${materialAssetId}`,
  };
}

function createArtistMaterialAssetInspectorProperties(
  document: EditorSceneDocument,
  materialAsset: SceneMaterialAssetConfig | null,
  text: ArtistMaterialInspectorText,
  orderOffset: number,
  context: EditorSceneInspectorContext = {},
): InspectorProperty<EditorSceneDocument>[] {
  if (!materialAsset) {
    return [];
  }
  const materialKind = resolveEditorSceneMaterialAssetKind(materialAsset);
  const identityProperties = createReadonlyArtistMaterialAssetIdentityProperties(materialAsset, text, orderOffset);
  if (isReadonlyEditorSceneMaterialAsset(materialAsset)) {
    return [
      ...identityProperties,
      createEditorSceneReadonlyInspectorProperty({
        path: `scene.materialAssets.${materialAsset.id}.profile`,
        label: text.assetProfile,
        value: text.defaultMaterialReadOnly,
        order: orderOffset + 2,
        source: 'Document',
        effect: 'default',
        disabledReason: text.defaultMaterialReadOnly,
        tags: ['ArtistMaterial', 'MaterialAsset'],
        tooltip: text.tooltips.assetProfile,
      })!,
    ];
  }
  const profile = materialAsset.profile ?? {};
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    ...identityProperties,
    createMaterialAssetEnumInspectorProperty(document, materialAsset, 'profile.lightingModel', text.assetLightingModel, profile.lightingModel ?? 'lit', orderOffset + 1, createMaterialLightingModelOptions(text), text.tooltips.lightingModel),
    createMaterialTexturePickerInspectorProperty({
      path: `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.profile.baseColor.texture.textureAssetId`,
      label: text.assetBaseTexture,
      value: readArtistMaterialTexturePickerValue(profile.baseColor?.texture),
      order: orderOffset + 2,
      text,
      context,
      tooltip: text.tooltips.baseTexture,
    }),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.baseColor.brightness', text.assetBrightness, profile.baseColor?.brightness ?? 1, orderOffset + 3, 0, 2, 0.05, text.tooltips.brightness),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.baseColor.saturation', text.assetSaturation, profile.baseColor?.saturation ?? 1, orderOffset + 4, 0, 2, 0.05, text.tooltips.saturation),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.baseColor.contrast', text.assetContrast, profile.baseColor?.contrast ?? 1, orderOffset + 5, 0, 2, 0.05, text.tooltips.contrast),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.baseColor.hue', text.assetHue, profile.baseColor?.hue ?? 0, orderOffset + 6, -180, 180, 1, text.tooltips.hue),
    createMaterialAssetFieldInspectorProperty(document, materialAsset, 'profile.baseColor.color', text.assetBaseColor, profile.baseColor?.color ?? { r: 1, g: 1, b: 1 }, orderOffset + 7, 'color', 'color', 'immediate', text.tooltips.baseColor),
    createMaterialTexturePickerInspectorProperty({
      path: `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.profile.normal.texture.textureAssetId`,
      label: text.assetNormalTexture,
      value: readArtistMaterialTexturePickerValue(profile.normal?.texture),
      order: orderOffset + 8,
      text,
      context,
      tooltip: text.tooltips.normalTexture,
    }),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.normal.strength', text.assetNormalStrength, profile.normal?.strength ?? 1, orderOffset + 9, 0, 4, 0.05, text.tooltips.normalStrength),
  ];
  if (materialKind === 'pbr') {
    properties.push(
      createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.metallic', text.assetMetallic, profile.metallic ?? 0, orderOffset + 10, 0, 1, 0.05, text.tooltips.metallic),
      createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.roughness', text.assetRoughness, profile.roughness ?? 1, orderOffset + 11, 0, 1, 0.05, text.tooltips.roughness),
      createMaterialTexturePickerInspectorProperty({
        path: `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.profile.metallicRoughness.texture.textureAssetId`,
        label: text.assetMetallicRoughnessTexture,
        value: readArtistMaterialTexturePickerValue(profile.metallicRoughness?.texture),
        order: orderOffset + 12,
        text,
        context,
        tooltip: text.tooltips.metallicRoughnessTexture,
      }),
      createMaterialTexturePickerInspectorProperty({
        path: `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.profile.occlusion.texture.textureAssetId`,
        label: text.assetOcclusionTexture,
        value: readArtistMaterialTexturePickerValue(profile.occlusion?.texture),
        order: orderOffset + 13,
        text,
        context,
        tooltip: text.tooltips.occlusionTexture,
      }),
      createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.occlusion.strength', text.assetOcclusionStrength, profile.occlusion?.strength ?? 1, orderOffset + 14, 0, 4, 0.05, text.tooltips.occlusionStrength),
    );
  }
  properties.push(
    createMaterialAssetFieldInspectorProperty(document, materialAsset, 'profile.emission.color', text.assetEmissionColor, profile.emission?.color ?? { r: 0, g: 0, b: 0 }, orderOffset + 20, 'color', 'color', 'immediate', text.tooltips.emissionColor),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.emission.intensity', text.assetEmissionIntensity, profile.emission?.intensity ?? 0, orderOffset + 21, 0, undefined, 0.05, text.tooltips.emissionIntensity),
    createMaterialTexturePickerInspectorProperty({
      path: `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.profile.emission.texture.textureAssetId`,
      label: text.assetEmissionTexture,
      value: readArtistMaterialTexturePickerValue(profile.emission?.texture),
      order: orderOffset + 22,
      text,
      context,
      tooltip: text.tooltips.emissionTexture,
    }),
    createMaterialTexturePickerInspectorProperty({
      path: `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.profile.emission.maskTexture.textureAssetId`,
      label: text.assetEmissionMaskUrl,
      value: readArtistMaterialTexturePickerValue(profile.emission?.maskTexture),
      order: orderOffset + 23,
      text,
      context,
      tooltip: text.tooltips.emissionMaskUrl,
    }),
    createMaterialAssetEnumInspectorProperty(document, materialAsset, 'profile.alpha.mode', text.assetAlphaMode, profile.alpha?.mode ?? 'opaque', orderOffset + 30, createMaterialAlphaModeOptions(text), text.tooltips.alphaMode),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.alpha.opacity', text.assetAlphaOpacity, profile.alpha?.opacity ?? 1, orderOffset + 31, 0, 1, 0.05, text.tooltips.alphaOpacity),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.alpha.cutoff', text.assetAlphaCutoff, profile.alpha?.cutoff ?? 0.5, orderOffset + 32, 0, 1, 0.01, text.tooltips.alphaCutoff),
    createMaterialTexturePickerInspectorProperty({
      path: `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.profile.alpha.texture.textureAssetId`,
      label: text.assetAlphaTexture,
      value: readArtistMaterialTexturePickerValue(profile.alpha?.texture),
      order: orderOffset + 33,
      text,
      context,
      tooltip: text.tooltips.alphaTexture,
    }),
  );
  return properties;
}

function createReadonlyArtistMaterialAssetIdentityProperties(
  materialAsset: SceneMaterialAssetConfig,
  text: ArtistMaterialInspectorText,
  orderOffset: number,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createReadonlyInspectorProperty(
      `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.name`,
      text.assetName,
      getEditorSceneMaterialAssetDisplayName(materialAsset, text),
      orderOffset,
      text.tooltips.assetName,
    ),
    createReadonlyInspectorProperty(
      `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.materialKind`,
      text.assetKind,
      getEditorSceneMaterialKindLabel(resolveEditorSceneMaterialAssetKind(materialAsset), text),
      orderOffset + 1,
      text.tooltips.assetKind,
    ),
  ];
}

function resolveEditorSceneMaterialAssetKind(materialAsset: SceneMaterialAssetConfig): 'pbr' | 'standard' {
  return resolvePlayableEditorSceneMaterialAssetKind(materialAsset);
}

function getEditorSceneMaterialKindLabel(
  materialKind: 'pbr' | 'standard',
  text: ArtistMaterialInspectorText,
): string {
  return materialKind === 'standard' ? text.assetKindStandard : text.assetKindPbr;
}

function isReadonlyEditorSceneMaterialAsset(materialAsset: SceneMaterialAssetConfig): boolean {
  return isDefaultEditorSceneMaterialAsset(materialAsset)
    || isPlayableEditorSceneMaterialAssetReadonlyForInspector(materialAsset, [
      DEFAULT_PBR_MATERIAL_ASSET_ID,
      DEFAULT_STANDARD_MATERIAL_ASSET_ID,
    ]);
}

function createMaterialTexturePickerInspectorProperty(input: {
  path: string;
  label: string;
  value: string;
  order: number;
  text: ArtistMaterialInspectorText;
  context: EditorSceneInspectorContext;
  tooltip?: string;
}): InspectorProperty<EditorSceneDocument> {
  const currentTexture = findEditorSceneInspectorTextureAsset(input.context, input.value);
  return {
    path: input.path,
    label: input.label,
    valueType: 'string',
    control: 'custom',
    customControl: 'asset-picker-card',
    value: input.value,
    readOnly: false,
    persistence: 'document',
    commitMode: 'change',
    order: input.order,
    tooltip: input.tooltip,
    tags: ['ArtistMaterial', 'TextureAsset'],
    controlOptions: createTexturePickerControlOptions(input.context, input.text, input.value, currentTexture),
    validate: (value) => {
      const normalized = normalizeMaterialTexturePickerPropertyValue(input.context, input.path, value);
      return normalized.ok
        ? { ok: true, value: normalized.value }
        : { ok: false, message: 'Invalid texture selection.' };
    },
    coerce: (value) => {
      const normalized = normalizeMaterialTexturePickerPropertyValue(input.context, input.path, value);
      return normalized.ok ? normalized.value : null;
    },
  };
}

function createTexturePickerControlOptions(
  context: EditorSceneInspectorContext,
  text: ArtistMaterialInspectorText,
  currentValue: string,
  currentTexture: EditorSceneInspectorTextureAsset | null,
): Record<string, unknown> {
  return {
    ...createPlayableEditorSceneTexturePickerControlOptions({
      textureAssets: context.textureAssets,
      currentTexture,
      currentValue,
      pickerText: createEditorSceneTexturePickerText(text),
      candidateValue: 'assetId',
    }),
  };
}

function findEditorSceneInspectorTextureAsset(
  context: EditorSceneInspectorContext,
  value: string,
): EditorSceneInspectorTextureAsset | null {
  return findPlayableEditorSceneInspectorTextureAsset(context.textureAssets, value) as EditorSceneInspectorTextureAsset | null;
}

function readArtistMaterialTexturePickerValue(
  texture: { textureAssetId?: string | null; url?: string | null } | null | undefined,
): string {
  const textureAssetId = typeof texture?.textureAssetId === 'string' ? texture.textureAssetId.trim() : '';
  if (textureAssetId) return textureAssetId;
  const textureUrl = typeof texture?.url === 'string' ? texture.url.trim() : '';
  return textureUrl;
}

function normalizeMaterialTexturePickerPropertyValue(
  context: EditorSceneInspectorContext,
  path: string,
  value: unknown,
): { ok: true; value: string | null } | { ok: false } {
  if (value == null || value === '') return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!path.endsWith('.textureAssetId')) return { ok: true, value: trimmed };
  const textureAsset = findPlayableEditorSceneInspectorTextureAsset(context.textureAssets, trimmed);
  if (textureAsset) return { ok: true, value: textureAsset.id };
  return /^[A-Za-z0-9_-]+$/.test(trimmed) ? { ok: true, value: trimmed } : { ok: true, value: null };
}

function createEditorSceneTexturePickerText(text: ArtistMaterialInspectorText) {
  return {
    texturePickerTitle: text.texturePickerTitle,
    replace: text.replace,
    inheritNone: text.inheritNone,
    summaryInherit: text.summaryInherit,
  };
}

function createMaterialAssetNumberInspectorProperty(
  document: EditorSceneDocument,
  materialAsset: SceneMaterialAssetConfig,
  path: string,
  label: string,
  value: number,
  order: number,
  min?: number,
  max?: number,
  step = 0.05,
  tooltip?: string,
): InspectorProperty<EditorSceneDocument> {
  return {
    ...createMaterialAssetFieldInspectorProperty(document, materialAsset, path, label, value, order, 'number', 'number', 'live', tooltip),
    min,
    max,
    step,
  };
}

function createMaterialAssetEnumInspectorProperty(
  document: EditorSceneDocument,
  materialAsset: SceneMaterialAssetConfig,
  path: string,
  label: string,
  value: string,
  order: number,
  options: InspectorProperty<EditorSceneDocument>['options'],
  tooltip?: string,
): InspectorProperty<EditorSceneDocument> {
  return {
    ...createMaterialAssetFieldInspectorProperty(document, materialAsset, path, label, value, order, 'enum', 'enum', 'immediate', tooltip),
    options,
    controlOptions: { variant: 'segmented' },
  };
}

function createMaterialAssetFieldInspectorProperty(
  document: EditorSceneDocument,
  materialAsset: SceneMaterialAssetConfig,
  fieldPath: string,
  label: string,
  value: unknown,
  order: number,
  valueType: InspectorProperty<EditorSceneDocument>['valueType'],
  control: InspectorProperty<EditorSceneDocument>['control'],
  commitMode: InspectorProperty<EditorSceneDocument>['commitMode'],
  tooltip?: string,
): InspectorProperty<EditorSceneDocument> {
  return {
    ...createPlayableEditorSceneMaterialAssetFieldInspectorPropertyInput({
      document,
      materialAsset,
      fieldPath,
      label,
      value,
      order,
      valueType,
      control,
      commitMode,
      tooltip,
      pathPrefix: MATERIAL_ASSET_FIELD_PATH_PREFIX,
    }),
    validate: (inputValue) => {
      const normalizedValue = normalizeEditorSceneMaterialAssetValue(fieldPath, inputValue);
      return validateEditorSceneMaterialAssetFieldValue(fieldPath, normalizedValue)
        ? { ok: true, value: normalizedValue }
        : { ok: false, message: `Invalid material asset field: ${fieldPath}.` };
    },
    coerce: (inputValue) => normalizeEditorSceneMaterialAssetValue(fieldPath, inputValue),
  };
}

const OUTLINE_DEFAULT_DISABLED_REASON = 'Outline fields are showing defaults; configure an outline override before edits affect this object.';

function markInspectorPropertiesEffect(
  properties: InspectorProperty<EditorSceneDocument>[],
  effect: InspectorProperty<EditorSceneDocument>['effect'],
  disabledReason?: string,
): InspectorProperty<EditorSceneDocument>[] {
  if (!effect || effect === 'active') return properties;
  return properties.map(property => ({
    ...property,
    readOnly: true,
    persistence: property.persistence === 'runtime' ? 'runtime' : 'readonly',
    control: property.control === 'custom' ? property.control : 'readonly',
    effect: property.effect ?? effect,
    disabledReason: property.disabledReason ?? disabledReason,
  }));
}

function createOutlineInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  outline: OutlineOverrideConfig | undefined,
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.outline.renderOutline',
      label: 'Render Outline',
      valueType: 'boolean',
      control: 'boolean',
      value: outline?.renderOutline ?? false,
      commitMode: 'immediate',
      order: 0,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.outline.outlineWidth',
      label: 'Width',
      valueType: 'number',
      control: 'number',
      value: outline?.outlineWidth ?? 0.04,
      commitMode: 'live',
      order: 1,
      min: 0,
      step: 0.005,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.outline.outlineColor',
      label: 'Color',
      valueType: 'color',
      control: 'color',
      value: outline?.outlineColor ?? { r: 0.03, g: 0.03, b: 0.03 },
      commitMode: 'immediate',
      order: 2,
    }),
  ];
  appendReadonlyInspectorProperty(properties, {
    path: 'overrides.outline.raw',
    label: 'Raw Override',
    value: outline ?? 'not configured',
    order: properties.length,
    source: 'Document',
    tags: ['Raw'],
  });
  return properties;
}

function createDocumentInspectorProperty(
  document: EditorSceneDocument | null,
  nodeKind: SceneNodeConfig['kind'],
  property: Omit<InspectorProperty<EditorSceneDocument>, 'readOnly' | 'persistence' | 'validate'>,
): InspectorProperty<EditorSceneDocument> {
  return createPlayableEditorSceneDocumentInspectorProperty<EditorSceneDocument, SceneNodeConfig['kind']>({
    document,
    nodeKind,
    property,
    extraValidators: PROJECT_EDITOR_SCENE_INSPECTOR_EXTRA_VALIDATORS,
  });
}

function appendReadonlyInspectorProperty(
  properties: InspectorProperty<EditorSceneDocument>[],
  input: EditorSceneReadonlyInspectorPropertyInput,
): void {
  const property = createEditorSceneReadonlyInspectorProperty(input);
  if (property) properties.push(property);
}

function createReadonlyInspectorProperty(
  path: string,
  label: string,
  value: unknown,
  order: number,
  tooltip?: string,
): InspectorProperty<EditorSceneDocument> {
  return createEditorSceneReadonlyInspectorProperty({
    path,
    label,
    value,
    order,
    persistence: 'readonly',
    source: 'Document',
    tooltip,
  })!;
}

const PROJECT_EDITOR_SCENE_INSPECTOR_EXTRA_VALIDATORS: ReadonlyArray<
  PlayableEditorSceneFieldInspectorExtraValidator<EditorSceneDocument, SceneNodeConfig['kind']>
> = [
  validateProjectEditorSceneInspectorField,
];

function validateProjectEditorSceneInspectorField(input: {
  path: string;
  value: unknown;
  document?: EditorSceneDocument | null;
}): InspectorValidationResult | null {
  if (input.path === 'shadowMode') {
    return input.value == null || isPlayableEditorSceneShadowMode(input.value)
      ? { ok: true, value: input.value }
      : { ok: false, message: 'Invalid value for scene node field: shadowMode.' };
  }
  if (input.path === 'camera.inspectorLanguage') {
    return input.value === 'zh' || input.value === 'en'
      ? { ok: true, value: input.value }
      : { ok: false, message: 'Invalid value for scene node field: camera.inspectorLanguage.' };
  }
  if (input.path === 'light.inspectorLanguage') {
    return input.value === 'zh' || input.value === 'en'
      ? { ok: true, value: input.value }
      : { ok: false, message: 'Invalid value for scene node field: light.inspectorLanguage.' };
  }
  if (isDirectionalLightAnglePath(input.path)) {
    return typeof input.value === 'number' && Number.isFinite(input.value)
      ? { ok: true, value: input.value }
      : { ok: false, message: `Invalid value for scene node field: ${input.path}.` };
  }
  if (input.path === 'metadata.artistMaterialInspectorLanguage' || input.path === PLAYABLE_EDITOR_SCENE_SHADOW_INSPECTOR_LANGUAGE_PATH) {
    return input.value === 'zh' || input.value === 'en'
      ? { ok: true, value: input.value }
      : { ok: false, message: `Invalid value for scene node field: ${input.path}.` };
  }
  if (
    input.path === 'instance.assetId'
    && input.document
    && typeof input.value === 'string'
    && !input.document.assets.some((asset) => asset.id === input.value)
  ) {
    return { ok: false, message: `Asset not found: ${input.value}.` };
  }
  if (
    isMaterialAssetBindingPath(input.path)
    && input.document
    && typeof input.value === 'string'
    && input.value
    && !hasEditorSceneMaterialAsset(input.document, input.value)
  ) {
    return { ok: false, message: `Material asset not found: ${input.value}.` };
  }
  if (isMaterialAssetBindingPath(input.path)) {
    return input.value == null || (typeof input.value === 'string' && input.value.trim().length > 0)
      ? { ok: true, value: input.value }
      : { ok: false, message: `Invalid value for scene node field: ${input.path}.` };
  }
  return null;
}

function isMaterialAssetBindingPath(path: string): boolean {
  return isPlayableEditorSceneMaterialBindingPath(path);
}

function isEditorSceneArtistMaterialPatchPath(path: string): boolean {
  return isPlayableEditorSceneArtistMaterialPatchPath(path);
}

function parseEditorSceneMaterialAssetFieldPath(path: string): { materialAssetId: string; fieldPath: string } | null {
  return parsePlayableEditorSceneMaterialAssetFieldPath(path, MATERIAL_ASSET_FIELD_PATH_PREFIX);
}

function normalizeEditorSceneMaterialAssetValue(path: string, value: unknown): unknown {
  return normalizePlayableEditorSceneMaterialAssetValue(path, value);
}

function validateEditorSceneMaterialAssetFieldValue(path: string, value: unknown): boolean {
  return validatePlayableEditorSceneMaterialAssetFieldValue(path, value);
}

function hasEditorSceneMaterialAsset(document: EditorSceneDocument, materialAssetId: string): boolean {
  return document.scene.materialAssets?.some((materialAsset) => materialAsset.id === materialAssetId) ?? false;
}

function normalizeEditorScenePrefabAssetFieldValue(
  path: string,
  value: unknown,
): unknown | typeof INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE {
  if (path === 'displayName') {
    return readNonEmptyEditorSceneString(value) ?? INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE;
  }
  if (path === 'prefab.defaults.active') {
    return typeof value === 'boolean' ? value : INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE;
  }
  if (path === 'prefab.defaults.shadowMode') {
    if (value == null || value === '' || value === 'default') return null;
    return isPlayableEditorSceneShadowMode(value) ? value : INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE;
  }
  if (isPlayableEditorScenePrefabOverridePath(path)) {
    return normalizeEditorScenePrefabOverrideFieldValue(path, value);
  }
  return INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE;
}

function normalizeEditorScenePrefabOverrideFieldValue(
  path: string,
  value: unknown,
): unknown | typeof INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE {
  if (!isPlayableEditorScenePrefabCoreMaterialOverridePath(path)) return INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE;
  const materialPath = readPlayableEditorScenePrefabOverrideMaterialPath(path);
  if (!materialPath) return INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE;
  if (materialPath.endsWith('.materialAssetId')) {
    return value == null ? null : readNonEmptyEditorSceneString(value) ?? null;
  }
  const profilePath = readEditorScenePrefabOverrideProfilePath(materialPath);
  if (!profilePath) return INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE;
  const materialAssetProfilePath = `profile.${profilePath}`;
  const normalizedValue = normalizePlayableEditorSceneMaterialAssetValue(materialAssetProfilePath, value);
  return validatePlayableEditorSceneMaterialAssetFieldValue(materialAssetProfilePath, normalizedValue)
    ? normalizedValue
    : INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE;
}

function readEditorScenePrefabOverrideProfilePath(materialPath: string): string | null {
  const marker = '.override.';
  const markerIndex = materialPath.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const profilePath = materialPath.slice(markerIndex + marker.length);
  return profilePath ? profilePath : null;
}

function findEditorScenePrefabAsset(
  document: EditorSceneDocument,
  assetId: string,
): EditorSceneAsset | null {
  return document.assets.find((asset) => asset.id === assetId && isPlayableEditorScenePrefabAsset(asset)) ?? null;
}

export interface EditorScenePrefabStageInput {
  assetId?: string;
  browserAssetId?: string;
  asset?: { prefab?: unknown } | null;
}

export interface EditorScenePrefabStageDescriptor {
  assetId: string;
  browserAssetId?: string;
  label: string;
  sourceAssetId?: string;
  sourceAssetGuid?: string;
  readonly?: boolean;
  previewNodeId: string;
}

export interface EditorScenePrefabStageStructureItem {
  id: string;
  label: string;
  kind: 'root' | 'source' | 'group' | 'mesh' | 'material' | 'texture' | 'animation' | 'info';
  icon?: string;
  meta?: string;
  readonly?: boolean;
  sourceAssetId?: string;
  slotId?: string;
  ownerNodePath?: string;
  meshIndex?: number;
  primitiveIndex?: number;
  sourceMaterialIndex?: number;
  sourceMaterialIndices?: number[];
  sourceMaterialName?: string;
  sourceMaterialNames?: string[];
  children?: EditorScenePrefabStageStructureItem[];
}

export interface EditorScenePrefabStageContext {
  previewNodeId?: string;
  importStructureReady?: boolean;
  importStructure?: EditorScenePrefabStageImportStructure | null;
  textureAssets?: readonly EditorSceneInspectorTextureAsset[];
}

interface EditorScenePrefabStageImportStructure {
  projectionNodeId: string;
  assetId?: string;
  sourceId?: string;
  nodes?: EditorScenePrefabStageImportNode[];
  materials?: EditorScenePrefabStageImportMaterial[];
  textures?: EditorScenePrefabStageImportTexture[];
  animations?: EditorScenePrefabStageImportAnimation[];
}

interface EditorScenePrefabStageImportNode {
  id: string;
  parentId: string | null;
  name: string;
  kind: 'root' | 'transform' | 'mesh';
  sourceName?: string;
  ownerNodePath?: string;
  materialIds?: string[];
}

interface EditorScenePrefabStageImportMaterial {
  id: string;
  name: string;
  kind?: string;
  nodeIds?: string[];
  textureIds?: string[];
}

interface EditorScenePrefabStageImportTexture {
  id: string;
  name: string;
  kind?: string;
  url?: string;
}

interface EditorScenePrefabStageImportAnimation {
  id: string;
  name: string;
}

export function getEditorScenePrefabStageDescriptor(
  document: EditorSceneDocument,
  input: EditorScenePrefabStageInput,
): EditorScenePrefabStageDescriptor | null {
  const assetId = resolveEditorScenePrefabStageAssetId(input);
  if (!assetId) return null;
  const prefabAsset = findEditorScenePrefabAsset(document, assetId);
  if (!prefabAsset || !prefabAsset.prefab) return null;
  return createEditorScenePrefabStageDescriptor(prefabAsset, input.browserAssetId);
}

export function getEditorScenePrefabStageProjectionNodes(
  document: EditorSceneDocument,
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'assetId' | 'label'> & { previewNodeId?: string },
): unknown[] {
  const prefabAsset = findEditorScenePrefabAsset(document, descriptor.assetId);
  if (!prefabAsset || !prefabAsset.prefab) return [];
  const sourceAsset = findEditorScenePrefabSourceAsset(document, prefabAsset);
  if (!sourceAsset) return [];
  const previewNodeId = resolveEditorScenePrefabStagePreviewNodeId(prefabAsset, descriptor);
  const gameObject = createEditorScenePrefabStagePreviewGameObject(prefabAsset, sourceAsset, {
    ...descriptor,
    previewNodeId,
  });
  const meshCloneGameObject = createEditorScenePrefabStagePreviewGameObject(prefabAsset, sourceAsset, {
    ...descriptor,
    label: `${descriptor.label} Mesh Clone`,
    previewNodeId: `${previewNodeId}:compare-clone`,
  });
  const instancedMeshGameObject = createEditorScenePrefabStagePreviewGameObject(prefabAsset, sourceAsset, {
    ...descriptor,
    label: `${descriptor.label} InstanceMesh`,
    previewNodeId: `${previewNodeId}:compare-instance`,
  });
  return [
    ...createEditorScenePrefabStagePreviewLightNodes(document),
    createPlayableEditorSceneRuntimePreviewNode(document, gameObject),
    createEditorScenePrefabStageRuntimePreviewNode(document, meshCloneGameObject, 'meshClone'),
    createEditorScenePrefabStageRuntimePreviewNode(document, instancedMeshGameObject, 'instancedMesh'),
  ];
}

export function getEditorScenePrefabStageStructure(
  document: EditorSceneDocument,
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'assetId' | 'label' | 'sourceAssetId' | 'sourceAssetGuid' | 'readonly'>,
  context?: EditorScenePrefabStageContext,
): EditorScenePrefabStageStructureItem[] {
  const prefabAsset = findEditorScenePrefabAsset(document, descriptor.assetId);
  const sourceAsset = prefabAsset?.prefab
    ? findEditorScenePrefabSourceAsset(document, prefabAsset)
    : findEditorScenePrefabSourceAssetByDescriptor(document, descriptor);
  const sourceAssetId = sourceAsset?.id ?? descriptor.sourceAssetId;
  const importStructure = context?.importStructure;
  if (isEditorScenePrefabStageImportStructure(importStructure)) {
    return createEditorScenePrefabStageImportStructureItems(descriptor, sourceAsset, sourceAssetId, importStructure);
  }
  return [createEditorScenePrefabStageMetadataRootItem(descriptor, prefabAsset, sourceAsset, sourceAssetId)];
}

function createEditorScenePrefabStageMetadataRootItem(
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'assetId' | 'label' | 'sourceAssetId' | 'sourceAssetGuid' | 'readonly'>,
  prefabAsset: EditorSceneAsset | null | undefined,
  sourceAsset: EditorSceneAsset | null,
  sourceAssetId: string | undefined,
): EditorScenePrefabStageStructureItem {
  const root: EditorScenePrefabStageStructureItem = {
    id: 'prefab-root',
    label: descriptor.label || prefabAsset?.displayName || prefabAsset?.id || descriptor.assetId,
    kind: 'root',
    icon: 'prefab',
    meta: descriptor.assetId,
    readonly: descriptor.readonly !== false,
    children: [createEditorScenePrefabStageSourceStructureItem(sourceAsset, sourceAssetId)],
  };
  const materialSlots = sourceAsset ? readEditorScenePrefabStageMaterialSlots(sourceAsset) : [];
  if (materialSlots.length > 0) {
    root.children?.push({
      id: 'prefab-material-slots',
      label: `Meshes / Materials (${materialSlots.length})`,
      kind: 'group',
      icon: 'material-slot',
      meta: 'metadata.materialSlots',
      readonly: true,
      children: materialSlots.map((slot, index) => createEditorScenePrefabStageMaterialSlotStructureItem(slot, index)),
    });
  }
  return root;
}

export function getEditorScenePrefabStageInspectorObject(
  document: EditorSceneDocument,
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'assetId' | 'browserAssetId' | 'label' | 'sourceAssetId' | 'sourceAssetGuid' | 'readonly' | 'previewNodeId'>,
  selectedItemId: string | null,
  context?: EditorScenePrefabStageContext,
): InspectorObject<EditorSceneDocument> | null {
  const prefabAsset = findEditorScenePrefabAsset(document, descriptor.assetId);
  if (!prefabAsset || !prefabAsset.prefab) return null;
  const sourceAsset = findEditorScenePrefabSourceAsset(document, prefabAsset)
    ?? findEditorScenePrefabSourceAssetByDescriptor(document, descriptor);
  const structureItems = getEditorScenePrefabStageStructure(document, descriptor, context);
  const selectedItem = selectedItemId
    ? findEditorScenePrefabStageStructureItem(structureItems, selectedItemId)
    : null;
  const selectedRoot = !selectedItem
    || selectedItem.id === 'prefab-scene'
    || selectedItem.id === 'prefab-root';
  if (selectedRoot) {
    return createEditorScenePrefabDefinitionInspectorObject(
      document,
      descriptor,
      prefabAsset as EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
      sourceAsset,
      context,
    );
  }
  return createEditorScenePrefabStructureItemInspectorObject(
    document,
    descriptor,
    prefabAsset as EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
    selectedItem,
    sourceAsset,
    context,
  );
}

function createEditorScenePrefabDefinitionInspectorObject(
  document: EditorSceneDocument,
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'assetId' | 'browserAssetId' | 'label' | 'sourceAssetId' | 'sourceAssetGuid' | 'readonly' | 'previewNodeId'>,
  prefabAsset: EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
  sourceAsset: EditorSceneAsset | null,
  context?: EditorScenePrefabStageContext,
): InspectorObject<EditorSceneDocument> {
  const targetId = prefabAsset.id;
  return {
    targetIds: [targetId],
    activeId: targetId,
    label: prefabAsset.displayName ?? descriptor.label ?? prefabAsset.id,
    document,
    selection: {
      targetIds: [targetId],
      activeId: targetId,
      targetKind: 'prefab',
      document,
      capabilities: ['prefab-definition'],
    },
    sections: [
      {
        id: 'prefab-definition',
        title: 'Prefab Definition',
        summary: sourceAsset?.displayName ?? descriptor.sourceAssetId ?? 'Missing source model',
        order: 0,
        persistence: descriptor.readonly ? 'readonly' : 'document',
        properties: createEditorScenePrefabDefinitionProperties(document, prefabAsset, descriptor.readonly === true),
      },
      createEditorScenePrefabSourceInspectorSection(sourceAsset, descriptor, 10),
      createEditorScenePrefabDebugInspectorSection(descriptor, context, 90),
    ].filter((section): section is InspectorSection<EditorSceneDocument> => !!section),
  };
}

function createEditorScenePrefabStructureItemInspectorObject(
  document: EditorSceneDocument,
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'assetId' | 'browserAssetId' | 'label' | 'sourceAssetId' | 'sourceAssetGuid' | 'readonly' | 'previewNodeId'>,
  prefabAsset: EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
  selectedItem: EditorScenePrefabStageStructureItem,
  sourceAsset: EditorSceneAsset | null,
  context?: EditorScenePrefabStageContext,
): InspectorObject<EditorSceneDocument> {
  return {
    targetIds: [selectedItem.id],
    activeId: selectedItem.id,
    label: selectedItem.label,
    document,
    selection: {
      targetIds: [selectedItem.id],
      activeId: selectedItem.id,
      targetKind: selectedItem.kind,
      document,
      capabilities: ['prefab-structure'],
    },
    sections: [
      {
        id: 'prefab-structure-selection',
        title: createEditorScenePrefabStructureInspectorTitle(selectedItem),
        summary: selectedItem.meta,
        order: 0,
        persistence: 'readonly',
        properties: createEditorScenePrefabStructureSelectionProperties(selectedItem, sourceAsset),
      },
      selectedItem.kind === 'source'
        ? createEditorScenePrefabSourceInspectorSection(sourceAsset, descriptor, 10)
        : null,
      selectedItem.kind === 'material' || selectedItem.kind === 'texture'
        ? createEditorScenePrefabMaterialOverrideTargetInspectorSection(
            document,
            descriptor,
            prefabAsset,
            selectedItem,
            context,
            20,
          )
        : null,
      createEditorScenePrefabDebugInspectorSection({
        ...descriptor,
        assetId: prefabAsset.id,
      }, context, 90, selectedItem.id),
    ].filter((section): section is InspectorSection<EditorSceneDocument> => !!section),
  };
}

interface EditorScenePrefabMaterialOverrideTarget {
  editable: boolean;
  kind: 'slot' | 'owner-path' | 'readonly';
  bindingKey?: string;
  bindingPath?: string;
  materialAssetPath?: string;
  profilePathPrefix?: string;
  reason?: string;
}

function createEditorScenePrefabMaterialOverrideTargetInspectorSection(
  document: EditorSceneDocument,
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'readonly'>,
  prefabAsset: EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
  selectedItem: EditorScenePrefabStageStructureItem,
  context: EditorScenePrefabStageContext | undefined,
  order: number,
): InspectorSection<EditorSceneDocument> {
  const target = resolveEditorScenePrefabMaterialOverrideTarget(descriptor, selectedItem);
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.materialOverride.status',
    label: 'Status',
    value: target.editable ? 'Editable' : 'Read Only',
    order: 0,
    source: 'Document',
    effect: target.editable ? 'active' : 'unsupported',
    disabledReason: target.reason,
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.materialOverride.targetKind',
    label: 'Target',
    value: target.kind,
    order: properties.length,
    source: 'Document',
  });
  if (target.bindingPath) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.materialOverride.bindingPath',
      label: 'Binding Path',
      value: target.bindingPath,
      order: properties.length,
      source: 'Document',
    });
  }
  if (target.materialAssetPath) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.materialOverride.materialAssetPath',
      label: 'Material Asset Path',
      value: target.materialAssetPath,
      order: properties.length,
      source: 'Document',
    });
  }
  if (target.profilePathPrefix) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.materialOverride.profilePathPrefix',
      label: 'Profile Path',
      value: target.profilePathPrefix,
      order: properties.length,
      source: 'Document',
    });
  }
  if (target.reason) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.materialOverride.reason',
      label: 'Reason',
      value: target.reason,
      order: properties.length,
      source: 'Document',
      effect: 'unsupported',
    });
  }
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.materialOverride.prefabAssetId',
    label: 'Prefab',
    value: prefabAsset.displayName ?? prefabAsset.id,
    order: properties.length,
    source: 'Document',
  });
  if (target.editable) {
    properties.push(...createEditorScenePrefabMaterialOverrideEditorProperties(
      document,
      prefabAsset,
      target,
      context,
      properties.length + 10,
    ));
  }
  return {
    id: 'prefab-material-override-target',
    title: 'Prefab Material Override',
    summary: target.editable ? `${target.kind} · Core PBR` : target.reason,
    order,
    persistence: target.editable ? 'document' : 'readonly',
    effect: target.editable ? 'active' : 'unsupported',
    properties,
  };
}

function resolveEditorScenePrefabMaterialOverrideTarget(
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'readonly'>,
  selectedItem: EditorScenePrefabStageStructureItem,
): EditorScenePrefabMaterialOverrideTarget {
  if (descriptor.readonly === true) {
    return {
      editable: false,
      kind: 'readonly',
      reason: 'Prefab definition is readonly.',
    };
  }
  if (selectedItem.kind === 'texture') {
    return {
      editable: false,
      kind: 'readonly',
      reason: 'Texture nodes are inspection-only. Edit texture channels from a stable material slot.',
    };
  }
  const slotId = readNonEmptyEditorSceneString(selectedItem.slotId);
  if (slotId) {
    const bindingPath = `prefab.overrides.materialSlotBindings.${slotId}`;
    return {
      editable: true,
      kind: 'slot',
      bindingKey: slotId,
      bindingPath,
      materialAssetPath: `${bindingPath}.materialAssetId`,
      profilePathPrefix: `${bindingPath}.override`,
    };
  }
  const ownerNodePath = selectedItem.ownerNodePath
    ? normalizePlayableEditorSceneMaterialSlotOwnerPath(selectedItem.ownerNodePath)
    : '';
  if (ownerNodePath) {
    const bindingPath = `prefab.overrides.childMaterialBindings.${ownerNodePath}`;
    return {
      editable: true,
      kind: 'owner-path',
      bindingKey: ownerNodePath,
      bindingPath,
      materialAssetPath: `${bindingPath}.materialAssetId`,
      profilePathPrefix: `${bindingPath}.override`,
    };
  }
  return {
    editable: false,
    kind: 'readonly',
    reason: 'This runtime material has no stable slotId or ownerNodePath mapping.',
  };
}

function createEditorScenePrefabMaterialOverrideEditorProperties(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
  target: EditorScenePrefabMaterialOverrideTarget,
  context: EditorScenePrefabStageContext | undefined,
  orderOffset: number,
): InspectorProperty<EditorSceneDocument>[] {
  if (!target.editable || !target.materialAssetPath || !target.profilePathPrefix) return [];
  const text = getArtistMaterialInspectorText('zh');
  const binding = readEditorScenePrefabMaterialOverrideBinding(prefabAsset, target);
  const materialAssetId = readNonEmptyEditorSceneString(binding?.materialAssetId) ?? '';
  const materialAsset = materialAssetId ? findEditorSceneMaterialAsset(document, materialAssetId) : null;
  const profile = readEditorScenePrefabMaterialOverrideProfile(binding);
  return [
    createEditorScenePrefabMaterialAssetSelectorInspectorProperty({
      document,
      path: target.materialAssetPath,
      label: text.slotMaterialAsset,
      value: materialAssetId,
      currentAsset: materialAsset,
      order: orderOffset,
      text,
    }),
    createEditorScenePrefabMaterialTexturePickerInspectorProperty({
      path: `${target.profilePathPrefix}.baseColor.texture.textureAssetId`,
      label: text.assetBaseTexture,
      value: readArtistMaterialTexturePickerValue(profile.baseColor?.texture),
      order: orderOffset + 1,
      text,
      context,
      tooltip: text.tooltips.baseTexture,
    }),
    createEditorScenePrefabMaterialOverrideFieldInspectorProperty({
      document,
      path: `${target.profilePathPrefix}.baseColor.color`,
      label: text.assetBaseColor,
      value: profile.baseColor?.color ?? { r: 1, g: 1, b: 1 },
      order: orderOffset + 2,
      valueType: 'color',
      control: 'color',
      commitMode: 'immediate',
      tooltip: text.tooltips.baseColor,
    }),
    createEditorScenePrefabMaterialTexturePickerInspectorProperty({
      path: `${target.profilePathPrefix}.normal.texture.textureAssetId`,
      label: text.assetNormalTexture,
      value: readArtistMaterialTexturePickerValue(profile.normal?.texture),
      order: orderOffset + 3,
      text,
      context,
      tooltip: text.tooltips.normalTexture,
    }),
    createEditorScenePrefabMaterialOverrideNumberInspectorProperty({
      document,
      path: `${target.profilePathPrefix}.normal.strength`,
      label: text.assetNormalStrength,
      value: profile.normal?.strength ?? 1,
      order: orderOffset + 4,
      min: 0,
      max: 4,
      step: 0.05,
      tooltip: text.tooltips.normalStrength,
    }),
    createEditorScenePrefabMaterialOverrideNumberInspectorProperty({
      document,
      path: `${target.profilePathPrefix}.metallic`,
      label: text.assetMetallic,
      value: profile.metallic ?? 0,
      order: orderOffset + 5,
      min: 0,
      max: 1,
      step: 0.05,
      tooltip: text.tooltips.metallic,
    }),
    createEditorScenePrefabMaterialOverrideNumberInspectorProperty({
      document,
      path: `${target.profilePathPrefix}.roughness`,
      label: text.assetRoughness,
      value: profile.roughness ?? 1,
      order: orderOffset + 6,
      min: 0,
      max: 1,
      step: 0.05,
      tooltip: text.tooltips.roughness,
    }),
    createEditorScenePrefabMaterialOverrideFieldInspectorProperty({
      document,
      path: `${target.profilePathPrefix}.emission.color`,
      label: text.assetEmissionColor,
      value: profile.emission?.color ?? { r: 0, g: 0, b: 0 },
      order: orderOffset + 7,
      valueType: 'color',
      control: 'color',
      commitMode: 'immediate',
      tooltip: text.tooltips.emissionColor,
    }),
    createEditorScenePrefabMaterialOverrideNumberInspectorProperty({
      document,
      path: `${target.profilePathPrefix}.emission.intensity`,
      label: text.assetEmissionIntensity,
      value: profile.emission?.intensity ?? 0,
      order: orderOffset + 8,
      min: 0,
      step: 0.05,
      tooltip: text.tooltips.emissionIntensity,
    }),
    createEditorScenePrefabMaterialTexturePickerInspectorProperty({
      path: `${target.profilePathPrefix}.emission.texture.textureAssetId`,
      label: text.assetEmissionTexture,
      value: readArtistMaterialTexturePickerValue(profile.emission?.texture),
      order: orderOffset + 9,
      text,
      context,
      tooltip: text.tooltips.emissionTexture,
    }),
  ];
}

function readEditorScenePrefabMaterialOverrideBinding(
  prefabAsset: EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
  target: EditorScenePrefabMaterialOverrideTarget,
): { materialAssetId?: string | null; override?: ArtistMaterialProfile } | null {
  if (!target.bindingKey) return null;
  if (target.kind === 'slot') {
    return prefabAsset.prefab.overrides?.materialSlotBindings?.[target.bindingKey] as {
      materialAssetId?: string | null;
      override?: ArtistMaterialProfile;
    } | null ?? null;
  }
  if (target.kind === 'owner-path') {
    return prefabAsset.prefab.overrides?.childMaterialBindings?.[target.bindingKey] as {
      materialAssetId?: string | null;
      override?: ArtistMaterialProfile;
    } | null ?? null;
  }
  return null;
}

function readEditorScenePrefabMaterialOverrideProfile(
  binding: { override?: ArtistMaterialProfile } | null,
): ArtistMaterialProfile {
  return binding?.override && typeof binding.override === 'object' && !Array.isArray(binding.override)
    ? binding.override
    : {};
}

function createEditorScenePrefabMaterialAssetSelectorInspectorProperty(input: {
  document: EditorSceneDocument;
  path: string;
  label: string;
  value: string;
  currentAsset: SceneMaterialAssetConfig | null;
  order: number;
  text: ArtistMaterialInspectorText;
}): InspectorProperty<EditorSceneDocument> {
  const controlOptions = createMaterialAssetPickerControlOptions(input.document, input.currentAsset, input.text, input.value);
  return {
    path: input.path,
    label: input.label,
    valueType: 'string',
    control: 'custom',
    customControl: 'asset-picker-card',
    value: input.value,
    readOnly: false,
    persistence: 'document',
    commitMode: 'change',
    order: input.order,
    document: input.document,
    tags: ['Prefab', 'MaterialOverride', 'MaterialAsset'],
    tooltip: input.text.tooltips.materialAsset,
    controlOptions: {
      ...controlOptions,
      currentEditImpactLabel: 'Prefab definition override; scene instances resolve this material at preview/compile time.',
    },
    validate: (value) => {
      if (value == null || value === '') return { ok: true, value: null };
      if (typeof value !== 'string') return { ok: false, message: 'Choose a material asset.' };
      const materialAssetId = value.trim();
      if (!materialAssetId) return { ok: true, value: null };
      const duplicateMaterialAssetId = parseDuplicateMaterialAssetValue(materialAssetId);
      if (duplicateMaterialAssetId && hasEditorSceneMaterialAsset(input.document, duplicateMaterialAssetId)) {
        return { ok: true, value: materialAssetId };
      }
      if (hasEditorSceneMaterialAsset(input.document, materialAssetId)) return { ok: true, value: materialAssetId };
      return { ok: false, message: `Material asset not found: ${materialAssetId}.` };
    },
    coerce: (value) => {
      if (value == null) return null;
      if (typeof value !== 'string') return value;
      const materialAssetId = value.trim();
      if (parseDuplicateMaterialAssetValue(materialAssetId)) return materialAssetId;
      return materialAssetId || null;
    },
  };
}

function createEditorScenePrefabMaterialTexturePickerInspectorProperty(input: {
  path: string;
  label: string;
  value: string;
  order: number;
  text: ArtistMaterialInspectorText;
  context?: EditorScenePrefabStageContext;
  tooltip?: string;
}): InspectorProperty<EditorSceneDocument> {
  const inspectorContext: EditorSceneInspectorContext = {
    textureAssets: input.context?.textureAssets,
  };
  const currentTexture = findEditorSceneInspectorTextureAsset(inspectorContext, input.value);
  return {
    path: input.path,
    label: input.label,
    valueType: 'string',
    control: 'custom',
    customControl: 'asset-picker-card',
    value: input.value,
    readOnly: false,
    persistence: 'document',
    commitMode: 'change',
    order: input.order,
    tags: ['Prefab', 'MaterialOverride', 'TextureAsset'],
    tooltip: input.tooltip,
    controlOptions: createTexturePickerControlOptions(inspectorContext, input.text, input.value, currentTexture),
    validate: (value) => {
      const normalized = normalizeMaterialTexturePickerPropertyValue(inspectorContext, input.path, value);
      if (!normalized.ok) return { ok: false, message: 'Invalid texture selection.' };
      const prefabValue = normalizeEditorScenePrefabAssetFieldValue(input.path, normalized.value);
      return prefabValue === INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE
        ? { ok: false, message: `Invalid prefab texture field: ${input.path}.` }
        : { ok: true, value: prefabValue };
    },
    coerce: (value) => {
      const normalized = normalizeMaterialTexturePickerPropertyValue(inspectorContext, input.path, value);
      return normalized.ok ? normalized.value : null;
    },
  };
}

function createEditorScenePrefabMaterialOverrideNumberInspectorProperty(input: {
  document: EditorSceneDocument;
  path: string;
  label: string;
  value: number;
  order: number;
  min?: number;
  max?: number;
  step?: number;
  tooltip?: string;
}): InspectorProperty<EditorSceneDocument> {
  return {
    ...createEditorScenePrefabMaterialOverrideFieldInspectorProperty({
      document: input.document,
      path: input.path,
      label: input.label,
      value: input.value,
      order: input.order,
      valueType: 'number',
      control: 'number',
      commitMode: 'live',
      tooltip: input.tooltip,
    }),
    min: input.min,
    max: input.max,
    step: input.step ?? 0.05,
  };
}

function createEditorScenePrefabMaterialOverrideFieldInspectorProperty(input: {
  document: EditorSceneDocument;
  path: string;
  label: string;
  value: unknown;
  order: number;
  valueType: InspectorProperty<EditorSceneDocument>['valueType'];
  control: InspectorProperty<EditorSceneDocument>['control'];
  commitMode: InspectorProperty<EditorSceneDocument>['commitMode'];
  tooltip?: string;
}): InspectorProperty<EditorSceneDocument> {
  return {
    path: input.path,
    label: input.label,
    valueType: input.valueType,
    control: input.control,
    value: input.value,
    readOnly: false,
    persistence: 'document',
    commitMode: input.commitMode,
    order: input.order,
    tooltip: input.tooltip,
    tags: ['Prefab', 'MaterialOverride'],
    document: input.document,
    validate: (value) => {
      const normalized = normalizeEditorScenePrefabAssetFieldValue(input.path, value);
      return normalized === INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE
        ? { ok: false, message: `Invalid prefab material override field: ${input.path}.` }
        : { ok: true, value: normalized };
    },
    coerce: (value) => normalizeEditorScenePrefabAssetFieldValue(input.path, value),
  };
}

function createEditorScenePrefabDefinitionProperties(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
  readonly: boolean,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createEditorScenePrefabFieldInspectorProperty(document, {
      path: 'displayName',
      label: 'Name',
      valueType: 'string',
      control: 'string',
      value: prefabAsset.displayName ?? prefabAsset.id,
      commitMode: 'change',
      order: 0,
      readonly,
    }),
    createEditorScenePrefabFieldInspectorProperty(document, {
      path: 'prefab.defaults.active',
      label: 'Default Active',
      valueType: 'boolean',
      control: 'boolean',
      value: prefabAsset.prefab.defaults?.active !== false,
      commitMode: 'immediate',
      order: 1,
      readonly,
    }),
    {
      ...createEditorScenePrefabFieldInspectorProperty(document, {
        path: 'prefab.defaults.shadowMode',
        label: 'Default Shadow',
        valueType: 'enum',
        control: 'enum',
        value: prefabAsset.prefab.defaults?.shadowMode ?? 'default',
        commitMode: 'immediate',
        order: 2,
        readonly,
      }),
      options: [
        { label: 'Default', value: 'default' },
        { label: 'None', value: 'none' },
        { label: 'Blob', value: 'blob' },
        { label: 'Static', value: 'static' },
        { label: 'Planar', value: 'planar' },
        { label: 'Dynamic', value: 'dynamic' },
      ],
    },
  ];
}

function createEditorScenePrefabFieldInspectorProperty(
  document: EditorSceneDocument,
  input: {
    path: string;
    label: string;
    valueType: InspectorProperty<EditorSceneDocument>['valueType'];
    control: InspectorProperty<EditorSceneDocument>['control'];
    value: unknown;
    commitMode: InspectorProperty<EditorSceneDocument>['commitMode'];
    order: number;
    readonly: boolean;
  },
): InspectorProperty<EditorSceneDocument> {
  return {
    path: input.path,
    label: input.label,
    valueType: input.valueType,
    control: input.readonly ? 'readonly' : input.control,
    value: input.value,
    readOnly: input.readonly,
    persistence: input.readonly ? 'readonly' : 'document',
    commitMode: input.commitMode,
    order: input.order,
    document,
    validate: (value) => {
      const normalized = normalizeEditorScenePrefabAssetFieldValue(input.path, value);
      return normalized === INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE
        ? { ok: false, message: `Invalid prefab field: ${input.path}.` }
        : { ok: true, value: normalized };
    },
    coerce: (value) => normalizeEditorScenePrefabAssetFieldValue(input.path, value),
  };
}

function createEditorScenePrefabSourceInspectorSection(
  sourceAsset: EditorSceneAsset | null,
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'sourceAssetId' | 'sourceAssetGuid'>,
  order: number,
): InspectorSection<EditorSceneDocument> {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.source.name',
    label: 'Name',
    value: sourceAsset?.displayName ?? descriptor.sourceAssetId ?? 'Missing source asset',
    order: 0,
    source: 'Document',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.source.type',
    label: 'Type',
    value: sourceAsset?.type ?? 'missing',
    order: 1,
    source: 'Document',
  });
  if (sourceAsset?.category) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.source.category',
      label: 'Category',
      value: sourceAsset.category,
      order: 2,
      source: 'Document',
    });
  }
  return {
    id: 'prefab-source',
    title: 'Source Model',
    order,
    persistence: 'readonly',
    properties,
  };
}

function createEditorScenePrefabStructureInspectorTitle(item: EditorScenePrefabStageStructureItem): string {
  if (item.kind === 'source') return 'Source Model';
  if (item.kind === 'mesh') return 'Node / Mesh';
  if (item.kind === 'material') return 'Material';
  if (item.kind === 'texture') return 'Texture';
  if (item.kind === 'animation') return 'Animation';
  return 'Prefab Explorer';
}

function createEditorScenePrefabStructureSelectionProperties(
  item: EditorScenePrefabStageStructureItem,
  sourceAsset: EditorSceneAsset | null,
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.structure.name',
    label: 'Name',
    value: item.label,
    order: 0,
    source: 'Runtime',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.structure.kind',
    label: 'Kind',
    value: item.kind,
    order: 1,
    source: 'Runtime',
  });
  if (item.sourceAssetId || sourceAsset?.id) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.structure.sourceAsset',
      label: 'Source Asset',
      value: item.sourceAssetId ?? sourceAsset?.displayName ?? sourceAsset?.id,
      order: properties.length,
      source: 'Document',
    });
  }
  if (item.ownerNodePath) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.structure.ownerNodePath',
      label: 'Owner Path',
      value: item.ownerNodePath,
      order: properties.length,
      source: 'Runtime',
    });
  }
  if (item.slotId) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.structure.slotId',
      label: 'Slot',
      value: item.slotId,
      order: properties.length,
      source: 'Runtime',
    });
  }
  if (item.meshIndex != null) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.structure.meshIndex',
      label: 'Mesh Index',
      value: item.meshIndex,
      order: properties.length,
      source: 'Runtime',
    });
  }
  if (item.primitiveIndex != null) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.structure.primitiveIndex',
      label: 'Primitive',
      value: item.primitiveIndex,
      order: properties.length,
      source: 'Runtime',
    });
  }
  if (item.sourceMaterialIndex != null) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.structure.sourceMaterialIndex',
      label: 'Source Material',
      value: item.sourceMaterialIndex,
      order: properties.length,
      source: 'Runtime',
    });
  }
  if (item.sourceMaterialNames?.length) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.structure.sourceMaterialNames',
      label: 'Source Materials',
      value: item.sourceMaterialNames.join(', '),
      order: properties.length,
      source: 'Runtime',
    });
  }
  if (item.meta) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.structure.meta',
      label: 'Summary',
      value: item.meta,
      order: properties.length,
      source: 'Runtime',
    });
  }
  return properties;
}

function createEditorScenePrefabDebugInspectorSection(
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'assetId' | 'browserAssetId' | 'sourceAssetId' | 'sourceAssetGuid' | 'previewNodeId'>,
  context: EditorScenePrefabStageContext | undefined,
  order: number,
  selectedItemId?: string,
): InspectorSection<EditorSceneDocument> {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.debug.assetId',
    label: 'Prefab ID',
    value: descriptor.assetId,
    order: 0,
    source: 'Document',
  });
  if (descriptor.browserAssetId) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.debug.browserAssetId',
      label: 'Browser ID',
      value: descriptor.browserAssetId,
      order: properties.length,
      source: 'Document',
    });
  }
  if (descriptor.sourceAssetId) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.debug.sourceAssetId',
      label: 'Source ID',
      value: descriptor.sourceAssetId,
      order: properties.length,
      source: 'Document',
    });
  }
  if (descriptor.sourceAssetGuid) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.debug.sourceAssetGuid',
      label: 'Source GUID',
      value: descriptor.sourceAssetGuid,
      order: properties.length,
      source: 'Document',
    });
  }
  if (descriptor.previewNodeId) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.debug.previewNodeId',
      label: 'Preview Node',
      value: descriptor.previewNodeId,
      order: properties.length,
      source: 'Runtime',
    });
  }
  if (selectedItemId) {
    appendReadonlyInspectorProperty(properties, {
      path: 'prefab.debug.selectedItemId',
      label: 'Selected',
      value: selectedItemId,
      order: properties.length,
      source: 'Runtime',
    });
  }
  appendReadonlyInspectorProperty(properties, {
    path: 'prefab.debug.importStructureReady',
    label: 'Import Ready',
    value: context?.importStructureReady === true,
    order: properties.length,
    source: 'Runtime',
  });
  return {
    id: 'prefab-debug',
    title: 'Debug',
    order,
    collapsedByDefault: true,
    persistence: 'readonly',
    properties,
  };
}

function findEditorScenePrefabStageStructureItem(
  items: readonly EditorScenePrefabStageStructureItem[],
  itemId: string,
): EditorScenePrefabStageStructureItem | null {
  for (const item of items) {
    if (item.id === itemId) return item;
    const child = item.children ? findEditorScenePrefabStageStructureItem(item.children, itemId) : null;
    if (child) return child;
  }
  return null;
}

function isEditorScenePrefabStageImportStructure(
  value: EditorScenePrefabStageImportStructure | null | undefined,
): value is EditorScenePrefabStageImportStructure {
  return !!value && Array.isArray(value.nodes);
}

function createEditorScenePrefabStageImportStructureItems(
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'assetId' | 'label' | 'sourceAssetId' | 'sourceAssetGuid' | 'readonly'>,
  sourceAsset: EditorSceneAsset | null,
  sourceAssetId: string | undefined,
  importStructure: EditorScenePrefabStageImportStructure,
): EditorScenePrefabStageStructureItem[] {
  const sceneChildren: EditorScenePrefabStageStructureItem[] = [{
    id: 'prefab-root',
    label: descriptor.label || descriptor.assetId,
    kind: 'root',
    icon: 'prefab',
    meta: descriptor.assetId,
    readonly: descriptor.readonly !== false,
  }, createEditorScenePrefabStageSourceStructureItem(sourceAsset, sourceAssetId)];
  const nodeItems = createEditorScenePrefabStageImportNodeItems(importStructure.nodes ?? []);
  sceneChildren.push({
    id: 'prefab-import-nodes',
    label: `Nodes (${importStructure.nodes?.length ?? 0})`,
    kind: 'group',
    icon: 'group',
    readonly: true,
    children: nodeItems,
  });
  const materialItems = (importStructure.materials ?? []).map((material, index) => (
    createEditorScenePrefabStageImportMaterialItem(material, index)
  ));
  sceneChildren.push({
    id: 'prefab-import-materials',
    label: `Materials (${materialItems.length})`,
    kind: 'group',
    icon: 'material-slot',
    readonly: true,
    children: materialItems,
  });
  const textureItems = (importStructure.textures ?? []).map((texture, index) => (
    createEditorScenePrefabStageImportTextureItem(texture, index)
  ));
  sceneChildren.push({
    id: 'prefab-import-textures',
    label: `Textures (${textureItems.length})`,
    kind: 'group',
    icon: 'asset',
    readonly: true,
    children: textureItems,
  });
  const editableMaterialSlots = sourceAsset ? readEditorScenePrefabStageMaterialSlots(sourceAsset) : [];
  if (editableMaterialSlots.length > 0) {
    sceneChildren.push({
      id: 'prefab-material-slots',
      label: `Editable Material Slots (${editableMaterialSlots.length})`,
      kind: 'group',
      icon: 'material-slot',
      meta: 'metadata.materialSlots',
      readonly: true,
      children: editableMaterialSlots.map((slot, index) => createEditorScenePrefabStageMaterialSlotStructureItem(slot, index)),
    });
  }
  const animationItems = (importStructure.animations ?? []).map((animation, index) => (
    createEditorScenePrefabStageImportAnimationItem(animation, index)
  ));
  sceneChildren.push({
    id: 'prefab-import-animations',
    label: `Animations (${animationItems.length})`,
    kind: 'group',
    icon: 'execute',
    readonly: true,
    children: animationItems,
  });
  return [{
    id: 'prefab-scene',
    label: 'Scene',
    kind: 'root',
    icon: 'world',
    meta: importStructure.sourceId ?? importStructure.assetId ?? descriptor.assetId,
    readonly: true,
    children: sceneChildren,
  }];
}

function createEditorScenePrefabStageImportNodeItems(
  nodes: readonly EditorScenePrefabStageImportNode[],
): EditorScenePrefabStageStructureItem[] {
  const itemBySourceId = new Map<string, EditorScenePrefabStageStructureItem>();
  const childrenByParentId = new Map<string | null, EditorScenePrefabStageStructureItem[]>();
  nodes.forEach((node, index) => {
    const item = createEditorScenePrefabStageImportNodeItem(node, index);
    itemBySourceId.set(node.id, item);
    const siblings = childrenByParentId.get(node.parentId ?? null) ?? [];
    siblings.push(item);
    childrenByParentId.set(node.parentId ?? null, siblings);
  });
  for (const node of nodes) {
    const item = itemBySourceId.get(node.id);
    if (!item) continue;
    const children = childrenByParentId.get(node.id) ?? [];
    if (children.length > 0) item.children = children;
  }
  return childrenByParentId.get(null)
    ?? childrenByParentId.get('root')
    ?? [...itemBySourceId.values()];
}

function createEditorScenePrefabStageImportNodeItem(
  node: EditorScenePrefabStageImportNode,
  index: number,
): EditorScenePrefabStageStructureItem {
  const id = createEditorScenePrefabStageStructureItemId('prefab-import-node', node.id, index);
  return {
    id,
    label: node.name || node.sourceName || `Node ${index + 1}`,
    kind: node.kind === 'mesh' ? 'mesh' : node.kind === 'root' ? 'root' : 'group',
    icon: node.kind === 'mesh' ? 'object' : node.kind === 'root' ? 'root' : 'group',
    readonly: true,
    meta: [
      node.kind,
      node.ownerNodePath ? `Owner: ${node.ownerNodePath}` : null,
      node.materialIds?.length ? `Materials: ${node.materialIds.length}` : null,
    ].filter((part): part is string => !!part).join(' · '),
    ...(node.ownerNodePath ? { ownerNodePath: node.ownerNodePath } : {}),
  };
}

function createEditorScenePrefabStageImportMaterialItem(
  material: EditorScenePrefabStageImportMaterial,
  index: number,
): EditorScenePrefabStageStructureItem {
  return {
    id: createEditorScenePrefabStageStructureItemId('prefab-import-material', material.id, index),
    label: material.name || `Material ${index + 1}`,
    kind: 'material',
    icon: 'material-slot',
    readonly: true,
    meta: [
      material.kind,
      material.nodeIds?.length ? `Nodes: ${material.nodeIds.length}` : null,
      material.textureIds?.length ? `Textures: ${material.textureIds.length}` : null,
    ].filter((part): part is string => !!part).join(' · '),
  };
}

function createEditorScenePrefabStageImportTextureItem(
  texture: EditorScenePrefabStageImportTexture,
  index: number,
): EditorScenePrefabStageStructureItem {
  return {
    id: createEditorScenePrefabStageStructureItemId('prefab-import-texture', texture.id, index),
    label: texture.name || `Texture ${index + 1}`,
    kind: 'texture',
    icon: 'asset',
    readonly: true,
    meta: [texture.kind, texture.url].filter((part): part is string => !!part).join(' · '),
  };
}

function createEditorScenePrefabStageImportAnimationItem(
  animation: EditorScenePrefabStageImportAnimation,
  index: number,
): EditorScenePrefabStageStructureItem {
  return {
    id: createEditorScenePrefabStageStructureItemId('prefab-import-animation', animation.id, index),
    label: animation.name || `Animation ${index + 1}`,
    kind: 'animation',
    icon: 'execute',
    readonly: true,
    meta: animation.id,
  };
}

function resolveEditorScenePrefabStageAssetId(input: EditorScenePrefabStageInput): string | null {
  const fromAssetId = readNonEmptyEditorSceneString(input.assetId);
  if (fromAssetId) return stripEditorScenePrefabBrowserAssetPrefix(fromAssetId);
  const fromBrowserAssetId = readNonEmptyEditorSceneString(input.browserAssetId);
  return fromBrowserAssetId ? stripEditorScenePrefabBrowserAssetPrefix(fromBrowserAssetId) : null;
}

function stripEditorScenePrefabBrowserAssetPrefix(value: string): string {
  return value.startsWith('prefab:') ? value.slice('prefab:'.length) : value;
}

function createEditorScenePrefabStageDescriptor(
  prefabAsset: EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
  browserAssetId?: string,
): EditorScenePrefabStageDescriptor {
  const sourceAssetId = resolvePlayableEditorScenePrefabSourceAssetId(prefabAsset);
  return {
    assetId: prefabAsset.id,
    browserAssetId,
    label: readNonEmptyEditorSceneString(prefabAsset.displayName) ?? prefabAsset.id,
    ...(sourceAssetId ? { sourceAssetId } : {}),
    ...(prefabAsset.prefab.sourceAssetGuid ? { sourceAssetGuid: prefabAsset.prefab.sourceAssetGuid } : {}),
    readonly: false,
    previewNodeId: `prefab-stage:${prefabAsset.id}`,
  };
}

function findEditorScenePrefabSourceAsset(
  document: EditorSceneDocument,
  prefabAsset: Pick<EditorSceneAsset, 'prefab'>,
): EditorSceneAsset | null {
  const sourceAssetId = prefabAsset.prefab ? resolvePlayableEditorScenePrefabSourceAssetId(prefabAsset as EditorSceneAsset) : null;
  const sourceAssetGuid = readNonEmptyEditorSceneString(prefabAsset.prefab?.sourceAssetGuid);
  const asset = document.assets.find((candidate) => {
    if (candidate.type === 'prefab') return false;
    if (sourceAssetId && candidate.id === sourceAssetId) return true;
    return !!sourceAssetGuid && candidate.guid === sourceAssetGuid;
  });
  return asset ?? null;
}

function findEditorScenePrefabSourceAssetByDescriptor(
  document: EditorSceneDocument,
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'sourceAssetId' | 'sourceAssetGuid'>,
): EditorSceneAsset | null {
  const sourceAssetId = readNonEmptyEditorSceneString(descriptor.sourceAssetId);
  const sourceAssetGuid = readNonEmptyEditorSceneString(descriptor.sourceAssetGuid);
  return document.assets.find((candidate) => {
    if (candidate.type === 'prefab') return false;
    if (sourceAssetId && candidate.id === sourceAssetId) return true;
    return !!sourceAssetGuid && candidate.guid === sourceAssetGuid;
  }) ?? null;
}

function createEditorScenePrefabStageSourceStructureItem(
  sourceAsset: EditorSceneAsset | null,
  sourceAssetId: string | undefined,
): EditorScenePrefabStageStructureItem {
  return {
    id: 'prefab-source',
    label: sourceAsset?.displayName ?? sourceAssetId ?? 'Source Model',
    kind: 'source',
    icon: 'asset',
    ...(sourceAssetId ? { sourceAssetId } : {}),
    meta: sourceAsset ? `${sourceAsset.type} · ${sourceAsset.id}` : 'Missing source asset',
    readonly: true,
  };
}

type EditorScenePrefabStageMaterialSlot = EditorSceneChildMaterialSlot & {
  slotId?: string;
  primitiveIndex?: number;
};

function readEditorScenePrefabStageMaterialSlots(sourceAsset: EditorSceneAsset): EditorScenePrefabStageMaterialSlot[] {
  const rawSlots = sourceAsset.metadata?.materialSlots;
  if (!Array.isArray(rawSlots)) return [];
  return rawSlots
    .map(readPlayableEditorSceneMaterialSlotDescriptor)
    .filter((slot): slot is EditorScenePrefabStageMaterialSlot => !!slot);
}

function createEditorScenePrefabStageMaterialSlotStructureItem(
  slot: EditorScenePrefabStageMaterialSlot,
  index: number,
): EditorScenePrefabStageStructureItem {
  const sourceMaterialIndices = getEditorScenePrefabStageSlotSourceMaterialIndices(slot);
  const sourceMaterialNames = sourceMaterialIndices
    .map(sourceMaterialIndex => getEditorSceneSlotSourceMaterialName(slot, sourceMaterialIndex))
    .filter((name): name is string => !!name);
  const primarySourceMaterialIndex = slot.sourceMaterialIndex ?? sourceMaterialIndices[0];
  const primarySourceMaterialName = primarySourceMaterialIndex == null
    ? undefined
    : getEditorSceneSlotSourceMaterialName(slot, primarySourceMaterialIndex) ?? undefined;
  return {
    id: createEditorScenePrefabStageStructureItemId('prefab-material-slot', slot.slotId || slot.ownerNodePath, index),
    label: slot.label || formatEditorSceneMaterialSlotLabel(slot.ownerNodePath, index, getArtistMaterialInspectorText('zh')),
    kind: 'material',
    icon: 'material-slot',
    meta: createEditorScenePrefabStageMaterialSlotMeta(slot, sourceMaterialNames),
    readonly: true,
    ...(slot.slotId ? { slotId: slot.slotId } : {}),
    ownerNodePath: slot.ownerNodePath,
    ...(slot.meshIndex != null ? { meshIndex: slot.meshIndex } : {}),
    ...(slot.primitiveIndex != null ? { primitiveIndex: slot.primitiveIndex } : {}),
    ...(primarySourceMaterialIndex != null ? { sourceMaterialIndex: primarySourceMaterialIndex } : {}),
    ...(sourceMaterialIndices.length > 0 ? { sourceMaterialIndices } : {}),
    ...(primarySourceMaterialName ? { sourceMaterialName: primarySourceMaterialName } : {}),
    ...(sourceMaterialNames.length > 0 ? { sourceMaterialNames } : {}),
  };
}

function getEditorScenePrefabStageSlotSourceMaterialIndices(slot: EditorScenePrefabStageMaterialSlot): number[] {
  const indices = [
    ...(slot.sourceMaterialIndex != null ? [slot.sourceMaterialIndex] : []),
    ...(slot.sourceMaterialIndices ?? []),
    ...(slot.sourceMaterialProfiles?.map(profile => profile.sourceMaterialIndex) ?? []),
  ];
  return Array.from(new Set(indices.filter((value) => Number.isInteger(value))));
}

function createEditorScenePrefabStageMaterialSlotMeta(
  slot: EditorScenePrefabStageMaterialSlot,
  sourceMaterialNames: readonly string[],
): string {
  return [
    `Owner: ${slot.ownerNodePath}`,
    slot.meshIndex != null ? `Mesh: ${slot.meshIndex}` : null,
    slot.primitiveIndex != null ? `Primitive: ${slot.primitiveIndex}` : null,
    sourceMaterialNames.length > 0 ? `Source: ${sourceMaterialNames.join(', ')}` : null,
  ].filter((part): part is string => !!part).join(' · ');
}

function createEditorScenePrefabStageStructureItemId(
  prefix: string,
  value: string,
  index: number,
): string {
  const idPart = sanitizePlayableEditorSceneId(value) || `item_${index + 1}`;
  return `${prefix}:${idPart}:${index + 1}`;
}

function createEditorScenePrefabStagePreviewGameObject(
  prefabAsset: EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
  sourceAsset: EditorSceneAsset,
  descriptor: Pick<EditorScenePrefabStageDescriptor, 'label'> & { assetId?: string; previewNodeId?: string },
): EditorSceneGameObject {
  const previewNodeId = resolveEditorScenePrefabStagePreviewNodeId(prefabAsset, descriptor);
  return {
    id: previewNodeId,
    name: descriptor.label,
    kind: 'instance',
    active: true,
    ...(prefabAsset.prefab.defaults?.shadowMode ? { shadowMode: prefabAsset.prefab.defaults.shadowMode } : {}),
    ...(prefabAsset.prefab.overrides ? { overrides: structuredClone(prefabAsset.prefab.overrides) } : {}),
    components: [{
      type: 'Transform',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }, {
      type: 'ModelRenderer',
      assetId: sourceAsset.id,
    }],
  };
}

function resolveEditorScenePrefabStagePreviewNodeId(
  prefabAsset: Pick<EditorSceneAsset, 'id'>,
  descriptor: { previewNodeId?: string },
): string {
  return descriptor.previewNodeId ?? `prefab-stage:${prefabAsset.id}`;
}

function createEditorScenePrefabStageRuntimePreviewNode(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  assetInstantiationMode: 'meshClone' | 'instancedMesh',
): unknown {
  const node = createPlayableEditorSceneRuntimePreviewNode(document, gameObject);
  if (!node || typeof node !== 'object') return node;
  return {
    ...(node as Record<string, unknown>),
    assetInstantiationMode,
  };
}

type EditorScenePrefabStagePreviewLightType = 'hemispheric' | 'directional';
type EditorScenePrefabStagePreviewLight = EditorSceneLight & { helperVisible: false };

function createEditorScenePrefabStagePreviewLightNodes(document: EditorSceneDocument): unknown[] {
  return [
    createPlayableEditorSceneRuntimePreviewNode(
      document,
      createEditorScenePrefabStagePreviewLightGameObject(document, 'hemispheric'),
    ),
    createPlayableEditorSceneRuntimePreviewNode(
      document,
      createEditorScenePrefabStagePreviewLightGameObject(document, 'directional'),
    ),
  ];
}

function createEditorScenePrefabStagePreviewLightGameObject(
  document: EditorSceneDocument,
  type: EditorScenePrefabStagePreviewLightType,
): EditorSceneGameObject {
  const source = findEditorScenePrefabStageLightGameObject(document, type);
  const isHemispheric = type === 'hemispheric';
  return {
    id: isHemispheric ? PREFAB_STAGE_ENVIRONMENT_LIGHT_NODE_ID : PREFAB_STAGE_DIRECTIONAL_LIGHT_NODE_ID,
    name: isHemispheric ? 'Prefab Stage Environment Light' : 'Prefab Stage Directional Light',
    kind: 'transform',
    active: source?.active !== false,
    transformType: 'light',
    light: createEditorScenePrefabStagePreviewLight(source?.light, type),
    components: [{
      type: 'Transform',
      position: isHemispheric ? { x: 0, y: 3, z: 0 } : { x: 0, y: 4, z: -3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }],
  };
}

function createEditorScenePrefabStagePreviewLight(
  light: EditorSceneGameObject['light'],
  type: EditorScenePrefabStagePreviewLightType,
): EditorScenePrefabStagePreviewLight {
  return {
    ...mergeEditorSceneLightDefaults(light, type),
    helperVisible: false,
  };
}

function findEditorScenePrefabStageLightGameObject(
  document: EditorSceneDocument,
  type: EditorScenePrefabStagePreviewLightType,
): EditorSceneGameObject | undefined {
  const preferredId = type === 'hemispheric'
    ? EDITOR_SCENE_ENVIRONMENT_LIGHT_ID
    : EDITOR_SCENE_SUN_LIGHT_ID;
  const preferred = document.scene.gameObjects.find((gameObject) => (
    gameObject.id === preferredId
    && isEditorSceneLightGameObject(gameObject)
    && readEditorSceneLightType(gameObject.light, type) === type
  ));
  return preferred ?? document.scene.gameObjects.find((gameObject) => (
    isEditorSceneLightGameObject(gameObject)
    && readEditorSceneLightType(gameObject.light, type) === type
  ));
}

function findEditorScenePrefabAssetForSource(
  document: EditorSceneDocument,
  sourceAsset: Pick<EditorSceneAsset, 'id' | 'guid' | 'prefab'>,
): EditorSceneAsset | null {
  const sourceAssetId = sourceAsset.prefab
    ? resolvePlayableEditorScenePrefabSourceAssetId(sourceAsset)
    : readNonEmptyEditorSceneString(sourceAsset.id);
  const sourceAssetGuid = sourceAsset.prefab?.sourceAssetGuid ?? readNonEmptyEditorSceneString(sourceAsset.guid);
  if (!sourceAssetId && !sourceAssetGuid) return null;
  return document.assets.find((asset) => {
    if (!isPlayableEditorScenePrefabAsset(asset)) return false;
    const prefabSourceAssetId = resolvePlayableEditorScenePrefabSourceAssetId(asset);
    if (sourceAssetId && prefabSourceAssetId === sourceAssetId) return true;
    return !!sourceAssetGuid && asset.prefab.sourceAssetGuid === sourceAssetGuid;
  }) ?? null;
}

function resolveEditorScenePrefabSourceAssetForAction(
  input: EditorSceneAssetActionPatchInput,
): { asset: EditorSceneAsset; shouldAddSourceAsset: boolean } | null {
  const assetId = readNonEmptyEditorSceneString(input.assetId);
  if (!assetId) return null;
  const assetGuid = readNonEmptyEditorSceneString(input.asset?.guid);
  const existingAsset = input.document.assets.find((asset) => (
    asset.id === assetId
    || (!!assetGuid && asset.guid === assetGuid)
  ));
  if (existingAsset) {
    if (existingAsset.type !== 'glb') return null;
    return { asset: existingAsset, shouldAddSourceAsset: false };
  }

  if (input.asset) {
    if (input.asset.type !== 'glb' && input.asset.kind !== 'model') return null;
    const sourceAsset = createPlayableEditorSceneAssetFromLibraryItem(input.asset) as EditorSceneAsset;
    if (sourceAsset.type !== 'glb') return null;
    return { asset: sourceAsset, shouldAddSourceAsset: true };
  }

  if (input.assetKind && input.assetKind !== 'model') return null;
  return {
    asset: {
      id: assetId,
      type: 'glb',
      displayName: assetId,
      category: 'Model',
    },
    shouldAddSourceAsset: true,
  };
}

function createEditorScenePrefabAssetId(
  document: EditorSceneDocument,
  sourceAsset: Pick<EditorSceneAsset, 'id' | 'displayName'>,
): string {
  const preferred = `${sanitizePlayableEditorSceneId(sourceAsset.id || sourceAsset.displayName || 'prefab')}_prefab`;
  return createPlayableUniqueEditorSceneId(document.assets.map((asset) => asset.id), preferred);
}

function createEditorScenePrefabAssetGuid(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `prefab_${uuid}`;
  const random = Math.random().toString(36).slice(2, 12);
  const timestamp = Date.now().toString(36);
  return `prefab_${timestamp}_${random}`;
}

function createEditorScenePrefabAssetDisplayName(sourceAsset: Pick<EditorSceneAsset, 'id' | 'displayName'>): string {
  const displayName = readNonEmptyEditorSceneString(sourceAsset.displayName)
    ?? readNonEmptyEditorSceneString(sourceAsset.id)
    ?? 'Prefab';
  return displayName.endsWith(' Prefab') ? displayName : `${displayName} Prefab`;
}

function hasEditorSceneAssetIdentity(
  assets: readonly EditorSceneAsset[],
  target: EditorSceneAsset,
): boolean {
  return assets.some((asset) => asset.id === target.id || (!!target.guid && asset.guid === target.guid));
}

function readNonEmptyEditorSceneString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseDuplicateMaterialAssetValue(value: unknown): string | null {
  return parsePlayableEditorSceneDuplicateMaterialAssetValue(value);
}

function isEditorSceneMaterialBindingPath(path: string): boolean {
  return isPlayableEditorSceneMaterialBindingPath(path);
}

function findEditorSceneMaterialAsset(
  document: EditorSceneDocument,
  materialAssetId: string,
): SceneMaterialAssetConfig | null {
  return findPlayableEditorSceneMaterialAsset(document, materialAssetId) as SceneMaterialAssetConfig | null;
}

function validateEditorSceneInspectorValue(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  path: string,
  value: unknown,
): InspectorValidationResult {
  if (isDirectionalLightAnglePath(path) && gameObject.light?.type !== 'directional') {
    return { ok: false, message: `Unsupported scene node field: ${path}.` };
  }
  return validatePlayableEditorSceneFieldInspectorValue<EditorSceneDocument, SceneNodeConfig['kind']>({
    path,
    nodeKind: readEditorSceneNodeKind(gameObject),
    value,
    document,
    extraValidators: PROJECT_EDITOR_SCENE_INSPECTOR_EXTRA_VALIDATORS,
  });
}

function normalizeEditorSceneInspectorValue(path: string, value: unknown): unknown {
  if (isDirectionalLightAnglePath(path)) {
    return normalizeDirectionalLightAngleValue(path, value);
  }
  if (
    (
      path === 'overrides.materialBinding.materialAssetId'
      || path === 'overrides.materialBinding.override.emission.maskTexture.url'
      || path === 'overrides.materialBinding.override.baseColor.texture.url'
      || /^overrides\.materialSlotBindings\..+\.materialAssetId$/.test(path)
      || /^overrides\.materialSlotBindings\..+\.override\.emission\.maskTexture\.url$/.test(path)
      || /^overrides\.materialSlotBindings\..+\.override\.baseColor\.texture\.url$/.test(path)
      || /^overrides\.childMaterialBindings\..+\.materialAssetId$/.test(path)
      || /^overrides\.childMaterialBindings\..+\.override\.emission\.maskTexture\.url$/.test(path)
      || /^overrides\.childMaterialBindings\..+\.override\.baseColor\.texture\.url$/.test(path)
    )
    && typeof value === 'string'
  ) {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return normalizePlayableEditorSceneFieldInspectorValue(path, value);
}

const EDITOR_SCENE_FIELD_MUTATION_OPTIONS: PlayableEditorSceneFieldMutationOptions<EditorSceneDocument, EditorSceneGameObject> = {
  normalizeFieldValue: normalizeEditorSceneInspectorValue,
  validateField: ({ document, gameObject, path, value }) => (
    validateEditorSceneInspectorValue(document, gameObject, path, value)
  ),
  blockFieldPatch: ({ document, targetId, path, value }) => (
    isBlockedEditorSceneSystemFieldPatch(document, targetId, path, value)
  ),
  normalizePrimitiveShape: normalizeEditorScenePrimitiveShape,
  mergeCameraDefaults: mergeEditorSceneCameraDefaults,
  normalizeCameraAfterFieldPatch: (camera, path) => (
    camera ? normalizeEditorSceneCameraAfterFieldPatch(camera, path) : camera
  ),
  mergeLightDefaults: mergeEditorSceneLightDefaults,
  mergeGroundDecalDefaults: mergeGroundDecalDefaults,
};

export function patchEditorSceneGameObjectField(
  document: EditorSceneDocument,
  targetId: string,
  path: string,
  value: unknown,
): EditorSceneDocument {
  if (path.startsWith('metadata.') || isDirectionalLightAnglePath(path)) {
    const gameObject = findEditorSceneGameObject(document, targetId);
    if (!gameObject) return document;
    const normalizedValue = normalizeEditorSceneInspectorValue(path, value);
    if (!validateEditorSceneInspectorValue(document, gameObject, path, normalizedValue).ok) return document;
    if (isBlockedEditorSceneSystemFieldPatch(document, targetId, path, normalizedValue)) return document;

    if (isDirectionalLightAnglePath(path) && typeof normalizedValue === 'number' && Number.isFinite(normalizedValue)) {
      const light = mergeEditorSceneLightDefaults(gameObject.light, 'directional');
      if (light.type !== 'directional') return document;
      const angles = readDirectionalLightAngles(light.direction);
      return patchPlayableEditorSceneGameObjectField(
        document,
        targetId,
        'light.direction',
        createDirectionalLightDirectionFromAngles(
          path === LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH ? normalizedValue : angles.horizontalAngleDeg,
          path === LIGHT_DIRECTION_ELEVATION_ANGLE_PATH ? normalizedValue : angles.elevationAngleDeg,
        ),
        EDITOR_SCENE_FIELD_MUTATION_OPTIONS,
      ) as EditorSceneDocument;
    }

    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: document.scene.gameObjects.map((entry) => {
          if (entry.id !== targetId) return entry;
          const next = structuredClone(entry);
          applyJsonFieldPatch(next as unknown as Record<string, unknown>, path, normalizedValue);
          if (next.metadata && Object.keys(next.metadata).length === 0) delete next.metadata;
          return next;
        }),
      },
    };
  }

  return patchPlayableEditorSceneGameObjectField(
    document,
    targetId,
    path,
    value,
    EDITOR_SCENE_FIELD_MUTATION_OPTIONS,
  ) as EditorSceneDocument;
}

export function patchEditorSceneGameObjectsField(
  document: EditorSceneDocument,
  targetIds: readonly string[],
  path: string,
  value: unknown,
): EditorSceneDocument {
  const uniqueTargetIds = Array.from(new Set(targetIds.filter(Boolean)));
  if (uniqueTargetIds.length === 0) return document;
  if (path.startsWith('metadata.')) {
    return patchEditorSceneGameObjectsMetadataField(document, uniqueTargetIds, path, value);
  }
  if (isDirectionalLightAnglePath(path)) {
    return uniqueTargetIds.reduce((nextDocument, targetId) => (
      patchEditorSceneGameObjectField(nextDocument, targetId, path, value)
    ), document);
  }
  return patchPlayableEditorSceneGameObjectsField(
    document,
    uniqueTargetIds,
    path,
    value,
    EDITOR_SCENE_FIELD_MUTATION_OPTIONS,
  ) as EditorSceneDocument;
}

function patchEditorSceneGameObjectsMetadataField(
  document: EditorSceneDocument,
  targetIds: readonly string[],
  path: string,
  value: unknown,
): EditorSceneDocument {
  const targetIdSet = new Set(targetIds);
  const normalizedValue = normalizeEditorSceneInspectorValue(path, value);
  let changed = false;
  const gameObjects = document.scene.gameObjects.map((entry) => {
    if (!targetIdSet.has(entry.id)) return entry;
    if (!validateEditorSceneInspectorValue(document, entry, path, normalizedValue).ok) return entry;
    if (isBlockedEditorSceneSystemFieldPatch(document, entry.id, path, normalizedValue)) return entry;
    const next = structuredClone(entry);
    applyJsonFieldPatch(next as unknown as Record<string, unknown>, path, normalizedValue);
    if (next.metadata && Object.keys(next.metadata).length === 0) delete next.metadata;
    changed = true;
    return next;
  });
  if (!changed) return document;
  return {
    ...document,
    scene: {
      ...document.scene,
      gameObjects,
    },
  };
}

function patchEditorSceneMaterialAssetField(
  document: EditorSceneDocument,
  materialAssetId: string,
  path: string,
  value: unknown,
): EditorSceneDocument {
  return patchPlayableEditorSceneMaterialAssetField(
    document,
    materialAssetId,
    path,
    value,
  ) as EditorSceneDocument;
}

function patchEditorScenePrefabAssetField(
  document: EditorSceneDocument,
  assetId: string,
  path: string,
  value: unknown,
): EditorSceneDocument {
  const normalizedValue = normalizeEditorScenePrefabAssetFieldValue(path, value);
  if (normalizedValue === INVALID_EDITOR_SCENE_PREFAB_FIELD_VALUE) return document;
  let changed = false;
  const assets = document.assets.map((asset) => {
    if (asset.id !== assetId || !isPlayableEditorScenePrefabAsset(asset)) return asset;
    changed = true;
    if (path === 'displayName') {
      return {
        ...asset,
        displayName: normalizedValue as string,
      };
    }
    if (path === 'prefab.defaults.active') {
      return patchEditorScenePrefabAssetDefaults(asset, {
        ...asset.prefab.defaults,
        active: normalizedValue as boolean,
      });
    }
    if (path === 'prefab.defaults.shadowMode') {
      const defaults: PlayableEditorScenePrefabDefaults = {
        ...asset.prefab.defaults,
      };
      if (normalizedValue == null) delete defaults.shadowMode;
      else defaults.shadowMode = normalizedValue as PlayableEditorScenePrefabDefaults['shadowMode'];
      return patchEditorScenePrefabAssetDefaults(asset, defaults);
    }
    if (isPlayableEditorScenePrefabOverridePath(path)) {
      return patchPlayableEditorScenePrefabOverride(asset, path, normalizedValue) as EditorSceneAsset;
    }
    return asset;
  });
  return changed ? { ...document, assets } : document;
}

function patchEditorScenePrefabAssetDefaults(
  asset: EditorSceneAsset & { prefab: NonNullable<EditorSceneAsset['prefab']> },
  defaults: PlayableEditorScenePrefabDefaults,
): EditorSceneAsset {
  const nextPrefab = {
    ...asset.prefab,
  };
  if (Object.keys(defaults).length > 0) nextPrefab.defaults = defaults;
  else delete nextPrefab.defaults;
  return {
    ...asset,
    prefab: nextPrefab,
  };
}

function createEditorSceneCreatedMaterialAsset(
  document: EditorSceneDocument,
  name?: string,
): SceneMaterialAssetConfig {
  return createPlayableEditorSceneCreatedMaterialAsset(document, name) as SceneMaterialAssetConfig;
}

function createEditorSceneDuplicatedMaterialAssetCopy(
  document: EditorSceneDocument,
  sourceMaterialAsset: SceneMaterialAssetConfig,
  name?: string,
): SceneMaterialAssetConfig {
  return createPlayableEditorSceneDuplicatedMaterialAssetCopy(document, sourceMaterialAsset, name) as SceneMaterialAssetConfig;
}

function addEditorSceneMaterialAsset(
  document: EditorSceneDocument,
  materialAsset: SceneMaterialAssetConfig,
): EditorSceneDocument {
  if (hasEditorSceneMaterialAsset(document, materialAsset.id)) return document;
  return {
    ...document,
    scene: {
      ...document.scene,
      materialAssets: [...(document.scene.materialAssets ?? []), structuredClone(materialAsset)],
    },
  };
}

function addEditorSceneMaterialAssetAndBindPrefab(
  document: EditorSceneDocument,
  prefabAssetId: string,
  bindingPath: string,
  materialAsset: SceneMaterialAssetConfig,
): EditorSceneDocument {
  const withMaterial = addEditorSceneMaterialAsset(document, materialAsset);
  return patchEditorScenePrefabAssetField(withMaterial, prefabAssetId, bindingPath, materialAsset.id);
}

function addEditorScenePrefabAsset(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset,
  sourceAsset?: EditorSceneAsset,
  options: { allowDuplicateSource?: boolean } = {},
): EditorSceneDocument {
  if (!isPlayableEditorScenePrefabAsset(prefabAsset)) return document;
  if (!options.allowDuplicateSource && findEditorScenePrefabAssetForSource(document, prefabAsset)) return document;
  const assets = [...document.assets];
  if (sourceAsset && !hasEditorSceneAssetIdentity(assets, sourceAsset)) {
    assets.push(structuredClone(sourceAsset));
  }
  if (!hasEditorSceneAssetIdentity(assets, prefabAsset)) {
    assets.push(structuredClone(prefabAsset));
  }
  return assets.length === document.assets.length ? document : { ...document, assets };
}

function resolveEditorSceneMaterialAssetDeleteState(
  document: EditorSceneDocument,
  materialAssetId: string,
) {
  return resolvePlayableEditorSceneMaterialAssetDeleteState(
    document,
    materialAssetId,
    [DEFAULT_PBR_MATERIAL_ASSET_ID, DEFAULT_STANDARD_MATERIAL_ASSET_ID],
  );
}

function deleteEditorSceneMaterialAsset(
  document: EditorSceneDocument,
  materialAssetId: string,
): EditorSceneDocument {
  return deletePlayableEditorSceneMaterialAsset(
    document,
    materialAssetId,
    [DEFAULT_PBR_MATERIAL_ASSET_ID, DEFAULT_STANDARD_MATERIAL_ASSET_ID],
  ) as EditorSceneDocument;
}

function addEditorSceneMaterialAssetAndBind(
  document: EditorSceneDocument,
  targetId: string,
  bindingPath: string,
  materialAsset: SceneMaterialAssetConfig,
): EditorSceneDocument {
  return addPlayableEditorSceneMaterialAssetAndBind(
    document,
    targetId,
    bindingPath,
    materialAsset,
  ) as EditorSceneDocument;
}

function applyJsonFieldPatch(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = splitEditorSceneFieldPath(path);
  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    const next = cursor[segment];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  const leaf = segments[segments.length - 1];
  if (!leaf) return;
  if (value == null) delete cursor[leaf];
  else cursor[leaf] = structuredClone(value);
}

function splitEditorSceneFieldPath(path: string): string[] {
  const materialSlotBinding = splitMaterialSlotBindingFieldPath(path);
  if (materialSlotBinding) return materialSlotBinding;
  const childMaterialBinding = splitChildMaterialBindingFieldPath(path);
  return childMaterialBinding ?? path.split('.').filter(Boolean);
}

function splitMaterialSlotBindingFieldPath(path: string): string[] | null {
  const prefix = 'overrides.materialSlotBindings.';
  if (!path.startsWith(prefix)) return null;
  const remainder = path.slice(prefix.length);
  const overrideMarker = '.override.';
  const overrideMarkerIndex = remainder.lastIndexOf(overrideMarker);
  if (overrideMarkerIndex >= 0) {
    const slotId = remainder.slice(0, overrideMarkerIndex);
    const suffix = remainder.slice(overrideMarkerIndex + overrideMarker.length);
    if (!slotId || !suffix) return null;
    return ['overrides', 'materialSlotBindings', slotId, 'override', ...suffix.split('.').filter(Boolean)];
  }
  const materialAssetSuffix = '.materialAssetId';
  if (remainder.endsWith(materialAssetSuffix)) {
    const slotId = remainder.slice(0, -materialAssetSuffix.length);
    if (!slotId) return null;
    return ['overrides', 'materialSlotBindings', slotId, 'materialAssetId'];
  }
  return null;
}

function splitChildMaterialBindingFieldPath(path: string): string[] | null {
  const prefix = 'overrides.childMaterialBindings.';
  if (!path.startsWith(prefix)) return null;
  const remainder = path.slice(prefix.length);
  const overrideMarker = '.override.';
  const overrideMarkerIndex = remainder.lastIndexOf(overrideMarker);
  if (overrideMarkerIndex >= 0) {
    const ownerNodePath = remainder.slice(0, overrideMarkerIndex);
    const suffix = remainder.slice(overrideMarkerIndex + overrideMarker.length);
    if (!ownerNodePath || !suffix) return null;
    return ['overrides', 'childMaterialBindings', ownerNodePath, 'override', ...suffix.split('.').filter(Boolean)];
  }
  const materialAssetSuffix = '.materialAssetId';
  if (remainder.endsWith(materialAssetSuffix)) {
    const ownerNodePath = remainder.slice(0, -materialAssetSuffix.length);
    if (!ownerNodePath) return null;
    return ['overrides', 'childMaterialBindings', ownerNodePath, 'materialAssetId'];
  }
  return null;
}


function createDefaultGroundDecal(): NonNullable<EditorSceneGameObject['groundDecal']> {
  return {
    size: { width: 1, depth: 1 },
    color: { r: 1, g: 1, b: 1 },
  };
}

function mergeGroundDecalDefaults(
  groundDecal: EditorSceneGameObject['groundDecal'],
): NonNullable<EditorSceneGameObject['groundDecal']> {
  const defaults = createDefaultGroundDecal();
  return {
    ...defaults,
    ...(groundDecal ?? {}),
    size: {
      ...defaults.size,
      ...(groundDecal?.size ?? {}),
    },
    color: groundDecal?.color
      ? { ...defaults.color, ...groundDecal.color }
      : defaults.color,
  };
}

function createDefaultEditorSceneCameraGameObject(
  rootId: string | undefined,
  usedIds: Set<string>,
): EditorSceneGameObject {
  const id = reserveEditorSceneDefaultId(usedIds, EDITOR_SCENE_MAIN_CAMERA_ID);
  return {
    id,
    guid: createEditorSceneGameObjectGuid(),
    name: 'Main Camera',
    kind: 'transform',
    ...(rootId ? { parentId: rootId } : {}),
    active: true,
    transformType: 'camera',
    camera: mergeEditorSceneCameraDefaults(undefined),
    components: [{
      type: 'Transform',
      position: { x: 0, y: 5, z: -8 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }],
  };
}

function createDefaultEditorSceneSunLightGameObject(
  rootId: string | undefined,
  usedIds: Set<string>,
): EditorSceneGameObject {
  const id = reserveEditorSceneDefaultId(usedIds, EDITOR_SCENE_SUN_LIGHT_ID);
  return {
    id,
    guid: createEditorSceneGameObjectGuid(),
    name: 'Directional Light',
    kind: 'transform',
    ...(rootId ? { parentId: rootId } : {}),
    active: true,
    transformType: 'light',
    light: mergeEditorSceneLightDefaults(undefined, 'directional'),
    components: [{
      type: 'Transform',
      position: { x: 0, y: 4, z: -3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }],
  };
}

function createDefaultEditorSceneEnvironmentLightGameObject(
  rootId: string | undefined,
  usedIds: Set<string>,
): EditorSceneGameObject {
  const id = reserveEditorSceneDefaultId(usedIds, EDITOR_SCENE_ENVIRONMENT_LIGHT_ID);
  return {
    id,
    guid: createEditorSceneGameObjectGuid(),
    name: 'Environment Light',
    kind: 'transform',
    ...(rootId ? { parentId: rootId } : {}),
    active: true,
    transformType: 'light',
    light: mergeEditorSceneLightDefaults(undefined, 'hemispheric'),
    components: [{
      type: 'Transform',
      position: { x: 0, y: 3, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }],
  };
}

function reserveEditorSceneDefaultId(usedIds: Set<string>, preferredId: string): string {
  const id = createUniqueEditorSceneId([...usedIds], preferredId);
  usedIds.add(id);
  return id;
}

function normalizeEditorSceneCameraGameObject(gameObject: EditorSceneGameObject): EditorSceneGameObject {
  const next = ensureTransformComponent({
    ...gameObject,
    kind: 'transform',
    transformType: 'camera',
    camera: mergeEditorSceneCameraDefaults(gameObject.camera),
  });
  delete next.light;
  delete next.groundDecal;
  delete next.primitive;
  return shallowEditorSceneGameObjectsEqual(next, gameObject) ? gameObject : next;
}

function normalizeEditorSceneSystemLightGameObject(
  gameObject: EditorSceneGameObject,
  type: EditorSceneLight['type'],
): EditorSceneGameObject {
  const next = ensureTransformComponent({
    ...gameObject,
    name: type === 'hemispheric' ? 'Environment Light' : 'Directional Light',
    kind: 'transform',
    transformType: 'light',
    light: mergeEditorSceneLightDefaults(gameObject.light, type),
  });
  delete next.camera;
  delete next.groundDecal;
  delete next.primitive;
  return shallowEditorSceneGameObjectsEqual(next, gameObject) ? gameObject : next;
}

function normalizeEditorScenePlainTransformGameObject(gameObject: EditorSceneGameObject): EditorSceneGameObject {
  const next = ensureTransformComponent({
    ...gameObject,
    kind: 'transform',
    transformType: 'plain',
  });
  delete next.camera;
  delete next.light;
  delete next.groundDecal;
  delete next.primitive;
  return shallowEditorSceneGameObjectsEqual(next, gameObject) ? gameObject : next;
}

function ensureTransformComponent(gameObject: EditorSceneGameObject): EditorSceneGameObject {
  if (findEditorSceneTransform(gameObject)) return gameObject;
  return {
    ...gameObject,
    components: [
      {
        type: 'Transform',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      ...gameObject.components,
    ],
  };
}

function mergeEditorSceneCameraDefaults(
  camera: EditorSceneGameObject['camera'],
): EditorSceneCameraRig {
  const defaults = DEFAULT_EDITOR_SCENE_CAMERA;
  return {
    ...defaults,
    ...(camera ?? {}),
    projection: readEditorSceneCameraProjection(camera?.projection),
    fov: readPositiveFiniteNumber(camera?.fov, defaults.fov ?? 0.85),
    targetOffset: isVec3(camera?.targetOffset)
      ? { ...camera.targetOffset }
      : { ...(defaults.targetOffset ?? { x: 0, y: 0, z: 0 }) },
    minZ: readPositiveFiniteNumber(camera?.minZ, defaults.minZ ?? 1),
    maxZ: readPositiveFiniteNumber(camera?.maxZ, defaults.maxZ ?? 10000),
    lowerBetaLimit: readFiniteNumber(camera?.lowerBetaLimit, defaults.lowerBetaLimit ?? defaults.beta),
    upperBetaLimit: readFiniteNumber(camera?.upperBetaLimit, defaults.upperBetaLimit ?? defaults.beta),
    lowerRadiusLimit: readPositiveFiniteNumber(camera?.lowerRadiusLimit, defaults.lowerRadiusLimit ?? defaults.radius),
    upperRadiusLimit: readPositiveFiniteNumber(camera?.upperRadiusLimit, defaults.upperRadiusLimit ?? defaults.radius),
    inertia: readUnitRangeNumber(camera?.inertia, defaults.inertia ?? 0.9),
    targetScreenOffset: isVec2(camera?.targetScreenOffset)
      ? { ...camera.targetScreenOffset }
      : { ...(defaults.targetScreenOffset ?? { x: 0, y: 0 }) },
    inspectorLanguage: readEditorSceneCameraInspectorLanguage(camera?.inspectorLanguage),
  };
}

function normalizeEditorSceneCameraAfterFieldPatch(
  camera: EditorSceneCameraRig,
  path: string,
): EditorSceneCameraRig {
  normalizeEditorSceneCameraRangeAfterFieldPatch(camera, path, {
    valueField: 'beta',
    lowerField: 'lowerBetaLimit',
    upperField: 'upperBetaLimit',
    minValue: Number.NEGATIVE_INFINITY,
  });
  normalizeEditorSceneCameraRangeAfterFieldPatch(camera, path, {
    valueField: 'radius',
    lowerField: 'lowerRadiusLimit',
    upperField: 'upperRadiusLimit',
    minValue: 0.001,
  });
  return camera;
}

function normalizeEditorSceneCameraRangeAfterFieldPatch(
  camera: EditorSceneCameraRig,
  path: string,
  options: {
    valueField: 'beta' | 'radius';
    lowerField: 'lowerBetaLimit' | 'lowerRadiusLimit';
    upperField: 'upperBetaLimit' | 'upperRadiusLimit';
    minValue: number;
  },
): void {
  const valuePath = `camera.${options.valueField}`;
  const lowerPath = `camera.${options.lowerField}`;
  const upperPath = `camera.${options.upperField}`;
  let value = readFiniteNumber(camera[options.valueField], DEFAULT_EDITOR_SCENE_CAMERA[options.valueField]);
  let lower = readFiniteNumber(camera[options.lowerField], value);
  let upper = readFiniteNumber(camera[options.upperField], value);
  if (Number.isFinite(options.minValue)) {
    value = Math.max(options.minValue, value);
    lower = Math.max(options.minValue, lower);
    upper = Math.max(options.minValue, upper);
  }
  if (upper < lower) {
    if (path === upperPath) lower = upper;
    else upper = lower;
  }
  if (path === lowerPath || path === upperPath) {
    value = Math.min(upper, Math.max(lower, value));
  } else if (path === valuePath) {
    if (value < lower) lower = value;
    if (value > upper) upper = value;
  }
  camera[options.valueField] = value;
  camera[options.lowerField] = lower;
  camera[options.upperField] = upper;
}

function readEditorSceneCameraProjection(value: unknown): SceneCameraProjection {
  return value === 'perspective' ? 'perspective' : 'orthographic';
}

function readEditorSceneCameraInspectorLanguage(value: unknown): EditorSceneCameraInspectorLanguage {
  return value === 'en' ? 'en' : 'zh';
}

function readEditorSceneLightInspectorLanguage(value: unknown): EditorSceneLightInspectorLanguage {
  return value === 'en' ? 'en' : 'zh';
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readPositiveFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function readUnitRangeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}

function isVec2(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { x?: unknown; y?: unknown };
  return typeof candidate.x === 'number'
    && Number.isFinite(candidate.x)
    && typeof candidate.y === 'number'
    && Number.isFinite(candidate.y);
}

function hasInvalidEditorSceneCameraRelationships(camera: EditorSceneCameraRig): boolean {
  if (camera.maxZ != null && camera.minZ != null && camera.maxZ <= camera.minZ) return true;
  if (camera.upperBetaLimit != null && camera.lowerBetaLimit != null && camera.upperBetaLimit < camera.lowerBetaLimit) return true;
  if (camera.upperRadiusLimit != null && camera.lowerRadiusLimit != null && camera.upperRadiusLimit < camera.lowerRadiusLimit) return true;
  return false;
}

function readEditorSceneLightType(
  light: EditorSceneGameObject['light'],
  fallback: EditorSceneLight['type'],
): EditorSceneLight['type'] {
  if (light?.type === 'hemispheric') return 'hemispheric';
  if (light?.type === 'directional') return 'directional';
  return fallback;
}

function mergeEditorSceneLightDefaults(
  light: EditorSceneGameObject['light'],
  fallbackType: EditorSceneLight['type'] = 'directional',
): EditorSceneLight {
  return readEditorSceneLightType(light, fallbackType) === 'hemispheric'
    ? mergeEditorSceneHemisphericLightDefaults(light)
    : mergeEditorSceneDirectionalLightDefaults(light);
}

function mergeEditorSceneDirectionalLightDefaults(
  light: EditorSceneGameObject['light'],
): EditorSceneDirectionalLight {
  const defaults = DEFAULT_EDITOR_SCENE_SUN_LIGHT;
  const directional = light?.type === 'directional' ? light : undefined;
  return {
    ...defaults,
    ...(directional ?? {}),
    type: 'directional',
    direction: {
      ...defaults.direction,
      ...(directional?.direction ?? {}),
    },
    diffuseColor: directional?.diffuseColor
      ? { ...defaults.diffuseColor, ...directional.diffuseColor }
      : defaults.diffuseColor,
    inspectorLanguage: readEditorSceneLightInspectorLanguage(directional?.inspectorLanguage),
  };
}

function mergeEditorSceneHemisphericLightDefaults(
  light: EditorSceneGameObject['light'],
): EditorSceneHemisphericLight {
  const defaults = DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT;
  const hemispheric = light?.type === 'hemispheric' ? light : undefined;
  return {
    ...defaults,
    ...(hemispheric ?? {}),
    type: 'hemispheric',
    diffuseColor: hemispheric?.diffuseColor
      ? { ...defaults.diffuseColor, ...hemispheric.diffuseColor }
      : defaults.diffuseColor,
    groundColor: hemispheric?.groundColor
      ? { ...defaults.groundColor, ...hemispheric.groundColor }
      : defaults.groundColor,
    inspectorLanguage: readEditorSceneLightInspectorLanguage(hemispheric?.inspectorLanguage),
  };
}

function shallowEditorSceneGameObjectsEqual(
  left: EditorSceneGameObject,
  right: EditorSceneGameObject,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isBlockedEditorSceneSystemFieldPatch(
  document: EditorSceneDocument,
  targetId: string,
  path: string,
  value: unknown,
): boolean {
  const target = findEditorSceneGameObject(document, targetId);
  if (!target) return false;
  const targetIsCamera = isEditorSceneCameraGameObject(target);
  const targetIsLight = isEditorSceneLightGameObject(target);
  const targetIsProtectedSystem = isEditorSceneProtectedSystemGameObject(target);
  if (path.startsWith('transform.') && targetIsProtectedSystem) return true;
  if (path.startsWith('camera.') && !targetIsCamera) return true;
  if (path.startsWith('camera.') && targetIsCamera) {
    const patchedCameraHost = { camera: mergeEditorSceneCameraDefaults(target.camera) };
    applyPlayableEditorSceneJsonFieldPatch(patchedCameraHost as unknown as Record<string, unknown>, path, value);
    patchedCameraHost.camera = normalizeEditorSceneCameraAfterFieldPatch(patchedCameraHost.camera, path);
    if (hasInvalidEditorSceneCameraRelationships(patchedCameraHost.camera)) return true;
  }
  if (path.startsWith('light.') && !targetIsLight) return true;
  if (path === 'light.type') {
    if (target.id === EDITOR_SCENE_ENVIRONMENT_LIGHT_ID && value !== 'hemispheric') return true;
    if (target.id === EDITOR_SCENE_SUN_LIGHT_ID && value !== 'directional') return true;
  }
  if (path === 'transformType') {
    if (targetIsCamera && value !== 'camera') return true;
    if (targetIsLight && value !== 'light') return true;
    if (!targetIsLight && value === 'light') return true;
    if (value === 'camera' && !targetIsCamera && hasEditorSceneCamera(document, targetId)) return true;
  }
  return false;
}

function isEditorSceneProjectionShapePath(path: string): boolean {
  return path === 'shadowMode'
    || path === 'transformType'
    || path.startsWith('rendering.')
    || path.startsWith('primitive.')
    || path.startsWith('camera.')
    || path.startsWith('light.');
}

function hasEditorSceneCamera(document: EditorSceneDocument, exceptId?: string): boolean {
  return document.scene.gameObjects.some((gameObject) => (
    gameObject.id !== exceptId && isEditorSceneCameraGameObject(gameObject)
  ));
}

export function applyEditorSceneSerializedPropertyPatch(
  document: EditorSceneDocument,
  patch: SerializedPropertyPatch,
): EditorSceneDocument {
  if (isEditorSceneRootTransformPath(patch.targetId, patch.path)) return document;
  return applyPlayableEditorSceneSerializedPropertyPatch<EditorSceneDocument>({
    document,
    patch,
    validateField: validateEditorSceneSerializedPropertyField,
  });
}

export function addAssetLibraryItemToEditorSceneDocument(
  document: EditorSceneDocument,
  assetItem: EditorSceneAssetLibraryItem,
  placement?: EditorTransformSnapshot,
): { document: EditorSceneDocument; gameObject: EditorSceneGameObject } {
  const result = addPlayableAssetLibraryItemToEditorSceneDocument(
    document,
    assetItem,
    placement,
    {
      createGameObjectGuid: () => createEditorSceneGameObjectGuid(),
      resolveLocalTransform: ({ document: targetDocument, parentId, worldTransform }) => (
        toLocalTransformForParent(targetDocument as EditorSceneDocument, parentId, worldTransform)
      ),
    },
  );
  return {
    document: result.document as EditorSceneDocument,
    gameObject: result.gameObject as EditorSceneGameObject,
  };
}

const validateEditorSceneSerializedPropertyField: PlayableEditorSceneSerializedPropertyValidator<EditorSceneDocument> = (
  input,
) => validateEditorSceneInspectorValue(
  input.document,
  input.gameObject as EditorSceneGameObject,
  input.path,
  input.value,
);

function readTransformVector(
  transform: { position: EditorSceneVec3; rotation: EditorSceneVec3; scale?: EditorSceneVec3 },
  vectorName: 'position' | 'rotation' | 'scale',
): EditorSceneVec3 {
  return readPlayableEditorSceneTransformVector(transform, vectorName);
}

function radiansToDegrees(value: number): number {
  return radiansToPlayableEditorSceneDegrees(value);
}

function degreesToRadians(value: number): number {
  return degreesToPlayableEditorSceneRadians(value);
}

function roundForInspector(value: number): number {
  return roundPlayableEditorSceneInspectorNumber(value);
}

function normalizeEditorScenePrimitiveShape(shape: unknown): ScenePrimitiveShape | null {
  return shape === 'cube' || shape === 'sphere' || shape === 'plane' || shape === 'capsule'
    ? shape
    : null;
}

function createUniqueEditorSceneId(existingIds: string[], preferredId: string): string {
  const used = new Set(existingIds);
  const base = sanitizeEditorSceneId(preferredId) || 'game_object';
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

function sanitizeEditorSceneId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'asset';
}
