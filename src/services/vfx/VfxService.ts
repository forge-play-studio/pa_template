import { validateVfxBudget } from './VfxBudgetValidator.ts';
import { VfxDiagnostics, formatVfxError, type VfxDiagnosticsListener } from './VfxDiagnostics.ts';
import {
  prepareVfxRegistrations,
  disposePreparedVfxRegistrations,
  warmVfxRegistrations,
  type PreparedVfxRegistration,
} from './VfxLoadingPipeline.ts';
import { VfxPoolManager } from './VfxPoolManager.ts';
import type {
  VfxDiagnosticsSnapshot,
  VfxEffectDiagnostics,
  VfxEffectRegistration,
  VfxOwner,
  VfxPlaybackHandle,
  VfxPlayOptions,
  VfxPlayResult,
  VfxRegisteredEffectInfo,
  VfxRejectionCode,
  VfxServiceOptions,
  VfxServiceState,
} from './types.ts';

export class VfxService {
  private readonly options: VfxServiceOptions;
  private readonly registrations = new Map<string, VfxEffectRegistration>();
  private readonly diagnostics = new VfxDiagnostics();
  private readonly poolManager: VfxPoolManager;
  private readonly renderWarmupFrame: () => Promise<void>;
  private readonly leaseEffects = new Map<string, string>();
  private readonly leaseOwners = new Map<string, VfxOwner>();
  private readonly leasesByOwner = new Map<VfxOwner, Set<string>>();
  private state: VfxServiceState = 'collecting';
  private registryFrozen = false;
  private prepared: PreparedVfxRegistration[] = [];
  private preloadPromise: Promise<void> | null = null;
  private warmupPromise: Promise<void> | null = null;
  private leaseSequence = 0;
  private budgetConflict: string | null = null;

  constructor(options: VfxServiceOptions) {
    this.options = options;
    this.renderWarmupFrame = options.renderWarmupFrame ?? (async () => undefined);
    this.poolManager = new VfxPoolManager(
      options.scene,
      this.renderWarmupFrame,
      () => this.emitDiagnostics(),
    );
  }

  register(registration: VfxEffectRegistration): void {
    this.assertCollecting();
    const effectId = registration.config.effectId;
    if (this.registrations.has(effectId)) throw new Error(`Duplicate VFX registration: ${effectId}`);
    this.registrations.set(effectId, registration);
    this.emitDiagnostics();
  }

  registerAll(registrations: readonly VfxEffectRegistration[]): void {
    for (const registration of registrations) this.register(registration);
  }

  async init(): Promise<void> {
    await this.preload();
    await this.warmup();
  }

  async preload(): Promise<void> {
    if (this.state === 'prepared' || this.state === 'warming' || this.state === 'ready') return;
    if (this.state === 'preparing' && this.preloadPromise) return this.preloadPromise;
    this.assertUsableForInitialization();
    this.registryFrozen = true;

    const validation = validateVfxBudget([...this.registrations.values()], this.options.budget);
    this.budgetConflict = validation.conflict;
    if (!validation.valid) {
      const error = new Error(`VFX initialization rejected:\n- ${validation.errors.join('\n- ')}`);
      this.fail(error);
      throw error;
    }
    for (const warning of validation.warnings) console.warn(`[VfxService] ${warning}`);

    this.state = 'preparing';
    this.emitDiagnostics();
    const pending = prepareVfxRegistrations(
      [...this.registrations.values()],
      this.options.scene,
      () => this.state === 'disposed',
    ).then((prepared) => {
      if (this.state === 'disposed') {
        disposePreparedVfxRegistrations(prepared, this.options.scene);
        throw new Error('VFX initialization was cancelled because the service was disposed.');
      }
      this.prepared = prepared;
      this.state = 'prepared';
      this.emitDiagnostics();
    }).catch((error: unknown) => {
      if (this.state !== 'disposed') this.fail(error);
      throw error;
    });
    this.preloadPromise = pending;
    return pending;
  }

  async warmup(): Promise<void> {
    if (this.state === 'ready') return;
    if (this.state === 'collecting' || this.state === 'preparing') await this.preload();
    if (this.state === 'warming' && this.warmupPromise) return this.warmupPromise;
    if (this.state !== 'prepared') this.assertUsableForInitialization();

    this.state = 'warming';
    this.emitDiagnostics();
    const pending = warmVfxRegistrations(this.prepared, this.poolManager)
      .then(() => {
        if (this.state === 'disposed') {
          this.poolManager.dispose();
          this.disposePreparedResources();
          throw new Error('VFX initialization was cancelled because the service was disposed.');
        }
        this.state = 'ready';
        this.recordActive();
        this.emitDiagnostics();
      })
      .catch((error: unknown) => {
        this.poolManager.dispose();
        this.disposePreparedResources();
        if (this.state !== 'disposed') this.fail(error);
        throw error;
      });
    this.warmupPromise = pending;
    return pending;
  }

