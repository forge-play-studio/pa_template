import type { ColorRGB } from '../config';
import type { Game } from '../core/Game';
import type { RuntimeLightEditorBinding } from './runtime-lighting-save';
import { saveRuntimeLightsToEditorScene } from './runtime-lighting-save';
import {
  canSaveEditorSceneLightingDebugSnapshot as canSaveSnapshot,
  cloneEditorSceneLightingDebugSnapshot as cloneSnapshot,
  colorFromEditorSceneLightingHex as hexToColor,
  colorToEditorSceneLightingHex as colorToHex,
  createEditorSceneDirectionalLightDirectionFromAngles as createDirectionalLightDirectionFromAngles,
  findEditorSceneLightingDebugNumberFieldConfig as findNumberConfig,
  formatEditorSceneLightingNumber as formatNumber,
  formatEditorSceneLightingShadowMode,
  readEditorSceneDirectionalLightAngles as readDirectionalLightAngles,
  readEditorSceneLightingDebugColorSnapshotField as readColorSnapshotField,
  readEditorSceneLightingDebugNumberSnapshotField as readNumberSnapshotField,
  readEditorSceneLightingDebugText,
  readEditorSceneLightingDebugTooltipText,
  readEditorSceneLightingProjectedLengthMultiplier as readProjectedLengthMultiplier,
  readEditorSceneRuntimeLightBinding,
  readStoredEditorSceneLightingDebugLanguage as readStoredLanguage,
  readStoredEditorSceneLightingDebugOpen as readStoredOpen,
  roundEditorSceneLightingNumber as roundNumber,
  toEditorSceneRuntimeLightingPatches as toRuntimeLightingPatches,
  writeStoredEditorSceneLightingDebugLanguage as writeStoredLanguage,
  writeStoredEditorSceneLightingDebugOpen as writeStoredOpen,
  type EditorSceneLightingDebugColorField as ColorField,
  type EditorSceneLightingDebugLanguage as LightingDebugLanguage,
  type EditorSceneLightingDebugNumberField as NumberField,
  type EditorSceneLightingDebugNumberFieldConfig as NumberFieldConfig,
  type EditorSceneLightingDebugSnapshot as LightingDebugSnapshot,
  type EditorSceneLightingDebugText as LightingDebugText,
  type EditorSceneLightingDebugTooltipText as LightingDebugTooltipText,
  type EditorSceneRuntimeShadowMode as RuntimeShadowMode,
} from '@fps-games/editor/playable-sdk';

export interface RuntimeLightingDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export interface RuntimeLightingDebugPanel {
  dispose(): void;
}

const TOOLTIP_DELAY_MS = 320;

