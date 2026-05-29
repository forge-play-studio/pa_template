import {
  applySerializedPropertyPatch,
  createSerializedObject,
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
  type SerializedPropertyDescriptor,
  type SerializedPropertyPatch,
  combineEditorTransforms,
  composeEditorTransformChain,
  createIdentityEditorTransform,
  getTopLevelSceneGraphNodeIds,
  toEditorLocalTransformFromWorld,
  validateSceneGraphGroupSelection,
  validateSceneGraphMove,
} from '@fps-games/editor-core';
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
  findEditorScenePrimitiveRenderer,
  findEditorSceneTransform,
  patchEditorSceneGameObjectTransform,
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

type EditorSceneHierarchyMovePatchEntry = {
  targetId: string;
  parentId?: string;
  transform: EditorTransformSnapshot;
};

export const EDITOR_SCENE_MAIN_CAMERA_ID = 'main_camera';
export const EDITOR_SCENE_ENVIRONMENT_LIGHT_ID = 'environment_light';
export const EDITOR_SCENE_SUN_LIGHT_ID = 'sun_light';
const EDITOR_SCENE_ROOT_ID = 'root';
const EDITOR_SCENE_ROOT_TRANSFORM = createIdentityEditorTransform();
const EDITOR_SCENE_GAME_OBJECT_GUID_PREFIX = 'go_';
const CREATE_CHILD_MATERIAL_SLOT_PATH = 'overrides.childMaterialBindings.$create.ownerNodePath';
const MATERIAL_ASSET_FIELD_PATH_PREFIX = 'scene.materialAssets.';
const DUPLICATE_MATERIAL_ASSET_VALUE_PREFIX = '__fps_duplicate_material_asset__:';
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

function readEditorSceneGameObjectGuid(gameObject: EditorSceneGameObject): string | null {
  return typeof gameObject.guid === 'string' && gameObject.guid.trim()
    ? gameObject.guid.trim()
    : null;
}

function ensureUniqueEditorSceneGameObjectGuid(
  gameObject: EditorSceneGameObject,
  usedGuids: Set<string>,
): EditorSceneGameObject {
  const existingGuid = readEditorSceneGameObjectGuid(gameObject);
  if (existingGuid && !usedGuids.has(existingGuid)) {
    usedGuids.add(existingGuid);
    return existingGuid === gameObject.guid ? gameObject : { ...gameObject, guid: existingGuid };
  }

  let guid = createEditorSceneGameObjectGuid();
  while (usedGuids.has(guid)) {
    guid = createEditorSceneGameObjectGuid();
  }
  usedGuids.add(guid);
  return { ...gameObject, guid };
}

function isEditorSceneRootGameObjectId(gameObjectId: string | null | undefined): boolean {
  return gameObjectId === EDITOR_SCENE_ROOT_ID;
}

function isEditorSceneRootGameObject(gameObject: EditorSceneGameObject): boolean {
  return isEditorSceneRootGameObjectId(gameObject.id);
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
  const usedGuids = new Set<string>();
  let changed = false;
  const gameObjects = document.scene.gameObjects.map((gameObject) => {
    const next = ensureUniqueEditorSceneGameObjectGuid(gameObject, usedGuids);
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
  if (command.type === 'document.replace') return command.document;
  const patch = command.patch;
  if (patch.kind === 'serialized-property') {
    return applyEditorSceneSerializedPropertyPatch(document, patch);
  }
  if (patch.kind === 'game-object.field') {
    if (isBlockedEditorSceneSystemFieldPatch(document, patch.targetId, patch.path, patch.value)) return document;
    return patchEditorSceneGameObjectField(document, patch.targetId, patch.path, patch.value);
  }
  if (patch.kind === 'scene.material-asset.field') {
    return patchEditorSceneMaterialAssetField(document, patch.materialAssetId, patch.path, patch.value);
  }
  if (patch.kind === 'scene.material-asset.duplicate-and-bind') {
    return addEditorSceneMaterialAssetAndBind(document, patch.targetId, patch.bindingPath, patch.materialAsset);
  }
  if (patch.kind === 'game-object.create-from-asset') {
    return addAssetLibraryItemToEditorSceneDocument(document, patch.assetItem, patch.placement).document;
  }
  if (patch.kind === 'game-object.transform') {
    if (isEditorSceneRootGameObjectId(patch.targetId)) return document;
    if (isEditorSceneProtectedSystemGameObjectId(document, patch.targetId)) return document;
    return patchEditorSceneGameObjectTransform(document, patch.targetId, {
      position: patch.transform.position,
      rotation: patch.transform.rotation,
      scale: patch.transform.scale,
    });
  }
  if (patch.kind === 'game-object.transform-batch') {
    return patch.targets.reduce(
      (nextDocument, target) => {
        if (isEditorSceneRootGameObjectId(target.targetId)) return nextDocument;
        if (isEditorSceneProtectedSystemGameObjectId(nextDocument, target.targetId)) return nextDocument;
        const gameObject = nextDocument.scene.gameObjects.find((entry) => entry.id === target.targetId);
        const transform = gameObject ? findEditorSceneTransform(gameObject) : null;
        return patchEditorSceneGameObjectTransform(nextDocument, target.targetId, {
          position: target.transform.position
            ? { ...transform?.position, ...target.transform.position } as EditorSceneVec3
            : undefined,
          rotation: target.transform.rotation
            ? { ...transform?.rotation, ...target.transform.rotation } as EditorSceneVec3
            : undefined,
          scale: target.transform.scale
            ? { ...readTransformVector(transform ?? { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }, 'scale'), ...target.transform.scale } as EditorSceneVec3
            : undefined,
        });
      },
      document,
    );
  }
  if (patch.kind === 'game-object.duplicate-selection') {
    const existingIds = new Set(document.scene.gameObjects.map((gameObject) => gameObject.id));
    const gameObjects = patch.gameObjects.filter((gameObject) => (
      !existingIds.has(gameObject.id)
      && !isEditorSceneRootGameObject(gameObject)
      && !isEditorSceneProtectedSystemGameObject(gameObject)
    ));
    if (gameObjects.length === 0) return document;
    return {
      ...document,
      scene: {
        gameObjects: [...document.scene.gameObjects, ...gameObjects],
      },
    };
  }
  if (patch.kind === 'game-object.rename') {
    const name = patch.name.trim();
    if (!name) return document;
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: document.scene.gameObjects.map((gameObject) => (
          gameObject.id === patch.targetId
            ? { ...gameObject, name }
            : gameObject
        )),
      },
    };
  }
  if (patch.kind === 'game-object.create-group') {
    if (document.scene.gameObjects.some((gameObject) => gameObject.id === patch.gameObject.id)) return document;
    if (isEditorSceneProtectedSystemGameObject(patch.gameObject)) return document;
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: [...document.scene.gameObjects, patch.gameObject],
      },
    };
  }
  if (patch.kind === 'game-object.create-primitive') {
    if (document.scene.gameObjects.some((gameObject) => gameObject.id === patch.gameObject.id)) return document;
    if (isEditorSceneProtectedSystemGameObject(patch.gameObject)) return document;
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: [...document.scene.gameObjects, patch.gameObject],
      },
    };
  }
  if (patch.kind === 'game-object.delete-subtree') {
    if (patch.targetIds.some(isEditorSceneRootGameObjectId)) return document;
    const deleteIds = collectEditorSceneSubtreeIds(document, patch.targetIds);
    if (deleteIds.size === 0) return document;
    if (document.scene.gameObjects.some((gameObject) => deleteIds.has(gameObject.id) && isEditorSceneProtectedSystemGameObject(gameObject))) {
      return document;
    }
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: document.scene.gameObjects.filter((gameObject) => !deleteIds.has(gameObject.id)),
      },
    };
  }
  if (patch.kind === 'game-object.reparent') {
    if (isEditorSceneRootGameObjectId(patch.targetId)) return document;
    if (isEditorSceneProtectedSystemGameObjectId(document, patch.targetId)) return document;
    if (isEditorSceneProtectedSystemGameObjectId(document, patch.parentId)) return document;
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: document.scene.gameObjects.map((gameObject) => {
          if (gameObject.id !== patch.targetId) return gameObject;
          return {
            ...gameObject,
            parentId: patch.parentId,
            components: patch.transform
              ? gameObject.components.map((component) => {
                  if (component.type !== 'Transform') return component;
                  return {
                    ...component,
                    position: patch.transform?.position ?? component.position,
                    rotation: patch.transform?.rotation ?? component.rotation,
                    scale: patch.transform?.scale ?? component.scale,
                  };
                })
              : gameObject.components,
          };
        }),
      },
    };
  }
  if (patch.kind === 'game-object.hierarchy-move') {
    if (patch.moves.some((move) => isEditorSceneProtectedSystemGameObjectId(document, move.targetId) || isEditorSceneProtectedSystemGameObjectId(document, move.parentId))) {
      return document;
    }
    const moves = new Map(patch.moves
      .filter((move) => !isEditorSceneRootGameObjectId(move.targetId))
      .map((move) => [move.targetId, move]));
    if (moves.size === 0) return document;
    const gameObjects = document.scene.gameObjects.map((gameObject) => {
      const move = moves.get(gameObject.id);
      if (!move) return gameObject;
      return {
        ...gameObject,
        parentId: move.parentId,
        components: gameObject.components.map((component) => {
          if (component.type !== 'Transform') return component;
          return {
            ...component,
            position: move.transform.position,
            rotation: move.transform.rotation,
            scale: move.transform.scale,
          };
        }),
      };
    });
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: orderEditorSceneGameObjects(gameObjects, patch.order),
      },
    };
  }
  if (patch.kind === 'game-object.group-selection') {
    if (isEditorSceneRootGameObject(patch.gameObject)) return document;
    if (isEditorSceneProtectedSystemGameObject(patch.gameObject)) return document;
    if (isEditorSceneProtectedSystemGameObjectId(document, patch.gameObject.parentId)) return document;
    if (document.scene.gameObjects.some((gameObject) => gameObject.id === patch.gameObject.id)) return document;
    const childIds = new Set(patch.childIds.filter((id) => !isEditorSceneRootGameObjectId(id)));
    if (childIds.size === 0) return document;
    if (document.scene.gameObjects.some((gameObject) => childIds.has(gameObject.id) && isEditorSceneProtectedSystemGameObject(gameObject))) {
      return document;
    }
    const updated = document.scene.gameObjects.map((gameObject) => {
      if (!childIds.has(gameObject.id)) return gameObject;
      const transform = patch.childTransforms[gameObject.id];
      return {
        ...gameObject,
        parentId: patch.gameObject.id,
        components: transform
          ? gameObject.components.map((component) => {
              if (component.type !== 'Transform') return component;
              return {
                ...component,
                position: transform.position,
                rotation: transform.rotation,
                scale: transform.scale,
              };
            })
          : gameObject.components,
      };
    });
    return {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: orderEditorSceneGameObjects([...updated, patch.gameObject], patch.order),
      },
    };
  }
  return document;
}

export function isEditorSceneGroupLikeGameObject(gameObject: EditorSceneGameObject): boolean {
  return readEditorSceneNodeKind(gameObject) === 'group';
}

export function canEditorSceneGameObjectHaveChildren(gameObject: EditorSceneGameObject): boolean {
  return !!findEditorSceneTransform(gameObject);
}

export function isEditorSceneCameraGameObject(gameObject: EditorSceneGameObject): boolean {
  return readEditorSceneNodeKind(gameObject) === 'transform'
    && (gameObject.transformType === 'camera' || !!gameObject.camera);
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
  const rootId = resolveEditorSceneRootContainerId(document);
  return document.scene.gameObjects
    .filter(gameObject => gameObject.id !== EDITOR_SCENE_ROOT_ID)
    .map((gameObject) => {
      const systemProtected = isEditorSceneProtectedSystemGameObject(gameObject);
      const canHaveChildren = canEditorSceneGameObjectHaveChildren(gameObject);
      return {
        id: gameObject.id,
        label: gameObject.name ?? gameObject.id,
        parentId: gameObject.parentId === rootId ? null : gameObject.parentId ?? null,
        depth: Math.max(0, getEditorSceneGameObjectDepth(document, gameObject) - (rootId ? 1 : 0)),
        role: canHaveChildren && isEditorSceneGroupLikeGameObject(gameObject) ? 'group' : 'object',
        selectable: true,
        protected: systemProtected,
        canHaveChildren: !systemProtected && canHaveChildren,
        renamable: !systemProtected,
        deletable: !systemProtected,
        draggable: !systemProtected,
      };
    });
}

export function normalizeEditorSceneHierarchyDocument(document: EditorSceneDocument): EditorSceneDocument {
  const normalizedDocument = normalizeEditorSceneRootTransformDocument(document);
  const rootId = resolveEditorSceneRootContainerId(normalizedDocument);
  if (!rootId) return normalizedDocument;
  let changed = false;
  const gameObjects = normalizedDocument.scene.gameObjects.map((gameObject) => {
    if (gameObject.id === rootId || gameObject.parentId) return gameObject;
    const world = getEditorSceneGameObjectWorldTransform(normalizedDocument, gameObject.id);
    const local = world ? toLocalTransformForParent(normalizedDocument, rootId, world) : null;
    changed = true;
    return {
      ...gameObject,
      parentId: rootId,
      components: local
        ? gameObject.components.map((component) => {
            if (component.type !== 'Transform') return component;
            return {
              ...component,
              position: local.position,
              rotation: local.rotation,
              scale: local.scale,
            };
          })
        : gameObject.components,
    };
  });
  return changed
    ? {
        ...normalizedDocument,
        scene: {
          ...normalizedDocument.scene,
          gameObjects,
        },
      }
    : normalizedDocument;
}

export function createEditorSceneRenamePatch(
  document: EditorSceneDocument,
  intent: SceneGraphRenameIntent,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string } | null {
  const name = intent.name.trim();
  if (!name) return null;
  const gameObject = findEditorSceneGameObject(document, intent.id);
  if (!gameObject || gameObject.name === name) return null;
  return {
    label: `Rename ${gameObject.name ?? gameObject.id} to ${name}`,
    patch: {
      kind: 'game-object.rename',
      targetId: intent.id,
      name,
    },
    changedId: intent.id,
  };
}

