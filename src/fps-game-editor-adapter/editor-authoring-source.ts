import type { AuthoringSourceDescriptor, AuthoringSourceRef } from '@fps-games/editor-core';
import type { EditorSceneDocument } from './editor-scene-document';

export const EDITOR_SCENE_SOURCE_ID = 'scene.main';
export const EDITOR_SCENE_SOURCE_TYPE = 'scene';
export const EDITOR_SCENE_SCHEMA_VERSION = 1;

export function getEditorSceneAuthoringSourceRef(document: EditorSceneDocument): AuthoringSourceRef {
  const existing = document.meta?.authoringSource;
  return {
    sourceId: existing?.sourceId || EDITOR_SCENE_SOURCE_ID,
    sourceType: existing?.sourceType || EDITOR_SCENE_SOURCE_TYPE,
    revision: typeof existing?.revision === 'number' ? existing.revision : 1,
  };
}

export function createEditorSceneAuthoringSourceDescriptor(
  document: EditorSceneDocument,
  filePath?: string,
): AuthoringSourceDescriptor {
  return {
    ref: getEditorSceneAuthoringSourceRef(document),
    filePath,
    schemaVersion: EDITOR_SCENE_SCHEMA_VERSION,
    capabilities: {
      editable: true,
      compilable: true,
      runtimeApply: true,
      aiWritable: true,
    },
  };
}

export function ensureEditorSceneAuthoringSource(
  document: EditorSceneDocument,
): EditorSceneDocument {
  const ref = getEditorSceneAuthoringSourceRef(document);
  return {
    ...document,
    meta: {
      ...document.meta,
      authoringSource: {
        sourceId: EDITOR_SCENE_SOURCE_ID,
        sourceType: EDITOR_SCENE_SOURCE_TYPE,
        revision: ref.revision ?? 1,
      },
    },
  };
}

export function bumpEditorSceneAuthoringSourceRevision(
  document: EditorSceneDocument,
): EditorSceneDocument {
  const current = getEditorSceneAuthoringSourceRef(document);
  return {
    ...document,
    meta: {
      ...document.meta,
      authoringSource: {
        sourceId: EDITOR_SCENE_SOURCE_ID,
        sourceType: EDITOR_SCENE_SOURCE_TYPE,
        revision: (current.revision ?? 0) + 1,
      },
    },
  };
}

export interface EditorSceneRuntimeInputDrift {
  detected: boolean;
  sourceId: string;
  sourceType: string;
  sourceRevision: number | null;
  generatedRevision: number | null;
  reason?: 'missing-generated-from' | 'source-mismatch' | 'revision-mismatch';
}

export function detectEditorSceneRuntimeInputDrift(
  document: EditorSceneDocument,
  runtimeSceneConfig: unknown,
): EditorSceneRuntimeInputDrift {
  const sourceRef = getEditorSceneAuthoringSourceRef(document);
  const generatedFrom = readGeneratedFrom(runtimeSceneConfig);
  const sourceRevision = sourceRef.revision ?? null;
  if (!generatedFrom) {
    return {
      detected: true,
      sourceId: sourceRef.sourceId,
      sourceType: sourceRef.sourceType,
      sourceRevision,
      generatedRevision: null,
      reason: 'missing-generated-from',
    };
  }
  const generatedRevision = typeof generatedFrom.revision === 'number' ? generatedFrom.revision : null;
  if (generatedFrom.sourceId !== sourceRef.sourceId || generatedFrom.sourceType !== sourceRef.sourceType) {
    return {
      detected: true,
      sourceId: sourceRef.sourceId,
      sourceType: sourceRef.sourceType,
      sourceRevision,
      generatedRevision,
      reason: 'source-mismatch',
    };
  }
  if (sourceRevision !== generatedRevision) {
    return {
      detected: true,
      sourceId: sourceRef.sourceId,
      sourceType: sourceRef.sourceType,
      sourceRevision,
      generatedRevision,
      reason: 'revision-mismatch',
    };
  }
  return {
    detected: false,
    sourceId: sourceRef.sourceId,
    sourceType: sourceRef.sourceType,
    sourceRevision,
    generatedRevision,
  };
}

function readGeneratedFrom(runtimeSceneConfig: unknown): AuthoringSourceRef | null {
  if (!runtimeSceneConfig || typeof runtimeSceneConfig !== 'object') return null;
  const meta = (runtimeSceneConfig as { meta?: unknown }).meta;
  if (!meta || typeof meta !== 'object') return null;
  const generatedFrom = (meta as { generatedFrom?: unknown }).generatedFrom;
  if (!generatedFrom || typeof generatedFrom !== 'object') return null;
  const sourceId = (generatedFrom as { sourceId?: unknown }).sourceId;
  const sourceType = (generatedFrom as { sourceType?: unknown }).sourceType;
  if (typeof sourceId !== 'string' || typeof sourceType !== 'string') return null;
  return {
    sourceId,
    sourceType: sourceType as AuthoringSourceRef['sourceType'],
    revision: typeof (generatedFrom as { revision?: unknown }).revision === 'number'
      ? (generatedFrom as { revision: number }).revision
      : undefined,
  };
}
