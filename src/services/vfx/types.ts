import type { Scene } from '@babylonjs/core/scene';

export type Awaitable<T> = T | Promise<T>;
export type VfxParams = Record<string, unknown>;
export type VfxOwner = string | number | symbol | object;
export type VfxServiceState =
  | 'collecting'
  | 'preparing'
  | 'prepared'
  | 'warming'
  | 'ready'
  | 'failed'
  | 'disposed';

export interface VfxVector3Like {
  x: number;
  y: number;
  z: number;
}

export interface VfxPlacement {
  parent?: unknown;
  position?: VfxVector3Like;
  rotation?: VfxVector3Like;
  scale?: number | VfxVector3Like;
  offsetIsLocal?: boolean;
  renderingGroupId?: number;
  inputs?: Readonly<Record<string, unknown>>;
}

export interface VfxPrepareContext {
  scene: Scene;
  effectId: string;
}

export interface VfxInstanceContext extends VfxPrepareContext {
  instanceIndex: number;
}

export interface VfxWarmupContext extends VfxInstanceContext {
  renderFrame(): Promise<void>;
}

export type VfxRecycleReason = 'warmup' | 'complete' | 'release' | 'owner-release' | 'play-failed' | 'dispose';

export interface VfxRecycleContext extends VfxInstanceContext {
  reason: VfxRecycleReason;
}

export interface VfxPlayRequest<TParams extends VfxParams = VfxParams> {
  effectId: string;
  params: Readonly<TParams>;
  owner?: VfxOwner;
  placement?: VfxPlacement;
  source: 'runtime' | 'debug';
}

export interface VfxPlaybackLifecycle {
  complete(): void;
}

export interface ProjectVfxEffectDefinition<
  TInstance = unknown,
  TParams extends VfxParams = VfxParams,
> {
  id: string;
  prepare(context: VfxPrepareContext): Awaitable<void>;
  createInstance(context: VfxInstanceContext): Awaitable<TInstance>;
  warmup(instance: TInstance, context: VfxWarmupContext): Awaitable<void>;
  play(instance: TInstance, request: VfxPlayRequest<TParams>, lifecycle: VfxPlaybackLifecycle): void;
  recycle(instance: TInstance, context: VfxRecycleContext): void;
  destroy(instance: TInstance, context: VfxInstanceContext): void;
  dispose(context: VfxPrepareContext): void;
}

export type AnyProjectVfxEffectDefinition = ProjectVfxEffectDefinition<any, any>;

export type VfxDeclaredLifecycle = 'one-shot' | 'persistent' | 'mixed';

export interface VfxEffectRuntimeConfig {
  schemaVersion: 'project-vfx-runtime/1.0';
  effectId: string;
  displayName?: string;
  poolSize: number;
  expectedPeak: number;
  lifecycle: VfxDeclaredLifecycle;
}

export interface VfxDebugParameterDefinition {
  key: string;
  label?: string;
  kind?: 'number' | 'boolean' | 'color' | 'text' | 'json' | 'select';
  min?: number;
  max?: number;
  step?: number;
  options?: readonly { value: string; label?: string }[];
}

export interface VfxEffectRegistration {
  definition: AnyProjectVfxEffectDefinition;
  config: VfxEffectRuntimeConfig;
  defaultParams?: VfxParams;
  debugParameters?: VfxDebugParameterDefinition[];
}

export interface VfxBudgetConfig {
  schemaVersion: 'project-vfx-budget/1.0';
  status: 'unconfirmed' | 'confirmed';
  globalActiveLimit: number;
  expectedGlobalPeak: number;
  notes?: string;
}

export interface VfxServiceOptions {
  scene: Scene;
  budget: VfxBudgetConfig;
  renderWarmupFrame?: () => Promise<void>;
}

export type VfxRejectionCode =
  | 'not-ready'
  | 'unknown-effect'
  | 'pool-exhausted'
  | 'global-budget-exhausted'
  | 'play-failed';

export interface VfxPlaybackHandle {
  readonly leaseId: string;
  readonly effectId: string;
  readonly owner?: VfxOwner;
  readonly active: boolean;
  release(): boolean;
}

export type VfxPlayResult =
  | { ok: true; handle: VfxPlaybackHandle }
  | { ok: false; code: VfxRejectionCode; effectId: string; message: string };

export interface VfxPlayOptions {
  params?: VfxParams;
  owner?: VfxOwner;
  placement?: VfxPlacement;
  source?: 'runtime' | 'debug';
}

export interface VfxEffectDiagnostics {
  effectId: string;
  displayName: string;
  lifecycle: VfxDeclaredLifecycle;
  status: 'registered' | 'prepared' | 'ready' | 'failed';
  configuredCapacity: number;
  effectiveCapacity: number;
  expectedPeak: number;
  active: number;
  available: number;
  peakActive: number;
  created: number;
  warmed: number;
  acquired: number;
  recycled: number;
  completed: number;
  rejected: number;
  failedInstances: number;
  prepareMs: number;
  warmupMs: number;
  lastRejection?: VfxRejectionCode;
  lastError?: string;
}

export interface VfxDiagnosticsSnapshot {
  state: VfxServiceState;
  registryFrozen: boolean;
  budget: {
    status: VfxBudgetConfig['status'];
    globalActiveLimit: number;
    expectedGlobalPeak: number;
    active: number;
    peakActive: number;
    rejected: number;
    conflict: string | null;
  };
  effects: VfxEffectDiagnostics[];
  lastError?: string;
}

export interface VfxRegisteredEffectInfo {
  effectId: string;
  displayName: string;
  config: Readonly<VfxEffectRuntimeConfig>;
  defaultParams: Readonly<VfxParams>;
  debugParameters: readonly VfxDebugParameterDefinition[];
}