  play(effectId: string, options: VfxPlayOptions = {}): VfxPlayResult {
    if (this.state !== 'ready') return this.reject(effectId, 'not-ready', 'VFX service is not ready.');
    const pool = this.poolManager.get(effectId);
    const registration = this.registrations.get(effectId);
    if (!pool || !registration) return this.reject(effectId, 'unknown-effect', `Unknown VFX effect "${effectId}".`);

    if (this.poolManager.getActiveCount() >= this.options.budget.globalActiveLimit) {
      pool.recordRejection('global-budget-exhausted');
      return this.reject(
        effectId,
        'global-budget-exhausted',
        `VFX global active limit ${this.options.budget.globalActiveLimit} is exhausted.`,
      );
    }

    const leaseId = `${effectId}:${++this.leaseSequence}`;
    this.leaseEffects.set(leaseId, effectId);
    if (options.owner !== undefined) this.addOwnerLease(options.owner, leaseId);
    const request = {
      effectId,
      params: { ...(registration.defaultParams ?? {}), ...(options.params ?? {}) },
      ...(options.owner !== undefined ? { owner: options.owner } : {}),
      ...(options.placement ? { placement: options.placement } : {}),
      source: options.source ?? 'runtime' as const,
    };

    try {
      const started = pool.play(leaseId, request, () => this.releaseLease(leaseId, 'complete'));
      if (!started) {
        this.removeLeaseIndex(leaseId);
        return this.reject(effectId, 'pool-exhausted', `VFX pool "${effectId}" is exhausted.`);
      }
    } catch (error) {
      this.removeLeaseIndex(leaseId);
      this.diagnostics.recordError(error);
      return this.reject(effectId, 'play-failed', `VFX "${effectId}" play failed: ${formatVfxError(error)}`);
    }

    const service = this;
    const handle: VfxPlaybackHandle = {
      leaseId,
      effectId,
      ...(options.owner !== undefined ? { owner: options.owner } : {}),
      get active() { return service.isLeaseActive(leaseId); },
      release() { return service.release(handle); },
    };
    this.recordActive();
    this.emitDiagnostics();
    return { ok: true, handle };
  }

  release(handleOrLeaseId: VfxPlaybackHandle | string): boolean {
    const leaseId = typeof handleOrLeaseId === 'string' ? handleOrLeaseId : handleOrLeaseId.leaseId;
    return this.releaseLease(leaseId, 'release');
  }

  releaseByOwner(owner: VfxOwner): number {
    const leases = [...(this.leasesByOwner.get(owner) ?? [])];
    let released = 0;
    for (const leaseId of leases) {
      if (this.releaseLease(leaseId, 'owner-release')) released += 1;
    }
    return released;
  }

  isReady(): boolean {
    return this.state === 'ready';
  }

  getState(): VfxServiceState {
    return this.state;
  }

  getRegisteredEffects(): VfxRegisteredEffectInfo[] {
    return [...this.registrations.values()]
      .map(registration => ({
        effectId: registration.config.effectId,
        displayName: registration.config.displayName ?? registration.config.effectId,
        config: registration.config,
        defaultParams: registration.defaultParams ?? {},
        debugParameters: registration.debugParameters ?? [],
      }))
      .sort((left, right) => left.effectId.localeCompare(right.effectId));
  }

  getDiagnostics(): VfxDiagnosticsSnapshot {
    const active = this.poolManager.getActiveCount();
    const effects = this.createEffectDiagnostics();
    return {
      state: this.state,
      registryFrozen: this.registryFrozen,
      budget: {
        status: this.options.budget.status,
        globalActiveLimit: this.options.budget.globalActiveLimit,
        expectedGlobalPeak: this.options.budget.expectedGlobalPeak,
        active,
        peakActive: this.diagnostics.getPeakActive(),
        rejected: this.diagnostics.getRejected(),
        conflict: this.budgetConflict,
      },
      effects,
      ...(this.diagnostics.getLastError() ? { lastError: this.diagnostics.getLastError() } : {}),
    };
  }

