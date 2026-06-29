import {
  type DocumentCommand,
  type EditorPlacementHit,
  type EditorTransformSnapshot as PlayableEditorTransformSnapshot,
  type EditorTransformTrsSnapshot,
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
  isEditorTransformTrsSnapshot,
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
  createEditorSceneHierarchyMovePatch as createPlayableEditorSceneHierarchyMovePatch,
  createEditorSceneCreatedMaterialAsset as createPlayableEditorSceneCreatedMaterialAsset,
  createEditorSceneDuplicatedMaterialAssetCopy as createPlayableEditorSceneDuplicatedMaterialAssetCopy,
  createEditorSceneDuplicateMaterialAssetForBindingPatch as createPlayableEditorSceneDuplicateMaterialAssetForBindingPatch,
  createEditorSceneMaterialAssetFieldInspectorPropertyInput as createPlayableEditorSceneMaterialAssetFieldInspectorPropertyInput,
  createEditorSceneMaterialBrowserAssetItems as createPlayableEditorSceneMaterialBrowserAssetItems,
  createEditorSceneMaterialBindingSummary as createPlayableEditorSceneMaterialBindingSummary,
  createEditorSceneMaterialPickerControlOptions as createPlayableEditorSceneMaterialPickerControlOptions,
  createEditorSceneDuplicatedPrefabDefinition as createPlayableEditorSceneDuplicatedPrefabDefinition,
  createEditorScenePrefabGroupNode as createPlayableEditorScenePrefabGroupNode,
  createEditorScenePrefabPrimitiveNode as createPlayableEditorScenePrefabPrimitiveNode,
  createEditorScenePrefabNodeFromAsset as createPlayableEditorScenePrefabNodeFromAsset,
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
  deleteEditorSceneMaterialAsset as deletePlayableEditorSceneMaterialAsset,
  deleteEditorScenePrefabNode as deletePlayableEditorScenePrefabNode,
  degreesToEditorSceneRadians as degreesToPlayableEditorSceneRadians,
  describeEditorSceneRuntimeObject as describePlayableEditorSceneRuntimeObject,
  ensureEditorScenePrefabComposition as ensurePlayableEditorScenePrefabComposition,
  ensureEditorSceneGameObjectGuids as ensurePlayableEditorSceneGameObjectGuids,
  getEditorSceneGameObjectWorldTransform as getPlayableEditorSceneGameObjectWorldTransform,
  getEditorSceneMaterialAssetDisplayName as getPlayableEditorSceneMaterialAssetDisplayName,
  getEditorSceneHierarchyItems as getPlayableEditorSceneHierarchyItems,
  findEditorSceneMaterialAsset as findPlayableEditorSceneMaterialAsset,
  findEditorSceneInspectorTextureAsset as findPlayableEditorSceneInspectorTextureAsset,
  EDITOR_SCENE_SHADOW_INSPECTOR_LANGUAGE_PATH as PLAYABLE_EDITOR_SCENE_SHADOW_INSPECTOR_LANGUAGE_PATH,
  isEditorScenePrefabAsset as isPlayableEditorScenePrefabAsset,
  isEditorScenePrefabCoreMaterialOverridePath as isPlayableEditorScenePrefabCoreMaterialOverridePath,
  isEditorSceneCameraGameObject as isPlayableEditorSceneCameraGameObject,
  isEditorSceneArtistMaterialPatchPath as isPlayableEditorSceneArtistMaterialPatchPath,
  isEditorSceneGroupLikeGameObject as isPlayableEditorSceneGroupLikeGameObject,
  isEditorSceneMaterialBindingPath as isPlayableEditorSceneMaterialBindingPath,
  isEditorSceneMaterialAssetReadonlyForInspector as isPlayableEditorSceneMaterialAssetReadonlyForInspector,
  isEditorSceneRootGameObject as isPlayableEditorSceneRootGameObject,
  isEditorSceneRootGameObjectId as isPlayableEditorSceneRootGameObjectId,
  isEditorSceneShadowMode as isPlayableEditorSceneShadowMode,
  normalizeEditorSceneFieldInspectorValue as normalizePlayableEditorSceneFieldInspectorValue,
  normalizeEditorSceneHierarchyDocument as normalizePlayableEditorSceneHierarchyDocument,
  normalizeEditorSceneMaterialAssetValue as normalizePlayableEditorSceneMaterialAssetValue,
  migrateEditorSceneDocumentRenderingAlphaIndex as migratePlayableEditorSceneDocumentRenderingAlphaIndex,
  readEditorScenePrefabRootNodeId as readPlayableEditorScenePrefabRootNodeId,
  readEditorScenePrefabNodes as readPlayableEditorScenePrefabNodes,
  radiansToEditorSceneDegrees as radiansToPlayableEditorSceneDegrees,
  parseEditorSceneDuplicateMaterialAssetValue as parsePlayableEditorSceneDuplicateMaterialAssetValue,
  parseEditorSceneMaterialAssetFieldPath as parsePlayableEditorSceneMaterialAssetFieldPath,
  patchEditorScenePrefabOverride as patchPlayableEditorScenePrefabOverride,
  patchEditorSceneMaterialAssetField as patchPlayableEditorSceneMaterialAssetField,
  collectEditorSceneChildMaterialSlots as collectPlayableEditorSceneChildMaterialSlots,
  readEditorScenePrefabOverrideProfileFieldPath as readPlayableEditorScenePrefabOverrideProfileFieldPath,
  readEditorScenePrefabNodeChildren as readPlayableEditorScenePrefabNodeChildren,
  collectEditorSceneMaterialAssetBindingIds as collectPlayableEditorSceneMaterialAssetBindingIds,
  reparentEditorScenePrefabNode as reparentPlayableEditorScenePrefabNode,
  renameEditorScenePrefabAsset as renamePlayableEditorScenePrefabAsset,
  renameEditorScenePrefabNode as renamePlayableEditorScenePrefabNode,
  resolveEditorScenePrefabInstanceRelation as resolvePlayableEditorScenePrefabInstanceRelation,
  setEditorScenePrefabNodeTransform as setPlayableEditorScenePrefabNodeTransform,
  readEditorSceneAssetMaterialSlots as readPlayableEditorSceneAssetMaterialSlots,
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
  roundEditorSceneInspectorNumber as roundPlayableEditorSceneInspectorNumber,
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
  type EditorScenePrefabNode as PlayableEditorScenePrefabNode,
  type EditorSceneReadonlyInspectorPropertyInput as PlayableEditorSceneReadonlyInspectorPropertyInput,
  type EditorSceneReadonlyInspectorSectionInput as PlayableEditorSceneReadonlyInspectorSectionInput,
  type EditorSceneRuntimeInspectorSnapshot as PlayableEditorSceneRuntimeInspectorSnapshot,
  type EditorSceneSerializedPropertyValidator as PlayableEditorSceneSerializedPropertyValidator,
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

type EditorTransformSnapshot = EditorTransformTrsSnapshot;

export type EditorSceneDocumentPatch =
  | ({ kind: 'serialized-property' } & SerializedPropertyPatch)
  | {
    kind: 'game-object.field';
    targetId: string;
    path: string;
    value: unknown;
  }
  | {
    kind: 'game-object.field-batch';
    fields: Array<{
      targetId: string;
      path: string;
      value: unknown;
    }>;
  }
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
    kind: 'scene.prefab-asset.create';
    sourceAsset: EditorSceneAsset;
    prefabAsset: EditorSceneAsset;
  }
  | {
    kind: 'scene.prefab-asset.create-from-game-object';
    sourceGameObjectId: string;
    prefabAsset: EditorSceneAsset;
  }
  | {
    kind: 'scene.prefab-asset.duplicate';
    sourcePrefabAssetId: string;
    prefabAsset: EditorSceneAsset;
  }
  | {
    kind: 'scene.prefab-asset.field';
    assetId: string;
    path: string;
    value: unknown;
  }
  | {
    kind: 'scene.prefab-asset.replace';
    assetId: string;
    prefabAsset: EditorSceneAsset;
  }
  | {
    kind: 'scene.prefab-material-asset.duplicate-and-bind';
    assetId: string;
    bindingPath: string;
    materialAsset: SceneMaterialAssetConfig;
  }
  | {
    kind: 'game-object.create-from-asset';
    assetItem: EditorSceneAssetLibraryItem;
    name?: string;
    placement?: EditorTransformSnapshot;
  }
  | {
    kind: 'game-object.transform';
    targetId: string;
    transform: EditorTransformSnapshot;
  }
  | {
    kind: 'game-object.transform-batch';
    targets: Array<{
      targetId: string;
      transform: Partial<EditorTransformSnapshot>;
    }>;
  }
  | {
    kind: 'game-object.duplicate-selection';
    gameObjects: EditorSceneGameObject[];
  }
  | {
    kind: 'game-object.rename';
    targetId: string;
    name: string;
  }
  | {
    kind: 'game-object.create-group';
    gameObject: EditorSceneGameObject;
  }
  | {
    kind: 'game-object.create-primitive';
    gameObject: EditorSceneGameObject;
  }
  | {
    kind: 'game-object.delete-subtree';
    targetIds: string[];
  }
  | {
    kind: 'game-object.reparent';
    targetId: string;
    parentId?: string;
    transform?: EditorTransformSnapshot;
  }
  | {
    kind: 'game-object.hierarchy-move';
    moves: Array<{
      targetId: string;
      parentId?: string;
      transform: EditorTransformSnapshot;
    }>;
    order: string[];
  }
  | {
    kind: 'game-object.group-selection';
    gameObject: EditorSceneGameObject;
    childIds: string[];
    childTransforms: Record<string, EditorTransformSnapshot>;
    order: string[];
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
const ASSET_MESH_SELECTION_SEPARATOR = '::assetMesh::';
const DEFAULT_PBR_MATERIAL_ASSET_ID = 'mat_default_pbr';
const DEFAULT_STANDARD_MATERIAL_ASSET_ID = 'mat_default_standard';
const DEFAULT_PBR_MATERIAL_ASSET_GUID = '00000000-0000-4000-8000-000000000001';
const DEFAULT_STANDARD_MATERIAL_ASSET_GUID = '00000000-0000-4000-8000-000000000002';
const DEFAULT_ARTIST_MATERIAL_ASSET_ID = DEFAULT_PBR_MATERIAL_ASSET_ID;
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
    if (!bakedTransform || !isEditorTransformTrsSnapshot(bakedTransform)) return gameObject;
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
    if (command.patch.kind === 'scene.prefab-asset.create') {
      return addEditorScenePrefabAsset(
        document,
        command.patch.prefabAsset,
        command.patch.sourceAsset,
      );
    }
    if (command.patch.kind === 'scene.prefab-asset.create-from-game-object') {
      return addEditorScenePrefabAsset(document, command.patch.prefabAsset);
    }
    if (command.patch.kind === 'scene.prefab-asset.duplicate') {
      return addEditorScenePrefabAsset(document, command.patch.prefabAsset);
    }
    if (command.patch.kind === 'scene.prefab-asset.field') {
      return patchEditorScenePrefabAssetField(
        document,
        command.patch.assetId,
        command.patch.path,
        command.patch.value,
      );
    }
    if (command.patch.kind === 'scene.prefab-asset.replace') {
      return replaceEditorScenePrefabAsset(
        document,
        command.patch.assetId,
        command.patch.prefabAsset,
      );
    }
    if (command.patch.kind === 'scene.prefab-material-asset.duplicate-and-bind') {
      return addEditorSceneMaterialAssetAndBindPrefabOverride(
        document,
        command.patch.assetId,
        command.patch.bindingPath,
        command.patch.materialAsset,
      );
    }
    if (command.patch.kind === 'game-object.field-batch') {
      return command.patch.fields.reduce(
        (nextDocument, field) => patchEditorSceneGameObjectsField(
          nextDocument,
          [field.targetId],
          field.path,
          field.value,
        ),
        document,
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
    const ownerNodePath = normalizeEditorSceneMaterialSlotMigrationOwnerPath(
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
  const normalizedOwnerNodePath = normalizeEditorSceneMaterialSlotMigrationOwnerPath(ownerNodePath);
  for (const [legacyOwnerNodePath, binding] of Object.entries(childMaterialBindings)) {
    if (!binding) continue;
    if (normalizeEditorSceneMaterialSlotMigrationOwnerPath(legacyOwnerNodePath) === normalizedOwnerNodePath) {
      return { ownerNodePath: legacyOwnerNodePath, binding };
    }
  }
  return null;
}

function normalizeEditorSceneMaterialSlotMigrationOwnerPath(ownerNodePath: string): string {
  return String(ownerNodePath ?? '').split('/').filter(Boolean).join('/');
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
  const transform = getPlayableEditorSceneGameObjectWorldTransform(document, gameObjectId);
  return transform && isEditorTransformTrsSnapshot(transform) ? transform : null;
}

export function toEditorSceneLocalTransformFromWorld(
  document: EditorSceneDocument,
  gameObjectId: string,
  worldTransform: PlayableEditorTransformSnapshot,
): EditorTransformSnapshot | null {
  const transform = toPlayableEditorSceneLocalTransformFromWorld(document, gameObjectId, worldTransform);
  return transform && isEditorTransformTrsSnapshot(transform) ? transform : null;
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
  targetPrefabAssetId?: string;
  nodeId?: string;
  parentNodeId?: string;
  primitiveShape?: string;
  asset?: EditorSceneAssetLibraryItem | EditorSceneAsset | null;
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

export function createEditorSceneBrowserAssetItems(editorScene: EditorSceneDocument) {
  const materialItems = createPlayableEditorSceneMaterialBrowserAssetItems(editorScene);
  const prefabItems = editorScene.assets
    .filter(isPlayableEditorScenePrefabAsset)
    .map(asset => ({
      id: `prefab:${asset.id}`,
      assetId: asset.id,
      guid: asset.guid,
      type: 'prefab',
      kind: 'prefab',
      label: asset.displayName ?? asset.id,
      displayName: asset.displayName ?? asset.id,
      category: asset.category ?? 'Prefab',
      origin: 'project',
      placeable: true,
      prefab: {
        id: asset.id,
        guid: asset.guid,
        displayName: asset.displayName ?? asset.id,
        category: asset.category ?? 'Prefab',
        ...structuredClone(asset.prefab),
      },
      metadata: structuredClone(asset.metadata ?? {}),
    }));
  return [...materialItems, ...prefabItems];
}

export function getEditorScenePrefabStageDescriptor(
  document: EditorSceneDocument,
  input: { assetId: string; browserAssetId?: string; asset?: unknown },
) {
  const assetId = input.assetId.replace(/^prefab:/, '');
  const prefabAsset = findEditorScenePrefabAsset(document, assetId);
  if (!prefabAsset?.prefab) return null;
  return {
    assetId: prefabAsset.id,
    browserAssetId: input.browserAssetId,
    label: prefabAsset.displayName ?? prefabAsset.id,
    sourceAssetId: prefabAsset.prefab.sourceAssetId,
    sourceAssetGuid: prefabAsset.prefab.sourceAssetGuid,
    readonly: false,
    previewNodeId: `prefab-stage:${prefabAsset.id}`,
  };
}

export function getEditorScenePrefabStageProjectionNodes(
  document: EditorSceneDocument,
  descriptor: { assetId: string; label: string; sourceAssetId?: string; previewNodeId?: string },
) {
  const prefabAsset = findEditorScenePrefabAsset(document, descriptor.assetId);
  const sourceAssetId = descriptor.sourceAssetId ?? prefabAsset?.prefab?.sourceAssetId;
  if (!prefabAsset?.prefab) return [];
  const sourceAsset = sourceAssetId ? document.assets.find(asset => asset.id === sourceAssetId) : null;
  const previewNodeId = descriptor.previewNodeId ?? `prefab-stage:${prefabAsset.id}`;
  const compositionNodes = createEditorScenePrefabStageCompositionProjectionNodes(document, prefabAsset, {
    previewNodeId,
    label: descriptor.label,
  });
  if (compositionNodes.length === 0) return [];
  const comparisonNodes = sourceAsset
    ? [
      {
        ...createEditorScenePrefabStageModelProjectionNode(document, prefabAsset, sourceAsset, {
          id: `${previewNodeId}:compare-clone`,
          name: `${descriptor.label} Mesh Clone`,
          position: { x: -2.4, y: 0, z: 0 },
        }),
        assetInstantiationMode: 'meshClone',
      },
      {
        ...createEditorScenePrefabStageModelProjectionNode(document, prefabAsset, sourceAsset, {
          id: `${previewNodeId}:compare-instance`,
          name: `${descriptor.label} InstanceMesh`,
          position: { x: 2.4, y: 0, z: 0 },
        }),
        assetInstantiationMode: 'instancedMesh',
      },
    ]
    : [];
  return [
    createEditorScenePrefabStageEnvironmentLightNode(),
    createEditorScenePrefabStageDirectionalLightNode(),
    ...compositionNodes,
    ...comparisonNodes,
  ];
}

export function getEditorScenePrefabStageStructure(
  document: EditorSceneDocument,
  descriptor: { assetId: string; sourceAssetId?: string },
  _context: EditorScenePrefabStageContext = {},
) {
  const prefabAsset = findEditorScenePrefabAsset(document, descriptor.assetId);
  if (!prefabAsset?.prefab) {
    return [{
      id: 'prefab-scene',
      label: 'Prefab Scene Tree',
      kind: 'root',
      children: [],
    }];
  }
  const rootNodeId = readPlayableEditorScenePrefabRootNodeId(prefabAsset);
  const rootNodes = readPlayableEditorScenePrefabNodeChildren(prefabAsset, null);
  const editableRoots = rootNodeId
    ? rootNodes.filter(node => node.id === rootNodeId)
    : rootNodes;
  return [{
    id: 'prefab-root',
    label: 'Prefab Scene Tree',
    kind: 'root',
    children: editableRoots.map(node => createEditorScenePrefabStageNodeTreeItem(prefabAsset, node)),
  }];
}

export function getEditorScenePrefabStageInspectorObject(
  document: EditorSceneDocument,
  descriptor: { assetId: string; label: string; sourceAssetId?: string },
  selectedItemId: string | null,
  context: EditorScenePrefabStageContext = {},
): InspectorObject<EditorSceneDocument> | null {
  const prefabAsset = findEditorScenePrefabAsset(document, descriptor.assetId);
  if (!prefabAsset) return null;
  const sourceAsset = descriptor.sourceAssetId
    ? document.assets.find(asset => asset.id === descriptor.sourceAssetId)
    : null;
  const selectedItem = selectedItemId
    ? findEditorScenePrefabStageStructureItem(
      getEditorScenePrefabStageStructure(document, descriptor, context),
      selectedItemId,
    ) ?? findEditorScenePrefabStageInspectorItem(document, descriptor, selectedItemId, context)
    : null;
  const materialOverrideTarget = selectedItem
    ? resolveEditorScenePrefabStageMaterialOverrideTarget(document, descriptor, selectedItem, context)
    : null;
  const materialOverrideSection = materialOverrideTarget
    ? createEditorScenePrefabMaterialOverrideInspectorSection(document, prefabAsset, materialOverrideTarget, context)
    : null;
  const sourceStructureSection = selectedItem
    ? createEditorScenePrefabSourceStructureInspectorSection(document, descriptor, selectedItem, context)
    : null;
  return {
    targetIds: [prefabAsset.id],
    activeId: prefabAsset.id,
    label: context.importStructureReady ? 'Prefab Runtime Ready' : descriptor.label,
    document,
    selection: {
      targetIds: [prefabAsset.id],
      activeId: prefabAsset.id,
      targetKind: 'prefab',
      document,
    },
    sections: [
      {
        id: 'prefab-stage',
        title: 'Prefab Stage',
        summary: context.importStructureReady ? 'Runtime Ready' : 'Preview',
        persistence: 'document',
        properties: [
          createPrefabStageEditableProperty({
            path: 'displayName',
            label: 'Display Name',
            valueType: 'string',
            control: 'string',
            value: prefabAsset.displayName ?? prefabAsset.id,
            order: 0,
          }),
          createEditorSceneReadonlyInspectorProperty({
            path: 'prefab.sourceAssetId',
            label: 'Source Asset',
            value: sourceAsset?.displayName ?? descriptor.sourceAssetId ?? 'Missing',
            order: 1,
          }),
          createPrefabStageEditableProperty({
            path: 'prefab.defaults.active',
            label: 'Default Active',
            valueType: 'boolean',
            control: 'boolean',
            value: prefabAsset.prefab?.defaults?.active ?? true,
            order: 2,
          }),
          createPrefabStageEditableProperty({
            path: 'prefab.defaults.shadowMode',
            label: 'Default Shadow Mode',
            valueType: 'enum',
            control: 'enum',
            value: prefabAsset.prefab?.defaults?.shadowMode ?? 'default',
            options: PREFAB_STAGE_SHADOW_MODE_OPTIONS,
            order: 3,
          }),
          createEditorSceneReadonlyInspectorProperty({
            path: 'prefab.selectedItem',
            label: 'Selected Item',
            value: selectedItemId ?? 'Preview Root',
            order: 4,
          }),
        ].filter((property): property is InspectorProperty<EditorSceneDocument> => !!property),
      },
      ...(sourceStructureSection ? [sourceStructureSection] : []),
      ...(materialOverrideSection ? [materialOverrideSection] : []),
    ],
  };
}

const PREFAB_STAGE_SHADOW_MODE_OPTIONS = [
  { label: 'Project Default', value: 'default' },
  { label: 'No Shadow', value: 'none' },
  { label: 'Blob Shadow', value: 'blob' },
  { label: 'Static Baked Shadow', value: 'static' },
  { label: 'Planar Shadow', value: 'planar' },
] as const;

function createPrefabStageEditableProperty(input: {
  path: string;
  label: string;
  valueType: InspectorProperty<EditorSceneDocument>['valueType'];
  control: InspectorProperty<EditorSceneDocument>['control'];
  value: unknown;
  order: number;
  options?: InspectorProperty<EditorSceneDocument>['options'];
}): InspectorProperty<EditorSceneDocument> {
  return {
    path: input.path,
    label: input.label,
    valueType: input.valueType,
    control: input.control,
    value: input.value,
    readOnly: false,
    persistence: 'document',
    commitMode: input.control === 'string' ? 'blur' : 'immediate',
    order: input.order,
    ...(input.options ? { options: input.options } : {}),
    validate: (value: unknown) => validateEditorScenePrefabAssetFieldValue(
      input.path,
      normalizeEditorScenePrefabAssetFieldValue(input.path, value),
    )
      ? { ok: true, value: normalizeEditorScenePrefabAssetFieldValue(input.path, value) }
      : { ok: false, message: `Invalid prefab field: ${input.path}.` },
    coerce: (value: unknown) => normalizeEditorScenePrefabAssetFieldValue(input.path, value),
  };
}

function createEditorScenePrefabSourceStructureInspectorSection(
  document: EditorSceneDocument,
  descriptor: { assetId: string; sourceAssetId?: string },
  selectedItem: EditorScenePrefabStageStructureItem,
  context: EditorScenePrefabStageContext,
): InspectorSection<EditorSceneDocument> | null {
  if (selectedItem.itemType !== 'prefab-node') return null;
  if (selectedItem.kind !== 'model') return null;
  const sourceAssetId = typeof selectedItem.sourceAssetId === 'string' ? selectedItem.sourceAssetId : null;
  if (!sourceAssetId) return null;
  const sourceAsset = document.assets.find(asset => asset.id === sourceAssetId);
  const materialSlots = createEditorScenePrefabStageMaterialSlotItems(sourceAsset);
  const runtimeNodeCount = readEditorSceneImportArray(context.importStructure, 'nodes').length;
  const runtimeMaterialCount = readEditorSceneImportArray(context.importStructure, 'materials').length;
  const runtimeTextureCount = readEditorSceneImportArray(context.importStructure, 'textures').length;
  const runtimeAnimationCount = readEditorSceneImportArray(context.importStructure, 'animations').length;
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createReadonlyInspectorProperty(
      'prefab.sourceStructure.sourceAsset',
      'Source Asset',
      sourceAsset?.displayName ?? sourceAssetId,
      0,
    ),
    createReadonlyInspectorProperty(
      'prefab.sourceStructure.assetId',
      'Asset ID',
      sourceAssetId,
      1,
    ),
  ];
  if (sourceAsset?.metadata?.relativePath) {
    properties.push(createReadonlyInspectorProperty(
      'prefab.sourceStructure.relativePath',
      'Relative Path',
      String(sourceAsset.metadata.relativePath),
      2,
    ));
  }
  properties.push(
    createReadonlyInspectorProperty(
      'prefab.sourceStructure.materialSlots',
      'Material Slots',
      String(materialSlots.length),
      10,
    ),
    createReadonlyInspectorProperty(
      'prefab.sourceStructure.runtimeNodes',
      'Runtime Nodes',
      String(runtimeNodeCount),
      20,
    ),
    createReadonlyInspectorProperty(
      'prefab.sourceStructure.runtimeMaterials',
      'Runtime Materials',
      String(runtimeMaterialCount),
      21,
    ),
    createReadonlyInspectorProperty(
      'prefab.sourceStructure.runtimeTextures',
      'Runtime Textures',
      String(runtimeTextureCount),
      22,
    ),
    createReadonlyInspectorProperty(
      'prefab.sourceStructure.runtimeAnimations',
      'Runtime Animations',
      String(runtimeAnimationCount),
      23,
    ),
  );
  if (materialSlots.length > 0) {
    properties.push(createReadonlyInspectorProperty(
      'prefab.sourceStructure.materialSlotSummary',
      'Material Slot Summary',
      materialSlots.map(slot => slot.label).join(', '),
      30,
    ));
  }
  return {
    id: 'prefab-source-structure',
    title: 'Source Structure',
    summary: sourceAsset ? 'Readonly GLB / glTF anatomy' : 'Missing source asset',
    persistence: 'readonly',
    effect: sourceAsset ? 'active' : 'unsupported',
    properties,
  };
}

function resolveEditorScenePrefabStageMaterialOverrideTarget(
  document: EditorSceneDocument,
  descriptor: { assetId: string; sourceAssetId?: string },
  selectedItem: EditorScenePrefabStageStructureItem,
  context: EditorScenePrefabStageContext,
): EditorScenePrefabStageStructureItem | null {
  if (
    selectedItem.itemType === 'prefab-material-slot'
    || selectedItem.itemType === 'runtime-material'
    || selectedItem.itemType === 'runtime-texture'
  ) {
    return selectedItem;
  }
  if (selectedItem.itemType !== 'prefab-node' || selectedItem.kind !== 'model') return null;
  const sourceAssetId = typeof selectedItem.sourceAssetId === 'string'
    ? selectedItem.sourceAssetId
    : descriptor.sourceAssetId;
  if (!sourceAssetId) return null;
  const sourceAsset = document.assets.find(asset => asset.id === sourceAssetId);
  const materialSlotItems = createEditorScenePrefabStageMaterialSlotItems(sourceAsset);
  if (materialSlotItems.length > 0) return materialSlotItems[0] ?? null;
  const runtimeMaterialGroup = hasEditorScenePrefabStageRuntimeStructure(context.importStructure)
    ? createEditorScenePrefabStageRuntimeGroups(context.importStructure)
      .find(group => group.id === 'prefab-import-materials')
    : null;
  return runtimeMaterialGroup?.children?.[0] ?? null;
}

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

export function createEditorSceneAssetActionPatch(
  input: EditorSceneAssetActionPatchInput,
): { patch: EditorSceneDocumentPatch; label: string; changedId?: string; createdId?: string; changedIds?: string[]; reprojectIds?: string[] } | null {
  if (input.actionId === 'asset.create-prefab') {
    const sourceAsset = createEditorSceneSourceAssetFromActionInput(input);
    if (!sourceAsset || sourceAsset.type === 'prefab' || hasEditorScenePrefabForSourceAsset(input.document, sourceAsset.id)) return null;
    const prefabAsset = createEditorScenePrefabDefinitionFromAsset(input.document, sourceAsset);
    return {
      label: `Create prefab ${prefabAsset.displayName ?? prefabAsset.id}`,
      patch: {
        kind: 'scene.prefab-asset.create',
        sourceAsset,
        prefabAsset,
      },
      createdId: prefabAsset.id,
    };
  }
  if (input.actionId === 'asset.create-prefab-from-game-object') {
    if (!input.activeId) return null;
    const prefabAsset = createEditorScenePrefabDefinitionFromGameObject(input.document, input.activeId);
    if (!prefabAsset || hasEditorScenePrefabForSourceAsset(input.document, prefabAsset.prefab?.sourceAssetId)) return null;
    return {
      label: `Create prefab ${prefabAsset.displayName ?? prefabAsset.id} from ${input.activeId}`,
      patch: {
        kind: 'scene.prefab-asset.create-from-game-object',
        sourceGameObjectId: input.activeId,
        prefabAsset,
      },
      changedId: input.activeId,
      createdId: prefabAsset.id,
      changedIds: [input.activeId],
      reprojectIds: [input.activeId],
    };
  }
  if (input.actionId === 'asset.duplicate-prefab') {
    if (!input.assetId) return null;
    const prefabAsset = createEditorSceneDuplicatedPrefabDefinition(input.document, input.assetId);
    if (!prefabAsset) return null;
    const source = input.document.assets.find(asset => asset.id === input.assetId);
    return {
      label: `Duplicate prefab ${source?.displayName ?? source?.id ?? input.assetId}`,
      patch: {
        kind: 'scene.prefab-asset.duplicate',
        sourcePrefabAssetId: input.assetId,
        prefabAsset,
      },
      createdId: prefabAsset.id,
    };
  }
  if (input.actionId === 'asset.add-to-current-prefab') {
    if (!input.assetId || !input.targetPrefabAssetId) return null;
    const targetPrefabAsset = findEditorScenePrefabAsset(input.document, input.targetPrefabAssetId);
    const sourceAsset = createEditorSceneSourceAssetFromActionInput(input);
    const nodeCreateOptions = readEditorScenePrefabNodeCreateActionValue(input.value);
    if (!targetPrefabAsset || !sourceAsset) return null;
    const result = createPlayableEditorScenePrefabNodeFromAsset(targetPrefabAsset, sourceAsset, {
      parentId: input.parentNodeId,
      ...(nodeCreateOptions.name ? { name: nodeCreateOptions.name } : {}),
      ...(nodeCreateOptions.sourceNodePath ? { sourceNodePath: nodeCreateOptions.sourceNodePath } : {}),
      ...(nodeCreateOptions.transform ? { transform: nodeCreateOptions.transform } : {}),
    });
    if (!result.ok || !result.changed) return null;
    return {
      label: `Add ${sourceAsset.displayName ?? sourceAsset.id} to prefab ${targetPrefabAsset.displayName ?? targetPrefabAsset.id}`,
      patch: {
        kind: 'scene.prefab-asset.replace',
        assetId: targetPrefabAsset.id,
        prefabAsset: result.prefabAsset,
      },
      changedId: targetPrefabAsset.id,
      changedIds: [targetPrefabAsset.id],
      createdId: result.createdNodeId,
    };
  }
  if (input.actionId === 'prefab.node.createPrimitive') {
    if (!input.targetPrefabAssetId) return null;
    const targetPrefabAsset = findEditorScenePrefabAsset(input.document, input.targetPrefabAssetId);
    const primitiveShape = normalizeEditorScenePrimitiveShape(input.primitiveShape ?? input.value);
    const nodeCreateOptions = readEditorScenePrefabNodeCreateActionValue(input.value);
    if (!targetPrefabAsset || !primitiveShape) return null;
    const result = createPlayableEditorScenePrefabPrimitiveNode(targetPrefabAsset, {
      parentId: input.parentNodeId ?? input.nodeId,
      shape: primitiveShape,
      ...(nodeCreateOptions.name ? { name: nodeCreateOptions.name } : {}),
      ...(nodeCreateOptions.transform ? { transform: nodeCreateOptions.transform } : {}),
    });
    if (!result.ok || !result.changed) return null;
    return createEditorScenePrefabNodeMutationPatchResult(
      targetPrefabAsset,
      result.prefabAsset,
      `Create ${primitiveShape} in prefab ${targetPrefabAsset.displayName ?? targetPrefabAsset.id}`,
      {
        createdId: result.createdNodeId,
        changedId: result.selectedNodeId ?? result.createdNodeId,
      },
    );
  }
  if (input.actionId === 'prefab.node.createGroup') {
    if (!input.targetPrefabAssetId) return null;
    const targetPrefabAsset = findEditorScenePrefabAsset(input.document, input.targetPrefabAssetId);
    const nodeCreateOptions = readEditorScenePrefabNodeCreateActionValue(input.value);
    if (!targetPrefabAsset) return null;
    const result = createPlayableEditorScenePrefabGroupNode(targetPrefabAsset, {
      parentId: input.parentNodeId ?? input.nodeId,
      ...(nodeCreateOptions.name ? { name: nodeCreateOptions.name } : {}),
      ...(nodeCreateOptions.transform ? { transform: nodeCreateOptions.transform } : {}),
    });
    if (!result.ok || !result.changed) return null;
    return createEditorScenePrefabNodeMutationPatchResult(
      targetPrefabAsset,
      result.prefabAsset,
      `Create group in prefab ${targetPrefabAsset.displayName ?? targetPrefabAsset.id}`,
      {
        createdId: result.createdNodeId,
        changedId: result.selectedNodeId ?? result.createdNodeId,
      },
    );
  }
  if (input.actionId === 'prefab.node.delete') {
    if (!input.targetPrefabAssetId || !input.nodeId) return null;
    const targetPrefabAsset = findEditorScenePrefabAsset(input.document, input.targetPrefabAssetId);
    if (!targetPrefabAsset) return null;
    const result = deletePlayableEditorScenePrefabNode(targetPrefabAsset, input.nodeId);
    if (!result.ok || !result.changed) return null;
    return createEditorScenePrefabNodeMutationPatchResult(
      targetPrefabAsset,
      result.prefabAsset,
      `Delete prefab node ${input.nodeId}`,
      {
        changedId: readPlayableEditorScenePrefabRootNodeId(result.prefabAsset) ?? targetPrefabAsset.id,
      },
    );
  }
  if (input.actionId === 'prefab.node.setTransform') {
    if (!input.targetPrefabAssetId || !input.nodeId) return null;
    const targetPrefabAsset = findEditorScenePrefabAsset(input.document, input.targetPrefabAssetId);
    const transformValue = readEditorScenePrefabNodeTransformActionValue(input.value);
    if (!targetPrefabAsset || !transformValue) return null;
    const result = setPlayableEditorScenePrefabNodeTransform(targetPrefabAsset, input.nodeId, transformValue);
    if (!result.ok || !result.changed) return null;
    return createEditorScenePrefabNodeMutationPatchResult(
      targetPrefabAsset,
      result.prefabAsset,
      `Set prefab node ${input.nodeId} transform`,
      {
        changedId: result.selectedNodeId ?? input.nodeId,
      },
    );
  }
  if (input.actionId === 'prefab.node.reparent') {
    if (!input.targetPrefabAssetId || !input.nodeId || !input.parentNodeId) return null;
    const targetPrefabAsset = findEditorScenePrefabAsset(input.document, input.targetPrefabAssetId);
    if (!targetPrefabAsset) return null;
    const result = reparentPlayableEditorScenePrefabNode(targetPrefabAsset, input.nodeId, input.parentNodeId);
    if (!result.ok || !result.changed) return null;
    return createEditorScenePrefabNodeMutationPatchResult(
      targetPrefabAsset,
      result.prefabAsset,
      `Reparent prefab node ${input.nodeId}`,
      {
        changedId: result.selectedNodeId ?? input.nodeId,
      },
    );
  }
  if (input.actionId === 'prefab.node.rename') {
    if (!input.targetPrefabAssetId || !input.nodeId) return null;
    const targetPrefabAsset = findEditorScenePrefabAsset(input.document, input.targetPrefabAssetId);
    if (!targetPrefabAsset) return null;
    const result = renamePlayableEditorScenePrefabNode(targetPrefabAsset, input.nodeId, input.value);
    if (!result.ok || !result.changed) return null;
    return createEditorScenePrefabNodeMutationPatchResult(
      targetPrefabAsset,
      result.prefabAsset,
      `Rename prefab node ${input.nodeId}`,
      {
        changedId: result.selectedNodeId ?? input.nodeId,
      },
    );
  }
  if (input.actionId === 'asset.rename') {
    if (!input.assetId) return null;
    const result = renamePlayableEditorScenePrefabAsset(input.document, input.assetId, input.value);
    if (!result.ok || !result.changed) return null;
    return {
      label: `Rename prefab ${input.assetId}`,
      patch: {
        kind: 'scene.prefab-asset.replace',
        assetId: input.assetId,
        prefabAsset: result.prefabAsset as EditorSceneAsset,
      },
      changedId: input.assetId,
      changedIds: [input.assetId],
    };
  }
  if (input.actionId === 'asset.edit-prefab-field') {
    if (!input.assetId) return null;
    const prefabAsset = findEditorScenePrefabAsset(input.document, input.assetId);
    if (!prefabAsset) return null;
    const fieldPath = typeof input.fieldPath === 'string' ? input.fieldPath.trim() : '';
    if (fieldPath === 'displayName') {
      const result = renamePlayableEditorScenePrefabAsset(input.document, input.assetId, input.value);
      if (!result.ok || !result.changed) return null;
      return {
        label: `Rename prefab ${input.assetId}`,
        patch: {
          kind: 'scene.prefab-asset.replace',
          assetId: input.assetId,
          prefabAsset: result.prefabAsset as EditorSceneAsset,
        },
        changedId: input.activeId ?? input.assetId,
        changedIds: [input.assetId],
      };
    }
    const duplicateMaterialAssetId = parseDuplicateMaterialAssetValue(input.value);
    if (duplicateMaterialAssetId && isEditorScenePrefabMaterialAssetIdOverridePath(fieldPath)) {
      const sourceMaterialAsset = findEditorSceneMaterialAsset(input.document, duplicateMaterialAssetId);
      if (!sourceMaterialAsset) return null;
      const materialAsset = createEditorSceneDuplicatedMaterialAssetCopy(
        input.document,
        sourceMaterialAsset,
        `${prefabAsset.displayName ?? prefabAsset.id} - ${sourceMaterialAsset.name ?? sourceMaterialAsset.id}`,
      );
      return {
        label: `Duplicate material ${sourceMaterialAsset.name ?? sourceMaterialAsset.id} for prefab ${prefabAsset.displayName ?? prefabAsset.id}`,
        patch: {
          kind: 'scene.prefab-material-asset.duplicate-and-bind',
          assetId: input.assetId,
          bindingPath: fieldPath,
          materialAsset,
        },
        createdId: materialAsset.id,
      };
    }
    const normalizedValue = normalizeEditorScenePrefabAssetFieldValue(fieldPath, input.value);
    if (!validateEditorScenePrefabAssetFieldValue(fieldPath, normalizedValue)) return null;
    return {
      label: `Edit prefab ${prefabAsset.displayName ?? prefabAsset.id} ${fieldPath}`,
      patch: {
        kind: 'scene.prefab-asset.field',
        assetId: input.assetId,
        path: fieldPath,
        value: normalizedValue,
      },
      changedId: input.activeId ?? undefined,
    };
  }
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

function createEditorSceneSourceAssetFromActionInput(
  input: EditorSceneAssetActionPatchInput,
): EditorSceneAsset | null {
  if (input.asset && typeof input.asset === 'object') {
    const rawAsset = input.asset as Record<string, unknown>;
    if (typeof rawAsset.assetId === 'string') {
      return createPlayableEditorSceneAssetFromLibraryItem(input.asset as EditorSceneAssetLibraryItem) as EditorSceneAsset;
    }
    if (typeof rawAsset.id === 'string') return structuredClone(input.asset as EditorSceneAsset);
  }
  if (!input.assetId) return null;
  const documentAsset = input.document.assets.find(asset => asset.id === input.assetId);
  return documentAsset ? structuredClone(documentAsset) : null;
}

function createEditorScenePrefabNodeMutationPatchResult(
  targetPrefabAsset: EditorSceneAsset,
  prefabAsset: EditorSceneAsset,
  label: string,
  ids: { createdId?: string; changedId?: string | null } = {},
): { patch: EditorSceneDocumentPatch; label: string; changedId?: string; createdId?: string; changedIds: string[] } {
  return {
    label,
    patch: {
      kind: 'scene.prefab-asset.replace',
      assetId: targetPrefabAsset.id,
      prefabAsset,
    },
    ...(ids.changedId ? { changedId: ids.changedId } : {}),
    ...(ids.createdId ? { createdId: ids.createdId } : {}),
    changedIds: [targetPrefabAsset.id],
  };
}

function readEditorScenePrefabNodeTransformActionValue(
  value: unknown,
): NonNullable<PlayableEditorScenePrefabNode['transform']> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.type !== 'Transform') return null;
  if (record.mode === 'matrix' && 'matrix' in record) {
    return structuredClone(record) as unknown as NonNullable<PlayableEditorScenePrefabNode['transform']>;
  }
  if (!isEditorSceneVec3Like(record.position) || !isEditorSceneVec3Like(record.rotation)) return null;
  return {
    type: 'Transform',
    position: { ...record.position },
    rotation: { ...record.rotation },
    ...(isEditorSceneVec3Like(record.scale) ? { scale: { ...record.scale } } : {}),
  };
}

function readEditorScenePrefabNodeCreateActionValue(
  value: unknown,
): {
  name?: string;
  sourceNodePath?: string;
  transform?: NonNullable<PlayableEditorScenePrefabNode['transform']>;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : undefined;
  const sourceNodePath = typeof record.sourceNodePath === 'string' && record.sourceNodePath.trim()
    ? record.sourceNodePath.trim()
    : undefined;
  const transform = readEditorScenePrefabNodeTransformActionValue(record.transform);
  return {
    ...(name ? { name } : {}),
    ...(sourceNodePath ? { sourceNodePath } : {}),
    ...(transform ? { transform } : {}),
  };
}

function isEditorSceneVec3Like(value: unknown): value is EditorSceneVec3 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<EditorSceneVec3>;
  return typeof record.x === 'number'
    && Number.isFinite(record.x)
    && typeof record.y === 'number'
    && Number.isFinite(record.y)
    && typeof record.z === 'number'
    && Number.isFinite(record.z);
}

function createEditorScenePrefabStageEnvironmentLightNode() {
  return {
    id: 'prefab-stage:environment-light',
    name: 'Prefab Stage Environment Light',
    parentId: null,
    runtimeKind: 'light',
    asset: null,
    primitive: null,
    light: {
      type: 'hemispheric',
      intensity: 0.7,
      direction: { x: 0, y: 1, z: 0 },
      diffuseColor: { r: 1, g: 1, b: 1 },
      groundColor: { r: 0.28, g: 0.32, b: 0.38 },
      helperVisible: false,
    },
  };
}

function createEditorScenePrefabStageDirectionalLightNode() {
  return {
    id: 'prefab-stage:directional-light',
    name: 'Prefab Stage Directional Light',
    parentId: null,
    runtimeKind: 'light',
    asset: null,
    primitive: null,
    light: {
      type: 'directional',
      intensity: 1.5,
      direction: { x: -0.3, y: -1, z: -0.2 },
      diffuseColor: { r: 1, g: 0.92, b: 0.78 },
      helperVisible: false,
    },
  };
}

function createEditorScenePrefabStageModelProjectionNode(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset,
  sourceAsset: EditorSceneAsset,
  input: { id: string; name: string; position: EditorSceneVec3 },
) {
  const gameObject: EditorSceneGameObject = {
    id: input.id,
    name: input.name,
    kind: 'instance',
    active: prefabAsset.prefab?.defaults?.active ?? true,
    ...(prefabAsset.prefab?.defaults?.shadowMode ? { shadowMode: prefabAsset.prefab.defaults.shadowMode } : {}),
    overrides: structuredClone(prefabAsset.prefab?.overrides ?? {}) as EditorSceneGameObject['overrides'],
    components: [{
      type: 'Transform',
      position: input.position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }, {
      type: 'ModelRenderer',
      assetId: sourceAsset.id,
    }],
    prefab: {
      prefabId: prefabAsset.id,
      ...(prefabAsset.guid ? { prefabGuid: prefabAsset.guid } : {}),
      sourceAssetId: sourceAsset.id,
    },
  };
  return {
    ...createPlayableEditorSceneRuntimePreviewNode(document, gameObject),
    id: input.id,
    name: input.name,
    parentId: null,
  };
}

function createEditorScenePrefabStageCompositionProjectionNodes(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset,
  input: { previewNodeId: string; label: string },
): unknown[] {
  const nodes = readPlayableEditorScenePrefabNodes(prefabAsset);
  const rootNodeId = readPlayableEditorScenePrefabRootNodeId(prefabAsset);
  if (nodes.length === 0 || !rootNodeId) return [];
  const projectionNodes = nodes.flatMap((node) => {
    const projected = createEditorScenePrefabStageProjectionNodeFromCompositionNode(
      document,
      prefabAsset,
      node,
      {
        previewNodeId: input.previewNodeId,
        rootNodeId,
        fallbackRootLabel: input.label,
      },
    );
    return projected ? [projected] : [];
  });
  const hasRenderableNode = projectionNodes.some((node) => {
    const record = node as Record<string, unknown>;
    return record.asset != null || record.primitive != null || record.light != null;
  });
  return hasRenderableNode ? projectionNodes : [];
}

function createEditorScenePrefabStageProjectionNodeFromCompositionNode(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset,
  node: PlayableEditorScenePrefabNode,
  input: { previewNodeId: string; rootNodeId: string; fallbackRootLabel: string },
): unknown | null {
  const transform = createEditorScenePrefabStageNodeTransform(node);
  const parentId = node.parentId
    ? createEditorScenePrefabStageProjectionNodeId(input.previewNodeId, input.rootNodeId, node.parentId)
    : null;
  const gameObject: EditorSceneGameObject = {
    id: createEditorScenePrefabStageProjectionNodeId(input.previewNodeId, input.rootNodeId, node.id),
    name: node.name ?? (node.id === input.rootNodeId ? input.fallbackRootLabel : createEditorScenePrefabStageNodeFallbackLabel(node)),
    kind: createEditorScenePrefabStageProjectionKind(node),
    ...(parentId ? { parentId } : {}),
    active: node.defaults?.active ?? (node.id === input.rootNodeId ? prefabAsset.prefab?.defaults?.active ?? true : true),
    ...(node.defaults?.shadowMode ?? (node.id === input.rootNodeId ? prefabAsset.prefab?.defaults?.shadowMode : undefined)
      ? { shadowMode: node.defaults?.shadowMode ?? prefabAsset.prefab?.defaults?.shadowMode }
      : {}),
    components: [transform],
  };

  if (node.kind === 'model') {
    const sourceAsset = node.sourceAssetId ? document.assets.find(asset => asset.id === node.sourceAssetId) : null;
    if (!sourceAsset) return null;
    gameObject.kind = 'instance';
    gameObject.components.push({
      type: 'ModelRenderer',
      assetId: sourceAsset.id,
    });
    gameObject.overrides = structuredClone(node.overrides ?? prefabAsset.prefab?.overrides ?? {}) as EditorSceneGameObject['overrides'];
    gameObject.prefab = {
      prefabId: prefabAsset.id,
      ...(prefabAsset.guid ? { prefabGuid: prefabAsset.guid } : {}),
      sourceAssetId: sourceAsset.id,
    };
  } else if (node.kind === 'prefabInstance') {
    const childPrefabAsset = node.childPrefabId ? findEditorScenePrefabAsset(document, node.childPrefabId) : null;
    const childSourceAssetId = childPrefabAsset?.prefab?.sourceAssetId;
    const childSourceAsset = childSourceAssetId ? document.assets.find(asset => asset.id === childSourceAssetId) : null;
    if (!childPrefabAsset || !childSourceAsset) return null;
    gameObject.kind = 'instance';
    gameObject.components.push({
      type: 'ModelRenderer',
      assetId: childSourceAsset.id,
    });
    gameObject.overrides = structuredClone(node.overrides ?? childPrefabAsset.prefab?.overrides ?? {}) as EditorSceneGameObject['overrides'];
    gameObject.prefab = {
      prefabId: childPrefabAsset.id,
      ...(childPrefabAsset.guid ? { prefabGuid: childPrefabAsset.guid } : {}),
      sourceAssetId: childSourceAsset.id,
    };
  } else if (node.kind === 'primitive' && node.primitive?.shape) {
    gameObject.kind = 'primitive';
    gameObject.primitive = structuredClone(node.primitive) as EditorSceneGameObject['primitive'];
  } else if (node.kind === 'light' && node.light) {
    gameObject.kind = 'transform';
    gameObject.light = structuredClone(node.light);
  }

  return createPlayableEditorSceneRuntimePreviewNode(document, gameObject);
}

function createEditorScenePrefabStageProjectionNodeId(
  previewNodeId: string,
  rootNodeId: string,
  nodeId: string,
): string {
  return nodeId === rootNodeId ? previewNodeId : `${previewNodeId}:${nodeId}`;
}

function createEditorScenePrefabStageProjectionKind(node: PlayableEditorScenePrefabNode): EditorSceneGameObject['kind'] {
  if (node.kind === 'model' || node.kind === 'prefabInstance') return 'instance';
  if (node.kind === 'primitive') return 'primitive';
  return 'group';
}

function createEditorScenePrefabStageNodeTransform(
  node: PlayableEditorScenePrefabNode,
): NonNullable<EditorSceneGameObject['components'][number]> {
  if (node.transform?.type === 'Transform') return structuredClone(node.transform);
  return {
    type: 'Transform',
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

type EditorScenePrefabStageContext = EditorSceneInspectorContext & {
  importStructureReady?: boolean;
  importStructure?: unknown;
  previewNodeId?: string;
};

type EditorScenePrefabStageStructureItem = {
  id: string;
  label: string;
  kind: string;
  children?: EditorScenePrefabStageStructureItem[];
  [key: string]: unknown;
};

type EditorScenePrefabMaterialOverrideTarget = EditorScenePrefabStageStructureItem & {
  itemType: 'prefab-material-slot';
  bindingKind: 'slot' | 'owner-path';
  bindingPath: string;
  materialAssetIdPath: string;
  profilePathPrefix: string;
  slotId?: string;
  ownerNodePath?: string;
};

function createEditorScenePrefabStageNodeTreeItem(
  prefabAsset: EditorSceneAsset,
  node: PlayableEditorScenePrefabNode,
): EditorScenePrefabStageStructureItem {
  const children = readPlayableEditorScenePrefabNodeChildren(prefabAsset, node.id)
    .map(child => createEditorScenePrefabStageNodeTreeItem(prefabAsset, child));
  return {
    id: `prefab-node:${node.id}`,
    nodeId: node.id,
    label: node.name ?? createEditorScenePrefabStageNodeFallbackLabel(node),
    kind: node.kind,
    itemType: 'prefab-node',
    ...(node.guid ? { guid: node.guid } : {}),
    ...(node.sourceAssetId ? { sourceAssetId: node.sourceAssetId } : {}),
    ...(node.childPrefabId ? { childPrefabId: node.childPrefabId } : {}),
    ...(node.sourceNodePath ? { sourceNodePath: node.sourceNodePath } : {}),
    ...(node.transform ? { transform: structuredClone(node.transform) } : {}),
    ...(node.primitive ? { primitive: structuredClone(node.primitive) } : {}),
    ...(node.defaults && Object.keys(node.defaults).length > 0 ? { defaults: structuredClone(node.defaults) } : {}),
    ...(node.overrides && Object.keys(node.overrides).length > 0 ? { overrides: structuredClone(node.overrides) } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

function createEditorScenePrefabStageNodeFallbackLabel(
  node: PlayableEditorScenePrefabNode,
): string {
  if (node.kind === 'model') return node.sourceAssetId ?? node.id;
  if (node.kind === 'prefabInstance') return node.childPrefabId ?? node.id;
  if (node.kind === 'primitive') return node.primitive?.shape ?? node.id;
  return node.id;
}

function findEditorScenePrefabStageInspectorItem(
  document: EditorSceneDocument,
  descriptor: { assetId: string; sourceAssetId?: string },
  selectedItemId: string,
  context: EditorScenePrefabStageContext,
): EditorScenePrefabStageStructureItem | null {
  const prefabAsset = findEditorScenePrefabAsset(document, descriptor.assetId);
  const sourceAssetId = descriptor.sourceAssetId ?? prefabAsset?.prefab?.sourceAssetId;
  const sourceAsset = sourceAssetId ? document.assets.find(asset => asset.id === sourceAssetId) : null;
  const sourceItem = createEditorScenePrefabStageSourceItem(sourceAsset, sourceAssetId);
  const materialSlotItems = createEditorScenePrefabStageMaterialSlotItems(sourceAsset);
  const materialSlotGroup = createEditorScenePrefabStageMaterialSlotGroup(materialSlotItems, !!context.importStructureReady);
  const runtimeGroups = hasEditorScenePrefabStageRuntimeStructure(context.importStructure)
    ? createEditorScenePrefabStageRuntimeGroups(context.importStructure)
    : [];
  return findEditorScenePrefabStageStructureItem(
    [
      sourceItem,
      ...(materialSlotGroup ? [materialSlotGroup] : []),
      ...runtimeGroups,
    ],
    selectedItemId,
  );
}

function createEditorScenePrefabStageSourceItem(
  sourceAsset: EditorSceneAsset | undefined | null,
  sourceAssetId: string | undefined,
): EditorScenePrefabStageStructureItem {
  return {
    id: 'prefab-source',
    label: sourceAsset?.displayName ?? sourceAssetId ?? 'Missing source asset',
    kind: 'source',
    sourceAssetId,
    ...(sourceAsset?.metadata?.relativePath ? { meta: sourceAsset.metadata.relativePath } : {}),
  };
}

function createEditorScenePrefabStageMaterialSlotGroup(
  slots: readonly EditorScenePrefabMaterialOverrideTarget[],
  runtimeReady: boolean,
): EditorScenePrefabStageStructureItem | null {
  if (slots.length === 0) return null;
  return {
    id: 'prefab-material-slots',
    label: `${runtimeReady ? 'Editable Material Slots' : 'Meshes / Materials'} (${slots.length})`,
    kind: 'group',
    children: [...slots],
  };
}

function createEditorScenePrefabStageMaterialSlotItems(
  sourceAsset: EditorSceneAsset | undefined | null,
): EditorScenePrefabMaterialOverrideTarget[] {
  const rawSlots = Array.isArray(sourceAsset?.metadata?.materialSlots) ? sourceAsset.metadata.materialSlots : [];
  return rawSlots
    .map(readEditorScenePrefabStageMaterialSlot)
    .filter((slot): slot is EditorSceneChildMaterialSlot => !!slot)
    .map((slot, index) => {
      const ownerNodePath = normalizeEditorScenePrefabStageOwnerNodePath(slot.ownerNodePath);
      const sourceMaterialIndices = collectEditorSceneSlotSourceMaterialIndices(slot);
      const sourceMaterialNames = sourceMaterialIndices
        .map(sourceMaterialIndex => getEditorSceneSlotSourceMaterialName(slot, sourceMaterialIndex))
        .filter((name): name is string => !!name);
      if (sourceMaterialNames.length === 0 && slot.materialNames?.length) {
        sourceMaterialNames.push(...slot.materialNames.filter((name): name is string => typeof name === 'string' && !!name.trim()));
      }
      if (sourceMaterialNames.length === 0 && slot.materialName) {
        sourceMaterialNames.push(slot.materialName);
      }
      const bindingPath = slot.slotId
        ? `prefab.overrides.materialSlotBindings.${slot.slotId}`
        : `prefab.overrides.childMaterialBindings.${ownerNodePath}`;
      const sourceMaterialIndex = typeof slot.sourceMaterialIndex === 'number' ? slot.sourceMaterialIndex : undefined;
      const label = slot.label
        ?? sourceMaterialNames[0]
        ?? ownerNodePath.split('/').filter(Boolean).pop()
        ?? `Material Slot ${index + 1}`;
      const idBase = createEditorScenePrefabStageStableId(slot.slotId ?? ownerNodePath, `material_slot_${index + 1}`);
      return {
        id: `prefab-material-slot:${idBase}:${index + 1}`,
        itemType: 'prefab-material-slot',
        label,
        kind: 'material',
        bindingKind: slot.slotId ? 'slot' : 'owner-path',
        bindingPath,
        materialAssetIdPath: `${bindingPath}.materialAssetId`,
        profilePathPrefix: `${bindingPath}.override`,
        ...(slot.slotId ? { slotId: slot.slotId } : {}),
        ownerNodePath,
        ...(typeof slot.nodeIndex === 'number' ? { nodeIndex: slot.nodeIndex } : {}),
        ...(typeof slot.meshIndex === 'number' ? { meshIndex: slot.meshIndex } : {}),
        ...(typeof slot.primitiveIndex === 'number' ? { primitiveIndex: slot.primitiveIndex } : {}),
        ...(sourceMaterialIndex == null ? {} : { sourceMaterialIndex }),
        ...(sourceMaterialIndices.length > 0 ? { sourceMaterialIndices } : {}),
        ...(sourceMaterialNames[0] ? { sourceMaterialName: sourceMaterialNames[0] } : {}),
        ...(sourceMaterialNames.length > 0 ? { sourceMaterialNames } : {}),
        meta: [
          ownerNodePath,
          sourceMaterialNames.length > 0 ? sourceMaterialNames.join(', ') : null,
        ].filter(Boolean).join(' - '),
      };
    });
}

function readEditorScenePrefabStageMaterialSlot(value: unknown): EditorSceneChildMaterialSlot | null {
  const source = readEditorSceneRecord(value);
  if (!source) return null;
  const slotId = readEditorSceneString(source.slotId);
  const ownerNodePath = normalizeEditorScenePrefabStageOwnerNodePath(readEditorSceneString(source.ownerNodePath) ?? '');
  if (!slotId && !ownerNodePath) return null;
  const sourceMaterialIndices = readEditorSceneNumberArray(source.sourceMaterialIndices);
  const materialNames = readEditorSceneStringArray(source.materialNames);
  const sourceMaterialProfiles = Array.isArray(source.sourceMaterialProfiles)
    ? source.sourceMaterialProfiles
      .map((profile) => {
        const record = readEditorSceneRecord(profile);
        if (!record || typeof record.sourceMaterialIndex !== 'number') return null;
        return {
          sourceMaterialIndex: record.sourceMaterialIndex,
          ...(readEditorSceneString(record.materialName) ? { materialName: readEditorSceneString(record.materialName)! } : {}),
          ...(record.profile && typeof record.profile === 'object' ? { profile: record.profile as ArtistMaterialProfile } : {}),
        } satisfies EditorSceneSourceMaterialProfile;
      })
      .filter((profile): profile is EditorSceneSourceMaterialProfile => !!profile)
    : undefined;
  return {
    ...(slotId ? { slotId } : {}),
    ownerNodePath,
    ...(readEditorSceneString(source.label) ? { label: readEditorSceneString(source.label)! } : {}),
    ...(typeof source.nodeIndex === 'number' ? { nodeIndex: source.nodeIndex } : {}),
    ...(typeof source.meshIndex === 'number' ? { meshIndex: source.meshIndex } : {}),
    ...(typeof source.primitiveIndex === 'number' ? { primitiveIndex: source.primitiveIndex } : {}),
    ...(typeof source.sourceMaterialIndex === 'number' ? { sourceMaterialIndex: source.sourceMaterialIndex } : {}),
    ...(sourceMaterialIndices.length > 0 ? { sourceMaterialIndices } : {}),
    ...(readEditorSceneString(source.materialName) ? { materialName: readEditorSceneString(source.materialName)! } : {}),
    ...(materialNames.length > 0 ? { materialNames } : {}),
    ...(sourceMaterialProfiles && sourceMaterialProfiles.length > 0 ? { sourceMaterialProfiles } : {}),
  };
}

function hasEditorScenePrefabStageRuntimeStructure(importStructure: unknown): boolean {
  return ['nodes', 'materials', 'textures', 'animations']
    .some(key => readEditorSceneImportArray(importStructure, key).length > 0);
}

function createEditorScenePrefabStageRuntimeGroups(importStructure: unknown): EditorScenePrefabStageStructureItem[] {
  const groups: EditorScenePrefabStageStructureItem[] = [];
  const nodes = readEditorSceneImportArray(importStructure, 'nodes');
  if (nodes.length > 0) {
    groups.push({
      id: 'prefab-import-nodes',
      label: `Nodes (${nodes.length})`,
      kind: 'group',
      children: createEditorScenePrefabStageRuntimeNodeTree(nodes),
    });
  }
  const materials = readEditorSceneImportArray(importStructure, 'materials');
  if (materials.length > 0) {
    groups.push({
      id: 'prefab-import-materials',
      label: `Materials (${materials.length})`,
      kind: 'group',
      children: materials.map((material, index) => createEditorScenePrefabStageRuntimeLeaf(material, index, 'material')),
    });
  }
  const textures = readEditorSceneImportArray(importStructure, 'textures');
  if (textures.length > 0) {
    groups.push({
      id: 'prefab-import-textures',
      label: `Textures (${textures.length})`,
      kind: 'group',
      children: textures.map((texture, index) => createEditorScenePrefabStageRuntimeLeaf(texture, index, 'texture')),
    });
  }
  const animations = readEditorSceneImportArray(importStructure, 'animations');
  if (animations.length > 0) {
    groups.push({
      id: 'prefab-import-animations',
      label: `Animations (${animations.length})`,
      kind: 'group',
      children: animations.map((animation, index) => createEditorScenePrefabStageRuntimeLeaf(animation, index, 'animation')),
    });
  }
  return groups;
}

function createEditorScenePrefabStageRuntimeNodeTree(
  nodes: readonly Record<string, unknown>[],
): EditorScenePrefabStageStructureItem[] {
  const entries = nodes.map((node, index) => {
    const runtimeId = readEditorSceneString(node.id) ?? `runtime-node-${index + 1}`;
    const kind = readEditorSceneString(node.kind);
    const item: EditorScenePrefabStageStructureItem = {
      id: `prefab-import-node:${createEditorScenePrefabStageStableId(runtimeId, `node_${index + 1}`)}`,
      runtimeId,
      label: readEditorSceneString(node.name) ?? readEditorSceneString(node.sourceName) ?? runtimeId,
      kind: kind === 'mesh' ? 'mesh' : kind === 'root' ? 'root' : 'group',
      ...(readEditorSceneString(node.ownerNodePath) ? { ownerNodePath: readEditorSceneString(node.ownerNodePath) } : {}),
      ...(readEditorSceneString(node.sourceName) ? { sourceName: readEditorSceneString(node.sourceName) } : {}),
      ...(Array.isArray(node.materialIds) ? { materialIds: node.materialIds.filter((id): id is string => typeof id === 'string') } : {}),
      children: [],
    };
    return {
      runtimeId,
      parentId: readEditorSceneString(node.parentId),
      item,
    };
  });
  const byRuntimeId = new Map(entries.map(entry => [entry.runtimeId, entry.item]));
  const roots: EditorScenePrefabStageStructureItem[] = [];
  for (const entry of entries) {
    if (entry.parentId && byRuntimeId.has(entry.parentId)) {
      byRuntimeId.get(entry.parentId)!.children!.push(entry.item);
    } else {
      roots.push(entry.item);
    }
  }
  return roots;
}

function createEditorScenePrefabStageRuntimeLeaf(
  value: Record<string, unknown>,
  index: number,
  kind: 'material' | 'texture' | 'animation',
): EditorScenePrefabStageStructureItem {
  const runtimeId = readEditorSceneString(value.id) ?? `${kind}-${index + 1}`;
  const url = readEditorSceneString(value.url);
  const nodeIds = Array.isArray(value.nodeIds) ? value.nodeIds.filter((id): id is string => typeof id === 'string') : [];
  const textureIds = Array.isArray(value.textureIds) ? value.textureIds.filter((id): id is string => typeof id === 'string') : [];
  return {
    id: `prefab-import-${kind}:${createEditorScenePrefabStageStableId(runtimeId, `${kind}_${index + 1}`)}`,
    itemType: kind === 'material' ? 'runtime-material' : kind === 'texture' ? 'runtime-texture' : 'runtime-animation',
    runtimeId,
    label: readEditorSceneString(value.name) ?? runtimeId,
    kind,
    ...(readEditorSceneString(value.kind) ? { runtimeKind: readEditorSceneString(value.kind) } : {}),
    ...(url ? { url } : {}),
    ...(nodeIds.length > 0 ? { nodeIds } : {}),
    ...(textureIds.length > 0 ? { textureIds } : {}),
    meta: [
      readEditorSceneString(value.kind),
      url,
      nodeIds.length > 0 ? `${nodeIds.length} node${nodeIds.length === 1 ? '' : 's'}` : null,
      textureIds.length > 0 ? `${textureIds.length} texture${textureIds.length === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' - '),
  };
}

function createEditorScenePrefabMaterialOverrideInspectorSection(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset,
  selectedItem: EditorScenePrefabStageStructureItem,
  context: EditorScenePrefabStageContext,
): InspectorSection<EditorSceneDocument> | null {
  if (selectedItem.itemType === 'prefab-material-slot') {
    return createEditorSceneEditablePrefabMaterialOverrideInspectorSection(
      document,
      prefabAsset,
      selectedItem as EditorScenePrefabMaterialOverrideTarget,
      context,
    );
  }
  if (selectedItem.itemType === 'runtime-material') {
    return createEditorSceneReadonlyPrefabMaterialOverrideInspectorSection(
      'This runtime material has no stable slotId or ownerNodePath mapping.',
      selectedItem,
    );
  }
  if (selectedItem.itemType === 'runtime-texture') {
    return createEditorSceneReadonlyPrefabMaterialOverrideInspectorSection(
      'Texture nodes are inspection-only. Edit texture channels from a stable material slot.',
      selectedItem,
    );
  }
  return null;
}

function createEditorSceneEditablePrefabMaterialOverrideInspectorSection(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset,
  target: EditorScenePrefabMaterialOverrideTarget,
  context: EditorScenePrefabStageContext,
): InspectorSection<EditorSceneDocument> {
  const text = getArtistMaterialInspectorText('en');
  const binding = readEditorScenePrefabMaterialOverrideBinding(prefabAsset, target);
  const materialAssetId = typeof binding?.materialAssetId === 'string' ? binding.materialAssetId : '';
  const materialAsset = findEditorSceneMaterialAsset(document, materialAssetId);
  const override = binding?.override ?? {};
  return {
    id: 'prefab-material-override-target',
    title: 'Prefab Material Override',
    order: 20,
    placement: 'body',
    summary: `${target.bindingKind} · Core PBR`,
    persistence: 'document',
    effect: 'active',
    collapsedByDefault: false,
    properties: [
      createReadonlyInspectorProperty('prefab.materialOverride.status', 'Status', 'Editable', 0),
      createReadonlyInspectorProperty('prefab.materialOverride.bindingPath', 'Binding Path', target.bindingPath, 1),
      createReadonlyInspectorProperty('prefab.materialOverride.materialAssetPath', 'Material Asset Path', target.materialAssetIdPath, 2),
      createReadonlyInspectorProperty('prefab.materialOverride.profilePathPrefix', 'Profile Path Prefix', target.profilePathPrefix, 3),
      createMaterialAssetSelectorInspectorProperty(document, 'instance' as SceneNodeConfig['kind'], {
        path: target.materialAssetIdPath,
        label: 'Material Asset',
        value: materialAssetId,
        order: 10,
        text,
        currentAsset: materialAsset,
      }),
      createPrefabMaterialTexturePickerInspectorProperty({
        path: `${target.profilePathPrefix}.baseColor.texture.textureAssetId`,
        label: text.assetBaseTexture,
        value: readArtistMaterialTexturePickerValue(readMaterialOverrideTexture(override, 'baseColor')),
        order: 20,
        text,
        context,
        tooltip: text.tooltips.baseTexture,
      }),
      createPrefabMaterialOverrideFieldInspectorProperty({
        path: `${target.profilePathPrefix}.baseColor.color`,
        label: text.assetBaseColor,
        value: override.baseColor?.color ?? { r: 1, g: 1, b: 1 },
        order: 21,
        valueType: 'color',
        control: 'color',
        commitMode: 'immediate',
        tooltip: text.tooltips.baseColor,
      }),
      createPrefabMaterialTexturePickerInspectorProperty({
        path: `${target.profilePathPrefix}.normal.texture.textureAssetId`,
        label: text.assetNormalTexture,
        value: readArtistMaterialTexturePickerValue(readMaterialOverrideTexture(override, 'normal')),
        order: 30,
        text,
        context,
        tooltip: text.tooltips.normalTexture,
      }),
      createPrefabMaterialOverrideNumberInspectorProperty(`${target.profilePathPrefix}.normal.strength`, text.assetNormalStrength, override.normal?.strength ?? 1, 31, 0, 4, text.tooltips.normalStrength),
      createPrefabMaterialOverrideNumberInspectorProperty(`${target.profilePathPrefix}.metallic`, text.assetMetallic, override.metallic ?? 0, 40, 0, 1, text.tooltips.metallic),
      createPrefabMaterialOverrideNumberInspectorProperty(`${target.profilePathPrefix}.roughness`, text.assetRoughness, override.roughness ?? 1, 41, 0, 1, text.tooltips.roughness),
      createPrefabMaterialOverrideFieldInspectorProperty({
        path: `${target.profilePathPrefix}.emission.color`,
        label: text.assetEmissionColor,
        value: override.emission?.color ?? { r: 0, g: 0, b: 0 },
        order: 50,
        valueType: 'color',
        control: 'color',
        commitMode: 'immediate',
        tooltip: text.tooltips.emissionColor,
      }),
      createPrefabMaterialOverrideNumberInspectorProperty(`${target.profilePathPrefix}.emission.intensity`, text.assetEmissionIntensity, override.emission?.intensity ?? 0, 51, 0, undefined, text.tooltips.emissionIntensity),
      createPrefabMaterialTexturePickerInspectorProperty({
        path: `${target.profilePathPrefix}.emission.texture.textureAssetId`,
        label: text.assetEmissionTexture,
        value: readArtistMaterialTexturePickerValue(readMaterialOverrideTexture(override, 'emission')),
        order: 52,
        text,
        context,
        tooltip: text.tooltips.emissionTexture,
      }),
    ],
  };
}

function createEditorSceneReadonlyPrefabMaterialOverrideInspectorSection(
  reason: string,
  selectedItem: EditorScenePrefabStageStructureItem,
): InspectorSection<EditorSceneDocument> {
  return {
    id: 'prefab-material-override-target',
    title: 'Prefab Material Override',
    order: 20,
    placement: 'body',
    summary: reason,
    persistence: 'readonly',
    effect: 'unsupported',
    collapsedByDefault: false,
    properties: [
      createReadonlyInspectorProperty('prefab.materialOverride.status', 'Status', 'Read Only', 0),
      createReadonlyInspectorProperty('prefab.materialOverride.reason', 'Reason', reason, 1),
      createReadonlyInspectorProperty('prefab.materialOverride.runtimeId', 'Runtime ID', selectedItem.runtimeId ?? selectedItem.id, 2),
    ],
  };
}

function createPrefabMaterialTexturePickerInspectorProperty(input: {
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
    ...createPrefabMaterialOverrideFieldInspectorProperty({
      path: input.path,
      label: input.label,
      value: input.value,
      order: input.order,
      valueType: 'string',
      control: 'custom',
      commitMode: 'change',
      tooltip: input.tooltip,
    }),
    customControl: 'asset-picker-card',
    controlOptions: {
      ...createTexturePickerControlOptions(input.context, input.text, input.value, currentTexture),
      pickerKind: 'texture',
    },
  };
}

function createPrefabMaterialOverrideNumberInspectorProperty(
  path: string,
  label: string,
  value: number,
  order: number,
  min?: number,
  max?: number,
  tooltip?: string,
): InspectorProperty<EditorSceneDocument> {
  return {
    ...createPrefabMaterialOverrideFieldInspectorProperty({
      path,
      label,
      value,
      order,
      valueType: 'number',
      control: 'number',
      commitMode: 'live',
      tooltip,
    }),
    min,
    max,
    step: 0.05,
  };
}

function createPrefabMaterialOverrideFieldInspectorProperty(input: {
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
    validate: (value) => {
      const normalized = normalizeEditorScenePrefabAssetFieldValue(input.path, value);
      return validateEditorScenePrefabAssetFieldValue(input.path, normalized)
        ? { ok: true, value: normalized }
        : { ok: false, message: `Invalid prefab material override field: ${input.path}.` };
    },
    coerce: (value) => normalizeEditorScenePrefabAssetFieldValue(input.path, value),
  };
}

function readEditorScenePrefabMaterialOverrideBinding(
  prefabAsset: EditorSceneAsset,
  target: EditorScenePrefabMaterialOverrideTarget,
): SceneNodeMaterialBindingConfig | undefined {
  if (target.slotId) return readEditorSceneMaterialBindingConfig(prefabAsset.prefab?.overrides?.materialSlotBindings?.[target.slotId]);
  if (target.ownerNodePath) return readEditorSceneMaterialBindingConfig(prefabAsset.prefab?.overrides?.childMaterialBindings?.[target.ownerNodePath]);
  return undefined;
}

function readMaterialOverrideTexture(
  override: ArtistMaterialProfile,
  channel: 'baseColor' | 'normal' | 'emission',
): { textureAssetId?: string | null; url?: string | null } | undefined {
  const texture = channel === 'baseColor'
    ? override.baseColor?.texture
    : channel === 'normal'
      ? override.normal?.texture
      : override.emission?.texture;
  return texture ?? undefined;
}

function readEditorSceneMaterialBindingConfig(value: unknown): SceneNodeMaterialBindingConfig | undefined {
  const source = readEditorSceneRecord(value);
  if (!source) return undefined;
  const binding: SceneNodeMaterialBindingConfig = {};
  const materialAssetId = readEditorSceneString(source.materialAssetId);
  if (materialAssetId) binding.materialAssetId = materialAssetId;
  if (source.override && typeof source.override === 'object' && !Array.isArray(source.override)) {
    binding.override = source.override as ArtistMaterialProfile;
  }
  return Object.keys(binding).length > 0 ? binding : undefined;
}

function findEditorScenePrefabStageStructureItem(
  items: readonly EditorScenePrefabStageStructureItem[],
  id: string,
): EditorScenePrefabStageStructureItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    const child = item.children ? findEditorScenePrefabStageStructureItem(item.children, id) : null;
    if (child) return child;
  }
  return null;
}

function readEditorSceneImportArray(importStructure: unknown, key: string): Record<string, unknown>[] {
  const source = readEditorSceneRecord(importStructure);
  const value = source?.[key];
  return Array.isArray(value)
    ? value.map(readEditorSceneRecord).filter((entry): entry is Record<string, unknown> => !!entry)
    : [];
}

function readEditorSceneRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readEditorSceneString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readEditorSceneStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(readEditorSceneString).filter((entry): entry is string => !!entry) : [];
}

function readEditorSceneNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => Number.isInteger(entry))
    : [];
}

function normalizeEditorScenePrefabStageOwnerNodePath(value: string): string {
  return value.split('/').map(part => part.trim()).filter(Boolean).join('/');
}

function createEditorScenePrefabStageStableId(value: string, fallback: string): string {
  const normalized = normalizeEditorScenePrefabStageOwnerNodePath(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function createEditorScenePrefabDefinitionFromAsset(
  document: EditorSceneDocument,
  sourceAsset: EditorSceneAsset,
): EditorSceneAsset {
  return createPlayableEditorScenePrefabDefinitionFromAsset(sourceAsset, {
    id: createUniqueEditorScenePrefabAssetId(document, `${sourceAsset.id}_prefab`),
    guid: createEditorScenePrefabGuid(),
  }) as EditorSceneAsset;
}

function createEditorScenePrefabDefinitionFromGameObject(
  document: EditorSceneDocument,
  gameObjectId: string,
): EditorSceneAsset | null {
  return createPlayableEditorScenePrefabDefinitionFromGameObject(document, gameObjectId, {
    id: createUniqueEditorScenePrefabAssetId(document, `${gameObjectId}-prefab`),
    metadata: { sourceGameObjectId: gameObjectId },
  }) as EditorSceneAsset | null;
}

function createEditorSceneDuplicatedPrefabDefinition(
  document: EditorSceneDocument,
  prefabAssetId: string,
): EditorSceneAsset | null {
  return createPlayableEditorSceneDuplicatedPrefabDefinition(document, prefabAssetId, {
    metadata: { sourcePrefabAssetId: prefabAssetId },
  }) as EditorSceneAsset | null;
}

function hasEditorScenePrefabForSourceAsset(
  document: EditorSceneDocument,
  sourceAssetId: unknown,
): boolean {
  return typeof sourceAssetId === 'string' && sourceAssetId.trim().length > 0
    ? document.assets.some(asset => isPlayableEditorScenePrefabAsset(asset) && asset.prefab.sourceAssetId === sourceAssetId)
    : false;
}

function findEditorScenePrefabAsset(
  document: EditorSceneDocument,
  assetId: string,
): EditorSceneAsset | null {
  const asset = document.assets.find(candidate => candidate.id === assetId);
  return asset && isPlayableEditorScenePrefabAsset(asset) ? asset : null;
}

function createUniqueEditorScenePrefabAssetId(
  document: EditorSceneDocument,
  preferredId: string,
): string {
  const used = new Set(document.assets.map(asset => asset.id));
  const base = normalizeEditorScenePrefabIdentifierPart(preferredId) ?? 'prefab';
  if (!used.has(base)) return base;
  let suffix = 1;
  let candidate = `${base}_${suffix}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }
  return candidate;
}

function normalizeEditorScenePrefabIdentifierPart(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_:-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
}

function createEditorScenePrefabGuid(): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `prefab_${randomId}`;
}

function normalizeEditorScenePrefabAssetFieldValue(path: string, value: unknown): unknown {
  if (path === 'displayName' && typeof value === 'string') return value.trim();
  if (path === 'prefab.defaults.active') return value == null ? null : value;
  if (path === 'prefab.defaults.shadowMode') return value == null || value === 'default' ? null : value;
  const profilePath = readPlayableEditorScenePrefabOverrideProfileFieldPath(path);
  if (profilePath) return normalizeEditorSceneMaterialAssetValue(profilePath, value);
  if (isEditorScenePrefabMaterialAssetIdOverridePath(path) && typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
}

function validateEditorScenePrefabAssetFieldValue(path: string, value: unknown): boolean {
  if (path === 'displayName') return typeof value === 'string' && value.length > 0;
  if (path === 'prefab.defaults.active') return value == null || typeof value === 'boolean';
  if (path === 'prefab.defaults.shadowMode') return value == null || isPlayableEditorSceneShadowMode(value);
  if (!isEditorScenePrefabCoreMaterialOverridePath(path)) return false;
  const profilePath = readPlayableEditorScenePrefabOverrideProfileFieldPath(path);
  if (profilePath) return validateEditorSceneMaterialAssetFieldValue(profilePath, value);
  return isEditorScenePrefabMaterialAssetIdOverridePath(path)
    && (value == null || (typeof value === 'string' && value.trim().length > 0));
}

function isEditorScenePrefabCoreMaterialOverridePath(path: string): boolean {
  return isPlayableEditorScenePrefabCoreMaterialOverridePath(path);
}

function isEditorScenePrefabMaterialAssetIdOverridePath(path: string): boolean {
  return path.startsWith('prefab.overrides.')
    && path.endsWith('.materialAssetId')
    && isEditorScenePrefabCoreMaterialOverridePath(path);
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
  world: PlayableEditorTransformSnapshot,
): EditorTransformSnapshot | null {
  const parentWorld = parentId ? getEditorSceneGameObjectWorldTransform(document, parentId) : createIdentityEditorTransform();
  return parentWorld ? toLocalTransformFromParentWorld(parentWorld, world) : null;
}

function toLocalTransformFromParentWorld(
  parentWorld: EditorTransformSnapshot,
  world: PlayableEditorTransformSnapshot,
): EditorTransformSnapshot | null {
  const transform = toEditorLocalTransformFromWorld(parentWorld, world);
  return transform && isEditorTransformTrsSnapshot(transform) ? transform : null;
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
  const prefabInstanceSection = createPrefabInstanceInspectorSection(document, gameObject);
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

function createPrefabInstanceInspectorSection(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): InspectorSection<EditorSceneDocument> | null {
  const relation = resolvePlayableEditorScenePrefabInstanceRelation(document, gameObject.id);
  if (!relation.prefab) return null;
  const errorCount = relation.diagnostics.filter(diagnostic => diagnostic.severity === 'error').length;
  const warningCount = relation.diagnostics.filter(diagnostic => diagnostic.severity === 'warning').length;
  const infoCount = relation.diagnostics.filter(diagnostic => diagnostic.severity === 'info').length;
  const hasDiagnostics = relation.diagnostics.length > 0;
  const effect: InspectorSection<EditorSceneDocument>['effect'] = errorCount > 0
    ? 'unsupported'
    : hasDiagnostics
      ? 'derived'
      : 'active';
  const disabledReason = errorCount > 0
    ? 'Prefab relation is incomplete; fix the missing definition or source asset before using prefab actions.'
    : undefined;
  const definitionLabel = relation.definition?.displayName ?? relation.definition?.id ?? relation.prefab.prefabId;
  const sourceLabel = relation.sourceAsset?.displayName
    ?? relation.sourceAsset?.id
    ?? relation.prefab.sourceAssetId
    ?? 'Missing';
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createEditorSceneReadonlyInspectorProperty({
      path: 'prefab.relation.definition',
      label: 'Prefab Definition',
      value: definitionLabel,
      order: 0,
      source: 'Document',
      effect,
    }),
    createEditorSceneReadonlyInspectorProperty({
      path: 'prefab.relation.source',
      label: 'Source Model',
      value: sourceLabel,
      order: 1,
      source: relation.sourceAsset ? 'Asset' : 'Document',
      effect,
      disabledReason,
    }),
  ].filter((property): property is InspectorProperty<EditorSceneDocument> => !!property);

  if (hasDiagnostics) {
    properties.push(createEditorSceneReadonlyInspectorProperty({
      path: 'prefab.relation.diagnostics',
      label: 'Diagnostics',
      value: relation.diagnostics
        .map(diagnostic => `${diagnostic.severity}:${diagnostic.code} - ${diagnostic.message}`)
        .join('\n'),
      order: 2,
      source: 'Derived',
      effect,
      disabledReason,
    })!);
  }

  properties.push(createPrefabInspectorActionProperty({
    path: 'prefab.actions.editDefinition',
    label: 'Edit Prefab',
    actionId: 'prefab.edit-definition',
    order: 10,
    icon: 'prefab',
    tooltip: 'Open the prefab definition stage.',
    params: {
      assetId: relation.definition?.id ?? relation.prefab.prefabId,
      browserAssetId: relation.definition ? `prefab:${relation.definition.id}` : undefined,
    },
    disabled: !relation.definition,
    disabledReason,
    effect,
  }));
  properties.push(createPrefabInspectorActionProperty({
    path: 'prefab.actions.selectDefinition',
    label: 'Select Prefab',
    actionId: 'prefab.select-definition',
    order: 11,
    icon: 'prefab',
    tooltip: 'Select the prefab asset in the asset browser.',
    params: {
      assetId: relation.definition?.id ?? relation.prefab.prefabId,
      browserAssetId: relation.definition ? `prefab:${relation.definition.id}` : undefined,
    },
    disabled: !relation.definition,
    disabledReason,
    effect,
  }));
  properties.push(createPrefabInspectorActionProperty({
    path: 'prefab.actions.pingSource',
    label: 'Ping Source',
    actionId: 'prefab.ping-source',
    order: 12,
    icon: 'asset',
    tooltip: 'Select the prefab source asset in the asset browser.',
    params: {
      assetId: relation.sourceAsset?.id ?? relation.prefab.sourceAssetId,
    },
    disabled: !relation.sourceAsset,
    disabledReason,
    effect,
  }));

  return {
    id: 'prefab-instance',
    title: 'Prefab',
    order: 48,
    placement: 'body',
    summary: errorCount > 0
      ? `${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`
      : warningCount > 0
        ? 'Warning'
        : infoCount > 0
          ? 'Info'
          : 'Ready',
    persistence: 'readonly',
    effect,
    disabledReason,
    collapsedByDefault: false,
    properties,
  };
}

function createPrefabInspectorActionProperty(input: {
  path: string;
  label: string;
  actionId: string;
  order: number;
  icon: string;
  tooltip: string;
  params: Record<string, string | undefined>;
  disabled: boolean;
  disabledReason?: string;
  effect?: InspectorProperty<EditorSceneDocument>['effect'];
}): InspectorProperty<EditorSceneDocument> {
  const params = Object.fromEntries(
    Object.entries(input.params).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0),
  );
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
      params,
      ...(input.disabled ? { disabled: true } : {}),
      ...(input.disabledReason ? { disabledReason: input.disabledReason } : {}),
    },
    value: input.actionId,
    readOnly: false,
    persistence: 'readonly',
    commitMode: 'immediate',
    order: input.order,
    tooltip: input.disabledReason ?? input.tooltip,
    effect: input.effect,
    disabledReason: input.disabled ? input.disabledReason : undefined,
  };
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
  primitiveIndex?: number;
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

function addEditorScenePrefabAsset(
  document: EditorSceneDocument,
  prefabAsset: EditorSceneAsset,
  sourceAsset?: EditorSceneAsset,
): EditorSceneDocument {
  const nextAssets = [...document.assets];
  if (sourceAsset && !nextAssets.some(asset => asset.id === sourceAsset.id)) {
    nextAssets.push(structuredClone(sourceAsset));
  }
  const normalizedPrefabAsset = syncEditorScenePrefabRootNodeFields(prefabAsset);
  if (!nextAssets.some(asset => asset.id === prefabAsset.id)) {
    nextAssets.push(structuredClone(normalizedPrefabAsset));
  }
  if (nextAssets.length === document.assets.length) return document;
  return {
    ...document,
    assets: nextAssets,
  };
}

function patchEditorScenePrefabAssetField(
  document: EditorSceneDocument,
  assetId: string,
  path: string,
  value: unknown,
): EditorSceneDocument {
  if (path === 'displayName') return document;
  const asset = findEditorScenePrefabAsset(document, assetId);
  if (!asset) return document;
  const patchedAsset = patchEditorScenePrefabAsset(normalizeEditorScenePrefabAssetComposition(asset), path, value);
  if (JSON.stringify(patchedAsset) === JSON.stringify(asset)) return document;
  return {
    ...document,
    assets: document.assets.map(candidate => candidate.id === assetId ? patchedAsset : candidate),
  };
}

function replaceEditorScenePrefabAsset(
  document: EditorSceneDocument,
  assetId: string,
  prefabAsset: EditorSceneAsset,
): EditorSceneDocument {
  const existing = findEditorScenePrefabAsset(document, assetId);
  if (!existing) return document;
  const normalizedPrefabAsset = syncEditorScenePrefabRootNodeFields({
    ...structuredClone(prefabAsset),
    id: assetId,
  });
  if (JSON.stringify(normalizedPrefabAsset) === JSON.stringify(existing)) return document;
  return {
    ...document,
    assets: document.assets.map(candidate => candidate.id === assetId ? normalizedPrefabAsset : candidate),
  };
}

function patchEditorScenePrefabAsset(
  prefabAsset: EditorSceneAsset,
  path: string,
  value: unknown,
): EditorSceneAsset {
  if (path === 'displayName') {
    return prefabAsset;
  }
  if (path === 'prefab.defaults.active' || path === 'prefab.defaults.shadowMode') {
    const next = structuredClone(prefabAsset);
    const prefab = structuredClone(next.prefab ?? prefabAsset.prefab)!;
    prefab.defaults = { ...(prefab.defaults ?? {}) };
    if (path === 'prefab.defaults.active') {
      if (value == null) delete prefab.defaults.active;
      else prefab.defaults.active = value as boolean;
    } else if (value == null) {
      delete prefab.defaults.shadowMode;
    } else {
      prefab.defaults.shadowMode = value as NonNullable<typeof prefab.defaults.shadowMode>;
    }
    if (Object.keys(prefab.defaults).length === 0) delete prefab.defaults;
    next.prefab = prefab;
    return syncEditorScenePrefabRootNodeFields(next);
  }
  return patchPlayableEditorScenePrefabOverride(prefabAsset, path, value) as EditorSceneAsset;
}

function normalizeEditorScenePrefabAssetComposition(prefabAsset: EditorSceneAsset): EditorSceneAsset {
  if (!isPlayableEditorScenePrefabAsset(prefabAsset)) return prefabAsset;
  const result = ensurePlayableEditorScenePrefabComposition(prefabAsset);
  return result.ok ? result.prefabAsset as EditorSceneAsset : prefabAsset;
}

function syncEditorScenePrefabRootNodeFields(prefabAsset: EditorSceneAsset): EditorSceneAsset {
  if (!isPlayableEditorScenePrefabAsset(prefabAsset)) return prefabAsset;
  const next = normalizeEditorScenePrefabAssetComposition(prefabAsset);
  const rootNodeId = readPlayableEditorScenePrefabRootNodeId(next);
  if (!rootNodeId || !Array.isArray(next.prefab?.nodes)) return next;
  const rootIndex = next.prefab.nodes.findIndex(node => node.id === rootNodeId);
  if (rootIndex < 0) return next;
  const rootNode = structuredClone(next.prefab.nodes[rootIndex]!);
  rootNode.name = next.displayName ?? rootNode.name;
  if (next.prefab.defaults) {
    rootNode.defaults = structuredClone(next.prefab.defaults);
  } else {
    delete rootNode.defaults;
  }
  next.prefab.nodes = [...next.prefab.nodes];
  next.prefab.nodes[rootIndex] = rootNode;
  return next;
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

function addEditorSceneMaterialAssetAndBindPrefabOverride(
  document: EditorSceneDocument,
  assetId: string,
  bindingPath: string,
  materialAsset: SceneMaterialAssetConfig,
): EditorSceneDocument {
  const withMaterial = addEditorSceneMaterialAsset(document, materialAsset);
  return patchEditorScenePrefabAssetField(
    withMaterial,
    assetId,
    bindingPath,
    materialAsset.id,
  );
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
