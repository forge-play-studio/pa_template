import type { SceneCameraProjection, SceneCameraRigConfig } from '../config';
import type {
  EditorSceneDocument,
  EditorSceneGameObject,
} from '../fps-game-editor-adapter/editor-scene-document';
import {
  ensureEditorSceneGameObjectGuids,
  isEditorSceneCameraGameObject,
  patchEditorSceneGameObjectField,
} from '../fps-game-editor-adapter/editor-scene-session';
import {
  loadSceneMainSource,
  saveSceneMainSource,
  type SceneMainSourceSaveResult,
} from '../fps-game-editor-adapter/scene-main-source-driver';

const CAMERA_RIG_SAVE_FIELDS = [
  'projection',
  'alpha',
  'beta',
  'radius',
  'orthoSize',
  'fov',
  'targetOffset',
  'minZ',
  'maxZ',
  'lowerBetaLimit',
  'upperBetaLimit',
  'lowerRadiusLimit',
  'upperRadiusLimit',
  'inertia',
  'targetScreenOffset',
] as const satisfies readonly (keyof SceneCameraRigConfig)[];

export interface RuntimeCameraEditorBinding {
  sourceId: string;
  objectGuid?: string;
  objectId?: string;
  propertyPath: 'camera' | string;
}

export interface RuntimeCameraRigPatchResult {
  document: EditorSceneDocument;
  targetId: string;
  objectGuid?: string;
}

export interface RuntimeCameraRigSaveResult extends RuntimeCameraRigPatchResult {
  saved: SceneMainSourceSaveResult;
}

export async function saveRuntimeCameraRigToEditorScene(
  binding: RuntimeCameraEditorBinding,
  cameraRig: SceneCameraRigConfig,
): Promise<RuntimeCameraRigSaveResult> {
  const loaded = await loadSceneMainSource();
  const patched = patchRuntimeCameraRigInEditorScene(
    loaded.document,
    binding,
    cameraRig,
    loaded.source.ref.sourceId,
  );
  const saved = await saveSceneMainSource(patched.document, { mode: 'local-commit-save' });
  return {
    ...patched,
    document: saved.document,
    saved,
  };
}

export function patchRuntimeCameraRigInEditorScene(
  document: EditorSceneDocument,
  binding: RuntimeCameraEditorBinding,
  cameraRig: SceneCameraRigConfig,
  expectedSourceId?: string,
): RuntimeCameraRigPatchResult {
  const normalizedBinding = normalizeRuntimeCameraEditorBinding(binding);
  if (expectedSourceId && normalizedBinding.sourceId !== expectedSourceId) {
    throw new Error(`Runtime camera binding source mismatch: ${normalizedBinding.sourceId} !== ${expectedSourceId}`);
  }

  const originalGuidById = createOriginalGuidById(document);
  let nextDocument = ensureEditorSceneGameObjectGuids(document);
  const target = findRuntimeCameraTarget(nextDocument, normalizedBinding, originalGuidById);
  if (!target) {
    throw new Error('Runtime camera binding did not match an editor camera object.');
  }
  if (!isEditorSceneCameraGameObject(target)) {
    throw new Error(`Runtime camera binding target is not a camera object: ${target.id}`);
  }

  const sanitizedRig = sanitizeRuntimeCameraRig(cameraRig);
  for (const field of CAMERA_RIG_SAVE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(sanitizedRig, field)) continue;
    nextDocument = patchEditorSceneGameObjectField(
      nextDocument,
      target.id,
      `camera.${field}`,
      sanitizedRig[field],
    );
  }

  return {
    document: nextDocument,
    targetId: target.id,
    objectGuid: target.guid,
  };
}

