import type { Scene } from '@babylonjs/core/scene';
import { VfxEffectPool } from './VfxEffectPool.ts';
import type { VfxEffectDiagnostics, VfxEffectRegistration } from './types.ts';

export class VfxPoolManager {
  private readonly pools = new Map<string, VfxEffectPool>();
  private activeCount = 0;
  private disposed = false;

  constructor(
    private readonly scene: Scene,
    private readonly renderWarmupFrame: () => Promise<void>,
    private readonly onChanged: () => void,
  ) {}

  addPreparedRegistration(registration: VfxEffectRegistration, prepareMs: number): VfxEffectPool {
    if (this.disposed) throw new Error('VFX pool manager is disposed.');
    const effectId = registration.config.effectId;
    if (this.pools.has(effectId)) throw new Error(`VFX pool already exists: ${effectId}`);
    const pool = new VfxEffectPool(
      registration,
      this.scene,
      this.renderWarmupFrame,
      delta => { this.activeCount += delta; },
      this.onChanged,
    );
    pool.setPrepared(prepareMs);
    this.pools.set(effectId, pool);
    return pool;
  }

  get(effectId: string): VfxEffectPool | null {
    return this.pools.get(effectId) ?? null;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getDiagnostics(): VfxEffectDiagnostics[] {
    return [...this.pools.values()]
      .map(pool => pool.getDiagnostics())
      .sort((left, right) => left.effectId.localeCompare(right.effectId));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const pool of this.pools.values()) pool.dispose();
    this.pools.clear();
    this.activeCount = 0;
  }
}
