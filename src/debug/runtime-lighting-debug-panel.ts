import type { ColorRGB, SceneDirectionalLightConfig, SceneHemisphericLightConfig } from '../config';
import type { Game } from '../core/Game';
import type { RuntimeLightEditorBinding, RuntimeLightingPatch } from './runtime-lighting-save';
import { saveRuntimeLightsToEditorScene } from './runtime-lighting-save';
import {
  LIGHT_DIRECTION_ELEVATION_MAX_DEG,
  LIGHT_DIRECTION_ELEVATION_MIN_DEG,
  createDirectionalLightDirectionFromAngles,
  normalizeDirectionVector,
  readDirectionalLightAngles,
} from '../fps-game-editor-adapter/editor-lighting-utils';

export interface RuntimeLightingDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export interface RuntimeLightingDebugPanel {
  dispose(): void;
}

type LightingDebugLanguage = 'zh' | 'en';
type NumberField =
  | 'environmentIntensity'
  | 'directionalIntensity'
  | 'directionalHorizontalAngle'
  | 'directionalElevationAngle';
type ColorField = 'environmentDiffuseColor' | 'environmentGroundColor' | 'directionalDiffuseColor';

interface RuntimeLightSnapshot<TLight extends SceneHemisphericLightConfig | SceneDirectionalLightConfig> {
  enabled: boolean;
  light: TLight;
  binding: RuntimeLightEditorBinding | null;
}

interface LightingDebugSnapshot {
  environment: RuntimeLightSnapshot<SceneHemisphericLightConfig>;
  directional: RuntimeLightSnapshot<SceneDirectionalLightConfig>;
  shadow: {
    mode: RuntimeShadowMode;
    projectedLengthMultiplier: number;
  };
}

type RuntimeShadowMode = 'none' | 'legacy' | 'planar' | 'unknown';

type LightingDebugText = Record<
  | 'title'
  | 'runtime'
  | 'languageButton'
  | 'toggleTitle'
  | 'environmentSection'
  | 'directionalSection'
  | 'enabled'
  | 'intensity'
  | 'skyLightColor'
  | 'groundColor'
  | 'horizontalAngle'
  | 'elevationAngle'
  | 'lightColor'
  | 'rawDirection'
  | 'shadowReadout'
  | 'shadowPlanarFollow'
  | 'shadowLegacy'
  | 'shadowNone'
  | 'shadowUnknown'
  | 'reset'
  | 'save'
  | 'resetStatus'
  | 'savingStatus'
  | 'savedStatus'
  | 'saveFailed'
  | 'missingBindingStatus',
  string
>;

type LightingDebugTooltipText = Record<
  | 'languageButton'
  | 'toggleTitle'
  | 'enabled'
  | 'environmentIntensity'
  | 'directionalIntensity'
  | 'skyLightColor'
  | 'groundColor'
  | 'horizontalAngle'
  | 'elevationAngle'
  | 'lightColor'
  | 'rawDirection'
  | 'shadowReadout'
  | 'reset'
  | 'save',
  string
>;

type NumberFieldConfig = {
  field: NumberField;
  step: number;
  min?: number;
  max?: number;
  textKey: keyof LightingDebugText;
  tooltipKey: keyof LightingDebugTooltipText;
};

const LIGHTING_DEBUG_STORAGE_KEY = 'pa-template.lighting-debug.open';
const LIGHTING_DEBUG_LANGUAGE_STORAGE_KEY = 'pa-template.lighting-debug.language';
const TOOLTIP_DELAY_MS = 320;

const NUMBER_FIELDS: ReadonlyArray<NumberFieldConfig> = [
  { field: 'environmentIntensity', textKey: 'intensity', tooltipKey: 'environmentIntensity', step: 0.05, min: 0 },
  { field: 'directionalIntensity', textKey: 'intensity', tooltipKey: 'directionalIntensity', step: 0.05, min: 0 },
  { field: 'directionalHorizontalAngle', textKey: 'horizontalAngle', tooltipKey: 'horizontalAngle', step: 1, min: -180, max: 180 },
  { field: 'directionalElevationAngle', textKey: 'elevationAngle', tooltipKey: 'elevationAngle', step: 1, min: LIGHT_DIRECTION_ELEVATION_MIN_DEG, max: LIGHT_DIRECTION_ELEVATION_MAX_DEG },
];

