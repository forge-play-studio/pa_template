import {
  createLocalEditorHarness,
  type LocalEditorHarness,
  type LocalEditorHarnessMultiPropertyInput,
  type LocalEditorHarnessPropertyInput,
  type LocalEditorHarnessTransformBatchInput,
  type LocalEditorHarnessTransformInput,
} from '@fps-games/editor';
import { createProjectAuthoringHost, type EditorTransformSnapshot } from '@fps-games/editor-core';
import type {
  BabylonEditorProjectionImportContext,
  BabylonEditorProjectionImportResult,
  BabylonEditorProjectionNode,
  BabylonSceneCameraPreviewRig,
} from '@fps-games/editor-babylon';
import { createBabylonEditorInfiniteGrid } from '@fps-games/editor-babylon';
import baseSceneConfig from '../config/scene.json';
import type { SceneConfig } from '../config/types';
import type { EditorSceneDocument } from '../fps-game-editor-adapter/editor-scene-document';
import {
  findEditorSceneModelRenderer,
  findEditorScenePrimitiveRenderer,
  findEditorSceneTransform,
  type EditorSceneAssetLibraryItem,
  type EditorSceneGameObject,
} from '../fps-game-editor-adapter/editor-scene-document';
import { enrichEditorSceneDocumentAssets } from '../fps-game-editor-adapter/editor-asset-library';
import {
  collectEditorSceneSubtreeIdList,
  createEditorSceneCreateGroupPatch,
  createEditorSceneCreatePrimitivePatch,
  createEditorSceneDeleteSubtreePatch,
  createEditorSceneDuplicateSelectionPatch,
  createEditorSceneGroupSelectionPatch,
  createEditorSceneHierarchyMovePatch,
  createEditorSceneInspectorPropertyPatch,
  createEditorScenePlacedAssetPatch,
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
  getEditorSceneGameObjectWorldTransform,
  normalizeEditorSceneHierarchyDocument,
  isEditorSceneCameraGameObject,
  isEditorSceneLightGameObject,
  reduceEditorSceneDocument,
  toEditorSceneLocalTransformFromWorld,
  validateEditorSceneGroupSelection,
  validateEditorSceneHierarchyMove,
  validateEditorSceneReparent,
  type EditorSceneDocumentPatch,
} from '../fps-game-editor-adapter/editor-scene-session';
import {
  createSceneMainSourceDriver,
  loadEditorAssetLibrary,
  loadSceneMainSource,
  saveSceneMainSource,
} from '../fps-game-editor-adapter/scene-main-source-driver';
import { compileEditorSceneDocumentToSceneConfig } from '../fps-game-editor-adapter/editor-scene-compiler';

type BabylonModule = Record<string, any>;

export interface LocalEditorModeSwitcherOptions {
  root?: HTMLElement;
  disposeGameWorld: () => void;
  onBeforeReload?: () => void;
}

export interface LocalEditorModeSwitcher {
  enterEditor(): Promise<void>;
  discardAndRunGame(): Promise<void>;
  dispose(): void;
}

type EditorLoadingOverlayContent = {
  title: string;
  description: string;
};

type EditorLoadingOverlayController = {
  show(content: EditorLoadingOverlayContent): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
};

const EDITOR_LOADING_OVERLAY_CONTENT: Record<'enter' | 'saveScene' | 'saveAndRunGame' | 'discardAndRunGame' | 'assetImport', EditorLoadingOverlayContent> = {
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

const MIN_ASSET_LOADING_OVERLAY_MS = 500;

export function mountLocalEditorModeSwitcher(options: LocalEditorModeSwitcherOptions): LocalEditorModeSwitcher {
  const sceneMainSourceDriver = createSceneMainSourceDriver();
  const editorLoadingOverlay = createEditorLoadingOverlay(options.root ?? document.body);
  let assetLoadingCount = 0;
  let assetLoadingOverlayOwned = false;
  let assetLoadingOverlayShownAt = 0;
  const runWithAssetLoadingOverlay = async <T>(operation: () => Promise<T>): Promise<T> => {
    const shouldShowAssetLoading = !editorLoadingOverlay.isVisible() && !assetLoadingOverlayOwned;
    assetLoadingCount += 1;
    if (shouldShowAssetLoading) {
      assetLoadingOverlayOwned = true;
      assetLoadingOverlayShownAt = Date.now();
      editorLoadingOverlay.show(EDITOR_LOADING_OVERLAY_CONTENT.assetImport);
      await waitForEditorLoadingOverlayPaint();
    }

    try {
      return await operation();
    } finally {
      assetLoadingCount = Math.max(0, assetLoadingCount - 1);
      if (assetLoadingCount === 0 && assetLoadingOverlayOwned) {
        const elapsed = Date.now() - assetLoadingOverlayShownAt;
        const remaining = MIN_ASSET_LOADING_OVERLAY_MS - elapsed;
        if (remaining > 0) await waitForMilliseconds(remaining);
        if (assetLoadingCount === 0 && assetLoadingOverlayOwned) {
          assetLoadingOverlayOwned = false;
          editorLoadingOverlay.hide();
        }
      }
    }
  };
  const importProjectionModelWithLoading = async (
    context: BabylonEditorProjectionImportContext,
  ): Promise<BabylonEditorProjectionImportResult | null> => {
    return runWithAssetLoadingOverlay(() => importEditorProjectionModel(context));
  };
  const authoringHost = createProjectAuthoringHost({
    drivers: [sceneMainSourceDriver],
  });
  const harness: LocalEditorHarness<EditorSceneDocument> = createLocalEditorHarness<EditorSceneDocument, EditorSceneDocumentPatch, EditorSceneAssetLibraryItem>({
    root: options.root,
    localTestActions: window.parent === window,
    authoringHost,
    documentAdapter: {
      prepareDocument: (document, assets) => normalizeEditorSceneHierarchyDocument(
        ensureEditorSceneEnvironmentDefaults(enrichEditorSceneDocumentAssets(document, assets)),
      ),
      reduceDocument: reduceEditorSceneDocument,
      getSerializedObject: getEditorSceneSerializedObject,
      getSerializedMultiObject: getEditorSceneSerializedMultiObject,
      getInspectorObject: getEditorSceneInspectorObject,
      getInspectorMultiObject: getEditorSceneInspectorMultiObject,
      getRuntimeInspectorSections: getEditorSceneRuntimeInspectorSections,
      getHierarchyItems: getEditorSceneHierarchyItems,
      getProjectionNodes: createProjectionNodes,
      getProjectionNode: (document, id) => {
        const gameObject = document.scene.gameObjects.find((entry) => entry.id === id);
        return gameObject ? createProjectionNode(document, gameObject) : null;
      },
      getSceneCameraPreviewRig: createSceneCameraPreviewRig,
      isSelectable: (_document, id) => id !== 'root',
      isLocked: () => false,
      createPatchFromAsset: (assetItem, input) => ({
        label: `Add ${assetItem.displayName}`,
        patch: {
          kind: 'game-object.create-from-asset',
          assetItem,
          ...(input?.placement ? { placement: input.placement } : {}),
        },
      }),
      createPlacedAssetPatch: createEditorScenePlacedAssetPatch,
      findCreatedId: (beforeDocument, afterDocument) => {
        const beforeIds = new Set(beforeDocument.scene.gameObjects.map((gameObject) => gameObject.id));
        return afterDocument.scene.gameObjects.find((gameObject) => !beforeIds.has(gameObject.id))?.id ?? null;
      },
      createSerializedPropertyPatch: createEditorSceneSerializedPropertyPatch,
      createSerializedMultiPropertyPatch: createEditorSceneSerializedMultiPropertyPatch,
      createTransformPatch: createEditorSceneTransformPatch,
      createTransformBatchPatch: createEditorSceneTransformBatchPatch,
      createDuplicateSelectionPatch: createEditorSceneDuplicateSelectionPatch,
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
      summarize: summarizeEditorScene,
    },
    persistenceAdapter: {
      async loadAuthoringSource() {
        const loaded = await loadSceneMainSource();
        authoringHost.registerSource(loaded.source);
        return {
          source: loaded.source,
          document: loaded.document,
          summary: loaded.summary,
        };
      },
      loadAssets: loadEditorAssetLibrary,
      runGame() {
        options.onBeforeReload?.();
        window.location.reload();
      },
    },
    worldAdapter: {
      disposeGameWorld: options.disposeGameWorld,
      getCanvas() {
        const canvas = document.getElementById('renderCanvas');
        if (!(canvas instanceof HTMLCanvasElement)) return null;
        return canvas;
      },
      loadBabylon: () => import('@babylonjs/core') as Promise<BabylonModule>,
      createEngine(babylon, canvas) {
        return new babylon.Engine(canvas, true, {
          preserveDrawingBuffer: true,
          stencil: true,
          antialias: true,
        });
      },
      importProjectionModel: importProjectionModelWithLoading,
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
          disabled: asset.placeable === false,
        };
      },
    },
    world: {
      cameraTarget: { x: 0, y: 0.6, z: 0 },
      cameraRadius: 12,
      clearColor: { r: 0.055, g: 0.07, b: 0.09, a: 1 },
      useRightHandedSystem: true,
    },
    createGrid: createEditorGrid,
  });

  const rawEnterEditor = harness.enterEditor.bind(harness);
  const rawSaveScene = harness.saveScene.bind(harness);
  const rawDiscardAndRunGame = harness.discardAndRunGame.bind(harness);
  const enterEditorWithLoading = async (): Promise<void> => {
    editorLoadingOverlay.show(EDITOR_LOADING_OVERLAY_CONTENT.enter);
    try {
      await rawEnterEditor();
    } finally {
      editorLoadingOverlay.hide();
    }
  };
  const showLoadingOverlayIfNeeded = (content: EditorLoadingOverlayContent): void => {
    if (!editorLoadingOverlay.isVisible()) editorLoadingOverlay.show(content);
  };
  const saveAndRunGameWithLoading = async (): Promise<boolean> => {
    showLoadingOverlayIfNeeded(EDITOR_LOADING_OVERLAY_CONTENT.saveAndRunGame);
    try {
      await waitForEditorLoadingOverlayPaint();
      const saved = await rawSaveScene();
      if (!saved) {
        editorLoadingOverlay.hide();
        return false;
      }
      await rawDiscardAndRunGame();
      return true;
    } catch (error) {
      editorLoadingOverlay.hide();
      throw error;
    }
  };
  const discardAndRunGameWithLoading = async (): Promise<void> => {
    showLoadingOverlayIfNeeded(EDITOR_LOADING_OVERLAY_CONTENT.discardAndRunGame);
    try {
      await waitForEditorLoadingOverlayPaint();
      await rawDiscardAndRunGame();
    } catch (error) {
      editorLoadingOverlay.hide();
      throw error;
    }
  };
  harness.enterEditor = enterEditorWithLoading;
  harness.saveAndRunGame = saveAndRunGameWithLoading;
  harness.discardAndRunGame = discardAndRunGameWithLoading;

  const disposeForgePlayBridge = installForgePlayModeBridge(harness, editorLoadingOverlay, runWithAssetLoadingOverlay);

  return {
    enterEditor: () => enterEditorWithLoading(),
    discardAndRunGame: () => discardAndRunGameWithLoading(),
    dispose() {
      disposeForgePlayBridge();
      editorLoadingOverlay.dispose();
      harness.dispose();
    },
  };
}

