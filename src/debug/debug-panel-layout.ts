export interface RuntimeDebugPanelLayoutController {
  dispose(): void;
  isVisible(): boolean;
  setVisible(visible: boolean): void;
}

type RuntimeDebugLayout = {
  host: HTMLElement;
  content: HTMLElement;
  globalButton: HTMLButtonElement;
  ownerDocument: Document;
  users: number;
  visible: boolean;
};

const DEBUG_PANEL_HOST_ID = 'runtime-debug-panel-host';
const DEBUG_PANEL_CONTENT_ID = 'runtime-debug-panel-content';
const DEBUG_PANEL_VISIBILITY_STORAGE_KEY = 'pa-template.debug-panels.visible';
const DEBUG_PANEL_VISIBLE_ATTRIBUTE = 'data-runtime-debug-panels-visible';

let activeLayout: RuntimeDebugLayout | null = null;

export function installDebugPanelLayout(root: HTMLElement = document.body): RuntimeDebugPanelLayoutController {
  const layout = acquireLayout(root);
  return {
    dispose: () => releaseLayout(layout),
    isVisible: () => layout.visible,
    setVisible: (visible: boolean) => setDebugPanelVisibility(layout, visible),
  };
}

export function mountRuntimeDebugPanelContainer(root: HTMLElement, container: HTMLElement): () => void {
  const layout = acquireLayout(root);
  container.setAttribute('data-runtime-debug-panel-container', '');
  container.style.position = 'relative';
  container.style.pointerEvents = 'auto';
  container.style.userSelect = '';
  layout.content.append(container);

  return () => {
    container.remove();
    releaseLayout(layout);
  };
}

export function createRuntimeDebugPanelButton(ownerDocument: Document, text: string): HTMLButtonElement {
  const button = ownerDocument.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.style.cssText = [
    'pointer-events:auto',
    'height:32px',
    'min-width:64px',
    'padding:0 12px',
    'border:1px solid rgba(148,163,184,.36)',
    'border-radius:7px',
    'background:rgba(15,23,42,.88)',
    'color:#f8fafc',
    'font:700 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'box-shadow:0 10px 26px rgba(0,0,0,.28)',
    'cursor:pointer',
    'white-space:nowrap',
  ].join(';');
  return button;
}

export function readDebugHudVisible(ownerDocument: Document = document): boolean {
  const visible = ownerDocument.documentElement.getAttribute(DEBUG_PANEL_VISIBLE_ATTRIBUTE);
  if (visible === 'false') return false;
  if (visible === 'true') return true;
  return readStoredBoolean(ownerDocument.defaultView ?? window, DEBUG_PANEL_VISIBILITY_STORAGE_KEY, true);
}

function acquireLayout(root: HTMLElement): RuntimeDebugLayout {
  const layout = ensureLayout(root);
  layout.users += 1;
  return layout;
}

function releaseLayout(layout: RuntimeDebugLayout): void {
  layout.users -= 1;
  if (layout.users > 0) return;
  layout.ownerDocument.documentElement.removeAttribute(DEBUG_PANEL_VISIBLE_ATTRIBUTE);
  layout.host.remove();
  if (activeLayout === layout) activeLayout = null;
}

function ensureLayout(root: HTMLElement): RuntimeDebugLayout {
  const ownerDocument = root.ownerDocument;
  if (activeLayout && activeLayout.ownerDocument === ownerDocument && activeLayout.host.isConnected) {
    return activeLayout;
  }

  ownerDocument.getElementById(DEBUG_PANEL_HOST_ID)?.remove();
  const win = ownerDocument.defaultView ?? window;
  const visible = readStoredBoolean(win, DEBUG_PANEL_VISIBILITY_STORAGE_KEY, true);

  const host = ownerDocument.createElement('aside');
  host.id = DEBUG_PANEL_HOST_ID;
  host.setAttribute('data-input-layer', '');
  host.setAttribute('aria-label', 'Runtime debug panels');
  host.style.cssText = [
    'position:fixed',
    'left:16px',
    'right:16px',
    'bottom:16px',
    'z-index:2147482600',
    'display:flex',
    'flex-wrap:wrap',
    'align-items:flex-end',
    'gap:8px',
    'pointer-events:none',
    'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';');

  const globalButton = createRuntimeDebugPanelButton(ownerDocument, 'Debug');
  globalButton.title = 'Show or hide runtime debug panels';

  const content = ownerDocument.createElement('div');
  content.id = DEBUG_PANEL_CONTENT_ID;
  content.style.cssText = [
    'display:flex',
    'flex-wrap:wrap',
    'align-items:flex-end',
    'gap:8px',
    'pointer-events:none',
  ].join(';');

  host.append(globalButton, content);
  root.append(host);

  const layout: RuntimeDebugLayout = {
    host,
    content,
    globalButton,
    ownerDocument,
    users: 0,
    visible,
  };

  globalButton.addEventListener('click', () => {
    setDebugPanelVisibility(layout, !layout.visible);
  });
  renderDebugPanelVisibility(layout);
  activeLayout = layout;
  return layout;
}

function setDebugPanelVisibility(layout: RuntimeDebugLayout, visible: boolean): void {
  layout.visible = visible;
  writeStoredBoolean(layout.ownerDocument.defaultView ?? window, DEBUG_PANEL_VISIBILITY_STORAGE_KEY, visible);
  renderDebugPanelVisibility(layout);
}

function renderDebugPanelVisibility(layout: RuntimeDebugLayout): void {
  layout.ownerDocument.documentElement.setAttribute(DEBUG_PANEL_VISIBLE_ATTRIBUTE, layout.visible ? 'true' : 'false');
  layout.content.style.display = layout.visible ? 'flex' : 'none';
  layout.globalButton.setAttribute('aria-pressed', String(layout.visible));
  layout.globalButton.style.opacity = layout.visible ? '1' : '.72';
}

function readStoredBoolean(win: Window, key: string, fallback: boolean): boolean {
  try {
    const value = win.localStorage.getItem(key);
    if (value === 'true') return true;
    if (value === 'false') return false;
  } catch {
    return fallback;
  }
  return fallback;
}

function writeStoredBoolean(win: Window, key: string, value: boolean): void {
  try {
    win.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures in sandboxed previews.
  }
}
