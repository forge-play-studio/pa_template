export const FP3D_PROTOCOL_VERSION = '0.1' as const;
export const FP3D_OBSERVATION_VERSION = 'fp3d-observation.v0.1' as const;
export const FP3D_IMPLEMENTATION_NAME = 'pa-template-runtime-inspector' as const;
export const FP3D_IMPLEMENTATION_VERSION = '0.4.0' as const;

export type RuntimeInspectorErrorCode =
  | 'INVALID_QUERY'
  | 'INVALID_HANDLE'
  | 'RUNTIME_MISMATCH'
  | 'SCENE_MISMATCH'
  | 'STALE_HANDLE'
  | 'NOT_FOUND'
  | 'AMBIGUOUS'
  | 'INVALID_LEASE'
  | 'LEASE_CONFLICT'
  | 'UNAVAILABLE'
  | 'INTERNAL_ERROR';

export type RuntimeInspectorBuildIdentity = {
  mode: string;
  commit: string | null;
  branch: string | null;
  worktree: string | null;
  buildId: string | null;
  dirty: boolean | null;
};

export type RuntimeInspectorIdentity = {
  protocolVersion: typeof FP3D_PROTOCOL_VERSION;
  runtimeSessionId: string;
  implementation: {
    name: typeof FP3D_IMPLEMENTATION_NAME;
    version: string;
    bootedAt: string;
  };
  engine: {
    name: 'Babylon.js';
    version: string | null;
  };
  page: {
    url: string;
    origin: string;
    bootId: string;
  };
  build: RuntimeInspectorBuildIdentity;
  scene: {
    id: string;
    generation: number;
  };
  capabilities: Record<string, string>;
};

export type RuntimeInspectorCoverage = {
  observed: string[];
  unavailable: Array<{ channel: string; reason: string }>;
};

export type RuntimeInspectorObservation<T> = {
  schemaVersion: typeof FP3D_OBSERVATION_VERSION;
  ok: boolean;
  runtime: RuntimeInspectorIdentity;
  frame: {
    id: number | null;
    timeMs: number;
    phase: 'command';
  };
  data: T | null;
  coverage: RuntimeInspectorCoverage;
  warnings: string[];
  probe: {
    id: string;
    contaminated: boolean;
  };
  error?: {
    code: RuntimeInspectorErrorCode;
    message: string;
    details?: unknown;
  };
};

export type RuntimeInspectorObjectKind = 'transformNode' | 'mesh' | 'instancedMesh';

export type RuntimeInspectorObjectHandle = {
  runtimeSessionId: string;
  sceneId: string;
  sceneGeneration: number;
  kind: RuntimeInspectorObjectKind;
  engineId: string;
  objectGeneration: number;
  name: string;
  path: string[];
};

export type RuntimeInspectorQuerySpec = {
  kind?: RuntimeInspectorObjectKind | RuntimeInspectorObjectKind[];
  engineId?: string;
  name?: {
    exact?: string;
    contains?: string;
    regex?: string;
    flags?: string;
  };
  enabled?: boolean;
  visible?: boolean;
  limit?: number;
};

export type RuntimeInspectorInspectSpec = {
  metadataDepth?: number;
};

export type RuntimeInspectorObjectRecord = {
  handle: RuntimeInspectorObjectHandle;
  className: string;
  name: string;
  enabled: boolean;
  visible: boolean | null;
  visibility: number | null;
  disposed: boolean;
  transform: {
    position: [number, number, number] | null;
    rotation: [number, number, number] | null;
    rotationQuaternion: [number, number, number, number] | null;
    scaling: [number, number, number] | null;
    absolutePosition: [number, number, number] | null;
    absoluteScaling: [number, number, number] | null;
  };
  boundingBox: {
    minimumWorld: [number, number, number];
    maximumWorld: [number, number, number];
  } | null;
  parent: RuntimeInspectorObjectHandle | null;
  material: { name: string; uniqueId: string } | null;
  geometry: { uniqueId: string } | null;
  skeleton: { name: string; uniqueId: string } | null;
  isAnInstance: boolean;
  sourceMesh: RuntimeInspectorObjectHandle | null;
  metadata: unknown;
};

export type RuntimeInspectorRelationGraph = {
  self: RuntimeInspectorObjectHandle;
  parent: RuntimeInspectorObjectHandle | null;
  children: RuntimeInspectorObjectHandle[];
  sourceMesh: RuntimeInspectorObjectHandle | null;
  material: { name: string; uniqueId: string } | null;
  skeleton: { name: string; uniqueId: string } | null;
};

