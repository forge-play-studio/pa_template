/**
 * 应用入口
 * 初始化游戏应用（新系统）
 */

import { LoadingScreen } from './ui';
import { Game } from './core/Game';
import { registerProjectEditorPlugin, registerProjectEditorRuntimeBridge } from './editor-package';
import type { ProjectEditorRuntime } from './editor-package';
import { registerModelUrl } from './assets';

// ============================================================
// 全局实例
// ============================================================

/** 游戏实例 */
let game: Game | null = null;

/** 加载屏幕 */
let loadingScreen: LoadingScreen | null = null;

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createRuntimeModelId(file: File): string {
  const base = file.name
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'model';
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now().toString(36)}_${Math.floor(Math.random() * 10000).toString(36)}`;
  return `dropped_${base}_${id}`;
}

// Convert normalized iframe drop point (0..1) into a babylon world position.
// 1) `scene.pick(canvasX, canvasY)` against existing geometry — preferred so
//    drops onto a roof land on the roof, not the floor below.
// 2) Fallback: intersect the pick ray with the y=0 ground plane.
// 3) Last resort: scene origin (rare — would mean the ray is parallel to
//    the ground, e.g. pure top-down ortho).
function screenPointToWorld(point: { x: number; y: number }): { x: number; y: number; z: number } | null {
  try {
    const game = (window as any).gameInstance;
    const scene = game?.getScene?.() ?? game?.scene ?? null;
    if (!scene) return null;
    const canvas = scene.getEngine?.()?.getRenderingCanvas?.();
    if (!canvas || !canvas.width || !canvas.height) return null;

    const cx = Math.max(0, Math.min(canvas.width, point.x * canvas.width));
    const cy = Math.max(0, Math.min(canvas.height, point.y * canvas.height));

    // (1) Pick against existing meshes.
    const pickInfo = scene.pick?.(cx, cy);
    if (pickInfo?.hit && pickInfo.pickedPoint) {
      return { x: pickInfo.pickedPoint.x, y: pickInfo.pickedPoint.y, z: pickInfo.pickedPoint.z };
    }

    // (2) Ray vs y=0 plane.
    const camera = scene.activeCamera;
    if (!camera || typeof scene.createPickingRay !== 'function') return null;
    const B = (window as any).BABYLON;
    const ray = scene.createPickingRay(cx, cy, B?.Matrix?.Identity?.() ?? null, camera);
    if (!ray) return null;
    const oy = ray.origin?.y;
    const dy = ray.direction?.y;
    if (typeof oy !== 'number' || typeof dy !== 'number' || Math.abs(dy) < 1e-6) return null;
    const t = -oy / dy;
    if (t <= 0) return null;
    return {
      x: ray.origin.x + ray.direction.x * t,
      y: 0,
      z: ray.origin.z + ray.direction.z * t,
    };
  } catch {
    return null;
  }
}

// After document:restore the new model loads async — poll the live scene
// until the corresponding TransformNode shows up (or timeout). Used by the
// drop flow to auto-select+focus the just-dropped model.
function awaitNodeAndSelect(nodeId: string, nodeName: string, timeoutMs: number): Promise<any | null> {
  return new Promise((resolve) => {
    const game = (window as any).gameInstance;
    const liveScene = game?.getScene?.() ?? game?.scene ?? null;
    if (!liveScene) { resolve(null); return; }
    const findOnce = (): any | null => (
      liveScene.getTransformNodeById?.(nodeId)
      ?? liveScene.getMeshById?.(nodeId)
      ?? liveScene.getTransformNodeByName?.(nodeName)
      ?? liveScene.getMeshByName?.(nodeName)
      ?? null
    );
    const startAt = performance.now();
    const tick = () => {
      const node = findOnce();
      if (node) return resolve(node);
      if (performance.now() - startAt > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error(`Failed to read model file: ${file.name}`));
    };
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read model file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function installBridgeInspectorPatch(): void {
  if (!import.meta.env.DEV) return;

  const w = window as any;
  let attempts = 0;
  const maxAttempts = 120;

  const tryPatch = () => {
    const editor = w.__bridge?.editor;
    if (!editor) {
      if (attempts < maxAttempts) {
        attempts++;
        window.setTimeout(tryPatch, 250);
      }
      return;
    }

    if (editor.__localInspectorLoadPatched) return;

    const ensureLocalInspector = async () => {
      const localInspector = typeof w.ensureInspectorReady === 'function'
        ? await w.ensureInspectorReady()
        : null;
      if (localInspector?.ShowInspector) {
        w.INSPECTOR = localInspector;
      }
      return localInspector;
    };

    if (typeof editor.showInspector === 'function') {
      const originalShowInspector = editor.showInspector.bind(editor);
      editor.showInspector = async (...args: unknown[]) => {
        await ensureLocalInspector();
        return originalShowInspector(...args);
      };
    }

    if (typeof editor.loadV2 === 'function') {
      const originalLoadV2 = editor.loadV2.bind(editor);
      editor.loadV2 = async (...args: unknown[]) => {
        const localInspector = await ensureLocalInspector();
        if (localInspector?.ShowInspector) {
          return localInspector;
        }
        return originalLoadV2(...args);
      };
    }
    editor.__localInspectorLoadPatched = true;
  };

  tryPatch();
}

// Walk a scene doc's `scene.assets[]` and re-register runtime-dropped
// asset URLs into MODEL_URL_MAP. MAP is module memory and resets on every
// iframe boot, but the scene doc is persisted (IDB) — so without this step
// any previously-dropped `dropped_*` asset would throw "Unknown model ID"
// during the boot SceneBuilder pass and abort the whole scene load.
//
// Entries whose `url` is missing or `blob:` (session-scoped, dead after
// reload) get pruned along with any node that referenced them, so a single
// stale entry can't take down the whole scene.
function rehydrateDroppedAssets(sceneDoc: any): any {
  if (!sceneDoc || typeof sceneDoc !== 'object') return sceneDoc;
  const scene = (sceneDoc as any).scene;
  if (!scene || !Array.isArray(scene.assets)) return sceneDoc;
  const next = cloneJson(sceneDoc) as any;
  const list: any[] = next.scene.assets;
  const dead: string[] = [];
  for (const a of list) {
    if (!a || typeof a.sourceId !== 'string') continue;
    if (!a.sourceId.startsWith('dropped_')) continue;
    const url = typeof a.url === 'string' ? a.url : '';
    if (!url || url.startsWith('blob:')) { dead.push(a.sourceId); continue; }
    registerModelUrl(a.sourceId, url);
  }
  if (dead.length === 0) return next;
  next.scene.assets = list.filter((a: any) => !(typeof a?.sourceId === 'string' && dead.includes(a.sourceId)));
  if (Array.isArray(next.scene.nodes)) {
    next.scene.nodes = next.scene.nodes.filter((n: any) => !dead.includes(n?.instance?.assetId));
  }
  console.warn('[Main] stripped stale dropped_* assets', dead);
  return next;
}

function installSceneDataApi(runtime: ProjectEditorRuntime): void {
  const w = window as any;

  // Bridge command receiver — single envelope shape per docs/editor-game-api.md.
  // editor wraps every command as { source, type: 'command', payload: { name, ... } }.
  let bridgeListenerInstalled = false;
  const handleBridgeMessage = (event: MessageEvent) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.source !== 'forge-play-game-bridge' || msg.type !== 'command') return;
    const name = msg.payload?.name;

    if (name === 'document:restore') {
      const sceneData = msg.payload?.sceneData;
      if (sceneData == null) return;
      const hydrated = rehydrateDroppedAssets(sceneData);
      void Promise.resolve(runtime.Editor.restoreSceneData?.(hydrated)).catch((error) => {
        console.warn('[Main] Failed to restore scene from document:restore:', error);
      });
      return;
    }

    if (name === 'assets:drop') {
      const assets = Array.isArray(msg.payload?.assets) ? msg.payload.assets : [];
      const point = msg.payload?.point;
      try { handleAssetsDrop(assets, point); }
      catch (error) { console.warn('[Main] assets:drop handler failed:', error); }
      return;
    }

    if (name === 'assets:loaded') {
      const items = Array.isArray(msg.payload?.assets) ? msg.payload.assets : [];
      try { handleAssetsLoaded(items); }
      catch (error) { console.warn('[Main] assets:loaded handler failed:', error); }
      return;
    }

    if (typeof name === 'string') {
      void Promise.resolve(runtime.handleCommand(name, msg.payload ?? {})).catch((error) => {
        console.warn('[Main] bridge command handler failed:', { name, error });
      });
    }
  };

  // Derive a deterministic sandbox-side `sourceId` from the host's drop
  // `item.id`. Lets `assets:loaded` find the right asset entry without
  // needing a session-scoped Map (HMR or iframe reload between
  // `assets:drop` and `assets:loaded` would lose that Map).
  const sourceIdFor = (dropId: string): string => `dropped_${dropId.replace(/[^a-zA-Z0-9_-]+/g, '_')}`;

  // Surface failures to the host so the user understands why a drop
  // didn't materialize. Host shows system:error in its connection log.
  const emitSystemError = (message: string): void => {
    try {
      window.parent.postMessage({
        source: 'forge-play-game-bridge',
        type: 'event',
        payload: { name: 'system:error', kind: 'error', message: `[assets:drop] ${message}` },
        timestamp: Date.now(),
      }, '*');
    } catch {}
  };

  // Validate kind/name. Returns null + emits error if unsupported.
  // Accepted: model_3d (.glb), image (.png/.jpg/.jpeg/.webp), audio
  // (.mp3/.wav/.ogg/.m4a). Image is rendered as a billboarded Plane in
  // the scene; audio is silently persisted to FS without scene-level
  // visualization.
  const IMAGE_EXTS = /\.(png|jpe?g|webp)$/i;
  const AUDIO_EXTS = /\.(mp3|wav|ogg|m4a)$/i;
  const validateItem = (item: any): { name: string } | null => {
    const name = item.name || 'dropped';
    if (item.kind === 'model_3d') {
      if (!name.toLowerCase().endsWith('.glb')) {
        const msg = `unsupported file format: ${name} (pa_template only loads .glb for model_3d)`;
        emitSystemError(msg);
        return null;
      }
      return { name };
    }
    if (item.kind === 'image') {
      if (!IMAGE_EXTS.test(name)) {
        emitSystemError(`unsupported image extension: ${name}`);
        return null;
      }
      return { name };
    }
    if (item.kind === 'audio') {
      if (!AUDIO_EXTS.test(name)) {
        emitSystemError(`unsupported audio extension: ${name}`);
        return null;
      }
      return { name };
    }
    emitSystemError(`unsupported kind '${item.kind}'`);
    return null;
  };

  // Spawn a textured billboard Plane at the drop point. Session-only —
  // not persisted in scene.assets[], so reload loses it. (Persisting
  // images would need a new asset type in the editor-package schema.)
  const addImageByUrl = (
    imageUrl: string,
    displayName: string,
    point?: { x: number; y: number },
  ): void => {
    try {
      const game = (window as any).gameInstance;
      const scene = game?.getScene?.() ?? game?.scene ?? null;
      const B = (window as any).BABYLON;
      if (!scene || !B?.MeshBuilder) {
        emitSystemError('image drop: babylon/scene not ready');
        return;
      }
      const dropWorld = point ? screenPointToWorld(point) : null;
      const pos = dropWorld ?? { x: 0, y: 1, z: 0 };
      const plane = B.MeshBuilder.CreatePlane(`img_${displayName}`, { width: 1, height: 1 }, scene);
      plane.position = new B.Vector3(pos.x, pos.y + 0.5, pos.z);
      plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
      const mat = new B.StandardMaterial(`img_${displayName}_mat`, scene);
      const tex = new B.Texture(imageUrl, scene);
      tex.hasAlpha = true;
      mat.diffuseTexture = tex;
      mat.useAlphaFromDiffuseTexture = true;
      mat.backFaceCulling = false;
      plane.material = mat;
      // Once the texture loads, fix the plane aspect ratio to match.
      const obs = tex.onLoadObservable?.addOnce?.(() => {
        try {
          const size = tex.getSize?.();
          if (size?.width && size?.height) {
            plane.scaling.x = size.width / size.height;
          }
        } catch {}
      });
      void obs;
    } catch (e) {
      console.warn('[Main] addImageByUrl failed', e);
      emitSystemError(`addImageByUrl threw: ${String(e)}`);
    }
  };

  // Resolve an AssetDropItem to a URL babylon can fetch from. Returns
  // null when neither bytes nor assetPath is usable.
  const itemToUrl = (item: any): string | null => {
    if (typeof item.assetPath === 'string' && item.assetPath) return item.assetPath;
    if (item.bytes instanceof ArrayBuffer && item.bytes.byteLength > 0) {
      const mime = item.mimeType || 'model/gltf-binary';
      return URL.createObjectURL(new Blob([item.bytes], { type: mime }));
    }
    return null;
  };

  // Single entry point used by both `assets:drop` and `assets:loaded`.
  // First time we see an id → create a new scene node. Subsequent calls
  // with the same id → just rewire the source URL (e.g. blob: → path)
  // without touching scene topology.
  const applyAssetItem = (item: any, point?: { x: number; y: number }): void => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') {
      console.warn('[Main] applyAssetItem: missing id', item);
      return;
    }
    const url = itemToUrl(item);
    if (!url) {
      console.warn(`[Main] applyAssetItem: ${item.id} has neither bytes nor assetPath`);
      return;
    }

    // Identity comes from the host's drop id (stable across
    // assets:drop and the follow-up assets:loaded). If the scene
    // already has an asset entry for this sourceId, this is the
    // follow-up — swap the URL in place. Otherwise it's the first
    // delivery — create a new node.
    const sourceId = sourceIdFor(item.id);
    const sceneNow = runtime.Editor.getSceneData?.();
    const existingEntry = Array.isArray(sceneNow?.scene?.assets)
      ? sceneNow.scene.assets.find((a: any) => a?.sourceId === sourceId)
      : null;

    // Asset-entry lookup only applies to model_3d (other kinds don't
    // persist in scene.assets[] yet).
    if (item.kind === 'model_3d' && existingEntry) {
      // Swap registered URL (MAP) so future re-renders use the new one,
      // and update the persisted scene entry so a fresh iframe boot can
      // rehydrate from it. We don't trigger a scene rebuild — the model
      // is already visible from the previous URL.
      registerModelUrl(sourceId, url);
      try {
        const next = cloneJson(sceneNow) as any;
        const list = next?.scene?.assets;
        if (Array.isArray(list)) {
          for (const a of list) if (a?.sourceId === sourceId) a.url = url;
          void Promise.resolve(runtime.Editor.restoreSceneData?.(next));
        }
      } catch (e) {
        console.warn('[Main] assets:loaded url-patch failed', e);
      }
      return;
    }

    // New drop: validate, dispatch by kind.
    const valid = validateItem(item);
    if (!valid) return;
    if (item.kind === 'image') {
      addImageByUrl(url, valid.name, point);
      return;
    }
    if (item.kind === 'audio') {
      // Silent accept — file is already PUT to sandbox FS by the host.
      console.log('[Main] audio dropped', { name: valid.name, url: url.slice(0, 60) });
      return;
    }
    // model_3d
    void api.addModelByUrl(url, valid.name, point ? { point } : undefined, sourceId).catch((err) => {
      console.warn('[Main] addModelByUrl failed', err);
      emitSystemError(`addModelByUrl threw for ${valid.name}: ${String(err)}`);
    });
  };

  const handleAssetsDrop = (assets: any[], point?: { x: number; y: number }): void => {
    for (const a of assets) applyAssetItem(a, point);
  };

  const handleAssetsLoaded = (items: any[]): void => {
    for (const it of items) applyAssetItem(it);
  };
  const listenSceneRestore = () => {
    if (bridgeListenerInstalled) return unlistenSceneRestore;
    window.addEventListener('message', handleBridgeMessage);
    bridgeListenerInstalled = true;
    return unlistenSceneRestore;
  };
  const unlistenSceneRestore = () => {
    if (!bridgeListenerInstalled) return;
    window.removeEventListener('message', handleBridgeMessage);
    bridgeListenerInstalled = false;
  };

  const api = {
    getSceneData: () => runtime.Editor.getSceneData?.() ?? null,
    dispatchSceneChange: (source?: string) => runtime.Editor.dispatchSceneChange?.(source) ?? null,
    restoreSceneData: (sceneData: Record<string, any> | string) => runtime.Editor.restoreSceneData?.(sceneData) ?? false,
    addModelFile: async (file: File, opts?: { point?: { x: number; y: number } }) => {
      const lowerName = file.name.toLowerCase();
      if (!lowerName.endsWith('.glb')) {
        console.warn('[Main] Ignored dropped file, expected .glb:', file.name);
        return false;
      }

      const current = runtime.Editor.getSceneData?.();
      if (!current) return false;

      const sceneData = cloneJson(current);
      const sceneSection = ((sceneData as any).scene ??= {});
      const assets = (Array.isArray(sceneSection.assets) ? sceneSection.assets : (sceneSection.assets = [])) as any[];
      const nodes = (Array.isArray(sceneSection.nodes) ? sceneSection.nodes : (sceneSection.nodes = [])) as any[];

      const sourceId = createRuntimeModelId(file);
      const dataUrl = await readFileAsDataUrl(file);
      registerModelUrl(sourceId, dataUrl);

      const assetId = sourceId;
      assets.push({
        id: assetId,
        type: 'glb',
        sourceId,
        displayName: file.name,
        materialMode: 'instance',
        // Persist the URL in the document so a fresh iframe can re-register
        // it on boot (MODEL_URL_MAP is module memory and dies on reload).
        // dataUrl survives — but any blob:/data: of this kind doesn't always.
        url: dataUrl,
      });

      // Position: prefer screen-space drop point (raycast against ground or
      // hit geometry) when host gave us one; fallback to grid layout when
      // the call site didn't supply coords (e.g. native window-level drop).
      const dropWorld = opts?.point ? screenPointToWorld(opts.point) : null;
      const index = nodes.length;
      const gridX = ((index % 7) - 3) * 1.7;
      const gridZ = (Math.floor(index / 7) % 5 - 2) * 1.7;
      const pos = dropWorld ?? { x: gridX, y: 0, z: gridZ };

      const nodeId = `${assetId}_node`;
      nodes.push({
        id: nodeId,
        name: file.name.replace(/\.[^.]+$/, '') || assetId,
        kind: 'instance',
        instance: { assetId },
        transform: {
          position: pos,
          rotationDeg: { x: 0, y: 0, z: 0 },
          scale: 0.2,
        },
      });

      await Promise.resolve(runtime.Editor.restoreSceneData?.(sceneData));
      runtime.Editor.dispatchSceneChange?.('model-drop');

      // Post-apply: select + focus the newly placed model so the user
      // sees what they just dropped instead of guessing where it landed.
      // GLB load is async — restoreSceneData returns before the mesh
      // exists in the live scene, so we poll briefly via rAF.
      const dropName = nodes[nodes.length - 1].name;
      void awaitNodeAndSelect(nodeId, dropName, 2000).then((node) => {
        if (node) {
          try {
            runtime.Editor.selectEntity?.(node, true);
            runtime.Edit._focusSelected?.();
          } catch (e) {
            console.warn('[Main] auto-select after drop failed:', e);
          }
        }
      });
      return true;
    },

    // Bridge `assets:drop`/`assets:loaded` entry point for runtime drops.
    // Caller supplies the deterministic `sourceId` derived from the host
    // drop id so the follow-up `assets:loaded` finds this same entry
    // without needing a session-scoped Map.
    addModelByUrl: async (
      assetUrl: string,
      displayName: string,
      opts?: { point?: { x: number; y: number } },
      sourceId?: string,
    ): Promise<{ sourceId: string } | null> => {
      if (!displayName.toLowerCase().endsWith('.glb')) {
        console.warn('[Main] addModelByUrl: expected .glb, got:', displayName);
        return null;
      }
      const current = runtime.Editor.getSceneData?.();
      if (!current) return null;

      const sceneData = cloneJson(current);
      const sceneSection = ((sceneData as any).scene ??= {});
      const assets = (Array.isArray(sceneSection.assets) ? sceneSection.assets : (sceneSection.assets = [])) as any[];
      const nodes = (Array.isArray(sceneSection.nodes) ? sceneSection.nodes : (sceneSection.nodes = [])) as any[];

      const safeBase = displayName
        .replace(/\.[^.]+$/, '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        || 'model';
      const resolvedSourceId = sourceId ?? (() => {
        const uniq = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID().slice(0, 8)
          : `${Date.now().toString(36)}_${Math.floor(Math.random() * 10000).toString(36)}`;
        return `dropped_${safeBase}_${uniq}`;
      })();

      // Register the URL — babylon's asset loader fetches via it.
      // For assetPath: SW → vite (and SW-caches in sandbox-assets).
      // For blob: URL: stays in-memory for this iframe session; can be
      // upgraded via `assets:loaded` once host PUT completes.
      registerModelUrl(resolvedSourceId, assetUrl);

      const assetId = resolvedSourceId;
      // Persist `url` so a fresh iframe can re-register on boot (see
      // rehydrateDroppedAssets). For online drops the URL is initially a
      // session-only blob:; the follow-up `assets:loaded` swaps it to a
      // persistent `src/assets/*.glb` and updates assets[i].url too.
      assets.push({ id: assetId, type: 'glb', sourceId: resolvedSourceId, displayName, materialMode: 'instance', url: assetUrl });

      const dropWorld = opts?.point ? screenPointToWorld(opts.point) : null;
      const index = nodes.length;
      const gridX = ((index % 7) - 3) * 1.7;
      const gridZ = (Math.floor(index / 7) % 5 - 2) * 1.7;
      const pos = dropWorld ?? { x: gridX, y: 0, z: gridZ };

      const nodeId = `${assetId}_node`;
      const nodeName = safeBase;
      nodes.push({
        id: nodeId,
        name: nodeName,
        kind: 'instance',
        instance: { assetId },
        transform: {
          position: pos,
          rotationDeg: { x: 0, y: 0, z: 0 },
          scale: 0.2,
        },
      });

      await Promise.resolve(runtime.Editor.restoreSceneData?.(sceneData));
      runtime.Editor.dispatchSceneChange?.('model-drop');

      void awaitNodeAndSelect(nodeId, nodeName, 2000).then((node) => {
        if (node) {
          try {
            runtime.Editor.selectEntity?.(node, true);
            runtime.Edit._focusSelected?.();
          } catch (e) {
            console.warn('[Main] auto-select after drop failed:', e);
          }
        }
      });
      return { sourceId: resolvedSourceId };
    },

    listenSceneRestore,
    unlistenSceneRestore,
  };

  w.sceneDataApi = api;
  w.getSceneData = api.getSceneData;
  w.dispatchSceneChange = api.dispatchSceneChange;
  w.restoreSceneData = api.restoreSceneData;
  w.addModelFile = api.addModelFile;
  w.addModelByUrl = api.addModelByUrl;
  w.listenSceneRestore = api.listenSceneRestore;
  w.unlistenSceneRestore = api.unlistenSceneRestore;
  w.sceneChange = (sceneData?: Record<string, any> | string) => (
    sceneData == null ? api.dispatchSceneChange('manual') : api.restoreSceneData(sceneData)
  );
  api.listenSceneRestore();
}

function installModelDrop(): void {
  const addFiles = async (files: FileList | File[]): Promise<void> => {
    const modelFiles = Array.from(files).filter((file) => {
      const name = file.name.toLowerCase();
      return name.endsWith('.glb');
    });
    for (const file of modelFiles) {
      await (window as any).sceneDataApi?.addModelFile?.(file);
    }
  };

  const prevent = (event: DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  window.addEventListener('dragover', prevent);
  window.addEventListener('drop', (event) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    void addFiles(files).catch((error) => {
      console.warn('[Main] Failed to add dropped model:', error);
    });
  });

  (window as any).addModelFile = (file: File) => (window as any).sceneDataApi?.addModelFile?.(file) ?? false;
}

async function openDefaultInspector(runtime: ProjectEditorRuntime, gameInstance: Game): Promise<void> {
  try {
    runtime.Editor.init(gameInstance.getScene());
    const ensureInspectorReady = (window as any).ensureInspectorReady;
    if (typeof ensureInspectorReady === 'function') {
      void ensureInspectorReady();
    }
    await runtime.Edit.enter();
    await runtime.Editor.showInspector();
  } catch (error) {
    console.warn('[Main] Failed to open inspector by default:', error);
  }
}

// ============================================================
// 初始化函数
// ============================================================

/**
 * 主初始化函数
 */
