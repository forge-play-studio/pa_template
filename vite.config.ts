import {
  createFpsGameEditorAssetAuthoringServices,
  createFpsGameEditorProjectAuthoringApiPlugin,
  createFpsGameEditorProjectSceneAuthoringServices,
  createFpsGameEditorRenderingAuthoringServices,
  createFpsGameEditorViteAdapter,
  invalidateFpsGameEditorViteFileModules,
} from '@fps-games/editor/playable-sdk/vite';
import { createFpsConfiguredPluginManifestVitePlugin } from '@fps-games/editor/vite';
import { unwatchFile, watchFile } from 'node:fs';
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
    'src/services/SceneBuilder.ts',
  ],
});
const scene = createFpsGameEditorProjectSceneAuthoringServices(editorConfig, {
  projectRoot: __dirname,
  moduleIds: {
    sceneModule: '/src/services/fps-game-editor/scene-feature.ts',
    renderingProfile: '/src/rendering/rendering-profile.ts',
  },
  summarizeRenderingProfile: rendering.summarize,
  createRenderingInvalidationFiles: rendering.createInvalidationFiles,
  invalidateFiles: invalidateFpsGameEditorViteFileModules,
});
const integration = createFpsGameEditorViteAdapter(editorConfig, {
  projectRoot: __dirname,
  localEditorRepo: null,
  editorEntry: { url: '/src/services/fps-game-editor/local-editor.ts', cache: 'revalidate' },
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

let stopRuntimeSceneModuleInvalidationWatch: (() => void) | null = null;
const runtimeSceneModuleInvalidation = {
  name: 'pa-template-runtime-scene-module-invalidation',
  apply: 'serve' as const,
  configureServer(server: Parameters<typeof invalidateFpsGameEditorViteFileModules>[0]) {
    stopRuntimeSceneModuleInvalidationWatch?.();
    const runtimeScenePath = scene.paths.scenePath;
    const handleRuntimeSceneChange = (current: { mtimeMs: number }, previous: { mtimeMs: number }) => {
      if (current.mtimeMs === previous.mtimeMs) return;
      invalidateFpsGameEditorViteFileModules(server, [runtimeScenePath]);
    };
    watchFile(runtimeScenePath, { interval: 250 }, handleRuntimeSceneChange);
    const stopWatch = () => {
      unwatchFile(runtimeScenePath, handleRuntimeSceneChange);
      if (stopRuntimeSceneModuleInvalidationWatch === stopWatch) {
        stopRuntimeSceneModuleInvalidationWatch = null;
      }
    };
    stopRuntimeSceneModuleInvalidationWatch = stopWatch;
    server.httpServer?.once('close', stopWatch);
  },
  closeBundle() {
    stopRuntimeSceneModuleInvalidationWatch?.();
  },
};

export default createPaTemplateViteConfig({
  ...integration,
  pluginManifestVitePlugin: () => [pluginManifests, runtimeSceneModuleInvalidation],
});
