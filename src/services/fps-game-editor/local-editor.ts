import {
  createFpsGameEditorPlayableProjectHostAssembly,
  createFpsGameEditorProductProjectHostServices,
  createFpsGameEditorProductProjectionPreview,
  readFpsGameEditorPlatformAssetLookup,
  mountFpsGameEditorProductLocalEditor,
} from '@fps-games/editor/playable-sdk';
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
  getEditorScenePrefabStageDescriptor,
  getEditorScenePrefabStageInspectorObject,
  getEditorScenePrefabStageProjectionNodeIdForNode,
  getEditorScenePrefabStageProjectionNodes,
  getEditorScenePrefabStageStructure,
  normalizeEditorSceneHierarchyDocument,
  resolveEditorScenePrefabStagePreviewTarget,
  sceneAssembly,
  sceneSource,
  renderingRuntime,
  setEditorRenderingTextures,
  enrichEditorSceneDocumentAssets,
} from './scene-feature';
import { editorPluginHost } from './plugin-host';

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
  projectDropPoint: projectDropPointToGround,
});
export const describeEditorSceneAgentObject = (document: EditorSceneDocument, objectId: string) => hostServices.agentContext.describeSceneObject({ document, objectId });
export const describeEditorSceneAgentObjectSet = (document: EditorSceneDocument, objectIds: string[]) => hostServices.agentContext.describeSceneObjectSet({ document, objectIds });

const loadingContent: any = {
  enter: { title: '正在进入编辑界面…', description: '正在加载场景数据和编辑器，请稍候' },
  saveScene: { title: '正在保存场景…', description: '正在写入场景数据，请稍候' },
  saveAndRunGame: { title: '正在保存并退出…', description: '正在写入场景并返回游戏，请稍候' },
  discardAndRunGame: { title: '正在放弃变更并退出…', description: '正在恢复游戏场景，请稍候' },
  assetImport: { title: '正在添加资源…', description: '正在检查资产库并实例化资源，请稍候' },
};

export interface LocalEditorModeSwitcherOptions {
  root?: HTMLElement;
  disposeGameWorld: () => void | Promise<void>;
  restartGame?: (context?: { reason?: string }) => void | Promise<void>;
  onBeforeEnterEditor?: () => void | Promise<void>;
  onBeforeReload?: () => void | Promise<void>;
}

export interface LocalEditorModeSwitcher {
  enterEditor(): Promise<void>;
  discardAndRunGame(): Promise<void>;
  detachForEditor(): void;
  dispose(): Promise<void>;
}

export function mountLocalEditorModeSwitcher(options: LocalEditorModeSwitcherOptions): LocalEditorModeSwitcher {
  const hierarchyOperationCapability = {
    hierarchyOperations: createEditorSceneGroundDecalHierarchyOperations(),
  } as const;
  const hostAssembly = createFpsGameEditorPlayableProjectHostAssembly({
    scene: sceneAssembly,
    projection: projectionPreview,
    sceneSource,
    rendering: { ...renderingRuntime, setTextures: setEditorRenderingTextures },
    projectServices: hostServices,
    prepareDocument: (document: EditorSceneDocument, assets: EditorSceneAssetLibraryItem[]) => { currentEditorAssetLibrary = assets; return preparePaTemplateEditorDocument(document, assets); },
    createAssetActionPatch: (input: any) => createEditorSceneAssetActionPatch(input),
    prefab: { getDescriptor: getEditorScenePrefabStageDescriptor, getProjectionNodes: getEditorScenePrefabStageProjectionNodes, getStructure: getEditorScenePrefabStageStructure, getInspectorObject: getEditorScenePrefabStageInspectorObject, resolvePreviewTarget: resolveEditorScenePrefabStagePreviewTarget, getProjectionNodeId: getEditorScenePrefabStageProjectionNodeIdForNode },
    ...hierarchyOperationCapability,
    loadingContent,
    runtimeWindow: window,
    gameModeEntryVisible: false,
    loadBabylon: () => import('@babylonjs/core'),
    world: { cameraTarget: { x: 0, y: 0.6, z: 0 }, cameraRadius: 12, clearColor: { r: 0.055, g: 0.07, b: 0.09, a: 1 }, useRightHandedSystem: true, selectionEdgesPrewarm: 'lazy' },
    reportError: (error: unknown) => console.error('[LocalEditorModeSwitcher] Forge Play mode change failed', error),
  });

  const switcher = mountFpsGameEditorProductLocalEditor<
    EditorSceneDocument,
    EditorSceneDocumentPatch,
    EditorSceneAssetLibraryItem
  >({
    project: editorConfig,
    compatibilityTag: 'integration/fps-game-editor-lab',
    root: options.root,
    window,
    disposeGameWorld: options.disposeGameWorld,
    restartGame: options.restartGame,
    onBeforeEnterEditor: options.onBeforeEnterEditor,
    onBeforeReload: options.onBeforeReload,
    agentBridgeSessionMetadata: __FPS_EDITOR_AGENT_SESSION_METADATA__,
    pluginHost: editorPluginHost,
    hostAssembly,
  });
  return {
    enterEditor: () => switcher.enterEditor(),
    discardAndRunGame: () => switcher.discardAndRunGame(),
    detachForEditor: () => switcher.detachForEditor(),
    async dispose() { await switcher.dispose(); },
  };
}

function projectDropPointToGround(point: { x: number; y: number } | null) {
  const babylon = (window as any).BABYLON; const scene = babylon?.EngineStore?.LastCreatedScene; const camera = scene?.activeCamera; const canvas = document.getElementById('renderCanvas');
  if (!point || !babylon || !scene || !camera || !(canvas instanceof HTMLCanvasElement)) return null;
  const rect = canvas.getBoundingClientRect(); const x = (point.x <= 1 ? point.x * innerWidth : point.x) - rect.left; const y = (point.y <= 1 ? point.y * innerHeight : point.y) - rect.top;
  const ray = scene.createPickingRay(x, y, babylon.Matrix.Identity(), camera, false); if (!ray?.direction || Math.abs(ray.direction.y) < 0.000001) return null;
  const distance = -ray.origin.y / ray.direction.y; if (!Number.isFinite(distance) || distance < 0) return null;
  const hit = ray.origin.add(ray.direction.scale(distance)); return { x: hit.x, y: 0, z: hit.z };
}

export function preparePaTemplateEditorDocument(
  document: EditorSceneDocument,
  assets: EditorSceneAssetLibraryItem[],
): EditorSceneDocument {
  return normalizeEditorSceneHierarchyDocument(
    sceneAssembly.ensureEnvironmentDefaults(enrichEditorSceneDocumentAssets(document, assets)),
  );
}
