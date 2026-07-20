import {
  createFpsGameEditorAdapter,
  mountFpsGameEditorStandardProject,
} from '@fps-games/editor/playable-sdk';
import { createFpsPluginEnvironmentLifecycle } from '@fps-games/editor/playable-runtime';
import * as runtimePlugins from 'virtual:fps-plugins/runtime';
import config from './fps.config';

export const runtimePluginLifecycle = createFpsPluginEnvironmentLifecycle({ module: runtimePlugins, apiVersion: 1 });
export const runtimePluginsReady = runtimePluginLifecycle.start();
export const disposeRuntimePlugins = () => runtimePluginLifecycle.dispose();
export const editor = createFpsGameEditorAdapter(config.editor, {
  getGame: () => null,
  getCanvas: () => document.querySelector('canvas'),
  disposeGameWorld: () => undefined,
  restartGame: () => globalThis.location.reload(),
});

export const localEditor = mountFpsGameEditorStandardProject(config.editor, editor.runtimeHooks);
