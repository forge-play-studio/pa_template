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
      const mutation = runtime.mutation.current();
      if (mutation.ok && mutation.data?.active) runtime.mutation.restore(mutation.data.id);
      const vfx = runtime.vfx.current();
      if (vfx.ok && vfx.data?.active) runtime.vfx.restore(vfx.data.id);
      const material = runtime.materials.current();
      if (material.ok && material.data?.active) runtime.materials.restore(material.data.id);
      const animation = runtime.animations.current();
      if (animation.ok && animation.data?.active) runtime.animations.restore(animation.data.id);
    },
    dispose() {
      runtime.dispose();
    },
  };
}

type RuntimeInspectorWindow = Window & {
  __fp3d?: RuntimeInspectorApi;
};
