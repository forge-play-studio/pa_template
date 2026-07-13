export const FP3D_PROTOCOL_VERSION = '0.1' as const;
export const FP3D_OBSERVATION_VERSION = 'fp3d-observation.v0.1' as const;
export const FP3D_IMPLEMENTATION_NAME = 'pa-template-runtime-inspector' as const;
export const FP3D_IMPLEMENTATION_VERSION = '0.26.0' as const;

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

export type RuntimeInspectorJsonPrimitive = string | number | boolean | null;

export type RuntimeInspectorMetadataQueryPredicate =
  | {
      path: string[];
      op: 'exists';
    }
  | {
      path: string[];
      op: 'equals';
      value: RuntimeInspectorJsonPrimitive;
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
  metadata?: RuntimeInspectorMetadataQueryPredicate[];
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

export type RuntimeInspectorHierarchyOptions = {
  maxDepth?: number;
  maxNodes?: number;
  maxBytes?: number;
  metadata?: {
    maxDepth?: number;
    maxKeys?: number;
    maxArray?: number;
    maxString?: number;
  };
};

export type RuntimeInspectorHierarchyNode = {
  handle: RuntimeInspectorObjectHandle;
  className: string;
  name: string;
  enabled: boolean;
  visible: boolean | null;
  childCount: number;
  metadata?: unknown;
  children: RuntimeInspectorHierarchyNode[];
};

export type RuntimeInspectorHierarchyResult = {
  focus: RuntimeInspectorObjectHandle;
  ancestors: Array<Omit<RuntimeInspectorHierarchyNode, 'children' | 'metadata'>>;
  tree: RuntimeInspectorHierarchyNode;
  returnedNodeCount: number;
  totalNodeCount: number;
  omittedNodeCount: number;
  truncated: boolean;
  truncationReasons: Array<'maxDepth' | 'maxNodes' | 'maxBytes' | 'cycle'>;
};

export type RuntimeInspectorSpatialGeometryResult = {
  handle: RuntimeInspectorObjectHandle;
  markerType: string;
  markerKind: string | null;
  coordinateSpace: 'world';
} & (
  | {
      kind: 'point';
      position: [number, number, number];
    }
  | {
      kind: 'box';
      center: [number, number, number];
      size: [number, number, number];
      xAxis: [number, number, number];
      yAxis: [number, number, number];
      zAxis: [number, number, number];
      corners: Array<[number, number, number]>;
    }
  | {
      kind: 'polyhedron';
      vertices: Array<[number, number, number]>;
      faces: number[][];
    }
  | {
      kind: 'object-bounds';
      targetRef: { kind: string; id: string; label?: string; path?: string };
      targetHandle: RuntimeInspectorObjectHandle;
      bounds: RuntimeInspectorCameraFocusResult['aggregateBounds'];
    }
);

export type RuntimeInspectorSpatialQuerySpec =
  | {
      kind: 'sphere';
      center: [number, number, number];
      radius: number;
      relation?: 'intersects' | 'center-inside';
      includeHidden?: boolean;
      includeDisabled?: boolean;
      limit?: number;
    }
  | {
      kind: 'aabb';
      minimum: [number, number, number];
      maximum: [number, number, number];
      relation?: 'intersects' | 'contained';
      includeHidden?: boolean;
      includeDisabled?: boolean;
      limit?: number;
    }
  | {
      kind: 'ray';
      origin: [number, number, number];
      direction: [number, number, number];
      length: number;
      includeHidden?: boolean;
      includeDisabled?: boolean;
      limit?: number;
    };

export type RuntimeInspectorSpatialQueryResult = {
  method: 'bounds-sphere-v1' | 'bounds-aabb-v1' | 'mesh-ray-v1';
  query: RuntimeInspectorSpatialQuerySpec;
  totalHitCount: number;
  truncated: boolean;
  hits: Array<{
    handle: RuntimeInspectorObjectHandle;
    distance: number;
    bounds?: RuntimeInspectorCameraFocusResult['aggregateBounds'];
    point?: [number, number, number];
    normal?: [number, number, number] | null;
  }>;
  limitations: string[];
};

export type RuntimeInspectorLogicalQuerySpec = {
  id?: string;
  kind?: string | string[];
  name?: {
    exact?: string;
    contains?: string;
    regex?: string;
    flags?: string;
  };
  tags?: {
    all?: string[];
    any?: string[];
  };
  limit?: number;
};

export type RuntimeInspectorLogicalObjectRecord = {
  logicalId: string;
  name: string;
  kind: string;
  tags: string[];
  provenance: {
    providerId: string;
    source: string;
  };
  rootHandle: RuntimeInspectorObjectHandle;
  controlHandles: RuntimeInspectorObjectHandle[];
  memberHandles: RuntimeInspectorObjectHandle[];
  memberCount: number;
  membersTruncated: boolean;
  aggregateBounds: RuntimeInspectorCameraFocusResult['aggregateBounds'] | null;
  metadata: unknown;
};

export type RuntimeInspectorLogicalQueryResult = {
  method: 'provider-logical-objects-v1';
  query: RuntimeInspectorLogicalQuerySpec;
  totalMatchCount: number;
  truncated: boolean;
  objects: RuntimeInspectorLogicalObjectRecord[];
  limitations: string[];
};

export type RuntimeInspectorMutationAcquireOptions = {
  owner?: string;
  reason?: string;
  timeoutMs?: number;
};

export type RuntimeInspectorMutationNodeSnapshot = {
  position: [number, number, number];
  rotation: [number, number, number];
  rotationQuaternion: [number, number, number, number] | null;
  scaling: [number, number, number];
  isVisible: boolean | null;
  visibility: number | null;
};

export type RuntimeInspectorMutationLeaseRecord = {
  id: string;
  owner: string;
  reason: string | null;
  acquiredAt: string;
  expiresAt: string;
  active: boolean;
  patchCount: number;
};

export type RuntimeInspectorMutationSetSpec = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  rotationQuaternion?: [number, number, number, number];
  scaling?: [number, number, number];
  isVisible?: boolean;
  visibility?: number;
};

