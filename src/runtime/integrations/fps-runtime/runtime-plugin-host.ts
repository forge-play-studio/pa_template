import { createFpsRuntimeDataFromCompiledScene } from '@fps-games/editor/playable-runtime';
import {
  createFpsBabylonGameWorldPluginLifecycle,
  type FpsBabylonRendererContext,
  type FpsBabylonRendererService,
} from '@fps-games/editor/playable-runtime/babylon';
import * as rendererPluginModule from 'virtual:fps-plugins/renderer';
import * as runtimePluginModule from 'virtual:fps-plugins/runtime';
import sceneConfig from '../../../config/scene.json';
import renderingConfig from '../../../config/rendering.json';

const gameWorldPlugins = createFpsBabylonGameWorldPluginLifecycle({
  runtimeModule: runtimePluginModule,
  rendererModule: rendererPluginModule,
  runtimeData: createFpsRuntimeDataFromCompiledScene(sceneConfig, renderingConfig),
  apiVersion: 1,
});

export async function startProjectRuntimePlugins(): Promise<void> {
  await gameWorldPlugins.startRuntime();
}

export async function attachProjectRenderer(
  context: FpsBabylonRendererContext,
): Promise<FpsBabylonRendererService> {
  return gameWorldPlugins.attachRenderer(context);
}

export async function detachProjectRenderer(): Promise<void> {
  await gameWorldPlugins.detachRenderer();
}

export async function disposeProjectRuntimePlugins(): Promise<void> {
  await gameWorldPlugins.dispose();
}
