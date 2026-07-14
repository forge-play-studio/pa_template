import type { Scene } from '@babylonjs/core/scene';
import type { VfxEffectRegistration } from './types.ts';
import type { VfxPoolManager } from './VfxPoolManager.ts';

export interface PreparedVfxRegistration {
  registration: VfxEffectRegistration;
  prepareMs: number;
}

export async function prepareVfxRegistrations(
  registrations: readonly VfxEffectRegistration[],
  scene: Scene,
  isCancelled: () => boolean = () => false,
): Promise<PreparedVfxRegistration[]> {
  const prepared: PreparedVfxRegistration[] = [];
  for (const registration of registrations) {
    if (isCancelled()) {
      disposePreparedVfxRegistrations(prepared, scene);
      throw new Error('VFX initialization was cancelled because the service was disposed.');
    }
    const startedAt = performance.now();
    try {
      await registration.definition.prepare({
        scene,
        effectId: registration.config.effectId,
      });
      if (isCancelled()) {
        throw new Error('VFX initialization was cancelled because the service was disposed.');
      }
    } catch (error) {
      disposeRegistration(registration, scene);
      disposePreparedVfxRegistrations(prepared, scene);
      throw error;
    }
    prepared.push({
      registration,
      prepareMs: performance.now() - startedAt,
    });
  }
  return prepared;
}

export function disposePreparedVfxRegistrations(
  prepared: readonly PreparedVfxRegistration[],
  scene: Scene,
  onError: (error: unknown) => void = error => console.warn('[VfxService] shared VFX disposal failed', error),
): void {
  for (let index = prepared.length - 1; index >= 0; index -= 1) {
    disposeRegistration(prepared[index]!.registration, scene, onError);
  }
}

function disposeRegistration(
  registration: VfxEffectRegistration,
  scene: Scene,
  onError: (error: unknown) => void = error => console.warn('[VfxService] shared VFX disposal failed', error),
): void {
  try {
    registration.definition.dispose({
      scene,
      effectId: registration.config.effectId,
    });
  } catch (error) {
    onError(error);
  }
}

export async function warmVfxRegistrations(
  prepared: readonly PreparedVfxRegistration[],
  poolManager: VfxPoolManager,
): Promise<void> {
  for (const entry of prepared) {
    const pool = poolManager.addPreparedRegistration(entry.registration, entry.prepareMs);
    await pool.createAndWarm();
  }
}
