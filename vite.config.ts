import { defineConfig } from 'vite';
import { resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from './package.json';
import {
  createPlayableEditorBundledPackageRoots,
  createPlayableEditorBundledPackageAliasPlan,
  createPlayableEditorSourcePackageAliasPlan,
  formatPlayableEditorDoctorReport,
  handleEditorSceneRenderingProfileAuthoringRequest,
  handlePlayableAuthoringServerRequest,
  inspectPlayableEditorPackageAliasPlan,
  PLAYABLE_EDITOR_PACKAGE_IDS,
  readEditorSceneStaticShadowArtifact,
  readSceneMainSourceSaveCompanionConfigs,
  readSceneMainSourceRenderingConfig,
  readSceneMainSourceStaticShadowsArtifact,
  SCENE_MAIN_SOURCE_STATIC_SHADOWS_COMPANION_CONFIG_KEY,
  type PlayableEditorPackageAliasPlan,
  type PlayableAuthoringServerResponse,
} from '@fps-games/editor/playable-sdk';

import {
  analyticsPlugin,
  type AdNetwork,
  bridgePlugin,
  glbGzipPlugin,
  gzipBundlePlugin,
  inspectorPlugin,
  localePlugin,
  modelCachePlugin,
  molocoCtaPlugin,
  optimizePngPlugin,
  stripBabylonPlugin,
  thirdPartyWhitelistPlugin,
} from './vite-plugins';

type TemplateLocaleConfig = {
  htmlLang: string;
  isRTL: boolean;
  region?: string;
};

type TemplateAppConfig = {
  analytics: {
    adNetwork?: AdNetwork;
    playableId?: string;
    playableVersion?: string;
    distributorName?: string;
    sdkVersion?: string;
    isLandscape?: boolean;
    maxWidth?: number;
    maxHeight?: number;
  };
  i18n: {
    buildVersions: string[];
    locales: Record<string, TemplateLocaleConfig>;
    channels: {
      tracked: AdNetwork[];
      untracked: AdNetwork[];
    };
  };
  naming: {
    projectCode: string;
    materialId: string;
    creator: string;
    vendor: string;
    materialName: string;
  };
};

const appConfig = (pkg as typeof pkg & { appConfig: TemplateAppConfig }).appConfig;
const analyticsConfig = appConfig.analytics;
const i18nConfig = appConfig.i18n;
const liteBuild = process.env.LITE_BUILD === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const bridgeEnabled = process.env.BRIDGE_ENABLED !== 'false';
const bundleStatsEnabled = process.env.BUNDLE_STATS === 'true';
const buildMatrix = process.env.BUILD_MATRIX === 'true';
const defaultBuildLocale = (i18nConfig.buildVersions[0] || 'EN').toUpperCase();
const locale = (process.env.LOCALE || defaultBuildLocale).toUpperCase();
const channel = (process.env.CHANNEL || analyticsConfig.adNetwork || 'applovin') as AdNetwork;
const tracking = process.env.TRACKING !== 'false';
const dedicatedBuildLocales = new Set(i18nConfig.buildVersions.slice(1).map(value => value.toUpperCase()));
const isMultiLocale = locale === defaultBuildLocale;
const bundledLocales = isMultiLocale
  ? Object.keys(i18nConfig.locales).filter(value => !dedicatedBuildLocales.has(value.toUpperCase()))
  : [locale];
const localeMeta = i18nConfig.locales[locale] || i18nConfig.locales[defaultBuildLocale] || {
  htmlLang: locale.toLowerCase(),
  isRTL: false,
};
const debugPanelConfigRoot = resolve(__dirname, 'src/config');
const localFpsGameEditorRepo = process.env.FPS_GAME_EDITOR_REPO
  ? resolve(process.env.FPS_GAME_EDITOR_REPO)
  : null;
const bundledEditorPackageRoots = createPlayableEditorBundledPackageRoots(__dirname, {
  resolvePath: resolve,
});
const fpsEditorPackageJsonPath = localFpsGameEditorRepo
  ? resolve(localFpsGameEditorRepo, 'packages/editor/package.json')
  : bundledEditorPackageRoots.editorPackageJsonPath;
const allowedThirdPartyPackages = [
  '@babylonjs/core',
  '@babylonjs/loaders',
  ...PLAYABLE_EDITOR_PACKAGE_IDS,
  'brotli-dec-wasm',
];

const editorPackageIds = PLAYABLE_EDITOR_PACKAGE_IDS;

function readFpsEditorVersion(): string {
  if (!existsSync(fpsEditorPackageJsonPath)) return 'missing';
  try {
    const pkg = JSON.parse(readFileSync(fpsEditorPackageJsonPath, 'utf8') || '{}') as { version?: unknown };
    return typeof pkg.version === 'string' && pkg.version.trim()
      ? pkg.version.trim().replace(/[^a-zA-Z0-9._-]/g, '_')
      : 'unknown';
  } catch {
    return 'unknown';
  }
}

function editorPackageAlias(find: string | RegExp, replacement: string): { find: string | RegExp; replacement: string } {
  return { find, replacement };
}

function packageIdRegex(packageId: string): RegExp {
  return new RegExp(`^${packageId.replaceAll('/', '\\/')}$`);
}

function assertAliasFilesExist(aliasPlan: PlayableEditorPackageAliasPlan, intro: string): void {
  const report = inspectPlayableEditorPackageAliasPlan(aliasPlan, existsSync, { title: intro });
  if (report.ok) return;
  throw new Error(formatPlayableEditorDoctorReport(report));
}

function createLocalEditorSourceAliases(repoRoot: string): Array<{ find: string | RegExp; replacement: string }> {
  const aliasPlan = createPlayableEditorSourcePackageAliasPlan(repoRoot, {
    resolvePath: resolve,
  });

  assertAliasFilesExist(
    aliasPlan,
    `FPS_GAME_EDITOR_REPO is set to "${repoRoot}", but the editor source files are missing.`,
  );

  return aliasPlan.entries.map(entry => editorPackageAlias(packageIdRegex(entry.packageId), entry.file));
}

function createBundledEditorAliases(): Array<{ find: string | RegExp; replacement: string }> {
  const aliasPlan = createPlayableEditorBundledPackageAliasPlan({
    bundledEditorPackagesRoot: bundledEditorPackageRoots.bundledEditorPackagesRoot,
    directBabylonRendererPackageRoot: bundledEditorPackageRoots.directBabylonRendererPackageRoot,
    resolvePath: resolve,
    fileExists: existsSync,
  });

  assertAliasFilesExist(
    aliasPlan,
    'The bundled @fps-games/editor packages are missing. Run npm install or pnpm install before starting Vite.',
  );

  return aliasPlan.entries.map(entry => editorPackageAlias(packageIdRegex(entry.packageId), entry.file));
}

const editorPackageAliases = localFpsGameEditorRepo
  ? createLocalEditorSourceAliases(localFpsGameEditorRepo)
  : createBundledEditorAliases();

if (localFpsGameEditorRepo) {
  console.info(`[fps-editor] Using local editor sources from ${localFpsGameEditorRepo}`);
}

function resolveDebugPanelConfigFile(file: string | null): string | null {
  if (!file || file.includes('/') || file.includes('\\') || file.includes('..') || !file.endsWith('.json')) {
    return null;
  }
  return resolve(debugPanelConfigRoot, file);
}

function setNestedValue(target: Record<string, any>, path: string, value: unknown): void {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]!] = value;
}