export type RuntimeInspectorCameraSnapshot = {
  name: string;
  uniqueId: string;
  projection: 'orthographic' | 'perspective';
  mode: number;
  position: [number, number, number];
  target: [number, number, number];
  alpha: number;
  beta: number;
  radius: number;
  fov: number;
  minZ: number;
  maxZ: number;
  orthoLeft: number | null;
  orthoRight: number | null;
  orthoTop: number | null;
  orthoBottom: number | null;
};

export type RuntimeInspectorCameraAcquireOptions = {
  owner?: string;
  reason?: string;
  timeoutMs?: number;
};

export type RuntimeInspectorCameraLeaseRecord = {
  id: string;
  owner: string;
  reason: string | null;
  acquiredAt: string;
  expiresAt: string;
  active: boolean;
  cameraBefore: RuntimeInspectorCameraSnapshot;
  ownerProviderId: string | null;
  ownerBefore: unknown;
  activePatchCount: number;
};

export type RuntimeInspectorCameraFocusOptions = {
  margin?: number;
};

export type RuntimeInspectorCameraFocusResult = {
  leaseId: string;
  targets: RuntimeInspectorObjectHandle[];
  aggregateBounds: {
    minimumWorld: [number, number, number];
    maximumWorld: [number, number, number];
    centerWorld: [number, number, number];
    radiusWorld: number;
  };
  projection: RuntimeInspectorCameraSnapshot['projection'];
  cameraAfter: RuntimeInspectorCameraSnapshot;
  screenCoverage: {
    viewportPx: { x: number; y: number; width: number; height: number };
    boundsPx: { left: number; top: number; right: number; bottom: number };
    widthRatio: number;
    heightRatio: number;
    allCornersInside: boolean;
  };
};

export type RuntimeInspectorCameraRestoreResult = {
  leaseId: string;
  reason: 'explicit' | 'timeout' | 'dispose' | 'pagehide';
  restored: boolean;
  cameraAfter: RuntimeInspectorCameraSnapshot | null;
  ownerAfter: unknown;
  restoredPatchCount: number;
  differences: string[];
};

export type RuntimeInspectorCameraOcclusionResult = {
  leaseId: string;
  method: 'raycast-center-v1';
  sampleCount: number;
  blockedSampleCount: number;
  targetMissSampleCount: number;
  occluders: Array<{
    handle: RuntimeInspectorObjectHandle;
    hitCount: number;
    minDistance: number;
    maxDistance: number;
  }>;
};

export type RuntimeInspectorCameraPatchSpec = {
  mode: 'hide' | 'ghost' | 'isolate';
  handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[];
  opacity?: number;
};

export type RuntimeInspectorCameraPatchResult = {
  leaseId: string;
  patchId: string;
  mode: RuntimeInspectorCameraPatchSpec['mode'];
  changedCount: number;
  changedHandles: RuntimeInspectorObjectHandle[];
  truncatedHandleCount: number;
};

export interface RuntimeInspectorCameraApi {
  acquire(
    options?: RuntimeInspectorCameraAcquireOptions,
  ): RuntimeInspectorObservation<RuntimeInspectorCameraLeaseRecord>;
  current(): RuntimeInspectorObservation<RuntimeInspectorCameraLeaseRecord | null>;
  focus(
    leaseId: string,
    handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    options?: RuntimeInspectorCameraFocusOptions,
  ): RuntimeInspectorObservation<RuntimeInspectorCameraFocusResult>;
  occlusion(
    leaseId: string,
    handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
  ): RuntimeInspectorObservation<RuntimeInspectorCameraOcclusionResult>;
  patch(
    leaseId: string,
    spec: RuntimeInspectorCameraPatchSpec,
  ): RuntimeInspectorObservation<RuntimeInspectorCameraPatchResult>;
  restore(leaseId: string): RuntimeInspectorObservation<RuntimeInspectorCameraRestoreResult>;
}

export interface RuntimeInspectorApi {
  readonly protocolVersion: typeof FP3D_PROTOCOL_VERSION;
  discover(): RuntimeInspectorObservation<RuntimeInspectorIdentity>;
  query(spec?: RuntimeInspectorQuerySpec): RuntimeInspectorObservation<RuntimeInspectorObjectHandle[]>;
  inspect(
    handle: RuntimeInspectorObjectHandle,
    spec?: RuntimeInspectorInspectSpec,
  ): RuntimeInspectorObservation<RuntimeInspectorObjectRecord>;
  relations(handle: RuntimeInspectorObjectHandle): RuntimeInspectorObservation<RuntimeInspectorRelationGraph>;
  readonly camera: RuntimeInspectorCameraApi;
  dispose(): void;
}
