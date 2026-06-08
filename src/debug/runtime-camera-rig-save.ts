import type { SceneCameraRigConfig } from '../config';
import type {
  EditorSceneDocument,
} from '../fps-game-editor-adapter/editor-scene-document';
import {
  patchEditorSceneGameObjectField,
} from '../fps-game-editor-adapter/editor-scene-session';
import {
  patchEditorSceneRuntimeCameraRig as patchPlayableEditorSceneRuntimeCameraRig,
  type EditorSceneCameraRig,
  type EditorSceneRuntimeCameraBinding,
  type EditorSceneRuntimeCameraRigPatchResult as PlayableEditorSceneRuntimeCameraRigPatchResult,
} from '@fps-games/editor/playable-sdk';
import {
  loadSceneMainSource,
  saveSceneMainSource,
  type SceneMainSourceSaveResult,
} from '../fps-game-editor-adapter/scene-main-source-driver';

export interface RuntimeCameraEditorBinding extends EditorSceneRuntimeCameraBinding {}

export interface RuntimeCameraRigPatchResult extends PlayableEditorSceneRuntimeCameraRigPatchResult<EditorSceneDocument> {}

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
  return patchPlayableEditorSceneRuntimeCameraRig(document, binding, cameraRig as unknown as EditorSceneCameraRig, {
    expectedSourceId,
    patchCameraField: patchEditorSceneGameObjectField,
  }) as RuntimeCameraRigPatchResult;
}
