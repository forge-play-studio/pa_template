import type { Game } from '../core/Game';
import {
  installDebugPanelLayout,
  type RuntimeDebugPanelLayoutController,
} from './debug-panel-layout';

export interface RuntimeGameplayDebugPanelsOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export interface RuntimeGameplayDebugPanels {
  dispose(): void;
}

type RuntimeGameplayDebugPanelMount = (options: Required<RuntimeGameplayDebugPanelsOptions>) => RuntimeGameplayDebugPanels;

const panelMounts: RuntimeGameplayDebugPanelMount[] = [
  // Phase-specific debug panels generated through the debug-panel skill should be registered here.
];

export function mountRuntimeGameplayDebugPanels(options: RuntimeGameplayDebugPanelsOptions): RuntimeGameplayDebugPanels {
  const root = options.root ?? document.body;
  const mountOptions: Required<RuntimeGameplayDebugPanelsOptions> = {
    root,
    getGame: options.getGame,
  };
  let layout: RuntimeDebugPanelLayoutController | null = null;
  const panels: RuntimeGameplayDebugPanels[] = [];

  if (panelMounts.length > 0) {
    layout = installDebugPanelLayout(root);
  }

  for (const mount of panelMounts) {
    panels.push(mount(mountOptions));
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