function createEditorLoadingOverlay(root: HTMLElement): EditorLoadingOverlayController {
  const ownerDocument = root.ownerDocument ?? document;
  const host = ownerDocument.body ?? root;
  const overlay = ownerDocument.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '2147483000';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.background = 'rgba(7, 11, 20, 0.72)';
  overlay.style.backdropFilter = 'blur(3px)';
  overlay.style.color = '#f8fbff';
  overlay.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  overlay.style.pointerEvents = 'auto';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');

  const panel = ownerDocument.createElement('div');
  panel.style.minWidth = '260px';
  panel.style.maxWidth = 'min(420px, calc(100vw - 48px))';
  panel.style.padding = '24px 28px';
  panel.style.borderRadius = '18px';
  panel.style.background = 'rgba(15, 23, 42, 0.92)';
  panel.style.boxShadow = '0 18px 60px rgba(0, 0, 0, 0.38)';
  panel.style.border = '1px solid rgba(148, 163, 184, 0.26)';
  panel.style.textAlign = 'center';

  const spinner = ownerDocument.createElement('div');
  spinner.style.width = '38px';
  spinner.style.height = '38px';
  spinner.style.margin = '0 auto 16px';
  spinner.style.borderRadius = '999px';
  spinner.style.border = '4px solid rgba(148, 163, 184, 0.28)';
  spinner.style.borderTopColor = '#60a5fa';
  spinner.style.animation = 'project-editor-loading-spin 0.82s linear infinite';

  const title = ownerDocument.createElement('div');
  title.textContent = EDITOR_LOADING_OVERLAY_CONTENT.enter.title;
  title.style.fontSize = '18px';
  title.style.fontWeight = '700';
  title.style.letterSpacing = '0.02em';

  const desc = ownerDocument.createElement('div');
  desc.textContent = EDITOR_LOADING_OVERLAY_CONTENT.enter.description;
  desc.style.marginTop = '8px';
  desc.style.fontSize = '13px';
  desc.style.lineHeight = '1.5';
  desc.style.color = 'rgba(226, 232, 240, 0.82)';

  const style = ownerDocument.createElement('style');
  style.textContent = '@keyframes project-editor-loading-spin { to { transform: rotate(360deg); } }';

  panel.append(spinner, title, desc);
  overlay.append(panel);

  let attached = false;
  let visible = false;

  const ensureAttached = (): void => {
    if (attached) return;
    host.append(style, overlay);
    attached = true;
  };

  return {
    show(content) {
      ensureAttached();
      title.textContent = content.title;
      desc.textContent = content.description;
      overlay.style.display = 'flex';
      visible = true;
    },
    hide() {
      overlay.style.display = 'none';
      visible = false;
    },
    isVisible() {
      return visible;
    },
    dispose() {
      overlay.remove();
      style.remove();
      attached = false;
    },
  };
}