export function mountRuntimeLightingDebugPanel(options: RuntimeLightingDebugPanelOptions): RuntimeLightingDebugPanel {
  const root = options.root ?? document.body;
  const ownerDocument = root.ownerDocument;
  let open = readStoredOpen(ownerDocument.defaultView);
  let language = readStoredLanguage(ownerDocument.defaultView);
  let disposed = false;
  let saving = false;
  let initialSnapshot: LightingDebugSnapshot | null = null;
  let latestSnapshot: LightingDebugSnapshot | null = null;
  let frameHandle = 0;
  let statusTimeout = 0;

  const container = ownerDocument.createElement('div');
  container.style.cssText = [
    'position:fixed',
    'right:100px',
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
  toggleButton.textContent = 'Light';
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
    'width:330px',
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

  const form = ownerDocument.createElement('div');
  form.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

  const environmentSection = createSection(ownerDocument);
  const environmentTitle = createSectionTitle(ownerDocument);
  const environmentGrid = createGrid(ownerDocument);
  const environmentEnabled = createCheckbox(ownerDocument);
  const environmentIntensity = createNumberInput(ownerDocument, findNumberConfig('environmentIntensity'));
  const environmentDiffuseColor = createColorInput(ownerDocument);
  const environmentGroundColor = createColorInput(ownerDocument);
  environmentGrid.append(
    createLabel(ownerDocument), environmentEnabled,
    createLabel(ownerDocument), environmentIntensity,
    createLabel(ownerDocument), environmentDiffuseColor,
    createLabel(ownerDocument), environmentGroundColor,
  );
  environmentSection.append(environmentTitle, environmentGrid);

  const directionalSection = createSection(ownerDocument);
  const directionalTitle = createSectionTitle(ownerDocument);
  const directionalGrid = createGrid(ownerDocument);
  const directionalEnabled = createCheckbox(ownerDocument);
  const directionalIntensity = createNumberInput(ownerDocument, findNumberConfig('directionalIntensity'));
  const directionalHorizontalAngle = createNumberInput(ownerDocument, findNumberConfig('directionalHorizontalAngle'));
  const directionalElevationAngle = createNumberInput(ownerDocument, findNumberConfig('directionalElevationAngle'));
  const directionalDiffuseColor = createColorInput(ownerDocument);
  const rawDirection = ownerDocument.createElement('div');
  rawDirection.style.cssText = [
    'min-height:26px',
    'box-sizing:border-box',
    'padding:5px 6px',
    'border:1px solid rgba(148, 163, 184, 0.2)',
    'border-radius:6px',
    'background:rgba(15, 23, 42, 0.58)',
    'color:#dbeafe',
    'font:11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    'line-height:1.35',
    'white-space:normal',
  ].join(';');
  const shadowStatus = ownerDocument.createElement('div');
  shadowStatus.style.cssText = rawDirection.style.cssText;
  directionalGrid.append(
    createLabel(ownerDocument), directionalEnabled,
    createLabel(ownerDocument), directionalIntensity,
    createLabel(ownerDocument), directionalHorizontalAngle,
    createLabel(ownerDocument), directionalElevationAngle,
    createLabel(ownerDocument), directionalDiffuseColor,
    createLabel(ownerDocument), rawDirection,
    createLabel(ownerDocument), shadowStatus,
  );
  directionalSection.append(directionalTitle, directionalGrid);

  form.append(environmentSection, directionalSection);

  const actions = ownerDocument.createElement('div');
  actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;';
  const resetButton = createPanelButton(ownerDocument);
  const saveButton = createPanelButton(ownerDocument);
  actions.append(resetButton, saveButton);

  const status = ownerDocument.createElement('div');
  status.style.cssText = 'min-height:16px;margin-top:8px;font-size:11px;color:#94a3b8;';

  panel.append(titleRow, form, actions, status);
  container.append(panel, toggleButton);
  root.append(container);

  const lightGridChildren = directionalGrid.children;
  const gridShadowLabel = lightGridChildren[12] as HTMLLabelElement;
  const labelRows = {
    environmentEnabled: environmentGrid.children[0] as HTMLLabelElement,
    environmentIntensity: environmentGrid.children[2] as HTMLLabelElement,
    environmentDiffuseColor: environmentGrid.children[4] as HTMLLabelElement,
    environmentGroundColor: environmentGrid.children[6] as HTMLLabelElement,
    directionalEnabled: lightGridChildren[0] as HTMLLabelElement,
    directionalIntensity: lightGridChildren[2] as HTMLLabelElement,
    directionalHorizontalAngle: lightGridChildren[4] as HTMLLabelElement,
    directionalElevationAngle: lightGridChildren[6] as HTMLLabelElement,
    directionalDiffuseColor: lightGridChildren[8] as HTMLLabelElement,
    rawDirection: lightGridChildren[10] as HTMLLabelElement,
    shadowReadout: gridShadowLabel,
  };

  const numberInputs = new Map<NumberField, HTMLInputElement>([
    ['environmentIntensity', environmentIntensity],
    ['directionalIntensity', directionalIntensity],
    ['directionalHorizontalAngle', directionalHorizontalAngle],
    ['directionalElevationAngle', directionalElevationAngle],
  ]);
  const colorInputs = new Map<ColorField, HTMLInputElement>([
    ['environmentDiffuseColor', environmentDiffuseColor],
    ['environmentGroundColor', environmentGroundColor],
    ['directionalDiffuseColor', directionalDiffuseColor],
  ]);
  const checkboxInputs = [environmentEnabled, directionalEnabled];

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

  const handleInput = () => applyInputSnapshot();
  environmentEnabled.addEventListener('change', handleInput);
  directionalEnabled.addEventListener('change', handleInput);
  for (const input of numberInputs.values()) input.addEventListener('input', handleInput);
  for (const input of colorInputs.values()) input.addEventListener('input', handleInput);

  toggleButton.addEventListener('click', () => {
    open = !open;
    writeStoredOpen(ownerDocument.defaultView, open);
    renderOpenState();
  });
  languageButton.addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    writeStoredLanguage(ownerDocument.defaultView, language);
    renderLanguage();
  });
  resetButton.addEventListener('click', () => {
    if (!initialSnapshot || saving) return;
    setInputs(initialSnapshot);
    applySnapshot(initialSnapshot);
    showStatus(text().resetStatus);
  });
  saveButton.addEventListener('click', () => {
    const snapshot = latestSnapshot ?? readSnapshot(options.getGame());
    if (!snapshot || saving || !canSaveSnapshot(snapshot)) {
      showStatus(text().missingBindingStatus, { tone: 'error' });
      return;
    }
    saving = true;
    syncPanel(snapshot);
    showStatus(text().savingStatus, { sticky: true });
    void saveRuntimeLightsToEditorScene(toRuntimeLightingPatches(snapshot))
      .then(() => {
        showStatus(text().savedStatus, { sticky: true });
        ownerDocument.defaultView?.location.reload();
      })
      .catch((error) => {
        console.error('[RuntimeLightingDebugPanel] Save lighting failed', error);
        saving = false;
        showStatus(formatErrorMessage(error, text().saveFailed), { sticky: true, tone: 'error' });
        syncPanel(latestSnapshot);
      });
  });

  container.addEventListener('pointerover', handleDebugTooltipPointerOver);
  container.addEventListener('pointerout', handleDebugTooltipPointerOut);
  container.addEventListener('focusin', handleDebugTooltipFocusIn);
  container.addEventListener('focusout', hideDebugTooltip);
  container.addEventListener('click', hideDebugTooltip);

  function tick(): void {
    if (disposed) return;
    const snapshot = readSnapshot(options.getGame());
    if (!snapshot) {
      initialSnapshot = null;
      latestSnapshot = null;
    } else {
      if (!initialSnapshot) initialSnapshot = cloneSnapshot(snapshot);
      latestSnapshot = cloneSnapshot(snapshot);
    }
    syncPanel(snapshot);
    frameHandle = ownerDocument.defaultView?.requestAnimationFrame(tick) ?? window.requestAnimationFrame(tick);
  }

  function syncPanel(snapshot: LightingDebugSnapshot | null): void {
    container.style.display = snapshot ? 'flex' : 'none';
    if (!snapshot) {
      hideDebugTooltip();
      return;
    }
    for (const input of [...numberInputs.values(), ...colorInputs.values(), ...checkboxInputs]) {
      input.disabled = saving;
    }
    resetButton.disabled = !initialSnapshot || saving;
    saveButton.disabled = saving || !canSaveSnapshot(snapshot);
    saveButton.style.opacity = saveButton.disabled ? '0.68' : '1';
    saveButton.style.cursor = saveButton.disabled ? 'not-allowed' : 'pointer';
    if (!isPanelInputActive()) setInputs(snapshot);
    syncReadout(snapshot);
    if (!canSaveSnapshot(snapshot) && !saving) showStatus(text().missingBindingStatus, { tone: 'error' });
  }

  function applyInputSnapshot(): void {
    if (saving) return;
    const current = latestSnapshot ?? readSnapshot(options.getGame());
    if (!current) return;
    const next = readInputs(current);
    applySnapshot(next);
    syncInputsExceptActive(next);
  }

  function applySnapshot(snapshot: LightingDebugSnapshot): void {
    const sceneBuilder = options.getGame()?.getSceneBuilder();
    if (!sceneBuilder) return;
    sceneBuilder.applyHemisphericLight(snapshot.environment.light, { enabled: snapshot.environment.enabled });
    sceneBuilder.applyDirectionalLight(snapshot.directional.light, { enabled: snapshot.directional.enabled });
    latestSnapshot = cloneSnapshot(snapshot);
    syncReadout(snapshot);
  }

  function setInputs(snapshot: LightingDebugSnapshot): void {
    environmentEnabled.checked = snapshot.environment.enabled;
    directionalEnabled.checked = snapshot.directional.enabled;
    setNumberInput('environmentIntensity', snapshot.environment.light.intensity);
    setColorInput('environmentDiffuseColor', snapshot.environment.light.diffuseColor ?? { r: 1, g: 1, b: 1 });
    setColorInput('environmentGroundColor', snapshot.environment.light.groundColor ?? { r: 0.48, g: 0.52, b: 0.62 });
    const angles = readDirectionalLightAngles(snapshot.directional.light.direction);
    setNumberInput('directionalIntensity', snapshot.directional.light.intensity);
    setNumberInput('directionalHorizontalAngle', angles.horizontalAngleDeg);
    setNumberInput('directionalElevationAngle', angles.elevationAngleDeg);
    setColorInput('directionalDiffuseColor', snapshot.directional.light.diffuseColor ?? { r: 1, g: 1, b: 1 });
  }

  function syncInputsExceptActive(snapshot: LightingDebugSnapshot): void {
    const active = ownerDocument.activeElement;
    if (active !== environmentEnabled) environmentEnabled.checked = snapshot.environment.enabled;
    if (active !== directionalEnabled) directionalEnabled.checked = snapshot.directional.enabled;
    for (const field of numberInputs.keys()) {
      const input = numberInputs.get(field);
      if (!input || active === input) continue;
      setNumberInput(field, readNumberSnapshotField(snapshot, field));
    }
    for (const field of colorInputs.keys()) {
      const input = colorInputs.get(field);
      if (!input || active === input) continue;
      setColorInput(field, readColorSnapshotField(snapshot, field));
    }
  }

  function readInputs(fallback: LightingDebugSnapshot): LightingDebugSnapshot {
    const horizontalAngle = readNumberInput('directionalHorizontalAngle', readDirectionalLightAngles(fallback.directional.light.direction).horizontalAngleDeg);
    const elevationAngle = readNumberInput('directionalElevationAngle', readDirectionalLightAngles(fallback.directional.light.direction).elevationAngleDeg);
    const direction = createDirectionalLightDirectionFromAngles(horizontalAngle, elevationAngle);
    return {
      environment: {
        ...fallback.environment,
        enabled: environmentEnabled.checked,
        light: {
          type: 'hemispheric',
          intensity: Math.max(0, readNumberInput('environmentIntensity', fallback.environment.light.intensity)),
          diffuseColor: readColorInput('environmentDiffuseColor', fallback.environment.light.diffuseColor ?? { r: 1, g: 1, b: 1 }),
          groundColor: readColorInput('environmentGroundColor', fallback.environment.light.groundColor ?? { r: 0.48, g: 0.52, b: 0.62 }),
        },
      },
      directional: {
        ...fallback.directional,
        enabled: directionalEnabled.checked,
        light: {
          type: 'directional',
          intensity: Math.max(0, readNumberInput('directionalIntensity', fallback.directional.light.intensity)),
          direction,
          diffuseColor: readColorInput('directionalDiffuseColor', fallback.directional.light.diffuseColor ?? { r: 1, g: 1, b: 1 }),
        },
      },
      shadow: {
        ...fallback.shadow,
        projectedLengthMultiplier: readProjectedLengthMultiplier(direction),
      },
    };
  }

  function setNumberInput(field: NumberField, value: number): void {
    const input = numberInputs.get(field);
    if (input) input.value = String(roundNumber(value));
  }

  function readNumberInput(field: NumberField, fallback: number): number {
    const input = numberInputs.get(field);
    if (!input) return fallback;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return fallback;
    const config = findNumberConfig(field);
    const min = config.min ?? Number.NEGATIVE_INFINITY;
    const max = config.max ?? Number.POSITIVE_INFINITY;
    return Math.min(max, Math.max(min, value));
  }

  function setColorInput(field: ColorField, value: ColorRGB): void {
    const input = colorInputs.get(field);
    if (input) input.value = colorToHex(value);
  }

  function readColorInput(field: ColorField, fallback: ColorRGB): ColorRGB {
    const input = colorInputs.get(field);
    return input ? hexToColor(input.value, fallback) : fallback;
  }

  function syncReadout(snapshot: LightingDebugSnapshot): void {
    const direction = snapshot.directional.light.direction;
    rawDirection.textContent = `x ${formatNumber(direction.x)}  y ${formatNumber(direction.y)}  z ${formatNumber(direction.z)}`;
    shadowStatus.textContent = `${formatEditorSceneLightingShadowMode(snapshot.shadow.mode, text())}\nshadow length x${formatNumber(snapshot.shadow.projectedLengthMultiplier)}`;
  }

  function renderOpenState(): void {
    panel.style.display = open ? 'block' : 'none';
    toggleButton.style.background = open ? 'rgba(29, 78, 216, 0.9)' : 'rgba(15, 23, 42, 0.88)';
    if (!open) hideDebugTooltip();
  }

  function renderLanguage(): void {
    const copy = text();
    const hints = tooltips();
    title.textContent = copy.title;
    modeLabel.textContent = copy.runtime;
    languageButton.textContent = copy.languageButton;
    setDebugTooltip(languageButton, hints.languageButton);
    setDebugTooltip(toggleButton, hints.toggleTitle);
    toggleButton.setAttribute('aria-label', hints.toggleTitle);
    environmentTitle.textContent = copy.environmentSection;
    directionalTitle.textContent = copy.directionalSection;
    labelRows.environmentEnabled.textContent = copy.enabled;
    labelRows.environmentIntensity.textContent = copy.intensity;
    labelRows.environmentDiffuseColor.textContent = copy.skyLightColor;
    labelRows.environmentGroundColor.textContent = copy.groundColor;
    labelRows.directionalEnabled.textContent = copy.enabled;
    labelRows.directionalIntensity.textContent = copy.intensity;
    labelRows.directionalHorizontalAngle.textContent = copy.horizontalAngle;
    labelRows.directionalElevationAngle.textContent = copy.elevationAngle;
    labelRows.directionalDiffuseColor.textContent = copy.lightColor;
    labelRows.rawDirection.textContent = copy.rawDirection;
    labelRows.shadowReadout.textContent = copy.shadowReadout;

    setDebugTooltip(environmentEnabled, hints.enabled);
    setDebugTooltip(labelRows.environmentEnabled, hints.enabled);
    setDebugTooltip(labelRows.environmentIntensity, hints.environmentIntensity);
    setDebugTooltip(environmentIntensity, hints.environmentIntensity);
    setDebugTooltip(labelRows.environmentDiffuseColor, hints.skyLightColor);
    setDebugTooltip(environmentDiffuseColor, hints.skyLightColor);
    setDebugTooltip(labelRows.environmentGroundColor, hints.groundColor);
    setDebugTooltip(environmentGroundColor, hints.groundColor);
    setDebugTooltip(directionalEnabled, hints.enabled);
    setDebugTooltip(labelRows.directionalEnabled, hints.enabled);
    setDebugTooltip(labelRows.directionalIntensity, hints.directionalIntensity);
    setDebugTooltip(directionalIntensity, hints.directionalIntensity);
    setDebugTooltip(labelRows.directionalHorizontalAngle, hints.horizontalAngle);
    setDebugTooltip(directionalHorizontalAngle, hints.horizontalAngle);
    setDebugTooltip(labelRows.directionalElevationAngle, hints.elevationAngle);
    setDebugTooltip(directionalElevationAngle, hints.elevationAngle);
    setDebugTooltip(labelRows.directionalDiffuseColor, hints.lightColor);
    setDebugTooltip(directionalDiffuseColor, hints.lightColor);
    setDebugTooltip(labelRows.rawDirection, hints.rawDirection);
    setDebugTooltip(rawDirection, hints.rawDirection);
    setDebugTooltip(labelRows.shadowReadout, hints.shadowReadout);
    setDebugTooltip(shadowStatus, hints.shadowReadout);
    resetButton.textContent = copy.reset;
    setDebugTooltip(resetButton, hints.reset);
    saveButton.textContent = copy.save;
    setDebugTooltip(saveButton, hints.save);
    if (latestSnapshot) syncReadout(latestSnapshot);
  }

  function setDebugTooltip(element: HTMLElement, message: string): void {
    const value = message.trim();
    if (!value) {
      delete element.dataset.lightingDebugTooltip;
      element.removeAttribute('title');
      return;
    }
    element.dataset.lightingDebugTooltip = value;
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
    return value instanceof HTMLElement ? value.closest<HTMLElement>('[data-lighting-debug-tooltip]') : null;
  }

  function scheduleDebugTooltip(target: HTMLElement): void {
    const message = target.dataset.lightingDebugTooltip?.trim();
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
    }, TOOLTIP_DELAY_MS) ?? 0;
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
    const active = ownerDocument.activeElement;
    return active === languageButton
      || active === environmentEnabled
      || active === directionalEnabled
      || [...numberInputs.values()].includes(active as HTMLInputElement)
      || [...colorInputs.values()].includes(active as HTMLInputElement);
  }

  function text(): LightingDebugText {
    return readEditorSceneLightingDebugText(language);
  }

  function tooltips(): LightingDebugTooltipText {
    return readEditorSceneLightingDebugTooltipText(language);
  }

  renderLanguage();
  renderOpenState();
  frameHandle = ownerDocument.defaultView?.requestAnimationFrame(tick) ?? window.requestAnimationFrame(tick);

  return {
    dispose() {
      disposed = true;
      if (frameHandle) ownerDocument.defaultView?.cancelAnimationFrame(frameHandle);
      if (statusTimeout) ownerDocument.defaultView?.clearTimeout(statusTimeout);
      clearDebugTooltipTimer();
      container.remove();
      debugTooltip.remove();
    },
  };
}

