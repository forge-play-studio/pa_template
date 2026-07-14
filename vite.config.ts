import {
  createFpsGameEditorAssetAuthoringServices,
  createFpsGameEditorProjectAuthoringApiPlugin,
  createFpsGameEditorProjectSceneAuthoringServices,
  createFpsGameEditorRenderingAuthoringServices,
  createFpsGameEditorViteAdapter,
  invalidateFpsGameEditorViteFileModules,
} from '@fps-games/editor/playable-sdk/vite';
import { createFpsConfiguredPluginManifestVitePlugin } from '@fps-games/editor/vite';
import fpsConfig, { editorConfig } from './fps.config';
import { createPaTemplateViteConfig } from './vite-plugins/projectViteConfig';

const assets = createFpsGameEditorAssetAuthoringServices({
  projectRoot: __dirname,
  assetCatalogConfigModulePath: 'scripts/asset-registry/project-asset-catalog-config.mjs',
  assetCatalogModuleId: '/src/assets/index.ts',
  additionalInvalidationFiles: ['src/assets/index.ts'],
});
const rendering = createFpsGameEditorRenderingAuthoringServices(editorConfig, {
  projectRoot: __dirname,
  additionalInvalidationFiles: [
    'src/rendering/rendering-profile.ts',
    'src/services/RenderingService.ts',
    'src/services/ShadowService.ts',
    'src/services/SceneBuilder.ts',
  ],
});
const scene = createFpsGameEditorProjectSceneAuthoringServices(editorConfig, {
  projectRoot: __dirname,
  moduleIds: {
    authoringSource: '/src/services/fps-game-editor/scene-feature.ts',
    assetLibrary: '/src/services/fps-game-editor/scene-feature.ts',
    sceneSession: '/src/services/fps-game-editor/scene-feature.ts',
    sceneCompiler: '/src/services/fps-game-editor/scene-feature.ts',
    renderingProfile: '/src/rendering/rendering-profile.ts',
  },
  assertRuntimeSceneConfigModulePath: 'scripts/platform-sim/lib/scene-json-v2-schema.mjs',
  assertRuntimeSceneConfigExportName: 'assertSceneJsonV2',
  summarizeRenderingProfile: rendering.summarize,
  createRenderingInvalidationFiles: rendering.createInvalidationFiles,
  invalidateFiles: invalidateFpsGameEditorViteFileModules,
});
const integration = createFpsGameEditorViteAdapter(editorConfig, {
  projectRoot: __dirname,
  localEditorRepo: null,
  logger: console,
  extendAgentBridgeSessionMetadata: metadata => ({ ...metadata, paTemplateRoot: metadata.projectRoot }),
  createProjectAuthoringApiPlugin: () => createFpsGameEditorProjectAuthoringApiPlugin({
    projectRoot: __dirname,
    logger: console,
    createAssetAuthoringHandlers: assets.createProjectAssetAuthoringHandlers,
    getAuthoringWrittenFiles: async () => {
      const { projectAssetRegistryConfig: model, projectTextureRegistryConfig: texture } = await assets.loadProjectAssetCatalogConfigModule();
      return [model.scenePath, model.manifestPath, model.registryPath, model.importedDir, texture.manifestPath, texture.registryPath, texture.importedDir];
    },
    handleRenderingProfileRoute: rendering.handleRoute,
    loadEditorScene: server => scene.loadEditorScene({ server, listEditorAssetLibrary: assets.listEditorAssetLibrary }),
    saveEditorScene: input => scene.saveEditorScene({ ...input, listEditorAssetLibrary: assets.listEditorAssetLibrary }),
  }),
});

const pluginManifests = createFpsConfiguredPluginManifestVitePlugin({
  apiVersion: 1,
  projectRoot: __dirname,
  plugins: fpsConfig.plugins,
});

export default createPaTemplateViteConfig({
  ...integration,
  pluginManifestVitePlugin: () => pluginManifests,
});
