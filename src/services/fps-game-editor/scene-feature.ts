/**
 * pa_template scene feature configuration.
 * Standard session, hierarchy, Inspector, marker, material, prefab, and
 * rendering-profile assembly is owned by @fps-games/editor/playable-sdk.
 */
import {
  compileEditorSceneDocumentToSceneConfig as compileSdkEditorSceneDocumentToSceneConfig,
  createEditorSceneAssetLibrary as createPlayableEditorSceneAssetLibrary,
  enrichEditorSceneDocumentAssets as enrichPlayableEditorSceneDocumentAssets,
  mergeEditorSceneAssetWithLibraryItem as mergePlayableEditorSceneAssetWithLibraryItem,
  PLAYABLE_EDITOR_SCENE_COMPILER_ID,
  PLAYABLE_EDITOR_SCENE_COMPILER_VERSION,
  createFpsGameEditorProductRenderingRuntime,
  createFpsGameEditorSceneSourceServices,
  createFpsGameEditorStandardSceneAssembly,
  createFpsGameEditorStandardAssetActionPatch,
  migrateEditorSceneMarkerGraphMarkersToGameObjects,
  syncEditorSceneMarkerGraph,
  type SpatialMarkerTypeDefinition,
  type SpatialRelationTypeDefinition,
  type EditorSceneAssetCatalogEntry as PlayableEditorSceneAssetCatalogEntry,
} from '@fps-games/editor/playable-sdk';
import { editorConfig } from '../../../fps.config';
import baseSceneConfig from '../../config/scene.json';
import renderingConfig from '../../config/rendering.json';
import { configService } from '../../config/ConfigService';
import type { AssetExternalRef, GroundDecalUiKind, SceneConfig } from '../../config';
import {
  addGroundDecalUiDeliveryPair,
  createDefaultGroundDecalUiConfig,
  isGroundDecalUiConfig,
  removeGroundDecalUiDeliveryPair,
} from './ground-decal-authored';
import { PA_TEMPLATE_GROUND_DECAL_LAYER_PAIR_ACTIONS, paTemplateGroundDecalFeatureConfig } from './ground-decal-config';
import type {
  EditorSceneDocumentPatch,
  EditorSceneAsset,
  EditorSceneAssetLibraryItem,
  EditorSceneDocument,
  EditorSceneGameObject,
} from './scene-types';
import { getEditorSceneRenderingProfile, setEditorSceneRenderingProfileReader } from './scene-types';
import { EDITOR_SCENE_FIELD_SCHEMA, isEditorSceneFiniteNumber, type EditorSceneFieldSchemaEntry } from '@fps-games/editor/playable-sdk';

export interface EditorSceneInspectorTextureAsset {
  id: string;
  label: string;
  url: string;
  meta?: string;
}

export interface EditorSceneInspectorContext {
  textureAssets?: readonly EditorSceneInspectorTextureAsset[];
}

const markerTypes: SpatialMarkerTypeDefinition[] = [
  { type: 'collection-area', label: 'Collection Area', kind: 'region', description: 'A gameplay region that can own or contain collectible objects.' },
  { type: 'trade-zone', label: 'Trade Zone', kind: 'region', description: 'A gameplay region used for trading interactions.' },
  { type: 'entrance', label: 'Entrance', kind: 'point', description: 'A semantic entry marker for a region or object.' },
  { type: 'exit', label: 'Exit', kind: 'point', description: 'A semantic exit marker for a region or object.' },
  { type: 'effect-socket', label: 'Effect Socket', kind: 'anchor', description: 'A semantic attachment point for visual effects.' },
];

const relationTypes: SpatialRelationTypeDefinition[] = [
  { type: 'contains', label: 'Contains', directed: true },
  { type: 'belongs-to', label: 'Belongs To', directed: true },
  { type: 'entrance-of', label: 'Entrance Of', directed: true },
  { type: 'exit-of', label: 'Exit Of', directed: true },
  { type: 'attached-to', label: 'Attached To', directed: true },
  { type: 'near', label: 'Near', directed: false },
  { type: 'faces', label: 'Faces', directed: true },
];

let currentRenderingTextures: any[] = [];

let sceneAssembly: ReturnType<typeof createFpsGameEditorStandardSceneAssembly<
  EditorSceneDocument,
  EditorSceneGameObject,
  EditorSceneDocumentPatch,
  EditorSceneAssetLibraryItem,
  EditorSceneAsset,
  EditorSceneInspectorContext