function debugPanelConfigApiPlugin() {
  return {
    name: 'debug-panel-config-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__debug_panel_config', async (req: any, res: any) => {
        const requestUrl = new URL(req.url ?? '', 'http://localhost');
        const configPath = resolveDebugPanelConfigFile(requestUrl.searchParams.get('file'));
        if (!configPath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Unsupported debug panel config file' }));
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(existsSync(configPath) ? readFileSync(configPath, 'utf8') : '{}');
          return;
        }

        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as { changes?: Record<string, unknown> };
          const current = existsSync(configPath)
            ? JSON.parse(readFileSync(configPath, 'utf8') || '{}') as Record<string, any>
            : {};
          for (const [path, value] of Object.entries(body.changes ?? {})) {
            setNestedValue(current, path, value);
          }
          mkdirSync(debugPanelConfigRoot, { recursive: true });
          writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.statusCode = 405;
        res.end('Method Not Allowed');
      });
    },
  };
}

function projectAuthoringApiPlugin() {
  return {
    name: 'fps-editor-project-authoring-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      void import('./scripts/asset-registry/project-asset-catalog-config.mjs')
        .then(({ projectAssetRegistryConfig, projectTextureRegistryConfig }) => {
          const paths = [
            projectAssetRegistryConfig.scenePath,
            projectAssetRegistryConfig.manifestPath,
            projectAssetRegistryConfig.registryPath,
            projectAssetRegistryConfig.importedDir,
            projectTextureRegistryConfig.manifestPath,
            projectTextureRegistryConfig.registryPath,
            projectTextureRegistryConfig.importedDir,
          ];
          server.watcher.unwatch(paths);
          console.log('[ProjectAuthoring][Vite] HMR disabled for authoring-written files', paths);
        })
        .catch((error) => {
          console.warn('[ProjectAuthoring][Vite] failed to disable HMR for authoring files', error);
        });

      server.middlewares.use(async (req: any, res: any, next: any) => {
        const requestUrl = new URL(req.url ?? '', 'http://localhost');
        const pathname = requestUrl.pathname;
        const isProjectAuthoringRoute = pathname.startsWith('/__fps_editor_authoring');
        const isLegacyMockRoute = pathname.startsWith('/__mock_platform_assets');
        const route = isProjectAuthoringRoute || isLegacyMockRoute
          ? pathname
              .replace(/^\/__fps_editor_authoring/, '')
              .replace(/^\/__mock_platform_assets/, '') || '/'
          : '/';

        if ((isProjectAuthoringRoute || isLegacyMockRoute) && route.startsWith('/rendering-profile')) {
          setProjectAuthoringCorsHeaders(res);
          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }

          try {
            const response = await handleRenderingProfileAuthoringRoute(server, req, route);
            sendAuthoringServerResponse(res, response);
          } catch (error) {
            sendAuthoringServerResponse(res, {
              statusCode: 500,
              body: {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
                details: (error as any)?.details,
              },
            });
          }
          return;
        }

        const response = await handlePlayableAuthoringServerRequest({
          url: req.url ?? '',
          method: req.method ?? 'GET',
        }, {
          readBody: () => readJsonBody(req),
          normalizeTransportPath,
          async loadManifest() {
            const { projectAssetRegistryConfig, projectTextureRegistryConfig } = await import('./scripts/asset-registry/project-asset-catalog-config.mjs');
            const manifest = existsSync(projectAssetRegistryConfig.manifestPath)
              ? JSON.parse(readFileSync(projectAssetRegistryConfig.manifestPath, 'utf8'))
              : [];
            const textureManifest = existsSync(projectTextureRegistryConfig.manifestPath)
              ? JSON.parse(readFileSync(projectTextureRegistryConfig.manifestPath, 'utf8'))
              : [];
            return { ok: true, manifest, textureManifest };
          },
          async loadEditorAssetLibrary() {
            const assets = await listEditorAssetLibrary(server);
            return {
              ok: true,
              assets,
              summary: {
                assets: assets.length,
              },
            };
          },
          async loadEditorScene() {
            const editorScenePath = resolve(__dirname, 'src/config/editor-scene.json');
            const scenePath = resolve(__dirname, 'src/config/scene.json');
            const editorScene = existsSync(editorScenePath)
              ? JSON.parse(readFileSync(editorScenePath, 'utf8') || '{}')
              : null;
            const runtimeScene = existsSync(scenePath)
              ? JSON.parse(readFileSync(scenePath, 'utf8') || '{}')
              : null;
            const { ensureEditorSceneAuthoringSource, detectEditorSceneRuntimeInputDrift } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-authoring-source.ts');
            const { repairEditorSceneMaterialAssetsFromSceneConfig } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-scene-session.ts');
            const normalizedEditorScene = editorScene
              ? repairEditorSceneMaterialAssetsFromSceneConfig(ensureEditorSceneAuthoringSource(editorScene), runtimeScene)
              : editorScene;
            const companionConfigs = readSceneMainSourceSaveCompanionConfigs(normalizedEditorScene);
            return {
              ok: true,
              editorScenePath,
              scenePath,
              editorScene: normalizedEditorScene,
              ...(Object.keys(companionConfigs).length > 0 ? { companionConfigs } : {}),
              drift: normalizedEditorScene ? detectEditorSceneRuntimeInputDrift(normalizedEditorScene, runtimeScene) : null,
              summary: summarizeEditorScene(normalizedEditorScene),
            };
          },
          async writeFile({ path: targetPath, text }) {
            await mkdir(path.dirname(targetPath), { recursive: true });
            await writeFile(targetPath, text, 'utf8');
            return { ok: true, path: targetPath };
          },
          async runCommand({ cmd, payloadPath }) {
            const { projectAssetRegistryConfig, projectTextureRegistryConfig } = await import('./scripts/asset-registry/project-asset-catalog-config.mjs');
            const registryCore = await import('./scripts/asset-registry/core.mjs');
            const rules = await projectAssetRegistryConfig.loadRules();
            const errorCodes = rules.errorCodes ?? {};
            const payload = readAssetRegistryPayload(payloadPath);
            const registryConfig = selectAssetRegistryConfigForPayload(
              payload,
              projectAssetRegistryConfig,
              projectTextureRegistryConfig,
            );
            const result = cmd.includes('asset:unregister')
              ? await registryCore.unregisterAsset(registryConfig, { payload: payloadPath }, errorCodes)
              : await registryCore.registerAsset(registryConfig, { payload: payloadPath }, errorCodes);
            invalidateViteFileModules(
              server,
              [
                resolve(__dirname, 'src/assets/index.ts'),
                typeof result?.manifestPath === 'string' ? result.manifestPath : registryConfig.manifestPath,
                typeof result?.registryPath === 'string' ? result.registryPath : registryConfig.registryPath,
              ],
            );
            return { ok: true, cmd, result };
          },
          async saveEditorScene({ mode: saveMode, rawEditorScene, body }) {
            const companionConfigPayload = readSceneMainSourceSaveCompanionConfigs(body);
            const renderingConfig = readSceneMainSourceRenderingConfig(body);
            const hasStaticShadowArtifactPayload = Object.prototype.hasOwnProperty.call(
              companionConfigPayload,
              SCENE_MAIN_SOURCE_STATIC_SHADOWS_COMPANION_CONFIG_KEY,
            );
            const staticShadowArtifact = readEditorSceneStaticShadowArtifact(
              companionConfigPayload[SCENE_MAIN_SOURCE_STATIC_SHADOWS_COMPANION_CONFIG_KEY],
            );
            const editorScenePath = resolve(__dirname, 'src/config/editor-scene.json');
            const scenePath = resolve(__dirname, 'src/config/scene.json');
            const renderingConfigPath = resolve(__dirname, 'src/config/rendering.json');
            const previousSceneConfig = existsSync(scenePath)
              ? JSON.parse(readFileSync(scenePath, 'utf8') || '{}')
              : {};
            const { compileEditorSceneDocumentToSceneConfig } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-scene-compiler.ts');
            const { enrichEditorSceneDocumentAssets } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-asset-library.ts');
            const { repairEditorSceneMaterialAssetsFromSceneConfig, assertEditorSceneMaterialAssetIntegrity } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-scene-session.ts');
            const { bumpEditorSceneAuthoringSourceRevision, ensureEditorSceneAuthoringSource } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-authoring-source.ts');
            const { normalizeRenderingProfile } = await server.ssrLoadModule('/src/rendering/rendering-profile.ts');
            const { assertSceneJsonV2 } = await import('./scripts/platform-sim/lib/scene-json-v2-schema.mjs');
            assertEditorSceneDocument(rawEditorScene);
            const normalizedRenderingConfig = renderingConfig ? normalizeRenderingProfile(renderingConfig) : null;
            const editorAssets = await listEditorAssetLibrary(server);
            const repairedEditorScene = repairEditorSceneMaterialAssetsFromSceneConfig(
              enrichEditorSceneDocumentAssets(ensureEditorSceneAuthoringSource(rawEditorScene), editorAssets),
              previousSceneConfig,
            );
            assertEditorSceneMaterialAssetIntegrity(repairedEditorScene);
            const editorScene = bumpEditorSceneAuthoringSourceRevision(
              repairedEditorScene,
            );
            const runtimeStaticShadowArtifact = hasStaticShadowArtifactPayload
              ? staticShadowArtifact
              : staticShadowArtifact
                ?? readSceneMainSourceStaticShadowsArtifact(rawEditorScene)
                ?? readEditorSceneStaticShadowArtifact(readRecord(previousSceneConfig).staticShadows);
            const persistedEditorScene = withEditorSceneCompanionConfigs(editorScene, {
              staticShadows: runtimeStaticShadowArtifact,
            });
            const compiled = compileEditorSceneDocumentToSceneConfig(editorScene, previousSceneConfig);
            const compiledSceneConfig = runtimeStaticShadowArtifact
              ? {
                  ...compiled.sceneConfig,
                  staticShadows: runtimeStaticShadowArtifact,
                }
              : {
                  ...compiled.sceneConfig,
                };
            if (!runtimeStaticShadowArtifact) delete (compiledSceneConfig as Record<string, unknown>).staticShadows;
            assertSceneJsonV2(compiledSceneConfig);

            const previousVersion = typeof previousSceneConfig.version === 'number' ? previousSceneConfig.version : undefined;
            const version = typeof previousVersion === 'number' ? previousVersion + 1 : 1;
            const updatedAt = new Date().toISOString();
            const savedEditorSceneText = `${JSON.stringify(persistedEditorScene, null, 2)}\n`;
            const savedSceneJsonText = saveMode === 'local-commit-save'
              ? `${JSON.stringify({
                ...compiledSceneConfig,
                version,
                updatedAt,
              }, null, 2)}\n`
              : `${JSON.stringify(compiledSceneConfig, null, 2)}\n`;

            await writeFile(editorScenePath, savedEditorSceneText, 'utf8');
            if (saveMode === 'local-commit-save') {
              await writeFile(scenePath, savedSceneJsonText, 'utf8');
              if (renderingConfig) {
                await writeFile(renderingConfigPath, `${JSON.stringify(renderingConfig, null, 2)}\n`, 'utf8');
              }
            }
            const invalidationFiles = saveMode === 'local-commit-save'
              ? [
                  editorScenePath,
                  scenePath,
                  ...(renderingConfig ? [
                    renderingConfigPath,
                    resolve(__dirname, 'src/rendering/rendering-profile.ts'),
                    resolve(__dirname, 'src/fps-game-editor-adapter/editor-rendering-profile.ts'),
                    resolve(__dirname, 'src/fps-game-editor-adapter/editor-shadow-preview-profile.ts'),
                    resolve(__dirname, 'src/services/RenderingService.ts'),
                    resolve(__dirname, 'src/services/ShadowService.ts'),
                    resolve(__dirname, 'src/services/SceneBuilder.ts'),
                  ] : []),
                ]
              : [editorScenePath];
            invalidateViteFileModules(server, invalidationFiles);

            return {
              ok: true,
              mode: saveMode,
              editorScenePath,
              scenePath,
              expectedVersion: previousVersion,
              ...(saveMode === 'local-commit-save' ? { version, updatedAt } : {}),
              editorScene: persistedEditorScene,
              ...((renderingConfig || hasStaticShadowArtifactPayload) && saveMode === 'local-commit-save' ? {
                companionConfigs: {
                  ...(renderingConfig ? { rendering: renderingConfig } : {}),
                  ...(hasStaticShadowArtifactPayload ? { staticShadows: runtimeStaticShadowArtifact } : {}),
                },
                ...(renderingConfig ? {
                  renderingConfig,
                  renderingSummary: summarizeRenderingProfile(normalizedRenderingConfig),
                } : {}),
              } : {}),
              sceneJsonText: savedSceneJsonText,
              summary: {
                editorScene: summarizeEditorScene(editorScene),
                compiled: compiled.summary,
              },
            };
          },
        });

        if (!response) {
          next();
          return;
        }
        sendAuthoringServerResponse(res, response);
      });
    },
  };
}

