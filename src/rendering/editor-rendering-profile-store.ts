import renderingConfig from '../config/rendering.json';
import {
  createEditorSceneRenderingProfileDraftState,
  isEditorSceneRenderingProfileDraftDirty,
  markEditorSceneRenderingProfileDraftSaved,
  resetEditorSceneRenderingProfileDraft,
  setEditorSceneRenderingProfileDraftConfig,
  setEditorSceneRenderingProfileDraftError,
  type EditorSceneRenderingProfileDraftState,
} from '@fps-games/editor/playable-sdk';
import {
  normalizeRenderingProfile,
  type NormalizedRenderingProfile,
} from './rendering-profile';

const renderingProfileState = createEditorSceneRenderingProfileDraftState(renderingConfig);

export interface EditorRenderingProfileState extends EditorSceneRenderingProfileDraftState {}

export function getActiveRenderingConfig(): Record<string, unknown> {
  return renderingProfileState.draftConfig;
}

export function getSavedRenderingConfig(): Record<string, unknown> {
  return renderingProfileState.savedConfig;
}

export function getEditorRenderingProfileState(): EditorRenderingProfileState {
  renderingProfileState.dirty = isRenderingProfileDirty();
  return renderingProfileState;
}

export function setActiveRenderingConfig(config: unknown): void {
  setEditorSceneRenderingProfileDraftConfig(renderingProfileState, config);
}

export function markActiveRenderingConfigSaved(config: unknown = renderingProfileState.draftConfig): void {
  markEditorSceneRenderingProfileDraftSaved(renderingProfileState, config);
}

export function resetActiveRenderingConfigDraft(): void {
  resetEditorSceneRenderingProfileDraft(renderingProfileState);
}

export function setActiveRenderingConfigError(error: unknown): void {
  setEditorSceneRenderingProfileDraftError(renderingProfileState, error);
}

export function isRenderingProfileDirty(): boolean {
  renderingProfileState.dirty = isEditorSceneRenderingProfileDraftDirty(renderingProfileState);
  return renderingProfileState.dirty;
}

export function getActiveRenderingProfile(): NormalizedRenderingProfile {
  return normalizeRenderingProfile(renderingProfileState.draftConfig);
}

export function getSavedRenderingProfile(): NormalizedRenderingProfile {
  return normalizeRenderingProfile(renderingProfileState.savedConfig);
}
