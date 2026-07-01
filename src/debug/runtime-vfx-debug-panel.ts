import type { Game } from '../core/Game';
import {
  createRuntimeDebugPanelButton,
  mountRuntimeDebugPanelContainer,
  readDebugHudVisible,
} from './framework/panel-layout';
import type {
  VfxColorValue,
  VfxEffectPackage,
  VfxParamDefinition,
  VfxParamValue,
  VfxParamValues,
} from '../assets/vfx';

export interface RuntimeVfxDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export interface RuntimeVfxDebugPanel {
  dispose(): void;
}

type DraftValues = Record<string, string>;
type VfxNumberParamDefinition = Extract<VfxParamDefinition, { kind: 'number' | 'opacity' | 'lifetime' | 'scale' }>;
type VfxColorParamDefinition = Extract<VfxParamDefinition, { kind: 'color' }>;
type VfxBooleanParamDefinition = Extract<VfxParamDefinition, { kind: 'boolean' }>;
type VfxEnumParamDefinition = Extract<VfxParamDefinition, { kind: 'enum' }>;
interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownControl {
  root: HTMLElement;
  button: HTMLButtonElement;
  setOptions(options: DropdownOption[]): void;
  setValue(value: string): void;
  getValue(): string;
  close(): void;
}

const VFX_DEBUG_OPEN_STORAGE_KEY = 'pa-template.vfx-debug.open';
const VFX_DEBUG_EFFECT_STORAGE_KEY = 'pa-template.vfx-debug.effect';
const VFX_DEBUG_DRAFT_STORAGE_KEY = 'pa-template.vfx-debug.draft';
const VFX_DEBUG_PANEL_ATTRIBUTE = 'data-runtime-vfx-debug-panel';
const PREVIEW_DEBOUNCE_MS = 180;
const DEFAULT_SPAWN_PARAM_KEYS = {
  offsetX: '__generation.offsetX',
  offsetY: '__generation.offsetY',
  offsetZ: '__generation.offsetZ',
} as const;
const DEFAULT_SPAWN_PARAM_DEFINITIONS: VfxParamDefinition[] = [
  { key: DEFAULT_SPAWN_PARAM_KEYS.offsetX, label: '位置偏移 X', kind: 'number', min: -5, max: 5, step: 0.01 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.offsetY, label: '位置偏移 Y', kind: 'number', min: -5, max: 5, step: 0.01 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.offsetZ, label: '位置偏移 Z', kind: 'number', min: -5, max: 5, step: 0.01 },
];

function createRuntimeDebugDockButton(ownerDocument: Document, text: string): HTMLButtonElement {
  return createRuntimeDebugPanelButton(ownerDocument, text);
}

function applyRuntimeDebugButtonStyle(button: HTMLButtonElement, text = button.textContent ?? ''): void {
  const styled = createRuntimeDebugPanelButton(button.ownerDocument, text);
  button.style.cssText = styled.style.cssText;
}

