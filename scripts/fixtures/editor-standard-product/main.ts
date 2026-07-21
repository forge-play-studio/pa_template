import {
  mountFpsGameEditorStandardLocalEditorFromEnvironmentModule,
} from '@fps-games/editor/playable-sdk';
import * as editorPlugins from 'virtual:fps-plugins/editor';
import config from './fps.config';

export const localEditor = mountFpsGameEditorStandardLocalEditorFromEnvironmentModule(config.editor, {
  pluginModule: editorPlugins,
  projectMode: {
    enterEditorMode: () => undefined,
    enterPlayMode: () => globalThis.location.reload(),
  },
});
