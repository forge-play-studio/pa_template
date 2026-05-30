import {
  createLocalEditorHarness,
  type LocalEditorHarness,
  type LocalEditorHarnessMultiPropertyInput,
  type LocalEditorHarnessPropertyInput,
  type LocalEditorHarnessTransformBatchInput,
  type LocalEditorHarnessTransformInput,
} from '@fps-games/editor';
import { createProjectAuthoringHost } from '@fps-games/editor-core';
import {
  createPlayableLocalEditorLifecycleController,
  createPlayableLocalEditorLoadingOverlay,
  createPlayablePlatformAssetDropCache,
  createEditorSceneRuntimePreviewMainCameraRig,
  createEditorSceneRuntimePreviewImportPlan,
  createEditorSceneRuntimePreviewMissingAssetUrlDiagnostic,
  createEditorSceneRuntimePreviewNode,
  createEditorSceneRuntimePreviewNodes,
  createEditorSceneSerializedMultiTransformPatch as createPlayableEditorSceneSerializedMultiTransformPatch,
  createEditorSceneTransformBatchPatch as createPlayableEditorSceneTransformBatchPatch,
  createEditorSceneTransformPatch as createPlayableEditorSceneTransformPatch,
  installPlayableForgePlayModeBridge,
  normalizePlayableForgePlayCommandName,
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
  waitForPlayableLocalEditorPaint,
  writePlayableAuthoringFile,
  type PlayableForgePlaySaveState,
  type PlayableLocalEditorLifecycleController,
  type PlayableLocalEditorLoadingOverlayContent,
  type PlayableLocalEditorLoadingOverlayController,
  type PlayablePlatformAssetDropPoint,
  type PlayablePlatformAssetExternal,
  type EditorSceneRuntimePreviewGroundDecalDescriptor,
} from '@fps-games/editor/playable-sdk';
import type {
  BabylonEditorProjectionImportContext,
  BabylonEditorProjectionImportResult,
  BabylonEditorProjectionNode,
  BabylonSceneCameraPreviewRig,
} from '@fps-games/editor-babylon';
import { createBabylonEditorInfiniteGrid } from '@fps-games/editor-babylon';
import baseSceneConfig from '../config/scene.json';
import type {
  ArtistMaterialProfile,
  SceneConfig,
  SceneMaterialAssetKind,
  SceneNodeMaterialBindingConfig,
} from '../config/types';
import type { EditorSceneDocument } from '../fps-game-editor-adapter/editor-scene-document';
import {
  type EditorSceneAssetLibraryItem,
  type EditorSceneGameObject,
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
  applyEditorRenderingAction,
  applyEditorRenderingPropertyChange,
  getEditorRenderingPanelState,
  hasEditorRenderingDraftChanges,
  resetEditorRenderingDraft,
  resolveEditorWorldRenderingProfile,
} from '../fps-game-editor-adapter/editor-rendering-profile';
import * as editorAssets from '../assets';

type BabylonModule = Record<string, any>;

type ProjectGameRestartContext = {
  reason?: string;
};

type ProjectGameRestartWindow = Window & {
  __restartProjectGame?: (context?: ProjectGameRestartContext) => Promise<void> | void;
};

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

