import {
  createPlayableLocalEditorHost,
  createPlayablePlatformAssetDropCache,
  createPlayableBabylonEditorGrid,
  createBabylonAssetContainerProjectionImporter,
  formatPlayableEditorDoctorReport,
  inspectPlayableEditorHostCompatibilityReport,
  createEditorSceneRuntimePreviewMainCameraRig,
  createEditorSceneRuntimePreviewImportPlan,
  createEditorSceneRuntimePreviewMissingAssetUrlDiagnostic,
  createEditorSceneRuntimePreviewNode,
  createEditorSceneRuntimePreviewNodes,
  createEditorSceneMaterialBrowserAssetItems as createPlayableEditorSceneMaterialBrowserAssetItems,
  createEditorSceneSerializedMultiTransformPatch as createPlayableEditorSceneSerializedMultiTransformPatch,
  createEditorSceneTransformBatchPatch as createPlayableEditorSceneTransformBatchPatch,
  createEditorSceneTransformPatch as createPlayableEditorSceneTransformPatch,
  normalizePlayableForgePlayCommandName,
  PLAYABLE_LOCAL_EDITOR_HOST_MANIFEST_VERSION,
  PLAYABLE_FORGE_PLAY_COMMAND,
  PLAYABLE_FORGE_PLAY_EVENT,
  PLAYABLE_FORGE_PLAY_PROJECT_ASSET_COMMANDS,
  postPlayableForgePlayEvent,
  readPlayableForgePlayRequestId,
  readPlayablePlatformAssetExternal,
  readPlayablePlatformAssetKind,
  readPlayablePlatformAssetPath,
  readPlayablePlatformAssetPlacement,
  readPlayablePlatformRawAssetId,
  readEditorSceneRuntimePreviewAssetId,
  readEditorSceneRuntimePreviewAssetKind,
  resolveEditorSceneRuntimePreviewAssetUrl,
  registerPlayablePlatformAssetIfNeeded as registerPlayablePlatformAssetWithSdk,
  runPlayableAuthoringCommand,
  writePlayableAuthoringFile,
  type PlayableLocalEditorHost,
  type PlayableLocalEditorHostCompatibilityReport,
  type PlayableLocalEditorHostBridgeContext,
  type PlayableLocalEditorHarnessApi,
  type PlayableLocalEditorMultiPropertyCapabilityInput,
  type PlayableLocalEditorMultiPropertyPatchInput,
  type PlayableLocalEditorPropertyPatchInput,
  type PlayableLocalEditorTransformBatchPatchInput,
  type PlayableLocalEditorTransformInspectorPreviewInput,
  type PlayableLocalEditorTransformPatchInput,
  type PlayableForgePlaySaveState,
  type PlayableBabylonProjectionImportContext,
  type PlayableBabylonProjectionImportResult,
  type PlayableBabylonProjectionNode,
  type PlayableBabylonSceneCameraPreviewRig,
  type BabylonAssetContainerProjectionImportEvent,
  type PlayableLocalEditorLoadingOverlayContent,
  type PlayablePlatformAssetDropPoint,
  type PlayablePlatformAssetExternal,
  type EditorSceneRuntimePreviewGroundDecalDescriptor,
} from '@fps-games/editor/playable-sdk';
import baseSceneConfig from '../config/scene.json';
import type {
  SceneConfig,
} from '../config/types';
import type { EditorSceneDocument } from '../fps-game-editor-adapter/editor-scene-document';
import {
  type EditorSceneAssetLibraryItem,
  type EditorSceneGameObject,
  findEditorSceneModelRenderer,
  readEditorSceneNodeKind,
} from '../fps-game-editor-adapter/editor-scene-document';
import { enrichEditorSceneDocumentAssets } from '../fps-game-editor-adapter/editor-asset-library';
import {
  createEditorSceneCreateGroupPatch,
  createEditorSceneCreatePrimitivePatch,
  createEditorSceneDeleteSubtreePatch,
  createEditorSceneDuplicateSelectionPatch,
  createEditorSceneGroupSelectionPatch,
  createEditorSceneHierarchyMovePatch,
  createEditorSceneInspectorPropertyPatch,
  createEditorScenePlacedAssetPatch,
  createEditorSceneAssetActionPatch,
  createEditorSceneRenamePatch,
  createEditorSceneReparentPatch,
  DEFAULT_EDITOR_SCENE_CAMERA,
  ensureEditorSceneEnvironmentDefaults,
  getEditorSceneHierarchyItems,
  getEditorSceneInspectorMultiObject,
  getEditorSceneInspectorObject,
  getEditorSceneRuntimeInspectorSections,
  getEditorSceneSerializedObject,
  getEditorSceneSerializedMultiObject,
  normalizeEditorSceneHierarchyDocument,
  reduceEditorSceneDocument,
  toEditorSceneLocalTransformFromWorld,
  validateEditorSceneGroupSelection,
  validateEditorSceneHierarchyMove,
  validateEditorSceneReparent,
  type EditorSceneInspectorTextureAsset,
  type EditorSceneDocumentPatch,
} from '../fps-game-editor-adapter/editor-scene-session';
import {
  createSceneMainSourceDriver,
  loadEditorAssetLibrary,
  loadSceneMainSource,
  saveSceneMainSource,
} from '../fps-game-editor-adapter/scene-main-source-driver';
import { compileEditorSceneDocumentToSceneConfig } from '../fps-game-editor-adapter/editor-scene-compiler';
import { resolveEditorLightingPreviewProfile } from '../fps-game-editor-adapter/editor-lighting-preview-profile';
import {
  createEditorRenderingCapability,
  hasEditorRenderingDraftChanges,
  resetEditorRenderingDraft,
} from '../fps-game-editor-adapter/editor-rendering-profile';
import * as editorAssets from '../assets';

type BabylonModule = Record<string, any>;

type ProjectGameRestartContext = {
  reason?: string;
};

type ProjectGameRestartWindow = Window & {
  __restartProjectGame?: (context?: ProjectGameRestartContext) => Promise<void> | void;
  __localEditorProjectionImportStats?: EditorProjectionImportStats;
};

type EditorPrimitiveProjectionShape = 'cube' | 'sphere' | 'plane' | 'capsule';
type EditorPrimitiveProjectionMaterialKind = 'pbr' | 'standard';

interface EditorPrimitiveProjectionInstancingEntry {
  shape: EditorPrimitiveProjectionShape;
  materialKind: EditorPrimitiveProjectionMaterialKind;
}

interface EditorProjectionImportStats {
  importModelCalls: number;
  containerLoads: number;
  containerCacheHits: number;
  instantiateCalls: number;
  fallbackCount: number;
  lastCacheKey: string | null;
  lastError: string | null;
}

export interface LocalEditorModeSwitcherOptions {
  root?: HTMLElement;
  disposeGameWorld: () => void | Promise<void>;
  onBeforeReload?: () => void;
}

export interface LocalEditorModeSwitcher {
  enterEditor(): Promise<void>;
  discardAndRunGame(): Promise<void>;
  dispose(): void;
}

const EDITOR_LOADING_OVERLAY_CONTENT: Record<'enter' | 'saveScene' | 'saveAndRunGame' | 'discardAndRunGame' | 'assetImport', PlayableLocalEditorLoadingOverlayContent> = {
  enter: {
    title: '正在进入编辑界面…',
    description: '正在加载场景数据和编辑器，请稍候',
  },
  saveScene: {
    title: '正在保存场景…',
    description: '正在写入场景数据，请稍候',
  },
  saveAndRunGame: {
    title: '正在保存并退出…',
    description: '正在写入场景并返回游戏，请稍候',
  },
  discardAndRunGame: {
    title: '正在放弃变更并退出…',
    description: '正在恢复游戏场景，请稍候',
  },
  assetImport: {
    title: '正在添加资源…',
    description: '正在检查资产库并实例化模型或贴图，请稍候，完成前请勿继续操作',
  },
};

