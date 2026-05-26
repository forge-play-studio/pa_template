import type {
  AssetExternalRef,
  ColorRGB,
  SceneAssetDefaults,
  SceneAssetMaterialMode,
  SceneCameraRigConfig,
  SceneDirectionalLightConfig,
  SceneNodeConfig,
  ScenePrimitiveShape,
  SceneNodeVisualOverrides,
  SceneTransformNode,
} from '../config';
import type { AuthoringSourceRef } from '@fps-games/editor-core';

export interface EditorSceneVec3 {
  x: number;
  y: number;
  z: number;
}

export interface EditorSceneAsset {
  id: string;
  guid?: string;
  type: 'glb';
  displayName?: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  defaults?: SceneAssetDefaults;
  external?: AssetExternalRef;
  metadata?: Record<string, unknown>;
}

export interface EditorSceneAssetLibraryItem {
  id: string;
  guid?: string;
  assetId: string;
  type: 'glb' | 'texture';
  kind: 'model' | 'texture';
  displayName: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  defaults?: SceneAssetDefaults;
  external?: AssetExternalRef;
  metadata?: Record<string, unknown>;
  origin: 'project';
  dedupeKey: string;
  placeable: boolean;
}

export interface EditorSceneTransformComponent {
  type: 'Transform';
  position: EditorSceneVec3;
  rotation: EditorSceneVec3;
  scale?: EditorSceneVec3;
}

export interface EditorSceneModelRendererComponent {
  type: 'ModelRenderer';
  assetId: string;
}

export interface EditorScenePrimitiveRenderer {
  shape: ScenePrimitiveShape;
}

export type EditorSceneCameraRig = SceneCameraRigConfig;

export interface EditorSceneDirectionalLight extends Omit<SceneDirectionalLightConfig, 'direction' | 'diffuseColor'> {
  direction: EditorSceneVec3;
  diffuseColor?: ColorRGB;
}

export type EditorSceneComponent =
  | EditorSceneTransformComponent
  | EditorSceneModelRendererComponent;

export interface EditorSceneGameObject {
  id: string;
  name?: string;
  kind?: SceneNodeConfig['kind'];
  parentId?: string;
  active?: boolean;
  transformType?: SceneTransformNode['transformType'];
  camera?: EditorSceneCameraRig;
  light?: EditorSceneDirectionalLight;
  primitive?: EditorScenePrimitiveRenderer;
  groundDecal?: SceneTransformNode['groundDecal'];
  overrides?: SceneNodeVisualOverrides;
  metadata?: Record<string, unknown>;
  components: EditorSceneComponent[];
}

export interface EditorSceneDocument {
  schemaVersion: 1;
  meta?: {
    name?: string;
    authoringSource?: AuthoringSourceRef;
    [key: string]: unknown;
  };
  assets: EditorSceneAsset[];
  scene: {
    gameObjects: EditorSceneGameObject[];
  };
}

export interface EditorSceneTransformPatch {
  position?: EditorSceneVec3;
  rotation?: EditorSceneVec3;
  scale?: EditorSceneVec3;
}

export function cloneEditorSceneDocument(document: EditorSceneDocument): EditorSceneDocument {
  return structuredClone(document);
}

export function findEditorSceneTransform(
  gameObject: EditorSceneGameObject,
): EditorSceneTransformComponent | null {
  return gameObject.components.find(
    (component): component is EditorSceneTransformComponent => component.type === 'Transform',
  ) ?? null;
}

export function findEditorSceneModelRenderer(
  gameObject: EditorSceneGameObject,
): EditorSceneModelRendererComponent | null {
  return gameObject.components.find(
    (component): component is EditorSceneModelRendererComponent => component.type === 'ModelRenderer',
  ) ?? null;
}

export function findEditorScenePrimitiveRenderer(
  gameObject: EditorSceneGameObject,
): EditorScenePrimitiveRenderer | null {
  return gameObject.primitive ?? null;
}

export function readEditorSceneNodeKind(gameObject: EditorSceneGameObject): SceneNodeConfig['kind'] {
  if (gameObject.kind === 'group' || gameObject.kind === 'instance' || gameObject.kind === 'transform' || gameObject.kind === 'primitive') {
    return gameObject.kind;
  }
  if (findEditorScenePrimitiveRenderer(gameObject)) return 'primitive';
  if (findEditorSceneModelRenderer(gameObject)) return 'instance';
  if (gameObject.transformType || gameObject.groundDecal) return 'transform';
  return 'group';
}

export function patchEditorSceneGameObjectTransform(
  document: EditorSceneDocument,
  gameObjectId: string,
  patch: EditorSceneTransformPatch,
): EditorSceneDocument {
  return {
    ...document,
    scene: {
      ...document.scene,
      gameObjects: document.scene.gameObjects.map((gameObject) => {
        if (gameObject.id !== gameObjectId) return gameObject;
        return {
          ...gameObject,
          components: gameObject.components.map((component) => {
            if (component.type !== 'Transform') return component;
            return {
              ...component,
              position: patch.position ?? component.position,
              rotation: patch.rotation ?? component.rotation,
              scale: patch.scale ?? component.scale,
            };
          }),
        };
      }),
    },
  };
}
