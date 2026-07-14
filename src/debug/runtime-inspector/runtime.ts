import { Camera } from '@babylonjs/core/Cameras/camera';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { DepthRenderer } from '@babylonjs/core/Rendering/depthRenderer';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Material } from '@babylonjs/core/Materials/material';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import type { Scene } from '@babylonjs/core/scene';
import type { Game } from '../../core/Game';
import {
  getBabylonNodeClassName,
  getBabylonNodeKind,
  isBabylonNodeDisposed,
  isBabylonNodeEnabled,
  isBabylonMeshNode,
  listBabylonRuntimeNodes,
  quaternion,
  readBabylonAbsolutePosition,
  readBabylonAbsoluteScaling,
  readBabylonBoundingBox,
  readBabylonEngineVersion,
  readBabylonMeshVisibility,
  readBabylonNodeGeometry,
  readBabylonNodeMaterial,
  readBabylonNodeSkeleton,
  readBabylonNodeVisible,
  readBabylonSceneId,
  readBabylonSourceMesh,
  vector3,
  writeBabylonMeshVisibility,
  type BabylonMeshVisibilityState,
  type BabylonRuntimeNode,
} from './babylon-adapter';
import {
  readRuntimeInspectorBuildIdentity,
  readRuntimeInspectorCameraControlProvider,
  readRuntimeInspectorLogicalObjectProviders,
  readRuntimeInspectorSnapshotProviders,
  readRuntimeInspectorVfxProviders,
  readRuntimeInspectorMaterialProviders,
  readRuntimeInspectorAnimationProviders,
  type RuntimeInspectorCameraControlProvider,
  type RuntimeInspectorCameraOwnerLease,
  type RuntimeInspectorLogicalObjectDescriptor,
  type RuntimeInspectorVfxEffectDescriptor,
  type RuntimeInspectorVfxUsageDescriptor,
  type RuntimeInspectorVfxProvider,
  type RuntimeInspectorMaterialAssetDescriptor,
  type RuntimeInspectorMaterialInstanceDescriptor,
  type RuntimeInspectorMaterialProvider,
  type RuntimeInspectorAnimationGroupDescriptor,
  type RuntimeInspectorAnimationProvider,
} from './providers';
import { safeSerialize } from './safe-serialize';
import {
  FP3D_IMPLEMENTATION_NAME,
  FP3D_IMPLEMENTATION_VERSION,
  FP3D_OBSERVATION_VERSION,
  FP3D_PROTOCOL_VERSION,
  type RuntimeInspectorApi,
  type RuntimeInspectorCameraAcquireOptions,
  type RuntimeInspectorCameraAdjustResult,
  type RuntimeInspectorCameraAdjustSpec,
  type RuntimeInspectorCameraFocusOptions,
  type RuntimeInspectorCameraFocusResult,
  type RuntimeInspectorCameraLeaseRecord,
  type RuntimeInspectorCameraOcclusionResult,
  type RuntimeInspectorCameraOcclusionOptions,
  type RuntimeInspectorCameraVisualOcclusionOptions,
  type RuntimeInspectorCameraVisualOcclusionResult,
  type RuntimeInspectorCameraVisualAttributionResult,
  type RuntimeInspectorCameraVisualOcclusionBoundsResult,
  type RuntimeInspectorCameraPatchResult,
  type RuntimeInspectorCameraPatchSpec,
  type RuntimeInspectorCameraRestoreResult,
  type RuntimeInspectorCameraSnapshot,
  type RuntimeInspectorCameraViewResult,
  type RuntimeInspectorCameraViewSpec,
  type RuntimeInspectorErrorCode,
  type RuntimeInspectorIdentity,
  type RuntimeInspectorInspectSpec,
  type RuntimeInspectorHierarchyNode,
  type RuntimeInspectorHierarchyOptions,
  type RuntimeInspectorHierarchyResult,
  type RuntimeInspectorLogicalObjectRecord,
  type RuntimeInspectorLogicalQueryResult,
  type RuntimeInspectorLogicalQuerySpec,
  type RuntimeInspectorMutationAcquireOptions,
  type RuntimeInspectorMutationLeaseRecord,
  type RuntimeInspectorMutationNodeSnapshot,
  type RuntimeInspectorMutationPatchResult,
  type RuntimeInspectorMutationPatchSpec,
  type RuntimeInspectorMutationRestoreResult,
  type RuntimeInspectorMutationSetSpec,
  type RuntimeInspectorObjectHandle,
  type RuntimeInspectorObjectRecord,
  type RuntimeInspectorObservation,
  type RuntimeInspectorPixelCaptureRecord,
  type RuntimeInspectorPixelCaptureSpec,
  type RuntimeInspectorPixelCaptureSummary,
  type RuntimeInspectorPixelDiffMetrics,
  type RuntimeInspectorPixelDiffOptions,
  type RuntimeInspectorPixelDiffResult,
  type RuntimeInspectorPixelRect,
  type RuntimeInspectorPixelReleaseResult,
  type RuntimeInspectorPixelSelfCheckResult,
  type RuntimeInspectorQuerySpec,
  type RuntimeInspectorRelationGraph,
  type RuntimeInspectorRenderExplainResult,
  type RuntimeInspectorRenderMaterialRecord,
  type RuntimeInspectorRenderPassMembership,
  type RuntimeInspectorRenderSubMeshRecord,
  type RuntimeInspectorSpatialGeometryResult,
  type RuntimeInspectorSpatialQueryResult,
  type RuntimeInspectorSpatialQuerySpec,
  type RuntimeInspectorSnapshotAnimationRecord,
  type RuntimeInspectorSnapshotCaptureSpec,
  type RuntimeInspectorSnapshotChannel,
  type RuntimeInspectorSnapshotDiffOptions,
  type RuntimeInspectorSnapshotDiffResult,
  type RuntimeInspectorSnapshotDifference,
  type RuntimeInspectorSnapshotEntityChange,
  type RuntimeInspectorSnapshotEntityRef,
  type RuntimeInspectorSnapshotNodeRecord,
  type RuntimeInspectorSnapshotProviderRecord,
  type RuntimeInspectorSnapshotRecord,
  type RuntimeInspectorSnapshotReleaseResult,
  type RuntimeInspectorSnapshotSummary,
  type RuntimeInspectorTraceField,
  type RuntimeInspectorTraceFieldChange,
  type RuntimeInspectorTraceReadOptions,
  type RuntimeInspectorTraceReadResult,
  type RuntimeInspectorTraceReleaseResult,
  type RuntimeInspectorTraceSample,
  type RuntimeInspectorTraceStartSpec,
  type RuntimeInspectorTraceSummary,
  type RuntimeInspectorTraceTriggerRecord,
  type RuntimeInspectorTraceTriggerSpec,
  type RuntimeInspectorVfxCatalogResult,
  type RuntimeInspectorVfxEffectRecord,
  type RuntimeInspectorVfxUsageRecord,
  type RuntimeInspectorVfxAcquireOptions,
  type RuntimeInspectorVfxLeaseRecord,
  type RuntimeInspectorVfxPreviewResult,
  type RuntimeInspectorVfxPreviewSpec,
  type RuntimeInspectorVfxRestoreResult,
  type RuntimeInspectorMaterialCatalogResult,
  type RuntimeInspectorMaterialAssetRecord,
  type RuntimeInspectorMaterialInstanceRecord,
  type RuntimeInspectorMaterialAcquireOptions,
  type RuntimeInspectorMaterialLeaseRecord,
  type RuntimeInspectorMaterialPreviewSpec,
  type RuntimeInspectorMaterialPreviewResult,
  type RuntimeInspectorMaterialRestoreResult,
  type RuntimeInspectorAnimationCatalogResult,
  type RuntimeInspectorAnimationGroupRecord,
  type RuntimeInspectorAnimationAcquireOptions,
  type RuntimeInspectorAnimationLeaseRecord,
  type RuntimeInspectorAnimationPreviewSpec,
  type RuntimeInspectorAnimationPreviewResult,
  type RuntimeInspectorAnimationRestoreResult,
} from './schema';

type RuntimeInspectorOptions = {
  getGame: () => Game | null;
  mode: string;
  onDispose?: () => void;
};

type HandleEntry = {
  node: BabylonRuntimeNode;
  objectGeneration: number;
};

type CameraLeaseEntry = {
  record: RuntimeInspectorCameraLeaseRecord;
  camera: ArcRotateCamera;
  scene: Scene;
  ownerProvider: RuntimeInspectorCameraControlProvider | null;
  ownerLease: RuntimeInspectorCameraOwnerLease | null;
  patches: CameraPatchEntry[];
  timeoutId: number | null;
};

type CameraPatchEntry = {
  id: string;
  mode: RuntimeInspectorCameraPatchSpec['mode'];
  states: Array<{
    node: BabylonRuntimeNode;
    before: BabylonMeshVisibilityState;
  }>;
};

type MutationPatchEntry = {
  id: string;
  node: BabylonRuntimeNode;
  before: RuntimeInspectorMutationNodeSnapshot;
  fields: Array<keyof RuntimeInspectorMutationSetSpec>;
};

type MutationLeaseEntry = {
  record: RuntimeInspectorMutationLeaseRecord;
  scene: Scene;
  patches: MutationPatchEntry[];
  timeoutId: number | null;
};

type SnapshotCaptureSelection = {
  nodes: BabylonRuntimeNode[];
  totalObjectCount: number;
  selector: RuntimeInspectorSnapshotRecord['selector'];
};

type PixelCaptureEntry = {
  record: RuntimeInspectorPixelCaptureRecord;
  bytes: Uint8Array;
};

type TraceEntry = {
  summary: RuntimeInspectorTraceSummary;
  scene: Scene;
  nodes: BabylonRuntimeNode[];
  observer: Observer<Scene> | null;
  samples: RuntimeInspectorTraceSample[];
  previousSample: RuntimeInspectorTraceSample | null;
  nextSequence: number;
  sampledRenderCount: number;
  remainingPostSamples: number;
};

type VfxPatchEntry = {
  id: string;
  provider: RuntimeInspectorVfxProvider;
  providerId: string;
  usageId: string;
  restoreState: unknown;
  beforeParams: unknown;
};

type VfxLeaseEntry = {
  record: RuntimeInspectorVfxLeaseRecord;
  scene: Scene;
  patches: VfxPatchEntry[];
  timeoutId: number | null;
};

type MaterialPatchEntry = {
  id: string;
  provider: RuntimeInspectorMaterialProvider;
  providerId: string;
  instanceId: string;
  restoreState: unknown;
  beforeProperties: RuntimeInspectorMaterialInstanceRecord['properties'];
};

type MaterialLeaseEntry = {
  record: RuntimeInspectorMaterialLeaseRecord;
  scene: Scene;
  patches: MaterialPatchEntry[];
  timeoutId: number | null;
};

type AnimationPatchEntry = {
  id: string;
  provider: RuntimeInspectorAnimationProvider;
  providerId: string;
  groupId: string;
  restoreState: unknown;
  before: RuntimeInspectorAnimationGroupRecord;
};

type AnimationLeaseEntry = {
  record: RuntimeInspectorAnimationLeaseRecord;
  scene: Scene;
  patches: AnimationPatchEntry[];
  timeoutId: number | null;
};

type CommandResult<T> = {
  data: T;
  observed: string[];
  unavailable?: Array<{ channel: string; reason: string }>;
  warnings?: string[];
};

class RuntimeInspectorCommandError extends Error {
  constructor(
    readonly code: RuntimeInspectorErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'RuntimeInspectorCommandError';
  }
}

