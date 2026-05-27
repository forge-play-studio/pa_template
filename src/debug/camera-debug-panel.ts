import { Camera } from '@babylonjs/core/Cameras/camera';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Game } from '../core/Game';
import type { SceneCameraProjection, SceneCameraRigConfig } from '../config';
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

type CameraDebugLanguage = 'zh' | 'en';

type CameraNumberField =
  | 'alpha'
  | 'beta'
  | 'radius'
  | 'orthoSize'
  | 'fovDeg'
  | 'minZ'
  | 'maxZ'
  | 'lowerBetaLimit'
  | 'upperBetaLimit'
  | 'lowerRadiusLimit'
  | 'upperRadiusLimit'
  | 'inertia'
  | 'targetScreenOffsetX'
  | 'targetScreenOffsetY';

interface CameraDebugSnapshot extends SceneCameraRigConfig {
  projection: SceneCameraProjection;
  fov: number;
  target: { x: number; y: number; z: number };
  binding: RuntimeCameraEditorBinding;
}

type CameraDebugText = Record<
  | 'title'
  | 'runtime'
  | 'languageButton'
  | 'toggleTitle'
  | 'projection'
  | 'orthographic'
  | 'perspective'
  | 'alpha'
  | 'beta'
  | 'radius'
  | 'orthoSize'
  | 'fov'
  | 'nearClip'
  | 'farClip'
  | 'minBeta'
  | 'maxBeta'
  | 'minRadius'
  | 'maxRadius'
  | 'inertia'
  | 'screenOffsetX'
  | 'screenOffsetY'
  | 'panHint'
  | 'reset'
  | 'save'
  | 'resetStatus'
  | 'savingStatus'
  | 'savedStatus'
  | 'saveFailed',
  string
>;

const CAMERA_DEBUG_STORAGE_KEY = 'pa-template.camera-debug.open';
const CAMERA_DEBUG_LANGUAGE_STORAGE_KEY = 'pa-template.camera-debug.language';
const CAMERA_DEBUG_PAN_KEYS = new Set(['w', 'a', 's', 'd']);
const CAMERA_DEBUG_TEXT: Record<CameraDebugLanguage, CameraDebugText> = {
  zh: {
    title: '摄像机调试',
    runtime: '运行时',
    languageButton: 'EN',
    toggleTitle: '打开摄像机调试面板',
    projection: '投影模式',
    orthographic: '正交',
    perspective: '透视',
    alpha: 'Alpha',
    beta: 'Beta',
    radius: '半径',
    orthoSize: '正交尺寸',
    fov: '视野角度',
    nearClip: '近裁剪',
    farClip: '远裁剪',
    minBeta: '最小 Beta',
    maxBeta: '最大 Beta',
    minRadius: '最小半径',
    maxRadius: '最大半径',
    inertia: '惯性',
    screenOffsetX: '屏幕偏移 X',
    screenOffsetY: '屏幕偏移 Y',
    panHint: 'W/S 前进 / 后退 · A/D 左 / 右 · 十字准星 = 预览目标',
    reset: '重置',
    save: '保存 Rig',
    resetStatus: '已重置为初始运行时摄像机。',
    savingStatus: '正在保存 Rig...',
    savedStatus: '已保存 Rig，正在重新加载...',
    saveFailed: '保存失败',
  },
  en: {
    title: 'Camera Debug',
    runtime: 'Runtime',
    languageButton: '中文',
    toggleTitle: 'Toggle camera debug panel',
    projection: 'Projection',
    orthographic: 'Orthographic',
    perspective: 'Perspective',
    alpha: 'Alpha',
    beta: 'Beta',
    radius: 'Radius',
    orthoSize: 'Ortho Size',
    fov: 'FOV',
    nearClip: 'Near Clip',
    farClip: 'Far Clip',
    minBeta: 'Min Beta',
    maxBeta: 'Max Beta',
    minRadius: 'Min Radius',
    maxRadius: 'Max Radius',
    inertia: 'Inertia',
    screenOffsetX: 'Screen Offset X',
    screenOffsetY: 'Screen Offset Y',
    panHint: 'W/S Forward / Back · A/D Left / Right · crosshair = preview target',
    reset: 'Reset',
    save: 'Save Rig',
    resetStatus: 'Reset to initial runtime camera.',
    savingStatus: 'Saving rig...',
    savedStatus: 'Saved rig. Reloading...',
    saveFailed: 'Save failed',
  },
};