async function init(): Promise<void> {
  try {
    // 开发模式：暴露 BABYLON 供 AI 调试脚本使用
    if (import.meta.env.DEV) {
      const BABYLON = await import('@babylonjs/core');
      (window as any).BABYLON = BABYLON;
      installBridgeInspectorPatch();
    }

    // 创建并显示加载页面
    loadingScreen = new LoadingScreen();

    // 创建游戏实例
    game = new Game({
      canvasId: 'renderCanvas',
      debug: true,
      enableAudio: true,
    });

    // 初始化游戏（包括资源加载和场景构建）
    await game.init();

    registerProjectEditorPlugin();
    const editorRuntime = registerProjectEditorRuntimeBridge();
    installSceneDataApi(editorRuntime);
    installModelDrop();

    // Host-injected boot state (see forge-play docs/editor-game-api.md §3.5).
    // If the editor pre-populated window.__sandbox.host.data with saved
    // snapshot, apply it BEFORE the render loop starts — avoids the
    // "default scaffold flash → restore" double-render.
    const hostState = (window as any).__sandbox?.host;
    if (hostState && typeof hostState === 'object') {
      const major = typeof hostState.apiVersion === 'string'
        ? Number(hostState.apiVersion.split('.')[0])
        : NaN;
      if (major === 1 && hostState.data) {
        try {
          const hydrated = rehydrateDroppedAssets(hostState.data);
          await editorRuntime.Editor.restoreSceneData?.(hydrated);
        } catch (e) {
          console.warn('[Main] host.data apply failed', e);
        }
      } else if (major !== 1) {
        console.warn('[Main] __sandbox.host apiVersion unsupported:', hostState.apiVersion);
      }
    }

    // 启动游戏循环 BEFORE hiding loading screen.
    // 这样首帧已经画在 canvas 上时 LoadingScreen 才让出 —— 避免
    // 用户看到 hide 瞬间的空白 canvas 一次闪烁。
    game.start();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

    // 隐藏加载页面
    loadingScreen?.hide();

    // 暴露给调试
    window.gameInstance = game;

    await openDefaultInspector(editorRuntime, game);

  } catch (error) {
    console.error('[Main] Failed to initialize game:', error);
    // 发生错误时也隐藏加载页面
    loadingScreen?.hide();
  }
}

