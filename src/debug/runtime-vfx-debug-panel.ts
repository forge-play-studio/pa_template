import { AxesViewer } from '@babylonjs/core/Debug/axesViewer';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { ProjectGameplayRuntime } from '../gameplay';
import type { GameWorld } from '../runtime/GameWorld';
import type { ProjectVfxOffsetConfig, ProjectVfxUsageTarget } from '../systems';
import type {
  VfxDebugParameterDefinition,
  VfxParams,
  VfxRegisteredEffectInfo,
  VfxService,
} from '../services';
import { createRuntimeDebugPanelButton, mountRuntimeDebugPanelContainer } from './debug-panel-layout';
import { saveVfxEffectDefaultParams, saveVfxUsageOverride } from './framework/config-client';
import type { Disposable } from './framework/disposables';

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
  close(): void;
}

interface Vector3Value {
  x: number;
  y: number;
  z: number;
}

type VfxDebugTarget =
  | { kind: 'effect'; effect: VfxRegisteredEffectInfo }
  | { kind: 'usage'; effect: VfxRegisteredEffectInfo; usage: ProjectVfxUsageTarget };

const PREVIEW_DEBOUNCE_MS = 180;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const OFFSET_KEYS = {
  positionX: '__generation.offsetX',
  positionY: '__generation.offsetY',
  positionZ: '__generation.offsetZ',
  rotationX: '__generation.rotationX',
  rotationY: '__generation.rotationY',
  rotationZ: '__generation.rotationZ',
  scaleX: '__generation.scaleX',
  scaleY: '__generation.scaleY',
  scaleZ: '__generation.scaleZ',
} as const;
const DEBUG_AXIS_KEY = '__debug.showAxis';
const OFFSET_DEFINITIONS: readonly VfxDebugParameterDefinition[] = [
  { key: OFFSET_KEYS.positionX, label: '位置 X', kind: 'number', min: -5, max: 5, step: 0.01 },
  { key: OFFSET_KEYS.positionY, label: '位置 Y', kind: 'number', min: -5, max: 5, step: 0.01 },
  { key: OFFSET_KEYS.positionZ, label: '位置 Z', kind: 'number', min: -5, max: 5, step: 0.01 },
  { key: OFFSET_KEYS.rotationX, label: '旋转 X (°)', kind: 'number', min: -360, max: 360, step: 1 },
  { key: OFFSET_KEYS.rotationY, label: '旋转 Y (°)', kind: 'number', min: -360, max: 360, step: 1 },
  { key: OFFSET_KEYS.rotationZ, label: '旋转 Z (°)', kind: 'number', min: -360, max: 360, step: 1 },
  { key: OFFSET_KEYS.scaleX, label: '缩放 X', kind: 'number', min: 0.01, max: 10, step: 0.01 },
  { key: OFFSET_KEYS.scaleY, label: '缩放 Y', kind: 'number', min: 0.01, max: 10, step: 0.01 },
  { key: OFFSET_KEYS.scaleZ, label: '缩放 Z', kind: 'number', min: 0.01, max: 10, step: 0.01 },
];

export interface RuntimeVfxDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => GameWorld | null;
  getGameplayRuntime?: () => ProjectGameplayRuntime | null;
}

/**
 * The shared runtime-panel implementation for authored VFX tuning. It only
 * talks to the VFX Service and ProjectVfxDirector public contracts: the panel
 * never reaches into a pool instance, ParticleSystem, or Material.
 */
export function mountRuntimeVfxDebugPanel(options: RuntimeVfxDebugPanelOptions): Disposable {
  const root = options.root ?? document.body;
  const container = root.ownerDocument.createElement('div');
  container.id = 'runtime-vfx-debug-panel';
  container.setAttribute('data-input-layer', '');
  container.setAttribute('aria-label', 'VFX 调试');
  const panel = renderRuntimeVfxDebugPanel(container, options);
  const unmount = mountRuntimeDebugPanelContainer(root, container);
  return {
    dispose() {
      panel.dispose();
      unmount();
    },
  };
}