export function mountLocalEditorModeSwitcher(options: LocalEditorModeSwitcherOptions): LocalEditorModeSwitcher {
  const sceneMainSourceDriver = createSceneMainSourceDriver();
  const editorLoadingOverlay = createPlayableLocalEditorLoadingOverlay(options.root ?? document.body);
  let lifecycleController: PlayableLocalEditorLifecycleController | null = null;
  const runWithAssetLoadingOverlay = async <T>(operation: () => Promise<T>): Promise<T> => {
    return lifecycleController
      ? lifecycleController.runWithAssetLoadingOverlay(operation)
      : operation();
  };
  const importProjectionModelWithLoading = async (
    context: BabylonEditorProjectionImportContext,
  ): Promise<BabylonEditorProjectionImportResult | null> => {
    return runWithAssetLoadingOverlay(() => importEditorProjectionModel(context));
  };
  const authoringHost = createProjectAuthoringHost({
    drivers: [sceneMainSourceDriver],
  });
  const editorLightingPreviewAdapter = {
    getWorldAppearance: resolveEditorLightingPreviewProfile,
    getWorldRendering: resolveEditorWorldRenderingProfile,
    getRenderingPanelState: getEditorRenderingPanelState,
    onRenderingAction: applyEditorRenderingAction,
    onRenderingPropertyChange: applyEditorRenderingPropertyChange,
  } as Record<string, unknown>;
  let currentEditorAssetLibrary: EditorSceneAssetLibraryItem[] = [];
  const harness: LocalEditorHarness<EditorSceneDocument> = createLocalEditorHarness<EditorSceneDocument, EditorSceneDocumentPatch, EditorSceneAssetLibraryItem>({
    root: options.root,
    localTestActions: window.parent === window,
    authoringHost,
    documentAdapter: {
      ...editorLightingPreviewAdapter,
      prepareDocument: (document, assets) => {
        currentEditorAssetLibrary = assets;
        return normalizeEditorSceneHierarchyDocument(
          ensureEditorSceneEnvironmentDefaults(enrichEditorSceneDocumentAssets(document, assets)),
        );
      },
      reduceDocument: reduceEditorSceneDocument,
      getSerializedObject: getEditorSceneSerializedObject,
      getSerializedMultiObject: getEditorSceneSerializedMultiObject,
      getInspectorObject: (document, activeId) => getEditorSceneInspectorObject(
        document,
        activeId,
        { textureAssets: createEditorSceneInspectorTextureAssets(currentEditorAssetLibrary) },
      ),
      getInspectorMultiObject: getEditorSceneInspectorMultiObject,
      getRuntimeInspectorSections: getEditorSceneRuntimeInspectorSections,
      getHierarchyItems: getEditorSceneHierarchyItems,
      ...({
        getBrowserAssetItems: createEditorSceneBrowserAssetItems,
        createAssetActionPatch: createEditorSceneAssetActionPatch,
      } as Record<string, unknown>),
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
    },
    createGrid: createEditorGrid,
  });

  const rawDiscardAndRunGame = harness.discardAndRunGame.bind(harness);
  lifecycleController = createPlayableLocalEditorLifecycleController({
    harness: {
      enterEditor: harness.enterEditor.bind(harness),
      saveScene: harness.saveScene.bind(harness),
      async discardAndRunGame() {
        resetEditorRenderingDraft();
        await rawDiscardAndRunGame();
      },
      render: harness.render.bind(harness),
      notifyViewportRevealed: harness.notifyViewportRevealed?.bind(harness),
    },
    loadingOverlay: editorLoadingOverlay,
    content: EDITOR_LOADING_OVERLAY_CONTENT,
  });
  harness.enterEditor = lifecycleController.enterEditor;
  harness.saveAndRunGame = lifecycleController.saveAndRunGame;
  harness.discardAndRunGame = lifecycleController.discardAndRunGame;

  const disposeForgePlayBridge = installForgePlayModeBridge(harness, editorLoadingOverlay, runWithAssetLoadingOverlay);

  return {
    enterEditor: () => lifecycleController.enterEditor(),
    discardAndRunGame: () => lifecycleController.discardAndRunGame(),
    dispose() {
      disposeForgePlayBridge();
      editorLoadingOverlay.dispose();
      harness.dispose();
    },
  };
}

function createEditorGrid(BABYLON: BabylonModule, scene: any, camera?: any) {
  return createBabylonEditorInfiniteGrid({
    babylon: BABYLON,
    scene,
    camera,
    name: 'pa-template-editor-grid',
    halfLineCount: 96,
  });
}

function createEditorSceneBrowserAssetItems(editorScene: EditorSceneDocument) {
  return (editorScene.scene.materialAssets ?? []).map((materialAsset) => ({
    id: `material:${materialAsset.id}`,
    assetId: materialAsset.id,
    kind: 'material',
    label: materialAsset.name || materialAsset.id,
    meta: createEditorSceneMaterialAssetMeta(materialAsset.profile, materialAsset.id),
    preview: createEditorSceneMaterialAssetPreview(materialAsset.profile),
    material: {
      id: materialAsset.id,
      name: materialAsset.name || materialAsset.id,
      materialKind: resolveEditorSceneBrowserMaterialKind(materialAsset),
      readonly: materialAsset.system?.readonly === true,
      profile: structuredClone(materialAsset.profile ?? {}),
    },
    placeable: false,
  }));
}

