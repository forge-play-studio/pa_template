import renderingConfig from '../config/rendering.json';
import {
  normalizeRenderingProfile,
  type NormalizedRenderingProfile,
} from './rendering-profile';

let savedRenderingConfig = cloneConfig(renderingConfig);
let draftRenderingConfig = cloneConfig(savedRenderingConfig);
let lastRenderingError: string | null = null;

export interface EditorRenderingProfileState {
  savedConfig: Record<string, unknown>;
  draftConfig: Record<string, unknown>;
  dirty: boolean;
  lastError: string | null;
}

export function getActiveRenderingConfig(): Record<string, unknown> {
  return draftRenderingConfig;
}

export function getSavedRenderingConfig(): Record<string, unknown> {
  return savedRenderingConfig;
}

export function getEditorRenderingProfileState(): EditorRenderingProfileState {
  return {
    savedConfig: savedRenderingConfig,
    draftConfig: draftRenderingConfig,
    dirty: isRenderingProfileDirty(),
    lastError: lastRenderingError,
  };
}

export function setActiveRenderingConfig(config: unknown): void {
  draftRenderingConfig = cloneConfig(config);
  lastRenderingError = null;
}

export function markActiveRenderingConfigSaved(config: unknown = draftRenderingConfig): void {
  savedRenderingConfig = cloneConfig(config);
  draftRenderingConfig = cloneConfig(savedRenderingConfig);
  lastRenderingError = null;
}

export function resetActiveRenderingConfigDraft(): void {
  draftRenderingConfig = cloneConfig(savedRenderingConfig);
  lastRenderingError = null;
}

export function setActiveRenderingConfigError(error: unknown): void {
  lastRenderingError = error instanceof Error ? error.message : String(error);
}

export function isRenderingProfileDirty(): boolean {
  return !configsEqual(savedRenderingConfig, draftRenderingConfig);
}

export function getActiveRenderingProfile(): NormalizedRenderingProfile {
  return normalizeRenderingProfile(draftRenderingConfig);
}

export function getSavedRenderingProfile(): NormalizedRenderingProfile {
  return normalizeRenderingProfile(savedRenderingConfig);
}

function cloneConfig(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function configsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}
