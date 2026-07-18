import { DevHost } from './DevHost';
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

function mountEditorEntryButton(currentHost: DevHost): () => void {
  const existing = document.getElementById('pa-template-editor-entry');
  if (existing) existing.remove();

  const button = document.createElement('button');
  button.id = 'pa-template-editor-entry';
  button.type = 'button';
  button.textContent = '进入编辑场景';
  button.title = '进入编辑场景';
  button.style.cssText = [
    'position:fixed',
    'top:14px',
    'right:16px',
    'z-index:2147482604',
    'height:32px',
    'min-width:104px',
    'padding:0 12px',
    'border:1px solid #aee7c2',
    'border-radius:999px',
    'background:#e1f8e8',
    'color:#2f6f52',
    'font:800 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'box-shadow:0 8px 20px rgba(15,23,42,.18)',
    'cursor:pointer',
    'white-space:nowrap',
    'user-select:none',
  ].join(';');

  const enterEditor = async (): Promise<void> => {
    button.disabled = true;
    button.textContent = '正在进入编辑界面…';
    button.style.opacity = '.72';
    try {
      await currentHost.enterEditor();
      button.remove();
    } catch (error) {
      console.error('[DevHost] enter editor failed', error);
      button.disabled = false;
      button.textContent = '进入编辑场景';
      button.style.opacity = '1';
    }
  };

  button.addEventListener('click', () => {
    void enterEditor();
  });
  document.body.append(button);

  return () => {
    button.remove();
  };
}