function normalizeRuntimeCameraEditorBinding(
  binding: RuntimeCameraEditorBinding,
): Required<Pick<RuntimeCameraEditorBinding, 'sourceId' | 'propertyPath'>> & Pick<RuntimeCameraEditorBinding, 'objectGuid' | 'objectId'> {
  const sourceId = readNonEmptyString(binding.sourceId);
  const propertyPath = readNonEmptyString(binding.propertyPath);
  const objectGuid = readNonEmptyString(binding.objectGuid);
  const objectId = readNonEmptyString(binding.objectId);
  if (!sourceId) throw new Error('Runtime camera binding is missing sourceId.');
  if (propertyPath !== 'camera') throw new Error(`Runtime camera binding is not for camera: ${propertyPath ?? 'missing'}`);
  if (!objectGuid && !objectId) throw new Error('Runtime camera binding is missing objectGuid/objectId.');
  return {
    sourceId,
    propertyPath,
    ...(objectGuid ? { objectGuid } : {}),
    ...(objectId ? { objectId } : {}),
  };
}

function findRuntimeCameraTarget(
  document: EditorSceneDocument,
  binding: Pick<RuntimeCameraEditorBinding, 'objectGuid' | 'objectId'>,
  originalGuidById: Map<string, string>,
): EditorSceneGameObject | null {
  if (binding.objectGuid) {
    const guidMatch = document.scene.gameObjects.find((gameObject) => gameObject.guid === binding.objectGuid);
    if (guidMatch) {
      if (binding.objectId && guidMatch.id !== binding.objectId) {
        throw new Error(`Runtime camera binding guid/id conflict: ${binding.objectGuid} belongs to ${guidMatch.id}, not ${binding.objectId}.`);
      }
      return guidMatch;
    }
  }

  if (!binding.objectId) return null;
  const idMatch = document.scene.gameObjects.find((gameObject) => gameObject.id === binding.objectId);
  if (!idMatch) return null;
  const originalGuid = originalGuidById.get(idMatch.id);
  if (binding.objectGuid && originalGuid && originalGuid !== binding.objectGuid) {
    throw new Error(`Runtime camera binding guid conflict for ${idMatch.id}.`);
  }
  return idMatch;
}

function createOriginalGuidById(document: EditorSceneDocument): Map<string, string> {
  const result = new Map<string, string>();
  for (const gameObject of document.scene.gameObjects) {
    const guid = readNonEmptyString(gameObject.guid);
    if (guid) result.set(gameObject.id, guid);
  }
  return result;
}

function sanitizeRuntimeCameraRig(cameraRig: SceneCameraRigConfig): SceneCameraRigConfig {
  const sanitized: SceneCameraRigConfig = {
    projection: readCameraProjection(cameraRig.projection),
    alpha: readFiniteRigNumber(cameraRig.alpha, 'alpha'),
    beta: readFiniteRigNumber(cameraRig.beta, 'beta'),
    radius: readPositiveFiniteRigNumber(cameraRig.radius, 'radius'),
    orthoSize: readPositiveFiniteRigNumber(cameraRig.orthoSize, 'orthoSize'),
    fov: readPositiveFiniteRigNumber(cameraRig.fov ?? 0.85, 'fov'),
  };

  const targetOffset = readRigVec3(cameraRig.targetOffset, 'targetOffset');
  if (targetOffset) sanitized.targetOffset = targetOffset;

  const minZ = readOptionalPositiveFiniteRigNumber(cameraRig.minZ, 'minZ');
  if (minZ != null) sanitized.minZ = minZ;
  const maxZ = readOptionalPositiveFiniteRigNumber(cameraRig.maxZ, 'maxZ');
  if (maxZ != null) sanitized.maxZ = maxZ;

  const lowerBetaLimit = readOptionalFiniteRigNumber(cameraRig.lowerBetaLimit, 'lowerBetaLimit');
  if (lowerBetaLimit != null) sanitized.lowerBetaLimit = lowerBetaLimit;
  const upperBetaLimit = readOptionalFiniteRigNumber(cameraRig.upperBetaLimit, 'upperBetaLimit');
  if (upperBetaLimit != null) sanitized.upperBetaLimit = upperBetaLimit;

  const lowerRadiusLimit = readOptionalPositiveFiniteRigNumber(cameraRig.lowerRadiusLimit, 'lowerRadiusLimit');
  if (lowerRadiusLimit != null) sanitized.lowerRadiusLimit = lowerRadiusLimit;
  const upperRadiusLimit = readOptionalPositiveFiniteRigNumber(cameraRig.upperRadiusLimit, 'upperRadiusLimit');
  if (upperRadiusLimit != null) sanitized.upperRadiusLimit = upperRadiusLimit;

  const inertia = readOptionalUnitRigNumber(cameraRig.inertia, 'inertia');
  if (inertia != null) sanitized.inertia = inertia;

  const targetScreenOffset = readRigVec2(cameraRig.targetScreenOffset, 'targetScreenOffset');
  if (targetScreenOffset) sanitized.targetScreenOffset = targetScreenOffset;

  assertCameraRigRelationships(sanitized);
  return sanitized;
}

