import type {
  ColorRGB,
  SceneDirectionalLightConfig,
  SceneHemisphericLightConfig,
  SceneLightConfig,
} from '../config';
import type {
  EditorSceneDocument,
  EditorSceneGameObject,
  EditorSceneVec3,
} from '../fps-game-editor-adapter/editor-scene-document';
import {
  ensureEditorSceneGameObjectGuids,
  isEditorSceneLightGameObject,
  patchEditorSceneGameObjectField,
} from '../fps-game-editor-adapter/editor-scene-session';
import {
  loadSceneMainSource,
  saveSceneMainSource,
  type SceneMainSourceSaveResult,
} from '../fps-game-editor-adapter/scene-main-source-driver';
import { normalizeDirectionVector } from '../fps-game-editor-adapter/editor-lighting-utils';

export interface RuntimeLightEditorBinding {
  sourceId: string;
  objectGuid?: string;
  objectId?: string;
  propertyPath: 'light' | string;
  lightType?: SceneLightConfig['type'] | string;
}

export type RuntimeLightingPatch =
  | {
      binding: RuntimeLightEditorBinding;
      enabled: boolean;
      light: SceneHemisphericLightConfig;
    }
  | {
      binding: RuntimeLightEditorBinding;
      enabled: boolean;
      light: SceneDirectionalLightConfig;
    };

export interface RuntimeLightingPatchResult {
  document: EditorSceneDocument;
  targets: Array<{
    id: string;
    objectGuid?: string;
    lightType: SceneLightConfig['type'];
  }>;
}

export interface RuntimeLightingSaveResult extends RuntimeLightingPatchResult {
  saved: SceneMainSourceSaveResult;
}

export async function saveRuntimeLightsToEditorScene(
  patches: RuntimeLightingPatch[],
): Promise<RuntimeLightingSaveResult> {
  const loaded = await loadSceneMainSource();
  const patched = patchRuntimeLightsInEditorScene(loaded.document, patches, loaded.source.ref.sourceId);
  const saved = await saveSceneMainSource(patched.document, { mode: 'local-commit-save' });
  return {
    ...patched,
    document: saved.document,
    saved,
  };
}

export function patchRuntimeLightsInEditorScene(
  document: EditorSceneDocument,
  patches: RuntimeLightingPatch[],
  expectedSourceId?: string,
): RuntimeLightingPatchResult {
  const originalGuidById = createOriginalGuidById(document);
  let nextDocument = ensureEditorSceneGameObjectGuids(document);
  const targets: RuntimeLightingPatchResult['targets'] = [];

  for (const patch of patches) {
    const sanitizedPatch = sanitizeRuntimeLightingPatch(patch);
    const binding = normalizeRuntimeLightEditorBinding(sanitizedPatch.binding);
    if (expectedSourceId && binding.sourceId !== expectedSourceId) {
      throw new Error(`Runtime light binding source mismatch: ${binding.sourceId} !== ${expectedSourceId}`);
    }

    const target = findRuntimeLightTarget(nextDocument, binding, originalGuidById);
    if (!target) {
      throw new Error('Runtime light binding did not match an editor light object.');
    }
    assertRuntimeLightTarget(target, sanitizedPatch.light.type, binding);

    nextDocument = patchEditorSceneGameObjectField(nextDocument, target.id, 'enabled', sanitizedPatch.enabled);
    nextDocument = patchEditorSceneGameObjectField(nextDocument, target.id, 'light.intensity', sanitizedPatch.light.intensity);
    if (sanitizedPatch.light.diffuseColor) {
      nextDocument = patchEditorSceneGameObjectField(nextDocument, target.id, 'light.diffuseColor', sanitizedPatch.light.diffuseColor);
    }

    if (sanitizedPatch.light.type === 'hemispheric') {
      if (sanitizedPatch.light.groundColor) {
        nextDocument = patchEditorSceneGameObjectField(nextDocument, target.id, 'light.groundColor', sanitizedPatch.light.groundColor);
      }
    } else {
      nextDocument = patchEditorSceneGameObjectField(nextDocument, target.id, 'light.direction', sanitizedPatch.light.direction);
    }

    targets.push({
      id: target.id,
      ...(target.guid ? { objectGuid: target.guid } : {}),
      lightType: sanitizedPatch.light.type,
    });
  }

  return {
    document: nextDocument,
    targets,
  };
}

function normalizeRuntimeLightEditorBinding(
  binding: RuntimeLightEditorBinding,
): Required<Pick<RuntimeLightEditorBinding, 'sourceId' | 'propertyPath'>> & Pick<RuntimeLightEditorBinding, 'objectGuid' | 'objectId' | 'lightType'> {
  const sourceId = readNonEmptyString(binding.sourceId);
  const propertyPath = readNonEmptyString(binding.propertyPath);
  const objectGuid = readNonEmptyString(binding.objectGuid);
  const objectId = readNonEmptyString(binding.objectId);
  const lightType = readNonEmptyString(binding.lightType);
  if (!sourceId) throw new Error('Runtime light binding is missing sourceId.');
  if (propertyPath !== 'light') throw new Error(`Runtime light binding is not for light: ${propertyPath ?? 'missing'}`);
  if (!objectGuid && !objectId) throw new Error('Runtime light binding is missing objectGuid/objectId.');
  return {
    sourceId,
    propertyPath,
    ...(objectGuid ? { objectGuid } : {}),
    ...(objectId ? { objectId } : {}),
    ...(lightType ? { lightType } : {}),
  };
}