async function readJsonBody(req: any): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, any>;
}

async function handleRenderingProfileAuthoringRoute(
  server: any,
  req: any,
  _route: string,
): Promise<PlayableAuthoringServerResponse> {
  const renderingConfigPath = resolve(__dirname, 'src/config/rendering.json');
  return handleEditorSceneRenderingProfileAuthoringRequest({
    method: req.method ?? 'GET',
  }, {
    readBody: () => readJsonBody(req),
    loadConfig() {
      const renderingConfig = existsSync(renderingConfigPath)
        ? JSON.parse(readFileSync(renderingConfigPath, 'utf8') || '{}')
        : {};
      return {
        renderingConfig,
        response: { renderingConfigPath },
      };
    },
    async saveConfig({ renderingConfig }) {
      await mkdir(path.dirname(renderingConfigPath), { recursive: true });
      await writeFile(renderingConfigPath, `${JSON.stringify(renderingConfig, null, 2)}\n`, 'utf8');
      invalidateViteFileModules(server, [
        renderingConfigPath,
        resolve(__dirname, 'src/rendering/rendering-profile.ts'),
        resolve(__dirname, 'src/fps-game-editor-adapter/editor-rendering-profile.ts'),
        resolve(__dirname, 'src/fps-game-editor-adapter/editor-shadow-preview-profile.ts'),
        resolve(__dirname, 'src/services/RenderingService.ts'),
        resolve(__dirname, 'src/services/ShadowService.ts'),
        resolve(__dirname, 'src/services/SceneBuilder.ts'),
      ]);
      return { renderingConfigPath };
    },
  });
}

