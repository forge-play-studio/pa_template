import {
  DEFAULT_DIRECTIONAL_LIGHT_DIRECTION,
  LIGHT_DIRECTION_ELEVATION_MAX_DEG,
  LIGHT_DIRECTION_ELEVATION_MIN_DEG,
  LIGHT_DIRECTION_HORIZONTAL_MAX_DEG,
  LIGHT_DIRECTION_HORIZONTAL_MIN_DEG,
  createDirectionalLightDirectionFromAngles as createRendererDirectionalLightDirectionFromAngles,
  normalizeDirectionVector as normalizeRendererDirectionVector,
  readDirectionalLightAngles as readRendererDirectionalLightAngles,
} from '@fps-games/babylon-renderer';

export interface EditorLightingVec3 {
  x: number;
  y: number;
  z: number;
}

export {
  DEFAULT_DIRECTIONAL_LIGHT_DIRECTION,
  LIGHT_DIRECTION_ELEVATION_MAX_DEG,
  LIGHT_DIRECTION_ELEVATION_MIN_DEG,
  LIGHT_DIRECTION_HORIZONTAL_MAX_DEG,
  LIGHT_DIRECTION_HORIZONTAL_MIN_DEG,
};

export const LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH = 'light.directionHorizontalAngleDeg';
export const LIGHT_DIRECTION_ELEVATION_ANGLE_PATH = 'light.directionElevationAngleDeg';

export function isDirectionalLightAnglePath(path: string): boolean {
  return path === LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH || path === LIGHT_DIRECTION_ELEVATION_ANGLE_PATH;
}

export function normalizeDirectionalLightAngleValue(path: string, value: unknown): unknown {
  const numeric = readFiniteInspectorNumber(value);
  if (numeric == null) return value;
  if (path === LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH) return Math.round(normalizeAngleDegrees(numeric));
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
  return normalizeRendererDirectionVector(direction, fallback) as EditorLightingVec3;
}

export function readDirectionalLightAngles(direction: EditorLightingVec3 | undefined): {
  horizontalAngleDeg: number;
  elevationAngleDeg: number;
} {
  return readRendererDirectionalLightAngles(direction);
}

export function createDirectionalLightDirectionFromAngles(
  horizontalAngleDeg: number,
  elevationAngleDeg: number,
): EditorLightingVec3 {
  return createRendererDirectionalLightDirectionFromAngles(
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

function normalizeAngleDegrees(value: number): number {
  const normalized = ((((value + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
}
