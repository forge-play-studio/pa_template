/**
 * Dev-only runtime debug lifecycle entry.
 * Last updated: 2026-07-05.
 *
 * This file stays in `src/debug` because it owns panel mount/dispose lifecycle
 * for runtime debug UI. The local editor host implementation itself lives in
 * `src/services/fps-game-editor/local-editor.ts`; this file
 * only imports and mounts that host together with debug panels.
 */
import type { Game } from '../core/Game';
import type { ProjectGameplayRuntime } from '../gameplay';
import { mountCameraDebugPanel } from './camera-debug-panel';
import { mountLocalEditorModeSwitcher } from '../services/fps-game-editor/local-editor';
import { mountRuntimeAudioDebugPanel } from './runtime-audio-debug-panel';
import { mountRuntimeGameplayDebugPanels } from './runtime-gameplay-debug-panels';
import { mountRuntimeLightingDebugPanel } from './runtime-lighting-debug-panel';
import { mountRuntimeVfxDebugPanel } from './runtime-vfx-debug-panel';
import { mountRuntimeShadowMapStressHarness } from './shadow-map-stress-harness';
import { DisposableStack } from './framework/disposables';
import { createRuntimeDebugPanelManager } from './framework/panel-manager';

export interface RuntimeDebugBootstrapOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
  getGameplayRuntime: () => ProjectGameplayRuntime | null;
  disposeGameWorld: () => void | Promise<void>;
}

export interface RuntimeDebugBootstrap {
  detachForEditor(): void;
  dispose(): Promise<void>;
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
  runtimePanels.use(mountRuntimeAudioDebugPanel({
    root,
    getGame: options.getGame,
  }));
  runtimePanels.use(mountRuntimeGameplayDebugPanels({
    root,
    getGame: options.getGame,
    getGameplayRuntime: options.getGameplayRuntime,
    actions,
  }));
  runtimePanels.use(mountRuntimeShadowMapStressHarness({
    getGame: options.getGame,
  }));

  let disposed = false;
  let disposal: Promise<void> | null = null;
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
    onBeforeReload: detachRuntimePanelsForEditor,
  });
  async function disposeMountedEditor(): Promise<void> {
    if (disposed) return;
    if (disposal) return disposal;
    const pending = (async () => {
      runtimePanels.dispose();
      await editorSwitcher.dispose();
      disposed = true;
    })();
    disposal = pending;
    try {
      await pending;
    } finally {
      if (disposal === pending) disposal = null;
    }
  }

  return {
    detachForEditor: detachRuntimePanelsForEditor,
    dispose: disposeMountedEditor,
  };
}