function readCameraProjection(value: unknown): SceneCameraProjection {
  if (value == null) return 'orthographic';
  if (value === 'orthographic' || value === 'perspective') return value;
  throw new Error('Runtime camera rig projection must be orthographic or perspective.');
}

function assertCameraRigRelationships(cameraRig: SceneCameraRigConfig): void {
  if (cameraRig.minZ != null && cameraRig.maxZ != null && cameraRig.maxZ <= cameraRig.minZ) {
    throw new Error('Runtime camera rig maxZ must be greater than minZ.');
  }
  if (cameraRig.lowerBetaLimit != null && cameraRig.upperBetaLimit != null && cameraRig.upperBetaLimit < cameraRig.lowerBetaLimit) {
    throw new Error('Runtime camera rig upperBetaLimit must be greater than or equal to lowerBetaLimit.');
  }
  if (cameraRig.lowerRadiusLimit != null && cameraRig.upperRadiusLimit != null && cameraRig.upperRadiusLimit < cameraRig.lowerRadiusLimit) {
    throw new Error('Runtime camera rig upperRadiusLimit must be greater than or equal to lowerRadiusLimit.');
  }
}

function readFiniteRigNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Runtime camera rig ${label} must be a finite number.`);
  }
  return value;
}

function readOptionalFiniteRigNumber(value: unknown, label: string): number | undefined {
  if (value == null) return undefined;
  return readFiniteRigNumber(value, label);
}

function readPositiveFiniteRigNumber(value: unknown, label: string): number {
  const numberValue = readFiniteRigNumber(value, label);
  if (numberValue <= 0) throw new Error(`Runtime camera rig ${label} must be greater than 0.`);
  return numberValue;
}

function readOptionalPositiveFiniteRigNumber(value: unknown, label: string): number | undefined {
  if (value == null) return undefined;
  return readPositiveFiniteRigNumber(value, label);
}

function readOptionalUnitRigNumber(value: unknown, label: string): number | undefined {
  if (value == null) return undefined;
  const numberValue = readFiniteRigNumber(value, label);
  if (numberValue < 0 || numberValue > 1) throw new Error(`Runtime camera rig ${label} must be between 0 and 1.`);
  return numberValue;
}

function readRigVec3(value: unknown, label: string): { x: number; y: number; z: number } | undefined {
  if (value == null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Runtime camera rig ${label} must be a vector object.`);
  }
  const record = value as Record<string, unknown>;
  return {
    x: readFiniteRigNumber(record.x, `${label}.x`),
    y: readFiniteRigNumber(record.y, `${label}.y`),
    z: readFiniteRigNumber(record.z, `${label}.z`),
  };
}

function readRigVec2(value: unknown, label: string): { x: number; y: number } | undefined {
  if (value == null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Runtime camera rig ${label} must be a vector object.`);
  }
  const record = value as Record<string, unknown>;
  return {
    x: readFiniteRigNumber(record.x, `${label}.x`),
    y: readFiniteRigNumber(record.y, `${label}.y`),
  };
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