export function mountRuntimeVfxDebugPanel(options: RuntimeVfxDebugPanelOptions): RuntimeVfxDebugPanel {
  const root = options.root ?? document.body;
  const ownerDocument = root.ownerDocument;
  const win = ownerDocument.defaultView ?? window;
  for (const existingPanel of root.querySelectorAll<HTMLElement>(`[${VFX_DEBUG_PANEL_ATTRIBUTE}]`)) {
    existingPanel.remove();
  }
  let disposed = false;
  let open = readStoredBoolean(win, VFX_DEBUG_OPEN_STORAGE_KEY, false);
  let selectedEffectId = readStoredString(win, VFX_DEBUG_EFFECT_STORAGE_KEY);
  let latestPackages: VfxEffectPackage[] = [];
  let closeOpenDropdown: (() => void) | null = null;
  let draftValues: DraftValues = {};
  let previewTimer = 0;
  let statusTimer = 0;
  let frameHandle = 0;
  let editingParamKey: string | null = null;
  let previewHandle: { dispose(): void } | null = null;

  const container = ownerDocument.createElement('div');
  container.id = 'runtime-vfx-debug-panel';
  container.setAttribute('data-input-layer', '');
  container.setAttribute(VFX_DEBUG_PANEL_ATTRIBUTE, '');
  container.setAttribute('aria-label', 'VFX 调试');
  container.style.cssText = [
    'position:relative',
    'display:none',
    'flex-direction:column-reverse',
    'align-items:flex-start',
    'gap:8px',
    'font-family:system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'color:#edf2ff',
    'pointer-events:none',
  ].join(';');

  const toggleButton = createRuntimeDebugDockButton(ownerDocument, 'VFX');
  toggleButton.title = '打开 VFX 调试面板';

  const panel = ownerDocument.createElement('section');
  panel.setAttribute('data-input-layer', '');
  panel.setAttribute('data-vfx-debug-panel-body', '');
  panel.style.cssText = [
    'pointer-events:auto',
    'width:320px',
    'max-height:min(74vh, 720px)',
    'overflow:auto',
    'box-sizing:border-box',
    'padding:12px',
    'border:1px solid rgba(148, 163, 184, 0.28)',
    'border-radius:8px',
    'background:rgba(13, 18, 28, 0.95)',
    'box-shadow:0 18px 44px rgba(0,0,0,0.34)',
    'backdrop-filter:blur(8px)',
    'display:none',
  ].join(';');

  const title = ownerDocument.createElement('div');
  title.textContent = 'VFX 调试';
  title.style.cssText = 'font-size:13px;font-weight:800;line-height:1.2;margin-bottom:10px;';

  const effectRow = ownerDocument.createElement('div');
  effectRow.style.cssText = 'display:grid;grid-template-columns:72px 1fr;align-items:center;gap:8px;font-size:12px;color:#dbeafe;margin-bottom:10px;';

  const effectLabel = ownerDocument.createElement('span');
  effectLabel.textContent = '特效';

  const effectDropdown = createDropdownControl(ownerDocument, [], '', (value) => {
    selectedEffectId = value;
    writeStoredString(win, VFX_DEBUG_EFFECT_STORAGE_KEY, selectedEffectId);
    loadDraftValues();
    renderParams();
    playPreviewNow();
  });
  effectDropdown.button.style.height = '30px';

  effectRow.append(effectLabel, effectDropdown.root);

  const paramsRoot = ownerDocument.createElement('div');
  paramsRoot.setAttribute('data-vfx-debug-params', '');
  paramsRoot.style.cssText = 'display:flex;flex-direction:column;gap:9px;margin-bottom:12px;';

  const actions = ownerDocument.createElement('div');
  actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;';

  const playButton = createActionButton(ownerDocument, '播放');
  const saveButton = createActionButton(ownerDocument, '保存');
  const resetButton = createActionButton(ownerDocument, '重置');
  saveButton.dataset.vfxDebugAction = 'save';
  actions.append(playButton, saveButton, resetButton);

  const status = ownerDocument.createElement('div');
  status.style.cssText = 'min-height:16px;font-size:11px;line-height:1.35;color:#93c5fd;';

  const savePathHint = ownerDocument.createElement('div');
  savePathHint.style.cssText = 'font-size:10px;line-height:1.35;color:rgba(203, 213, 225, 0.72);word-break:break-all;';

  panel.append(title, effectRow, paramsRoot, actions, status, savePathHint);
  container.append(toggleButton, panel);
  const unmountContainer = mountRuntimeDebugPanelContainer(root, container);

  const handleDocumentPointerDown = (): void => {
    closeOpenDropdown?.();
  };
  ownerDocument.addEventListener('pointerdown', handleDocumentPointerDown);

  toggleButton.addEventListener('click', () => {
    open = !open;
    writeStoredBoolean(win, VFX_DEBUG_OPEN_STORAGE_KEY, open);
    renderOpenState();
  });

  playButton.addEventListener('click', () => playPreviewNow());
  saveButton.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    syncDraftValuesFromCurrentControls();
  });
  saveButton.addEventListener('click', () => void saveCurrentParams());
  resetButton.addEventListener('click', () => {
    const effectPackage = getSelectedPackage();
    if (!effectPackage) return;
    draftValues = paramsToDraft(effectPackage.defaultParams, effectPackage);
    writeDraftValues();
    renderParams();
    playPreviewNow();
    setStatus('已重置为默认参数');
  });

  function tick(): void {
    if (disposed) return;
    const service = options.getGame()?.getEffectPackageService?.();
    const packages = service?.getEffectPackages?.() ?? [];
    const debugHudVisible = readDebugHudVisible(ownerDocument);
    container.style.display = service && packages.length > 0 && debugHudVisible ? 'flex' : 'none';
    if (!debugHudVisible) panel.style.display = 'none';
    if (packagesChanged(latestPackages, packages) && !isEditingParamControl()) {
      latestPackages = packages;
      syncEffectSelect();
      loadDraftValues();
      renderParams();
    }
    frameHandle = win.requestAnimationFrame(tick);
  }

  function syncEffectSelect(): void {
    const previous = selectedEffectId;
    effectDropdown.setOptions(latestPackages.map((effectPackage) => ({
      value: effectPackage.id,
      label: effectPackage.nameZh,
    })));
    selectedEffectId = latestPackages.some((item) => item.id === previous)
      ? previous
      : latestPackages[0]?.id ?? '';
    effectDropdown.setValue(selectedEffectId);
    writeStoredString(win, VFX_DEBUG_EFFECT_STORAGE_KEY, selectedEffectId);
  }

  function renderParams(): void {
    paramsRoot.innerHTML = '';
    const effectPackage = getSelectedPackage();
    updateSavePathHint(effectPackage);
    if (!effectPackage) return;

    const { spawnDefinitions, effectDefinitions } = getPanelParamDefinitions(effectPackage);
    if (spawnDefinitions.length > 0) {
      paramsRoot.append(createSectionTitle('生成参数'));
      for (const definition of spawnDefinitions) paramsRoot.append(createParamRow(definition));
    }
    paramsRoot.append(createSectionTitle('特效参数'));
    for (const definition of effectDefinitions) paramsRoot.append(createParamRow(definition));
  }

  function createParamRow(definition: VfxParamDefinition): HTMLElement {
    if (definition.kind === 'color') return createColorRow(definition);
    if (definition.kind === 'enum') return createEnumRow(definition);
    if (definition.kind === 'boolean') return createBooleanRow(definition);
    return createNumberRow(definition);
  }

  function createSectionTitle(text: string): HTMLElement {
    const title = ownerDocument.createElement('div');
    title.textContent = text;
    title.style.cssText = [
      'margin:2px 0 -2px',
      'padding-top:4px',
      'border-top:1px solid rgba(148, 163, 184, 0.16)',
      'color:#93c5fd',
      'font:800 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      'letter-spacing:0',
    ].join(';');
    return title;
  }

  function createNumberRow(definition: VfxNumberParamDefinition): HTMLElement {
    const row = ownerDocument.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:92px 1fr;align-items:center;gap:8px;font-size:12px;color:#dbeafe;';

    const label = ownerDocument.createElement('span');
    label.textContent = definition.label;
    label.title = definition.description ?? definition.label;

    const input = ownerDocument.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = draftValues[definition.key] ?? '';
    input.dataset.vfxParamKey = definition.key;
    input.style.cssText = inputStyle();
    label.addEventListener('click', () => input.focus());
    input.addEventListener('pointerdown', (event) => event.stopPropagation());
    input.addEventListener('click', (event) => {
      event.stopPropagation();
      input.focus();
    });
    input.addEventListener('focus', () => { editingParamKey = definition.key; });
    input.addEventListener('blur', () => {
      if (editingParamKey === definition.key) editingParamKey = null;
      draftValues[definition.key] = input.value;
      writeDraftValues();
      if (!isIncompleteNumberDraft(input.value) && readDraftNumber(input.value) !== null) schedulePreview();
    });
    input.addEventListener('keydown', (event) => event.stopPropagation());
    input.addEventListener('input', () => {
      draftValues[definition.key] = input.value;
      writeDraftValues();
      if (isEditingParamControl()) return;
      if (!isIncompleteNumberDraft(input.value) && readDraftNumber(input.value) !== null) schedulePreview();
    });
    row.append(label, input);
    return row;
  }

  function createColorRow(definition: VfxColorParamDefinition): HTMLElement {
    const row = ownerDocument.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:92px 1fr;align-items:center;gap:8px;font-size:12px;color:#dbeafe;';

    const label = ownerDocument.createElement('span');
    label.textContent = definition.label;

    const input = ownerDocument.createElement('input');
    input.type = 'color';
    input.value = normalizeHex(draftValues[definition.key] ?? '#ffffff');
    input.dataset.vfxParamKey = definition.key;
    input.style.cssText = [
      inputStyle(),
      'padding:2px',
      'cursor:pointer',
    ].join(';');
    label.addEventListener('click', () => input.focus());
    input.addEventListener('pointerdown', (event) => event.stopPropagation());
    input.addEventListener('click', (event) => {
      event.stopPropagation();
      input.focus();
    });
    input.addEventListener('input', () => {
      draftValues[definition.key] = input.value;
      writeDraftValues();
      schedulePreview();
    });

    row.append(label, input);
    return row;
  }

  function createBooleanRow(definition: VfxBooleanParamDefinition): HTMLElement {
    const row = ownerDocument.createElement('label');
    row.style.cssText = 'display:grid;grid-template-columns:92px 1fr;align-items:center;gap:8px;font-size:12px;color:#dbeafe;cursor:pointer;';

    const label = ownerDocument.createElement('span');
    label.textContent = definition.label;
    label.title = definition.description ?? definition.label;

    const input = ownerDocument.createElement('input');
    input.type = 'checkbox';
    input.checked = readDraftBoolean(draftValues[definition.key], false);
    input.value = input.checked ? 'true' : 'false';
    input.dataset.vfxParamKey = definition.key;
    input.style.cssText = [
      'width:18px',
      'height:18px',
      'margin:0',
      'accent-color:#60a5fa',
      'pointer-events:auto',
      'position:relative',
      'z-index:1',
      'cursor:pointer',
    ].join(';');
    input.addEventListener('pointerdown', (event) => event.stopPropagation());
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('change', () => {
      input.value = input.checked ? 'true' : 'false';
      draftValues[definition.key] = input.value;
      writeDraftValues();
      schedulePreview();
    });

    row.append(label, input);
    return row;
  }

  function createEnumRow(definition: VfxEnumParamDefinition): HTMLElement {
    const row = ownerDocument.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:92px 1fr;align-items:center;gap:8px;font-size:12px;color:#dbeafe;';

    const label = ownerDocument.createElement('span');
    label.textContent = definition.label;
    label.title = definition.description ?? definition.label;

    const hidden = ownerDocument.createElement('input');
    hidden.type = 'hidden';
    hidden.dataset.vfxParamKey = definition.key;
    const options: DropdownOption[] = [];
    if (definition.kind === 'enum') {
      for (const option of definition.options) {
        options.push({ value: option.value, label: option.label });
      }
    }
    hidden.value = draftValues[definition.key] ?? options[0]?.value ?? '';
    const dropdown = createDropdownControl(ownerDocument, options, hidden.value, (value) => {
      hidden.value = value;
      draftValues[definition.key] = value;
      writeDraftValues();
      schedulePreview();
    });
    label.addEventListener('click', () => dropdown.button.focus());
    row.append(label, dropdown.root, hidden);
    return row;
  }

  function loadDraftValues(): void {
    const effectPackage = getSelectedPackage();
    if (!effectPackage) {
      draftValues = {};
      return;
    }
    const service = options.getGame()?.getEffectPackageService?.();
    const merged = service?.getMergedParams?.(effectPackage.id) ?? effectPackage.defaultParams;
    draftValues = {
      ...paramsToDraft(merged, effectPackage),
      ...readLocalDraft(win, effectPackage.id),
    };
  }

  function flushActiveParamControl(): void {
    const activeElement = ownerDocument.activeElement;
    if (activeElement instanceof win.HTMLInputElement && paramsRoot.contains(activeElement)) {
      activeElement.blur();
    }
  }

  function syncDraftValuesFromCurrentControls(): void {
    for (const input of paramsRoot.querySelectorAll<HTMLInputElement>('input[data-vfx-param-key]')) {
      const key = input.dataset.vfxParamKey ?? '';
      if (!key) continue;
      draftValues[key] = input.type === 'checkbox' ? (input.checked ? 'true' : 'false') : input.value;
    }
    writeDraftValues();
  }

  function isEditingParamControl(): boolean {
    const activeElement = ownerDocument.activeElement;
    return editingParamKey !== null
      && activeElement instanceof win.HTMLInputElement
      && paramsRoot.contains(activeElement)
      && activeElement.type === 'text';
  }

  function readCurrentParams(): Partial<VfxParamValues> | null {
    const effectPackage = getSelectedPackage();
    if (!effectPackage) return null;
    const result: Partial<VfxParamValues> = {};
    for (const definition of getPanelParamDefinitions(effectPackage).allDefinitions) {
      const raw = draftValues[definition.key];
      if (definition.kind === 'color') {
        result[definition.key] = hexToColor(raw, readDefaultColor(effectPackage, definition.key));
        continue;
      }
      if (definition.kind === 'enum') {
        result[definition.key] = raw ?? String(readDefaultParam(effectPackage, definition.key) ?? '');
        continue;
      }
      if (definition.kind === 'boolean') {
        result[definition.key] = readDraftBoolean(raw, readDefaultBoolean(effectPackage, definition.key));
        continue;
      }
      const value = readDraftNumber(raw);
      if (value === null) {
        setStatus(`参数无效：${definition.label}`);
        return null;
      }
      result[definition.key] = clampNumber(value, readNumberProp(definition, 'min', -Infinity), readNumberProp(definition, 'max', Infinity));
    }
    return result;
  }

  function schedulePreview(): void {
    if (isEditingParamControl()) return;
    win.clearTimeout(previewTimer);
    previewTimer = win.setTimeout(playPreviewNow, PREVIEW_DEBOUNCE_MS);
  }

  function playPreviewNow(): void {
    if (isEditingParamControl()) return;
    const effectPackage = getSelectedPackage();
    const params = readCurrentParams();
    if (!effectPackage || !params) return;
    previewHandle?.dispose();
    previewHandle = options.getGame()?.playEffectPackage?.(effectPackage.id, params) ?? null;
    setStatus('已播放预览');
  }

  async function saveCurrentParams(): Promise<void> {
    const effectPackage = getSelectedPackage();
    flushActiveParamControl();
    syncDraftValuesFromCurrentControls();
    const params = readCurrentParams();
    if (!effectPackage || !params) return;
    const savePath = getEffectParamsRelativePath(effectPackage.id);
    const saveSummary = formatSavedParamsSummary(params);
    try {
      await postDebugPanelConfigJson(win, '/__vfx_debug_overrides', {
        effectId: effectPackage.id,
        params,
      });
      options.getGame()?.getEffectPackageService?.()?.setDebugOverride?.(effectPackage.id, params);
      clearLocalDraft(win, effectPackage.id);
      updateSavePathHint(effectPackage);
      win.setTimeout(() => win.location.reload(), 180);
      setStatus(`已保存：${savePath}；${saveSummary}`);
    } catch (error) {
      writeDraftValues();
      console.warn('[RuntimeVfxDebugPanel] Save failed; draft kept in localStorage', error);
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`保存失败：${message}；已保留临时缓存`);
    }
  }

  function getSelectedPackage(): VfxEffectPackage | null {
    return latestPackages.find((item) => item.id === selectedEffectId) ?? latestPackages[0] ?? null;
  }

  function writeDraftValues(): void {
    const effectPackage = getSelectedPackage();
    if (!effectPackage) return;
    writeLocalDraft(win, effectPackage.id, draftValues);
  }

  function setStatus(message: string): void {
    status.textContent = message;
    win.clearTimeout(statusTimer);
    statusTimer = win.setTimeout(() => {
      if (status.textContent === message) status.textContent = '';
    }, 1800);
  }

  function updateSavePathHint(effectPackage: VfxEffectPackage | null): void {
    savePathHint.textContent = effectPackage ? `保存到：${getEffectParamsRelativePath(effectPackage.id)}` : '';
  }

  function renderOpenState(): void {
    closeOpenDropdown?.();
    panel.style.display = open ? 'block' : 'none';
    toggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function createDropdownControl(
    doc: Document,
    initialOptions: DropdownOption[],
    initialValue: string,
    onChange: (value: string) => void,
  ): DropdownControl {
    let options = initialOptions;
    let value = initialValue;
    let open = false;

    const rootElement = doc.createElement('div');
    rootElement.style.cssText = 'position:relative;width:100%;';

    const button = doc.createElement('button');
    button.type = 'button';
    button.style.cssText = dropdownButtonStyle();

    const menu = doc.createElement('div');
    menu.style.cssText = dropdownMenuStyle();
    menu.style.display = 'none';

    rootElement.append(button, menu);

    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(!open);
    });

    renderOptions();
    updateButton();

    return {
      root: rootElement,
      button,
      setOptions(nextOptions) {
        options = nextOptions;
        if (!options.some((option) => option.value === value)) value = options[0]?.value ?? '';
        renderOptions();
        updateButton();
      },
      setValue(nextValue) {
        value = nextValue;
        renderOptions();
        updateButton();
      },
      getValue() {
        return value;
      },
      close() {
        setOpen(false);
      },
    };

    function setOpen(nextOpen: boolean): void {
      if (nextOpen) {
        closeOpenDropdown?.();
        closeOpenDropdown = () => setOpen(false);
      } else if (closeOpenDropdown) {
        closeOpenDropdown = null;
      }
      open = nextOpen;
      menu.style.display = open ? 'flex' : 'none';
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function renderOptions(): void {
      menu.innerHTML = '';
      for (const option of options) {
        const optionButton = createRuntimeDebugDockButton(doc, option.label);
        optionButton.dataset.value = option.value;
        optionButton.style.width = '100%';
        optionButton.style.minHeight = '28px';
        optionButton.style.height = 'auto';
        optionButton.style.justifyContent = 'flex-start';
        optionButton.style.textAlign = 'left';
        optionButton.style.boxShadow = option.value === value
          ? '0 0 0 2px rgba(255, 255, 255, 0.55) inset'
          : '0 8px 20px rgba(15, 23, 42, 0.18)';
        optionButton.addEventListener('pointerdown', (event) => event.stopPropagation());
        optionButton.addEventListener('click', (event) => {
          event.stopPropagation();
          value = option.value;
          updateButton();
          renderOptions();
          setOpen(false);
          onChange(value);
        });
        menu.append(optionButton);
      }
    }

    function updateButton(): void {
      const selected = options.find((option) => option.value === value);
      button.textContent = selected?.label ?? value;
      applyRuntimeDebugButtonStyle(button, button.textContent ?? value);
      button.style.width = '100%';
      button.style.textAlign = 'left';
      button.style.padding = '0 24px 0 12px';
      button.style.position = 'relative';
      button.style.zIndex = '2';
    }
  }

  renderOpenState();
  frameHandle = win.requestAnimationFrame(tick);

  return {
    dispose() {
      disposed = true;
      win.cancelAnimationFrame(frameHandle);
      win.clearTimeout(previewTimer);
      win.clearTimeout(statusTimer);
      previewHandle?.dispose();
      ownerDocument.removeEventListener('pointerdown', handleDocumentPointerDown);
      unmountContainer();
    },
  };
}