function findRuntimeLightTarget(
  document: EditorSceneDocument,
  binding: Pick<RuntimeLightEditorBinding, 'objectGuid' | 'objectId'>,
  originalGuidById: Map<string, string>,
): EditorSceneGameObject | null {
  if (binding.objectGuid) {
    const guidMatch = document.scene.gameObjects.find((gameObject) => gameObject.guid === binding.objectGuid);
    if (guidMatch) {
      if (binding.objectId && guidMatch.id !== binding.objectId) {
        throw new Error(`Runtime light binding guid/id conflict: ${binding.objectGuid} belongs to ${guidMatch.id}, not ${binding.objectId}.`);
      }
      return guidMatch;
    }
  }

  if (!binding.objectId) return null;
  const idMatch = document.scene.gameObjects.find((gameObject) => gameObject.id === binding.objectId);
  if (!idMatch) return null;
  const originalGuid = originalGuidById.get(idMatch.id);
  if (binding.objectGuid && originalGuid && originalGuid !== binding.objectGuid) {
    throw new Error(`Runtime light binding guid conflict for ${idMatch.id}.`);
  }
  return idMatch;
}

function assertRuntimeLightTarget(
  target: EditorSceneGameObject,
  lightType: SceneLightConfig['type'],
  binding: Pick<RuntimeLightEditorBinding, 'lightType'>,
): void {
  if (!isEditorSceneLightGameObject(target)) {
    throw new Error(`Runtime light binding target is not a light object: ${target.id}`);
  }
  if (!target.light) {
    throw new Error(`Runtime light binding target is missing light config: ${target.id}`);
  }
  if (target.light.type !== lightType) {
    throw new Error(`Runtime light binding type mismatch for ${target.id}: ${target.light.type} !== ${lightType}`);
  }
  if (binding.lightType && binding.lightType !== lightType) {
    throw new Error(`Runtime light binding metadata type mismatch: ${binding.lightType} !== ${lightType}`);
  }
}

function sanitizeRuntimeLightingPatch(patch: RuntimeLightingPatch): RuntimeLightingPatch {
  const enabled = readRuntimeBoolean(patch.enabled, 'enabled');
  if (patch.light.type === 'hemispheric') {
    return {
      binding: patch.binding,
      enabled,
      light: sanitizeRuntimeHemisphericLight(patch.light),
    };
  }
  return {
    binding: patch.binding,
    enabled,
    light: sanitizeRuntimeDirectionalLight(patch.light),
  };
}

function sanitizeRuntimeHemisphericLight(light: SceneHemisphericLightConfig): SceneHemisphericLightConfig {
  if (light.type !== 'hemispheric') throw new Error('Runtime light patch must be hemispheric.');
  return {
    type: 'hemispheric',
    intensity: readNonNegativeRuntimeNumber(light.intensity, 'hemispheric.intensity'),
    ...(light.diffuseColor ? { diffuseColor: readRuntimeColor(light.diffuseColor, 'hemispheric.diffuseColor') } : {}),
    ...(light.groundColor ? { groundColor: readRuntimeColor(light.groundColor, 'hemispheric.groundColor') } : {}),
  };
}

function sanitizeRuntimeDirectionalLight(light: SceneDirectionalLightConfig): SceneDirectionalLightConfig {
  if (light.type !== 'directional') throw new Error('Runtime light patch must be directional.');
  return {
    type: 'directional',
    intensity: readNonNegativeRuntimeNumber(light.intensity, 'directional.intensity'),
    direction: normalizeDirectionVector(readRuntimeVec3(light.direction, 'directional.direction')) as EditorSceneVec3,
    ...(light.diffuseColor ? { diffuseColor: readRuntimeColor(light.diffuseColor, 'directional.diffuseColor') } : {}),
  };
}

function createOriginalGuidById(document: EditorSceneDocument): Map<string, string> {
  const result = new Map<string, string>();
  for (const gameObject of document.scene.gameObjects) {
    const guid = readNonEmptyString(gameObject.guid);
    if (guid) result.set(gameObject.id, guid);
  }
  return result;
}

function readRuntimeBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Runtime light ${label} must be a boolean.`);
  return value;
}

function readNonNegativeRuntimeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Runtime light ${label} must be a non-negative finite number.`);
  }
  return value;
}

function readRuntimeColor(value: ColorRGB, label: string): ColorRGB {
  return {
    r: readFiniteRuntimeNumber(value.r, `${label}.r`),
    g: readFiniteRuntimeNumber(value.g, `${label}.g`),
    b: readFiniteRuntimeNumber(value.b, `${label}.b`),
  };
}

function readRuntimeVec3(value: EditorSceneVec3, label: string): EditorSceneVec3 {
  return {
    x: readFiniteRuntimeNumber(value.x, `${label}.x`),
    y: readFiniteRuntimeNumber(value.y, `${label}.y`),
    z: readFiniteRuntimeNumber(value.z, `${label}.z`),
  };
}

function readFiniteRuntimeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Runtime light ${label} must be a finite number.`);
  }
  return value;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
