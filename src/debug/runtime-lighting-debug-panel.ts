import type { ColorRGB } from '../config';
import type { Game } from '../core/Game';
import {
  mountEditorRuntimeLightingDebugPanel,
  type EditorRuntimeLightingDebugPanel,
} from '@fps-games/editor';
import type { RuntimeLightEditorBinding } from './runtime-lighting-save';
import { saveRuntimeLightsToEditorScene } from './runtime-lighting-save';
import {
  readEditorSceneLightingProjectedLengthMultiplier,
  readEditorSceneRuntimeLightBinding,
  toEditorSceneRuntimeLightingPatches,
  type EditorSceneLightingDebugSnapshot as LightingDebugSnapshot,
  type EditorSceneRuntimeShadowMode as RuntimeShadowMode,
} from '@fps-games/editor/playable-sdk';

export interface RuntimeLightingDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export type RuntimeLightingDebugPanel = EditorRuntimeLightingDebugPanel;

export function mountRuntimeLightingDebugPanel(options: RuntimeLightingDebugPanelOptions): RuntimeLightingDebugPanel {
  return mountEditorRuntimeLightingDebugPanel({
    root: options.root,
    readSnapshot: () => readSnapshot(options.getGame()),
    applySnapshot: snapshot => applySnapshot(options.getGame(), snapshot),
    saveSnapshot: snapshot => saveRuntimeLightsToEditorScene(toEditorSceneRuntimeLightingPatches(snapshot)),
    reloadAfterSave: true,
    placement: {
      right: 100,
      width: 330,
    },
  });
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
  return mode === 'planar' || mode === 'legacy' || mode === 'none' ? mode : 'unknown';
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
