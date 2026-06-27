export function createFlightPanelButton(ownerDocument: Document, text: string): HTMLButtonElement {
  const button = ownerDocument.createElement('button');
  button.type = 'button';
  button.textContent = text;
  applyRuntimeDebugButtonStyle(button, text);
  return button;
}

const MACARON_BUTTON_COLORS = [
  { background: '#ffe3ef', border: '#ffb3d1', text: '#7a3150' },
  { background: '#e1f8e8', border: '#aee7c2', text: '#2f6f52' },
  { background: '#dcf5ff', border: '#a9e4fb', text: '#28677c' },
  { background: '#fff5c8', border: '#f7dc82', text: '#756020' },
  { background: '#eee5ff', border: '#d6c5ff', text: '#5a4285' },
  { background: '#ffe2cd', border: '#ffc49d', text: '#854a25' },
  { background: '#d9f7fb', border: '#aeeef5', text: '#2b7079' },
  { background: '#ffe0e4', border: '#f6b9c1', text: '#7c3540' },
  { background: '#e5facf', border: '#c9ee9b', text: '#4f7328' },
  { background: '#fae0ff', border: '#edb8f8', text: '#743181' },
];

export function applyRuntimeDebugButtonStyle(button: HTMLButtonElement, seed = button.textContent ?? ''): void {
  const color = MACARON_BUTTON_COLORS[hashString(seed) % MACARON_BUTTON_COLORS.length];
  button.style.cssText = [
    'pointer-events:auto',
    'height:32px',
    'min-width:64px',
    'padding:0 12px',
    `border:1px solid ${color.border}`,
    'border-radius:999px',
    `background:${color.background}`,
    `color:${color.text}`,
    'font:800 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'box-shadow:0 8px 20px rgba(15, 23, 42, 0.18)',
    'cursor:pointer',
    'white-space:nowrap',
  ].join(';');
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export type RuntimeDebugPanelDockSide = 'left' | 'right';

const RUNTIME_DEBUG_PANEL_DOCK_ATTRIBUTE = 'data-runtime-debug-panel-dock';
const RUNTIME_DEBUG_PANEL_MASTER_TOGGLE_ATTRIBUTE = 'data-runtime-debug-panel-master-toggle';
const RUNTIME_DEBUG_PANEL_MANAGER_TOGGLE_ATTRIBUTE = 'data-runtime-debug-panel-manager-toggle';
const RUNTIME_DEBUG_PANEL_MANAGER_ATTRIBUTE = 'data-runtime-debug-panel-manager';
const RUNTIME_DEBUG_PANEL_ORDER_STORAGE_KEY = 'runtime-debug-panel-order';
const RUNTIME_DEBUG_PANEL_VISIBLE_STORAGE_KEY = 'runtime-debug-panel-visible';
const RUNTIME_DEBUG_PANEL_PREFS_STORAGE_KEY = 'runtime-debug-panel-prefs';
const RUNTIME_DEBUG_PANEL_DRAG_THRESHOLD_PX = 4;
const RUNTIME_DEBUG_PANEL_CAMERA_LIGHT_RESERVED_WIDTH_PX = 704;
const RUNTIME_DEBUG_PANEL_MIN_WIDTH_PX = 304;
const RUNTIME_DEBUG_PANEL_DEFAULT_GROUP = '默认';
const RUNTIME_DEBUG_PANEL_DOCK_Z_INDEX = 2147483400;
const RUNTIME_DEBUG_PANEL_TOGGLE_Z_INDEX = RUNTIME_DEBUG_PANEL_DOCK_Z_INDEX + 1;
const RUNTIME_DEBUG_PANEL_MANAGER_Z_INDEX = RUNTIME_DEBUG_PANEL_DOCK_Z_INDEX + 2;
const RUNTIME_DEBUG_PANEL_DEFAULT_ORDER = [
  'IBL',
  'VFX',
  '打包',
  'NPC吸入',
  'NPC特效',
  'NPC Anim',
  '最终特效',
  'Spawn FX',
  'Tree Chop',
  '+100 钱币',
  '背包',
  'MAX',
  '木材效果',
  '木材Shader',
  '木材禁入区',
  '动物巡逻',
  '堆叠排列',
  '解锁鱼塘',
  '解锁养鸡区',
  '卡车UI',
  '卡车尾气',
  '卡车材质',
  '收集车吸入',
  '收集车材质',
  '司机',
  '支付数字',
  '钱材质',
  '指向箭头',
  '描边测试',
  '剪影描边',
  'Player Halo',
  'Flight',
  'Flight Outline',
  'Water',
  'Audio',
  '地贴排序',
  '地贴镜头',
  '采集镜头',
  '路面',
  'EndCam',
  '外部摆场',
  '资源',
  'GLB导出',
] as const;
const RUNTIME_DEBUG_PANEL_DEFAULT_ORDER_INDEX = new Map<string, number>(
  RUNTIME_DEBUG_PANEL_DEFAULT_ORDER.map((id, index) => [id, index]),
);

interface RuntimeDebugPanelPrefs {
  labels: Record<string, string>;
  groups: Record<string, string>;
}

export function mountRuntimeDebugPanelContainer(
  root: HTMLElement,
  container: HTMLElement,
  side: RuntimeDebugPanelDockSide = 'left',
): () => void {
  const ownerDocument = root.ownerDocument;
  const dock = getRuntimeDebugPanelDock(root);
  const toggle = getRuntimeDebugPanelMasterToggle(root, dock);
  const managerToggle = getRuntimeDebugPanelManagerToggle(root, dock);
  const dragCleanup = makeRuntimeDebugPanelDraggable(container, dock);
  container.setAttribute('data-runtime-debug-panel-slot', side);
  container.setAttribute('data-runtime-debug-panel-id', getRuntimeDebugPanelId(container));
  container.setAttribute('data-runtime-debug-panel-default-label', getRuntimeDebugPanelDefaultLabel(container));
  container.style.position = 'relative';
  container.style.left = '';
  container.style.right = '';
  container.style.bottom = '';
  container.style.zIndex = '';
  container.style.pointerEvents = 'auto';
  container.style.userSelect = '';
  applyRuntimeDebugPanelPrefs(container);
  placeRuntimeDebugPanel(dock, container);
  applyStoredRuntimeDebugPanelOrder(dock);
  syncRuntimeDebugPanelDockVisibility(dock, toggle);
  refreshRuntimeDebugPanelManager(root, dock);

  return () => {
    dragCleanup();
    container.remove();
    removeEmptyRuntimeDebugPanelGroups(dock);
    if (!dock.querySelector('[data-runtime-debug-panel-slot]')) {
      dock.remove();
      toggle.remove();
      managerToggle.remove();
      root.querySelector<HTMLElement>(`[${RUNTIME_DEBUG_PANEL_MANAGER_ATTRIBUTE}]`)?.remove();
    } else {
      refreshRuntimeDebugPanelManager(root, dock);
    }
  };

  function getRuntimeDebugPanelDock(parent: HTMLElement): HTMLElement {
    const selector = `[${RUNTIME_DEBUG_PANEL_DOCK_ATTRIBUTE}="bottom"]`;
    const existing = parent.querySelector<HTMLElement>(selector);
    if (existing) return existing;

    const nextDock = ownerDocument.createElement('div');
    nextDock.setAttribute(RUNTIME_DEBUG_PANEL_DOCK_ATTRIBUTE, 'bottom');
    nextDock.style.cssText = [
      'position:fixed',
      'left:16px',
      `right:clamp(16px, calc(100vw - ${RUNTIME_DEBUG_PANEL_MIN_WIDTH_PX + 16}px), ${RUNTIME_DEBUG_PANEL_CAMERA_LIGHT_RESERVED_WIDTH_PX}px)`,
      'bottom:16px',
      `z-index:${RUNTIME_DEBUG_PANEL_DOCK_Z_INDEX}`,
      'display:flex',
      'flex-direction:column',
      'justify-content:flex-end',
      'align-items:flex-start',
      'gap:6px',
      'max-height:calc(100vh - 32px)',
      'pointer-events:none',
    ].join(';');
    parent.append(nextDock);
    return nextDock;
  }
}

function getRuntimeDebugPanelMasterToggle(root: HTMLElement, dock: HTMLElement): HTMLButtonElement {
  const ownerDocument = root.ownerDocument;
  const selector = `[${RUNTIME_DEBUG_PANEL_MASTER_TOGGLE_ATTRIBUTE}]`;
  const existing = root.querySelector<HTMLButtonElement>(selector);
  if (existing) return existing;

  const toggle = ownerDocument.createElement('button');
  toggle.type = 'button';
  toggle.setAttribute(RUNTIME_DEBUG_PANEL_MASTER_TOGGLE_ATTRIBUTE, '');
  toggle.setAttribute('data-input-layer', '');
  toggle.style.cssText = [
    'position:fixed',
    // 与 SDK「进入编辑场景」工具条并列(同一行、在其左侧；右侧被金币 HUD 占用放不下)。
    // 工具条居中(left ~50%)，这两个按钮在它左边依次排开。
    'top:14px',
    'left:calc(50% - 352px)',
    `z-index:${RUNTIME_DEBUG_PANEL_TOGGLE_Z_INDEX}`,
    'pointer-events:auto',
    'height:30px',
    'padding:0 14px',
    'border:1px solid rgba(148, 163, 184, 0.55)',
    'border-radius:999px',
    'background:rgba(15, 23, 42, 0.78)',
    'color:#f8fafc',
    'font:800 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'box-shadow:0 10px 28px rgba(15, 23, 42, 0.28)',
    'cursor:pointer',
    'white-space:nowrap',
    'backdrop-filter:blur(8px)',
  ].join(';');
  toggle.addEventListener('click', () => {
    const win = ownerDocument.defaultView;
    const visible = dock.style.display === 'none';
    if (win) writeStoredBoolean(win, RUNTIME_DEBUG_PANEL_VISIBLE_STORAGE_KEY, visible);
    syncRuntimeDebugPanelDockVisibility(dock, toggle, visible);
  });
  root.append(toggle);
  return toggle;
}

function getRuntimeDebugPanelManagerToggle(root: HTMLElement, dock: HTMLElement): HTMLButtonElement {
  const ownerDocument = root.ownerDocument;
  const selector = `[${RUNTIME_DEBUG_PANEL_MANAGER_TOGGLE_ATTRIBUTE}]`;
  const existing = root.querySelector<HTMLButtonElement>(selector);
  if (existing) return existing;

  const toggle = ownerDocument.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Debug 管理';
  toggle.setAttribute(RUNTIME_DEBUG_PANEL_MANAGER_TOGGLE_ATTRIBUTE, '');
  toggle.setAttribute('data-input-layer', '');
  toggle.style.cssText = [
    'position:fixed',
    // 与「显示/隐藏 Debug 面板」并列, 共同排在 SDK 编辑工具条左侧同一行。
    'top:14px',
    'left:calc(50% - 222px)',
    `z-index:${RUNTIME_DEBUG_PANEL_TOGGLE_Z_INDEX}`,
    'pointer-events:auto',
    'height:30px',
    'padding:0 14px',
    'border:1px solid rgba(251, 191, 36, 0.55)',
    'border-radius:999px',
    'background:rgba(41, 25, 8, 0.82)',
    'color:#fef3c7',
    'font:800 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'box-shadow:0 10px 28px rgba(15, 23, 42, 0.28)',
    'cursor:pointer',
    'white-space:nowrap',
    'backdrop-filter:blur(8px)',
  ].join(';');
  toggle.addEventListener('click', () => {
    const manager = getRuntimeDebugPanelManager(root, dock);
    manager.style.display = manager.style.display === 'none' ? 'block' : 'none';
    refreshRuntimeDebugPanelManager(root, dock);
  });
  root.append(toggle);
  return toggle;
}

function syncRuntimeDebugPanelDockVisibility(dock: HTMLElement, toggle: HTMLButtonElement, visible?: boolean): void {
  const win = dock.ownerDocument.defaultView;
  const nextVisible = visible ?? (win ? readStoredBoolean(win, RUNTIME_DEBUG_PANEL_VISIBLE_STORAGE_KEY, true) : true);
  dock.style.display = nextVisible ? 'flex' : 'none';
  toggle.textContent = nextVisible ? '隐藏 Debug 面板' : '显示 Debug 面板';
  toggle.setAttribute('aria-pressed', String(!nextVisible));
  if (!nextVisible) {
    dock.ownerDocument.querySelector<HTMLElement>(`[${RUNTIME_DEBUG_PANEL_MANAGER_ATTRIBUTE}]`)?.style.setProperty('display', 'none');
  }
}

function makeRuntimeDebugPanelDraggable(container: HTMLElement, dock: HTMLElement): () => void {
  const ownerDocument = container.ownerDocument;
  let pointerId: number | null = null;
  let startClientX = 0;
  let latestClientX = 0;
  let dragging = false;
  let suppressNextClick = false;

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || pointerId !== null) return;
    if (isTextSelectionOrFormControl(event.target)) return;

    pointerId = event.pointerId;
    startClientX = event.clientX;
    latestClientX = event.clientX;
    dragging = false;
    ownerDocument.addEventListener('pointermove', onPointerMove);
    ownerDocument.addEventListener('pointerup', onPointerUp);
    ownerDocument.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    latestClientX = event.clientX;
    const deltaX = latestClientX - startClientX;
    if (!dragging && Math.abs(deltaX) < RUNTIME_DEBUG_PANEL_DRAG_THRESHOLD_PX) return;

    dragging = true;
    event.preventDefault();
    container.style.transition = 'none';
    container.style.zIndex = '1';
    container.style.transform = `translateX(${deltaX}px)`;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    ownerDocument.removeEventListener('pointermove', onPointerMove);
    ownerDocument.removeEventListener('pointerup', onPointerUp);
    ownerDocument.removeEventListener('pointercancel', onPointerUp);

    if (dragging) {
      suppressNextClick = true;
      reorderRuntimeDebugPanels(dock, container, latestClientX - startClientX);
      writeRuntimeDebugPanelOrder(dock);
    }

    pointerId = null;
    dragging = false;
    container.style.transform = '';
    container.style.transition = '';
    container.style.zIndex = '';
  };

  const onClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('click', onClickCapture, true);

  return () => {
    container.removeEventListener('pointerdown', onPointerDown);
    ownerDocument.removeEventListener('pointermove', onPointerMove);
    ownerDocument.removeEventListener('pointerup', onPointerUp);
    ownerDocument.removeEventListener('pointercancel', onPointerUp);
    container.removeEventListener('click', onClickCapture, true);
  };
}