const CAMERA_NUMBER_FIELDS: ReadonlyArray<{
  field: CameraNumberField;
  textKey: keyof CameraDebugText;
  step: number;
  min?: number;
  max?: number;
  projection?: SceneCameraProjection;
}> = [
  { field: 'alpha', textKey: 'alpha', step: 0.01 },
  { field: 'beta', textKey: 'beta', step: 0.01 },
  { field: 'radius', textKey: 'radius', step: 0.1, min: 0.001 },
  { field: 'orthoSize', textKey: 'orthoSize', step: 0.1, min: 0.001, projection: 'orthographic' },
  { field: 'fovDeg', textKey: 'fov', step: 1, min: 1, max: 179, projection: 'perspective' },
  { field: 'minZ', textKey: 'nearClip', step: 0.1, min: 0.001 },
  { field: 'maxZ', textKey: 'farClip', step: 1, min: 0.001 },
  { field: 'lowerBetaLimit', textKey: 'minBeta', step: 0.01 },
  { field: 'upperBetaLimit', textKey: 'maxBeta', step: 0.01 },
  { field: 'lowerRadiusLimit', textKey: 'minRadius', step: 0.1, min: 0.001 },
  { field: 'upperRadiusLimit', textKey: 'maxRadius', step: 0.1, min: 0.001 },
  { field: 'inertia', textKey: 'inertia', step: 0.05, min: 0, max: 1 },
  { field: 'targetScreenOffsetX', textKey: 'screenOffsetX', step: 0.01 },
  { field: 'targetScreenOffsetY', textKey: 'screenOffsetY', step: 0.01 },
];

