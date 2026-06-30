import type {
  AssetExternalRef,
  ColorRGB,
  SceneAssetDefaults,
  SceneAssetMaterialMode,
  SceneCameraRigConfig,
  SceneDirectionalLightConfig,
  SceneHemisphericLightConfig,
  SceneMaterialAssetConfig,
  SceneNodeConfig,
  ScenePrimitiveShape,
  SceneNodeVisualOverrides,
  SceneTransformNode,
} from '../config';
import {
  cloneEditorSceneDocument as clonePlayableEditorSceneDocument,
  findEditorSceneModelRenderer as findPlayableEditorSceneModelRenderer,
  findEditorSceneTransform as findPlayableEditorSceneTransform,
  isEditorSceneTrsTransformComponent,
  readEditorSceneNodeKind as readPlayableEditorSceneNodeKind,
  type EditorSceneAsset as PlayableEditorSceneAsset,
  type EditorSceneAssetLibraryItem as PlayableEditorSceneAssetLibraryItem,
  type EditorSceneCameraInspectorLanguage,
  type EditorSceneCameraRig as PlayableEditorSceneCameraRig,
  type EditorSceneComponent as PlayableEditorSceneComponent,
  type EditorSceneDirectionalLight as PlayableEditorSceneDirectionalLight,
  type EditorSceneDocument as PlayableEditorSceneDocument,
  type EditorSceneGameObject as PlayableEditorSceneGameObject,
  type EditorSceneModelRendererComponent as PlayableEditorSceneModelRendererComponent,
  type EditorScenePrefabDefinition,
  type EditorScenePrimitiveRenderer as PlayableEditorScenePrimitiveRenderer,
  type EditorSceneTransformComponent as PlayableEditorSceneTransformComponent,
  type EditorSceneVec3 as PlayableEditorSceneVec3,
  type AuthoringSourceRef,
  type SpatialMarkerGraph,
  type SpatialMarkerJsonObject,
  type SpatialMarkerLocalFrame,
  type SpatialMarkerTargetRef,
} from '@fps-games/editor/playable-sdk';

export { isEditorSceneTrsTransformComponent };

export type { EditorSceneCameraInspectorLanguage };

export interface EditorSceneVec3 extends PlayableEditorSceneVec3 {}

export interface EditorSceneAsset extends PlayableEditorSceneAsset<
  SceneAssetDefaults,
  AssetExternalRef,
  SceneAssetMaterialMode
> {
  type: 'glb' | 'prefab' | 'texture';
  materialMode?: SceneAssetMaterialMode;
  defaults?: SceneAssetDefaults;
  prefab?: EditorScenePrefabDefinition;
  external?: AssetExternalRef;
}

export interface EditorSceneAssetLibraryItem extends PlayableEditorSceneAssetLibraryItem<
  SceneAssetDefaults,
  AssetExternalRef,
  SceneAssetMaterialMode
> {
  type: 'glb' | 'prefab' | 'texture';
  kind: 'model' | 'prefab' | 'texture';
  materialMode?: SceneAssetMaterialMode;
  defaults?: SceneAssetDefaults;
  prefab?: EditorScenePrefabDefinition;
  external?: AssetExternalRef;
  origin: 'project';
}

export type EditorSceneTransformComponent = PlayableEditorSceneTransformComponent;

export type EditorSceneModelRendererComponent = PlayableEditorSceneModelRendererComponent;

export interface EditorScenePrimitiveRenderer extends PlayableEditorScenePrimitiveRenderer<ScenePrimitiveShape> {
  shape: ScenePrimitiveShape;
}

export interface EditorSceneMarkerBoxGeometry {
  kind: 'box';
}

export interface EditorSceneMarkerPointGeometry {
  kind: 'point';
  coordinateSpace?: 'world' | 'local';
  position?: EditorSceneVec3;
  offset?: EditorSceneVec3;
  target?: SpatialMarkerTargetRef;
}

export interface EditorSceneMarkerObjectBoundsGeometry {
  kind: 'object-bounds';
  target: SpatialMarkerTargetRef;
}

export interface EditorSceneMarkerPolyhedronGeometry {
  kind: 'polyhedron';
  coordinateSpace?: 'world';
  vertices: EditorSceneVec3[];
  faces?: number[][];
}