function reorderRuntimeDebugPanels(dock: HTMLElement, dragged: HTMLElement, deltaX: number): void {
  const group = dragged.closest<HTMLElement>('[data-runtime-debug-panel-group-items]');
  const items = [...(group ?? dock).querySelectorAll<HTMLElement>('[data-runtime-debug-panel-slot]')];
  const ordered = items
    .map((item, index) => {
      const rect = item.getBoundingClientRect();
      return {
        item,
        index,
        centerX: rect.left + rect.width / 2 + (item === dragged ? deltaX : 0),
      };
    })
    .sort((a, b) => a.centerX - b.centerX || a.index - b.index);

  for (const entry of ordered) {
    (group ?? dock).append(entry.item);
  }
}

function applyStoredRuntimeDebugPanelOrder(dock: HTMLElement): void {
  const win = dock.ownerDocument.defaultView;
  if (!win) return;
  const stored = readStoredString(win, RUNTIME_DEBUG_PANEL_ORDER_STORAGE_KEY);

  let order: string[] = [];
  try {
    const parsed = stored ? JSON.parse(stored) as unknown : [];
    order = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    order = [];
  }

  const items = [...dock.querySelectorAll<HTMLElement>('[data-runtime-debug-panel-slot]')];
  items.sort((a, b) => {
    const aGroup = getRuntimeDebugPanelGroup(a);
    const bGroup = getRuntimeDebugPanelGroup(b);
    if (aGroup !== bGroup) return aGroup.localeCompare(bGroup, 'zh-Hans-CN');
    return compareRuntimeDebugPanelOrder(a, b, order);
  });
  for (const item of items) {
    placeRuntimeDebugPanel(dock, item);
  }
  orderRuntimeDebugPanelGroups(dock);
}