export type RuntimeInspectorMutationPatchSpec = {
  handle: RuntimeInspectorObjectHandle;
  set: RuntimeInspectorMutationSetSpec;
};

export type RuntimeInspectorMutationPatchResult = {
  leaseId: string;
  patchId: string;
  target: RuntimeInspectorObjectHandle;
  changed: boolean;
  changedFields: Array<keyof RuntimeInspectorMutationSetSpec>;
  before: RuntimeInspectorMutationNodeSnapshot;
  after: RuntimeInspectorMutationNodeSnapshot;
};

export type RuntimeInspectorMutationRestoreResult = {
  leaseId: string;
  reason: string;
  restored: boolean;
  restoredPatchCount: number;
  differences: string[];
};

export type RuntimeInspectorSnapshotChannel = 'nodes' | 'animations' | 'providers';

export type RuntimeInspectorSnapshotCaptureSpec = {
  label?: string;
  handles?: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[];
  query?: RuntimeInspectorQuerySpec;
  includeDescendants?: boolean;
  channels?: RuntimeInspectorSnapshotChannel[];
  maxObjects?: number;
};

export type RuntimeInspectorSnapshotNodeRecord = {
  key: string;
  handle: RuntimeInspectorObjectHandle;
  className: string;
  name: string;
  lifecycle: {
    enabled: boolean;
    visible: boolean | null;
    visibility: number | null;
    disposed: boolean;
  };
  transform: {
    position: [number, number, number] | null;
    rotation: [number, number, number] | null;
    rotationQuaternion: [number, number, number, number] | null;
    scaling: [number, number, number] | null;
    absolutePosition: [number, number, number] | null;
    absoluteScaling: [number, number, number] | null;
    worldMatrix: number[] | null;
  };
  boundingBox: RuntimeInspectorObjectRecord['boundingBox'];
  relations: {
    parent: RuntimeInspectorObjectHandle | null;
    sourceMesh: RuntimeInspectorObjectHandle | null;
  };
  resources: {
    material: RuntimeInspectorObjectRecord['material'];
    geometry: RuntimeInspectorObjectRecord['geometry'];
    skeleton: RuntimeInspectorObjectRecord['skeleton'];
  };
  rendering: {
    layerMask: number;
    renderingGroupId: number;
    alphaIndex: number;
    receiveShadows: boolean;
  } | null;
  geometry: {
    totalVertices: number;
    totalIndices: number;
  } | null;
  instances: {
    isInstance: boolean;
    thinInstanceCount: number;
  };
  health: {
    finiteTransform: boolean;
    zeroScale: boolean;
    degenerateBounds: boolean | null;
  };
};

export type RuntimeInspectorSnapshotAnimationRecord = {
  key: string;
  name: string;
  uniqueId: string;
  from: number;
  to: number;
  currentFrame: number;
  isStarted: boolean;
  isPlaying: boolean;
  speedRatio: number;
  loopAnimation: boolean;
  isAdditive: boolean;
  weight: number;
  targetCount: number;
  targetHandles: RuntimeInspectorObjectHandle[];
  unresolvedTargetCount: number;
};

export type RuntimeInspectorSnapshotProviderRecord = {
  providerId: string;
  data: unknown;
  coverage: RuntimeInspectorCoverage;
  warnings: string[];
};

export type RuntimeInspectorSnapshotRecord = {
  id: string;
  label: string | null;
  capturedAt: string;
  runtimeSessionId: string;
  scene: RuntimeInspectorIdentity['scene'];
  frame: RuntimeInspectorObservation<unknown>['frame'];
  selector: {
    kind: 'all' | 'handles' | 'query';
    includeDescendants: boolean;
    requestedCount: number;
  };
  channels: RuntimeInspectorSnapshotChannel[];
  totalObjectCount: number;
  objectCount: number;
  truncated: boolean;
  nodes: RuntimeInspectorSnapshotNodeRecord[];
  animations: RuntimeInspectorSnapshotAnimationRecord[];
  providers: RuntimeInspectorSnapshotProviderRecord[];
  coverage: RuntimeInspectorCoverage;
  warnings: string[];
  limitations: string[];
};

export type RuntimeInspectorSnapshotSummary = Pick<
  RuntimeInspectorSnapshotRecord,
  'id' | 'label' | 'capturedAt' | 'runtimeSessionId' | 'scene' | 'frame' | 'channels' | 'objectCount' | 'truncated'
>;

export type RuntimeInspectorSnapshotDiffOptions = {
  maxDifferences?: number;
};

export type RuntimeInspectorSnapshotDifference = {
  path: string;
  before: unknown;
  after: unknown;
};

