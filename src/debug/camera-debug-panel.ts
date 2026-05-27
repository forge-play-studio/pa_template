import { Camera } from '@babylonjs/core/Cameras/camera';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
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
  | 'betaRange'
  | 'minRadius'
  | 'maxRadius'
  | 'radiusRange'
  | 'inertia'
  | 'screenOffsetX'
  | 'screenOffsetY'
  | 'panHint'
  | 'reset'
  | 'save'
  | 'worldPosition'
  | 'resetStatus'
  | 'savingStatus'
  | 'savedStatus'
  | 'saveFailed',
  string
>;

type CameraDebugTooltipText = Record<
  | 'languageButton'
  | 'toggleTitle'
  | 'projection'
  | 'alpha'
  | 'beta'
  | 'radius'
  | 'orthoSize'
  | 'fov'
  | 'nearClip'
  | 'farClip'
  | 'minBeta'
  | 'maxBeta'
  | 'betaRange'
  | 'minRadius'
  | 'maxRadius'
  | 'radiusRange'
  | 'inertia'
  | 'screenOffsetX'
  | 'screenOffsetY'
  | 'panHint'
  | 'reset'
  | 'save',
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
    alpha: '水平环绕角',
    beta: '俯仰角',
    radius: '跟随距离',
    orthoSize: '正交视野高度',
    fov: '透视视野角',
    nearClip: '近裁面距离',
    farClip: '远裁面距离',
    minBeta: '最小俯仰角',
    maxBeta: '最大俯仰角',
    betaRange: '俯仰角范围',
    minRadius: '最小跟随距离',
    maxRadius: '最大跟随距离',
    radiusRange: '跟随距离范围',
    inertia: '平滑惯性',
    screenOffsetX: '画面偏移 X',
    screenOffsetY: '画面偏移 Y',
    panHint: 'W/S 前进 / 后退 · A/D 左 / 右 · 十字准星 = 预览目标',
    reset: '重置参数',
    save: '保存参数',
    worldPosition: '世界坐标',
    resetStatus: '已重置为初始运行时摄像机。',
    savingStatus: '正在保存摄像机参数...',
    savedStatus: '已保存摄像机参数，正在重新加载...',
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
    betaRange: 'Pitch Range',
    minRadius: 'Min Radius',
    maxRadius: 'Max Radius',
    radiusRange: 'Follow Distance Range',
    inertia: 'Inertia',
    screenOffsetX: 'Screen Offset X',
    screenOffsetY: 'Screen Offset Y',
    panHint: 'W/S Forward / Back · A/D Left / Right · crosshair = preview target',
    reset: 'Reset',
    save: 'Save Rig',
    worldPosition: 'World',
    resetStatus: 'Reset to initial runtime camera.',
    savingStatus: 'Saving rig...',
    savedStatus: 'Saved rig. Reloading...',
    saveFailed: 'Save failed',
  },
};

