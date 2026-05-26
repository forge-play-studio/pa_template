import type { SceneCameraRigConfig } from '../config';
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

const CAMERA_RIG_SAVE_FIELDS = ['alpha', 'beta', 'radius', 'orthoSize'] as const;

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
  return {
    alpha: readFiniteRigNumber(cameraRig.alpha, 'alpha'),
    beta: readFiniteRigNumber(cameraRig.beta, 'beta'),
    radius: readPositiveFiniteRigNumber(cameraRig.radius, 'radius'),
    orthoSize: readPositiveFiniteRigNumber(cameraRig.orthoSize, 'orthoSize'),
  };
}

function readFiniteRigNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Runtime camera rig ${label} must be a finite number.`);
  }
  return value;
}

function readPositiveFiniteRigNumber(value: unknown, label: string): number {
  const numberValue = readFiniteRigNumber(value, label);
  if (numberValue <= 0) throw new Error(`Runtime camera rig ${label} must be greater than 0.`);
  return numberValue;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