const LIGHTING_DEBUG_TEXT: Record<LightingDebugLanguage, LightingDebugText> = {
  zh: {
    title: '光照调试',
    runtime: '运行时',
    languageButton: 'EN',
    toggleTitle: '打开光照调试面板',
    environmentSection: '环境光',
    directionalSection: '直射光',
    enabled: '启用',
    intensity: '强度',
    skyLightColor: '天空光颜色',
    groundColor: '地面颜色',
    horizontalAngle: '水平角',
    elevationAngle: '高度角',
    lightColor: '光照颜色',
    rawDirection: '原始方向',
    shadowReadout: '阴影',
    shadowPlanarFollow: 'Planar / 跟随直射光',
    shadowLegacy: 'Legacy ShadowGenerator',
    shadowNone: 'Off',
    shadowUnknown: 'Unknown',
    reset: '重置参数',
    save: '保存参数',
    resetStatus: '已重置为初始运行时光照。',
    savingStatus: '正在保存光照参数...',
    savedStatus: '已保存光照参数，正在重新加载...',
    saveFailed: '保存失败',
    missingBindingStatus: '缺少光源绑定，只能临时预览，不能保存。',
  },
  en: {
    title: 'Lighting Debug',
    runtime: 'Runtime',
    languageButton: '中文',
    toggleTitle: 'Toggle lighting debug panel',
    environmentSection: 'Environment Light',
    directionalSection: 'Directional Light',
    enabled: 'Enabled',
    intensity: 'Intensity',
    skyLightColor: 'Sky Light Color',
    groundColor: 'Ground Color',
    horizontalAngle: 'Horizontal Angle',
    elevationAngle: 'Elevation Angle',
    lightColor: 'Light Color',
    rawDirection: 'Raw Direction',
    shadowReadout: 'Shadow',
    shadowPlanarFollow: 'Planar / Follow Directional Light',
    shadowLegacy: 'Legacy ShadowGenerator',
    shadowNone: 'Off',
    shadowUnknown: 'Unknown',
    reset: 'Reset',
    save: 'Save Lights',
    resetStatus: 'Reset to initial runtime lighting.',
    savingStatus: 'Saving lighting...',
    savedStatus: 'Saved lighting. Reloading...',
    saveFailed: 'Save failed',
    missingBindingStatus: 'Light binding missing; preview only, saving disabled.',
  },
};