const editorProjectionImportStats: EditorProjectionImportStats = {
  importModelCalls: 0,
  containerLoads: 0,
  containerCacheHits: 0,
  instantiateCalls: 0,
  fallbackCount: 0,
  lastCacheKey: null,
  lastError: null,
};

type EditorSceneRuntimePreviewImportPlan = NonNullable<ReturnType<typeof createEditorSceneRuntimePreviewImportPlan>>;

const editorProjectionImportPlanCache = new WeakMap<object, EditorSceneRuntimePreviewImportPlan>();
const editorPrimitiveProjectionInstancingByNodeId = new Map<string, EditorPrimitiveProjectionInstancingEntry>();
const editorPrimitiveProjectionSourceMeshes = new WeakMap<object, Map<string, any>>();

const editorProjectionModelImporter = createBabylonAssetContainerProjectionImporter({
  loadContainer: async (context) => {
    const importPlan = resolveCachedEditorProjectionImportPlan(context);
    if (!importPlan || importPlan.kind === 'groundDecal') {
      throw new Error('[LocalEditor] Missing model import plan for projection asset container');
    }
    await import('@babylonjs/loaders/glTF');
    const { SceneLoader } = await import('@babylonjs/core/Loading/sceneLoader');
    const pathInfo = await editorAssets.getModelPathAndFileAsync(importPlan.url);
    return SceneLoader.LoadAssetContainerAsync(
      pathInfo.path,
      pathInfo.filename,
      context.scene,
      undefined,
      pathInfo.isDataUrl || pathInfo.isCompressed ? '.glb' : undefined,
    );
  },
  resolveCacheKey: (context) => {
    const importPlan = resolveCachedEditorProjectionImportPlan(context);
    const assetId = readEditorSceneRuntimePreviewAssetId(context.asset) ?? '';
    const sourceId = typeof context.asset.sourceId === 'string' ? context.asset.sourceId : '';
    return importPlan && importPlan.kind !== 'groundDecal'
      ? `pa-template:model:${assetId}:${sourceId}:${importPlan.url}`
      : `pa-template:model:${assetId}:${sourceId}`;
  },
  onEvent: handleEditorProjectionImportEvent,
});