function compareRuntimeDebugPanelOrder(a: HTMLElement, b: HTMLElement, storedOrder: readonly string[]): number {
  const aId = getRuntimeDebugPanelId(a);
  const bId = getRuntimeDebugPanelId(b);
  const aStoredIndex = normalizeStoredOrderIndex(storedOrder.indexOf(aId));
  const bStoredIndex = normalizeStoredOrderIndex(storedOrder.indexOf(bId));
  if (aStoredIndex !== bStoredIndex) return aStoredIndex - bStoredIndex;

  const aDefaultIndex = normalizeDefaultOrderIndex(RUNTIME_DEBUG_PANEL_DEFAULT_ORDER_INDEX.get(aId));
  const bDefaultIndex = normalizeDefaultOrderIndex(RUNTIME_DEBUG_PANEL_DEFAULT_ORDER_INDEX.get(bId));
  if (aDefaultIndex !== bDefaultIndex) return aDefaultIndex - bDefaultIndex;

  return aId.localeCompare(bId, 'zh-Hans-CN');
}

function writeRuntimeDebugPanelOrder(dock: HTMLElement): void {
  const win = dock.ownerDocument.defaultView;
  if (!win) return;
  const order = [...dock.querySelectorAll<HTMLElement>('[data-runtime-debug-panel-slot]')].map(getRuntimeDebugPanelId);
  writeStoredString(win, RUNTIME_DEBUG_PANEL_ORDER_STORAGE_KEY, JSON.stringify(order));
}

