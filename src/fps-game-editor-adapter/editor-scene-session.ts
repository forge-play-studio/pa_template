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
  EditorSceneVec3,
} from './editor-scene-document';
import type {
  MaterialOverrideConfig,
  OutlineOverrideConfig,
  SceneCameraProjection,
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

export type EditorSceneDocumentPatch =
  | ({ kind: 'serialized-property' } & SerializedPropertyPatch)
  | {
    kind: 'game-object.field';
    targetId: string;
    path: string;
    value: unknown;
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
export const EDITOR_SCENE_SUN_LIGHT_ID = 'sun_light';
const EDITOR_SCENE_ROOT_ID = 'root';
const EDITOR_SCENE_ROOT_TRANSFORM = createIdentityEditorTransform();
const EDITOR_SCENE_GAME_OBJECT_GUID_PREFIX = 'go_';
const DEFAULT_CAMERA_LOWER_BETA_LIMIT = 0.1;
const DEFAULT_CAMERA_UPPER_BETA_LIMIT = 1.45;
const DEFAULT_CAMERA_RADIUS_LIMIT_FACTOR_MIN = 0.25;
const DEFAULT_CAMERA_RADIUS_LIMIT_FACTOR_MAX = 4;
const MIN_CAMERA_RADIUS_LIMIT = 0.1;

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
  lowerBetaLimit: DEFAULT_CAMERA_LOWER_BETA_LIMIT,
  upperBetaLimit: DEFAULT_CAMERA_UPPER_BETA_LIMIT,
  lowerRadiusLimit: 3.5,
  upperRadiusLimit: 56,
  inertia: 0.9,
  targetScreenOffset: { x: 0, y: 0 },
  inspectorLanguage: 'zh',
};

export const DEFAULT_EDITOR_SCENE_SUN_LIGHT: EditorSceneDirectionalLight = {
  type: 'directional',
  intensity: 2,
  direction: { x: -0.3, y: -1, z: -0.2 },
  diffuseColor: { r: 1, g: 1, b: 1 },
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
  betaRange: string;
  minRadius: string;
  maxRadius: string;
  radiusRange: string;
  inertia: string;
  screenOffset: string;
  rawCamera: string;
  tooltips: CameraInspectorTooltipText;
};

type CameraInspectorTooltipText = Record<
  | 'language'
  | 'projection'
  | 'alpha'
  | 'beta'
  | 'radius'
  | 'orthoSize'
  | 'fov'
  | 'targetOffset'
  | 'nearClip'
  | 'farClip'
  | 'minBeta'
  | 'maxBeta'
  | 'betaRange'
  | 'minRadius'
  | 'maxRadius'
  | 'radiusRange'
  | 'inertia'
  | 'screenOffset'
  | 'rawCamera',
  string
>;

const CAMERA_INSPECTOR_TEXT: Record<EditorSceneCameraInspectorLanguage, CameraInspectorText> = {
  zh: {
    title: '摄像机',
    summaryOrthographic: 'ArcRotate 正交',
    summaryPerspective: 'ArcRotate 透视',
    language: '语言',
    projection: '投影模式',
    projectionOrthographic: '正交',
    projectionPerspective: '透视',
    alpha: '水平环绕角',
    beta: '俯仰角',
    radius: '跟随距离',
    orthoSize: '正交视野高度',
    fov: '透视视野角',
    targetOffset: '观察目标偏移',
    nearClip: '近裁面距离',
    farClip: '远裁面距离',
    minBeta: '最小俯仰角',
    maxBeta: '最大俯仰角',
    betaRange: '俯仰角范围',
    minRadius: '最小跟随距离',
    maxRadius: '最大跟随距离',
    radiusRange: '跟随距离范围',
    inertia: '平滑惯性',
    screenOffset: '画面偏移',
    rawCamera: '原始摄像机数据',
    tooltips: {
      language: '切换摄像机 Inspector 的显示语言。',
      projection: '切换 Main Camera 使用正交投影或透视投影。',
      alpha: 'ArcRotate 水平环绕角，单位为弧度。',
      beta: 'ArcRotate 垂直俯仰角，单位为弧度。',
      radius: '摄像机到观察目标的距离。',
      orthoSize: '正交模式下的视野高度，数值越大看到的范围越大。',
      fov: '透视模式下的垂直视野角；界面用角度显示，保存为弧度。',
      targetOffset: 'Main Camera 围绕观察的目标点偏移，按 X/Y/Z 一行编辑。',
      nearClip: '小于该距离的内容不会被摄像机渲染。',
      farClip: '大于该距离的内容不会被摄像机渲染。',
      minBeta: '限制运行时可用的最小俯仰角。',
      maxBeta: '限制运行时可用的最大俯仰角。',
      betaRange: '运行时允许的俯仰角范围，左侧为最小值，右侧为最大值。',
      minRadius: '限制摄像机可接近目标的最小距离。',
      maxRadius: '限制摄像机可远离目标的最大距离。',
      radiusRange: '运行时允许的跟随距离范围，左侧为最小值，右侧为最大值。',
      inertia: '摄像机输入或跟随的平滑惯性，0 最灵敏，1 最平滑。',
      screenOffset: '将观察目标在画面中偏移，X 为水平，Y 为垂直。',
      rawCamera: '合并默认值前的原始摄像机 authoring 数据。',
    },
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
    betaRange: 'Pitch Range',
    minRadius: 'Min Radius',
    maxRadius: 'Max Radius',
    radiusRange: 'Follow Distance Range',
    inertia: 'Inertia',
    screenOffset: 'Screen Offset',
    rawCamera: 'Raw Camera',
    tooltips: {
      language: 'Switch the camera Inspector language.',
      projection: 'Switch the Main Camera between orthographic and perspective projection.',
      alpha: 'ArcRotate horizontal orbit angle, in radians.',
      beta: 'ArcRotate vertical pitch angle, in radians.',
      radius: 'Distance from the camera to the look target.',
      orthoSize: 'Orthographic view height. Larger values show a wider area.',
      fov: 'Perspective vertical field of view. The UI uses degrees; saved data uses radians.',
      targetOffset: 'Look target offset for the Main Camera, edited as X/Y/Z in one row.',
      nearClip: 'Content closer than this distance is not rendered.',
      farClip: 'Content farther than this distance is not rendered.',
      minBeta: 'Minimum allowed runtime pitch angle.',
      maxBeta: 'Maximum allowed runtime pitch angle.',
      betaRange: 'Allowed runtime pitch range. Left is minimum; right is maximum.',
      minRadius: 'Minimum allowed camera distance from the target.',
      maxRadius: 'Maximum allowed camera distance from the target.',
      radiusRange: 'Allowed runtime follow distance range. Left is minimum; right is maximum.',
      inertia: 'Camera input/follow smoothing. 0 is most responsive; 1 is smoothest.',
      screenOffset: 'Moves the look target in screen space. X is horizontal; Y is vertical.',
      rawCamera: 'Raw camera authoring data before defaults are merged.',
    },
  },
};

const CAMERA_LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
];

