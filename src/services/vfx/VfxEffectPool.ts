import type { Scene } from '@babylonjs/core/scene';
import { formatVfxError } from './VfxDiagnostics.ts';
import type {
  VfxEffectDiagnostics,
  VfxEffectRegistration,
  VfxPlayRequest,
  VfxRecycleReason,
} from './types.ts';

type PoolEntryState = 'warming' | 'idle' | 'active' | 'failed' | 'destroyed';

interface VfxPoolEntry {
  index: number;
  instance: unknown;
  state: PoolEntryState;
}

export class VfxEffectPool {
  private readonly entries: VfxPoolEntry[] = [];
  private readonly idleEntries: VfxPoolEntry[] = [];
  private readonly activeByLease = new Map<string, VfxPoolEntry>();
  private status: VfxEffectDiagnostics['status'] = 'registered';
  private prepareMs = 0;
  private warmupMs = 0;
  private peakActive = 0;
  private acquired = 0;
  private recycled = 0;
  private completed = 0;
  private rejected = 0;
  private failedInstances = 0;
  private lastRejection: VfxEffectDiagnostics['lastRejection'];
  private lastError: string | undefined;

  constructor(
    private readonly registration: VfxEffectRegistration,
    private readonly scene: Scene,
    private readonly renderWarmupFrame: () => Promise<void>,
    private readonly onActiveChanged: (delta: number) => void,
    private readonly onChanged: () => void,
  ) {}

  setPrepared(durationMs: number): void {
    this.status = 'prepared';
    this.prepareMs = durationMs;
    this.onChanged();
  }

  async createAndWarm(): Promise<void> {
    const startedAt = performance.now();
    try {
      for (let index = 0; index < this.registration.config.poolSize; index += 1) {
        const instance = await this.registration.definition.createInstance({
          scene: this.scene,
          effectId: this.registration.config.effectId,
          instanceIndex: index,
        });
        if (this.status === 'failed') {
          this.registration.definition.destroy(instance, {
            scene: this.scene,
            effectId: this.registration.config.effectId,
            instanceIndex: index,
          });
          throw new Error(`VFX pool "${this.registration.config.effectId}" was disposed during warmup.`);
        }
        this.entries.push({ index, instance, state: 'warming' });
      }

      for (const entry of this.entries) {
        this.assertNotDisposed();
        await this.registration.definition.warmup(entry.instance, {
          scene: this.scene,
          effectId: this.registration.config.effectId,
          instanceIndex: entry.index,
          renderFrame: this.renderWarmupFrame,
        });
        this.assertNotDisposed();
        await this.renderWarmupFrame();
        this.assertNotDisposed();
        await this.renderWarmupFrame();
        this.assertNotDisposed();
        this.recycleEntry(entry, 'warmup');
      }
      this.warmupMs = performance.now() - startedAt;
      this.status = 'ready';
      this.onChanged();
    } catch (error) {
      this.status = 'failed';
      this.lastError = formatVfxError(error);
      this.onChanged();
      throw error;
    }
  }

  play(leaseId: string, request: VfxPlayRequest, onComplete: () => void): boolean {
    const entry = this.idleEntries.pop();
    if (!entry) {
      this.recordRejection('pool-exhausted');
      return false;
    }

    entry.state = 'active';
    this.activeByLease.set(leaseId, entry);
    this.onActiveChanged(1);
    this.acquired += 1;
    this.peakActive = Math.max(this.peakActive, this.activeByLease.size);
    this.onChanged();

    try {
      this.registration.definition.play(entry.instance, request, {
        complete: () => {
          if (!this.activeByLease.has(leaseId)) return;
          this.completed += 1;
          onComplete();
        },
      });
      return true;
    } catch (error) {
      this.lastError = formatVfxError(error);
      this.release(leaseId, 'play-failed');
      throw error;
    }
  }

  release(leaseId: string, reason: VfxRecycleReason): boolean {
    const entry = this.activeByLease.get(leaseId);
    if (!entry) return false;
    this.activeByLease.delete(leaseId);
    this.onActiveChanged(-1);
    this.recycleEntry(entry, reason);
    this.onChanged();
    return true;
  }

  hasLease(leaseId: string): boolean {
    return this.activeByLease.has(leaseId);
  }

  getActiveCount(): number {
    return this.activeByLease.size;
  }

  recordRejection(code: VfxEffectDiagnostics['lastRejection']): void {
    this.rejected += 1;
    this.lastRejection = code;
    this.onChanged();
  }

  getDiagnostics(): VfxEffectDiagnostics {
    const available = this.idleEntries.length;
    const effectiveCapacity = this.entries.filter(entry => entry.state !== 'failed' && entry.state !== 'destroyed').length;
    return {
      effectId: this.registration.config.effectId,
      displayName: this.registration.config.displayName ?? this.registration.config.effectId,
      lifecycle: this.registration.config.lifecycle,
      status: this.status,
      configuredCapacity: this.registration.config.poolSize,
      effectiveCapacity,
      expectedPeak: this.registration.config.expectedPeak,
      active: this.activeByLease.size,
      available,
      peakActive: this.peakActive,
      created: this.entries.length,
      warmed: this.status === 'ready' ? effectiveCapacity : 0,
      acquired: this.acquired,
      recycled: this.recycled,
      completed: this.completed,
      rejected: this.rejected,
      failedInstances: this.failedInstances,
      prepareMs: this.prepareMs,
      warmupMs: this.warmupMs,
      ...(this.lastRejection ? { lastRejection: this.lastRejection } : {}),
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }

  dispose(): void {
    if (this.status === 'failed' && this.entries.length === 0) return;
    this.status = 'failed';
    for (const leaseId of [...this.activeByLease.keys()]) {
      this.release(leaseId, 'dispose');
    }
    for (const entry of this.entries) this.destroyEntry(entry);
    this.entries.length = 0;
    this.idleEntries.length = 0;
    this.activeByLease.clear();
    this.onChanged();
  }

  private recycleEntry(entry: VfxPoolEntry, reason: VfxRecycleReason): void {
    if (entry.state === 'failed' || entry.state === 'destroyed') return;
    try {
      this.registration.definition.recycle(entry.instance, {
        scene: this.scene,
        effectId: this.registration.config.effectId,
        instanceIndex: entry.index,
        reason,
      });
      entry.state = 'idle';
      this.idleEntries.push(entry);
      this.recycled += 1;
    } catch (error) {
      entry.state = 'failed';
      this.failedInstances += 1;
      this.lastError = formatVfxError(error);
      this.destroyEntry(entry);
      if (reason === 'warmup') throw error;
    }
  }

  private destroyEntry(entry: VfxPoolEntry): void {
    if (entry.state === 'destroyed') return;
    try {
      this.registration.definition.destroy(entry.instance, {
        scene: this.scene,
        effectId: this.registration.config.effectId,
        instanceIndex: entry.index,
      });
    } catch (error) {
      this.lastError = formatVfxError(error);
    } finally {
      entry.state = 'destroyed';
    }
  }

  private assertNotDisposed(): void {
    if (this.status === 'failed') {
      throw new Error(`VFX pool "${this.registration.config.effectId}" was disposed during warmup.`);
    }
  }
}