export function createRuntimeInspector(options: RuntimeInspectorOptions): RuntimeInspectorApi {
  const runtimeSessionId = createId('runtime');
  const bootedAt = new Date().toISOString();
  const pageBootId = getPageBootId();
  const handles = new Map<string, HandleEntry>();
  let sceneReference: Scene | null = null;
  let sceneGeneration = 0;
  let probeSequence = 0;
  let activeCameraLease: CameraLeaseEntry | null = null;
  let lastCameraRestore: RuntimeInspectorCameraRestoreResult | null = null;
  let activeMutationLease: MutationLeaseEntry | null = null;
  let lastMutationRestore: RuntimeInspectorMutationRestoreResult | null = null;
  let activeVfxLease: VfxLeaseEntry | null = null;
  let lastVfxRestore: RuntimeInspectorVfxRestoreResult | null = null;
  let activeMaterialLease: MaterialLeaseEntry | null = null;
  let lastMaterialRestore: RuntimeInspectorMaterialRestoreResult | null = null;
  let activeAnimationLease: AnimationLeaseEntry | null = null;
  let lastAnimationRestore: RuntimeInspectorAnimationRestoreResult | null = null;
  const snapshots = new Map<string, RuntimeInspectorSnapshotRecord>();
  const pixelCaptures = new Map<string, PixelCaptureEntry>();
  const traces = new Map<string, TraceEntry>();
  let disposed = false;

  const handlePageHide = () => {
    restoreActiveCameraLease('pagehide');
    restoreActiveMutationLease('pagehide');
    restoreActiveVfxLease('pagehide');
    restoreActiveMaterialLease('pagehide');
    restoreActiveAnimationLease('pagehide');
    stopActiveTraces('pagehide', 'cancelled');
  };
  window.addEventListener('pagehide', handlePageHide);

  const api: RuntimeInspectorApi = {
    protocolVersion: FP3D_PROTOCOL_VERSION,

    discover() {
      return command(() => {
        requireScene();
        return {
          data: readIdentity(),
          observed: ['runtime.identity', 'runtime.capabilities', 'scene.identity'],
        };
      });
    },

    query(spec = {}) {
      return command(() => queryNodes(spec));
    },

    inspect(handle, spec = {}) {
      return command(() => inspectNode(handle, spec));
    },

    relations(handle) {
      return command(() => readRelations(handle));
    },

    hierarchy(handle, hierarchyOptions = {}) {
      return command(() => readHierarchy(handle, hierarchyOptions));
    },

    spatial(handle) {
      return command(() => readSpatialGeometry(handle));
    },

    spatialQuery(spec) {
      return command(() => runSpatialQuery(spec));
    },

    logicalQuery(spec = {}) {
      return command(() => runLogicalQuery(spec));
    },

    snapshot: {
      capture(spec = {}) {
        return command(() => captureRuntimeSnapshot(spec));
      },

      list() {
        return command(() => listRuntimeSnapshots());
      },

      get(id) {
        return command(() => getRuntimeSnapshot(id));
      },

      diff(fromId, toId, diffOptions = {}) {
        return command(() => diffRuntimeSnapshots(fromId, toId, diffOptions));
      },

      release(id) {
        return command(() => releaseRuntimeSnapshot(id));
      },
    },

    pixels: {
      capture(spec = {}) {
        return commandAsync(() => capturePixels(spec));
      },

      selfCheck(spec = {}) {
        return commandAsync(() => selfCheckPixels(spec));
      },

      list() {
        return command(() => listPixelCaptures());
      },

      get(id) {
        return command(() => getPixelCapture(id));
      },

      diff(fromId, toId, diffOptions = {}) {
        return command(() => diffPixelCaptures(fromId, toId, diffOptions));
      },

      release(id) {
        return command(() => releasePixelCapture(id));
      },
    },

    trace: {
      start(spec) {
        return command(() => startRuntimeTrace(spec));
      },

      list() {
        return command(() => listRuntimeTraces());
      },

      get(id, readOptions = {}) {
        return command(() => getRuntimeTrace(id, readOptions));
      },

      trigger(id) {
        return command(() => triggerRuntimeTrace(id));
      },

      stop(id) {
        return command(() => stopRuntimeTrace(id));
      },

      release(id) {
        return command(() => releaseRuntimeTrace(id));
      },
    },

    render: {
      explain(handle) {
        return command(() => explainRenderPath(handle));
      },
    },

    vfx: {
      catalog() {
        return command(() => readVfxCatalog());
      },

      acquire(acquireOptions = {}) {
        return command(() => acquireVfxLease(acquireOptions));
      },

      current() {
        return command(() => ({
          data: activeVfxLease ? readVfxLeaseRecord(activeVfxLease) : null,
          observed: ['vfx.lease'],
        }));
      },

      lastRestore() {
        return command(() => ({
          data: lastVfxRestore ? safeSerialize(lastVfxRestore) as RuntimeInspectorVfxRestoreResult : null,
          observed: ['vfx.restoreAudit'],
        }));
      },

      preview(leaseId, spec) {
        return command(() => previewVfxUsage(leaseId, spec));
      },

      restore(leaseId) {
        return command(() => restoreVfxByLeaseId(leaseId));
      },
    },

    materials: {
      catalog() {
        return command(() => readMaterialCatalog());
      },
      acquire(acquireOptions = {}) {
        return command(() => acquireMaterialLease(acquireOptions));
      },
      current() {
        return command(() => ({ data: activeMaterialLease ? readMaterialLeaseRecord(activeMaterialLease) : null, observed: ['material.lease'] }));
      },
      lastRestore() {
        return command(() => ({ data: lastMaterialRestore ? safeSerialize(lastMaterialRestore) as RuntimeInspectorMaterialRestoreResult : null, observed: ['material.restoreAudit'] }));
      },
      preview(leaseId, spec) {
        return command(() => previewMaterialInstance(leaseId, spec));
      },
      restore(leaseId) {
        return command(() => restoreMaterialByLeaseId(leaseId));
      },
    },

    animations: {
      catalog() {
        return command(() => readAnimationCatalog());
      },
      acquire(acquireOptions = {}) {
        return command(() => acquireAnimationLease(acquireOptions));
      },
      current() {
        return command(() => ({ data: activeAnimationLease ? readAnimationLeaseRecord(activeAnimationLease) : null, observed: ['animation.lease'] }));
      },
      lastRestore() {
        return command(() => ({ data: lastAnimationRestore ? safeSerialize(lastAnimationRestore) as RuntimeInspectorAnimationRestoreResult : null, observed: ['animation.restoreAudit'] }));
      },
      preview(leaseId, spec) {
        return command(() => previewAnimationGroup(leaseId, spec));
      },
      restore(leaseId) {
        return command(() => restoreAnimationByLeaseId(leaseId));
      },
    },

    camera: {
      acquire(acquireOptions = {}) {
        return command(() => acquireCameraLease(acquireOptions));
      },

      current() {
        return command(() => ({
          data: activeCameraLease ? readCameraLeaseRecord(activeCameraLease) : null,
          observed: ['camera.lease'],
        }));
      },

      lastRestore() {
        return command(() => ({
          data: lastCameraRestore ? safeSerialize(lastCameraRestore) as RuntimeInspectorCameraRestoreResult : null,
          observed: ['camera.restoreAudit'],
        }));
      },

      focus(leaseId, handlesOrHandle, focusOptions = {}) {
        return command(() => focusCamera(leaseId, handlesOrHandle, focusOptions));
      },

      view(leaseId, handlesOrHandle, spec) {
        return command(() => viewCamera(leaseId, handlesOrHandle, spec));
      },

      adjust(leaseId, spec) {
        return command(() => adjustCamera(leaseId, spec));
      },

      occlusion(leaseId, handlesOrHandle, occlusionOptions = {}) {
        return command(() => inspectCameraOcclusion(leaseId, handlesOrHandle, occlusionOptions));
      },

      visualOcclusion(leaseId, handlesOrHandle, visualOptions = {}) {
        return commandAsync(() => inspectCameraVisualOcclusion(leaseId, handlesOrHandle, visualOptions));
      },

      visualAttribution(leaseId, handlesOrHandle, visualOptions = {}) {
        return commandAsync(() => inspectCameraVisualAttribution(leaseId, handlesOrHandle, visualOptions));
      },

      visualOcclusionBounds(leaseId, handlesOrHandle, visualOptions = {}) {
        return commandAsync(() => inspectCameraVisualOcclusionBounds(leaseId, handlesOrHandle, visualOptions));
      },

      patch(leaseId, spec) {
        return command(() => patchCameraVisibility(leaseId, spec));
      },

      restore(leaseId) {
        return command(() => restoreCameraByLeaseId(leaseId));
      },
    },

    mutation: {
      acquire(acquireOptions = {}) {
        return command(() => acquireMutationLease(acquireOptions));
      },

      current() {
        return command(() => ({
          data: activeMutationLease ? readMutationLeaseRecord(activeMutationLease) : null,
          observed: ['mutation.lease'],
        }));
      },

      lastRestore() {
        return command(() => ({
          data: lastMutationRestore ? safeSerialize(lastMutationRestore) as RuntimeInspectorMutationRestoreResult : null,
          observed: ['mutation.restoreAudit'],
        }));
      },

      patch(leaseId, spec) {
        return command(() => patchRuntimeNode(leaseId, spec));
      },

      restore(leaseId) {
        return command(() => restoreMutationByLeaseId(leaseId));
      },
    },

    dispose() {
      if (disposed) return;
      restoreActiveCameraLease('dispose');
      restoreActiveMutationLease('dispose');
      restoreActiveVfxLease('dispose');
      restoreActiveMaterialLease('dispose');
      restoreActiveAnimationLease('dispose');
      stopActiveTraces('dispose', 'cancelled');
      disposed = true;
      window.removeEventListener('pagehide', handlePageHide);
      handles.clear();
      snapshots.clear();
      pixelCaptures.clear();
      traces.clear();
      options.onDispose?.();
    },
  };

  return api;

  function command<T>(operation: () => CommandResult<T>): RuntimeInspectorObservation<T> {
    const probeId = `${runtimeSessionId}:command:${++probeSequence}`;
    try {
      if (disposed) throw new RuntimeInspectorCommandError('UNAVAILABLE', 'runtime inspector is disposed');
      const result = operation();
      return {
        schemaVersion: FP3D_OBSERVATION_VERSION,
        ok: true,
        runtime: readIdentity(),
        frame: readFrame(),
        data: result.data,
        coverage: {
          observed: uniqueSorted(result.observed),
          unavailable: result.unavailable ?? [],
        },
        warnings: result.warnings ?? [],
        probe: { id: probeId, contaminated: false },
      };
    } catch (error) {
      const normalized = normalizeError(error);
      return {
        schemaVersion: FP3D_OBSERVATION_VERSION,
        ok: false,
        runtime: readIdentity(),
        frame: readFrame(),
        data: null,
        coverage: { observed: ['runtime.identity'], unavailable: [] },
        warnings: [],
        probe: { id: probeId, contaminated: false },
        error: normalized,
      };
    }
  }

  async function commandAsync<T>(operation: () => Promise<CommandResult<T>>): Promise<RuntimeInspectorObservation<T>> {
    const probeId = `${runtimeSessionId}:command:${++probeSequence}`;
    try {
      if (disposed) throw new RuntimeInspectorCommandError('UNAVAILABLE', 'runtime inspector is disposed');
      const result = await operation();
      return {
        schemaVersion: FP3D_OBSERVATION_VERSION,
        ok: true,
        runtime: readIdentity(),
        frame: readFrame(),
        data: result.data,
        coverage: {
          observed: uniqueSorted(result.observed),
          unavailable: result.unavailable ?? [],
        },
        warnings: result.warnings ?? [],
        probe: { id: probeId, contaminated: false },
      };
    } catch (error) {
      return {
        schemaVersion: FP3D_OBSERVATION_VERSION,
        ok: false,
        runtime: readIdentity(),
        frame: readFrame(),
        data: null,
        coverage: { observed: ['runtime.identity'], unavailable: [] },
        warnings: [],
        probe: { id: probeId, contaminated: false },
        error: normalizeError(error),
      };
    }
  }

  function readIdentity(): RuntimeInspectorIdentity {
    const scene = readScene();
    const sceneState = syncScene(scene);
    return {
      protocolVersion: FP3D_PROTOCOL_VERSION,
      runtimeSessionId,
      implementation: {
        name: FP3D_IMPLEMENTATION_NAME,
        version: FP3D_IMPLEMENTATION_VERSION,
        bootedAt,
      },
      engine: {
        name: 'Babylon.js',
        version: scene ? readBabylonEngineVersion(scene) : null,
      },
      page: {
        url: window.location.href,
        origin: window.location.origin,
        bootId: pageBootId,
      },
      build: readRuntimeInspectorBuildIdentity(options.mode),
      scene: sceneState,
      capabilities: {
        discover: FP3D_PROTOCOL_VERSION,
        query: '0.2',
        inspect: FP3D_PROTOCOL_VERSION,
        relations: FP3D_PROTOCOL_VERSION,
        hierarchy: '0.1',
        camera: '0.4',
        cameraOcclusion: '0.2',
        cameraReference: '0.1',
        cameraVisual: '0.1',
        cameraVisualAttribution: '0.1',
        cameraVisualBounds: '0.1',
        spatial: '0.1',
        spatialQuery: '0.1',
        logicalObjects: '0.1',
        mutation: '0.1',
        snapshot: '0.1',
        pixelDiff: '0.1',
        trace: '0.1',
        renderExplain: '0.1',
        vfxProvider: '0.1',
        vfxControl: '0.1',
        materialProvider: '0.1',
        materialControl: '0.1',
        animationProvider: '0.1',
        animationControl: '0.1',
      },
    };
  }

  function readFrame(): RuntimeInspectorObservation<unknown>['frame'] {
    const scene = readScene();
    const frameId = scene && typeof scene.getFrameId === 'function' ? scene.getFrameId() : null;
    return {
      id: Number.isInteger(frameId) ? frameId : null,
      timeMs: performance.now(),
      phase: 'command',
    };
  }

  function readScene(): Scene | null {
    return options.getGame()?.getScene() ?? null;
  }

  function requireScene(): Scene {
    const scene = readScene();
    if (!scene) throw new RuntimeInspectorCommandError('UNAVAILABLE', 'game scene is not available');
    syncScene(scene);
    return scene;
  }

  function syncScene(scene: Scene | null): RuntimeInspectorIdentity['scene'] {
    if (scene && scene !== sceneReference) {
      restoreActiveCameraLease('dispose');
      restoreActiveMutationLease('scene-change');
      restoreActiveVfxLease('scene-change');
      restoreActiveMaterialLease('scene-change');
      restoreActiveAnimationLease('scene-change');
      stopActiveTraces('scene-change', 'cancelled');
      sceneReference = scene;
      sceneGeneration += 1;
      handles.clear();
    }
    return {
      id: scene ? readBabylonSceneId(scene) : 'scene:unavailable',
      generation: Math.max(1, sceneGeneration),
    };
  }

  function queryNodes(spec: RuntimeInspectorQuerySpec): CommandResult<RuntimeInspectorObjectHandle[]> {
    validateQuerySpec(spec);
    const scene = requireScene();
    const identity = readIdentity();
    const { matches, metadataChannels } = matchQueryNodes(spec, listBabylonRuntimeNodes(scene));
    const metadataPredicates = spec.metadata ?? null;
    const limit = spec.limit ?? 100;
    const warnings: string[] = [];
    if (spec.name?.exact && matches.length > 1) {
      warnings.push(`AMBIGUOUS: exact name "${spec.name.exact}" matched ${matches.length} nodes; returning handles for every match.`);
    }
    if (matches.length > limit) warnings.push(`TRUNCATED: ${matches.length} matches limited to ${limit}.`);
    const data = matches.slice(0, limit).map(node => makeHandle(node, identity));
    return {
      data,
      observed: [
        'scene.nodes',
        'node.identity',
        'query.filters',
        ...(metadataPredicates ? ['query.metadata'] : []),
        ...metadataChannels,
      ],
      unavailable: [
        { channel: 'query.spatial', reason: 'Query 0.2 does not embed spatial filters; use spatialQuery 0.1' },
      ],
      warnings,
    };
  }

  function inspectNode(
    handle: RuntimeInspectorObjectHandle,
    spec: RuntimeInspectorInspectSpec,
  ): CommandResult<RuntimeInspectorObjectRecord> {
    const node = resolveHandle(handle);
    const identity = readIdentity();
    const sourceMesh = readBabylonSourceMesh(node);
    const boundingBox = readBabylonBoundingBox(node);
    const metadataDepth = clampInteger(spec.metadataDepth, 0, 8, 3);
    const data: RuntimeInspectorObjectRecord = {
      handle: makeHandle(node, identity),
      className: getBabylonNodeClassName(node),
      name: String(node.name ?? ''),
      enabled: isBabylonNodeEnabled(node),
      visible: readBabylonNodeVisible(node),
      visibility: readBabylonMeshVisibility(node)?.visibility ?? null,
      disposed: isBabylonNodeDisposed(node),
      transform: {
        position: vector3(node.position),
        rotation: vector3(node.rotation),
        rotationQuaternion: quaternion(node.rotationQuaternion),
        scaling: vector3(node.scaling),
        absolutePosition: readBabylonAbsolutePosition(node),
        absoluteScaling: readBabylonAbsoluteScaling(node),
      },
      boundingBox,
      parent: isRuntimeNode(node.parent) ? makeHandle(node.parent, identity) : null,
      material: readBabylonNodeMaterial(node),
      geometry: readBabylonNodeGeometry(node),
      skeleton: readBabylonNodeSkeleton(node),
      isAnInstance: getBabylonNodeKind(node) === 'instancedMesh',
      sourceMesh: sourceMesh ? makeHandle(sourceMesh, identity) : null,
      metadata: safeSerialize(node.metadata, { maxDepth: metadataDepth }),
    };
    const unavailable: Array<{ channel: string; reason: string }> = [];
    if (!boundingBox) unavailable.push({ channel: 'node.boundingBox', reason: 'node has no mesh bounding info' });
    return {
      data,
      observed: [
        'node.identity',
        'node.lifecycle',
        'node.transform',
        'node.relations.parent',
        'node.material',
        'node.geometry',
        'node.skeleton',
        'node.metadata',
      ],
      unavailable,
    };
  }

  function readRelations(handle: RuntimeInspectorObjectHandle): CommandResult<RuntimeInspectorRelationGraph> {
    const node = resolveHandle(handle);
    const scene = requireScene();
    const identity = readIdentity();
    const sourceMesh = readBabylonSourceMesh(node);
    const children = listBabylonRuntimeNodes(scene)
      .filter(candidate => candidate.parent === node)
      .map(candidate => makeHandle(candidate, identity))
      .sort(compareHandles);
    return {
      data: {
        self: makeHandle(node, identity),
        parent: isRuntimeNode(node.parent) ? makeHandle(node.parent, identity) : null,
        children,
        sourceMesh: sourceMesh ? makeHandle(sourceMesh, identity) : null,
        material: readBabylonNodeMaterial(node),
        skeleton: readBabylonNodeSkeleton(node),
      },
      observed: [
        'node.relations.parent',
        'node.relations.children',
        'node.relations.sourceMesh',
        'node.material',
        'node.skeleton',
      ],
    };
  }

  function readHierarchy(
    handle: RuntimeInspectorObjectHandle,
    hierarchyOptions: RuntimeInspectorHierarchyOptions,
  ): CommandResult<RuntimeInspectorHierarchyResult> {
    validateHierarchyOptions(hierarchyOptions);
    const focusNode = resolveHandle(handle);
    const scene = requireScene();
    const identity = readIdentity();
    const maxDepth = hierarchyOptions.maxDepth ?? 3;
    const maxNodes = hierarchyOptions.maxNodes ?? 100;
    const maxBytes = hierarchyOptions.maxBytes ?? 16_000;
    const metadataOptions = hierarchyOptions.metadata;
    const allNodes = listBabylonRuntimeNodes(scene);
    const childrenByParent = new Map<string, BabylonRuntimeNode[]>();
    for (const candidate of allNodes) {
      if (!isRuntimeNode(candidate.parent)) continue;
      const key = String(candidate.parent.uniqueId);
      const children = childrenByParent.get(key) ?? [];
      children.push(candidate);
      childrenByParent.set(key, children);
    }
    for (const children of childrenByParent.values()) {
      children.sort((left, right) => compareHandles(makeHandle(left, identity), makeHandle(right, identity)));
    }

    const reachable = new Set<string>();
    const countStack = [focusNode];
    while (countStack.length > 0) {
      const current = countStack.pop()!;
      const key = String(current.uniqueId);
      if (reachable.has(key)) continue;
      reachable.add(key);
      countStack.push(...(childrenByParent.get(key) ?? []));
    }

    const reasons = new Set<'maxDepth' | 'maxNodes' | 'maxBytes' | 'cycle'>();
    let returnedNodeCount = 0;
    const buildNode = (node: BabylonRuntimeNode, depth: number, path: Set<string>): RuntimeInspectorHierarchyNode => {
      const key = String(node.uniqueId);
      const directChildren = childrenByParent.get(key) ?? [];
      const record: RuntimeInspectorHierarchyNode = {
        handle: makeHandle(node, identity),
        className: getBabylonNodeClassName(node),
        name: String(node.name ?? ''),
        enabled: isBabylonNodeEnabled(node),
        visible: readBabylonNodeVisible(node),
        childCount: directChildren.length,
        ...(metadataOptions ? { metadata: safeSerialize(node.metadata, metadataOptions) } : {}),
        children: [],
      };
      returnedNodeCount += 1;
      if (directChildren.length > 0 && depth >= maxDepth) {
        reasons.add('maxDepth');
        return record;
      }
      const nextPath = new Set(path);
      nextPath.add(key);
      for (const child of directChildren) {
        if (returnedNodeCount >= maxNodes) {
          reasons.add('maxNodes');
          break;
        }
        const childKey = String(child.uniqueId);
        if (nextPath.has(childKey)) {
          reasons.add('cycle');
          continue;
        }
        record.children.push(buildNode(child, depth + 1, nextPath));
      }
      return record;
    };

    const ancestors: RuntimeInspectorHierarchyResult['ancestors'] = [];
    const ancestorSeen = new Set<string>();
    let current = isRuntimeNode(focusNode.parent) ? focusNode.parent : null;
    while (current) {
      const key = String(current.uniqueId);
      if (ancestorSeen.has(key)) {
        reasons.add('cycle');
        break;
      }
      ancestorSeen.add(key);
      const directChildren = childrenByParent.get(key) ?? [];
      ancestors.push({
        handle: makeHandle(current, identity),
        className: getBabylonNodeClassName(current),
        name: String(current.name ?? ''),
        enabled: isBabylonNodeEnabled(current),
        visible: readBabylonNodeVisible(current),
        childCount: directChildren.length,
      });
      current = isRuntimeNode(current.parent) ? current.parent : null;
    }
    ancestors.reverse();
    const tree = buildNode(focusNode, 0, new Set());
    const removeLastDescendant = (node: RuntimeInspectorHierarchyNode): boolean => {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        if (removeLastDescendant(node.children[index])) return true;
        node.children.splice(index, 1);
        return true;
      }
      return false;
    };
    const data: RuntimeInspectorHierarchyResult = {
      focus: makeHandle(focusNode, identity),
      ancestors,
      tree,
      returnedNodeCount,
      totalNodeCount: reachable.size,
      omittedNodeCount: Math.max(0, reachable.size - returnedNodeCount),
      truncated: reasons.size > 0 || reachable.size > returnedNodeCount,
      truncationReasons: [...reasons].sort(),
    };
    while (JSON.stringify(data).length > maxBytes && data.returnedNodeCount > 1) {
      if (!removeLastDescendant(tree)) break;
      data.returnedNodeCount -= 1;
      data.omittedNodeCount = Math.max(0, data.totalNodeCount - data.returnedNodeCount);
      reasons.add('maxBytes');
      data.truncated = true;
      data.truncationReasons = [...reasons].sort();
    }
    if (JSON.stringify(data).length > maxBytes) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'hierarchy root and ancestor chain exceed maxBytes', { maxBytes });
    }
    return {
      data,
      observed: ['node.hierarchy.ancestors', 'node.hierarchy.descendants', 'node.hierarchy.truncation'],
      unavailable: metadataOptions ? [] : [{ channel: 'node.hierarchy.metadata', reason: 'metadata was not requested' }],
    };
  }

  function readSpatialGeometry(handle: RuntimeInspectorObjectHandle): CommandResult<RuntimeInspectorSpatialGeometryResult> {
    const node = resolveHandle(handle);
    const scene = requireScene();
    const identity = readIdentity();
    const markerType = readRequiredMetadataString(node.metadata, ['sceneMarker', 'type'], 'sceneMarker.type');
    const markerKind = readOptionalMetadataString(node.metadata, ['sceneMarker', 'kind'], 'sceneMarker.kind');
    const geometryKind = readRequiredMetadataString(node.metadata, ['sceneMarker', 'geometry', 'kind'], 'sceneMarker.geometry.kind');
    const base = {
      handle: makeHandle(node, identity),
      markerType,
      markerKind,
      coordinateSpace: 'world' as const,
    };
    if (geometryKind === 'point') {
      const authoredSpace = readOptionalMetadataString(
        node.metadata,
        ['sceneMarker', 'geometry', 'coordinateSpace'],
        'sceneMarker.geometry.coordinateSpace',
      ) ?? 'world';
      if (authoredSpace !== 'world' && authoredSpace !== 'local') {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `unsupported marker point coordinateSpace: ${authoredSpace}`);
      }
      const authoredPosition = readOptionalMetadataVector3(
        node.metadata,
        ['sceneMarker', 'geometry', 'position'],
        'sceneMarker.geometry.position',
      );
      const offset = readOptionalMetadataVector3(
        node.metadata,
        ['sceneMarker', 'geometry', 'offset'],
        'sceneMarker.geometry.offset',
      );
      const absolutePosition = readBabylonAbsolutePosition(node);
      if (!absolutePosition) throw new RuntimeInspectorCommandError('UNAVAILABLE', 'marker node world position is unavailable');
      let position: Vector3;
      if (authoredSpace === 'world') {
        position = authoredPosition
          ?? Vector3.FromArray(absolutePosition).add(offset ?? Vector3.Zero());
      } else {
        try {
          node.computeWorldMatrix(true);
          position = Vector3.TransformCoordinates(authoredPosition ?? Vector3.Zero(), node.getWorldMatrix());
        } catch (error) {
          throw new RuntimeInspectorCommandError(
            'UNAVAILABLE',
            `marker local point could not be transformed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      return {
        data: { ...base, kind: 'point', position: vector3(position)! },
        observed: ['node.metadata.sceneMarker.geometry', 'node.transform.world'],
      };
    }
    if (geometryKind === 'box') {
      const center = readBabylonAbsolutePosition(node);
      const scaling = readBabylonAbsoluteScaling(node);
      if (!center || !scaling) throw new RuntimeInspectorCommandError('UNAVAILABLE', 'marker box world transform is unavailable');
      node.computeWorldMatrix(true);
      const axes = normalizeCameraReferenceAxes(
        Vector3.TransformNormal(Vector3.Right(), node.getWorldMatrix()),
        Vector3.TransformNormal(Vector3.Up(), node.getWorldMatrix()),
        Vector3.TransformNormal(Vector3.Forward(), node.getWorldMatrix()),
        'marker box',
      );
      const size: [number, number, number] = scaling.map(value => roundNumber(Math.abs(value))) as [number, number, number];
      const corners = buildOrientedBoxCorners(center, size, axes);
      return {
        data: { ...base, kind: 'box', center, size, ...axes, corners },
        observed: ['node.metadata.sceneMarker.geometry', 'node.transform.world'],
      };
    }
    if (geometryKind === 'polyhedron') {
      const authoredSpace = readOptionalMetadataString(
        node.metadata,
        ['sceneMarker', 'geometry', 'coordinateSpace'],
        'sceneMarker.geometry.coordinateSpace',
      ) ?? 'world';
      if (authoredSpace !== 'world') {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `unsupported marker polyhedron coordinateSpace: ${authoredSpace}`);
      }
      const verticesValue = readRequiredMetadataValue(
        node.metadata,
        ['sceneMarker', 'geometry', 'vertices'],
        'sceneMarker.geometry.vertices',
      );
      const vertices = readMetadataVectorArray(verticesValue, 'sceneMarker.geometry.vertices', 200);
      const facesValue = readOptionalMetadataValue(node.metadata, ['sceneMarker', 'geometry', 'faces']);
      const faces = facesValue === undefined ? [] : readMetadataFaceArray(facesValue, vertices.length, 200);
      return {
        data: { ...base, kind: 'polyhedron', vertices: vertices.map(value => vector3(value)!), faces },
        observed: ['node.metadata.sceneMarker.geometry'],
      };
    }
    if (geometryKind === 'object-bounds') {
      const targetKind = readRequiredMetadataString(
        node.metadata,
        ['sceneMarker', 'geometry', 'target', 'kind'],
        'sceneMarker.geometry.target.kind',
      );
      const targetId = readRequiredMetadataString(
        node.metadata,
        ['sceneMarker', 'geometry', 'target', 'id'],
        'sceneMarker.geometry.target.id',
      );
      const targetLabel = readOptionalMetadataString(
        node.metadata,
        ['sceneMarker', 'geometry', 'target', 'label'],
        'sceneMarker.geometry.target.label',
      );
      const targetPath = readOptionalMetadataString(
        node.metadata,
        ['sceneMarker', 'geometry', 'target', 'path'],
        'sceneMarker.geometry.target.path',
      );
      const matches = listBabylonRuntimeNodes(scene).filter(candidate => {
        const value = readOwnMetadataPath(candidate.metadata, ['sceneNodeId']);
        if (value.failed) {
          throw new RuntimeInspectorCommandError('UNAVAILABLE', 'sceneNodeId metadata could not be read safely');
        }
        return value.found && value.value === targetId;
      });
      if (matches.length !== 1) {
        throw new RuntimeInspectorCommandError(
          'UNAVAILABLE',
          `object-bounds target ${targetId} resolved ${matches.length} runtime nodes; expected exactly one`,
        );
      }
      const targetNode = matches[0];
      return {
        data: {
          ...base,
          kind: 'object-bounds',
          targetRef: {
            kind: targetKind,
            id: targetId,
            ...(targetLabel ? { label: targetLabel } : {}),
            ...(targetPath ? { path: targetPath } : {}),
          },
          targetHandle: makeHandle(targetNode, identity),
          bounds: readAggregateBounds(scene, [targetNode]),
        },
        observed: ['node.metadata.sceneMarker.geometry', 'scene.nodes', 'node.boundingBox'],
      };
    }
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `unsupported marker geometry kind: ${geometryKind}`);
  }

  function runSpatialQuery(spec: RuntimeInspectorSpatialQuerySpec): CommandResult<RuntimeInspectorSpatialQueryResult> {
    validateSpatialQuerySpec(spec);
    const scene = requireScene();
    const identity = readIdentity();
    const limit = spec.limit ?? 50;
    const includeNode = (node: BabylonRuntimeNode) => (
      (spec.includeDisabled === true || isBabylonNodeEnabled(node))
      && (spec.includeHidden === true || (
        readBabylonNodeVisible(node) !== false
        && (readBabylonMeshVisibility(node)?.visibility ?? 1) > 0
      ))
    );
    if (spec.kind === 'ray') {
      const origin = Vector3.FromArray(spec.origin);
      const direction = Vector3.FromArray(spec.direction).normalize();
      const ray = new Ray(origin, direction, spec.length);
      const uniqueHits = new Map<string, RuntimeInspectorSpatialQueryResult['hits'][number]>();
      const picks = scene.multiPickWithRay(ray, mesh => includeNode(mesh as BabylonRuntimeNode)) ?? [];
      for (const pick of picks.sort((left, right) => left.distance - right.distance)) {
        const mesh = pick.pickedMesh;
        if (!mesh || !Number.isFinite(pick.distance) || pick.distance < 0 || pick.distance > spec.length) continue;
        const engineId = String(mesh.uniqueId);
        if (uniqueHits.has(engineId)) continue;
        let normal: [number, number, number] | null = null;
        try {
          normal = vector3(pick.getNormal(true, true)) ?? null;
        } catch {
          normal = null;
        }
        uniqueHits.set(engineId, {
          handle: makeHandle(mesh as BabylonRuntimeNode, identity),
          distance: roundNumber(pick.distance),
          ...(pick.pickedPoint ? { point: vector3(pick.pickedPoint)! } : {}),
          normal,
        });
      }
      const allHits = [...uniqueHits.values()];
      return {
        data: {
          method: 'mesh-ray-v1',
          query: { ...spec, direction: vector3(direction)! },
          totalHitCount: allHits.length,
          truncated: allHits.length > limit,
          hits: allHits.slice(0, limit),
          limitations: [
            'ray hits are mesh geometry intersections and do not include particles, sprites, post-processes, or shader-only displacement outside source geometry',
            'the predicate includes enabled visible meshes regardless of isPickable unless explicitly filtered by visibility options',
          ],
        },
        observed: ['scene.meshes', 'node.geometry', 'node.visibility', 'query.spatial.ray'],
        warnings: allHits.length > limit ? [`TRUNCATED: ${allHits.length} ray hits limited to ${limit}.`] : [],
      };
    }

    const hits: RuntimeInspectorSpatialQueryResult['hits'] = [];
    const queryCenter = spec.kind === 'sphere'
      ? Vector3.FromArray(spec.center)
      : Vector3.Center(Vector3.FromArray(spec.minimum), Vector3.FromArray(spec.maximum));
    for (const node of listBabylonRuntimeNodes(scene)) {
      if (!isBabylonMeshNode(node) || !includeNode(node)) continue;
      const rawBounds = readBabylonBoundingBox(node);
      if (!rawBounds) continue;
      const minimum = Vector3.FromArray(rawBounds.minimumWorld);
      const maximum = Vector3.FromArray(rawBounds.maximumWorld);
      const center = Vector3.Center(minimum, maximum);
      let matches = false;
      let distance = 0;
      if (spec.kind === 'sphere') {
        const relation = spec.relation ?? 'intersects';
        if (relation === 'center-inside') {
          distance = Vector3.Distance(queryCenter, center);
          matches = distance <= spec.radius;
        } else {
          distance = distancePointToAabb(queryCenter, minimum, maximum);
          matches = distance <= spec.radius;
        }
      } else {
        const queryMinimum = Vector3.FromArray(spec.minimum);
        const queryMaximum = Vector3.FromArray(spec.maximum);
        const relation = spec.relation ?? 'intersects';
        matches = relation === 'contained'
          ? aabbContains(queryMinimum, queryMaximum, minimum, maximum)
          : aabbIntersects(queryMinimum, queryMaximum, minimum, maximum);
        distance = Vector3.Distance(queryCenter, center);
      }
      if (!matches) continue;
      hits.push({
        handle: makeHandle(node, identity),
        distance: roundNumber(distance),
        bounds: aggregateBoundsFromMinimumMaximum(minimum, maximum),
      });
    }
    hits.sort((left, right) => left.distance - right.distance || left.handle.engineId.localeCompare(right.handle.engineId));
    return {
      data: {
        method: spec.kind === 'sphere' ? 'bounds-sphere-v1' : 'bounds-aabb-v1',
        query: spec,
        totalHitCount: hits.length,
        truncated: hits.length > limit,
        hits: hits.slice(0, limit),
        limitations: [
          'bounds queries test renderable mesh world AABBs; TransformNode aggregate hierarchy and exact triangle volume are not included in v0.1',
        ],
      },
      observed: ['scene.meshes', 'node.boundingBox', 'node.visibility', `query.spatial.${spec.kind}`],
      warnings: hits.length > limit ? [`TRUNCATED: ${hits.length} spatial hits limited to ${limit}.`] : [],
    };
  }

  function runLogicalQuery(rawSpec: RuntimeInspectorLogicalQuerySpec): CommandResult<RuntimeInspectorLogicalQueryResult> {
    const spec = validateLogicalQuerySpec(rawSpec);
    const scene = requireScene();
    const identity = readIdentity();
    const providers = readRuntimeInspectorLogicalObjectProviders();
    if (providers.length === 0) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'no logical object provider is registered');
    }
    const sceneNodes = listBabylonRuntimeNodes(scene);
    const sceneNodeSet = new Set(sceneNodes);
    const records: RuntimeInspectorLogicalObjectRecord[] = [];
    const logicalIds = new Map<string, string>();

    for (const provider of providers) {
      const providerId = readBoundedProviderString(provider.id, 'logical object provider id');
      let descriptors: RuntimeInspectorLogicalObjectDescriptor[];
      try {
        descriptors = provider.list();
      } catch (error) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `logical object provider "${providerId}" failed`, {
          providerId,
          error: formatError(error),
        });
      }
      if (!Array.isArray(descriptors) || descriptors.length > 500) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `logical object provider "${providerId}" must return at most 500 descriptors`);
      }
      for (const rawDescriptor of descriptors) {
        const descriptor = validateLogicalObjectDescriptor(rawDescriptor, providerId, sceneNodeSet);
        const previousProvider = logicalIds.get(descriptor.id);
        if (previousProvider) {
          throw new RuntimeInspectorCommandError('AMBIGUOUS', `logical object id "${descriptor.id}" is duplicated`, {
            logicalId: descriptor.id,
            providers: [previousProvider, providerId],
          });
        }
        logicalIds.set(descriptor.id, providerId);
        const controlNodes = uniqueRuntimeNodes([descriptor.root, ...(descriptor.members ?? [])]);
        const members = expandLogicalMembers(sceneNodes, controlNodes);
        const memberHandles = members.map(node => makeHandle(node, identity)).sort(compareHandles);
        let aggregateBounds: RuntimeInspectorLogicalObjectRecord['aggregateBounds'] = null;
        try {
          aggregateBounds = readAggregateBounds(scene, controlNodes);
        } catch {
          aggregateBounds = null;
        }
        records.push({
          logicalId: descriptor.id,
          name: descriptor.name,
          kind: descriptor.kind,
          tags: uniqueSorted(descriptor.tags ?? []),
          provenance: { providerId, source: descriptor.source },
          rootHandle: makeHandle(descriptor.root, identity),
          controlHandles: controlNodes.map(node => makeHandle(node, identity)).sort(compareHandles),
          memberHandles: memberHandles.slice(0, 200),
          memberCount: memberHandles.length,
          membersTruncated: memberHandles.length > 200,
          aggregateBounds,
          metadata: safeSerialize(descriptor.metadata, { maxDepth: 4, maxKeys: 64, maxArray: 64 }),
        });
      }
    }

    const nameMatcher = createNameMatcher(spec.name);
    const kinds = spec.kind === undefined
      ? null
      : new Set(Array.isArray(spec.kind) ? spec.kind : [spec.kind]);
    const filtered = records.filter(record => {
      if (spec.id !== undefined && record.logicalId !== spec.id) return false;
      if (kinds && !kinds.has(record.kind)) return false;
      if (nameMatcher && !nameMatcher(record.name)) return false;
      if (spec.tags?.all && !spec.tags.all.every(tag => record.tags.includes(tag))) return false;
      if (spec.tags?.any && !spec.tags.any.some(tag => record.tags.includes(tag))) return false;
      return true;
    }).sort((left, right) => (
      left.logicalId.localeCompare(right.logicalId)
      || left.provenance.providerId.localeCompare(right.provenance.providerId)
    ));
    const limit = spec.limit ?? 50;
    const warnings: string[] = [];
    if (filtered.length > limit) warnings.push(`TRUNCATED: ${filtered.length} logical objects limited to ${limit}.`);
    for (const record of filtered.slice(0, limit)) {
      if (record.membersTruncated) warnings.push(`TRUNCATED: logical object "${record.logicalId}" has ${record.memberCount} members; returning 200.`);
      if (!record.aggregateBounds) warnings.push(`UNAVAILABLE: logical object "${record.logicalId}" has no renderable world bounds.`);
    }
    return {
      data: {
        method: 'provider-logical-objects-v1',
        query: spec,
        totalMatchCount: filtered.length,
        truncated: filtered.length > limit,
        objects: filtered.slice(0, limit),
        limitations: [
          'logical objects are provider-authoritative; unregistered business objects are intentionally absent',
          'member handles are bounded to 200 while controlHandles preserve the root plus every explicit out-of-tree member',
          'aggregate bounds include renderable descendants of root and explicit members; non-visual logical objects return null bounds',
        ],
      },
      observed: [
        'project.logicalObjects',
        'project.logicalObjects.metadata',
        'project.logicalObjects.provenance',
        'scene.nodes',
        'node.boundingBox',
      ],
      warnings,
    };
  }

  function readVfxCatalog(): CommandResult<RuntimeInspectorVfxCatalogResult> {
    const scene = requireScene();
    const identity = readIdentity();
    const registered = readRuntimeInspectorVfxProviders();
    if (registered.length === 0) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'no VFX provider is registered');
    }
    const sceneNodes = new Set(listBabylonRuntimeNodes(scene));
    const effects: RuntimeInspectorVfxEffectRecord[] = [];
    const usages: RuntimeInspectorVfxUsageRecord[] = [];
    const warnings: string[] = [];
    const providerIds = new Set<string>();

    for (const provider of registered) {
      const providerId = readBoundedProviderString(provider.id, 'VFX provider id');
      if (providerIds.has(providerId)) {
        throw new RuntimeInspectorCommandError('AMBIGUOUS', `VFX provider id "${providerId}" is duplicated`);
      }
      providerIds.add(providerId);
      let rawEffects: RuntimeInspectorVfxEffectDescriptor[];
      let rawUsages: RuntimeInspectorVfxUsageDescriptor[];
      try {
        rawEffects = provider.listEffects();
        rawUsages = provider.listUsages();
      } catch (error) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX provider "${providerId}" failed`, {
          providerId,
          error: formatError(error),
        });
      }
      if (!Array.isArray(rawEffects) || rawEffects.length > 200) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX provider "${providerId}" must return at most 200 effects`);
      }
      if (!Array.isArray(rawUsages) || rawUsages.length > 500) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX provider "${providerId}" must return at most 500 usages`);
      }
      const effectIds = new Set<string>();
      for (const rawEffect of rawEffects) {
        const effect = validateVfxEffectDescriptor(rawEffect, providerId);
        if (effectIds.has(effect.id)) {
          throw new RuntimeInspectorCommandError('AMBIGUOUS', `VFX effect id "${effect.id}" is duplicated within provider "${providerId}"`);
        }
        effectIds.add(effect.id);
        effects.push({
          providerId,
          id: effect.id,
          name: effect.name,
          placement: effect.placement,
          geometrySpace: effect.geometrySpace ?? null,
          requiredInputs: uniqueSorted(effect.requiredInputs ?? []),
          optionalInputs: uniqueSorted(effect.optionalInputs ?? []),
          defaultParams: safeSerialize(effect.defaultParams ?? null, { maxDepth: 5, maxKeys: 96, maxArray: 96 }),
          paramDefinitions: safeSerialize(effect.paramDefinitions ?? [], { maxDepth: 5, maxKeys: 96, maxArray: 96 }) as unknown[],
          metadata: safeSerialize(effect.metadata ?? null, { maxDepth: 4, maxKeys: 64, maxArray: 64 }),
          provenance: { source: effect.source },
        });
      }
      const usageIds = new Set<string>();
      for (const rawUsage of rawUsages) {
        const usage = validateVfxUsageDescriptor(rawUsage, providerId);
        if (usageIds.has(usage.id)) {
          throw new RuntimeInspectorCommandError('AMBIGUOUS', `VFX usage id "${usage.id}" is duplicated within provider "${providerId}"`);
        }
        usageIds.add(usage.id);
        let instance: RuntimeInspectorVfxUsageRecord['instance'];
        if (usage.root === undefined) {
          instance = { state: 'unavailable', rootHandle: null };
        } else if (usage.root === null) {
          instance = { state: 'inactive', rootHandle: null };
        } else if (!isRuntimeNode(usage.root) || !sceneNodes.has(usage.root) || isBabylonNodeDisposed(usage.root)) {
          instance = { state: 'unavailable', rootHandle: null };
          warnings.push(`UNAVAILABLE: VFX usage "${providerId}/${usage.id}" root is not a live node in the current scene.`);
        } else {
          instance = { state: 'active', rootHandle: makeHandle(usage.root, identity) };
        }
        usages.push({
          providerId,
          id: usage.id,
          label: usage.label,
          effectId: usage.effectId,
          effectAvailable: effectIds.has(usage.effectId),
          placement: usage.placement,
          lifecycle: usage.lifecycle,
          binding: safeSerialize(usage.binding ?? null, { maxDepth: 4, maxKeys: 64, maxArray: 64 }),
          params: safeSerialize(usage.params ?? null, { maxDepth: 5, maxKeys: 96, maxArray: 96 }),
          offset: safeSerialize(usage.offset ?? null, { maxDepth: 4, maxKeys: 64, maxArray: 64 }),
          instance,
          provenance: { source: usage.source },
        });
        if (!effectIds.has(usage.effectId)) {
          warnings.push(`UNAVAILABLE: VFX usage "${providerId}/${usage.id}" references missing effect "${usage.effectId}".`);
        }
      }
    }

    effects.sort((left, right) => left.providerId.localeCompare(right.providerId) || left.id.localeCompare(right.id));
    usages.sort((left, right) => left.providerId.localeCompare(right.providerId) || left.id.localeCompare(right.id));
    return {
      data: {
        method: 'provider-vfx-catalog-v1',
        effects,
        usages,
        providerCount: registered.length,
        limitations: [
          'VFX catalog facts are provider-authoritative; unregistered effects and usages are intentionally absent.',
          'Instance roots cover provider-owned TransformNodes only; particle internals, GPU contribution and detached world-space geometry are not inferred.',
          'VFX Provider 0.1 is observation-only and does not preview, save, replay or sweep parameters.',
        ],
      },
      observed: [
        'project.vfx.effects',
        'project.vfx.usages',
        'project.vfx.bindings',
        'project.vfx.params',
        'project.vfx.instances',
      ],
      unavailable: [
        { channel: 'vfx.particleInternals', reason: 'VFX Provider 0.1 does not inspect particle pools, living particles or emitter internals.' },
        { channel: 'vfx.gpuContribution', reason: 'Catalog and root presence do not prove final-pixel contribution.' },
        { channel: 'vfx.parameterMutation', reason: 'Parameter preview/save/sweep is intentionally deferred to a recoverable control slice.' },
      ],
      warnings,
    };
  }

  function readMaterialCatalog(): CommandResult<RuntimeInspectorMaterialCatalogResult> {
    const scene = requireScene();
    const identity = readIdentity();
    const registered = readRuntimeInspectorMaterialProviders();
    if (registered.length === 0) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'no material provider is registered');
    }
    const sceneMaterials = new Set(scene.materials);
    const sceneNodes = listBabylonRuntimeNodes(scene);
    const assets: RuntimeInspectorMaterialAssetRecord[] = [];
    const instances: RuntimeInspectorMaterialInstanceRecord[] = [];
    const providerIds = new Set<string>();

    for (const provider of registered) {
      const providerId = readBoundedProviderString(provider.id, 'material provider id');
      if (providerIds.has(providerId)) {
        throw new RuntimeInspectorCommandError('AMBIGUOUS', `material provider id "${providerId}" is duplicated`);
      }
      providerIds.add(providerId);
      let rawAssets: RuntimeInspectorMaterialAssetDescriptor[];
      let rawInstances: RuntimeInspectorMaterialInstanceDescriptor[];
      try {
        rawAssets = provider.listAssets();
        rawInstances = provider.listInstances();
      } catch (error) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `material provider "${providerId}" failed`, {
          providerId,
          error: formatError(error),
        });
      }
      if (!Array.isArray(rawAssets) || rawAssets.length > 500) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `material provider "${providerId}" must return at most 500 assets`);
      }
      if (!Array.isArray(rawInstances) || rawInstances.length > 1000) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `material provider "${providerId}" must return at most 1000 instances`);
      }

      const assetIds = new Set<string>();
      for (const rawAsset of rawAssets) {
        const asset = validateMaterialAssetDescriptor(rawAsset, providerId);
        if (assetIds.has(asset.id)) {
          throw new RuntimeInspectorCommandError('AMBIGUOUS', `material asset id "${asset.id}" is duplicated within provider "${providerId}"`);
        }
        assetIds.add(asset.id);
        assets.push({
          providerId,
          id: asset.id,
          name: asset.name,
          kind: asset.kind,
          profile: safeSerialize(asset.profile ?? null, { maxDepth: 6, maxKeys: 128, maxArray: 96 }),
          readonly: asset.readonly === true,
          origin: safeSerialize(asset.origin ?? null, { maxDepth: 5, maxKeys: 64, maxArray: 64 }),
          metadata: safeSerialize(asset.metadata ?? null, { maxDepth: 4, maxKeys: 64, maxArray: 64 }),
          provenance: { source: asset.source },
        });
      }

      const instanceIds = new Set<string>();
      for (const rawInstance of rawInstances) {
        const instance = validateMaterialInstanceDescriptor(rawInstance, providerId, sceneMaterials);
        if (instanceIds.has(instance.id)) {
          throw new RuntimeInspectorCommandError('AMBIGUOUS', `material instance id "${instance.id}" is duplicated within provider "${providerId}"`);
        }
        instanceIds.add(instance.id);
        const boundNodes = sceneNodes.filter(node => runtimeNodeUsesMaterial(node, instance.material));
        const bindingsTruncated = boundNodes.length > 200;
        const bindings = boundNodes.slice(0, 200).map(node => makeHandle(node, identity)).sort(compareHandles);
        const sceneNodeIds = uniqueSorted(boundNodes.flatMap(node => {
          const sceneNodeId = readRuntimeSceneNodeId(node);
          return sceneNodeId ? [sceneNodeId] : [];
        }));
        const renderRecord = readRenderMaterialRecord(instance.material, 'mesh');
        instances.push({
          providerId,
          id: instance.id,
          name: renderRecord.name ?? '',
          className: renderRecord.className ?? 'Material',
          properties: readMaterialProperties(instance.material),
          textures: renderRecord.textures,
          texturesTruncated: renderRecord.texturesTruncated,
          bindings,
          bindingsTruncated,
          sceneNodeIds,
          sharedAcrossSceneNodes: boundNodes.length > 1,
          provenance: { source: instance.source },
        });
      }
    }

    assets.sort((left, right) => left.providerId.localeCompare(right.providerId) || left.id.localeCompare(right.id));
    instances.sort((left, right) => left.providerId.localeCompare(right.providerId) || left.id.localeCompare(right.id));
    return {
      data: {
        method: 'provider-material-catalog-v1',
        assets,
        instances,
        providerCount: registered.length,
        limitations: [
          'Material assets and runtime instances are separate provider-authoritative inventories; 0.1 does not guess asset-to-instance identity without explicit provenance.',
          'Bindings cover Babylon mesh material and MultiMaterial sub-material references in the current scene; shader-only, post-process and GPU-only materials are not inferred.',
          'Material Provider 0.1 is observation-only and never previews or saves authored profiles.',
        ],
      },
      observed: [
        'project.material.assets',
        'project.material.profiles',
        'scene.materials',
        'scene.material.bindings',
        'scene.material.textures',
        'scene.material.properties',
      ],
      unavailable: [
        { channel: 'material.assetInstanceMapping', reason: 'Material Provider 0.1 does not infer authored asset identity from similar runtime values.' },
        { channel: 'material.shaderInternals', reason: 'Shader uniforms, NodeMaterial blocks and GPU program state are not inspected.' },
        { channel: 'material.mutation', reason: 'Material Provider 0.1 is read-only; recoverable preview belongs to a later control slice.' },
      ],
    };
  }

  function readAnimationCatalog(): CommandResult<RuntimeInspectorAnimationCatalogResult> {
    const scene = requireScene();
    const identity = readIdentity();
    const registered = readRuntimeInspectorAnimationProviders();
    if (registered.length === 0) throw new RuntimeInspectorCommandError('UNAVAILABLE', 'no animation provider is registered');
    const liveGroups = new Set(scene.animationGroups);
    const sceneNodes = new Set(listBabylonRuntimeNodes(scene));
    const groups: RuntimeInspectorAnimationGroupRecord[] = [];
    const providerIds = new Set<string>();

    for (const provider of registered) {
      const providerId = readBoundedProviderString(provider.id, 'animation provider id');
      if (providerIds.has(providerId)) throw new RuntimeInspectorCommandError('AMBIGUOUS', `animation provider id "${providerId}" is duplicated`);
      providerIds.add(providerId);
      let descriptors: RuntimeInspectorAnimationGroupDescriptor[];
      try {
        descriptors = provider.listGroups();
      } catch (error) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `animation provider "${providerId}" failed`, formatError(error));
      }
      if (!Array.isArray(descriptors) || descriptors.length > 500) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', `animation provider "${providerId}" must return at most 500 groups`);
      }
      const ids = new Set<string>();
      for (const raw of descriptors) {
        const descriptor = validateAnimationGroupDescriptor(raw, providerId, liveGroups);
        if (ids.has(descriptor.id)) {
          throw new RuntimeInspectorCommandError('AMBIGUOUS', `animation group id "${descriptor.id}" is duplicated within provider "${providerId}"`);
        }
        ids.add(descriptor.id);
        const targets = descriptor.group.targetedAnimations.map(targeted => targeted.target);
        const targetNodes = uniqueRuntimeNodes(targets.filter((target): target is BabylonRuntimeNode => (
          isRuntimeNode(target) && sceneNodes.has(target) && !isBabylonNodeDisposed(target)
        )));
        const sceneNodeIds = uniqueSorted(targetNodes.flatMap(node => {
          const sceneNodeId = readRuntimeSceneNodeId(node);
          return sceneNodeId ? [sceneNodeId] : [];
        }));
        groups.push({
          providerId,
          id: descriptor.id,
          name: String(descriptor.group.name ?? ''),
          range: {
            from: nullableNumber(descriptor.group.from) ?? 0,
            to: nullableNumber(descriptor.group.to) ?? 0,
            currentFrame: nullableNumber(descriptor.group.getCurrentFrame()) ?? 0,
          },
          state: {
            isStarted: Boolean(descriptor.group.isStarted),
            isPlaying: Boolean(descriptor.group.isPlaying),
            speedRatio: nullableNumber(descriptor.group.speedRatio) ?? 0,
            loopAnimation: Boolean(descriptor.group.loopAnimation),
            isAdditive: Boolean(descriptor.group.isAdditive),
            weight: nullableNumber(descriptor.group.weight) ?? 0,
          },
          targetCount: targets.length,
          targetHandles: targetNodes.map(node => makeHandle(node, identity)).sort(compareHandles),
          unresolvedTargetCount: targets.length - targetNodes.length,
          sceneNodeIds,
          provenance: { source: descriptor.source },
        });
      }
    }

    groups.sort((left, right) => left.providerId.localeCompare(right.providerId) || left.id.localeCompare(right.id));
    return {
      data: {
        method: 'provider-animation-catalog-v1',
        groups,
        providerCount: registered.length,
        limitations: [
          'Animation groups are live provider-owned Scene facts; authored clip intent and gameplay state-machine meaning are not inferred.',
          'Stable handles cover TransformNode/Mesh targets only; Bone, MorphTarget and other non-scene-node targets remain explicitly unresolved.',
          'Catalog reads are observation-only; pause, seek and speed preview require a separate recoverable Animation Control lease.',
        ],
      },
      observed: ['scene.animation.groups', 'scene.animation.range', 'scene.animation.state', 'scene.animation.targets'],
      unavailable: [
        { channel: 'animation.authoredIntent', reason: 'Live AnimationGroup names do not prove gameplay state-machine semantics.' },
        { channel: 'animation.nonNodeTargets', reason: 'Bone, MorphTarget and other non-scene-node targets do not have ObjectHandles in 0.1.' },
        { channel: 'animation.persistence', reason: 'Animation Control previews runtime state only and never save authored clips or gameplay state.' },
      ],
    };
  }

  function acquireAnimationLease(options: RuntimeInspectorAnimationAcquireOptions): CommandResult<RuntimeInspectorAnimationLeaseRecord> {
    validateAnimationAcquireOptions(options);
    if (activeAnimationLease) {
      throw new RuntimeInspectorCommandError('LEASE_CONFLICT', 'an animation lease is already active', {
        activeLease: readAnimationLeaseRecord(activeAnimationLease),
      });
    }
    const scene = requireScene();
    const acquiredAtMs = Date.now();
    const timeoutMs = options.timeoutMs ?? 60_000;
    const entry: AnimationLeaseEntry = {
      record: {
        id: createId('animation-lease'),
        owner: options.owner?.trim() || 'agent',
        reason: options.reason?.trim() || null,
        acquiredAt: new Date(acquiredAtMs).toISOString(),
        expiresAt: new Date(acquiredAtMs + timeoutMs).toISOString(),
        active: true,
        patchCount: 0,
        touchedGroups: [],
      },
      scene,
      patches: [],
      timeoutId: null,
    };
    entry.timeoutId = window.setTimeout(() => {
      if (activeAnimationLease?.record.id === entry.record.id) restoreActiveAnimationLease('timeout');
    }, timeoutMs);
    activeAnimationLease = entry;
    return {
      data: readAnimationLeaseRecord(entry),
      observed: ['animation.lease'],
      unavailable: [{ channel: 'animation.persistence', reason: 'Animation control is runtime-only and never saves authored clips or gameplay state.' }],
    };
  }

  function previewAnimationGroup(
    leaseId: string,
    spec: RuntimeInspectorAnimationPreviewSpec,
  ): CommandResult<RuntimeInspectorAnimationPreviewResult> {
    validateAnimationPreviewSpec(spec);
    const lease = requireAnimationLease(leaseId);
    if (lease.scene !== requireScene()) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'animation lease belongs to another scene');
    }
    const catalog = readAnimationCatalog().data;
    const group = catalog.groups.find(item => item.providerId === spec.providerId && item.id === spec.groupId);
    if (!group) {
      throw new RuntimeInspectorCommandError('NOT_FOUND', `animation group "${spec.providerId}/${spec.groupId}" was not found`);
    }
    const set = validateAnimationStatePatch(spec.set, group);
    const provider = readRuntimeInspectorAnimationProviders().find(item => item.id === spec.providerId);
    if (!provider?.captureGroupState || !provider.previewGroup || !provider.restoreGroupState) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `animation provider "${spec.providerId}" does not support recoverable control`);
    }
    const restoreState = provider.captureGroupState(spec.groupId);
    if (restoreState == null) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `animation group "${spec.providerId}/${spec.groupId}" state is unavailable`);
    }
    let applied = false;
    try {
      applied = provider.previewGroup(spec.groupId, set);
    } catch (error) {
      try { provider.restoreGroupState(spec.groupId, restoreState); } catch {}
      throw new RuntimeInspectorCommandError('INTERNAL_ERROR', `animation preview failed and was rolled back: ${formatError(error)}`);
    }
    if (!applied) {
      try { provider.restoreGroupState(spec.groupId, restoreState); } catch {}
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `animation provider rejected preview for "${spec.providerId}/${spec.groupId}"`);
    }
    const after = readAnimationCatalog().data.groups.find(item => item.providerId === spec.providerId && item.id === spec.groupId);
    if (!after) {
      try { provider.restoreGroupState(spec.groupId, restoreState); } catch {}
      throw new RuntimeInspectorCommandError('INTERNAL_ERROR', 'animation group disappeared after preview; state was rolled back');
    }
    const patchId = createId('animation-patch');
    lease.patches.push({
      id: patchId,
      provider,
      providerId: spec.providerId,
      groupId: spec.groupId,
      restoreState,
      before: group,
    });
    lease.record.patchCount = lease.patches.length;
    const touchedKey = `${spec.providerId}\u0000${spec.groupId}`;
    if (!lease.record.touchedGroups.some(item => `${item.providerId}\u0000${item.groupId}` === touchedKey)) {
      lease.record.touchedGroups.push({ providerId: spec.providerId, groupId: spec.groupId });
    }
    const changedFields = Object.keys(set).filter(key => {
      if (key === 'paused') return group.state.isPlaying !== after.state.isPlaying;
      if (key === 'currentFrame') return Math.abs(group.range.currentFrame - after.range.currentFrame) > 0.001;
      return group.state.speedRatio !== after.state.speedRatio;
    }).sort();
    return {
      data: {
        leaseId,
        patchId,
        providerId: spec.providerId,
        groupId: spec.groupId,
        changedFields,
        before: group,
        after,
      },
      observed: ['animation.lease', 'animation.preview', 'scene.animation.range', 'scene.animation.state'],
      unavailable: [
        { channel: 'animation.persistence', reason: 'Preview values are not saved to authored clips or gameplay state.' },
        { channel: 'animation.gameplaySemantics', reason: 'A successful AnimationGroup preview does not prove gameplay state-machine safety.' },
      ],
    };
  }

  function restoreAnimationByLeaseId(leaseId: string): CommandResult<RuntimeInspectorAnimationRestoreResult> {
    requireAnimationLease(leaseId);
    const result = restoreActiveAnimationLease('explicit');
    if (!result) throw new RuntimeInspectorCommandError('INVALID_LEASE', 'animation lease is no longer active', leaseId);
    return {
      data: result,
      observed: ['animation.lease', 'animation.restoreAudit', 'scene.animation.range', 'scene.animation.state'],
      warnings: result.restored ? [] : [`animation restore was incomplete: ${result.differences.join(', ')}`],
    };
  }

  function requireAnimationLease(leaseId: string): AnimationLeaseEntry {
    if (typeof leaseId !== 'string' || !leaseId.trim()) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'animation lease id must be a non-empty string');
    }
    if (!activeAnimationLease || activeAnimationLease.record.id !== leaseId) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'animation lease is missing, expired, or already restored', {
        requested: leaseId,
        active: activeAnimationLease?.record.id ?? null,
      });
    }
    return activeAnimationLease;
  }

  function restoreActiveAnimationLease(reason: string): RuntimeInspectorAnimationRestoreResult | null {
    const lease = activeAnimationLease;
    if (!lease) return null;
    activeAnimationLease = null;
    if (lease.timeoutId !== null) window.clearTimeout(lease.timeoutId);
    const differences: string[] = [];
    let restoredPatchCount = 0;
    for (const patch of [...lease.patches].reverse()) {
      try {
        const restored = patch.provider.restoreGroupState?.(patch.groupId, patch.restoreState) === true;
        if (!restored) {
          differences.push(`animation.patch:${patch.id}:provider-restore-failed`);
          continue;
        }
        const current = readAnimationCatalog().data.groups.find(item => (
          item.providerId === patch.providerId && item.id === patch.groupId
        ));
        if (current && animationRestoreMatches(patch.before, current)) restoredPatchCount += 1;
        else differences.push(`animation.patch:${patch.id}:state`);
      } catch (error) {
        differences.push(`animation.patch:${patch.id}:${formatError(error)}`);
      }
    }
    lease.patches.length = 0;
    lastAnimationRestore = {
      leaseId: lease.record.id,
      reason,
      restored: differences.length === 0,
      restoredPatchCount,
      differences,
    };
    return lastAnimationRestore;
  }

  function readAnimationLeaseRecord(lease: AnimationLeaseEntry): RuntimeInspectorAnimationLeaseRecord {
    return {
      ...lease.record,
      active: activeAnimationLease?.record.id === lease.record.id,
      patchCount: lease.patches.length,
      touchedGroups: lease.record.touchedGroups.map(item => ({ ...item })),
    };
  }

  function acquireMaterialLease(options: RuntimeInspectorMaterialAcquireOptions): CommandResult<RuntimeInspectorMaterialLeaseRecord> {
    validateMaterialAcquireOptions(options);
    if (activeMaterialLease) {
      throw new RuntimeInspectorCommandError('LEASE_CONFLICT', 'a material lease is already active', {
        activeLease: readMaterialLeaseRecord(activeMaterialLease),
      });
    }
    const scene = requireScene();
    const acquiredAtMs = Date.now();
    const timeoutMs = options.timeoutMs ?? 60_000;
    const entry: MaterialLeaseEntry = {
      record: {
        id: createId('material-lease'),
        owner: options.owner?.trim() || 'agent',
        reason: options.reason?.trim() || null,
        acquiredAt: new Date(acquiredAtMs).toISOString(),
        expiresAt: new Date(acquiredAtMs + timeoutMs).toISOString(),
        active: true,
        patchCount: 0,
        touchedInstances: [],
      },
      scene,
      patches: [],
      timeoutId: null,
    };
    entry.timeoutId = window.setTimeout(() => {
      if (activeMaterialLease?.record.id === entry.record.id) restoreActiveMaterialLease('timeout');
    }, timeoutMs);
    activeMaterialLease = entry;
    return {
      data: readMaterialLeaseRecord(entry),
      observed: ['material.lease'],
      unavailable: [{ channel: 'material.persistence', reason: 'Material control is runtime-only and never saves authored profiles.' }],
    };
  }

  function previewMaterialInstance(
    leaseId: string,
    spec: RuntimeInspectorMaterialPreviewSpec,
  ): CommandResult<RuntimeInspectorMaterialPreviewResult> {
    validateMaterialPreviewSpec(spec);
    const lease = requireMaterialLease(leaseId);
    if (lease.scene !== requireScene()) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'material lease belongs to another scene');
    }
    const catalog = readMaterialCatalog().data;
    const instance = catalog.instances.find(item => item.providerId === spec.providerId && item.id === spec.instanceId);
    if (!instance) {
      throw new RuntimeInspectorCommandError('NOT_FOUND', `material instance "${spec.providerId}/${spec.instanceId}" was not found`);
    }
    const provider = readRuntimeInspectorMaterialProviders().find(item => item.id === spec.providerId);
    if (!provider?.captureInstanceState || !provider.previewInstance || !provider.restoreInstanceState) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `material provider "${spec.providerId}" does not support recoverable control`);
    }
    const set = validateMaterialPropertyPatch(spec.set, instance.properties);
    const restoreState = provider.captureInstanceState(spec.instanceId);
    if (restoreState == null) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `material instance "${spec.providerId}/${spec.instanceId}" state is unavailable`);
    }
    let applied = false;
    try {
      applied = provider.previewInstance(spec.instanceId, set);
    } catch (error) {
      try { provider.restoreInstanceState(spec.instanceId, restoreState); } catch {}
      throw new RuntimeInspectorCommandError('INTERNAL_ERROR', `material preview failed and was rolled back: ${formatError(error)}`);
    }
    if (!applied) {
      try { provider.restoreInstanceState(spec.instanceId, restoreState); } catch {}
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `material provider rejected preview for "${spec.providerId}/${spec.instanceId}"`);
    }
    const after = readMaterialCatalog().data.instances.find(item => item.providerId === spec.providerId && item.id === spec.instanceId);
    if (!after) {
      try { provider.restoreInstanceState(spec.instanceId, restoreState); } catch {}
      throw new RuntimeInspectorCommandError('INTERNAL_ERROR', 'material instance disappeared after preview; state was rolled back');
    }
    const patchId = createId('material-patch');
    lease.patches.push({
      id: patchId,
      provider,
      providerId: spec.providerId,
      instanceId: spec.instanceId,
      restoreState,
      beforeProperties: instance.properties,
    });
    lease.record.patchCount = lease.patches.length;
    const touchedKey = `${spec.providerId}\u0000${spec.instanceId}`;
    if (!lease.record.touchedInstances.some(item => `${item.providerId}\u0000${item.instanceId}` === touchedKey)) {
      lease.record.touchedInstances.push({ providerId: spec.providerId, instanceId: spec.instanceId });
    }
    const changedFields = Object.keys(set).filter(key => (
      JSON.stringify(instance.properties[key as keyof typeof instance.properties])
      !== JSON.stringify(after.properties[key as keyof typeof after.properties])
    )).sort();
    return {
      data: {
        leaseId,
        patchId,
        providerId: spec.providerId,
        instanceId: spec.instanceId,
        changedFields,
        beforeProperties: instance.properties,
        afterProperties: after.properties,
        bindings: after.bindings,
        sceneNodeIds: after.sceneNodeIds,
        sharedAcrossSceneNodes: after.sharedAcrossSceneNodes,
      },
      observed: ['material.lease', 'material.preview', 'scene.material.properties', 'scene.material.bindings'],
      unavailable: [
        { channel: 'material.persistence', reason: 'Preview values are not saved to scene material assets or overrides.' },
        { channel: 'material.finalPixels', reason: 'A successful material preview does not prove final-pixel contribution.' },
      ],
      warnings: after.sharedAcrossSceneNodes
        ? [`material instance is shared across ${after.bindings.length}${after.bindingsTruncated ? '+' : ''} runtime scene nodes; every binding is affected`]
        : [],
    };
  }

  function restoreMaterialByLeaseId(leaseId: string): CommandResult<RuntimeInspectorMaterialRestoreResult> {
    requireMaterialLease(leaseId);
    const result = restoreActiveMaterialLease('explicit');
    if (!result) throw new RuntimeInspectorCommandError('INVALID_LEASE', 'material lease is no longer active', leaseId);
    return {
      data: result,
      observed: ['material.lease', 'material.restoreAudit', 'scene.material.properties'],
      warnings: result.restored ? [] : [`material restore was incomplete: ${result.differences.join(', ')}`],
    };
  }

  function requireMaterialLease(leaseId: string): MaterialLeaseEntry {
    if (typeof leaseId !== 'string' || !leaseId.trim()) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'material lease id must be a non-empty string');
    }
    if (!activeMaterialLease || activeMaterialLease.record.id !== leaseId) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'material lease is missing, expired, or already restored', {
        requested: leaseId,
        active: activeMaterialLease?.record.id ?? null,
      });
    }
    return activeMaterialLease;
  }

  function restoreActiveMaterialLease(reason: string): RuntimeInspectorMaterialRestoreResult | null {
    const lease = activeMaterialLease;
    if (!lease) return null;
    activeMaterialLease = null;
    if (lease.timeoutId !== null) window.clearTimeout(lease.timeoutId);
    const differences: string[] = [];
    let restoredPatchCount = 0;
    for (const patch of [...lease.patches].reverse()) {
      try {
        const restored = patch.provider.restoreInstanceState?.(patch.instanceId, patch.restoreState) === true;
        if (!restored) {
          differences.push(`material.patch:${patch.id}:provider-restore-failed`);
          continue;
        }
        const current = readMaterialCatalog().data.instances.find(item => (
          item.providerId === patch.providerId && item.id === patch.instanceId
        ));
        if (current && JSON.stringify(current.properties) === JSON.stringify(patch.beforeProperties)) restoredPatchCount += 1;
        else differences.push(`material.patch:${patch.id}:properties`);
      } catch (error) {
        differences.push(`material.patch:${patch.id}:${formatError(error)}`);
      }
    }
    lease.patches.length = 0;
    lastMaterialRestore = {
      leaseId: lease.record.id,
      reason,
      restored: differences.length === 0,
      restoredPatchCount,
      differences,
    };
    return lastMaterialRestore;
  }

  function readMaterialLeaseRecord(lease: MaterialLeaseEntry): RuntimeInspectorMaterialLeaseRecord {
    return {
      ...lease.record,
      active: activeMaterialLease?.record.id === lease.record.id,
      patchCount: lease.patches.length,
      touchedInstances: lease.record.touchedInstances.map(item => ({ ...item })),
    };
  }

  function acquireVfxLease(
    acquireOptions: RuntimeInspectorVfxAcquireOptions,
  ): CommandResult<RuntimeInspectorVfxLeaseRecord> {
    validateVfxAcquireOptions(acquireOptions);
    const scene = requireScene();
    if (activeVfxLease) {
      throw new RuntimeInspectorCommandError('LEASE_CONFLICT', 'VFX control already has an active lease', {
        activeLease: readVfxLeaseRecord(activeVfxLease),
      });
    }
    const owner = acquireOptions.owner?.trim() || 'agent';
    const reason = acquireOptions.reason?.trim() || null;
    const timeoutMs = acquireOptions.timeoutMs ?? 60_000;
    const acquiredAtMs = Date.now();
    const entry: VfxLeaseEntry = {
      record: {
        id: createId('vfx-lease'),
        owner,
        reason,
        acquiredAt: new Date(acquiredAtMs).toISOString(),
        expiresAt: new Date(acquiredAtMs + timeoutMs).toISOString(),
        active: true,
        patchCount: 0,
        touchedUsages: [],
      },
      scene,
      patches: [],
      timeoutId: null,
    };
    entry.timeoutId = window.setTimeout(() => {
      if (activeVfxLease?.record.id === entry.record.id) restoreActiveVfxLease('timeout');
    }, timeoutMs);
    activeVfxLease = entry;
    return {
      data: readVfxLeaseRecord(entry),
      observed: ['vfx.lease'],
      unavailable: [{
        channel: 'vfx.persistence',
        reason: 'VFX control is runtime-only and never saves authored usage or effect parameter files.',
      }],
    };
  }

  function previewVfxUsage(
    leaseId: string,
    spec: RuntimeInspectorVfxPreviewSpec,
  ): CommandResult<RuntimeInspectorVfxPreviewResult> {
    validateVfxPreviewSpec(spec);
    const lease = requireVfxLease(leaseId);
    if (lease.scene !== requireScene()) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'VFX lease belongs to another scene');
    }
    const catalog = readVfxCatalog().data;
    const usage = catalog.usages.find(item => item.providerId === spec.providerId && item.id === spec.usageId);
    if (!usage) {
      throw new RuntimeInspectorCommandError('NOT_FOUND', `VFX usage "${spec.providerId}/${spec.usageId}" was not found`);
    }
    if (!usage.effectAvailable) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX usage "${spec.providerId}/${spec.usageId}" references unavailable effect "${usage.effectId}"`);
    }
    const effect = catalog.effects.find(item => item.providerId === spec.providerId && item.id === usage.effectId);
    if (!effect) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX effect "${spec.providerId}/${usage.effectId}" is unavailable`);
    }
    const provider = readRuntimeInspectorVfxProviders().find(item => item.id === spec.providerId);
    if (!provider?.captureUsageState || !provider.previewUsage || !provider.restoreUsageState) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX provider "${spec.providerId}" does not support recoverable parameter control`);
    }
    const patchValues = validateVfxParamPatch(spec.set, effect.paramDefinitions);
    const beforeParams = isPlainRecord(usage.params) ? safeSerialize(usage.params, { maxDepth: 5, maxKeys: 96, maxArray: 96 }) : {};
    const nextParams = { ...(beforeParams as Record<string, unknown>), ...patchValues };
    const restoreState = provider.captureUsageState(spec.usageId);
    if (restoreState == null) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX usage "${spec.providerId}/${spec.usageId}" runtime state is unavailable`);
    }
    let applied = false;
    try {
      applied = provider.previewUsage(spec.usageId, nextParams);
    } catch (error) {
      try { provider.restoreUsageState(spec.usageId, restoreState); } catch { /* best effort rollback */ }
      throw new RuntimeInspectorCommandError('INTERNAL_ERROR', `VFX preview failed and was rolled back: ${formatError(error)}`);
    }
    if (!applied) {
      try { provider.restoreUsageState(spec.usageId, restoreState); } catch { /* best effort rollback */ }
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX provider rejected preview for "${spec.providerId}/${spec.usageId}"`);
    }
    const afterCatalog = readVfxCatalog().data;
    const afterUsage = afterCatalog.usages.find(item => item.providerId === spec.providerId && item.id === spec.usageId);
    if (!afterUsage) {
      try { provider.restoreUsageState(spec.usageId, restoreState); } catch { /* best effort rollback */ }
      throw new RuntimeInspectorCommandError('INTERNAL_ERROR', 'VFX usage disappeared after preview; state was rolled back');
    }
    const patchId = createId('vfx-patch');
    lease.patches.push({
      id: patchId,
      provider,
      providerId: spec.providerId,
      usageId: spec.usageId,
      restoreState,
      beforeParams,
    });
    lease.record.patchCount = lease.patches.length;
    const touchedKey = `${spec.providerId}\u0000${spec.usageId}`;
    if (!lease.record.touchedUsages.some(item => `${item.providerId}\u0000${item.usageId}` === touchedKey)) {
      lease.record.touchedUsages.push({ providerId: spec.providerId, usageId: spec.usageId });
    }
    const changedFields = Object.keys(patchValues).filter(key => (
      JSON.stringify((beforeParams as Record<string, unknown>)[key]) !== JSON.stringify((afterUsage.params as Record<string, unknown> | null)?.[key])
    )).sort();
    return {
      data: {
        leaseId,
        patchId,
        providerId: spec.providerId,
        usageId: spec.usageId,
        changedFields,
        beforeParams,
        afterParams: afterUsage.params,
        effectAvailable: afterUsage.effectAvailable,
        instance: afterUsage.instance,
      },
      observed: ['vfx.lease', 'vfx.preview', 'project.vfx.params', 'project.vfx.instances'],
      unavailable: [
        { channel: 'vfx.persistence', reason: 'Preview values are not saved to usages.json or effect parameter files.' },
        { channel: 'vfx.gpuContribution', reason: 'A successful parameter preview does not prove final-pixel contribution.' },
      ],
    };
  }

  function restoreVfxByLeaseId(leaseId: string): CommandResult<RuntimeInspectorVfxRestoreResult> {
    requireVfxLease(leaseId);
    const result = restoreActiveVfxLease('explicit');
    if (!result) throw new RuntimeInspectorCommandError('INVALID_LEASE', 'VFX lease is no longer active', leaseId);
    return {
      data: result,
      observed: ['vfx.lease', 'vfx.restoreAudit', 'project.vfx.params', 'project.vfx.instances'],
      warnings: result.restored ? [] : [`VFX restore was incomplete: ${result.differences.join(', ')}`],
    };
  }

  function requireVfxLease(leaseId: string): VfxLeaseEntry {
    if (typeof leaseId !== 'string' || !leaseId.trim()) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'VFX lease id must be a non-empty string');
    }
    if (!activeVfxLease || activeVfxLease.record.id !== leaseId) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'VFX lease is missing, expired, or already restored', {
        requested: leaseId,
        active: activeVfxLease?.record.id ?? null,
      });
    }
    return activeVfxLease;
  }

  function restoreActiveVfxLease(reason: string): RuntimeInspectorVfxRestoreResult | null {
    const lease = activeVfxLease;
    if (!lease) return null;
    activeVfxLease = null;
    if (lease.timeoutId !== null) window.clearTimeout(lease.timeoutId);
    const differences: string[] = [];
    let restoredPatchCount = 0;
    for (const patch of [...lease.patches].reverse()) {
      try {
        const restored = patch.provider.restoreUsageState?.(patch.usageId, patch.restoreState) === true;
        if (!restored) {
          differences.push(`vfx.patch:${patch.id}:provider-restore-failed`);
          continue;
        }
        const current = patch.provider.listUsages().find(item => item.id === patch.usageId);
        const currentParams = safeSerialize(current?.params ?? null, { maxDepth: 5, maxKeys: 96, maxArray: 96 });
        if (JSON.stringify(currentParams) === JSON.stringify(patch.beforeParams)) restoredPatchCount += 1;
        else differences.push(`vfx.patch:${patch.id}:params`);
      } catch (error) {
        differences.push(`vfx.patch:${patch.id}:${formatError(error)}`);
      }
    }
    lease.patches.length = 0;
    lastVfxRestore = {
      leaseId: lease.record.id,
      reason,
      restored: differences.length === 0,
      restoredPatchCount,
      differences,
    };
    return lastVfxRestore;
  }

  function readVfxLeaseRecord(lease: VfxLeaseEntry): RuntimeInspectorVfxLeaseRecord {
    return {
      ...lease.record,
      active: activeVfxLease?.record.id === lease.record.id,
      patchCount: lease.patches.length,
      touchedUsages: lease.record.touchedUsages.map(item => ({ ...item })),
    };
  }

  function captureRuntimeSnapshot(
    rawSpec: RuntimeInspectorSnapshotCaptureSpec,
  ): CommandResult<RuntimeInspectorSnapshotRecord> {
    const spec = validateSnapshotCaptureSpec(rawSpec);
    const scene = requireScene();
    const identity = readIdentity();
    const channels = spec.channels ?? ['nodes', 'animations', 'providers'];
    const selection = selectSnapshotNodes(spec, scene);
    const selectedNodes = selection.nodes.slice(0, spec.maxObjects ?? 200);
    const selectedHandles = selectedNodes.map(node => makeHandle(node, identity)).sort(compareHandles);
    const coverageObserved: string[] = ['snapshot.identity', 'snapshot.selection'];
    const coverageUnavailable: Array<{ channel: string; reason: string }> = [];
    const warnings: string[] = [];
    const limitations = [
      'Snapshot 0.1 records bounded JSON-safe observations; it is not a world-state checkpoint and cannot rewind gameplay.',
      'Particle/VFX internals, shader/texture bindings, physics state, readiness and thin-instance matrices require later providers and are explicitly unavailable.',
    ];

    let nodes: RuntimeInspectorSnapshotNodeRecord[] = [];
    if (channels.includes('nodes')) {
      nodes = selectedNodes.map(node => readSnapshotNode(node, identity));
      coverageObserved.push(
        'snapshot.nodes.identity',
        'snapshot.nodes.lifecycle',
        'snapshot.nodes.transform',
        'snapshot.nodes.boundingBox',
        'snapshot.nodes.resources',
        'snapshot.nodes.rendering',
        'snapshot.nodes.geometry',
        'snapshot.nodes.instances',
        'snapshot.nodes.health',
      );
      coverageUnavailable.push(
        {
          channel: 'snapshot.nodes.readiness',
          reason: 'Snapshot 0.1 does not call material/mesh isReady in the default render pass because that can contaminate draw-wrapper state.',
        },
        {
          channel: 'snapshot.nodes.thinInstanceMatrices',
          reason: 'Snapshot 0.1 reports thinInstanceCount only; per-instance matrices are deferred and must be bounded separately.',
        },
      );
    }

    let animations: RuntimeInspectorSnapshotAnimationRecord[] = [];
    if (channels.includes('animations')) {
      animations = readSnapshotAnimations(scene, new Set(selectedNodes), identity);
      coverageObserved.push('snapshot.animations.groups', 'snapshot.animations.targets');
    }

    let providerRecords: RuntimeInspectorSnapshotProviderRecord[] = [];
    if (channels.includes('providers')) {
      providerRecords = readSnapshotProviderRecords(scene, selectedNodes, selectedHandles, spec);
      coverageObserved.push('snapshot.providers');
      for (const provider of providerRecords) {
        coverageObserved.push(...provider.coverage.observed);
        coverageUnavailable.push(...provider.coverage.unavailable);
        warnings.push(...provider.warnings.map(warning => `${provider.providerId}: ${warning}`));
      }
    }

    coverageUnavailable.push(
      { channel: 'snapshot.particles', reason: 'No particle-system snapshot provider is registered in Snapshot 0.1.' },
      { channel: 'snapshot.vfx', reason: 'No project VFX lifecycle snapshot provider is registered in Snapshot 0.1.' },
      { channel: 'snapshot.shader', reason: 'Shader sources/defines/effect/pass state are deferred to the render introspection slice.' },
      { channel: 'snapshot.textures', reason: 'Texture/sampler bindings are deferred to the render introspection slice.' },
      { channel: 'snapshot.physics', reason: 'Physics bodies, collision and trigger state require a project/engine provider.' },
    );
    if (selection.totalObjectCount > selectedNodes.length) {
      warnings.push(`TRUNCATED: ${selection.totalObjectCount} selected nodes limited to ${selectedNodes.length}.`);
    }

    const record: RuntimeInspectorSnapshotRecord = {
      id: createId('snapshot'),
      label: spec.label ?? null,
      capturedAt: new Date().toISOString(),
      runtimeSessionId,
      scene: { ...identity.scene },
      frame: readFrame(),
      selector: selection.selector,
      channels: [...channels],
      totalObjectCount: selection.totalObjectCount,
      objectCount: selectedNodes.length,
      truncated: selection.totalObjectCount > selectedNodes.length,
      nodes,
      animations,
      providers: providerRecords,
      coverage: {
        observed: uniqueSorted(coverageObserved),
        unavailable: dedupeUnavailableCoverage(coverageUnavailable),
      },
      warnings: uniqueSorted(warnings),
      limitations,
    };
    snapshots.set(record.id, cloneJsonValue(record));
    while (snapshots.size > 16) snapshots.delete(snapshots.keys().next().value!);
    return {
      data: cloneJsonValue(record),
      observed: record.coverage.observed,
      unavailable: record.coverage.unavailable,
      warnings: record.warnings,
    };
  }

  function listRuntimeSnapshots(): CommandResult<RuntimeInspectorSnapshotSummary[]> {
    requireScene();
    return {
      data: [...snapshots.values()].map(snapshot => readSnapshotSummary(snapshot)),
      observed: ['snapshot.store'],
    };
  }

  function getRuntimeSnapshot(id: string): CommandResult<RuntimeInspectorSnapshotRecord> {
    validateSnapshotId(id, 'snapshot id');
    requireScene();
    const snapshot = snapshots.get(id);
    if (!snapshot) throw new RuntimeInspectorCommandError('NOT_FOUND', `snapshot "${id}" was not found`);
    return {
      data: cloneJsonValue(snapshot),
      observed: ['snapshot.store', ...snapshot.coverage.observed],
      unavailable: snapshot.coverage.unavailable,
      warnings: snapshot.warnings,
    };
  }

  function releaseRuntimeSnapshot(id: string): CommandResult<RuntimeInspectorSnapshotReleaseResult> {
    validateSnapshotId(id, 'snapshot id');
    requireScene();
    const released = snapshots.delete(id);
    return {
      data: { id, released, remaining: snapshots.size },
      observed: ['snapshot.store'],
    };
  }

  function diffRuntimeSnapshots(
    fromId: string,
    toId: string,
    rawOptions: RuntimeInspectorSnapshotDiffOptions,
  ): CommandResult<RuntimeInspectorSnapshotDiffResult> {
    validateSnapshotId(fromId, 'from snapshot id');
    validateSnapshotId(toId, 'to snapshot id');
    const options = validateSnapshotDiffOptions(rawOptions);
    requireScene();
    const from = snapshots.get(fromId);
    const to = snapshots.get(toId);
    if (!from || !to) {
      throw new RuntimeInspectorCommandError('NOT_FOUND', 'snapshot diff requires two stored snapshot ids', {
        fromId,
        toId,
        have: [...snapshots.keys()],
      });
    }
    if (from.runtimeSessionId !== to.runtimeSessionId) {
      throw new RuntimeInspectorCommandError('RUNTIME_MISMATCH', 'snapshots belong to different runtime sessions');
    }
    if (from.scene.id !== to.scene.id || from.scene.generation !== to.scene.generation) {
      throw new RuntimeInspectorCommandError('SCENE_MISMATCH', 'snapshots belong to different scene generations', {
        from: from.scene,
        to: to.scene,
      });
    }
    if (JSON.stringify(from.channels) !== JSON.stringify(to.channels)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot diff requires identical channel selections', {
        from: from.channels,
        to: to.channels,
      });
    }

    const maxDifferences = options.maxDifferences ?? 500;
    const added: RuntimeInspectorSnapshotEntityRef[] = [];
    const removed: RuntimeInspectorSnapshotEntityRef[] = [];
    const changed: RuntimeInspectorSnapshotEntityChange[] = [];
    let differenceCount = 0;
    let truncated = false;

    const compareGroup = <T>(
      entity: RuntimeInspectorSnapshotEntityRef['entity'],
      beforeRecords: T[],
      afterRecords: T[],
      keyOf: (record: T) => string,
      refOf: (record: T) => RuntimeInspectorSnapshotEntityRef,
    ) => {
      const beforeByKey = new Map(beforeRecords.map(record => [keyOf(record), record]));
      const afterByKey = new Map(afterRecords.map(record => [keyOf(record), record]));
      const keys = uniqueSorted([...beforeByKey.keys(), ...afterByKey.keys()]);
      for (const key of keys) {
        const before = beforeByKey.get(key);
        const after = afterByKey.get(key);
        if (before === undefined && after !== undefined) {
          added.push(refOf(after));
          continue;
        }
        if (before !== undefined && after === undefined) {
          removed.push(refOf(before));
          continue;
        }
        if (before === undefined || after === undefined || JSON.stringify(before) === JSON.stringify(after)) continue;
        const remaining = Math.max(0, maxDifferences - differenceCount);
        const collected = collectSnapshotDifferences(before, after, remaining + 1);
        const entityTruncated = collected.length > remaining;
        const differences = collected.slice(0, remaining);
        if (entityTruncated) truncated = true;
        differenceCount += differences.length;
        changed.push({ ...refOf(after), entity, differences, truncated: entityTruncated });
        if (differenceCount >= maxDifferences) truncated = true;
      }
    };

    compareGroup(
      'node',
      from.nodes,
      to.nodes,
      record => record.key,
      record => ({ entity: 'node', key: record.key, name: record.name, handle: record.handle }),
    );
    compareGroup(
      'animation',
      from.animations,
      to.animations,
      record => record.key,
      record => ({ entity: 'animation', key: record.key, name: record.name }),
    );
    compareGroup(
      'provider',
      from.providers,
      to.providers,
      record => record.providerId,
      record => ({ entity: 'provider', key: record.providerId, name: record.providerId }),
    );

    const result: RuntimeInspectorSnapshotDiffResult = {
      from: readSnapshotSummary(from),
      to: readSnapshotSummary(to),
      summary: {
        added: added.length,
        removed: removed.length,
        changed: changed.length,
        differenceCount,
      },
      added: added.sort(compareSnapshotEntityRefs),
      removed: removed.sort(compareSnapshotEntityRefs),
      changed: changed.sort(compareSnapshotEntityRefs),
      truncated,
      limitations: [
        'Diff compares only channels observed in both snapshots; unavailable channels remain unavailable rather than implying equality.',
        'Snapshot metadata such as capture time and frame id is intentionally excluded from semantic entity differences.',
      ],
    };
    return {
      data: cloneJsonValue(result),
      observed: ['snapshot.diff', ...from.coverage.observed, ...to.coverage.observed],
      unavailable: dedupeUnavailableCoverage([
        ...from.coverage.unavailable,
        ...to.coverage.unavailable,
      ]),
      warnings: truncated ? [`TRUNCATED: snapshot diff limited to ${maxDifferences} field differences.`] : [],
    };
  }

  function selectSnapshotNodes(
    spec: RuntimeInspectorSnapshotCaptureSpec,
    scene: Scene,
  ): SnapshotCaptureSelection {
    const allNodes = listBabylonRuntimeNodes(scene);
    let requested: BabylonRuntimeNode[];
    let selectorKind: RuntimeInspectorSnapshotRecord['selector']['kind'];
    let requestedCount: number;
    if (spec.handles !== undefined) {
      const rawHandles = Array.isArray(spec.handles) ? spec.handles : [spec.handles];
      requested = uniqueRuntimeNodes(rawHandles.map(handle => resolveHandle(handle)));
      selectorKind = 'handles';
      requestedCount = rawHandles.length;
    } else if (spec.query !== undefined) {
      const matches = matchQueryNodes(spec.query, allNodes).matches;
      const queryLimit = spec.query.limit ?? matches.length;
      requested = matches.slice(0, queryLimit);
      selectorKind = 'query';
      requestedCount = matches.length;
    } else {
      requested = allNodes;
      selectorKind = 'all';
      requestedCount = allNodes.length;
    }
    const expanded = spec.includeDescendants
      ? expandSnapshotDescendants(allNodes, requested)
      : requested;
    const nodes = uniqueRuntimeNodes(expanded).sort((left, right) => Number(left.uniqueId) - Number(right.uniqueId));
    return {
      nodes,
      totalObjectCount: nodes.length,
      selector: {
        kind: selectorKind,
        includeDescendants: spec.includeDescendants ?? false,
        requestedCount,
      },
    };
  }

  function readSnapshotNode(
    node: BabylonRuntimeNode,
    identity: RuntimeInspectorIdentity,
  ): RuntimeInspectorSnapshotNodeRecord {
    const handle = makeHandle(node, identity);
    const sourceMesh = readBabylonSourceMesh(node);
    const meshVisibility = readBabylonMeshVisibility(node);
    const localPosition = readFiniteVector3(node.position);
    const localRotation = readFiniteVector3(node.rotation);
    const localQuaternion = readFiniteQuaternion(node.rotationQuaternion);
    const localScaling = readFiniteVector3(node.scaling);
    let worldMatrix: number[] | null = null;
    try {
      node.computeWorldMatrix(true);
      worldMatrix = readFiniteNumberArray(node.getWorldMatrix().asArray());
    } catch {
      worldMatrix = null;
    }
    const absolutePosition = readFiniteVector3FromTuple(readBabylonAbsolutePosition(node));
    const absoluteScaling = readFiniteVector3FromTuple(readBabylonAbsoluteScaling(node));
    const boundingBox = sanitizeSnapshotBounds(readBabylonBoundingBox(node));
    const finiteTransform = Boolean(
      localPosition
      && localRotation
      && localScaling
      && worldMatrix
      && absolutePosition
      && absoluteScaling
      && (node.rotationQuaternion === null || node.rotationQuaternion === undefined || localQuaternion),
    );
    const zeroScale = localScaling ? localScaling.some(value => Math.abs(value) <= 1e-9) : false;
    const degenerateBounds = boundingBox
      ? boundingBox.maximumWorld.every((value, index) => Math.abs(value - boundingBox.minimumWorld[index]) <= 1e-9)
      : null;
    let rendering: RuntimeInspectorSnapshotNodeRecord['rendering'] = null;
    let geometry: RuntimeInspectorSnapshotNodeRecord['geometry'] = null;
    let thinInstanceCount = 0;
    if (isBabylonMeshNode(node)) {
      rendering = {
        layerMask: node.layerMask,
        renderingGroupId: node.renderingGroupId,
        alphaIndex: node.alphaIndex,
        receiveShadows: node.receiveShadows,
      };
      try {
        geometry = {
          totalVertices: Math.max(0, Math.trunc(node.getTotalVertices())),
          totalIndices: Math.max(0, Math.trunc(node.getTotalIndices())),
        };
      } catch {
        geometry = null;
      }
      const candidate = (node as AbstractMesh & { thinInstanceCount?: unknown }).thinInstanceCount;
      if (typeof candidate === 'number' && Number.isFinite(candidate)) thinInstanceCount = Math.max(0, Math.trunc(candidate));
    }
    return {
      key: snapshotNodeKey(handle),
      handle,
      className: getBabylonNodeClassName(node),
      name: String(node.name ?? ''),
      lifecycle: {
        enabled: isBabylonNodeEnabled(node),
        visible: readBabylonNodeVisible(node),
        visibility: meshVisibility?.visibility ?? null,
        disposed: isBabylonNodeDisposed(node),
      },
      transform: {
        position: localPosition,
        rotation: localRotation,
        rotationQuaternion: localQuaternion,
        scaling: localScaling,
        absolutePosition,
        absoluteScaling,
        worldMatrix,
      },
      boundingBox,
      relations: {
        parent: isRuntimeNode(node.parent) ? makeHandle(node.parent, identity) : null,
        sourceMesh: sourceMesh ? makeHandle(sourceMesh, identity) : null,
      },
      resources: {
        material: readBabylonNodeMaterial(node),
        geometry: readBabylonNodeGeometry(node),
        skeleton: readBabylonNodeSkeleton(node),
      },
      rendering,
      geometry,
      instances: {
        isInstance: getBabylonNodeKind(node) === 'instancedMesh',
        thinInstanceCount,
      },
      health: { finiteTransform, zeroScale, degenerateBounds },
    };
  }

  function readSnapshotAnimations(
    scene: Scene,
    selectedNodes: Set<BabylonRuntimeNode>,
    identity: RuntimeInspectorIdentity,
  ): RuntimeInspectorSnapshotAnimationRecord[] {
    return scene.animationGroups.map(group => {
      const targets = group.targetedAnimations.map(targeted => targeted.target);
      const targetNodes = uniqueRuntimeNodes(targets.filter((target): target is BabylonRuntimeNode => (
        isRuntimeNode(target) && selectedNodes.has(target)
      )));
      return {
        key: `animation:${String(group.uniqueId)}`,
        name: String(group.name ?? ''),
        uniqueId: String(group.uniqueId),
        from: nullableNumber(group.from) ?? 0,
        to: nullableNumber(group.to) ?? 0,
        currentFrame: nullableNumber(group.getCurrentFrame()) ?? 0,
        isStarted: Boolean(group.isStarted),
        isPlaying: Boolean(group.isPlaying),
        speedRatio: nullableNumber(group.speedRatio) ?? 0,
        loopAnimation: group.loopAnimation,
        isAdditive: group.isAdditive,
        weight: nullableNumber(group.weight) ?? 0,
        targetCount: targets.length,
        targetHandles: targetNodes.map(node => makeHandle(node, identity)).sort(compareHandles),
        unresolvedTargetCount: targets.length - targetNodes.length,
      };
    }).filter(record => record.targetHandles.length > 0)
      .sort((left, right) => left.uniqueId.localeCompare(right.uniqueId));
  }

  function readSnapshotProviderRecords(
    scene: Scene,
    nodes: BabylonRuntimeNode[],
    selectedHandles: RuntimeInspectorObjectHandle[],
    spec: RuntimeInspectorSnapshotCaptureSpec,
  ): RuntimeInspectorSnapshotProviderRecord[] {
    const records: RuntimeInspectorSnapshotProviderRecord[] = [];
    const providerIds = new Set<string>();
    for (const provider of readRuntimeInspectorSnapshotProviders()) {
      const providerId = readBoundedProviderString(provider.id, 'snapshot provider id');
      if (providerIds.has(providerId)) {
        throw new RuntimeInspectorCommandError('AMBIGUOUS', `snapshot provider id "${providerId}" is duplicated`);
      }
      providerIds.add(providerId);
      try {
        const capture = provider.capture({ scene, nodes, handles: selectedHandles, spec });
        if (!capture || typeof capture !== 'object' || Array.isArray(capture)) {
          throw new Error('provider capture must return an object');
        }
        records.push({
          providerId,
          data: safeSerialize(capture.data, { maxDepth: 8, maxKeys: 256, maxArray: 256 }),
          coverage: {
            observed: uniqueSorted(capture.observed ?? []),
            unavailable: dedupeUnavailableCoverage(capture.unavailable ?? []),
          },
          warnings: uniqueSorted(capture.warnings ?? []),
        });
      } catch (error) {
        records.push({
          providerId,
          data: null,
          coverage: {
            observed: [],
            unavailable: [{
              channel: `snapshot.provider.${providerId}`,
              reason: `provider failed: ${formatError(error)}`,
            }],
          },
          warnings: [`provider failed: ${formatError(error)}`],
        });
      }
    }
    return records.sort((left, right) => left.providerId.localeCompare(right.providerId));
  }

  async function capturePixels(
    rawSpec: RuntimeInspectorPixelCaptureSpec,
  ): Promise<CommandResult<RuntimeInspectorPixelCaptureRecord>> {
    const spec = validatePixelCaptureSpec(rawSpec);
    const scene = requireScene();
    const identity = readIdentity();
    const engine = scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    validatePixelCanvasSize(width, height);
    const resolvedRoi = resolvePixelRoi(spec, scene, identity, width, height);
    const bytes = await readDefaultFramebufferAfterRender(scene, width, height, spec.timeoutMs ?? 2_000);
    if (readScene() !== scene) {
      throw new RuntimeInspectorCommandError('SCENE_MISMATCH', 'scene changed while pixel capture was waiting for a rendered frame');
    }
    const backgroundRgba: [number, number, number, number] = [
      clampByte(scene.clearColor.r * 255),
      clampByte(scene.clearColor.g * 255),
      clampByte(scene.clearColor.b * 255),
      clampByte(scene.clearColor.a * 255),
    ];
    const statistics = readPixelCaptureStatistics(
      bytes,
      width,
      height,
      resolvedRoi.roi,
      backgroundRgba,
      spec.backgroundTolerance ?? 6,
    );
    const record: RuntimeInspectorPixelCaptureRecord = {
      id: createId('pixel-capture'),
      label: spec.label ?? null,
      capturedAt: new Date().toISOString(),
      runtimeSessionId,
      scene: { ...identity.scene },
      frame: readFrame(),
      canvas: { width, height, pixelCount: width * height },
      roi: resolvedRoi.roi,
      targets: resolvedRoi.targets,
      readbackY: 'bottom-left-inverted',
      statistics: {
        ...statistics,
        backgroundRgba,
        backgroundTolerance: spec.backgroundTolerance ?? 6,
      },
      limitations: [
        'Pixel Capture 0.1 reads the Babylon drawing buffer only; DOM overlays, browser compositing and display color management are outside this observation.',
        'Pixel bytes are local to the current GPU/browser surface; cross-machine byte identity requires a separately calibrated tolerance profile.',
      ],
    };
    pixelCaptures.set(record.id, { record: cloneJsonValue(record), bytes: bytes.slice() });
    while (pixelCaptures.size > 4) pixelCaptures.delete(pixelCaptures.keys().next().value!);
    return {
      data: cloneJsonValue(record),
      observed: ['pixels.drawingBuffer', 'pixels.roi', 'pixels.statistics', 'pixels.store'],
      unavailable: [
        { channel: 'pixels.domComposite', reason: 'WebGL readPixels does not include HTML/CSS overlays or browser compositor output.' },
        { channel: 'pixels.objectId', reason: 'Pixel Diff 0.1 uses projected ROI, not an object-id render pass.' },
      ],
    };
  }

  async function selfCheckPixels(
    rawSpec: RuntimeInspectorPixelCaptureSpec,
  ): Promise<CommandResult<RuntimeInspectorPixelSelfCheckResult>> {
    const spec = validatePixelCaptureSpec(rawSpec);
    const scene = requireScene();
    const identity = readIdentity();
    const engine = scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    validatePixelCanvasSize(width, height);
    const resolvedRoi = resolvePixelRoi(spec, scene, identity, width, height);
    const [first, second] = await readDefaultFramebufferTwiceAfterRender(
      scene,
      width,
      height,
      spec.timeoutMs ?? 2_000,
    );
    const metrics = measurePixelDifference(first, second, width, height, resolvedRoi.roi, 0, true);
    const data: RuntimeInspectorPixelSelfCheckResult = {
      canvas: { width, height, pixelCount: width * height },
      roi: resolvedRoi.roi,
      readbackY: 'bottom-left-inverted',
      ssd: metrics.ssd,
      maxChannelDiff: metrics.maxChannelDiff,
      diffPixelCount: metrics.diffPixelCount,
      stable: metrics.ssd === 0 && metrics.maxChannelDiff === 0 && metrics.diffPixelCount === 0,
    };
    return {
      data,
      observed: ['pixels.drawingBuffer', 'pixels.roi', 'pixels.noiseFloor'],
      unavailable: [
        { channel: 'pixels.temporalStability', reason: 'Self-check reads the same completed framebuffer twice; it does not prove two separately rendered frames are identical.' },
      ],
    };
  }

  function listPixelCaptures(): CommandResult<RuntimeInspectorPixelCaptureSummary[]> {
    requireScene();
    return {
      data: [...pixelCaptures.values()].map(entry => readPixelCaptureSummary(entry.record)),
      observed: ['pixels.store'],
    };
  }

  function getPixelCapture(id: string): CommandResult<RuntimeInspectorPixelCaptureRecord> {
    validatePixelCaptureId(id);
    requireScene();
    const entry = pixelCaptures.get(id);
    if (!entry) throw new RuntimeInspectorCommandError('NOT_FOUND', `pixel capture "${id}" was not found`);
    return {
      data: cloneJsonValue(entry.record),
      observed: ['pixels.store', 'pixels.statistics'],
      unavailable: [
        { channel: 'pixels.rawBytes', reason: 'Raw RGBA bytes remain page-local and are not returned through the JSON API.' },
      ],
    };
  }

  function releasePixelCapture(id: string): CommandResult<RuntimeInspectorPixelReleaseResult> {
    validatePixelCaptureId(id);
    requireScene();
    const released = pixelCaptures.delete(id);
    return {
      data: { id, released, remaining: pixelCaptures.size },
      observed: ['pixels.store'],
    };
  }

  function diffPixelCaptures(
    fromId: string,
    toId: string,
    rawOptions: RuntimeInspectorPixelDiffOptions,
  ): CommandResult<RuntimeInspectorPixelDiffResult> {
    validatePixelCaptureId(fromId);
    validatePixelCaptureId(toId);
    const options = validatePixelDiffOptions(rawOptions);
    requireScene();
    const from = pixelCaptures.get(fromId);
    const to = pixelCaptures.get(toId);
    if (!from || !to) {
      throw new RuntimeInspectorCommandError('NOT_FOUND', 'pixel diff requires two stored capture ids', {
        fromId,
        toId,
        have: [...pixelCaptures.keys()],
      });
    }
    if (from.record.runtimeSessionId !== to.record.runtimeSessionId) {
      throw new RuntimeInspectorCommandError('RUNTIME_MISMATCH', 'pixel captures belong to different runtime sessions');
    }
    if (from.record.scene.id !== to.record.scene.id || from.record.scene.generation !== to.record.scene.generation) {
      throw new RuntimeInspectorCommandError('SCENE_MISMATCH', 'pixel captures belong to different scene generations');
    }
    if (from.record.canvas.width !== to.record.canvas.width || from.record.canvas.height !== to.record.canvas.height) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'pixel captures use different drawing-buffer dimensions', {
        from: from.record.canvas,
        to: to.record.canvas,
      });
    }
    const width = from.record.canvas.width;
    const height = from.record.canvas.height;
    const roiMode = options.roiMode ?? 'union';
    const comparisonRoi = resolvePixelComparisonRoi(from.record.roi, to.record.roi, roiMode, width, height);
    const threshold = options.channelThreshold ?? 0;
    const fullRect: RuntimeInspectorPixelRect = { x: 0, y: 0, width, height };
    const inside = measurePixelDifference(from.bytes, to.bytes, width, height, comparisonRoi, threshold, true);
    const outside = measurePixelDifference(from.bytes, to.bytes, width, height, comparisonRoi, threshold, false);
    const full = measurePixelDifference(from.bytes, to.bytes, width, height, fullRect, threshold, true);
    const heatmap = buildPixelHeatmap(
      from.bytes,
      to.bytes,
      width,
      height,
      comparisonRoi,
      threshold,
      options.heatmapColumns ?? 16,
      options.heatmapRows ?? 9,
    );
    const data: RuntimeInspectorPixelDiffResult = {
      from: readPixelCaptureSummary(from.record),
      to: readPixelCaptureSummary(to.record),
      channelThreshold: threshold,
      roiMode,
      comparisonRoi,
      inside,
      outside,
      full,
      heatmap,
      limitations: [
        'Diff compares the current drawing-buffer bytes. A non-zero outside metric is collateral evidence, not automatic proof of a bug.',
        'Projected handle ROI is a screen-space AABB with padding; it does not provide per-object segmentation where geometry overlaps.',
      ],
    };
    return {
      data,
      observed: ['pixels.diff', 'pixels.diff.inside', 'pixels.diff.outside', 'pixels.diff.heatmap'],
      unavailable: [
        { channel: 'pixels.objectAttribution', reason: 'Changed pixels are partitioned by ROI only; object-id attribution is unavailable.' },
      ],
    };
  }

  function startRuntimeTrace(
    rawSpec: RuntimeInspectorTraceStartSpec,
  ): CommandResult<RuntimeInspectorTraceSummary> {
    const spec = validateTraceStartSpec(rawSpec);
    const scene = requireScene();
    const identity = readIdentity();
    ensureTraceStoreCapacity();

    const selection = selectSnapshotNodes({
      ...(spec.handles !== undefined ? { handles: spec.handles } : {}),
      ...(spec.query !== undefined ? { query: spec.query } : {}),
      includeDescendants: spec.includeDescendants,
      maxObjects: spec.maxObjects,
    }, scene);
    const maxObjects = spec.maxObjects ?? 8;
    const nodes = selection.nodes.slice(0, maxObjects);
    if (nodes.length === 0) {
      throw new RuntimeInspectorCommandError('NOT_FOUND', 'trace selector did not resolve any runtime nodes');
    }
    if (spec.trigger.kind !== 'manual' && spec.trigger.handle) {
      const triggerNode = resolveHandle(spec.trigger.handle);
      if (!nodes.includes(triggerNode)) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace trigger handle must be part of the selected node set');
      }
    }

    const warnings = selection.totalObjectCount > nodes.length
      ? [`TRUNCATED: ${selection.totalObjectCount} selected nodes limited to ${nodes.length}.`]
      : [];
    const summary: RuntimeInspectorTraceSummary = {
      id: createId('trace'),
      label: spec.label ?? null,
      startedAt: new Date().toISOString(),
      runtimeSessionId,
      scene: { ...identity.scene },
      status: 'armed',
      selector: {
        ...selection.selector,
        requestedCount: selection.totalObjectCount,
      },
      fields: [...spec.fields],
      triggerSpec: cloneJsonValue(spec.trigger),
      trigger: null,
      preSamples: spec.preSamples ?? 30,
      postSamples: spec.postSamples ?? 10,
      sampleEveryFrames: spec.sampleEveryFrames ?? 1,
      totalSampleCount: 0,
      retainedSampleCount: 0,
      droppedPreSampleCount: 0,
      stopReason: null,
      coverage: {
        observed: [
          'trace.afterRender',
          'trace.nodeFields',
          'trace.prePostRing',
          'trace.trigger',
        ],
        unavailable: [
          { channel: 'trace.beforeUpdate', reason: 'Trace 0.1 samples only after completed Scene renders.' },
          { channel: 'trace.afterUpdate', reason: 'Trace 0.1 samples only after completed Scene renders.' },
          { channel: 'trace.beforeRender', reason: 'Trace 0.1 samples only after completed Scene renders.' },
          { channel: 'trace.callStack', reason: 'Trace 0.1 records state transitions, not mutation call stacks.' },
          { channel: 'trace.gameplayPause', reason: 'Trace 0.1 does not pause gameplay when a trigger fires.' },
          { channel: 'trace.renderMembership', reason: 'Active-list/pass membership requires the later Render Explain provider.' },
          { channel: 'trace.vfx', reason: 'VFX lifecycle requires a project provider.' },
          { channel: 'trace.physics', reason: 'Physics state requires a project/engine provider.' },
        ],
      },
      warnings,
      limitations: [
        'Trace 0.1 binds to the selected runtime instances and never rebinds a disposed object by name.',
        'Only explicitly selected node fields are sampled; an absent transition in another channel is unobserved, not proof of no change.',
        'Sampling stride is expressed in completed Scene renders and is not a performance measurement.',
      ],
    };
    const entry: TraceEntry = {
      summary,
      scene,
      nodes,
      observer: null,
      samples: [],
      previousSample: null,
      nextSequence: 1,
      sampledRenderCount: 0,
      remainingPostSamples: summary.postSamples,
    };
    entry.observer = scene.onAfterRenderObservable.add(() => sampleRuntimeTrace(entry));
    traces.set(summary.id, entry);
    return traceCommandResult(readTraceSummary(entry));
  }

  function listRuntimeTraces(): CommandResult<RuntimeInspectorTraceSummary[]> {
    syncScene(readScene());
    return {
      data: [...traces.values()].map(entry => readTraceSummary(entry)),
      observed: ['trace.store', 'trace.lifecycle'],
    };
  }

  function getRuntimeTrace(
    id: string,
    rawOptions: RuntimeInspectorTraceReadOptions,
  ): CommandResult<RuntimeInspectorTraceReadResult> {
    validateTraceId(id);
    const options = validateTraceReadOptions(rawOptions);
    syncScene(readScene());
    const entry = traces.get(id);
    if (!entry) throw new RuntimeInspectorCommandError('NOT_FOUND', `trace "${id}" was not found`);
    const fromSequence = options.fromSequence ?? entry.samples[0]?.sequence ?? 1;
    const limit = options.limit ?? 50;
    const eligible = entry.samples.filter(sample => sample.sequence >= fromSequence);
    const samples = eligible.slice(0, limit).map(sample => cloneJsonValue(sample));
    const truncated = eligible.length > samples.length;
    const data: RuntimeInspectorTraceReadResult = {
      summary: readTraceSummary(entry),
      samples,
      returnedSampleCount: samples.length,
      truncated,
      nextSequence: truncated && samples.length > 0 ? samples[samples.length - 1].sequence + 1 : null,
    };
    return {
      data,
      observed: ['trace.store', ...entry.summary.coverage.observed],
      unavailable: entry.summary.coverage.unavailable,
      warnings: entry.summary.warnings,
    };
  }

  function triggerRuntimeTrace(id: string): CommandResult<RuntimeInspectorTraceSummary> {
    validateTraceId(id);
    syncScene(readScene());
    const entry = requireTraceEntry(id);
    if (entry.summary.triggerSpec.kind !== 'manual') {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace.trigger() is only valid for a manual trigger spec');
    }
    if (entry.summary.status !== 'armed') {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `trace "${id}" is ${entry.summary.status}, not armed`);
    }
    const sample = entry.samples[entry.samples.length - 1];
    if (!sample) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'manual trace requires at least one completed after-render sample');
    }
    applyRuntimeTraceTrigger(entry, sample, [], 'manual trigger requested');
    return traceCommandResult(readTraceSummary(entry));
  }

  function stopRuntimeTrace(id: string): CommandResult<RuntimeInspectorTraceSummary> {
    validateTraceId(id);
    syncScene(readScene());
    const entry = requireTraceEntry(id);
    if (isActiveTrace(entry)) stopTraceEntry(entry, 'explicit', 'stopped');
    return traceCommandResult(readTraceSummary(entry));
  }

  function releaseRuntimeTrace(id: string): CommandResult<RuntimeInspectorTraceReleaseResult> {
    validateTraceId(id);
    syncScene(readScene());
    const entry = traces.get(id);
    if (entry && isActiveTrace(entry)) stopTraceEntry(entry, 'release', 'stopped');
    const released = traces.delete(id);
    return {
      data: { id, released, remaining: traces.size },
      observed: ['trace.store', 'trace.lifecycle'],
    };
  }

  function sampleRuntimeTrace(entry: TraceEntry): void {
    if (!isActiveTrace(entry)) return;
    if (disposed || readScene() !== entry.scene) {
      stopTraceEntry(entry, disposed ? 'dispose' : 'scene-change', 'cancelled');
      return;
    }
    entry.sampledRenderCount += 1;
    if ((entry.sampledRenderCount - 1) % entry.summary.sampleEveryFrames !== 0) return;
    try {
      const identity = readIdentity();
      const nodes = entry.nodes.map(node => readTraceNodeSample(node, identity, entry.summary.fields));
      const frameId = entry.scene.getFrameId();
      if (!Number.isInteger(frameId)) return;
      const current: RuntimeInspectorTraceSample = {
        sequence: entry.nextSequence++,
        frame: { id: frameId, timeMs: performance.now(), phase: 'after-render' },
        nodes,
        changes: entry.previousSample
          ? compareTraceSamples(entry.previousSample, nodes, entry.summary.fields)
          : [],
      };
      entry.summary.totalSampleCount += 1;

      if (entry.summary.status === 'armed') {
        const trigger = matchRuntimeTraceTrigger(entry, current);
        entry.samples.push(current);
        if (trigger) {
          applyRuntimeTraceTrigger(entry, current, trigger.changes, trigger.reason);
        } else {
          const retainedWhileArmed = Math.max(1, entry.summary.preSamples);
          while (entry.samples.length > retainedWhileArmed) {
            entry.samples.shift();
            entry.summary.droppedPreSampleCount += 1;
          }
        }
      } else {
        entry.samples.push(current);
        entry.remainingPostSamples -= 1;
        if (entry.remainingPostSamples <= 0) stopTraceEntry(entry, 'post-samples-complete', 'completed');
      }
      entry.previousSample = current;
      entry.summary.retainedSampleCount = entry.samples.length;
    } catch (error) {
      entry.summary.warnings = uniqueSorted([
        ...entry.summary.warnings,
        `Trace sampling stopped after an internal read failure: ${formatError(error)}`,
      ]);
      stopTraceEntry(entry, 'sample-error', 'cancelled');
    }
  }

  function matchRuntimeTraceTrigger(
    entry: TraceEntry,
    sample: RuntimeInspectorTraceSample,
  ): { changes: RuntimeInspectorTraceFieldChange[]; reason: string } | null {
    const trigger = entry.summary.triggerSpec;
    if (trigger.kind === 'manual') return null;
    const matchingNodes = sample.nodes.filter(node => !trigger.handle || sameTraceHandle(node.handle, trigger.handle!));
    if (trigger.kind === 'change') {
      const changes = sample.changes.filter(change => (
        change.field === trigger.field
        && (!trigger.handle || sameTraceHandle(change.handle, trigger.handle))
        && !traceValuesEqual(change.before, change.after, trigger.epsilon ?? 0)
      ));
      return changes.length > 0
        ? { changes, reason: `${trigger.field} changed on ${changes.length} selected node(s)` }
        : null;
    }
    const previousByHandle = new Map(
      (entry.previousSample?.nodes ?? []).map(node => [traceHandleKey(node.handle), node]),
    );
    const changes: RuntimeInspectorTraceFieldChange[] = [];
    for (const node of matchingNodes) {
      const after = node.values[trigger.field];
      if (!traceValuesEqual(after, trigger.value, trigger.epsilon ?? 0)) continue;
      changes.push({
        handle: node.handle,
        field: trigger.field,
        before: cloneJsonValue(previousByHandle.get(traceHandleKey(node.handle))?.values[trigger.field] ?? null),
        after: cloneJsonValue(after),
      });
    }
    return changes.length > 0
      ? { changes, reason: `${trigger.field} equalled the requested value on ${changes.length} selected node(s)` }
      : null;
  }

  function applyRuntimeTraceTrigger(
    entry: TraceEntry,
    sample: RuntimeInspectorTraceSample,
    changes: RuntimeInspectorTraceFieldChange[],
    reason: string,
  ): void {
    const trigger: RuntimeInspectorTraceTriggerRecord = {
      kind: entry.summary.triggerSpec.kind,
      reason,
      sequence: sample.sequence,
      frame: cloneJsonValue(sample.frame),
      changes: cloneJsonValue(changes),
    };
    entry.summary.trigger = trigger;
    entry.remainingPostSamples = entry.summary.postSamples;
    if (entry.remainingPostSamples === 0) {
      stopTraceEntry(entry, 'post-samples-complete', 'completed');
    } else {
      entry.summary.status = 'triggered';
    }
    entry.summary.retainedSampleCount = entry.samples.length;
  }

  function stopActiveTraces(reason: string, status: 'stopped' | 'cancelled'): void {
    for (const entry of traces.values()) {
      if (isActiveTrace(entry)) stopTraceEntry(entry, reason, status);
    }
  }

  function stopTraceEntry(
    entry: TraceEntry,
    reason: string,
    status: 'completed' | 'stopped' | 'cancelled',
  ): void {
    if (entry.observer) {
      entry.scene.onAfterRenderObservable.remove(entry.observer);
      entry.observer = null;
    }
    entry.summary.status = status;
    entry.summary.stopReason = reason;
    entry.summary.retainedSampleCount = entry.samples.length;
  }

  function readTraceSummary(entry: TraceEntry): RuntimeInspectorTraceSummary {
    return cloneJsonValue({
      ...entry.summary,
      retainedSampleCount: entry.samples.length,
    });
  }

  function traceCommandResult(summary: RuntimeInspectorTraceSummary): CommandResult<RuntimeInspectorTraceSummary> {
    return {
      data: summary,
      observed: ['trace.store', 'trace.lifecycle', ...summary.coverage.observed],
      unavailable: summary.coverage.unavailable,
      warnings: summary.warnings,
    };
  }

  function requireTraceEntry(id: string): TraceEntry {
    const entry = traces.get(id);
    if (!entry) throw new RuntimeInspectorCommandError('NOT_FOUND', `trace "${id}" was not found`);
    return entry;
  }

  function ensureTraceStoreCapacity(): void {
    if (traces.size < 4) return;
    const evictable = [...traces.entries()].find(([, entry]) => !isActiveTrace(entry));
    if (!evictable) {
      throw new RuntimeInspectorCommandError('LEASE_CONFLICT', 'all four trace slots are active; stop or release one before starting another');
    }
    traces.delete(evictable[0]);
  }

  function isActiveTrace(entry: TraceEntry): boolean {
    return entry.summary.status === 'armed' || entry.summary.status === 'triggered';
  }

  function readTraceNodeSample(
    node: BabylonRuntimeNode,
    identity: RuntimeInspectorIdentity,
    fields: RuntimeInspectorTraceField[],
  ): RuntimeInspectorTraceSample['nodes'][number] {
    const values: Partial<Record<RuntimeInspectorTraceField, unknown>> = {};
    for (const field of fields) values[field] = readRuntimeTraceField(node, identity, field);
    return {
      handle: makeHandle(node, identity),
      state: isBabylonNodeDisposed(node) ? 'disposed' : 'active',
      values,
    };
  }

  function readRuntimeTraceField(
    node: BabylonRuntimeNode,
    identity: RuntimeInspectorIdentity,
    field: RuntimeInspectorTraceField,
  ): unknown {
    switch (field) {
      case 'lifecycle.enabled': return isBabylonNodeEnabled(node);
      case 'lifecycle.visible': return readBabylonNodeVisible(node);
      case 'lifecycle.visibility': return readBabylonMeshVisibility(node)?.visibility ?? null;
      case 'lifecycle.disposed': return isBabylonNodeDisposed(node);
      case 'transform.position': return traceVector(node.position);
      case 'transform.rotation': return traceVector(node.rotation);
      case 'transform.rotationQuaternion': return traceQuaternion(node.rotationQuaternion);
      case 'transform.scaling': return traceVector(node.scaling);
      case 'transform.absolutePosition': {
        try {
          node.computeWorldMatrix(true);
          return traceVector(node.getAbsolutePosition());
        } catch {
          return null;
        }
      }
      case 'transform.absoluteScaling': {
        try {
          node.computeWorldMatrix(true);
          return traceVector(node.absoluteScaling);
        } catch {
          return null;
        }
      }
      case 'relations.parent': return isRuntimeNode(node.parent) ? makeHandle(node.parent, identity) : null;
      case 'boundingBox.minimumWorld': return traceVector(readBabylonBoundingBox(node)?.minimumWorld ?? null);
      case 'boundingBox.maximumWorld': return traceVector(readBabylonBoundingBox(node)?.maximumWorld ?? null);
      case 'health.finiteTransform': return traceNodeHasFiniteTransform(node);
    }
  }

  function compareTraceSamples(
    previous: RuntimeInspectorTraceSample,
    currentNodes: RuntimeInspectorTraceSample['nodes'],
    fields: RuntimeInspectorTraceField[],
  ): RuntimeInspectorTraceFieldChange[] {
    const previousByHandle = new Map(previous.nodes.map(node => [traceHandleKey(node.handle), node]));
    const changes: RuntimeInspectorTraceFieldChange[] = [];
    for (const current of currentNodes) {
      const before = previousByHandle.get(traceHandleKey(current.handle));
      if (!before) continue;
      for (const field of fields) {
        const beforeValue = before.values[field];
        const afterValue = current.values[field];
        if (traceValuesEqual(beforeValue, afterValue, 0)) continue;
        changes.push({
          handle: current.handle,
          field,
          before: cloneJsonValue(beforeValue),
          after: cloneJsonValue(afterValue),
        });
      }
    }
    return changes;
  }

  function traceVector(value: { x: number; y: number; z: number } | number[] | null | undefined): unknown {
    if (!value) return null;
    const values = Array.isArray(value) ? value.slice(0, 3) : [value.x, value.y, value.z];
    return values.map(traceNumber);
  }

  function traceQuaternion(value: { x: number; y: number; z: number; w: number } | null | undefined): unknown {
    return value ? [value.x, value.y, value.z, value.w].map(traceNumber) : null;
  }

  function traceNumber(value: number): number | string {
    if (Number.isNaN(value)) return 'NaN';
    if (value === Number.POSITIVE_INFINITY) return '+Infinity';
    if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
    return roundNumber(value);
  }

  function traceNodeHasFiniteTransform(node: BabylonRuntimeNode): boolean {
    const values = [
      node.position?.x, node.position?.y, node.position?.z,
      node.rotation?.x, node.rotation?.y, node.rotation?.z,
      node.scaling?.x, node.scaling?.y, node.scaling?.z,
      ...(node.rotationQuaternion
        ? [node.rotationQuaternion.x, node.rotationQuaternion.y, node.rotationQuaternion.z, node.rotationQuaternion.w]
        : []),
    ];
    return values.every(value => typeof value === 'number' && Number.isFinite(value));
  }

  function traceValuesEqual(left: unknown, right: unknown, epsilon: number): boolean {
    if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) <= epsilon;
    if (Array.isArray(left) && Array.isArray(right)) {
      return left.length === right.length && left.every((value, index) => traceValuesEqual(value, right[index], epsilon));
    }
    if (left && right && typeof left === 'object' && typeof right === 'object') {
      return JSON.stringify(left) === JSON.stringify(right);
    }
    return Object.is(left, right);
  }

  function traceHandleKey(handle: RuntimeInspectorObjectHandle): string {
    return `${handle.runtimeSessionId}:${handle.sceneGeneration}:${handle.engineId}:${handle.objectGeneration}`;
  }

  function sameTraceHandle(left: RuntimeInspectorObjectHandle, right: RuntimeInspectorObjectHandle): boolean {
    return traceHandleKey(left) === traceHandleKey(right);
  }

  function explainRenderPath(
    handle: RuntimeInspectorObjectHandle,
  ): CommandResult<RuntimeInspectorRenderExplainResult> {
    const scene = requireScene();
    const identity = readIdentity();
    const node = resolveHandle(handle);
    const resolvedHandle = makeHandle(node, identity);
    const renderable = isBabylonMeshNode(node);
    const disposedNode = isBabylonNodeDisposed(node);
    const enabled = isBabylonNodeEnabled(node);
    const visible = readBabylonNodeVisible(node);
    const visibility = readBabylonMeshVisibility(node)?.visibility ?? null;
    const camera = scene.activeCamera;
    let totalVertices = 0;
    let totalIndices = 0;
    let hasGeometry = false;
    let layerMaskMatch: boolean | null = null;
    let inFrustum: boolean | null = null;
    let alwaysSelectAsActiveMesh: boolean | null = null;
    let inActiveMeshes: boolean | null = null;
    let material: Material | null = null;
    let materialSource: RuntimeInspectorRenderMaterialRecord['source'] = 'none';
    let subMeshes: RuntimeInspectorRenderSubMeshRecord[] = [];
    let subMeshesTruncated = false;

    if (renderable) {
      try {
        totalVertices = Math.max(0, Math.trunc(node.getTotalVertices()));
        totalIndices = Math.max(0, Math.trunc(node.getTotalIndices()));
      } catch {
        totalVertices = 0;
        totalIndices = 0;
      }
      hasGeometry = Boolean(node.geometry) && totalVertices > 0;
      layerMaskMatch = camera ? (node.layerMask & camera.layerMask) !== 0 : null;
      alwaysSelectAsActiveMesh = Boolean(node.alwaysSelectAsActiveMesh);
      if (camera) {
        try {
          node.computeWorldMatrix(true);
          inFrustum = scene.frustumPlanes?.length > 0 ? node.isInFrustum(scene.frustumPlanes) : null;
        } catch {
          inFrustum = null;
        }
      }
      const activeMeshes = scene.getActiveMeshes();
      inActiveMeshes = false;
      for (let index = 0; index < activeMeshes.length; index += 1) {
        if (activeMeshes.data[index] === node) {
          inActiveMeshes = true;
          break;
        }
      }
      material = node.material ?? scene.defaultMaterial ?? null;
      materialSource = node.material ? 'mesh' : material ? 'scene-default' : 'none';
      const allSubMeshes = Array.isArray(node.subMeshes) ? node.subMeshes : [];
      subMeshesTruncated = allSubMeshes.length > 16;
      subMeshes = allSubMeshes.slice(0, 16).map((subMesh, index) => {
        let effect = null;
        try {
          const candidate = subMesh.effect;
          if (candidate) {
            const key = boundedRenderString(String(candidate.key ?? ''), 512);
            const defines = boundedRenderString(
              typeof candidate.defines === 'string' ? candidate.defines : String(candidate.defines ?? ''),
              8_192,
            );
            effect = {
              key: key.value,
              keyHash32: key.hash32,
              keyTruncated: key.truncated,
              defines: defines.value,
              definesHash32: defines.hash32,
              definesTruncated: defines.truncated,
              pipelineContextPresent: Boolean(candidate.getPipelineContext?.()),
            };
          }
        } catch {
          effect = null;
        }
        let materialDefines: unknown = null;
        try {
          materialDefines = safeSerialize(subMesh.materialDefines ?? null, { maxDepth: 4, maxKeys: 128, maxArray: 64 });
        } catch {
          materialDefines = null;
        }
        return {
          index,
          materialIndex: Math.max(0, Math.trunc(subMesh.materialIndex ?? 0)),
          verticesStart: Math.max(0, Math.trunc(subMesh.verticesStart ?? 0)),
          verticesCount: Math.max(0, Math.trunc(subMesh.verticesCount ?? 0)),
          indexStart: Math.max(0, Math.trunc(subMesh.indexStart ?? 0)),
          indexCount: Math.max(0, Math.trunc(subMesh.indexCount ?? 0)),
          effect,
          materialDefines,
        };
      });
    }

    const reasons: RuntimeInspectorRenderExplainResult['reasons'] = [];
    const exclude = (code: RuntimeInspectorRenderExplainResult['reasons'][number]['code'], detail: string) => {
      reasons.push({ code, outcome: 'exclude', detail });
    };
    if (!renderable) exclude('NOT_RENDERABLE_NODE', `${getBabylonNodeClassName(node)} is not an AbstractMesh draw candidate.`);
    if (disposedNode) exclude('DISPOSED', 'The selected runtime instance is disposed.');
    if (!enabled) exclude('DISABLED', 'isEnabled() is false, including inherited enabled state.');
    if (visible === false) exclude('HIDDEN', 'Mesh isVisible is false.');
    if (visibility !== null && visibility <= 0) exclude('ZERO_VISIBILITY', `Mesh visibility is ${visibility}.`);
    if (renderable && !hasGeometry) exclude('NO_GEOMETRY', `Mesh has ${totalVertices} vertices and no renderable geometry.`);
    if (renderable && !camera) exclude('NO_ACTIVE_CAMERA', 'Scene has no active camera.');
    if (renderable && layerMaskMatch === false) exclude('LAYER_MASK_MISMATCH', 'Mesh layerMask does not intersect active camera layerMask.');
    if (renderable && inFrustum === false && alwaysSelectAsActiveMesh !== true) {
      exclude('OUTSIDE_FRUSTUM', 'Mesh bounding volume is outside the most recently computed scene frustum.');
    }
    const excluded = reasons.some(reason => reason.outcome === 'exclude');
    if (renderable && !excluded && inActiveMeshes === true) {
      reasons.push({
        code: 'ACTIVE_MESH_CANDIDATE',
        outcome: 'include',
        detail: 'Mesh is in Scene.getActiveMeshes() for the most recently evaluated frame.',
      });
    } else if (renderable && !excluded && inActiveMeshes === false) {
      reasons.push({
        code: 'NOT_IN_ACTIVE_MESH_LIST',
        outcome: 'unknown',
        detail: 'Static gates pass, but the mesh is absent from the most recently evaluated active-mesh list.',
      });
    }

    const materialRecord = readRenderMaterialRecord(material, materialSource);
    const passResult = renderPassMembership(scene, renderable ? node : null, material);
    const classification: RuntimeInspectorRenderExplainResult['classification'] = !renderable
      ? 'not-renderable'
      : excluded
        ? 'excluded'
        : inActiveMeshes === true
          ? 'active-candidate'
          : 'inactive-candidate';
    const data: RuntimeInspectorRenderExplainResult = {
      handle: resolvedHandle,
      frameId: Number.isInteger(scene.getFrameId()) ? scene.getFrameId() : null,
      classification,
      gates: {
        renderable,
        disposed: disposedNode,
        enabled,
        visible,
        visibility,
        hasGeometry,
        totalVertices,
        totalIndices,
        activeCamera: camera ? {
          name: String(camera.name ?? ''),
          uniqueId: String(camera.uniqueId),
          layerMask: camera.layerMask,
        } : null,
        layerMaskMatch,
        inFrustum,
        alwaysSelectAsActiveMesh,
        inActiveMeshes,
      },
      reasons,
      material: materialRecord,
      subMeshes,
      subMeshesTruncated,
      passes: passResult.records,
      passesTruncated: passResult.truncated,
      limitations: [
        'Active-mesh membership is a CPU candidate fact from the most recently evaluated frame; it does not prove a fragment reached the final framebuffer.',
        'Render Explain 0.1 passively reads existing draw-wrapper/effect state and never calls material/mesh isReady or force compilation.',
        'Occlusion, shader discard/clip, alpha compositing, custom renderer callbacks and post-process appearance require independent visual evidence.',
      ],
    };
    const warnings = [
      ...(subMeshesTruncated ? [`TRUNCATED: ${renderable ? node.subMeshes.length : 0} submeshes limited to 16.`] : []),
      ...(passResult.truncated ? ['TRUNCATED: render-pass memberships limited to 32.'] : []),
    ];
    return {
      data,
      observed: [
        'render.lifecycleGates',
        'render.cameraGates',
        'render.activeMeshes',
        'render.material',
        'render.subMeshDrawWrapper',
        'render.passMembership',
      ],
      unavailable: [
        { channel: 'render.readiness', reason: 'Passive explain does not call material/mesh isReady or compile shaders.' },
        { channel: 'render.actualDraw', reason: 'Active-list membership does not prove the mesh submitted or completed a draw.' },
        { channel: 'render.finalPixels', reason: 'Use pixels/camera visual observations for framebuffer evidence.' },
        { channel: 'render.customCallbacks', reason: 'Custom render-list predicates/callbacks are reported but never executed by the inspector.' },
        { channel: 'render.shaderOutcome', reason: 'Fragment discard, clip planes, custom shader output and post-process appearance are not inferred.' },
        { channel: 'render.particlesSprites', reason: 'Render Explain 0.1 covers Babylon AbstractMesh nodes only.' },
      ],
      warnings,
    };
  }

  function readRenderMaterialRecord(
    material: Material | null,
    source: RuntimeInspectorRenderMaterialRecord['source'],
  ): RuntimeInspectorRenderMaterialRecord {
    if (!material) {
      return {
        source: 'none',
        name: null,
        uniqueId: null,
        className: null,
        alpha: null,
        transparencyMode: null,
        backFaceCulling: null,
        disableDepthWrite: null,
        needDepthPrePass: null,
        textures: [],
        texturesTruncated: false,
      };
    }
    let activeTextures: BaseTexture[] = [];
    try {
      activeTextures = material.getActiveTextures?.() ?? [];
    } catch {
      activeTextures = [];
    }
    const texturesTruncated = activeTextures.length > 32;
    const textures = activeTextures.slice(0, 32).map(texture => {
      const candidate = texture as BaseTexture & { coordinatesIndex?: unknown; level?: unknown };
      return {
        name: String(texture.name ?? ''),
        uniqueId: String(texture.uniqueId),
        className: texture.getClassName?.() ?? texture.constructor?.name ?? 'BaseTexture',
        coordinatesIndex: typeof candidate.coordinatesIndex === 'number' && Number.isFinite(candidate.coordinatesIndex)
          ? roundNumber(candidate.coordinatesIndex)
          : null,
        level: typeof candidate.level === 'number' && Number.isFinite(candidate.level)
          ? roundNumber(candidate.level)
          : null,
      };
    });
    return {
      source,
      name: String(material.name ?? ''),
      uniqueId: String(material.uniqueId),
      className: material.getClassName?.() ?? material.constructor?.name ?? 'Material',
      alpha: nullableNumber(material.alpha),
      transparencyMode: nullableNumber(material.transparencyMode),
      backFaceCulling: material.backFaceCulling,
      disableDepthWrite: material.disableDepthWrite,
      needDepthPrePass: material.needDepthPrePass,
      textures,
      texturesTruncated,
    };
  }

  function boundedRenderString(value: string, maxLength: number): {
    value: string;
    hash32: string;
    truncated: boolean;
  } {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return {
      value: value.length > maxLength ? value.slice(0, maxLength) : value,
      hash32: hash.toString(16).padStart(8, '0'),
      truncated: value.length > maxLength,
    };
  }

  function renderPassMembership(
    scene: Scene,
    mesh: AbstractMesh | null,
    material: Material | null,
  ): { records: RuntimeInspectorRenderPassMembership[]; truncated: boolean } {
    if (!mesh) return { records: [], truncated: false };
    const records: RuntimeInspectorRenderPassMembership[] = [];
    const pushTarget = (
      kind: RuntimeInspectorRenderPassMembership['kind'],
      target: RenderTargetTexture | null | undefined,
    ) => {
      if (!target) return;
      const candidate = target as RenderTargetTexture & {
        renderListPredicate?: unknown;
        getCustomRenderList?: unknown;
      };
      const renderList = target.renderList;
      const hasCustom = typeof candidate.renderListPredicate === 'function'
        || typeof candidate.getCustomRenderList === 'function';
      records.push({
        kind,
        name: String(target.name ?? ''),
        uniqueId: String(target.uniqueId),
        renderListMode: Array.isArray(renderList) ? 'explicit' : hasCustom ? 'predicate-or-custom' : 'scene-default',
        included: Array.isArray(renderList) ? renderList.includes(mesh) : null,
      });
    };
    for (const target of scene.customRenderTargets ?? []) pushTarget('custom-render-target', target);
    for (const target of scene.activeCamera?.customRenderTargets ?? []) pushTarget('camera-render-target', target);
    if (material?.getRenderTargetTextures) {
      try {
        const targets = material.getRenderTargetTextures();
        if (targets) {
          for (let index = 0; index < targets.length; index += 1) pushTarget('material-render-target', targets.data[index]);
        }
      } catch {
        // A custom material provider may reject passive target enumeration; coverage remains explicit.
      }
    }
    for (const light of scene.lights.slice(0, 32)) {
      const candidate = light as typeof light & {
        getShadowGenerators?: () => Map<unknown, { getShadowMap?: () => RenderTargetTexture | null }> | null;
      };
      let generators: Map<unknown, { getShadowMap?: () => RenderTargetTexture | null }> | null = null;
      try {
        generators = candidate.getShadowGenerators?.() ?? null;
      } catch {
        generators = null;
      }
      if (!generators) continue;
      for (const generator of generators.values()) {
        let shadowMap: RenderTargetTexture | null = null;
        try {
          shadowMap = generator.getShadowMap?.() ?? null;
        } catch {
          shadowMap = null;
        }
        pushTarget('shadow-map', shadowMap);
      }
    }
    const unique = new Map<string, RuntimeInspectorRenderPassMembership>();
    for (const record of records) unique.set(`${record.kind}:${record.uniqueId}`, record);
    const sorted = [...unique.values()].sort((left, right) => (
      left.kind.localeCompare(right.kind) || left.uniqueId.localeCompare(right.uniqueId)
    ));
    return { records: sorted.slice(0, 32), truncated: sorted.length > 32 };
  }

  function resolvePixelRoi(
    spec: RuntimeInspectorPixelCaptureSpec,
    scene: Scene,
    identity: RuntimeInspectorIdentity,
    width: number,
    height: number,
  ): { roi: RuntimeInspectorPixelRect; targets: RuntimeInspectorObjectHandle[] } {
    const roi = spec.roi ?? { kind: 'full' as const };
    if (roi.kind === 'full') {
      return { roi: { x: 0, y: 0, width, height }, targets: [] };
    }
    if (roi.kind === 'screen') {
      return {
        roi: clipPixelRect({ x: roi.x, y: roi.y, width: roi.width, height: roi.height }, width, height),
        targets: [],
      };
    }
    const rawHandles = Array.isArray(roi.handles) ? roi.handles : [roi.handles];
    const nodes = uniqueRuntimeNodes(rawHandles.map(handle => resolveHandle(handle)));
    const targets = nodes.map(node => makeHandle(node, identity)).sort(compareHandles);
    const bounds = readAggregateBounds(scene, nodes);
    const coverage = projectBoundsToScreen(requireCamera(), scene, bounds);
    const padding = roi.paddingPx ?? 8;
    return {
      roi: clipPixelRect({
        x: Math.floor(coverage.boundsPx.left - padding),
        y: Math.floor(coverage.boundsPx.top - padding),
        width: Math.ceil(coverage.boundsPx.right + padding) - Math.floor(coverage.boundsPx.left - padding),
        height: Math.ceil(coverage.boundsPx.bottom + padding) - Math.floor(coverage.boundsPx.top - padding),
      }, width, height),
      targets,
    };
  }

  function acquireCameraLease(
    acquireOptions: RuntimeInspectorCameraAcquireOptions,
  ): CommandResult<RuntimeInspectorCameraLeaseRecord> {
    validateCameraAcquireOptions(acquireOptions);
    if (activeCameraLease) {
      throw new RuntimeInspectorCommandError('LEASE_CONFLICT', 'camera already has an active fp3d lease', {
        activeLease: readCameraLeaseRecord(activeCameraLease),
      });
    }

    const camera = requireCamera();
    const scene = requireScene();
    const owner = acquireOptions.owner?.trim() || 'agent';
    const reason = acquireOptions.reason?.trim() || null;
    const timeoutMs = acquireOptions.timeoutMs ?? 60_000;
    const leaseId = createId('camera-lease');
    const cameraBefore = readCameraSnapshot(camera);
    const ownerProvider = readRuntimeInspectorCameraControlProvider();
    let ownerLease: RuntimeInspectorCameraOwnerLease | null = null;
    if (ownerProvider) {
      try {
        ownerLease = ownerProvider.acquire({ leaseId, owner, reason, timeoutMs });
      } catch (error) {
        throw new RuntimeInspectorCommandError(
          'LEASE_CONFLICT',
          `camera owner provider "${ownerProvider.id}" rejected the lease: ${formatError(error)}`,
        );
      }
    }

    const acquiredAtMs = Date.now();
    const record: RuntimeInspectorCameraLeaseRecord = {
      id: leaseId,
      owner,
      reason,
      acquiredAt: new Date(acquiredAtMs).toISOString(),
      expiresAt: new Date(acquiredAtMs + timeoutMs).toISOString(),
      active: true,
      cameraBefore,
      ownerProviderId: ownerProvider?.id ?? null,
      ownerBefore: ownerLease ? safeSerialize(ownerLease.stateBefore) : null,
      activePatchCount: 0,
    };
    const entry: CameraLeaseEntry = {
      record,
      camera,
      scene,
      ownerProvider,
      ownerLease,
      patches: [],
      timeoutId: null,
    };
    clearCameraControlLimits(camera);
    entry.timeoutId = window.setTimeout(() => {
      if (activeCameraLease?.record.id === leaseId) restoreActiveCameraLease('timeout');
    }, timeoutMs);
    activeCameraLease = entry;

    return {
      data: readCameraLeaseRecord(entry),
      observed: ['camera.lease', 'camera.pose', 'camera.projection'],
      unavailable: ownerProvider
        ? []
        : [{ channel: 'camera.owner', reason: 'no project camera control provider is registered' }],
    };
  }

  function focusCamera(
    leaseId: string,
    handlesOrHandle: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    focusOptions: RuntimeInspectorCameraFocusOptions,
  ): CommandResult<RuntimeInspectorCameraFocusResult> {
    const lease = requireCameraLease(leaseId);
    if (!focusOptions || typeof focusOptions !== 'object' || Array.isArray(focusOptions)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera focus options must be an object');
    }
    const margin = focusOptions.margin ?? 1.5;
    if (!Number.isFinite(margin) || margin < 1 || margin > 10) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera focus margin must be between 1 and 10', margin);
    }
    const requestedHandles = Array.isArray(handlesOrHandle) ? handlesOrHandle : [handlesOrHandle];
    if (requestedHandles.length < 1 || requestedHandles.length > 100) {
      throw new RuntimeInspectorCommandError('INVALID_HANDLE', 'camera focus requires 1 to 100 handles');
    }
    const targetNodes = requestedHandles.map(resolveHandle);
    const bounds = readAggregateBounds(lease.scene, targetNodes);
    const camera = lease.camera;
    const engine = lease.scene.getEngine();
    const aspect = Math.max(0.0001, engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()));
    const center = Vector3.FromArray(bounds.centerWorld);

    camera.target.copyFrom(center);
    if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
      const halfHeight = (bounds.radiusWorld * margin) / Math.min(1, aspect);
      const halfWidth = halfHeight * aspect;
      camera.orthoTop = halfHeight;
      camera.orthoBottom = -halfHeight;
      camera.orthoLeft = -halfWidth;
      camera.orthoRight = halfWidth;
    } else {
      const verticalHalfFov = Math.max(0.01, camera.fov / 2);
      const effectiveHalfFov = aspect >= 1
        ? verticalHalfFov
        : Math.atan(Math.tan(verticalHalfFov) * aspect);
      camera.radius = (bounds.radiusWorld * margin) / Math.max(0.01, Math.sin(effectiveHalfFov));
    }
    camera.getViewMatrix(true);
    camera.getProjectionMatrix(true);

    const identity = readIdentity();
    return {
      data: {
        leaseId,
        targets: targetNodes.map(node => makeHandle(node, identity)),
        aggregateBounds: bounds,
        projection: camera.mode === Camera.ORTHOGRAPHIC_CAMERA ? 'orthographic' : 'perspective',
        cameraAfter: readCameraSnapshot(camera),
        screenCoverage: projectBoundsToScreen(camera, lease.scene, bounds),
      },
      observed: [
        'camera.lease',
        'camera.pose',
        'camera.projection',
        'camera.screenCoverage',
        'node.boundingBox',
      ],
    };
  }

  function viewCamera(
    leaseId: string,
    handlesOrHandle: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    rawSpec: RuntimeInspectorCameraViewSpec,
  ): CommandResult<RuntimeInspectorCameraViewResult> {
    const lease = requireCameraLease(leaseId);
    const spec = validateCameraViewSpec(rawSpec);
    const requestedHandles = normalizeCameraHandles(handlesOrHandle);
    const targetNodes = requestedHandles.map(resolveHandle);
    const referenceNode = spec.kind === 'orbit' && spec.referenceHandle
      ? resolveHandle(spec.referenceHandle)
      : null;
    const bounds = readAggregateBounds(lease.scene, targetNodes);
    const camera = lease.camera;
    const cameraBefore = readCameraSnapshot(camera);
    const center = Vector3.FromArray(bounds.centerWorld);
    let normalizedSpec: RuntimeInspectorCameraViewSpec;
    let referenceFrame: RuntimeInspectorCameraViewResult['referenceFrame'] = {
      reference: 'world',
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      zAxis: [0, 0, 1],
      source: null,
    };

    if (spec.kind === 'pose') {
      const position = Vector3.FromArray(spec.position);
      const target = Vector3.FromArray(spec.target);
      const up = Vector3.FromArray(spec.up ?? cameraBefore.up).normalize();
      const viewDirection = target.subtract(position);
      if (viewDirection.lengthSquared() < 1e-10) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera pose position and target must be different');
      }
      if (Vector3.Cross(viewDirection.normalize(), up).lengthSquared() < 1e-10) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera pose up vector must not be parallel to the view direction');
      }
      camera.upVector.copyFrom(up);
      camera.setTarget(target);
      camera.setPosition(position);
      normalizedSpec = {
        kind: 'pose',
        position: vector3(position)!,
        target: vector3(target)!,
        up: vector3(up)!,
      };
    } else {
      const identity = readIdentity();
      referenceFrame = resolveCameraReferenceFrame(
        spec.reference,
        targetNodes,
        referenceNode,
        node => makeHandle(node, identity),
      );
      const margin = spec.margin ?? 1.5;
      const engine = lease.scene.getEngine();
      const aspect = Math.max(0.0001, engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()));
      const distance = spec.distance ?? readAutoCameraDistance(camera, bounds.radiusWorld, margin, aspect);
      const azimuthDeg = normalizeDegrees(spec.azimuthDeg);
      const azimuth = azimuthDeg * Math.PI / 180;
      const elevation = spec.elevationDeg * Math.PI / 180;
      const cosElevation = Math.cos(elevation);
      const direction = Vector3.FromArray(referenceFrame.xAxis).scale(Math.sin(azimuth) * cosElevation)
        .add(Vector3.FromArray(referenceFrame.yAxis).scale(Math.sin(elevation)))
        .add(Vector3.FromArray(referenceFrame.zAxis).scale(Math.cos(azimuth) * cosElevation))
        .normalize();
      const position = center.add(direction.scale(distance));
      camera.upVector.copyFrom(Vector3.FromArray(referenceFrame.yAxis));
      camera.setTarget(center);
      camera.setPosition(position);
      if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
        applyOrthographicCameraFraming(camera, bounds.radiusWorld, margin, aspect);
      }
      normalizedSpec = {
        kind: 'orbit',
        reference: spec.reference,
        ...(spec.referenceHandle && referenceFrame.source ? { referenceHandle: referenceFrame.source } : {}),
        azimuthDeg,
        elevationDeg: spec.elevationDeg,
        distance: roundNumber(distance),
        margin,
      };
    }

    camera.getViewMatrix(true);
    camera.getProjectionMatrix(true);
    const identity = readIdentity();
    return {
      data: {
        leaseId,
        targets: targetNodes.map(node => makeHandle(node, identity)),
        normalizedSpec,
        referenceFrame,
        aggregateBounds: bounds,
        projection: camera.mode === Camera.ORTHOGRAPHIC_CAMERA ? 'orthographic' : 'perspective',
        cameraBefore,
        cameraAfter: readCameraSnapshot(camera),
        screenCoverage: projectBoundsToScreen(camera, lease.scene, bounds),
      },
      observed: [
        'camera.lease',
        'camera.pose',
        'camera.projection',
        `camera.reference.${referenceFrame.reference}`,
        'camera.screenCoverage',
        'node.boundingBox',
      ],
    };
  }

  function adjustCamera(
    leaseId: string,
    rawSpec: RuntimeInspectorCameraAdjustSpec,
  ): CommandResult<RuntimeInspectorCameraAdjustResult> {
    const lease = requireCameraLease(leaseId);
    const spec = validateCameraAdjustSpec(rawSpec);
    const camera = lease.camera;
    const cameraBefore = readCameraSnapshot(camera);
    const normalizedSpec: RuntimeInspectorCameraAdjustSpec = {};

    if (spec.orbitDeltaDeg) {
      camera.alpha -= spec.orbitDeltaDeg.azimuth * Math.PI / 180;
      camera.beta = clamp(
        camera.beta - spec.orbitDeltaDeg.elevation * Math.PI / 180,
        Math.PI / 180,
        179 * Math.PI / 180,
      );
      normalizedSpec.orbitDeltaDeg = {
        azimuth: roundNumber(spec.orbitDeltaDeg.azimuth),
        elevation: roundNumber(spec.orbitDeltaDeg.elevation),
      };
    }
    if (spec.dollyFactor !== undefined) {
      if (camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
        scaleOrthographicCamera(camera, lease.scene, spec.dollyFactor);
      } else {
        camera.radius *= spec.dollyFactor;
      }
      normalizedSpec.dollyFactor = roundNumber(spec.dollyFactor);
    }
    camera.getViewMatrix(true);

    if (spec.panWorld) {
      const pan = Vector3.FromArray(spec.panWorld);
      const position = camera.position.add(pan);
      const target = camera.target.add(pan);
      camera.setTarget(target);
      camera.setPosition(position);
      normalizedSpec.panWorld = vector3(pan)!;
    }

    camera.getViewMatrix(true);
    camera.getProjectionMatrix(true);
    return {
      data: {
        leaseId,
        normalizedSpec,
        projection: camera.mode === Camera.ORTHOGRAPHIC_CAMERA ? 'orthographic' : 'perspective',
        cameraBefore,
        cameraAfter: readCameraSnapshot(camera),
      },
      observed: ['camera.lease', 'camera.pose', 'camera.projection', 'camera.adjust'],
    };
  }

  function restoreCameraByLeaseId(
    leaseId: string,
  ): CommandResult<RuntimeInspectorCameraRestoreResult> {
    requireCameraLease(leaseId);
    const result = restoreActiveCameraLease('explicit');
    if (!result) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'camera lease is no longer active', leaseId);
    }
    return {
      data: result,
      observed: ['camera.lease', 'camera.pose', 'camera.projection', 'camera.owner'],
      warnings: result.restored ? [] : [`camera restore was incomplete: ${result.differences.join(', ')}`],
    };
  }

  function inspectCameraOcclusion(
    leaseId: string,
    handlesOrHandle: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    rawOptions: RuntimeInspectorCameraOcclusionOptions,
  ): CommandResult<RuntimeInspectorCameraOcclusionResult> {
    const lease = requireCameraLease(leaseId);
    const occlusionOptions = validateCameraOcclusionOptions(rawOptions);
    const requestedHandles = normalizeCameraHandles(handlesOrHandle);
    const targetNodes = requestedHandles.map(resolveHandle);
    const targetMeshes = expandRuntimeMeshes(lease.scene, targetNodes);
    if (targetMeshes.length === 0) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'occlusion targets have no mesh descendants');
    }
    const targetMeshIds = new Set(targetMeshes.map(node => String(node.uniqueId)));
    const bounds = readAggregateBounds(lease.scene, targetNodes);
    const coverage = projectBoundsToScreen(lease.camera, lease.scene, bounds);
    const grid = buildOcclusionScreenGrid(coverage, occlusionOptions.gridSize ?? 7);
    const hitsById = new Map<string, {
      node: BabylonRuntimeNode;
      hitCount: number;
      minDistance: number;
      maxDistance: number;
    }>();
    let blockedSampleCount = 0;
    let targetMissSampleCount = 0;

    for (const sample of grid.samples) {
      const ray = lease.scene.createPickingRay(sample.x, sample.y, Matrix.Identity(), lease.camera, false);
      const picks = (lease.scene.multiPickWithRay(ray, mesh => (
        mesh.isEnabled()
        && mesh.isVisible
        && mesh.visibility > 0.001
      )) ?? []).sort((left, right) => left.distance - right.distance);
      const targetHit = picks.find(pick => (
        pick.pickedMesh && targetMeshIds.has(String(pick.pickedMesh.uniqueId))
      ));
      if (!targetHit) {
        targetMissSampleCount += 1;
        continue;
      }
      const blockingLimit = targetHit.distance - 1e-4;
      const sampleOccluders = new Set<string>();
      for (const pick of picks) {
        const pickedMesh = pick.pickedMesh;
        if (!pickedMesh || pick.distance >= blockingLimit) continue;
        const engineId = String(pickedMesh.uniqueId);
        if (targetMeshIds.has(engineId) || sampleOccluders.has(engineId)) continue;
        sampleOccluders.add(engineId);
        const existing = hitsById.get(engineId);
        if (existing) {
          existing.hitCount += 1;
          existing.minDistance = Math.min(existing.minDistance, pick.distance);
          existing.maxDistance = Math.max(existing.maxDistance, pick.distance);
        } else {
          hitsById.set(engineId, {
            node: pickedMesh,
            hitCount: 1,
            minDistance: pick.distance,
            maxDistance: pick.distance,
          });
        }
      }
      if (sampleOccluders.size > 0) blockedSampleCount += 1;
    }

    const identity = readIdentity();
    const validTargetSampleCount = grid.samples.length - targetMissSampleCount;
    const occluders = [...hitsById.values()]
      .sort((left, right) => right.hitCount - left.hitCount || String(left.node.uniqueId).localeCompare(String(right.node.uniqueId)))
      .map(hit => ({
        handle: makeHandle(hit.node, identity),
        hitCount: hit.hitCount,
        sampleRatio: roundNumber(hit.hitCount / Math.max(1, validTargetSampleCount)),
        minDistance: roundNumber(hit.minDistance),
        maxDistance: roundNumber(hit.maxDistance),
      }));
    const warnings = targetMissSampleCount > 0
      ? [`${targetMissSampleCount}/${grid.samples.length} screen-grid rays did not intersect a target mesh; blockedRatio uses valid target samples only.`]
      : [];
    return {
      data: {
        leaseId,
        method: 'raycast-screen-grid-v2',
        grid: {
          columns: grid.columns,
          rows: grid.rows,
          boundsPx: grid.boundsPx,
        },
        sampleCount: grid.samples.length,
        validTargetSampleCount,
        blockedSampleCount,
        targetMissSampleCount,
        blockedRatio: validTargetSampleCount > 0
          ? roundNumber(blockedSampleCount / validTargetSampleCount)
          : null,
        occluders,
      },
      observed: ['camera.lease', 'camera.occlusion.screenGrid', 'camera.screenCoverage', 'node.boundingBox'],
      warnings,
    };
  }

  async function inspectCameraVisualOcclusion(
    leaseId: string,
    handlesOrHandle: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    rawOptions: RuntimeInspectorCameraVisualOcclusionOptions,
  ): Promise<CommandResult<RuntimeInspectorCameraVisualOcclusionResult>> {
    return (await captureCameraVisualOcclusion(leaseId, handlesOrHandle, rawOptions)).command;
  }

  async function captureCameraVisualOcclusion(
    leaseId: string,
    handlesOrHandle: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    rawOptions: RuntimeInspectorCameraVisualOcclusionOptions,
    captureOptions: { forceTransparentScene?: boolean; forceTransparentTarget?: boolean } = {},
  ): Promise<{
    command: CommandResult<RuntimeInspectorCameraVisualOcclusionResult>;
    targetPixels: Uint8Array;
    scenePixels: Uint8Array;
    samples: Array<{ x: number; y: number }>;
    width: number;
    height: number;
    depthEpsilon: number;
    invertY: boolean;
  }> {
    const lease = requireCameraLease(leaseId);
    const visualOptions = validateCameraVisualOcclusionOptions(rawOptions);
    const requestedHandles = normalizeCameraHandles(handlesOrHandle);
    const targetNodes = requestedHandles.map(resolveHandle);
    const targetMeshes = expandRuntimeMeshes(lease.scene, targetNodes)
      .filter(isBabylonMeshNode) as AbstractMesh[];
    if (targetMeshes.length === 0) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'visual occlusion targets have no mesh descendants');
    }
    const bounds = readAggregateBounds(lease.scene, targetNodes);
    const coverage = projectBoundsToScreen(lease.camera, lease.scene, bounds);
    const grid = buildOcclusionScreenGrid(coverage, visualOptions.gridSize ?? 7);
    const depthEpsilon = visualOptions.depthEpsilon ?? 1e-5;
    const engine = lease.scene.getEngine();
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const allMeshes = lease.scene.meshes.filter(mesh => !mesh.isDisposed());
    const targetRenderer = new DepthRenderer(
      lease.scene,
      Constants.TEXTURETYPE_UNSIGNED_BYTE,
      lease.camera,
      false,
      Texture.NEAREST_SAMPLINGMODE,
      false,
      '__fp3d_target_depth',
    );
    const sceneRenderer = new DepthRenderer(
      lease.scene,
      Constants.TEXTURETYPE_UNSIGNED_BYTE,
      lease.camera,
      false,
      Texture.NEAREST_SAMPLINGMODE,
      false,
      '__fp3d_scene_depth',
    );
    const targetMap = targetRenderer.getDepthMap();
    const sceneMap = sceneRenderer.getDepthMap();
    targetMap.renderList = targetMeshes;
    sceneMap.renderList = allMeshes;
    targetMap.ignoreCameraViewport = false;
    sceneMap.ignoreCameraViewport = false;
    targetRenderer.useOnlyInActiveCamera = true;
    sceneRenderer.useOnlyInActiveCamera = true;
    targetRenderer.forceDepthWriteTransparentMeshes = captureOptions.forceTransparentTarget === true;
    sceneRenderer.forceDepthWriteTransparentMeshes = captureOptions.forceTransparentScene === true;
    try {
      await renderTransientDepthMap(lease.scene, targetRenderer, targetMap, targetMeshes, 5_000, 'target');
      const targetPixels = await targetMap.readPixels(0, 0, null, true, true);
      await renderTransientDepthMap(lease.scene, sceneRenderer, sceneMap, targetMeshes, 5_000, 'scene');
      const scenePixels = await sceneMap.readPixels(0, 0, null, true, true);
      if (!targetPixels || !scenePixels) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', 'GPU depth readback returned no pixel buffer');
      }
      const expectedLength = width * height * 4;
      if (targetPixels.byteLength < expectedLength || scenePixels.byteLength < expectedLength) {
        throw new RuntimeInspectorCommandError('UNAVAILABLE', 'GPU depth readback buffer is smaller than the render surface');
      }
      const topLeft = analyzeDepthGrid(
        grid.samples,
        targetPixels,
        scenePixels,
        width,
        height,
        depthEpsilon,
        false,
      );
      const bottomLeftInverted = analyzeDepthGrid(
        grid.samples,
        targetPixels,
        scenePixels,
        width,
        height,
        depthEpsilon,
        true,
      );
      const selected = bottomLeftInverted.validTargetSampleCount > topLeft.validTargetSampleCount
        ? bottomLeftInverted
        : topLeft;
      const readbackY = selected === bottomLeftInverted ? 'bottom-left-inverted' : 'top-left';
      const identity = readIdentity();
      const warnings = [
        ...(selected.targetMissSampleCount > 0
          ? [`${selected.targetMissSampleCount}/${grid.samples.length} GPU depth samples missed target pixels; blockedRatio uses valid target samples only.`]
          : []),
      ];
      const command: CommandResult<RuntimeInspectorCameraVisualOcclusionResult> = {
        data: {
          leaseId,
          targets: targetNodes.map(node => makeHandle(node, identity)),
          method: 'gpu-depth-grid-v1',
          grid: { columns: grid.columns, rows: grid.rows, boundsPx: grid.boundsPx },
          sampleCount: grid.samples.length,
          validTargetSampleCount: selected.validTargetSampleCount,
          blockedSampleCount: selected.blockedSampleCount,
          targetMissSampleCount: selected.targetMissSampleCount,
          blockedRatio: selected.validTargetSampleCount > 0
            ? roundNumber(selected.blockedSampleCount / selected.validTargetSampleCount)
            : null,
          depthEpsilon,
          readbackY,
          limitations: [
            'Babylon depth shaders respect opaque geometry and alpha-test discard paths',
            captureOptions.forceTransparentScene
              ? 'alpha-blended transparent meshes are treated as binary opaque geometry in this depth pass; material alpha is not proportional coverage'
              : 'alpha-blended transparent meshes are excluded from this depth pass',
            'particles, sprites, post-process appearance, and shader-only silhouettes are not represented',
            'raycast-screen-grid-v2 remains the structural source for per-occluder handles',
          ],
        },
        observed: [
          'camera.lease',
          'camera.visualOcclusion.gpuDepth',
          'camera.screenCoverage',
          'node.boundingBox',
          'render.depth.target',
          'render.depth.scene',
        ],
        warnings,
      };
      return {
        command,
        targetPixels: new Uint8Array(targetPixels.buffer, targetPixels.byteOffset, targetPixels.byteLength).slice(),
        scenePixels: new Uint8Array(scenePixels.buffer, scenePixels.byteOffset, scenePixels.byteLength).slice(),
        samples: grid.samples,
        width,
        height,
        depthEpsilon,
        invertY: selected === bottomLeftInverted,
      };
    } finally {
      disposeTransientDepthRenderer(targetRenderer);
      disposeTransientDepthRenderer(sceneRenderer);
    }
  }

  async function inspectCameraVisualAttribution(
    leaseId: string,
    handlesOrHandle: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    rawOptions: RuntimeInspectorCameraVisualOcclusionOptions,
  ): Promise<CommandResult<RuntimeInspectorCameraVisualAttributionResult>> {
    const capture = await captureCameraVisualOcclusion(leaseId, handlesOrHandle, rawOptions);
    const structural = inspectCameraOcclusion(leaseId, handlesOrHandle, {
      gridSize: rawOptions.gridSize,
    });
    const lease = requireCameraLease(leaseId);
    const candidateLimit = 12;
    const candidates = structural.data.occluders.slice(0, candidateLimit);
    const renderer = new DepthRenderer(
      lease.scene,
      Constants.TEXTURETYPE_UNSIGNED_BYTE,
      lease.camera,
      false,
      Texture.NEAREST_SAMPLINGMODE,
      false,
      '__fp3d_candidate_depth',
    );
    renderer.useOnlyInActiveCamera = true;
    const depthMap = renderer.getDepthMap();
    depthMap.ignoreCameraViewport = false;
    const attributedOccluders: RuntimeInspectorCameraVisualAttributionResult['attributedOccluders'] = [];
    const attributedSamples = new Set<number>();
    const warnings = [...(capture.command.warnings ?? [])];
    try {
      for (const candidate of candidates) {
        const node = resolveHandle(candidate.handle);
        const meshes = expandRuntimeMeshes(lease.scene, [node]).filter(isBabylonMeshNode) as AbstractMesh[];
        if (meshes.length === 0) continue;
        depthMap.renderList = meshes;
        try {
          await renderTransientDepthMap(lease.scene, renderer, depthMap, meshes, 2_000, `candidate ${candidate.handle.name}`);
        } catch (error) {
          warnings.push(error instanceof Error ? error.message : String(error));
          continue;
        }
        const pixels = await depthMap.readPixels(0, 0, null, true, true);
        if (!pixels) {
          warnings.push(`candidate ${candidate.handle.name} returned no GPU depth buffer`);
          continue;
        }
        const candidatePixels = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
        const matchedSamples = matchCandidateDepthSamples(
          capture.samples,
          capture.targetPixels,
          capture.scenePixels,
          candidatePixels,
          capture.width,
          capture.height,
          capture.depthEpsilon,
          capture.invertY,
        );
        if (matchedSamples.length === 0) continue;
        matchedSamples.forEach(sampleIndex => attributedSamples.add(sampleIndex));
        attributedOccluders.push({
          handle: candidate.handle,
          sampleCount: matchedSamples.length,
          sampleRatio: roundNumber(matchedSamples.length / Math.max(1, capture.command.data.validTargetSampleCount)),
        });
      }
    } finally {
      disposeTransientDepthRenderer(renderer);
    }
    attributedOccluders.sort((left, right) => (
      right.sampleCount - left.sampleCount || left.handle.engineId.localeCompare(right.handle.engineId)
    ));
    if (structural.data.occluders.length > candidateLimit) {
      warnings.push(`${structural.data.occluders.length - candidateLimit} raycast candidates were not GPU-confirmed because the attribution limit is ${candidateLimit}.`);
    }
    return {
      data: {
        leaseId,
        method: 'gpu-depth-match-raycast-candidates-v1',
        visualOcclusion: capture.command.data,
        structuralOcclusion: structural.data,
        attributedOccluders,
        unattributedBlockedSampleCount: Math.max(0, capture.command.data.blockedSampleCount - attributedSamples.size),
        candidateCount: structural.data.occluders.length,
        candidateLimit,
        limitations: [
          'only raycast-discovered candidates are tested for GPU depth attribution',
          'the raycast predicate intentionally includes enabled visible meshes even when isPickable is false',
          'shader-only, particle, sprite, or other raycast-missed visual blockers remain unattributed',
          'frontmost candidate depth must match the full-scene depth within the configured epsilon',
          ...capture.command.data.limitations,
        ],
      },
      observed: [
        ...(capture.command.observed ?? []),
        'camera.visualAttribution.raycastCandidates',
        'camera.visualAttribution.candidateDepth',
      ],
      warnings,
    };
  }

  async function inspectCameraVisualOcclusionBounds(
    leaseId: string,
    handlesOrHandle: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
    rawOptions: RuntimeInspectorCameraVisualOcclusionOptions,
  ): Promise<CommandResult<RuntimeInspectorCameraVisualOcclusionBoundsResult>> {
    const lower = await captureCameraVisualOcclusion(leaseId, handlesOrHandle, rawOptions, {
      forceTransparentTarget: true,
      forceTransparentScene: false,
    });
    const upper = await captureCameraVisualOcclusion(leaseId, handlesOrHandle, rawOptions, {
      forceTransparentTarget: true,
      forceTransparentScene: true,
    });
    const validTargetSampleCount = Math.min(
      lower.command.data.validTargetSampleCount,
      upper.command.data.validTargetSampleCount,
    );
    const uncertainSampleCount = Math.max(
      0,
      upper.command.data.blockedSampleCount - lower.command.data.blockedSampleCount,
    );
    const warnings = [
      ...(lower.command.warnings ?? []).map(warning => `lower bound: ${warning}`),
      ...(upper.command.warnings ?? []).map(warning => `upper bound: ${warning}`),
    ];
    if (upper.command.data.blockedSampleCount < lower.command.data.blockedSampleCount) {
      warnings.push('transparent-binary upper bound was below the transparent-excluded lower bound; treat this observation as unavailable for ordering');
    }
    return {
      data: {
        leaseId,
        method: 'gpu-depth-transparency-bounds-v1',
        lowerBound: lower.command.data,
        upperBound: upper.command.data,
        uncertainSampleCount,
        uncertaintyRatio: validTargetSampleCount > 0
          ? roundNumber(uncertainSampleCount / validTargetSampleCount)
          : null,
        semantics: {
          lower: 'transparent-excluded',
          upper: 'transparent-binary-opaque',
        },
        limitations: [
          'the interval is a conservative diagnostic, not proportional alpha compositing',
          'transparent-binary-opaque treats every alpha-blended fragment as fully depth-blocking',
          'particles, sprites, post-process appearance, and shader-only silhouettes remain outside both bounds',
        ],
      },
      observed: [
        'camera.lease',
        'camera.visualOcclusion.transparencyBounds',
        'render.depth.transparentExcluded',
        'render.depth.transparentBinaryOpaque',
      ],
      warnings,
    };
  }

  function patchCameraVisibility(
    leaseId: string,
    spec: RuntimeInspectorCameraPatchSpec,
  ): CommandResult<RuntimeInspectorCameraPatchResult> {
    const lease = requireCameraLease(leaseId);
    validateCameraPatchSpec(spec);
    const requestedHandles = normalizeCameraHandles(spec.handles);
    const targetNodes = requestedHandles.map(resolveHandle);
    const selectedMeshes = expandRuntimeMeshes(lease.scene, targetNodes);
    if (selectedMeshes.length === 0) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'visibility patch targets have no mesh descendants');
    }
    const selectedIds = new Set(selectedMeshes.map(node => String(node.uniqueId)));
    const candidates = spec.mode === 'isolate'
      ? listBabylonRuntimeNodes(lease.scene).filter(node => isBabylonMeshNode(node) && !selectedIds.has(String(node.uniqueId)))
      : selectedMeshes;
    const opacity = spec.opacity ?? 0.15;
    const states: CameraPatchEntry['states'] = [];

    try {
      for (const node of candidates) {
        const before = readBabylonMeshVisibility(node);
        if (!before) continue;
        const after: BabylonMeshVisibilityState = spec.mode === 'ghost'
          ? {
              ...before,
              visibility: opacity,
              renderOutline: false,
            }
          : { ...before, isVisible: false };
        if (
          before.isVisible === after.isVisible
          && numbersEqual(before.visibility, after.visibility)
          && before.renderOutline === after.renderOutline
          && nullableColorEqual(before.outlineColor, after.outlineColor)
          && numbersEqual(before.outlineWidth, after.outlineWidth)
        ) continue;
        writeBabylonMeshVisibility(node, after);
        states.push({ node, before });
      }
    } catch (error) {
      for (const state of [...states].reverse()) {
        writeBabylonMeshVisibility(state.node, state.before);
      }
      throw new RuntimeInspectorCommandError('INTERNAL_ERROR', `visibility patch failed and was rolled back: ${formatError(error)}`);
    }

    const patch: CameraPatchEntry = {
      id: createId('camera-patch'),
      mode: spec.mode,
      states,
    };
    lease.patches.push(patch);
    const identity = readIdentity();
    const handleLimit = 20;
    const changedHandles = states
      .slice(0, handleLimit)
      .map(state => makeHandle(state.node, identity));
    const truncatedHandleCount = Math.max(0, states.length - changedHandles.length);
    return {
      data: {
        leaseId,
        patchId: patch.id,
        mode: patch.mode,
        changedCount: states.length,
        changedHandles,
        truncatedHandleCount,
      },
      observed: ['camera.lease', 'camera.visibilityPatch', 'node.visibility'],
      warnings: truncatedHandleCount > 0
        ? [`${truncatedHandleCount} changed handles omitted from the response; all remain tracked for restore.`]
        : [],
    };
  }

  function acquireMutationLease(
    acquireOptions: RuntimeInspectorMutationAcquireOptions,
  ): CommandResult<RuntimeInspectorMutationLeaseRecord> {
    validateMutationAcquireOptions(acquireOptions);
    const scene = requireScene();
    if (activeMutationLease) {
      throw new RuntimeInspectorCommandError('LEASE_CONFLICT', 'runtime mutation already has an active lease', {
        activeLease: readMutationLeaseRecord(activeMutationLease),
      });
    }
    const owner = acquireOptions.owner?.trim() || 'agent';
    const reason = acquireOptions.reason?.trim() || null;
    const timeoutMs = acquireOptions.timeoutMs ?? 60_000;
    const acquiredAtMs = Date.now();
    const entry: MutationLeaseEntry = {
      record: {
        id: createId('mutation-lease'),
        owner,
        reason,
        acquiredAt: new Date(acquiredAtMs).toISOString(),
        expiresAt: new Date(acquiredAtMs + timeoutMs).toISOString(),
        active: true,
        patchCount: 0,
      },
      scene,
      patches: [],
      timeoutId: null,
    };
    entry.timeoutId = window.setTimeout(() => {
      if (activeMutationLease?.record.id === entry.record.id) restoreActiveMutationLease('timeout');
    }, timeoutMs);
    activeMutationLease = entry;
    return {
      data: readMutationLeaseRecord(entry),
      observed: ['mutation.lease'],
      unavailable: [{
        channel: 'mutation.owner',
        reason: 'Mutation 0.1 does not pause gameplay property owners; verify persistence after a rendered frame.',
      }],
    };
  }

  function patchRuntimeNode(
    leaseId: string,
    spec: RuntimeInspectorMutationPatchSpec,
  ): CommandResult<RuntimeInspectorMutationPatchResult> {
    validateMutationPatchSpec(spec);
    const node = resolveHandle(spec.handle);
    const lease = requireMutationLease(leaseId);
    if (lease.scene !== requireScene()) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'mutation lease belongs to another scene');
    }
    validateMutationSetForNode(node, spec.set);
    const before = readMutationNodeSnapshot(node);
    const patchId = createId('mutation-patch');
    try {
      applyMutationSet(node, spec.set);
      node.computeWorldMatrix(true);
    } catch (error) {
      restoreMutationFields(node, before, Object.keys(spec.set) as Array<keyof RuntimeInspectorMutationSetSpec>);
      throw new RuntimeInspectorCommandError('INTERNAL_ERROR', `runtime mutation failed and was rolled back: ${formatError(error)}`);
    }
    const after = readMutationNodeSnapshot(node);
    const changedFields = (Object.keys(spec.set) as Array<keyof RuntimeInspectorMutationSetSpec>)
      .filter(field => !mutationSnapshotFieldEqual(before, after, field));
    if (changedFields.length > 0) {
      lease.patches.push({ id: patchId, node, before, fields: changedFields });
      lease.record.patchCount = lease.patches.length;
    }
    return {
      data: {
        leaseId,
        patchId,
        target: makeHandle(node, readIdentity()),
        changed: changedFields.length > 0,
        changedFields,
        before,
        after,
      },
      observed: [
        'mutation.lease',
        'mutation.patch',
        'node.transform.local',
        ...(isBabylonMeshNode(node) ? ['node.visibility'] : []),
      ],
      unavailable: [{
        channel: 'mutation.persistence',
        reason: 'runtime mutation is ephemeral and is not persisted to source configuration',
      }],
    };
  }

  function restoreMutationByLeaseId(
    leaseId: string,
  ): CommandResult<RuntimeInspectorMutationRestoreResult> {
    requireMutationLease(leaseId);
    const result = restoreActiveMutationLease('explicit');
    if (!result) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'mutation lease is no longer active', leaseId);
    }
    return {
      data: result,
      observed: ['mutation.lease', 'mutation.restoreAudit', 'node.transform.local', 'node.visibility'],
      warnings: result.restored ? [] : [`mutation restore was incomplete: ${result.differences.join(', ')}`],
    };
  }

  function requireMutationLease(leaseId: string): MutationLeaseEntry {
    if (typeof leaseId !== 'string' || !leaseId.trim()) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'mutation lease id must be a non-empty string');
    }
    if (!activeMutationLease || activeMutationLease.record.id !== leaseId) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'mutation lease is missing, expired, or already restored', {
        requested: leaseId,
        active: activeMutationLease?.record.id ?? null,
      });
    }
    return activeMutationLease;
  }

  function restoreActiveMutationLease(reason: string): RuntimeInspectorMutationRestoreResult | null {
    const lease = activeMutationLease;
    if (!lease) return null;
    activeMutationLease = null;
    if (lease.timeoutId !== null) window.clearTimeout(lease.timeoutId);
    const differences: string[] = [];
    let restoredPatchCount = 0;
    for (const patch of [...lease.patches].reverse()) {
      try {
        restoreMutationFields(patch.node, patch.before, patch.fields);
        const restored = readMutationNodeSnapshot(patch.node);
        const patchDifferences = patch.fields.filter(field => !mutationSnapshotFieldEqual(patch.before, restored, field));
        if (patchDifferences.length === 0) restoredPatchCount += 1;
        else differences.push(...patchDifferences.map(field => `mutation.patch:${patch.id}:${field}`));
      } catch (error) {
        differences.push(`mutation.patch:${patch.id}:${formatError(error)}`);
      }
    }
    lease.patches.length = 0;
    lastMutationRestore = {
      leaseId: lease.record.id,
      reason,
      restored: differences.length === 0,
      restoredPatchCount,
      differences,
    };
    return lastMutationRestore;
  }

  function readMutationLeaseRecord(lease: MutationLeaseEntry): RuntimeInspectorMutationLeaseRecord {
    return {
      ...lease.record,
      active: activeMutationLease?.record.id === lease.record.id,
      patchCount: lease.patches.length,
    };
  }

  function requireCamera(): ArcRotateCamera {
    const camera = options.getGame()?.getCamera() ?? null;
    if (!camera) throw new RuntimeInspectorCommandError('UNAVAILABLE', 'game camera is not available');
    return camera;
  }

  function requireCameraLease(leaseId: string): CameraLeaseEntry {
    if (typeof leaseId !== 'string' || !leaseId.trim()) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'camera lease id must be a non-empty string');
    }
    if (!activeCameraLease || activeCameraLease.record.id !== leaseId) {
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'camera lease is missing, expired, or already restored', {
        requested: leaseId,
        active: activeCameraLease?.record.id ?? null,
      });
    }
    const lease = activeCameraLease;
    if (lease.scene !== requireScene()) {
      restoreActiveCameraLease('dispose');
      throw new RuntimeInspectorCommandError('INVALID_LEASE', 'camera lease belongs to another scene');
    }
    return lease;
  }

  function restoreActiveCameraLease(
    reason: RuntimeInspectorCameraRestoreResult['reason'],
  ): RuntimeInspectorCameraRestoreResult | null {
    const lease = activeCameraLease;
    if (!lease) return null;
    activeCameraLease = null;
    if (lease.timeoutId !== null) window.clearTimeout(lease.timeoutId);

    const differences: string[] = [];
    let cameraAfter: RuntimeInspectorCameraSnapshot | null = null;
    let ownerAfter: unknown = null;
    const restoredPatchCount = restoreCameraVisibilityPatches(lease, differences);
    try {
      applyCameraSnapshot(lease.camera, lease.record.cameraBefore);
      cameraAfter = readCameraSnapshot(lease.camera);
      differences.push(...compareCameraSnapshots(lease.record.cameraBefore, cameraAfter));
    } catch (error) {
      differences.push(`camera.restore:${formatError(error)}`);
    }

    if (lease.ownerProvider && lease.ownerLease) {
      try {
        lease.ownerProvider.restore(lease.ownerLease.restoreState);
        ownerAfter = safeSerialize(lease.ownerProvider.readState?.() ?? null);
        if (JSON.stringify(ownerAfter) !== JSON.stringify(safeSerialize(lease.ownerLease.stateBefore))) {
          differences.push('camera.owner');
        }
      } catch (error) {
        differences.push(`camera.owner:${formatError(error)}`);
      }
    }

    lastCameraRestore = {
      leaseId: lease.record.id,
      reason,
      restored: differences.length === 0,
      cameraAfter,
      ownerAfter,
      restoredPatchCount,
      differences,
    };
    return lastCameraRestore;
  }

  function readCameraLeaseRecord(lease: CameraLeaseEntry): RuntimeInspectorCameraLeaseRecord {
    return {
      ...lease.record,
      active: activeCameraLease?.record.id === lease.record.id,
      cameraBefore: { ...lease.record.cameraBefore },
      activePatchCount: lease.patches.length,
    };
  }

  function restoreCameraVisibilityPatches(
    lease: CameraLeaseEntry,
    differences: string[],
  ): number {
    let restoredPatchCount = 0;
    for (const patch of [...lease.patches].reverse()) {
      let patchRestored = true;
      for (const state of [...patch.states].reverse()) {
        try {
          writeBabylonMeshVisibility(state.node, state.before);
          const after = readBabylonMeshVisibility(state.node);
          if (
            !after
            || after.isVisible !== state.before.isVisible
            || !numbersEqual(after.visibility, state.before.visibility)
            || after.renderOutline !== state.before.renderOutline
            || !nullableColorEqual(after.outlineColor, state.before.outlineColor)
            || !numbersEqual(after.outlineWidth, state.before.outlineWidth)
          ) {
            patchRestored = false;
            differences.push(`camera.patch:${patch.id}:${String(state.node.uniqueId)}`);
          }
        } catch (error) {
          patchRestored = false;
          differences.push(`camera.patch:${patch.id}:${formatError(error)}`);
        }
      }
      if (patchRestored) restoredPatchCount += 1;
    }
    lease.patches.length = 0;
    return restoredPatchCount;
  }

  function makeHandle(
    node: BabylonRuntimeNode,
    identity: RuntimeInspectorIdentity,
  ): RuntimeInspectorObjectHandle {
    const engineId = String(node.uniqueId);
    const existing = handles.get(engineId);
    let objectGeneration = existing?.objectGeneration ?? 1;
    if (existing && existing.node !== node) objectGeneration += 1;
    handles.set(engineId, { node, objectGeneration });
    return {
      runtimeSessionId,
      sceneId: identity.scene.id,
      sceneGeneration: identity.scene.generation,
      kind: getBabylonNodeKind(node),
      engineId,
      objectGeneration,
      name: String(node.name ?? ''),
      path: readNodePath(node),
    };
  }

  function resolveHandle(handle: RuntimeInspectorObjectHandle): BabylonRuntimeNode {
    if (!isHandleLike(handle)) {
      throw new RuntimeInspectorCommandError('INVALID_HANDLE', 'handle does not match fp3d v0.1 shape', handle);
    }
    const identity = readIdentity();
    if (handle.runtimeSessionId !== runtimeSessionId) {
      throw new RuntimeInspectorCommandError('RUNTIME_MISMATCH', 'handle belongs to another runtime session', {
        expected: runtimeSessionId,
        actual: handle.runtimeSessionId,
      });
    }
    if (handle.sceneId !== identity.scene.id || handle.sceneGeneration !== identity.scene.generation) {
      throw new RuntimeInspectorCommandError('SCENE_MISMATCH', 'handle belongs to another scene generation', {
        expected: identity.scene,
        actual: { id: handle.sceneId, generation: handle.sceneGeneration },
      });
    }
    const entry = handles.get(handle.engineId);
    if (!entry || entry.objectGeneration !== handle.objectGeneration) {
      throw new RuntimeInspectorCommandError('STALE_HANDLE', 'handle object generation is stale', handle);
    }
    const scene = requireScene();
    const current = listBabylonRuntimeNodes(scene).find(node => String(node.uniqueId) === handle.engineId);
    if (!current || current !== entry.node || isBabylonNodeDisposed(entry.node)) {
      throw new RuntimeInspectorCommandError('STALE_HANDLE', 'handle target is disposed, removed, or reused', handle);
    }
    return entry.node;
  }

  function readNodePath(node: BabylonRuntimeNode): string[] {
    const path: string[] = [];
    let current: BabylonRuntimeNode | null = node;
    let guard = 0;
    while (current && guard < 64) {
      path.push(`${String(current.name ?? '')}#${String(current.uniqueId)}`);
      current = isRuntimeNode(current.parent) ? current.parent : null;
      guard += 1;
    }
    return path.reverse();
  }
}