export type RuntimeInspectorSnapshotEntityRef = {
  entity: 'node' | 'animation' | 'provider';
  key: string;
  name: string;
  handle?: RuntimeInspectorObjectHandle;
};

export type RuntimeInspectorSnapshotEntityChange = RuntimeInspectorSnapshotEntityRef & {
  differences: RuntimeInspectorSnapshotDifference[];
  truncated: boolean;
};

export type RuntimeInspectorSnapshotDiffResult = {
  from: RuntimeInspectorSnapshotSummary;
  to: RuntimeInspectorSnapshotSummary;
  summary: {
    added: number;
    removed: number;
    changed: number;
    differenceCount: number;
  };
  added: RuntimeInspectorSnapshotEntityRef[];
  removed: RuntimeInspectorSnapshotEntityRef[];
  changed: RuntimeInspectorSnapshotEntityChange[];
  truncated: boolean;
  limitations: string[];
};

export type RuntimeInspectorSnapshotReleaseResult = {
  id: string;
  released: boolean;
  remaining: number;
};

export type RuntimeInspectorPixelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RuntimeInspectorPixelRoiSpec =
  | { kind: 'full' }
  | { kind: 'screen'; x: number; y: number; width: number; height: number }
  | {
      kind: 'handles';
      handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[];
      paddingPx?: number;
    };

export type RuntimeInspectorPixelCaptureSpec = {
  label?: string;
  roi?: RuntimeInspectorPixelRoiSpec;
  backgroundTolerance?: number;
  timeoutMs?: number;
};

export type RuntimeInspectorPixelCaptureRecord = {
  id: string;
  label: string | null;
  capturedAt: string;
  runtimeSessionId: string;
  scene: RuntimeInspectorIdentity['scene'];
  frame: RuntimeInspectorObservation<unknown>['frame'];
  canvas: {
    width: number;
    height: number;
    pixelCount: number;
  };
  roi: RuntimeInspectorPixelRect;
  targets: RuntimeInspectorObjectHandle[];
  readbackY: 'bottom-left-inverted';
  statistics: {
    pixelCount: number;
    nonBackgroundPixelCount: number;
    meanRgba: [number, number, number, number] | null;
    backgroundRgba: [number, number, number, number];
    backgroundTolerance: number;
    hash32: string;
  };
  limitations: string[];
};

export type RuntimeInspectorPixelCaptureSummary = Pick<
  RuntimeInspectorPixelCaptureRecord,
  'id' | 'label' | 'capturedAt' | 'runtimeSessionId' | 'scene' | 'frame' | 'canvas' | 'roi' | 'targets'
>;

export type RuntimeInspectorPixelSelfCheckResult = {
  canvas: RuntimeInspectorPixelCaptureRecord['canvas'];
  roi: RuntimeInspectorPixelRect;
  readbackY: RuntimeInspectorPixelCaptureRecord['readbackY'];
  ssd: number;
  maxChannelDiff: number;
  diffPixelCount: number;
  stable: boolean;
};

export type RuntimeInspectorPixelDiffOptions = {
  channelThreshold?: number;
  roiMode?: 'union' | 'intersection' | 'from' | 'to' | 'full';
  heatmapColumns?: number;
  heatmapRows?: number;
};

export type RuntimeInspectorPixelDiffMetrics = {
  pixelCount: number;
  ssd: number;
  maxChannelDiff: number;
  diffPixelCount: number;
  diffPixelRatio: number;
  meanAbsoluteChannelDiff: number;
  changedBounds: RuntimeInspectorPixelRect | null;
};

export type RuntimeInspectorPixelDiffResult = {
  from: RuntimeInspectorPixelCaptureSummary;
  to: RuntimeInspectorPixelCaptureSummary;
  channelThreshold: number;
  roiMode: NonNullable<RuntimeInspectorPixelDiffOptions['roiMode']>;
  comparisonRoi: RuntimeInspectorPixelRect;
  inside: RuntimeInspectorPixelDiffMetrics;
  outside: RuntimeInspectorPixelDiffMetrics;
  full: RuntimeInspectorPixelDiffMetrics;
  heatmap: {
    columns: number;
    rows: number;
    changedPixelRatios: number[];
  };
  limitations: string[];
};

export type RuntimeInspectorPixelReleaseResult = {
  id: string;
  released: boolean;
  remaining: number;
};

export type RuntimeInspectorTraceField =
  | 'lifecycle.enabled'
  | 'lifecycle.visible'
  | 'lifecycle.visibility'
  | 'lifecycle.disposed'
  | 'transform.position'
  | 'transform.rotation'
  | 'transform.rotationQuaternion'
  | 'transform.scaling'
  | 'transform.absolutePosition'
  | 'transform.absoluteScaling'
  | 'relations.parent'
  | 'boundingBox.minimumWorld'
  | 'boundingBox.maximumWorld'
  | 'health.finiteTransform';

export type RuntimeInspectorTraceComparableValue =
  | RuntimeInspectorJsonPrimitive
  | RuntimeInspectorJsonPrimitive[];

export type RuntimeInspectorTraceTriggerSpec =
  | {
      kind: 'change';
      field: RuntimeInspectorTraceField;
      handle?: RuntimeInspectorObjectHandle;
      epsilon?: number;
    }
  | {
      kind: 'equals';
      field: RuntimeInspectorTraceField;
      value: RuntimeInspectorTraceComparableValue;
      handle?: RuntimeInspectorObjectHandle;
      epsilon?: number;
    }
  | { kind: 'manual' };

