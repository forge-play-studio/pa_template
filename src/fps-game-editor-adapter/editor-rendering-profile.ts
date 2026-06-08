import {
  createPlayableBabylonRenderingCapability,
  type EditorSceneRenderingPanelLanguage,
  type EditorSceneRenderingTextureAsset,
  type PlayableLocalEditorRenderingCapability,
} from '@fps-games/editor/playable-sdk';
import type { EditorSceneDocument } from './editor-scene-document';
import {
  EDITOR_SCENE_MAIN_CAMERA_ID,
  EDITOR_SCENE_SUN_LIGHT_ID,
} from './editor-scene-session';
import {
  getActiveRenderingConfig,
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
): PlayableLocalEditorRenderingCapability<EditorSceneDocument> {
  return createPlayableBabylonRenderingCapability<EditorSceneDocument>({
    getConfig: () => getActiveRenderingConfig(),
    setConfig: ({ config }) => setActiveRenderingConfig(config),
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