function getRuntimeDebugPanelId(container: HTMLElement): string {
  const existing = container.getAttribute('data-runtime-debug-panel-id');
  if (existing) return existing;
  const label = getRuntimeDebugPanelToggleButton(container)?.textContent?.trim();
  return label || `panel-${container.ownerDocument.querySelectorAll('[data-runtime-debug-panel-slot]').length}`;
}

function getRuntimeDebugPanelDefaultLabel(container: HTMLElement): string {
  const existing = container.getAttribute('data-runtime-debug-panel-default-label');
  if (existing) return existing;
  return getRuntimeDebugPanelToggleButton(container)?.textContent?.trim() || getRuntimeDebugPanelId(container);
}

function getRuntimeDebugPanelToggleButton(container: HTMLElement): HTMLButtonElement | null {
  for (const child of Array.from(container.children)) {
    if (child instanceof HTMLButtonElement) return child;
  }
  return container.querySelector<HTMLButtonElement>('button');
}

function getRuntimeDebugPanelGroup(container: HTMLElement): string {
  return container.getAttribute('data-runtime-debug-panel-group') || RUNTIME_DEBUG_PANEL_DEFAULT_GROUP;
}

function applyRuntimeDebugPanelPrefs(container: HTMLElement): void {
  const win = container.ownerDocument.defaultView;
  const id = getRuntimeDebugPanelId(container);
  const prefs = win ? readRuntimeDebugPanelPrefs(win) : createEmptyRuntimeDebugPanelPrefs();
  const label = sanitizeDebugPanelText(prefs.labels[id]) || getRuntimeDebugPanelDefaultLabel(container);
  const group = sanitizeDebugPanelText(prefs.groups[id]) || RUNTIME_DEBUG_PANEL_DEFAULT_GROUP;
  const toggle = getRuntimeDebugPanelToggleButton(container);
  if (toggle) {
    toggle.textContent = label;
    applyRuntimeDebugButtonStyle(toggle, label);
  }
  container.setAttribute('data-runtime-debug-panel-group', group);
}