function matchQueryNodes(
  spec: RuntimeInspectorQuerySpec,
  nodes: BabylonRuntimeNode[],
): { matches: BabylonRuntimeNode[]; metadataChannels: string[] } {
  const matcher = createNameMatcher(spec.name);
  const kinds = spec.kind ? new Set(Array.isArray(spec.kind) ? spec.kind : [spec.kind]) : null;
  const metadataPredicates = spec.metadata ?? null;
  const metadataChannels = metadataPredicates
    ? [...new Set(metadataPredicates.map(predicate => `node.metadata.${predicate.path.join('.')}`))]
    : [];
  const matches = nodes.filter(node => {
    if (spec.engineId !== undefined && String(node.uniqueId) !== spec.engineId) return false;
    if (kinds && !kinds.has(getBabylonNodeKind(node))) return false;
    if (matcher && !matcher(String(node.name ?? ''))) return false;
    if (spec.enabled !== undefined && isBabylonNodeEnabled(node) !== spec.enabled) return false;
    const visible = readBabylonNodeVisible(node);
    if (spec.visible !== undefined && visible !== spec.visible) return false;
    if (metadataPredicates) {
      const metadataMatch = matchesMetadataPredicates(node.metadata, metadataPredicates);
      if (metadataMatch.failedPath) {
        throw new RuntimeInspectorCommandError(
          'UNAVAILABLE',
          'metadata predicate could not be evaluated without executing an accessor or unsafe object trap',
          { engineId: String(node.uniqueId), path: metadataMatch.failedPath },
        );
      }
      if (!metadataMatch.matches) return false;
    }
    return true;
  });
  return { matches, metadataChannels };
}

