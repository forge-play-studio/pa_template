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
} from '@fps-games/editor-core';
import {
  callEditorSceneRuntimeMethod as callPlayableEditorSceneRuntimeMethod,
  addAssetLibraryItemToEditorSceneDocument as addPlayableAssetLibraryItemToEditorSceneDocument,
  canEditorSceneGameObjectHaveChildren as canPlayableEditorSceneGameObjectHaveChildren,
  collectEditorSceneSubtreeIdList as collectPlayableEditorSceneSubtreeIdList,
  createEditorSceneAssetPlacementPatch as createPlayableEditorSceneAssetPlacementPatch,
  createEditorSceneDocumentInspectorProperty as createPlayableEditorSceneDocumentInspectorProperty,
  createEditorSceneDocumentInspectorSections as createPlayableEditorSceneDocumentInspectorSections,
  createEditorSceneCreateGroupPatch as createPlayableEditorSceneCreateGroupPatch,
  createEditorSceneCreatePrimitivePatch as createPlayableEditorSceneCreatePrimitivePatch,
  createEditorSceneDeleteSubtreePatch as createPlayableEditorSceneDeleteSubtreePatch,
  createEditorSceneDuplicateSelectionPatch as createPlayableEditorSceneDuplicateSelectionPatch,
  createEditorSceneFieldInspectorValidator as createPlayableEditorSceneFieldInspectorValidator,
  createEditorSceneGroupSelectionPatch as createPlayableEditorSceneGroupSelectionPatch,
  createEditorSceneHierarchyMovePatch as createPlayableEditorSceneHierarchyMovePatch,
  createEditorSceneDuplicateMaterialAssetForBindingPatch as createPlayableEditorSceneDuplicateMaterialAssetForBindingPatch,
  createEditorSceneDuplicateMaterialAssetValue as createPlayableEditorSceneDuplicateMaterialAssetValue,
  createEditorSceneMaterialAssetFieldInspectorPropertyInput as createPlayableEditorSceneMaterialAssetFieldInspectorPropertyInput,
  createEditorSceneMaterialAssetPreview as createPlayableEditorSceneMaterialAssetPreview,
  createEditorSceneMaterialBindingSummary as createPlayableEditorSceneMaterialBindingSummary,
  createEditorSceneMaterialPickerControlOptions as createPlayableEditorSceneMaterialPickerControlOptions,
  createEditorSceneReadonlyInspectorProperty as createPlayableEditorSceneReadonlyInspectorProperty,
  createEditorSceneReadonlyInspectorSection as createPlayableEditorSceneReadonlyInspectorSection,
  createEditorSceneReadonlyVector3Properties as createPlayableEditorSceneReadonlyVector3Properties,
  createEditorSceneRenamePatch as createPlayableEditorSceneRenamePatch,
  createEditorSceneReparentPatch as createPlayableEditorSceneReparentPatch,
  createEditorSceneRuntimeInspectorSnapshot as createPlayableEditorSceneRuntimeInspectorSnapshot,
  createEditorSceneRuntimeInspectorSections as createPlayableEditorSceneRuntimeInspectorSections,
  createEditorSceneSerializedMultiObject as createPlayableEditorSceneSerializedMultiObject,
  createEditorSceneSerializedObject as createPlayableEditorSceneSerializedObject,
  createEditorSceneTextureAssetPreview as createPlayableEditorSceneTextureAssetPreview,
  createEditorSceneTexturePickerControlOptions as createPlayableEditorSceneTexturePickerControlOptions,
  degreesToEditorSceneRadians as degreesToPlayableEditorSceneRadians,
  describeEditorSceneRuntimeObject as describePlayableEditorSceneRuntimeObject,
  ensureEditorSceneGameObjectGuids as ensurePlayableEditorSceneGameObjectGuids,
  getEditorSceneGameObjectWorldTransform as getPlayableEditorSceneGameObjectWorldTransform,
  getEditorSceneMaterialAssetDisplayMeta as getPlayableEditorSceneMaterialAssetDisplayMeta,
  getEditorSceneMaterialAssetDisplayName as getPlayableEditorSceneMaterialAssetDisplayName,
  getEditorSceneHierarchyItems as getPlayableEditorSceneHierarchyItems,
  findEditorSceneMaterialAsset as findPlayableEditorSceneMaterialAsset,
  findEditorSceneInspectorTextureAsset as findPlayableEditorSceneInspectorTextureAsset,
  isEditorSceneCameraGameObject as isPlayableEditorSceneCameraGameObject,
  isEditorSceneArtistMaterialPatchPath as isPlayableEditorSceneArtistMaterialPatchPath,
  isEditorSceneGroupLikeGameObject as isPlayableEditorSceneGroupLikeGameObject,
  isEditorSceneLightGameObject as isPlayableEditorSceneLightGameObject,
  isEditorSceneMaterialBindingPath as isPlayableEditorSceneMaterialBindingPath,
  isEditorSceneMaterialAssetReadonlyForInspector as isPlayableEditorSceneMaterialAssetReadonlyForInspector,
  isEditorSceneRootGameObject as isPlayableEditorSceneRootGameObject,
  isEditorSceneRootGameObjectId as isPlayableEditorSceneRootGameObjectId,
  normalizeEditorSceneFieldInspectorValue as normalizePlayableEditorSceneFieldInspectorValue,
  normalizeEditorSceneHierarchyDocument as normalizePlayableEditorSceneHierarchyDocument,
  normalizeEditorSceneMaterialAssetValue as normalizePlayableEditorSceneMaterialAssetValue,
  radiansToEditorSceneDegrees as radiansToPlayableEditorSceneDegrees,
  parseEditorSceneDuplicateMaterialAssetValue as parsePlayableEditorSceneDuplicateMaterialAssetValue,
  parseEditorSceneMaterialAssetFieldPath as parsePlayableEditorSceneMaterialAssetFieldPath,
  patchEditorSceneMaterialAssetField as patchPlayableEditorSceneMaterialAssetField,
  collectEditorSceneChildMaterialSlots as collectPlayableEditorSceneChildMaterialSlots,
  collectEditorSceneMaterialAssetBindingIds as collectPlayableEditorSceneMaterialAssetBindingIds,
  readEditorSceneInspectorVec3 as readPlayableEditorSceneInspectorVec3,
  readEditorSceneRuntimeBoolean as readPlayableEditorSceneRuntimeBoolean,
  readEditorSceneRuntimeClassName as readPlayableEditorSceneRuntimeClassName,
  readEditorSceneRuntimeNumber as readPlayableEditorSceneRuntimeNumber,
  readEditorSceneRuntimeString as readPlayableEditorSceneRuntimeString,
  readEditorSceneRuntimeValue as readPlayableEditorSceneRuntimeValue,
  readEditorSceneTransformVector as readPlayableEditorSceneTransformVector,
  reduceEditorSceneDocumentMutation as reducePlayableEditorSceneDocumentMutation,
  resolveEditorSceneMaterialAssetKind as resolvePlayableEditorSceneMaterialAssetKind,
  roundEditorSceneInspectorNumber as roundPlayableEditorSceneInspectorNumber,
  applyEditorSceneJsonFieldPatch as applyPlayableEditorSceneJsonFieldPatch,
  toEditorSceneLocalTransformFromWorld as toPlayableEditorSceneLocalTransformFromWorld,
  toEditorSceneInspectorSafeValue as toPlayableEditorSceneInspectorSafeValue,
  applyEditorSceneSerializedPropertyPatch as applyPlayableEditorSceneSerializedPropertyPatch,
  patchEditorSceneGameObjectField as patchPlayableEditorSceneGameObjectField,
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
  type EditorSceneReadonlyInspectorPropertyInput as PlayableEditorSceneReadonlyInspectorPropertyInput,
  type EditorSceneReadonlyInspectorSectionInput as PlayableEditorSceneReadonlyInspectorSectionInput,
  type EditorSceneRuntimeInspectorSnapshot as PlayableEditorSceneRuntimeInspectorSnapshot,
  type EditorSceneSerializedPropertyValidator as PlayableEditorSceneSerializedPropertyValidator,
} from '@fps-games/editor/playable-sdk';
import type {
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
import { mergeEditorSceneAssetWithLibraryItem } from './editor-asset-library';
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
  | ({ kind: 'serialized-property' } & SerializedPropertyPatch)
  | {
    kind: 'game-object.field';
    targetId: string;
    path: string;
    value: unknown;
  }
  | {
    kind: 'scene.material-asset.field';
    materialAssetId: string;
    path: string;
    value: unknown;
  }
  | {
    kind: 'scene.material-asset.duplicate-and-bind';
    targetId: string;
    bindingPath: string;
    materialAsset: SceneMaterialAssetConfig;
  }
  | {
    kind: 'game-object.create-from-asset';
    assetItem: EditorSceneAssetLibraryItem;
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
const DEFAULT_PBR_MATERIAL_ASSET_ID = 'mat_default_pbr';
const DEFAULT_STANDARD_MATERIAL_ASSET_ID = 'mat_default_standard';
const DEFAULT_ARTIST_MATERIAL_ASSET_ID = DEFAULT_PBR_MATERIAL_ASSET_ID;
const DEFAULT_PBR_MATERIAL_ASSET: SceneMaterialAssetConfig = {
  id: DEFAULT_PBR_MATERIAL_ASSET_ID,
  name: 'Default PBR Material',
  materialKind: 'pbr',
  system: {
    readonly: true,
    preset: 'default-pbr',
  },
  profile: {
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
  name: 'Default Standard Material',
  materialKind: 'standard',
  system: {
    readonly: true,
    preset: 'default-standard',
  },
  profile: {
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
  duplicateForObject: string;
  materialPickerTitle: string;
  texturePickerTitle: string;
  assetProfile: string;
  assetProfileEmpty: string;
  assetName: string;
  assetKind: string;
  assetKindPbr: string;
  assetKindStandard: string;
  assetBaseColor: string;
  assetBaseTexture: string;
  assetBrightness: string;
  assetSaturation: string;
  assetContrast: string;
  assetHue: string;
  assetMetallic: string;
  assetRoughness: string;
  assetEmissionColor: string;
  assetEmissionIntensity: string;
  assetEmissionMaskUrl: string;
  createSlotMaterial: string;
  slotOwnerPath: string;
  slotMaterialAsset: string;
  legacySlotRaw: string;
  summaryAsset: (name: string) => string;
  summaryMissingAsset: string;
  summaryLegacyData: string;
  summaryInherit: string;
  summaryAddSlot: string;
  summarySlotCount: (count: number) => string;
  tooltips: ArtistMaterialTooltipText;
};

type ArtistMaterialTooltipText = Record<
  | 'language'
  | 'materialAsset'
  | 'baseTexture'
  | 'assetProfile'
  | 'assetName'
  | 'assetKind'
  | 'baseColor'
  | 'duplicateForObject'
  | 'brightness'
  | 'saturation'
  | 'contrast'
  | 'hue'
  | 'metallic'
  | 'roughness'
  | 'emissionColor'
  | 'emissionIntensity'
  | 'emissionMaskUrl'
  | 'createSlotMaterial'
  | 'slotOwnerPath'
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
    duplicateForObject: '复制',
    materialPickerTitle: '选择材质资产',
    texturePickerTitle: '选择贴图资产',
    assetProfile: '资产参数',
    assetProfileEmpty: '选择材质资产后可编辑资产参数',
    assetName: '资产名称',
    assetKind: '材质类型',
    assetKindPbr: 'PBR 标准材质球',
    assetKindStandard: 'Standard 标准材质球',
    assetBaseColor: '资产基础色',
    assetBaseTexture: '资产基础贴图',
    assetBrightness: '资产亮度',
    assetSaturation: '资产饱和度',
    assetContrast: '资产对比度',
    assetHue: '资产色相',
    assetMetallic: '资产金属度',
    assetRoughness: '资产粗糙度',
    assetEmissionColor: '资产自发光色',
    assetEmissionIntensity: '资产自发光强度',
    assetEmissionMaskUrl: '资产遮罩贴图',
    createSlotMaterial: '添加材质槽',
    slotOwnerPath: '槽节点路径',
    slotMaterialAsset: '槽材质资产',
    legacySlotRaw: '旧槽材质原始值',
    summaryAsset: (name) => `资产：${name}`,
    summaryMissingAsset: '资产缺失',
    summaryLegacyData: '旧数据',
    summaryInherit: '继承',
    summaryAddSlot: '添加槽',
    summarySlotCount: (count) => `${count} 个槽`,
    tooltips: {
      language: '切换美术材质 Inspector 的显示语言。',
      materialAsset: '选择项目级共享材质资产，或使用只读的默认 PBR 材质。',
      baseTexture: '选择项目贴图作为 Base Color 贴图。',
      assetProfile: '共享材质资产的参数会影响所有绑定该资产的节点。',
      assetName: '材质资产名称为只读，避免破坏历史按名称查找链路。',
      assetKind: '材质球类型决定运行时使用 PBRMaterial 或 StandardMaterial。',
      baseColor: '基础颜色。修改共享材质资产会影响所有绑定该材质球的节点。',
      duplicateForObject: '复制当前材质球为这个对象或槽的独立材质，然后自动替换绑定。',
      brightness: '亮度倍率，1 为不改变。',
      saturation: '饱和度倍率，1 为不改变。',
      contrast: '对比度倍率，1 为不改变。',
      hue: '色相偏移，单位为度。',
      metallic: '金属度，范围 0 到 1。',
      roughness: '粗糙度，范围 0 到 1。',
      emissionColor: '自发光颜色，会与强度相乘。',
      emissionIntensity: '自发光强度，0 表示无自发光。',
      emissionMaskUrl: '选择灰度贴图作为自发光强度遮罩。',
      createSlotMaterial: '输入 GLB 子节点或 mesh 的 ownerNodePath 来添加槽绑定，初始使用默认 PBR 材质。',
      slotOwnerPath: '材质槽定位到的子节点或 mesh 路径。',
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
    duplicateForObject: 'Copy',
    materialPickerTitle: 'Select Material Asset',
    texturePickerTitle: 'Select Texture Asset',
    assetProfile: 'Asset Profile',
    assetProfileEmpty: 'Select a material asset to edit asset parameters',
    assetName: 'Asset Name',
    assetKind: 'Material Kind',
    assetKindPbr: 'PBR standard material',
    assetKindStandard: 'Standard material',
    assetBaseColor: 'Asset Base Color',
    assetBaseTexture: 'Asset Base Texture',
    assetBrightness: 'Asset Brightness',
    assetSaturation: 'Asset Saturation',
    assetContrast: 'Asset Contrast',
    assetHue: 'Asset Hue',
    assetMetallic: 'Asset Metallic',
    assetRoughness: 'Asset Roughness',
    assetEmissionColor: 'Asset Emission Color',
    assetEmissionIntensity: 'Asset Emission Intensity',
    assetEmissionMaskUrl: 'Asset Mask Texture',
    createSlotMaterial: 'Add Material Slot',
    slotOwnerPath: 'Slot Owner Path',
    slotMaterialAsset: 'Slot Material Asset',
    legacySlotRaw: 'Legacy Slot Raw',
    summaryAsset: (name) => `Asset: ${name}`,
    summaryMissingAsset: 'Missing asset',
    summaryLegacyData: 'Legacy data',
    summaryInherit: 'Inherit',
    summaryAddSlot: 'Add slot',
    summarySlotCount: (count) => `${count} slot${count === 1 ? '' : 's'}`,
    tooltips: {
      language: 'Switch the artist material Inspector language.',
      materialAsset: 'Choose a project-level shared material asset, or use the read-only Default PBR material.',
      baseTexture: 'Choose a project texture as the Base Color texture.',
      assetProfile: 'Shared asset parameters affect every node bound to this material asset.',
      assetName: 'Material asset names are readonly to preserve legacy name-based lookups.',
      assetKind: 'The material kind controls whether runtime projection uses PBRMaterial or StandardMaterial.',
      baseColor: 'Base color. Editing the shared material asset affects every bound node.',
      duplicateForObject: 'Copy the current material as an independent material for this object or slot, then bind it automatically.',
      brightness: 'Brightness multiplier. 1 leaves the color unchanged.',
      saturation: 'Saturation multiplier. 1 leaves the color unchanged.',
      contrast: 'Contrast multiplier. 1 leaves the color unchanged.',
      hue: 'Hue offset in degrees.',
      metallic: 'Metallic value from 0 to 1.',
      roughness: 'Roughness value from 0 to 1.',
      emissionColor: 'Emission color multiplied by emission intensity.',
      emissionIntensity: 'Emission intensity. 0 means no emission.',
      emissionMaskUrl: 'Choose a grayscale texture to modulate emission intensity.',
      createSlotMaterial: 'Enter a GLB child node or mesh ownerNodePath to add a slot binding with the Default PBR material.',
      slotOwnerPath: 'Child node or mesh path targeted by this material slot.',
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
    if (command.patch.kind === 'scene.material-asset.duplicate-and-bind') {
      return addEditorSceneMaterialAssetAndBind(
        document,
        command.patch.targetId,
        command.patch.bindingPath,
        command.patch.materialAsset,
      );
    }
  }
  return reducePlayableEditorSceneDocumentMutation(
    document,
    command as DocumentCommand<EditorSceneDocument, PlayableEditorSceneDocumentMutationPatch<EditorSceneGameObject>>,
    createEditorSceneDocumentMutationOptions(),
  );
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
  const materialAssets = ensureDefaultEditorSceneMaterialAssets(documentWithGuids.scene.materialAssets ?? []);
  changed = changed || materialAssets !== documentWithGuids.scene.materialAssets;
  const gameObjects = documentWithGuids.scene.gameObjects.map((gameObject) => {
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
  return getPlayableEditorSceneHierarchyItems(document);
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
  const serialized = getEditorSceneSerializedMultiObject(document, gameObjectIds, activeId);
  if (!serialized) return null;
  return {
    targetIds: serialized.targetIds,
    activeId,
    label: serialized.label,
    document,
    selection: {
      targetIds: serialized.targetIds,
      activeId,
      document,
    },
    sections: [{
      id: 'transform',
      title: 'Transform',
      order: 20,
      placement: 'body',
      persistence: 'document',
      properties: serialized.properties.map((property, order) => ({
        path: property.path,
        label: property.label,
        valueType: property.valueType,
        control: 'number',
        value: property.value,
        mixed: property.mixed,
        readOnly: false,
        persistence: 'document',
        commitMode: 'live',
        order,
        step: property.path.startsWith('transform.rotation.') ? 1 : 0.1,
        validate: createEditorSceneInspectorValidator('group', property.path),
      })),
    }],
  };
}

export interface EditorSceneInspectorPropertyPatchInput {
  document: EditorSceneDocument;
  targetId: string;
  path: string;
  value: unknown;
}

export interface EditorSceneAssetActionPatchInput {
  actionId: string;
  assetId: string;
  browserAssetId?: string;
  assetKind?: string;
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
  const gameObject = findEditorSceneGameObject(input.document, input.targetId);
  if (!gameObject) return null;
  const path = input.path;
  const value = normalizeEditorSceneInspectorValue(path, input.value);
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
    if (!changedIds.includes(input.targetId)) changedIds.push(input.targetId);
    return {
      label: `Patch material asset ${materialAssetFieldPath.materialAssetId} ${materialAssetFieldPath.fieldPath}`,
      patch: {
        kind: 'scene.material-asset.field',
        materialAssetId: materialAssetFieldPath.materialAssetId,
        path: materialAssetFieldPath.fieldPath,
        value: normalizedMaterialAssetValue,
      },
      changedId: input.targetId,
      changedIds,
      ...(materialAssetFieldPath.fieldPath.startsWith('profile.') ? { reprojectIds: changedIds } : {}),
    };
  }
  if (isEditorSceneRootTransformPath(input.targetId, path)) return null;
  if (!validateEditorSceneInspectorValue(input.document, gameObject, path, value).ok) return null;
  if (isBlockedEditorSceneSystemFieldPatch(input.document, input.targetId, path, value)) return null;
  const changedIds = path.startsWith('transform.')
    ? collectEditorSceneSubtreeIdList(input.document, [input.targetId])
    : [input.targetId];
  const reprojectIds = isEditorSceneProjectionShapePath(path) || isEditorSceneArtistMaterialPatchPath(path)
    ? [input.targetId]
    : undefined;
  return {
    label: `Patch ${input.targetId} ${path}`,
    patch: {
      kind: 'game-object.field',
      targetId: input.targetId,
      path,
      value,
    },
    changedId: input.targetId,
    changedIds,
    ...(reprojectIds ? { reprojectIds } : {}),
  };
}

export function createEditorSceneAssetActionPatch(
  input: EditorSceneAssetActionPatchInput,
): { patch: EditorSceneDocumentPatch; label: string; changedId?: string; changedIds?: string[]; reprojectIds?: string[] } | null {
  if (input.actionId === 'asset.apply-material') {
    if (!input.activeId) return null;
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
  const materialAsset = findEditorSceneMaterialAsset(input.document, input.assetId);
  if (!materialAsset || isReadonlyEditorSceneMaterialAsset(materialAsset)) return null;
  const fieldPath = typeof input.fieldPath === 'string' ? input.fieldPath.trim() : '';
  if (!fieldPath.startsWith('profile.')) return null;
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
    isBindingPathAllowed: path => !!resolveSceneNodeFieldSchema(path, readEditorSceneNodeKind(gameObject)),
  });
  if (!result) return null;
  const sourceMaterialAsset = findEditorSceneMaterialAsset(document, sourceMaterialAssetId);
  const materialAsset = result.patch.materialAsset as SceneMaterialAssetConfig;
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

  const slotProperties = nodeKind === 'primitive'
    ? []
    : createChildMaterialBindingInspectorProperties(document, gameObject, nodeKind, context);
  if (slotProperties.length > 0) {
    sections.push({
      id: 'artistMaterialSlots',
    title: text.slotTitle,
    order: 48,
    placement: 'body',
    summary: createChildMaterialBindingSummary(document, gameObject, text),
      persistence: 'document',
      collapsedByDefault: true,
      properties: slotProperties,
    });
  }
  return sections;
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
    const binding = gameObject.overrides?.childMaterialBindings?.[ownerNodePath];
    const legacy = gameObject.overrides?.childMaterials?.[ownerNodePath];
    const materialAsset = findEditorSceneMaterialAsset(document, binding?.materialAssetId ?? '');
    const baseOrder = (slotIndex + 1) * 100;
    properties.push(createMaterialAssetSelectorInspectorProperty(document, nodeKind, {
      path: `overrides.childMaterialBindings.${ownerNodePath}.materialAssetId`,
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

type EditorSceneChildMaterialSlot = {
  ownerNodePath: string;
  label?: string;
};

function collectEditorSceneChildMaterialSlots(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): EditorSceneChildMaterialSlot[] {
  return collectPlayableEditorSceneChildMaterialSlots(document, gameObject) as EditorSceneChildMaterialSlot[];
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
    }),
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

function getEditorSceneMaterialAssetMeta(
  materialAsset: SceneMaterialAssetConfig,
  text: ArtistMaterialInspectorText,
): string {
  return getPlayableEditorSceneMaterialAssetDisplayMeta(
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

function createEditorSceneMaterialDisplayText(text: ArtistMaterialInspectorText) {
  return {
    defaultMaterial: text.defaultMaterial,
    defaultStandardMaterial: text.defaultStandardMaterial,
    defaultMaterialMeta: text.defaultMaterialMeta,
    defaultStandardMaterialMeta: text.defaultStandardMaterialMeta,
    formatMaterialMeta: (materialAssetId: string) => `Material - ${materialAssetId}`,
  };
}

function createEditorSceneMaterialPreview(profile: ArtistMaterialProfile): Record<string, unknown> {
  return createPlayableEditorSceneMaterialAssetPreview(profile);
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
    createMaterialAssetFieldInspectorProperty(document, materialAsset, 'profile.baseColor.color', text.assetBaseColor, profile.baseColor?.color ?? { r: 1, g: 1, b: 1 }, orderOffset + 2, 'color', 'color', 'immediate', text.tooltips.baseColor),
    createMaterialTexturePickerInspectorProperty({
      path: `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.profile.baseColor.texture.url`,
      label: text.assetBaseTexture,
      value: profile.baseColor?.texture?.url ?? '',
      order: orderOffset + 3,
      text,
      context,
      tooltip: text.tooltips.baseTexture,
    }),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.baseColor.brightness', text.assetBrightness, profile.baseColor?.brightness ?? 1, orderOffset + 4, 0, 2, 0.05, text.tooltips.brightness),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.baseColor.saturation', text.assetSaturation, profile.baseColor?.saturation ?? 1, orderOffset + 5, 0, 2, 0.05, text.tooltips.saturation),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.baseColor.contrast', text.assetContrast, profile.baseColor?.contrast ?? 1, orderOffset + 6, 0, 2, 0.05, text.tooltips.contrast),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.baseColor.hue', text.assetHue, profile.baseColor?.hue ?? 0, orderOffset + 7, -180, 180, 1, text.tooltips.hue),
  ];
  if (materialKind === 'pbr') {
    properties.push(
      createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.metallic', text.assetMetallic, profile.metallic ?? 0, orderOffset + 8, 0, 1, 0.05, text.tooltips.metallic),
      createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.roughness', text.assetRoughness, profile.roughness ?? 1, orderOffset + 9, 0, 1, 0.05, text.tooltips.roughness),
    );
  }
  properties.push(
    createMaterialAssetFieldInspectorProperty(document, materialAsset, 'profile.emission.color', text.assetEmissionColor, profile.emission?.color ?? { r: 0, g: 0, b: 0 }, orderOffset + 10, 'color', 'color', 'immediate', text.tooltips.emissionColor),
    createMaterialAssetNumberInspectorProperty(document, materialAsset, 'profile.emission.intensity', text.assetEmissionIntensity, profile.emission?.intensity ?? 0, orderOffset + 11, 0, undefined, 0.05, text.tooltips.emissionIntensity),
    createMaterialTexturePickerInspectorProperty({
      path: `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.profile.emission.maskTexture.url`,
      label: text.assetEmissionMaskUrl,
      value: profile.emission?.maskTexture?.url ?? '',
      order: orderOffset + 12,
      text,
      context,
      tooltip: text.tooltips.emissionMaskUrl,
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
    validate: (value) => (
      value == null || value === '' || (typeof value === 'string' && value.trim().length > 0)
        ? { ok: true, value: typeof value === 'string' && value.trim() ? value.trim() : null }
        : { ok: false, message: 'Invalid texture selection.' }
    ),
    coerce: (value) => (typeof value === 'string' && value.trim() ? value.trim() : null),
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
    }),
  };
}

function findEditorSceneInspectorTextureAsset(
  context: EditorSceneInspectorContext,
  value: string,
): EditorSceneInspectorTextureAsset | null {
  return findPlayableEditorSceneInspectorTextureAsset(context.textureAssets, value) as EditorSceneInspectorTextureAsset | null;
}

function createTextureAssetPreview(texture: EditorSceneInspectorTextureAsset): Record<string, unknown> {
  return {
    ...createPlayableEditorSceneTextureAssetPreview(texture),
  };
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
  if (input.path === 'metadata.artistMaterialInspectorLanguage') {
    return input.value === 'zh' || input.value === 'en'
      ? { ok: true, value: input.value }
      : { ok: false, message: 'Invalid value for scene node field: metadata.artistMaterialInspectorLanguage.' };
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
  return null;
}

function createEditorSceneInspectorValidator(
  nodeKind: SceneNodeConfig['kind'],
  path: string,
  document?: EditorSceneDocument | null,
): (value: unknown) => InspectorValidationResult {
  return createPlayableEditorSceneFieldInspectorValidator<EditorSceneDocument, SceneNodeConfig['kind']>({
    path,
    nodeKind,
    document,
    extraValidators: PROJECT_EDITOR_SCENE_INSPECTOR_EXTRA_VALIDATORS,
  });
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

function createDuplicateMaterialAssetValue(materialAssetId: string): string {
  return createPlayableEditorSceneDuplicateMaterialAssetValue(materialAssetId);
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

function addEditorSceneMaterialAssetAndBind(
  document: EditorSceneDocument,
  targetId: string,
  bindingPath: string,
  materialAsset: SceneMaterialAssetConfig,
): EditorSceneDocument {
  if (document.scene.materialAssets?.some((entry) => entry.id === materialAsset.id)) return document;
  const withAsset: EditorSceneDocument = {
    ...document,
    scene: {
      ...document.scene,
      materialAssets: [...(document.scene.materialAssets ?? []), structuredClone(materialAsset)],
    },
  };
  return patchEditorSceneGameObjectField(withAsset, targetId, bindingPath, materialAsset.id);
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
  const childMaterialBinding = splitChildMaterialBindingFieldPath(path);
  return childMaterialBinding ?? path.split('.').filter(Boolean);
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
  return path === 'transformType' || path.startsWith('primitive.') || path.startsWith('camera.') || path.startsWith('light.');
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
