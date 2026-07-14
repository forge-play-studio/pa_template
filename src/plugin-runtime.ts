import {
  createFpsPluginEnvironmentLifecycle,
  createFpsRuntimeDataFromCompiledScene,
  FPS_RUNTIME_DATA,
} from '@fps-games/editor/playable-runtime';
import * as runtimePluginModule from 'virtual:fps-plugins/runtime';
import sceneConfig from './config/scene.json';
import renderingConfig from './config/rendering.json';

const runtimePlugins = createFpsPluginEnvironmentLifecycle({
  module: runtimePluginModule,
  apiVersion: 1,
  scope: 'project',
  initialServices: [{
    token: FPS_RUNTIME_DATA,
    value: createFpsRuntimeDataFromCompiledScene(sceneConfig, renderingConfig),
  }],
});

export async function startProjectRuntimePlugins(): Promise<void> {
  await runtimePlugins.start();
}

export async function disposeProjectRuntimePlugins(): Promise<void> {
  await runtimePlugins.dispose();
}