function readSnapshot(game: Game | null): LightingDebugSnapshot | null {
  const sceneBuilder = game?.getSceneBuilder();
  if (!sceneBuilder) return null;
  const environmentState = sceneBuilder.getSelectedHemisphericLightState();
  const directionalState = sceneBuilder.getSelectedDirectionalLightState();
  const environmentLight = sceneBuilder.getRuntimeHemisphericLight();
  const directionalLight = sceneBuilder.getRuntimeDirectionalLight();
  if (!environmentLight || !directionalLight) return null;
  const direction = {
    x: readFiniteNumber(directionalLight.direction?.x, directionalState.light.direction.x),
    y: readFiniteNumber(directionalLight.direction?.y, directionalState.light.direction.y),
    z: readFiniteNumber(directionalLight.direction?.z, directionalState.light.direction.z),
  };
  return {
    environment: {
      enabled: environmentLight.isEnabled?.() ?? environmentState.enabled,
      light: {
        type: 'hemispheric',
        intensity: readFiniteNumber(environmentLight.intensity, environmentState.light.intensity),
        diffuseColor: color3ToColor(environmentLight.diffuse, environmentState.light.diffuseColor ?? { r: 1, g: 1, b: 1 }),
        groundColor: color3ToColor(environmentLight.groundColor, environmentState.light.groundColor ?? { r: 0.48, g: 0.52, b: 0.62 }),
      },
      binding: readEditorSceneRuntimeLightBinding(environmentLight.metadata, 'hemispheric') as RuntimeLightEditorBinding | null,
    },
    directional: {
      enabled: directionalLight.isEnabled?.() ?? directionalState.enabled,
      light: {
        type: 'directional',
        intensity: readFiniteNumber(directionalLight.intensity, directionalState.light.intensity),
        direction,
        diffuseColor: color3ToColor(directionalLight.diffuse, directionalState.light.diffuseColor ?? { r: 1, g: 1, b: 1 }),
      },
      binding: readEditorSceneRuntimeLightBinding(directionalLight.metadata, 'directional') as RuntimeLightEditorBinding | null,
    },
    shadow: {
      mode: readRuntimeShadowMode(game),
      projectedLengthMultiplier: readProjectedLengthMultiplier(direction),
    },
  };
}