const LIGHTING_DEBUG_TOOLTIPS: Record<LightingDebugLanguage, LightingDebugTooltipText> = {
  zh: {
    languageButton: '切换光照调试面板的显示语言。',
    toggleTitle: '打开或关闭运行时光照调试面板。',
    enabled: '启用或禁用对应的运行时光源，保存后写回编辑器场景。',
    environmentIntensity: '环境光强度，对应 BabylonJS HemisphericLight.intensity。',
    directionalIntensity: '直射光强度，对应 BabylonJS DirectionalLight.intensity。',
    skyLightColor: '环境光来自天空方向的漫反射颜色。',
    groundColor: '环境光来自地面反射方向的颜色。',
    horizontalAngle: '直射光在 XZ 平面内的朝向角度，会转换为 DirectionalLight.direction。',
    elevationAngle: '直射光相对地平线的高度角；90 度表示从正上方照下。',
    lightColor: '直射光漫反射颜色。',
    rawDirection: '只读方向向量，用于排查运行时转换结果。',
    shadowReadout: '只读阴影状态；planar 阴影跟随当前直射光角度。',
    reset: '恢复为打开运行时时读取到的初始光照参数。',
    save: '通过编辑器保存链路写回 Environment Light 与 Directional Light，然后重新加载运行时。',
  },
  en: {
    languageButton: 'Switch the lighting debug panel language.',
    toggleTitle: 'Open or close the runtime lighting debug panel.',
    enabled: 'Enable or disable the runtime light and save it back to the editor scene.',
    environmentIntensity: 'Environment intensity. Maps to BabylonJS HemisphericLight.intensity.',
    directionalIntensity: 'Directional intensity. Maps to BabylonJS DirectionalLight.intensity.',
    skyLightColor: 'Diffuse sky color for the environment light.',
    groundColor: 'Ground bounce color for the environment light.',
    horizontalAngle: 'Directional heading in the XZ plane, converted to DirectionalLight.direction.',
    elevationAngle: 'Directional elevation above the horizon; 90 degrees points straight down.',
    lightColor: 'Directional diffuse color.',
    rawDirection: 'Read-only direction vector for checking runtime conversion.',
    shadowReadout: 'Read-only shadow status; planar shadows follow the current Directional Light angles.',
    reset: 'Restore the lighting captured when runtime opened.',
    save: 'Save Environment Light and Directional Light through the editor authoring pipeline, then reload runtime.',
  },
};

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

  function readNumberSnapshotField(snapshot: LightingDebugSnapshot, field: NumberField): number {
    switch (field) {
      case 'environmentIntensity': return snapshot.environment.light.intensity;
      case 'directionalIntensity': return snapshot.directional.light.intensity;
      case 'directionalHorizontalAngle': return readDirectionalLightAngles(snapshot.directional.light.direction).horizontalAngleDeg;
      case 'directionalElevationAngle': return readDirectionalLightAngles(snapshot.directional.light.direction).elevationAngleDeg;
    }
  }

  function readColorSnapshotField(snapshot: LightingDebugSnapshot, field: ColorField): ColorRGB {
    switch (field) {
      case 'environmentDiffuseColor': return snapshot.environment.light.diffuseColor ?? { r: 1, g: 1, b: 1 };
      case 'environmentGroundColor': return snapshot.environment.light.groundColor ?? { r: 0.48, g: 0.52, b: 0.62 };
      case 'directionalDiffuseColor': return snapshot.directional.light.diffuseColor ?? { r: 1, g: 1, b: 1 };
    }
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
    shadowStatus.textContent = `${formatShadowMode(snapshot.shadow.mode)}\nshadow length x${formatNumber(snapshot.shadow.projectedLengthMultiplier)}`;
  }

  function formatShadowMode(mode: RuntimeShadowMode): string {
    const copy = text();
    if (mode === 'planar') return copy.shadowPlanarFollow;
    if (mode === 'legacy') return copy.shadowLegacy;
    if (mode === 'none') return copy.shadowNone;
    return copy.shadowUnknown;
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
    return LIGHTING_DEBUG_TEXT[language] ?? LIGHTING_DEBUG_TEXT.zh;
  }

  function tooltips(): LightingDebugTooltipText {
    return LIGHTING_DEBUG_TOOLTIPS[language] ?? LIGHTING_DEBUG_TOOLTIPS.zh;
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
      binding: readLightEditorBinding(environmentLight.metadata, 'hemispheric'),
    },
    directional: {
      enabled: directionalLight.isEnabled?.() ?? directionalState.enabled,
      light: {
        type: 'directional',
        intensity: readFiniteNumber(directionalLight.intensity, directionalState.light.intensity),
        direction,
        diffuseColor: color3ToColor(directionalLight.diffuse, directionalState.light.diffuseColor ?? { r: 1, g: 1, b: 1 }),
      },
      binding: readLightEditorBinding(directionalLight.metadata, 'directional'),
    },
    shadow: {
      mode: readRuntimeShadowMode(game),
      projectedLengthMultiplier: readProjectedLengthMultiplier(direction),
    },
  };
}

function readLightEditorBinding(metadata: unknown, expectedType: SceneHemisphericLightConfig['type'] | SceneDirectionalLightConfig['type']): RuntimeLightEditorBinding | null {
  const fpsEditor = readRecord(readRecord(metadata)?.__fpsEditor);
  const sourceId = readNonEmptyString(fpsEditor?.sourceId);
  const objectGuid = readNonEmptyString(fpsEditor?.objectGuid);
  const objectId = readNonEmptyString(fpsEditor?.objectId);
  const propertyPath = readNonEmptyString(fpsEditor?.propertyPath);
  const lightType = readNonEmptyString(fpsEditor?.lightType);
  if (!sourceId || propertyPath !== 'light' || (!objectGuid && !objectId)) return null;
  if (lightType && lightType !== expectedType) return null;
  return {
    sourceId,
    propertyPath: 'light',
    lightType: expectedType,
    ...(objectGuid ? { objectGuid } : {}),
    ...(objectId ? { objectId } : {}),
  };
}