function resolveEditorSceneBrowserMaterialKind(materialAsset: { materialKind?: string; system?: { preset?: string } }): 'pbr' | 'standard' {
  if (materialAsset.materialKind === 'standard' || materialAsset.system?.preset === 'default-standard') return 'standard';
  return 'pbr';
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
      return [{
        id: asset.assetId,
        label: asset.displayName || asset.assetId,
        url,
        meta: asset.assetId,
      }];
    });
}

function createEditorSceneMaterialAssetMeta(profile: ArtistMaterialProfile, id: string): string {
  const metallic = formatEditorSceneMaterialPreviewNumber(profile.metallic ?? 0);
  const roughness = formatEditorSceneMaterialPreviewNumber(profile.roughness ?? 1);
  return `M ${metallic} / R ${roughness} - ${id}`;
}

function createEditorSceneMaterialAssetPreview(profile: ArtistMaterialProfile) {
  return {
    kind: 'material-sphere' as const,
    baseColor: transformEditorSceneMaterialPreviewBaseColor(profile),
    metallic: clampEditorSceneMaterialPreview01(profile.metallic ?? 0),
    roughness: clampEditorSceneMaterialPreview01(profile.roughness ?? 1),
    emissionColor: profile.emission?.color,
    emissionIntensity: profile.emission?.intensity ?? 0,
    textureUrl: profile.baseColor?.texture?.url,
  };
}

function transformEditorSceneMaterialPreviewBaseColor(profile: ArtistMaterialProfile): { r: number; g: number; b: number } {
  const baseColor = profile.baseColor ?? {};
  const source = baseColor.color ?? { r: 0.78, g: 0.78, b: 0.78 };
  const brightness = Number.isFinite(baseColor.brightness) ? baseColor.brightness! : 1;
  const contrast = Number.isFinite(baseColor.contrast) ? baseColor.contrast! : 1;
  const saturation = Number.isFinite(baseColor.saturation) ? baseColor.saturation! : 1;
  const hue = Number.isFinite(baseColor.hue) ? baseColor.hue! : 0;

  let r = clampEditorSceneMaterialPreview01(source.r * Math.max(0, brightness));
  let g = clampEditorSceneMaterialPreview01(source.g * Math.max(0, brightness));
  let b = clampEditorSceneMaterialPreview01(source.b * Math.max(0, brightness));

  r = clampEditorSceneMaterialPreview01((r - 0.5) * contrast + 0.5);
  g = clampEditorSceneMaterialPreview01((g - 0.5) * contrast + 0.5);
  b = clampEditorSceneMaterialPreview01((b - 0.5) * contrast + 0.5);

  const hsl = rgbToEditorSceneMaterialPreviewHsl(r, g, b);
  hsl.h = normalizeEditorSceneMaterialPreviewHue(hsl.h + hue);
  hsl.s = clampEditorSceneMaterialPreview01(hsl.s * Math.max(0, saturation));
  return hslToEditorSceneMaterialPreviewRgb(hsl.h, hsl.s, hsl.l);
}

function rgbToEditorSceneMaterialPreviewHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  return { h: h * 60, s, l };
}

function hslToEditorSceneMaterialPreviewRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) return { r: l, g: l, b: l };

  const hueToRgb = (p: number, q: number, t: number): number => {
    let nextT = t;
    if (nextT < 0) nextT += 1;
    if (nextT > 1) nextT -= 1;
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT;
    if (nextT < 1 / 2) return q;
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6;
    return p;
  };

  const normalizedHue = normalizeEditorSceneMaterialPreviewHue(h) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clampEditorSceneMaterialPreview01(hueToRgb(p, q, normalizedHue + 1 / 3)),
    g: clampEditorSceneMaterialPreview01(hueToRgb(p, q, normalizedHue)),
    b: clampEditorSceneMaterialPreview01(hueToRgb(p, q, normalizedHue - 1 / 3)),
  };
}