>>;

sceneAssembly = createFpsGameEditorStandardSceneAssembly<
  EditorSceneDocument,
  EditorSceneGameObject,
  EditorSceneDocumentPatch,
  EditorSceneAssetLibraryItem,
  EditorSceneAsset,
  EditorSceneInspectorContext
>({
  markerTypes,
  relationTypes,
  features: editorConfig.features,
  formatMarkerTypeLabel(type, fallback) {
    return ({ 'collection-area': '采集区域', 'trade-zone': '交易区', entrance: '入口', exit: '出口', 'effect-socket': '特效挂点' } as Record<string, string>)[type] ?? fallback;
  },
  getRenderingProfile: getEditorSceneRenderingProfile,
  resolveFieldSchema: resolveProjectFieldSchema,
  createPatch: {
    gameObjectField: (targetId, path, value) => ({ kind: 'game-object.field', targetId, path, value }),
    gameObjectFieldBatch: fields => ({ kind: 'game-object.field-batch', fields }),
    materialAssetField: (materialAssetId, path, value) => ({ kind: 'scene.material-asset.field', materialAssetId, path, value }),
    markerGraph: command => ({ kind: 'scene.marker-graph', command }),
  },
  clearFeatureStateFromSystemObject(next, original) {
    if (!('groundDecal' in next)) return next;
    const cleaned = { ...next };
    delete cleaned.groundDecal;
    return JSON.stringify(cleaned) === JSON.stringify(original) ? original : cleaned;
  },
});

export const renderingRuntime = createFpsGameEditorProductRenderingRuntime<EditorSceneDocument, EditorSceneDocumentPatch>({
  initialConfig: renderingConfig,
  initialStaticShadowArtifact: configService.getStaticShadowArtifact(),
  getTextureAssets: () => currentRenderingTextures,
  getGameObjects: document => document.scene.gameObjects,
  createAlphaIndexMigrationPatch: input => ({ kind: 'game-object.rendering-alpha-index-migration', ...input }),
  directionalLightNodeId: 'sun_light',
  isDirectionalLightEnabled: document => document.scene.gameObjects.find(entry => entry.id === 'sun_light')?.active !== false,
  resolveLanguage: document => document.scene.gameObjects.find(entry => entry.id === 'sun_light')?.light?.inspectorLanguage === 'en' ? 'en' : 'zh',
});
setEditorSceneRenderingProfileReader(renderingRuntime.getProfile);
export const sceneSource = createFpsGameEditorSceneSourceServices<EditorSceneDocument, SceneConfig, EditorSceneAssetLibraryItem>({
  compilerId: PLAYABLE_EDITOR_SCENE_COMPILER_ID,
  compilerVersion: PLAYABLE_EDITOR_SCENE_COMPILER_VERSION,
  compileRuntimeScene: document => compileEditorSceneDocumentToSceneConfig(document, structuredClone(baseSceneConfig) as SceneConfig).sceneConfig,
  isRuntimeScene: (value): value is SceneConfig => !!value && typeof value === 'object' && (value as SceneConfig).schemaVersion === 2,
  onRuntimeScene: value => configService.replaceSceneConfig(structuredClone(value)),
  renderingDraft: renderingRuntime.profileDraft,
  staticShadowDraft: renderingRuntime.staticShadowDraft,
  castAssets: assets => assets as EditorSceneAssetLibraryItem[],
});
export const loadSceneMainSource = sceneSource.load;
export const saveSceneMainSource = sceneSource.save;
export const setEditorRenderingTextures = (textures: any[]) => { currentRenderingTextures = textures; };