const TRACE_FIELDS = new Set<RuntimeInspectorTraceField>([
  'lifecycle.enabled',
  'lifecycle.visible',
  'lifecycle.visibility',
  'lifecycle.disposed',
  'transform.position',
  'transform.rotation',
  'transform.rotationQuaternion',
  'transform.scaling',
  'transform.absolutePosition',
  'transform.absoluteScaling',
  'relations.parent',
  'boundingBox.minimumWorld',
  'boundingBox.maximumWorld',
  'health.finiteTransform',
]);

function validateTraceStartSpec(spec: RuntimeInspectorTraceStartSpec): RuntimeInspectorTraceStartSpec {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace start spec must be an object', spec);
  }
  const allowed = new Set([
    'label', 'handles', 'query', 'includeDescendants', 'fields', 'trigger',
    'preSamples', 'postSamples', 'sampleEveryFrames', 'maxObjects',
  ]);
  const unknown = Object.keys(spec).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported trace fields: ${unknown.join(', ')}`, unknown);
  }
  if (spec.label !== undefined && (typeof spec.label !== 'string' || !spec.label.trim() || spec.label.length > 128)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace label must be a non-empty string up to 128 characters');
  }
  const hasHandles = spec.handles !== undefined;
  const hasQuery = spec.query !== undefined;
  if (hasHandles === hasQuery) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace requires exactly one selector: handles or query');
  }
  if (hasHandles) {
    const handles = Array.isArray(spec.handles) ? spec.handles : [spec.handles];
    if (handles.length < 1 || handles.length > 16 || handles.some(handle => !isHandleLike(handle))) {
      throw new RuntimeInspectorCommandError('INVALID_HANDLE', 'trace handles selector requires 1 to 16 valid handles');
    }
  }
  if (hasQuery) validateQuerySpec(spec.query!);
  if (spec.includeDescendants !== undefined && typeof spec.includeDescendants !== 'boolean') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace includeDescendants must be boolean');
  }
  if (!Array.isArray(spec.fields) || spec.fields.length < 1 || spec.fields.length > 8) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace fields must contain 1 to 8 entries');
  }
  if (spec.fields.some(field => typeof field !== 'string' || !TRACE_FIELDS.has(field))) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace fields contain an unsupported node field', spec.fields);
  }
  if (new Set(spec.fields).size !== spec.fields.length) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace fields must be unique');
  }
  validateTraceTriggerSpec(spec.trigger, spec.fields);
  const preSamples = validateTraceInteger(spec.preSamples, 'preSamples', 0, 119, 30);
  const postSamples = validateTraceInteger(spec.postSamples, 'postSamples', 0, 119, 10);
  if (preSamples + postSamples + 1 > 120) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace preSamples + postSamples + trigger sample must not exceed 120');
  }
  const sampleEveryFrames = validateTraceInteger(spec.sampleEveryFrames, 'sampleEveryFrames', 1, 60, 1);
  const maxObjects = validateTraceInteger(spec.maxObjects, 'maxObjects', 1, 8, 8);
  return {
    ...(spec.label !== undefined ? { label: spec.label.trim() } : {}),
    ...(hasHandles ? { handles: spec.handles } : {}),
    ...(hasQuery ? { query: spec.query } : {}),
    includeDescendants: spec.includeDescendants ?? false,
    fields: [...spec.fields],
    trigger: cloneJsonValue(spec.trigger),
    preSamples,
    postSamples,
    sampleEveryFrames,
    maxObjects,
  };
}

function validateTraceTriggerSpec(
  trigger: RuntimeInspectorTraceTriggerSpec,
  fields: RuntimeInspectorTraceField[],
): void {
  if (!trigger || typeof trigger !== 'object' || Array.isArray(trigger)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace trigger must be an object');
  }
  if (trigger.kind === 'manual') {
    const unknown = Object.keys(trigger).filter(key => key !== 'kind');
    if (unknown.length > 0) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported manual trace trigger fields: ${unknown.join(', ')}`);
    }
    return;
  }
  if (trigger.kind !== 'change' && trigger.kind !== 'equals') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace trigger kind must be change, equals, or manual');
  }
  const allowed = trigger.kind === 'equals'
    ? new Set(['kind', 'field', 'value', 'handle', 'epsilon'])
    : new Set(['kind', 'field', 'handle', 'epsilon']);
  const unknown = Object.keys(trigger).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported trace trigger fields: ${unknown.join(', ')}`, unknown);
  }
  if (!TRACE_FIELDS.has(trigger.field) || !fields.includes(trigger.field)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace trigger field must be present in the selected fields');
  }
  if (trigger.handle !== undefined && !isHandleLike(trigger.handle)) {
    throw new RuntimeInspectorCommandError('INVALID_HANDLE', 'trace trigger handle is invalid');
  }
  if (trigger.epsilon !== undefined && (!Number.isFinite(trigger.epsilon) || trigger.epsilon < 0 || trigger.epsilon > 1_000_000)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace trigger epsilon must be finite and between 0 and 1000000');
  }
  if (trigger.kind === 'equals' && !isTraceComparableValue(trigger.value)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace equals value must be a finite JSON primitive or an array of at most 16 primitives');
  }
}

function isTraceComparableValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return Array.isArray(value)
    && value.length <= 16
    && value.every(item => item === null
      || typeof item === 'string'
      || typeof item === 'boolean'
      || (typeof item === 'number' && Number.isFinite(item)));
}

function validateTraceInteger(
  value: number | undefined,
  label: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `trace ${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function validateTraceReadOptions(options: RuntimeInspectorTraceReadOptions): RuntimeInspectorTraceReadOptions {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace read options must be an object');
  }
  const unknown = Object.keys(options).filter(key => !['fromSequence', 'limit'].includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported trace read fields: ${unknown.join(', ')}`, unknown);
  }
  const fromSequence = options.fromSequence === undefined
    ? undefined
    : validateTraceInteger(options.fromSequence, 'fromSequence', 1, Number.MAX_SAFE_INTEGER, 1);
  const limit = options.limit === undefined
    ? undefined
    : validateTraceInteger(options.limit, 'read limit', 1, 50, 50);
  return {
    ...(fromSequence !== undefined ? { fromSequence } : {}),
    ...(limit !== undefined ? { limit } : {}),
  };
}

function validateTraceId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !id.trim() || id.length > 256) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'trace id must be a non-empty string up to 256 characters', id);
  }
}

function validatePixelCaptureSpec(
  spec: RuntimeInspectorPixelCaptureSpec,
): RuntimeInspectorPixelCaptureSpec {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel capture spec must be an object', spec);
  }
  const unknown = Object.keys(spec).filter(key => !['label', 'roi', 'backgroundTolerance', 'timeoutMs'].includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported pixel capture fields: ${unknown.join(', ')}`, unknown);
  }
  if (spec.label !== undefined && (typeof spec.label !== 'string' || !spec.label.trim() || spec.label.length > 128)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel capture label must be a non-empty string up to 128 characters');
  }
  if (spec.backgroundTolerance !== undefined && (!Number.isInteger(spec.backgroundTolerance) || spec.backgroundTolerance < 0 || spec.backgroundTolerance > 255)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel backgroundTolerance must be an integer between 0 and 255');
  }
  if (spec.timeoutMs !== undefined && (!Number.isInteger(spec.timeoutMs) || spec.timeoutMs < 100 || spec.timeoutMs > 10_000)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel timeoutMs must be an integer between 100 and 10000');
  }
  if (spec.roi !== undefined) validatePixelRoiSpec(spec.roi);
  return {
    ...(spec.label !== undefined ? { label: spec.label.trim() } : {}),
    ...(spec.roi !== undefined ? { roi: spec.roi } : {}),
    backgroundTolerance: spec.backgroundTolerance ?? 6,
    timeoutMs: spec.timeoutMs ?? 2_000,
  };
}

