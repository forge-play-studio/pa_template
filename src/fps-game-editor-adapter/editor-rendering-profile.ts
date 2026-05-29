import type { EditorSceneDocument } from './editor-scene-document';
import {
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

type RenderingPanelState = {
  title?: string;
  summary?: string;
  dirty?: boolean;
  status?: string;
  statusTone?: 'default' | 'success' | 'warning' | 'error';
  actions?: Array<{
    id: string;
    label: string;
    icon?: 'undo' | 'save' | 'world' | 'status';
    disabled?: boolean;
    tooltip?: string;
  }>;
  sections: Array<{
    id: string;
    title: string;
    summary?: string;
    systems: Array<Record<string, unknown>>;
  }>;
};

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
  statusTone?: 'default' | 'success' | 'warning' | 'error';
};

export function resolveEditorWorldRenderingProfile(
  document: EditorSceneDocument,
) {
  const profile = getActiveRenderingProfile();
  const sunObject = document.scene.gameObjects.find(gameObject => gameObject.id === EDITOR_SCENE_SUN_LIGHT_ID);
  return {
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
  _document: EditorSceneDocument,
): RenderingPanelState {
  return createRenderingPanelState(getActiveRenderingProfile(), getEditorRenderingProfileState());
}

export async function applyEditorRenderingPropertyChange(
  input: RenderingPropertyInput,
): Promise<RenderingPropertyChangeResult> {
  if (input.sectionId !== 'shadows') {
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
): RenderingPanelState {
  const planar = profile.shadows.planar;
  const dirty = state.dirty === true;
  const lastError = state.lastError ?? null;
  return {
    title: 'Rendering',
    summary: 'Project-level rendering settings. Shadow direction follows Directional Light.',
    dirty,
    status: lastError ?? (dirty ? 'Rendering changes are not saved yet.' : undefined),
    statusTone: lastError ? 'error' : dirty ? 'warning' : undefined,
    actions: [{
      id: 'revert-rendering',
      label: 'Revert',
      icon: 'undo',
      disabled: !dirty,
      tooltip: dirty
        ? 'Revert rendering settings to the last saved rendering.json.'
        : 'Rendering settings already match the last saved rendering.json.',
    }],
    sections: [{
      id: 'shadows',
      title: 'Shadows',
      summary: 'Global shadow systems for editor preview and runtime.',
      systems: [
        {
          id: 'planar-main',
          label: 'Planar Main',
          kind: 'planar-shadow',
          active: planar.enabled,
          summary: 'Follow Directional Light',
          properties: [
            {
              path: 'shadows.planar.enabled',
              label: 'Enabled',
              valueType: 'boolean',
              control: 'boolean',
              value: planar.enabled,
              tooltip: 'Enable the shared planar shadow system.',
              commitMode: 'immediate',
            },
            {
              path: 'shadows.planar.appearance.color',
              label: 'Color',
              valueType: 'color',
              control: 'color',
              value: planar.appearance.color,
              tooltip: 'Planar shadow RGB color. Opacity is edited separately.',
              commitMode: 'immediate',
            },
            {
              path: 'shadows.planar.appearance.color.a',
              label: 'Opacity',
              valueType: 'number',
              control: 'number',
              value: planar.appearance.color.a,
              min: 0,
              max: 1,
              step: 0.01,
              tooltip: 'Planar shadow opacity, clamped between 0 and 1.',
              commitMode: 'live',
            },
            {
              path: 'shadows.planar.plane.heightMode',
              label: 'Height Source',
              valueType: 'string',
              control: 'readonly',
              value: planar.plane.heightMode === 'receiver' ? 'Auto from Receivers' : 'Fixed Height',
              readOnly: true,
              tooltip: 'Planar shadow receiver height is resolved from matched receiver meshes when available.',
            },
            {
              path: 'shadows.planar.plane.height',
              label: 'Fallback Height',
              valueType: 'number',
              control: 'number',
              value: planar.plane.height,
              step: 0.01,
              unit: 'm',
              tooltip: 'Fallback receiver plane height, used only when no receiver mesh can be resolved.',
              commitMode: 'live',
            },
            {
              path: 'shadows.planar.plane.bias',
              label: 'Bias',
              valueType: 'number',
              control: 'number',
              value: planar.plane.bias,
              min: 0,
              step: 0.01,
              tooltip: 'Projection bias used to keep the planar shadow stable.',
              commitMode: 'live',
            },
            {
              path: 'shadows.planar.projection.footprintScale',
              label: 'Footprint Scale',
              valueType: 'number',
              control: 'number',
              value: planar.projection.footprintScale,
              min: 0,
              max: 2,
              step: 0.01,
              tooltip: 'Scale the projected footprint around the caster center; lower values reduce hard-edged mesh projection artifacts.',
              commitMode: 'live',
            },
            {
              path: 'shadows.planar.stencil.enabled',
              label: 'Stencil',
              valueType: 'boolean',
              control: 'boolean',
              value: planar.stencil.enabled,
              tooltip: 'Use stencil routing so shadows affect only receivers.',
              commitMode: 'immediate',
            },
            {
              path: 'shadows.planar.casters.excludePatterns',
              label: 'Caster Excludes',
              valueType: 'string-list',
              control: 'string-list',
              value: planar.casters.excludePatterns,
              placeholder: 'One pattern per line',
              tooltip: 'Meshes matching these patterns will not cast planar shadows.',
              commitMode: 'blur',
            },
            {
              path: 'shadows.planar.casters.rootBoundaryPatterns',
              label: 'Caster Roots',
              valueType: 'string-list',
              control: 'string-list',
              value: planar.casters.rootBoundaryPatterns,
              placeholder: 'One pattern per line',
              tooltip: 'Optional root boundary patterns for caster auto-detection.',
              commitMode: 'blur',
            },
            {
              path: 'shadows.planar.receivers.patterns',
              label: 'Receivers',
              valueType: 'string-list',
              control: 'string-list',
              value: planar.receivers.patterns,
              placeholder: 'One pattern per line',
              tooltip: 'Meshes matching these patterns can receive planar shadows.',
              commitMode: 'blur',
            },
            {
              path: 'shadows.planar.direction',
              label: 'Direction',
              valueType: 'string',
              control: 'readonly',
              value: 'Follow Directional Light',
              readOnly: true,
              tooltip: 'Shadow direction is derived from the protected Directional Light.',
            },
          ],
        },
        {
          id: 'legacy-shadow',
          label: 'Legacy Shadow',
          kind: 'legacy-shadow',
          active: profile.shadows.enabled && !planar.enabled,
          readOnly: true,
          summary: profile.shadows.enabled ? 'Compatibility path' : 'Disabled',
          properties: [
            createReadonlyProperty('shadows.enabled', 'Enabled', profile.shadows.enabled),
            createReadonlyProperty('shadows.settings.mapSize', 'Map Size', profile.shadows.settings.mapSize),
            createReadonlyProperty('shadows.settings.darkness', 'Darkness', profile.shadows.settings.darkness),
          ],
        },
        {
          id: 'csm-shadow',
          label: 'CSM',
          kind: 'csm-shadow',
          active: profile.shadows.enabled && profile.shadows.useCsm && !planar.enabled,
          readOnly: true,
          summary: profile.shadows.useCsm ? 'Compatibility path' : 'Disabled',
          properties: [
            createReadonlyProperty('shadows.useCsm', 'Enabled', profile.shadows.useCsm),
            createReadonlyProperty('shadows.csm.numCascades', 'Cascades', profile.shadows.csm.numCascades),
            createReadonlyProperty('shadows.csm.lambda', 'Lambda', profile.shadows.csm.lambda),
          ],
        },
      ],
    }],
  };
}

function createReadonlyProperty(path: string, label: string, value: unknown) {
  return {
    path,
    label,
    valueType: typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
    control: 'readonly',
    value,
    readOnly: true,
  } as const;
}