export { sceneAssembly, migrateEditorSceneMarkerGraphMarkersToGameObjects, syncEditorSceneMarkerGraph };
export const createEditorSceneAssetActionPatch = (input: any) => createFpsGameEditorStandardAssetActionPatch(input, createGroundDecalAssetActionPatch);
export const DEFAULT_EDITOR_SCENE_CAMERA = sceneAssembly.defaults.camera;
export const DEFAULT_EDITOR_SCENE_SUN_LIGHT = sceneAssembly.defaults.sunLight;
export const DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT = sceneAssembly.defaults.environmentLight;
export const reduceEditorSceneDocument = sceneAssembly.reduceDocument;
export const ensureEditorSceneEnvironmentDefaults = sceneAssembly.ensureEnvironmentDefaults;
export const isEditorSceneSelectableHierarchyId = sceneAssembly.isSelectableHierarchyId;
export const getEditorSceneHierarchyItems = sceneAssembly.getHierarchyItems;
export const normalizeEditorSceneHierarchyDocument = sceneAssembly.normalizeHierarchyDocument;
export const createEditorSceneRenamePatch = sceneAssembly.createRenamePatch;
export const createEditorSceneCreateGroupPatch = sceneAssembly.createCreateGroupPatch;
export const createEditorSceneCreatePrimitivePatch = sceneAssembly.createCreatePrimitivePatch;
export const createEditorSceneDeleteSubtreePatch = sceneAssembly.createDeleteSubtreePatch;
export const createEditorSceneReparentPatch = sceneAssembly.createReparentPatch;
export const createEditorSceneHierarchyMovePatch = sceneAssembly.createHierarchyMovePatch;
export const createEditorSceneGroupSelectionPatch = sceneAssembly.createGroupSelectionPatch;
export const createEditorSceneDuplicateSelectionPatch = sceneAssembly.createDuplicateSelectionPatch;
export function createEditorScenePlacedAssetPatch(
  input: Record<string, unknown> & { document: EditorSceneDocument; asset?: EditorSceneAssetLibraryItem },
) {
  return sceneAssembly.createPlacedAssetPatch(
    input as Parameters<typeof sceneAssembly.createPlacedAssetPatch>[0],
  );
}
export const validateEditorSceneReparent = sceneAssembly.validateReparent;
export const validateEditorSceneHierarchyMove = sceneAssembly.validateHierarchyMove;
export const validateEditorSceneGroupSelection = sceneAssembly.validateGroupSelection;
export const createEditorSceneGroundDecalUiPatch = (
  document: EditorSceneDocument,
  uiKind: GroundDecalUiKind,
) => sceneAssembly.createFeatureHierarchyPatch(document, `ground-decal:${uiKind}`);
export function createEditorSceneGroundDecalHierarchyActions() {
  return paTemplateGroundDecalFeatureConfig.uiKinds.map((uiKind: string) => ({
    id: `ground-decal-ui.create-${uiKind}`,
    label: uiKind === 'delivery' ? '添加交付类地贴 UI' : '添加操作类地贴 UI',
    placement: 'after-create' as const,
    run: (context: { document: EditorSceneDocument }) => (
      createEditorSceneGroundDecalUiPatch(context.document, uiKind as GroundDecalUiKind) ?? false
    ),
  }));
}
export const createEditorSceneInspectorPropertyPatch = sceneAssembly.createInspectorPropertyPatch;
export const patchEditorSceneGameObjectField = sceneAssembly.patchGameObjectField;
export const patchEditorSceneGameObjectsField = sceneAssembly.patchGameObjectsField;
export const canCreateEditorSceneSerializedMultiPropertyPatch = sceneAssembly.canCreateSerializedMultiPropertyPatch;
export const createEditorSceneSerializedMultiPropertyPatch = sceneAssembly.createSerializedMultiPropertyPatch;
export const createEditorSceneBrowserAssetItems = sceneAssembly.createBrowserAssetItems;
export const getEditorSceneInspectorObject = sceneAssembly.getInspectorObject;
export const getEditorSceneInspectorMultiObject = sceneAssembly.getInspectorMultiObject;
export const getEditorScenePrefabStageInspectorObject = sceneAssembly.getPrefabStageInspectorObject;
export const getEditorSceneRuntimeInspectorSections = sceneAssembly.getRuntimeInspectorSections;
export const getEditorSceneMarkerGraph = sceneAssembly.getMarkerGraph;
export const getEditorSceneMarkerTypeCatalog = sceneAssembly.getMarkerTypeCatalog;
export const getEditorSceneRelationTypeCatalog = sceneAssembly.getRelationTypeCatalog;
export const createEditorSceneMarkerGraphPatch = sceneAssembly.createMarkerGraphPatch;
export const reduceEditorSceneMarkerGraphPatch = sceneAssembly.reduceMarkerGraphPatch;
export const syncEditorSceneMarkerGraphDocument = sceneAssembly.syncMarkerGraphDocument;
export const resolveEditorSceneMarkerKind = sceneAssembly.resolveMarkerKind;
export const assertEditorSceneMaterialAssetIntegrity = sceneAssembly.assertMaterialAssetIntegrity;

