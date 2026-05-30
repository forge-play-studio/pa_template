import { Camera } from '@babylonjs/core/Cameras/camera';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import {
  canHandleEditorSceneCameraDebugPanKey,
  clampEditorSceneCameraDebugNumber,
  cloneEditorSceneCameraDebugSnapshot,
  cloneEditorSceneCameraDebugTarget,
  createEditorSceneCameraDebugPanelNumberFields,
  createEditorSceneCameraDebugPanelRangeFieldEnds,
  createEditorSceneCameraDebugPanelRangeFieldPairs,
  createEditorSceneCameraDebugSnapshot,
  createEditorSceneCameraPanMovement,
  formatEditorSceneCameraDebugCoordinate,
  formatEditorSceneCameraDebugErrorMessage,
  getEditorSceneCameraDebugText,
  getEditorSceneCameraDebugTooltips,
  isEditorSceneCameraDebugPanelFieldVisible,
  isEditorSceneCameraDebugPanKey,
  readEditorSceneCameraDebugPanelInputSnapshot,
  readEditorSceneCameraDebugProjectionSelectValue,
  readEditorSceneCameraDebugSnapshotField,
  readEditorSceneCameraDebugStoredLanguage,
  readEditorSceneCameraDebugStoredOpen,
  roundEditorSceneCameraDebugNumber,
  toEditorSceneCameraRig,
  writeEditorSceneCameraDebugStoredLanguage,
  writeEditorSceneCameraDebugStoredOpen,
  type EditorSceneCameraRig,
  type EditorSceneCameraDebugNumberField,
  type EditorSceneCameraDebugLanguage,
  type EditorSceneCameraDebugPanelNumberFieldConfig,
  type EditorSceneCameraDebugText,
  type EditorSceneCameraDebugTooltipText,
  type EditorSceneCameraDebugSnapshot as PlayableEditorSceneCameraDebugSnapshot,
} from '@fps-games/editor/playable-sdk';
import type { Game } from '../core/Game';
import type { SceneCameraRigConfig } from '../config';
import {
  saveRuntimeCameraRigToEditorScene,
  type RuntimeCameraEditorBinding,
} from './runtime-camera-rig-save';

export interface CameraDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export interface CameraDebugPanel {
  dispose(): void;
}

type CameraDebugLanguage = EditorSceneCameraDebugLanguage;

type CameraNumberField = EditorSceneCameraDebugNumberField;
type CameraDebugText = EditorSceneCameraDebugText;
type CameraDebugTooltipText = EditorSceneCameraDebugTooltipText;

type CameraDebugSnapshot = PlayableEditorSceneCameraDebugSnapshot & {
  binding: RuntimeCameraEditorBinding;
};

const CAMERA_DEBUG_STORAGE_KEY = 'pa-template.camera-debug.open';
const CAMERA_DEBUG_LANGUAGE_STORAGE_KEY = 'pa-template.camera-debug.language';
type CameraNumberFieldConfig = EditorSceneCameraDebugPanelNumberFieldConfig;

const CAMERA_NUMBER_FIELDS = createEditorSceneCameraDebugPanelNumberFields();
const CAMERA_DEBUG_RANGE_FIELD_PAIRS = createEditorSceneCameraDebugPanelRangeFieldPairs();
const CAMERA_DEBUG_RANGE_FIELD_ENDS = createEditorSceneCameraDebugPanelRangeFieldEnds();
const CAMERA_DEBUG_TOOLTIP_DELAY_MS = 140;
const CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET = 0.32;
const CAMERA_DEBUG_TARGET_MARKER_ARM_LENGTH = 0.16;
const CAMERA_DEBUG_TARGET_MARKER_ARM_GAP = 0.02;
const CAMERA_DEBUG_TARGET_MARKER_ARM_HEIGHT = 0.2;
const CAMERA_DEBUG_TARGET_LABEL_MIN_GAP_PX = 8;
const CAMERA_DEBUG_TARGET_LABEL_MAX_GAP_PX = 20;