  subscribeDiagnostics(listener: VfxDiagnosticsListener): () => void {
    const unsubscribe = this.diagnostics.subscribe(listener);
    listener(this.getDiagnostics());
    return unsubscribe;
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    const initializationInFlight = this.state === 'preparing' || this.state === 'warming';
    for (const leaseId of [...this.leaseEffects.keys()]) this.releaseLease(leaseId, 'dispose');
    this.poolManager.dispose();
    if (!initializationInFlight) this.disposePreparedResources();
    this.leaseEffects.clear();
    this.leaseOwners.clear();
    this.leasesByOwner.clear();
    this.state = 'disposed';
    this.emitDiagnostics();
  }

  private releaseLease(leaseId: string, reason: 'complete' | 'release' | 'owner-release' | 'dispose'): boolean {
    const effectId = this.leaseEffects.get(leaseId);
    if (!effectId) return false;
    const pool = this.poolManager.get(effectId);
    const released = pool?.release(leaseId, reason) ?? false;
    this.removeLeaseIndex(leaseId);
    this.recordActive();
    this.emitDiagnostics();
    return released;
  }

  private isLeaseActive(leaseId: string): boolean {
    const effectId = this.leaseEffects.get(leaseId);
    return !!effectId && !!this.poolManager.get(effectId)?.hasLease(leaseId);
  }

  private addOwnerLease(owner: VfxOwner, leaseId: string): void {
    this.leaseOwners.set(leaseId, owner);
    const leases = this.leasesByOwner.get(owner) ?? new Set<string>();
    leases.add(leaseId);
    this.leasesByOwner.set(owner, leases);
  }

  private removeLeaseIndex(leaseId: string): void {
    this.leaseEffects.delete(leaseId);
    const owner = this.leaseOwners.get(leaseId);
    this.leaseOwners.delete(leaseId);
    if (owner === undefined) return;
    const leases = this.leasesByOwner.get(owner);
    leases?.delete(leaseId);
    if (leases?.size === 0) this.leasesByOwner.delete(owner);
  }

  private reject(effectId: string, code: VfxRejectionCode, message: string): VfxPlayResult {
    this.diagnostics.recordRejection(code);
    this.emitDiagnostics();
    return { ok: false, code, effectId, message };
  }

  private recordActive(): void {
    this.diagnostics.recordActive(this.poolManager.getActiveCount());
  }

  private emitDiagnostics(): void {
    if (!this.diagnostics.hasListeners()) return;
    this.diagnostics.emit(this.getDiagnostics());
  }

  private createEffectDiagnostics(): VfxEffectDiagnostics[] {
    const pooled = this.poolManager.getDiagnostics();
    const pooledIds = new Set(pooled.map(effect => effect.effectId));
    for (const registration of this.registrations.values()) {
      if (pooledIds.has(registration.config.effectId)) continue;
      const prepared = this.prepared.find(entry => entry.registration.config.effectId === registration.config.effectId);
      pooled.push({
        effectId: registration.config.effectId,
        displayName: registration.config.displayName ?? registration.config.effectId,
        lifecycle: registration.config.lifecycle,
        status: this.state === 'failed' ? 'failed' : prepared ? 'prepared' : 'registered',
        configuredCapacity: registration.config.poolSize,
        effectiveCapacity: 0,
        expectedPeak: registration.config.expectedPeak,
        active: 0,
        available: 0,
        peakActive: 0,
        created: 0,
        warmed: 0,
        acquired: 0,
        recycled: 0,
        completed: 0,
        rejected: 0,
        failedInstances: 0,
        prepareMs: prepared?.prepareMs ?? 0,
        warmupMs: 0,
        ...(this.state === 'failed' && this.diagnostics.getLastError()
          ? { lastError: this.diagnostics.getLastError() }
          : {}),
      });
    }
    return pooled.sort((left, right) => left.effectId.localeCompare(right.effectId));
  }

  private fail(error: unknown): void {
    this.state = 'failed';
    this.diagnostics.recordError(error);
    this.emitDiagnostics();
  }

  private disposePreparedResources(): void {
    disposePreparedVfxRegistrations(
      this.prepared,
      this.options.scene,
      error => this.diagnostics.recordError(error),
    );
    this.prepared = [];
  }

  private assertCollecting(): void {
    if (this.state !== 'collecting' || this.registryFrozen) {
      throw new Error('VFX registrations are frozen; reload and register before init.');
    }
  }

  private assertUsableForInitialization(): void {
    if (this.state === 'failed') throw new Error('VFX service initialization already failed.');
    if (this.state === 'disposed') throw new Error('VFX service is disposed.');
  }
}