const CAMERA_DEBUG_TOOLTIPS: Record<CameraDebugLanguage, CameraDebugTooltipText> = {
  zh: {
    languageButton: '切换摄像机调试面板的显示语言。',
    toggleTitle: '打开或关闭运行时摄像机调试面板。',
    projection: '切换主摄像机的正交或透视投影模式。',
    alpha: 'ArcRotate 水平环绕角，单位为弧度。',
    beta: 'ArcRotate 垂直俯仰角，单位为弧度。',
    radius: '摄像机到观察目标的距离。',
    orthoSize: '正交模式下的视野高度，数值越大看到的范围越大。',
    fov: '透视模式下的垂直视野角；界面用角度显示，保存为弧度。',
    nearClip: '小于该距离的内容不会被摄像机渲染。',
    farClip: '大于该距离的内容不会被摄像机渲染。',
    minBeta: '限制运行时可用的最小俯仰角。',
    maxBeta: '限制运行时可用的最大俯仰角。',
    betaRange: '运行时允许的俯仰角范围，左侧为最小值，右侧为最大值。',
    minRadius: '限制摄像机可接近目标的最小距离。',
    maxRadius: '限制摄像机可远离目标的最大距离。',
    radiusRange: '运行时允许的跟随距离范围，左侧为最小值，右侧为最大值。',
    inertia: '摄像机输入或跟随的平滑惯性，0 最灵敏，1 最平滑。',
    screenOffsetX: '将观察目标在画面中水平偏移。',
    screenOffsetY: '将观察目标在画面中垂直偏移。',
    panHint: '面板打开时可用 W/A/S/D 移动预览目标；关闭面板会恢复目标位置。',
    reset: '恢复为打开运行时时读取到的初始摄像机参数。',
    save: '通过编辑器保存链路写回 Main Camera，并在保存成功后重新加载运行时。',
  },
  en: {
    languageButton: 'Switch the camera debug panel language.',
    toggleTitle: 'Open or close the runtime camera debug panel.',
    projection: 'Switch the Main Camera between orthographic and perspective projection.',
    alpha: 'ArcRotate horizontal orbit angle, in radians.',
    beta: 'ArcRotate vertical pitch angle, in radians.',
    radius: 'Distance from the camera to the look target.',
    orthoSize: 'Orthographic view height. Larger values show a wider area.',
    fov: 'Perspective vertical field of view. The UI uses degrees; saved data uses radians.',
    nearClip: 'Content closer than this distance is not rendered.',
    farClip: 'Content farther than this distance is not rendered.',
    minBeta: 'Minimum allowed runtime pitch angle.',
    maxBeta: 'Maximum allowed runtime pitch angle.',
    betaRange: 'Allowed runtime pitch range. Left is minimum; right is maximum.',
    minRadius: 'Minimum allowed camera distance from the target.',
    maxRadius: 'Maximum allowed camera distance from the target.',
    radiusRange: 'Allowed runtime follow distance range. Left is minimum; right is maximum.',
    inertia: 'Camera input/follow smoothing. 0 is most responsive; 1 is smoothest.',
    screenOffsetX: 'Moves the look target horizontally in screen space.',
    screenOffsetY: 'Moves the look target vertically in screen space.',
    panHint: 'When the panel is open, use W/A/S/D to move the preview target; closing the panel restores it.',
    reset: 'Restore the camera parameters captured when runtime opened.',
    save: 'Save back to the Main Camera through the editor authoring pipeline, then reload runtime.',
  },
};

type CameraNumberFieldConfig = {
  field: CameraNumberField;
  textKey: keyof CameraDebugText;
  step: number;
  min?: number;
  max?: number;
  projection?: SceneCameraProjection;
};

