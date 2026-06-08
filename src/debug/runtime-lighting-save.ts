import type {
  SceneLightConfig,
} from '../config';
import {
  patchEditorSceneRuntimeLights as patchPlayableEditorSceneRuntimeLights,
  type EditorSceneRuntimeLightingPatch as PlayableEditorSceneRuntimeLightingPatch,
} from '@fps-games/editor/playable-sdk';
import type {
  EditorSceneDocument,
} from '../fps-game-editor-adapter/editor-scene-document';
import {
  patchEditorSceneGameObjectField,
} from '../fps-game-editor-adapter/editor-scene-session';
import {
  loadSceneMainSource,
  saveSceneMainSource,
  type SceneMainSourceSaveResult,
} from '../fps-game-editor-adapter/scene-main-source-driver';

export type RuntimeLightEditorBinding = PlayableEditorSceneRuntimeLightingPatch['binding'];
export type RuntimeLightingPatch = PlayableEditorSceneRuntimeLightingPatch;

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
  return patchPlayableEditorSceneRuntimeLights(document, patches, {
    expectedSourceId,
    patchLightField: (targetDocument, targetId, path, value) => (
      patchEditorSceneGameObjectField(targetDocument as EditorSceneDocument, targetId, path, value)
    ),
  }) as RuntimeLightingPatchResult;
}
