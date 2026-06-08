import {
  EDITOR_SCENE_DEFAULT_DIRECTIONAL_LIGHT_DIRECTION,
  EDITOR_SCENE_LIGHT_DIRECTION_ELEVATION_MAX_DEG,
  EDITOR_SCENE_LIGHT_DIRECTION_ELEVATION_MIN_DEG,
  EDITOR_SCENE_LIGHT_DIRECTION_HORIZONTAL_MAX_DEG,
  EDITOR_SCENE_LIGHT_DIRECTION_HORIZONTAL_MIN_DEG,
  createEditorSceneDirectionalLightDirectionFromAngles,
  normalizeEditorSceneLightDirectionVector,
  normalizeEditorSceneLightingAngleDegrees,
  readEditorSceneDirectionalLightAngles,
} from '@fps-games/editor/playable-sdk';

export interface EditorLightingVec3 {
  x: number;
  y: number;
  z: number;
}

export const DEFAULT_DIRECTIONAL_LIGHT_DIRECTION = EDITOR_SCENE_DEFAULT_DIRECTIONAL_LIGHT_DIRECTION;
export const LIGHT_DIRECTION_ELEVATION_MAX_DEG = EDITOR_SCENE_LIGHT_DIRECTION_ELEVATION_MAX_DEG;
export const LIGHT_DIRECTION_ELEVATION_MIN_DEG = EDITOR_SCENE_LIGHT_DIRECTION_ELEVATION_MIN_DEG;
export const LIGHT_DIRECTION_HORIZONTAL_MAX_DEG = EDITOR_SCENE_LIGHT_DIRECTION_HORIZONTAL_MAX_DEG;
export const LIGHT_DIRECTION_HORIZONTAL_MIN_DEG = EDITOR_SCENE_LIGHT_DIRECTION_HORIZONTAL_MIN_DEG;

export const LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH = 'light.directionHorizontalAngleDeg';
export const LIGHT_DIRECTION_ELEVATION_ANGLE_PATH = 'light.directionElevationAngleDeg';

export function isDirectionalLightAnglePath(path: string): boolean {
  return path === LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH || path === LIGHT_DIRECTION_ELEVATION_ANGLE_PATH;
}

export function normalizeDirectionalLightAngleValue(path: string, value: unknown): unknown {
  const numeric = readFiniteInspectorNumber(value);
  if (numeric == null) return value;
  if (path === LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH) return Math.round(normalizeEditorSceneLightingAngleDegrees(numeric));
  if (path === LIGHT_DIRECTION_ELEVATION_ANGLE_PATH) {
    return Math.round(clampNumber(
      numeric,
      LIGHT_DIRECTION_ELEVATION_MIN_DEG,
      LIGHT_DIRECTION_ELEVATION_MAX_DEG,
    ));
  }
  return value;
}

export function normalizeDirectionVector(
  direction: EditorLightingVec3 | undefined,
  fallback: EditorLightingVec3 = DEFAULT_DIRECTIONAL_LIGHT_DIRECTION,
): EditorLightingVec3 {
  return normalizeEditorSceneLightDirectionVector(direction, fallback) as EditorLightingVec3;
}

export function readDirectionalLightAngles(direction: EditorLightingVec3 | undefined): {
  horizontalAngleDeg: number;
  elevationAngleDeg: number;
} {
  return readEditorSceneDirectionalLightAngles(direction);
}

export function createDirectionalLightDirectionFromAngles(
  horizontalAngleDeg: number,
  elevationAngleDeg: number,
): EditorLightingVec3 {
  return createEditorSceneDirectionalLightDirectionFromAngles(
    horizontalAngleDeg,
    elevationAngleDeg,
  ) as EditorLightingVec3;
}

function readFiniteInspectorNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