function placeRuntimeDebugPanel(dock: HTMLElement, container: HTMLElement): void {
  const groupName = getRuntimeDebugPanelGroup(container);
  const group = getOrCreateRuntimeDebugPanelGroup(dock, groupName);
  const items = group.querySelector<HTMLElement>('[data-runtime-debug-panel-group-items]') ?? group;
  items.append(container);
  removeEmptyRuntimeDebugPanelGroups(dock);
}

function getOrCreateRuntimeDebugPanelGroup(dock: HTMLElement, groupName: string): HTMLElement {
  const escapedGroup = cssEscape(groupName);
  const existing = dock.querySelector<HTMLElement>(`[data-runtime-debug-panel-group="${escapedGroup}"]`);
  if (existing && !existing.hasAttribute('data-runtime-debug-panel-slot')) return existing;

  const ownerDocument = dock.ownerDocument;
  const group = ownerDocument.createElement('div');
  group.setAttribute('data-runtime-debug-panel-group', groupName);
  group.style.cssText = [
    'display:flex',
    'flex-direction:column',
    'align-items:flex-start',
    'gap:4px',
    'pointer-events:none',
  ].join(';');

  const title = ownerDocument.createElement('div');
  title.setAttribute('data-runtime-debug-panel-group-title', '');
  title.textContent = groupName;
  title.style.cssText = [
    'pointer-events:none',
    'padding:2px 8px',
    'border-radius:999px',
    'background:rgba(15, 23, 42, 0.62)',
    'color:#cbd5e1',
    'font:800 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'letter-spacing:0.04em',
  ].join(';');

  const items = ownerDocument.createElement('div');
  items.setAttribute('data-runtime-debug-panel-group-items', '');
  items.style.cssText = [
    'display:flex',
    'flex-wrap:wrap',
    'align-items:flex-end',
    'gap:8px',
    'pointer-events:none',
  ].join(';');
  group.append(title, items);
  dock.append(group);
  orderRuntimeDebugPanelGroups(dock);
  return group;
}