export type RuntimeInspectorTraceStartSpec = {
  label?: string;
  handles?: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[];
  query?: RuntimeInspectorQuerySpec;
  includeDescendants?: boolean;
  fields: RuntimeInspectorTraceField[];
  trigger: RuntimeInspectorTraceTriggerSpec;
  preSamples?: number;
  postSamples?: number;
  sampleEveryFrames?: number;
  maxObjects?: number;
};

export type RuntimeInspectorTraceStatus = 'armed' | 'triggered' | 'completed' | 'stopped' | 'cancelled';

export type RuntimeInspectorTraceFrame = {
  id: number;
  timeMs: number;
  phase: 'after-render';
};

export type RuntimeInspectorTraceFieldChange = {
  handle: RuntimeInspectorObjectHandle;
  field: RuntimeInspectorTraceField;
  before: unknown;
  after: unknown;
};

export type RuntimeInspectorTraceNodeSample = {
  handle: RuntimeInspectorObjectHandle;
  state: 'active' | 'disposed';
  values: Partial<Record<RuntimeInspectorTraceField, unknown>>;
};

export type RuntimeInspectorTraceSample = {
  sequence: number;
  frame: RuntimeInspectorTraceFrame;
  nodes: RuntimeInspectorTraceNodeSample[];
  changes: RuntimeInspectorTraceFieldChange[];
};

export type RuntimeInspectorTraceTriggerRecord = {
  kind: RuntimeInspectorTraceTriggerSpec['kind'];
  reason: string;
  sequence: number;
  frame: RuntimeInspectorTraceFrame;
  changes: RuntimeInspectorTraceFieldChange[];
};

export type RuntimeInspectorTraceSummary = {
  id: string;
  label: string | null;
  startedAt: string;
  runtimeSessionId: string;
  scene: RuntimeInspectorIdentity['scene'];
  status: RuntimeInspectorTraceStatus;
  selector: RuntimeInspectorSnapshotRecord['selector'];
  fields: RuntimeInspectorTraceField[];
  triggerSpec: RuntimeInspectorTraceTriggerSpec;
  trigger: RuntimeInspectorTraceTriggerRecord | null;
  preSamples: number;
  postSamples: number;
  sampleEveryFrames: number;
  totalSampleCount: number;
  retainedSampleCount: number;
  droppedPreSampleCount: number;
  stopReason: string | null;
  coverage: RuntimeInspectorCoverage;
  warnings: string[];
  limitations: string[];
};

export type RuntimeInspectorTraceReadOptions = {
  fromSequence?: number;
  limit?: number;
};

export type RuntimeInspectorTraceReadResult = {
  summary: RuntimeInspectorTraceSummary;
  samples: RuntimeInspectorTraceSample[];
  returnedSampleCount: number;
  truncated: boolean;
  nextSequence: number | null;
};

export type RuntimeInspectorTraceReleaseResult = {
  id: string;
  released: boolean;
  remaining: number;
};

export type RuntimeInspectorRenderReasonCode =
  | 'NOT_RENDERABLE_NODE'
  | 'DISPOSED'
  | 'DISABLED'
  | 'HIDDEN'
  | 'ZERO_VISIBILITY'
  | 'NO_GEOMETRY'
  | 'NO_ACTIVE_CAMERA'
  | 'LAYER_MASK_MISMATCH'
  | 'OUTSIDE_FRUSTUM'
  | 'NOT_IN_ACTIVE_MESH_LIST'
  | 'ACTIVE_MESH_CANDIDATE';

export type RuntimeInspectorRenderTextureRecord = {
  name: string;
  uniqueId: string;
  className: string;
  coordinatesIndex: number | null;
  level: number | null;
};

export type RuntimeInspectorRenderEffectRecord = {
  key: string;
  keyHash32: string;
  keyTruncated: boolean;
  defines: string;
  definesHash32: string;
  definesTruncated: boolean;
  pipelineContextPresent: boolean;
};

export type RuntimeInspectorRenderSubMeshRecord = {
  index: number;
  materialIndex: number;
  verticesStart: number;
  verticesCount: number;
  indexStart: number;
  indexCount: number;
  effect: RuntimeInspectorRenderEffectRecord | null;
  materialDefines: unknown;
};

export type RuntimeInspectorRenderMaterialRecord = {
  source: 'mesh' | 'scene-default' | 'none';
  name: string | null;
  uniqueId: string | null;
  className: string | null;
  alpha: number | null;
  transparencyMode: number | null;
  backFaceCulling: boolean | null;
  disableDepthWrite: boolean | null;
  needDepthPrePass: boolean | null;
  textures: RuntimeInspectorRenderTextureRecord[];
  texturesTruncated: boolean;
};

export type RuntimeInspectorRenderPassMembership = {
  kind: 'custom-render-target' | 'camera-render-target' | 'material-render-target' | 'shadow-map';
  name: string;
  uniqueId: string;
  renderListMode: 'explicit' | 'scene-default' | 'predicate-or-custom';
  included: boolean | null;
};

