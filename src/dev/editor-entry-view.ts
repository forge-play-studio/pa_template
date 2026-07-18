import type { PlayableEditorEntryState } from '@fps-games/editor/playable-sdk';
import type { DevHost, DevHostEditorEntryViewState } from './DevHost';

export type EditorEntryButtonAction = 'none' | 'enter' | 'retry' | 'reload';

export interface EditorEntryButtonPresentation {
  readonly action: EditorEntryButtonAction;
  readonly disabled: boolean;
  readonly hidden: boolean;
  readonly label: string;
  readonly title: string;
}

export function resolveEditorEntryButtonPresentation(
  state: DevHostEditorEntryViewState,
): EditorEntryButtonPresentation {
  const entry = state.entry;
  switch (entry.phase) {
    case 'idle':
      return presentation('none', true, false, '游戏加载中…');
    case 'warming':
      return presentation(
        'none',
        true,
        false,
        state.gameReady ? '正在准备编辑器…' : '游戏加载中…',
      );
    case 'ready':
      return presentation('enter', false, false, '进入编辑场景');
    case 'preparing':
      return presentation('none', true, false, '正在检查编辑环境…');
    case 'committing':
      return presentation('none', true, false, '正在进入编辑界面…');
    case 'rolling-back':
      return presentation('none', true, false, '正在恢复游戏…');
    case 'failed':
      return entry.failure?.recoverable
        ? presentation('retry', false, false, '重试进入编辑器', entry.failure.message)
        : presentation('reload', false, false, '刷新页面恢复', entry.failure?.message);
    case 'editing':
    case 'disposed':
      return presentation('none', true, true, '进入编辑场景');
  }
}

export function mountEditorEntryButton(currentHost: DevHost): () => void {
  document.getElementById('pa-template-editor-entry')?.remove();
  const button = document.createElement('button');
  button.id = 'pa-template-editor-entry';
  button.type = 'button';
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
    'white-space:nowrap',
    'user-select:none',
  ].join(';');

  let presentationState = resolveEditorEntryButtonPresentation(
    currentHost.getEditorEntryViewState(),
  );
  const render = (state: DevHostEditorEntryViewState): void => {
    presentationState = resolveEditorEntryButtonPresentation(state);
    button.disabled = presentationState.disabled;
    button.textContent = presentationState.label;
    button.title = presentationState.title;
    button.style.opacity = presentationState.disabled ? '.72' : '1';
    button.style.cursor = presentationState.disabled ? 'default' : 'pointer';
    if (presentationState.hidden) button.remove();
    else if (!button.isConnected) document.body.append(button);
  };

  const unsubscribe = currentHost.subscribeEditorEntryView(render);
  const activate = async (): Promise<void> => {
    if (presentationState.action === 'enter') await currentHost.enterEditor();
    else if (presentationState.action === 'retry') await currentHost.retryEditorEntry();
    else if (presentationState.action === 'reload') window.location.reload();
  };
  button.addEventListener('click', () => {
    void activate().catch(error => console.error('[DevHost] editor entry action failed', error));
  });

  return () => {
    unsubscribe();
    button.remove();
  };
}

function presentation(
  action: EditorEntryButtonAction,
  disabled: boolean,
  hidden: boolean,
  label: string,
  title = label,
): EditorEntryButtonPresentation {
  return Object.freeze({ action, disabled, hidden, label, title });
}

export function createEditorEntryViewState(
  entry: PlayableEditorEntryState,
  gameReady: boolean,
): DevHostEditorEntryViewState {
  return Object.freeze({ entry, gameReady });
}