export function mountCameraDebugPanel(options: CameraDebugPanelOptions): CameraDebugPanel {
  const root = options.root ?? document.body;
  const ownerDocument = root.ownerDocument;
  let open = readEditorSceneCameraDebugStoredOpen(ownerDocument.defaultView, CAMERA_DEBUG_STORAGE_KEY);
  let language = readEditorSceneCameraDebugStoredLanguage(ownerDocument.defaultView, CAMERA_DEBUG_LANGUAGE_STORAGE_KEY);
  let disposed = false;
  let saving = false;
  let initialSnapshot: CameraDebugSnapshot | null = null;
  let latestSnapshot: CameraDebugSnapshot | null = null;
  let cameraPanRestoreTarget: CameraDebugSnapshot['target'] | null = null;
  let targetMarker: TransformNode | null = null;
  let targetCoordinateLabel: HTMLDivElement | null = null;
  let targetCoordinate: CameraDebugSnapshot['target'] | null = null;
  let frameHandle = 0;
  let lastFrameTime = 0;
  let statusTimeout = 0;
  const pressedPanKeys = new Set<string>();

  const container = ownerDocument.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:2147482600',
    'display:none',
    'flex-direction:column',
    'align-items:flex-end',
    'font-family:system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'color:#edf2ff',
    'pointer-events:none',
  ].join(';');

  const toggleButton = ownerDocument.createElement('button');
  toggleButton.type = 'button';
  toggleButton.textContent = 'Camera';
  toggleButton.style.cssText = [
    'pointer-events:auto',
    'height:34px',
    'padding:0 12px',
    'border:1px solid rgba(148, 163, 184, 0.36)',
    'border-radius:7px',
    'background:rgba(15, 23, 42, 0.88)',
    'color:#f8fafc',
    'font:600 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'box-shadow:0 10px 26px rgba(0,0,0,0.28)',
    'cursor:pointer',
  ].join(';');

  const panel = ownerDocument.createElement('section');
  panel.style.cssText = [
    'pointer-events:auto',
    'width:320px',
    'max-height:min(70vh, 720px)',
    'overflow:auto',
    'box-sizing:border-box',
    'margin-bottom:8px',
    'padding:12px',
    'border:1px solid rgba(148, 163, 184, 0.28)',
    'border-radius:8px',
    'background:rgba(13, 18, 28, 0.94)',
    'box-shadow:0 18px 44px rgba(0,0,0,0.34)',
    'backdrop-filter:blur(8px)',
    'display:none',
  ].join(';');

  const titleRow = ownerDocument.createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;';

  const title = ownerDocument.createElement('div');
  title.style.cssText = 'font-size:13px;font-weight:700;line-height:1.2;';

  const headerActions = ownerDocument.createElement('div');
  headerActions.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const modeLabel = ownerDocument.createElement('div');
  modeLabel.style.cssText = 'font-size:11px;color:#93c5fd;line-height:1.2;';

  const languageButton = ownerDocument.createElement('button');
  languageButton.type = 'button';
  languageButton.style.cssText = [
    'height:24px',
    'padding:0 8px',
    'border:1px solid rgba(148, 163, 184, 0.3)',
    'border-radius:6px',
    'background:rgba(30, 41, 59, 0.8)',
    'color:#dbeafe',
    'font:700 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'cursor:pointer',
  ].join(';');

  headerActions.append(modeLabel, languageButton);
  titleRow.append(title, headerActions);

  const grid = ownerDocument.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 108px;gap:7px 8px;align-items:center;';

  const projectionLabel = ownerDocument.createElement('label');
  projectionLabel.style.cssText = 'font-size:11px;color:#cbd5e1;';
  const projectionSelect = ownerDocument.createElement('select');
  projectionSelect.style.cssText = [
    'width:108px',
    'height:26px',
    'border:1px solid rgba(148, 163, 184, 0.34)',
    'border-radius:6px',
    'background:rgba(15, 23, 42, 0.84)',
    'color:#f8fafc',
    'padding:0 6px',
    'font:700 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  ].join(';');
  projectionSelect.addEventListener('change', () => applyInputSnapshot());
  grid.append(projectionLabel, projectionSelect);

  const fields = new Map<CameraNumberField, HTMLInputElement>();
  const fieldRows = new Map<CameraNumberField, { label: HTMLLabelElement; input: HTMLInputElement; config: CameraNumberFieldConfig }>();
  const rangeRows: Array<{
    label: HTMLLabelElement;
    wrapper: HTMLDivElement;
    labelKey: keyof CameraDebugText;
    tooltipKey: keyof CameraDebugTooltipText;
    lowerConfig: CameraNumberFieldConfig;
    upperConfig: CameraNumberFieldConfig;
    lowerInput: HTMLInputElement;
    upperInput: HTMLInputElement;
  }> = [];

  for (const config of CAMERA_NUMBER_FIELDS) {
    if (CAMERA_DEBUG_RANGE_FIELD_ENDS.has(config.field)) continue;
    const rangePair = CAMERA_DEBUG_RANGE_FIELD_PAIRS.find(pair => pair.lower === config.field);
    if (rangePair) {
      const upperConfig = CAMERA_NUMBER_FIELDS.find(candidate => candidate.field === rangePair.upper);
      if (!upperConfig) continue;
      const labelEl = ownerDocument.createElement('label');
      labelEl.style.cssText = 'font-size:11px;color:#cbd5e1;';
      const wrapper = ownerDocument.createElement('div');
      wrapper.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;width:108px;';
      const lowerInput = createCameraNumberInput(config, { compact: true });
      const upperInput = createCameraNumberInput(upperConfig, { compact: true });
      fields.set(config.field, lowerInput);
      fields.set(upperConfig.field, upperInput);
      rangeRows.push({
        label: labelEl,
        wrapper,
        labelKey: rangePair.labelKey,
        tooltipKey: rangePair.tooltipKey,
        lowerConfig: config,
        upperConfig,
        lowerInput,
        upperInput,
      });
      wrapper.append(lowerInput, upperInput);
      grid.append(labelEl, wrapper);
      continue;
    }

    const labelEl = ownerDocument.createElement('label');
    labelEl.style.cssText = 'font-size:11px;color:#cbd5e1;';

    const input = createCameraNumberInput(config);
    fields.set(config.field, input);
    fieldRows.set(config.field, { label: labelEl, input, config });
    grid.append(labelEl, input);
  }

  const panHint = ownerDocument.createElement('div');
  panHint.style.cssText = [
    'margin-top:10px',
    'font-size:11px',
    'line-height:1.35',
    'color:#9fb2d0',
  ].join(';');

  const actions = ownerDocument.createElement('div');
  actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;';
  const resetButton = createPanelButton(ownerDocument);
  const saveButton = createPanelButton(ownerDocument);
  actions.append(resetButton, saveButton);

  const status = ownerDocument.createElement('div');
  status.style.cssText = 'min-height:16px;margin-top:8px;font-size:11px;color:#94a3b8;';

  panel.append(titleRow, grid, panHint, actions, status);
  container.append(panel, toggleButton);
  root.append(container);

  const debugTooltip = ownerDocument.createElement('div');
  debugTooltip.style.cssText = [
    'position:fixed',
    'z-index:2147483601',
    'display:none',
    'max-width:min(280px, calc(100vw - 16px))',
    'box-sizing:border-box',
    'padding:5px 7px',
    'border:1px solid rgba(148, 163, 184, 0.32)',
    'border-radius:5px',
    'background:rgba(15, 23, 42, 0.94)',
    'box-shadow:0 10px 26px rgba(0, 0, 0, 0.3)',
    'color:#dbeafe',
    'font:700 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'line-height:1.35',
    'white-space:normal',
    'pointer-events:none',
  ].join(';');
  root.append(debugTooltip);
  let debugTooltipTarget: HTMLElement | null = null;
  let debugTooltipTimer = 0;

  toggleButton.addEventListener('click', () => {
    open = !open;
    writeEditorSceneCameraDebugStoredOpen(ownerDocument.defaultView, CAMERA_DEBUG_STORAGE_KEY, open);
    renderOpenState();
  });
  container.addEventListener('pointerover', handleDebugTooltipPointerOver);
  container.addEventListener('pointerout', handleDebugTooltipPointerOut);
  container.addEventListener('focusin', handleDebugTooltipFocusIn);
  container.addEventListener('focusout', hideDebugTooltip);
  container.addEventListener('click', hideDebugTooltip);
  languageButton.addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    writeEditorSceneCameraDebugStoredLanguage(ownerDocument.defaultView, CAMERA_DEBUG_LANGUAGE_STORAGE_KEY, language);
    renderLanguage();
    syncVisibleFields(latestSnapshot?.projection ?? readProjectionSelectValue());
  });
  resetButton.addEventListener('click', () => {
    if (!initialSnapshot || saving) return;
    setInputs(initialSnapshot);
    applySnapshot(initialSnapshot, { restoreTarget: true });
    cameraPanRestoreTarget = cloneEditorSceneCameraDebugTarget(initialSnapshot.target);
    updateTargetMarker(initialSnapshot.target);
    showStatus(text().resetStatus);
  });
  saveButton.addEventListener('click', () => {
    const snapshot = latestSnapshot ?? readSnapshot(options.getGame());
    if (!snapshot || saving) return;
    saving = true;
    syncPanel(snapshot);
    showStatus(text().savingStatus, { sticky: true });
    void saveRuntimeCameraRigToEditorScene(snapshot.binding, toCameraRig(snapshot))
      .then(() => {
        showStatus(text().savedStatus, { sticky: true });
        ownerDocument.defaultView?.location.reload();
      })
      .catch((error) => {
        console.error('[CameraDebugPanel] Save rig failed', error);
        saving = false;
        showStatus(formatEditorSceneCameraDebugErrorMessage(error, text().saveFailed), { sticky: true, tone: 'error' });
        syncPanel(latestSnapshot);
      });
  });
  ownerDocument.defaultView?.addEventListener('keydown', handlePanKeyDown, { capture: true });
  ownerDocument.defaultView?.addEventListener('keyup', handlePanKeyUp, { capture: true });
  ownerDocument.defaultView?.addEventListener('blur', clearPanKeys);

  function tick(time: number): void {
    if (disposed) return;
    const deltaSeconds = lastFrameTime > 0
      ? Math.min(0.05, Math.max(0, (time - lastFrameTime) / 1000))
      : 0;
    lastFrameTime = time;
    const snapshot = readSnapshot(options.getGame());
    if (!snapshot) {
      initialSnapshot = null;
      latestSnapshot = null;
    } else {
      if (!initialSnapshot) initialSnapshot = cloneEditorSceneCameraDebugSnapshot(snapshot) as CameraDebugSnapshot;
      latestSnapshot = cloneEditorSceneCameraDebugSnapshot(snapshot) as CameraDebugSnapshot;
    }
    syncPanel(snapshot);
    applyCameraPan(deltaSeconds);
    updateTargetCoordinateLabel();
    frameHandle = ownerDocument.defaultView?.requestAnimationFrame(tick) ?? window.requestAnimationFrame(tick);
  }

  function syncPanel(snapshot: CameraDebugSnapshot | null): void {
    container.style.display = snapshot ? 'flex' : 'none';
    if (!snapshot) {
      hideDebugTooltip();
      stopCameraPanMode();
      return;
    }
    if (open) startCameraPanMode(snapshot);
    else stopCameraPanMode();
    for (const input of fields.values()) input.disabled = saving;
    projectionSelect.disabled = saving;
    resetButton.disabled = !initialSnapshot || saving;
    saveButton.disabled = saving;
    syncVisibleFields(snapshot.projection);
    if (isPanelInputActive()) return;
    setInputs(snapshot);
  }

  function applyInputSnapshot(): void {
    if (saving) return;
    const current = latestSnapshot ?? readSnapshot(options.getGame());
    if (!current) return;
    const next = readInputs(current);
    syncVisibleFields(next.projection);
    applySnapshot(next);
    syncInputsExceptActive(next);
  }

  function applySnapshot(snapshot: CameraDebugSnapshot, applyOptions: { restoreTarget?: boolean } = {}): void {
    const game = options.getGame();
    const camera = game?.getCamera();
    const sceneBuilder = game?.getSceneBuilder();
    if (!camera || !sceneBuilder) return;
    sceneBuilder.applyCameraRig(
      camera,
      toCameraRig(snapshot),
      applyOptions.restoreTarget ? new Vector3(snapshot.target.x, snapshot.target.y, snapshot.target.z) : undefined,
    );
    latestSnapshot = cloneEditorSceneCameraDebugSnapshot(snapshot) as CameraDebugSnapshot;
    if (applyOptions.restoreTarget) updateTargetMarker(snapshot.target);
  }

  function setInputs(snapshot: CameraDebugSnapshot): void {
    projectionSelect.value = snapshot.projection;
    for (const config of CAMERA_NUMBER_FIELDS) {
      setInputValue(config.field, readEditorSceneCameraDebugSnapshotField(snapshot, config.field));
    }
  }

  function setInputValue(field: CameraNumberField, value: number | undefined): void {
    const input = fields.get(field);
    if (!input) return;
    input.value = value == null ? '' : String(roundEditorSceneCameraDebugNumber(value));
  }

  function syncInputsExceptActive(snapshot: CameraDebugSnapshot): void {
    const active = ownerDocument.activeElement;
    if (active !== projectionSelect) projectionSelect.value = snapshot.projection;
    for (const config of CAMERA_NUMBER_FIELDS) {
      const input = fields.get(config.field);
      if (!input || active === input) continue;
      setInputValue(config.field, readEditorSceneCameraDebugSnapshotField(snapshot, config.field));
    }
  }

  function readInputs(fallback: CameraDebugSnapshot): CameraDebugSnapshot {
    const values: Record<string, string> = {
      projection: projectionSelect.value,
    };
    for (const [field, input] of fields) {
      values[field] = input.value;
    }
    return readEditorSceneCameraDebugPanelInputSnapshot(fallback, values, {
      activeField: readActiveNumberField(),
    }) as CameraDebugSnapshot;
  }

  function readActiveNumberField(): CameraNumberField | null {
    const active = ownerDocument.activeElement;
    for (const [field, input] of fields) {
      if (active === input) return field;
    }
    return null;
  }

  function readProjectionSelectValue(): CameraDebugSnapshot['projection'] {
    return readEditorSceneCameraDebugProjectionSelectValue(projectionSelect.value);
  }

  function createCameraNumberInput(
    config: CameraNumberFieldConfig,
    options: { compact?: boolean } = {},
  ): HTMLInputElement {
    const input = ownerDocument.createElement('input');
    input.type = 'number';
    input.step = String(config.step);
    if (config.min != null) input.min = String(config.min);
    if (config.max != null) input.max = String(config.max);
    input.inputMode = 'decimal';
    input.style.cssText = [
      `width:${options.compact ? '100%' : '108px'}`,
      'height:26px',
      'min-width:0',
      'box-sizing:border-box',
      'border:1px solid rgba(148, 163, 184, 0.34)',
      'border-radius:6px',
      'background:rgba(15, 23, 42, 0.84)',
      'color:#f8fafc',
      'padding:0 6px',
      'font:12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    ].join(';');
    input.addEventListener('input', () => applyInputSnapshot());
    return input;
  }

  function syncVisibleFields(projection: CameraDebugSnapshot['projection']): void {
    for (const { label, input, config } of fieldRows.values()) {
      const visible = isEditorSceneCameraDebugPanelFieldVisible(config, projection);
      label.style.display = visible ? '' : 'none';
      input.style.display = visible ? '' : 'none';
    }
    for (const { label, wrapper, lowerConfig, upperConfig } of rangeRows) {
      const visible = [lowerConfig, upperConfig].every(config => isEditorSceneCameraDebugPanelFieldVisible(config, projection));
      label.style.display = visible ? '' : 'none';
      wrapper.style.display = visible ? 'grid' : 'none';
    }
  }

  function renderOpenState(): void {
    panel.style.display = open ? 'block' : 'none';
    toggleButton.style.background = open ? 'rgba(29, 78, 216, 0.9)' : 'rgba(15, 23, 42, 0.88)';
    const snapshot = latestSnapshot ?? readSnapshot(options.getGame());
    if (open && snapshot) startCameraPanMode(snapshot);
    if (!open) {
      hideDebugTooltip();
      stopCameraPanMode();
    }
  }

  function renderLanguage(): void {
    const copy = text();
    const hints = tooltips();
    const currentProjection = readProjectionSelectValue();
    title.textContent = copy.title;
    modeLabel.textContent = copy.runtime;
    languageButton.textContent = copy.languageButton;
    setDebugTooltip(languageButton, hints.languageButton);
    setDebugTooltip(toggleButton, hints.toggleTitle);
    toggleButton.setAttribute('aria-label', hints.toggleTitle);
    projectionLabel.textContent = copy.projection;
    setDebugTooltip(projectionLabel, hints.projection);
    setDebugTooltip(projectionSelect, hints.projection);
    projectionSelect.innerHTML = '';
    for (const option of [
      { label: copy.orthographic, value: 'orthographic' },
      { label: copy.perspective, value: 'perspective' },
    ] as const) {
      const optionEl = ownerDocument.createElement('option');
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      projectionSelect.append(optionEl);
    }
    projectionSelect.value = latestSnapshot?.projection ?? currentProjection;
    for (const { label, input, config } of fieldRows.values()) {
      const hint = hints[config.textKey as keyof CameraDebugTooltipText];
      label.textContent = copy[config.textKey];
      setDebugTooltip(label, hint ?? '');
      setDebugTooltip(input, hint ?? '');
    }
    for (const row of rangeRows) {
      const rangeHint = hints[row.tooltipKey];
      const lowerHint = hints[row.lowerConfig.textKey as keyof CameraDebugTooltipText];
      const upperHint = hints[row.upperConfig.textKey as keyof CameraDebugTooltipText];
      row.label.textContent = copy[row.labelKey];
      row.lowerInput.placeholder = copy[row.lowerConfig.textKey];
      row.upperInput.placeholder = copy[row.upperConfig.textKey];
      setDebugTooltip(row.label, rangeHint);
      setDebugTooltip(row.wrapper, rangeHint);
      setDebugTooltip(row.lowerInput, lowerHint ?? rangeHint);
      setDebugTooltip(row.upperInput, upperHint ?? rangeHint);
    }
    panHint.textContent = copy.panHint;
    setDebugTooltip(panHint, hints.panHint);
    resetButton.textContent = copy.reset;
    setDebugTooltip(resetButton, hints.reset);
    saveButton.textContent = copy.save;
    setDebugTooltip(saveButton, hints.save);
    updateTargetCoordinateLabel();
  }

  function startCameraPanMode(snapshot: CameraDebugSnapshot): void {
    if (!cameraPanRestoreTarget) cameraPanRestoreTarget = cloneEditorSceneCameraDebugTarget(snapshot.target);
    updateTargetMarker(snapshot.target);
  }

  function stopCameraPanMode(): void {
    clearPanKeys();
    const restoreTarget = cameraPanRestoreTarget;
    cameraPanRestoreTarget = null;
    disposeTargetMarker();
    if (!restoreTarget) return;
    const game = options.getGame();
    const camera = game?.getCamera();
    const sceneBuilder = game?.getSceneBuilder();
    if (!camera || !sceneBuilder) return;
    sceneBuilder.applyCameraRig(
      camera,
      sceneBuilder.getSelectedCameraRig(),
      new Vector3(restoreTarget.x, restoreTarget.y, restoreTarget.z),
    );
    const snapshot = readSnapshot(game);
    latestSnapshot = snapshot ? cloneEditorSceneCameraDebugSnapshot(snapshot) as CameraDebugSnapshot : null;
  }

  function handlePanKeyDown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (!canHandlePanKey(event, key)) return;
    pressedPanKeys.add(key);
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handlePanKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    if (!isEditorSceneCameraDebugPanKey(key)) return;
    pressedPanKeys.delete(key);
    if (!isCameraPanModeActive() || isEditableElement(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function canHandlePanKey(event: KeyboardEvent, key: string): boolean {
    return canHandleEditorSceneCameraDebugPanKey({
      key,
      active: isCameraPanModeActive(),
      saving,
      editable: isEditableElement(event.target),
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
    });
  }

  function isCameraPanModeActive(): boolean {
    return open && !!cameraPanRestoreTarget && !saving;
  }

  function clearPanKeys(): void {
    pressedPanKeys.clear();
  }

  function applyCameraPan(deltaSeconds: number): void {
    if (!isCameraPanModeActive() || deltaSeconds <= 0 || pressedPanKeys.size === 0) return;
    const game = options.getGame();
    const camera = game?.getCamera();
    const sceneBuilder = game?.getSceneBuilder();
    if (!camera || !sceneBuilder) return;

    const cameraRig = sceneBuilder.getSelectedCameraRig();
    const movement = createEditorSceneCameraPanMovement({
      pressedKeys: pressedPanKeys,
      cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      cameraTarget: { x: camera.target.x, y: camera.target.y, z: camera.target.z },
      projection: cameraRig.projection === 'perspective' ? 'perspective' : 'orthographic',
      radius: cameraRig.radius ?? 1,
      orthoSize: cameraRig.orthoSize ?? 10,
      deltaSeconds,
    });
    if (!movement) return;
    const nextTarget = camera.target.add(new Vector3(movement.x, movement.y, movement.z));
    sceneBuilder.applyCameraRig(camera, cameraRig, nextTarget);
    updateTargetMarker({ x: nextTarget.x, y: nextTarget.y, z: nextTarget.z });

    const snapshot = readSnapshot(game);
    latestSnapshot = snapshot ? cloneEditorSceneCameraDebugSnapshot(snapshot) as CameraDebugSnapshot : null;
  }

  function updateTargetMarker(target: CameraDebugSnapshot['target']): void {
    const game = options.getGame();
    const scene = game?.getScene();
    if (!scene || !open) return;
    if (!targetMarker) targetMarker = createTargetMarker();
    targetMarker.position.set(target.x, target.y, target.z);
    targetCoordinate = cloneEditorSceneCameraDebugTarget(target);
    updateTargetCoordinateLabel(target);
  }

  function createTargetMarker(): TransformNode {
    const game = options.getGame();
    const scene = game?.getScene();
    if (!scene) throw new Error('Camera debug target marker requires an active scene.');

    const rootNode = new TransformNode('cameraDebugTargetMarker', scene);
    rootNode.metadata = {
      ...(rootNode.metadata && typeof rootNode.metadata === 'object' ? rootNode.metadata : {}),
      disablePlanarShadow: true,
    };
    const material = new StandardMaterial('cameraDebugTargetMarker.material', scene);
    material.diffuseColor = new Color3(1, 0.04, 0.03);
    material.emissiveColor = new Color3(1, 0.04, 0.03);
    material.specularColor = new Color3(0.35, 0.02, 0.02);
    material.disableLighting = true;

    const armDiameter = 0.048;
    const createArm = (name: string, position: Vector3, rotation: Vector3, height = CAMERA_DEBUG_TARGET_MARKER_ARM_LENGTH): void => {
      const arm = MeshBuilder.CreateCylinder(name, {
        height,
        diameter: armDiameter,
        tessellation: 8,
      }, scene);
      arm.parent = rootNode;
      arm.position.copyFrom(position);
      arm.rotation.copyFrom(rotation);
      arm.material = material;
      arm.isPickable = false;
      arm.renderingGroupId = 2;
      arm.metadata = {
        ...(arm.metadata && typeof arm.metadata === 'object' ? arm.metadata : {}),
        disablePlanarShadow: true,
      };
    };

    const centerDistance = CAMERA_DEBUG_TARGET_MARKER_ARM_GAP + CAMERA_DEBUG_TARGET_MARKER_ARM_LENGTH / 2;
    createArm('cameraDebugTargetMarker.arm.x.positive', new Vector3(centerDistance, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, 0), new Vector3(0, 0, Math.PI / 2));
    createArm('cameraDebugTargetMarker.arm.x.negative', new Vector3(-centerDistance, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, 0), new Vector3(0, 0, Math.PI / 2));
    createArm('cameraDebugTargetMarker.arm.z.positive', new Vector3(0, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, centerDistance), new Vector3(Math.PI / 2, 0, 0));
    createArm('cameraDebugTargetMarker.arm.z.negative', new Vector3(0, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, -centerDistance), new Vector3(Math.PI / 2, 0, 0));
    createArm('cameraDebugTargetMarker.arm.y', new Vector3(0, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, 0), new Vector3(0, 0, 0), CAMERA_DEBUG_TARGET_MARKER_ARM_HEIGHT);

    return rootNode;
  }

  function disposeTargetMarker(): void {
    targetMarker?.dispose();
    targetMarker = null;
    targetCoordinate = null;
    disposeTargetCoordinateLabel();
  }

  function ensureTargetCoordinateLabel(): HTMLDivElement {
    if (targetCoordinateLabel) return targetCoordinateLabel;
    const label = ownerDocument.createElement('div');
    label.style.cssText = [
      'position:fixed',
      'z-index:2147482599',
      'display:none',
      'box-sizing:border-box',
      'max-width:min(280px, calc(100vw - 24px))',
      'padding:3px 6px',
      'border:1px solid rgba(248, 113, 113, 0.55)',
      'border-radius:5px',
      'background:rgba(15, 23, 42, 0.86)',
      'box-shadow:0 8px 22px rgba(0, 0, 0, 0.28)',
      'color:#fecaca',
      'font:700 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      'line-height:1.25',
      'letter-spacing:0',
      'white-space:nowrap',
      'pointer-events:none',
      'transform:translate(-50%, -100%)',
    ].join(';');
    root.append(label);
    targetCoordinateLabel = label;
    return label;
  }

  function updateTargetCoordinateLabel(target = targetCoordinate): void {
    if (!open || !target) {
      hideTargetCoordinateLabel();
      return;
    }
    const labelAnchor = projectTargetLabelAnchorToScreen(target);
    if (!labelAnchor) {
      hideTargetCoordinateLabel();
      return;
    }
    const label = ensureTargetCoordinateLabel();
    label.textContent = formatTargetCoordinateLabel(target);
    label.style.left = `${labelAnchor.x}px`;
    label.style.top = `${labelAnchor.y}px`;
    label.style.display = '';
  }

  function hideTargetCoordinateLabel(): void {
    if (targetCoordinateLabel) targetCoordinateLabel.style.display = 'none';
  }

  function disposeTargetCoordinateLabel(): void {
    targetCoordinateLabel?.remove();
    targetCoordinateLabel = null;
  }

  function projectTargetToScreen(target: CameraDebugSnapshot['target']): { x: number; y: number; depth: number } | null {
    const game = options.getGame();
    const scene = game?.getScene();
    const camera = game?.getCamera() ?? scene?.activeCamera ?? null;
    const engine = scene?.getEngine?.();
    const canvas = engine?.getRenderingCanvas?.() as HTMLCanvasElement | null | undefined;
    const viewport = camera?.viewport?.toGlobal?.(
      engine?.getRenderWidth?.() ?? canvas?.width ?? 0,
      engine?.getRenderHeight?.() ?? canvas?.height ?? 0,
    );
    if (!scene || !camera || !canvas || !viewport) return null;

    const rect = canvas.getBoundingClientRect();
    const renderWidth = Math.max(1, Number(engine?.getRenderWidth?.() ?? canvas.width ?? rect.width));
    const renderHeight = Math.max(1, Number(engine?.getRenderHeight?.() ?? canvas.height ?? rect.height));
    const transformMatrix = camera.getViewMatrix(true).multiply(camera.getProjectionMatrix(true));
    const projected = Vector3.Project(
      new Vector3(target.x, target.y, target.z),
      Matrix.Identity(),
      transformMatrix,
      viewport,
    );
    const x = rect.left + Number(projected?.x) * (rect.width / renderWidth);
    const y = rect.top + Number(projected?.y) * (rect.height / renderHeight);
    const depth = Number(projected?.z);
    return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(depth) ? { x, y, depth } : null;
  }

  function projectTargetLabelAnchorToScreen(target: CameraDebugSnapshot['target']): { x: number; y: number } | null {
    const targetScreen = projectTargetToScreen(target);
    if (!targetScreen || targetScreen.depth < 0 || targetScreen.depth > 1) return null;
    const markerScreens = getTargetMarkerWorldPoints(target)
      .map(point => projectTargetToScreen(point))
      .filter((point): point is { x: number; y: number; depth: number } => !!point && point.depth >= 0 && point.depth <= 1);
    if (markerScreens.length === 0) return {
      x: targetScreen.x,
      y: targetScreen.y - CAMERA_DEBUG_TARGET_LABEL_MIN_GAP_PX,
    };

    const minX = Math.min(...markerScreens.map(point => point.x));
    const maxX = Math.max(...markerScreens.map(point => point.x));
    const minY = Math.min(...markerScreens.map(point => point.y));
    const maxY = Math.max(...markerScreens.map(point => point.y));
    const markerHeight = Math.max(0, maxY - minY);
    const gap = clampEditorSceneCameraDebugNumber(markerHeight * 0.25, CAMERA_DEBUG_TARGET_LABEL_MIN_GAP_PX, CAMERA_DEBUG_TARGET_LABEL_MAX_GAP_PX);
    return {
      x: (minX + maxX) / 2,
      y: minY - gap,
    };
  }

  function getTargetMarkerWorldPoints(target: CameraDebugSnapshot['target']): CameraDebugSnapshot['target'][] {
    const armExtent = CAMERA_DEBUG_TARGET_MARKER_ARM_GAP + CAMERA_DEBUG_TARGET_MARKER_ARM_LENGTH;
    const centerY = target.y + CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET;
    const halfHeight = CAMERA_DEBUG_TARGET_MARKER_ARM_HEIGHT / 2;
    return [
      { x: target.x, y: target.y, z: target.z },
      { x: target.x - armExtent, y: centerY, z: target.z },
      { x: target.x + armExtent, y: centerY, z: target.z },
      { x: target.x, y: centerY, z: target.z - armExtent },
      { x: target.x, y: centerY, z: target.z + armExtent },
      { x: target.x, y: centerY - halfHeight, z: target.z },
      { x: target.x, y: centerY + halfHeight, z: target.z },
    ];
  }

  function formatTargetCoordinateLabel(target: CameraDebugSnapshot['target']): string {
    const copy = text();
    return `${copy.worldPosition}  X ${formatEditorSceneCameraDebugCoordinate(target.x)}  Y ${formatEditorSceneCameraDebugCoordinate(target.y)}  Z ${formatEditorSceneCameraDebugCoordinate(target.z)}`;
  }

  function setDebugTooltip(element: HTMLElement, message: string): void {
    const value = message.trim();
    if (!value) {
      delete element.dataset.cameraDebugTooltip;
      element.removeAttribute('title');
      return;
    }
    element.dataset.cameraDebugTooltip = value;
    element.removeAttribute('title');
  }

  function handleDebugTooltipPointerOver(event: PointerEvent): void {
    const target = findDebugTooltipTarget(event.target);
    if (!target || target === debugTooltipTarget) return;
    scheduleDebugTooltip(target);
  }

  function handleDebugTooltipPointerOut(event: PointerEvent): void {
    if (!debugTooltipTarget) return;
    const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (related && debugTooltipTarget.contains(related)) return;
    hideDebugTooltip();
  }

  function handleDebugTooltipFocusIn(event: FocusEvent): void {
    const target = findDebugTooltipTarget(event.target);
    if (target) scheduleDebugTooltip(target);
  }

  function findDebugTooltipTarget(value: EventTarget | null): HTMLElement | null {
    return value instanceof HTMLElement ? value.closest<HTMLElement>('[data-camera-debug-tooltip]') : null;
  }

  function scheduleDebugTooltip(target: HTMLElement): void {
    const message = target.dataset.cameraDebugTooltip?.trim();
    if (!message) {
      hideDebugTooltip();
      return;
    }
    clearDebugTooltipTimer();
    debugTooltipTarget = target;
    debugTooltipTimer = ownerDocument.defaultView?.setTimeout(() => {
      debugTooltipTimer = 0;
      if (debugTooltipTarget !== target) return;
      showDebugTooltip(target, message);
    }, CAMERA_DEBUG_TOOLTIP_DELAY_MS) ?? 0;
  }

  function showDebugTooltip(target: HTMLElement, message: string): void {
    debugTooltip.textContent = message;
    debugTooltip.style.display = '';
    debugTooltip.style.left = '0px';
    debugTooltip.style.top = '0px';
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = debugTooltip.getBoundingClientRect();
    const viewportWidth = ownerDocument.defaultView?.innerWidth ?? ownerDocument.documentElement.clientWidth;
    const viewportHeight = ownerDocument.defaultView?.innerHeight ?? ownerDocument.documentElement.clientHeight;
    const left = Math.max(8, Math.min(
      targetRect.left + (targetRect.width - tooltipRect.width) / 2,
      viewportWidth - tooltipRect.width - 8,
    ));
    const belowTop = targetRect.bottom + 7;
    const aboveTop = targetRect.top - tooltipRect.height - 7;
    const top = belowTop + tooltipRect.height <= viewportHeight - 8 ? belowTop : Math.max(8, aboveTop);
    debugTooltip.style.left = `${left}px`;
    debugTooltip.style.top = `${top}px`;
  }

  function hideDebugTooltip(): void {
    clearDebugTooltipTimer();
    debugTooltipTarget = null;
    debugTooltip.style.display = 'none';
    debugTooltip.textContent = '';
  }

  function clearDebugTooltipTimer(): void {
    if (!debugTooltipTimer) return;
    ownerDocument.defaultView?.clearTimeout(debugTooltipTimer);
    debugTooltipTimer = 0;
  }

  function showStatus(
    message: string,
    options: { sticky?: boolean; tone?: 'default' | 'error' } = {},
  ): void {
    status.textContent = message;
    status.style.color = options.tone === 'error' ? '#fca5a5' : '#94a3b8';
    if (statusTimeout) ownerDocument.defaultView?.clearTimeout(statusTimeout);
    statusTimeout = 0;
    if (options.sticky) return;
    statusTimeout = ownerDocument.defaultView?.setTimeout(() => {
      if (status.textContent === message) status.textContent = '';
      statusTimeout = 0;
    }, 1800) ?? 0;
  }

  function isPanelInputActive(): boolean {
    return ownerDocument.activeElement === projectionSelect
      || ownerDocument.activeElement === languageButton
      || [...fields.values()].includes(ownerDocument.activeElement as HTMLInputElement);
  }

  function text(): CameraDebugText {
    return getEditorSceneCameraDebugText(language);
  }

  function tooltips(): CameraDebugTooltipText {
    return getEditorSceneCameraDebugTooltips(language);
  }

  renderLanguage();
  renderOpenState();
  frameHandle = ownerDocument.defaultView?.requestAnimationFrame(tick) ?? window.requestAnimationFrame(tick);

  return {
    dispose() {
      disposed = true;
      stopCameraPanMode();
      if (frameHandle) ownerDocument.defaultView?.cancelAnimationFrame(frameHandle);
      if (statusTimeout) ownerDocument.defaultView?.clearTimeout(statusTimeout);
      clearDebugTooltipTimer();
      ownerDocument.defaultView?.removeEventListener('keydown', handlePanKeyDown, { capture: true });
      ownerDocument.defaultView?.removeEventListener('keyup', handlePanKeyUp, { capture: true });
      ownerDocument.defaultView?.removeEventListener('blur', clearPanKeys);
      container.remove();
      debugTooltip.remove();
    },
  };
}

function createPanelButton(ownerDocument: Document): HTMLButtonElement {
  const button = ownerDocument.createElement('button');
  button.type = 'button';
  button.style.cssText = [
    'height:28px',
    'border:1px solid rgba(148, 163, 184, 0.32)',
    'border-radius:6px',
    'background:rgba(30, 41, 59, 0.86)',
    'color:#f8fafc',
    'font:600 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'cursor:pointer',
  ].join(';');
  return button;
}

function readSnapshot(game: Game | null): CameraDebugSnapshot | null {
  const camera = game?.getCamera();
  if (!camera) return null;
  const sceneBuilder = game?.getSceneBuilder();
  const snapshot = createEditorSceneCameraDebugSnapshot({
    camera,
    selectedRig: (sceneBuilder?.getSelectedCameraRig() ?? null) as EditorSceneCameraRig | null,
    perspectiveMode: Camera.PERSPECTIVE_CAMERA,
  });
  if (!snapshot) return null;
  return {
    ...snapshot,
    target: {
      x: roundEditorSceneCameraDebugNumber(snapshot.target.x),
      y: roundEditorSceneCameraDebugNumber(snapshot.target.y),
      z: roundEditorSceneCameraDebugNumber(snapshot.target.z),
    },
  } as CameraDebugSnapshot;
}

function toCameraRig(snapshot: CameraDebugSnapshot): SceneCameraRigConfig {
  return toEditorSceneCameraRig(snapshot) as unknown as SceneCameraRigConfig;
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable;
}
