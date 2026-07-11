import type { RuntimeInspectorBuildIdentity } from './schema';

export type RuntimeInspectorCameraOwnerAcquireContext = {
  leaseId: string;
  owner: string;
  reason: string | null;
  timeoutMs: number;
};

export type RuntimeInspectorCameraOwnerLease = {
  restoreState: unknown;
  stateBefore: unknown;
};

export type RuntimeInspectorCameraControlProvider = {
  id: string;
  acquire(context: RuntimeInspectorCameraOwnerAcquireContext): RuntimeInspectorCameraOwnerLease;
  restore(restoreState: unknown): void;
  readState?(): unknown;
};

export type RuntimeInspectorProviderRegistration = {
  buildIdentity?: () => Partial<RuntimeInspectorBuildIdentity> | null | undefined;
  cameraControl?: RuntimeInspectorCameraControlProvider;
};

type RegisteredProvider = {
  id: number;
  registration: RuntimeInspectorProviderRegistration;
};

let nextProviderId = 1;
const providers: RegisteredProvider[] = [];

export function registerRuntimeInspectorProviders(
  registration: RuntimeInspectorProviderRegistration,
): () => void {
  const id = nextProviderId++;
  providers.push({ id, registration });
  return () => {
    const index = providers.findIndex(provider => provider.id === id);
    if (index >= 0) providers.splice(index, 1);
  };
}

export function readRuntimeInspectorBuildIdentity(mode: string): RuntimeInspectorBuildIdentity {
  const identity: RuntimeInspectorBuildIdentity = {
    mode,
    commit: null,
    branch: null,
    worktree: null,
    buildId: null,
    dirty: null,
  };

  for (const provider of providers) {
    try {
      const contribution = provider.registration.buildIdentity?.();
      if (!contribution) continue;
      assignNullableString(identity, 'commit', contribution.commit);
      assignNullableString(identity, 'branch', contribution.branch);
      assignNullableString(identity, 'worktree', contribution.worktree);
      assignNullableString(identity, 'buildId', contribution.buildId);
      if (typeof contribution.dirty === 'boolean') identity.dirty = contribution.dirty;
      if (typeof contribution.mode === 'string' && contribution.mode.trim()) {
        identity.mode = contribution.mode.trim();
      }
    } catch (error) {
      console.warn('[runtime-inspector] buildIdentity provider failed', error);
    }
  }

  return identity;
}

export function readRuntimeInspectorCameraControlProvider(): RuntimeInspectorCameraControlProvider | null {
  for (let index = providers.length - 1; index >= 0; index -= 1) {
    const provider = providers[index]?.registration.cameraControl;
    if (provider) return provider;
  }
  return null;
}

export function clearRuntimeInspectorProviders(): void {
  providers.length = 0;
}

function assignNullableString(
  target: RuntimeInspectorBuildIdentity,
  key: 'commit' | 'branch' | 'worktree' | 'buildId',
  value: string | null | undefined,
): void {
  if (typeof value === 'string' && value.trim()) target[key] = value.trim();
}
