import {
  EDITOR_SCENE_DEFAULT_PLANAR_SHADOW_EXCLUDE_PATTERNS,
  EDITOR_SCENE_DEFAULT_PLANAR_SHADOW_RECEIVER_PATTERNS,
  EDITOR_SCENE_RENDERING_PROFILE_ALLOWED_PATCH_PATHS,
  applyEditorSceneRenderingProfilePatch,
  createEditorSceneBlobShadowPreviewSettings,
  createEditorScenePlanarShadowPreviewSettings,
  createEditorSceneStaticProjectedShadowPreviewSettings,
  isEditorSceneRenderingProfilePatchPath,
  normalizeEditorSceneRenderingProfile,
  summarizeEditorSceneRenderingProfile,
  type EditorSceneBlobShadowPreviewSettings,
  type EditorSceneBlobShadowPreviewSettingsInput,
  type EditorScenePlanarShadowPreviewSettings,
  type EditorScenePlanarShadowPreviewSettingsInput,
  type EditorScenePlanarShadowProfile,
  type EditorSceneRenderingColorRgb,
  type EditorSceneRenderingColorRgba,
  type EditorSceneRenderingProfile,
  type EditorSceneRenderingProfilePatchPath,
  type EditorSceneRenderingProfilePatchResult,
  type EditorSceneRenderingVec3,
  type EditorSceneStaticProjectedShadowPreviewSettings,
  type EditorSceneStaticProjectedShadowPreviewSettingsInput,
} from '@fps-games/editor/playable-sdk';

export type RenderingVec3 = EditorSceneRenderingVec3;
export type RenderingColorRgb = EditorSceneRenderingColorRgb;
export type RenderingColorRgba = EditorSceneRenderingColorRgba;
export type NormalizedPlanarShadowProfile = EditorScenePlanarShadowProfile;
export type NormalizedRenderingProfile = EditorSceneRenderingProfile;
export type BlobShadowOptionsFromRenderingProfileInput = EditorSceneBlobShadowPreviewSettingsInput;
export type BlobShadowOptionsFromRenderingProfile = EditorSceneBlobShadowPreviewSettings;
export type StaticProjectedShadowOptionsFromRenderingProfileInput = EditorSceneStaticProjectedShadowPreviewSettingsInput;
export type StaticProjectedShadowOptionsFromRenderingProfile = EditorSceneStaticProjectedShadowPreviewSettings;
export type PlanarShadowOptionsFromRenderingProfileInput = EditorScenePlanarShadowPreviewSettingsInput;
export type PlanarShadowOptionsFromRenderingProfile = EditorScenePlanarShadowPreviewSettings;
export type RenderingProfilePatchResult = EditorSceneRenderingProfilePatchResult;
export type EditorRenderingProfileAllowedPatchPath = EditorSceneRenderingProfilePatchPath;

export const DEFAULT_PLANAR_SHADOW_RECEIVER_PATTERNS = EDITOR_SCENE_DEFAULT_PLANAR_SHADOW_RECEIVER_PATTERNS;
export const DEFAULT_PLANAR_SHADOW_EXCLUDE_PATTERNS = EDITOR_SCENE_DEFAULT_PLANAR_SHADOW_EXCLUDE_PATTERNS;
export const EDITOR_RENDERING_PROFILE_ALLOWED_PATCH_PATHS = EDITOR_SCENE_RENDERING_PROFILE_ALLOWED_PATCH_PATHS;

export function normalizeRenderingProfile(config: unknown): NormalizedRenderingProfile {
  return normalizeEditorSceneRenderingProfile(config);
}

export function createPlanarShadowOptionsFromRenderingProfile(
  profile: NormalizedRenderingProfile,
  input: PlanarShadowOptionsFromRenderingProfileInput = {},
): PlanarShadowOptionsFromRenderingProfile {
  return createEditorScenePlanarShadowPreviewSettings(profile, input);
}

export function createBlobShadowOptionsFromRenderingProfile(
  profile: NormalizedRenderingProfile,
  input: BlobShadowOptionsFromRenderingProfileInput = {},
): BlobShadowOptionsFromRenderingProfile {
  return createEditorSceneBlobShadowPreviewSettings(profile, input);
}

export function createStaticProjectedShadowOptionsFromRenderingProfile(
  profile: NormalizedRenderingProfile,
  input: StaticProjectedShadowOptionsFromRenderingProfileInput = {},
): StaticProjectedShadowOptionsFromRenderingProfile {
  return createEditorSceneStaticProjectedShadowPreviewSettings(profile, input);
}

export function applyEditorRenderingProfilePatch(
  config: unknown,
  changes: Record<string, unknown>,
): RenderingProfilePatchResult {
  return applyEditorSceneRenderingProfilePatch(config, changes);
}

export function isAllowedEditorRenderingPatchPath(path: string): path is EditorRenderingProfileAllowedPatchPath {
  return isEditorSceneRenderingProfilePatchPath(path);
}

export function summarizeRenderingProfile(value: NormalizedRenderingProfile | null | undefined): Record<string, unknown> {
  return { ...summarizeEditorSceneRenderingProfile(value) };
}
