import renderingConfig from '../../config/rendering.json';
import type { AssetExternalRef, ColorRGB, GroundDecalUiConfig, SceneAssetDefaults, SceneAssetMaterialMode, SceneCameraRigConfig, SceneDirectionalLightConfig, SceneHemisphericLightConfig, SceneMaterialAssetConfig, SceneNodeConfig, SceneNodeVisualOverrides, ScenePrimitiveShape, SceneTransformNode } from '../../config';
import {
  cloneEditorSceneDocument as cloneDocument,
  findEditorSceneModelRenderer as findModelRenderer,
  findEditorSceneTransform as findTransform,
  normalizeEditorSceneRenderingProfile,
  patchEditorSceneGameObjectTransform as patchTransform,
  readEditorSceneNodeKind as readNodeKind,
  type AuthoringSourceRef,
  type EditorSceneAsset as SdkAsset,
  type EditorSceneAssetLibraryItem as SdkAssetItem,
  type EditorSceneCameraRig as SdkCamera,
  type EditorSceneComponent,
  type EditorSceneDocument as SdkDocument,
  type EditorSceneGameObject as SdkObject,
  type EditorSceneLightInspectorLanguage,
  type EditorSceneMarkerConfig,
  type EditorSceneModelRendererComponent,
  type EditorScenePrefabDefinition,
  type EditorScenePrimitiveRenderer,
  type EditorSceneTransformComponent,
  type EditorSceneVec3,
  type PlayableEditorSceneDocumentPatch,
  type PlayableLocalEditorMarkerGraphCommand,
  type SpatialMarkerGraph,
} from '@fps-games/editor/playable-sdk';

export type { EditorSceneLightInspectorLanguage, EditorSceneMarkerConfig, EditorSceneModelRendererComponent, EditorSceneTransformComponent, EditorSceneVec3 };
export interface EditorSceneAsset extends SdkAsset<SceneAssetDefaults, AssetExternalRef, SceneAssetMaterialMode> { type: 'glb' | 'prefab' | 'texture'; prefab?: EditorScenePrefabDefinition; }
export interface EditorSceneAssetLibraryItem extends SdkAssetItem<SceneAssetDefaults, AssetExternalRef, SceneAssetMaterialMode> { type: 'glb' | 'prefab' | 'texture'; kind: 'model' | 'prefab' | 'texture'; origin: 'project'; prefab?: EditorScenePrefabDefinition; }
export type EditorSceneLight = (Omit<SceneDirectionalLightConfig, 'direction' | 'diffuseColor'> & { type: 'directional'; direction: EditorSceneVec3; diffuseColor?: ColorRGB; inspectorLanguage?: EditorSceneLightInspectorLanguage }) | (Omit<SceneHemisphericLightConfig, 'diffuseColor' | 'groundColor'> & { type: 'hemispheric'; diffuseColor?: ColorRGB; groundColor?: ColorRGB; inspectorLanguage?: EditorSceneLightInspectorLanguage });
export interface EditorSceneGameObject extends SdkObject<ScenePrimitiveShape> { kind?: SceneNodeConfig['kind']; transformType?: SceneTransformNode['transformType']; camera?: SceneCameraRigConfig & SdkCamera; light?: EditorSceneLight; primitive?: EditorScenePrimitiveRenderer<ScenePrimitiveShape>; marker?: EditorSceneMarkerConfig; groundDecal?: SceneTransformNode['groundDecal']; overrides?: SceneNodeVisualOverrides; components: EditorSceneComponent[]; }
export interface EditorSceneDocument extends SdkDocument<EditorSceneGameObject, EditorSceneAsset> { meta?: { name?: string; authoringSource?: AuthoringSourceRef; [key: string]: unknown }; assets: EditorSceneAsset[]; scene: { gameObjects: EditorSceneGameObject[]; markerGraph?: SpatialMarkerGraph; materialAssets?: SceneMaterialAssetConfig[] } }
export type EditorSceneGroundDecalPatch = { kind: 'game-object.ground-decal-ui.replace'; targetId: string; groundDecal: GroundDecalUiConfig };
export type EditorSceneDocumentPatch = PlayableEditorSceneDocumentPatch<EditorSceneAsset, EditorSceneGameObject, SceneMaterialAssetConfig, EditorSceneAssetLibraryItem, PlayableLocalEditorMarkerGraphCommand, EditorSceneGroundDecalPatch | { kind: 'game-object.field-batch'; fields: Array<{ targetId: string; path: string; value: unknown }> }>;

export const cloneEditorSceneDocument = cloneDocument as (document: EditorSceneDocument) => EditorSceneDocument;
export const findEditorSceneTransform = findTransform as (object: EditorSceneGameObject) => EditorSceneTransformComponent | null;
export const findEditorSceneModelRenderer = findModelRenderer as (object: EditorSceneGameObject) => EditorSceneModelRendererComponent | null;
export const readEditorSceneNodeKind = readNodeKind as (object: EditorSceneGameObject) => SceneNodeConfig['kind'];
export const patchEditorSceneGameObjectTransform = patchTransform as (document: EditorSceneDocument, id: string, patch: { position?: EditorSceneVec3; rotation?: EditorSceneVec3; scale?: EditorSceneVec3 }) => EditorSceneDocument;
let renderingProfileReader = () => normalizeEditorSceneRenderingProfile(renderingConfig);
export const getEditorSceneRenderingProfile = () => renderingProfileReader();
export const setEditorSceneRenderingProfileReader = (reader: () => ReturnType<typeof normalizeEditorSceneRenderingProfile>) => { renderingProfileReader = reader; };