export function mountLocalEditorModeSwitcher(options: LocalEditorModeSwitcherOptions): LocalEditorModeSwitcher {
  const sceneMainSourceDriver = createSceneMainSourceDriver();
  let editorHost: PlayableLocalEditorHost<EditorSceneDocument> | null = null;
  const runWithAssetLoadingOverlay = async <T>(operation: () => Promise<T>): Promise<T> => {
    return editorHost
      ? editorHost.runWithAssetLoadingOverlay(operation)
      : operation();
  };
  const importProjectionModelWithLoading = async (
    context: PlayableBabylonProjectionImportContext,
  ): Promise<PlayableBabylonProjectionImportResult | null> => {
    return runWithAssetLoadingOverlay(() => importEditorProjectionModel(context));
  };
  const editorLightingPreviewAdapter = {
    getWorldAppearance: resolveEditorLightingPreviewProfile,
  } as Record<string, unknown>;
  const editorRenderingCapability = createEditorRenderingCapability({
    getTextureAssets: () => createEditorSceneInspectorTextureAssets(currentEditorAssetLibrary),
  });
  let currentEditorAssetLibrary: EditorSceneAssetLibraryItem[] = [];
  const platformAssetDropCache = createPlayablePlatformAssetDropCache();
  const rememberPlatformAssetDrop = (payload: Record<string, unknown>): void => {
    platformAssetDropCache.remember(payload);
  };
  const normalizeLoadedPlatformAssetPayload = (payload: Record<string, unknown>): Record<string, unknown> => {
    return platformAssetDropCache.normalize(payload);
  };

  editorHost = createPlayableLocalEditorHost<EditorSceneDocument, EditorSceneDocumentPatch, EditorSceneAssetLibraryItem>({
    metadata: {
      manifestVersion: PLAYABLE_LOCAL_EDITOR_HOST_MANIFEST_VERSION,
      projectId: 'pa_template',
      projectName: 'PA Template',
      compatibilityTag: 'integration/fps-game-editor-lab',
    },
    root: options.root,
    localTestActions: window.parent === window,
    authoring: {
      drivers: [sceneMainSourceDriver],
    },
    documentAdapter: {
      reduceDocument: reduceEditorSceneDocument,
      getSerializedObject: getEditorSceneSerializedObject,
      getHierarchyItems: getEditorSceneHierarchyItems,
      getProjectionNodes: createProjectionNodes,
      getProjectionNode: (document, id) => {
        const gameObject = document.scene.gameObjects.find((entry) => entry.id === id);
        return gameObject ? createProjectionNode(document, gameObject) : null;
      },
      createPatchFromAsset: (assetItem, input) => ({
        label: `Add ${assetItem.displayName}`,
        patch: {
          kind: 'game-object.create-from-asset',
          assetItem,
          ...(input?.placement ? { placement: input.placement as any } : {}),
        },
      }),
      createSerializedPropertyPatch: createEditorSceneSerializedPropertyPatch,
    },
    capabilities: {
      documentLifecycle: {
        prepareDocument: (document, assets) => {
          currentEditorAssetLibrary = assets;
          return normalizeEditorSceneHierarchyDocument(
            ensureEditorSceneEnvironmentDefaults(enrichEditorSceneDocumentAssets(document, assets)),
          );
        },
        summarize: summarizeEditorScene,
      },
      selection: {
        isSelectable: (_document, id) => id !== 'root',
        isLocked: () => false,
      },
      inspector: {
        getSerializedMultiObject: getEditorSceneSerializedMultiObject,
        getInspectorObject: (document, activeId) => getEditorSceneInspectorObject(
          document,
          activeId,
          { textureAssets: createEditorSceneInspectorTextureAssets(currentEditorAssetLibrary) },
        ),
        getInspectorMultiObject: getEditorSceneInspectorMultiObject,
        getRuntimeInspectorSections: getEditorSceneRuntimeInspectorSections,
      },
      assetBrowser: {
        getBrowserAssetItems: createEditorSceneBrowserAssetItems,
      },
      agentContext: {
        describeSceneObject: input => describeEditorSceneAgentObject(input.document, input.objectId),
        describeSceneObjectSet: input => describeEditorSceneAgentObjectSet(input.document, input.objectIds),
        describeRegionBinding: input => describeEditorSceneAgentRegionBinding(input.document, input.objectIds),
      },
      assetActions: {
        createAssetActionPatch: input => createEditorSceneAssetActionPatch(input as unknown as Parameters<typeof createEditorSceneAssetActionPatch>[0]),
        createPlacedAssetPatch: createEditorScenePlacedAssetPatch,
        findCreatedId: (beforeDocument, afterDocument) => {
          const beforeIds = new Set(beforeDocument.scene.gameObjects.map((gameObject) => gameObject.id));
          return afterDocument.scene.gameObjects.find((gameObject) => !beforeIds.has(gameObject.id))?.id ?? null;
        },
      },
      transformCommands: {
        canCreateSerializedMultiPropertyPatch: canCreateEditorSceneSerializedMultiPropertyPatch,
        createSerializedMultiPropertyPatch: createEditorSceneSerializedMultiPropertyPatch,
        createTransformInspectorPreview: createEditorSceneTransformInspectorPreview,
        createTransformPatch: createEditorSceneTransformPatch,
        createTransformBatchPatch: createEditorSceneTransformBatchPatch,
        createDuplicateSelectionPatch: createEditorSceneDuplicateSelectionPatch,
      },
      sceneGraph: {
        validateSceneGraphDrop: validateEditorSceneReparent,
        validateSceneGraphMove: validateEditorSceneHierarchyMove,
        validateSceneGraphGroupSelection: validateEditorSceneGroupSelection,
        createSceneGraphRenamePatch: createEditorSceneRenamePatch,
        createSceneGraphCreateGroupPatch: createEditorSceneCreateGroupPatch,
        createSceneGraphCreatePrimitivePatch: createEditorSceneCreatePrimitivePatch,
        createSceneGraphDeletePatch: createEditorSceneDeleteSubtreePatch,
        createSceneGraphDropPatch: createEditorSceneReparentPatch,
        createSceneGraphMovePatch: createEditorSceneHierarchyMovePatch,
        createSceneGraphGroupSelectionPatch: createEditorSceneGroupSelectionPatch,
      },
      worldPreview: {
        getSceneCameraPreviewRig: createSceneCameraPreviewRig,
        getWorldAppearance: editorLightingPreviewAdapter.getWorldAppearance as (document: EditorSceneDocument) => unknown | null,
      },
      rendering: editorRenderingCapability,
    },
    persistenceAdapter: {
      async loadAuthoringSource() {
        const loaded = await loadSceneMainSource();
        return {
          source: loaded.source,
          document: loaded.document,
          summary: loaded.summary,
        };
      },
      loadAssets: loadEditorAssetLibrary,
      async runGame(context?: ProjectGameRestartContext) {
        const restartProjectGame = (window as ProjectGameRestartWindow).__restartProjectGame;
        if (typeof restartProjectGame === 'function') {
          await restartProjectGame(context);
          return;
        }
        options.onBeforeReload?.();
        window.location.reload();
      },
    },
    worldAdapter: {
      disposeWorld: options.disposeGameWorld,
      getCanvas() {
        const canvas = document.getElementById('renderCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return null;
        return canvas;
      },
      loadPreviewEngine: async () => createEditorPreviewBabylonModule(await import('@babylonjs/core') as BabylonModule),
      createPreviewEngine(babylon, canvas) {
        return new babylon.Engine(canvas, true, {
          preserveDrawingBuffer: true,
          stencil: true,
          antialias: true,
        });
      },
      importPreviewAsset: importProjectionModelWithLoading,
      resolveMaterialTextureUrl: texture => resolveEditorSceneTextureRefUrl(currentEditorAssetLibrary, texture),
      resolveAssetId: asset => asset.assetId,
      toBrowserAssetItem(asset) {
        return {
          id: asset.assetId,
          guid: asset.guid,
          assetId: asset.assetId,
          kind: asset.kind,
          label: asset.displayName,
          meta: asset.assetId,
          external: asset.external,
          origin: asset.origin,
          dedupeKey: asset.dedupeKey,
          placeable: asset.placeable,
          preview: createEditorSceneLibraryAssetPreview(asset),
          disabled: asset.placeable === false,
        };
      },
    },
    world: {
      cameraTarget: { x: 0, y: 0.6, z: 0 },
      cameraRadius: 12,
      clearColor: { r: 0.055, g: 0.07, b: 0.09, a: 1 },
      useRightHandedSystem: true,
      selectionEdgesPrewarm: 'lazy',
    },
    createGrid: createEditorGrid,
    lifecycle: {
      loadingContent: EDITOR_LOADING_OVERLAY_CONTENT,
      beforeDiscardAndRunGame: resetEditorRenderingDraft,
    },
    forgePlay: {
      window,
      hasUnsavedPlatformChanges: hasEditorRenderingDraftChanges,
      handleAssetDrop: rememberPlatformAssetDrop,
      handleProjectAssetCommand: context => handleProjectAssetCommand(context, normalizeLoadedPlatformAssetPayload),
      exportDocument: ({ payload, saveState }) => {
        const harness = editorHost?.harness;
        if (!harness) throw new Error('editor_host_unavailable');
        return exportForgePlayDocument(harness, payload, saveState);
      },
      reportError: error => {
        console.error('[LocalEditorModeSwitcher] Forge Play mode change failed', error);
      },
    },
  });

  const host = editorHost;
  logPlayableLocalEditorHostCompatibilityReport(host.getCompatibilityReport());
  const disposeLegacyAssetBypass = installLegacyAssetCommandBypass((name, params) => {
    const commandName = normalizePlayableForgePlayCommandName(name) ?? name;
    return handleLegacyProjectAssetCommand(commandName, params, normalizeLoadedPlatformAssetPayload, host);
  });
  setLocalEditorAssetBridgeActive(true);

  return {
    enterEditor: () => host.enterEditor(),
    discardAndRunGame: () => host.discardAndRunGame(),
    dispose() {
      disposeLegacyAssetBypass();
      setLocalEditorAssetBridgeActive(false);
      host.dispose();
    },
  };
}

function createEditorGrid(BABYLON: BabylonModule, scene: any, camera?: any) {
  return createPlayableBabylonEditorGrid({
    babylon: BABYLON,
    scene,
    camera,
    name: 'pa-template-editor-grid',
    halfLineCount: 96,
  });
}

function createEditorPreviewBabylonModule(BABYLON: BabylonModule): BabylonModule {
  const MeshBuilder = BABYLON.MeshBuilder;
  if (!MeshBuilder) return BABYLON;
  return {
    ...BABYLON,
    MeshBuilder: {
      ...MeshBuilder,
      CreateBox: createEditorPrimitiveProjectionBuilder(BABYLON, 'cube', MeshBuilder.CreateBox),
      CreateSphere: createEditorPrimitiveProjectionBuilder(BABYLON, 'sphere', MeshBuilder.CreateSphere),
      CreateGround: createEditorPrimitiveProjectionBuilder(BABYLON, 'plane', MeshBuilder.CreateGround),
      CreateCapsule: createEditorPrimitiveProjectionBuilder(BABYLON, 'capsule', MeshBuilder.CreateCapsule),
    },
  };
}

function createEditorPrimitiveProjectionBuilder(
  BABYLON: BabylonModule,
  shape: EditorPrimitiveProjectionShape,
  originalBuilder: unknown,
) {
  if (typeof originalBuilder !== 'function') return originalBuilder;
  const buildPrimitiveMesh = originalBuilder as (name: string, options: Record<string, unknown>, scene: unknown) => any;
  return (name: string, options: Record<string, unknown>, scene: unknown) => {
    const request = readEditorPrimitiveProjectionMeshRequest(name);
    if (!request || request.shape !== shape) {
      return buildPrimitiveMesh(name, options, scene);
    }
    const instancing = editorPrimitiveProjectionInstancingByNodeId.get(request.nodeId);
    if (!instancing || instancing.shape !== shape) {
      return buildPrimitiveMesh(name, options, scene);
    }
    const source = getOrCreateEditorPrimitiveProjectionSourceMesh({
      BABYLON,
      scene,
      shape,
      materialKind: instancing.materialKind,
      options,
      originalBuilder: buildPrimitiveMesh,
    });
    const instance = typeof source?.createInstance === 'function'
      ? source.createInstance(name)
      : null;
    if (!instance) return buildPrimitiveMesh(name, options, scene);
    configureEditorPrimitiveProjectionInstance(instance, source);
    return instance;
  };
}

function getOrCreateEditorPrimitiveProjectionSourceMesh(input: {
  BABYLON: BabylonModule;
  scene: unknown;
  shape: EditorPrimitiveProjectionShape;
  materialKind: EditorPrimitiveProjectionMaterialKind;
  options: Record<string, unknown>;
  originalBuilder: (name: string, options: Record<string, unknown>, scene: unknown) => any;
}): any | null {
  if (!input.scene || typeof input.scene !== 'object') return null;
  let sceneCache = editorPrimitiveProjectionSourceMeshes.get(input.scene);
  if (!sceneCache) {
    sceneCache = new Map();
    editorPrimitiveProjectionSourceMeshes.set(input.scene, sceneCache);
  }
  const cacheKey = `${input.shape}:${input.materialKind}`;
  const cached = sceneCache.get(cacheKey);
  if (cached && !cached.isDisposed?.()) return cached;
  const sourceName = `__pa_template_editor_primitive_source_${cacheKey.replace(/[^a-z0-9_-]/gi, '_')}`;
  const source = input.originalBuilder(sourceName, input.options, input.scene);
  if (!source) return null;
  source.isVisible = false;
  source.isPickable = false;
  source.metadata = {
    ...(source.metadata && typeof source.metadata === 'object' ? source.metadata : {}),
    editorProjection: {
      helper: 'primitiveSource',
      primitiveShape: input.shape,
      materialKind: input.materialKind,
    },
  };
  sceneCache.set(cacheKey, source);
  return source;
}

function configureEditorPrimitiveProjectionInstance(instance: any, source: any): void {
  try {
    Object.defineProperty(instance, 'material', {
      configurable: true,
      enumerable: true,
      get() {
        return source.material ?? null;
      },
      set(value: unknown) {
        if (!value) return;
        if (!source.material) {
          source.material = value;
          return;
        }
        if (value !== source.material && typeof (value as { dispose?: unknown }).dispose === 'function') {
          (value as { dispose: () => void }).dispose();
        }
      },
    });
  } catch {}
}

function readEditorPrimitiveProjectionMeshRequest(name: string): { nodeId: string; shape: EditorPrimitiveProjectionShape } | null {
  for (const shape of ['cube', 'sphere', 'plane', 'capsule'] as const) {
    const suffix = `.${shape}Projection`;
    if (!name.endsWith(suffix)) continue;
    const nodeId = name.slice(0, -suffix.length);
    return nodeId ? { nodeId, shape } : null;
  }
  return null;
}

function createEditorSceneBrowserAssetItems(editorScene: EditorSceneDocument) {
  return createPlayableEditorSceneMaterialBrowserAssetItems(editorScene);
}

function logPlayableLocalEditorHostCompatibilityReport(
  report: PlayableLocalEditorHostCompatibilityReport,
): void {
  const visibleDiagnostics = report.diagnostics.filter(
    diagnostic => diagnostic.severity === 'warning' || diagnostic.severity === 'error',
  );
  if (visibleDiagnostics.length === 0) return;
  const doctorReport = inspectPlayableEditorHostCompatibilityReport({
    diagnostics: visibleDiagnostics,
  });
  const formatted = formatPlayableEditorDoctorReport(doctorReport);
  if (doctorReport.ok) {
    console.warn(formatted);
  } else {
    console.error(formatted);
  }
}

function createEditorSceneLibraryAssetPreview(asset: EditorSceneAssetLibraryItem) {
  if (asset.kind !== 'texture') return undefined;
  const url = resolveEditorSceneRuntimePreviewAssetUrl(editorAssets, asset, 'texture');
  if (!url) return undefined;
  return {
    kind: 'image' as const,
    url,
    alt: asset.displayName,
    fit: 'contain' as const,
  };
}

function createEditorSceneInspectorTextureAssets(
  assets: readonly EditorSceneAssetLibraryItem[],
): EditorSceneInspectorTextureAsset[] {
  return assets
    .filter(asset => asset.kind === 'texture')
    .flatMap((asset) => {
      const url = resolveEditorSceneRuntimePreviewAssetUrl(editorAssets, asset, 'texture');
      if (!url) return [];
      const environmentTexture = isEnvironmentTextureAsset(asset, url);
      return [{
        id: asset.assetId,
        label: asset.displayName || asset.assetId,
        url,
        meta: environmentTexture ? `${asset.assetId} · IBL` : asset.assetId,
        usage: environmentTexture ? 'environment' : 'material',
        capabilities: {
          materialTexture: !environmentTexture,
          environmentTexture,
        },
      }];
    });
}

function resolveEditorSceneTextureRefUrl(
  assets: readonly EditorSceneAssetLibraryItem[],
  texture: { textureAssetId?: string | null; url?: string | null } | null | undefined,
): string | null {
  if (!texture || typeof texture !== 'object') return null;
  const textureAssetId = typeof texture.textureAssetId === 'string' ? texture.textureAssetId.trim() : '';
  if (textureAssetId) {
    const asset = assets.find(candidate => candidate.kind === 'texture' && candidate.assetId === textureAssetId);
    return asset ? resolveEditorSceneRuntimePreviewAssetUrl(editorAssets, asset, 'texture') ?? null : null;
  }
  const textureUrl = typeof texture.url === 'string' ? texture.url.trim() : '';
  return textureUrl || null;
}

function isEnvironmentTextureAsset(asset: EditorSceneAssetLibraryItem, resolvedUrl: string): boolean {
  const metadata = asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata)
    ? asset.metadata as Record<string, unknown>
    : {};
  if (metadata.textureUsage === 'environment' || metadata.usage === 'environment') return true;
  const capabilities = metadata.capabilities && typeof metadata.capabilities === 'object' && !Array.isArray(metadata.capabilities)
    ? metadata.capabilities as Record<string, unknown>
    : null;
  if (capabilities?.environmentTexture === true) return true;
  if (capabilities?.environmentTexture === false) return false;
  const candidates = [
    resolvedUrl,
    asset.displayName,
    asset.assetId,
    typeof metadata.relativePath === 'string' ? metadata.relativePath : '',
    typeof metadata.originalFileName === 'string' ? metadata.originalFileName : '',
  ];
  return candidates.some(value => /\.(env|hdr|dds|ktx|ktx2)(?:[?#].*)?$/i.test(value));
}

function createProjectionNodes(editorScene: EditorSceneDocument): PlayableBabylonProjectionNode[] {
  const nodes = createEditorSceneRuntimePreviewNodes(editorScene) as unknown as PlayableBabylonProjectionNode[];
  editorPrimitiveProjectionInstancingByNodeId.clear();
  for (const node of nodes) rememberEditorPrimitiveProjectionInstancing(node);
  return nodes;
}

function createProjectionNode(
  editorScene: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): PlayableBabylonProjectionNode {
  const node = createEditorSceneRuntimePreviewNode(editorScene, gameObject) as unknown as PlayableBabylonProjectionNode;
  rememberEditorPrimitiveProjectionInstancing(node);
  return node;
}

function rememberEditorPrimitiveProjectionInstancing(node: PlayableBabylonProjectionNode): void {
  const shape = readEditorPrimitiveProjectionShape(node.primitive?.shape);
  if (!shape || hasEditorPrimitiveProjectionMaterialOverride(node)) {
    editorPrimitiveProjectionInstancingByNodeId.delete(node.id);
    return;
  }
  editorPrimitiveProjectionInstancingByNodeId.set(node.id, {
    shape,
    materialKind: node.artistMaterialKind === 'standard' ? 'standard' : 'pbr',
  });
}

function readEditorPrimitiveProjectionShape(value: unknown): EditorPrimitiveProjectionShape | null {
  return value === 'cube' || value === 'sphere' || value === 'plane' || value === 'capsule' ? value : null;
}

function hasEditorPrimitiveProjectionMaterialOverride(node: PlayableBabylonProjectionNode): boolean {
  return hasObjectEntries(node.artistMaterialProfile) || hasObjectEntries(node.artistMaterialSlotProfiles);
}

function hasObjectEntries(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function createSceneCameraPreviewRig(
  editorScene: EditorSceneDocument,
): PlayableBabylonSceneCameraPreviewRig | null {
  return createEditorSceneRuntimePreviewMainCameraRig(editorScene, DEFAULT_EDITOR_SCENE_CAMERA) as PlayableBabylonSceneCameraPreviewRig | null;
}

async function importEditorProjectionModel(
  context: PlayableBabylonProjectionImportContext,
): Promise<PlayableBabylonProjectionImportResult | null> {
  editorProjectionImportStats.importModelCalls += 1;
  publishEditorProjectionImportStats();
  const assetId = readEditorSceneRuntimePreviewAssetId(context.asset);
  if (!assetId) {
    editorProjectionImportStats.fallbackCount += 1;
    publishEditorProjectionImportStats();
    return null;
  }
  const importPlan = resolveCachedEditorProjectionImportPlan(context);
  if (!importPlan) {
    const kind = readEditorSceneRuntimePreviewAssetKind(context.asset) === 'texture' ? 'texture' : 'model';
    editorProjectionImportStats.fallbackCount += 1;
    publishEditorProjectionImportStats();
    warnProjectionAssetUrlMissing(context.asset, kind);
    return null;
  }
  if (importPlan.kind === 'groundDecal') return createGroundDecalProjectionResult(context, importPlan.decal);

  return await editorProjectionModelImporter(context) ?? null;
}

function warnProjectionAssetUrlMissing(asset: unknown, kind: 'model' | 'texture'): void {
  console.warn('[LocalEditor] Missing projection asset URL', createEditorSceneRuntimePreviewMissingAssetUrlDiagnostic(asset, kind));
}

function resolveCachedEditorProjectionImportPlan(
  context: PlayableBabylonProjectionImportContext,
): EditorSceneRuntimePreviewImportPlan | null {
  const cached = editorProjectionImportPlanCache.get(context);
  if (cached) return cached;
  const importPlan = createEditorSceneRuntimePreviewImportPlan({
    assetsModule: editorAssets,
    asset: context.asset,
    nodeId: context.node.id,
  });
  if (importPlan) editorProjectionImportPlanCache.set(context, importPlan);
  return importPlan;
}

function handleEditorProjectionImportEvent(event: BabylonAssetContainerProjectionImportEvent): void {
  editorProjectionImportStats.lastCacheKey = event.cacheKey;
  if (event.type === 'container-load-start') {
    editorProjectionImportStats.containerLoads += 1;
    editorProjectionImportStats.lastError = null;
  } else if (event.type === 'container-cache-hit') {
    editorProjectionImportStats.containerCacheHits += 1;
  } else if (event.type === 'instantiate') {
    editorProjectionImportStats.instantiateCalls += 1;
  } else if (event.type === 'container-load-failure') {
    editorProjectionImportStats.fallbackCount += 1;
    editorProjectionImportStats.lastError = event.error instanceof Error
      ? event.error.message
      : String(event.error);
  }
  publishEditorProjectionImportStats();
}

function publishEditorProjectionImportStats(): void {
  (window as ProjectGameRestartWindow).__localEditorProjectionImportStats = { ...editorProjectionImportStats };
}

async function createGroundDecalProjectionResult(
  context: PlayableBabylonProjectionImportContext,
  decal: EditorSceneRuntimePreviewGroundDecalDescriptor,
): Promise<PlayableBabylonProjectionImportResult> {
  const [{ MeshBuilder }, { StandardMaterial }, { Texture }, { Color3 }] = await Promise.all([
    import('@babylonjs/core/Meshes/meshBuilder'),
    import('@babylonjs/core/Materials/standardMaterial'),
    import('@babylonjs/core/Materials/Textures/texture'),
    import('@babylonjs/core/Maths/math.color'),
  ]);
  const mesh = MeshBuilder.CreateGround(decal.meshName, {
    width: decal.size.width,
    height: decal.size.depth,
  }, context.scene);
  const mat = new StandardMaterial(decal.materialName, context.scene);
  const texture = new Texture(decal.textureUrl, context.scene);
  texture.hasAlpha = decal.textureHasAlpha;
  // Ground decal 是 XZ 平面；图片像素行方向与地面 UV 的 V 轴相反。
  // 在贴图层翻转 V 轴，避免旋转 mesh 破坏地贴朝向语义。
  texture.vScale = decal.textureVScale;
  texture.vOffset = decal.textureVOffset;
  mat.diffuseTexture = texture;
  mat.useAlphaFromDiffuseTexture = true;
  mat.diffuseColor = new Color3(decal.color.r, decal.color.g, decal.color.b);
  mat.specularColor = new Color3(0, 0, 0);
  mat.backFaceCulling = false;
  mesh.material = mat;
  return { meshes: [mesh], transformNodes: [], animationGroups: [] };
}

function createEditorSceneSerializedPropertyPatch(
  input: PlayableLocalEditorPropertyPatchInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[]; reprojectIds?: string[] } | null {
  return createEditorSceneInspectorPropertyPatch(input);
}

function canCreateEditorSceneSerializedMultiPropertyPatch(
  input: PlayableLocalEditorMultiPropertyCapabilityInput<EditorSceneDocument>,
): boolean {
  return input.path.startsWith('transform.') || isEditorSceneSerializedMultiFieldPath(input.path);
}

function createEditorSceneSerializedMultiPropertyPatch(
  input: PlayableLocalEditorMultiPropertyPatchInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[]; reprojectIds?: string[] } | null {
  if (input.targetIds.some((targetId) => !createEditorSceneInspectorPropertyPatch({
    document: input.document,
    targetId,
    path: input.path,
    value: input.value,
  }))) return null;
  if (isEditorSceneSerializedMultiFieldPath(input.path)) {
    return {
      label: `Patch ${input.targetIds.length} GameObjects ${input.path}`,
      patch: {
        kind: 'game-object.field-batch',
        fields: input.targetIds.map((targetId) => ({
          targetId,
          path: input.path,
          value: input.value,
        })),
      },
      changedIds: input.targetIds,
      ...(input.path === 'shadowMode' ? { reprojectIds: input.targetIds } : {}),
    };
  }
  const result = createPlayableEditorSceneSerializedMultiTransformPatch(input);
  if (!result) return null;
  return {
    ...result,
    patch: result.patch as EditorSceneDocumentPatch,
  };
}

function isEditorSceneSerializedMultiFieldPath(path: string): boolean {
  return path === 'shadowMode' || path === 'metadata.shadowInspectorLanguage';
}

function createEditorSceneTransformPatch(
  input: PlayableLocalEditorTransformPatchInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[] } | null {
  const result = createPlayableEditorSceneTransformPatch(input as any);
  if (!result) return null;
  return {
    ...result,
    patch: result.patch as EditorSceneDocumentPatch,
  };
}

function createEditorSceneTransformInspectorPreview(
  input: PlayableLocalEditorTransformInspectorPreviewInput<EditorSceneDocument>,
) {
  return toEditorSceneLocalTransformFromWorld(input.document, input.targetId, input.transform);
}

function createEditorSceneTransformBatchPatch(
  input: PlayableLocalEditorTransformBatchPatchInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  const result = createPlayableEditorSceneTransformBatchPatch(input as any);
  if (!result) return null;
  return {
    ...result,
    patch: result.patch as EditorSceneDocumentPatch,
  };
}

const LOCAL_EDITOR_ASSET_BRIDGE_ACTIVE_FLAG = '__projectLocalEditorAssetBridgeActive';
const LOCAL_EDITOR_LEGACY_ASSET_BYPASS_FLAG = '__projectLegacyAssetBypass';
const LOCAL_EDITOR_ORIGINAL_LEGACY_ASSET_RUNTIME = '__projectOriginalLegacyAssetRuntime';
const LOCAL_EDITOR_LEGACY_REGISTER_PATCH_FLAG = '__projectLegacyRegisterPatch';

function postForgePlayEvent(name: string, payload: Record<string, unknown> = {}): void {
  postPlayableForgePlayEvent(window, name, payload);
}

async function handleProjectAssetCommand(
  context: PlayableLocalEditorHostBridgeContext<PlayableLocalEditorHarnessApi<EditorSceneDocument>>,
  normalizeLoadedPlatformAssetPayload: (payload: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const commandName = normalizePlayableForgePlayCommandName(context.name);
  if (commandName === PLAYABLE_FORGE_PLAY_COMMAND.ASSET_LIBRARY_REFRESH) {
    await refreshEditorAssetLibrary({
      payload: context.payload,
      harness: context.harness,
      ensureEditorMode: context.ensureEditorMode,
      runWithAssetLoadingOverlay: context.runWithAssetLoadingOverlay,
    });
    return;
  }
  if (commandName === PLAYABLE_FORGE_PLAY_COMMAND.ASSET_IMPORT || commandName === PLAYABLE_FORGE_PLAY_COMMAND.ASSETS_LOADED) {
    await importPlatformAsset({
      payload: context.payload,
      harness: context.harness,
      ensureEditorMode: context.ensureEditorMode,
      runWithAssetLoadingOverlay: context.runWithAssetLoadingOverlay,
      normalizeLoadedPlatformAssetPayload,
    });
    return;
  }
  if (commandName === PLAYABLE_FORGE_PLAY_COMMAND.EDITOR_ASSET_PLACE) {
    await placeEditorAsset({
      payload: context.payload,
      harness: context.harness,
      ensureEditorMode: context.ensureEditorMode,
      runWithAssetLoadingOverlay: context.runWithAssetLoadingOverlay,
      normalizeLoadedPlatformAssetPayload,
    });
  }
}

async function handleLegacyProjectAssetCommand(
  commandName: string,
  payload: Record<string, unknown>,
  normalizeLoadedPlatformAssetPayload: (payload: Record<string, unknown>) => Record<string, unknown>,
  host: PlayableLocalEditorHost<EditorSceneDocument> | null,
): Promise<void> {
  if (!host) return;
  const bridge = host.getBridge();
  const ensureEditorMode = async (): Promise<void> => {
    if (bridge) {
      if (bridge.getMode() !== 'edit') await bridge.switchMode('edit');
      return;
    }
    if (!host.harness.getWorkingDocument()) await host.enterEditor();
  };
  const context: PlayableLocalEditorHostBridgeContext<PlayableLocalEditorHarnessApi<EditorSceneDocument>> = {
    name: commandName,
    payload,
    harness: host.harness,
    ensureEditorMode,
    runWithAssetLoadingOverlay: host.runWithAssetLoadingOverlay,
    postEvent: postForgePlayEvent,
    getBridge: host.getBridge,
  };
  await handleProjectAssetCommand(context, normalizeLoadedPlatformAssetPayload);
}

async function refreshEditorAssetLibrary(input: {
  payload: Record<string, unknown>;
  harness: PlayableLocalEditorHarnessApi<EditorSceneDocument>;
  ensureEditorMode: () => Promise<void>;
  runWithAssetLoadingOverlay: <T>(operation: () => Promise<T>) => Promise<T>;
}): Promise<void> {
  const requestId = readOptionalString(input.payload.requestId);
  try {
    await input.ensureEditorMode();
    await input.runWithAssetLoadingOverlay(async () => {
      const result = await input.harness.reloadAssets();
      postForgePlayEvent(PLAYABLE_FORGE_PLAY_EVENT.ASSET_LIBRARY_REFRESHED, {
        ...(requestId ? { requestId } : {}),
        ...result,
      });
    });
  } catch (error) {
    postForgePlayEvent(PLAYABLE_FORGE_PLAY_EVENT.ASSET_LIBRARY_REFRESHED, {
      ...(requestId ? { requestId } : {}),
      ok: false,
      assetCount: 0,
      status: 'Asset reload failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function importPlatformAsset(input: {
  payload: Record<string, unknown>;
  harness: PlayableLocalEditorHarnessApi<EditorSceneDocument>;
  ensureEditorMode: () => Promise<void>;
  runWithAssetLoadingOverlay: <T>(operation: () => Promise<T>) => Promise<T>;
  normalizeLoadedPlatformAssetPayload: (payload: Record<string, unknown>) => Record<string, unknown>;
}): Promise<void> {
  const requestId = readOptionalString(input.payload.requestId);
  const normalizedPayload = input.normalizeLoadedPlatformAssetPayload(input.payload);
  try {
    await input.ensureEditorMode();
    await input.runWithAssetLoadingOverlay(async () => {
      const registered = await registerPlatformAssetIfNeeded(normalizedPayload);
      const refresh = await input.harness.reloadAssets();
      const assetType = readPlayablePlatformAssetKind(normalizedPayload);
      const created = input.harness.createAssetFromAssetId(registered.assetId, {
        placement: readPlayablePlatformAssetPlacement(normalizedPayload, {
          projectDropPoint: projectPlatformDropPointToGround,
        }),
      });
      postForgePlayEvent(PLAYABLE_FORGE_PLAY_EVENT.ASSET_IMPORT_RESULT, {
        ...(requestId ? { requestId } : {}),
        ok: created.ok,
        guid: registered.guid,
        assetId: registered.assetId,
        kind: assetType === 'texture' ? 'texture' : 'model',
        external: registered.external,
        nodeId: created.createdId ?? undefined,
        assetCount: refresh.assetCount,
        status: created.status,
        ...(created.error ? { error: created.error } : {}),
      });
    });
  } catch (error) {
    postForgePlayEvent(PLAYABLE_FORGE_PLAY_EVENT.ASSET_IMPORT_RESULT, {
      ...(requestId ? { requestId } : {}),
      ok: false,
      assetId: readOptionalString(normalizedPayload.projectAssetId) ?? '',
      external: readPlayablePlatformAssetExternal(input.payload),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function placeEditorAsset(input: {
  payload: Record<string, unknown>;
  harness: PlayableLocalEditorHarnessApi<EditorSceneDocument>;
  ensureEditorMode: () => Promise<void>;
  runWithAssetLoadingOverlay: <T>(operation: () => Promise<T>) => Promise<T>;
  normalizeLoadedPlatformAssetPayload: (payload: Record<string, unknown>) => Record<string, unknown>;
}): Promise<void> {
  const requestId = readOptionalString(input.payload.requestId);
  const normalizedPayload = input.normalizeLoadedPlatformAssetPayload(input.payload);
  let assetId = readOptionalString(normalizedPayload.projectAssetId) ?? '';
  try {
    await input.ensureEditorMode();
    await input.runWithAssetLoadingOverlay(async () => {
      assetId = await resolvePlatformAssetId(normalizedPayload);
      const created = input.harness.createAssetFromAssetId(assetId, {
        placement: readPlayablePlatformAssetPlacement(normalizedPayload, {
          projectDropPoint: projectPlatformDropPointToGround,
        }),
      });
      postForgePlayEvent(PLAYABLE_FORGE_PLAY_EVENT.EDITOR_ASSET_PLACE_RESULT, {
        ...(requestId ? { requestId } : {}),
        ok: created.ok,
        assetId,
        nodeId: created.createdId ?? undefined,
        status: created.status,
        ...(created.error ? { error: created.error } : {}),
      });
    });
  } catch (error) {
    postForgePlayEvent(PLAYABLE_FORGE_PLAY_EVENT.EDITOR_ASSET_PLACE_RESULT, {
      ...(requestId ? { requestId } : {}),
      ok: false,
      assetId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function installLegacyAssetCommandBypass(
  handleCommand: (name: string, params: Record<string, unknown>) => Promise<void>,
): () => void {
  const patchLegacyRuntime = (): void => {
    const bridgeState = (window as any).__BRIDGE_EDITOR_RUNTIME_STATE;
    const currentRuntime = bridgeState?.runtime;
    const previousLegacy = bridgeState?.legacyRuntime
      ?? (window as any).__bridgeLegacyEditorRuntime
      ?? (currentRuntime?.owner === 'legacy' ? currentRuntime : null);
    if (!previousLegacy || previousLegacy[LOCAL_EDITOR_LEGACY_ASSET_BYPASS_FLAG]) return;

    const originalLegacy = previousLegacy[LOCAL_EDITOR_ORIGINAL_LEGACY_ASSET_RUNTIME] ?? previousLegacy;
    const proxy = {
      owner: 'legacy',
      Editor: originalLegacy.Editor,
      Edit: originalLegacy.Edit,
      async handleCommand(name: string, params: Record<string, unknown>) {
        const commandName = normalizePlayableForgePlayCommandName(name);
        if (commandName && PLAYABLE_FORGE_PLAY_PROJECT_ASSET_COMMANDS.has(commandName)) {
          await handleCommand(name, params);
          return;
        }
        await originalLegacy?.handleCommand?.(name, params);
      },
      [LOCAL_EDITOR_LEGACY_ASSET_BYPASS_FLAG]: true,
      [LOCAL_EDITOR_ORIGINAL_LEGACY_ASSET_RUNTIME]: originalLegacy,
    };

    if (bridgeState) {
      if (bridgeState.runtime === previousLegacy) bridgeState.runtime = proxy;
      bridgeState.legacyRuntime = proxy;
    }
    (window as any).__bridgeLegacyEditorRuntime = proxy;
  };

  const patchRegisterRuntime = (): void => {
    const bridge = (window as any).__bridge;
    if (!bridge || bridge[LOCAL_EDITOR_LEGACY_REGISTER_PATCH_FLAG]) return;
    const originalRegister = typeof bridge.registerEditorRuntime === 'function'
      ? bridge.registerEditorRuntime.bind(bridge)
      : null;
    if (!originalRegister) return;
    bridge.registerEditorRuntime = (runtime: unknown) => {
      originalRegister(runtime);
      patchLegacyRuntime();
    };
    bridge[LOCAL_EDITOR_LEGACY_REGISTER_PATCH_FLAG] = true;
  };

  const refreshPatch = (): void => {
    patchRegisterRuntime();
    patchLegacyRuntime();
  };

  refreshPatch();
  const intervalId = window.setInterval(refreshPatch, 500);
  return () => window.clearInterval(intervalId);
}

async function registerPlatformAssetIfNeeded(payload: Record<string, unknown>): Promise<{ guid?: string; assetId: string; external?: PlayablePlatformAssetExternal }> {
  return registerPlayablePlatformAssetWithSdk(payload, {
    commandName: 'npm run asset:register',
    cwd: '.',
    findExistingAsset: findExistingPlatformEditorAsset,
    writeFile: writePlayableAuthoringFile,
    runCommand: runPlayableAuthoringCommand,
  });
}

function setLocalEditorAssetBridgeActive(active: boolean): void {
  (window as any)[LOCAL_EDITOR_ASSET_BRIDGE_ACTIVE_FLAG] = active;
}

async function findExistingPlatformEditorAsset(
  payload: Record<string, unknown>,
): Promise<{ guid?: string; assetId: string; external?: PlayablePlatformAssetExternal } | null> {
  const projectAssetId = readOptionalString(payload.projectAssetId);
  const platformAssetId = readPlayablePlatformRawAssetId(payload);
  const expectedKind = readPlayablePlatformAssetKind(payload) === 'texture' ? 'texture' : 'model';
  const assetPath = readPlayablePlatformAssetPath(payload);

  try {
    const assetsModule = await import('../assets');
    const entries = assetsModule.getAssetCatalogEntries({ kind: expectedKind });
    const existing = entries.find((entry) => {
      if (projectAssetId && entry.assetId === projectAssetId) return true;
      if (platformAssetId && entry.external?.platformAssetId === platformAssetId) return true;
      if (assetPath && entry.external?.assetPath === assetPath) return true;
      return false;
    });
    if (existing) {
      return {
        guid: existing.guid,
        assetId: existing.assetId,
        external: existing.external,
      };
    }
  } catch {}

  return null;
}

async function resolvePlatformAssetId(payload: Record<string, unknown>): Promise<string> {
  const projectAssetId = readOptionalString(payload.projectAssetId);
  if (projectAssetId) return projectAssetId;
  const existing = await findExistingPlatformEditorAsset(payload);
  if (existing) return existing.assetId;
  throw new Error('project assetId was not found for platform asset');
}

function projectPlatformDropPointToGround(point: PlayablePlatformAssetDropPoint | null): { x: number; y: number; z: number } | null {
  if (!point) return null;
  const babylon = (window as any).BABYLON;
  const scene = babylon?.EngineStore?.LastCreatedScene;
  const camera = scene?.activeCamera;
  const canvas = document.getElementById('renderCanvas');
  if (!babylon || !scene || !camera || !(canvas instanceof HTMLCanvasElement)) return null;
  const rect = canvas.getBoundingClientRect();
  const clientX = point.x >= 0 && point.x <= 1 ? point.x * window.innerWidth : point.x;
  const clientY = point.y >= 0 && point.y <= 1 ? point.y * window.innerHeight : point.y;
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;
  if (canvasX < 0 || canvasY < 0 || canvasX > rect.width || canvasY > rect.height) return null;
  const ray = scene.createPickingRay(canvasX, canvasY, babylon.Matrix.Identity(), camera, false);
  if (!ray?.direction || Math.abs(ray.direction.y) < 0.000001) return null;
  const t = -ray.origin.y / ray.direction.y;
  if (!Number.isFinite(t) || t < 0) return null;
  const hit = ray.origin.add(ray.direction.scale(t));
  return { x: hit.x, y: 0, z: hit.z };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function exportForgePlayDocument(
  harness: PlayableLocalEditorHarnessApi,
  payload: Record<string, unknown>,
  saveState: PlayableForgePlaySaveState,
): Promise<void> {
  const requestId = readPlayableForgePlayRequestId(payload);
  const workingDocument = harness.getWorkingDocument();
  if (!workingDocument) throw new Error('editor_document_unavailable');
  const assets = await loadEditorAssetLibrary();
  const editorScene = enrichEditorSceneDocumentAssets(workingDocument as EditorSceneDocument, assets);
  const prepared = await saveSceneMainSource(editorScene, { mode: 'prepare-platform-save' });
  const sceneJsonText = readPreparedSceneJsonText(prepared.sceneJsonText, prepared.compiledArtifact?.data, prepared.document);
  saveState.preparedRevision += 1;
  saveState.committedRevision = 0;
  postForgePlayEvent(PLAYABLE_FORGE_PLAY_EVENT.DOCUMENT_EXPORTED, {
    ...(requestId ? { requestId } : {}),
    sceneJsonText,
    ...(typeof prepared.expectedVersion === 'number'
      ? { expectedVersion: prepared.expectedVersion }
      : readBaseSceneVersion() !== undefined
        ? { expectedVersion: readBaseSceneVersion() }
        : {}),
  });
}

function readPreparedSceneJsonText(
  sceneJsonText: string | undefined,
  compiledArtifactData: unknown,
  editorScene: EditorSceneDocument,
): string {
  if (typeof sceneJsonText === 'string' && sceneJsonText.trim()) return sceneJsonText;
  if (compiledArtifactData && typeof compiledArtifactData === 'object' && !Array.isArray(compiledArtifactData)) {
    return `${JSON.stringify(compiledArtifactData, null, 2)}\n`;
  }
  const compiled = compileEditorSceneDocumentToSceneConfig(editorScene, baseSceneConfig as SceneConfig);
  return `${JSON.stringify(compiled.sceneConfig, null, 2)}\n`;
}

function readBaseSceneVersion(): number | undefined {
  const version = (baseSceneConfig as unknown as { version?: unknown }).version;
  return typeof version === 'number' ? version : undefined;
}

function summarizeEditorScene(editorScene: EditorSceneDocument): string {
  return `editorScene assets=${editorScene.assets.length}, gameObjects=${editorScene.scene.gameObjects.length}`;
}

function describeEditorSceneAgentObject(
  editorScene: EditorSceneDocument,
  objectId: string,
) {
  const gameObject = findEditorSceneAgentGameObject(editorScene, objectId);
  if (!gameObject) return null;
  const nodeKind = readEditorSceneNodeKind(gameObject);
  const asset = findEditorSceneAgentAsset(editorScene, gameObject);
  const label = gameObject.name || gameObject.id;
  return {
    domainKind: `pa-template:${nodeKind}`,
    domainRole: resolveEditorSceneAgentGameplayRole(gameObject),
    functionLabel: label,
    functionDescription: asset
      ? `${label} is a ${nodeKind} scene node using asset ${asset.displayName || asset.id}.`
      : `${label} is a ${nodeKind} scene node in the editable scene document.`,
    domainHints: [
      `Interpret this as a ${nodeKind} node from pa_template's scene graph.`,
      ...(asset ? [`Asset reference: ${asset.displayName || asset.id}.`] : []),
    ],
    bindingCandidates: [
      {
        kind: 'scene-node',
        id: gameObject.id,
        label,
        path: `scene.gameObjects.${gameObject.id}`,
      },
      ...(asset ? [{
        kind: 'scene-asset',
        id: asset.id,
        label: asset.displayName || asset.id,
        path: `assets.${asset.id}`,
      }] : []),
    ],
    sourceRefs: [
      {
        kind: 'scene-document',
        path: 'scene.gameObjects',
        label,
      },
    ],
    metadata: {
      nodeKind,
      ...(asset ? { assetId: asset.id, assetDisplayName: asset.displayName || asset.id } : {}),
    },
  };
}

function describeEditorSceneAgentObjectSet(
  editorScene: EditorSceneDocument,
  objectIds: readonly string[],
) {
  const gameObjects = findEditorSceneAgentGameObjects(editorScene, objectIds);
  if (gameObjects.length === 0) return null;
  const nodeKinds = [...new Set(gameObjects.map(readEditorSceneNodeKind))];
  return {
    domainKind: 'pa-template:scene-object-set',
    domainRole: 'selection',
    functionLabel: `${gameObjects.length} selected scene nodes`,
    functionDescription: 'A multi-selection from the pa_template scene graph.',
    domainHints: [
      'Consider these nodes together before proposing scene edits or gameplay bindings.',
      `Selected node kinds: ${nodeKinds.join(', ')}.`,
    ],
    relationshipHints: [{
      type: 'selection',
      description: 'The user selected these scene nodes together in the editor hierarchy.',
      primaryObjectId: gameObjects[0]?.id,
      supportingObjectIds: gameObjects.slice(1).map(gameObject => gameObject.id),
    }],
    sourceRefs: gameObjects.map(gameObject => ({
      kind: 'scene-document',
      path: 'scene.gameObjects',
      label: gameObject.name || gameObject.id,
    })),
    metadata: {
      objectCount: gameObjects.length,
      nodeKinds,
    },
  };
}

function describeEditorSceneAgentRegionBinding(
  editorScene: EditorSceneDocument,
  objectIds: readonly string[],
) {
  const gameObjects = findEditorSceneAgentGameObjects(editorScene, objectIds);
  if (gameObjects.length === 0) return null;
  return {
    domainKind: 'pa-template:selection-region',
    domainRole: 'region-binding',
    functionLabel: `${gameObjects.length} nodes as gameplay region`,
    functionDescription: 'The selected scene nodes are being treated as a candidate gameplay region.',
    domainHints: [
      'Use the selected nodes as landmarks or bounds for reasoning about an editable gameplay region.',
      'Prefer suggestions that preserve the selected nodes and describe their spatial relationship.',
    ],
    relationshipHints: [{
      type: 'selection-region',
      description: 'The current multi-selection defines a region relationship for Agent reasoning.',
      primaryObjectId: gameObjects[0]?.id,
      supportingObjectIds: gameObjects.slice(1).map(gameObject => gameObject.id),
    }],
    sourceRefs: gameObjects.map(gameObject => ({
      kind: 'scene-document',
      path: 'scene.gameObjects',
      label: gameObject.name || gameObject.id,
    })),
    metadata: {
      objectCount: gameObjects.length,
      objectIds: gameObjects.map(gameObject => gameObject.id),
    },
  };
}

function findEditorSceneAgentGameObject(
  editorScene: EditorSceneDocument,
  objectId: string,
): EditorSceneGameObject | null {
  return editorScene.scene.gameObjects.find(gameObject => gameObject.id === objectId) ?? null;
}

function findEditorSceneAgentGameObjects(
  editorScene: EditorSceneDocument,
  objectIds: readonly string[],
): EditorSceneGameObject[] {
  const requested = new Set(objectIds);
  return editorScene.scene.gameObjects.filter(gameObject => requested.has(gameObject.id));
}

function findEditorSceneAgentAsset(
  editorScene: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): EditorSceneAssetLibraryItem | null {
  const renderer = findEditorSceneModelRenderer(gameObject);
  const instanceAssetId = (gameObject as { instance?: { assetId?: string } }).instance?.assetId;
  const assetId = renderer?.assetId ?? instanceAssetId;
  if (!assetId) return null;
  return editorScene.assets.find(asset => asset.id === assetId) as EditorSceneAssetLibraryItem | undefined ?? null;
}

function resolveEditorSceneAgentGameplayRole(gameObject: EditorSceneGameObject): string {
  const nodeKind = readEditorSceneNodeKind(gameObject);
  if (gameObject.camera) return 'camera';
  if (gameObject.light) return 'light';
  if (gameObject.groundDecal) return 'ground-decal';
  if (findEditorSceneModelRenderer(gameObject)) return 'asset-instance';
  if (gameObject.primitive) return `primitive-${gameObject.primitive.shape}`;
  return nodeKind;
}
