import {
  PROJECT_GAMEPLAY_CONFIG,
  type ProjectFlightTuningValues,
} from './projectGameplayConfig';

const runtimeDrafts = new Map<string, ProjectFlightTuningValues>();

export function getProjectFlightEffectIds(): string[] {
  return [
    ...new Set([
      ...Object.keys(PROJECT_GAMEPLAY_CONFIG.flightTuning),
      ...runtimeDrafts.keys(),
    ]),
  ];
}

export function getFlightTuning(effectId: string): ProjectFlightTuningValues {
  return sanitizeFlightTuningValues({
    ...(PROJECT_GAMEPLAY_CONFIG.flightTuning[effectId] ?? {}),
    ...(runtimeDrafts.get(effectId) ?? {}),
  });
}

export function getFlightTuningValue(effectId: string, key: string): number {
  return getFlightTuningNumber(effectId, key);
}

export function getFlightTuningNumber(effectId: string, key: string, fallback?: number): number {
  const value = getFlightTuning(effectId)[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
  throw new Error(`[projectFlightTuning] Missing flightTuning.${effectId}.${key} in project gameplay config`);
}

export function setRuntimeFlightTuningPreview(effectId: string, values: ProjectFlightTuningValues): void {
  if (!import.meta.env.DEV) return;
  runtimeDrafts.set(effectId, sanitizeFlightTuningValues(values));
}

export function resetRuntimeFlightTuningPreview(effectId: string): void {
  if (!import.meta.env.DEV) return;
  runtimeDrafts.delete(effectId);
}

export function sanitizeFlightTuningValues(values: ProjectFlightTuningValues): ProjectFlightTuningValues {
  const result: ProjectFlightTuningValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
}
