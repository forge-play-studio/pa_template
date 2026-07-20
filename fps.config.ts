import { defineFpsGameEditorProject, groundDecalFeature } from '@fps-games/editor/playable-sdk';
import * as editorPlugins from '@fps-games/editor';
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

const hierarchyPluginReference = (editorPlugins as unknown as {
  hierarchyPlugin?: () => ReturnType<typeof editorPlugins.scenePlugin>;
}).hierarchyPlugin?.();

export const fpsConfig = Object.freeze({
  editor: editorConfig,
  plugins: Object.freeze([
    ...(hierarchyPluginReference ? [hierarchyPluginReference] : []),
    editorPlugins.scenePlugin(),
    editorPlugins.assetsPlugin(),
    editorPlugins.materialsPlugin(),
    editorPlugins.renderingPlugin(),
    editorPlugins.shadowsPlugin(),
    editorPlugins.shadowMapExperimentPlugin(),
    editorPlugins.markersPlugin(),
    editorPlugins.babylonRendererPlugin(),
  ]),
});

export default fpsConfig;