export type RuntimeInspectorRenderExplainResult = {
  handle: RuntimeInspectorObjectHandle;
  frameId: number | null;
  classification: 'not-renderable' | 'excluded' | 'inactive-candidate' | 'active-candidate';
  gates: {
    renderable: boolean;
    disposed: boolean;
    enabled: boolean;
    visible: boolean | null;
    visibility: number | null;
    hasGeometry: boolean;
    totalVertices: number;
    totalIndices: number;
    activeCamera: { name: string; uniqueId: string; layerMask: number } | null;
    layerMaskMatch: boolean | null;
    inFrustum: boolean | null;
    alwaysSelectAsActiveMesh: boolean | null;
    inActiveMeshes: boolean | null;
  };
  reasons: Array<{
    code: RuntimeInspectorRenderReasonCode;
    outcome: 'exclude' | 'include' | 'unknown';
    detail: string;
  }>;
  material: RuntimeInspectorRenderMaterialRecord;
  subMeshes: RuntimeInspectorRenderSubMeshRecord[];
  subMeshesTruncated: boolean;
  passes: RuntimeInspectorRenderPassMembership[];
  passesTruncated: boolean;
  limitations: string[];
};

export type RuntimeInspectorVfxEffectRecord = {
  providerId: string;
  id: string;
  name: string;
  placement: string;
  geometrySpace: string | null;
  requiredInputs: string[];
  optionalInputs: string[];
  defaultParams: unknown;
  paramDefinitions: unknown[];
  metadata: unknown;
  provenance: { source: string };
};

export type RuntimeInspectorVfxUsageRecord = {
  providerId: string;
  id: string;
  label: string;
  effectId: string;
  effectAvailable: boolean;
  placement: string;
  lifecycle: string;
  binding: unknown;
  params: unknown;
  offset: unknown;
  instance: {
    state: 'active' | 'inactive' | 'unavailable';
    rootHandle: RuntimeInspectorObjectHandle | null;
  };
  provenance: { source: string };
};

export type RuntimeInspectorVfxCatalogResult = {
  method: 'provider-vfx-catalog-v1';
  effects: RuntimeInspectorVfxEffectRecord[];
  usages: RuntimeInspectorVfxUsageRecord[];
  providerCount: number;
  limitations: string[];
};

export type RuntimeInspectorVfxAcquireOptions = {
  owner?: string;
  reason?: string;
  timeoutMs?: number;
};

export type RuntimeInspectorVfxLeaseRecord = {
  id: string;
  owner: string;
  reason: string | null;
  acquiredAt: string;
  expiresAt: string;
  active: boolean;
  patchCount: number;
  touchedUsages: Array<{ providerId: string; usageId: string }>;
};

export type RuntimeInspectorVfxPreviewSpec = {
  providerId: string;
  usageId: string;
  set: Record<string, unknown>;
};

export type RuntimeInspectorVfxPreviewResult = {
  leaseId: string;
  patchId: string;
  providerId: string;
  usageId: string;
  changedFields: string[];
  beforeParams: unknown;
  afterParams: unknown;
  effectAvailable: boolean;
  instance: RuntimeInspectorVfxUsageRecord['instance'];
};

export type RuntimeInspectorVfxRestoreResult = {
  leaseId: string;
  reason: string;
  restored: boolean;
  restoredPatchCount: number;
  differences: string[];
};

export type RuntimeInspectorMaterialAssetRecord = {
  providerId: string;
  id: string;
  name: string;
  kind: string;
  profile: unknown;
  readonly: boolean;
  origin: unknown;
  metadata: unknown;
  provenance: { source: string };
};

export type RuntimeInspectorMaterialInstanceRecord = {
  providerId: string;
  id: string;
  name: string;
  className: string;
  properties: {
    alpha: number | null;
    transparencyMode: number | null;
    backFaceCulling: boolean | null;
    disableDepthWrite: boolean | null;
    needDepthPrePass: boolean | null;
    metallic: number | null;
    roughness: number | null;
    microSurface: number | null;
    emissiveIntensity: number | null;
    albedoColor: [number, number, number] | null;
    diffuseColor: [number, number, number] | null;
    emissiveColor: [number, number, number] | null;
  };
  textures: RuntimeInspectorRenderTextureRecord[];
  texturesTruncated: boolean;
  bindings: RuntimeInspectorObjectHandle[];
  bindingsTruncated: boolean;
  sceneNodeIds: string[];
  sharedAcrossSceneNodes: boolean;
  provenance: { source: string };
};

export type RuntimeInspectorMaterialCatalogResult = {
  method: 'provider-material-catalog-v1';
  assets: RuntimeInspectorMaterialAssetRecord[];
  instances: RuntimeInspectorMaterialInstanceRecord[];
  providerCount: number;
  limitations: string[];
};

export type RuntimeInspectorMaterialAcquireOptions = {
  owner?: string;
  reason?: string;
  timeoutMs?: number;
};

export type RuntimeInspectorMaterialLeaseRecord = {
  id: string;
  owner: string;
  reason: string | null;
  acquiredAt: string;
  expiresAt: string;
  active: boolean;
  patchCount: number;
  touchedInstances: Array<{ providerId: string; instanceId: string }>;
};

export type RuntimeInspectorMaterialPreviewSpec = {
  providerId: string;
  instanceId: string;
  set: Record<string, unknown>;
};

