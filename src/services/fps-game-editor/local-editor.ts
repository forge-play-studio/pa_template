import {
  createFpsGameEditorPlayableProjectHostAssembly,
  createFpsGameEditorProductProjectHostServices,
  createFpsGameEditorProductProjectionPreview,
  readFpsGameEditorPlatformAssetLookup,
  mountFpsGameEditorProductLocalEditorFromEnvironmentModule,
  type FpsGameEditorLocalEditorEntryMountOptions,
  type FpsGameEditorProductLocalEditorModeSwitcher,
} from '@fps-games/editor/playable-sdk';
import * as editorPluginModule from 'virtual:fps-plugins/editor';
import * as editorAssets from '../../assets';
import type { GroundDecalUiConfig } from '../../config';
import { createGroundDecalUiDynamicTexture, isGroundDecalUiConfig } from '../GroundDecalUiService';
import { editorConfig } from '../../../fps.config';
import {
  findEditorSceneModelRenderer,
  type EditorSceneAssetLibraryItem,
  EditorSceneDocumentPatch,
  type EditorSceneDocument,
  type EditorSceneGameObject,
} from './scene-types';
import {
  createEditorSceneAssetActionPatch,
  createEditorSceneGroundDecalHierarchyOperations,
  normalizeEditorSceneHierarchyDocument,
  sceneAssembly,
  sceneSource,
  renderingRuntime,
  setEditorRenderingTextures,
  enrichEditorSceneDocumentAssets,
} from './scene-feature';

const projectionPreview = createFpsGameEditorProductProjectionPreview<EditorSceneDocument, EditorSceneGameObject, EditorSceneAssetLibraryItem, GroundDecalUiConfig>({
  assetsModule: editorAssets,
  defaultCamera: sceneAssembly.defaults.camera,
  gridName: 'pa-template-editor-grid',
  primitiveSourceMeshNamePrefix: '__pa_template_editor_primitive_source',
  statsTargetKey: '__localEditorProjectionImportStats',
  resolveModelPathAndFile: editorAssets.getModelPathAndFileAsync,
  async loadBabylonSceneLoader() { await import('@babylonjs/loaders/glTF'); return import('@babylonjs/core/Loading/sceneLoader'); },
  groundDecal: {
    isGroundDecalConfig: isGroundDecalUiConfig,
    createDynamicTexture: createGroundDecalUiDynamicTexture as never,
    readSize: decal => decal.size,
    readRendering: decal => decal.rendering,
  },
});

let currentEditorAssetLibrary: EditorSceneAssetLibraryItem[] = [];
const hostServices = createFpsGameEditorProductProjectHostServices<EditorSceneDocument, EditorSceneGameObject, EditorSceneAssetLibraryItem>({
  domainPrefix: 'pa-template', sceneSource, enrichDocument: enrichEditorSceneDocumentAssets,
  findObject: (document, id) => document.scene.gameObjects.find(entry => entry.id === id) ?? null,
  findObjects: (document, ids) => { const selected = new Set(ids); return document.scene.gameObjects.filter(entry => selected.has(entry.id)); },
  readNodeKind: object => object.kind ?? 'transform',
  findAsset: (_document, object) => { const id = findEditorSceneModelRenderer(object)?.assetId ?? (object as any).instance?.assetId; return currentEditorAssetLibrary.find(asset => asset.id === id || asset.assetId === id) ?? null; },
  hasModelRenderer: object => !!findEditorSceneModelRenderer(object),
  resolveDomainRole: object => object.groundDecal ? 'ground-decal' : null,
  findExistingAsset: async payload => { const lookup = readFpsGameEditorPlatformAssetLookup(payload); const match = editorAssets.getAssetCatalogEntries({ kind: lookup.kind }).find(entry => lookup.projectAssetId === entry.assetId || lookup.platformAssetId === entry.external?.platformAssetId || lookup.assetPath === entry.external?.assetPath); return match ? { guid: match.guid, assetId: match.assetId, external: match.external } : null; },
});
export const describeEditorSceneAgentObject = (document: EditorSceneDocument, objectId: string) => hostServices.agentContext.describeSceneObject({ document, objectId });
export const describeEditorSceneAgentObjectSet = (document: EditorSceneDocument, objectIds: string[]) => hostServices.agentContext.describeSceneObjectSet({ document, objectIds });

export function mountLocalEditorModeSwitcher(
  options: FpsGameEditorLocalEditorEntryMountOptions & { root?: HTMLElement },
): Promise<FpsGameEditorProductLocalEditorModeSwitcher<EditorSceneDocument>> {
  const hostAssembly = createFpsGameEditorPlayableProjectHostAssembly({
    scene: sceneAssembly,
    projection: projectionPreview,
    sceneSource,
    rendering: { ...renderingRuntime, setTextures: setEditorRenderingTextures },
    projectServices: hostServices,
    prepareDocument: (document: EditorSceneDocument, assets: EditorSceneAssetLibraryItem[]) => { currentEditorAssetLibrary = assets; return preparePaTemplateEditorDocument(document, assets); },
    createAssetActionPatch: (input: any) => createEditorSceneAssetActionPatch(input),
    hierarchyOperations: createEditorSceneGroundDecalHierarchyOperations(),
    runtimeWindow: window,
    gameModeEntryVisible: false,
    loadBabylon: () => import('@babylonjs/core'),
    world: { cameraTarget: { x: 0, y: 0.6, z: 0 }, cameraRadius: 12, clearColor: { r: 0.055, g: 0.07, b: 0.09, a: 1 }, useRightHandedSystem: true, selectionEdgesPrewarm: 'lazy' },
    reportError: (error: unknown) => console.error('[LocalEditorModeSwitcher] Forge Play mode change failed', error),
  });

  return mountFpsGameEditorProductLocalEditorFromEnvironmentModule<
    EditorSceneDocument,
    EditorSceneDocumentPatch,
    EditorSceneAssetLibraryItem
  >({
    project: editorConfig,
    root: options.root,
    window,
    projectMode: options.projectMode,
    getCanvas: options.getCanvas,
    agentBridgeSessionMetadata: __FPS_EDITOR_AGENT_SESSION_METADATA__,
    pluginModule: editorPluginModule,
    reportPluginDiagnostic(diagnostic) {
      const method = diagnostic.severity === 'error' ? 'error' : diagnostic.severity === 'warning' ? 'warn' : 'info';
      console[method](`[Plugin:${diagnostic.pluginId ?? 'host'}] ${diagnostic.code}: ${diagnostic.message}`);
    },
    hostAssembly,
  });
}

export function preparePaTemplateEditorDocument(
  document: EditorSceneDocument,
  assets: EditorSceneAssetLibraryItem[],
): EditorSceneDocument {
  return normalizeEditorSceneHierarchyDocument(
    sceneAssembly.ensureEnvironmentDefaults(enrichEditorSceneDocumentAssets(document, assets)),
  );
}
