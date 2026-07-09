const MILLISECONDS_PER_SECOND = 1000;

export const DEFAULT_ENGINE_RENDER_DELTA_TIME_SECONDS = 1 / 60;

export function pinEngineDeltaTimeForFrame(engine: unknown, deltaTimeSeconds: number): number {
  if (!engine || typeof engine !== 'object') {
    throw new Error('pinEngineDeltaTimeForFrame requires a Babylon engine object.');
  }
  if (!Number.isFinite(deltaTimeSeconds) || deltaTimeSeconds < 0) {
    throw new Error(`pinEngineDeltaTimeForFrame requires a finite non-negative dt, got ${deltaTimeSeconds}.`);
  }

  const deltaTimeMs = deltaTimeSeconds * MILLISECONDS_PER_SECOND;
  (engine as { _deltaTime: number })._deltaTime = deltaTimeMs;
  return deltaTimeMs;
}
