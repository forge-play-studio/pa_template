import {
  bumpEditorSceneAuthoringSourceRevision as bumpPlayableEditorSceneAuthoringSourceRevision,
  createEditorSceneAuthoringSourceDescriptor as createPlayableEditorSceneAuthoringSourceDescriptor,
  detectEditorSceneRuntimeInputDrift as detectPlayableEditorSceneRuntimeInputDrift,
  EDITOR_SCENE_SCHEMA_VERSION,
  EDITOR_SCENE_SOURCE_ID,
  EDITOR_SCENE_SOURCE_TYPE,
  ensureEditorSceneAuthoringSource as ensurePlayableEditorSceneAuthoringSource,
  getEditorSceneAuthoringSourceRef as getPlayableEditorSceneAuthoringSourceRef,
  type EditorSceneRuntimeInputDrift,
} from '@fps-games/editor/playable-sdk';
import type { AuthoringSourceDescriptor, AuthoringSourceRef } from '@fps-games/editor-core';
import type { EditorSceneDocument } from './editor-scene-document';

export {
  EDITOR_SCENE_SCHEMA_VERSION,
  EDITOR_SCENE_SOURCE_ID,
  EDITOR_SCENE_SOURCE_TYPE,
  type EditorSceneRuntimeInputDrift,
};

export function getEditorSceneAuthoringSourceRef(document: EditorSceneDocument): AuthoringSourceRef {
  return getPlayableEditorSceneAuthoringSourceRef(document);
}

export function createEditorSceneAuthoringSourceDescriptor(
  document: EditorSceneDocument,
  filePath?: string,
): AuthoringSourceDescriptor {
  return createPlayableEditorSceneAuthoringSourceDescriptor(document, filePath);
}

export function ensureEditorSceneAuthoringSource(
  document: EditorSceneDocument,
): EditorSceneDocument {
  return ensurePlayableEditorSceneAuthoringSource(document);
}

export function bumpEditorSceneAuthoringSourceRevision(
  document: EditorSceneDocument,
): EditorSceneDocument {
  return bumpPlayableEditorSceneAuthoringSourceRevision(document);
}

export function detectEditorSceneRuntimeInputDrift(
  document: EditorSceneDocument,
  runtimeSceneConfig: unknown,
): EditorSceneRuntimeInputDrift {
  return detectPlayableEditorSceneRuntimeInputDrift(document, runtimeSceneConfig);
}
