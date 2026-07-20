import type { GameWorld } from '../runtime/GameWorld';
import type { ProjectGameplayRuntime } from '../gameplay';
import type { Disposable } from './framework/disposables';
import type { RuntimeDebugActionRegistry } from './framework/debug-action-registry';
import {
  installDebugPanelLayout,
  type RuntimeDebugPanelLayoutController,
} from './framework/panel-layout';
import { runtimeGameplayDebugPanelDescriptors } from './panel-manifest';

export interface RuntimeGameplayDebugPanelsOptions {
  root?: HTMLElement;
  getGame: () => GameWorld | null;
  getGameplayRuntime: () => ProjectGameplayRuntime | null;
  actions: RuntimeDebugActionRegistry;
}

export interface RuntimeGameplayDebugPanelDescriptor {
  id: string;
  title: string;
  phase: number | 'presentation' | 'framework';
  mount(options: Required<RuntimeGameplayDebugPanelsOptions>): Disposable;
}

export type RuntimeGameplayDebugPanels = Disposable;

export function mountRuntimeGameplayDebugPanels(options: RuntimeGameplayDebugPanelsOptions): RuntimeGameplayDebugPanels {
  const root = options.root ?? document.body;
  const mountOptions: Required<RuntimeGameplayDebugPanelsOptions> = {
    root,
    getGame: options.getGame,
    getGameplayRuntime: options.getGameplayRuntime,
    actions: options.actions,
  };
  let layout: RuntimeDebugPanelLayoutController | null = null;
  const panels: Disposable[] = [];

  if (runtimeGameplayDebugPanelDescriptors.length > 0) {
    layout = installDebugPanelLayout(root);
  }

  for (const descriptor of runtimeGameplayDebugPanelDescriptors) {
    panels.push(descriptor.mount(mountOptions));
  }

  return {
    dispose() {
      for (let index = panels.length - 1; index >= 0; index -= 1) {
        panels[index]?.dispose();
      }
      panels.length = 0;
      layout?.dispose();
      layout = null;
    },
  };
}
