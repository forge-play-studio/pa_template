import {
  resolveBabylonDefaultPostProcessVolumeStack,
  createEditorSceneRenderingPanelState,
  type EditorSceneRenderingPanelLanguage,
  type EditorSceneRenderingPanelState,
  type EditorSceneRenderingStatusTone,
} from '@fps-games/editor/playable-sdk';
import type { EditorSceneDocument } from './editor-scene-document';
import {
  EDITOR_SCENE_MAIN_CAMERA_ID,
  EDITOR_SCENE_SUN_LIGHT_ID,
} from './editor-scene-session';
import {
  applyEditorRenderingProfilePatch,
  createPlanarShadowOptionsFromRenderingProfile,
  type NormalizedRenderingProfile,
} from '../rendering/rendering-profile';
import {
  getActiveRenderingConfig,
  getActiveRenderingProfile,
  getEditorRenderingProfileState,
  isRenderingProfileDirty,
  resetActiveRenderingConfigDraft,
  setActiveRenderingConfig,
} from '../rendering/editor-rendering-profile-store';

type RenderingPanelState = EditorSceneRenderingPanelState;

type RenderingPropertyInput = {
  document: EditorSceneDocument;
  sectionId: string;
  systemId: string;
  path: string;
  value: unknown;
};

type RenderingActionInput = {
  document: EditorSceneDocument;
  actionId: string;
};

type RenderingPropertyChangeResult = {
  changed?: boolean;
  refreshWorldRendering?: boolean;
  dirty?: boolean;
  status?: string;
  statusTone?: EditorSceneRenderingStatusTone;
};

export function resolveEditorWorldRenderingProfile(
  document: EditorSceneDocument,
) {
  const profile = getActiveRenderingProfile();
  const sunObject = document.scene.gameObjects.find(gameObject => gameObject.id === EDITOR_SCENE_SUN_LIGHT_ID);
  return {
    postProcess: resolveBabylonDefaultPostProcessVolumeStack(getActiveRenderingConfig()).profile,
    shadowPreview: {
      planar: {
        ...createPlanarShadowOptionsFromRenderingProfile(profile, {
          enabled: sunObject?.active !== false,
        }),
        directionalLightNodeId: EDITOR_SCENE_SUN_LIGHT_ID,
      },
    },
  };
}

export function getEditorRenderingPanelState(
  document: EditorSceneDocument,
): RenderingPanelState {
  return createRenderingPanelState(
    getActiveRenderingProfile(),
    getEditorRenderingProfileState(),
    resolveEditorRenderingPanelLanguage(document),
  );
}

export async function applyEditorRenderingPropertyChange(
  input: RenderingPropertyInput,
): Promise<RenderingPropertyChangeResult> {
  if (input.sectionId !== 'shadows' && input.sectionId !== 'post-process') {
    return {
      changed: false,
      status: `Unsupported rendering section: ${input.sectionId}`,
      statusTone: 'warning',
    };
  }
  const patch = applyEditorRenderingProfilePatch(getActiveRenderingConfig(), {
    [input.path]: input.value,
  });
  if (patch.changedPaths.length === 0) {
    return {
      changed: false,
      status: `Unsupported rendering field: ${input.path}`,
      statusTone: 'warning',
    };
  }
  setActiveRenderingConfig(patch.config);
  const dirty = isRenderingProfileDirty();
  return {
    changed: true,
    refreshWorldRendering: true,
    dirty,
    status: `Rendering draft updated: ${input.path}`,
    statusTone: dirty ? 'warning' : 'success',
  };
}

export async function applyEditorRenderingAction(
  input: RenderingActionInput,
): Promise<RenderingPropertyChangeResult> {
  if (input.actionId !== 'revert-rendering') {
    return {
      changed: false,
      status: `Unsupported rendering action: ${input.actionId}`,
      statusTone: 'warning',
    };
  }
  if (!isRenderingProfileDirty()) {
    return {
      changed: false,
      status: 'Rendering already matches saved settings.',
      statusTone: 'default',
    };
  }
  resetActiveRenderingConfigDraft();
  return {
    changed: true,
    refreshWorldRendering: true,
    dirty: false,
    status: 'Rendering draft reverted to saved settings.',
    statusTone: 'success',
  };
}

export function resetEditorRenderingDraft(): void {
  resetActiveRenderingConfigDraft();
}

export function hasEditorRenderingDraftChanges(): boolean {
  return isRenderingProfileDirty();
}

export function createRenderingPanelState(
  profile: NormalizedRenderingProfile,
  state: { dirty?: boolean; lastError?: string | null } = {},
  language: EditorSceneRenderingPanelLanguage = 'zh',
): RenderingPanelState {
  const panel = createEditorSceneRenderingPanelState(profile, state, { language });
  const revertAction = panel.actions?.find(action => action.id === 'revert-rendering');
  if (revertAction) {
    revertAction.tooltip = language === 'en'
      ? state.dirty === true
        ? 'Revert rendering settings to the last saved rendering.json.'
        : 'Rendering settings already match the last saved rendering.json.'
      : state.dirty === true
        ? '还原到上一次保存的 rendering.json。'
        : '当前渲染设置已经和上一次保存的 rendering.json 一致。';
  }
  return panel;
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
