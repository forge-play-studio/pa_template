/** Editor/tooling rendering-profile surface. Production runtime uses src/rendering directly. */
export * from '../../rendering/rendering-profile';
export {
  EDITOR_SCENE_RENDERING_PROFILE_ALLOWED_PATCH_PATHS as EDITOR_RENDERING_PROFILE_ALLOWED_PATCH_PATHS,
  applyEditorSceneRenderingProfilePatch as applyEditorRenderingProfilePatch,
  isEditorSceneRenderingProfilePatchPath as isAllowedEditorRenderingPatchPath,
} from '@fps-games/editor/playable-sdk';
export type {
  EditorSceneRenderingProfilePatchPath as EditorRenderingProfileAllowedPatchPath,
  EditorSceneRenderingProfilePatchResult as RenderingProfilePatchResult,
} from '@fps-games/editor/playable-sdk';
export {
  summarizeEditorSceneRenderingProfile as summarizeRenderingProfile,
} from '../../runtime/integrations/fps-runtime/rendering-profile';