function getCameraInspectorText(language: EditorSceneCameraInspectorLanguage): CameraInspectorText {
  return CAMERA_INSPECTOR_TEXT[language] ?? CAMERA_INSPECTOR_TEXT.zh;
}

function createCameraProjectionOptions(text: CameraInspectorText): Array<{ label: string; value: SceneCameraProjection }> {
  return [
    { label: text.projectionOrthographic, value: 'orthographic' },
    { label: text.projectionPerspective, value: 'perspective' },
  ];
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
    if (isBlockedEditorSceneCameraFieldPatch(document, patch.targetId, patch.path, patch.value)) return document;
    return patchEditorSceneGameObjectField(document, patch.targetId, patch.path, patch.value);
  }
  if (patch.kind === 'game-object.create-from-asset') {
    return addAssetLibraryItemToEditorSceneDocument(document, patch.assetItem, patch.placement).document;
  }
  if (patch.kind === 'game-object.transform') {
    if (isEditorSceneRootGameObjectId(patch.targetId)) return document;
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
      && !isEditorSceneCameraGameObject(gameObject)
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
    if (document.scene.gameObjects.some((gameObject) => deleteIds.has(gameObject.id) && isEditorSceneCameraGameObject(gameObject))) {
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
    if (document.scene.gameObjects.some((gameObject) => gameObject.id === patch.gameObject.id)) return document;
    const childIds = new Set(patch.childIds.filter((id) => !isEditorSceneRootGameObjectId(id)));
    if (childIds.size === 0) return document;
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
    || gameObject.id === EDITOR_SCENE_SUN_LIGHT_ID
    || isEditorSceneCameraGameObject(gameObject)
    || isEditorSceneLightGameObject(gameObject);
}

export function ensureEditorSceneEnvironmentDefaults(document: EditorSceneDocument): EditorSceneDocument {
  const documentWithGuids = ensureEditorSceneGameObjectGuids(document);
  const rootId = resolveEditorSceneRootContainerId(documentWithGuids);
  let cameraSeen = false;
  let changed = documentWithGuids !== document;
  const gameObjects = documentWithGuids.scene.gameObjects.map((gameObject) => {
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
      const next = normalizeEditorSceneLightGameObject(gameObject);
      changed = changed || next !== gameObject;
      return next;
    }
    return gameObject;
  });

  const usedIds = new Set(gameObjects.map((gameObject) => gameObject.id));
  if (!cameraSeen) {
    changed = true;
    gameObjects.push(createDefaultEditorSceneCameraGameObject(rootId, usedIds));
  }
  if (!gameObjects.some(isEditorSceneLightGameObject)) {
    changed = true;
    gameObjects.push(createDefaultEditorSceneSunLightGameObject(rootId, usedIds));
  }

  return changed
    ? {
        ...documentWithGuids,
        scene: {
          ...documentWithGuids.scene,
          gameObjects,
        },
      }
    : documentWithGuids;
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
  if (document.scene.gameObjects.some((gameObject) => deletedIds.includes(gameObject.id) && isEditorSceneCameraGameObject(gameObject))) {
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
  if (!target) return { ok: false, reason: `Parent GameObject not found: ${intent.targetId}` };
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
  const parentId = resolveEditorSceneMoveParentId(document, intent);
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
  const parentId = resolveEditorSceneGroupSelectionParentId(document, intent.parentId ?? null);
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
    if (!source || isEditorSceneRootGameObject(source) || isEditorSceneCameraGameObject(source)) continue;
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
    sections: createEditorSceneInspectorSections(document, gameObject),
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
  if (isEditorSceneRootTransformPath(input.targetId, path)) return null;
  if (!validateEditorSceneInspectorValue(input.document, gameObject, path, value).ok) return null;
  if (isBlockedEditorSceneCameraFieldPatch(input.document, input.targetId, path, value)) return null;
  const changedIds = path.startsWith('transform.')
    ? collectEditorSceneSubtreeIdList(input.document, [input.targetId])
    : [input.targetId];
  const reprojectIds = isEditorSceneProjectionShapePath(path) ? [input.targetId] : undefined;
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
    sections.push({
      id: 'light',
      title: 'Sun Light',
      order: 44,
      placement: 'body',
      summary: 'Directional',
      persistence: 'document',
      collapsedByDefault: false,
      properties: createSunLightInspectorProperties(nodeKind, gameObject.light),
    });
  }
  if (nodeKind === 'instance' || nodeKind === 'primitive' || (nodeKind === 'transform' && !isEditorSceneCameraGameObject(gameObject) && !isEditorSceneLightGameObject(gameObject))) {
    sections.push(...createMaterialOverrideInspectorSections(nodeKind, gameObject.overrides?.material));
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
  const displayTransform = rootTransform ? EDITOR_SCENE_ROOT_TRANSFORM : transform;
  for (const vectorName of ['position', 'rotation', 'scale'] as const) {
    const vector = readTransformVector(displayTransform, vectorName);
    for (const axis of ['x', 'y', 'z'] as const) {
      const path = `transform.${vectorName}.${axis}`;
      const value = vectorName === 'rotation' ? roundForInspector(radiansToDegrees(vector[axis])) : vector[axis];
      properties.push(rootTransform
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
    tooltip: text.tooltips.language,
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
    tooltip: text.tooltips.projection,
  }));
  order += 1;

  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.alpha',
    label: text.alpha,
    value: rig.alpha,
    order,
    step: 0.01,
    tooltip: text.tooltips.alpha,
  }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.beta',
    label: text.beta,
    value: rig.beta,
    order,
    step: 0.01,
    tooltip: text.tooltips.beta,
  }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.radius',
    label: text.radius,
    value: rig.radius,
    order,
    min: 0.001,
    step: 0.1,
    tooltip: text.tooltips.radius,
  }));
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
      tooltip: text.tooltips.fov,
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
      tooltip: text.tooltips.orthoSize,
    }));
  }
  order += 1;

  properties.push(createDocumentInspectorProperty(null, nodeKind, {
    path: 'camera.targetOffset',
    label: text.targetOffset,
    valueType: 'vec3',
    control: 'vec3',
    value: rig.targetOffset ?? { x: 0, y: 0, z: 0 },
    commitMode: 'live',
    order,
    step: 0.05,
    tooltip: text.tooltips.targetOffset,
  }));
  order += 1;

  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.minZ',
    label: text.nearClip,
    value: rig.minZ ?? 1,
    order,
    min: 0.001,
    step: 0.1,
    tooltip: text.tooltips.nearClip,
  }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.maxZ',
    label: text.farClip,
    value: rig.maxZ ?? 10000,
    order,
    min: 0.001,
    step: 1,
    tooltip: text.tooltips.farClip,
  }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.lowerBetaLimit',
    label: text.minBeta,
    value: rig.lowerBetaLimit ?? rig.beta,
    order,
    step: 0.01,
    tooltip: text.tooltips.minBeta,
    controlOptions: { groupPath: 'camera.betaLimitRange', groupLabel: text.betaRange, groupOrder: 0 },
  }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.upperBetaLimit',
    label: text.maxBeta,
    value: rig.upperBetaLimit ?? rig.beta,
    order,
    step: 0.01,
    tooltip: text.tooltips.maxBeta,
    controlOptions: { groupPath: 'camera.betaLimitRange', groupLabel: text.betaRange, groupOrder: 1 },
  }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.lowerRadiusLimit',
    label: text.minRadius,
    value: rig.lowerRadiusLimit ?? rig.radius,
    order,
    min: 0.001,
    step: 0.1,
    tooltip: text.tooltips.minRadius,
    controlOptions: { groupPath: 'camera.radiusLimitRange', groupLabel: text.radiusRange, groupOrder: 0 },
  }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.upperRadiusLimit',
    label: text.maxRadius,
    value: rig.upperRadiusLimit ?? rig.radius,
    order,
    min: 0.001,
    step: 0.1,
    tooltip: text.tooltips.maxRadius,
    controlOptions: { groupPath: 'camera.radiusLimitRange', groupLabel: text.radiusRange, groupOrder: 1 },
  }));
  order += 1;
  properties.push(createCameraNumberInspectorProperty(nodeKind, {
    path: 'camera.inertia',
    label: text.inertia,
    value: rig.inertia ?? 0.9,
    order,
    min: 0,
    max: 1,
    step: 0.05,
    tooltip: text.tooltips.inertia,
  }));
  order += 1;

  for (const axis of ['x', 'y'] as const) {
    properties.push(createCameraNumberInspectorProperty(nodeKind, {
      path: `camera.targetScreenOffset.${axis}`,
      label: `${text.screenOffset} ${axis.toUpperCase()}`,
      value: rig.targetScreenOffset?.[axis] ?? 0,
      order,
      step: 0.01,
      tooltip: text.tooltips.screenOffset,
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
    tooltip: text.tooltips.rawCamera,
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
    tooltip?: string;
    controlOptions?: InspectorProperty<EditorSceneDocument>['controlOptions'];
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
    tooltip: input.tooltip,
    controlOptions: input.controlOptions,
    coerce: input.coerce,
  });
}

function createSunLightInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  light: EditorSceneGameObject['light'],
): InspectorProperty<EditorSceneDocument>[] {
  const sun = mergeEditorSceneLightDefaults(light);
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createReadonlyInspectorProperty('light.type', 'Type', sun.type, 0),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'light.intensity',
      label: 'Intensity',
      valueType: 'number',
      control: 'number',
      value: sun.intensity,
      commitMode: 'live',
      order: 1,
      min: 0,
      step: 0.05,
    }),
  ];
  let order = 2;
  for (const axis of ['x', 'y', 'z'] as const) {
    properties.push(createDocumentInspectorProperty(null, nodeKind, {
      path: `light.direction.${axis}`,
      label: `Direction.${axis}`,
      valueType: 'number',
      control: 'number',
      value: sun.direction[axis],
      commitMode: 'live',
      order,
      step: 0.05,
    }));
    order += 1;
  }
  properties.push(createDocumentInspectorProperty(null, nodeKind, {
    path: 'light.diffuseColor',
    label: 'Diffuse Color',
    valueType: 'color',
    control: 'color',
    value: sun.diffuseColor ?? { r: 1, g: 1, b: 1 },
    commitMode: 'immediate',
    order,
  }));
  appendReadonlyInspectorProperty(properties, {
    path: 'light.raw',
    label: 'Raw Light',
    value: light ?? 'defaults',
    order: properties.length,
    source: 'Document',
    tags: ['Raw'],
  });
  return properties;
}