function validatePixelRoiSpec(roi: RuntimeInspectorPixelCaptureSpec['roi']): void {
  if (!roi || typeof roi !== 'object' || Array.isArray(roi)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel roi must be an object');
  }
  if (roi.kind === 'full') {
    const unknown = Object.keys(roi).filter(key => key !== 'kind');
    if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported full pixel roi fields: ${unknown.join(', ')}`);
    return;
  }
  if (roi.kind === 'screen') {
    const unknown = Object.keys(roi).filter(key => !['kind', 'x', 'y', 'width', 'height'].includes(key));
    if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported screen pixel roi fields: ${unknown.join(', ')}`);
    if (![roi.x, roi.y, roi.width, roi.height].every(Number.isFinite) || roi.width <= 0 || roi.height <= 0) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'screen pixel roi requires finite x/y and positive width/height');
    }
    return;
  }
  if (roi.kind === 'handles') {
    const unknown = Object.keys(roi).filter(key => !['kind', 'handles', 'paddingPx'].includes(key));
    if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported handle pixel roi fields: ${unknown.join(', ')}`);
    const handles = Array.isArray(roi.handles) ? roi.handles : [roi.handles];
    if (handles.length < 1 || handles.length > 100 || handles.some(handle => !isHandleLike(handle))) {
      throw new RuntimeInspectorCommandError('INVALID_HANDLE', 'pixel handle roi requires 1 to 100 valid handles');
    }
    if (roi.paddingPx !== undefined && (!Number.isInteger(roi.paddingPx) || roi.paddingPx < 0 || roi.paddingPx > 256)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel roi paddingPx must be an integer between 0 and 256');
    }
    return;
  }
  throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel roi kind must be full, screen, or handles');
}

function validatePixelDiffOptions(options: RuntimeInspectorPixelDiffOptions): RuntimeInspectorPixelDiffOptions {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel diff options must be an object');
  }
  const unknown = Object.keys(options).filter(key => !['channelThreshold', 'roiMode', 'heatmapColumns', 'heatmapRows'].includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported pixel diff fields: ${unknown.join(', ')}`, unknown);
  }
  if (options.channelThreshold !== undefined && (!Number.isInteger(options.channelThreshold) || options.channelThreshold < 0 || options.channelThreshold > 255)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel channelThreshold must be an integer between 0 and 255');
  }
  const roiModes = ['union', 'intersection', 'from', 'to', 'full'];
  if (options.roiMode !== undefined && !roiModes.includes(options.roiMode)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel roiMode must be union, intersection, from, to, or full');
  }
  for (const [key, value] of [['heatmapColumns', options.heatmapColumns], ['heatmapRows', options.heatmapRows]] as const) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 32)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `pixel ${key} must be an integer between 1 and 32`);
    }
  }
  return { ...options };
}

