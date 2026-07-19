import { defineFpsGameEditorProject, groundDecalFeature } from '@fps-games/editor/playable-sdk';
import {
  assetsPlugin,
  babylonRendererPlugin,
  markersPlugin,
  materialsPlugin,
  renderingPlugin,
  scenePlugin,
  shadowMapExperimentPlugin,
  shadowsPlugin,
} from '@fps-games/editor';
import { paTemplateGroundDecalFeatureConfig } from './src/services/fps-game-editor/ground-decal-config';

export const editorConfig = defineFpsGameEditorProject({
  projectId: 'pa_template',
  projectName: 'PA Template',
  source: {
    editorScene: 'src/config/editor-scene.json',
    runtimeScene: 'src/config/scene.json',
    rendering: 'src/config/rendering.json',
    shadows: 'src/config/shadows.json',
  },
  assets: {
    importedDir: 'src/assets/imported',
    generatedDir: 'src/assets/generated',
    publicBase: '/assets/imported',
  },
  features: [groundDecalFeature(paTemplateGroundDecalFeatureConfig)],
});

export const fpsConfig = Object.freeze({
  editor: editorConfig,
  plugins: Object.freeze([
    scenePlugin(),
    assetsPlugin(),
    materialsPlugin(),
    renderingPlugin(),
    shadowsPlugin(),
    shadowMapExperimentPlugin(),
    markersPlugin(),
    babylonRendererPlugin(),
  ]),
});

export default fpsConfig;