function readRuntimeShadowMode(game: Game | null): RuntimeShadowMode {
  const mode = game?.getShadowService()?.getShadowMode?.();
  return mode === 'planar' || mode === 'legacy' || mode === 'none' ? mode : 'unknown';
}

function createSection(ownerDocument: Document): HTMLElement {
  const section = ownerDocument.createElement('section');
  section.style.cssText = [
    'padding:9px',
    'border:1px solid rgba(148, 163, 184, 0.2)',
    'border-radius:7px',
    'background:rgba(15, 23, 42, 0.36)',
  ].join(';');
  return section;
}

function createSectionTitle(ownerDocument: Document): HTMLDivElement {
  const title = ownerDocument.createElement('div');
  title.style.cssText = 'margin-bottom:8px;font-size:12px;font-weight:800;color:#f8fafc;';
  return title;
}

function createGrid(ownerDocument: Document): HTMLDivElement {
  const grid = ownerDocument.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 126px;gap:7px 8px;align-items:center;';
  return grid;
}

function createLabel(ownerDocument: Document): HTMLLabelElement {
  const label = ownerDocument.createElement('label');
  label.style.cssText = 'font-size:11px;color:#cbd5e1;';
  return label;
}

function createCheckbox(ownerDocument: Document): HTMLInputElement {
  const input = ownerDocument.createElement('input');
  input.type = 'checkbox';
  input.style.cssText = 'width:18px;height:18px;margin:0;accent-color:#60a5fa;';
  return input;
}

