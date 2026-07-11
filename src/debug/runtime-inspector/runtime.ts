import { Camera } from '@babylonjs/core/Cameras/camera';
import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
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
  type RuntimeInspectorCameraControlProvider,
  type RuntimeInspectorCameraOwnerLease,
} from './providers';
import { safeSerialize } from './safe-serialize';
import {
  FP3D_IMPLEMENTATION_NAME,
  FP3D_IMPLEMENTATION_VERSION,
  FP3D_OBSERVATION_VERSION,
  FP3D_PROTOCOL_VERSION,
  type RuntimeInspectorApi,
  type RuntimeInspectorCameraAcquireOptions,
  type RuntimeInspectorCameraFocusOptions,
  type RuntimeInspectorCameraFocusResult,
  type RuntimeInspectorCameraLeaseRecord,
  type RuntimeInspectorCameraOcclusionResult,
  type RuntimeInspectorCameraPatchResult,
  type RuntimeInspectorCameraPatchSpec,
  type RuntimeInspectorCameraRestoreResult,
  type RuntimeInspectorCameraSnapshot,
  type RuntimeInspectorErrorCode,
  type RuntimeInspectorIdentity,
  type RuntimeInspectorInspectSpec,
  type RuntimeInspectorObjectHandle,
  type RuntimeInspectorObjectRecord,
  type RuntimeInspectorObservation,
  type RuntimeInspectorQuerySpec,
  type RuntimeInspectorRelationGraph,
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
  let disposed = false;

  const handlePageHide = () => {
    restoreActiveCameraLease('pagehide');
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

      focus(leaseId, handlesOrHandle, focusOptions = {}) {
        return command(() => focusCamera(leaseId, handlesOrHandle, focusOptions));
      },

      occlusion(leaseId, handlesOrHandle) {
        return command(() => inspectCameraOcclusion(leaseId, handlesOrHandle));
      },

      patch(leaseId, spec) {
        return command(() => patchCameraVisibility(leaseId, spec));
      },

      restore(leaseId) {
        return command(() => restoreCameraByLeaseId(leaseId));
      },
    },

    dispose() {
      if (disposed) return;
      restoreActiveCameraLease('dispose');
      disposed = true;
      window.removeEventListener('pagehide', handlePageHide);
      handles.clear();
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
        query: FP3D_PROTOCOL_VERSION,
        inspect: FP3D_PROTOCOL_VERSION,
        relations: FP3D_PROTOCOL_VERSION,
        camera: '0.3',
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
    const allNodes = listBabylonRuntimeNodes(scene);
    const matcher = createNameMatcher(spec.name);
    const kinds = spec.kind ? new Set(Array.isArray(spec.kind) ? spec.kind : [spec.kind]) : null;
    const limit = spec.limit ?? 100;
    const matches = allNodes.filter(node => {
      if (spec.engineId !== undefined && String(node.uniqueId) !== spec.engineId) return false;
      if (kinds && !kinds.has(getBabylonNodeKind(node))) return false;
      if (matcher && !matcher(String(node.name ?? ''))) return false;
      if (spec.enabled !== undefined && isBabylonNodeEnabled(node) !== spec.enabled) return false;
      const visible = readBabylonNodeVisible(node);
      if (spec.visible !== undefined && visible !== spec.visible) return false;
      return true;
    });
    const warnings: string[] = [];
    if (spec.name?.exact && matches.length > 1) {
      warnings.push(`AMBIGUOUS: exact name "${spec.name.exact}" matched ${matches.length} nodes; returning handles for every match.`);
    }
    if (matches.length > limit) warnings.push(`TRUNCATED: ${matches.length} matches limited to ${limit}.`);
    const data = matches.slice(0, limit).map(node => makeHandle(node, identity));
    return {
      data,
      observed: ['scene.nodes', 'node.identity', 'query.filters'],
      unavailable: [
        { channel: 'query.spatial', reason: 'v0.1 does not implement spatial or raycast queries' },
        { channel: 'query.metadata', reason: 'v0.1 does not implement metadata predicates' },
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
  ): CommandResult<RuntimeInspectorCameraOcclusionResult> {
    const lease = requireCameraLease(leaseId);
    const requestedHandles = normalizeCameraHandles(handlesOrHandle);
    const targetNodes = requestedHandles.map(resolveHandle);
    const targetMeshes = expandRuntimeMeshes(lease.scene, targetNodes);
    if (targetMeshes.length === 0) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'occlusion targets have no mesh descendants');
    }
    const targetMeshIds = new Set(targetMeshes.map(node => String(node.uniqueId)));
    const samplePoints = readOcclusionSamplePoints(targetMeshes);
    if (samplePoints.length === 0) {
      throw new RuntimeInspectorCommandError('UNAVAILABLE', 'occlusion targets have no world bounding boxes');
    }

    const origin = lease.camera.position.clone();
    const hitsById = new Map<string, {
      node: BabylonRuntimeNode;
      hitCount: number;
      minDistance: number;
      maxDistance: number;
    }>();
    let blockedSampleCount = 0;
    let targetMissSampleCount = 0;

    for (const samplePoint of samplePoints) {
      const direction = samplePoint.subtract(origin);
      const length = direction.length();
      if (length <= 1e-6) continue;
      const ray = new Ray(origin, direction.scale(1 / length), length);
      const picks = (lease.scene.multiPickWithRay(ray, mesh => (
        mesh.isEnabled()
        && mesh.isVisible
        && mesh.visibility > 0.001
      )) ?? []).sort((left, right) => left.distance - right.distance);
      const targetHit = picks.find(pick => (
        pick.pickedMesh && targetMeshIds.has(String(pick.pickedMesh.uniqueId))
      ));
      if (!targetHit) targetMissSampleCount += 1;
      const blockingLimit = Math.min(length - 1e-4, targetHit?.distance ?? length - 1e-4);
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
    const occluders = [...hitsById.values()]
      .sort((left, right) => right.hitCount - left.hitCount || Number(left.node.uniqueId) - Number(right.node.uniqueId))
      .map(hit => ({
        handle: makeHandle(hit.node, identity),
        hitCount: hit.hitCount,
        minDistance: roundNumber(hit.minDistance),
        maxDistance: roundNumber(hit.maxDistance),
      }));
    const warnings = targetMissSampleCount > 0
      ? [`${targetMissSampleCount}/${samplePoints.length} rays did not intersect a target mesh; occlusion is approximate.`]
      : [];
    return {
      data: {
        leaseId,
        method: 'raycast-center-v1',
        sampleCount: samplePoints.length,
        blockedSampleCount,
        targetMissSampleCount,
        occluders,
      },
      observed: ['camera.lease', 'camera.occlusion.raycast', 'node.boundingBox'],
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
          ? { ...before, visibility: opacity }
          : { ...before, isVisible: false };
        if (before.isVisible === after.isVisible && numbersEqual(before.visibility, after.visibility)) continue;
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
    return activeCameraLease;
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

    return {
      leaseId: lease.record.id,
      reason,
      restored: differences.length === 0,
      cameraAfter,
      ownerAfter,
      restoredPatchCount,
      differences,
    };
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

function normalizeCameraHandles(
  handlesOrHandle: RuntimeInspectorObjectHandle | RuntimeInspectorObjectHandle[],
): RuntimeInspectorObjectHandle[] {
  const requestedHandles = Array.isArray(handlesOrHandle) ? handlesOrHandle : [handlesOrHandle];
  if (requestedHandles.length < 1 || requestedHandles.length > 100) {
    throw new RuntimeInspectorCommandError('INVALID_HANDLE', 'camera operation requires 1 to 100 handles');
  }
  return requestedHandles;
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
    alpha: roundNumber(camera.alpha),
    beta: roundNumber(camera.beta),
    radius: roundNumber(camera.radius),
    fov: roundNumber(camera.fov),
    minZ: roundNumber(camera.minZ),
    maxZ: roundNumber(camera.maxZ),
    orthoLeft: nullableNumber(camera.orthoLeft),
    orthoRight: nullableNumber(camera.orthoRight),
    orthoTop: nullableNumber(camera.orthoTop),
    orthoBottom: nullableNumber(camera.orthoBottom),
  };
}

function applyCameraSnapshot(camera: ArcRotateCamera, snapshot: RuntimeInspectorCameraSnapshot): void {
  camera.mode = snapshot.mode;
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
  for (const key of ['alpha', 'beta', 'radius', 'fov', 'minZ', 'maxZ', 'orthoLeft', 'orthoRight', 'orthoTop', 'orthoBottom'] as const) {
    if (!numbersEqual(expected[key], actual[key])) differences.push(`camera.${key}`);
  }
  for (const key of ['position', 'target'] as const) {
    if (expected[key].some((value, index) => !numbersEqual(value, actual[key][index]))) {
      differences.push(`camera.${key}`);
    }
  }
  return differences;
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

function readOcclusionSamplePoints(targetMeshes: BabylonRuntimeNode[]): Vector3[] {
  const samples = new Map<string, Vector3>();
  for (const node of targetMeshes.slice(0, 32)) {
    const bounds = readBabylonBoundingBox(node);
    if (!bounds) continue;
    const center = Vector3.Center(
      Vector3.FromArray(bounds.minimumWorld),
      Vector3.FromArray(bounds.maximumWorld),
    );
    const key = vector3(center)?.join(',') ?? String(node.uniqueId);
    samples.set(key, center);
  }
  return [...samples.values()];
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
  const allowed = new Set(['kind', 'engineId', 'name', 'enabled', 'visible', 'limit']);
  const unknown = Object.keys(spec).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', `unsupported query fields: ${unknown.join(', ')}`, unknown);
  }
  if (spec.limit !== undefined && (!Number.isInteger(spec.limit) || spec.limit < 1 || spec.limit > 500)) {
    throw new RuntimeInspectorCommandError('INVALID_QUERY', 'limit must be an integer between 1 and 500', spec.limit);
  }
  const validKinds = new Set(['transformNode', 'mesh', 'instancedMesh']);
  const kinds = spec.kind === undefined ? [] : Array.isArray(spec.kind) ? spec.kind : [spec.kind];
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

function createNameMatcher(spec: RuntimeInspectorQuerySpec['name']): ((name: string) => boolean) | null {
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

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