export type RuntimeInspectorMaterialPreviewResult = {
  leaseId: string;
  patchId: string;
  providerId: string;
  instanceId: string;
  changedFields: string[];
  beforeProperties: RuntimeInspectorMaterialInstanceRecord['properties'];
  afterProperties: RuntimeInspectorMaterialInstanceRecord['properties'];
  bindings: RuntimeInspectorObjectHandle[];
  sceneNodeIds: string[];
  sharedAcrossSceneNodes: boolean;
};

export type RuntimeInspectorMaterialRestoreResult = {
  leaseId: string;
  reason: string;
  restored: boolean;
  restoredPatchCount: number;
  differences: string[];
};

export type RuntimeInspectorAnimationGroupRecord = {
  providerId: string;
  id: string;
  name: string;
  range: { from: number; to: number; currentFrame: number };
  state: {
    isStarted: boolean;
    isPlaying: boolean;
    speedRatio: number;
    loopAnimation: boolean;
    isAdditive: boolean;
    weight: number;
  };
  targetCount: number;
  targetHandles: RuntimeInspectorObjectHandle[];
  unresolvedTargetCount: number;
  sceneNodeIds: string[];
  provenance: { source: string };
};

export type RuntimeInspectorAnimationCatalogResult = {
  method: 'provider-animation-catalog-v1';
  groups: RuntimeInspectorAnimationGroupRecord[];
  providerCount: number;
  limitations: string[];
};

export type RuntimeInspectorAnimationAcquireOptions = RuntimeInspectorMaterialAcquireOptions;
export type RuntimeInspectorAnimationLeaseRecord = {
  id: string;
  owner: string;
  reason: string | null;
  acquiredAt: string;
  expiresAt: string;
  active: boolean;
  patchCount: number;
  touchedGroups: Array<{ providerId: string; groupId: string }>;
};
export type RuntimeInspectorAnimationPreviewSpec = {
  providerId: string;
  groupId: string;
  set: { paused?: boolean; currentFrame?: number; speedRatio?: number };
};
export type RuntimeInspectorAnimationPreviewResult = {
  leaseId: string;
  patchId: string;
  providerId: string;
  groupId: string;
  changedFields: string[];
  before: RuntimeInspectorAnimationGroupRecord;
  after: RuntimeInspectorAnimationGroupRecord;
};
export type RuntimeInspectorAnimationRestoreResult = RuntimeInspectorMaterialRestoreResult;

export type RuntimeInspectorCameraSnapshot = {
  name: string;
  uniqueId: string;
  projection: 'orthographic' | 'perspective';
  mode: number;
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
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
  lowerAlphaLimit: number | null;
  upperAlphaLimit: number | null;
  lowerBetaLimit: number | null;
  upperBetaLimit: number | null;
  lowerRadiusLimit: number | null;
  upperRadiusLimit: number | null;
};

export type RuntimeInspectorCameraViewSpec =
  | {
      kind: 'pose';
      position: [number, number, number];
      target: [number, number, number];
      up?: [number, number, number];
    }
  | {
      kind: 'orbit';
      reference: 'world' | 'target-local' | 'semantic-frame';
      referenceHandle?: RuntimeInspectorObjectHandle;
      azimuthDeg: number;
      elevationDeg: number;
      distance?: number;
      margin?: number;
    };

export type RuntimeInspectorCameraViewResult = {
  leaseId: string;
  targets: RuntimeInspectorObjectHandle[];
  normalizedSpec: RuntimeInspectorCameraViewSpec;
  referenceFrame: {
    reference: 'world' | 'target-local' | 'semantic-frame';
    origin: [number, number, number];
    xAxis: [number, number, number];
    yAxis: [number, number, number];
    zAxis: [number, number, number];
    source: RuntimeInspectorObjectHandle | null;
  };
  aggregateBounds: RuntimeInspectorCameraFocusResult['aggregateBounds'];
  projection: RuntimeInspectorCameraSnapshot['projection'];
  cameraBefore: RuntimeInspectorCameraSnapshot;
  cameraAfter: RuntimeInspectorCameraSnapshot;
  screenCoverage: RuntimeInspectorCameraFocusResult['screenCoverage'];
};

export type RuntimeInspectorCameraAdjustSpec = {
  orbitDeltaDeg?: { azimuth: number; elevation: number };
  panWorld?: [number, number, number];
  dollyFactor?: number;
};

export type RuntimeInspectorCameraAdjustResult = {
  leaseId: string;
  normalizedSpec: RuntimeInspectorCameraAdjustSpec;
  projection: RuntimeInspectorCameraSnapshot['projection'];
  cameraBefore: RuntimeInspectorCameraSnapshot;
  cameraAfter: RuntimeInspectorCameraSnapshot;
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
  method: 'raycast-screen-grid-v2';
  grid: {
    columns: number;
    rows: number;
    boundsPx: { left: number; top: number; right: number; bottom: number };
  };
  sampleCount: number;
  validTargetSampleCount: number;
  blockedSampleCount: number;
  targetMissSampleCount: number;
  blockedRatio: number | null;
  occluders: Array<{
    handle: RuntimeInspectorObjectHandle;
    hitCount: number;
    sampleRatio: number;
    minDistance: number;
    maxDistance: number;
  }>;
};

export type RuntimeInspectorCameraOcclusionOptions = {
  gridSize?: number;
};

export type RuntimeInspectorCameraVisualOcclusionOptions = {
  gridSize?: number;
  depthEpsilon?: number;
};