export {
  createEditorScenePrefabStageMaterialSlotItems,
  getEditorScenePrefabStageDescriptor,
  getEditorScenePrefabStageProjectionNodeIdForNode,
  getEditorScenePrefabStageProjectionNodes,
  getEditorScenePrefabStageStructure,
  resolveEditorScenePrefabStagePreviewTarget,
} from '@fps-games/editor/playable-sdk';

export {
  bumpEditorSceneAuthoringSourceRevision,
  createEditorSceneAuthoringSourceDescriptor,
  detectEditorSceneRuntimeInputDrift,
  ensureEditorSceneAuthoringSource,
} from '@fps-games/editor/playable-sdk';

export const EDITOR_SCENE_COMPILER_ID = PLAYABLE_EDITOR_SCENE_COMPILER_ID;
export const EDITOR_SCENE_COMPILER_VERSION = PLAYABLE_EDITOR_SCENE_COMPILER_VERSION;

export interface ProjectEditorAssetCatalogEntry extends PlayableEditorSceneAssetCatalogEntry<AssetExternalRef> {
  guid: string;
  assetId: string;
  kind: 'model' | 'prefab' | 'texture' | 'image' | 'sound';
  displayName: string;
  relativePath: string;
  external?: AssetExternalRef;
}

export const createProjectEditorAssetLibrary = (catalogEntries: ProjectEditorAssetCatalogEntry[]): EditorSceneAssetLibraryItem[] => (
  createPlayableEditorSceneAssetLibrary(catalogEntries) as EditorSceneAssetLibraryItem[]
);

export const enrichEditorSceneDocumentAssets = (
  document: EditorSceneDocument,
  assets: EditorSceneAssetLibraryItem[],
): EditorSceneDocument => enrichPlayableEditorSceneDocumentAssets(document, assets) as EditorSceneDocument;

export const mergeEditorSceneAssetWithLibraryItem = (
  asset: EditorSceneAsset,
  libraryItem: EditorSceneAssetLibraryItem,
): EditorSceneAsset => mergePlayableEditorSceneAssetWithLibraryItem(asset, libraryItem) as EditorSceneAsset;

export function compileEditorSceneDocumentToSceneConfig(
  document: EditorSceneDocument,
  baseSceneConfig: SceneConfig,
) {
  return compileSdkEditorSceneDocumentToSceneConfig(
    syncEditorSceneMarkerGraphDocument(document),
    baseSceneConfig,
    {
      readCustomTransformRuntimeData: gameObject => isGroundDecalUiConfig(gameObject.groundDecal)
        ? { groundDecal: structuredClone(gameObject.groundDecal) }
        : null,
    },
  );
}

function isGroundDecalObject(gameObject: EditorSceneGameObject): gameObject is EditorSceneGameObject & { groundDecal: ReturnType<typeof createDefaultGroundDecalUiConfig> } {
  return gameObject.transformType === 'groundDecal' && isGroundDecalUiConfig(gameObject.groundDecal);
}

function createGroundDecalAssetActionPatch(input: any) {
  const actions = PA_TEMPLATE_GROUND_DECAL_LAYER_PAIR_ACTIONS;
  if ((input.actionId !== actions.addActionId && input.actionId !== actions.removeActionId) || !input.activeId) return null;
  const object = input.document.scene.gameObjects.find((entry: EditorSceneGameObject) => entry.id === input.activeId);
  if (!object || !isGroundDecalObject(object) || object.groundDecal.uiKind !== 'delivery') return null;
  const next = input.actionId === actions.addActionId ? addGroundDecalUiDeliveryPair(object.groundDecal) : removeGroundDecalUiDeliveryPair(object.groundDecal);
  return next ? { label: `${input.actionId === actions.addActionId ? 'Add' : 'Remove'} delivery UI pair on ${object.name ?? object.id}`, patch: { kind: 'game-object.ground-decal-ui.replace', targetId: object.id, groundDecal: next }, changedId: object.id, changedIds: [object.id], reprojectIds: [object.id] } : null;
}

function resolveProjectFieldSchema(path: string, nodeKind: string): EditorSceneFieldSchemaEntry | null {
  if (path === 'groundDecal.size') return { path, appliesTo: ['transform'], validate: value => value == null || (!!value && typeof value === 'object') };
  if (path === 'groundDecal.size.width' || path === 'groundDecal.size.depth') return { path, appliesTo: ['transform'], allowDelete: false, validate: value => isEditorSceneFiniteNumber(value) && value > 0 };
  return EDITOR_SCENE_FIELD_SCHEMA.find(entry => entry.path === path && entry.appliesTo.includes(nodeKind as any)) ?? null;
}
