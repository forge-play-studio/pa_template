import type { PlanarShadowOptions } from '@fps-games/babylon-renderer';
import {
  EDITOR_SCENE_DEFAULT_PLANAR_SHADOW_EXCLUDE_PATTERNS,
  EDITOR_SCENE_DEFAULT_PLANAR_SHADOW_RECEIVER_PATTERNS,
  EDITOR_SCENE_RENDERING_PROFILE_ALLOWED_PATCH_PATHS,
  applyEditorSceneRenderingProfilePatch,
  createEditorScenePlanarShadowPreviewSettings,
  isEditorSceneRenderingProfilePatchPath,
  normalizeEditorSceneRenderingProfile,
  summarizeEditorSceneRenderingProfile,
  type EditorScenePlanarShadowPreviewSettingsInput,
  type EditorScenePlanarShadowProfile,
  type EditorSceneRenderingColorRgb,
  type EditorSceneRenderingColorRgba,
  type EditorSceneRenderingProfile,
  type EditorSceneRenderingProfilePatchPath,
  type EditorSceneRenderingProfilePatchResult,
  type EditorSceneRenderingVec3,
} from '@fps-games/editor/playable-sdk';

export type RenderingVec3 = EditorSceneRenderingVec3;
export type RenderingColorRgb = EditorSceneRenderingColorRgb;
export type RenderingColorRgba = EditorSceneRenderingColorRgba;
export type NormalizedPlanarShadowProfile = EditorScenePlanarShadowProfile;
export type NormalizedRenderingProfile = EditorSceneRenderingProfile;
export type PlanarShadowOptionsFromRenderingProfileInput = EditorScenePlanarShadowPreviewSettingsInput;
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
): Partial<PlanarShadowOptions> {
  return createEditorScenePlanarShadowPreviewSettings(profile, input) as Partial<PlanarShadowOptions>;
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