function normalizeEditorSceneMaterialPreviewHue(value: number): number {
  const result = value % 360;
  return result < 0 ? result + 360 : result;
}

function clampEditorSceneMaterialPreview01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatEditorSceneMaterialPreviewNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function createProjectionNodes(editorScene: EditorSceneDocument): BabylonEditorProjectionNode[] {
  return createEditorSceneRuntimePreviewNodes(editorScene) as unknown as BabylonEditorProjectionNode[];
}

function createProjectionNode(
  editorScene: EditorSceneDocument,
  gameObject: EditorSceneGameObject,
): BabylonEditorProjectionNode {
  return createEditorSceneRuntimePreviewNode(editorScene, gameObject) as unknown as BabylonEditorProjectionNode;
}

function createSceneCameraPreviewRig(
  editorScene: EditorSceneDocument,
): BabylonSceneCameraPreviewRig | null {
  return createEditorSceneRuntimePreviewMainCameraRig(editorScene, DEFAULT_EDITOR_SCENE_CAMERA) as BabylonSceneCameraPreviewRig | null;
}

async function importEditorProjectionModel(
  context: BabylonEditorProjectionImportContext,
): Promise<BabylonEditorProjectionImportResult | null> {
  const assetId = readEditorSceneRuntimePreviewAssetId(context.asset);
  if (!assetId) return null;
  const assetsModule = await import('../assets');
  const importPlan = createEditorSceneRuntimePreviewImportPlan({
    assetsModule,
    asset: context.asset,
    nodeId: context.node.id,
  });
  if (!importPlan) {
    const kind = readEditorSceneRuntimePreviewAssetKind(context.asset) === 'texture' ? 'texture' : 'model';
    warnProjectionAssetUrlMissing(context.asset, kind);
    return null;
  }
  if (importPlan.kind === 'groundDecal') return createGroundDecalProjectionResult(context, importPlan.decal);

  await import('@babylonjs/loaders/glTF');
  const { SceneLoader } = await import('@babylonjs/core/Loading/sceneLoader');
  const pathInfo = await assetsModule.getModelPathAndFileAsync(importPlan.url);
  return SceneLoader.ImportMeshAsync(
    '',
    pathInfo.path,
    pathInfo.filename,
    context.scene,
    undefined,
    pathInfo.isDataUrl || pathInfo.isCompressed ? '.glb' : undefined,
  );
}

function warnProjectionAssetUrlMissing(asset: unknown, kind: 'model' | 'texture'): void {
  console.warn('[LocalEditor] Missing projection asset URL', createEditorSceneRuntimePreviewMissingAssetUrlDiagnostic(asset, kind));
}

async function createGroundDecalProjectionResult(
  context: BabylonEditorProjectionImportContext,
  decal: EditorSceneRuntimePreviewGroundDecalDescriptor,
): Promise<BabylonEditorProjectionImportResult> {
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
  input: LocalEditorHarnessPropertyInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[]; reprojectIds?: string[] } | null {
  return createEditorSceneInspectorPropertyPatch(input);
}

function createEditorSceneSerializedMultiPropertyPatch(
  input: LocalEditorHarnessMultiPropertyInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  if (input.targetIds.some((targetId) => !createEditorSceneInspectorPropertyPatch({
    document: input.document,
    targetId,
    path: input.path,
    value: input.value,
  }))) return null;
  const result = createPlayableEditorSceneSerializedMultiTransformPatch(input);
  if (!result) return null;
  return {
    ...result,
    patch: result.patch as EditorSceneDocumentPatch,
  };
}

function createEditorSceneTransformPatch(
  input: LocalEditorHarnessTransformInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedId: string; changedIds: string[] } | null {
  const result = createPlayableEditorSceneTransformPatch(input);
  if (!result) return null;
  return {
    ...result,
    patch: result.patch as EditorSceneDocumentPatch,
  };
}