export type EditorSceneMarkerGeometry =
  | EditorSceneMarkerBoxGeometry
  | EditorSceneMarkerPointGeometry
  | EditorSceneMarkerObjectBoundsGeometry
  | EditorSceneMarkerPolyhedronGeometry;

export interface EditorSceneMarkerConfig {
  schemaVersion: 1;
  type: string;
  kind?: string;
  tags?: string[];
  note?: string;
  color?: ColorRGB;
  target?: SpatialMarkerTargetRef;
  semanticFrame?: SpatialMarkerLocalFrame;
  geometry: EditorSceneMarkerGeometry;
  metadata?: SpatialMarkerJsonObject;
}

export type EditorSceneLightInspectorLanguage = 'zh' | 'en';

export interface EditorSceneCameraRig extends SceneCameraRigConfig, PlayableEditorSceneCameraRig {}

export interface EditorSceneDirectionalLight extends
  Omit<SceneDirectionalLightConfig, 'direction' | 'diffuseColor'>,
  PlayableEditorSceneDirectionalLight {
  direction: EditorSceneVec3;
  diffuseColor?: ColorRGB;
  inspectorLanguage?: EditorSceneLightInspectorLanguage;
}

export interface EditorSceneHemisphericLight extends Omit<SceneHemisphericLightConfig, 'diffuseColor' | 'groundColor'> {
  diffuseColor?: ColorRGB;
  groundColor?: ColorRGB;
  inspectorLanguage?: EditorSceneLightInspectorLanguage;
}

export type EditorSceneLight =
  | EditorSceneHemisphericLight
  | EditorSceneDirectionalLight;

export type EditorSceneComponent =
  | EditorSceneTransformComponent
  | EditorSceneModelRendererComponent
  | PlayableEditorSceneComponent;

export interface EditorSceneGameObject extends PlayableEditorSceneGameObject<ScenePrimitiveShape> {
  kind?: SceneNodeConfig['kind'];
  transformType?: SceneTransformNode['transformType'];
  camera?: EditorSceneCameraRig;
  light?: EditorSceneLight;
  primitive?: EditorScenePrimitiveRenderer;
  marker?: EditorSceneMarkerConfig;
  groundDecal?: SceneTransformNode['groundDecal'];
  overrides?: SceneNodeVisualOverrides;
  components: EditorSceneComponent[];
}

export interface EditorSceneDocument extends PlayableEditorSceneDocument<
  EditorSceneGameObject,
  EditorSceneAsset
> {
  meta?: {
    name?: string;
    authoringSource?: AuthoringSourceRef;
    [key: string]: unknown;
  };
  assets: EditorSceneAsset[];
  scene: {
    gameObjects: EditorSceneGameObject[];
    markerGraph?: SpatialMarkerGraph;
    materialAssets?: SceneMaterialAssetConfig[];
  };
}

export interface EditorSceneTransformPatch {
  position?: EditorSceneVec3;
  rotation?: EditorSceneVec3;
  scale?: EditorSceneVec3;
}

export function cloneEditorSceneDocument(document: EditorSceneDocument): EditorSceneDocument {
  return clonePlayableEditorSceneDocument(document);
}

export function findEditorSceneTransform(
  gameObject: EditorSceneGameObject,
): EditorSceneTransformComponent | null {
  return findPlayableEditorSceneTransform(gameObject) as EditorSceneTransformComponent | null;
}

export function findEditorSceneModelRenderer(
  gameObject: EditorSceneGameObject,
): EditorSceneModelRendererComponent | null {
  return findPlayableEditorSceneModelRenderer(gameObject) as EditorSceneModelRendererComponent | null;
}

export function findEditorScenePrimitiveRenderer(
  gameObject: EditorSceneGameObject,
): EditorScenePrimitiveRenderer | null {
  return gameObject.primitive ?? null;
}

export function readEditorSceneNodeKind(gameObject: EditorSceneGameObject): SceneNodeConfig['kind'] {
  return readPlayableEditorSceneNodeKind(gameObject) as SceneNodeConfig['kind'];
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
            const transformComponent = component as EditorSceneTransformComponent;
            if (!isEditorSceneTrsTransformComponent(transformComponent)) return component;
            return {
              ...transformComponent,
              position: patch.position ?? transformComponent.position,
              rotation: patch.rotation ?? transformComponent.rotation,
              scale: patch.scale ?? transformComponent.scale,
            };
          }),
        };
      }),
    },
  };
}