export function createEditorSceneCreateGroupPatch(
  document: EditorSceneDocument,
  intent: SceneGraphCreateGroupIntent,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string } | null {
  const parentId = resolveCreateGroupParentId(document, intent);
  if (parentId === null) return null;
  const id = createUniqueEditorSceneId(document.scene.gameObjects.map((gameObject) => gameObject.id), 'empty');
  const name = intent.name?.trim() || 'Empty';
  const gameObject: EditorSceneGameObject = {
    id,
    guid: createEditorSceneGameObjectGuid(),
    name,
    kind: 'transform',
    transformType: 'plain',
    ...(parentId ? { parentId } : {}),
    active: true,
    components: [
      {
        type: 'Transform',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    ],
  };
  return {
    label: `Create empty ${name}`,
    patch: {
      kind: 'game-object.create-group',
      gameObject,
    },
    createdId: id,
  };
}

export function createEditorSceneCreatePrimitivePatch(
  document: EditorSceneDocument,
  intent: SceneGraphCreatePrimitiveIntent,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string; changedIds: string[] } | null {
  const shape = normalizeEditorScenePrimitiveShape(intent.shape);
  if (!shape) return null;
  const parentId = resolveCreateGroupParentId(document, intent);
  if (parentId === null) return null;
  const id = createUniqueEditorSceneId(document.scene.gameObjects.map((gameObject) => gameObject.id), shape);
  const name = intent.name?.trim() || getEditorScenePrimitiveDisplayName(shape);
  const worldTransform: EditorTransformSnapshot = {
    position: getNextPlacementPosition(document),
    rotation: { x: 0, y: 0, z: 0 },
    scale: getEditorScenePrimitiveDefaultScale(shape),
  };
  const localTransform = parentId
    ? toLocalTransformForParent(document, parentId, worldTransform) ?? worldTransform
    : worldTransform;
  const gameObject: EditorSceneGameObject = {
    id,
    guid: createEditorSceneGameObjectGuid(),
    name,
    kind: 'primitive',
    ...(parentId ? { parentId } : {}),
    active: true,
    primitive: { shape },
    components: [
      {
        type: 'Transform',
        position: localTransform.position,
        rotation: localTransform.rotation,
        scale: localTransform.scale,
      },
    ],
  };
  return {
    label: `Create ${name}`,
    patch: {
      kind: 'game-object.create-primitive',
      gameObject,
    },
    createdId: id,
    changedIds: [id],
  };
}

export function createEditorSceneDeleteSubtreePatch(
  document: EditorSceneDocument,
  intent: SceneGraphDeleteIntent,
): { patch: EditorSceneDocumentPatch; label: string; deletedIds: string[]; fallbackSelectionId: string | null } | null {
  if (intent.ids.some(isEditorSceneRootGameObjectId)) return null;
  const deletedIds = [...collectEditorSceneSubtreeIds(document, intent.ids)];
  if (deletedIds.length === 0) return null;
  if (document.scene.gameObjects.some((gameObject) => deletedIds.includes(gameObject.id) && isEditorSceneProtectedSystemGameObject(gameObject))) {
    return null;
  }
  const fallbackSelectionId = resolveDeleteFallbackSelectionId(document, deletedIds, intent.activeId ?? null);
  return {
    label: `Delete ${deletedIds.length} GameObject${deletedIds.length === 1 ? '' : 's'}`,
    patch: {
      kind: 'game-object.delete-subtree',
      targetIds: intent.ids,
    },
    deletedIds,
    fallbackSelectionId,
  };
}

export function collectEditorSceneSubtreeIdList(document: EditorSceneDocument, rootIds: string[]): string[] {
  return [...collectEditorSceneSubtreeIds(document, rootIds)];
}

export function validateEditorSceneReparent(
  document: EditorSceneDocument,
  intent: SceneGraphDropIntent,
): SceneGraphValidationResult {
  if (intent.placement !== 'inside') return { ok: false, reason: 'Only inside reparent is supported.' };
  const dragged = findEditorSceneGameObject(document, intent.draggedId);
  const target = findEditorSceneGameObject(document, intent.targetId);
  if (!dragged) return { ok: false, reason: `GameObject not found: ${intent.draggedId}` };
  if (isEditorSceneRootGameObject(dragged)) return { ok: false, reason: 'Root GameObject cannot be reparented.' };
  if (isEditorSceneProtectedSystemGameObject(dragged)) return { ok: false, reason: 'Protected system GameObject cannot be reparented.' };
  if (!target) return { ok: false, reason: `Parent GameObject not found: ${intent.targetId}` };
  if (isEditorSceneProtectedSystemGameObject(target)) return { ok: false, reason: 'Protected system GameObject cannot have children.' };
  if (!findEditorSceneTransform(dragged)) return { ok: false, reason: `${intent.draggedId} has no Transform to preserve.` };
  if (!canEditorSceneGameObjectHaveChildren(target)) return { ok: false, reason: `${intent.targetId} cannot have children.` };
  if (dragged.id === target.id) return { ok: false, reason: 'GameObject cannot be parented to itself.' };
  if (isEditorSceneAncestor(document, dragged.id, target.id)) {
    return { ok: false, reason: 'GameObject cannot be parented to its descendant.' };
  }
  if (intent.preserveWorldTransform !== false && !computeLocalTransformForParent(document, dragged.id, target.id)) {
    return { ok: false, reason: 'Cannot preserve world transform under the target parent.' };
  }
  return { ok: true };
}

export function createEditorSceneReparentPatch(
  document: EditorSceneDocument,
  intent: SceneGraphDropIntent,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  const validation = validateEditorSceneReparent(document, intent);
  if (!validation.ok) return null;
  const target = findEditorSceneGameObject(document, intent.draggedId);
  if (!target || !findEditorSceneTransform(target)) return null;
  const parentId = intent.targetId;
  const transform = intent.preserveWorldTransform === false
    ? readGameObjectLocalTransform(target)
    : computeLocalTransformForParent(document, target.id, parentId);
  if (!transform) return null;
  if (target.parentId === parentId && transformsEqual(readGameObjectLocalTransform(target), transform)) return null;
  return {
    label: `Reparent ${target.name ?? target.id}`,
    patch: {
      kind: 'game-object.reparent',
      targetId: target.id,
      parentId,
      transform,
    },
    changedIds: [target.id],
  };
}

export function validateEditorSceneHierarchyMove(
  document: EditorSceneDocument,
  intent: SceneGraphMoveIntent,
): SceneGraphValidationResult {
  const hierarchy = getEditorSceneHierarchyItems(document);
  const validation = validateSceneGraphMove(hierarchy, intent);
  if (!validation.ok) return validation;
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  if (ids.some(isEditorSceneRootGameObjectId)) return { ok: false, reason: 'Root GameObject cannot be moved.' };
  if (ids.some((id) => isEditorSceneProtectedSystemGameObjectId(document, id))) {
    return { ok: false, reason: 'Protected system GameObject cannot be moved.' };
  }
  const parentId = resolveEditorSceneMoveParentId(document, intent);
  if (isEditorSceneProtectedSystemGameObjectId(document, parentId)) {
    return { ok: false, reason: 'Protected system GameObject cannot have children.' };
  }
  if (parentId && !isEditorSceneContainer(document, parentId)) {
    return { ok: false, reason: `${parentId} cannot have children.` };
  }
  if (intent.preserveWorldTransform !== false) {
    for (const id of ids) {
      const gameObject = findEditorSceneGameObject(document, id);
      if (!gameObject) return { ok: false, reason: `GameObject not found: ${id}` };
      if (!findEditorSceneTransform(gameObject)) return { ok: false, reason: `${id} has no Transform to preserve.` };
      if (!computeLocalTransformForParent(document, id, parentId)) {
        return { ok: false, reason: 'Cannot preserve world transform under the target parent.' };
      }
    }
  }
  return { ok: true };
}

export function createEditorSceneHierarchyMovePatch(
  document: EditorSceneDocument,
  intent: SceneGraphMoveIntent,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  const validation = validateEditorSceneHierarchyMove(document, intent);
  if (!validation.ok) return null;
  const hierarchy = getEditorSceneHierarchyItems(document);
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  const parentId = resolveEditorSceneMoveParentId(document, intent);
  const moves = ids
    .map<EditorSceneHierarchyMovePatchEntry | null>((id) => {
      const gameObject = findEditorSceneGameObject(document, id);
      if (!gameObject || !findEditorSceneTransform(gameObject)) return null;
      const transform = intent.preserveWorldTransform === false
        ? readGameObjectLocalTransform(gameObject)
        : computeLocalTransformForParent(document, id, parentId);
      if (!transform) return null;
      return parentId
        ? { targetId: id, parentId, transform }
        : { targetId: id, transform };
    })
    .filter((move): move is EditorSceneHierarchyMovePatchEntry => !!move);
  if (moves.length !== ids.length) return null;
  const order = createEditorSceneMoveOrder(document, ids, intent);
  const currentOrder = document.scene.gameObjects.map((gameObject) => gameObject.id);
  const moved = moves.some((move) => {
    const gameObject = findEditorSceneGameObject(document, move.targetId);
    return !gameObject
      || gameObject.parentId !== move.parentId
      || !transformsEqual(readGameObjectLocalTransform(gameObject), move.transform);
  });
  if (!moved && arraysEqual(currentOrder, order)) return null;
  return {
    label: `Move ${ids.length} GameObject${ids.length === 1 ? '' : 's'}`,
    patch: {
      kind: 'game-object.hierarchy-move',
      moves,
      order,
    },
    changedIds: ids,
  };
}

export function validateEditorSceneGroupSelection(
  document: EditorSceneDocument,
  intent: SceneGraphGroupSelectionIntent,
): SceneGraphValidationResult {
  const hierarchy = getEditorSceneHierarchyItems(document);
  const validation = validateSceneGraphGroupSelection(hierarchy, intent);
  if (!validation.ok) return validation;
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  if (ids.some(isEditorSceneRootGameObjectId)) return { ok: false, reason: 'Root GameObject cannot be grouped.' };
  if (ids.some((id) => isEditorSceneProtectedSystemGameObjectId(document, id))) {
    return { ok: false, reason: 'Protected system GameObject cannot be grouped.' };
  }
  const parentId = resolveEditorSceneGroupSelectionParentId(document, intent.parentId ?? null);
  if (isEditorSceneProtectedSystemGameObjectId(document, parentId)) {
    return { ok: false, reason: 'Protected system GameObject cannot have children.' };
  }
  if (parentId && !isEditorSceneContainer(document, parentId)) {
    return { ok: false, reason: `${parentId} cannot have children.` };
  }
  if (intent.preserveWorldTransform !== false) {
    const center = computeEditorSceneSelectionWorldCenter(document, ids);
    const groupWorld = center
      ? {
          position: center,
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        }
      : null;
    if (!groupWorld || !toLocalTransformForParent(document, parentId, groupWorld)) {
      return { ok: false, reason: 'Cannot preserve world transform under the target parent.' };
    }
    for (const id of ids) {
      const gameObject = findEditorSceneGameObject(document, id);
      if (!gameObject) return { ok: false, reason: `GameObject not found: ${id}` };
      if (!findEditorSceneTransform(gameObject)) return { ok: false, reason: `${id} has no Transform to preserve.` };
      if (!getEditorSceneGameObjectWorldTransform(document, id)) {
        return { ok: false, reason: 'Cannot preserve world transform under the target parent.' };
      }
    }
  }
  return { ok: true };
}

export function createEditorSceneGroupSelectionPatch(
  document: EditorSceneDocument,
  intent: SceneGraphGroupSelectionIntent,
): { patch: EditorSceneDocumentPatch; label: string; createdId: string; changedIds: string[] } | null {
  const validation = validateEditorSceneGroupSelection(document, intent);
  if (!validation.ok) return null;
  const hierarchy = getEditorSceneHierarchyItems(document);
  const ids = getTopLevelSceneGraphNodeIds(hierarchy, intent.ids);
  if (ids.length === 0) return null;
  const parentId = resolveEditorSceneGroupSelectionParentId(document, intent.parentId ?? null);
  const center = computeEditorSceneSelectionWorldCenter(document, ids);
  if (!center) return null;
  const groupWorld = {
    position: center,
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
  const groupLocal = toLocalTransformForParent(document, parentId, groupWorld);
  if (!groupLocal) return null;
  const id = createUniqueEditorSceneId(document.scene.gameObjects.map((gameObject) => gameObject.id), 'parent');
  const gameObject: EditorSceneGameObject = {
    id,
    guid: createEditorSceneGameObjectGuid(),
    name: intent.name?.trim() || 'Parent',
    kind: 'transform',
    transformType: 'plain',
    ...(parentId ? { parentId } : {}),
    active: true,
    components: [
      {
        type: 'Transform',
        position: groupLocal.position,
        rotation: groupLocal.rotation,
        scale: groupLocal.scale,
      },
    ],
  };
  const childTransforms: Record<string, EditorTransformSnapshot> = {};
  for (const childId of ids) {
    const child = findEditorSceneGameObject(document, childId);
    if (!child) return null;
    if (intent.preserveWorldTransform === false) {
      childTransforms[childId] = readGameObjectLocalTransform(child);
      continue;
    }
    const childWorld = getEditorSceneGameObjectWorldTransform(document, childId);
    if (!childWorld) return null;
    const childLocal = toLocalTransformFromParentWorld(groupWorld, childWorld);
    if (!childLocal) return null;
    childTransforms[childId] = childLocal;
  }
  const order = createEditorSceneGroupSelectionOrder(document, id, ids, intent.insertBeforeId ?? null);
  return {
    label: `Parent ${ids.length} GameObject${ids.length === 1 ? '' : 's'}`,
    patch: {
      kind: 'game-object.group-selection',
      gameObject,
      childIds: ids,
      childTransforms,
      order,
    },
    createdId: id,
    changedIds: [id, ...ids],
  };
}

export function createEditorSceneDuplicateSelectionPatch(input: {
  document: EditorSceneDocument;
  targetIds: string[];
  activeId: string | null;
}): { patch: EditorSceneDocumentPatch; label: string; createdIds: string[]; activeId: string | null; changedIds: string[] } | null {
  const idMap = new Map<string, string>();
  const usedIds = new Set(input.document.scene.gameObjects.map((gameObject) => gameObject.id));
  for (const targetId of input.targetIds) {
    const source = findEditorSceneGameObject(input.document, targetId);
    if (!source || isEditorSceneRootGameObject(source) || isEditorSceneProtectedSystemGameObject(source)) continue;
    const duplicateId = createUniqueEditorSceneId([...usedIds], `${source.id}_copy`);
    usedIds.add(duplicateId);
    idMap.set(source.id, duplicateId);
  }
  const gameObjects = input.targetIds
    .map((targetId) => findEditorSceneGameObject(input.document, targetId))
    .filter((source): source is EditorSceneGameObject => !!source && idMap.has(source.id))
    .map((source) => {
      const duplicate = structuredClone(source);
      duplicate.id = idMap.get(source.id)!;
      duplicate.guid = createEditorSceneGameObjectGuid();
      duplicate.name = `${source.name ?? source.id} Copy`;
      if (duplicate.parentId && idMap.has(duplicate.parentId)) {
        duplicate.parentId = idMap.get(duplicate.parentId)!;
      }
      return duplicate;
    });
  if (gameObjects.length === 0) return null;
  const createdIds = gameObjects.map((gameObject) => gameObject.id);
  const activeId = input.activeId && idMap.has(input.activeId)
    ? idMap.get(input.activeId)!
    : createdIds[createdIds.length - 1] ?? null;
  return {
    label: `Duplicate ${createdIds.length} object${createdIds.length === 1 ? '' : 's'}`,
    patch: {
      kind: 'game-object.duplicate-selection',
      gameObjects,
    },
    createdIds,
    activeId,
    changedIds: createdIds,
  };
}

export function createEditorScenePlacedAssetPatch(input: {
  document: EditorSceneDocument;
  asset: EditorSceneAssetLibraryItem;
  hit: EditorPlacementHit;
}): { patch: EditorSceneDocumentPatch; label: string; createdId: string; changedIds: string[] } {
  const id = createUniqueEditorSceneId(
    input.document.scene.gameObjects.map((gameObject) => gameObject.id),
    sanitizeEditorSceneId(input.asset.displayName || input.asset.assetId),
  );
  return {
    label: `Place ${input.asset.displayName}`,
    patch: {
      kind: 'game-object.create-from-asset',
      assetItem: input.asset,
      placement: {
        position: { ...input.hit.position },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
    createdId: id,
    changedIds: [id],
  };
}

export function getEditorSceneGameObjectWorldTransform(
  document: EditorSceneDocument,
  gameObjectId: string,
): EditorTransformSnapshot | null {
  if (isEditorSceneRootGameObjectId(gameObjectId)) return createIdentityEditorTransform();
  const gameObject = findEditorSceneGameObject(document, gameObjectId);
  if (!gameObject) return null;
  const chain: EditorSceneGameObject[] = [];
  const byId = createGameObjectMap(document);
  const seen = new Set<string>();
  let cursor: EditorSceneGameObject | undefined = gameObject;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return composeEditorTransformChain(chain.map(entry => readGameObjectLocalTransform(entry)));
}

export function toEditorSceneLocalTransformFromWorld(
  document: EditorSceneDocument,
  gameObjectId: string,
  worldTransform: EditorTransformSnapshot,
): EditorTransformSnapshot | null {
  const gameObject = findEditorSceneGameObject(document, gameObjectId);
  if (!gameObject || !findEditorSceneTransform(gameObject)) return null;
  return toLocalTransformForParent(document, gameObject.parentId, worldTransform);
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
  const gameObject = document.scene.gameObjects.find((entry) => entry.id === gameObjectId);
  if (!gameObject) return null;
  return createSerializedObject({
    document,
    targetId: gameObjectId,
    label: gameObject.name ?? gameObject.id,
    descriptors: createEditorScenePropertyDescriptors(gameObject),
  });
}

export function getEditorSceneSerializedMultiObject(
  document: EditorSceneDocument,
  gameObjectIds: string[],
  activeId: string | null,
): SerializedMultiObject<EditorSceneDocument> | null {
  const gameObjects = gameObjectIds
    .map((gameObjectId) => document.scene.gameObjects.find((entry) => entry.id === gameObjectId) ?? null)
    .filter((gameObject): gameObject is EditorSceneGameObject => !!gameObject);
  if (gameObjects.length === 0) return null;
  return {
    targetIds: gameObjects.map((gameObject) => gameObject.id),
    activeId,
    label: `${gameObjects.length} GameObjects`,
    properties: createEditorSceneMultiTransformProperties(gameObjects),
  };
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

export type EditorSceneInspectorSourceTag = 'Document' | 'Runtime' | 'Asset' | 'Derived';

export interface EditorSceneReadonlyInspectorPropertyInput {
  path: string;
  label: string;
  value: unknown;
  order?: number;
  persistence?: InspectorProperty<EditorSceneDocument>['persistence'];
  source?: EditorSceneInspectorSourceTag;
  tags?: readonly string[];
  tooltip?: string;
  effect?: InspectorProperty<EditorSceneDocument>['effect'];
  disabledReason?: string;
  valueType?: InspectorProperty<EditorSceneDocument>['valueType'];
}

export interface EditorSceneReadonlyInspectorSectionInput {
  id: string;
  title: string;
  order: number;
  properties: Array<InspectorProperty<EditorSceneDocument> | null | undefined>;
  summary?: string;
  persistence?: InspectorSection<EditorSceneDocument>['persistence'];
  runtimeOnly?: boolean;
  effect?: InspectorSection<EditorSceneDocument>['effect'];
  disabledReason?: string;
  collapsedByDefault?: boolean;
  tags?: readonly string[];
  omitWhenEmpty?: boolean;
}

export function createEditorSceneReadonlyInspectorSection(
  input: EditorSceneReadonlyInspectorSectionInput,
): InspectorSection<EditorSceneDocument> | null {
  const properties = input.properties
    .filter((property): property is InspectorProperty<EditorSceneDocument> => !!property)
    .map((property, order) => property.order == null ? { ...property, order } : property);
  if (properties.length === 0 && input.omitWhenEmpty !== false) return null;
  return {
    id: input.id,
    title: input.title,
    order: input.order,
    placement: 'body',
    summary: input.summary,
    persistence: input.persistence ?? (input.runtimeOnly ? 'runtime' : 'readonly'),
    runtimeOnly: input.runtimeOnly,
    effect: input.effect ?? (input.runtimeOnly ? 'runtime' : undefined),
    disabledReason: input.disabledReason,
    collapsedByDefault: input.collapsedByDefault,
    tags: input.tags,
    properties,
  };
}

export function createEditorSceneReadonlyInspectorProperty(
  input: EditorSceneReadonlyInspectorPropertyInput,
): InspectorProperty<EditorSceneDocument> | null {
  if (!shouldDisplayEditorSceneInspectorValue(input.value)) return null;
  const value = toEditorSceneInspectorSafeValue(input.value);
  return {
    path: input.path,
    label: input.label,
    valueType: input.valueType ?? inferEditorSceneInspectorValueType(value),
    control: 'readonly',
    value,
    readOnly: true,
    persistence: input.persistence ?? 'readonly',
    commitMode: 'blur',
    order: input.order,
    tags: mergeEditorSceneInspectorTags(input.source, input.tags),
    tooltip: input.tooltip,
    effect: input.effect ?? inferEditorSceneInspectorEffect(input.source, input.persistence),
    disabledReason: input.disabledReason,
  };
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
  const vector = readEditorSceneInspectorVec3(input.value);
  if (!vector) return [];
  const order = input.order ?? 0;
  return (['x', 'y', 'z'] as const)
    .map((axis, index) => createEditorSceneReadonlyInspectorProperty({
      path: `${input.basePath}.${axis}`,
      label: `${input.label}.${axis}`,
      value: vector[axis],
      order: order + index,
      persistence: input.persistence,
      source: input.source,
      tags: input.tags,
      effect: input.effect,
      disabledReason: input.disabledReason,
      valueType: 'number',
    }))
    .filter((property): property is InspectorProperty<EditorSceneDocument> => !!property);
}

function inferEditorSceneInspectorEffect(
  source: EditorSceneInspectorSourceTag | undefined,
  persistence: InspectorProperty<EditorSceneDocument>['persistence'] | undefined,
): InspectorProperty<EditorSceneDocument>['effect'] {
  if (persistence === 'runtime' || source === 'Runtime') return 'runtime';
  if (source === 'Derived') return 'derived';
  return undefined;
}

export function readEditorSceneInspectorVec3(value: unknown): EditorSceneVec3 | null {
  if (!value || typeof value !== 'object') return null;
  const x = readEditorSceneRuntimeNumber(value, 'x');
  const y = readEditorSceneRuntimeNumber(value, 'y');
  const z = readEditorSceneRuntimeNumber(value, 'z');
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

export function readEditorSceneRuntimeValue(value: unknown, key: string): unknown {
  if (!isObjectRecord(value)) return undefined;
  try {
    return value[key];
  } catch {
    return undefined;
  }
}

export function readEditorSceneRuntimeString(value: unknown, key: string): string | null {
  const raw = readEditorSceneRuntimeValue(value, key);
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

export function readEditorSceneRuntimeNumber(value: unknown, key: string): number | null {
  const raw = readEditorSceneRuntimeValue(value, key);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

export function readEditorSceneRuntimeBoolean(value: unknown, key: string): boolean | null {
  const raw = readEditorSceneRuntimeValue(value, key);
  return typeof raw === 'boolean' ? raw : null;
}

export function callEditorSceneRuntimeMethod(value: unknown, key: string, args: readonly unknown[] = []): unknown {
  const method = readEditorSceneRuntimeValue(value, key);
  if (typeof method !== 'function') return undefined;
  try {
    return method.apply(value, args);
  } catch {
    return undefined;
  }
}

export function readEditorSceneRuntimeClassName(value: unknown): string | null {
  if (!isObjectRecord(value)) return null;
  const className = callEditorSceneRuntimeMethod(value, 'getClassName');
  if (typeof className === 'string' && className.trim()) return className;
  const constructorValue = readEditorSceneRuntimeValue(value, 'constructor');
  const constructorName = constructorValue && typeof constructorValue === 'function'
    ? constructorValue.name
    : '';
  return constructorName && constructorName !== 'Object' ? constructorName : null;
}

export function describeEditorSceneRuntimeObject(value: unknown): string | null {
  const className = readEditorSceneRuntimeClassName(value);
  const name = readEditorSceneRuntimeString(value, 'name');
  if (className && name) return `${className} · ${name}`;
  return className ?? name;
}

export function toEditorSceneInspectorSafeValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? roundForInspector(value) : '[NonFiniteNumber]';
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value === 'symbol') return String(value);
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[Circular]';
  if (depth > 6) return '[MaxDepth]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => toEditorSceneInspectorSafeValue(entry, seen, depth + 1));
  const record = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    output[key] = toEditorSceneInspectorSafeValue(readEditorSceneRuntimeValue(record, key), seen, depth + 1);
  }
  return output;
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
  return [
    createEditorSceneRuntimeBindingSection(context, gameObject, renderer, sourceRef, runtime),
    createEditorSceneGeometryBoxSection(runtime),
    createEditorSceneRenderingSection(runtime),
    createEditorSceneCollisionsSection(runtime),
    createEditorScenePhysicsSection(runtime),
    createEditorSceneShadowsSection(runtime),
    createEditorSceneMaterialSection(runtime),
    createEditorSceneMaterialTexturesSection(runtime),
    createEditorSceneMaterialColorsSection(runtime),
    createEditorSceneMetallicRoughnessSection(runtime),
    createEditorSceneIntensityPropertiesSection(runtime),
    createEditorSceneAnimationSkeletonSection(runtime),
    createEditorSceneRawMiscSection(context, runtime),
  ].filter((section): section is InspectorSection<EditorSceneDocument> => !!section);
}

function createEditorSceneRuntimeBindingSection(
  context: EditorSceneRuntimeInspectorContext,
  gameObject: EditorSceneGameObject,
  renderer: ReturnType<typeof findEditorSceneModelRenderer>,
  sourceRef: ReturnType<typeof getEditorSceneAuthoringSourceRef>,
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.binding.sourceId',
    label: 'Source ID',
    value: sourceRef.sourceId,
    order: 0,
    source: 'Document',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.binding.sourceType',
    label: 'Source Type',
    value: sourceRef.sourceType,
    order: 1,
    source: 'Document',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.binding.objectId',
    label: 'Object ID',
    value: gameObject.id,
    order: 2,
    source: 'Document',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.binding.component',
    label: 'Component',
    value: renderer ? 'ModelRenderer' : readEditorSceneNodeKind(gameObject) === 'transform' ? 'Transform' : 'GameObject',
    order: 3,
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.projection.nodeId',
    label: 'Projection Node ID',
    value: readEditorSceneRuntimeString(context.projectionNode, 'id') ?? 'none',
    order: 4,
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.projection.name',
    label: 'Projection Name',
    value: readEditorSceneRuntimeString(context.projectionNode, 'name') ?? 'none',
    order: 5,
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.projection.parentId',
    label: 'Projection Parent',
    value: readEditorSceneRuntimeString(context.projectionNode, 'parentId') ?? 'none',
    order: 6,
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.projection.assetId',
    label: 'Projection Asset ID',
    value: readProjectionAssetId(context.projectionNode) ?? 'none',
    order: 7,
    source: 'Asset',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.root.status',
    label: 'Projected Root',
    value: runtime.root ? 'available' : 'not projected',
    order: 8,
    source: 'Runtime',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.root.className',
    label: 'Runtime Class',
    value: readEditorSceneRuntimeClassName(runtime.root) ?? 'none',
    order: 9,
    source: 'Runtime',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.root.name',
    label: 'Runtime Name',
    value: readEditorSceneRuntimeString(runtime.root, 'name') ?? 'none',
    order: 10,
    source: 'Runtime',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.binding.primaryMesh',
    label: 'Primary Mesh',
    value: describeEditorSceneRuntimeObject(runtime.primaryMesh) ?? 'none',
    order: 11,
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.binding.primaryMaterial',
    label: 'Primary Material',
    value: describeEditorSceneRuntimeObject(runtime.material) ?? 'none',
    order: 12,
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.material.kind',
    label: 'Material Kind',
    value: resolveProjectedMaterialRuntimeKindFromMaterial(runtime.material) ?? 'none',
    order: 13,
    source: 'Runtime',
  });
  return createRuntimeInspectorSection({
    id: 'runtimeBinding',
    title: 'Runtime Binding',
    order: 910,
    summary: runtime.root ? describeEditorSceneRuntimeObject(runtime.root) ?? 'Runtime' : 'not projected',
    collapsedByDefault: true,
    properties,
  });
}

interface EditorSceneRuntimeInspectorSnapshot {
  root: unknown;
  projectionNode: unknown;
  childNodes: unknown[];
  meshes: unknown[];
  primaryMesh: unknown;
  material: unknown;
}

function createEditorSceneRuntimeInspectorSnapshot(
  context: EditorSceneRuntimeInspectorContext,
): EditorSceneRuntimeInspectorSnapshot {
  const root = context.projectedRoot ?? null;
  const meshes = collectEditorSceneRuntimeMeshes(root);
  const primaryMesh = meshes.find((mesh) => !!readEditorSceneRuntimeValue(mesh, 'material')) ?? meshes[0] ?? null;
  return {
    root,
    projectionNode: context.projectionNode ?? null,
    childNodes: collectEditorSceneRuntimeChildNodes(root),
    meshes,
    primaryMesh,
    material: findProjectedRuntimeMaterial(root),
  };
}

function createEditorSceneGeometryBoxSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  const bounds = readEditorSceneRuntimeBounds(runtime.root) ?? readEditorSceneRuntimeBounds(runtime.primaryMesh);
  if (bounds) {
    appendRuntimeVector3Properties(properties, 'runtime.bounds.min', 'Bounds Min', bounds.min, properties.length, 'Derived');
    appendRuntimeVector3Properties(properties, 'runtime.bounds.max', 'Bounds Max', bounds.max, properties.length, 'Derived');
    appendRuntimeVector3Properties(properties, 'runtime.bounds.center', 'Bounds Center', bounds.center, properties.length, 'Derived');
    appendRuntimeVector3Properties(properties, 'runtime.bounds.size', 'Bounds Size', bounds.size, properties.length, 'Derived');
  } else {
    appendRuntimeInspectorProperty(properties, {
      path: 'runtime.bounds.status',
      label: 'Bounds',
      value: 'not available',
      source: 'Derived',
    });
  }
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.geometry.meshCount',
    label: 'Mesh Count',
    value: runtime.meshes.length,
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.geometry.childNodeCount',
    label: 'Child Nodes',
    value: runtime.childNodes.length,
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.geometry.totalVertices',
    label: 'Total Vertices',
    value: sumEditorSceneRuntimeMeshNumbers(runtime.meshes, 'getTotalVertices'),
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.geometry.totalIndices',
    label: 'Total Indices',
    value: sumEditorSceneRuntimeMeshNumbers(runtime.meshes, 'getTotalIndices'),
    source: 'Derived',
  });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.geometry.subMeshCount',
    label: 'SubMeshes',
    value: runtime.meshes.reduce<number>((total, mesh) => total + readEditorSceneRuntimeArrayLength(mesh, 'subMeshes'), 0),
    source: 'Derived',
  });
  return createRuntimeInspectorSection({
    id: 'geometryBox',
    title: 'Geometry / Box',
    order: 920,
    summary: bounds ? `${runtime.meshes.length} mesh${runtime.meshes.length === 1 ? '' : 'es'}` : 'no bounds',
    collapsedByDefault: false,
    properties,
  });
}

function createEditorSceneRenderingSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const target = runtime.primaryMesh ?? runtime.root;
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.nodeClass', label: 'Node Class', value: readEditorSceneRuntimeClassName(target) ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.nodeName', label: 'Node Name', value: readEditorSceneRuntimeString(target, 'name') ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.isEnabled', label: 'Enabled', value: readEditorSceneRuntimeIsEnabled(target) ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.isVisible', label: 'Is Visible', value: readEditorSceneRuntimeBoolean(target, 'isVisible') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.visibility', label: 'Visibility', value: readEditorSceneRuntimeNumber(target, 'visibility') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.layerMask', label: 'Layer Mask', value: readEditorSceneRuntimeNumber(target, 'layerMask') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.renderingGroupId', label: 'Rendering Group', value: readEditorSceneRuntimeNumber(target, 'renderingGroupId') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.alphaIndex', label: 'Alpha Index', value: readEditorSceneRuntimeNumber(target, 'alphaIndex') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.alwaysSelectAsActiveMesh', label: 'Always Active Mesh', value: readEditorSceneRuntimeBoolean(target, 'alwaysSelectAsActiveMesh') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.rendering.billboardMode', label: 'Billboard Mode', value: readEditorSceneRuntimeNumber(target, 'billboardMode') ?? 'not available' });
  return createRuntimeInspectorSection({
    id: 'rendering',
    title: 'Rendering',
    order: 930,
    summary: readEditorSceneRuntimeString(target, 'name') ?? readEditorSceneRuntimeClassName(target) ?? 'not available',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorSceneCollisionsSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const target = runtime.primaryMesh ?? runtime.root;
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendRuntimeInspectorProperty(properties, { path: 'runtime.collisions.checkCollisions', label: 'Check Collisions', value: readEditorSceneRuntimeBoolean(target, 'checkCollisions') ?? 'not configured' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.collisions.collisionMask', label: 'Collision Mask', value: readEditorSceneRuntimeNumber(target, 'collisionMask') ?? 'not configured' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.collisions.collisionGroup', label: 'Collision Group', value: readEditorSceneRuntimeNumber(target, 'collisionGroup') ?? 'not configured' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.collisions.collisionResponse', label: 'Collision Response', value: readEditorSceneRuntimeBoolean(target, 'collisionResponse') ?? 'not configured' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.collisions.moveWithCollisions', label: 'Move With Collisions', value: typeof readEditorSceneRuntimeValue(target, 'moveWithCollisions') === 'function' ? 'available' : 'not available' });
  appendRuntimeVector3Properties(properties, 'runtime.collisions.ellipsoid', 'Ellipsoid', readEditorSceneRuntimeValue(target, 'ellipsoid'), properties.length, 'Runtime', 'not configured');
  appendRuntimeVector3Properties(properties, 'runtime.collisions.ellipsoidOffset', 'Ellipsoid Offset', readEditorSceneRuntimeValue(target, 'ellipsoidOffset'), properties.length, 'Runtime', 'not configured');
  return createRuntimeInspectorSection({
    id: 'collisions',
    title: 'Collisions',
    order: 940,
    summary: readEditorSceneRuntimeBoolean(target, 'checkCollisions') === true ? 'enabled' : 'not configured',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorScenePhysicsSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const target = runtime.primaryMesh ?? runtime.root;
  const physicsBody = readEditorSceneRuntimeValue(target, 'physicsBody');
  const physicsImpostor = readEditorSceneRuntimeValue(target, 'physicsImpostor');
  const body = physicsBody ?? physicsImpostor;
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendRuntimeInspectorProperty(properties, { path: 'runtime.physics.status', label: 'Physics', value: body ? 'configured' : 'not configured' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.physics.bodyClass', label: 'Body Class', value: readEditorSceneRuntimeClassName(body) ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.physics.bodyName', label: 'Body Name', value: readEditorSceneRuntimeString(body, 'name') ?? readEditorSceneRuntimeString(body, 'id') ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.physics.mass', label: 'Mass', value: readEditorScenePhysicsParam(body, 'mass') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.physics.friction', label: 'Friction', value: readEditorScenePhysicsParam(body, 'friction') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.physics.restitution', label: 'Restitution', value: readEditorScenePhysicsParam(body, 'restitution') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.physics.disablePreStep', label: 'Disable Pre Step', value: readEditorSceneRuntimeBoolean(body, 'disablePreStep') ?? 'not available' });
  return createRuntimeInspectorSection({
    id: 'physics',
    title: 'Physics',
    order: 950,
    summary: body ? describeEditorSceneRuntimeObject(body) ?? 'configured' : 'not configured',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorSceneShadowsSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const target = runtime.primaryMesh ?? runtime.root;
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendRuntimeInspectorProperty(properties, { path: 'runtime.shadows.receiveShadows', label: 'Receive Shadows', value: readEditorSceneRuntimeBoolean(target, 'receiveShadows') ?? 'not configured' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.shadows.shadowEnabled', label: 'Shadow Enabled', value: callEditorSceneRuntimeMethod(target, 'isShadowEnabled') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.shadows.shadowDepthWrapper', label: 'Shadow Depth Wrapper', value: describeEditorSceneRuntimeObject(readEditorSceneRuntimeValue(runtime.material, 'shadowDepthWrapper')) ?? 'none' });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.shadows.receivingMeshCount',
    label: 'Receiving Meshes',
    value: runtime.meshes.filter((mesh) => readEditorSceneRuntimeBoolean(mesh, 'receiveShadows') === true).length,
    source: 'Derived',
  });
  return createRuntimeInspectorSection({
    id: 'shadows',
    title: 'Shadows',
    order: 960,
    summary: readEditorSceneRuntimeBoolean(target, 'receiveShadows') === true ? 'receiving' : 'not configured',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorSceneMaterialSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const material = runtime.material;
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.status', label: 'Material', value: material ? 'available' : 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.className', label: 'Class', value: readEditorSceneRuntimeClassName(material) ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.name', label: 'Name', value: readEditorSceneRuntimeString(material, 'name') ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.id', label: 'ID', value: readEditorSceneRuntimeString(material, 'id') ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.uniqueId', label: 'Unique ID', value: readEditorSceneRuntimeNumber(material, 'uniqueId') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.alpha', label: 'Alpha', value: readEditorSceneRuntimeNumber(material, 'alpha') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.backFaceCulling', label: 'Back Face Culling', value: readEditorSceneRuntimeBoolean(material, 'backFaceCulling') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.twoSidedLighting', label: 'Two Sided Lighting', value: readEditorSceneRuntimeBoolean(material, 'twoSidedLighting') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.disableLighting', label: 'Disable Lighting', value: readEditorSceneRuntimeBoolean(material, 'disableLighting') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.wireframe', label: 'Wireframe', value: readEditorSceneRuntimeBoolean(material, 'wireframe') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.pointsCloud', label: 'Points Cloud', value: readEditorSceneRuntimeBoolean(material, 'pointsCloud') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.fillMode', label: 'Fill Mode', value: readEditorSceneRuntimeNumber(material, 'fillMode') ?? 'not available' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.material.activeTextureCount', label: 'Active Textures', value: readEditorSceneRuntimeArrayLengthFromMethod(material, 'getActiveTextures'), source: 'Derived' });
  return createRuntimeInspectorSection({
    id: 'material',
    title: 'Material',
    order: 970,
    summary: describeEditorSceneRuntimeObject(material) ?? 'none',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorSceneMaterialTexturesSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const material = runtime.material;
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.material.textures.activeCount',
    label: 'Active Texture Count',
    value: readEditorSceneRuntimeArrayLengthFromMethod(material, 'getActiveTextures'),
    source: 'Derived',
  });
  let textureCount = 0;
  for (const slot of EDITOR_SCENE_RUNTIME_TEXTURE_SLOTS) {
    const texture = readEditorSceneRuntimeValue(material, slot);
    if (!texture) continue;
    textureCount += 1;
    appendTextureInspectorProperties(properties, `runtime.material.textures.${slot}`, toInspectorLabel(slot), texture);
  }
  if (textureCount === 0) {
    appendRuntimeInspectorProperty(properties, { path: 'runtime.material.textures.status', label: 'Textures', value: 'none' });
  }
  return createRuntimeInspectorSection({
    id: 'materialTextures',
    title: 'Material Textures',
    order: 980,
    summary: textureCount > 0 ? `${textureCount} slot${textureCount === 1 ? '' : 's'}` : 'none',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorSceneMaterialColorsSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  let colorCount = 0;
  for (const slot of EDITOR_SCENE_RUNTIME_COLOR_SLOTS) {
    const color = readEditorSceneRuntimeValue(runtime.material, slot);
    if (!appendRuntimeColorProperties(properties, `runtime.material.colors.${slot}`, toInspectorLabel(slot), color, properties.length)) continue;
    colorCount += 1;
  }
  if (colorCount === 0) appendRuntimeInspectorProperty(properties, { path: 'runtime.material.colors.status', label: 'Colors', value: 'none' });
  return createRuntimeInspectorSection({
    id: 'materialColors',
    title: 'Material Colors',
    order: 990,
    summary: colorCount > 0 ? `${colorCount} color${colorCount === 1 ? '' : 's'}` : 'none',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorSceneMetallicRoughnessSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  for (const slot of EDITOR_SCENE_RUNTIME_METALLIC_ROUGHNESS_SLOTS) {
    appendRuntimeInspectorProperty(properties, {
      path: `runtime.material.metallicRoughness.${slot}`,
      label: toInspectorLabel(slot),
      value: readEditorSceneRuntimeNumber(runtime.material, slot) ?? 'not available',
    });
  }
  return createRuntimeInspectorSection({
    id: 'metallicRoughness',
    title: 'Metallic / Roughness',
    order: 1000,
    summary: runtime.material ? 'runtime material' : 'none',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorSceneIntensityPropertiesSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  for (const slot of EDITOR_SCENE_RUNTIME_INTENSITY_SLOTS) {
    appendRuntimeInspectorProperty(properties, {
      path: `runtime.material.intensity.${slot}`,
      label: toInspectorLabel(slot),
      value: readEditorSceneRuntimeNumber(runtime.material, slot) ?? 'not available',
    });
  }
  return createRuntimeInspectorSection({
    id: 'intensityProperties',
    title: 'Intensity Properties',
    order: 1010,
    summary: runtime.material ? 'runtime material' : 'none',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorSceneAnimationSkeletonSection(
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const target = runtime.primaryMesh ?? runtime.root;
  const skeleton = readEditorSceneRuntimeValue(target, 'skeleton');
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendRuntimeInspectorProperty(properties, { path: 'runtime.animation.rootAnimationCount', label: 'Root Animations', value: readEditorSceneRuntimeArrayLength(runtime.root, 'animations'), source: 'Derived' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.animation.meshAnimationCount', label: 'Mesh Animations', value: readEditorSceneRuntimeArrayLength(target, 'animations'), source: 'Derived' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.skeleton.status', label: 'Skeleton', value: skeleton ? 'available' : 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.skeleton.className', label: 'Skeleton Class', value: readEditorSceneRuntimeClassName(skeleton) ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.skeleton.name', label: 'Skeleton Name', value: readEditorSceneRuntimeString(skeleton, 'name') ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.skeleton.id', label: 'Skeleton ID', value: readEditorSceneRuntimeString(skeleton, 'id') ?? 'none' });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.skeleton.boneCount', label: 'Bones', value: readEditorSceneRuntimeArrayLength(skeleton, 'bones'), source: 'Derived' });
  return createRuntimeInspectorSection({
    id: 'animationSkeleton',
    title: 'Animation / Skeleton',
    order: 1020,
    summary: skeleton ? readEditorSceneRuntimeString(skeleton, 'name') ?? 'skeleton' : 'none',
    collapsedByDefault: true,
    properties,
  });
}

function createEditorSceneRawMiscSection(
  context: EditorSceneRuntimeInspectorContext,
  runtime: EditorSceneRuntimeInspectorSnapshot,
): InspectorSection<EditorSceneDocument> | null {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendRuntimeInspectorProperty(properties, { path: 'runtime.raw.rootMetadata', label: 'Root Metadata', value: readEditorSceneRuntimeValue(runtime.root, 'metadata') ?? 'none', tags: ['Raw'] });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.raw.primaryMeshMetadata', label: 'Mesh Metadata', value: readEditorSceneRuntimeValue(runtime.primaryMesh, 'metadata') ?? 'none', tags: ['Raw'] });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.raw.materialMetadata', label: 'Material Metadata', value: readEditorSceneRuntimeValue(runtime.material, 'metadata') ?? 'none', tags: ['Raw'] });
  appendRuntimeInspectorProperty(properties, { path: 'runtime.raw.projectionAssetMetadata', label: 'Projection Asset Metadata', value: readProjectionAssetMetadata(context.projectionNode) ?? 'none', source: 'Asset', tags: ['Raw'] });
  appendRuntimeInspectorProperty(properties, {
    path: 'runtime.misc.isDisposed',
    label: 'Root Disposed',
    value: callEditorSceneRuntimeMethod(runtime.root, 'isDisposed') ?? 'not available',
  });
  return createRuntimeInspectorSection({
    id: 'rawMisc',
    title: 'Raw / Misc',
    order: 1030,
    summary: 'metadata',
    collapsedByDefault: true,
    properties,
  });
}

function createRuntimeInspectorSection(input: {
  id: string;
  title: string;
  order: number;
  properties: Array<InspectorProperty<EditorSceneDocument> | null | undefined>;
  summary?: string;
  collapsedByDefault?: boolean;
}): InspectorSection<EditorSceneDocument> | null {
  return createEditorSceneReadonlyInspectorSection({
    id: input.id,
    title: input.title,
    order: input.order,
    summary: input.summary,
    persistence: 'runtime',
    runtimeOnly: true,
    collapsedByDefault: input.collapsedByDefault,
    omitWhenEmpty: false,
    tags: ['Runtime'],
    properties: input.properties,
  });
}

function appendRuntimeInspectorProperty(
  properties: InspectorProperty<EditorSceneDocument>[],
  input: Omit<EditorSceneReadonlyInspectorPropertyInput, 'persistence'>,
): void {
  appendReadonlyInspectorProperty(properties, {
    ...input,
    persistence: 'runtime',
    source: input.source ?? 'Runtime',
  });
}

function appendRuntimeVector3Properties(
  properties: InspectorProperty<EditorSceneDocument>[],
  basePath: string,
  label: string,
  value: unknown,
  order: number,
  source: EditorSceneInspectorSourceTag = 'Runtime',
  missingValue?: string,
): void {
  const vectorProperties = createEditorSceneReadonlyVector3Properties({
    basePath,
    label,
    value,
    order,
    persistence: 'runtime',
    source,
  });
  if (vectorProperties.length > 0) properties.push(...vectorProperties);
  else if (missingValue) appendRuntimeInspectorProperty(properties, { path: `${basePath}.status`, label, value: missingValue, order, source });
}

function appendRuntimeColorProperties(
  properties: InspectorProperty<EditorSceneDocument>[],
  basePath: string,
  label: string,
  value: unknown,
  order: number,
): boolean {
  const color = readEditorSceneInspectorColor(value);
  if (!color) return false;
  appendRuntimeInspectorProperty(properties, { path: `${basePath}.r`, label: `${label}.r`, value: color.r, order, valueType: 'number' });
  appendRuntimeInspectorProperty(properties, { path: `${basePath}.g`, label: `${label}.g`, value: color.g, order: order + 1, valueType: 'number' });
  appendRuntimeInspectorProperty(properties, { path: `${basePath}.b`, label: `${label}.b`, value: color.b, order: order + 2, valueType: 'number' });
  if (color.a != null) appendRuntimeInspectorProperty(properties, { path: `${basePath}.a`, label: `${label}.a`, value: color.a, order: order + 3, valueType: 'number' });
  return true;
}

function appendTextureInspectorProperties(
  properties: InspectorProperty<EditorSceneDocument>[],
  basePath: string,
  label: string,
  texture: unknown,
): void {
  const order = properties.length;
  appendRuntimeInspectorProperty(properties, { path: `${basePath}.className`, label: `${label} Class`, value: readEditorSceneRuntimeClassName(texture) ?? 'Texture', order });
  appendRuntimeInspectorProperty(properties, { path: `${basePath}.name`, label: `${label} Name`, value: readEditorSceneRuntimeString(texture, 'name') ?? 'none', order: order + 1 });
  appendRuntimeInspectorProperty(properties, { path: `${basePath}.url`, label: `${label} URL`, value: readEditorSceneTextureUrl(texture) ?? 'none', order: order + 2 });
  appendRuntimeInspectorProperty(properties, { path: `${basePath}.level`, label: `${label} Level`, value: readEditorSceneRuntimeNumber(texture, 'level') ?? 'not available', order: order + 3 });
  appendRuntimeInspectorProperty(properties, { path: `${basePath}.coordinatesIndex`, label: `${label} UV Set`, value: readEditorSceneRuntimeNumber(texture, 'coordinatesIndex') ?? 'not available', order: order + 4 });
  appendRuntimeInspectorProperty(properties, { path: `${basePath}.hasAlpha`, label: `${label} Has Alpha`, value: readEditorSceneRuntimeBoolean(texture, 'hasAlpha') ?? 'not available', order: order + 5 });
}

interface EditorSceneRuntimeBounds {
  min: EditorSceneVec3;
  max: EditorSceneVec3;
  center: EditorSceneVec3;
  size: EditorSceneVec3;
}

function readEditorSceneRuntimeBounds(value: unknown): EditorSceneRuntimeBounds | null {
  const hierarchyBounds = callEditorSceneRuntimeMethod(value, 'getHierarchyBoundingVectors');
  const hierarchyMin = readEditorSceneInspectorVec3(readEditorSceneRuntimeValue(hierarchyBounds, 'min'));
  const hierarchyMax = readEditorSceneInspectorVec3(readEditorSceneRuntimeValue(hierarchyBounds, 'max'));
  if (hierarchyMin && hierarchyMax) return createEditorSceneRuntimeBounds(hierarchyMin, hierarchyMax);
  const boundingInfo = callEditorSceneRuntimeMethod(value, 'getBoundingInfo');
  const boundingBox = readEditorSceneRuntimeValue(boundingInfo, 'boundingBox');
  const minimumWorld = readEditorSceneInspectorVec3(readEditorSceneRuntimeValue(boundingBox, 'minimumWorld'));
  const maximumWorld = readEditorSceneInspectorVec3(readEditorSceneRuntimeValue(boundingBox, 'maximumWorld'));
  if (minimumWorld && maximumWorld) return createEditorSceneRuntimeBounds(minimumWorld, maximumWorld);
  return null;
}

function createEditorSceneRuntimeBounds(min: EditorSceneVec3, max: EditorSceneVec3): EditorSceneRuntimeBounds {
  return {
    min,
    max,
    center: {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2,
    },
    size: {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z,
    },
  };
}

function collectEditorSceneRuntimeMeshes(root: unknown): unknown[] {
  const meshes = callEditorSceneRuntimeMethod(root, 'getChildMeshes', [false]);
  const result = Array.isArray(meshes) ? [...meshes] : [];
  if (isEditorSceneRuntimeMeshLike(root)) result.unshift(root);
  return [...new Set(result)];
}

function collectEditorSceneRuntimeChildNodes(root: unknown): unknown[] {
  const children = callEditorSceneRuntimeMethod(root, 'getChildren');
  return Array.isArray(children) ? children : [];
}

function isEditorSceneRuntimeMeshLike(value: unknown): boolean {
  return !!value && (
    !!readEditorSceneRuntimeValue(value, 'material')
    || typeof readEditorSceneRuntimeValue(value, 'getTotalVertices') === 'function'
    || typeof readEditorSceneRuntimeValue(value, 'getBoundingInfo') === 'function'
  );
}

function sumEditorSceneRuntimeMeshNumbers(meshes: unknown[], methodName: string): number | string {
  let total = 0;
  let count = 0;
  for (const mesh of meshes) {
    const value = callEditorSceneRuntimeMethod(mesh, methodName);
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    total += value;
    count += 1;
  }
  return count > 0 ? total : 'not available';
}

function readEditorSceneRuntimeArrayLength(value: unknown, key: string): number {
  const raw = readEditorSceneRuntimeValue(value, key);
  return Array.isArray(raw) ? raw.length : 0;
}

function readEditorSceneRuntimeArrayLengthFromMethod(value: unknown, key: string): number | string {
  const raw = callEditorSceneRuntimeMethod(value, key);
  return Array.isArray(raw) ? raw.length : 'not available';
}

function readEditorSceneRuntimeIsEnabled(value: unknown): boolean | null {
  const enabled = callEditorSceneRuntimeMethod(value, 'isEnabled');
  return typeof enabled === 'boolean' ? enabled : null;
}

function readEditorScenePhysicsParam(value: unknown, key: string): number | null {
  const direct = readEditorSceneRuntimeNumber(value, key);
  if (direct != null) return direct;
  const param = callEditorSceneRuntimeMethod(value, 'getParam', [key]);
  return typeof param === 'number' && Number.isFinite(param) ? param : null;
}

function readEditorSceneTextureUrl(texture: unknown): string | null {
  return readEditorSceneRuntimeString(texture, 'url')
    ?? readEditorSceneRuntimeString(texture, 'name')
    ?? readEditorSceneRuntimeString(callEditorSceneRuntimeMethod(texture, 'getInternalTexture'), 'url');
}

function readEditorSceneInspectorColor(value: unknown): { r: number; g: number; b: number; a?: number } | null {
  if (!value || typeof value !== 'object') return null;
  const r = readEditorSceneRuntimeNumber(value, 'r');
  const g = readEditorSceneRuntimeNumber(value, 'g');
  const b = readEditorSceneRuntimeNumber(value, 'b');
  if (r == null || g == null || b == null) return null;
  const a = readEditorSceneRuntimeNumber(value, 'a');
  return a == null ? { r, g, b } : { r, g, b, a };
}

function readProjectionAssetId(projectionNode: unknown): string | null {
  const asset = readEditorSceneRuntimeValue(projectionNode, 'asset');
  return readEditorSceneRuntimeString(asset, 'assetId') ?? readEditorSceneRuntimeString(asset, 'id');
}

function readProjectionAssetMetadata(projectionNode: unknown): unknown {
  return readEditorSceneRuntimeValue(readEditorSceneRuntimeValue(projectionNode, 'asset'), 'metadata');
}

function resolveProjectedMaterialRuntimeKindFromMaterial(material: unknown): string | null {
  const className = readEditorSceneRuntimeClassName(material);
  if (!className) return null;
  if (className.includes('PBR')) return 'pbr';
  if (className.includes('Standard')) return 'standard';
  return className;
}

const EDITOR_SCENE_RUNTIME_TEXTURE_SLOTS = [
  'albedoTexture',
  'diffuseTexture',
  'emissiveTexture',
  'ambientTexture',
  'opacityTexture',
  'bumpTexture',
  'normalTexture',
  'metallicTexture',
  'reflectionTexture',
  'refractionTexture',
  'lightmapTexture',
  'specularTexture',
  'roughnessTexture',
] as const;

const EDITOR_SCENE_RUNTIME_COLOR_SLOTS = [
  'albedoColor',
  'diffuseColor',
  'emissiveColor',
  'ambientColor',
  'specularColor',
  'reflectivityColor',
] as const;

const EDITOR_SCENE_RUNTIME_METALLIC_ROUGHNESS_SLOTS = [
  'metallic',
  'roughness',
  'microSurface',
  'specularPower',
  'baseWeight',
  'indexOfRefraction',
] as const;

const EDITOR_SCENE_RUNTIME_INTENSITY_SLOTS = [
  'directIntensity',
  'emissiveIntensity',
  'environmentIntensity',
  'specularIntensity',
  'cameraExposure',
  'cameraContrast',
] as const;

function toInspectorLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function findProjectedRuntimeMaterial(root: unknown): unknown {
  const record = isObjectRecord(root) ? root : null;
  const directMaterial = readEditorSceneRuntimeValue(record, 'material');
  if (directMaterial) return directMaterial;
  const meshes = callEditorSceneRuntimeMethod(root, 'getChildMeshes', [false]);
  if (Array.isArray(meshes)) {
    const mesh = meshes.find((candidate) => !!readEditorSceneRuntimeValue(candidate, 'material'));
    if (mesh) return readEditorSceneRuntimeValue(mesh, 'material');
  }
  return null;
}

function isObjectRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object';
}

/*
 * Runtime Inspector sections intentionally use only guarded property/method reads.
 * Babylon objects can contain throwing getters while assets are loading or after disposal.
 */
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
  const sourceMaterialAsset = findEditorSceneMaterialAsset(document, sourceMaterialAssetId);
  if (!sourceMaterialAsset) return null;
  if (!resolveSceneNodeFieldSchema(bindingPath, readEditorSceneNodeKind(gameObject))) return null;
  const materialAsset = createEditorSceneDuplicatedMaterialAsset(document, gameObject, sourceMaterialAsset);
  return {
    label: `Duplicate material ${sourceMaterialAsset.name} for ${gameObject.name ?? gameObject.id}`,
    patch: {
      kind: 'scene.material-asset.duplicate-and-bind',
      targetId: gameObject.id,
      bindingPath,
      materialAsset,
    },
    changedId: gameObject.id,
    changedIds: [gameObject.id],
    reprojectIds: [gameObject.id],
  };
}

function collectEditorSceneMaterialAssetBindingIds(
  document: EditorSceneDocument,
  materialAssetId: string,
): string[] {
  const ids: string[] = [];
  for (const gameObject of document.scene.gameObjects) {
    if (gameObject.overrides?.materialBinding?.materialAssetId === materialAssetId) {
      ids.push(gameObject.id);
      continue;
    }
    if (Object.values(gameObject.overrides?.childMaterialBindings ?? {}).some(binding => binding?.materialAssetId === materialAssetId)) {
      ids.push(gameObject.id);
    }
  }
  return ids;
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

function resolveCreateGroupParentId(
  document: EditorSceneDocument,
  intent: SceneGraphCreateGroupIntent,
): string | null | undefined {
  if (intent.parentId) {
    const parent = findEditorSceneGameObject(document, intent.parentId);
    return parent && canEditorSceneGameObjectHaveChildren(parent) ? parent.id : null;
  }
  const active = intent.activeId ? findEditorSceneGameObject(document, intent.activeId) : null;
  if (active && canEditorSceneGameObjectHaveChildren(active)) return active.id;
  if (active?.parentId) {
    const activeParent = findEditorSceneGameObject(document, active.parentId);
    if (activeParent && canEditorSceneGameObjectHaveChildren(activeParent)) return activeParent.id;
  }
  return document.scene.gameObjects.find((gameObject) => gameObject.id === EDITOR_SCENE_ROOT_ID && canEditorSceneGameObjectHaveChildren(gameObject))?.id
    ?? document.scene.gameObjects.find((gameObject) => !gameObject.parentId && canEditorSceneGameObjectHaveChildren(gameObject))?.id;
}

function resolveEditorSceneRootContainerId(document: EditorSceneDocument): string | undefined {
  return document.scene.gameObjects.find((gameObject) => gameObject.id === EDITOR_SCENE_ROOT_ID && canEditorSceneGameObjectHaveChildren(gameObject))?.id
    ?? document.scene.gameObjects.find((gameObject) => !gameObject.parentId && canEditorSceneGameObjectHaveChildren(gameObject))?.id;
}

function resolveEditorSceneMoveParentId(document: EditorSceneDocument, intent: SceneGraphMoveIntent): string | undefined {
  if (intent.placement === 'root') return resolveEditorSceneRootContainerId(document);
  if (intent.placement === 'inside' && intent.targetId) return intent.targetId;
  const target = intent.targetId ? findEditorSceneGameObject(document, intent.targetId) : null;
  return intent.parentId ?? target?.parentId ?? resolveEditorSceneRootContainerId(document);
}

function resolveEditorSceneGroupSelectionParentId(document: EditorSceneDocument, parentId: string | null): string | undefined {
  return parentId && isEditorSceneContainer(document, parentId) ? parentId : resolveEditorSceneRootContainerId(document);
}

function isEditorSceneContainer(document: EditorSceneDocument, gameObjectId: string): boolean {
  const gameObject = findEditorSceneGameObject(document, gameObjectId);
  return !!gameObject && canEditorSceneGameObjectHaveChildren(gameObject);
}

function collectEditorSceneSubtreeIds(document: EditorSceneDocument, rootIds: string[]): Set<string> {
  const ids = new Set(rootIds.filter((id) => !!findEditorSceneGameObject(document, id)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const gameObject of document.scene.gameObjects) {
      if (gameObject.parentId && ids.has(gameObject.parentId) && !ids.has(gameObject.id)) {
        ids.add(gameObject.id);
        changed = true;
      }
    }
  }
  return ids;
}

function createEditorSceneMoveOrder(
  document: EditorSceneDocument,
  ids: readonly string[],
  intent: SceneGraphMoveIntent,
): string[] {
  const blockIds = collectOrderedEditorSceneSubtreeBlockIds(document, ids);
  const blockSet = new Set(blockIds);
  const remaining = document.scene.gameObjects
    .map((gameObject) => gameObject.id)
    .filter((id) => !blockSet.has(id));
  const index = resolveEditorSceneInsertIndex(document, remaining, {
    placement: intent.placement,
    targetId: intent.targetId ?? null,
    beforeId: intent.beforeId ?? null,
    afterId: intent.afterId ?? null,
    parentId: resolveEditorSceneMoveParentId(document, intent),
  });
  return insertEditorSceneIdsAt(remaining, blockIds, index);
}

function createEditorSceneGroupSelectionOrder(
  document: EditorSceneDocument,
  groupId: string,
  ids: readonly string[],
  insertBeforeId: string | null,
): string[] {
  const blockIds = collectOrderedEditorSceneSubtreeBlockIds(document, ids);
  const blockSet = new Set(blockIds);
  const currentOrder = document.scene.gameObjects.map((gameObject) => gameObject.id);
  const remaining = currentOrder.filter((id) => !blockSet.has(id));
  const firstSelectedIndex = Math.min(...ids.map((id) => currentOrder.indexOf(id)).filter((index) => index >= 0));
  const fallbackIndex = Number.isFinite(firstSelectedIndex)
    ? remaining.filter((id) => currentOrder.indexOf(id) < firstSelectedIndex).length
    : remaining.length;
  const index = insertBeforeId
    ? Math.max(0, remaining.indexOf(insertBeforeId))
    : fallbackIndex;
  return insertEditorSceneIdsAt(remaining, [groupId, ...blockIds], index);
}

function collectOrderedEditorSceneSubtreeBlockIds(document: EditorSceneDocument, rootIds: readonly string[]): string[] {
  const subtreeIds = collectEditorSceneSubtreeIds(document, [...rootIds]);
  return document.scene.gameObjects
    .map((gameObject) => gameObject.id)
    .filter((id) => subtreeIds.has(id));
}

function resolveEditorSceneInsertIndex(
  document: EditorSceneDocument,
  remaining: readonly string[],
  input: {
    placement: SceneGraphMoveIntent['placement'];
    targetId: string | null;
    beforeId: string | null;
    afterId: string | null;
    parentId?: string;
  },
): number {
  if (input.beforeId) return boundedInsertIndex(remaining.indexOf(input.beforeId), remaining.length);
  if (input.afterId) return indexAfterEditorSceneSubtree(document, remaining, input.afterId);
  if (input.placement === 'before' && input.targetId) return boundedInsertIndex(remaining.indexOf(input.targetId), remaining.length);
  if (input.placement === 'after' && input.targetId) return indexAfterEditorSceneSubtree(document, remaining, input.targetId);
  if (input.placement === 'inside' && input.targetId) return indexAfterEditorSceneSubtree(document, remaining, input.targetId);
  if (input.placement === 'root') return remaining.length;
  if (input.parentId) return indexAfterEditorSceneSubtree(document, remaining, input.parentId);
  return remaining.length;
}

function indexAfterEditorSceneSubtree(document: EditorSceneDocument, remaining: readonly string[], anchorId: string): number {
  const subtreeIds = collectEditorSceneSubtreeIds(document, [anchorId]);
  let index = remaining.indexOf(anchorId);
  if (index < 0) return remaining.length;
  for (let cursor = index + 1; cursor < remaining.length; cursor += 1) {
    if (!subtreeIds.has(remaining[cursor]!)) break;
    index = cursor;
  }
  return index + 1;
}

function insertEditorSceneIdsAt(base: readonly string[], ids: readonly string[], index: number): string[] {
  const safeIndex = Math.max(0, Math.min(index, base.length));
  return [
    ...base.slice(0, safeIndex),
    ...ids,
    ...base.slice(safeIndex),
  ];
}

function orderEditorSceneGameObjects(
  gameObjects: EditorSceneGameObject[],
  order: readonly string[],
): EditorSceneGameObject[] {
  const byId = new Map(gameObjects.map((gameObject) => [gameObject.id, gameObject]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((gameObject): gameObject is EditorSceneGameObject => !!gameObject);
  const orderedIds = new Set(ordered.map((gameObject) => gameObject.id));
  return [
    ...ordered,
    ...gameObjects.filter((gameObject) => !orderedIds.has(gameObject.id)),
  ];
}

function boundedInsertIndex(index: number, fallback: number): number {
  return index >= 0 ? index : fallback;
}

function computeEditorSceneSelectionWorldCenter(
  document: EditorSceneDocument,
  ids: readonly string[],
): EditorSceneVec3 | null {
  const worlds = ids
    .map((id) => getEditorSceneGameObjectWorldTransform(document, id))
    .filter((transform): transform is EditorTransformSnapshot => !!transform);
  if (worlds.length === 0) return null;
  return {
    x: worlds.reduce((sum, transform) => sum + transform.position.x, 0) / worlds.length,
    y: worlds.reduce((sum, transform) => sum + transform.position.y, 0) / worlds.length,
    z: worlds.reduce((sum, transform) => sum + transform.position.z, 0) / worlds.length,
  };
}

function resolveDeleteFallbackSelectionId(
  document: EditorSceneDocument,
  deletedIds: string[],
  activeId: string | null,
): string | null {
  const deleted = new Set(deletedIds);
  const active = activeId ? findEditorSceneGameObject(document, activeId) : null;
  if (active?.parentId && !deleted.has(active.parentId) && findEditorSceneGameObject(document, active.parentId)) {
    return active.parentId;
  }
  const remaining = document.scene.gameObjects.filter((gameObject) => !deleted.has(gameObject.id));
  return remaining[remaining.length - 1]?.id ?? null;
}

function isEditorSceneAncestor(document: EditorSceneDocument, ancestorId: string, descendantId: string): boolean {
  const byId = createGameObjectMap(document);
  const seen = new Set<string>();
  let cursor = byId.get(descendantId);
  while (cursor?.parentId && !seen.has(cursor.parentId)) {
    if (cursor.parentId === ancestorId) return true;
    seen.add(cursor.parentId);
    cursor = byId.get(cursor.parentId);
  }
  return false;
}

function createGameObjectMap(document: EditorSceneDocument): Map<string, EditorSceneGameObject> {
  return new Map(document.scene.gameObjects.map((gameObject) => [gameObject.id, gameObject]));
}

function computeLocalTransformForParent(
  document: EditorSceneDocument,
  gameObjectId: string,
  parentId: string | undefined,
): EditorTransformSnapshot | null {
  const world = getEditorSceneGameObjectWorldTransform(document, gameObjectId);
  if (!world) return null;
  return toLocalTransformForParent(document, parentId, world);
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

function getEditorSceneGameObjectDepth(document: EditorSceneDocument, gameObject: EditorSceneGameObject): number {
  const byId = createGameObjectMap(document);
  const seen = new Set<string>();
  let depth = 0;
  let cursor = gameObject.parentId ? byId.get(gameObject.parentId) : undefined;
  while (cursor && !seen.has(cursor.id) && depth < 32) {
    seen.add(cursor.id);
    depth += 1;
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return depth;
}

function readGameObjectLocalTransform(gameObject: EditorSceneGameObject): EditorTransformSnapshot {
  if (isEditorSceneRootGameObject(gameObject)) return identityTransform();
  return readRawGameObjectLocalTransform(gameObject);
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

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
  const sections: InspectorSection<EditorSceneDocument>[] = [
    {
      id: 'common',
      title: 'Common',
      order: 10,
      placement: 'body',
      summary: nodeKind,
      persistence: 'document',
      collapsedByDefault: false,
      properties: createCommonInspectorProperties(document, gameObject, nodeKind),
    },
  ];
  const hierarchySourceSection = createEditorSceneReadonlyInspectorSection({
    id: 'hierarchySource',
    title: 'Hierarchy / Source',
    order: 15,
    summary: createHierarchySourceSummary(document, gameObject),
    collapsedByDefault: true,
    tags: ['Document', 'Derived'],
    properties: createHierarchySourceInspectorProperties(document, gameObject),
  });
  if (hierarchySourceSection) sections.push(hierarchySourceSection);
  const transform = findEditorSceneTransform(gameObject);
  if (transform) {
    sections.push({
      id: 'transform',
      title: 'Transform',
      order: 20,
      placement: 'body',
      summary: createTransformInspectorSummary(document, gameObject),
      persistence: 'document',
      collapsedByDefault: false,
      properties: createTransformInspectorProperties(document, gameObject, nodeKind, transform),
    });
  }
  const renderer = findEditorSceneModelRenderer(gameObject);
  const primitive = findEditorScenePrimitiveRenderer(gameObject);
  if (renderer) {
    sections.push({
      id: 'renderer',
      title: 'Renderer / Asset',
      order: 30,
      placement: 'body',
      summary: createRendererInspectorSummary(document, renderer.assetId),
      persistence: 'document',
      collapsedByDefault: true,
      properties: createRendererInspectorProperties(document, gameObject, renderer.assetId),
    });
  }
  if (primitive) {
    sections.push({
      id: 'primitive',
      title: 'Primitive',
      order: 32,
      placement: 'body',
      summary: primitive.shape,
      persistence: 'document',
      collapsedByDefault: false,
      properties: createPrimitiveInspectorProperties(document, nodeKind, primitive.shape),
    });
  }
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
  const componentsSection = createEditorSceneReadonlyInspectorSection({
    id: 'components',
    title: 'Scripts / Components',
    order: 65,
    summary: createComponentsInspectorSummary(gameObject),
    collapsedByDefault: true,
    tags: ['Document'],
    properties: createComponentsInspectorProperties(gameObject),
  });
  if (componentsSection) sections.push(componentsSection);
  const metadataProperties = createMetadataInspectorProperties(document, gameObject, renderer?.assetId ?? null);
  if (metadataProperties.length > 0) {
    sections.push({
      id: 'metadata',
      title: 'Metadata',
      order: 80,
      placement: 'body',
      summary: createMetadataInspectorSummary(document, gameObject, renderer?.assetId ?? null),
      persistence: 'readonly',
      collapsedByDefault: true,
      tags: ['Document', 'Asset'],
      properties: metadataProperties,
    });
  }
  return sections;
}

function createHierarchySourceSummary(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): string {
  const parent = gameObject.parentId ? findEditorSceneGameObject(document, gameObject.parentId) : null;
  return parent ? `Parent: ${parent.name ?? parent.id}` : 'Scene root';
}

function createHierarchySourceInspectorProperties(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  const parent = gameObject.parentId ? findEditorSceneGameObject(document, gameObject.parentId) : null;
  const directChildren = document.scene.gameObjects.filter((entry) => entry.parentId === gameObject.id);
  const descendantCount = Math.max(collectEditorSceneSubtreeIdList(document, [gameObject.id]).length - 1, 0);
  const sourceRef = document.meta?.authoringSource ?? getEditorSceneAuthoringSourceRef(document);
  const siblingIndex = document.scene.gameObjects
    .filter((entry) => entry.parentId === gameObject.parentId)
    .findIndex((entry) => entry.id === gameObject.id);
  appendReadonlyInspectorProperty(properties, {
    path: 'hierarchy.parentId',
    label: 'Parent ID',
    value: gameObject.parentId ?? 'none',
    order: 0,
    source: 'Document',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'hierarchy.parentName',
    label: 'Parent Name',
    value: parent ? parent.name ?? parent.id : gameObject.parentId ? 'missing' : 'none',
    order: 1,
    source: 'Document',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'hierarchy.childCount',
    label: 'Children',
    value: directChildren.length,
    order: 2,
    source: 'Derived',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'hierarchy.descendantCount',
    label: 'Descendants',
    value: descendantCount,
    order: 3,
    source: 'Derived',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'hierarchy.siblingIndex',
    label: 'Sibling Index',
    value: siblingIndex >= 0 ? siblingIndex : 'unknown',
    order: 4,
    source: 'Derived',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'document.gameObjectIndex',
    label: 'Document Index',
    value: document.scene.gameObjects.findIndex((entry) => entry.id === gameObject.id),
    order: 5,
    source: 'Derived',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'document.schemaVersion',
    label: 'Schema Version',
    value: document.schemaVersion,
    order: 6,
    source: 'Document',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'source.sourceId',
    label: 'Source ID',
    value: sourceRef.sourceId,
    order: 7,
    source: 'Document',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'source.sourceType',
    label: 'Source Type',
    value: sourceRef.sourceType,
    order: 8,
    source: 'Document',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'source.revision',
    label: 'Revision',
    value: sourceRef.revision ?? 'none',
    order: 9,
    source: 'Document',
  });
  return properties;
}

function createCommonInspectorProperties(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  nodeKind: SceneNodeConfig['kind'],
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createReadonlyInspectorProperty('id', 'ID', gameObject.id, 0),
    createDocumentInspectorProperty(document, nodeKind, {
      path: 'name',
      label: 'Name',
      valueType: 'string',
      control: 'string',
      value: gameObject.name ?? gameObject.id,
      commitMode: 'blur',
      order: 1,
    }),
    createDocumentInspectorProperty(document, nodeKind, {
      path: 'enabled',
      label: 'Enabled',
      valueType: 'boolean',
      control: 'boolean',
      value: gameObject.active !== false,
      commitMode: 'immediate',
      order: 2,
    }),
    createReadonlyInspectorProperty('kind.resolved', 'Resolved Kind', nodeKind, 3),
    createReadonlyInspectorProperty('kind.explicit', 'Explicit Kind', gameObject.kind ?? 'inferred', 4),
    createReadonlyInspectorProperty('common.activeField', 'Active Field', gameObject.active ?? 'default:true', 5),
  ];
  if (nodeKind === 'transform') {
    properties.push(createDocumentInspectorProperty(document, nodeKind, {
      path: 'transformType',
      label: 'Transform Type',
      valueType: 'enum',
      control: 'enum',
      value: gameObject.transformType ?? 'plain',
      commitMode: 'immediate',
      order: 6,
      options: [
        { label: 'Plain', value: 'plain' },
        { label: 'Light', value: 'light' },
        { label: 'Camera', value: 'camera' },
        { label: 'Ground Decal', value: 'groundDecal' },
      ],
    }));
  } else {
    properties.push(createReadonlyInspectorProperty('common.transformType', 'Transform Type', gameObject.transformType ?? 'none', 6));
  }
  return properties;
}

function createTransformInspectorProperties(
  _document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  nodeKind: SceneNodeConfig['kind'],
  transform: { position: EditorSceneVec3; rotation: EditorSceneVec3; scale?: EditorSceneVec3 },
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  let order = 0;
  const rootTransform = isEditorSceneRootGameObject(gameObject);
  const protectedTransform = rootTransform || isEditorSceneProtectedSystemGameObject(gameObject);
  const displayTransform = rootTransform ? EDITOR_SCENE_ROOT_TRANSFORM : transform;
  for (const vectorName of ['position', 'rotation', 'scale'] as const) {
    const vector = readTransformVector(displayTransform, vectorName);
    for (const axis of ['x', 'y', 'z'] as const) {
      const path = `transform.${vectorName}.${axis}`;
      const value = vectorName === 'rotation' ? roundForInspector(radiansToDegrees(vector[axis])) : vector[axis];
      properties.push(protectedTransform
        ? createReadonlyInspectorProperty(path, `${toEditorSceneTransformVectorLabel(vectorName)}.${axis}`, value, order)
        : createDocumentInspectorProperty(null, nodeKind, {
            path,
            label: `${toEditorSceneTransformVectorLabel(vectorName)}.${axis}`,
            valueType: 'number',
            control: 'number',
            value,
            commitMode: 'live',
            order,
            step: vectorName === 'rotation' ? 1 : 0.1,
          }));
      order += 1;
    }
  }
  return properties;
}

function createTransformInspectorSummary(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): string {
  const parent = gameObject.parentId ? findEditorSceneGameObject(document, gameObject.parentId) : null;
  if (isEditorSceneRootGameObject(gameObject)) return 'Identity Root';
  return `Relative to: ${parent ? parent.name ?? parent.id : 'Scene'}`;
}

function toEditorSceneTransformVectorLabel(
  vectorName: 'position' | 'rotation' | 'scale',
): string {
  return vectorName === 'position' ? 'Position' : vectorName === 'rotation' ? 'Rotation' : 'Scale';
}

function createRendererInspectorProperties(
  document: EditorSceneDocument,
  _gameObject: EditorSceneGameObject,
  assetId: string,
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createDocumentInspectorProperty(document, 'instance', {
      path: 'instance.assetId',
      label: 'Asset',
      valueType: 'enum',
      control: 'enum',
      value: assetId,
      commitMode: 'immediate',
      order: 0,
      options: document.assets.map((asset) => ({
        label: asset.displayName ?? asset.id,
        value: asset.id,
      })),
    }),
  ];
  const asset = findEditorSceneAsset(document, assetId);
  appendReadonlyInspectorProperty(properties, {
    path: 'renderer.assetId',
    label: 'Renderer Asset ID',
    value: assetId,
    order: 1,
    source: 'Document',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'asset.id',
    label: 'Asset ID',
    value: asset?.id ?? 'missing',
    order: 2,
    source: 'Asset',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'asset.type',
    label: 'Asset Type',
    value: asset?.type ?? 'missing',
    order: 3,
    source: 'Asset',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'asset.guid',
    label: 'GUID',
    value: asset?.guid ?? 'missing',
    order: 4,
    source: 'Asset',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'asset.displayName',
    label: 'Display Name',
    value: asset?.displayName ?? 'none',
    order: 5,
    source: 'Asset',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'asset.category',
    label: 'Category',
    value: asset?.category ?? 'none',
    order: 6,
    source: 'Asset',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'asset.materialMode',
    label: 'Material Mode',
    value: asset?.materialMode ?? 'none',
    order: 7,
    source: 'Asset',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'asset.defaults',
    label: 'Defaults',
    value: asset?.defaults ?? 'none',
    order: 8,
    source: 'Asset',
    tags: ['Raw'],
  });
  return properties;
}

function createRendererInspectorSummary(document: EditorSceneDocument, assetId: string): string {
  const asset = findEditorSceneAsset(document, assetId);
  if (!asset) return `Missing asset: ${assetId}`;
  return asset.displayName ?? asset.id;
}

function createPrimitiveInspectorProperties(
  document: EditorSceneDocument,
  nodeKind: SceneNodeConfig['kind'],
  shape: ScenePrimitiveShape,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createDocumentInspectorProperty(document, nodeKind, {
      path: 'primitive.shape',
      label: 'Shape',
      valueType: 'enum',
      control: 'enum',
      value: shape,
      commitMode: 'immediate',
      order: 0,
      options: [
        { label: 'Cube', value: 'cube' },
        { label: 'Sphere', value: 'sphere' },
        { label: 'Plane', value: 'plane' },
        { label: 'Capsule', value: 'capsule' },
      ],
    }),
  ];
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
  if (materialAsset) return text.summaryAsset(materialAsset.name);
  if (binding?.materialAssetId) return text.summaryMissingAsset;
  if (binding?.override) return text.summaryLegacyData;
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
  const slots = new Map<string, EditorSceneChildMaterialSlot>();
  for (const slot of readEditorSceneAssetMaterialSlots(document, gameObject)) {
    slots.set(slot.ownerNodePath, slot);
  }
  for (const ownerNodePath of Object.keys(gameObject.overrides?.childMaterialBindings ?? {})) {
    if (!slots.has(ownerNodePath)) slots.set(ownerNodePath, { ownerNodePath });
  }
  for (const ownerNodePath of Object.keys(gameObject.overrides?.childMaterials ?? {})) {
    if (!slots.has(ownerNodePath)) slots.set(ownerNodePath, { ownerNodePath });
  }
  return [...slots.values()].sort((left, right) => left.ownerNodePath.localeCompare(right.ownerNodePath));
}

function readEditorSceneAssetMaterialSlots(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): EditorSceneChildMaterialSlot[] {
  const renderer = findEditorSceneModelRenderer(gameObject);
  if (!renderer) return [];
  const asset = document.assets.find((entry) => entry.id === renderer.assetId);
  const rawSlots = asset?.metadata?.materialSlots;
  if (!Array.isArray(rawSlots)) return [];
  const slots: EditorSceneChildMaterialSlot[] = [];
  for (const rawSlot of rawSlots) {
    const slot = readEditorSceneMaterialSlotDescriptor(rawSlot);
    if (slot) slots.push(slot);
  }
  return slots;
}

function readEditorSceneMaterialSlotDescriptor(value: unknown): EditorSceneChildMaterialSlot | null {
  if (typeof value === 'string') {
    const ownerNodePath = normalizeEditorSceneMaterialSlotOwnerPath(value);
    return ownerNodePath ? { ownerNodePath } : null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const ownerNodePath = normalizeEditorSceneMaterialSlotOwnerPath(
    typeof record.ownerNodePath === 'string'
      ? record.ownerNodePath
      : typeof record.path === 'string'
        ? record.path
        : typeof record.name === 'string'
          ? record.name
          : '',
  );
  if (!ownerNodePath) return null;
  const label = typeof record.label === 'string' && record.label.trim()
    ? record.label.trim()
    : ownerNodePath;
  return { ownerNodePath, label };
}

function normalizeEditorSceneMaterialSlotOwnerPath(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
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
  const currentDefaultPreset = getDefaultEditorSceneMaterialPreset(currentAsset);
  return {
    pickerKind: 'material',
    pickerTitle: text.materialPickerTitle,
    actionLabel: text.replace,
    copyActionLabel: currentAsset ? text.duplicateForObject : '',
    copyActionValue: currentAsset ? createDuplicateMaterialAssetValue(currentAsset.id) : '',
    copyActionTooltip: currentAsset ? text.tooltips.duplicateForObject : '',
    placeholder: currentValue ? text.summaryMissingAsset : text.inheritNone,
    currentLabel: currentAsset
      ? getEditorSceneMaterialAssetDisplayName(currentAsset, text)
      : (currentValue ? currentValue : text.inheritNone),
    currentMeta: currentAsset
      ? (currentDefaultPreset ? getEditorSceneMaterialAssetMeta(currentAsset, text) : `Material - ${currentAsset.id}`)
      : text.summaryInherit,
    currentPreview: currentAsset ? createEditorSceneMaterialPreview(currentAsset.profile) : undefined,
    candidates: [
      {
        label: text.inheritNone,
        value: '',
        meta: text.summaryInherit,
      },
      ...(document.scene.materialAssets ?? []).map(materialAsset => ({
        label: getEditorSceneMaterialAssetDisplayName(materialAsset, text),
        value: materialAsset.id,
        meta: getDefaultEditorSceneMaterialPreset(materialAsset)
          ? getEditorSceneMaterialAssetMeta(materialAsset, text)
          : `Material - ${materialAsset.id}`,
        kind: 'material',
        preview: createEditorSceneMaterialPreview(materialAsset.profile),
      })),
    ],
  };
}

function getEditorSceneMaterialAssetDisplayName(
  materialAsset: SceneMaterialAssetConfig,
  text: ArtistMaterialInspectorText,
): string {
  const preset = getDefaultEditorSceneMaterialPreset(materialAsset);
  if (preset === 'default-pbr') return text.defaultMaterial;
  if (preset === 'default-standard') return text.defaultStandardMaterial;
  return materialAsset.name || materialAsset.id;
}

function getEditorSceneMaterialAssetMeta(
  materialAsset: SceneMaterialAssetConfig,
  text: ArtistMaterialInspectorText,
): string {
  const preset = getDefaultEditorSceneMaterialPreset(materialAsset);
  if (preset === 'default-pbr') return text.defaultMaterialMeta;
  if (preset === 'default-standard') return text.defaultStandardMaterialMeta;
  return `Material - ${materialAsset.id}`;
}

function createEditorSceneMaterialPreview(profile: ArtistMaterialProfile): Record<string, unknown> {
  return {
    kind: 'material-sphere',
    baseColor: transformEditorSceneMaterialPreviewBaseColor(profile),
    metallic: clampEditorSceneMaterialPreview01(profile.metallic ?? 0),
    roughness: clampEditorSceneMaterialPreview01(profile.roughness ?? 1),
    emissionColor: profile.emission?.color,
    emissionIntensity: profile.emission?.intensity ?? 0,
    textureUrl: profile.baseColor?.texture?.url,
  };
}

function transformEditorSceneMaterialPreviewBaseColor(profile: ArtistMaterialProfile): { r: number; g: number; b: number } {
  const baseColor = profile.baseColor ?? {};
  const source = baseColor.color ?? { r: 0.78, g: 0.78, b: 0.78 };
  const brightness = Number.isFinite(baseColor.brightness) ? baseColor.brightness! : 1;
  const contrast = Number.isFinite(baseColor.contrast) ? baseColor.contrast! : 1;
  const saturation = Number.isFinite(baseColor.saturation) ? baseColor.saturation! : 1;
  const hue = Number.isFinite(baseColor.hue) ? baseColor.hue! : 0;

  let r = clampEditorSceneMaterialPreview01(source.r * Math.max(0, brightness));
  let g = clampEditorSceneMaterialPreview01(source.g * Math.max(0, brightness));
  let b = clampEditorSceneMaterialPreview01(source.b * Math.max(0, brightness));

  r = clampEditorSceneMaterialPreview01((r - 0.5) * contrast + 0.5);
  g = clampEditorSceneMaterialPreview01((g - 0.5) * contrast + 0.5);
  b = clampEditorSceneMaterialPreview01((b - 0.5) * contrast + 0.5);

  const hsl = rgbToEditorSceneMaterialPreviewHsl(r, g, b);
  hsl.h = normalizeEditorSceneMaterialPreviewHue(hsl.h + hue);
  hsl.s = clampEditorSceneMaterialPreview01(hsl.s * Math.max(0, saturation));
  return hslToEditorSceneMaterialPreviewRgb(hsl.h, hsl.s, hsl.l);
}

function rgbToEditorSceneMaterialPreviewHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  return { h: h * 60, s, l };
}

function hslToEditorSceneMaterialPreviewRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) return { r: l, g: l, b: l };

  const hueToRgb = (p: number, q: number, t: number): number => {
    let nextT = t;
    if (nextT < 0) nextT += 1;
    if (nextT > 1) nextT -= 1;
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT;
    if (nextT < 1 / 2) return q;
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6;
    return p;
  };

  const normalizedHue = normalizeEditorSceneMaterialPreviewHue(h) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clampEditorSceneMaterialPreview01(hueToRgb(p, q, normalizedHue + 1 / 3)),
    g: clampEditorSceneMaterialPreview01(hueToRgb(p, q, normalizedHue)),
    b: clampEditorSceneMaterialPreview01(hueToRgb(p, q, normalizedHue - 1 / 3)),
  };
}

function normalizeEditorSceneMaterialPreviewHue(value: number): number {
  const result = value % 360;
  return result < 0 ? result + 360 : result;
}

function clampEditorSceneMaterialPreview01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
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
  if (materialAsset.materialKind === 'standard') return 'standard';
  if (materialAsset.system?.preset === 'default-standard') return 'standard';
  return 'pbr';
}

function getEditorSceneMaterialKindLabel(
  materialKind: 'pbr' | 'standard',
  text: ArtistMaterialInspectorText,
): string {
  return materialKind === 'standard' ? text.assetKindStandard : text.assetKindPbr;
}

function isReadonlyEditorSceneMaterialAsset(materialAsset: SceneMaterialAssetConfig): boolean {
  return materialAsset.system?.readonly === true || isDefaultEditorSceneMaterialAsset(materialAsset);
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
    pickerKind: 'texture',
    pickerTitle: text.texturePickerTitle,
    actionLabel: text.replace,
    placeholder: text.inheritNone,
    currentLabel: currentTexture?.label ?? (currentValue ? currentValue : text.inheritNone),
    currentMeta: currentTexture?.meta ?? (currentValue ? currentValue : text.summaryInherit),
    currentPreview: currentTexture ? createTextureAssetPreview(currentTexture) : undefined,
    candidates: [
      {
        label: text.inheritNone,
        value: '',
        meta: text.summaryInherit,
      },
      ...(context.textureAssets ?? []).map(texture => ({
        label: texture.label,
        value: texture.url,
        meta: texture.meta ?? texture.id,
        kind: 'texture',
        preview: createTextureAssetPreview(texture),
      })),
    ],
  };
}

function findEditorSceneInspectorTextureAsset(
  context: EditorSceneInspectorContext,
  value: string,
): EditorSceneInspectorTextureAsset | null {
  const normalized = value.trim();
  if (!normalized) return null;
  return context.textureAssets?.find(texture => texture.url === normalized || texture.id === normalized) ?? null;
}

function createTextureAssetPreview(texture: EditorSceneInspectorTextureAsset): Record<string, unknown> {
  return {
    kind: 'image',
    url: texture.url,
    alt: texture.label,
    fit: 'contain',
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
  const path = `${MATERIAL_ASSET_FIELD_PATH_PREFIX}${materialAsset.id}.${fieldPath}`;
  return {
    path,
    label,
    valueType,
    control,
    value,
    readOnly: false,
    persistence: 'document',
    commitMode,
    order,
    tooltip,
    tags: ['ArtistMaterial', 'MaterialAsset'],
    document,
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

function createComponentsInspectorSummary(gameObject: EditorSceneGameObject): string {
  return gameObject.components.map((component) => component.type).join(', ') || 'none';
}

function createComponentsInspectorProperties(
  gameObject: EditorSceneGameObject,
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  appendReadonlyInspectorProperty(properties, {
    path: 'components.count',
    label: 'Count',
    value: gameObject.components.length,
    order: 0,
    source: 'Document',
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'components.types',
    label: 'Types',
    value: createComponentsInspectorSummary(gameObject),
    order: 1,
    source: 'Document',
  });
  gameObject.components.forEach((component, index) => {
    appendReadonlyInspectorProperty(properties, {
      path: `components.${index}`,
      label: `${component.type} ${index}`,
      value: component,
      order: index + 2,
      source: 'Document',
      tags: ['Component', 'Raw'],
    });
  });
  return properties;
}

function createMetadataInspectorProperties(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  assetId: string | null,
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [];
  const asset = assetId ? findEditorSceneAsset(document, assetId) : null;
  appendReadonlyInspectorProperty(properties, {
    path: 'metadata.document',
    label: 'Document Meta',
    value: document.meta ?? 'none',
    order: 0,
    source: 'Document',
    tags: ['Raw'],
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'metadata.gameObject',
    label: 'GameObject Metadata',
    value: gameObject.metadata ?? 'none',
    order: 1,
    source: 'Document',
    tags: ['Raw'],
  });
  appendReadonlyInspectorProperty(properties, {
    path: 'metadata.asset',
    label: 'Asset Metadata',
    value: asset?.metadata ?? 'none',
    order: 2,
    source: 'Asset',
    tags: ['Raw'],
  });
  return properties;
}

function createMetadataInspectorSummary(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  assetId: string | null,
): string {
  const asset = assetId ? findEditorSceneAsset(document, assetId) : null;
  const sources = [
    document.meta ? 'Document' : null,
    gameObject.metadata ? 'GameObject' : null,
    asset?.metadata ? 'Asset' : null,
  ].filter((entry): entry is string => !!entry);
  return sources.length > 0 ? sources.join(' + ') : 'none';
}

function createDocumentInspectorProperty(
  document: EditorSceneDocument | null,
  nodeKind: SceneNodeConfig['kind'],
  property: Omit<InspectorProperty<EditorSceneDocument>, 'readOnly' | 'persistence' | 'validate'>,
): InspectorProperty<EditorSceneDocument> {
  return {
    ...property,
    readOnly: false,
    persistence: 'document',
    document: document ?? undefined,
    validate: createEditorSceneInspectorValidator(nodeKind, property.path, document),
  };
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

function findEditorSceneAsset(document: EditorSceneDocument, assetId: string): EditorSceneAsset | null {
  return document.assets.find((entry) => entry.id === assetId) ?? null;
}

function shouldDisplayEditorSceneInspectorValue(value: unknown): boolean {
  return value != null && !(typeof value === 'number' && !Number.isFinite(value));
}

function inferEditorSceneInspectorValueType(
  value: unknown,
): InspectorProperty<EditorSceneDocument>['valueType'] {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (value && typeof value === 'object') return 'object';
  return 'unknown';
}

function mergeEditorSceneInspectorTags(
  source: EditorSceneInspectorSourceTag | undefined,
  tags: readonly string[] | undefined,
): readonly string[] | undefined {
  const merged = [...(source ? [source] : []), ...(tags ?? [])];
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

function createEditorSceneInspectorValidator(
  nodeKind: SceneNodeConfig['kind'],
  path: string,
  document?: EditorSceneDocument | null,
): (value: unknown) => InspectorValidationResult {
  return (value) => {
    if (path === 'camera.inspectorLanguage') {
      return value === 'zh' || value === 'en'
        ? { ok: true, value }
        : { ok: false, message: 'Invalid value for scene node field: camera.inspectorLanguage.' };
    }
    if (path === 'light.inspectorLanguage') {
      return value === 'zh' || value === 'en'
        ? { ok: true, value }
        : { ok: false, message: 'Invalid value for scene node field: light.inspectorLanguage.' };
    }
    if (isDirectionalLightAnglePath(path)) {
      return typeof value === 'number' && Number.isFinite(value)
        ? { ok: true, value }
        : { ok: false, message: `Invalid value for scene node field: ${path}.` };
    }
    if (path === 'metadata.artistMaterialInspectorLanguage') {
      return value === 'zh' || value === 'en'
        ? { ok: true, value }
        : { ok: false, message: 'Invalid value for scene node field: metadata.artistMaterialInspectorLanguage.' };
    }
    const schema = resolveSceneNodeFieldSchema(path, nodeKind);
    if (!schema) return { ok: false, message: `Unsupported scene node field: ${path}.` };
    if (value == null && schema.allowDelete === false) {
      return { ok: false, message: `Scene node field cannot be deleted: ${path}.` };
    }
    if (!schema.validate(value)) return { ok: false, message: `Invalid value for scene node field: ${path}.` };
    if (path === 'instance.assetId' && document && typeof value === 'string' && !document.assets.some((asset) => asset.id === value)) {
      return { ok: false, message: `Asset not found: ${value}.` };
    }
    if (isMaterialAssetBindingPath(path) && document && typeof value === 'string' && value && !hasEditorSceneMaterialAsset(document, value)) {
      return { ok: false, message: `Material asset not found: ${value}.` };
    }
    return { ok: true, value };
  };
}

function isMaterialAssetBindingPath(path: string): boolean {
  return path === 'overrides.materialBinding.materialAssetId'
    || /^overrides\.childMaterialBindings\..+\.materialAssetId$/.test(path);
}

function isEditorSceneArtistMaterialPatchPath(path: string): boolean {
  return path === 'overrides.materialBinding.materialAssetId'
    || path.startsWith('overrides.materialBinding.override.')
    || /^overrides\.childMaterialBindings\..+\.materialAssetId$/.test(path)
    || /^overrides\.childMaterialBindings\..+\.override\./.test(path);
}

function parseEditorSceneMaterialAssetFieldPath(path: string): { materialAssetId: string; fieldPath: string } | null {
  if (!path.startsWith(MATERIAL_ASSET_FIELD_PATH_PREFIX)) return null;
  const body = path.slice(MATERIAL_ASSET_FIELD_PATH_PREFIX.length);
  if (!body) return null;
  if (body.endsWith('.name')) {
    const materialAssetId = body.slice(0, -'.name'.length);
    return materialAssetId ? { materialAssetId, fieldPath: 'name' } : null;
  }
  const marker = '.profile.';
  const markerIndex = body.lastIndexOf(marker);
  if (markerIndex < 0) return null;
  const materialAssetId = body.slice(0, markerIndex);
  const profilePath = body.slice(markerIndex + marker.length);
  if (!materialAssetId || !profilePath) return null;
  return { materialAssetId, fieldPath: `profile.${profilePath}` };
}

function normalizeEditorSceneMaterialAssetValue(path: string, value: unknown): unknown {
  if (path === 'name' && typeof value === 'string') {
    return value.trim();
  }
  if (path === 'profile.emission.maskTexture.url' && typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (path === 'profile.baseColor.texture.url' && typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
}

function validateEditorSceneMaterialAssetFieldValue(path: string, value: unknown): boolean {
  const normalizedValue = normalizeEditorSceneMaterialAssetValue(path, value);
  if (path === 'name') return typeof normalizedValue === 'string' && normalizedValue.length > 0;
  if (path === 'profile.baseColor.color' || path === 'profile.emission.color') {
    return normalizedValue == null || isEditorSceneColorRgb(normalizedValue);
  }
  if (
    path === 'profile.baseColor.brightness'
    || path === 'profile.baseColor.saturation'
    || path === 'profile.baseColor.contrast'
    || path === 'profile.baseColor.hue'
    || path === 'profile.metallic'
    || path === 'profile.roughness'
    || path === 'profile.emission.intensity'
  ) {
    return normalizedValue == null || (typeof normalizedValue === 'number' && Number.isFinite(normalizedValue));
  }
  if (path === 'profile.baseColor.texture.url' || path === 'profile.emission.maskTexture.url') {
    return normalizedValue == null || (typeof normalizedValue === 'string' && normalizedValue.trim().length > 0);
  }
  return false;
}

function isEditorSceneColorRgb(value: unknown): value is { r: number; g: number; b: number } {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.r === 'number' && Number.isFinite(candidate.r)
    && typeof candidate.g === 'number' && Number.isFinite(candidate.g)
    && typeof candidate.b === 'number' && Number.isFinite(candidate.b);
}

function hasEditorSceneMaterialAsset(document: EditorSceneDocument, materialAssetId: string): boolean {
  return document.scene.materialAssets?.some((materialAsset) => materialAsset.id === materialAssetId) ?? false;
}

function createDuplicateMaterialAssetValue(materialAssetId: string): string {
  return `${DUPLICATE_MATERIAL_ASSET_VALUE_PREFIX}${materialAssetId}`;
}

function parseDuplicateMaterialAssetValue(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith(DUPLICATE_MATERIAL_ASSET_VALUE_PREFIX)) return null;
  const materialAssetId = value.slice(DUPLICATE_MATERIAL_ASSET_VALUE_PREFIX.length).trim();
  return materialAssetId || null;
}

function isEditorSceneMaterialBindingPath(path: string): boolean {
  return path === 'overrides.materialBinding.materialAssetId'
    || /^overrides\.childMaterialBindings\..+\.materialAssetId$/.test(path);
}

function findEditorSceneMaterialAsset(
  document: EditorSceneDocument,
  materialAssetId: string,
): SceneMaterialAssetConfig | null {
  if (!materialAssetId) return null;
  return document.scene.materialAssets?.find((materialAsset) => materialAsset.id === materialAssetId) ?? null;
}

function createEditorSceneDuplicatedMaterialAsset(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  sourceMaterialAsset: SceneMaterialAssetConfig,
): SceneMaterialAssetConfig {
  const displayName = gameObject.name?.trim() || gameObject.id;
  const sourceName = sourceMaterialAsset.name?.trim() || sourceMaterialAsset.id;
  const materialKind = resolveEditorSceneMaterialAssetKind(sourceMaterialAsset);
  return {
    id: createUniqueEditorSceneMaterialAssetId(document, `${displayName}_${sourceName}`),
    name: `${displayName} - ${sourceName}`,
    materialKind,
    profile: structuredClone(sourceMaterialAsset.profile ?? {}),
  };
}

function createUniqueEditorSceneMaterialAssetId(document: EditorSceneDocument, seed: string): string {
  const existingIds = new Set((document.scene.materialAssets ?? []).map((materialAsset) => materialAsset.id));
  const base = `mat_${sanitizeEditorSceneMaterialAssetIdPart(seed) || 'material'}`;
  let candidate = base;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function sanitizeEditorSceneMaterialAssetIdPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
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
  return createEditorSceneInspectorValidator(readEditorSceneNodeKind(gameObject), path, document)(value);
}

function normalizeEditorSceneInspectorValue(path: string, value: unknown): unknown {
  if (isDirectionalLightAnglePath(path)) {
    return normalizeDirectionalLightAngleValue(path, value);
  }
  if (path === 'groundDecal.textureId' && typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (/^overrides\.material\.(albedoTexture|normalTexture|metallicTexture)\.url$/.test(path) && typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (path === 'overrides.materialBinding.materialAssetId' && typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (
    (
      path === 'overrides.materialBinding.override.emission.maskTexture.url'
      || path === 'overrides.materialBinding.override.baseColor.texture.url'
      || /^overrides\.childMaterialBindings\..+\.override\.emission\.maskTexture\.url$/.test(path)
      || /^overrides\.childMaterialBindings\..+\.override\.baseColor\.texture\.url$/.test(path)
    )
    && typeof value === 'string'
  ) {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (/^overrides\.childMaterialBindings\..+\.materialAssetId$/.test(path) && typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
}

export function patchEditorSceneGameObjectField(
  document: EditorSceneDocument,
  targetId: string,
  path: string,
  value: unknown,
): EditorSceneDocument {
  if (isEditorSceneRootTransformPath(targetId, path)) return document;
  const gameObject = findEditorSceneGameObject(document, targetId);
  if (!gameObject) return document;
  const normalizedValue = normalizeEditorSceneInspectorValue(path, value);
  if (!validateEditorSceneInspectorValue(document, gameObject, path, normalizedValue).ok) return document;
  if (isBlockedEditorSceneSystemFieldPatch(document, targetId, path, normalizedValue)) return document;
  return {
    ...document,
    scene: {
      ...document.scene,
      gameObjects: document.scene.gameObjects.map((entry) => (
        entry.id === targetId ? patchEditorSceneGameObject(entry, path, normalizedValue) : entry
      )),
    },
  };
}

function patchEditorSceneMaterialAssetField(
  document: EditorSceneDocument,
  materialAssetId: string,
  path: string,
  value: unknown,
): EditorSceneDocument {
  const materialAssets = document.scene.materialAssets ?? [];
  let changed = false;
  const nextMaterialAssets = materialAssets.map((materialAsset) => {
    if (materialAsset.id !== materialAssetId) return materialAsset;
    const next = patchEditorSceneMaterialAsset(materialAsset, path, normalizeEditorSceneMaterialAssetValue(path, value));
    changed = changed || next !== materialAsset;
    return next;
  });
  if (!changed) return document;
  return {
    ...document,
    scene: {
      ...document.scene,
      materialAssets: nextMaterialAssets,
    },
  };
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

function patchEditorSceneMaterialAsset(
  materialAsset: SceneMaterialAssetConfig,
  path: string,
  value: unknown,
): SceneMaterialAssetConfig {
  if (materialAsset.system?.readonly === true) return materialAsset;
  if (!validateEditorSceneMaterialAssetFieldValue(path, value)) return materialAsset;
  const next: SceneMaterialAssetConfig = structuredClone(materialAsset);
  if (path === 'name') {
    if (typeof value !== 'string') return materialAsset;
    next.name = value.trim();
    return next.name === materialAsset.name ? materialAsset : next;
  }
  if (!path.startsWith('profile.')) return materialAsset;
  const profilePath = path.slice('profile.'.length);
  if (!profilePath) return materialAsset;
  next.profile = structuredClone(next.profile ?? {});
  applyJsonFieldPatch(next.profile as Record<string, unknown>, profilePath, value);
  next.profile = pruneEditorSceneArtistMaterialProfile(next.profile);
  return JSON.stringify(next) === JSON.stringify(materialAsset) ? materialAsset : next;
}

function pruneEditorSceneArtistMaterialProfile(profile: ArtistMaterialProfile): ArtistMaterialProfile {
  const next: ArtistMaterialProfile = structuredClone(profile ?? {});
  if (next.baseColor && Object.keys(next.baseColor).length === 0) delete next.baseColor;
  if (next.baseColor?.texture) {
    const url = next.baseColor.texture.url?.trim() ?? '';
    if (url) next.baseColor.texture.url = url;
    else delete next.baseColor.texture;
    if (Object.keys(next.baseColor).length === 0) delete next.baseColor;
  }
  if (next.emission) {
    if (next.emission.maskTexture) {
      const url = next.emission.maskTexture.url?.trim() ?? '';
      if (url) next.emission.maskTexture.url = url;
      else delete next.emission.maskTexture;
    }
    if (Object.keys(next.emission).length === 0) delete next.emission;
  }
  return next;
}

function patchEditorSceneGameObject(
  gameObject: EditorSceneGameObject,
  path: string,
  value: unknown,
): EditorSceneGameObject {
  const next: EditorSceneGameObject = structuredClone(gameObject);
  if (path === 'name') {
    if (typeof value === 'string' && value.trim()) next.name = value.trim();
    else delete next.name;
    return next;
  }
  if (path === 'enabled') {
    next.active = value !== false;
    return next;
  }
  if (path.startsWith('metadata.')) {
    applyJsonFieldPatch(next as unknown as Record<string, unknown>, path, value);
    if (next.metadata && Object.keys(next.metadata).length === 0) delete next.metadata;
    return next;
  }
  if (path === 'instance.assetId') {
    const renderer = findEditorSceneModelRenderer(next);
    if (renderer && typeof value === 'string') renderer.assetId = value;
    next.kind = 'instance';
    delete next.primitive;
    return next;
  }
  if (path === 'primitive.shape') {
    const shape = normalizeEditorScenePrimitiveShape(value);
    if (shape) {
      next.kind = 'primitive';
      next.primitive = { shape };
    }
    return next;
  }
  if (path === 'transformType') {
    if (value === 'plain' || value === 'light' || value === 'camera' || value === 'groundDecal') {
      next.kind = 'transform';
      next.transformType = value;
      delete next.primitive;
      if (value === 'camera') next.camera = mergeEditorSceneCameraDefaults(next.camera);
      else delete next.camera;
      if (value === 'light') next.light = mergeEditorSceneLightDefaults(next.light);
      else delete next.light;
      if (value === 'groundDecal' && !next.groundDecal) next.groundDecal = createDefaultGroundDecal();
      else if (value !== 'groundDecal') delete next.groundDecal;
    }
    return next;
  }
  const transformVectorMatch = path.match(/^transform\.(position|rotation|scale)$/);
  if (transformVectorMatch) {
    const transform = findEditorSceneTransform(next);
    if (!transform) return next;
    const vectorName = transformVectorMatch[1] as 'position' | 'rotation' | 'scale';
    if (vectorName === 'scale') {
      if (typeof value === 'number' && Number.isFinite(value)) {
        transform.scale = { x: value, y: value, z: value };
      } else if (isVec3(value)) {
        transform.scale = { ...value };
      }
      return next;
    }
    if (!isVec3(value)) return next;
    transform[vectorName] = vectorName === 'rotation'
      ? {
          x: degreesToRadians(value.x),
          y: degreesToRadians(value.y),
          z: degreesToRadians(value.z),
        }
      : { ...value };
    return next;
  }
  const transformMatch = path.match(/^transform\.(position|rotation|scale)\.(x|y|z)$/);
  if (transformMatch && typeof value === 'number' && Number.isFinite(value)) {
    const transform = findEditorSceneTransform(next);
    if (!transform) return next;
    const vectorName = transformMatch[1] as 'position' | 'rotation' | 'scale';
    const axis = transformMatch[2] as 'x' | 'y' | 'z';
    const storedValue = vectorName === 'rotation' ? degreesToRadians(value) : value;
    if (vectorName === 'scale') transform.scale = { ...readTransformVector(transform, 'scale'), [axis]: storedValue };
    else transform[vectorName] = { ...transform[vectorName], [axis]: storedValue };
    return next;
  }
  if (path.startsWith('groundDecal.')) {
    next.kind = 'transform';
    next.transformType = next.transformType ?? 'groundDecal';
    delete next.primitive;
    next.groundDecal = mergeGroundDecalDefaults(next.groundDecal);
    applyJsonFieldPatch(next as unknown as Record<string, unknown>, path, value);
    return next;
  }
  if (path.startsWith('camera.')) {
    next.kind = 'transform';
    next.transformType = 'camera';
    next.camera = mergeEditorSceneCameraDefaults(next.camera);
    delete next.light;
    delete next.groundDecal;
    delete next.primitive;
    applyJsonFieldPatch(next as unknown as Record<string, unknown>, path, value);
    return next;
  }
  if (isDirectionalLightAnglePath(path) && typeof value === 'number' && Number.isFinite(value)) {
    next.kind = 'transform';
    next.transformType = 'light';
    next.light = mergeEditorSceneLightDefaults(next.light, 'directional');
    delete next.camera;
    delete next.groundDecal;
    delete next.primitive;
    if (next.light.type !== 'directional') return next;
    const angles = readDirectionalLightAngles(next.light.direction);
    next.light.direction = createDirectionalLightDirectionFromAngles(
      path === LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH ? value : angles.horizontalAngleDeg,
      path === LIGHT_DIRECTION_ELEVATION_ANGLE_PATH ? value : angles.elevationAngleDeg,
    );
    return next;
  }
  if (path.startsWith('light.')) {
    next.kind = 'transform';
    next.transformType = 'light';
    next.light = mergeEditorSceneLightDefaults(next.light);
    delete next.camera;
    delete next.groundDecal;
    delete next.primitive;
    applyJsonFieldPatch(next as unknown as Record<string, unknown>, path, value);
    return next;
  }
  if (path.startsWith('overrides.')) {
    if (readEditorSceneNodeKind(next) === 'group') next.kind = 'instance';
    applyJsonFieldPatch(next as unknown as Record<string, unknown>, path, value);
    cleanupEditorSceneGameObjectOverrides(next);
    return next;
  }
  return next;
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

function cleanupEditorSceneGameObjectOverrides(gameObject: EditorSceneGameObject): void {
  const overrides = gameObject.overrides;
  if (!overrides) return;

  const materialBinding = pruneEditorSceneMaterialBinding(overrides.materialBinding);
  if (materialBinding) overrides.materialBinding = materialBinding;
  else delete overrides.materialBinding;

  for (const [key, childMaterialBinding] of Object.entries(overrides.childMaterialBindings ?? {})) {
    const normalized = pruneEditorSceneMaterialBinding(childMaterialBinding);
    if (normalized) overrides.childMaterialBindings![key] = normalized;
    else delete overrides.childMaterialBindings![key];
  }
  if (overrides.childMaterialBindings && Object.keys(overrides.childMaterialBindings).length === 0) delete overrides.childMaterialBindings;

  const material = pruneEditorSceneMaterialOverride(overrides.material);
  if (material) overrides.material = material;
  else delete overrides.material;

  for (const [key, childMaterial] of Object.entries(overrides.childMaterials ?? {})) {
    const normalized = pruneEditorSceneMaterialOverride(childMaterial);
    if (normalized) overrides.childMaterials![key] = normalized;
    else delete overrides.childMaterials![key];
  }
  if (overrides.childMaterials && Object.keys(overrides.childMaterials).length === 0) delete overrides.childMaterials;
  if (overrides.childTransforms && Object.keys(overrides.childTransforms).length === 0) delete overrides.childTransforms;
  if (overrides.childOutlines && Object.keys(overrides.childOutlines).length === 0) delete overrides.childOutlines;

  if (Object.keys(overrides).length === 0) delete gameObject.overrides;
}

function pruneEditorSceneMaterialBinding(
  binding: SceneNodeMaterialBindingConfig | undefined,
): SceneNodeMaterialBindingConfig | undefined {
  if (!binding) return undefined;
  const next: SceneNodeMaterialBindingConfig = structuredClone(binding);
  if (typeof next.materialAssetId === 'string') {
    const materialAssetId = next.materialAssetId.trim();
    if (materialAssetId) next.materialAssetId = materialAssetId;
    else delete next.materialAssetId;
  }
  if (next.override) {
    next.override = pruneEditorSceneArtistMaterialProfile(next.override);
    if (Object.keys(next.override).length === 0) delete next.override;
  }
  return next.materialAssetId || next.override ? next : undefined;
}

function pruneEditorSceneMaterialOverride(
  material: MaterialOverrideConfig | undefined,
): MaterialOverrideConfig | undefined {
  if (!material) return undefined;
  const next: MaterialOverrideConfig = structuredClone(material);
  for (const textureKey of ['albedoTexture', 'normalTexture', 'metallicTexture'] as const) {
    const texture = next[textureKey];
    if (texture && typeof texture === 'object' && Object.keys(texture).length === 0) delete next[textureKey];
  }
  for (const lightingKey of ['pbr', 'standard'] as const) {
    const lighting = next[lightingKey];
    if (lighting && typeof lighting === 'object' && Object.keys(lighting).length === 0) delete next[lightingKey];
  }
  return Object.keys(next).length > 0 ? next : undefined;
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
    applyJsonFieldPatch(patchedCameraHost as unknown as Record<string, unknown>, path, value);
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
  const gameObject = document.scene.gameObjects.find((entry) => entry.id === patch.targetId);
  if (!gameObject) return document;
  return applySerializedPropertyPatch(
    document,
    createEditorScenePropertyDescriptors(gameObject),
    patch,
  );
}

export function addAssetLibraryItemToEditorSceneDocument(
  document: EditorSceneDocument,
  assetItem: EditorSceneAssetLibraryItem,
  placement?: EditorTransformSnapshot,
): { document: EditorSceneDocument; gameObject: EditorSceneGameObject } {
  if (assetItem.type === 'texture') {
    const gameObject = createGroundDecalGameObjectForTextureAsset(document, assetItem, placement);
    return {
      document: {
        ...document,
        scene: {
          ...document.scene,
          gameObjects: [...document.scene.gameObjects, gameObject],
        },
      },
      gameObject,
    };
  }

  const existingAsset = document.assets.find((asset) => asset.id === assetItem.assetId || (asset.guid && asset.guid === assetItem.guid));
  const asset = existingAsset
    ? mergeEditorSceneAssetWithLibraryItem(existingAsset, assetItem)
    : createEditorSceneAssetFromLibraryItem(assetItem);
  const gameObject = createGameObjectForAsset(document, assetItem, asset.id, placement);
  return {
    document: {
      ...document,
      assets: existingAsset
        ? document.assets.map((candidate) => candidate.id === asset.id ? asset : candidate)
        : [...document.assets, asset],
      scene: {
        ...document.scene,
        gameObjects: [...document.scene.gameObjects, gameObject],
      },
    },
    gameObject,
  };
}

function createEditorScenePropertyDescriptors(
  gameObject: EditorSceneGameObject,
): SerializedPropertyDescriptor<EditorSceneDocument>[] {
  const descriptors: SerializedPropertyDescriptor<EditorSceneDocument>[] = [
    {
      path: 'gameObject.id',
      label: 'ID',
      valueType: 'string',
      readOnly: true,
      getValue: () => gameObject.id,
    },
    {
      path: 'gameObject.name',
      label: 'Name',
      valueType: 'string',
      readOnly: true,
      getValue: () => gameObject.name ?? gameObject.id,
    },
  ];
  const transform = findEditorSceneTransform(gameObject);
  if (transform) {
    const rootTransform = isEditorSceneRootGameObject(gameObject);
    const protectedTransform = rootTransform || isEditorSceneProtectedSystemGameObject(gameObject);
    const displayTransform = rootTransform ? EDITOR_SCENE_ROOT_TRANSFORM : transform;
    for (const vectorName of ['position', 'rotation', 'scale'] as const) {
      for (const axis of ['x', 'y', 'z'] as const) {
        descriptors.push({
          path: `transform.${vectorName}.${axis}`,
          label: `${vectorName}.${axis}`,
          valueType: 'number',
          readOnly: protectedTransform,
          getValue: () => {
            const value = readTransformVector(displayTransform, vectorName)[axis];
            return vectorName === 'rotation' ? roundForInspector(radiansToDegrees(value)) : value;
          },
          ...(protectedTransform
            ? {}
            : {
                setValue: (document, value, context) => {
                  const targetId = context.targetId;
                  const numericValue = Number(value);
                  if (!targetId || !Number.isFinite(numericValue)) return document;
                  const target = document.scene.gameObjects.find((entry) => entry.id === targetId);
                  const targetTransform = target ? findEditorSceneTransform(target) : null;
                  if (!target || !targetTransform) return document;
                  if (!validateEditorSceneInspectorValue(
                    document,
                    target,
                    `transform.${vectorName}.${axis}`,
                    numericValue,
                  ).ok) {
                    return document;
                  }
                  const storedValue = vectorName === 'rotation' ? degreesToRadians(numericValue) : numericValue;
                  const position = vectorName === 'position'
                    ? { ...targetTransform.position, [axis]: storedValue }
                    : targetTransform.position;
                  const rotation = vectorName === 'rotation'
                    ? { ...targetTransform.rotation, [axis]: storedValue }
                    : targetTransform.rotation;
                  const scale = vectorName === 'scale'
                    ? { ...readTransformVector(targetTransform, 'scale'), [axis]: storedValue }
                    : readTransformVector(targetTransform, 'scale');
                  return patchEditorSceneGameObjectTransform(document, targetId, {
                    position,
                    rotation,
                    scale,
                  });
                },
              }),
        });
      }
    }
  }
  const renderer = findEditorSceneModelRenderer(gameObject);
  if (renderer) {
    descriptors.push({
      path: 'modelRenderer.assetId',
      label: 'Asset ID',
      valueType: 'asset',
      readOnly: true,
      getValue: () => renderer.assetId,
    });
  }
  return descriptors;
}

function createEditorSceneMultiTransformProperties(
  gameObjects: EditorSceneGameObject[],
): SerializedMultiObject<EditorSceneDocument>['properties'] {
  const properties: SerializedMultiObject<EditorSceneDocument>['properties'] = [];
  for (const vectorName of ['position', 'rotation', 'scale'] as const) {
    for (const axis of ['x', 'y', 'z'] as const) {
      const values = gameObjects
        .map((gameObject) => {
          const transform = findEditorSceneTransform(gameObject);
          return transform ? readTransformVector(transform, vectorName)[axis] : null;
        })
        .filter((value): value is number => typeof value === 'number');
      if (values.length !== gameObjects.length) continue;
      const displayValues = vectorName === 'rotation'
        ? values.map(radiansToDegrees)
        : values;
      const firstValue = displayValues[0] ?? 0;
      const mixed = displayValues.some((value) => Math.abs(value - firstValue) > 0.000001);
      properties.push({
        path: `transform.${vectorName}.${axis}`,
        label: `${vectorName}.${axis}`,
        valueType: 'number',
        value: roundForInspector(firstValue),
        mixed,
        readOnly: false,
        descriptor: {
          path: `transform.${vectorName}.${axis}`,
          valueType: 'number',
          getValue: () => firstValue,
        },
      });
    }
  }
  return properties;
}

function readTransformVector(
  transform: { position: EditorSceneVec3; rotation: EditorSceneVec3; scale?: EditorSceneVec3 },
  vectorName: 'position' | 'rotation' | 'scale',
): EditorSceneVec3 {
  if (vectorName === 'scale') return transform.scale ?? { x: 1, y: 1, z: 1 };
  return transform[vectorName];
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function roundForInspector(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

function createEditorSceneAssetFromLibraryItem(assetItem: EditorSceneAssetLibraryItem): EditorSceneAsset {
  const preferredAssetId = assetItem.assetId;
  return {
    id: preferredAssetId,
    guid: assetItem.guid,
    type: 'glb',
    displayName: assetItem.displayName,
    category: assetItem.category,
    materialMode: assetItem.materialMode,
    defaults: assetItem.defaults ? structuredClone(assetItem.defaults) : undefined,
    external: assetItem.external ? structuredClone(assetItem.external) : undefined,
    metadata: assetItem.metadata ? structuredClone(assetItem.metadata) : undefined,
  };
}

function createGameObjectForAsset(
  document: EditorSceneDocument,
  assetItem: EditorSceneAssetLibraryItem,
  assetId: string,
  placement?: EditorTransformSnapshot,
): EditorSceneGameObject {
  const usedIds = document.scene.gameObjects.map((gameObject) => gameObject.id);
  const id = createUniqueEditorSceneId(usedIds, sanitizeEditorSceneId(assetItem.displayName || assetItem.assetId));
  const parentId = resolveEditorSceneRootContainerId(document);
  const worldTransform: EditorTransformSnapshot = {
    position: placement?.position ?? getNextPlacementPosition(document),
    rotation: placement?.rotation ?? { x: 0, y: 0, z: 0 },
    scale: placement?.scale ?? { x: 1, y: 1, z: 1 },
  };
  const localTransform = parentId
    ? toLocalTransformForParent(document, parentId, worldTransform) ?? worldTransform
    : worldTransform;
  return {
    id,
    guid: createEditorSceneGameObjectGuid(),
    name: assetItem.displayName,
    ...(parentId ? { parentId } : {}),
    active: true,
    components: [
      {
        type: 'Transform',
        position: localTransform.position,
        rotation: localTransform.rotation,
        scale: localTransform.scale,
      },
      {
        type: 'ModelRenderer',
        assetId,
      },
    ],
  };
}

function createGroundDecalGameObjectForTextureAsset(
  document: EditorSceneDocument,
  assetItem: EditorSceneAssetLibraryItem,
  placement?: EditorTransformSnapshot,
): EditorSceneGameObject {
  const usedIds = document.scene.gameObjects.map((gameObject) => gameObject.id);
  const id = createUniqueEditorSceneId(usedIds, sanitizeEditorSceneId(assetItem.displayName || assetItem.assetId));
  const parentId = resolveEditorSceneRootContainerId(document);
  const worldTransform: EditorTransformSnapshot = {
    position: placement?.position ?? getNextPlacementPosition(document),
    rotation: placement?.rotation ?? { x: 0, y: 0, z: 0 },
    scale: placement?.scale ?? { x: 1, y: 1, z: 1 },
  };
  const localTransform = parentId
    ? toLocalTransformForParent(document, parentId, worldTransform) ?? worldTransform
    : worldTransform;
  return {
    id,
    guid: createEditorSceneGameObjectGuid(),
    name: assetItem.displayName,
    kind: 'transform',
    ...(parentId ? { parentId } : {}),
    active: true,
    transformType: 'groundDecal',
    groundDecal: {
      size: { width: 1, depth: 1 },
      textureId: assetItem.assetId,
      color: { r: 1, g: 1, b: 1 },
    },
    metadata: {
      ...(assetItem.metadata ?? {}),
      assetId: assetItem.assetId,
      assetType: 'texture',
    },
    components: [{
      type: 'Transform',
      position: localTransform.position,
      rotation: localTransform.rotation,
      scale: localTransform.scale,
    }],
  };
}

function getNextPlacementPosition(document: EditorSceneDocument): EditorSceneVec3 {
  const renderableCount = document.scene.gameObjects.filter((gameObject) => (
    !!findEditorSceneModelRenderer(gameObject) || !!findEditorScenePrimitiveRenderer(gameObject)
  )).length;
  return {
    x: (renderableCount % 5) * 1.8 - 3.6,
    y: 0,
    z: Math.floor(renderableCount / 5) * 1.8 + 1.8,
  };
}

function normalizeEditorScenePrimitiveShape(shape: unknown): ScenePrimitiveShape | null {
  return shape === 'cube' || shape === 'sphere' || shape === 'plane' || shape === 'capsule'
    ? shape
    : null;
}

function getEditorScenePrimitiveDisplayName(shape: ScenePrimitiveShape): string {
  return shape[0]!.toUpperCase() + shape.slice(1);
}

function getEditorScenePrimitiveDefaultScale(shape: ScenePrimitiveShape): EditorSceneVec3 {
  return shape === 'plane'
    ? { x: 10, y: 1, z: 10 }
    : { x: 1, y: 1, z: 1 };
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
