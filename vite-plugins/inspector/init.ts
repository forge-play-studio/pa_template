// Loaded by vite-plugin-babylon-inspector (dev only, never bundled in production).
// Exposes lazy inspector loader on globalThis to avoid startup hard-fail when
// dev CDN/proxy has transient chunk errors.

type InspectorGlobal = typeof globalThis & {
  INSPECTOR?: unknown;
  INSPECTOR_READY?: Promise<unknown | null>;
  ensureInspectorReady?: () => Promise<unknown | null>;
};

const g = globalThis as InspectorGlobal;

g.ensureInspectorReady = () => {
  if (g.INSPECTOR_READY) return g.INSPECTOR_READY;

  g.INSPECTOR_READY = (async () => {
    try {
      const [mod] = await Promise.all([
        import('@babylonjs/inspector'),
        import('@babylonjs/core/Layers/effectLayerSceneComponent'),
        import('@babylonjs/core/Rendering/depthRendererSceneComponent'),
      ]);
      g.INSPECTOR = mod;
      return mod;
    } catch (error) {
      console.warn('[inspector/init] Failed to preload inspector:', error);
      return null;
    }
  })();

  return g.INSPECTOR_READY;
};

const params = new URLSearchParams(globalThis.location?.search ?? '');
const shouldPreloadInspector =
  params.get('edit') === 'true'
  || params.has('inspector')
  || params.has('debugGame')
  || params.get('mcp') === '1';

if (shouldPreloadInspector) {
  void g.ensureInspectorReady();
}