function validatePixelCaptureId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !id.trim() || id.length > 256) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'pixel capture id must be a non-empty string up to 256 characters', id);
  }
}

function validatePixelCanvasSize(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', 'drawing-buffer dimensions are unavailable', { width, height });
  }
  if (width * height > 4_194_304) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', 'Pixel Capture 0.1 caps drawing buffers at 4,194,304 pixels', {
      width,
      height,
      pixelCount: width * height,
    });
  }
}

async function readDefaultFramebufferAfterRender(
  scene: Scene,
  width: number,
  height: number,
  timeoutMs: number,
): Promise<Uint8Array> {
  return waitForAfterRender(scene, timeoutMs, async () => {
    const view = await scene.getEngine().readPixels(0, 0, width, height, true, true);
    return copyPixelBytes(view, width * height * 4);
  });
}

async function readDefaultFramebufferTwiceAfterRender(
  scene: Scene,
  width: number,
  height: number,
  timeoutMs: number,
): Promise<[Uint8Array, Uint8Array]> {
  return waitForAfterRender(scene, timeoutMs, async () => {
    const engine = scene.getEngine();
    const first = copyPixelBytes(await engine.readPixels(0, 0, width, height, true, true), width * height * 4);
    const second = copyPixelBytes(await engine.readPixels(0, 0, width, height, true, true), width * height * 4);
    return [first, second];
  });
}

function waitForAfterRender<T>(
  scene: Scene,
  timeoutMs: number,
  read: () => Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      if (observer) scene.onAfterRenderObservable.remove(observer);
      reject(new RuntimeInspectorCommandError('UNAVAILABLE', `pixel capture timed out after ${timeoutMs}ms waiting for scene render`));
    }, timeoutMs);
    const observer = scene.onAfterRenderObservable.add(() => {
      if (settled) return;
      settled = true;
      scene.onAfterRenderObservable.remove(observer);
      window.clearTimeout(timeoutId);
      read().then(resolve, reject);
    });
  });
}

function copyPixelBytes(view: ArrayBufferView, expectedLength: number): Uint8Array {
  if (view.byteLength < expectedLength) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', 'drawing-buffer read returned fewer bytes than expected', {
      expectedLength,
      actualLength: view.byteLength,
    });
  }
  return new Uint8Array(view.buffer, view.byteOffset, expectedLength).slice();
}

function clipPixelRect(rect: RuntimeInspectorPixelRect, width: number, height: number): RuntimeInspectorPixelRect {
  const left = Math.max(0, Math.min(width, Math.floor(rect.x)));
  const top = Math.max(0, Math.min(height, Math.floor(rect.y)));
  const right = Math.max(0, Math.min(width, Math.ceil(rect.x + rect.width)));
  const bottom = Math.max(0, Math.min(height, Math.ceil(rect.y + rect.height)));
  if (right <= left || bottom <= top) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', 'pixel ROI does not intersect the drawing buffer', { rect, width, height });
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function resolvePixelComparisonRoi(
  from: RuntimeInspectorPixelRect,
  to: RuntimeInspectorPixelRect,
  mode: NonNullable<RuntimeInspectorPixelDiffOptions['roiMode']>,
  width: number,
  height: number,
): RuntimeInspectorPixelRect {
  if (mode === 'full') return { x: 0, y: 0, width, height };
  if (mode === 'from') return clipPixelRect(from, width, height);
  if (mode === 'to') return clipPixelRect(to, width, height);
  const fromRight = from.x + from.width;
  const fromBottom = from.y + from.height;
  const toRight = to.x + to.width;
  const toBottom = to.y + to.height;
  if (mode === 'intersection') {
    const left = Math.max(from.x, to.x);
    const top = Math.max(from.y, to.y);
    return clipPixelRect({
      x: left,
      y: top,
      width: Math.min(fromRight, toRight) - left,
      height: Math.min(fromBottom, toBottom) - top,
    }, width, height);
  }
  const left = Math.min(from.x, to.x);
  const top = Math.min(from.y, to.y);
  return clipPixelRect({
    x: left,
    y: top,
    width: Math.max(fromRight, toRight) - left,
    height: Math.max(fromBottom, toBottom) - top,
  }, width, height);
}

function readPixelCaptureStatistics(
  bytes: Uint8Array,
  width: number,
  height: number,
  roi: RuntimeInspectorPixelRect,
  background: [number, number, number, number],
  tolerance: number,
): Pick<RuntimeInspectorPixelCaptureRecord['statistics'], 'pixelCount' | 'nonBackgroundPixelCount' | 'meanRgba' | 'hash32'> {
  let nonBackgroundPixelCount = 0;
  const sums = [0, 0, 0, 0];
  let hash = 0x811c9dc5;
  for (let y = roi.y; y < roi.y + roi.height; y += 1) {
    for (let x = roi.x; x < roi.x + roi.width; x += 1) {
      const index = pixelByteIndex(x, y, width, height);
      let backgroundMatch = true;
      for (let channel = 0; channel < 4; channel += 1) {
        const value = bytes[index + channel];
        sums[channel] += value;
        hash ^= value;
        hash = Math.imul(hash, 0x01000193) >>> 0;
        if (channel < 3 && Math.abs(value - background[channel]) > tolerance) backgroundMatch = false;
      }
      if (!backgroundMatch) nonBackgroundPixelCount += 1;
    }
  }
  const pixelCount = roi.width * roi.height;
  return {
    pixelCount,
    nonBackgroundPixelCount,
    meanRgba: pixelCount > 0 ? sums.map(sum => roundNumber(sum / pixelCount)) as [number, number, number, number] : null,
    hash32: hash.toString(16).padStart(8, '0'),
  };
}

function measurePixelDifference(
  before: Uint8Array,
  after: Uint8Array,
  width: number,
  height: number,
  roi: RuntimeInspectorPixelRect,
  threshold: number,
  includeInside: boolean,
): RuntimeInspectorPixelDiffMetrics {
  let pixelCount = 0;
  let ssd = 0;
  let maxChannelDiff = 0;
  let diffPixelCount = 0;
  let absoluteSum = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const startX = includeInside ? roi.x : 0;
  const startY = includeInside ? roi.y : 0;
  const endX = includeInside ? roi.x + roi.width : width;
  const endY = includeInside ? roi.y + roi.height : height;
  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const pointInside = x >= roi.x && x < roi.x + roi.width && y >= roi.y && y < roi.y + roi.height;
      if (pointInside !== includeInside) continue;
      pixelCount += 1;
      const index = pixelByteIndex(x, y, width, height);
      let pixelChanged = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(before[index + channel] - after[index + channel]);
        absoluteSum += delta;
        ssd += delta * delta;
        if (delta > maxChannelDiff) maxChannelDiff = delta;
        if (delta > threshold) pixelChanged = true;
      }
      if (pixelChanged) {
        diffPixelCount += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return {
    pixelCount,
    ssd,
    maxChannelDiff,
    diffPixelCount,
    diffPixelRatio: pixelCount > 0 ? roundNumber(diffPixelCount / pixelCount) : 0,
    meanAbsoluteChannelDiff: pixelCount > 0 ? roundNumber(absoluteSum / (pixelCount * 4)) : 0,
    changedBounds: diffPixelCount > 0
      ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null,
  };
}

function buildPixelHeatmap(
  before: Uint8Array,
  after: Uint8Array,
  width: number,
  height: number,
  roi: RuntimeInspectorPixelRect,
  threshold: number,
  columns: number,
  rows: number,
): RuntimeInspectorPixelDiffResult['heatmap'] {
  const changedPixelRatios: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    const top = roi.y + Math.floor(row * roi.height / rows);
    const bottom = roi.y + Math.floor((row + 1) * roi.height / rows);
    for (let column = 0; column < columns; column += 1) {
      const left = roi.x + Math.floor(column * roi.width / columns);
      const right = roi.x + Math.floor((column + 1) * roi.width / columns);
      let count = 0;
      let changed = 0;
      for (let y = top; y < Math.max(top + 1, bottom); y += 1) {
        for (let x = left; x < Math.max(left + 1, right); x += 1) {
          if (x >= roi.x + roi.width || y >= roi.y + roi.height) continue;
          count += 1;
          const index = pixelByteIndex(x, y, width, height);
          if ([0, 1, 2, 3].some(channel => Math.abs(before[index + channel] - after[index + channel]) > threshold)) changed += 1;
        }
      }
      changedPixelRatios.push(count > 0 ? roundNumber(changed / count) : 0);
    }
  }
  return { columns, rows, changedPixelRatios };
}

function readPixelCaptureSummary(record: RuntimeInspectorPixelCaptureRecord): RuntimeInspectorPixelCaptureSummary {
  return cloneJsonValue({
    id: record.id,
    label: record.label,
    capturedAt: record.capturedAt,
    runtimeSessionId: record.runtimeSessionId,
    scene: record.scene,
    frame: record.frame,
    canvas: record.canvas,
    roi: record.roi,
    targets: record.targets,
  });
}

function pixelByteIndex(x: number, screenY: number, width: number, height: number): number {
  return ((height - 1 - screenY) * width + x) * 4;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(Number.isFinite(value) ? value : 0)));
}

function validateSnapshotCaptureSpec(
  spec: RuntimeInspectorSnapshotCaptureSpec,
): RuntimeInspectorSnapshotCaptureSpec {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot capture spec must be an object', spec);
  }
  const allowed = new Set(['label', 'handles', 'query', 'includeDescendants', 'channels', 'maxObjects']);
  const unknown = Object.keys(spec).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported snapshot capture fields: ${unknown.join(', ')}`, unknown);
  }
  if (spec.label !== undefined && (typeof spec.label !== 'string' || !spec.label.trim() || spec.label.length > 128)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot label must be a non-empty string up to 128 characters');
  }
  if (spec.handles !== undefined && spec.query !== undefined) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot capture accepts handles or query, not both');
  }
  if (spec.handles !== undefined) {
    const handles = Array.isArray(spec.handles) ? spec.handles : [spec.handles];
    if (handles.length < 1 || handles.length > 500) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot handles must contain 1 to 500 handles');
    }
    for (const handle of handles) {
      if (!isHandleLike(handle)) throw new RuntimeInspectorCommandError('INVALID_HANDLE', 'snapshot handle does not match fp3d v0.1 shape', handle);
    }
  }
  if (spec.query !== undefined) validateQuerySpec(spec.query);
  if (spec.includeDescendants !== undefined && typeof spec.includeDescendants !== 'boolean') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot includeDescendants must be boolean');
  }
  const supportedChannels: RuntimeInspectorSnapshotChannel[] = ['nodes', 'animations', 'providers'];
  if (spec.channels !== undefined) {
    if (!Array.isArray(spec.channels) || spec.channels.length < 1 || spec.channels.length > supportedChannels.length) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot channels must contain 1 to 3 supported channels');
    }
    if (spec.channels.some(channel => !supportedChannels.includes(channel))) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot channels contain an unsupported value', spec.channels);
    }
    if (new Set(spec.channels).size !== spec.channels.length) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot channels must not contain duplicates', spec.channels);
    }
  }
  if (spec.maxObjects !== undefined && (!Number.isInteger(spec.maxObjects) || spec.maxObjects < 1 || spec.maxObjects > 500)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot maxObjects must be an integer between 1 and 500');
  }
  return {
    ...(spec.label !== undefined ? { label: spec.label.trim() } : {}),
    ...(spec.handles !== undefined ? { handles: spec.handles } : {}),
    ...(spec.query !== undefined ? { query: { ...spec.query } } : {}),
    ...(spec.includeDescendants !== undefined ? { includeDescendants: spec.includeDescendants } : {}),
    channels: spec.channels
      ? supportedChannels.filter(channel => spec.channels!.includes(channel))
      : supportedChannels,
    maxObjects: spec.maxObjects ?? 200,
  };
}

function validateSnapshotDiffOptions(
  options: RuntimeInspectorSnapshotDiffOptions,
): RuntimeInspectorSnapshotDiffOptions {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot diff options must be an object');
  }
  const unknown = Object.keys(options).filter(key => key !== 'maxDifferences');
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported snapshot diff fields: ${unknown.join(', ')}`, unknown);
  }
  if (options.maxDifferences !== undefined && (!Number.isInteger(options.maxDifferences) || options.maxDifferences < 1 || options.maxDifferences > 2_000)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'snapshot maxDifferences must be an integer between 1 and 2000');
  }
  return { ...(options.maxDifferences !== undefined ? { maxDifferences: options.maxDifferences } : {}) };
}

function validateSnapshotId(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 256) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `${label} must be a non-empty string up to 256 characters`, value);
  }
}

function expandSnapshotDescendants(
  sceneNodes: BabylonRuntimeNode[],
  roots: BabylonRuntimeNode[],
): BabylonRuntimeNode[] {
  const rootSet = new Set(roots);
  return sceneNodes.filter(node => {
    if (rootSet.has(node)) return true;
    let current = isRuntimeNode(node.parent) ? node.parent : null;
    let guard = 0;
    while (current && guard < 64) {
      if (rootSet.has(current)) return true;
      current = isRuntimeNode(current.parent) ? current.parent : null;
      guard += 1;
    }
    return false;
  });
}

function snapshotNodeKey(handle: RuntimeInspectorObjectHandle): string {
  return `node:${handle.kind}:${handle.engineId}:${handle.objectGeneration}`;
}

function readFiniteVector3(
  value: { x: number; y: number; z: number } | null | undefined,
): [number, number, number] | null {
  if (!value) return null;
  return readFiniteVector3FromTuple([value.x, value.y, value.z]);
}

function readFiniteVector3FromTuple(
  value: [number, number, number] | null | undefined,
): [number, number, number] | null {
  if (!value || value.some(component => !Number.isFinite(component))) return null;
  return value.map(roundNumber) as [number, number, number];
}

function readFiniteQuaternion(
  value: { x: number; y: number; z: number; w: number } | null | undefined,
): [number, number, number, number] | null {
  if (!value) return null;
  const tuple = [value.x, value.y, value.z, value.w];
  if (tuple.some(component => !Number.isFinite(component))) return null;
  return tuple.map(roundNumber) as [number, number, number, number];
}

function readFiniteNumberArray(value: ArrayLike<number>): number[] | null {
  const result = Array.from(value);
  if (result.some(component => !Number.isFinite(component))) return null;
  return result.map(roundNumber);
}

function sanitizeSnapshotBounds(
  bounds: RuntimeInspectorObjectRecord['boundingBox'],
): RuntimeInspectorObjectRecord['boundingBox'] {
  if (!bounds) return null;
  const minimumWorld = readFiniteVector3FromTuple(bounds.minimumWorld);
  const maximumWorld = readFiniteVector3FromTuple(bounds.maximumWorld);
  return minimumWorld && maximumWorld ? { minimumWorld, maximumWorld } : null;
}

function readSnapshotSummary(snapshot: RuntimeInspectorSnapshotRecord): RuntimeInspectorSnapshotSummary {
  return cloneJsonValue({
    id: snapshot.id,
    label: snapshot.label,
    capturedAt: snapshot.capturedAt,
    runtimeSessionId: snapshot.runtimeSessionId,
    scene: snapshot.scene,
    frame: snapshot.frame,
    channels: snapshot.channels,
    objectCount: snapshot.objectCount,
    truncated: snapshot.truncated,
  });
}

function collectSnapshotDifferences(
  before: unknown,
  after: unknown,
  limit: number,
): RuntimeInspectorSnapshotDifference[] {
  const differences: RuntimeInspectorSnapshotDifference[] = [];
  const missing = { $missing: true };
  const visit = (left: unknown, right: unknown, path: string) => {
    if (differences.length >= limit || JSON.stringify(left) === JSON.stringify(right)) return;
    const leftObject = left !== null && typeof left === 'object';
    const rightObject = right !== null && typeof right === 'object';
    if (leftObject && rightObject && !Array.isArray(left) && !Array.isArray(right)) {
      const leftRecord = left as Record<string, unknown>;
      const rightRecord = right as Record<string, unknown>;
      const keys = uniqueSorted([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
      for (const key of keys) {
        if (differences.length >= limit) break;
        const escaped = key.replace(/~/g, '~0').replace(/\//g, '~1');
        const childPath = `${path}/${escaped}`;
        const leftHas = Object.prototype.hasOwnProperty.call(leftRecord, key);
        const rightHas = Object.prototype.hasOwnProperty.call(rightRecord, key);
        if (!leftHas || !rightHas) {
          differences.push({
            path: childPath,
            before: leftHas ? cloneJsonValue(leftRecord[key]) : missing,
            after: rightHas ? cloneJsonValue(rightRecord[key]) : missing,
          });
        } else {
          visit(leftRecord[key], rightRecord[key], childPath);
        }
      }
      return;
    }
    if (Array.isArray(left) && Array.isArray(right)) {
      const maximum = Math.max(left.length, right.length);
      for (let index = 0; index < maximum && differences.length < limit; index += 1) {
        if (index >= left.length || index >= right.length) {
          differences.push({
            path: `${path}/${index}`,
            before: index < left.length ? cloneJsonValue(left[index]) : missing,
            after: index < right.length ? cloneJsonValue(right[index]) : missing,
          });
        } else {
          visit(left[index], right[index], `${path}/${index}`);
        }
      }
      return;
    }
    differences.push({
      path: path || '/',
      before: cloneJsonValue(left),
      after: cloneJsonValue(right),
    });
  };
  visit(before, after, '');
  return differences;
}

function compareSnapshotEntityRefs(
  left: RuntimeInspectorSnapshotEntityRef,
  right: RuntimeInspectorSnapshotEntityRef,
): number {
  return left.entity.localeCompare(right.entity) || left.key.localeCompare(right.key);
}

function dedupeUnavailableCoverage(
  values: Array<{ channel: string; reason: string }>,
): Array<{ channel: string; reason: string }> {
  const records = new Map<string, { channel: string; reason: string }>();
  for (const value of values) {
    if (!value || typeof value !== 'object' || typeof value.channel !== 'string' || !value.channel.trim()
      || typeof value.reason !== 'string' || !value.reason.trim()) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'snapshot unavailable coverage entries require channel and reason strings', value);
    }
    const channel = value.channel.trim().slice(0, 256);
    const reason = value.reason.trim().slice(0, 1_024);
    records.set(`${channel}\n${reason}`, { channel, reason });
  }
  return [...records.values()].sort((left, right) => left.channel.localeCompare(right.channel) || left.reason.localeCompare(right.reason));
}

function cloneJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validateMutationAcquireOptions(options: RuntimeInspectorMutationAcquireOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation acquire options must be an object');
  }
  const unknown = Object.keys(options).filter(key => !['owner', 'reason', 'timeoutMs'].includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported mutation acquire fields: ${unknown.join(', ')}`);
  }
  if (options.owner !== undefined && (typeof options.owner !== 'string' || !options.owner.trim())) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation lease owner must be a non-empty string');
  }
  if (options.reason !== undefined && typeof options.reason !== 'string') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation lease reason must be a string');
  }
  if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 300_000)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation lease timeoutMs must be an integer between 1000 and 300000');
  }
}

function validateMutationPatchSpec(spec: RuntimeInspectorMutationPatchSpec): void {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation patch spec must be an object');
  }
  const unknown = Object.keys(spec).filter(key => !['handle', 'set'].includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported mutation patch fields: ${unknown.join(', ')}`);
  }
  if (!isHandleLike(spec.handle)) {
    throw new RuntimeInspectorCommandError('INVALID_HANDLE', 'mutation patch handle does not match fp3d v0.1 shape', spec.handle);
  }
  if (!spec.set || typeof spec.set !== 'object' || Array.isArray(spec.set)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation patch set must be an object');
  }
  const allowed = new Set(['position', 'rotation', 'rotationQuaternion', 'scaling', 'isVisible', 'visibility']);
  const setUnknown = Object.keys(spec.set).filter(key => !allowed.has(key));
  if (setUnknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported mutation fields: ${setUnknown.join(', ')}`, setUnknown);
  }
  if (Object.keys(spec.set).length === 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation patch set must contain at least one field');
  }
  if (spec.set.position !== undefined) validateFiniteVector3(spec.set.position, 'mutation position');
  if (spec.set.rotation !== undefined) validateFiniteVector3(spec.set.rotation, 'mutation rotation');
  if (spec.set.scaling !== undefined) {
    validateFiniteVector3(spec.set.scaling, 'mutation scaling');
    if (spec.set.scaling.some(value => value < 0.0001 || value > 10_000)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation scaling components must be between 0.0001 and 10000');
    }
  }
  if (spec.set.rotationQuaternion !== undefined) {
    const value = spec.set.rotationQuaternion;
    if (!Array.isArray(value) || value.length !== 4 || value.some(component => !Number.isFinite(component))) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation rotationQuaternion must be a finite [x, y, z, w] tuple');
    }
    const lengthSquared = value.reduce((sum, component) => sum + component * component, 0);
    if (lengthSquared < 1e-12) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation rotationQuaternion must be non-zero');
    }
  }
  if (spec.set.rotation !== undefined && spec.set.rotationQuaternion !== undefined) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation patch cannot set Euler rotation and rotationQuaternion together');
  }
  if (spec.set.isVisible !== undefined && typeof spec.set.isVisible !== 'boolean') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation isVisible must be boolean');
  }
  if (spec.set.visibility !== undefined && (!Number.isFinite(spec.set.visibility) || spec.set.visibility < 0 || spec.set.visibility > 1)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation visibility must be between 0 and 1');
  }
}

function validateMutationSetForNode(
  node: BabylonRuntimeNode,
  set: RuntimeInspectorMutationSetSpec,
): void {
  if ((set.isVisible !== undefined || set.visibility !== undefined) && !isBabylonMeshNode(node)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'mutation visibility fields require a mesh handle');
  }
  if (set.rotation !== undefined && node.rotationQuaternion) {
    throw new RuntimeInspectorCommandError(
      'UNAVAILABLE',
      'mutation Euler rotation is unavailable while the node uses rotationQuaternion; set rotationQuaternion instead',
    );
  }
}

function readMutationNodeSnapshot(node: BabylonRuntimeNode): RuntimeInspectorMutationNodeSnapshot {
  const meshVisibility = readBabylonMeshVisibility(node);
  return {
    position: [node.position.x, node.position.y, node.position.z],
    rotation: [node.rotation.x, node.rotation.y, node.rotation.z],
    rotationQuaternion: node.rotationQuaternion
      ? [node.rotationQuaternion.x, node.rotationQuaternion.y, node.rotationQuaternion.z, node.rotationQuaternion.w]
      : null,
    scaling: [node.scaling.x, node.scaling.y, node.scaling.z],
    isVisible: meshVisibility?.isVisible ?? null,
    visibility: meshVisibility?.visibility ?? null,
  };
}

function applyMutationSet(node: BabylonRuntimeNode, set: RuntimeInspectorMutationSetSpec): void {
  if (set.position) node.position.copyFromFloats(...set.position);
  if (set.rotation) node.rotation.copyFromFloats(...set.rotation);
  if (set.rotationQuaternion) {
    const normalized = Quaternion.FromArray(set.rotationQuaternion).normalize();
    if (node.rotationQuaternion) node.rotationQuaternion.copyFrom(normalized);
    else node.rotationQuaternion = normalized;
  }
  if (set.scaling) node.scaling.copyFromFloats(...set.scaling);
  const meshVisibility = readBabylonMeshVisibility(node);
  if (meshVisibility && (set.isVisible !== undefined || set.visibility !== undefined)) {
    writeBabylonMeshVisibility(node, {
      isVisible: set.isVisible ?? meshVisibility.isVisible,
      visibility: set.visibility ?? meshVisibility.visibility,
      renderOutline: meshVisibility.renderOutline,
      outlineColor: meshVisibility.outlineColor,
      outlineWidth: meshVisibility.outlineWidth,
    });
  }
}

function restoreMutationFields(
  node: BabylonRuntimeNode,
  snapshot: RuntimeInspectorMutationNodeSnapshot,
  fields: Array<keyof RuntimeInspectorMutationSetSpec>,
): void {
  if (fields.includes('position')) node.position.copyFromFloats(...snapshot.position);
  if (fields.includes('rotation')) node.rotation.copyFromFloats(...snapshot.rotation);
  if (fields.includes('rotationQuaternion')) {
    if (snapshot.rotationQuaternion) {
      const restored = Quaternion.FromArray(snapshot.rotationQuaternion);
      if (node.rotationQuaternion) node.rotationQuaternion.copyFrom(restored);
      else node.rotationQuaternion = restored;
    } else {
      node.rotationQuaternion = null;
    }
  }
  if (fields.includes('scaling')) node.scaling.copyFromFloats(...snapshot.scaling);
  const meshVisibility = readBabylonMeshVisibility(node);
  if (meshVisibility && (fields.includes('isVisible') || fields.includes('visibility'))) {
    writeBabylonMeshVisibility(node, {
      isVisible: fields.includes('isVisible') ? snapshot.isVisible ?? meshVisibility.isVisible : meshVisibility.isVisible,
      visibility: fields.includes('visibility') ? snapshot.visibility ?? meshVisibility.visibility : meshVisibility.visibility,
      renderOutline: meshVisibility.renderOutline,
      outlineColor: meshVisibility.outlineColor,
      outlineWidth: meshVisibility.outlineWidth,
    });
  }
  node.computeWorldMatrix(true);
}

function mutationSnapshotFieldEqual(
  left: RuntimeInspectorMutationNodeSnapshot,
  right: RuntimeInspectorMutationNodeSnapshot,
  field: keyof RuntimeInspectorMutationSetSpec,
): boolean {
  const leftValue = left[field];
  const rightValue = right[field];
  if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
    return Array.isArray(leftValue)
      && Array.isArray(rightValue)
      && leftValue.length === rightValue.length
      && leftValue.every((value, index) => Math.abs(value - rightValue[index]) <= 1e-9);
  }
  return leftValue === rightValue;
}

function validateCameraAcquireOptions(options: RuntimeInspectorCameraAcquireOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera acquire options must be an object');
  }
  const unknown = Object.keys(options).filter(key => !['owner', 'reason', 'timeoutMs'].includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported camera acquire fields: ${unknown.join(', ')}`);
  }
  if (options.owner !== undefined && (typeof options.owner !== 'string' || !options.owner.trim())) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera lease owner must be a non-empty string');
  }
  if (options.reason !== undefined && typeof options.reason !== 'string') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera lease reason must be a string');
  }
  if (
    options.timeoutMs !== undefined
    && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 300_000)
  ) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera lease timeoutMs must be an integer between 1000 and 300000');
  }
}