function createEditorSceneTransformBatchPatch(
  input: LocalEditorHarnessTransformBatchInput<EditorSceneDocument>,
): { patch: EditorSceneDocumentPatch; label: string; changedIds: string[] } | null {
  const result = createPlayableEditorSceneTransformBatchPatch(input);
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

function installForgePlayModeBridge(
  harness: LocalEditorHarness,
  loadingOverlay: Pick<PlayableLocalEditorLoadingOverlayController, 'show' | 'hide' | 'isVisible'>,
  runWithAssetLoadingOverlay: <T>(operation: () => Promise<T>) => Promise<T>,
): () => void {
  setLocalEditorAssetBridgeActive(true);
  const platformAssetDropCache = createPlayablePlatformAssetDropCache();
  let bridge: ReturnType<typeof installPlayableForgePlayModeBridge>;

  function rememberPlatformAssetDrop(payload: Record<string, unknown>): void {
    platformAssetDropCache.remember(payload);
  }

  function normalizeLoadedPlatformAssetPayload(payload: Record<string, unknown>): Record<string, unknown> {
    return platformAssetDropCache.normalize(payload);
  }

  async function ensureEditorMode(): Promise<void> {
    if (bridge.getMode() === 'edit') return;
    await bridge.switchMode('edit');
  }

  async function refreshEditorAssetLibrary(payload: Record<string, unknown>): Promise<void> {
    const requestId = readOptionalString(payload.requestId);
    try {
      await ensureEditorMode();
      await runWithAssetLoadingOverlay(async () => {
        const result = await harness.reloadAssets();
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

  async function importPlatformAsset(payload: Record<string, unknown>): Promise<void> {
    const requestId = readOptionalString(payload.requestId);
    const normalizedPayload = normalizeLoadedPlatformAssetPayload(payload);
    try {
      await ensureEditorMode();
      await runWithAssetLoadingOverlay(async () => {
        const registered = await registerPlatformAssetIfNeeded(normalizedPayload);
        const refresh = await harness.reloadAssets();
        const assetType = readPlayablePlatformAssetKind(normalizedPayload);
        const created = harness.createAssetFromAssetId(registered.assetId, {
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
        external: readPlayablePlatformAssetExternal(payload),
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

  async function handleProjectAssetCommand(name: string, payload: Record<string, unknown>): Promise<void> {
    const commandName = normalizePlayableForgePlayCommandName(name);
    if (commandName === PLAYABLE_FORGE_PLAY_COMMAND.ASSET_LIBRARY_REFRESH) {
      await refreshEditorAssetLibrary(payload);
      return;
    }
    if (commandName === PLAYABLE_FORGE_PLAY_COMMAND.ASSET_IMPORT || commandName === PLAYABLE_FORGE_PLAY_COMMAND.ASSETS_LOADED) {
      await importPlatformAsset(payload);
      return;
    }
    if (commandName === PLAYABLE_FORGE_PLAY_COMMAND.EDITOR_ASSET_PLACE) {
      await placeEditorAsset(payload);
    }
  }

  const disposeLegacyAssetBypass = installLegacyAssetCommandBypass((name, params) => handleProjectAssetCommand(name, params));
  bridge = installPlayableForgePlayModeBridge({
    window,
    harness,
    loadingOverlay,
    loadingContent: {
      saveScene: EDITOR_LOADING_OVERLAY_CONTENT.saveScene,
      saveAndRunGame: EDITOR_LOADING_OVERLAY_CONTENT.saveAndRunGame,
      discardAndRunGame: EDITOR_LOADING_OVERLAY_CONTENT.discardAndRunGame,
    },
    waitForPaint: waitForPlayableLocalEditorPaint,
    hasUnsavedPlatformChanges: hasEditorRenderingDraftChanges,
    handleAssetDrop: rememberPlatformAssetDrop,
    handleProjectAssetCommand,
    exportDocument: ({ payload, saveState }) => exportForgePlayDocument(harness, payload, saveState),
    reportError: error => {
      console.error('[LocalEditorModeSwitcher] Forge Play mode change failed', error);
    },
  });

  return () => {
    disposeLegacyAssetBypass();
    setLocalEditorAssetBridgeActive(false);
    bridge.dispose();
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
  harness: LocalEditorHarness,
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
