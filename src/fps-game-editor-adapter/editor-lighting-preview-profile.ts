import type {
  EditorSceneDocument,
  EditorSceneGameObject,
  EditorSceneLight,
  EditorSceneVec3,
} from './editor-scene-document';
import {
  DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT,
  DEFAULT_EDITOR_SCENE_SUN_LIGHT,
  EDITOR_SCENE_ENVIRONMENT_LIGHT_ID,
  EDITOR_SCENE_SUN_LIGHT_ID,
} from './editor-scene-session';

type EditorLightingPreviewColor = { r: number; g: number; b: number };

export interface EditorLightingPreviewProfile {
  clearColor: { r: number; g: number; b: number; a: number };
  sky: {
    enabled: boolean;
    topColor: EditorLightingPreviewColor;
    horizonColor: EditorLightingPreviewColor;
    bottomColor: EditorLightingPreviewColor;
    cloudColor: EditorLightingPreviewColor;
    cloudStrength: number;
    sunColor: EditorLightingPreviewColor;
    sunDirection: EditorSceneVec3;
  };
  grid: {
    gridColor: EditorLightingPreviewColor;
    majorGridColor: EditorLightingPreviewColor;
    axisXColor: EditorLightingPreviewColor;
    axisZColor: EditorLightingPreviewColor;
  };
}

const NIGHT_CLEAR_COLOR = { r: 0.035, g: 0.045, b: 0.06 };
const NIGHT_SKY_TOP = { r: 0.045, g: 0.06, b: 0.09 };
const NIGHT_SKY_HORIZON = { r: 0.09, g: 0.11, b: 0.14 };
const NIGHT_SKY_BOTTOM = { r: 0.055, g: 0.06, b: 0.07 };
const DEFAULT_SUN_SOURCE_DIRECTION = { x: 0.3, y: 1, z: 0.2 };

export function resolveEditorLightingPreviewProfile(
  document: EditorSceneDocument,
): EditorLightingPreviewProfile {
  const environmentObject = findEditorSceneLightObject(document, EDITOR_SCENE_ENVIRONMENT_LIGHT_ID);
  const sunObject = findEditorSceneLightObject(document, EDITOR_SCENE_SUN_LIGHT_ID);
  const environmentLight = readHemisphericLight(environmentObject?.light);
  const sunLight = readDirectionalLight(sunObject?.light);
  const environmentIntensity = environmentObject?.active === false
    ? 0
    : clamp(environmentLight.intensity, 0, 4);
  const sunIntensity = sunObject?.active === false
    ? 0
    : clamp(sunLight.intensity, 0, 4);

  const skyLight = scaleColor(readColor(environmentLight.diffuseColor, { r: 1, g: 1, b: 1 }), environmentIntensity);
  const groundLight = scaleColor(
    readColor(environmentLight.groundColor, DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT.groundColor ?? { r: 0.48, g: 0.52, b: 0.62 }),
    environmentIntensity,
  );
  const sunLightColor = scaleColor(readColor(sunLight.diffuseColor, { r: 1, g: 1, b: 1 }), sunIntensity);
  const ambientLevel = clamp(environmentIntensity / 1.2, 0, 1);
  const sunLevel = clamp(sunIntensity / 3, 0, 1);
  const skyTint = toneMapColor(addColors(scaleColor(skyLight, 0.82), scaleColor(sunLightColor, 0.12)));
  const groundTint = toneMapColor(addColors(scaleColor(groundLight, 0.82), scaleColor(sunLightColor, 0.05)));
  const clearTint = toneMapColor(addColors(scaleColor(skyLight, 0.48), scaleColor(sunLightColor, 0.08)));
  const clearBlend = clamp(0.12 + ambientLevel * 0.54 + sunLevel * 0.08, 0, 0.78);
  const gridTint = toneMapColor(mixColor(groundTint, skyTint, 0.38));
  const gridBlend = clamp(0.16 + ambientLevel * 0.42 + sunLevel * 0.08, 0.12, 0.68);

  return {
    clearColor: {
      ...mixColor(NIGHT_CLEAR_COLOR, clearTint, clearBlend),
      a: 1,
    },
    sky: {
      enabled: true,
      topColor: mixColor(NIGHT_SKY_TOP, skyTint, clamp(0.22 + ambientLevel * 0.68, 0, 0.9)),
      horizonColor: mixColor(NIGHT_SKY_HORIZON, toneMapColor(addColors(scaleColor(skyTint, 0.66), scaleColor(groundTint, 0.34))), clamp(0.28 + ambientLevel * 0.58, 0, 0.9)),
      bottomColor: mixColor(NIGHT_SKY_BOTTOM, groundTint, clamp(0.18 + ambientLevel * 0.62, 0, 0.85)),
      cloudColor: mixColor({ r: 0.28, g: 0.3, b: 0.34 }, toneMapColor(addColors(scaleColor(skyTint, 0.45), scaleColor(sunLightColor, 0.25))), clamp(0.3 + sunLevel * 0.52, 0, 0.82)),
      cloudStrength: clamp(0.12 + ambientLevel * 0.24 + sunLevel * 0.16, 0.08, 0.46),
      sunColor: toneMapColor(addColors(scaleColor(sunLightColor, 0.78), scaleColor(skyTint, 0.12))),
      sunDirection: normalizeVec3({
        x: -sunLight.direction.x,
        y: -sunLight.direction.y,
        z: -sunLight.direction.z,
      }, DEFAULT_SUN_SOURCE_DIRECTION),
    },
    grid: {
      gridColor: mixColor({ r: 0.07, g: 0.1, b: 0.15 }, gridTint, gridBlend),
      majorGridColor: mixColor({ r: 0.12, g: 0.16, b: 0.23 }, scaleColor(gridTint, 1.18), gridBlend),
      axisXColor: mixColor({ r: 0.52, g: 0.12, b: 0.14 }, toneMapColor(addColors(scaleColor(gridTint, 0.4), { r: 0.5, g: 0.08, b: 0.08 })), clamp(0.22 + ambientLevel * 0.32, 0, 0.58)),
      axisZColor: mixColor({ r: 0.1, g: 0.32, b: 0.58 }, toneMapColor(addColors(scaleColor(gridTint, 0.42), { r: 0.08, g: 0.22, b: 0.55 })), clamp(0.22 + ambientLevel * 0.32, 0, 0.58)),
    },
  };
}

