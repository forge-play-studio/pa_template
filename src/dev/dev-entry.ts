import { DevHost } from './DevHost';
import { mountEditorEntryButton } from './editor-entry-view';
import { playableAnalyticsService } from '../services';

const host = new DevHost();
const restartProjectGame = (context?: Parameters<DevHost['restart']>[0]): Promise<void> => (
  host.restart(context)
);
const disposeEditorEntryButton = mountEditorEntryButton(host);

window.__restartProjectGame = restartProjectGame;

function hasRenderCanvas(): boolean {
  return document.getElementById('renderCanvas') instanceof HTMLCanvasElement;
}

function startWhenReady(): void {
  if (!hasRenderCanvas()) return;
  void host.start().catch(error => console.error('[DevHost] start failed', error));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startWhenReady, { once: true });
  queueMicrotask(startWhenReady);
} else {
  startWhenReady();
}

const reportCompleted = (): void => playableAnalyticsService.reportCompleted();
const disposeForUnload = (): void => {
  reportCompleted();
  void host.dispose().catch(error => console.warn('[DevHost] dispose failed', error));
};

window.addEventListener('beforeunload', disposeForUnload);
window.addEventListener('pagehide', reportCompleted);

import.meta.hot?.dispose(() => {
  window.removeEventListener('beforeunload', disposeForUnload);
  window.removeEventListener('pagehide', reportCompleted);
  disposeEditorEntryButton();
  if (window.__restartProjectGame === restartProjectGame) delete window.__restartProjectGame;
  void host.dispose().catch(error => console.warn('[DevHost] hot-dispose failed', error));
});