function withEditorSceneCompanionConfigs(
  editorScene: Record<string, unknown>,
  companionConfigs: Record<string, unknown>,
): Record<string, unknown> {
  const nextCompanionConfigs = {
    ...readSceneMainSourceSaveCompanionConfigs(editorScene),
  };
  delete nextCompanionConfigs.rendering;
  for (const [key, value] of Object.entries(companionConfigs)) {
    if (value == null) {
      delete nextCompanionConfigs[key];
    } else {
      nextCompanionConfigs[key] = value as Record<string, unknown>;
    }
  }
  const nextEditorScene = { ...editorScene };
  if (Object.keys(nextCompanionConfigs).length > 0) {
    nextEditorScene.companionConfigs = nextCompanionConfigs;
  } else {
    delete nextEditorScene.companionConfigs;
  }
  return nextEditorScene;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizePayloadPath(value: string): string {
  if (value.startsWith('/tmp/') || path.isAbsolute(value)) return value;
  return resolve(__dirname, '.platform-sim', value);
}

function normalizeTransportPath(value: string): string {
  if (!value.trim()) return '';
  return normalizePayloadPath(value);
}

function readAssetRegistryPayload(payloadPath: string): Record<string, any> {
  return JSON.parse(readFileSync(payloadPath, 'utf8') || '{}') as Record<string, any>;
}

function selectAssetRegistryConfigForPayload(
  payload: Record<string, any>,
  modelConfig: any,
  textureConfig: any,
): any {
  return isTextureAssetRegistryPayload(payload) ? textureConfig : modelConfig;
}

function isTextureAssetRegistryPayload(payload: Record<string, any>): boolean {
  const explicitType = typeof payload.assetType === 'string' ? payload.assetType.toLowerCase() : '';
  if (/^(texture|image|png|jpg|jpeg|webp)$/.test(explicitType)) return true;
  const mimeType = typeof payload.mimeType === 'string' ? payload.mimeType.toLowerCase() : '';
  if (mimeType.startsWith('image/')) return true;
  const candidate = [payload.sourcePath, payload.assetPath, payload.assetName]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  return /\.(png|jpe?g|webp)(?:$|[?#])/i.test(candidate);
}

function sendAuthoringServerResponse(res: any, response: PlayableAuthoringServerResponse): void {
  res.statusCode = response.statusCode;
  setProjectAuthoringCorsHeaders(res);
  if (response.body == null) {
    res.end();
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(response.body));
}

function setProjectAuthoringCorsHeaders(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
}

function assertEditorSceneDocument(value: any): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('editor_scene_must_be_object');
  }
  if (value.schemaVersion !== 1) {
    throw new Error('editor_scene_schema_version_must_be_1');
  }
  if (!Array.isArray(value.assets)) {
    throw new Error('editor_scene_assets_must_be_array');
  }
  const gameObjects = value.scene?.gameObjects;
  if (!Array.isArray(gameObjects)) {
    throw new Error('editor_scene_game_objects_must_be_array');
  }
  const materialAssets = value.scene?.materialAssets;
  if (materialAssets != null && !Array.isArray(materialAssets)) {
    throw new Error('editor_scene_material_assets_must_be_array');
  }
}

function summarizeEditorScene(value: any): Record<string, unknown> {
  return {
    schemaVersion: value?.schemaVersion ?? null,
    sourceId: value?.meta?.authoringSource?.sourceId ?? null,
    sourceType: value?.meta?.authoringSource?.sourceType ?? null,
    revision: value?.meta?.authoringSource?.revision ?? null,
    assets: Array.isArray(value?.assets) ? value.assets.length : 0,
    gameObjects: Array.isArray(value?.scene?.gameObjects) ? value.scene.gameObjects.length : 0,
    materialAssets: Array.isArray(value?.scene?.materialAssets) ? value.scene.materialAssets.length : 0,
  };
}

function summarizeRenderingProfile(value: any): Record<string, unknown> {
  return {
    postProcessEnabled: value?.postProcess?.enabled ?? value?.globalVolume?.enabled ?? null,
    postProcessBloomEnabled: value?.postProcess?.bloom?.enabled ?? value?.globalVolume?.postProcessing?.bloom?.enabled ?? null,
    planarEnabled: value?.shadows?.planar?.enabled ?? null,
    planarOpacity: value?.shadows?.planar?.appearance?.color?.a ?? null,
    planeHeight: value?.shadows?.planar?.plane?.height ?? null,
    planeBias: value?.shadows?.planar?.plane?.bias ?? null,
    stencilEnabled: value?.shadows?.planar?.stencil?.enabled ?? null,
  };
}

async function listEditorAssetLibrary(server: any): Promise<Array<Record<string, unknown>>> {
  const assetsModule = await server.ssrLoadModule('/src/assets/index.ts');
  const editorAssetLibraryModule = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-asset-library.ts');
  const catalogEntries = [
    ...assetsModule.getAssetCatalogEntries({ kind: 'model', placeable: true }),
    ...assetsModule.getAssetCatalogEntries({ kind: 'texture', placeable: true }),
  ];
  return editorAssetLibraryModule.createProjectEditorAssetLibrary(catalogEntries);
}

function invalidateViteFileModules(server: any, files: string[]): void {
  for (const file of files) {
    const modules = server.moduleGraph?.getModulesByFile?.(file);
    if (!modules) continue;
    for (const moduleNode of modules) {
      server.moduleGraph.invalidateModule(moduleNode);
    }
  }
}

export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR || `node_modules/.vite-fps-editor-${readFpsEditorVersion()}`,
  define: {
    __LITE_BUILD__: JSON.stringify(liteBuild),
    // 在生产构建时完全移除开发功能
    __PROD_BUILD__: JSON.stringify(isProduction),
    __LOCALE__: JSON.stringify(locale),
    __CHANNEL__: JSON.stringify(channel),
    __RTL__: JSON.stringify(localeMeta.isRTL),
    __MULTI_LOCALE__: JSON.stringify(isMultiLocale),
    __BUNDLED_LOCALES__: JSON.stringify(bundledLocales),
  },
  plugins: [
    // 平台 bridge 自动注入（仅开发模式）
    bridgePlugin({
      port: 8080,
      delay: 2000,
      enabled: bridgeEnabled,
    }),
    // 新版 fps-game-editor 不注入 Babylon Inspector UI。
    inspectorPlugin(),
    debugPanelConfigApiPlugin(),
    projectAuthoringApiPlugin(),
    // 开发模式模型强缓存 + URL 版本化（mtime）
    modelCachePlugin({
      extensions: ['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.mp3'],
      roots: ['src'],
      cacheMaxAgeSeconds: 31536000,
    }),
    thirdPartyWhitelistPlugin({
      allowedPackages: allowedThirdPartyPackages,
      projectRoot: __dirname,
    }),
    // GLB 预压缩（只在生产构建时启用）
    glbGzipPlugin({
      enabled: isProduction,
      minSize: 10 * 1024, // 只压缩 > 10KB 的文件
      verbose: true,
    }),
    // Strip unused Babylon.js code (WGSL shaders, submodules, OpenPBR, texture loaders)
    stripBabylonPlugin(),
    localePlugin({
      locale,
      htmlLang: localeMeta.htmlLang,
      isRTL: localeMeta.isRTL,
      imgRoot: resolve(__dirname, 'src/assets/ui'),
    }),
    ...(channel === 'moloco' ? [molocoCtaPlugin()] : []),
    ...(tracking ? [
      analyticsPlugin({
        adNetwork: channel,
        playableId: analyticsConfig.playableId,
        playableVersion: analyticsConfig.playableVersion,
        distributorName: analyticsConfig.distributorName,
        sdkVersion: analyticsConfig.sdkVersion,
        isLandscape: analyticsConfig.isLandscape,
        maxWidth: analyticsConfig.maxWidth,
        maxHeight: analyticsConfig.maxHeight,
        development: process.env.NODE_ENV !== 'production',
      }),
    ] : []),
    viteSingleFile(),
    // 构建后图片压缩：PNG → WebP (cwebp) 或 optipng 无损重压，取最小值
    // 需要: brew install webp optipng
    optimizePngPlugin({ enabled: isProduction, optipngLevel: 2, webpQuality: 80 }),
    // 构建后压缩 single-file HTML 中的内联 JS bundle。
    // 放在 optimizePngPlugin 后面，避免先压 JS 导致图片优化看不到内联 PNG。
    gzipBundlePlugin({ enabled: isProduction, minSize: 100 * 1024, verbose: true }),
    ...(bundleStatsEnabled ? [
      visualizer({
        filename: buildMatrix ? 'dist/_build/stats.html' : 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
      visualizer({
        filename: buildMatrix ? 'dist/_build/stats.json' : 'dist/stats.json',
        template: 'raw-data',
        gzipSize: true,
        brotliSize: true,
      }),
    ] : []),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      ...editorPackageAliases,
    ],
    dedupe: [
      '@babylonjs/core',
      '@babylonjs/loaders',
      '@babylonjs/inspector',
    ],
  },
  optimizeDeps: {
    exclude: localFpsGameEditorRepo ? [...editorPackageIds] : [],
    include: [
      '@babylonjs/core',
      '@babylonjs/core/Layers/effectLayerSceneComponent',
      '@babylonjs/inspector',
      '@babylonjs/core/Rendering/depthRendererSceneComponent',
      '@babylonjs/core/Gizmos/gizmoManager',
    ],
  },
  assetsInclude: ['**/*.env'],
  build: {
    target: 'esnext',
    outDir: buildMatrix ? 'dist/_build' : 'dist',
    // 临时降低内联阈值：查看文件大小分布
    assetsInlineLimit: 100000000, // 内联所有资源
    chunkSizeWarningLimit: 1000000,
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],  // 保留 warn 和 error
        passes: 3,  // 增加压缩次数
        sequences: true,  // 连续语句合并
        dead_code: true,  // 移除死代码
        conditionals: true,  // 优化条件语句
        booleans: true,  // 优化布尔值
        unused: true,  // 移除未使用的变量
        if_return: true,  // 优化 if return
        join_vars: true,  // 连接变量声明
        // 生产构建时移除开发功能
        global_defs: isProduction ? {
          'import.meta.env.PROD': true
        } : {},
      },
      mangle: {
        toplevel: false,  // 保持兼容性
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
      // 标记 Babylon.js 的副作用模块，帮助 tree-shaking
      treeshake: {
        moduleSideEffects: (id) => {
          // 标记不需要的 Babylon.js 模块为无副作用
          if (id.includes('@babylonjs/core')) {
            // 排除不需要的模块
            const excludePatterns = [
              '/XR/',
              '/Physics/',
              '/Debug/',
              '/DeviceInput/',
              '/Offline/',
              '/LibDecoder/',
              '/LensFlare/',
              '/Layer/',
              '/Sprites/',
              '/Morph/',
              '/Bones/',
              '/Navigation/',
              '/Audio/',
              '/GUI/',
              '/FluidRenderer/',
              '/GreasedLine/',
              '/ComputeEffect/',
              '/Materials/Node/',
              '/Materials/Textures/Procedurals/',
              '/Culling/Octrees/',
              '/BakedVertexAnimation/',
              '/Gamepads/',
              '/Misc/basis/',
            ];
            if (excludePatterns.some(pattern => id.includes(pattern))) {
              return false;
            }
          }
          return true;
        },
      },
    },
  },
  server: {
    port: 3006,
    strictPort: true,
    cors: true,
    allowedHosts: ['.e2b.app'],
    fs: localFpsGameEditorRepo
      ? {
          allow: [__dirname, localFpsGameEditorRepo],
        }
      : undefined,
    headers: {
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    }
  },
});
