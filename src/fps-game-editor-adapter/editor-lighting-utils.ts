export interface EditorLightingVec3 {
  x: number;
  y: number;
  z: number;
}

export const DEFAULT_DIRECTIONAL_LIGHT_DIRECTION: EditorLightingVec3 = { x: -0.3, y: -1, z: -0.2 };
export const LIGHT_DIRECTION_HORIZONTAL_ANGLE_PATH = 'light.directionHorizontalAngleDeg';
export const LIGHT_DIRECTION_ELEVATION_ANGLE_PATH = 'light.directionElevationAngleDeg';
export const LIGHT_DIRECTION_HORIZONTAL_MIN_DEG = -180;
export const LIGHT_DIRECTION_HORIZONTAL_MAX_DEG = 180;
export const LIGHT_DIRECTION_ELEVATION_MIN_DEG = -90;
export const LIGHT_DIRECTION_ELEVATION_MAX_DEG = 90;

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
  const candidate = direction && isVec3(direction) ? direction : fallback;
  const length = Math.hypot(candidate.x, candidate.y, candidate.z);
  if (!Number.isFinite(length) || length <= 0.000001) {
    const fallbackLength = Math.hypot(fallback.x, fallback.y, fallback.z) || 1;
    return {
      x: fallback.x / fallbackLength,
      y: fallback.y / fallbackLength,
      z: fallback.z / fallbackLength,
    };
  }
  return {
    x: candidate.x / length,
    y: candidate.y / length,
    z: candidate.z / length,
  };
}

export function readDirectionalLightAngles(direction: EditorLightingVec3 | undefined): {
  horizontalAngleDeg: number;
  elevationAngleDeg: number;
} {
  const normalized = normalizeDirectionVector(direction);
  return {
    horizontalAngleDeg: Math.round(normalizeAngleDegrees(radiansToDegrees(Math.atan2(normalized.z, normalized.x)))),
    elevationAngleDeg: Math.round(radiansToDegrees(Math.asin(clampNumber(-normalized.y, -1, 1)))),
  };
}

export function createDirectionalLightDirectionFromAngles(
  horizontalAngleDeg: number,
  elevationAngleDeg: number,
): EditorLightingVec3 {
  const horizontal = degreesToRadians(normalizeAngleDegrees(horizontalAngleDeg));
  const elevation = degreesToRadians(clampNumber(
    elevationAngleDeg,
    LIGHT_DIRECTION_ELEVATION_MIN_DEG,
    LIGHT_DIRECTION_ELEVATION_MAX_DEG,
  ));
  const horizontalLength = Math.cos(elevation);
  return {
    x: roundForInspector(horizontalLength * Math.cos(horizontal)),
    y: roundForInspector(-Math.sin(elevation)),
    z: roundForInspector(horizontalLength * Math.sin(horizontal)),
  };
}

function isVec3(value: unknown): value is EditorLightingVec3 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.x === 'number'
    && Number.isFinite(record.x)
    && typeof record.y === 'number'
    && Number.isFinite(record.y)
    && typeof record.z === 'number'
    && Number.isFinite(record.z);
}

function readFiniteInspectorNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function roundForInspector(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngleDegrees(value: number): number {
  const normalized = ((((value + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
}
