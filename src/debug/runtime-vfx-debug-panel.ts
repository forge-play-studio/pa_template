import { AxesViewer } from '@babylonjs/core/Debug/axesViewer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Game } from '../core/Game';
import {
  applyRuntimeDebugButtonStyle,
  createRuntimeDebugDockButton,
  mountRuntimeDebugPanelContainer,
} from './framework/runtime-debug-dock';
import type {
  VfxColorValue,
  VfxEffectPackage,
  VfxParamDefinition,
  VfxParamValue,
  VfxParamValues,
  VfxSpawnTransform,
} from '../assets/vfx';
import type { ProjectVfxDirector, ProjectVfxOffsetConfig, ProjectVfxUsageTarget, ProjectVfxVector3Config } from '../systems';

export interface RuntimeVfxDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export interface RuntimeVfxDebugPanel {
  dispose(): void;
}

type DraftValues = Record<string, string>;
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

type VfxDebugTarget =
  | { kind: 'effect'; key: string; effectId: string; label: string }
  | { kind: 'usage'; key: string; effectId: string; usageId: string; label: string; usage: ProjectVfxUsageTarget };

const VFX_DEBUG_PANEL_ATTRIBUTE = 'data-runtime-vfx-debug-panel';
const LEGACY_VFX_DEBUG_STORAGE_KEYS = [
  'pa-template.vfx-debug.open',
  'pa-template.vfx-debug.effect',
  'pa-template.vfx-debug.target',
  'pa-template.vfx-debug.draft',
  'pa-template.vfx-debug.draft.v2',
];
const PREVIEW_DEBOUNCE_MS = 180;
const AXIS_LABEL_DISTANCE = 1.85;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_SPAWN_PARAM_KEYS = {
  offsetX: '__generation.offsetX',
  offsetY: '__generation.offsetY',
  offsetZ: '__generation.offsetZ',
  rotationX: '__generation.rotationX',
  rotationY: '__generation.rotationY',
  rotationZ: '__generation.rotationZ',
  scaleX: '__generation.scaleX',
  scaleY: '__generation.scaleY',
  scaleZ: '__generation.scaleZ',
} as const;
const DEFAULT_OFFSET_PARAM_DEFINITIONS: VfxParamDefinition[] = [
  { key: DEFAULT_SPAWN_PARAM_KEYS.offsetX, label: '位置 X', kind: 'number', min: -5, max: 5, step: 0.01 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.offsetY, label: '位置 Y', kind: 'number', min: -5, max: 5, step: 0.01 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.offsetZ, label: '位置 Z', kind: 'number', min: -5, max: 5, step: 0.01 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.rotationX, label: '旋转 X (°)', kind: 'number', min: -360, max: 360, step: 1 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.rotationY, label: '旋转 Y (°)', kind: 'number', min: -360, max: 360, step: 1 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.rotationZ, label: '旋转 Z (°)', kind: 'number', min: -360, max: 360, step: 1 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.scaleX, label: '缩放 X', kind: 'number', min: 0.01, max: 10, step: 0.01 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.scaleY, label: '缩放 Y', kind: 'number', min: 0.01, max: 10, step: 0.01 },
  { key: DEFAULT_SPAWN_PARAM_KEYS.scaleZ, label: '缩放 Z', kind: 'number', min: 0.01, max: 10, step: 0.01 },
];
const DEBUG_AXIS_PARAM_KEY = '__debug.showAxis';
const DEBUG_AXIS_PARAM_DEFINITION: VfxParamDefinition = {
  key: DEBUG_AXIS_PARAM_KEY,
  label: '坐标轴 XYZ',
  kind: 'enum',
  options: [
    { value: 'on', label: '显示' },
    { value: 'off', label: '隐藏' },
  ],
};

