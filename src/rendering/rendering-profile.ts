import {
  normalizeEditorSceneRenderingProfile,
  summarizeEditorSceneRenderingProfile,
  type EditorSceneRenderingColorRgb,
  type EditorSceneRenderingColorRgba,
  type EditorSceneRenderingProfile,
  type EditorSceneRenderingVec3,
} from '../runtime/integrations/fps-runtime/rendering-profile';

export type RenderingVec3 = EditorSceneRenderingVec3;
export type RenderingColorRgb = EditorSceneRenderingColorRgb;
export type RenderingColorRgba = EditorSceneRenderingColorRgba;
export type NormalizedRenderingProfile = EditorSceneRenderingProfile;

export function normalizeRenderingProfile(config: unknown): NormalizedRenderingProfile {
  return normalizeEditorSceneRenderingProfile(config);
}

export function summarizeRenderingProfile(value: NormalizedRenderingProfile | null | undefined): Record<string, unknown> {
  return { ...summarizeEditorSceneRenderingProfile(value) };
}