function createMaterialOverrideInspectorSections(
  nodeKind: SceneNodeConfig['kind'],
  material: MaterialOverrideConfig | undefined,
): InspectorSection<EditorSceneDocument>[] {
  const summary = material ? 'Configured' : 'Defaults';
  const effect = material ? 'active' : 'default';
  const disabledReason = effect === 'default' ? MATERIAL_DEFAULT_DISABLED_REASON : undefined;
  const persistence = effect === 'default' ? 'readonly' : 'document';
  const markProperties = (properties: InspectorProperty<EditorSceneDocument>[]) => (
    markInspectorPropertiesEffect(properties, effect, disabledReason)
  );
  return [{
    id: 'material',
    title: 'Material',
    order: 50,
    placement: 'body',
    summary,
    persistence,
    effect,
    disabledReason,
    collapsedByDefault: true,
    properties: markProperties(createMaterialBaseInspectorProperties(nodeKind, material)),
  }, {
    id: 'materialTextures',
    title: 'Material Textures',
    order: 52,
    placement: 'body',
    summary: createMaterialTextureInspectorSummary(material),
    persistence,
    effect,
    disabledReason,
    collapsedByDefault: true,
    properties: markProperties(createMaterialTextureOverrideInspectorProperties(nodeKind, material)),
  }, {
    id: 'materialColors',
    title: 'Material Colors',
    order: 54,
    placement: 'body',
    summary,
    persistence,
    effect,
    disabledReason,
    collapsedByDefault: true,
    properties: markProperties(createMaterialColorOverrideInspectorProperties(nodeKind, material)),
  }, {
    id: 'metallicRoughness',
    title: 'Metallic / Roughness',
    order: 56,
    placement: 'body',
    summary,
    persistence,
    effect,
    disabledReason,
    collapsedByDefault: true,
    properties: markProperties(createMetallicRoughnessOverrideInspectorProperties(nodeKind, material)),
  }, {
    id: 'intensityProperties',
    title: 'Intensity Properties',
    order: 58,
    placement: 'body',
    summary,
    persistence,
    effect,
    disabledReason,
    collapsedByDefault: true,
    properties: markProperties(createIntensityOverrideInspectorProperties(nodeKind, material)),
  }];
}