function orderRuntimeDebugPanelGroups(dock: HTMLElement): void {
  const groups = [...dock.querySelectorAll<HTMLElement>(':scope > [data-runtime-debug-panel-group]')]
    .filter((group) => !group.hasAttribute('data-runtime-debug-panel-slot'));
  groups
    .sort((a, b) => {
      const aName = a.getAttribute('data-runtime-debug-panel-group') || '';
      const bName = b.getAttribute('data-runtime-debug-panel-group') || '';
      if (aName === RUNTIME_DEBUG_PANEL_DEFAULT_GROUP) return -1;
      if (bName === RUNTIME_DEBUG_PANEL_DEFAULT_GROUP) return 1;
      return aName.localeCompare(bName, 'zh-Hans-CN');
    })
    .forEach((group) => dock.append(group));
}

function removeEmptyRuntimeDebugPanelGroups(dock: HTMLElement): void {
  for (const group of dock.querySelectorAll<HTMLElement>(':scope > [data-runtime-debug-panel-group]')) {
    if (!group.hasAttribute('data-runtime-debug-panel-slot') && !group.querySelector('[data-runtime-debug-panel-slot]')) {
      group.remove();
    }
  }
}

function getRuntimeDebugPanelManager(root: HTMLElement, dock: HTMLElement): HTMLElement {
  const ownerDocument = root.ownerDocument;
  const existing = root.querySelector<HTMLElement>(`[${RUNTIME_DEBUG_PANEL_MANAGER_ATTRIBUTE}]`);
  if (existing) return existing;

  const manager = ownerDocument.createElement('section');
  manager.setAttribute(RUNTIME_DEBUG_PANEL_MANAGER_ATTRIBUTE, '');
  manager.setAttribute('data-input-layer', '');
  manager.style.cssText = [
    'position:fixed',
    'top:50px',
    'left:50%',
    'transform:translateX(-50%)',
    `z-index:${RUNTIME_DEBUG_PANEL_MANAGER_Z_INDEX}`,
    'display:none',
    'width:min(720px, calc(100vw - 32px))',
    'max-height:min(72vh, 720px)',
    'overflow:auto',
    'box-sizing:border-box',
    'padding:12px',
    'border:1px solid rgba(251, 191, 36, 0.45)',
    'border-radius:10px',
    'background:rgba(15, 23, 42, 0.94)',
    'box-shadow:0 18px 44px rgba(0,0,0,0.36)',
    'backdrop-filter:blur(10px)',
    'color:#f8fafc',
    'font:12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'pointer-events:auto',
  ].join(';');
  root.append(manager);
  refreshRuntimeDebugPanelManager(root, dock);
  return manager;
}