// ============================================================
// 启动
// ============================================================

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================================
// 调试接口
// ============================================================

declare global {
  interface Window {
    /** 游戏实例 */
    gameInstance: Game | null;
    /** Babylon.js 命名空间 (仅开发模式) */
    BABYLON?: any;
    ensureInspectorReady?: () => Promise<any>;
    INSPECTOR?: any;
    sceneDataApi?: {
      getSceneData: () => Record<string, any> | null;
      dispatchSceneChange: (source?: string) => Record<string, any> | null;
      restoreSceneData: (sceneData: Record<string, any> | string) => Promise<boolean> | boolean;
      addModelFile: (file: File) => Promise<boolean>;
      listenSceneRestore: () => () => void;
      unlistenSceneRestore: () => void;
    };
    getSceneData?: () => Record<string, any> | null;
    dispatchSceneChange?: (source?: string) => Record<string, any> | null;
    restoreSceneData?: (sceneData: Record<string, any> | string) => Promise<boolean> | boolean;
    addModelFile?: (file: File) => Promise<boolean>;
    listenSceneRestore?: () => () => void;
    unlistenSceneRestore?: () => void;
    sceneChange?: (sceneData?: Record<string, any> | string) => Record<string, any> | Promise<boolean> | boolean | null;
  }
}

export { game };
