import {
  createPlayableBabylonRenderingCapability,
  type EditorSceneRenderingPanelLanguage,
  type EditorSceneRenderingProfile,
  type EditorSceneRenderingTextureAsset,
  type PlayableBabylonRenderingSetConfigInput,
  type PlayableLocalEditorPatchResult,
  type PlayableLocalEditorRenderingCapability,
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
  previousProfile: EditorSceneRenderingProfile,
): PlayableLocalEditorPatchResult<EditorSceneDocumentPatch> | null {
  if (input.action) return null;
  const migration = resolveRenderingAlphaPresetValueMigration(input.changedPaths, previousProfile, input.change);
  if (!migration) return null;
  const targetIds = input.document.scene.gameObjects
    .filter((gameObject) => (
      readEditorSceneObjectRenderingGroupId(gameObject.rendering?.renderingGroupId) === migration.renderingGroupId
      && gameObject.rendering?.alphaIndex === migration.fromAlphaIndex
    ))
    .map(gameObject => gameObject.id);
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

function resolveRenderingAlphaPresetValueMigration(
  changedPaths: readonly string[],
  previousProfile: EditorSceneRenderingProfile,
  change: PlayableBabylonRenderingSetConfigInput<EditorSceneDocument>['change'],
): { renderingGroupId: 0 | 1 | 2 | 3; fromAlphaIndex: number; toAlphaIndex: number } | null {
  const alphaIndexPath = changedPaths.find(path => /^renderingGroups\.slots\.[0-3]\.alphaIndexPresets\.\d+\.alphaIndex$/.test(path));
  if (!alphaIndexPath) return null;
  if (change?.path !== alphaIndexPath) return null;
  const match = alphaIndexPath.match(/^renderingGroups\.slots\.([0-3])\.alphaIndexPresets\.(\d+)\.alphaIndex$/);
  if (!match) return null;
  const renderingGroupId = Number(match[1]) as 0 | 1 | 2 | 3;
  const presetIndex = Number(match[2]);
  const previousPreset = previousProfile.renderingGroups.slots
    .find(slot => slot.renderingGroupId === renderingGroupId)
    ?.alphaIndexPresets[presetIndex];
  const nextAlphaIndex = change.value;
  if (typeof nextAlphaIndex !== 'number' || !Number.isFinite(nextAlphaIndex)) return null;
  if (!previousPreset || !Number.isFinite(previousPreset.alphaIndex) || !Number.isFinite(nextAlphaIndex)) return null;
  if (previousPreset.alphaIndex === nextAlphaIndex) return null;
  return {
    renderingGroupId,
    fromAlphaIndex: previousPreset.alphaIndex,
    toAlphaIndex: nextAlphaIndex,
  };
}

function readEditorSceneObjectRenderingGroupId(value: unknown): 0 | 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3 ? value : 0;
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
