import type { Disposable } from './disposables';

export interface RuntimeDebugPanelLayoutController extends Disposable {
  isVisible(): boolean;
  setVisible(visible: boolean): void;
}

export interface RuntimeDebugPanelOptions {
  id: string;
  title: string;
  phase?: number | 'presentation' | 'framework';
  root?: HTMLElement;
  render(content: HTMLElement): Disposable | void;
}

type RuntimeDebugLayout = {
  host: HTMLElement;
  content: HTMLElement;
  globalButton: HTMLButtonElement;
  ownerDocument: Document;
  users: number;
  visible: boolean;
  draggedPanelId: string | null;
};

const DEBUG_PANEL_HOST_ID = 'runtime-debug-panel-host';
const DEBUG_PANEL_CONTENT_ID = 'runtime-debug-panel-content';
const DEBUG_PANEL_VISIBILITY_STORAGE_KEY = 'pa-template.debug-panels.visible';
const DEBUG_PANEL_ORDER_STORAGE_KEY = 'pa-template.debug-panels.order';
const DEBUG_PANEL_COLLAPSED_STORAGE_PREFIX = 'pa-template.debug-panels.collapsed.';
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

export function mountRuntimeDebugPanel(options: RuntimeDebugPanelOptions): Disposable {
  const root = options.root ?? document.body;
  const layout = acquireLayout(root);
  const ownerDocument = layout.ownerDocument;
  const panel = ownerDocument.createElement('section');
  const header = ownerDocument.createElement('header');
  const title = ownerDocument.createElement('div');
  const meta = ownerDocument.createElement('span');
  const collapseButton = createRuntimeDebugPanelButton(ownerDocument, '');
  const body = ownerDocument.createElement('div');

  panel.dataset.runtimeDebugPanelId = options.id;
  panel.draggable = true;
  panel.style.cssText = [
    'position:relative',
    'width:fit-content',
    'max-width:calc(100vw - 32px)',
    'pointer-events:auto',
    'user-select:none',
  ].join(';');

  header.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:8px',
    'height:28px',
    'padding:0 6px 0 10px',
    'border:1px solid rgba(148,163,184,.34)',
    'border-bottom:0',
    'border-radius:8px 8px 0 0',
    'background:rgba(30,41,59,.92)',
    'color:#f8fafc',
    'font:700 11px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'cursor:grab',
  ].join(';');

  title.textContent = options.title;
  title.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  meta.textContent = options.phase ? `P${options.phase}` : '';
  meta.style.cssText = 'color:#94a3b8;font-weight:700;font-size:10px';
  collapseButton.style.height = '22px';
  collapseButton.style.minWidth = '28px';
  collapseButton.style.padding = '0 6px';

  const titleWrap = ownerDocument.createElement('div');
  titleWrap.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0';
  titleWrap.append(title, meta);
  header.append(titleWrap, collapseButton);

  body.style.cssText = 'display:block';
  panel.append(header, body);

  const collapsedKey = `${DEBUG_PANEL_COLLAPSED_STORAGE_PREFIX}${options.id}`;
  let collapsed = readStoredBoolean(ownerDocument.defaultView ?? window, collapsedKey, false);
  const renderCollapsedState = () => {
    body.style.display = collapsed ? 'none' : 'block';
    collapseButton.textContent = collapsed ? '+' : '-';
    collapseButton.title = collapsed ? 'Expand panel' : 'Collapse panel';
  };
  collapseButton.addEventListener('click', () => {
    collapsed = !collapsed;
    writeStoredBoolean(ownerDocument.defaultView ?? window, collapsedKey, collapsed);
    renderCollapsedState();
  });
  renderCollapsedState();

  panel.addEventListener('dragstart', (event) => {
    layout.draggedPanelId = options.id;
    event.dataTransfer?.setData('text/plain', options.id);
    event.dataTransfer?.setDragImage(panel, 12, 12);
    header.style.cursor = 'grabbing';
  });
  panel.addEventListener('dragend', () => {
    layout.draggedPanelId = null;
    header.style.cursor = 'grab';
    savePanelOrder(layout);
  });
  panel.addEventListener('dragover', (event) => {
    if (!layout.draggedPanelId || layout.draggedPanelId === options.id) return;
    event.preventDefault();
  });
  panel.addEventListener('drop', (event) => {
    event.preventDefault();
    const draggedId = event.dataTransfer?.getData('text/plain') || layout.draggedPanelId;
    if (!draggedId || draggedId === options.id) return;
    const draggedPanel = layout.content.querySelector<HTMLElement>(`[data-runtime-debug-panel-id="${cssEscape(draggedId)}"]`);
    if (!draggedPanel) return;
    const rect = panel.getBoundingClientRect();
    const insertAfter = event.clientX > rect.left + rect.width / 2;
    layout.content.insertBefore(draggedPanel, insertAfter ? panel.nextSibling : panel);
    savePanelOrder(layout);
  });

  const rendered = options.render(body);
  appendPanelByStoredOrder(layout, panel);

  return {
    dispose() {
      rendered?.dispose();
      panel.remove();
      releaseLayout(layout);
    },
  };
}

export function mountRuntimeDebugPanelContainer(root: HTMLElement, container: HTMLElement): () => void {
  const registration = mountRuntimeDebugPanel({
    id: container.id || `panel_${Math.random().toString(36).slice(2)}`,
    title: container.getAttribute('aria-label') || 'Debug Panel',
    root,
    render(content) {
      container.setAttribute('data-runtime-debug-panel-container', '');
      container.style.position = 'relative';
      container.style.pointerEvents = 'auto';
      container.style.userSelect = '';
      content.append(container);
      return {
        dispose() {
          container.remove();
        },
      };
    },
  });
  return () => registration.dispose();
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
    draggedPanelId: null,
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

function appendPanelByStoredOrder(layout: RuntimeDebugLayout, panel: HTMLElement): void {
  const panelId = panel.dataset.runtimeDebugPanelId ?? '';
  const order = readPanelOrder(layout.ownerDocument.defaultView ?? window);
  const targetIndex = order.indexOf(panelId);
  if (targetIndex < 0) {
    layout.content.append(panel);
    savePanelOrder(layout);
    return;
  }
  const existingPanels = [...layout.content.querySelectorAll<HTMLElement>('[data-runtime-debug-panel-id]')];
  const before = existingPanels.find((candidate) => {
    const candidateId = candidate.dataset.runtimeDebugPanelId ?? '';
    const candidateIndex = order.indexOf(candidateId);
    return candidateIndex >= 0 && candidateIndex > targetIndex;
  });
  layout.content.insertBefore(panel, before ?? null);
  savePanelOrder(layout);
}

function savePanelOrder(layout: RuntimeDebugLayout): void {
  const order = [...layout.content.querySelectorAll<HTMLElement>('[data-runtime-debug-panel-id]')]
    .map((panel) => panel.dataset.runtimeDebugPanelId)
    .filter((id): id is string => !!id);
  try {
    (layout.ownerDocument.defaultView ?? window).localStorage.setItem(DEBUG_PANEL_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Ignore storage failures in sandboxed previews.
  }
}

function readPanelOrder(win: Window): string[] {
  try {
    const value = win.localStorage.getItem(DEBUG_PANEL_ORDER_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
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

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}