export function mountRuntimeVfxDebugPanel(options: RuntimeVfxDebugPanelOptions): RuntimeVfxDebugPanel {
  const root = options.root ?? document.body;
  const ownerDocument = root.ownerDocument;
  const win = ownerDocument.defaultView ?? window;
  clearLegacyVfxDebugStorage(win);
  for (const existingPanel of root.querySelectorAll<HTMLElement>(`[${VFX_DEBUG_PANEL_ATTRIBUTE}]`)) {
    existingPanel.remove();
  }
  let disposed = false;
  let open = false;
  let selectedEffectId = '';
  let selectedTargetKey = '';
  let latestPackages: VfxEffectPackage[] = [];
  let latestUsageTargets: ProjectVfxUsageTarget[] = [];
  let closeOpenDropdown: (() => void) | null = null;
  let draftValues: DraftValues = {};
  let previewTimer = 0;
  let statusTimer = 0;
  let frameHandle = 0;
  let editingParamKey: string | null = null;
  let previewHandle: { dispose(): void } | null = null;
  const axisOverlay = new EffectAxisOverlay();

  const container = ownerDocument.createElement('div');
  container.setAttribute('data-input-layer', '');
  container.setAttribute(VFX_DEBUG_PANEL_ATTRIBUTE, '');
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
    syncTargetSelect();
    refreshDraftFromSelectedTarget();
    renderParams();
    playPreviewNow();
  });
  effectDropdown.button.style.height = '30px';

  effectRow.append(effectLabel, effectDropdown.root);

  const targetRow = ownerDocument.createElement('div');
  targetRow.style.cssText = 'display:grid;grid-template-columns:72px 1fr;align-items:center;gap:8px;font-size:12px;color:#dbeafe;margin-bottom:10px;';

  const targetLabel = ownerDocument.createElement('span');
  targetLabel.textContent = '目标';

  const targetDropdown = createDropdownControl(ownerDocument, [], '', (value) => {
    selectedTargetKey = value;
    refreshDraftFromSelectedTarget();
    renderParams();
    playPreviewNow();
  });
  targetDropdown.button.style.height = '30px';

  targetRow.append(targetLabel, targetDropdown.root);

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

  panel.append(title, effectRow, targetRow, paramsRoot, actions, status, savePathHint);
  container.append(toggleButton, panel);
  const unmountContainer = mountRuntimeDebugPanelContainer(root, container);

  const handleDocumentPointerDown = (): void => {
    closeOpenDropdown?.();
  };
  ownerDocument.addEventListener('pointerdown', handleDocumentPointerDown);

  toggleButton.addEventListener('click', () => {
    open = !open;
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
    const target = getSelectedTarget();
    const params = target?.kind === 'usage'
      ? getProjectDefaultParams(effectPackage)
      : effectPackage.defaultParams;
    const offset = target?.kind === 'usage'
      ? target.usage.offset
      : readDefaultTargetOffset(params, effectPackage);
    draftValues = {
      ...paramsToDraft(params, effectPackage),
      ...offsetToDraft(offset, effectPackage),
      [DEBUG_AXIS_PARAM_KEY]: 'on',
    };
    renderParams();
    playPreviewNow();
    setStatus(target?.kind === 'usage' ? '已重置为模板参数' : '已重置为库默认参数');
  });

  function tick(): void {
    if (disposed) return;
    const service = options.getGame()?.getEffectPackageService?.();
    const packages = service?.getEffectPackages?.() ?? [];
    const usageTargets = getVfxDirector()?.getVfxUsageTargets?.() ?? [];
    const debugHudVisible = readDebugHudVisible(ownerDocument);
    container.style.display = service && packages.length > 0 && debugHudVisible ? 'flex' : 'none';
    if (!debugHudVisible) panel.style.display = 'none';
    if ((packagesChanged(latestPackages, packages) || usageTargetsChanged(latestUsageTargets, usageTargets)) && !isEditingParamControl()) {
      latestPackages = packages;
      latestUsageTargets = usageTargets;
      syncEffectSelect();
      syncTargetSelect();
      refreshDraftFromSelectedTarget();
      renderParams();
    }
    updateAxisOverlay(debugHudVisible && open);
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
  }

  function syncTargetSelect(): void {
    const options = getTargetOptions();
    targetDropdown.setOptions(options);
    selectedTargetKey = options.some((option) => option.value === selectedTargetKey)
      ? selectedTargetKey
      : options[0]?.value ?? '';
    targetDropdown.setValue(selectedTargetKey);
  }

  function getTargetOptions(): DropdownOption[] {
    if (!selectedEffectId) return [];
    const options: DropdownOption[] = [{
      value: buildEffectTargetKey(selectedEffectId),
      label: '模板',
    }];
    for (const usage of latestUsageTargets) {
      if (usage.effectId !== selectedEffectId) continue;
      options.push({
        value: buildUsageTargetKey(usage.id),
        label: `实例：${usage.label}`,
      });
    }
    return options;
  }

  function renderParams(): void {
    paramsRoot.innerHTML = '';
    const effectPackage = getSelectedPackage();
    updateSavePathHint(effectPackage);
    if (!effectPackage) return;

    const { offsetDefinitions, effectDefinitions } = getPanelParamDefinitions(effectPackage);
    if (offsetDefinitions.length > 0) {
      paramsRoot.append(createSectionTitle('挂载 Offset'));
      for (const definition of offsetDefinitions) paramsRoot.append(createParamRow(definition));
      paramsRoot.append(createParamRow(DEBUG_AXIS_PARAM_DEFINITION));
    }
    paramsRoot.append(createSectionTitle('特效参数'));
    for (const definition of effectDefinitions) paramsRoot.append(createParamRow(definition));
  }

  function createParamRow(definition: VfxParamDefinition): HTMLElement {
    if (definition.key === DEBUG_AXIS_PARAM_KEY) return createCheckboxRow(definition);
    if (definition.kind === 'color') return createColorRow(definition);
    if (definition.kind === 'enum') return createEnumRow(definition);
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

  function createNumberRow(definition: VfxParamDefinition): HTMLElement {
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
      scheduleNumberPreview(input.value);
    });
    input.addEventListener('keydown', (event) => event.stopPropagation());
    input.addEventListener('input', () => {
      draftValues[definition.key] = input.value;
      scheduleNumberPreview(input.value, { allowWhileEditing: true });
    });
    row.append(label, input);
    return row;
  }

  function createColorRow(definition: VfxParamDefinition): HTMLElement {
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
      schedulePreview();
    });

    row.append(label, input);
    return row;
  }

  function createEnumRow(definition: VfxParamDefinition): HTMLElement {
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
      schedulePreview();
    });
    label.addEventListener('click', () => dropdown.button.focus());
    row.append(label, dropdown.root, hidden);
    return row;
  }

  function createCheckboxRow(definition: VfxParamDefinition): HTMLElement {
    const row = ownerDocument.createElement('label');
    row.style.cssText = [
      'display:grid',
      'grid-template-columns:92px 1fr',
      'align-items:center',
      'gap:8px',
      'font-size:12px',
      'color:#dbeafe',
      'cursor:pointer',
      'pointer-events:auto',
    ].join(';');

    const label = ownerDocument.createElement('span');
    label.textContent = definition.label;
    label.title = definition.description ?? definition.label;

    const control = ownerDocument.createElement('span');
    control.style.cssText = 'display:flex;align-items:center;gap:8px;min-height:28px;';

    const input = ownerDocument.createElement('input');
    input.type = 'checkbox';
    input.checked = String(draftValues[definition.key] ?? 'on') === 'on';
    input.dataset.vfxParamKey = definition.key;
    input.style.cssText = [
      'width:16px',
      'height:16px',
      'margin:0',
      'accent-color:#93c5fd',
      'pointer-events:auto',
      'cursor:pointer',
    ].join(';');

    const text = ownerDocument.createElement('span');
    text.style.cssText = 'color:#cbd5e1;font-size:12px;';
    const syncCheckboxText = () => {
      text.textContent = input.checked ? '显示' : '隐藏';
    };
    syncCheckboxText();

    input.addEventListener('pointerdown', (event) => event.stopPropagation());
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('change', () => {
      draftValues[definition.key] = input.checked ? 'on' : 'off';
      syncCheckboxText();
      updateAxisOverlay(open);
    });

    control.append(input, text);
    row.append(label, control);
    return row;
  }

  function refreshDraftFromSelectedTarget(): void {
    const effectPackage = getSelectedPackage();
    if (!effectPackage) {
      draftValues = {};
      return;
    }
    const target = getSelectedTarget();
    const merged = target?.kind === 'usage'
      ? getUsageMergedParams(effectPackage, target.usageId)
      : getProjectDefaultParams(effectPackage);
    const offset = target?.kind === 'usage'
      ? target.usage.offset
      : readDefaultTargetOffset(merged, effectPackage);
    draftValues = {
      ...paramsToDraft(merged, effectPackage),
      ...offsetToDraft(offset, effectPackage),
      [DEBUG_AXIS_PARAM_KEY]: 'on',
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
      draftValues[key] = input.type === 'checkbox'
        ? input.checked ? 'on' : 'off'
        : input.value;
    }
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
    for (const definition of getPanelParamDefinitions(effectPackage).effectDefinitions) {
      const raw = draftValues[definition.key];
      if (definition.kind === 'color') {
        result[definition.key] = hexToColor(raw, readDefaultColor(effectPackage, definition.key));
        continue;
      }
      if (definition.kind === 'enum') {
        result[definition.key] = raw ?? String(readDefaultParam(effectPackage, definition.key) ?? '');
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

  function readCurrentOffset(): ProjectVfxOffsetConfig | null {
    const effectPackage = getSelectedPackage();
    if (!effectPackage) return null;
    const definitions = getPanelParamDefinitions(effectPackage).offsetDefinitions;
    const values = new Map<string, number>();
    for (const definition of definitions) {
      const raw = draftValues[definition.key];
      const value = readDraftNumber(raw);
      if (value === null) {
        setStatus(`Offset 无效：${definition.label}`);
        return null;
      }
      values.set(definition.key, clampNumber(value, readNumberProp(definition, 'min', -Infinity), readNumberProp(definition, 'max', Infinity)));
    }

    const keys = resolveOffsetParamKeys(effectPackage);
    const scale = readOffsetVector(values, keys.scaleX, keys.scaleY, keys.scaleZ, 1);
    const rotationDegrees = readOffsetVector(values, keys.rotationX, keys.rotationY, keys.rotationZ, 0);
    return {
      position: readOffsetVector(values, keys.offsetX, keys.offsetY, keys.offsetZ, 0),
      rotation: vectorDegreesToRadians(rotationDegrees),
      scale: sameVector3Components(scale) ? scale.x : scale,
    };
  }

  function scheduleNumberPreview(value: string, previewOptions: { allowWhileEditing?: boolean } = {}): void {
    win.clearTimeout(previewTimer);
    if (!isIncompleteNumberDraft(value) && readDraftNumber(value) !== null) schedulePreview(previewOptions);
  }

  function schedulePreview(previewOptions: { allowWhileEditing?: boolean } = {}): void {
    if (!previewOptions.allowWhileEditing && isEditingParamControl()) return;
    win.clearTimeout(previewTimer);
    previewTimer = win.setTimeout(() => playPreviewNow(previewOptions), PREVIEW_DEBOUNCE_MS);
  }

  function playPreviewNow(previewOptions: { allowWhileEditing?: boolean } = {}): void {
    if (!previewOptions.allowWhileEditing && isEditingParamControl()) return;
    const effectPackage = getSelectedPackage();
    const target = getSelectedTarget();
    const params = readCurrentParams();
    const offset = readCurrentOffset();
    if (!effectPackage || !target || !params || !offset) return;
    previewHandle?.dispose();
    previewHandle = null;
    if (target.kind === 'usage') {
      const overrideParams = diffVfxParams(params, getProjectDefaultParams(effectPackage));
      const ok = getVfxDirector()?.previewVfxUsageParams(target.usageId, overrideParams, offset) ?? false;
      updateAxisOverlay(open);
      setStatus(ok ? '已预览当前实例' : '实例预览失败');
      return;
    }
    const paramsWithOffset = mergeDefaultOffsetParams(params, offset, effectPackage);
    previewHandle = options.getGame()?.playEffectPackage?.(effectPackage.id, paramsWithOffset, buildDefaultPreviewSpawnTransform(offset)) ?? null;
    updateAxisOverlay(open);
    setStatus('已播放模板预览');
  }

  async function saveCurrentParams(): Promise<void> {
    const effectPackage = getSelectedPackage();
    const target = getSelectedTarget();
    flushActiveParamControl();
    syncDraftValuesFromCurrentControls();
    const params = readCurrentParams();
    const offset = readCurrentOffset();
    if (!effectPackage || !target || !params || !offset) return;
    const paramsToSave = target.kind === 'usage'
      ? diffVfxParams(params, getProjectDefaultParams(effectPackage))
      : mergeDefaultOffsetParams(params, offset, effectPackage);
    const savePath = target.kind === 'usage'
      ? getUsageParamsRelativePath(target.usageId)
      : getEffectParamsRelativePath(effectPackage.id);
    const saveSummary = formatSavedParamsSummary(paramsToSave);
    try {
      if (target.kind === 'usage') {
        await postDebugPanelConfigJson(win, '/__vfx_usage_overrides', {
          usageId: target.usageId,
          params: paramsToSave,
          offset,
        });
        getVfxDirector()?.saveVfxUsageParams(target.usageId, paramsToSave, offset);
      } else {
        await postDebugPanelConfigJson(win, '/__vfx_debug_overrides', {
          effectId: effectPackage.id,
          params: paramsToSave,
        });
        options.getGame()?.getEffectPackageService?.()?.setDebugOverride?.(effectPackage.id, paramsToSave);
        win.setTimeout(() => win.location.reload(), 180);
      }
      updateSavePathHint(effectPackage);
      setStatus(`已保存：${savePath}；${saveSummary}`);
    } catch (error) {
      console.warn('[RuntimeVfxDebugPanel] Save failed', error);
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`保存失败：${message}`);
    }
  }

  function getSelectedPackage(): VfxEffectPackage | null {
    return latestPackages.find((item) => item.id === selectedEffectId) ?? latestPackages[0] ?? null;
  }

  function getSelectedTarget(): VfxDebugTarget | null {
    const effectPackage = getSelectedPackage();
    if (!effectPackage) return null;

    const usage = latestUsageTargets.find((item) => {
      return item.effectId === effectPackage.id && buildUsageTargetKey(item.id) === selectedTargetKey;
    });
    if (usage) {
      return {
        kind: 'usage',
        key: buildUsageTargetKey(usage.id),
        effectId: usage.effectId,
        usageId: usage.id,
        label: usage.label,
        usage,
      };
    }

    return {
      kind: 'effect',
      key: buildEffectTargetKey(effectPackage.id),
      effectId: effectPackage.id,
      label: '模板',
    };
  }

  function getVfxDirector(): ProjectVfxDirector | null {
    return options.getGame()?.getProjectGameplayRuntime?.()?.systems.vfxDirector ?? null;
  }

  function readAxisVisible(): boolean {
    return String(draftValues[DEBUG_AXIS_PARAM_KEY] ?? 'on') === 'on';
  }

  function getSelectedEffectRoot(): TransformNode | null {
    const target = getSelectedTarget();
    if (target?.kind === 'usage') return getVfxDirector()?.getVfxUsageRoot(target.usageId) ?? null;
    return (previewHandle as { root?: TransformNode } | null)?.root ?? null;
  }

  function updateAxisOverlay(visibleContext: boolean): void {
    const scene = options.getGame()?.getScene?.() ?? null;
    const rootNode = getSelectedEffectRoot();
    axisOverlay.update(scene, visibleContext && readAxisVisible(), rootNode);
  }

  function getProjectDefaultParams(effectPackage: VfxEffectPackage): VfxParamValues {
    return options.getGame()?.getEffectPackageService?.()?.getMergedParams?.(effectPackage.id)
      ?? effectPackage.defaultParams;
  }

  function getUsageMergedParams(effectPackage: VfxEffectPackage, usageId: string): VfxParamValues {
    const usageParams = getVfxDirector()?.getVfxUsageParams(usageId)
      ?? latestUsageTargets.find((usage) => usage.id === usageId)?.params
      ?? {};
    return options.getGame()?.getEffectPackageService?.()?.getMergedParams?.(effectPackage.id, usageParams)
      ?? ({ ...effectPackage.defaultParams, ...usageParams } as VfxParamValues);
  }

  function setStatus(message: string): void {
    status.textContent = message;
    win.clearTimeout(statusTimer);
    statusTimer = win.setTimeout(() => {
      if (status.textContent === message) status.textContent = '';
    }, 1800);
  }

  function updateSavePathHint(effectPackage: VfxEffectPackage | null): void {
    const target = getSelectedTarget();
    if (!effectPackage || !target) {
      savePathHint.textContent = '';
      return;
    }
    savePathHint.textContent = target.kind === 'usage'
      ? `保存到：${getUsageParamsRelativePath(target.usageId)}`
      : `保存到：${getEffectParamsRelativePath(effectPackage.id)}`;
  }

  function renderOpenState(): void {
    closeOpenDropdown?.();
    panel.style.display = open ? 'block' : 'none';
    toggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) axisOverlay.dispose();
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
      axisOverlay.dispose();
      ownerDocument.removeEventListener('pointerdown', handleDocumentPointerDown);
      unmountContainer();
    },
  };
}

