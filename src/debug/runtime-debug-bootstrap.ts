/**
 * Dev-only runtime debug lifecycle entry.
 * Last updated: 2026-07-05.
 *
 * This file stays in `src/debug` because it owns panel mount/dispose lifecycle
 * for runtime debug UI. Project `src/dev/DevHost.ts` mounts it for each Play
 * mode lifetime; Editor Entry only requests mode transitions.
 */
import type { GameWorld } from '../runtime/GameWorld';
import type { ProjectGameplayRuntime } from '../gameplay';
import { mountCameraDebugPanel } from './camera-debug-panel';
import { mountRuntimeAudioDebugPanel } from './runtime-audio-debug-panel';
import { mountRuntimeGameplayDebugPanels } from './runtime-gameplay-debug-panels';
import { mountRuntimeLightingDebugPanel } from './runtime-lighting-debug-panel';
import { mountRuntimeVfxDebugPanel } from './runtime-vfx-debug-panel';
import { DisposableStack } from './framework/disposables';
import { createRuntimeDebugPanelManager } from './framework/panel-manager';

export interface RuntimeDebugBootstrapOptions {
  root?: HTMLElement;
  getGame: () => GameWorld | null;
  getGameplayRuntime: () => ProjectGameplayRuntime | null;
}

export interface RuntimeDebugBootstrap {
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
    getGameplayRuntime: options.getGameplayRuntime,
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

  let disposed = false;
  let disposal: Promise<void> | null = null;
  async function disposeRuntimeDebug(): Promise<void> {
    if (disposed) return;
    if (disposal) return disposal;
    const pending = (async () => {
      runtimePanels.dispose();
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
    dispose: disposeRuntimeDebug,
  };
}