function refreshRuntimeDebugPanelManager(root: HTMLElement, dock: HTMLElement): void {
  const manager = root.querySelector<HTMLElement>(`[${RUNTIME_DEBUG_PANEL_MANAGER_ATTRIBUTE}]`);
  if (!manager || manager.style.display === 'none') return;
  const ownerDocument = root.ownerDocument;
  const win = ownerDocument.defaultView;
  const prefs = win ? readRuntimeDebugPanelPrefs(win) : createEmptyRuntimeDebugPanelPrefs();
  const panels = [...dock.querySelectorAll<HTMLElement>('[data-runtime-debug-panel-slot]')];
  const groups = Array.from(new Set([
    RUNTIME_DEBUG_PANEL_DEFAULT_GROUP,
    ...Object.values(prefs.groups).map((value) => sanitizeDebugPanelText(value)).filter(Boolean),
    ...panels.map(getRuntimeDebugPanelGroup),
  ])).sort((a, b) => {
    if (a === RUNTIME_DEBUG_PANEL_DEFAULT_GROUP) return -1;
    if (b === RUNTIME_DEBUG_PANEL_DEFAULT_GROUP) return 1;
    return a.localeCompare(b, 'zh-Hans-CN');
  });

  const title = ownerDocument.createElement('div');
  title.textContent = 'Debug 面板管理';
  title.style.cssText = 'font-size:14px;font-weight:900;margin-bottom:6px;';
  const hint = ownerDocument.createElement('div');
  hint.textContent = '可修改每个面板按钮名和分组；这些只保存为本机 debug UI 偏好，不写入玩法配置。拖拽按钮仍可调整同组内顺序。';
  hint.style.cssText = 'font-size:11px;line-height:1.35;color:#cbd5e1;margin-bottom:10px;';

  const grid = ownerDocument.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:minmax(120px,1fr) minmax(140px,1fr) minmax(120px,0.8fr);gap:6px;align-items:center;';
  grid.append(createManagerHeader(ownerDocument, '原名'), createManagerHeader(ownerDocument, '显示名'), createManagerHeader(ownerDocument, '分组'));
  for (const panel of panels) {
    const id = getRuntimeDebugPanelId(panel);
    const defaultLabel = getRuntimeDebugPanelDefaultLabel(panel);
    const nameInput = createManagerInput(ownerDocument, prefs.labels[id] ?? defaultLabel);
    const groupInput = createManagerInput(ownerDocument, prefs.groups[id] ?? getRuntimeDebugPanelGroup(panel));
    groupInput.setAttribute('list', 'runtime-debug-panel-groups');
    const label = ownerDocument.createElement('div');
    label.textContent = defaultLabel;
    label.style.cssText = 'color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nameInput.addEventListener('input', () => {
      updateRuntimeDebugPanelPref(win, id, 'labels', nameInput.value);
      applyRuntimeDebugPanelPrefs(panel);
    });
    groupInput.addEventListener('input', () => {
      updateRuntimeDebugPanelPref(win, id, 'groups', groupInput.value);
      applyRuntimeDebugPanelPrefs(panel);
      placeRuntimeDebugPanel(dock, panel);
      applyStoredRuntimeDebugPanelOrder(dock);
    });
    grid.append(label, nameInput, groupInput);
  }

  const datalist = ownerDocument.createElement('datalist');
  datalist.id = 'runtime-debug-panel-groups';
  for (const group of groups) {
    const option = ownerDocument.createElement('option');
    option.value = group;
    datalist.append(option);
  }

  const resetButton = ownerDocument.createElement('button');
  resetButton.type = 'button';
  resetButton.textContent = '重置所有命名/分组';
  resetButton.style.cssText = 'margin-top:10px;height:30px;padding:0 12px;border:1px solid rgba(248,113,113,0.55);border-radius:8px;background:rgba(127,29,29,0.72);color:#fee2e2;font-weight:800;cursor:pointer;';
  resetButton.addEventListener('click', () => {
    if (!win) return;
    writeStoredString(win, RUNTIME_DEBUG_PANEL_PREFS_STORAGE_KEY, JSON.stringify(createEmptyRuntimeDebugPanelPrefs()));
    for (const panel of panels) {
      applyRuntimeDebugPanelPrefs(panel);
      placeRuntimeDebugPanel(dock, panel);
    }
    applyStoredRuntimeDebugPanelOrder(dock);
    refreshRuntimeDebugPanelManager(root, dock);
  });

  manager.replaceChildren(title, hint, grid, datalist, resetButton);
}

