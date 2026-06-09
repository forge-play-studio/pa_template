import {
  collectEditorSceneRenderingAlphaIndexMigrationTargetIds,
  createPlayableBabylonRenderingCapability,
  createEditorSceneStaticShadowArtifactDraftStore,
  type EditorSceneStaticShadowArtifact,
  type EditorSceneRenderingPanelLanguage,
  type EditorSceneRenderingTextureAsset,
  type PlayableBabylonRenderingSetConfigInput,
  type PlayableBabylonPlanarShadowPolicyInput,
  type PlayableLocalEditorPatchResult,
  type PlayableLocalEditorRenderingCapability,
  resolveEditorSceneRenderingAlphaIndexPresetValueMigration,
} from '@fps-games/editor/playable-sdk';
import type { EditorSceneDocument } from './editor-scene-document';
import {
  EDITOR_SCENE_MAIN_CAMERA_ID,
  EDITOR_SCENE_SUN_LIGHT_ID,
  type EditorSceneDocumentPatch,
} from './editor-scene-session';
import {
  getActiveRenderingConfig,
  getActiveRenderingProfile,
  getEditorRenderingProfileState,
  isRenderingProfileDirty,
  resetActiveRenderingConfigDraft,
  setActiveRenderingConfig,
} from '../rendering/editor-rendering-profile-store';
import { configService } from '../config/ConfigService';

type EditorRenderingCapabilityOptions = {
  getTextureAssets?: () => readonly EditorSceneRenderingTextureAsset[];
};

const staticShadowArtifactDraft = createEditorSceneStaticShadowArtifactDraftStore(configService.getStaticShadowArtifact());

export function createEditorRenderingCapability(
  options: EditorRenderingCapabilityOptions = {},
): PlayableLocalEditorRenderingCapability<EditorSceneDocument, EditorSceneDocumentPatch> {
  return createPlayableBabylonRenderingCapability<EditorSceneDocument, EditorSceneDocumentPatch>({
    getConfig: () => getActiveRenderingConfig(),
    setConfig: input => {
      const previousProfile = getActiveRenderingProfile();
      setActiveRenderingConfig(input.config);
      const documentPatch = createRenderingAlphaPresetMigrationDocumentPatch(input, previousProfile);
      return documentPatch ? { documentPatch } : undefined;
    },
    resetConfig: () => resetActiveRenderingConfigDraft(),
    isDirty: () => isRenderingProfileDirty() || isStaticShadowArtifactDirty(),
    getPanelState: () => getEditorRenderingProfileState(),
    getTextureAssets: () => options.getTextureAssets?.() ?? [],
    getLanguage: ({ document }) => resolveEditorRenderingPanelLanguage(document),
    getStaticShadowArtifact: () => getActiveStaticShadowArtifact(),
    setStaticShadowArtifact: ({ artifact }) => setActiveStaticShadowArtifact(artifact),
    shadowPreview: {
      directionalLightNodeId: EDITOR_SCENE_SUN_LIGHT_ID,
      planar: () => createProjectPlanarShadowPolicyInput(),
      enabled: ({ document }) => {
        const sunObject = document.scene.gameObjects.find(gameObject => gameObject.id === EDITOR_SCENE_SUN_LIGHT_ID);
        return sunObject?.active !== false;
      },
    },
  });
}

function createRenderingAlphaPresetMigrationDocumentPatch(
  input: PlayableBabylonRenderingSetConfigInput<EditorSceneDocument>,
  previousProfile: ReturnType<typeof getActiveRenderingProfile>,
): PlayableLocalEditorPatchResult<EditorSceneDocumentPatch> | null {
  if (input.action) return null;
  const migration = resolveEditorSceneRenderingAlphaIndexPresetValueMigration({
    changedPaths: input.changedPaths,
    previousProfile,
    change: input.change,
  });
  if (!migration) return null;
  const targetIds = collectEditorSceneRenderingAlphaIndexMigrationTargetIds(
    input.document.scene.gameObjects,
    {
      renderingGroupId: migration.renderingGroupId,
      fromAlphaIndex: migration.fromAlphaIndex,
    },
  );
  if (targetIds.length === 0) return null;
  return {
    label: `Migrate rendering alphaIndex ${migration.fromAlphaIndex} to ${migration.toAlphaIndex}`,
    patch: {
      kind: 'game-object.rendering-alpha-index-migration',
      targetIds,
      renderingGroupId: migration.renderingGroupId,
      fromAlphaIndex: migration.fromAlphaIndex,
      toAlphaIndex: migration.toAlphaIndex,
    },
    changedIds: targetIds,
    reprojectIds: targetIds,
  };
}

export function resetEditorRenderingDraft(): void {
  resetActiveRenderingConfigDraft();
  staticShadowArtifactDraft.reset();
}

export function hasEditorRenderingDraftChanges(): boolean {
  return isRenderingProfileDirty() || isStaticShadowArtifactDirty();
}

export function getActiveStaticShadowArtifact(): EditorSceneStaticShadowArtifact | null {
  return staticShadowArtifactDraft.get();
}

export function setActiveStaticShadowArtifact(value: unknown): void {
  staticShadowArtifactDraft.set(value);
}

export function markActiveStaticShadowArtifactSaved(value: unknown = staticShadowArtifactDraft.get()): void {
  staticShadowArtifactDraft.markSaved(value);
}

export function isStaticShadowArtifactDirty(): boolean {
  return staticShadowArtifactDraft.isDirty();
}

function resolveEditorRenderingPanelLanguage(
  document: EditorSceneDocument,
): EditorSceneRenderingPanelLanguage {
  const sunLight = document.scene.gameObjects.find(gameObject => gameObject.id === EDITOR_SCENE_SUN_LIGHT_ID);
  if (sunLight?.light?.inspectorLanguage === 'en') return 'en';
  if (sunLight?.light?.inspectorLanguage === 'zh') return 'zh';
  const mainCamera = document.scene.gameObjects.find(gameObject => gameObject.id === EDITOR_SCENE_MAIN_CAMERA_ID);
  if (mainCamera?.camera?.inspectorLanguage === 'en') return 'en';
  return 'zh';
}

function createProjectPlanarShadowPolicyInput(): PlayableBabylonPlanarShadowPolicyInput {
  const rootPatterns = getProjectPlanarShadowRootPatterns();
  return {
    autoDetectAllCasters: false,
    additionalCasterIncludePatterns: rootPatterns,
    additionalRootBoundaryPatterns: rootPatterns,
  };
}

function getProjectPlanarShadowRootPatterns(): string[] {
  const sceneRootId = configService.getSceneRootId();
  return Array.from(new Set([sceneRootId, 'scene_builder_root'].filter(Boolean)));
}