export function mountCameraDebugPanel(options: CameraDebugPanelOptions): CameraDebugPanel {
  const root = options.root ?? document.body;
  const ownerDocument = root.ownerDocument;
  let open = readStoredOpen(ownerDocument.defaultView);
  let language = readStoredLanguage(ownerDocument.defaultView);
  let disposed = false;
  let saving = false;
  let initialSnapshot: CameraDebugSnapshot | null = null;
  let latestSnapshot: CameraDebugSnapshot | null = null;
  let cameraPanRestoreTarget: CameraDebugSnapshot['target'] | null = null;
  let targetMarker: ReturnType<typeof MeshBuilder.CreateLineSystem> | null = null;
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
  const fieldRows = new Map<CameraNumberField, { label: HTMLLabelElement; input: HTMLInputElement; config: typeof CAMERA_NUMBER_FIELDS[number] }>();

  for (const config of CAMERA_NUMBER_FIELDS) {
    const labelEl = ownerDocument.createElement('label');
    labelEl.style.cssText = 'font-size:11px;color:#cbd5e1;';

    const input = ownerDocument.createElement('input');
    input.type = 'number';
    input.step = String(config.step);
    if (config.min != null) input.min = String(config.min);
    if (config.max != null) input.max = String(config.max);
    input.inputMode = 'decimal';
    input.style.cssText = [
      'width:108px',
      'height:26px',
      'border:1px solid rgba(148, 163, 184, 0.34)',
      'border-radius:6px',
      'background:rgba(15, 23, 42, 0.84)',
      'color:#f8fafc',
      'padding:0 6px',
      'font:12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    ].join(';');
    input.addEventListener('input', () => applyInputSnapshot());
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

  toggleButton.addEventListener('click', () => {
    open = !open;
    writeStoredOpen(ownerDocument.defaultView, open);
    renderOpenState();
  });
  languageButton.addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    writeStoredLanguage(ownerDocument.defaultView, language);
    renderLanguage();
    syncVisibleFields(latestSnapshot?.projection ?? readProjectionSelectValue());
  });
  resetButton.addEventListener('click', () => {
    if (!initialSnapshot || saving) return;
    setInputs(initialSnapshot);
    applySnapshot(initialSnapshot, { restoreTarget: true });
    cameraPanRestoreTarget = cloneTarget(initialSnapshot.target);
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
        showStatus(formatErrorMessage(error, text().saveFailed), { sticky: true, tone: 'error' });
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
      if (!initialSnapshot) initialSnapshot = cloneSnapshot(snapshot);
      latestSnapshot = cloneSnapshot(snapshot);
    }
    syncPanel(snapshot);
    applyCameraPan(deltaSeconds);
    frameHandle = ownerDocument.defaultView?.requestAnimationFrame(tick) ?? window.requestAnimationFrame(tick);
  }

  function syncPanel(snapshot: CameraDebugSnapshot | null): void {
    container.style.display = snapshot ? 'flex' : 'none';
    if (!snapshot) {
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
    latestSnapshot = cloneSnapshot(snapshot);
    if (applyOptions.restoreTarget) updateTargetMarker(snapshot.target);
  }

  function setInputs(snapshot: CameraDebugSnapshot): void {
    projectionSelect.value = snapshot.projection;
    for (const config of CAMERA_NUMBER_FIELDS) {
      setInputValue(config.field, readSnapshotField(snapshot, config.field));
    }
  }

  function setInputValue(field: CameraNumberField, value: number | undefined): void {
    const input = fields.get(field);
    if (!input) return;
    input.value = value == null ? '' : String(roundNumber(value));
  }

  function readInputs(fallback: CameraDebugSnapshot): CameraDebugSnapshot {
    const projection = readProjectionSelectValue();
    const next: CameraDebugSnapshot = {
      ...fallback,
      projection,
      alpha: readInputNumber('alpha', fallback.alpha),
      beta: readInputNumber('beta', fallback.beta),
      radius: Math.max(0.001, readInputNumber('radius', fallback.radius)),
      orthoSize: Math.max(0.001, readInputNumber('orthoSize', fallback.orthoSize)),
      fov: degreesToRadians(clamp(readInputNumber('fovDeg', radiansToDegrees(fallback.fov)), 1, 179)),
      minZ: Math.max(0.001, readInputNumber('minZ', fallback.minZ ?? 1)),
      maxZ: Math.max(0.001, readInputNumber('maxZ', fallback.maxZ ?? 10000)),
      lowerBetaLimit: readInputNumber('lowerBetaLimit', fallback.lowerBetaLimit ?? fallback.beta),
      upperBetaLimit: readInputNumber('upperBetaLimit', fallback.upperBetaLimit ?? fallback.beta),
      lowerRadiusLimit: Math.max(0.001, readInputNumber('lowerRadiusLimit', fallback.lowerRadiusLimit ?? fallback.radius)),
      upperRadiusLimit: Math.max(0.001, readInputNumber('upperRadiusLimit', fallback.upperRadiusLimit ?? fallback.radius)),
      inertia: clamp(readInputNumber('inertia', fallback.inertia ?? 0.9), 0, 1),
      targetScreenOffset: {
        x: readInputNumber('targetScreenOffsetX', fallback.targetScreenOffset?.x ?? 0),
        y: readInputNumber('targetScreenOffsetY', fallback.targetScreenOffset?.y ?? 0),
      },
    };
    const minZ = next.minZ ?? 0.001;
    if ((next.maxZ ?? minZ + 0.001) <= minZ) next.maxZ = minZ + 0.001;
    if ((next.upperBetaLimit ?? 0) < (next.lowerBetaLimit ?? 0)) next.upperBetaLimit = next.lowerBetaLimit;
    if ((next.upperRadiusLimit ?? 0) < (next.lowerRadiusLimit ?? 0)) next.upperRadiusLimit = next.lowerRadiusLimit;
    return next;
  }

  function readInputNumber(field: CameraNumberField, fallback: number): number {
    const input = fields.get(field);
    if (!input) return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function readProjectionSelectValue(): SceneCameraProjection {
    return projectionSelect.value === 'perspective' ? 'perspective' : 'orthographic';
  }

  function syncVisibleFields(projection: SceneCameraProjection): void {
    for (const { label, input, config } of fieldRows.values()) {
      const visible = !config.projection || config.projection === projection;
      label.style.display = visible ? '' : 'none';
      input.style.display = visible ? '' : 'none';
    }
  }

  function renderOpenState(): void {
    panel.style.display = open ? 'block' : 'none';
    toggleButton.style.background = open ? 'rgba(29, 78, 216, 0.9)' : 'rgba(15, 23, 42, 0.88)';
    const snapshot = latestSnapshot ?? readSnapshot(options.getGame());
    if (open && snapshot) startCameraPanMode(snapshot);
    if (!open) stopCameraPanMode();
  }

  function renderLanguage(): void {
    const copy = text();
    const currentProjection = readProjectionSelectValue();
    title.textContent = copy.title;
    modeLabel.textContent = copy.runtime;
    languageButton.textContent = copy.languageButton;
    toggleButton.title = copy.toggleTitle;
    projectionLabel.textContent = copy.projection;
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
    for (const { label, config } of fieldRows.values()) label.textContent = copy[config.textKey];
    panHint.textContent = copy.panHint;
    resetButton.textContent = copy.reset;
    saveButton.textContent = copy.save;
  }

  function startCameraPanMode(snapshot: CameraDebugSnapshot): void {
    if (!cameraPanRestoreTarget) cameraPanRestoreTarget = cloneTarget(snapshot.target);
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
    if (!camera) return;
    camera.target = new Vector3(restoreTarget.x, restoreTarget.y, restoreTarget.z);
    const snapshot = readSnapshot(game);
    latestSnapshot = snapshot ? cloneSnapshot(snapshot) : null;
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
    if (!CAMERA_DEBUG_PAN_KEYS.has(key)) return;
    pressedPanKeys.delete(key);
    if (!isCameraPanModeActive() || isEditableElement(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function canHandlePanKey(event: KeyboardEvent, key: string): boolean {
    return isCameraPanModeActive()
      && CAMERA_DEBUG_PAN_KEYS.has(key)
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey
      && !isEditableElement(event.target);
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

    const direction = new Vector3(0, 0, 0);
    if (pressedPanKeys.has('w')) direction.z += 1;
    if (pressedPanKeys.has('s')) direction.z -= 1;
    if (pressedPanKeys.has('d')) direction.x += 1;
    if (pressedPanKeys.has('a')) direction.x -= 1;
    if (direction.lengthSquared() === 0) return;

    const forward = camera.target.subtract(camera.position);
    forward.y = 0;
    if (forward.lengthSquared() <= 0.000001) forward.copyFromFloats(0, 0, 1);
    else forward.normalize();
    const right = new Vector3(-forward.z, 0, forward.x).normalize();
    const cameraRig = sceneBuilder.getSelectedCameraRig();
    const speed = Math.max(0.75, (cameraRig.projection === 'perspective' ? cameraRig.radius * 0.12 : cameraRig.orthoSize * 1.6));
    const movement = forward.scale(direction.z).addInPlace(right.scale(direction.x));
    if (movement.lengthSquared() === 0) return;
    movement.normalize().scaleInPlace(speed * deltaSeconds);
    camera.target = camera.target.add(movement);
    updateTargetMarker({ x: camera.target.x, y: camera.target.y, z: camera.target.z });

    const snapshot = readSnapshot(game);
    latestSnapshot = snapshot ? cloneSnapshot(snapshot) : null;
  }

  function updateTargetMarker(target: CameraDebugSnapshot['target']): void {
    const game = options.getGame();
    const scene = game?.getScene();
    if (!scene || !open) return;
    if (!targetMarker) {
      const size = 0.42;
      targetMarker = MeshBuilder.CreateLineSystem('cameraDebugTargetCrosshair', {
        lines: [
          [new Vector3(-size, 0.025, 0), new Vector3(size, 0.025, 0)],
          [new Vector3(0, 0.025, -size), new Vector3(0, 0.025, size)],
          [new Vector3(0, -size * 0.45, 0), new Vector3(0, size * 0.45, 0)],
        ],
        updatable: false,
      }, scene);
      targetMarker.color = new Color3(1, 0.08, 0.06);
      targetMarker.isPickable = false;
      targetMarker.renderingGroupId = 2;
    }
    targetMarker.position.set(target.x, target.y, target.z);
  }

  function disposeTargetMarker(): void {
    targetMarker?.dispose();
    targetMarker = null;
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
    return CAMERA_DEBUG_TEXT[language] ?? CAMERA_DEBUG_TEXT.zh;
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
      ownerDocument.defaultView?.removeEventListener('keydown', handlePanKeyDown, { capture: true });
      ownerDocument.defaultView?.removeEventListener('keyup', handlePanKeyUp, { capture: true });
      ownerDocument.defaultView?.removeEventListener('blur', clearPanKeys);
      container.remove();
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
  const binding = readCameraEditorBinding(camera.metadata);
  if (!binding) return null;
  const sceneBuilder = game?.getSceneBuilder();
  const cameraRig = sceneBuilder?.getSelectedCameraRig() ?? {
    projection: readCameraProjectionFromRuntime(camera.mode),
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
    orthoSize: readCameraOrthoSize(camera),
    fov: readPositiveNumber(camera.fov, 0.85),
  };
  return {
    projection: readCameraProjectionFromRuntime(camera.mode),
    alpha: roundNumber(camera.alpha),
    beta: roundNumber(camera.beta),
    radius: roundNumber(camera.radius),
    orthoSize: roundNumber(cameraRig.orthoSize ?? readCameraOrthoSize(camera)),
    fov: readPositiveNumber(camera.fov, cameraRig.fov ?? 0.85),
    ...(cameraRig.targetOffset ? { targetOffset: { ...cameraRig.targetOffset } } : {}),
    minZ: readPositiveNumber(camera.minZ, cameraRig.minZ ?? 1),
    maxZ: readPositiveNumber(camera.maxZ, cameraRig.maxZ ?? 10000),
    lowerBetaLimit: readFiniteNumber(camera.lowerBetaLimit, cameraRig.lowerBetaLimit ?? camera.beta),
    upperBetaLimit: readFiniteNumber(camera.upperBetaLimit, cameraRig.upperBetaLimit ?? camera.beta),
    lowerRadiusLimit: readPositiveNumber(camera.lowerRadiusLimit, cameraRig.lowerRadiusLimit ?? camera.radius),
    upperRadiusLimit: readPositiveNumber(camera.upperRadiusLimit, cameraRig.upperRadiusLimit ?? camera.radius),
    inertia: clamp(readFiniteNumber(camera.inertia, cameraRig.inertia ?? 0.9), 0, 1),
    targetScreenOffset: {
      x: readFiniteNumber(camera.targetScreenOffset?.x, cameraRig.targetScreenOffset?.x ?? 0),
      y: readFiniteNumber(camera.targetScreenOffset?.y, cameraRig.targetScreenOffset?.y ?? 0),
    },
    target: {
      x: roundNumber(camera.target.x),
      y: roundNumber(camera.target.y),
      z: roundNumber(camera.target.z),
    },
    binding,
  };
}

function readCameraEditorBinding(metadata: unknown): RuntimeCameraEditorBinding | null {
  const fpsEditor = readRecord(readRecord(metadata)?.__fpsEditor);
  const sourceId = readNonEmptyString(fpsEditor?.sourceId);
  const objectGuid = readNonEmptyString(fpsEditor?.objectGuid);
  const objectId = readNonEmptyString(fpsEditor?.objectId);
  const propertyPath = readNonEmptyString(fpsEditor?.propertyPath);
  if (!sourceId || propertyPath !== 'camera' || (!objectGuid && !objectId)) return null;
  return {
    sourceId,
    propertyPath: 'camera',
    ...(objectGuid ? { objectGuid } : {}),
    ...(objectId ? { objectId } : {}),
  };
}

function toCameraRig(snapshot: CameraDebugSnapshot): SceneCameraRigConfig {
  return {
    projection: snapshot.projection,
    alpha: snapshot.alpha,
    beta: snapshot.beta,
    radius: snapshot.radius,
    orthoSize: snapshot.orthoSize,
    fov: snapshot.fov,
    ...(snapshot.targetOffset ? { targetOffset: { ...snapshot.targetOffset } } : {}),
    minZ: snapshot.minZ,
    maxZ: snapshot.maxZ,
    lowerBetaLimit: snapshot.lowerBetaLimit,
    upperBetaLimit: snapshot.upperBetaLimit,
    lowerRadiusLimit: snapshot.lowerRadiusLimit,
    upperRadiusLimit: snapshot.upperRadiusLimit,
    inertia: snapshot.inertia,
    ...(snapshot.targetScreenOffset ? { targetScreenOffset: { ...snapshot.targetScreenOffset } } : {}),
  };
}

function readSnapshotField(snapshot: CameraDebugSnapshot, field: CameraNumberField): number | undefined {
  switch (field) {
    case 'alpha': return snapshot.alpha;
    case 'beta': return snapshot.beta;
    case 'radius': return snapshot.radius;
    case 'orthoSize': return snapshot.orthoSize;
    case 'fovDeg': return radiansToDegrees(snapshot.fov);
    case 'minZ': return snapshot.minZ;
    case 'maxZ': return snapshot.maxZ;
    case 'lowerBetaLimit': return snapshot.lowerBetaLimit;
    case 'upperBetaLimit': return snapshot.upperBetaLimit;
    case 'lowerRadiusLimit': return snapshot.lowerRadiusLimit;
    case 'upperRadiusLimit': return snapshot.upperRadiusLimit;
    case 'inertia': return snapshot.inertia;
    case 'targetScreenOffsetX': return snapshot.targetScreenOffset?.x;
    case 'targetScreenOffsetY': return snapshot.targetScreenOffset?.y;
  }
}

function readCameraProjectionFromRuntime(mode: number): SceneCameraProjection {
  return mode === Camera.PERSPECTIVE_CAMERA ? 'perspective' : 'orthographic';
}

function readCameraOrthoSize(camera: { orthoTop?: number | null; orthoBottom?: number | null }): number {
  const top = typeof camera.orthoTop === 'number' ? camera.orthoTop : null;
  const bottom = typeof camera.orthoBottom === 'number' ? camera.orthoBottom : null;
  if (top == null || bottom == null) return 10;
  return Math.max(0.001, Math.abs(top - bottom) / 2);
}

function cloneSnapshot(snapshot: CameraDebugSnapshot): CameraDebugSnapshot {
  return {
    ...snapshot,
    ...(snapshot.targetOffset ? { targetOffset: { ...snapshot.targetOffset } } : {}),
    ...(snapshot.targetScreenOffset ? { targetScreenOffset: { ...snapshot.targetScreenOffset } } : {}),
    target: { ...snapshot.target },
    binding: { ...snapshot.binding },
  };
}

function cloneTarget(target: CameraDebugSnapshot['target']): CameraDebugSnapshot['target'] {
  return { x: target.x, y: target.y, z: target.z };
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function formatErrorMessage(error: unknown, prefix: string): string {
  const message = error instanceof Error ? error.message : String(error);
  return message ? `${prefix}: ${message}` : `${prefix}.`;
}

function roundNumber(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function readStoredOpen(win: Window | null): boolean {
  try {
    return win?.localStorage.getItem(CAMERA_DEBUG_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredOpen(win: Window | null, value: boolean): void {
  try {
    win?.localStorage.setItem(CAMERA_DEBUG_STORAGE_KEY, String(value));
  } catch {
    // localStorage can be unavailable in embedded previews.
  }
}

function readStoredLanguage(win: Window | null): CameraDebugLanguage {
  try {
    return win?.localStorage.getItem(CAMERA_DEBUG_LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

function writeStoredLanguage(win: Window | null, value: CameraDebugLanguage): void {
  try {
    win?.localStorage.setItem(CAMERA_DEBUG_LANGUAGE_STORAGE_KEY, value);
  } catch {
    // localStorage can be unavailable in embedded previews.
  }
}
