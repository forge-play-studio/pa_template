/**
 * Runtime lighting debug panel.
 * Last updated: 2026-07-05.
 *
 * This file remains in `src/debug` because it renders dev-only lighting
 * controls against the live game runtime. It does not own editor scene
 * persistence: saving lighting authoring data composes SDK patch helpers with
 * the product scene-source services below.
 */
import type { ColorRGB } from '../config';
import type { Game } from '../core/Game';
import {
  mountEditorRuntimeLightingDebugPanel,
  patchEditorSceneRuntimeLights,
  readEditorSceneLightingProjectedLengthMultiplier,
  readEditorSceneRuntimeLightBinding,
  toEditorSceneRuntimeLightingPatches,
  type EditorRuntimeLightingDebugPanel,
  type EditorSceneLightingDebugSnapshot as LightingDebugSnapshot,
  type EditorSceneRuntimeShadowMode as RuntimeShadowMode,
  type EditorSceneRuntimeLightingPatch,
} from '@fps-games/editor/playable-sdk';
import { patchEditorSceneGameObjectField } from '../services/fps-game-editor/scene-feature';
import { loadSceneMainSource, saveSceneMainSource } from '../services/fps-game-editor/scene-feature';
import { mountRuntimeDebugPanelContainer } from './framework/panel-layout';

export interface RuntimeLightingDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export type RuntimeLightingDebugPanel = EditorRuntimeLightingDebugPanel;
export type RuntimeLightEditorBinding = EditorSceneRuntimeLightingPatch['binding'];

async function saveRuntimeLightsToEditorScene(patches: EditorSceneRuntimeLightingPatch[]) {
  const loaded = await loadSceneMainSource();
  const patched = patchEditorSceneRuntimeLights(loaded.document, patches, {
    expectedSourceId: loaded.source.ref.sourceId,
    patchLightField: patchEditorSceneGameObjectField,
  });
  const saved = await saveSceneMainSource(patched.document, { mode: 'local-commit-save' });
  return { ...patched, document: saved.document, saved };
}

export function mountRuntimeLightingDebugPanel(options: RuntimeLightingDebugPanelOptions): RuntimeLightingDebugPanel {
  const root = options.root ?? document.body;
  const host = root.ownerDocument.createElement('div');
  host.id = 'runtime-lighting-debug-panel';
  host.setAttribute('aria-label', 'Light');
  const unmountHost = mountRuntimeDebugPanelContainer(root, host, { placement: 'right-rail' });
  const panel = mountEditorRuntimeLightingDebugPanel({
    root: host,
    panelMode: 'managed',
    readSnapshot: () => readSnapshot(options.getGame()),
    applySnapshot: snapshot => applySnapshot(options.getGame(), snapshot),
    saveSnapshot: snapshot => saveRuntimeLightsToEditorScene(toEditorSceneRuntimeLightingPatches(snapshot)),
    reloadAfterSave: true,
    placement: {
      width: '100%',
    },
  } as Parameters<typeof mountEditorRuntimeLightingDebugPanel>[0] & { panelMode: 'managed' });
  return {
    dispose() {
      panel.dispose();
      unmountHost();
    },
  };
}

function applySnapshot(game: Game | null, snapshot: LightingDebugSnapshot): void {
  const sceneBuilder = game?.getSceneBuilder();
  if (!sceneBuilder) return;
  sceneBuilder.applyHemisphericLight(snapshot.environment.light, { enabled: snapshot.environment.enabled });
  sceneBuilder.applyDirectionalLight(snapshot.directional.light, { enabled: snapshot.directional.enabled });
}

function readSnapshot(game: Game | null): LightingDebugSnapshot | null {
  const sceneBuilder = game?.getSceneBuilder();
  if (!sceneBuilder) return null;
  const environmentState = sceneBuilder.getSelectedHemisphericLightState();
  const directionalState = sceneBuilder.getSelectedDirectionalLightState();
  const environmentLight = sceneBuilder.getRuntimeHemisphericLight();
  const directionalLight = sceneBuilder.getRuntimeDirectionalLight();
  if (!environmentLight || !directionalLight) return null;
  const direction = {
    x: readFiniteNumber(directionalLight.direction?.x, directionalState.light.direction.x),
    y: readFiniteNumber(directionalLight.direction?.y, directionalState.light.direction.y),
    z: readFiniteNumber(directionalLight.direction?.z, directionalState.light.direction.z),
  };
  return {
    environment: {
      enabled: environmentLight.isEnabled?.() ?? environmentState.enabled,
      light: {
        type: 'hemispheric',
        intensity: readFiniteNumber(environmentLight.intensity, environmentState.light.intensity),
        diffuseColor: color3ToColor(environmentLight.diffuse, environmentState.light.diffuseColor ?? { r: 1, g: 1, b: 1 }),
        groundColor: color3ToColor(environmentLight.groundColor, environmentState.light.groundColor ?? { r: 0.48, g: 0.52, b: 0.62 }),
      },
      binding: readEditorSceneRuntimeLightBinding(environmentLight.metadata, 'hemispheric') as RuntimeLightEditorBinding | null,
    },
    directional: {
      enabled: directionalLight.isEnabled?.() ?? directionalState.enabled,
      light: {
        type: 'directional',
        intensity: readFiniteNumber(directionalLight.intensity, directionalState.light.intensity),
        direction,
        diffuseColor: color3ToColor(directionalLight.diffuse, directionalState.light.diffuseColor ?? { r: 1, g: 1, b: 1 }),
      },
      binding: readEditorSceneRuntimeLightBinding(directionalLight.metadata, 'directional') as RuntimeLightEditorBinding | null,
    },
    shadow: {
      mode: readRuntimeShadowMode(game),
      projectedLengthMultiplier: readEditorSceneLightingProjectedLengthMultiplier(direction),
    },
  };
}

function readRuntimeShadowMode(game: Game | null): RuntimeShadowMode {
  const mode = game?.getShadowService()?.getShadowMode?.();
  return mode === 'dynamic' || mode === 'blob' || mode === 'static' || mode === 'planar' || mode === 'none'
    ? mode
    : 'unknown';
}

function color3ToColor(value: unknown, fallback: ColorRGB): ColorRGB {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    r: readFiniteNumber(record.r, fallback.r),
    g: readFiniteNumber(record.g, fallback.g),
    b: readFiniteNumber(record.b, fallback.b),
  };
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
