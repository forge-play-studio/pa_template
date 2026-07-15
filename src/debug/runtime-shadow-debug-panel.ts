/** Thin project wrapper around the shared editor-browser shadow tuning panel. */
import {
  mountEditorRuntimeShadowDebugPanel,
  type EditorRuntimeShadowDebugPanel,
} from '@fps-games/editor/playable-sdk';
import type { Game } from '../core/Game';
import {
  loadSceneMainSource,
  renderingRuntime,
  saveSceneMainSource,
} from '../services/fps-game-editor/scene-feature';
import { mountRuntimeDebugPanelContainer } from './framework/panel-layout';

export interface RuntimeShadowDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export type RuntimeShadowDebugPanel = EditorRuntimeShadowDebugPanel;

export function mountRuntimeShadowDebugPanel(
  options: RuntimeShadowDebugPanelOptions,
): RuntimeShadowDebugPanel {
  const root = options.root ?? document.body;
  const host = root.ownerDocument.createElement('div');
  host.id = 'runtime-shadow-debug-panel';
  host.setAttribute('aria-label', 'Shadow');
  const unmountHost = mountRuntimeDebugPanelContainer(root, host, { placement: 'right-rail' });
  const panel = mountEditorRuntimeShadowDebugPanel({
    root: host,
    panelMode: 'managed',
    placement: { width: '100%' },
    getService: () => options.getGame()?.getRendererShadows() ?? null,
    saveGlobalOpacity,
    reloadAfterSave: true,
  });
  return {
    dispose() {
      panel.dispose();
      unmountHost();
    },
  };
}

async function saveGlobalOpacity(opacity: number): Promise<void> {
  const config = structuredClone(renderingRuntime.getState().draftConfig);
  const shadows = ensureRecord(config, 'shadows');
  const settings = ensureRecord(shadows, 'settings');
  settings.globalOpacity = Math.max(0, Math.min(1, opacity));
  renderingRuntime.setConfig(config);
  const loaded = await loadSceneMainSource();
  await saveSceneMainSource(loaded.document, { mode: 'local-commit-save' });
}

function ensureRecord(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = parent[key];
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }
  const created: Record<string, unknown> = {};
  parent[key] = created;
  return created;
}