const MATERIAL_DEFAULT_DISABLED_REASON = 'Material fields are showing defaults; configure a material override before edits affect this object.';
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

function createMaterialBaseInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  material: MaterialOverrideConfig | undefined,
): InspectorProperty<EditorSceneDocument>[] {
  const properties: InspectorProperty<EditorSceneDocument>[] = [
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.material.alpha',
      label: 'Alpha',
      valueType: 'number',
      control: 'number',
      value: material?.alpha ?? 1,
      commitMode: 'live',
      order: 0,
      min: 0,
      max: 1,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.alphaCutOff',
      label: 'Alpha Cutoff',
      value: material?.alphaCutOff ?? 0,
      order: 1,
      min: 0,
      max: 1,
      step: 0.01,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.transparencyMode',
      label: 'Transparency Mode',
      value: material?.transparencyMode ?? 0,
      order: 2,
      min: 0,
      step: 1,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.material.backFaceCulling',
      label: 'Back Face Culling',
      valueType: 'boolean',
      control: 'boolean',
      value: material?.backFaceCulling ?? true,
      commitMode: 'immediate',
      order: 3,
    }),
    createDocumentInspectorProperty(null, nodeKind, {
      path: 'overrides.material.standard.useSpecularOverAlpha',
      label: 'Standard Use Specular Over Alpha',
      valueType: 'boolean',
      control: 'boolean',
      value: material?.standard?.useSpecularOverAlpha ?? false,
      commitMode: 'immediate',
      order: 4,
    }),
  ];
  appendReadonlyInspectorProperty(properties, {
    path: 'overrides.material.raw',
    label: 'Raw Override',
    value: material ?? 'not configured',
    order: properties.length,
    source: 'Document',
    tags: ['Raw'],
  });
  return properties;
}

function createMaterialTextureOverrideInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  material: MaterialOverrideConfig | undefined,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createMaterialTextureUrlInspectorProperty(nodeKind, {
      path: 'overrides.material.albedoTexture.url',
      label: 'Albedo Texture URL',
      value: material?.albedoTexture?.url ?? '',
      order: 0,
    }),
    createMaterialTextureUrlInspectorProperty(nodeKind, {
      path: 'overrides.material.normalTexture.url',
      label: 'Normal Texture URL',
      value: material?.normalTexture?.url ?? '',
      order: 1,
    }),
    createMaterialTextureUrlInspectorProperty(nodeKind, {
      path: 'overrides.material.metallicTexture.url',
      label: 'Metallic Texture URL',
      value: material?.metallicTexture?.url ?? '',
      order: 2,
    }),
  ];
}

function createMaterialColorOverrideInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  material: MaterialOverrideConfig | undefined,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.albedoColor', 'Albedo', material?.albedoColor ?? { r: 1, g: 1, b: 1 }, 0),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.diffuseColor', 'Diffuse', material?.diffuseColor ?? { r: 1, g: 1, b: 1 }, 1),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.emissiveColor', 'Emissive', material?.emissiveColor ?? { r: 0, g: 0, b: 0 }, 2),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.pbr.albedoColor', 'PBR Albedo', material?.pbr?.albedoColor ?? { r: 1, g: 1, b: 1 }, 3),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.pbr.reflectivityColor', 'PBR Reflectivity', material?.pbr?.reflectivityColor ?? { r: 1, g: 1, b: 1 }, 4),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.pbr.emissiveColor', 'PBR Emissive', material?.pbr?.emissiveColor ?? { r: 0, g: 0, b: 0 }, 5),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.pbr.ambientColor', 'PBR Ambient', material?.pbr?.ambientColor ?? { r: 0, g: 0, b: 0 }, 6),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.standard.diffuseColor', 'Standard Diffuse', material?.standard?.diffuseColor ?? { r: 1, g: 1, b: 1 }, 7),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.standard.specularColor', 'Standard Specular', material?.standard?.specularColor ?? { r: 1, g: 1, b: 1 }, 8),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.standard.emissiveColor', 'Standard Emissive', material?.standard?.emissiveColor ?? { r: 0, g: 0, b: 0 }, 9),
    createMaterialColorInspectorProperty(nodeKind, 'overrides.material.standard.ambientColor', 'Standard Ambient', material?.standard?.ambientColor ?? { r: 0, g: 0, b: 0 }, 10),
  ];
}

function createMetallicRoughnessOverrideInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  material: MaterialOverrideConfig | undefined,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.metallic',
      label: 'Metallic',
      value: material?.metallic ?? 0,
      order: 0,
      min: 0,
      max: 1,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.roughness',
      label: 'Roughness',
      value: material?.roughness ?? 1,
      order: 1,
      min: 0,
      max: 1,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.pbr.baseWeight',
      label: 'PBR Base Weight',
      value: material?.pbr?.baseWeight ?? 1,
      order: 2,
      min: 0,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.pbr.microSurface',
      label: 'PBR Micro Surface',
      value: material?.pbr?.microSurface ?? 1,
      order: 3,
      min: 0,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.pbr.metallicF0Factor',
      label: 'PBR Metallic F0 Factor',
      value: material?.pbr?.metallicF0Factor ?? 1,
      order: 4,
      min: 0,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.pbr.indexOfRefraction',
      label: 'PBR Index Of Refraction',
      value: material?.pbr?.indexOfRefraction ?? 1.5,
      order: 5,
      min: 0,
      step: 0.01,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.standard.specularPower',
      label: 'Standard Specular Power',
      value: material?.standard?.specularPower ?? 64,
      order: 6,
      min: 0,
      step: 1,
    }),
  ];
}

function createIntensityOverrideInspectorProperties(
  nodeKind: SceneNodeConfig['kind'],
  material: MaterialOverrideConfig | undefined,
): InspectorProperty<EditorSceneDocument>[] {
  return [
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.contrast',
      label: 'Contrast',
      value: material?.contrast ?? 1,
      order: 0,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.brightness',
      label: 'Brightness',
      value: material?.brightness ?? 1,
      order: 1,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.saturation',
      label: 'Saturation',
      value: material?.saturation ?? 1,
      order: 2,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.hue',
      label: 'Hue',
      value: material?.hue ?? 0,
      order: 3,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.colorDensity',
      label: 'Color Density',
      value: material?.colorDensity ?? 1,
      order: 4,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.pbr.lightFalloff',
      label: 'PBR Light Falloff',
      value: material?.pbr?.lightFalloff ?? 0,
      order: 5,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.pbr.directIntensity',
      label: 'PBR Direct Intensity',
      value: material?.pbr?.directIntensity ?? 1,
      order: 6,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.pbr.emissiveIntensity',
      label: 'PBR Emissive Intensity',
      value: material?.pbr?.emissiveIntensity ?? 1,
      order: 7,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.pbr.environmentIntensity',
      label: 'PBR Environment Intensity',
      value: material?.pbr?.environmentIntensity ?? 1,
      order: 8,
      step: 0.05,
    }),
    createMaterialNumberInspectorProperty(nodeKind, {
      path: 'overrides.material.pbr.specularIntensity',
      label: 'PBR Specular Intensity',
      value: material?.pbr?.specularIntensity ?? 1,
      order: 9,
      step: 0.05,
    }),
  ];
}

