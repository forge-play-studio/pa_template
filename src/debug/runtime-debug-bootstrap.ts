import type { Game } from '../core/Game';
import type { ProjectGameplayRuntime } from '../gameplay';
import { mountCameraDebugPanel } from './camera-debug-panel';
import { mountLocalEditorModeSwitcher } from './local-editor-mode-switcher';
import { mountRuntimeGameplayDebugPanels } from './runtime-gameplay-debug-panels';
import { mountRuntimeLightingDebugPanel } from './runtime-lighting-debug-panel';
import { DisposableStack, type Disposable } from './framework/disposables';
import { RuntimeDebugActionRegistry } from './framework/debug-action-registry';

export interface RuntimeDebugBootstrapOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
  getGameplayRuntime: () => ProjectGameplayRuntime | null;
  disposeGameWorld: () => void | Promise<void>;
}

export function mountRuntimeDebug(options: RuntimeDebugBootstrapOptions): Disposable {
  const root = options.root ?? document.body;
  const disposables = new DisposableStack();
  const actions = disposables.use(new RuntimeDebugActionRegistry(root.ownerDocument.defaultView ?? window));

  disposables.use(mountCameraDebugPanel({
    root,
    getGame: options.getGame,
  }));
  disposables.use(mountRuntimeLightingDebugPanel({
    root,
    getGame: options.getGame,
  }));
  disposables.use(mountRuntimeGameplayDebugPanels({
    root,
    getGame: options.getGame,
    getGameplayRuntime: options.getGameplayRuntime,
    actions,
  }));

  let disposedForReload = false;
  const editorSwitcher = mountLocalEditorModeSwitcher({
    root,
    disposeGameWorld: options.disposeGameWorld,
    onBeforeReload: () => {
      disposedForReload = true;
      disposables.dispose();
    },
  });
  disposables.use(editorSwitcher);

  return {
    dispose() {
      if (disposedForReload) return;
      disposables.dispose();
    },
  };
}