function findEditorSceneLightObject(
  document: EditorSceneDocument,
  id: string,
): EditorSceneGameObject | undefined {
  return document.scene.gameObjects.find(gameObject => gameObject.id === id);
}

function readHemisphericLight(light: EditorSceneLight | undefined) {
  if (light?.type !== 'hemispheric') return DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT;
  return {
    ...DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT,
    ...light,
  };
}

function readDirectionalLight(light: EditorSceneLight | undefined) {
  if (light?.type !== 'directional') return DEFAULT_EDITOR_SCENE_SUN_LIGHT;
  return {
    ...DEFAULT_EDITOR_SCENE_SUN_LIGHT,
    ...light,
  };
}

function readColor(
  color: Partial<EditorLightingPreviewColor> | undefined,
  fallback: EditorLightingPreviewColor,
): EditorLightingPreviewColor {
  return {
    r: readFiniteNumber(color?.r, fallback.r),
    g: readFiniteNumber(color?.g, fallback.g),
    b: readFiniteNumber(color?.b, fallback.b),
  };
}

function addColors(left: EditorLightingPreviewColor, right: EditorLightingPreviewColor): EditorLightingPreviewColor {
  return {
    r: left.r + right.r,
    g: left.g + right.g,
    b: left.b + right.b,
  };
}

function scaleColor(color: EditorLightingPreviewColor, scale: number): EditorLightingPreviewColor {
  return {
    r: color.r * scale,
    g: color.g * scale,
    b: color.b * scale,
  };
}

function mixColor(
  from: EditorLightingPreviewColor,
  to: EditorLightingPreviewColor,
  amount: number,
): EditorLightingPreviewColor {
  const t = clamp01(amount);
  return {
    r: clamp01(from.r + (to.r - from.r) * t),
    g: clamp01(from.g + (to.g - from.g) * t),
    b: clamp01(from.b + (to.b - from.b) * t),
  };
}

function toneMapColor(color: EditorLightingPreviewColor): EditorLightingPreviewColor {
  return {
    r: toneMap(color.r),
    g: toneMap(color.g),
    b: toneMap(color.b),
  };
}

function toneMap(value: number): number {
  const normalized = Math.max(0, Number.isFinite(value) ? value : 0);
  return clamp01(normalized / (1 + normalized * 0.42));
}

function normalizeVec3(value: EditorSceneVec3, fallback: EditorSceneVec3): EditorSceneVec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(length) || length <= 0.000001) return fallback;
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  };
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