function renderRuntimeVfxDebugPanel(content: HTMLElement, options: RuntimeVfxDebugPanelOptions): Disposable {
  const doc = content.ownerDocument;
  const win = doc.defaultView ?? window;
  content.style.cssText = [
    'position:relative',
    'display:flex',
    'flex-direction:column-reverse',
    'align-items:flex-start',
    'gap:8px',
    'font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'color:#edf2ff',
    'pointer-events:none',
  ].join(';');
  let open = false;
  let closeOpenDropdown: (() => void) | null = null;
  const toggleButton = createRuntimeDebugPanelButton(doc, 'VFX');
  toggleButton.title = '打开 VFX 调试面板';
  const panel = doc.createElement('section');
  panel.setAttribute('data-input-layer', '');
  panel.style.cssText = [
    'pointer-events:auto', 'width:320px', 'max-width:calc(100vw - 32px)',
    'max-height:min(74vh,720px)', 'overflow:auto', 'box-sizing:border-box', 'padding:12px',
    'border:1px solid rgba(148,163,184,.28)', 'border-radius:8px', 'background:rgba(13,18,28,.95)',
    'box-shadow:0 18px 44px rgba(0,0,0,.34)', 'backdrop-filter:blur(8px)', 'display:none',
  ].join(';');
  const title = doc.createElement('div');
  title.textContent = 'VFX 调试';
  title.style.cssText = 'font-size:13px;font-weight:800;line-height:1.2;margin-bottom:10px;';
  const effectRow = createPanelFieldRow(doc, '特效');
  const effectDropdown = createDropdownControl(doc, [], '', (value) => {
    selectedEffectId = value;
    selectedTargetKey = '';
    syncTargetSelect();
    loadDrafts();
    renderParams();
    playPreviewNow();
  }, () => closeOpenDropdown, (next) => { closeOpenDropdown = next; });
  effectRow.append(effectDropdown.root);
  const targetRow = createPanelFieldRow(doc, '目标');
  const targetDropdown = createDropdownControl(doc, [], '', (value) => {
    selectedTargetKey = value;
    loadDrafts();
    renderParams();
    playPreviewNow();
  }, () => closeOpenDropdown, (next) => { closeOpenDropdown = next; });
  targetRow.append(targetDropdown.root);

  const paramsRoot = doc.createElement('div');
  paramsRoot.style.cssText = 'display:flex;flex-direction:column;gap:9px;margin-bottom:12px;';

  const actions = doc.createElement('div');
  actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;';
  const actionStatus = doc.createElement('div');
  actionStatus.style.cssText = 'min-height:16px;font-size:11px;line-height:1.35;color:#93c5fd;';
  const saveHint = createEmptyLine(doc, '');
  const playButton = createRuntimeDebugPanelButton(doc, '播放');
  const saveButton = createRuntimeDebugPanelButton(doc, '保存');
  const resetButton = createRuntimeDebugPanelButton(doc, '重置');
  actions.append(playButton, saveButton, resetButton);
  panel.append(title, effectRow, targetRow, paramsRoot, actions, actionStatus, saveHint);
  content.append(toggleButton, panel);

  let effects: VfxRegisteredEffectInfo[] = [];
  let usageTargets: ProjectVfxUsageTarget[] = [];
  let selectedEffectId = '';
  let selectedTargetKey = '';
  let drafts: DraftValues = {};
  let previousSignature = '';
  let previewTimer: number | undefined;
  let statusTimer: number | undefined;
  let templateAxisAnchor: TransformNode | null = null;
  let usageAxisAnchor: TransformNode | null = null;
  const axisOverlay = new EffectAxisOverlay();

  const getService = (): VfxService | null => options.getGame()?.getVfxService() ?? null;
  const getDirector = () => options.getGameplayRuntime?.()?.systems.vfxDirector
    ?? options.getGame()?.getProjectGameplayRuntime()?.systems.vfxDirector
    ?? null;

  toggleButton.addEventListener('click', () => {
    open = !open;
    closeOpenDropdown?.();
    panel.style.display = open ? 'block' : 'none';
    toggleButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) axisOverlay.hide();
  });
  playButton.addEventListener('click', () => playPreviewNow());
  saveButton.addEventListener('click', () => { void saveCurrentTarget(); });
  resetButton.addEventListener('click', resetCurrentTarget);
  const closeDropdownOnPointerDown = () => closeOpenDropdown?.();
  doc.addEventListener('pointerdown', closeDropdownOnPointerDown);

  function refresh(): void {
    const service = getService();
    const nextEffects = service?.getRegisteredEffects() ?? [];
    const nextUsages = getDirector()?.getVfxUsageTargets() ?? [];
    const signature = [
      nextEffects.map(effect => `${effect.effectId}:${JSON.stringify(effect.defaultParams)}:${effect.debugParameters.map(item => `${item.key}:${item.kind}`).join(',')}`).join('|'),
      nextUsages.map(usage => `${usage.id}:${usage.effectId}:${JSON.stringify(usage.params)}:${JSON.stringify(usage.offset)}`).join('|'),
    ].join('||');
    if (signature !== previousSignature) {
      previousSignature = signature;
      effects = nextEffects;
      usageTargets = nextUsages;
      syncEffectSelect();
      syncTargetSelect();
      loadDrafts();
      renderParams();
    }
  }

  function syncEffectSelect(): void {
    const fallback = effects[0]?.effectId ?? '';
    selectedEffectId = effects.some(effect => effect.effectId === selectedEffectId) ? selectedEffectId : fallback;
    effectDropdown.setOptions(effects.map(effect => ({ value: effect.effectId, label: `${effect.displayName} (${effect.effectId})` })));
    effectDropdown.setValue(selectedEffectId);
  }

  function syncTargetSelect(): void {
    const choices = getTargetChoices();
    selectedTargetKey = choices.some(choice => choice.value === selectedTargetKey)
      ? selectedTargetKey
      : choices[0]?.value ?? '';
    targetDropdown.setOptions(choices);
    targetDropdown.setValue(selectedTargetKey);
    updateSaveHint();
  }

  function getTargetChoices(): Array<{ value: string; label: string }> {
    if (!selectedEffectId) return [];
    return [
      { value: effectTargetKey(selectedEffectId), label: '模板' },
      ...usageTargets.filter(usage => usage.effectId === selectedEffectId)
        .map(usage => ({ value: usageTargetKey(usage.id), label: `实例：${usage.label}` })),
    ];
  }

  function getTarget(): VfxDebugTarget | null {
    const effect = effects.find(item => item.effectId === selectedEffectId) ?? null;
    if (!effect) return null;
    const usageId = selectedTargetKey.startsWith('usage:') ? selectedTargetKey.slice('usage:'.length) : '';
    const usage = usageTargets.find(item => item.id === usageId && item.effectId === effect.effectId);
    return usage ? { kind: 'usage', effect, usage } : { kind: 'effect', effect };
  }

  function loadDrafts(): void {
    const target = getTarget();
    if (!target) {
      drafts = {};
      return;
    }
    const params = target.kind === 'usage'
      ? { ...target.effect.defaultParams, ...target.usage.params }
      : target.effect.defaultParams;
    drafts = {
      ...paramsToDraft(params, target.effect),
      ...offsetToDraft(target.kind === 'usage' ? target.usage.offset : undefined),
      [DEBUG_AXIS_KEY]: drafts[DEBUG_AXIS_KEY] ?? 'on',
    };
    updateSaveHint();
  }

  function renderParams(): void {
    paramsRoot.replaceChildren();
    const target = getTarget();
    if (!target) {
      paramsRoot.append(createEmptyLine(doc, '等待 VFX Service 注册 effect…'));
      return;
    }
    paramsRoot.append(createSectionTitle(doc, '挂载 Offset'));
    for (const definition of OFFSET_DEFINITIONS) paramsRoot.append(createParameterRow(definition));
    paramsRoot.append(createAxisRow());
    paramsRoot.append(createSectionTitle(doc, '特效参数'));
    const definitions = getEffectDefinitions(target.effect);
    if (definitions.length === 0) {
      paramsRoot.append(createEmptyLine(doc, `“${target.effect.displayName}”没有声明可调参数。`));
      return;
    }
    for (const definition of definitions) paramsRoot.append(createParameterRow(definition));
  }

  function createParameterRow(definition: VfxDebugParameterDefinition): HTMLElement {
    const row = createRowShell(doc, definition);
    const kind = definition.kind ?? 'number';
    const input = kind === 'json' ? doc.createElement('textarea') : doc.createElement('input');
    input.dataset.vfxParamKey = definition.key;
    if (input instanceof HTMLTextAreaElement) {
      input.rows = 3;
      input.spellcheck = false;
      input.value = drafts[definition.key] ?? '{}';
    } else if (kind === 'boolean' && input instanceof HTMLInputElement) {
      input.type = 'checkbox';
      input.checked = readBoolean(drafts[definition.key], false);
      input.style.cssText = 'width:16px;height:16px;margin:0;accent-color:#93c5fd;';
    } else if (kind === 'color') {
      input.type = 'color';
      input.value = normalizeHex(drafts[definition.key] ?? '#ffffff');
    } else if (kind === 'select') {
      const select = doc.createElement('input');
      select.type = 'hidden';
      select.dataset.vfxParamKey = definition.key;
      select.value = drafts[definition.key] ?? definition.options?.[0]?.value ?? '';
      const dropdown = createDropdownControl(doc, (definition.options ?? []).map(option => ({
        value: option.value,
        label: option.label ?? option.value,
      })), select.value, value => {
        select.value = value;
        updateDraftAndPreview(definition.key, value);
      }, () => closeOpenDropdown, (next) => { closeOpenDropdown = next; });
      row.append(dropdown.root, select);
      return row;
    } else {
      input.type = kind === 'text' ? 'text' : 'text';
      input.inputMode = kind === 'number' ? 'decimal' : 'text';
      input.value = drafts[definition.key] ?? '';
    }
    styleInput(input);
    if (kind === 'boolean' && input instanceof HTMLInputElement) {
      const control = doc.createElement('label');
      control.style.cssText = 'display:flex;align-items:center;gap:7px;min-height:28px;cursor:pointer;';
      const text = doc.createElement('span');
      const syncText = () => { text.textContent = input.checked ? '开启' : '关闭'; };
      syncText();
      input.addEventListener('change', () => {
        drafts[definition.key] = input.checked ? 'true' : 'false';
        syncText();
        schedulePreview();
      });
      control.append(input, text);
      row.append(control);
      return row;
    }
    const update = () => updateDraftAndPreview(definition.key, input.value, kind === 'number');
    input.addEventListener(kind === 'json' ? 'change' : 'input', update);
    input.addEventListener('change', update);
    row.append(input);
    return row;
  }

  function createAxisRow(): HTMLElement {
    const row = createRowShell(doc, { key: DEBUG_AXIS_KEY, label: '坐标轴 XYZ' });
    const control = doc.createElement('label');
    control.style.cssText = 'display:flex;align-items:center;gap:7px;min-height:28px;cursor:pointer;';
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.checked = drafts[DEBUG_AXIS_KEY] !== 'off';
    input.style.cssText = 'width:16px;height:16px;margin:0;accent-color:#93c5fd;';
    const text = doc.createElement('span');
    const syncText = () => { text.textContent = input.checked ? '显示' : '隐藏'; };
    syncText();
    input.addEventListener('change', () => {
      drafts[DEBUG_AXIS_KEY] = input.checked ? 'on' : 'off';
      syncText();
      updateAxis(readOffset());
    });
    control.append(input, text);
    row.append(control);
    return row;
  }

  function updateDraftAndPreview(key: string, value: string, numeric = false): void {
    drafts[key] = value;
    if (numeric && readNumber(value) === null) return;
    schedulePreview();
  }

  function schedulePreview(): void {
    if (previewTimer !== undefined) win.clearTimeout(previewTimer);
    previewTimer = win.setTimeout(() => {
      previewTimer = undefined;
      playPreviewNow();
    }, PREVIEW_DEBOUNCE_MS);
  }

  function playPreviewNow(): void {
    syncDraftsFromControls();
    const target = getTarget();
    const params = readParams(target?.effect ?? null);
    const offset = readOffset();
    if (!target || !params || !offset) return;
    if (target.kind === 'usage') {
      const overrides = diffParams(params, target.effect.defaultParams);
      const previewed = getDirector()?.previewVfxUsageParams(target.usage.id, overrides, offset) ?? false;
      updateAxis(offset);
      setStatus(previewed ? '已预览当前实例' : '实例预览失败');
      return;
    }
    const service = getService();
    if (!service) {
      setStatus('VFX Service 未初始化');
      return;
    }
    const owner = previewOwner(target.effect.effectId);
    service.releaseByOwner(owner);
    const result = service.play(target.effect.effectId, {
      owner,
      params,
      source: 'debug',
      placement: offsetToPlacement(offset),
    });
    updateAxis(offset);
    setStatus(result.ok ? '已播放模板预览' : `${result.code}: ${result.message}`);
  }

  function resetCurrentTarget(): void {
    const target = getTarget();
    if (!target) return;
    if (target.kind === 'usage') {
      const reset = getDirector()?.resetVfxUsagePreview(target.usage.id) ?? false;
      usageTargets = getDirector()?.getVfxUsageTargets() ?? usageTargets;
      const saved = usageTargets.find(item => item.id === target.usage.id) ?? target.usage;
      drafts = {
        ...paramsToDraft({ ...target.effect.defaultParams, ...saved.params }, target.effect),
        ...offsetToDraft(saved.offset),
        [DEBUG_AXIS_KEY]: drafts[DEBUG_AXIS_KEY] ?? 'on',
      };
      renderParams();
      updateAxis(readOffset());
      setStatus(reset ? '已恢复实例已保存的覆盖值' : '实例重置失败');
      return;
    }
    drafts = {
      ...paramsToDraft(target.effect.defaultParams, target.effect),
      ...offsetToDraft(undefined),
      [DEBUG_AXIS_KEY]: drafts[DEBUG_AXIS_KEY] ?? 'on',
    };
    renderParams();
    playPreviewNow();
    setStatus('已恢复模板已保存的默认参数');
  }

  async function saveCurrentTarget(): Promise<void> {
    syncDraftsFromControls();
    const target = getTarget();
    const params = readParams(target?.effect ?? null);
    const offset = readOffset();
    if (!target || !params || !offset) return;
    try {
      if (target.kind === 'usage') {
        const overrides = diffParams(params, target.effect.defaultParams);
        await saveVfxUsageOverride(target.usage.id, overrides, offset);
        const applied = getDirector()?.saveVfxUsageParams(target.usage.id, overrides, offset) ?? false;
        setStatus(applied
          ? `已保存实例覆盖：${usageSavePath(target.usage.id)}`
          : `已保存实例覆盖：${usageSavePath(target.usage.id)}（运行时不可用）`);
        return;
      }
      const savedParams = await saveVfxEffectDefaultParams(target.effect.effectId, params);
      const applied = getService()?.setDebugDefaultParams(target.effect.effectId, savedParams) ?? false;
      effects = getService()?.getRegisteredEffects() ?? effects;
      loadDrafts();
      renderParams();
      setStatus(applied
        ? `已验证并保存模板参数：${effectSavePath(target.effect.effectId)}`
        : `已验证并保存模板参数：${effectSavePath(target.effect.effectId)}（运行时 service 不可用）`);
    } catch (error) {
      setStatus(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function readParams(effect: VfxRegisteredEffectInfo | null): VfxParams | null {
    if (!effect) return null;
    const result: VfxParams = {};
    for (const definition of getEffectDefinitions(effect)) {
      const raw = drafts[definition.key];
      const kind = definition.kind ?? 'number';
      if (kind === 'color') {
        result[definition.key] = hexToColor(raw, readColor(effect.defaultParams[definition.key]) ?? { r: 1, g: 1, b: 1 });
      } else if (kind === 'boolean') {
        result[definition.key] = readBoolean(raw, readBoolean(effect.defaultParams[definition.key], false));
      } else if (kind === 'text' || kind === 'select') {
        result[definition.key] = raw ?? '';
      } else if (kind === 'json') {
        try {
          result[definition.key] = JSON.parse(raw || '{}');
        } catch {
          setStatus(`参数无效：${definition.label ?? definition.key} 不是有效 JSON`);
          return null;
        }
      } else {
        const value = readNumber(raw);
        if (value === null) {
          setStatus(`参数无效：${definition.label ?? definition.key}`);
          return null;
        }
        result[definition.key] = clamp(value, definition.min, definition.max);
      }
    }
    return result;
  }

  function readOffset(): ProjectVfxOffsetConfig | null {
    const values = new Map<string, number>();
    for (const definition of OFFSET_DEFINITIONS) {
      const value = readNumber(drafts[definition.key]);
      if (value === null) {
        setStatus(`Offset 无效：${definition.label ?? definition.key}`);
        return null;
      }
      values.set(definition.key, clamp(value, definition.min, definition.max));
    }
    const scale = readVector(values, OFFSET_KEYS.scaleX, OFFSET_KEYS.scaleY, OFFSET_KEYS.scaleZ, 1);
    return {
      position: readVector(values, OFFSET_KEYS.positionX, OFFSET_KEYS.positionY, OFFSET_KEYS.positionZ, 0),
      rotation: toRadians(readVector(values, OFFSET_KEYS.rotationX, OFFSET_KEYS.rotationY, OFFSET_KEYS.rotationZ, 0)),
      scale: sameVector(scale) ? scale.x : scale,
    };
  }

  function syncDraftsFromControls(): void {
    for (const control of paramsRoot.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-vfx-param-key]')) {
      const key = control.dataset.vfxParamKey;
      if (!key) continue;
      drafts[key] = control instanceof HTMLInputElement && control.type === 'checkbox'
        ? control.checked ? 'true' : 'false'
        : control.value;
    }
  }

  function updateAxis(offset: ProjectVfxOffsetConfig | null): void {
    const scene = options.getGame()?.getScene() ?? null;
    const target = getTarget();
    if (!scene || !target || !offset || drafts[DEBUG_AXIS_KEY] === 'off') {
      axisOverlay.hide();
      return;
    }
    if (target.kind === 'usage') {
      const parent = getDirector()?.getVfxUsageRoot(target.usage.id) ?? null;
      if (!parent) {
        axisOverlay.hide();
        return;
      }
      const anchor = getUsageAxisAnchor(scene, parent);
      applyOffset(anchor, offset);
      axisOverlay.update(scene, anchor);
      return;
    }
    const anchor = getTemplateAxisAnchor(scene);
    applyOffset(anchor, offset);
    axisOverlay.update(scene, anchor);
  }

  function getTemplateAxisAnchor(scene: Scene): TransformNode {
    if (!templateAxisAnchor || templateAxisAnchor.isDisposed() || templateAxisAnchor.getScene() !== scene) {
      templateAxisAnchor?.dispose();
      templateAxisAnchor = new TransformNode('runtime-vfx-debug-template-axis', scene);
    }
    return templateAxisAnchor;
  }

  function getUsageAxisAnchor(scene: Scene, parent: TransformNode): TransformNode {
    if (!usageAxisAnchor || usageAxisAnchor.isDisposed() || usageAxisAnchor.getScene() !== scene) {
      usageAxisAnchor?.dispose();
      usageAxisAnchor = new TransformNode('runtime-vfx-debug-usage-axis', scene);
    }
    usageAxisAnchor.parent = parent;
    return usageAxisAnchor;
  }

  function updateSaveHint(): void {
    const target = getTarget();
    if (!target) {
      saveHint.textContent = '';
      return;
    }
    saveHint.textContent = target.kind === 'usage'
      ? `保存到：${usageSavePath(target.usage.id)}`
      : `保存到：${effectSavePath(target.effect.effectId)}（模板 Offset 只用于预览）`;
  }

  function setStatus(message: string): void {
    actionStatus.textContent = message;
    if (statusTimer !== undefined) win.clearTimeout(statusTimer);
    statusTimer = win.setTimeout(() => {
      if (actionStatus.textContent === message) actionStatus.textContent = '';
    }, 2600);
  }

  refresh();
  const refreshTimer = win.setInterval(refresh, 250);
  return {
    dispose() {
      win.clearInterval(refreshTimer);
      if (previewTimer !== undefined) win.clearTimeout(previewTimer);
      if (statusTimer !== undefined) win.clearTimeout(statusTimer);
      for (const effect of effects) getService()?.releaseByOwner(previewOwner(effect.effectId));
      axisOverlay.dispose();
      templateAxisAnchor?.dispose();
      usageAxisAnchor?.dispose();
      doc.removeEventListener('pointerdown', closeDropdownOnPointerDown);
    },
  };
}

function getEffectDefinitions(effect: VfxRegisteredEffectInfo): readonly VfxDebugParameterDefinition[] {
  return effect.debugParameters.filter(definition => !OFFSET_DEFINITIONS.some(offset => offset.key === definition.key));
}

function paramsToDraft(params: Readonly<VfxParams>, effect: VfxRegisteredEffectInfo): DraftValues {
  const result: DraftValues = {};
  for (const definition of getEffectDefinitions(effect)) {
    const value = params[definition.key] ?? effect.defaultParams[definition.key];
    switch (definition.kind ?? 'number') {
      case 'color': result[definition.key] = colorToHex(readColor(value) ?? { r: 1, g: 1, b: 1 }); break;
      case 'boolean': result[definition.key] = String(readBoolean(value, false)); break;
      case 'json': result[definition.key] = JSON.stringify(value ?? {}, null, 2); break;
      case 'select':
      case 'text': result[definition.key] = String(value ?? ''); break;
      default: result[definition.key] = formatNumber(typeof value === 'number' ? value : 0);
    }
  }
  return result;
}

function offsetToDraft(offset: ProjectVfxOffsetConfig | undefined): DraftValues {
  const normalized = normalizeOffset(offset);
  return {
    [OFFSET_KEYS.positionX]: formatNumber(normalized.position.x),
    [OFFSET_KEYS.positionY]: formatNumber(normalized.position.y),
    [OFFSET_KEYS.positionZ]: formatNumber(normalized.position.z),
    [OFFSET_KEYS.rotationX]: formatNumber(normalized.rotation.x * RAD_TO_DEG),
    [OFFSET_KEYS.rotationY]: formatNumber(normalized.rotation.y * RAD_TO_DEG),
    [OFFSET_KEYS.rotationZ]: formatNumber(normalized.rotation.z * RAD_TO_DEG),
    [OFFSET_KEYS.scaleX]: formatNumber(normalized.scale.x),
    [OFFSET_KEYS.scaleY]: formatNumber(normalized.scale.y),
    [OFFSET_KEYS.scaleZ]: formatNumber(normalized.scale.z),
  };
}

function normalizeOffset(offset: ProjectVfxOffsetConfig | undefined): { position: Vector3Value; rotation: Vector3Value; scale: Vector3Value } {
  return {
    position: normalizeVector(offset?.position, 0),
    rotation: normalizeVector(offset?.rotation, 0),
    scale: typeof offset?.scale === 'number'
      ? { x: offset.scale, y: offset.scale, z: offset.scale }
      : normalizeVector(offset?.scale, 1),
  };
}

function normalizeVector(value: unknown, fallback: number): Vector3Value {
  const source = value && typeof value === 'object' ? value as Partial<Vector3Value> : {};
  return { x: finite(source.x, fallback), y: finite(source.y, fallback), z: finite(source.z, fallback) };
}

function applyOffset(node: TransformNode, offset: ProjectVfxOffsetConfig): void {
  const value = normalizeOffset(offset);
  node.position.copyFromFloats(value.position.x, value.position.y, value.position.z);
  node.rotation.copyFromFloats(value.rotation.x, value.rotation.y, value.rotation.z);
  node.scaling.copyFromFloats(value.scale.x, value.scale.y, value.scale.z);
  node.computeWorldMatrix(true);
}

function offsetToPlacement(offset: ProjectVfxOffsetConfig): { position: Vector3Value; rotation: Vector3Value; scale: number | Vector3Value } {
  const value = normalizeOffset(offset);
  return { position: value.position, rotation: value.rotation, scale: sameVector(value.scale) ? value.scale.x : value.scale };
}

function createRowShell(doc: Document, definition: VfxDebugParameterDefinition): HTMLElement {
  const row = doc.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:102px minmax(0,1fr);align-items:center;gap:8px;color:#dbeafe;font-size:12px;';
  const label = doc.createElement('span');
  label.textContent = definition.label ?? definition.key;
  label.title = definition.key;
  label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  row.append(label);
  return row;
}

function createPanelFieldRow(doc: Document, labelText: string): HTMLElement {
  const row = doc.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:72px minmax(0,1fr);align-items:center;gap:8px;font-size:12px;color:#dbeafe;margin-bottom:10px;';
  const label = doc.createElement('span');
  label.textContent = labelText;
  row.append(label);
  return row;
}

function createSectionTitle(doc: Document, text: string): HTMLElement {
  const title = doc.createElement('div');
  title.textContent = text;
  title.style.cssText = 'margin:2px 0 -2px;padding-top:4px;border-top:1px solid rgba(148,163,184,.16);color:#93c5fd;font-size:11px;font-weight:800;';
  return title;
}

function createEmptyLine(doc: Document, text: string): HTMLElement {
  const line = doc.createElement('div');
  line.textContent = text;
  line.style.cssText = 'color:#94a3b8;font-size:11px;line-height:1.4;';
  return line;
}

function styleInput(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  element.style.cssText = [
    'width:100%', 'min-width:0', 'box-sizing:border-box', 'min-height:28px', 'padding:0 8px',
    'border:1px solid rgba(148,163,184,.28)', 'border-radius:6px', 'background:rgba(15,23,42,.78)',
    'color:#f8fafc', 'font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace',
  ].join(';');
}

function createDropdownControl(
  doc: Document,
  initialOptions: DropdownOption[],
  initialValue: string,
  onChange: (value: string) => void,
  getOpenDropdown: () => (() => void) | null,
  setOpenDropdown: (close: (() => void) | null) => void,
): DropdownControl {
  let options = initialOptions;
  let value = initialValue;
  let open = false;
  const root = doc.createElement('div');
  root.style.cssText = 'position:relative;width:100%;min-width:0;';
  const button = createRuntimeDebugPanelButton(doc, '');
  button.style.cssText = dropdownButtonStyle();
  const menu = doc.createElement('div');
  menu.style.cssText = dropdownMenuStyle();
  menu.style.display = 'none';
  root.append(button, menu);

  button.addEventListener('pointerdown', event => event.stopPropagation());
  button.addEventListener('click', event => {
    event.stopPropagation();
    setOpen(!open);
  });
  renderOptions();
  updateButton();

  return {
    root,
    button,
    setOptions(nextOptions) {
      options = nextOptions;
      if (!options.some(option => option.value === value)) value = options[0]?.value ?? '';
      renderOptions();
      updateButton();
    },
    setValue(nextValue) {
      value = nextValue;
      renderOptions();
      updateButton();
    },
    close() { setOpen(false); },
  };

  function setOpen(nextOpen: boolean): void {
    if (nextOpen) {
      getOpenDropdown()?.();
      setOpenDropdown(() => setOpen(false));
    } else if (open) {
      setOpenDropdown(null);
    }
    open = nextOpen;
    menu.style.display = open ? 'flex' : 'none';
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function renderOptions(): void {
    menu.replaceChildren(...options.map(option => {
      const optionButton = createRuntimeDebugPanelButton(doc, option.label);
      optionButton.style.cssText = 'width:100%;min-height:28px;height:auto;justify-content:flex-start;text-align:left;';
      optionButton.style.boxShadow = option.value === value
        ? '0 0 0 2px rgba(255,255,255,.55) inset'
        : '0 8px 20px rgba(15,23,42,.18)';
      optionButton.addEventListener('pointerdown', event => event.stopPropagation());
      optionButton.addEventListener('click', event => {
        event.stopPropagation();
        value = option.value;
        updateButton();
        renderOptions();
        setOpen(false);
        onChange(value);
      });
      return optionButton;
    }));
  }

  function updateButton(): void {
    const selected = options.find(option => option.value === value);
    button.textContent = selected?.label ?? (options.length === 0 ? '未注册特效' : value);
    button.title = button.textContent;
  }
}

function dropdownButtonStyle(): string {
  return [
    'width:100%', 'box-sizing:border-box', 'height:30px', 'border:1px solid rgba(148,163,184,.28)',
    'border-radius:6px', 'background:rgba(15,23,42,.78)', 'color:#f8fafc',
    'font:600 12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'padding:0 24px 0 8px', 'pointer-events:auto', 'position:relative', 'z-index:2', 'cursor:pointer',
    'text-align:left', 'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
  ].join(';');
}

function dropdownMenuStyle(): string {
  return [
    'position:absolute', 'left:0', 'right:0', 'top:calc(100% + 4px)', 'z-index:2147483000',
    'display:flex', 'flex-direction:column', 'gap:2px', 'box-sizing:border-box', 'max-height:180px',
    'overflow:auto', 'padding:4px', 'border:1px solid rgba(148,163,184,.34)', 'border-radius:6px',
    'background:rgba(15,23,42,.98)', 'box-shadow:0 12px 28px rgba(0,0,0,.36)', 'pointer-events:auto',
  ].join(';');
}

function readNumber(value: string | undefined): number | null {
  if (!value || value === '-' || value === '.' || value === '-.') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  return typeof value === 'boolean' ? value : ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function readColor(value: unknown): { r: number; g: number; b: number } | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const color = value as { r?: unknown; g?: unknown; b?: unknown };
    if ([color.r, color.g, color.b].every(channel => typeof channel === 'number' && Number.isFinite(channel))) {
      return { r: color.r as number, g: color.g as number, b: color.b as number };
    }
  }
  return typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value.trim()) ? hexToColor(value, { r: 1, g: 1, b: 1 }) : null;
}