const CAMERA_NUMBER_FIELDS: ReadonlyArray<CameraNumberFieldConfig> = [
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
const CAMERA_DEBUG_RANGE_FIELD_PAIRS: ReadonlyArray<{
  labelKey: keyof CameraDebugText;
  tooltipKey: keyof CameraDebugTooltipText;
  lower: CameraNumberField;
  upper: CameraNumberField;
}> = [
  { labelKey: 'betaRange', tooltipKey: 'betaRange', lower: 'lowerBetaLimit', upper: 'upperBetaLimit' },
  { labelKey: 'radiusRange', tooltipKey: 'radiusRange', lower: 'lowerRadiusLimit', upper: 'upperRadiusLimit' },
];
const CAMERA_DEBUG_RANGE_FIELD_ENDS = new Set(CAMERA_DEBUG_RANGE_FIELD_PAIRS.map(pair => pair.upper));
const CAMERA_DEBUG_TOOLTIP_DELAY_MS = 140;

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
    writeStoredOpen(ownerDocument.defaultView, open);
    renderOpenState();
  });
  container.addEventListener('pointerover', handleDebugTooltipPointerOver);
  container.addEventListener('pointerout', handleDebugTooltipPointerOut);
  container.addEventListener('focusin', handleDebugTooltipFocusIn);
  container.addEventListener('focusout', hideDebugTooltip);
  container.addEventListener('click', hideDebugTooltip);
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

  function syncInputsExceptActive(snapshot: CameraDebugSnapshot): void {
    const active = ownerDocument.activeElement;
    if (active !== projectionSelect) projectionSelect.value = snapshot.projection;
    for (const config of CAMERA_NUMBER_FIELDS) {
      const input = fields.get(config.field);
      if (!input || active === input) continue;
      setInputValue(config.field, readSnapshotField(snapshot, config.field));
    }
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
    normalizeInteractiveCameraRanges(next, readActiveNumberField());
    return next;
  }

  function readActiveNumberField(): CameraNumberField | null {
    const active = ownerDocument.activeElement;
    for (const [field, input] of fields) {
      if (active === input) return field;
    }
    return null;
  }

  function normalizeInteractiveCameraRanges(snapshot: CameraDebugSnapshot, activeField: CameraNumberField | null): void {
    normalizeInteractiveNumberRange(snapshot, {
      valueField: 'beta',
      lowerField: 'lowerBetaLimit',
      upperField: 'upperBetaLimit',
      activeField,
      minValue: Number.NEGATIVE_INFINITY,
    });
    normalizeInteractiveNumberRange(snapshot, {
      valueField: 'radius',
      lowerField: 'lowerRadiusLimit',
      upperField: 'upperRadiusLimit',
      activeField,
      minValue: 0.001,
    });
  }

  function normalizeInteractiveNumberRange(
    snapshot: CameraDebugSnapshot,
    options: {
      valueField: 'beta' | 'radius';
      lowerField: 'lowerBetaLimit' | 'lowerRadiusLimit';
      upperField: 'upperBetaLimit' | 'upperRadiusLimit';
      activeField: CameraNumberField | null;
      minValue: number;
    },
  ): void {
    let value = snapshot[options.valueField];
    let lower = snapshot[options.lowerField] ?? value;
    let upper = snapshot[options.upperField] ?? value;
    if (upper < lower) {
      if (options.activeField === options.upperField) lower = upper;
      else upper = lower;
    }
    if (options.activeField === options.lowerField || options.activeField === options.upperField) {
      value = clamp(value, lower, upper);
      if (Number.isFinite(options.minValue)) value = Math.max(options.minValue, value);
    } else {
      if (value < lower) lower = value;
      if (value > upper) upper = value;
    }
    snapshot[options.valueField] = value;
    snapshot[options.lowerField] = Number.isFinite(options.minValue) ? Math.max(options.minValue, lower) : lower;
    snapshot[options.upperField] = Number.isFinite(options.minValue) ? Math.max(options.minValue, upper) : upper;
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

  function syncVisibleFields(projection: SceneCameraProjection): void {
    for (const { label, input, config } of fieldRows.values()) {
      const visible = !config.projection || config.projection === projection;
      label.style.display = visible ? '' : 'none';
      input.style.display = visible ? '' : 'none';
    }
    for (const { label, wrapper, lowerConfig, upperConfig } of rangeRows) {
      const visible = [lowerConfig, upperConfig].every(config => !config.projection || config.projection === projection);
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
    const sceneBuilder = game?.getSceneBuilder();
    if (!camera || !sceneBuilder) return;
    sceneBuilder.applyCameraRig(
      camera,
      sceneBuilder.getSelectedCameraRig(),
      new Vector3(restoreTarget.x, restoreTarget.y, restoreTarget.z),
    );
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
    const nextTarget = camera.target.add(movement);
    sceneBuilder.applyCameraRig(camera, cameraRig, nextTarget);
    updateTargetMarker({ x: nextTarget.x, y: nextTarget.y, z: nextTarget.z });

    const snapshot = readSnapshot(game);
    latestSnapshot = snapshot ? cloneSnapshot(snapshot) : null;
  }

  function updateTargetMarker(target: CameraDebugSnapshot['target']): void {
    const game = options.getGame();
    const scene = game?.getScene();
    if (!scene || !open) return;
    if (!targetMarker) targetMarker = createTargetMarker();
    targetMarker.position.set(target.x, target.y, target.z);
    targetCoordinate = cloneTarget(target);
    updateTargetCoordinateLabel(target);
  }

  function createTargetMarker(): TransformNode {
    const game = options.getGame();
    const scene = game?.getScene();
    if (!scene) throw new Error('Camera debug target marker requires an active scene.');

    const rootNode = new TransformNode('cameraDebugTargetMarker', scene);
    const material = new StandardMaterial('cameraDebugTargetMarker.material', scene);
    material.diffuseColor = new Color3(1, 0.04, 0.03);
    material.emissiveColor = new Color3(1, 0.04, 0.03);
    material.specularColor = new Color3(0.35, 0.02, 0.02);
    material.disableLighting = true;

    const markerYOffset = 0.32;
    const armLength = 0.16;
    const armGap = 0.02;
    const armDiameter = 0.048;
    const armHeight = 0.2;
    const createArm = (name: string, position: Vector3, rotation: Vector3, height = armLength): void => {
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
    };

    const centerDistance = armGap + armLength / 2;
    createArm('cameraDebugTargetMarker.arm.x.positive', new Vector3(centerDistance, markerYOffset, 0), new Vector3(0, 0, Math.PI / 2));
    createArm('cameraDebugTargetMarker.arm.x.negative', new Vector3(-centerDistance, markerYOffset, 0), new Vector3(0, 0, Math.PI / 2));
    createArm('cameraDebugTargetMarker.arm.z.positive', new Vector3(0, markerYOffset, centerDistance), new Vector3(Math.PI / 2, 0, 0));
    createArm('cameraDebugTargetMarker.arm.z.negative', new Vector3(0, markerYOffset, -centerDistance), new Vector3(Math.PI / 2, 0, 0));
    createArm('cameraDebugTargetMarker.arm.y', new Vector3(0, markerYOffset, 0), new Vector3(0, 0, 0), armHeight);

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
      'transform:translate(-50%, calc(-100% - 28px))',
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
    const projected = projectTargetToScreen(target);
    if (!projected || projected.depth < 0 || projected.depth > 1) {
      hideTargetCoordinateLabel();
      return;
    }
    const label = ensureTargetCoordinateLabel();
    label.textContent = formatTargetCoordinateLabel(target);
    label.style.left = `${projected.x}px`;
    label.style.top = `${projected.y}px`;
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
    const transformMatrix = scene?.getTransformMatrix?.();
    if (!scene || !camera || !canvas || !viewport || !transformMatrix) return null;

    const rect = canvas.getBoundingClientRect();
    const renderWidth = Math.max(1, Number(engine?.getRenderWidth?.() ?? canvas.width ?? rect.width));
    const renderHeight = Math.max(1, Number(engine?.getRenderHeight?.() ?? canvas.height ?? rect.height));
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

  function formatTargetCoordinateLabel(target: CameraDebugSnapshot['target']): string {
    const copy = text();
    return `${copy.worldPosition}  X ${formatCoordinate(target.x)}  Y ${formatCoordinate(target.y)}  Z ${formatCoordinate(target.z)}`;
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
    return CAMERA_DEBUG_TEXT[language] ?? CAMERA_DEBUG_TEXT.zh;
  }

  function tooltips(): CameraDebugTooltipText {
    return CAMERA_DEBUG_TOOLTIPS[language] ?? CAMERA_DEBUG_TOOLTIPS.zh;
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

function formatCoordinate(value: number): string {
  return roundNumber(value).toFixed(3);
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
