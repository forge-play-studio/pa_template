import type { Game } from '../../core/Game';
import { createRuntimeInspector } from './runtime';
import type { RuntimeInspectorApi } from './schema';

export type MountRuntimeInspectorOptions = {
  getGame: () => Game | null;
};

export type RuntimeInspectorDisposable = {
  beforeSceneChange(): void;
  dispose(): void;
};

export function mountRuntimeInspector(options: MountRuntimeInspectorOptions): RuntimeInspectorDisposable {
  const runtime = createRuntimeInspector({
    getGame: options.getGame,
    mode: import.meta.env.MODE,
    onDispose: () => {
      const current = (window as RuntimeInspectorWindow).__fp3d;
      if (current === runtime) delete (window as RuntimeInspectorWindow).__fp3d;
    },
  });
  (window as RuntimeInspectorWindow).__fp3d = runtime;

  return {
    beforeSceneChange() {
      const current = runtime.camera.current();
      if (current.ok && current.data?.active) runtime.camera.restore(current.data.id);
    },
    dispose() {
      runtime.dispose();
    },
  };
}

type RuntimeInspectorWindow = Window & {
  __fp3d?: RuntimeInspectorApi;
};