function waitForEditorLoadingOverlayPaint(): Promise<void> {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function waitForMilliseconds(milliseconds: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

function createEditorGrid(BABYLON: BabylonModule, scene: any) {
  return createBabylonEditorInfiniteGrid({
    babylon: BABYLON,
    scene,
    name: 'pa-template-editor-grid',
    halfLineCount: 96,
  });
}

function createProjectionNodes(editorScene: EditorSceneDocument): BabylonEditorProjectionNode[] {
  return editorScene.scene.gameObjects.map((gameObject) => createProjectionNode(editorScene, gameObject));
}

function isEditorSceneRootProjectionNode(gameObject: EditorSceneGameObject): boolean {
  return gameObject.id === 'root';
}

function createProjectionNode(
  editorScene: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): BabylonEditorProjectionNode {
  const transform = findEditorSceneTransform(gameObject);
  const worldTransform = getEditorSceneGameObjectWorldTransform(editorScene, gameObject.id);
  const renderer = findEditorSceneModelRenderer(gameObject);
  const primitive = findEditorScenePrimitiveRenderer(gameObject);
  const asset = renderer
    ? editorScene.assets.find((entry) => entry.id === renderer.assetId)
    : undefined;
  const groundDecalTextureId = !renderer && gameObject.groundDecal?.textureId
    ? gameObject.groundDecal.textureId
    : undefined;
  const runtimeKind = isEditorSceneCameraGameObject(gameObject)
    ? 'camera'
    : isEditorSceneLightGameObject(gameObject)
      ? 'light'
      : undefined;
  return {
    id: gameObject.id,
    name: gameObject.name ?? gameObject.id,
    parentId: gameObject.parentId ?? null,
    active: gameObject.active,
    ...(isEditorSceneRootProjectionNode(gameObject) ? { helperKind: 'root' as const } : {}),
    ...(runtimeKind ? { runtimeKind } : {}),
    ...(gameObject.camera ? { camera: structuredClone(gameObject.camera) } : {}),
    ...(gameObject.light ? { light: structuredClone(gameObject.light) } : {}),
    transform: transform && worldTransform
      ? {
          position: worldTransform.position,
          rotation: worldTransform.rotation,
          scale: worldTransform.scale,
        }
      : undefined,
    asset: asset
      ? {
          id: asset.id,
          transform: asset.defaults?.transform,
          metadata: {
            ...(asset.metadata ?? {}),
            assetId: asset.id,
            ...(asset.guid ? { guid: asset.guid } : {}),
            type: 'model',
            ...(asset.external ? { external: structuredClone(asset.external) } : {}),
          },
        }
      : groundDecalTextureId
        ? {
            id: groundDecalTextureId,
            metadata: {
              ...(gameObject.metadata ?? {}),
              assetId: groundDecalTextureId,
              type: 'texture',
              groundDecal: structuredClone(gameObject.groundDecal),
            },
          }
      : null,
    primitive: primitive
      ? {
          shape: primitive.shape,
        }
      : null,
  };
}

function createSceneCameraPreviewRig(
  editorScene: EditorSceneDocument,
): BabylonSceneCameraPreviewRig | null {
  const camera = editorScene.scene.gameObjects.find(isEditorSceneCameraGameObject);
  if (!camera || camera.active === false) return null;
  return {
    target: { x: 0, y: 0, z: 0 },
    settings: {
      ...DEFAULT_EDITOR_SCENE_CAMERA,
      ...(camera.camera ?? {}),
    },
  };
}

async function importEditorProjectionModel(
  context: BabylonEditorProjectionImportContext,
): Promise<BabylonEditorProjectionImportResult | null> {
  const assetId = readEditorProjectionAssetId(context.asset);
  if (!assetId) return null;
  const assetsModule = await import('../assets');
  if (readProjectionAssetType(context.asset) === 'texture') {
    const textureUrl = resolveEditorProjectionAssetUrl(assetsModule, context.asset, 'texture');
    if (!textureUrl) {
      warnProjectionAssetUrlMissing(context.asset, 'texture');
      return null;
    }
    return createGroundDecalProjectionResult(context, textureUrl);
  }

  await import('@babylonjs/loaders/glTF');
  const { SceneLoader } = await import('@babylonjs/core/Loading/sceneLoader');
  const url = resolveEditorProjectionAssetUrl(assetsModule, context.asset, 'model');
  if (!url) {
    warnProjectionAssetUrlMissing(context.asset, 'model');
    return null;
  }
  const pathInfo = await assetsModule.getModelPathAndFileAsync(url);
  return SceneLoader.ImportMeshAsync(
    '',
    pathInfo.path,
    pathInfo.filename,
    context.scene,
    undefined,
    pathInfo.isDataUrl || pathInfo.isCompressed ? '.glb' : undefined,
  );
}

type EditorAssetsModule = Record<string, any>;

function readEditorProjectionAssetId(asset: unknown): string {
  const value = (asset ?? {}) as Record<string, unknown>;
  return readOptionalString(value.assetId)
    ?? readOptionalString(value.id)
    ?? '';
}

function resolveEditorProjectionAssetUrl(
  assetsModule: EditorAssetsModule,
  asset: unknown,
  kind: 'model' | 'texture',
): string | null {
  const assetId = readEditorProjectionAssetId(asset);
  const metadata = readProjectionAssetMetadata(asset);
  const candidates: unknown[] = [];

  if (assetId) {
    candidates.push(resolveStaticEditorAssetUrl(assetsModule, assetId, kind));

    const catalogEntry = readRecord(readRecord(assetsModule.ASSET_CATALOG)[assetId]);
    const catalogExternal = readRecord(catalogEntry.external);
    candidates.push(
      catalogEntry.url,
      catalogEntry.relativePath,
      catalogExternal.assetUrl,
      catalogExternal.assetPath,
    );
  }

  const metadataExternal = readRecord(metadata.external);
  candidates.push(
    metadata.assetUrl,
    metadata.relativePath,
    metadata.assetPath,
    metadataExternal.assetUrl,
    metadataExternal.assetPath,
  );

  for (const candidate of candidates) {
    const url = resolveRuntimeEditorAssetUrlCandidate(candidate);
    if (url) return url;
  }

  return null;
}

function readProjectionAssetMetadata(asset: unknown): Record<string, unknown> {
  return readRecord(readRecord(asset).metadata);
}

function resolveStaticEditorAssetUrl(
  assetsModule: EditorAssetsModule,
  assetId: string,
  kind: 'model' | 'texture',
): string | null {
  const typedResolver = kind === 'texture'
    ? assetsModule.resolveTextureAssetUrl
    : assetsModule.resolveModelAssetUrl;
  const typedUrl = typeof typedResolver === 'function' ? typedResolver(assetId) : null;
  const fallbackUrl = typeof assetsModule.resolveAssetUrl === 'function'
    ? assetsModule.resolveAssetUrl(assetId)
    : null;
  return resolveRuntimeEditorAssetUrlCandidate(typedUrl)
    ?? resolveRuntimeEditorAssetUrlCandidate(fallbackUrl);
}

function resolveRuntimeEditorAssetUrlCandidate(value: unknown): string | null {
  const raw = readOptionalString(value);
  if (!raw) return null;
  const candidate = raw.replace(/\\/g, '/');
  if (/^(https?:|data:|blob:)/i.test(candidate)) return candidate;
  if (candidate.startsWith('/@fs/')) return candidate;
  if (candidate.startsWith('/src/')) return candidate;

  const projectUrl = normalizeProjectUrlPath(candidate);
  if (projectUrl) return projectUrl;

  const [pathname, suffix] = splitAssetUrlPathAndSuffix(candidate);
  if (pathname.startsWith('/') && pathname.includes('/src/assets/')) return `/@fs${pathname}${suffix}`;

  return resolveGeneratedAssetRelativeUrl(candidate);
}

function resolveGeneratedAssetRelativeUrl(relativePath: string): string | null {
  const directProjectUrl = normalizeProjectUrlPath(relativePath);
  if (directProjectUrl) return directProjectUrl;

  const [pathname, suffix] = splitAssetUrlPathAndSuffix(relativePath.replace(/\\/g, '/'));
  if (!pathname || pathname.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(pathname)) return null;

  const normalized = normalizeUrlPathParts(`src/assets/generated/${pathname}`);
  return normalized ? `/${normalized}${suffix}` : null;
}

function normalizeProjectUrlPath(path: string): string | null {
  const [pathname, suffix] = splitAssetUrlPathAndSuffix(path.replace(/\\/g, '/'));
  const withoutDot = pathname.startsWith('./') ? pathname.slice(2) : pathname;
  if (withoutDot.startsWith('/src/')) return formatProjectAssetUrl(withoutDot.slice(1), suffix);
  if (withoutDot.startsWith('src/')) return formatProjectAssetUrl(withoutDot, suffix);
  if (withoutDot.startsWith('assets/')) return formatProjectAssetUrl(`src/${withoutDot}`, suffix);
  if (withoutDot.startsWith('imported/')) return formatProjectAssetUrl(`src/assets/${withoutDot}`, suffix);
  return null;
}

function formatProjectAssetUrl(path: string, suffix: string): string | null {
  const normalized = normalizeUrlPathParts(path);
  return normalized ? `/${normalized}${suffix}` : null;
}

function splitAssetUrlPathAndSuffix(value: string): [string, string] {
  const suffixIndex = value.search(/[?#]/);
  return suffixIndex === -1 ? [value, ''] : [value.slice(0, suffixIndex), value.slice(suffixIndex)];
}

function normalizeUrlPathParts(path: string): string | null {
  const stack: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!stack.length) return null;
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.length ? stack.join('/') : null;
}

function warnProjectionAssetUrlMissing(asset: unknown, kind: 'model' | 'texture'): void {
  const metadata = readProjectionAssetMetadata(asset);
  console.warn('[LocalEditor] Missing projection asset URL', {
    assetId: readEditorProjectionAssetId(asset),
    kind,
    type: readProjectionAssetType(asset),
    relativePath: metadata.relativePath,
    external: metadata.external,
  });
}

async function createGroundDecalProjectionResult(
  context: BabylonEditorProjectionImportContext,
  textureUrl: string,
): Promise<BabylonEditorProjectionImportResult> {
  const [{ MeshBuilder }, { StandardMaterial }, { Texture }, { Color3 }] = await Promise.all([
    import('@babylonjs/core/Meshes/meshBuilder'),
    import('@babylonjs/core/Materials/standardMaterial'),
    import('@babylonjs/core/Materials/Textures/texture'),
    import('@babylonjs/core/Maths/math.color'),
  ]);
  const decal = readProjectionGroundDecal(context.asset);
  const mesh = MeshBuilder.CreateGround(`${context.node.id}.groundDecalProjection`, {
    width: decal.size.width,
    height: decal.size.depth,
  }, context.scene);
  const mat = new StandardMaterial(`${context.node.id}.groundDecalProjectionMaterial`, context.scene);
  const texture = new Texture(textureUrl, context.scene);
  texture.hasAlpha = true;
  // Ground decal 是 XZ 平面；图片像素行方向与地面 UV 的 V 轴相反。
  // 在贴图层翻转 V 轴，避免旋转 mesh 破坏地贴朝向语义。
  texture.vScale = -1;
  texture.vOffset = 1;
  mat.diffuseTexture = texture;
  mat.useAlphaFromDiffuseTexture = true;
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0, 0, 0);
  mat.backFaceCulling = false;
  mesh.material = mat;
  return { meshes: [mesh], transformNodes: [], animationGroups: [] };
}

function readProjectionAssetType(asset: unknown): string | null {
  const metadata = readProjectionAssetMetadata(asset);
  return readOptionalString(metadata.type)
    ?? readOptionalString(metadata.assetType)
    ?? null;
}

function readProjectionGroundDecal(asset: BabylonEditorProjectionImportContext['asset']): NonNullable<EditorSceneGameObject['groundDecal']> {
  const metadata = (asset as any)?.metadata;
  const groundDecal = metadata && typeof metadata === 'object' ? (metadata as any).groundDecal : null;
  const size = groundDecal && typeof groundDecal === 'object' ? (groundDecal as any).size : null;
  const width = typeof size?.width === 'number' && Number.isFinite(size.width) && size.width > 0 ? size.width : 1;
  const depth = typeof size?.depth === 'number' && Number.isFinite(size.depth) && size.depth > 0 ? size.depth : 1;
  return {
    size: { width, depth },
    color: { r: 1, g: 1, b: 1 },
  };
}

function createEditorSceneSerializedPropertyPatch(
  input: LocalEditorHarnessPropertyInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[]; reprojectIds?: string[] } | null {
  return createEditorSceneInspectorPropertyPatch(input);
}

function createEditorSceneSerializedMultiPropertyPatch(
  input: LocalEditorHarnessMultiPropertyInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  const serializedPath = input.path;
  const value = Number(input.value);
  if (input.targetIds.length === 0 || !serializedPath || !Number.isFinite(value)) return null;
  if (input.targetIds.some((targetId) => isUnsafeGroupRotationOrScale(input.document, targetId, serializedPath))) return null;
  const transform = createTransformFromSerializedPath(serializedPath, value);
  if (!transform) return null;
  return {
    label: `Patch ${serializedPath} on ${input.targetIds.length} objects`,
    patch: {
      kind: 'game-object.transform-batch',
      targets: input.targetIds.map((targetId) => ({
        targetId,
        transform,
      })),
    },
    changedIds: serializedPath.startsWith('transform.')
      ? collectEditorSceneSubtreeIdList(input.document, input.targetIds)
      : input.targetIds,
  };
}

function createEditorSceneTransformPatch(
  input: LocalEditorHarnessTransformInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[] } | null {
  const transform = toEditorSceneLocalTransformFromWorld(input.document, input.targetId, input.after);
  if (!transform) return null;
  if (input.tool !== 'move' && hasEditorSceneDescendants(input.document, input.targetId)) return null;
  return {
    label: `${input.tool} ${input.targetId}`,
    patch: {
      kind: 'game-object.transform',
      targetId: input.targetId,
      transform,
    },
    changedId: input.targetId,
    changedIds: collectEditorSceneSubtreeIdList(input.document, [input.targetId]),
  };
}

function createEditorSceneTransformBatchPatch(
  input: LocalEditorHarnessTransformBatchInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  if (input.targets.length === 0) return null;
  if (hasAncestorDescendantPair(input.document, input.targets.map((target) => target.id))) return null;
  if (input.tool !== 'move' && input.targets.some((target) => hasEditorSceneDescendants(input.document, target.id))) return null;
  const targets = input.targets.flatMap((target) => {
    const transform = toEditorSceneLocalTransformFromWorld(input.document, target.id, target.after);
    return transform ? [{ targetId: target.id, transform }] : [];
  });
  if (targets.length !== input.targets.length) return null;
  return {
    label: `${input.tool} ${input.targets.length} objects`,
    patch: {
      kind: 'game-object.transform-batch',
      targets,
    },
    changedIds: collectEditorSceneSubtreeIdList(input.document, input.targets.map((target) => target.id)),
  };
}

function isUnsafeGroupRotationOrScale(
  editorScene: EditorSceneDocument,
  targetId: string,
  serializedPath: string,
): boolean {
  if (!serializedPath.startsWith('transform.rotation.') && !serializedPath.startsWith('transform.scale.')) {
    return false;
  }
  return hasEditorSceneDescendants(editorScene, targetId);
}

function hasEditorSceneDescendants(editorScene: EditorSceneDocument, targetId: string): boolean {
  return collectEditorSceneSubtreeIdList(editorScene, [targetId]).length > 1;
}

function hasAncestorDescendantPair(editorScene: EditorSceneDocument, ids: string[]): boolean {
  const selected = new Set(ids);
  const byId = new Map(editorScene.scene.gameObjects.map((gameObject) => [gameObject.id, gameObject]));
  for (const id of ids) {
    const seen = new Set<string>();
    let cursor = byId.get(id);
    while (cursor?.parentId && !seen.has(cursor.parentId)) {
      if (selected.has(cursor.parentId)) return true;
      seen.add(cursor.parentId);
      cursor = byId.get(cursor.parentId);
    }
  }
  return false;
}

function createTransformFromSerializedPath(
  path: string,
  value: number,
): Partial<EditorTransformSnapshot> | null {
  const match = path.match(/^transform\.(position|rotation|scale)\.(x|y|z)$/);
  if (!match) return null;
  const vectorName = match[1] as 'position' | 'rotation' | 'scale';
  const axis = match[2] as 'x' | 'y' | 'z';
  const storedValue = vectorName === 'rotation' ? (value * Math.PI) / 180 : value;
  const vector = { [axis]: storedValue };
  return { [vectorName]: vector };
}

const FORGE_PLAY_BRIDGE_SOURCE = 'forge-play-game-bridge';
const FORGE_PLAY_POST_MESSAGE = {
  EVENT: 'event',
  COMMAND: 'command',
} as const;
const FORGE_PLAY_COMMAND = {
  MODE_CHANGE: 'mode.change',
  DOCUMENT_EXPORT: 'document.export',
  DOCUMENT_COMMIT: 'document.commit',
  ASSET_IMPORT: 'asset.import',
  ASSET_LIBRARY_REFRESH: 'asset.library.refresh',
  EDITOR_ASSET_PLACE: 'editor.asset.place',
  ASSETS_DROP: 'assets.drop',
  ASSETS_LOADED: 'assets.loaded',
} as const;
const FORGE_PLAY_EVENT = {
  SCENE_READY: 'scene.ready',
  FIRST_FRAME: 'scene.first_frame',
  MODE_CHANGE: 'mode.change',
  DOCUMENT_EXPORTED: 'document.exported',
  ASSET_IMPORT_RESULT: 'asset.import.result',
  ASSET_LIBRARY_REFRESHED: 'asset.library.refreshed',
  EDITOR_ASSET_PLACE_RESULT: 'editor.asset.place.result',
  SYSTEM_ERROR: 'system.error',
} as const;
const FORGE_PLAY_EVENT_ALIASES: Record<string, string[]> = {
  [FORGE_PLAY_EVENT.SCENE_READY]: ['scene:ready', 'lifecycle:ready'],
  [FORGE_PLAY_EVENT.FIRST_FRAME]: ['scene:first_frame', 'lifecycle:firstFrame'],
  [FORGE_PLAY_EVENT.MODE_CHANGE]: ['mode:change', 'mode:changed'],
  [FORGE_PLAY_EVENT.DOCUMENT_EXPORTED]: ['document:exported'],
  [FORGE_PLAY_EVENT.ASSET_IMPORT_RESULT]: ['asset:import:result'],
  [FORGE_PLAY_EVENT.ASSET_LIBRARY_REFRESHED]: ['asset:library:refreshed'],
  [FORGE_PLAY_EVENT.EDITOR_ASSET_PLACE_RESULT]: ['editor:asset:place:result'],
  [FORGE_PLAY_EVENT.SYSTEM_ERROR]: ['system:error'],
};
const FORGE_PLAY_COMMAND_ALIASES: Record<string, string> = {
  'mode:change': FORGE_PLAY_COMMAND.MODE_CHANGE,
  'document:export': FORGE_PLAY_COMMAND.DOCUMENT_EXPORT,
  'document:commit': FORGE_PLAY_COMMAND.DOCUMENT_COMMIT,
  'asset:import': FORGE_PLAY_COMMAND.ASSET_IMPORT,
  'asset:library:refresh': FORGE_PLAY_COMMAND.ASSET_LIBRARY_REFRESH,
  'editor:asset:place': FORGE_PLAY_COMMAND.EDITOR_ASSET_PLACE,
  'assets:drop': FORGE_PLAY_COMMAND.ASSETS_DROP,
  'assets:loaded': FORGE_PLAY_COMMAND.ASSETS_LOADED,
};
const LOCAL_EDITOR_ASSET_BRIDGE_ACTIVE_FLAG = '__projectLocalEditorAssetBridgeActive';
const LOCAL_EDITOR_LEGACY_ASSET_BYPASS_FLAG = '__projectLegacyAssetBypass';
const LOCAL_EDITOR_ORIGINAL_LEGACY_ASSET_RUNTIME = '__projectOriginalLegacyAssetRuntime';
const LOCAL_EDITOR_LEGACY_REGISTER_PATCH_FLAG = '__projectLegacyRegisterPatch';
const LOCAL_EDITOR_PROJECT_ASSET_COMMANDS = new Set<string>([
  FORGE_PLAY_COMMAND.ASSET_IMPORT,
  FORGE_PLAY_COMMAND.ASSET_LIBRARY_REFRESH,
  FORGE_PLAY_COMMAND.EDITOR_ASSET_PLACE,
  FORGE_PLAY_COMMAND.ASSETS_LOADED,
]);

function postForgePlayEvent(name: string, payload: Record<string, unknown> = {}): void {
  if (window.parent === window) return;
  const post = (eventName: string): void => {
    window.parent.postMessage({
      source: FORGE_PLAY_BRIDGE_SOURCE,
      type: FORGE_PLAY_POST_MESSAGE.EVENT,
      payload: { name: eventName, ...payload },
      timestamp: Date.now(),
    }, '*');
  };
  post(name);
  for (const alias of FORGE_PLAY_EVENT_ALIASES[name] ?? []) {
    if (alias !== name) post(alias);
  }
}

function normalizeForgePlayCommandName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return FORGE_PLAY_COMMAND_ALIASES[value] ?? value;
}

function installForgePlayModeBridge(
  harness: LocalEditorHarness,
  loadingOverlay: Pick<EditorLoadingOverlayController, 'show' | 'hide' | 'isVisible'>,
  runWithAssetLoadingOverlay: <T>(operation: () => Promise<T>) => Promise<T>,
): () => void {
  let currentMode: 'play' | 'edit' = 'play';
  let inFlight: Promise<void> | null = null;
  const saveState = {
    preparedRevision: 0,
    committedRevision: 0,
  };
  let platformSaveOverlayHideTimer: number | null = null;
  setLocalEditorAssetBridgeActive(true);

  function clearPlatformSaveOverlayHideTimer(): void {
    if (platformSaveOverlayHideTimer == null) return;
    window.clearTimeout(platformSaveOverlayHideTimer);
    platformSaveOverlayHideTimer = null;
  }

  function showPlatformSaveOverlay(content: EditorLoadingOverlayContent): void {
    clearPlatformSaveOverlayHideTimer();
    loadingOverlay.show(content);
  }

  function schedulePlatformSaveOverlayHide(): void {
    clearPlatformSaveOverlayHideTimer();
    platformSaveOverlayHideTimer = window.setTimeout(() => {
      platformSaveOverlayHideTimer = null;
      if (currentMode === 'edit') loadingOverlay.hide();
    }, 3000);
  }

  function reportModeChangeError(error: unknown, fallbackMode: 'play' | 'edit'): void {
    const messageText = error instanceof Error ? error.message : String(error);
    console.error('[LocalEditorModeSwitcher] Forge Play mode change failed', error);
    postForgePlayEvent(FORGE_PLAY_EVENT.SYSTEM_ERROR, {
      kind: 'rejection',
      message: messageText,
    });
    postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode: fallbackMode });
  }

  async function switchMode(mode: 'play' | 'edit', options: { save?: boolean } = {}): Promise<void> {
    const exitLoadingContent = mode === 'play'
      ? options.save === true
        ? EDITOR_LOADING_OVERLAY_CONTENT.saveAndRunGame
        : EDITOR_LOADING_OVERLAY_CONTENT.discardAndRunGame
      : null;
    const shouldRunExit = (): boolean => mode === 'play' && harness.getWorkingDocument() !== null;

    if (currentMode === mode && !shouldRunExit()) {
      postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode });
      return;
    }

    if (inFlight) await inFlight;
    if (currentMode === mode && !shouldRunExit()) {
      postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode });
      return;
    }
    inFlight = (async () => {
      if (exitLoadingContent) {
        showPlatformSaveOverlay(exitLoadingContent);
        await waitForEditorLoadingOverlayPaint();
      }
      try {
        if (mode === 'edit') {
          saveState.preparedRevision = 0;
          saveState.committedRevision = 0;
          await harness.enterEditor();
          harness.render();
          currentMode = 'edit';
          postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode: 'edit' });
          return;
        }

        if (options.save === true) {
          const platformCommitAlreadySaved = saveState.preparedRevision > 0
            && saveState.preparedRevision === saveState.committedRevision;
          if (!platformCommitAlreadySaved) {
            const saved = await harness.saveScene();
            if (!saved) {
              if (exitLoadingContent) loadingOverlay.hide();
              reportModeChangeError(new Error('save_failed'), 'edit');
              return;
            }
          }
        }

        await harness.discardAndRunGame();
        currentMode = 'play';
        postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode: 'play' });
      } catch (error) {
        if (exitLoadingContent) loadingOverlay.hide();
        throw error;
      }
    })();

    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
  }

  async function commitPlatformSave(): Promise<void> {
    if (inFlight) await inFlight;

    inFlight = (async () => {
      const saved = await harness.saveScene();
      if (!saved) {
        reportModeChangeError(new Error('save_failed'), 'edit');
        return;
      }
      if (saveState.preparedRevision > 0) {
        saveState.committedRevision = saveState.preparedRevision;
      }
    })();

    try {
      await inFlight;
    } finally {
      inFlight = null;
    }
  }

  async function ensureEditorMode(): Promise<void> {
    if (currentMode === 'edit') return;
    await switchMode('edit');
  }

  const pendingAssetDrops = new Map<string, { point?: { x: number; y: number }; asset?: Record<string, unknown>; timestamp: number }>();

  function rememberPlatformAssetDrop(payload: Record<string, unknown>): void {
    const point = readPlatformDropPoint(payload);
    for (const asset of readPlatformAssetRecords(payload)) {
      const id = readOptionalString(asset.id);
      if (!id) continue;
      pendingAssetDrops.set(id, { point: point ?? undefined, asset, timestamp: Date.now() });
    }
    for (const [id, entry] of pendingAssetDrops) {
      if (Date.now() - entry.timestamp > 30000) pendingAssetDrops.delete(id);
    }
  }

  function normalizeLoadedPlatformAssetPayload(payload: Record<string, unknown>): Record<string, unknown> {
    const asset = readPlatformAssetRecord(payload);
    if (!asset) return payload;
    const id = readOptionalString(asset.id);
    const pending = id ? pendingAssetDrops.get(id) : null;
    if (id) pendingAssetDrops.delete(id);
    return {
      ...payload,
      ...(pending?.asset ?? {}),
      ...asset,
      ...(readOptionalString(asset.name) && !readOptionalString(payload.assetName) ? { assetName: readOptionalString(asset.name) } : {}),
      ...(readOptionalString(asset.assetPath) && !readOptionalString(payload.assetPath) ? { assetPath: readOptionalString(asset.assetPath) } : {}),
      ...(readOptionalString(asset.url) && !readOptionalString(payload.assetUrl) ? { assetUrl: readOptionalString(asset.url) } : {}),
      ...(pending?.point && !readPlatformDropPoint(payload) ? { point: pending.point } : {}),
    };
  }

  async function refreshEditorAssetLibrary(payload: Record<string, unknown>): Promise<void> {
    const requestId = readOptionalString(payload.requestId);
    try {
      await ensureEditorMode();
      await runWithAssetLoadingOverlay(async () => {
        const result = await harness.reloadAssets();
        postForgePlayEvent(FORGE_PLAY_EVENT.ASSET_LIBRARY_REFRESHED, {
          ...(requestId ? { requestId } : {}),
          ...result,
        });
      });
    } catch (error) {
      postForgePlayEvent(FORGE_PLAY_EVENT.ASSET_LIBRARY_REFRESHED, {
        ...(requestId ? { requestId } : {}),
        ok: false,
        assetCount: 0,
        status: 'Asset reload failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function importPlatformAsset(payload: Record<string, unknown>): Promise<void> {
    const requestId = readOptionalString(payload.requestId);
    const normalizedPayload = normalizeLoadedPlatformAssetPayload(payload);
    try {
      await ensureEditorMode();
      await runWithAssetLoadingOverlay(async () => {
        const registered = await registerPlatformAssetIfNeeded(normalizedPayload);
        const refresh = await harness.reloadAssets();
        const assetType = readPlatformAssetType(normalizedPayload);
        const created = harness.createAssetFromAssetId(registered.assetId, {
          placement: readPlatformAssetPlacement(normalizedPayload),
        });
        postForgePlayEvent(FORGE_PLAY_EVENT.ASSET_IMPORT_RESULT, {
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
      postForgePlayEvent(FORGE_PLAY_EVENT.ASSET_IMPORT_RESULT, {
        ...(requestId ? { requestId } : {}),
        ok: false,
        assetId: readOptionalString(normalizedPayload.projectAssetId) ?? '',
        external: readPlatformAssetExternal(payload),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function placeEditorAsset(payload: Record<string, unknown>): Promise<void> {
    const requestId = readOptionalString(payload.requestId);
    const normalizedPayload = normalizeLoadedPlatformAssetPayload(payload);
    let assetId = readOptionalString(normalizedPayload.projectAssetId) ?? '';
    try {
      await ensureEditorMode();
      await runWithAssetLoadingOverlay(async () => {
        assetId = await resolvePlatformAssetId(normalizedPayload);
        const created = harness.createAssetFromAssetId(assetId, {
          placement: readPlatformAssetPlacement(normalizedPayload),
        });
        postForgePlayEvent(FORGE_PLAY_EVENT.EDITOR_ASSET_PLACE_RESULT, {
          ...(requestId ? { requestId } : {}),
          ok: created.ok,
          assetId,
          nodeId: created.createdId ?? undefined,
          status: created.status,
          ...(created.error ? { error: created.error } : {}),
        });
      });
    } catch (error) {
      postForgePlayEvent(FORGE_PLAY_EVENT.EDITOR_ASSET_PLACE_RESULT, {
        ...(requestId ? { requestId } : {}),
        ok: false,
        assetId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function handleProjectAssetCommand(name: string, payload: Record<string, unknown>): Promise<void> {
    const commandName = normalizeForgePlayCommandName(name);
    if (commandName === FORGE_PLAY_COMMAND.ASSET_LIBRARY_REFRESH) {
      await refreshEditorAssetLibrary(payload);
      return;
    }
    if (commandName === FORGE_PLAY_COMMAND.ASSET_IMPORT || commandName === FORGE_PLAY_COMMAND.ASSETS_LOADED) {
      await importPlatformAsset(payload);
      return;
    }
    if (commandName === FORGE_PLAY_COMMAND.EDITOR_ASSET_PLACE) {
      await placeEditorAsset(payload);
    }
  }

  const onMessage = (event: MessageEvent): void => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message !== 'object') return;
    if ((message as { source?: string }).source !== FORGE_PLAY_BRIDGE_SOURCE) return;
    if ((message as { type?: string }).type !== FORGE_PLAY_POST_MESSAGE.COMMAND) return;

    const payload = (message as { payload?: Record<string, unknown> }).payload;
    if (!payload) return;
    const commandName = normalizeForgePlayCommandName(payload.name);
    if (commandName === FORGE_PLAY_COMMAND.ASSETS_DROP) {
      rememberPlatformAssetDrop(payload);
      return;
    }
    if (commandName && LOCAL_EDITOR_PROJECT_ASSET_COMMANDS.has(commandName)) {
      event.stopImmediatePropagation();
      void handleProjectAssetCommand(commandName, payload).catch((error) => {
        postForgePlayEvent(FORGE_PLAY_EVENT.SYSTEM_ERROR, {
          kind: 'rejection',
          message: error instanceof Error ? error.message : String(error),
        });
      });
      return;
    }
    if (commandName === FORGE_PLAY_COMMAND.DOCUMENT_EXPORT) {
      showPlatformSaveOverlay(EDITOR_LOADING_OVERLAY_CONTENT.saveScene);
      void exportForgePlayDocument(harness, payload, saveState).catch((error) => {
        loadingOverlay.hide();
        postForgePlayDocumentExportError(payload, error);
      }).then(() => {
        schedulePlatformSaveOverlayHide();
      });
      return;
    }
    if (commandName === FORGE_PLAY_COMMAND.DOCUMENT_COMMIT) {
      showPlatformSaveOverlay(EDITOR_LOADING_OVERLAY_CONTENT.saveScene);
      void commitPlatformSave().catch((error) => {
        loadingOverlay.hide();
        reportModeChangeError(error, currentMode);
      }).then(() => {
        schedulePlatformSaveOverlayHide();
      });
      return;
    }
    if (commandName !== FORGE_PLAY_COMMAND.MODE_CHANGE) return;

    const mode = payload.mode === 'edit' ? 'edit' : payload.mode === 'play' ? 'play' : null;
    if (!mode) return;
    const save = mode === 'play' ? payload.save !== false : false;

    void switchMode(mode, { save }).catch((error) => {
      reportModeChangeError(error, currentMode);
    });
  };

  const disposeLegacyAssetBypass = installLegacyAssetCommandBypass((name, params) => handleProjectAssetCommand(name, params));
  window.addEventListener('message', onMessage, { capture: true });
  queueMicrotask(() => {
    postForgePlayEvent(FORGE_PLAY_EVENT.SCENE_READY, { mode: currentMode });
    postForgePlayEvent(FORGE_PLAY_EVENT.FIRST_FRAME);
    postForgePlayEvent(FORGE_PLAY_EVENT.MODE_CHANGE, { mode: currentMode });
  });

  return () => {
    clearPlatformSaveOverlayHideTimer();
    disposeLegacyAssetBypass();
    setLocalEditorAssetBridgeActive(false);
    window.removeEventListener('message', onMessage, { capture: true });
  };
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
        const commandName = normalizeForgePlayCommandName(name);
        if (commandName && LOCAL_EDITOR_PROJECT_ASSET_COMMANDS.has(commandName)) {
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

type PlatformAssetExternal = {
  platformAssetId?: string;
  assetPath?: string;
  assetUrl?: string;
};

async function registerPlatformAssetIfNeeded(payload: Record<string, unknown>): Promise<{ guid?: string; assetId: string; external?: PlatformAssetExternal }> {
  const assetPath = readPlatformAssetPath(payload);
  const assetType = readPlatformAssetType(payload);
  const existing = await findExistingPlatformEditorAsset(payload);
  if (existing) return existing;
  const projectAssetId = readOptionalString(payload.projectAssetId);
  if (!assetPath && projectAssetId) return { assetId: projectAssetId, external: readPlatformAssetExternal(payload) };
  if (!assetPath) throw new Error('assetPath is required to register a new project asset');

  const assetName = readOptionalString(payload.assetName) ?? readFileName(assetPath) ?? `asset${assetType === 'texture' ? '.png' : '.glb'}`;
  const platformAssetId = readPlatformRawAssetId(payload);
  const payloadPath = `/tmp/forge-play-asset-${platformAssetId ?? projectAssetId ?? Date.now().toString(36)}-${Date.now().toString(36)}.json`;
  const content = {
    sourcePath: assetPath,
    assetPath,
    assetType,
    ...(readOptionalString(payload.assetUrl) ? { assetUrl: readOptionalString(payload.assetUrl) } : {}),
    ...(readOptionalString(payload.guid) ? { guid: readOptionalString(payload.guid) } : {}),
    ...(projectAssetId ? { projectAssetId } : {}),
    ...(platformAssetId ? { platformAssetId } : {}),
    external: readPlatformAssetExternal(payload),
    assetName,
    displayName: readOptionalString(payload.displayName) ?? stripKnownPlatformAssetExtension(assetName),
    ...(readOptionalString(payload.category) ? { category: readOptionalString(payload.category) } : {}),
    ...(payload.defaultScale != null ? { defaultScale: payload.defaultScale } : {}),
    ...(payload.scale != null ? { scale: payload.scale } : {}),
    ...(payload.metadata && typeof payload.metadata === 'object' ? { metadata: payload.metadata } : {}),
  };

  await postProjectAuthoringJson('/file', { path: payloadPath, content });
  const response = await postProjectAuthoringJson('/exec', {
    cmd: `npm run asset:register -- --payload ${payloadPath}`,
    cwd: '.',
  });
  const result = readRecord(response.result);
  const resultExternal = readRecord(result.external);
  return {
    guid: readOptionalString(result.guid),
    assetId: readOptionalString(result.assetId) ?? projectAssetId ?? '',
    external: Object.keys(resultExternal).length > 0
      ? toPlatformAssetExternal(resultExternal)
      : readPlatformAssetExternal(payload),
  };
}

function setLocalEditorAssetBridgeActive(active: boolean): void {
  (window as any)[LOCAL_EDITOR_ASSET_BRIDGE_ACTIVE_FLAG] = active;
}

async function findExistingPlatformEditorAsset(
  payload: Record<string, unknown>,
): Promise<{ guid?: string; assetId: string; external?: PlatformAssetExternal } | null> {
  const projectAssetId = readOptionalString(payload.projectAssetId);
  const platformAssetId = readPlatformRawAssetId(payload);
  const expectedKind = readPlatformAssetType(payload) === 'texture' ? 'texture' : 'model';
  const assetPath = readPlatformAssetPath(payload);

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

async function postProjectAuthoringJson(route: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`/__fps_editor_authoring${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${response.status}`);
  }
  return json as Record<string, unknown>;
}

async function resolvePlatformAssetId(payload: Record<string, unknown>): Promise<string> {
  const projectAssetId = readOptionalString(payload.projectAssetId);
  if (projectAssetId) return projectAssetId;
  const existing = await findExistingPlatformEditorAsset(payload);
  if (existing) return existing.assetId;
  throw new Error('project assetId was not found for platform asset');
}

function readPlatformRawAssetId(payload: Record<string, unknown>): string | null {
  const asset = readPlatformAssetRecord(payload);
  return readOptionalString(payload.platformAssetId)
    ?? readOptionalString(asset?.platformAssetId)
    ?? readOptionalString(payload.assetId)
    ?? readOptionalString(asset?.assetId)
    ?? readOptionalString(asset?.id)
    ?? null;
}

function readPlatformAssetExternal(payload: Record<string, unknown>): PlatformAssetExternal | undefined {
  const externalRecord = readRecord(payload.external);
  const asset = readPlatformAssetRecord(payload);
  const platformAssetId = readOptionalString(externalRecord.platformAssetId)
    ?? readOptionalString(asset?.external && typeof asset.external === 'object' ? (asset.external as Record<string, unknown>).platformAssetId : undefined)
    ?? readPlatformRawAssetId(payload);
  const assetPath = readOptionalString(externalRecord.assetPath) ?? readPlatformAssetPath(payload) ?? undefined;
  const assetUrl = readOptionalString(externalRecord.assetUrl) ?? readPlatformAssetUrl(payload) ?? undefined;
  return toPlatformAssetExternal({ platformAssetId, assetPath, assetUrl });
}

function toPlatformAssetExternal(value: Record<string, unknown>): PlatformAssetExternal | undefined {
  const platformAssetId = readOptionalString(value.platformAssetId);
  const assetPath = readOptionalString(value.assetPath);
  const assetUrl = readOptionalString(value.assetUrl);
  if (!platformAssetId && !assetPath && !assetUrl) return undefined;
  return {
    ...(platformAssetId ? { platformAssetId } : {}),
    ...(assetPath ? { assetPath } : {}),
    ...(assetUrl ? { assetUrl } : {}),
  };
}

function readPlatformAssetPath(payload: Record<string, unknown>): string | null {
  const asset = readPlatformAssetRecord(payload);
  const assetPath = readOptionalString(payload.assetPath)
    ?? readOptionalString(asset?.assetPath)
    ?? readOptionalString(payload.path)
    ?? readOptionalString(asset?.path);
  if (assetPath) return normalizeFsPath(assetPath);
  const assetUrl = readPlatformAssetUrl(payload);
  if (assetUrl?.startsWith('/@fs/')) return normalizeFsPath(assetUrl.slice('/@fs'.length));
  return null;
}

function readPlatformAssetUrl(payload: Record<string, unknown>): string | null {
  const asset = readPlatformAssetRecord(payload);
  return readOptionalString(payload.assetUrl) ?? readOptionalString(asset?.assetUrl) ?? readOptionalString(asset?.url) ?? null;
}

function readPlatformAssetName(payload: Record<string, unknown>): string | null {
  const asset = readPlatformAssetRecord(payload);
  return readOptionalString(payload.assetName) ?? readOptionalString(asset?.assetName) ?? readOptionalString(asset?.name) ?? null;
}

function readPlatformAssetType(payload: Record<string, unknown>): 'model' | 'texture' {
  const asset = readPlatformAssetRecord(payload);
  const explicitType = readOptionalString(payload.assetType)
    ?? readOptionalString(asset?.assetType)
    ?? readOptionalString(asset?.type)
    ?? readOptionalString(asset?.kind);
  if (explicitType && /^(texture|image|png|jpg|jpeg|webp)$/i.test(explicitType)) return 'texture';
  const mimeType = readOptionalString(payload.mimeType) ?? readOptionalString(asset?.mimeType);
  if (mimeType?.toLowerCase().startsWith('image/')) return 'texture';
  const fileName = readPlatformAssetName(payload)
    ?? readFileName(readPlatformAssetPath(payload) ?? '')
    ?? readFileName(readPlatformAssetUrl(payload) ?? '');
  return fileName && isTextureFileName(fileName) ? 'texture' : 'model';
}

function isTextureFileName(value: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(stripUrlQuery(value));
}

function stripKnownPlatformAssetExtension(value: string): string {
  return value.replace(/\.(glb|gltf|png|jpe?g|webp)$/i, '');
}

function readPlatformAssetPlacement(payload: Record<string, unknown>): EditorTransformSnapshot | undefined {
  const position = readVec3(payload.position) ?? projectPlatformDropPointToGround(readPlatformDropPoint(payload));
  if (!position) return undefined;
  return {
    position,
    rotation: readVec3(payload.rotation) ?? { x: 0, y: 0, z: 0 },
    scale: readVec3(payload.scale) ?? readVec3(payload.instanceScale) ?? { x: 1, y: 1, z: 1 },
  };
}

function readPlatformAssetRecord(payload: Record<string, unknown>): Record<string, unknown> | null {
  return readPlatformAssetRecords(payload)[0] ?? null;
}

function readPlatformAssetRecords(payload: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(payload.assets)
    ? payload.assets.filter((asset): asset is Record<string, unknown> => !!asset && typeof asset === 'object' && !Array.isArray(asset))
    : [];
}

function readPlatformDropPoint(payload: Record<string, unknown>): { x: number; y: number } | null {
  const point = payload.point;
  if (!point || typeof point !== 'object') return null;
  const record = point as Record<string, unknown>;
  const x = typeof record.x === 'number' && Number.isFinite(record.x) ? record.x : null;
  const y = typeof record.y === 'number' && Number.isFinite(record.y) ? record.y : null;
  return x == null || y == null ? null : { x, y };
}

function projectPlatformDropPointToGround(point: { x: number; y: number } | null): { x: number; y: number; z: number } | null {
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

function readVec3(value: unknown): { x: number; y: number; z: number } | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const x = typeof record.x === 'number' && Number.isFinite(record.x) ? record.x : null;
  const y = typeof record.y === 'number' && Number.isFinite(record.y) ? record.y : null;
  const z = typeof record.z === 'number' && Number.isFinite(record.z) ? record.z : null;
  return x == null || y == null || z == null ? null : { x, y, z };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readFileName(value: string): string | null {
  const normalized = value.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() ?? null;
}

function normalizeFsPath(value: string): string {
  return value.startsWith('/@fs/') ? value.slice('/@fs'.length) : value;
}

function stripUrlQuery(value: string): string {
  return value.split('?')[0] ?? value;
}

async function exportForgePlayDocument(
  harness: LocalEditorHarness,
  payload: Record<string, unknown>,
  saveState: { preparedRevision: number; committedRevision: number },
): Promise<void> {
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const workingDocument = harness.getWorkingDocument();
  if (!workingDocument) throw new Error('editor_document_unavailable');
  const assets = await loadEditorAssetLibrary();
  const editorScene = enrichEditorSceneDocumentAssets(workingDocument as EditorSceneDocument, assets);
  const prepared = await saveSceneMainSource(editorScene, { mode: 'prepare-platform-save' });
  const sceneJsonText = readPreparedSceneJsonText(prepared.sceneJsonText, prepared.compiledArtifact?.data, prepared.document);
  saveState.preparedRevision += 1;
  saveState.committedRevision = 0;
  postForgePlayEvent(FORGE_PLAY_EVENT.DOCUMENT_EXPORTED, {
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

function postForgePlayDocumentExportError(payload: Record<string, unknown>, error: unknown): void {
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
  const message = error instanceof Error ? error.message : String(error);
  postForgePlayEvent(FORGE_PLAY_EVENT.DOCUMENT_EXPORTED, {
    ...(requestId ? { requestId } : {}),
    error: message,
  });
}

function summarizeEditorScene(editorScene: EditorSceneDocument): string {
  return `editorScene assets=${editorScene.assets.length}, gameObjects=${editorScene.scene.gameObjects.length}`;
}