async function postDebugPanelConfigJson(win: Window, url: string, payload: unknown): Promise<void> {
  const body = JSON.stringify(payload);
  if (typeof win.fetch === 'function') {
    const response = await win.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return;
  }

  const RequestConstructor = (win as Window & typeof globalThis).XMLHttpRequest;
  if (typeof RequestConstructor !== 'function') {
    await postDebugPanelConfigForm(win, url, body);
    return;
  }

  await new Promise<void>((resolveRequest, rejectRequest) => {
    const request = new RequestConstructor();
    request.open('POST', url, true);
    request.timeout = 10000;
    request.setRequestHeader('Content-Type', 'application/json');
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolveRequest();
      } else {
        rejectRequest(new Error(`HTTP ${request.status}`));
      }
    });
    request.addEventListener('error', () => rejectRequest(new Error('Network error')));
    request.addEventListener('timeout', () => rejectRequest(new Error('Request timeout')));
    request.send(body);
  });
}

async function postDebugPanelConfigForm(win: Window, url: string, body: string): Promise<void> {
  await new Promise<void>((resolveRequest, rejectRequest) => {
    const doc = win.document;
    const frameName = `vfx-debug-save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const iframe = doc.createElement('iframe');
    iframe.name = frameName;
    iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';

    const form = doc.createElement('form');
    form.method = 'POST';
    form.action = url;
    form.target = frameName;
    form.style.display = 'none';

    const payloadInput = doc.createElement('input');
    payloadInput.type = 'hidden';
    payloadInput.name = 'payload';
    payloadInput.value = body;
    form.append(payloadInput);

    let submitted = false;
    const timeout = win.setTimeout(() => {
      cleanup();
      rejectRequest(new Error('Request timeout'));
    }, 10000);

    iframe.addEventListener('load', () => {
      if (!submitted) return;
      try {
        const responseText = iframe.contentDocument?.body?.textContent?.trim() ?? '';
        const responseBody = responseText ? JSON.parse(responseText) as { ok?: unknown; error?: unknown; message?: unknown } : {};
        if (responseBody.ok === false || responseBody.error) {
          rejectRequest(new Error(String(responseBody.message ?? responseBody.error)));
        } else {
          resolveRequest();
        }
      } catch (error) {
        rejectRequest(error instanceof Error ? error : new Error(String(error)));
      } finally {
        cleanup();
      }
    });

    function cleanup(): void {
      win.clearTimeout(timeout);
      iframe.remove();
      form.remove();
    }

    doc.body.append(iframe, form);
    submitted = true;
    form.submit();
  });
}

function getEffectParamsRelativePath(effectId: string): string {
  return `src/assets/vfx/effects/${effectId}/vfx-params.json`;
}

function formatSavedParamsSummary(params: Partial<VfxParamValues>): string {
  const keys = ['count', 'scale', 'lifetime', 'emitInterval', 'opacity'];
  const parts: string[] = [];
  for (const key of keys) {
    const value = params[key];
    if (value === undefined) continue;
    parts.push(`${key}=${formatStatusValue(value)}`);
  }
  return parts.length > 0 ? parts.join(', ') : `${Object.keys(params).length} params`;
}

function formatStatusValue(value: VfxParamValue): string {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return colorToHex(value);
}

function createActionButton(ownerDocument: Document, text: string): HTMLButtonElement {
  return createRuntimeDebugDockButton(ownerDocument, text);
}

function inputStyle(): string {
  return [
    'width:100%',
    'box-sizing:border-box',
    'height:28px',
    'border:1px solid rgba(148, 163, 184, 0.28)',
    'border-radius:6px',
    'background:rgba(15, 23, 42, 0.78)',
    'color:#f8fafc',
    'font:600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'padding:0 8px',
    'pointer-events:auto',
    'position:relative',
    'z-index:1',
    'user-select:text',
  ].join(';');
}

function dropdownButtonStyle(): string {
  return [
    'width:100%',
    'box-sizing:border-box',
    'height:28px',
    'border:1px solid rgba(148, 163, 184, 0.28)',
    'border-radius:6px',
    'background:rgba(15, 23, 42, 0.78)',
    'color:#f8fafc',
    'font:600 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'padding:0 24px 0 8px',
    'pointer-events:auto',
    'position:relative',
    'z-index:2',
    'cursor:pointer',
    'user-select:auto',
    'touch-action:manipulation',
    'text-align:left',
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis',
  ].join(';');
}

function dropdownMenuStyle(): string {
  return [
    'position:absolute',
    'left:0',
    'right:0',
    'top:calc(100% + 4px)',
    'z-index:2147483000',
    'display:flex',
    'flex-direction:column',
    'gap:2px',
    'box-sizing:border-box',
    'max-height:180px',
    'overflow:auto',
    'padding:4px',
    'border:1px solid rgba(148, 163, 184, 0.34)',
    'border-radius:6px',
    'background:rgba(15, 23, 42, 0.98)',
    'box-shadow:0 12px 28px rgba(0,0,0,0.36)',
    'pointer-events:auto',
  ].join(';');
}

function paramsToDraft(params: Partial<VfxParamValues>, effectPackage: VfxEffectPackage): DraftValues {
  const result: DraftValues = {};
  for (const definition of getPanelParamDefinitions(effectPackage).allDefinitions) {
    const value = params[definition.key] ?? effectPackage.defaultParams[definition.key];
    result[definition.key] = definition.kind === 'color'
      ? colorToHex(readColorValue(value) ?? readDefaultColor(effectPackage, definition.key))
      : definition.kind === 'enum'
        ? String(value ?? '')
        : definition.kind === 'boolean'
          ? String(readBooleanValue(value))
          : formatNumber(typeof value === 'number' ? value : 0);
  }
  return result;
}

function readDefaultParam(effectPackage: VfxEffectPackage | null, key: string): VfxParamValue | undefined {
  return effectPackage?.defaultParams[key];
}

function readDefaultColor(effectPackage: VfxEffectPackage, key: string): VfxColorValue {
  const value = effectPackage.defaultParams[key];
  return readColorValue(value) ?? { r: 1, g: 1, b: 1 };
}

function readDefaultBoolean(effectPackage: VfxEffectPackage, key: string): boolean {
  return readBooleanValue(effectPackage.defaultParams[key]);
}

function readNumberProp(definition: VfxNumberParamDefinition, key: 'min' | 'max', fallback: number): number {
  const value = definition[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readDraftNumber(value: string | undefined): number | null {
  if (value == null || isIncompleteNumberDraft(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readDraftBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') return fallback;
  return readBooleanValue(value);
}

function readBooleanValue(value: VfxParamValue | undefined): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
}

function isIncompleteNumberDraft(value: string): boolean {
  return value === '' || value === '.' || value === '-' || value === '-.' || value === '+.';
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function colorToHex(color: VfxColorValue): string {
  const channel = (value: number) => Math.round(clampNumber(value, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function hexToColor(value: string | undefined, fallback: VfxColorValue): VfxColorValue {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!match) return { ...fallback };
  const hex = match[1];
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function readColorValue(value: unknown): VfxColorValue | null {
  if (isColorValue(value)) return value;
  if (typeof value === 'string') return hexToColor(value, { r: 1, g: 1, b: 1 });
  return null;
}

function normalizeHex(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';
}

function isColorValue(value: unknown): value is VfxColorValue {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof (value as VfxColorValue).r === 'number'
    && typeof (value as VfxColorValue).g === 'number'
    && typeof (value as VfxColorValue).b === 'number';
}

function packagesChanged(left: VfxEffectPackage[], right: VfxEffectPackage[]): boolean {
  if (left.length !== right.length) return true;
  return left.some((item, index) => item.id !== right[index]?.id);
}

function getPanelParamDefinitions(effectPackage: VfxEffectPackage): {
  spawnDefinitions: VfxParamDefinition[];
  effectDefinitions: VfxParamDefinition[];
  allDefinitions: VfxParamDefinition[];
} {
  const debugDefinitionByKey = new Map(effectPackage.debugParams.map((definition) => [definition.key, definition]));
  const spawnKeys = [
    effectPackage.spawnParams?.offsetX,
    effectPackage.spawnParams?.offsetY,
    effectPackage.spawnParams?.offsetZ,
  ].filter((key): key is string => typeof key === 'string' && key.length > 0);
  const spawnDefinitions = spawnKeys.length > 0
    ? spawnKeys.map((key, index) => debugDefinitionByKey.get(key) ?? {
      ...DEFAULT_SPAWN_PARAM_DEFINITIONS[index],
      key,
    })
    : DEFAULT_SPAWN_PARAM_DEFINITIONS;
  const spawnKeySet = new Set(spawnDefinitions.map((definition) => definition.key));
  const effectDefinitions = effectPackage.debugParams.filter((definition) => !spawnKeySet.has(definition.key));
  return {
    spawnDefinitions,
    effectDefinitions,
    allDefinitions: [...spawnDefinitions, ...effectDefinitions],
  };
}

function readLocalDraft(win: Window, effectId: string): DraftValues {
  try {
    const root = JSON.parse(win.localStorage.getItem(VFX_DEBUG_DRAFT_STORAGE_KEY) || '{}') as Record<string, DraftValues>;
    return root[effectId] ?? {};
  } catch {
    return {};
  }
}

function writeLocalDraft(win: Window, effectId: string, draft: DraftValues): void {
  try {
    const root = JSON.parse(win.localStorage.getItem(VFX_DEBUG_DRAFT_STORAGE_KEY) || '{}') as Record<string, DraftValues>;
    root[effectId] = draft;
    win.localStorage.setItem(VFX_DEBUG_DRAFT_STORAGE_KEY, JSON.stringify(root));
  } catch {
    // localStorage is best-effort only.
  }
}

function clearLocalDraft(win: Window, effectId: string): void {
  try {
    const root = JSON.parse(win.localStorage.getItem(VFX_DEBUG_DRAFT_STORAGE_KEY) || '{}') as Record<string, DraftValues>;
    delete root[effectId];
    win.localStorage.setItem(VFX_DEBUG_DRAFT_STORAGE_KEY, JSON.stringify(root));
  } catch {
    // localStorage is best-effort only.
  }
}

function readStoredBoolean(win: Window, key: string, fallback: boolean): boolean {
  try {
    const value = win.localStorage.getItem(key);
    return value == null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function writeStoredBoolean(win: Window, key: string, value: boolean): void {
  try { win.localStorage.setItem(key, value ? 'true' : 'false'); } catch {}
}

function readStoredString(win: Window, key: string): string {
  try { return win.localStorage.getItem(key) ?? ''; } catch { return ''; }
}

function writeStoredString(win: Window, key: string, value: string): void {
  try { win.localStorage.setItem(key, value); } catch {}
}
