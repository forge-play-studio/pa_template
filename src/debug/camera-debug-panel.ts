import { Vector3 } from '@babylonjs/core/Maths/math.vector';
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

interface CameraDebugSnapshot extends SceneCameraRigConfig {
  target: { x: number; y: number; z: number };
  binding: RuntimeCameraEditorBinding;
}

type CameraField = keyof SceneCameraRigConfig;

const CAMERA_DEBUG_STORAGE_KEY = 'pa-template.camera-debug.open';
const CAMERA_DEBUG_PAN_KEYS = new Set(['w', 'a', 's', 'd']);
const CAMERA_DEBUG_FIELDS = [
  ['alpha', 'Alpha', 0.01],
  ['beta', 'Beta', 0.01],
  ['radius', 'Radius', 0.1],
  ['orthoSize', 'Ortho', 0.1],
] as const satisfies readonly [CameraField, string, number][];

export function mountCameraDebugPanel(options: CameraDebugPanelOptions): CameraDebugPanel {
  const root = options.root ?? document.body;
  const ownerDocument = root.ownerDocument;
  let open = readStoredOpen(ownerDocument.defaultView);
  let disposed = false;
  let saving = false;
  let initialSnapshot: CameraDebugSnapshot | null = null;
  let latestSnapshot: CameraDebugSnapshot | null = null;
  let cameraPanRestoreTarget: CameraDebugSnapshot['target'] | null = null;
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
  toggleButton.title = 'Toggle camera debug panel';
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
    'width:280px',
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
  title.textContent = 'Camera Debug';
  title.style.cssText = 'font-size:13px;font-weight:700;line-height:1.2;';

  const modeLabel = ownerDocument.createElement('div');
  modeLabel.style.cssText = 'font-size:11px;color:#93c5fd;line-height:1.2;';

  titleRow.append(title, modeLabel);

  const fields = new Map<CameraField, HTMLInputElement>();
  const grid = ownerDocument.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 88px;gap:7px 8px;align-items:center;';

  for (const [field, label, step] of CAMERA_DEBUG_FIELDS) {
    const labelEl = ownerDocument.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-size:11px;color:#cbd5e1;';

    const input = ownerDocument.createElement('input');
    input.type = 'number';
    input.step = String(step);
    input.inputMode = 'decimal';
    input.style.cssText = [
      'width:88px',
      'height:26px',
      'border:1px solid rgba(148, 163, 184, 0.34)',
      'border-radius:6px',
      'background:rgba(15, 23, 42, 0.84)',
      'color:#f8fafc',
      'padding:0 6px',
      'font:12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    ].join(';');
    input.addEventListener('input', () => applyInputSnapshot());
    fields.set(field, input);
    grid.append(labelEl, input);
  }

  const panHint = ownerDocument.createElement('div');
  panHint.textContent = 'W/S Forward / Back · A/D Left / Right';
  panHint.style.cssText = [
    'margin-top:10px',
    'font-size:11px',
    'line-height:1.35',
    'color:#9fb2d0',
  ].join(';');

  const actions = ownerDocument.createElement('div');
  actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;';
  const resetButton = createPanelButton(ownerDocument, 'Reset');
  const saveButton = createPanelButton(ownerDocument, 'Save Rig');
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
  resetButton.addEventListener('click', () => {
    if (!initialSnapshot || saving) return;
    setInputs(initialSnapshot);
    applySnapshot(initialSnapshot, { restoreTarget: true });
    cameraPanRestoreTarget = cloneTarget(initialSnapshot.target);
    showStatus('Reset to initial runtime camera.');
  });
  saveButton.addEventListener('click', () => {
    const snapshot = latestSnapshot ?? readSnapshot(options.getGame());
    if (!snapshot || saving) return;
    saving = true;
    syncPanel(snapshot);
    showStatus('Saving rig...', { sticky: true });
    void saveRuntimeCameraRigToEditorScene(snapshot.binding, toCameraRig(snapshot))
      .then(() => {
        showStatus('Saved rig. Reloading...', { sticky: true });
        ownerDocument.defaultView?.location.reload();
      })
      .catch((error) => {
        console.error('[CameraDebugPanel] Save rig failed', error);
        saving = false;
        showStatus(formatErrorMessage(error), { sticky: true, tone: 'error' });
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
    modeLabel.textContent = 'Runtime';
    for (const input of fields.values()) {
      input.disabled = saving;
    }
    resetButton.disabled = !initialSnapshot || saving;
    saveButton.disabled = saving;
    if (ownerDocument.activeElement instanceof HTMLInputElement && [...fields.values()].includes(ownerDocument.activeElement)) return;
    setInputs(snapshot);
  }

  function applyInputSnapshot(): void {
    if (saving) return;
    const current = latestSnapshot ?? readSnapshot(options.getGame());
    if (!current) return;
    const next = readInputs(current);
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
  }

  function setInputs(snapshot: CameraDebugSnapshot): void {
    setInputValue('alpha', snapshot.alpha);
    setInputValue('beta', snapshot.beta);
    setInputValue('radius', snapshot.radius);
    setInputValue('orthoSize', snapshot.orthoSize);
  }

  function setInputValue(field: CameraField, value: number): void {
    const input = fields.get(field);
    if (!input) return;
    input.value = String(roundNumber(value));
  }

  function readInputs(fallback: CameraDebugSnapshot): CameraDebugSnapshot {
    return {
      ...fallback,
      alpha: readInputNumber('alpha', fallback.alpha),
      beta: readInputNumber('beta', fallback.beta),
      radius: Math.max(0.001, readInputNumber('radius', fallback.radius)),
      orthoSize: Math.max(0.001, readInputNumber('orthoSize', fallback.orthoSize)),
    };
  }

  function readInputNumber(field: CameraField, fallback: number): number {
    const input = fields.get(field);
    if (!input) return fallback;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function renderOpenState(): void {
    panel.style.display = open ? 'block' : 'none';
    toggleButton.style.background = open ? 'rgba(29, 78, 216, 0.9)' : 'rgba(15, 23, 42, 0.88)';
    const snapshot = latestSnapshot ?? readSnapshot(options.getGame());
    if (open && snapshot) startCameraPanMode(snapshot);
    if (!open) stopCameraPanMode();
  }

  function startCameraPanMode(snapshot: CameraDebugSnapshot): void {
    if (cameraPanRestoreTarget) return;
    cameraPanRestoreTarget = cloneTarget(snapshot.target);
  }

  function stopCameraPanMode(): void {
    clearPanKeys();
    const restoreTarget = cameraPanRestoreTarget;
    cameraPanRestoreTarget = null;
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
    const speed = Math.max(0.75, cameraRig.orthoSize * 1.6);
    const movement = forward.scale(direction.z).addInPlace(right.scale(direction.x));
    if (movement.lengthSquared() === 0) return;
    movement.normalize().scaleInPlace(speed * deltaSeconds);
    camera.target = camera.target.add(movement);

    const snapshot = readSnapshot(game);
    latestSnapshot = snapshot ? cloneSnapshot(snapshot) : null;
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

function createPanelButton(ownerDocument: Document, label: string): HTMLButtonElement {
  const button = ownerDocument.createElement('button');
  button.type = 'button';
  button.textContent = label;
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
    alpha: camera.alpha,
    beta: camera.beta,
    radius: camera.radius,
    orthoSize: readCameraOrthoSize(camera),
  };
  return {
    alpha: roundNumber(camera.alpha),
    beta: roundNumber(camera.beta),
    radius: roundNumber(camera.radius),
    orthoSize: roundNumber(cameraRig.orthoSize),
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
    alpha: snapshot.alpha,
    beta: snapshot.beta,
    radius: snapshot.radius,
    orthoSize: snapshot.orthoSize,
  };
}

function readCameraOrthoSize(camera: { orthoTop?: number | null; orthoBottom?: number | null }): number {
  const top = typeof camera.orthoTop === 'number' ? camera.orthoTop : null;
  const bottom = typeof camera.orthoBottom === 'number' ? camera.orthoBottom : null;
  if (top == null || bottom == null) return 10;
  return Math.max(0.001, Math.abs(top - bottom) / 2);
}

function cloneSnapshot(snapshot: CameraDebugSnapshot): CameraDebugSnapshot {
  return {
    alpha: snapshot.alpha,
    beta: snapshot.beta,
    radius: snapshot.radius,
    orthoSize: snapshot.orthoSize,
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

function formatErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message ? `Save failed: ${message}` : 'Save failed.';
}

function roundNumber(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(4)) : 0;
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
