import type {
  RuntimeInspectorBuildIdentity,
  RuntimeInspectorCoverage,
  RuntimeInspectorObjectHandle,
  RuntimeInspectorSnapshotCaptureSpec,
} from './schema';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { Material } from '@babylonjs/core/Materials/material';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';

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

export type RuntimeInspectorLogicalObjectDescriptor = {
  id: string;
  name: string;
  kind: string;
  root: TransformNode;
  members?: TransformNode[];
  tags?: string[];
  metadata?: unknown;
  source: string;
};

export type RuntimeInspectorLogicalObjectProvider = {
  id: string;
  list(): RuntimeInspectorLogicalObjectDescriptor[];
};

export type RuntimeInspectorSnapshotProviderContext = {
  scene: Scene;
  nodes: TransformNode[];
  handles: RuntimeInspectorObjectHandle[];
  spec: RuntimeInspectorSnapshotCaptureSpec;
};

export type RuntimeInspectorSnapshotProviderCapture = {
  data: unknown;
  observed?: string[];
  unavailable?: RuntimeInspectorCoverage['unavailable'];
  warnings?: string[];
};

export type RuntimeInspectorSnapshotProvider = {
  id: string;
  capture(context: RuntimeInspectorSnapshotProviderContext): RuntimeInspectorSnapshotProviderCapture;
};

export type RuntimeInspectorVfxEffectDescriptor = {
  id: string;
  name: string;
  placement: string;
  geometrySpace?: string | null;
  requiredInputs?: string[];
  optionalInputs?: string[];
  defaultParams?: unknown;
  paramDefinitions?: unknown[];
  metadata?: unknown;
  source: string;
};

export type RuntimeInspectorVfxUsageDescriptor = {
  id: string;
  label: string;
  effectId: string;
  placement: string;
  lifecycle: string;
  binding?: unknown;
  params?: unknown;
  offset?: unknown;
  /** undefined = provider cannot observe instances; null = observed inactive. */
  root?: TransformNode | null;
  source: string;
};

export type RuntimeInspectorVfxProvider = {
  id: string;
  listEffects(): RuntimeInspectorVfxEffectDescriptor[];
  listUsages(): RuntimeInspectorVfxUsageDescriptor[];
  captureUsageState?(usageId: string): unknown;
  previewUsage?(usageId: string, params: Record<string, unknown>): boolean;
  restoreUsageState?(usageId: string, state: unknown): boolean;
};

export type RuntimeInspectorMaterialAssetDescriptor = {
  id: string;
  name: string;
  kind: string;
  profile?: unknown;
  readonly?: boolean;
  origin?: unknown;
  metadata?: unknown;
  source: string;
};

export type RuntimeInspectorMaterialInstanceDescriptor = {
  id: string;
  material: Material;
  source: string;
};

export type RuntimeInspectorMaterialProvider = {
  id: string;
  listAssets(): RuntimeInspectorMaterialAssetDescriptor[];
  listInstances(): RuntimeInspectorMaterialInstanceDescriptor[];
  captureInstanceState?(instanceId: string): unknown;
  previewInstance?(instanceId: string, set: Record<string, unknown>): boolean;
  restoreInstanceState?(instanceId: string, state: unknown): boolean;
};

export type RuntimeInspectorAnimationGroupDescriptor = {
  id: string;
  group: AnimationGroup;
  source: string;
};

export type RuntimeInspectorAnimationProvider = {
  id: string;
  listGroups(): RuntimeInspectorAnimationGroupDescriptor[];
  captureGroupState?(groupId: string): unknown;
  previewGroup?(groupId: string, set: { paused?: boolean; currentFrame?: number; speedRatio?: number }): boolean;
  restoreGroupState?(groupId: string, state: unknown): boolean;
};

export type RuntimeInspectorProviderRegistration = {
  buildIdentity?: () => Partial<RuntimeInspectorBuildIdentity> | null | undefined;
  cameraControl?: RuntimeInspectorCameraControlProvider;
  logicalObjects?: RuntimeInspectorLogicalObjectProvider;
  snapshot?: RuntimeInspectorSnapshotProvider;
  vfx?: RuntimeInspectorVfxProvider;
  materials?: RuntimeInspectorMaterialProvider;
  animations?: RuntimeInspectorAnimationProvider;
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

export function readRuntimeInspectorLogicalObjectProviders(): RuntimeInspectorLogicalObjectProvider[] {
  return providers
    .map(provider => provider.registration.logicalObjects)
    .filter((provider): provider is RuntimeInspectorLogicalObjectProvider => Boolean(provider));
}

export function readRuntimeInspectorSnapshotProviders(): RuntimeInspectorSnapshotProvider[] {
  return providers
    .map(provider => provider.registration.snapshot)
    .filter((provider): provider is RuntimeInspectorSnapshotProvider => Boolean(provider));
}

export function readRuntimeInspectorVfxProviders(): RuntimeInspectorVfxProvider[] {
  return providers
    .map(provider => provider.registration.vfx)
    .filter((provider): provider is RuntimeInspectorVfxProvider => Boolean(provider));
}

export function readRuntimeInspectorMaterialProviders(): RuntimeInspectorMaterialProvider[] {
  return providers
    .map(provider => provider.registration.materials)
    .filter((provider): provider is RuntimeInspectorMaterialProvider => Boolean(provider));
}

export function readRuntimeInspectorAnimationProviders(): RuntimeInspectorAnimationProvider[] {
  return providers
    .map(provider => provider.registration.animations)
    .filter((provider): provider is RuntimeInspectorAnimationProvider => Boolean(provider));
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