export type RuntimeInspectorCameraVisualOcclusionResult = {
  leaseId: string;
  targets: RuntimeInspectorObjectHandle[];
  method: 'gpu-depth-grid-v1';
  grid: {
    columns: number;
    rows: number;
    boundsPx: { left: number; top: number; right: number; bottom: number };
  };
  sampleCount: number;
  validTargetSampleCount: number;
  blockedSampleCount: number;
  targetMissSampleCount: number;
  blockedRatio: number | null;
  depthEpsilon: number;
  readbackY: 'top-left' | 'bottom-left-inverted';
  limitations: string[];
};

export type RuntimeInspectorCameraVisualAttributionResult = {
  leaseId: string;
  method: 'gpu-depth-match-raycast-candidates-v1';
  visualOcclusion: RuntimeInspectorCameraVisualOcclusionResult;
  structuralOcclusion: RuntimeInspectorCameraOcclusionResult;
  attributedOccluders: Array<{
    handle: RuntimeInspectorObjectHandle;
    sampleCount: number;
    sampleRatio: number;
  }>;
  unattributedBlockedSampleCount: number;
  candidateCount: number;
  candidateLimit: number;
  limitations: string[];
};

export type RuntimeInspectorCameraVisualOcclusionBoundsResult = {
  leaseId: string;
  method: 'gpu-depth-transparency-bounds-v1';
  lowerBound: RuntimeInspectorCameraVisualOcclusionResult;
  upperBound: RuntimeInspectorCameraVisualOcclusionResult;
  uncertainSampleCount: number;
  uncertaintyRatio: number | null;
  semantics: {
    lower: 'transparent-excluded';
    upper: 'transparent-binary-opaque';
  };
  limitations: string[];
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
  lastRestore(): RuntimeInspectorObservation<RuntimeInspectorCameraRestoreResult | null>;
  focus(
    leaseId: string,
    handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    options?: RuntimeInspectorCameraFocusOptions,
  ): RuntimeInspectorObservation<RuntimeInspectorCameraFocusResult>;
  view(
    leaseId: string,
    handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    spec: RuntimeInspectorCameraViewSpec,
  ): RuntimeInspectorObservation<RuntimeInspectorCameraViewResult>;
  adjust(
    leaseId: string,
    spec: RuntimeInspectorCameraAdjustSpec,
  ): RuntimeInspectorObservation<RuntimeInspectorCameraAdjustResult>;
  occlusion(
    leaseId: string,
    handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    options?: RuntimeInspectorCameraOcclusionOptions,
  ): RuntimeInspectorObservation<RuntimeInspectorCameraOcclusionResult>;
  visualOcclusion(
    leaseId: string,
    handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    options?: RuntimeInspectorCameraVisualOcclusionOptions,
  ): Promise<RuntimeInspectorObservation<RuntimeInspectorCameraVisualOcclusionResult>>;
  visualAttribution(
    leaseId: string,
    handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    options?: RuntimeInspectorCameraVisualOcclusionOptions,
  ): Promise<RuntimeInspectorObservation<RuntimeInspectorCameraVisualAttributionResult>>;
  visualOcclusionBounds(
    leaseId: string,
    handles: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    options?: RuntimeInspectorCameraVisualOcclusionOptions,
  ): Promise<RuntimeInspectorObservation<RuntimeInspectorCameraVisualOcclusionBoundsResult>>;
  patch(
    leaseId: string,
    spec: RuntimeInspectorCameraPatchSpec,
  ): RuntimeInspectorObservation<RuntimeInspectorCameraPatchResult>;
  restore(leaseId: string): RuntimeInspectorObservation<RuntimeInspectorCameraRestoreResult>;
}

export interface RuntimeInspectorMutationApi {
  acquire(options?: RuntimeInspectorMutationAcquireOptions): RuntimeInspectorObservation<RuntimeInspectorMutationLeaseRecord>;
  current(): RuntimeInspectorObservation<RuntimeInspectorMutationLeaseRecord | null>;
  lastRestore(): RuntimeInspectorObservation<RuntimeInspectorMutationRestoreResult | null>;
  patch(leaseId: string, spec: RuntimeInspectorMutationPatchSpec): RuntimeInspectorObservation<RuntimeInspectorMutationPatchResult>;
  restore(leaseId: string): RuntimeInspectorObservation<RuntimeInspectorMutationRestoreResult>;
}

export interface RuntimeInspectorSnapshotApi {
  capture(spec?: RuntimeInspectorSnapshotCaptureSpec): RuntimeInspectorObservation<RuntimeInspectorSnapshotRecord>;
  list(): RuntimeInspectorObservation<RuntimeInspectorSnapshotSummary[]>;
  get(id: string): RuntimeInspectorObservation<RuntimeInspectorSnapshotRecord>;
  diff(
    fromId: string,
    toId: string,
    options?: RuntimeInspectorSnapshotDiffOptions,
  ): RuntimeInspectorObservation<RuntimeInspectorSnapshotDiffResult>;
  release(id: string): RuntimeInspectorObservation<RuntimeInspectorSnapshotReleaseResult>;
}

