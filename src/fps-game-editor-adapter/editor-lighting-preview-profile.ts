import {
  resolveEditorSceneLightingPreviewProfile,
  type EditorSceneLightingPreviewProfile as EditorLightingPreviewProfile,
} from '@fps-games/editor/playable-sdk';
import type {
  EditorSceneDocument,
} from './editor-scene-document';
import {
  DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT,
  DEFAULT_EDITOR_SCENE_SUN_LIGHT,
  EDITOR_SCENE_ENVIRONMENT_LIGHT_ID,
  EDITOR_SCENE_SUN_LIGHT_ID,
} from './editor-scene-session';

export type { EditorLightingPreviewProfile };

export function resolveEditorLightingPreviewProfile(
  document: EditorSceneDocument,
): EditorLightingPreviewProfile {
  return resolveEditorSceneLightingPreviewProfile(document, {
    environmentLightId: EDITOR_SCENE_ENVIRONMENT_LIGHT_ID,
    sunLightId: EDITOR_SCENE_SUN_LIGHT_ID,
    defaultEnvironmentLight: DEFAULT_EDITOR_SCENE_ENVIRONMENT_LIGHT,
    defaultSunLight: DEFAULT_EDITOR_SCENE_SUN_LIGHT,
  });
}
