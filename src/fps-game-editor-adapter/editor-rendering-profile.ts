import {
  collectEditorSceneRenderingAlphaIndexMigrationTargetIds,
  createPlayableBabylonRenderingCapability,
  type EditorSceneRenderingPanelLanguage,
  type EditorSceneRenderingTextureAsset,
  type PlayableBabylonRenderingSetConfigInput,
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

type EditorRenderingCapabilityOptions = {
  getTextureAssets?: () => readonly EditorSceneRenderingTextureAsset[];
};

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
    isDirty: () => isRenderingProfileDirty(),
    getPanelState: () => getEditorRenderingProfileState(),
    getTextureAssets: () => options.getTextureAssets?.() ?? [],
    getLanguage: ({ document }) => resolveEditorRenderingPanelLanguage(document),
    shadowPreview: {
      directionalLightNodeId: EDITOR_SCENE_SUN_LIGHT_ID,
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
}

export function hasEditorRenderingDraftChanges(): boolean {
  return isRenderingProfileDirty();
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