function validateCameraPatchSpec(spec: RuntimeInspectorCameraPatchSpec): void {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera patch spec must be an object');
  }
  const unknown = Object.keys(spec).filter(key => !['mode', 'handles', 'opacity'].includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported camera patch fields: ${unknown.join(', ')}`);
  }
  if (!['hide', 'ghost', 'isolate'].includes(spec.mode)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera patch mode must be hide, ghost, or isolate');
  }
  if (spec.opacity !== undefined && (!Number.isFinite(spec.opacity) || spec.opacity < 0 || spec.opacity > 1)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera patch opacity must be between 0 and 1');
  }
  if (spec.mode !== 'ghost' && spec.opacity !== undefined) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera patch opacity is only valid for ghost mode');
  }
}

function validateCameraViewSpec(spec: RuntimeInspectorCameraViewSpec): RuntimeInspectorCameraViewSpec {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera view spec must be an object');
  }
  if (spec.kind === 'pose') {
    const unknown = Object.keys(spec).filter(key => !['kind', 'position', 'target', 'up'].includes(key));
    if (unknown.length > 0) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported camera pose fields: ${unknown.join(', ')}`);
    }
    validateFiniteVector3(spec.position, 'camera pose position');
    validateFiniteVector3(spec.target, 'camera pose target');
    if (spec.up !== undefined) validateFiniteVector3(spec.up, 'camera pose up');
    if (spec.up && Vector3.FromArray(spec.up).lengthSquared() < 1e-10) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera pose up vector must be non-zero');
    }
    return spec;
  }
  if (spec.kind === 'orbit') {
    const unknown = Object.keys(spec).filter(key => !['kind', 'reference', 'referenceHandle', 'azimuthDeg', 'elevationDeg', 'distance', 'margin'].includes(key));
    if (unknown.length > 0) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported camera orbit fields: ${unknown.join(', ')}`);
    }
    if (!['world', 'target-local', 'semantic-frame'].includes(spec.reference)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbit reference must be world, target-local, or semantic-frame');
    }
    if (spec.reference === 'world' && spec.referenceHandle !== undefined) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbit referenceHandle is not valid for world reference');
    }
    if (spec.referenceHandle !== undefined && (!spec.referenceHandle || typeof spec.referenceHandle !== 'object' || Array.isArray(spec.referenceHandle))) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbit referenceHandle must be an object handle');
    }
    if (!Number.isFinite(spec.azimuthDeg)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbit azimuthDeg must be finite');
    }
    if (!Number.isFinite(spec.elevationDeg) || spec.elevationDeg < -89 || spec.elevationDeg > 89) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbit elevationDeg must be between -89 and 89');
    }
    if (spec.distance !== undefined && (!Number.isFinite(spec.distance) || spec.distance <= 0)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbit distance must be finite and greater than zero');
    }
    if (spec.margin !== undefined && (!Number.isFinite(spec.margin) || spec.margin < 1 || spec.margin > 10)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbit margin must be between 1 and 10');
    }
    return spec;
  }
  throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera view kind must be pose or orbit');
}

function validateCameraAdjustSpec(spec: RuntimeInspectorCameraAdjustSpec): RuntimeInspectorCameraAdjustSpec {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera adjust spec must be an object');
  }
  const unknown = Object.keys(spec).filter(key => !['orbitDeltaDeg', 'panWorld', 'dollyFactor'].includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported camera adjust fields: ${unknown.join(', ')}`);
  }
  if (spec.orbitDeltaDeg === undefined && spec.panWorld === undefined && spec.dollyFactor === undefined) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera adjust requires orbitDeltaDeg, panWorld, or dollyFactor');
  }
  if (spec.orbitDeltaDeg !== undefined) {
    const delta = spec.orbitDeltaDeg;
    if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbitDeltaDeg must be an object');
    }
    const deltaUnknown = Object.keys(delta).filter(key => !['azimuth', 'elevation'].includes(key));
    if (deltaUnknown.length > 0 || !Number.isFinite(delta.azimuth) || !Number.isFinite(delta.elevation)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbitDeltaDeg requires finite azimuth and elevation');
    }
    if (Math.abs(delta.azimuth) > 360 || Math.abs(delta.elevation) > 360) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera orbitDeltaDeg components must be between -360 and 360');
    }
  }
  if (spec.panWorld !== undefined) validateFiniteVector3(spec.panWorld, 'camera panWorld');
  if (spec.dollyFactor !== undefined && (!Number.isFinite(spec.dollyFactor) || spec.dollyFactor < 0.1 || spec.dollyFactor > 10)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera dollyFactor must be between 0.1 and 10');
  }
  return spec;
}

function validateCameraOcclusionOptions(
  options: RuntimeInspectorCameraOcclusionOptions,
): RuntimeInspectorCameraOcclusionOptions {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera occlusion options must be an object');
  }
  const unknown = Object.keys(options).filter(key => key !== 'gridSize');
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported camera occlusion fields: ${unknown.join(', ')}`);
  }
  if (
    options.gridSize !== undefined
    && (!Number.isInteger(options.gridSize) || options.gridSize < 3 || options.gridSize > 9 || options.gridSize % 2 === 0)
  ) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera occlusion gridSize must be an odd integer from 3 to 9');
  }
  return options;
}

function validateCameraVisualOcclusionOptions(
  options: RuntimeInspectorCameraVisualOcclusionOptions,
): RuntimeInspectorCameraVisualOcclusionOptions {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera visual occlusion options must be an object');
  }
  const unknown = Object.keys(options).filter(key => !['gridSize', 'depthEpsilon'].includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported camera visual occlusion fields: ${unknown.join(', ')}`);
  }
  if (
    options.gridSize !== undefined
    && (!Number.isInteger(options.gridSize) || options.gridSize < 3 || options.gridSize > 9 || options.gridSize % 2 === 0)
  ) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera visual occlusion gridSize must be an odd integer from 3 to 9');
  }
  if (
    options.depthEpsilon !== undefined
    && (!Number.isFinite(options.depthEpsilon) || options.depthEpsilon < 1e-8 || options.depthEpsilon > 1e-2)
  ) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'camera visual occlusion depthEpsilon must be between 1e-8 and 1e-2');
  }
  return options;
}

function validateSpatialQuerySpec(spec: RuntimeInspectorSpatialQuerySpec): RuntimeInspectorSpatialQuerySpec {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial query spec must be an object');
  }
  const common = ['kind', 'includeHidden', 'includeDisabled', 'limit'];
  const allowed = spec.kind === 'sphere'
    ? [...common, 'center', 'radius', 'relation']
    : spec.kind === 'aabb'
      ? [...common, 'minimum', 'maximum', 'relation']
      : spec.kind === 'ray'
        ? [...common, 'origin', 'direction', 'length']
        : common;
  const unknown = Object.keys(spec).filter(key => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported spatial query fields: ${unknown.join(', ')}`);
  }
  if (!['sphere', 'aabb', 'ray'].includes(spec.kind)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial query kind must be sphere, aabb, or ray');
  }
  if (spec.includeHidden !== undefined && typeof spec.includeHidden !== 'boolean') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial query includeHidden must be boolean');
  }
  if (spec.includeDisabled !== undefined && typeof spec.includeDisabled !== 'boolean') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial query includeDisabled must be boolean');
  }
  if (spec.limit !== undefined && (!Number.isInteger(spec.limit) || spec.limit < 1 || spec.limit > 200)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial query limit must be an integer from 1 to 200');
  }
  if (spec.kind === 'sphere') {
    validateFiniteVector3(spec.center, 'spatial sphere center');
    if (!Number.isFinite(spec.radius) || spec.radius <= 0 || spec.radius > 1e6) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial sphere radius must be finite and in (0, 1e6]');
    }
    if (spec.relation !== undefined && !['intersects', 'center-inside'].includes(spec.relation)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial sphere relation must be intersects or center-inside');
    }
  } else if (spec.kind === 'aabb') {
    validateFiniteVector3(spec.minimum, 'spatial aabb minimum');
    validateFiniteVector3(spec.maximum, 'spatial aabb maximum');
    if (spec.minimum.some((value, index) => value > spec.maximum[index])) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial aabb minimum must not exceed maximum');
    }
    if (spec.relation !== undefined && !['intersects', 'contained'].includes(spec.relation)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial aabb relation must be intersects or contained');
    }
  } else {
    validateFiniteVector3(spec.origin, 'spatial ray origin');
    validateFiniteVector3(spec.direction, 'spatial ray direction');
    if (Vector3.FromArray(spec.direction).lengthSquared() < 1e-12) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial ray direction must be non-zero');
    }
    if (!Number.isFinite(spec.length) || spec.length <= 0 || spec.length > 1e6) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'spatial ray length must be finite and in (0, 1e6]');
    }
  }
  return spec;
}

function validateFiniteVector3(value: unknown, label: string): asserts value is [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || value.some(component => !Number.isFinite(component))) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `${label} must be a finite [x, y, z] tuple`);
  }
}

function normalizeCameraHandles(
  handlesOrHandle: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
): RuntimeInspectorObjectHandle[] {
  const requestedHandles = Array.isArray(handlesOrHandle) ? handlesOrHandle : [handlesOrHandle];
  if (requestedHandles.length < 1 || requestedHandles.length > 100) {
    throw new RuntimeInspectorCommandError('INVALID_HANDLE', 'camera operation requires 1 to 100 handles');
  }
  return requestedHandles;
}

function scaleOrthographicCamera(
  camera: ArcRotateCamera,
  scene: Scene,
  factor: number,
): void {
  const engine = scene.getEngine();
  const halfRenderWidth = Math.max(1, engine.getRenderWidth()) / 2;
  const halfRenderHeight = Math.max(1, engine.getRenderHeight()) / 2;
  const left = camera.orthoLeft ?? -halfRenderWidth;
  const right = camera.orthoRight ?? halfRenderWidth;
  const top = camera.orthoTop ?? halfRenderHeight;
  const bottom = camera.orthoBottom ?? -halfRenderHeight;
  const centerX = (left + right) / 2;
  const centerY = (top + bottom) / 2;

  camera.orthoLeft = centerX + ((left - centerX) * factor);
  camera.orthoRight = centerX + ((right - centerX) * factor);
  camera.orthoTop = centerY + ((top - centerY) * factor);
  camera.orthoBottom = centerY + ((bottom - centerY) * factor);
}

function readCameraSnapshot(camera: ArcRotateCamera): RuntimeInspectorCameraSnapshot {
  camera.getViewMatrix(true);
  return {
    name: String(camera.name ?? ''),
    uniqueId: String(camera.uniqueId),
    projection: camera.mode === Camera.ORTHOGRAPHIC_CAMERA ? 'orthographic' : 'perspective',
    mode: camera.mode,
    position: vector3(camera.position) ?? [0, 0, 0],
    target: vector3(camera.target) ?? [0, 0, 0],
    up: vector3(camera.upVector) ?? [0, 1, 0],
    alpha: roundNumber(normalizeRadians(camera.alpha)),
    beta: roundNumber(camera.beta),
    radius: roundNumber(camera.radius),
    fov: roundNumber(camera.fov),
    minZ: roundNumber(camera.minZ),
    maxZ: roundNumber(camera.maxZ),
    orthoLeft: nullableNumber(camera.orthoLeft),
    orthoRight: nullableNumber(camera.orthoRight),
    orthoTop: nullableNumber(camera.orthoTop),
    orthoBottom: nullableNumber(camera.orthoBottom),
    lowerAlphaLimit: nullableNumber(camera.lowerAlphaLimit),
    upperAlphaLimit: nullableNumber(camera.upperAlphaLimit),
    lowerBetaLimit: nullableNumber(camera.lowerBetaLimit),
    upperBetaLimit: nullableNumber(camera.upperBetaLimit),
    lowerRadiusLimit: nullableNumber(camera.lowerRadiusLimit),
    upperRadiusLimit: nullableNumber(camera.upperRadiusLimit),
  };
}

function applyCameraSnapshot(camera: ArcRotateCamera, snapshot: RuntimeInspectorCameraSnapshot): void {
  camera.mode = snapshot.mode;
  camera.upVector.copyFromFloats(...snapshot.up);
  camera.alpha = snapshot.alpha;
  camera.beta = snapshot.beta;
  camera.radius = snapshot.radius;
  camera.fov = snapshot.fov;
  camera.minZ = snapshot.minZ;
  camera.maxZ = snapshot.maxZ;
  camera.orthoLeft = snapshot.orthoLeft;
  camera.orthoRight = snapshot.orthoRight;
  camera.orthoTop = snapshot.orthoTop;
  camera.orthoBottom = snapshot.orthoBottom;
  camera.target.copyFromFloats(...snapshot.target);
  camera.position.copyFromFloats(...snapshot.position);
  camera.lowerAlphaLimit = snapshot.lowerAlphaLimit;
  camera.upperAlphaLimit = snapshot.upperAlphaLimit;
  camera.lowerBetaLimit = snapshot.lowerBetaLimit;
  camera.upperBetaLimit = snapshot.upperBetaLimit;
  camera.lowerRadiusLimit = snapshot.lowerRadiusLimit;
  camera.upperRadiusLimit = snapshot.upperRadiusLimit;
  camera.getViewMatrix(true);
  camera.getProjectionMatrix(true);
}

function compareCameraSnapshots(
  expected: RuntimeInspectorCameraSnapshot,
  actual: RuntimeInspectorCameraSnapshot,
): string[] {
  const differences: string[] = [];
  for (const key of ['uniqueId', 'projection', 'mode'] as const) {
    if (expected[key] !== actual[key]) differences.push(`camera.${key}`);
  }
  for (const key of ['alpha', 'beta', 'radius', 'fov', 'minZ', 'maxZ', 'orthoLeft', 'orthoRight', 'orthoTop', 'orthoBottom', 'lowerAlphaLimit', 'upperAlphaLimit', 'lowerBetaLimit', 'upperBetaLimit', 'lowerRadiusLimit', 'upperRadiusLimit'] as const) {
    if (!numbersEqual(expected[key], actual[key])) differences.push(`camera.${key}`);
  }
  for (const key of ['position', 'target', 'up'] as const) {
    if (expected[key].some((value, index) => !numbersEqual(value, actual[key][index]))) {
      differences.push(`camera.${key}`);
    }
  }
  return differences;
}

function clearCameraControlLimits(camera: ArcRotateCamera): void {
  camera.lowerAlphaLimit = null;
  camera.upperAlphaLimit = null;
  camera.lowerBetaLimit = null;
  camera.upperBetaLimit = null;
  camera.lowerRadiusLimit = null;
  camera.upperRadiusLimit = null;
}

function readAutoCameraDistance(
  camera: ArcRotateCamera,
  radiusWorld: number,
  margin: number,
  aspect: number,
): number {
  const verticalHalfFov = Math.max(0.01, camera.fov / 2);
  const effectiveHalfFov = aspect >= 1
    ? verticalHalfFov
    : Math.atan(Math.tan(verticalHalfFov) * aspect);
  return (radiusWorld * margin) / Math.max(0.01, Math.sin(effectiveHalfFov));
}

function applyOrthographicCameraFraming(
  camera: ArcRotateCamera,
  radiusWorld: number,
  margin: number,
  aspect: number,
): void {
  const halfHeight = (radiusWorld * margin) / Math.min(1, aspect);
  const halfWidth = halfHeight * aspect;
  camera.orthoTop = halfHeight;
  camera.orthoBottom = -halfHeight;
  camera.orthoLeft = -halfWidth;
  camera.orthoRight = halfWidth;
}

function normalizeDegrees(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return numbersEqual(normalized, -180) ? 180 : roundNumber(normalized);
}

function normalizeRadians(value: number): number {
  const fullTurn = Math.PI * 2;
  const normalized = ((value % fullTurn) + fullTurn) % fullTurn;
  return numbersEqual(normalized, fullTurn) ? 0 : normalized;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function aggregateBoundsFromMinimumMaximum(
  minimum: Vector3,
  maximum: Vector3,
): RuntimeInspectorCameraFocusResult['aggregateBounds'] {
  const center = Vector3.Center(minimum, maximum);
  return {
    minimumWorld: vector3(minimum)!,
    maximumWorld: vector3(maximum)!,
    centerWorld: vector3(center)!,
    radiusWorld: roundNumber(Math.max(0.05, Vector3.Distance(minimum, maximum) / 2)),
  };
}

function distancePointToAabb(point: Vector3, minimum: Vector3, maximum: Vector3): number {
  const closest = new Vector3(
    clamp(point.x, minimum.x, maximum.x),
    clamp(point.y, minimum.y, maximum.y),
    clamp(point.z, minimum.z, maximum.z),
  );
  return Vector3.Distance(point, closest);
}

function aabbIntersects(leftMinimum: Vector3, leftMaximum: Vector3, rightMinimum: Vector3, rightMaximum: Vector3): boolean {
  return leftMinimum.x <= rightMaximum.x && leftMaximum.x >= rightMinimum.x
    && leftMinimum.y <= rightMaximum.y && leftMaximum.y >= rightMinimum.y
    && leftMinimum.z <= rightMaximum.z && leftMaximum.z >= rightMinimum.z;
}

function aabbContains(outerMinimum: Vector3, outerMaximum: Vector3, innerMinimum: Vector3, innerMaximum: Vector3): boolean {
  return innerMinimum.x >= outerMinimum.x && innerMaximum.x <= outerMaximum.x
    && innerMinimum.y >= outerMinimum.y && innerMaximum.y <= outerMaximum.y
    && innerMinimum.z >= outerMinimum.z && innerMaximum.z <= outerMaximum.z;
}

function readAggregateBounds(
  scene: Scene,
  targetNodes: BabylonRuntimeNode[],
): RuntimeInspectorCameraFocusResult['aggregateBounds'] {
  const targets = new Set(targetNodes);
  const candidates = listBabylonRuntimeNodes(scene).filter(node => {
    if (targets.has(node)) return true;
    let current = isRuntimeNode(node.parent) ? node.parent : null;
    let guard = 0;
    while (current && guard < 64) {
      if (targets.has(current)) return true;
      current = isRuntimeNode(current.parent) ? current.parent : null;
      guard += 1;
    }
    return false;
  });
  let minimum: Vector3 | null = null;
  let maximum: Vector3 | null = null;
  for (const node of candidates) {
    const bounds = readBabylonBoundingBox(node);
    if (!bounds) continue;
    const nodeMinimum = Vector3.FromArray(bounds.minimumWorld);
    const nodeMaximum = Vector3.FromArray(bounds.maximumWorld);
    minimum = minimum ? Vector3.Minimize(minimum, nodeMinimum) : nodeMinimum;
    maximum = maximum ? Vector3.Maximize(maximum, nodeMaximum) : nodeMaximum;
  }
  if (!minimum || !maximum) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', 'focus targets and descendants have no world bounding boxes');
  }
  const center = Vector3.Center(minimum, maximum);
  const radiusWorld = Math.max(0.05, Vector3.Distance(minimum, maximum) / 2);
  return {
    minimumWorld: vector3(minimum)!,
    maximumWorld: vector3(maximum)!,
    centerWorld: vector3(center)!,
    radiusWorld: roundNumber(radiusWorld),
  };
}

function readRequiredMetadataValue(metadata: unknown, path: string[], label: string): unknown {
  const result = readOwnMetadataPath(metadata, path);
  if (result.failed) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} could not be read safely`);
  }
  if (!result.found) throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} is missing`);
  return result.value;
}

function readOptionalMetadataValue(metadata: unknown, path: string[]): unknown | undefined {
  const result = readOwnMetadataPath(metadata, path);
  if (result.failed) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `${path.join('.')} could not be read safely`);
  }
  return result.found ? result.value : undefined;
}

function readRequiredMetadataString(metadata: unknown, path: string[], label: string): string {
  const value = readRequiredMetadataValue(metadata, path, label);
  if (typeof value !== 'string') throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} must be a string`);
  return value;
}

function readOptionalMetadataString(metadata: unknown, path: string[], label: string): string | null {
  const value = readOptionalMetadataValue(metadata, path);
  if (value === undefined) return null;
  if (typeof value !== 'string') throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} must be a string`);
  return value;
}

function readOptionalMetadataVector3(metadata: unknown, path: string[], label: string): Vector3 | null {
  const value = readOptionalMetadataValue(metadata, path);
  return value === undefined ? null : readOwnVector3Value(value, label);
}

function readOwnVector3Value(value: unknown, label: string): Vector3 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} must be an x/y/z object`);
  }
  const components = ['x', 'y', 'z'].map(component => {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, component);
    } catch {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label}.${component} could not be read safely`);
    }
    if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor) || typeof descriptor.value !== 'number' || !Number.isFinite(descriptor.value)) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label}.${component} must be a finite number`);
    }
    return descriptor.value;
  });
  return new Vector3(components[0], components[1], components[2]);
}

function readMetadataArray(value: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(value)) throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} must be an array`);
  let length: number;
  try {
    length = value.length;
  } catch {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label}.length could not be read safely`);
  }
  if (!Number.isInteger(length) || length < 0 || length > maximum) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} must contain at most ${maximum} items`);
  }
  return Array.from({ length }, (_, index) => {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label}[${index}] could not be read safely`);
    }
    if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor)) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label}[${index}] must be a data property`);
    }
    return descriptor.value;
  });
}

function readMetadataVectorArray(value: unknown, label: string, maximum: number): Vector3[] {
  return readMetadataArray(value, label, maximum).map((entry, index) => (
    readOwnVector3Value(entry, `${label}[${index}]`)
  ));
}

function readMetadataFaceArray(value: unknown, vertexCount: number, maximum: number): number[][] {
  return readMetadataArray(value, 'sceneMarker.geometry.faces', maximum).map((face, faceIndex) => (
    readMetadataArray(face, `sceneMarker.geometry.faces[${faceIndex}]`, maximum).map((entry, index) => {
      if (!Number.isInteger(entry) || (entry as number) < 0 || (entry as number) >= vertexCount) {
        throw new RuntimeInspectorCommandError(
          'UNAVAILABLE',
          `sceneMarker.geometry.faces[${faceIndex}][${index}] must index an existing vertex`,
        );
      }
      return entry as number;
    })
  ));
}

function buildOrientedBoxCorners(
  center: [number, number, number],
  size: [number, number, number],
  axes: Pick<RuntimeInspectorCameraViewResult['referenceFrame'], 'xAxis' | 'yAxis' | 'zAxis'>,
): Array<[number, number, number]> {
  const origin = Vector3.FromArray(center);
  const xAxis = Vector3.FromArray(axes.xAxis).scale(size[0] / 2);
  const yAxis = Vector3.FromArray(axes.yAxis).scale(size[1] / 2);
  const zAxis = Vector3.FromArray(axes.zAxis).scale(size[2] / 2);
  const corners: Array<[number, number, number]> = [];
  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        corners.push(vector3(origin
          .add(xAxis.scale(xSign))
          .add(yAxis.scale(ySign))
          .add(zAxis.scale(zSign)))!);
      }
    }
  }
  return corners;
}

function resolveCameraReferenceFrame(
  reference: Extract<RuntimeInspectorCameraViewSpec, { kind: 'orbit' }>['reference'],
  targetNodes: BabylonRuntimeNode[],
  explicitReferenceNode: BabylonRuntimeNode | null,
  makeSourceHandle: (node: BabylonRuntimeNode) => RuntimeInspectorObjectHandle,
): RuntimeInspectorCameraViewResult['referenceFrame'] {
  if (reference === 'world') {
    return {
      reference,
      origin: [0, 0, 0],
      xAxis: [1, 0, 0],
      yAxis: [0, 1, 0],
      zAxis: [0, 0, 1],
      source: null,
    };
  }
  if (reference === 'target-local') {
    if (!explicitReferenceNode && targetNodes.length !== 1) {
      throw new RuntimeInspectorCommandError(
        'UNAVAILABLE',
        'target-local camera reference requires exactly one target handle; no world-frame fallback was applied',
      );
    }
    const node = explicitReferenceNode ?? targetNodes[0];
    const origin = readBabylonAbsolutePosition(node);
    if (!origin) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'target-local camera reference origin is unavailable');
    }
    try {
      node.computeWorldMatrix(true);
      const world = node.getWorldMatrix();
      const axes = normalizeCameraReferenceAxes(
        Vector3.TransformNormal(Vector3.Right(), world),
        Vector3.TransformNormal(Vector3.Up(), world),
        Vector3.TransformNormal(Vector3.Forward(), world),
        'target-local',
      );
      return {
        reference,
        origin,
        ...axes,
        source: makeSourceHandle(node),
      };
    } catch (error) {
      if (error instanceof RuntimeInspectorCommandError) throw error;
      throw new RuntimeInspectorCommandError(
        'UNAVAILABLE',
        `target-local camera reference could not be resolved: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const candidates: Array<{
    node: BabylonRuntimeNode;
    origin: Vector3;
    right: Vector3;
    up: Vector3;
    forward: Vector3;
  }> = [];
  for (const node of explicitReferenceNode ? [explicitReferenceNode] : targetNodes) {
    const frame = readOwnMetadataPath(node.metadata, ['sceneMarker', 'semanticFrame']);
    if (frame.failed) {
      throw new RuntimeInspectorCommandError(
        'UNAVAILABLE',
        'semantic-frame metadata could not be read without executing an accessor or unsafe object trap',
      );
    }
    if (!frame.found) continue;
    candidates.push({
      node,
      origin: readSemanticFrameVector(node.metadata, 'origin'),
      right: readSemanticFrameVector(node.metadata, 'right'),
      up: readSemanticFrameVector(node.metadata, 'up'),
      forward: readSemanticFrameVector(node.metadata, 'forward'),
    });
  }
  if (candidates.length !== 1) {
    throw new RuntimeInspectorCommandError(
      'UNAVAILABLE',
      candidates.length === 0
        ? 'semantic-frame camera reference requires one target handle with explicit sceneMarker.semanticFrame metadata; no world-frame fallback was applied'
        : `semantic-frame camera reference is ambiguous: ${candidates.length} target handles provide sceneMarker.semanticFrame metadata`,
    );
  }
  const candidate = candidates[0];
  const axes = normalizeCameraReferenceAxes(candidate.right, candidate.up, candidate.forward, 'semantic-frame');
  return {
    reference,
    origin: vector3(candidate.origin)!,
    ...axes,
    source: makeSourceHandle(candidate.node),
  };
}

function readSemanticFrameVector(metadata: unknown, field: 'origin' | 'right' | 'up' | 'forward'): Vector3 {
  const values = ['x', 'y', 'z'].map(component => (
    readOwnMetadataPath(metadata, ['sceneMarker', 'semanticFrame', field, component])
  ));
  if (values.some(value => value.failed)) {
    throw new RuntimeInspectorCommandError(
      'UNAVAILABLE',
      `semantic-frame ${field} could not be read without executing an accessor or unsafe object trap`,
    );
  }
  if (values.some(value => !value.found || typeof value.value !== 'number' || !Number.isFinite(value.value))) {
    throw new RuntimeInspectorCommandError(
      'UNAVAILABLE',
      `semantic-frame ${field} must contain finite x/y/z numbers`,
    );
  }
  return new Vector3(values[0].value as number, values[1].value as number, values[2].value as number);
}

function normalizeCameraReferenceAxes(
  rawXAxis: Vector3,
  rawYAxis: Vector3,
  rawZAxis: Vector3,
  label: string,
): Pick<RuntimeInspectorCameraViewResult['referenceFrame'], 'xAxis' | 'yAxis' | 'zAxis'> {
  if ([rawXAxis, rawYAxis, rawZAxis].some(axis => axis.lengthSquared() < 1e-10)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} camera reference contains a zero-length axis`);
  }
  const xAxis = rawXAxis.normalize();
  const yAxis = rawYAxis.normalize();
  const zAxis = rawZAxis.normalize();
  const maximumDot = Math.max(
    Math.abs(Vector3.Dot(xAxis, yAxis)),
    Math.abs(Vector3.Dot(xAxis, zAxis)),
    Math.abs(Vector3.Dot(yAxis, zAxis)),
  );
  const volume = Math.abs(Vector3.Dot(Vector3.Cross(xAxis, yAxis), zAxis));
  if (maximumDot > 0.01 || volume < 0.99) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} camera reference axes must be orthogonal`);
  }
  return {
    xAxis: vector3(xAxis)!,
    yAxis: vector3(yAxis)!,
    zAxis: vector3(zAxis)!,
  };
}

function expandRuntimeMeshes(
  scene: Scene,
  targetNodes: BabylonRuntimeNode[],
): BabylonRuntimeNode[] {
  const targets = new Set(targetNodes);
  return listBabylonRuntimeNodes(scene).filter(node => (
    isBabylonMeshNode(node) && isNodeWithinTargets(node, targets)
  ));
}

function isNodeWithinTargets(
  node: BabylonRuntimeNode,
  targets: Set<BabylonRuntimeNode>,
): boolean {
  if (targets.has(node)) return true;
  let current = isRuntimeNode(node.parent) ? node.parent : null;
  let guard = 0;
  while (current && guard < 64) {
    if (targets.has(current)) return true;
    current = isRuntimeNode(current.parent) ? current.parent : null;
    guard += 1;
  }
  return false;
}

function buildOcclusionScreenGrid(
  coverage: RuntimeInspectorCameraFocusResult['screenCoverage'],
  gridSize: number,
): {
  columns: number;
  rows: number;
  boundsPx: { left: number; top: number; right: number; bottom: number };
  samples: Array<{ x: number; y: number }>;
} {
  const viewport = coverage.viewportPx;
  const left = Math.max(viewport.x, coverage.boundsPx.left);
  const top = Math.max(viewport.y, coverage.boundsPx.top);
  const right = Math.min(viewport.x + viewport.width, coverage.boundsPx.right);
  const bottom = Math.min(viewport.y + viewport.height, coverage.boundsPx.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width <= 1e-4 || height <= 1e-4) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', 'target screen bounds do not overlap the active camera viewport');
  }
  const aspect = width / height;
  const columns = aspect >= 1 ? gridSize : adaptiveOddGridCount(gridSize, aspect);
  const rows = aspect >= 1 ? adaptiveOddGridCount(gridSize, 1 / aspect) : gridSize;
  const samples: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    const y = top + ((row + 0.5) / rows) * height;
    for (let column = 0; column < columns; column += 1) {
      const x = left + ((column + 0.5) / columns) * width;
      samples.push({ x, y });
    }
  }
  return {
    columns,
    rows,
    boundsPx: {
      left: roundNumber(left),
      top: roundNumber(top),
      right: roundNumber(right),
      bottom: roundNumber(bottom),
    },
    samples,
  };
}

function adaptiveOddGridCount(maximum: number, shortToLongRatio: number): number {
  const approximate = Math.max(3, Math.round(maximum * Math.min(1, shortToLongRatio)));
  const odd = approximate % 2 === 0 ? approximate + 1 : approximate;
  return Math.min(maximum, odd);
}

async function renderTransientDepthMap(
  scene: Scene,
  renderer: DepthRenderer,
  depthMap: ReturnType<DepthRenderer['getDepthMap']>,
  readinessMeshes: AbstractMesh[],
  timeoutMs: number,
  label: string,
): Promise<void> {
  let ready = false;
  const observer = depthMap.onBeforeRenderObservable.add(() => {
    ready = readinessMeshes.every(mesh => (
      (mesh.subMeshes ?? []).every(subMesh => renderer.isReady(subMesh, false))
    ));
  });
  const deadline = Date.now() + timeoutMs;
  try {
    while (Date.now() < deadline) {
      scene.incrementRenderId();
      depthMap.render(false, false);
      if (ready) {
        await new Promise(resolve => window.setTimeout(resolve, 16));
        scene.incrementRenderId();
        depthMap.render(false, false);
        return;
      }
      await new Promise(resolve => window.setTimeout(resolve, 16));
    }
  } finally {
    depthMap.onBeforeRenderObservable.remove(observer);
  }
  throw new RuntimeInspectorCommandError('UNAVAILABLE', `GPU ${label} depth shaders did not become ready before timeout`);
}

function disposeTransientDepthRenderer(renderer: DepthRenderer): void {
  const depthMap = renderer.getDepthMap();
  depthMap.dispose();
  renderer.dispose();
}

function analyzeDepthGrid(
  samples: Array<{ x: number; y: number }>,
  targetPixels: ArrayBufferView,
  scenePixels: ArrayBufferView,
  width: number,
  height: number,
  depthEpsilon: number,
  invertY: boolean,
): { validTargetSampleCount: number; blockedSampleCount: number; targetMissSampleCount: number } {
  const targetBytes = new Uint8Array(targetPixels.buffer, targetPixels.byteOffset, targetPixels.byteLength);
  const sceneBytes = new Uint8Array(scenePixels.buffer, scenePixels.byteOffset, scenePixels.byteLength);
  let validTargetSampleCount = 0;
  let blockedSampleCount = 0;
  let targetMissSampleCount = 0;
  for (const sample of samples) {
    const x = Math.max(0, Math.min(width - 1, Math.floor(sample.x)));
    const screenY = Math.max(0, Math.min(height - 1, Math.floor(sample.y)));
    const y = invertY ? height - 1 - screenY : screenY;
    const byteIndex = (y * width + x) * 4;
    const targetDepth = decodePackedDepth(targetBytes, byteIndex);
    if (!Number.isFinite(targetDepth) || targetDepth >= 0.999999) {
      targetMissSampleCount += 1;
      continue;
    }
    validTargetSampleCount += 1;
    const sceneDepth = decodePackedDepth(sceneBytes, byteIndex);
    if (Number.isFinite(sceneDepth) && sceneDepth + depthEpsilon < targetDepth) {
      blockedSampleCount += 1;
    }
  }
  return { validTargetSampleCount, blockedSampleCount, targetMissSampleCount };
}

