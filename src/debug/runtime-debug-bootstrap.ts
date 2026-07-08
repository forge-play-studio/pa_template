import type { Game } from '../core/Game';
import type { ProjectGameplayRuntime } from '../gameplay';
import { mountCameraDebugPanel } from './camera-debug-panel';
import { mountLocalEditorModeSwitcher } from './local-editor-mode-switcher';
import { mountRuntimeGameplayDebugPanels } from './runtime-gameplay-debug-panels';
import { mountRuntimeLightingDebugPanel } from './runtime-lighting-debug-panel';
import { mountRuntimeRecordReplayPanel } from './runtime-record-replay-panel';
import { mountRuntimeVfxDebugPanel } from './runtime-vfx-debug-panel';
import { DisposableStack, type Disposable } from './framework/disposables';
import { createRuntimeDebugPanelManager } from './framework/panel-manager';

export interface RuntimeDebugBootstrapOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
  getGameplayRuntime: () => ProjectGameplayRuntime | null;
  disposeGameWorld: () => void | Promise<void>;
}

export interface RuntimeDebugBootstrap extends Disposable {
  detachForEditor(): void;
}

export function mountRuntimeDebug(options: RuntimeDebugBootstrapOptions): RuntimeDebugBootstrap {
  const root = options.root ?? document.body;
  const runtimePanels = new DisposableStack();
  const panelManager = runtimePanels.use(createRuntimeDebugPanelManager({ root }));
  const actions = panelManager.actions;

  runtimePanels.use(mountCameraDebugPanel({
    root,
    getGame: options.getGame,
  }));
  runtimePanels.use(mountRuntimeLightingDebugPanel({
    root,
    getGame: options.getGame,
  }));
  runtimePanels.use(mountRuntimeVfxDebugPanel({
    root,
    getGame: options.getGame,
  }));
  runtimePanels.use(mountRuntimeRecordReplayPanel({
    root,
    getGame: options.getGame,
    restartGame: async (context) => {
      if (!window.__restartProjectGame) throw new Error('__restartProjectGame is not available.');
      await window.__restartProjectGame(context);
    },
  }));
  runtimePanels.use(mountRuntimeGameplayDebugPanels({
    root,
    getGame: options.getGame,
    getGameplayRuntime: options.getGameplayRuntime,
    actions,
  }));

  let disposedForReload = false;
  let runtimePanelsDetached = false;
  const detachRuntimePanelsForEditor = () => {
    if (runtimePanelsDetached) return;
    runtimePanelsDetached = true;
    runtimePanels.dispose();
    editorSwitcher.detachForEditor();
  };
  const editorSwitcher = mountLocalEditorModeSwitcher({
    root,
    disposeGameWorld: async () => {
      detachRuntimePanelsForEditor();
      await options.disposeGameWorld();
    },
    onBeforeEnterEditor: detachRuntimePanelsForEditor,
    onBeforeReload: () => {
      disposedForReload = true;
      runtimePanels.dispose();
      editorSwitcher.dispose();
    },
  });

  return {
    detachForEditor: detachRuntimePanelsForEditor,
    dispose() {
      if (disposedForReload) return;
      runtimePanels.dispose();
      editorSwitcher.dispose();
    },
  };
}
