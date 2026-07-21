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
  type EditorSceneAssetLibraryItem,
  EditorSceneDocumentPatch,
  type EditorSceneDocument,
  type EditorSceneGameObject,
} from './scene-types';
import {
  createEditorSceneAssetActionPatch,
  createEditorSceneGroundDecalHierarchyOperations,
  sceneAssembly,
  sceneSource,
  renderingRuntime,
  setEditorRenderingTextures,
} from './scene-feature';

const projectionPreview = createFpsGameEditorProductProjectionPreview<EditorSceneDocument, EditorSceneGameObject, EditorSceneAssetLibraryItem, GroundDecalUiConfig>({
  assetsModule: editorAssets,
  defaultCamera: sceneAssembly.defaults.camera,
  resolveModelPathAndFile: editorAssets.getModelPathAndFileAsync,
  groundDecal: {
    isGroundDecalConfig: isGroundDecalUiConfig,
    createDynamicTexture: createGroundDecalUiDynamicTexture as never,
    readSize: decal => decal.size,
    readRendering: decal => decal.rendering,
  },
});

const hostServices = createFpsGameEditorProductProjectHostServices<EditorSceneDocument, EditorSceneGameObject, EditorSceneAssetLibraryItem>({
  domainPrefix: 'pa-template', sceneSource,
  resolveDomainRole: object => object.groundDecal ? 'ground-decal' : null,
  findExistingAsset: async payload => { const lookup = readFpsGameEditorPlatformAssetLookup(payload); const match = editorAssets.getAssetCatalogEntries({ kind: lookup.kind }).find(entry => lookup.projectAssetId === entry.assetId || lookup.platformAssetId === entry.external?.platformAssetId || lookup.assetPath === entry.external?.assetPath); return match ? { guid: match.guid, assetId: match.assetId, external: match.external } : null; },
});

export function mountLocalEditorModeSwitcher(
  options: FpsGameEditorLocalEditorEntryMountOptions & { root?: HTMLElement },
): Promise<FpsGameEditorProductLocalEditorModeSwitcher<EditorSceneDocument>> {
  const hostAssembly = createFpsGameEditorPlayableProjectHostAssembly({
    scene: sceneAssembly,
    projection: projectionPreview,
    sceneSource,
    rendering: { ...renderingRuntime, setTextures: setEditorRenderingTextures },
    projectServices: hostServices,
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
    hostAssembly,
  });
}