function canSaveSnapshot(snapshot: LightingDebugSnapshot): boolean {
  return !!snapshot.environment.binding && !!snapshot.directional.binding;
}

function readRuntimeShadowMode(game: Game | null): RuntimeShadowMode {
  const mode = game?.getShadowService()?.getShadowMode?.();
  return mode === 'planar' || mode === 'legacy' || mode === 'none' ? mode : 'unknown';
}

function readProjectedLengthMultiplier(direction: SceneDirectionalLightConfig['direction']): number {
  const normalized = normalizeDirectionVector(direction);
  const vertical = Math.abs(normalized.y);
  if (vertical <= 0.000001) return 999;
  return Math.min(999, Math.hypot(normalized.x, normalized.z) / vertical);
}

function toRuntimeLightingPatches(snapshot: LightingDebugSnapshot): RuntimeLightingPatch[] {
  if (!snapshot.environment.binding || !snapshot.directional.binding) return [];
  return [
    {
      binding: snapshot.environment.binding,
      enabled: snapshot.environment.enabled,
      light: snapshot.environment.light,
    },
    {
      binding: snapshot.directional.binding,
      enabled: snapshot.directional.enabled,
      light: snapshot.directional.light,
    },
  ];
}

function cloneSnapshot(snapshot: LightingDebugSnapshot): LightingDebugSnapshot {
  return {
    environment: {
      enabled: snapshot.environment.enabled,
      binding: snapshot.environment.binding ? { ...snapshot.environment.binding } : null,
      light: {
        type: 'hemispheric',
        intensity: snapshot.environment.light.intensity,
        ...(snapshot.environment.light.diffuseColor ? { diffuseColor: { ...snapshot.environment.light.diffuseColor } } : {}),
        ...(snapshot.environment.light.groundColor ? { groundColor: { ...snapshot.environment.light.groundColor } } : {}),
      },
    },
    directional: {
      enabled: snapshot.directional.enabled,
      binding: snapshot.directional.binding ? { ...snapshot.directional.binding } : null,
      light: {
        type: 'directional',
        intensity: snapshot.directional.light.intensity,
        direction: { ...snapshot.directional.light.direction },
        ...(snapshot.directional.light.diffuseColor ? { diffuseColor: { ...snapshot.directional.light.diffuseColor } } : {}),
      },
    },
    shadow: { ...snapshot.shadow },
  };
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

function findNumberConfig(field: NumberField): NumberFieldConfig {
  const config = NUMBER_FIELDS.find(entry => entry.field === field);
  if (!config) throw new Error(`Missing lighting number field config: ${field}`);
  return config;
}

function color3ToColor(value: unknown, fallback: ColorRGB): ColorRGB {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    r: readFiniteNumber(record.r, fallback.r),
    g: readFiniteNumber(record.g, fallback.g),
    b: readFiniteNumber(record.b, fallback.b),
  };
}

function colorToHex(color: ColorRGB): string {
  const toByte = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255)));
  return `#${[toByte(color.r), toByte(color.g), toByte(color.b)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToColor(value: string, fallback: ColorRGB): ColorRGB {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return fallback;
  const hex = match[1];
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function roundNumber(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number, digits = 3): string {
  return value.toFixed(digits);
}

function formatErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message ? `${fallback}: ${message}` : fallback;
}

function readStoredOpen(win: Window | null): boolean {
  try {
    return win?.localStorage.getItem(LIGHTING_DEBUG_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredOpen(win: Window | null, value: boolean): void {
  try {
    win?.localStorage.setItem(LIGHTING_DEBUG_STORAGE_KEY, String(value));
  } catch {
    // localStorage can be unavailable in embedded previews.
  }
}

function readStoredLanguage(win: Window | null): LightingDebugLanguage {
  try {
    return win?.localStorage.getItem(LIGHTING_DEBUG_LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

function writeStoredLanguage(win: Window | null, value: LightingDebugLanguage): void {
  try {
    win?.localStorage.setItem(LIGHTING_DEBUG_LANGUAGE_STORAGE_KEY, value);
  } catch {
    // localStorage can be unavailable in embedded previews.
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