function createNumberInput(ownerDocument: Document, config: NumberFieldConfig): HTMLInputElement {
  const input = ownerDocument.createElement('input');
  input.type = 'number';
  input.step = String(config.step);
  if (config.min != null) input.min = String(config.min);
  if (config.max != null) input.max = String(config.max);
  input.inputMode = 'decimal';
  input.style.cssText = createInputStyle('126px');
  return input;
}

function createColorInput(ownerDocument: Document): HTMLInputElement {
  const input = ownerDocument.createElement('input');
  input.type = 'color';
  input.style.cssText = [
    'width:48px',
    'height:28px',
    'box-sizing:border-box',
    'border:1px solid rgba(148, 163, 184, 0.34)',
    'border-radius:6px',
    'background:rgba(15, 23, 42, 0.84)',
    'padding:2px',
    'cursor:pointer',
  ].join(';');
  return input;
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

function createInputStyle(width: string): string {
  return [
    `width:${width}`,
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
}

function color3ToColor(value: unknown, fallback: ColorRGB): ColorRGB {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    r: readFiniteNumber(record.r, fallback.r),
    g: readFiniteNumber(record.g, fallback.g),
    b: readFiniteNumber(record.b, fallback.b),
  };
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function formatErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message ? `${fallback}: ${message}` : fallback;
}
