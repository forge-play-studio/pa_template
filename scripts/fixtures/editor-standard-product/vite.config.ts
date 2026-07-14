import { createFpsGameEditorViteAdapter } from '@fps-games/editor/playable-sdk/vite';
import { createFpsConfiguredPluginManifestVitePlugin } from '@fps-games/editor/vite';
import config from './fps.config';

export default {
  plugins: [
    createFpsConfiguredPluginManifestVitePlugin({ apiVersion: 1, projectRoot: '.', plugins: config.plugins }),
    createFpsGameEditorViteAdapter(config.editor, { projectRoot: '.' }),
  ],
};