class EffectAxisOverlay {
  private scene: Scene | null = null;
  private axesViewer: AxesViewer | null = null;
  private labels: Array<{ axis: 'x' | 'y' | 'z'; mesh: Mesh }> = [];

  update(scene: Scene | null, show: boolean, root: TransformNode | null): void {
    if (!scene || !show || !root || root.isDisposed()) {
      this.dispose();
      return;
    }
    if (this.scene !== scene) {
      this.dispose();
      this.scene = scene;
    }
    if (!this.axesViewer) {
      this.axesViewer = new AxesViewer(scene, 1.5);
      this.labels = [
        { axis: 'x', mesh: createAxisLabelMesh(scene, 'X', '#ff4d4d') },
        { axis: 'y', mesh: createAxisLabelMesh(scene, 'Y', '#52d273') },
        { axis: 'z', mesh: createAxisLabelMesh(scene, 'Z', '#4aa3ff') },
      ];
    }

    root.computeWorldMatrix(true);
    const axisReference = readAxisReference(root);
    const position = root.getAbsolutePosition();
    const xAxis = axisReference
      ? Vector3.TransformNormal(Vector3.Right(), axisReference.getWorldMatrix()).normalize()
      : Vector3.Right();
    const yAxis = axisReference
      ? Vector3.TransformNormal(Vector3.Up(), axisReference.getWorldMatrix()).normalize()
      : Vector3.Up();
    const zAxis = axisReference
      ? Vector3.TransformNormal(Vector3.Forward(), axisReference.getWorldMatrix()).normalize()
      : Vector3.Forward();

    this.axesViewer.update(position, xAxis, yAxis, zAxis);
    for (const label of this.labels) {
      const direction = label.axis === 'x'
        ? xAxis
        : label.axis === 'y'
          ? yAxis
          : zAxis;
      const labelOffset = label.axis === 'x'
        ? yAxis.scale(0.12)
        : label.axis === 'y'
          ? xAxis.scale(0.22)
          : xAxis.scale(0.38).add(yAxis.scale(-0.18));
      label.mesh.position.copyFrom(position.add(direction.scale(AXIS_LABEL_DISTANCE)).add(labelOffset));
      label.mesh.setEnabled(true);
    }
  }