export interface RuntimeInspectorPixelApi {
  capture(spec?: RuntimeInspectorPixelCaptureSpec): Promise<RuntimeInspectorObservation<RuntimeInspectorPixelCaptureRecord>>;
  selfCheck(spec?: RuntimeInspectorPixelCaptureSpec): Promise<RuntimeInspectorObservation<RuntimeInspectorPixelSelfCheckResult>>;
  list(): RuntimeInspectorObservation<RuntimeInspectorPixelCaptureSummary[]>;
  get(id: string): RuntimeInspectorObservation<RuntimeInspectorPixelCaptureRecord>;
  diff(
    fromId: string,
    toId: string,
    options?: RuntimeInspectorPixelDiffOptions,
  ): RuntimeInspectorObservation<RuntimeInspectorPixelDiffResult>;
  release(id: string): RuntimeInspectorObservation<RuntimeInspectorPixelReleaseResult>;
}

export interface RuntimeInspectorTraceApi {
  start(spec: RuntimeInspectorTraceStartSpec): RuntimeInspectorObservation<RuntimeInspectorTraceSummary>;
  list(): RuntimeInspectorObservation<RuntimeInspectorTraceSummary[]>;
  get(
    id: string,
    options?: RuntimeInspectorTraceReadOptions,
  ): RuntimeInspectorObservation<RuntimeInspectorTraceReadResult>;
  trigger(id: string): RuntimeInspectorObservation<RuntimeInspectorTraceSummary>;
  stop(id: string): RuntimeInspectorObservation<RuntimeInspectorTraceSummary>;
  release(id: string): RuntimeInspectorObservation<RuntimeInspectorTraceReleaseResult>;
}

export interface RuntimeInspectorRenderApi {
  explain(handle: RuntimeInspectorObjectHandle): RuntimeInspectorObservation<RuntimeInspectorRenderExplainResult>;
}

export interface RuntimeInspectorVfxApi {
  catalog(): RuntimeInspectorObservation<RuntimeInspectorVfxCatalogResult>;
  acquire(options?: RuntimeInspectorVfxAcquireOptions): RuntimeInspectorObservation<RuntimeInspectorVfxLeaseRecord>;
  current(): RuntimeInspectorObservation<RuntimeInspectorVfxLeaseRecord | null>;
  lastRestore(): RuntimeInspectorObservation<RuntimeInspectorVfxRestoreResult | null>;
  preview(leaseId: string, spec: RuntimeInspectorVfxPreviewSpec): RuntimeInspectorObservation<RuntimeInspectorVfxPreviewResult>;
  restore(leaseId: string): RuntimeInspectorObservation<RuntimeInspectorVfxRestoreResult>;
}

export interface RuntimeInspectorMaterialApi {
  catalog(): RuntimeInspectorObservation<RuntimeInspectorMaterialCatalogResult>;
  acquire(options?: RuntimeInspectorMaterialAcquireOptions): RuntimeInspectorObservation<RuntimeInspectorMaterialLeaseRecord>;
  current(): RuntimeInspectorObservation<RuntimeInspectorMaterialLeaseRecord | null>;
  lastRestore(): RuntimeInspectorObservation<RuntimeInspectorMaterialRestoreResult | null>;
  preview(leaseId: string, spec: RuntimeInspectorMaterialPreviewSpec): RuntimeInspectorObservation<RuntimeInspectorMaterialPreviewResult>;
  restore(leaseId: string): RuntimeInspectorObservation<RuntimeInspectorMaterialRestoreResult>;
}

export interface RuntimeInspectorAnimationApi {
  catalog(): RuntimeInspectorObservation<RuntimeInspectorAnimationCatalogResult>;
  acquire(options?: RuntimeInspectorAnimationAcquireOptions): RuntimeInspectorObservation<RuntimeInspectorAnimationLeaseRecord>;
  current(): RuntimeInspectorObservation<RuntimeInspectorAnimationLeaseRecord | null>;
  lastRestore(): RuntimeInspectorObservation<RuntimeInspectorAnimationRestoreResult | null>;
  preview(leaseId: string, spec: RuntimeInspectorAnimationPreviewSpec): RuntimeInspectorObservation<RuntimeInspectorAnimationPreviewResult>;
  restore(leaseId: string): RuntimeInspectorObservation<RuntimeInspectorAnimationRestoreResult>;
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
  hierarchy(
    handle: RuntimeInspectorObjectHandle,
    options?: RuntimeInspectorHierarchyOptions,
  ): RuntimeInspectorObservation<RuntimeInspectorHierarchyResult>;
  spatial(handle: RuntimeInspectorObjectHandle): RuntimeInspectorObservation<RuntimeInspectorSpatialGeometryResult>;
  spatialQuery(spec: RuntimeInspectorSpatialQuerySpec): RuntimeInspectorObservation<RuntimeInspectorSpatialQueryResult>;
  logicalQuery(spec?: RuntimeInspectorLogicalQuerySpec): RuntimeInspectorObservation<RuntimeInspectorLogicalQueryResult>;
  readonly snapshot: RuntimeInspectorSnapshotApi;
  readonly pixels: RuntimeInspectorPixelApi;
  readonly trace: RuntimeInspectorTraceApi;
  readonly render: RuntimeInspectorRenderApi;
  readonly vfx: RuntimeInspectorVfxApi;
  readonly materials: RuntimeInspectorMaterialApi;
  readonly animations: RuntimeInspectorAnimationApi;
  readonly camera: RuntimeInspectorCameraApi;
  readonly mutation: RuntimeInspectorMutationApi;
  dispose(): void;
}