function createManagerHeader(ownerDocument: Document, text: string): HTMLElement {
  const element = ownerDocument.createElement('div');
  element.textContent = text;
  element.style.cssText = 'font-size:11px;font-weight:900;color:#fef3c7;';
  return element;
}

function createManagerInput(ownerDocument: Document, value: string): HTMLInputElement {
  const input = ownerDocument.createElement('input');
  input.type = 'text';
  input.value = value;
  input.style.cssText = 'height:28px;box-sizing:border-box;border:1px solid rgba(148,163,184,0.34);border-radius:6px;background:rgba(15,23,42,0.72);color:#f8fafc;padding:0 8px;font:700 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;';
  return input;
}

function updateRuntimeDebugPanelPref(
  win: Window | null | undefined,
  id: string,
  bucket: keyof RuntimeDebugPanelPrefs,
  value: string,
): void {
  if (!win) return;
  const prefs = readRuntimeDebugPanelPrefs(win);
  const text = sanitizeDebugPanelText(value);
  if (text) prefs[bucket][id] = text;
  else delete prefs[bucket][id];
  writeStoredString(win, RUNTIME_DEBUG_PANEL_PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

function readRuntimeDebugPanelPrefs(win: Window): RuntimeDebugPanelPrefs {
  const empty = createEmptyRuntimeDebugPanelPrefs();
  const stored = readStoredString(win, RUNTIME_DEBUG_PANEL_PREFS_STORAGE_KEY);
  if (!stored) return empty;
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return empty;
    const record = parsed as Record<string, unknown>;
    return {
      labels: readStringRecord(record.labels),
      groups: readStringRecord(record.groups),
    };
  } catch {
    return empty;
  }
}

function createEmptyRuntimeDebugPanelPrefs(): RuntimeDebugPanelPrefs {
  return { labels: {}, groups: {} };
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, sanitizeDebugPanelText(entry)] as const)
      .filter((entry): entry is readonly [string, string] => !!entry[1]),
  );
}

function sanitizeDebugPanelText(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 32) : '';
}

function cssEscape(value: string): string {
  const css = (globalThis as { CSS?: { escape?: (input: string) => string } }).CSS;
  return css?.escape ? css.escape(value) : value.replace(/"/g, '\\"');
}

function normalizeStoredOrderIndex(index: number): number {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function normalizeDefaultOrderIndex(index: number | undefined): number {
  return index ?? Number.MAX_SAFE_INTEGER;
}

function isTextSelectionOrFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest('input,textarea,select,option,label,[contenteditable="true"]');
}

export function flightPanelNumberInputStyle(): string {
  return [
    'width:100%',
    'box-sizing:border-box',
    'height:28px',
    'border:1px solid rgba(148, 163, 184, 0.28)',
    'border-radius:6px',
    'background:rgba(15, 23, 42, 0.78)',
    'color:#f8fafc',
    'font:600 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    'padding:0 6px',
  ].join(';');
}

export function readDebugHudVisible(ownerDocument: Document): boolean {
  const candidates = [...ownerDocument.querySelectorAll<HTMLElement>('button,[role="button"]')]
    .filter((element) => {
      const text = (element.textContent ?? '').trim();
      return text === 'Task' || text === 'Debug' || text === '任务' || text === '调试';
    });
  if (candidates.length === 0) return true;
  return candidates.some((element) => {
    const style = ownerDocument.defaultView?.getComputedStyle(element);
    return !!style && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
  });
}

export function readStoredBoolean(win: Window, key: string, fallback: boolean): boolean {
  try {
    const value = win.localStorage.getItem(key);
    if (value === 'true') return true;
    if (value === 'false') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function readStoredString(win: Window, key: string): string | null {
  try {
    return win.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredBoolean(win: Window, key: string, value: boolean): void {
  try {
    win.localStorage.setItem(key, String(value));
  } catch {
    // Embedded previews can disable localStorage.
  }
}

export function writeStoredString(win: Window, key: string, value: string): void {
  try {
    win.localStorage.setItem(key, value);
  } catch {
    // Embedded previews can disable localStorage.
  }
}

export function readNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