function hexToColor(value: string | undefined, fallback: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!match) return { ...fallback };
  return {
    r: Number.parseInt(match[1].slice(0, 2), 16) / 255,
    g: Number.parseInt(match[1].slice(2, 4), 16) / 255,
    b: Number.parseInt(match[1].slice(4, 6), 16) / 255,
  };
}

function colorToHex(color: { r: number; g: number; b: number }): string {
  const channel = (value: number) => Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function normalizeHex(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff';
}

function readVector(values: Map<string, number>, xKey: string, yKey: string, zKey: string, fallback: number): Vector3Value {
  return { x: values.get(xKey) ?? fallback, y: values.get(yKey) ?? fallback, z: values.get(zKey) ?? fallback };
}

function toRadians(value: Vector3Value): Vector3Value {
  return { x: value.x * DEG_TO_RAD, y: value.y * DEG_TO_RAD, z: value.z * DEG_TO_RAD };
}

function sameVector(value: Vector3Value): boolean {
  return Math.abs(value.x - value.y) < 0.000001 && Math.abs(value.y - value.z) < 0.000001;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, value));
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function diffParams(params: VfxParams, defaults: Readonly<VfxParams>): VfxParams {
  return Object.fromEntries(Object.entries(params).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(defaults[key])));
}

function previewOwner(effectId: string): string { return `runtime-vfx-debug-preview:${effectId}`; }
function effectTargetKey(effectId: string): string { return `effect:${effectId}`; }
function usageTargetKey(usageId: string): string { return `usage:${usageId}`; }
function effectSavePath(effectId: string): string { return `src/assets/vfx/effects/${effectId}/vfx-params.json`; }
function usageSavePath(usageId: string): string { return `src/assets/vfx/usages.json / usages[${usageId}].params + offset`; }

class EffectAxisOverlay {
  private scene: Scene | null = null;
  private axesViewer: AxesViewer | null = null;

  update(scene: Scene, root: TransformNode | null): void {
    if (!root || root.isDisposed()) {
      this.hide();
      return;
    }
    if (this.scene !== scene) this.dispose();
    this.scene = scene;
    this.axesViewer ??= new AxesViewer(scene, 1.5);
    root.computeWorldMatrix(true);
    const matrix = root.getWorldMatrix();
    this.axesViewer.update(
      root.getAbsolutePosition(),
      Vector3.TransformNormal(Vector3.Right(), matrix).normalize(),
      Vector3.TransformNormal(Vector3.Up(), matrix).normalize(),
      Vector3.TransformNormal(Vector3.Forward(), matrix).normalize(),
    );
  }

  hide(): void {
    this.axesViewer?.dispose();
    this.axesViewer = null;
    this.scene = null;
  }

  dispose(): void { this.hide(); }
}
