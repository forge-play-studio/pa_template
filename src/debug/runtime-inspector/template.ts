import type { Game } from '../../core/Game';
import {
  mountRuntimeInspector,
  type RuntimeInspectorDisposable,
} from './index';
import { registerTemplateRuntimeInspectorProviders } from './template-providers';

export type MountTemplateRuntimeInspectorOptions = {
  getGame: () => Game | null;
};

export function mountTemplateRuntimeInspector(
  options: MountTemplateRuntimeInspectorOptions,
): RuntimeInspectorDisposable {
  const unregisterTemplateProviders = registerTemplateRuntimeInspectorProviders(options.getGame);
  const runtime = mountRuntimeInspector(options);
  return {
    beforeSceneChange() {
      runtime.beforeSceneChange();
    },
    dispose() {
      runtime.dispose();
      unregisterTemplateProviders();
    },
  };
}