  dispose(): void {
    this.axesViewer?.dispose();
    this.axesViewer = null;
    for (const label of this.labels) {
      const material = label.mesh.material as StandardMaterial | null;
      const texture = material?.diffuseTexture;
      label.mesh.dispose();
      material?.dispose();
      texture?.dispose();
    }
    this.labels = [];
    this.scene = null;
  }
}

function readAxisReference(root: TransformNode): TransformNode | null {
  const parent = root.parent;
  if (!parent || typeof (parent as { getWorldMatrix?: unknown }).getWorldMatrix !== 'function') return null;
  const reference = parent as TransformNode;
  reference.computeWorldMatrix(true);
  return reference;
}

function createAxisLabelMesh(scene: Scene, text: string, color: string): Mesh {
  const texture = new DynamicTexture(`vfx_axis_label_${text}`, { width: 128, height: 128 }, scene, true);
  texture.hasAlpha = true;
  const context = texture.getContext();
  context.clearRect(0, 0, 128, 128);
  texture.drawText(text, null, 88, 'bold 82px Arial', '#ffffff', color, true);

  const material = new StandardMaterial(`vfx_axis_label_${text}_mat`, scene);
  material.diffuseTexture = texture;
  material.opacityTexture = texture;
  material.emissiveColor = Color3.White();
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;

  const mesh = MeshBuilder.CreatePlane(`vfx_axis_label_${text}`, { size: 0.48 }, scene);
  mesh.material = material;
  mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.isPickable = false;
  mesh.renderingGroupId = 3;
  mesh.setEnabled(false);
  return mesh;
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

function getUsageParamsRelativePath(usageId: string): string {
  return `src/assets/vfx/usages.json / usages[${usageId}].params + offset`;
}

function buildEffectTargetKey(effectId: string): string {
  return `effect:${effectId}`;
}

function buildUsageTargetKey(usageId: string): string {
  return `usage:${usageId}`;
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
  for (const definition of getPanelParamDefinitions(effectPackage).effectDefinitions) {
    const value = params[definition.key] ?? effectPackage.defaultParams[definition.key];
    result[definition.key] = definition.kind === 'color'
      ? colorToHex(readColorValue(value) ?? readDefaultColor(effectPackage, definition.key))
      : definition.kind === 'enum'
        ? String(value ?? '')
        : formatNumber(typeof value === 'number' ? value : 0);
  }
  return result;
}

interface ResolvedOffsetParamKeys {
  offsetX: string;
  offsetY: string;
  offsetZ: string;
  rotationX: string;
  rotationY: string;
  rotationZ: string;
  scaleX: string;
  scaleY: string;
  scaleZ: string;
}
type CompleteVector3Config = Required<ProjectVfxVector3Config>;

function resolveOffsetParamKeys(effectPackage: VfxEffectPackage): ResolvedOffsetParamKeys {
  return {
    ...DEFAULT_SPAWN_PARAM_KEYS,
    offsetX: effectPackage.spawnParams?.offsetX ?? DEFAULT_SPAWN_PARAM_KEYS.offsetX,
    offsetY: effectPackage.spawnParams?.offsetY ?? DEFAULT_SPAWN_PARAM_KEYS.offsetY,
    offsetZ: effectPackage.spawnParams?.offsetZ ?? DEFAULT_SPAWN_PARAM_KEYS.offsetZ,
  };
}

function readMappedOffsetDefinitionKey(key: string, keys: ResolvedOffsetParamKeys): string {
  switch (key) {
    case DEFAULT_SPAWN_PARAM_KEYS.offsetX: return keys.offsetX;
    case DEFAULT_SPAWN_PARAM_KEYS.offsetY: return keys.offsetY;
    case DEFAULT_SPAWN_PARAM_KEYS.offsetZ: return keys.offsetZ;
    case DEFAULT_SPAWN_PARAM_KEYS.rotationX: return keys.rotationX;
    case DEFAULT_SPAWN_PARAM_KEYS.rotationY: return keys.rotationY;
    case DEFAULT_SPAWN_PARAM_KEYS.rotationZ: return keys.rotationZ;
    case DEFAULT_SPAWN_PARAM_KEYS.scaleX: return keys.scaleX;
    case DEFAULT_SPAWN_PARAM_KEYS.scaleY: return keys.scaleY;
    case DEFAULT_SPAWN_PARAM_KEYS.scaleZ: return keys.scaleZ;
    default: return key;
  }
}

function readDefaultTargetOffset(params: Partial<VfxParamValues>, effectPackage: VfxEffectPackage): ProjectVfxOffsetConfig {
  const keys = resolveOffsetParamKeys(effectPackage);
  return {
    position: {
      x: readParamNumber(params[keys.offsetX], 0),
      y: readParamNumber(params[keys.offsetY], 0),
      z: readParamNumber(params[keys.offsetZ], 0),
    },
    rotation: {
      x: readParamNumber(params[keys.rotationX], 0),
      y: readParamNumber(params[keys.rotationY], 0),
      z: readParamNumber(params[keys.rotationZ], 0),
    },
    scale: {
      x: readParamNumber(params[keys.scaleX], 1),
      y: readParamNumber(params[keys.scaleY], 1),
      z: readParamNumber(params[keys.scaleZ], 1),
    },
  };
}

function offsetToDraft(offset: ProjectVfxOffsetConfig | undefined, effectPackage: VfxEffectPackage): DraftValues {
  const keys = resolveOffsetParamKeys(effectPackage);
  const normalized = normalizePanelOffset(offset);
  return {
    [keys.offsetX]: formatNumber(normalized.position.x),
    [keys.offsetY]: formatNumber(normalized.position.y),
    [keys.offsetZ]: formatNumber(normalized.position.z),
    [keys.rotationX]: formatNumber(radiansToDegrees(normalized.rotation.x)),
    [keys.rotationY]: formatNumber(radiansToDegrees(normalized.rotation.y)),
    [keys.rotationZ]: formatNumber(radiansToDegrees(normalized.rotation.z)),
    [keys.scaleX]: formatNumber(normalized.scale.x),
    [keys.scaleY]: formatNumber(normalized.scale.y),
    [keys.scaleZ]: formatNumber(normalized.scale.z),
  };
}

function mergeDefaultOffsetParams(
  params: Partial<VfxParamValues>,
  offset: ProjectVfxOffsetConfig,
  effectPackage: VfxEffectPackage,
): Partial<VfxParamValues> {
  const keys = resolveOffsetParamKeys(effectPackage);
  const normalized = normalizePanelOffset(offset);
  return {
    ...params,
    [keys.offsetX]: normalized.position.x,
    [keys.offsetY]: normalized.position.y,
    [keys.offsetZ]: normalized.position.z,
    [keys.rotationX]: normalized.rotation.x,
    [keys.rotationY]: normalized.rotation.y,
    [keys.rotationZ]: normalized.rotation.z,
    [keys.scaleX]: normalized.scale.x,
    [keys.scaleY]: normalized.scale.y,
    [keys.scaleZ]: normalized.scale.z,
  };
}

function buildDefaultPreviewSpawnTransform(offset: ProjectVfxOffsetConfig): VfxSpawnTransform {
  const normalized = normalizePanelOffset(offset);
  return {
    rotation: normalized.rotation,
    scale: sameVector3Components(normalized.scale) ? normalized.scale.x : normalized.scale,
  };
}

function normalizePanelOffset(offset: ProjectVfxOffsetConfig | undefined): {
  position: CompleteVector3Config;
  rotation: CompleteVector3Config;
  scale: CompleteVector3Config;
} {
  return {
    position: normalizeOffsetVector(offset?.position, 0),
    rotation: normalizeOffsetVector(offset?.rotation, 0),
    scale: typeof offset?.scale === 'number'
      ? { x: offset.scale, y: offset.scale, z: offset.scale }
      : normalizeOffsetVector(offset?.scale, 1),
  };
}

function normalizeOffsetVector(value: ProjectVfxVector3Config | undefined, fallback: number): CompleteVector3Config {
  return {
    x: readFiniteConfigNumber(value?.x, fallback),
    y: readFiniteConfigNumber(value?.y, fallback),
    z: readFiniteConfigNumber(value?.z, fallback),
  };
}

function readOffsetVector(values: Map<string, number>, xKey: string, yKey: string, zKey: string, fallback: number): CompleteVector3Config {
  return {
    x: values.get(xKey) ?? fallback,
    y: values.get(yKey) ?? fallback,
    z: values.get(zKey) ?? fallback,
  };
}

function vectorDegreesToRadians(value: CompleteVector3Config): CompleteVector3Config {
  return {
    x: degreesToRadians(value.x),
    y: degreesToRadians(value.y),
    z: degreesToRadians(value.z),
  };
}

function degreesToRadians(value: number): number {
  return value * DEG_TO_RAD;
}

function radiansToDegrees(value: number): number {
  return value * RAD_TO_DEG;
}

function sameVector3Components(value: CompleteVector3Config): boolean {
  return Math.abs(value.x - value.y) < 0.000001
    && Math.abs(value.y - value.z) < 0.000001;
}

function readParamNumber(value: VfxParamValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readFiniteConfigNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readDefaultParam(effectPackage: VfxEffectPackage | null, key: string): VfxParamValue | undefined {
  return effectPackage?.defaultParams[key];
}

function readDefaultColor(effectPackage: VfxEffectPackage, key: string): VfxColorValue {
  const value = effectPackage.defaultParams[key];
  return readColorValue(value) ?? { r: 1, g: 1, b: 1 };
}

function readNumberProp(definition: VfxParamDefinition, key: 'min' | 'max', fallback: number): number {
  const value = definition.kind !== 'color' && definition.kind !== 'enum' ? definition[key] : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readDraftNumber(value: string | undefined): number | null {
  if (value == null || isIncompleteNumberDraft(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

function usageTargetsChanged(left: ProjectVfxUsageTarget[], right: ProjectVfxUsageTarget[]): boolean {
  if (left.length !== right.length) return true;
  return left.some((item, index) => {
    const next = right[index];
    return !next
      || item.id !== next.id
      || item.effectId !== next.effectId
      || item.label !== next.label
      || item.placement !== next.placement
      || item.lifecycle !== next.lifecycle
      || item.positionSource.kind !== next.positionSource.kind
      || item.positionSource.nodeId !== next.positionSource.nodeId
      || JSON.stringify(item.offset ?? {}) !== JSON.stringify(next.offset ?? {});
  });
}

function diffVfxParams(params: Partial<VfxParamValues>, baseParams: Partial<VfxParamValues>): Partial<VfxParamValues> {
  const result: Partial<VfxParamValues> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || sameVfxParamValue(value, baseParams[key])) continue;
    result[key] = cloneVfxParamValue(value);
  }
  return result;
}

function sameVfxParamValue(left: VfxParamValue | undefined, right: VfxParamValue | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) < 0.000001;

  const leftColor = readComparableColor(left);
  const rightColor = readComparableColor(right);
  if (leftColor && rightColor) return colorToHex(leftColor) === colorToHex(rightColor);

  return left === right;
}

function readComparableColor(value: VfxParamValue): VfxColorValue | null {
  if (isColorValue(value)) return value;
  if (typeof value !== 'string' || !/^#?[0-9a-f]{6}$/i.test(value.trim())) return null;
  return hexToColor(value, { r: 1, g: 1, b: 1 });
}

function cloneVfxParamValue(value: VfxParamValue): VfxParamValue {
  return isColorValue(value) ? { ...value } : value;
}

function getPanelParamDefinitions(effectPackage: VfxEffectPackage): {
  offsetDefinitions: VfxParamDefinition[];
  effectDefinitions: VfxParamDefinition[];
  allDefinitions: VfxParamDefinition[];
} {
  const keys = resolveOffsetParamKeys(effectPackage);
  const offsetDefinitions = DEFAULT_OFFSET_PARAM_DEFINITIONS.map((definition) => ({
    ...definition,
    key: readMappedOffsetDefinitionKey(definition.key, keys),
  }));
  const offsetKeySet = new Set(offsetDefinitions.map((definition) => definition.key));
  const effectDefinitions = effectPackage.debugParams.filter((definition) => !offsetKeySet.has(definition.key));
  return {
    offsetDefinitions,
    effectDefinitions,
    allDefinitions: [...offsetDefinitions, ...effectDefinitions],
  };
}

function readDebugHudVisible(ownerDocument: Document): boolean {
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

function clearLegacyVfxDebugStorage(win: Window): void {
  try {
    for (const key of LEGACY_VFX_DEBUG_STORAGE_KEYS) {
      win.localStorage.removeItem(key);
    }
  } catch {
    // Cache cleanup is best-effort only.
  }
}