function matchCandidateDepthSamples(
  samples: Array<{ x: number; y: number }>,
  targetBytes: Uint8Array,
  sceneBytes: Uint8Array,
  candidateBytes: Uint8Array,
  width: number,
  height: number,
  depthEpsilon: number,
  invertY: boolean,
): number[] {
  const matched: number[] = [];
  const matchEpsilon = Math.max(depthEpsilon * 4, 1e-6);
  samples.forEach((sample, sampleIndex) => {
    const x = Math.max(0, Math.min(width - 1, Math.floor(sample.x)));
    const screenY = Math.max(0, Math.min(height - 1, Math.floor(sample.y)));
    const y = invertY ? height - 1 - screenY : screenY;
    const byteIndex = (y * width + x) * 4;
    const targetDepth = decodePackedDepth(targetBytes, byteIndex);
    const sceneDepth = decodePackedDepth(sceneBytes, byteIndex);
    if (!Number.isFinite(targetDepth) || targetDepth >= 0.999999) return;
    if (!Number.isFinite(sceneDepth) || sceneDepth + depthEpsilon >= targetDepth) return;
    const candidateDepth = decodePackedDepth(candidateBytes, byteIndex);
    if (Number.isFinite(candidateDepth) && Math.abs(candidateDepth - sceneDepth) <= matchEpsilon) {
      matched.push(sampleIndex);
    }
  });
  return matched;
}

function decodePackedDepth(bytes: Uint8Array, byteIndex: number): number {
  const red = bytes[byteIndex] / 255;
  const green = bytes[byteIndex + 1] / 255;
  const blue = bytes[byteIndex + 2] / 255;
  const alpha = bytes[byteIndex + 3] / 255;
  return red / (255 * 255 * 255) + green / (255 * 255) + blue / 255 + alpha;
}

function projectBoundsToScreen(
  camera: ArcRotateCamera,
  scene: Scene,
  bounds: RuntimeInspectorCameraFocusResult['aggregateBounds'],
): RuntimeInspectorCameraFocusResult['screenCoverage'] {
  const engine = scene.getEngine();
  const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const minimum = bounds.minimumWorld;
  const maximum = bounds.maximumWorld;
  const corners: Vector3[] = [];
  for (const x of [minimum[0], maximum[0]]) {
    for (const y of [minimum[1], maximum[1]]) {
      for (const z of [minimum[2], maximum[2]]) corners.push(new Vector3(x, y, z));
    }
  }
  const transform = camera.getViewMatrix(true).multiply(camera.getProjectionMatrix(true));
  const projected = corners.map(corner => Vector3.Project(corner, Matrix.Identity(), transform, viewport));
  const left = Math.min(...projected.map(point => point.x));
  const right = Math.max(...projected.map(point => point.x));
  const top = Math.min(...projected.map(point => point.y));
  const bottom = Math.max(...projected.map(point => point.y));
  return {
    viewportPx: {
      x: roundNumber(viewport.x),
      y: roundNumber(viewport.y),
      width: roundNumber(viewport.width),
      height: roundNumber(viewport.height),
    },
    boundsPx: {
      left: roundNumber(left),
      top: roundNumber(top),
      right: roundNumber(right),
      bottom: roundNumber(bottom),
    },
    widthRatio: roundNumber((right - left) / Math.max(1, viewport.width)),
    heightRatio: roundNumber((bottom - top) / Math.max(1, viewport.height)),
    allCornersInside: projected.every(point => (
      point.x >= viewport.x
      && point.x <= viewport.x + viewport.width
      && point.y >= viewport.y
      && point.y <= viewport.y + viewport.height
      && point.z >= 0
      && point.z <= 1
    )),
  };
}

function validateQuerySpec(spec: RuntimeInspectorQuerySpec): void {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'query spec must be an object', spec);
  }
  const allowed = new Set(['kind', 'engineId', 'name', 'enabled', 'visible', 'metadata', 'limit']);
  const unknown = Object.keys(spec).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported query fields: ${unknown.join(', ')}`, unknown);
  }
  if (spec.limit !== undefined && (!Number.isInteger(spec.limit) || spec.limit < 1 || spec.limit > 500)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'limit must be an integer between 1 and 500', spec.limit);
  }
  const validKinds = new Set(['transformNode', 'mesh', 'instancedMesh']);
  const kinds = spec.kind === undefined ? [] : Array.isArray(spec.kind) ? spec.kind : [spec.kind];
  if (Array.isArray(spec.kind) && spec.kind.length === 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'logical query kind array must not be empty', spec.kind);
  }
  if (kinds.some(kind => !validKinds.has(kind))) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'kind contains an unsupported value', spec.kind);
  }
  if (spec.engineId !== undefined && typeof spec.engineId !== 'string') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'engineId must be a string', spec.engineId);
  }
  if (spec.enabled !== undefined && typeof spec.enabled !== 'boolean') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'enabled must be boolean', spec.enabled);
  }
  if (spec.visible !== undefined && typeof spec.visible !== 'boolean') {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'visible must be boolean', spec.visible);
  }
  validateMetadataPredicates(spec.metadata);
  if (spec.name) {
    if (typeof spec.name !== 'object' || Array.isArray(spec.name)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'name must be an object', spec.name);
    }
    const modes = [spec.name.exact, spec.name.contains, spec.name.regex].filter(value => value !== undefined);
    if (modes.length > 1) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'name accepts only one of exact/contains/regex', spec.name);
    }
    if (modes.some(value => typeof value !== 'string')) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'name matcher values must be strings', spec.name);
    }
    if (spec.name.flags !== undefined && typeof spec.name.flags !== 'string') {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'regex flags must be a string', spec.name.flags);
    }
  }
}

function validateHierarchyOptions(options: RuntimeInspectorHierarchyOptions): void {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'hierarchy options must be an object');
  }
  const unknown = Object.keys(options).filter(key => !['maxDepth', 'maxNodes', 'maxBytes', 'metadata'].includes(key));
  if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'unsupported hierarchy fields', unknown);
  if (options.maxDepth !== undefined && (!Number.isInteger(options.maxDepth) || options.maxDepth < 0 || options.maxDepth > 8)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'hierarchy maxDepth must be an integer between 0 and 8');
  }
  if (options.maxNodes !== undefined && (!Number.isInteger(options.maxNodes) || options.maxNodes < 1 || options.maxNodes > 500)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'hierarchy maxNodes must be an integer between 1 and 500');
  }
  if (options.maxBytes !== undefined && (!Number.isInteger(options.maxBytes) || options.maxBytes < 4_096 || options.maxBytes > 64_000)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'hierarchy maxBytes must be an integer between 4096 and 64000');
  }
  if (options.metadata !== undefined) {
    if (!options.metadata || typeof options.metadata !== 'object' || Array.isArray(options.metadata)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'hierarchy metadata options must be an object');
    }
    const metadataUnknown = Object.keys(options.metadata).filter(key => !['maxDepth', 'maxKeys', 'maxArray', 'maxString'].includes(key));
    if (metadataUnknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'unsupported hierarchy metadata fields', metadataUnknown);
    for (const [key, value, min, max] of [
      ['maxDepth', options.metadata.maxDepth, 0, 8],
      ['maxKeys', options.metadata.maxKeys, 1, 200],
      ['maxArray', options.metadata.maxArray, 1, 200],
      ['maxString', options.metadata.maxString, 8, 2_000],
    ] as const) {
      if (value !== undefined && (!Number.isInteger(value) || value < min || value > max)) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', `hierarchy metadata ${key} must be an integer between ${min} and ${max}`);
      }
    }
  }
}

function validateLogicalQuerySpec(spec: RuntimeInspectorLogicalQuerySpec): RuntimeInspectorLogicalQuerySpec {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'logical query spec must be an object', spec);
  }
  const allowed = new Set(['id', 'kind', 'name', 'tags', 'limit']);
  const unknown = Object.keys(spec).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported logical query fields: ${unknown.join(', ')}`, unknown);
  }
  if (spec.id !== undefined) readBoundedProviderString(spec.id, 'logical query id', 128, 'INVALID_QUERY');
  if (spec.limit !== undefined && (!Number.isInteger(spec.limit) || spec.limit < 1 || spec.limit > 100)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'logical query limit must be an integer between 1 and 100', spec.limit);
  }
  const kinds = spec.kind === undefined ? [] : Array.isArray(spec.kind) ? spec.kind : [spec.kind];
  if (kinds.length > 20) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'logical query kind accepts at most 20 values', spec.kind);
  }
  for (const kind of kinds) readBoundedProviderString(kind, 'logical query kind', 128, 'INVALID_QUERY');
  if (spec.name !== undefined) {
    if (!spec.name || typeof spec.name !== 'object' || Array.isArray(spec.name)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'logical query name must be an object', spec.name);
    }
    const nameUnknown = Object.keys(spec.name).filter(key => !['exact', 'contains', 'regex', 'flags'].includes(key));
    if (nameUnknown.length > 0) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported logical name fields: ${nameUnknown.join(', ')}`, nameUnknown);
    }
    const modes = [spec.name.exact, spec.name.contains, spec.name.regex].filter(value => value !== undefined);
    if (modes.length !== 1 || modes.some(value => typeof value !== 'string' || value.length > 512)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'logical query name requires exactly one bounded exact/contains/regex matcher', spec.name);
    }
    if (spec.name.flags !== undefined && typeof spec.name.flags !== 'string') {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'logical query regex flags must be a string', spec.name.flags);
    }
    createNameMatcher(spec.name);
  }
  if (spec.tags !== undefined) {
    if (!spec.tags || typeof spec.tags !== 'object' || Array.isArray(spec.tags)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'logical query tags must be an object', spec.tags);
    }
    const tagUnknown = Object.keys(spec.tags).filter(key => !['all', 'any'].includes(key));
    if (tagUnknown.length > 0) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported logical tag fields: ${tagUnknown.join(', ')}`, tagUnknown);
    }
    if (spec.tags.all === undefined && spec.tags.any === undefined) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'logical query tags requires all or any', spec.tags);
    }
    validateLogicalTags(spec.tags.all, 'logical query tags.all');
    validateLogicalTags(spec.tags.any, 'logical query tags.any');
  }
  return {
    ...(spec.id !== undefined ? { id: spec.id.trim() } : {}),
    ...(spec.kind !== undefined ? {
      kind: Array.isArray(spec.kind) ? spec.kind.map(kind => kind.trim()) : spec.kind.trim(),
    } : {}),
    ...(spec.name !== undefined ? { name: { ...spec.name } } : {}),
    ...(spec.tags !== undefined ? {
      tags: {
        ...(spec.tags.all ? { all: uniqueSorted(spec.tags.all.map(tag => tag.trim())) } : {}),
        ...(spec.tags.any ? { any: uniqueSorted(spec.tags.any.map(tag => tag.trim())) } : {}),
      },
    } : {}),
    ...(spec.limit !== undefined ? { limit: spec.limit } : {}),
  };
}

function validateLogicalObjectDescriptor(
  descriptor: RuntimeInspectorLogicalObjectDescriptor,
  providerId: string,
  sceneNodes: Set<BabylonRuntimeNode>,
): RuntimeInspectorLogicalObjectDescriptor {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `logical object provider "${providerId}" returned a non-object descriptor`);
  }
  const allowed = new Set(['id', 'name', 'kind', 'root', 'members', 'tags', 'metadata', 'source']);
  const unknown = Object.keys(descriptor).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `logical object provider "${providerId}" returned unsupported descriptor fields`, unknown);
  }
  const id = readBoundedProviderString(descriptor.id, 'logical object id');
  const name = readBoundedProviderString(descriptor.name, `logical object "${id}" name`, 512);
  const kind = readBoundedProviderString(descriptor.kind, `logical object "${id}" kind`);
  const source = readBoundedProviderString(descriptor.source, `logical object "${id}" source`);
  if (!isRuntimeNode(descriptor.root) || !sceneNodes.has(descriptor.root) || isBabylonNodeDisposed(descriptor.root)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `logical object "${id}" root is not a live node in the current scene`, { providerId });
  }
  if (descriptor.members !== undefined && (!Array.isArray(descriptor.members) || descriptor.members.length > 99)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `logical object "${id}" members must contain at most 99 nodes`, { providerId });
  }
  for (const member of descriptor.members ?? []) {
    if (!isRuntimeNode(member) || !sceneNodes.has(member) || isBabylonNodeDisposed(member)) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `logical object "${id}" member is not a live node in the current scene`, { providerId });
    }
  }
  validateLogicalTags(descriptor.tags, `logical object "${id}" tags`, 'UNAVAILABLE', true);
  return {
    ...descriptor,
    id,
    name,
    kind,
    source,
    tags: uniqueSorted((descriptor.tags ?? []).map(tag => tag.trim())),
  };
}

function validateVfxEffectDescriptor(
  descriptor: RuntimeInspectorVfxEffectDescriptor,
  providerId: string,
): RuntimeInspectorVfxEffectDescriptor {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX provider "${providerId}" returned a non-object effect descriptor`);
  }
  const allowed = new Set([
    'id', 'name', 'placement', 'geometrySpace', 'requiredInputs', 'optionalInputs',
    'defaultParams', 'paramDefinitions', 'metadata', 'source',
  ]);
  const unknown = Object.keys(descriptor).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX provider "${providerId}" returned unsupported effect fields`, unknown);
  }
  const id = readBoundedProviderString(descriptor.id, 'VFX effect id');
  const name = readBoundedProviderString(descriptor.name, `VFX effect "${id}" name`, 512);
  const placement = readBoundedProviderString(descriptor.placement, `VFX effect "${id}" placement`);
  const source = readBoundedProviderString(descriptor.source, `VFX effect "${id}" source`, 256);
  const geometrySpace = descriptor.geometrySpace == null
    ? descriptor.geometrySpace
    : readBoundedProviderString(descriptor.geometrySpace, `VFX effect "${id}" geometrySpace`);
  const requiredInputs = validateVfxStringList(descriptor.requiredInputs, `VFX effect "${id}" requiredInputs`);
  const optionalInputs = validateVfxStringList(descriptor.optionalInputs, `VFX effect "${id}" optionalInputs`);
  if (descriptor.paramDefinitions !== undefined && (!Array.isArray(descriptor.paramDefinitions) || descriptor.paramDefinitions.length > 96)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX effect "${id}" paramDefinitions must contain at most 96 entries`);
  }
  return { ...descriptor, id, name, placement, geometrySpace, source, requiredInputs, optionalInputs };
}

function validateAnimationGroupDescriptor(
  descriptor: RuntimeInspectorAnimationGroupDescriptor,
  providerId: string,
  liveGroups: Set<RuntimeInspectorAnimationGroupDescriptor['group']>,
): RuntimeInspectorAnimationGroupDescriptor {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `animation provider "${providerId}" returned a non-object group descriptor`);
  }
  const allowed = new Set(['id', 'group', 'source']);
  const unknown = Object.keys(descriptor).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `animation provider "${providerId}" returned unsupported group fields`, unknown);
  }
  const id = readBoundedProviderString(descriptor.id, 'animation group id');
  if (!descriptor.group || !liveGroups.has(descriptor.group)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `animation group "${id}" is not live in the current scene`, { providerId });
  }
  return {
    ...descriptor,
    id,
    source: readBoundedProviderString(descriptor.source, `animation group "${id}" source`, 256),
  };
}

function validateMaterialAcquireOptions(options: RuntimeInspectorMaterialAcquireOptions): void {
  if (!isPlainRecord(options)) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'material acquire options must be an object');
  const allowed = new Set(['owner', 'reason', 'timeoutMs']);
  const unknown = Object.keys(options).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'unsupported material acquire option fields', unknown);
  for (const key of ['owner', 'reason'] as const) {
    const value = options[key];
    if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 256)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `material acquire ${key} must be a non-empty string up to 256 characters`);
    }
  }
  if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 300_000)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'material acquire timeoutMs must be an integer from 1000 to 300000');
  }
}

function validateAnimationAcquireOptions(options: RuntimeInspectorAnimationAcquireOptions): void {
  if (!isPlainRecord(options)) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'animation acquire options must be an object');
  const allowed = new Set(['owner', 'reason', 'timeoutMs']);
  const unknown = Object.keys(options).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'unsupported animation acquire option fields', unknown);
  for (const key of ['owner', 'reason'] as const) {
    const value = options[key];
    if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 256)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `animation acquire ${key} must be a non-empty string up to 256 characters`);
    }
  }
  if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 300_000)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'animation acquire timeoutMs must be an integer from 1000 to 300000');
  }
}

function validateAnimationPreviewSpec(spec: RuntimeInspectorAnimationPreviewSpec): void {
  if (!isPlainRecord(spec)) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'animation preview spec must be an object');
  const allowed = new Set(['providerId', 'groupId', 'set']);
  const unknown = Object.keys(spec).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'unsupported animation preview fields', unknown);
  readBoundedProviderString(spec.providerId, 'animation preview providerId', 128, 'INVALID_QUERY');
  readBoundedProviderString(spec.groupId, 'animation preview groupId', 128, 'INVALID_QUERY');
  if (!isPlainRecord(spec.set)) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'animation preview set must be an object');
  const keys = Object.keys(spec.set);
  if (keys.length < 1 || keys.length > 3) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'animation preview set must contain 1 to 3 fields');
  const unsupported = keys.filter(key => !['paused', 'currentFrame', 'speedRatio'].includes(key));
  if (unsupported.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'unsupported animation preview set fields', unsupported);
}

function validateAnimationStatePatch(
  set: RuntimeInspectorAnimationPreviewSpec['set'],
  current: RuntimeInspectorAnimationGroupRecord,
): RuntimeInspectorAnimationPreviewSpec['set'] {
  const result: RuntimeInspectorAnimationPreviewSpec['set'] = {};
  if (set.paused !== undefined) {
    if (typeof set.paused !== 'boolean') throw new RuntimeInspectorCommandError('INVALID_QUERY', 'animation paused must be boolean');
    result.paused = set.paused;
  }
  if (set.currentFrame !== undefined) {
    const min = Math.min(current.range.from, current.range.to);
    const max = Math.max(current.range.from, current.range.to);
    if (typeof set.currentFrame !== 'number' || !Number.isFinite(set.currentFrame) || set.currentFrame < min || set.currentFrame > max) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `animation currentFrame must be a finite number from ${min} to ${max}`);
    }
    result.currentFrame = set.currentFrame;
  }
  if (set.speedRatio !== undefined) {
    if (typeof set.speedRatio !== 'number' || !Number.isFinite(set.speedRatio)
      || Math.abs(set.speedRatio) < 0.01 || Math.abs(set.speedRatio) > 8) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'animation speedRatio must be a finite number from -8 to -0.01 or 0.01 to 8');
    }
    result.speedRatio = set.speedRatio;
  }
  return result;
}

function animationRestoreMatches(
  before: RuntimeInspectorAnimationGroupRecord,
  current: RuntimeInspectorAnimationGroupRecord,
): boolean {
  if (before.state.isStarted !== current.state.isStarted
    || before.state.isPlaying !== current.state.isPlaying
    || before.state.loopAnimation !== current.state.loopAnimation
    || Math.abs(before.state.speedRatio - current.state.speedRatio) > 0.001) return false;
  return before.state.isPlaying || Math.abs(before.range.currentFrame - current.range.currentFrame) <= 0.5;
}

function validateMaterialPreviewSpec(spec: RuntimeInspectorMaterialPreviewSpec): void {
  if (!isPlainRecord(spec)) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'material preview spec must be an object');
  const allowed = new Set(['providerId', 'instanceId', 'set']);
  const unknown = Object.keys(spec).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'unsupported material preview fields', unknown);
  readBoundedProviderString(spec.providerId, 'material preview providerId', 128, 'INVALID_QUERY');
  readBoundedProviderString(spec.instanceId, 'material preview instanceId', 128, 'INVALID_QUERY');
  if (!isPlainRecord(spec.set)) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'material preview set must be an object');
  const keys = Object.keys(spec.set);
  if (keys.length < 1 || keys.length > 16) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'material preview set must contain 1 to 16 fields');
}

function validateMaterialPropertyPatch(
  set: Record<string, unknown>,
  current: RuntimeInspectorMaterialInstanceRecord['properties'],
): Record<string, unknown> {
  const unitFields = new Set(['alpha', 'metallic', 'roughness', 'microSurface']);
  const booleanFields = new Set(['backFaceCulling', 'disableDepthWrite', 'needDepthPrePass']);
  const colorFields = new Set(['albedoColor', 'diffuseColor', 'emissiveColor']);
  const allowed = new Set([...unitFields, ...booleanFields, ...colorFields, 'transparencyMode', 'emissiveIntensity']);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(set)) {
    if (!allowed.has(key) || !(key in current)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `material property "${key}" is not controllable`);
    }
    if (current[key as keyof typeof current] === null) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', `material property "${key}" is unsupported by this instance`);
    }
    if (unitFields.has(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', `material property "${key}" must be a finite number from 0 to 1`);
      }
      result[key] = value;
    } else if (key === 'emissiveIntensity') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 64) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', 'material emissiveIntensity must be a finite number from 0 to 64');
      }
      result[key] = value;
    } else if (key === 'transparencyMode') {
      if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > 3) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', 'material transparencyMode must be an integer from 0 to 3');
      }
      result[key] = value;
    } else if (booleanFields.has(key)) {
      if (typeof value !== 'boolean') throw new RuntimeInspectorCommandError('INVALID_QUERY', `material property "${key}" must be boolean`);
      result[key] = value;
    } else if (colorFields.has(key)) {
      if (!Array.isArray(value) || value.length !== 3
        || !value.every(channel => typeof channel === 'number' && Number.isFinite(channel) && channel >= 0 && channel <= 64)) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', `material property "${key}" must be a finite [r,g,b] array with channels from 0 to 64`);
      }
      result[key] = value.map(Number);
    }
  }
  return result;
}

function validateMaterialAssetDescriptor(
  descriptor: RuntimeInspectorMaterialAssetDescriptor,
  providerId: string,
): RuntimeInspectorMaterialAssetDescriptor {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `material provider "${providerId}" returned a non-object asset descriptor`);
  }
  const allowed = new Set(['id', 'name', 'kind', 'profile', 'readonly', 'origin', 'metadata', 'source']);
  const unknown = Object.keys(descriptor).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `material provider "${providerId}" returned unsupported asset fields`, unknown);
  }
  const id = readBoundedProviderString(descriptor.id, 'material asset id');
  if (descriptor.readonly !== undefined && typeof descriptor.readonly !== 'boolean') {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `material asset "${id}" readonly must be boolean`);
  }
  return {
    ...descriptor,
    id,
    name: readBoundedProviderString(descriptor.name, `material asset "${id}" name`, 512),
    kind: readBoundedProviderString(descriptor.kind, `material asset "${id}" kind`, 128),
    source: readBoundedProviderString(descriptor.source, `material asset "${id}" source`, 256),
  };
}

function validateMaterialInstanceDescriptor(
  descriptor: RuntimeInspectorMaterialInstanceDescriptor,
  providerId: string,
  sceneMaterials: Set<Material>,
): RuntimeInspectorMaterialInstanceDescriptor {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `material provider "${providerId}" returned a non-object instance descriptor`);
  }
  const allowed = new Set(['id', 'material', 'source']);
  const unknown = Object.keys(descriptor).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `material provider "${providerId}" returned unsupported instance fields`, unknown);
  }
  const id = readBoundedProviderString(descriptor.id, 'material instance id');
  if (!descriptor.material || !sceneMaterials.has(descriptor.material)
    || (descriptor.material as Material & { isDisposed?: () => boolean }).isDisposed?.()) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `material instance "${id}" is not a live material in the current scene`, { providerId });
  }
  return {
    ...descriptor,
    id,
    source: readBoundedProviderString(descriptor.source, `material instance "${id}" source`, 256),
  };
}

function runtimeNodeUsesMaterial(node: BabylonRuntimeNode, material: Material): boolean {
  const assigned = (node as BabylonRuntimeNode & { material?: Material & { subMaterials?: Array<Material | null> } }).material;
  if (!assigned) return false;
  if (assigned === material) return true;
  return Array.isArray(assigned.subMaterials) && assigned.subMaterials.includes(material);
}

function readRuntimeSceneNodeId(node: BabylonRuntimeNode): string | null {
  let current: { parent?: unknown; metadata?: unknown } | null = node;
  for (let depth = 0; current && depth < 64; depth += 1) {
    const metadata = isPlainRecord(current.metadata) ? current.metadata : null;
    const projection = metadata && isPlainRecord(metadata.editorProjection) ? metadata.editorProjection : null;
    const value = metadata?.sceneNodeId ?? metadata?.nodeId ?? projection?.nodeId;
    if (typeof value === 'string' && value.trim()) return value.trim();
    current = current.parent && typeof current.parent === 'object'
      ? current.parent as typeof current
      : null;
  }
  return null;
}

function readMaterialProperties(material: Material): RuntimeInspectorMaterialInstanceRecord['properties'] {
  const candidate = material as Material & Record<string, unknown>;
  return {
    alpha: nullableNumber(candidate.alpha),
    transparencyMode: nullableNumber(candidate.transparencyMode),
    backFaceCulling: typeof candidate.backFaceCulling === 'boolean' ? candidate.backFaceCulling : null,
    disableDepthWrite: typeof candidate.disableDepthWrite === 'boolean' ? candidate.disableDepthWrite : null,
    needDepthPrePass: typeof candidate.needDepthPrePass === 'boolean' ? candidate.needDepthPrePass : null,
    metallic: readMaterialNumber(candidate.metallic),
    roughness: readMaterialNumber(candidate.roughness),
    microSurface: readMaterialNumber(candidate.microSurface),
    emissiveIntensity: readMaterialNumber(candidate.emissiveIntensity),
    albedoColor: readMaterialColor(candidate.albedoColor),
    diffuseColor: readMaterialColor(candidate.diffuseColor),
    emissiveColor: readMaterialColor(candidate.emissiveColor),
  };
}

function readMaterialNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? roundNumber(value) : null;
}

function readMaterialColor(value: unknown): [number, number, number] | null {
  if (!value || typeof value !== 'object') return null;
  const color = value as { r?: unknown; g?: unknown; b?: unknown };
  if (![color.r, color.g, color.b].every(channel => typeof channel === 'number' && Number.isFinite(channel))) return null;
  return [roundNumber(Number(color.r)), roundNumber(Number(color.g)), roundNumber(Number(color.b))];
}

function validateVfxUsageDescriptor(
  descriptor: RuntimeInspectorVfxUsageDescriptor,
  providerId: string,
): RuntimeInspectorVfxUsageDescriptor {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX provider "${providerId}" returned a non-object usage descriptor`);
  }
  const allowed = new Set([
    'id', 'label', 'effectId', 'placement', 'lifecycle', 'binding', 'params', 'offset', 'root', 'source',
  ]);
  const unknown = Object.keys(descriptor).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `VFX provider "${providerId}" returned unsupported usage fields`, unknown);
  }
  const id = readBoundedProviderString(descriptor.id, 'VFX usage id');
  return {
    ...descriptor,
    id,
    label: readBoundedProviderString(descriptor.label, `VFX usage "${id}" label`, 512),
    effectId: readBoundedProviderString(descriptor.effectId, `VFX usage "${id}" effectId`),
    placement: readBoundedProviderString(descriptor.placement, `VFX usage "${id}" placement`),
    lifecycle: readBoundedProviderString(descriptor.lifecycle, `VFX usage "${id}" lifecycle`),
    source: readBoundedProviderString(descriptor.source, `VFX usage "${id}" source`, 256),
  };
}

function validateVfxStringList(value: unknown, label: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 32) {
    throw new RuntimeInspectorCommandError('UNAVAILABLE', `${label} must contain at most 32 strings`);
  }
  return value.map((entry, index) => readBoundedProviderString(entry, `${label}[${index}]`, 64));
}

function validateVfxAcquireOptions(options: RuntimeInspectorVfxAcquireOptions): void {
  if (!isPlainRecord(options)) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'VFX acquire options must be an object');
  const allowed = new Set(['owner', 'reason', 'timeoutMs']);
  const unknown = Object.keys(options).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'unsupported VFX acquire option fields', unknown);
  for (const key of ['owner', 'reason'] as const) {
    const value = options[key];
    if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 256)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `VFX acquire ${key} must be a non-empty string up to 256 characters`);
    }
  }
  if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1_000 || options.timeoutMs > 300_000)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'VFX acquire timeoutMs must be an integer from 1000 to 300000');
  }
}

function validateVfxPreviewSpec(spec: RuntimeInspectorVfxPreviewSpec): void {
  if (!isPlainRecord(spec)) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'VFX preview spec must be an object');
  const allowed = new Set(['providerId', 'usageId', 'set']);
  const unknown = Object.keys(spec).filter(key => !allowed.has(key));
  if (unknown.length > 0) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'unsupported VFX preview fields', unknown);
  readBoundedProviderString(spec.providerId, 'VFX preview providerId', 128, 'INVALID_QUERY');
  readBoundedProviderString(spec.usageId, 'VFX preview usageId', 128, 'INVALID_QUERY');
  if (!isPlainRecord(spec.set)) throw new RuntimeInspectorCommandError('INVALID_QUERY', 'VFX preview set must be an object');
  const keys = Object.keys(spec.set);
  if (keys.length < 1 || keys.length > 32) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'VFX preview set must contain 1 to 32 fields');
  }
  for (const key of keys) {
    if (!key || key.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(key)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'VFX preview parameter keys must be safe strings up to 128 characters', key);
    }
  }
}

function validateVfxParamPatch(set: Record<string, unknown>, definitions: unknown[]): Record<string, unknown> {
  const definitionMap = new Map<string, Record<string, unknown>>();
  for (const raw of definitions) {
    if (!isPlainRecord(raw) || typeof raw.key !== 'string' || typeof raw.kind !== 'string') continue;
    definitionMap.set(raw.key, raw);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(set)) {
    const definition = definitionMap.get(key);
    if (!definition) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `VFX parameter "${key}" is not declared by the effect`);
    }
    const kind = definition.kind;
    if (['number', 'opacity', 'lifetime', 'scale'].includes(String(kind))) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', `VFX parameter "${key}" must be a finite number`);
      }
      if (typeof definition.min === 'number' && value < definition.min) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', `VFX parameter "${key}" is below minimum ${definition.min}`);
      }
      if (typeof definition.max === 'number' && value > definition.max) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', `VFX parameter "${key}" is above maximum ${definition.max}`);
      }
      result[key] = value;
      continue;
    }
    if (kind === 'boolean') {
      if (typeof value !== 'boolean') throw new RuntimeInspectorCommandError('INVALID_QUERY', `VFX parameter "${key}" must be boolean`);
      result[key] = value;
      continue;
    }
    if (kind === 'enum') {
      const options = Array.isArray(definition.options)
        ? definition.options.filter(isPlainRecord).map(option => option.value).filter(item => typeof item === 'string')
        : [];
      if (typeof value !== 'string' || !options.includes(value)) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', `VFX parameter "${key}" must match a declared enum option`, options);
      }
      result[key] = value;
      continue;
    }
    if (kind === 'color') {
      if (typeof value === 'string' && value.trim() && value.length <= 64) {
        result[key] = value.trim();
        continue;
      }
      if (isPlainRecord(value)
        && ['r', 'g', 'b'].every(channel => typeof value[channel] === 'number'
          && Number.isFinite(value[channel]) && Number(value[channel]) >= 0 && Number(value[channel]) <= 64)) {
        result[key] = { r: value.r, g: value.g, b: value.b };
        continue;
      }
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `VFX parameter "${key}" must be a color string or finite {r,g,b}`);
    }
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `VFX parameter "${key}" has unsupported kind "${String(kind)}"`);
  }
  return result;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateLogicalTags(
  tags: unknown,
  label: string,
  code: RuntimeInspectorErrorCode = 'INVALID_QUERY',
  allowEmpty = false,
): asserts tags is string[] | undefined {
  if (tags === undefined) return;
  if (!Array.isArray(tags) || tags.length < (allowEmpty ? 0 : 1) || tags.length > 32) {
    throw new RuntimeInspectorCommandError(code, `${label} must contain ${allowEmpty ? '0' : '1'} to 32 strings`, tags);
  }
  for (const tag of tags) {
    if (typeof tag !== 'string' || !tag.trim() || tag.length > 64) {
      throw new RuntimeInspectorCommandError(code, `${label} values must be non-empty strings up to 64 characters`, tag);
    }
  }
}

function readBoundedProviderString(
  value: unknown,
  label: string,
  maximumLength = 128,
  code: RuntimeInspectorErrorCode = 'UNAVAILABLE',
): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximumLength) {
    throw new RuntimeInspectorCommandError(code, `${label} must be a non-empty string up to ${maximumLength} characters`, value);
  }
  return value.trim();
}

function uniqueRuntimeNodes(nodes: BabylonRuntimeNode[]): BabylonRuntimeNode[] {
  return [...new Map(nodes.map(node => [String(node.uniqueId), node])).values()];
}

function expandLogicalMembers(
  sceneNodes: BabylonRuntimeNode[],
  controlNodes: BabylonRuntimeNode[],
): BabylonRuntimeNode[] {
  const controls = new Set(controlNodes);
  return sceneNodes.filter(node => {
    if (controls.has(node)) return true;
    let current = isRuntimeNode(node.parent) ? node.parent : null;
    let guard = 0;
    while (current && guard < 64) {
      if (controls.has(current)) return true;
      current = isRuntimeNode(current.parent) ? current.parent : null;
      guard += 1;
    }
    return false;
  });
}

function validateMetadataPredicates(predicates: RuntimeInspectorQuerySpec['metadata']): void {
  if (predicates === undefined) return;
  if (!Array.isArray(predicates) || predicates.length < 1 || predicates.length > 8) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'metadata must contain 1 to 8 predicates', predicates);
  }
  const forbiddenSegments = new Set(['__proto__', 'prototype', 'constructor']);
  for (const rawPredicate of predicates as unknown[]) {
    if (!rawPredicate || typeof rawPredicate !== 'object' || Array.isArray(rawPredicate)) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'metadata predicates must be objects', rawPredicate);
    }
    const predicate = rawPredicate as Record<string, unknown>;
    const op = predicate.op;
    const path = predicate.path;
    const allowed = op === 'equals' ? new Set(['path', 'op', 'value']) : new Set(['path', 'op']);
    const unknown = Object.keys(predicate).filter(key => !allowed.has(key));
    if (unknown.length > 0) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported metadata predicate fields: ${unknown.join(', ')}`, predicate);
    }
    if (!Array.isArray(path) || path.length < 1 || path.length > 8) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'metadata predicate path must contain 1 to 8 segments', path);
    }
    for (const segment of path) {
      if (typeof segment !== 'string' || segment.length < 1 || segment.length > 64 || forbiddenSegments.has(segment)) {
        throw new RuntimeInspectorCommandError('INVALID_QUERY', 'metadata path segments must be safe strings from 1 to 64 characters', path);
      }
    }
    if (op !== 'exists' && op !== 'equals') {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'metadata predicate op must be exists or equals', op);
    }
    const hasValue = Object.prototype.hasOwnProperty.call(predicate, 'value');
    if (op === 'exists' && hasValue) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'metadata exists predicate must not include value', predicate);
    }
    if (op === 'equals' && (!hasValue || !isJsonPrimitive(predicate.value) || (typeof predicate.value === 'string' && predicate.value.length > 512))) {
      throw new RuntimeInspectorCommandError('INVALID_QUERY', 'metadata equals predicate requires a finite JSON primitive value up to 512 characters', predicate);
    }
  }
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

function matchesMetadataPredicates(
  metadata: unknown,
  predicates: NonNullable<RuntimeInspectorQuerySpec['metadata']>,
): { matches: boolean; failedPath: string[] | null } {
  for (const predicate of predicates) {
    const result = readOwnMetadataPath(metadata, predicate.path);
    if (result.failed) return { matches: false, failedPath: predicate.path };
    const matches = predicate.op === 'exists'
      ? result.found
      : result.found && result.value === predicate.value;
    if (!matches) return { matches: false, failedPath: null };
  }
  return { matches: true, failedPath: null };
}

function readOwnMetadataPath(
  metadata: unknown,
  path: string[],
): { found: boolean; failed: boolean; value?: unknown } {
  let current = metadata;
  for (const segment of path) {
    if (current === null || typeof current !== 'object') return { found: false, failed: false };
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(current, segment);
    } catch {
      return { found: false, failed: true };
    }
    if (!descriptor || descriptor.enumerable !== true) return { found: false, failed: false };
    if (!('value' in descriptor)) return { found: false, failed: true };
    current = descriptor.value;
  }
  return { found: true, failed: false, value: current };
}

function createNameMatcher(spec: RuntimeInspectorQuerySpec['name'] | RuntimeInspectorLogicalQuerySpec['name']): ((name: string) => boolean) | null {
  if (!spec) return null;
  if (spec.exact !== undefined) return name => name === spec.exact;
  if (spec.contains !== undefined) return name => name.includes(spec.contains!);
  if (spec.regex !== undefined) {
    try {
      const expression = new RegExp(spec.regex, spec.flags ?? '');
      return name => {
        expression.lastIndex = 0;
        return expression.test(name);
      };
    } catch (error) {
      throw new RuntimeInspectorCommandError(
        'INVALID_QUERY',
        `invalid name regex: ${error instanceof Error ? error.message : String(error)}`,
        spec,
      );
    }
  }
  return null;
}

function normalizeError(error: unknown): RuntimeInspectorObservation<unknown>['error'] {
  if (error instanceof RuntimeInspectorCommandError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : String(error),
  };
}

function isHandleLike(handle: unknown): handle is RuntimeInspectorObjectHandle {
  if (!handle || typeof handle !== 'object' || Array.isArray(handle)) return false;
  const value = handle as Partial<RuntimeInspectorObjectHandle>;
  return typeof value.runtimeSessionId === 'string'
    && typeof value.sceneId === 'string'
    && Number.isInteger(value.sceneGeneration)
    && typeof value.kind === 'string'
    && typeof value.engineId === 'string'
    && Number.isInteger(value.objectGeneration)
    && typeof value.name === 'string'
    && Array.isArray(value.path);
}

function isRuntimeNode(value: unknown): value is BabylonRuntimeNode {
  return !!value
    && typeof value === 'object'
    && 'uniqueId' in value
    && 'position' in value
    && 'scaling' in value;
}

function compareHandles(left: RuntimeInspectorObjectHandle, right: RuntimeInspectorObjectHandle): number {
  return Number(left.engineId) - Number(right.engineId);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value!)));
}

function createId(prefix: string): string {
  const value = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${value}`;
}

function getPageBootId(): string {
  const globalState = window as Window & { __fp3dPageBootId?: string };
  if (!globalState.__fp3dPageBootId) globalState.__fp3dPageBootId = createId('page');
  return globalState.__fp3dPageBootId;
}

function roundNumber(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? roundNumber(value) : null;
}

function numbersEqual(left: number | null, right: number | null): boolean {
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) <= 1e-5;
}

function nullableColorEqual(
  left: [number, number, number] | null,
  right: [number, number, number] | null,
): boolean {
  if (left === null || right === null) return left === right;
  return left.every((value, index) => numbersEqual(value, right[index]));
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
