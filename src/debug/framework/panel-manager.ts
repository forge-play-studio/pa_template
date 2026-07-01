import type { Disposable } from './disposables';
import { RuntimeDebugActionRegistry } from './debug-action-registry';

export type RuntimeDebugPanelPlacement = 'bottom-dock' | 'right-rail' | 'modal';

export interface RuntimeDebugPanelManagerOptions {
  root?: HTMLElement;
}

export interface RuntimeDebugPanelRegistrationOptions {
  id: string;
  title: string;
  phase?: number | 'presentation' | 'framework';
  placement?: RuntimeDebugPanelPlacement;
  render(content: HTMLElement): Disposable | void;
}

export interface RuntimeDebugPanelContainerOptions {
  id: string;
  title: string;
  placement?: RuntimeDebugPanelPlacement;
  container: HTMLElement;
}

export interface RuntimeDebugPanelManager extends Disposable {
  readonly actions: RuntimeDebugActionRegistry;
  isVisible(): boolean;
  setVisible(visible: boolean): void;
  registerPanel(options: RuntimeDebugPanelRegistrationOptions): Disposable;
  registerContainer(options: RuntimeDebugPanelContainerOptions): Disposable;
}

type RuntimeDebugPanelManagerInternal = RuntimeDebugPanelManager & {
  readonly ownerDocument: Document;
  readonly rootElement: HTMLElement;
};

type AutoManagerState = {
  manager: RuntimeDebugPanelManagerInternal;
  users: number;
};

type RuntimeDebugPanelItem = {
  id: string;
  placement: RuntimeDebugPanelPlacement;
  element: HTMLElement;
};

const DEBUG_MANAGER_ROOT_ID = 'runtime-debug-panel-manager-root';
const DEBUG_MANAGER_TOOLBAR_ID = 'runtime-debug-panel-manager-toolbar';
const DEBUG_MANAGER_BOTTOM_DOCK_ID = 'runtime-debug-panel-manager-bottom-dock';
const DEBUG_MANAGER_RIGHT_RAIL_ID = 'runtime-debug-panel-manager-right-rail';
const DEBUG_PANEL_VISIBILITY_STORAGE_KEY = 'pa-template.debug-panels.visible';
const DEBUG_PANEL_ORDER_STORAGE_KEY = 'pa-template.debug-panels.order';
const DEBUG_PANEL_COLLAPSED_STORAGE_PREFIX = 'pa-template.debug-panels.collapsed.';
const DEBUG_PANEL_VISIBLE_ATTRIBUTE = 'data-runtime-debug-panels-visible';

let activeManager: RuntimeDebugPanelManagerInternal | null = null;
let autoManager: AutoManagerState | null = null;

export function createRuntimeDebugPanelManager(
  options: RuntimeDebugPanelManagerOptions = {},
): RuntimeDebugPanelManager {
  const manager = new RuntimeDebugPanelManagerImpl(options.root ?? document.body, true);
  activeManager = manager;
  return manager;
}

export function getActiveRuntimeDebugPanelManager(): RuntimeDebugPanelManager | null {
  return activeManager;
}