function createMaterialColorInspectorProperty(
  nodeKind: SceneNodeConfig['kind'],
  path: string,
  label: string,
  value: { r: number; g: number; b: number },
  order: number,
): InspectorProperty<EditorSceneDocument> {
  return createDocumentInspectorProperty(null, nodeKind, {
    path,
    label,
    valueType: 'color',
    control: 'color',
    value,
    commitMode: 'immediate',
    order,
  });
}

function createMaterialNumberInspectorProperty(
  nodeKind: SceneNodeConfig['kind'],
  input: {
    path: string;
    label: string;
    value: number;
    order: number;
    min?: number;
    max?: number;
    step?: number;
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
  });
}

function createMaterialTextureUrlInspectorProperty(
  nodeKind: SceneNodeConfig['kind'],
  input: {
    path: string;
    label: string;
    value: string;
    order: number;
  },
): InspectorProperty<EditorSceneDocument> {
  return createDocumentInspectorProperty(null, nodeKind, {
    path: input.path,
    label: input.label,
    valueType: 'string',
    control: 'string',
    value: input.value,
    commitMode: 'blur',
    order: input.order,
    coerce: (value: unknown) => normalizeEditorSceneInspectorValue(input.path, value),
  });
}

function createMaterialTextureInspectorSummary(material: MaterialOverrideConfig | undefined): string {
  const count = [
    material?.albedoTexture?.url,
    material?.normalTexture?.url,
    material?.metallicTexture?.url,
  ].filter(Boolean).length;
  return count > 0 ? `${count} override${count === 1 ? '' : 's'}` : 'Defaults';
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
): InspectorProperty<EditorSceneDocument> {
  return createEditorSceneReadonlyInspectorProperty({
    path,
    label,
    value,
    order,
    persistence: 'readonly',
    source: 'Document',
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
    const schema = resolveSceneNodeFieldSchema(path, nodeKind);
    if (!schema) return { ok: false, message: `Unsupported scene node field: ${path}.` };
    if (value == null && schema.allowDelete === false) {
      return { ok: false, message: `Scene node field cannot be deleted: ${path}.` };
    }
    if (!schema.validate(value)) return { ok: false, message: `Invalid value for scene node field: ${path}.` };
    if (path === 'instance.assetId' && document && typeof value === 'string' && !document.assets.some((asset) => asset.id === value)) {
      return { ok: false, message: `Asset not found: ${value}.` };
    }
    return { ok: true, value };
  };
}

function validateEditorSceneInspectorValue(
  document: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
  path: string,
  value: unknown,
): InspectorValidationResult {
  return createEditorSceneInspectorValidator(readEditorSceneNodeKind(gameObject), path, document)(value);
}

function normalizeEditorSceneInspectorValue(path: string, value: unknown): unknown {
  if (path === 'groundDecal.textureId' && typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (/^overrides\.material\.(albedoTexture|normalTexture|metallicTexture)\.url$/.test(path) && typeof value === 'string') {
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
  if (isBlockedEditorSceneCameraFieldPatch(document, targetId, path, normalizedValue)) return document;
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
    next.camera = normalizeEditorSceneCameraAfterFieldPatch(next.camera, path);
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
  const segments = path.split('.').filter(Boolean);
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

function cleanupEditorSceneGameObjectOverrides(gameObject: EditorSceneGameObject): void {
  const overrides = gameObject.overrides;
  if (!overrides) return;

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
    name: 'Sun Light',
    kind: 'transform',
    ...(rootId ? { parentId: rootId } : {}),
    active: true,
    transformType: 'light',
    light: mergeEditorSceneLightDefaults(undefined),
    components: [{
      type: 'Transform',
      position: { x: 0, y: 4, z: -3 },
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

function normalizeEditorSceneLightGameObject(gameObject: EditorSceneGameObject): EditorSceneGameObject {
  const next = ensureTransformComponent({
    ...gameObject,
    kind: 'transform',
    transformType: 'light',
    light: mergeEditorSceneLightDefaults(gameObject.light),
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
  const merged: EditorSceneCameraRig = {
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
  return applyEditorSceneCameraLimitDefaults(merged);
}

function applyEditorSceneCameraLimitDefaults(camera: EditorSceneCameraRig): EditorSceneCameraRig {
  const betaLimits = resolveCameraBetaLimitDefaults(camera.beta, camera.lowerBetaLimit, camera.upperBetaLimit);
  const radiusLimits = resolveCameraRadiusLimitDefaults(camera.radius, camera.lowerRadiusLimit, camera.upperRadiusLimit);
  return {
    ...camera,
    lowerBetaLimit: betaLimits.lower,
    upperBetaLimit: betaLimits.upper,
    lowerRadiusLimit: radiusLimits.lower,
    upperRadiusLimit: radiusLimits.upper,
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

function readEditorSceneCameraProjection(value: unknown): SceneCameraProjection {
  return value === 'perspective' ? 'perspective' : 'orthographic';
}

function readEditorSceneCameraInspectorLanguage(value: unknown): EditorSceneCameraInspectorLanguage {
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

function mergeEditorSceneLightDefaults(
  light: EditorSceneGameObject['light'],
): EditorSceneDirectionalLight {
  const defaults = DEFAULT_EDITOR_SCENE_SUN_LIGHT;
  return {
    ...defaults,
    ...(light ?? {}),
    type: 'directional',
    direction: {
      ...defaults.direction,
      ...(light?.direction ?? {}),
    },
    diffuseColor: light?.diffuseColor
      ? { ...defaults.diffuseColor, ...light.diffuseColor }
      : defaults.diffuseColor,
  };
}

function shallowEditorSceneGameObjectsEqual(
  left: EditorSceneGameObject,
  right: EditorSceneGameObject,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isBlockedEditorSceneCameraFieldPatch(
  document: EditorSceneDocument,
  targetId: string,
  path: string,
  value: unknown,
): boolean {
  const target = findEditorSceneGameObject(document, targetId);
  if (!target) return false;
  const targetIsCamera = isEditorSceneCameraGameObject(target);
  if (path.startsWith('camera.') && !targetIsCamera) return true;
  if (path.startsWith('camera.') && targetIsCamera) {
    const patchedCameraHost = { camera: mergeEditorSceneCameraDefaults(target.camera) };
    applyJsonFieldPatch(patchedCameraHost as unknown as Record<string, unknown>, path, value);
    patchedCameraHost.camera = normalizeEditorSceneCameraAfterFieldPatch(patchedCameraHost.camera, path);
    if (hasInvalidEditorSceneCameraRelationships(patchedCameraHost.camera)) return true;
  }
  if (path.startsWith('light.') && !isEditorSceneLightGameObject(target)) return true;
  if (path === 'transformType') {
    if (targetIsCamera && value !== 'camera') return true;
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
    const displayTransform = rootTransform ? EDITOR_SCENE_ROOT_TRANSFORM : transform;
    for (const vectorName of ['position', 'rotation', 'scale'] as const) {
      for (const axis of ['x', 'y', 'z'] as const) {
        descriptors.push({
          path: `transform.${vectorName}.${axis}`,
          label: `${vectorName}.${axis}`,
          valueType: 'number',
          readOnly: rootTransform,
          getValue: () => {
            const value = readTransformVector(displayTransform, vectorName)[axis];
            return vectorName === 'rotation' ? roundForInspector(radiansToDegrees(value)) : value;
          },
          ...(rootTransform
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