export function acquireRuntimeDebugPanelManager(
  root: HTMLElement = document.body,
): { manager: RuntimeDebugPanelManager; release: () => void } {
  const ownerDocument = root.ownerDocument;
  if (activeManager && activeManager.ownerDocument === ownerDocument && activeManager.rootElement.isConnected) {
    return { manager: activeManager, release: () => {} };
  }

  if (autoManager?.manager.ownerDocument === ownerDocument && autoManager.manager.rootElement.isConnected) {
    autoManager.users += 1;
  } else {
    autoManager?.manager.dispose();
    autoManager = {
      manager: new RuntimeDebugPanelManagerImpl(root, false),
      users: 1,
    };
  }

  return {
    manager: autoManager.manager,
    release: () => {
      if (!autoManager) return;
      autoManager.users -= 1;
      if (autoManager.users > 0) return;
      autoManager.manager.dispose();
      autoManager = null;
    },
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

export function readRuntimeDebugPanelsVisible(ownerDocument: Document = document): boolean {
  const visible = ownerDocument.documentElement.getAttribute(DEBUG_PANEL_VISIBLE_ATTRIBUTE);
  if (visible === 'false') return false;
  if (visible === 'true') return true;
  return readStoredBoolean(ownerDocument.defaultView ?? window, DEBUG_PANEL_VISIBILITY_STORAGE_KEY, true);
}

class RuntimeDebugPanelManagerImpl implements RuntimeDebugPanelManagerInternal {
  readonly ownerDocument: Document;
  readonly rootElement: HTMLElement;
  readonly actions: RuntimeDebugActionRegistry;
  private readonly hostRoot: HTMLElement;
  private readonly toolbar: HTMLElement;
  private readonly bottomDock: HTMLElement;
  private readonly rightRail: HTMLElement;
  private readonly globalButton: HTMLButtonElement;
  private readonly items = new Map<string, RuntimeDebugPanelItem>();
  private readonly permanent: boolean;
  private visible: boolean;
  private disposed = false;
  private draggedPanelId: string | null = null;

  constructor(hostRoot: HTMLElement, permanent: boolean) {
    this.hostRoot = hostRoot;
    this.ownerDocument = hostRoot.ownerDocument;
    this.permanent = permanent;
    this.visible = readStoredBoolean(this.ownerDocument.defaultView ?? window, DEBUG_PANEL_VISIBILITY_STORAGE_KEY, true);
    this.actions = new RuntimeDebugActionRegistry(this.ownerDocument.defaultView ?? window);

    this.ownerDocument.getElementById(DEBUG_MANAGER_ROOT_ID)?.remove();
    this.rootElement = this.ownerDocument.createElement('aside');
    this.rootElement.id = DEBUG_MANAGER_ROOT_ID;
    this.rootElement.setAttribute('data-input-layer', '');
    this.rootElement.setAttribute('aria-label', 'Runtime debug panels');
    this.rootElement.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147482600',
      'pointer-events:none',
      'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    ].join(';');

    this.toolbar = this.ownerDocument.createElement('div');
    this.toolbar.id = DEBUG_MANAGER_TOOLBAR_ID;
    this.toolbar.style.cssText = [
      'position:fixed',
      'top:14px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:2147482602',
      'display:flex',
      'gap:8px',
      'align-items:center',
      'pointer-events:none',
    ].join(';');

    this.globalButton = createRuntimeDebugPanelButton(this.ownerDocument, 'Debug');
    this.globalButton.title = 'Show or hide runtime debug panels';
    this.globalButton.addEventListener('click', () => this.setVisible(!this.visible));
    this.toolbar.append(this.globalButton);

    this.bottomDock = this.ownerDocument.createElement('div');
    this.bottomDock.id = DEBUG_MANAGER_BOTTOM_DOCK_ID;
    this.bottomDock.style.cssText = [
      'position:fixed',
      'left:16px',
      'right:376px',
      'bottom:16px',
      'display:flex',
      'flex-wrap:wrap',
      'align-items:flex-end',
      'gap:8px',
      'pointer-events:none',
    ].join(';');

    this.rightRail = this.ownerDocument.createElement('div');
    this.rightRail.id = DEBUG_MANAGER_RIGHT_RAIL_ID;
    this.rightRail.style.cssText = [
      'position:fixed',
      'top:54px',
      'right:16px',
      'bottom:16px',
      'width:344px',
      'display:flex',
      'flex-direction:column',
      'align-items:stretch',
      'gap:8px',
      'overflow:auto',
      'pointer-events:none',
    ].join(';');

    this.rootElement.append(this.toolbar, this.bottomDock, this.rightRail);
    this.hostRoot.append(this.rootElement);
    this.renderVisibility();
  }

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    writeStoredBoolean(this.ownerDocument.defaultView ?? window, DEBUG_PANEL_VISIBILITY_STORAGE_KEY, visible);
    this.renderVisibility();
  }

  registerPanel(options: RuntimeDebugPanelRegistrationOptions): Disposable {
    const placement = options.placement ?? 'bottom-dock';
    const panel = this.createPanelElement(options);
    const body = panel.querySelector<HTMLElement>('[data-runtime-debug-panel-body]');
    const rendered = body ? options.render(body) : undefined;
    this.registerItem({ id: options.id, placement, element: panel });

    return {
      dispose: () => {
        rendered?.dispose();
        this.unregisterItem(options.id);
      },
    };
  }

  registerContainer(options: RuntimeDebugPanelContainerOptions): Disposable {
    const placement = options.placement ?? 'bottom-dock';
    const container = options.container;
    container.setAttribute('data-runtime-debug-panel-container', '');
    container.setAttribute('data-runtime-debug-panel-id', options.id);
    container.setAttribute('data-runtime-debug-panel-title', options.title);
    container.style.position = 'relative';
    container.style.pointerEvents = 'auto';
    container.style.userSelect = '';
    this.makeItemDraggable(container, options.id);
    this.registerItem({ id: options.id, placement, element: container });
    return {
      dispose: () => this.unregisterItem(options.id),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const item of [...this.items.values()]) item.element.remove();
    this.items.clear();
    this.actions.dispose();
    this.ownerDocument.documentElement.removeAttribute(DEBUG_PANEL_VISIBLE_ATTRIBUTE);
    this.rootElement.remove();
    if (activeManager === this) activeManager = null;
    if (!this.permanent && autoManager?.manager === this) autoManager = null;
  }

  private createPanelElement(options: RuntimeDebugPanelRegistrationOptions): HTMLElement {
    const panel = this.ownerDocument.createElement('section');
    const header = this.ownerDocument.createElement('header');
    const title = this.ownerDocument.createElement('div');
    const meta = this.ownerDocument.createElement('span');
    const collapseButton = createRuntimeDebugPanelButton(this.ownerDocument, '');
    const body = this.ownerDocument.createElement('div');

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

    const titleWrap = this.ownerDocument.createElement('div');
    titleWrap.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0';
    titleWrap.append(title, meta);
    header.append(titleWrap, collapseButton);

    body.setAttribute('data-runtime-debug-panel-body', '');
    body.style.cssText = 'display:block';
    panel.append(header, body);

    const collapsedKey = `${DEBUG_PANEL_COLLAPSED_STORAGE_PREFIX}${options.id}`;
    let collapsed = readStoredBoolean(this.ownerDocument.defaultView ?? window, collapsedKey, false);
    const renderCollapsedState = () => {
      body.style.display = collapsed ? 'none' : 'block';
      collapseButton.textContent = collapsed ? '+' : '-';
      collapseButton.title = collapsed ? 'Expand panel' : 'Collapse panel';
    };
    collapseButton.addEventListener('click', () => {
      collapsed = !collapsed;
      writeStoredBoolean(this.ownerDocument.defaultView ?? window, collapsedKey, collapsed);
      renderCollapsedState();
    });
    renderCollapsedState();
    this.makeItemDraggable(panel, options.id, header);
    return panel;
  }

  private registerItem(item: RuntimeDebugPanelItem): void {
    this.unregisterItem(item.id);
    this.items.set(item.id, item);
    this.appendItemByStoredOrder(item);
    this.savePanelOrder();
    this.renderLayoutReservation();
  }

  private unregisterItem(id: string): void {
    const existing = this.items.get(id);
    if (!existing) return;
    existing.element.remove();
    this.items.delete(id);
    this.savePanelOrder();
    this.renderLayoutReservation();
  }

  private getPlacementRoot(placement: RuntimeDebugPanelPlacement): HTMLElement {
    if (placement === 'right-rail') return this.rightRail;
    if (placement === 'modal') return this.bottomDock;
    return this.bottomDock;
  }

  private appendItemByStoredOrder(item: RuntimeDebugPanelItem): void {
    const parent = this.getPlacementRoot(item.placement);
    const order = readPanelOrder(this.ownerDocument.defaultView ?? window);
    const targetIndex = order.indexOf(item.id);
    if (targetIndex < 0) {
      parent.append(item.element);
      return;
    }
    const existingItems = [...parent.querySelectorAll<HTMLElement>('[data-runtime-debug-panel-id]')];
    const before = existingItems.find((candidate) => {
      const candidateId = candidate.dataset.runtimeDebugPanelId ?? '';
      const candidateIndex = order.indexOf(candidateId);
      return candidateIndex >= 0 && candidateIndex > targetIndex;
    });
    parent.insertBefore(item.element, before ?? null);
  }

  private makeItemDraggable(item: HTMLElement, id: string, handle: HTMLElement = item): void {
    item.dataset.runtimeDebugPanelId = id;
    item.draggable = true;
    item.addEventListener('dragstart', (event) => {
      this.draggedPanelId = id;
      event.dataTransfer?.setData('text/plain', id);
      event.dataTransfer?.setDragImage(item, 12, 12);
      handle.style.cursor = 'grabbing';
    });
    item.addEventListener('dragend', () => {
      this.draggedPanelId = null;
      handle.style.cursor = handle === item ? '' : 'grab';
      this.savePanelOrder();
    });
    item.addEventListener('dragover', (event) => {
      if (!this.draggedPanelId || this.draggedPanelId === id) return;
      event.preventDefault();
    });
    item.addEventListener('drop', (event) => {
      event.preventDefault();
      const draggedId = event.dataTransfer?.getData('text/plain') || this.draggedPanelId;
      if (!draggedId || draggedId === id) return;
      const placementRoot = item.parentElement;
      const draggedItem = placementRoot?.querySelector<HTMLElement>(`[data-runtime-debug-panel-id="${cssEscape(draggedId)}"]`);
      if (!placementRoot || !draggedItem) return;
      const rect = item.getBoundingClientRect();
      const insertAfter = event.clientX > rect.left + rect.width / 2;
      placementRoot.insertBefore(draggedItem, insertAfter ? item.nextSibling : item);
      this.savePanelOrder();
    });
  }

  private savePanelOrder(): void {
    const order = [...this.rootElement.querySelectorAll<HTMLElement>('[data-runtime-debug-panel-id]')]
      .map((panel) => panel.dataset.runtimeDebugPanelId)
      .filter((id): id is string => !!id);
    try {
      (this.ownerDocument.defaultView ?? window).localStorage.setItem(DEBUG_PANEL_ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch {
      // Ignore storage failures in sandboxed previews.
    }
  }

  private renderVisibility(): void {
    this.ownerDocument.documentElement.setAttribute(DEBUG_PANEL_VISIBLE_ATTRIBUTE, this.visible ? 'true' : 'false');
    this.bottomDock.style.display = this.visible ? 'flex' : 'none';
    this.rightRail.style.display = this.visible ? 'flex' : 'none';
    this.globalButton.textContent = this.visible ? 'Hide Debug' : 'Show Debug';
    this.globalButton.setAttribute('aria-pressed', String(this.visible));
    this.globalButton.style.opacity = this.visible ? '1' : '.78';
  }

  private renderLayoutReservation(): void {
    const hasRightRailItems = [...this.items.values()].some((item) => item.placement === 'right-rail');
    this.bottomDock.style.right = hasRightRailItems ? '376px' : '16px';
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
