import { defineConfig } from 'vite';
import { resolve } from 'path';
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from './package.json';
import {
  createPlayableEditorBundledPackageRoots,
  createPlayableEditorBundledPackageAliasPlan,
  createPlayableEditorSourcePackageAliasPlan,
  createEditorSceneAssetLibrary,
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
// This is deliberately production-only: normal dev and release builds must not mount the test controls.
const sceneWalkthroughBuild = isProduction && process.env.SCENE_WALKTHROUGH_BUILD === 'true';
const enableDevDebugTooling = !isProduction;
const VFX_USAGES_SCHEMA_REF = './usages.schema.json';
const VFX_USAGES_SCHEMA_VERSION = 'project-vfx-usages/1.0';
const VFX_USAGE_TARGET_KINDS = new Set(['socket', 'node']);
const VFX_USAGE_LIFECYCLES = new Set(['follow', 'loop', 'oneshot']);
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
  '@fps-games/vfx',
  ...PLAYABLE_EDITOR_PACKAGE_IDS,
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

type GitWorkspaceInfo = {
  root: string;
  repoRemote?: string;
  branch?: string;
  gitSha?: string;
};

function readJsonRecord(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;
  try {
    const value = JSON.parse(readFileSync(filePath, 'utf8') || '{}') as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function readGitOutput(cwd: string, args: string[]): string | null {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) return null;
  const value = String(result.stdout ?? '').trim();
  return value || null;
}

function readGitWorkspaceInfo(root: string | null): GitWorkspaceInfo | null {
  if (!root || !existsSync(root)) return null;
  const workspaceRoot = readGitOutput(root, ['rev-parse', '--show-toplevel']) ?? root;
  const branch = readGitOutput(workspaceRoot, ['branch', '--show-current'])
    ?? readGitOutput(workspaceRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const repoRemote = readGitOutput(workspaceRoot, ['config', '--get', 'remote.origin.url']);
  const gitSha = readGitOutput(workspaceRoot, ['rev-parse', 'HEAD']);
  return {
    root: workspaceRoot,
    ...(repoRemote ? { repoRemote } : {}),
    ...(branch && branch !== 'HEAD' ? { branch } : {}),
    ...(gitSha ? { gitSha } : {}),
  };
}

function createEditorBuildInfoMetadata(): Record<string, unknown> {
  const packageJson = readJsonRecord(fpsEditorPackageJsonPath);
  const distBuildInfo = readJsonRecord(resolve(path.dirname(fpsEditorPackageJsonPath), 'dist/build-info.json'));
  return {
    source: localFpsGameEditorRepo ? 'local-source' : 'bundled-package',
    packageJsonPath: fpsEditorPackageJsonPath,
    ...(typeof packageJson?.name === 'string' ? { packageName: packageJson.name } : {}),
    ...(typeof packageJson?.version === 'string' ? { version: packageJson.version } : {}),
    ...(distBuildInfo ? { buildInfo: distBuildInfo } : {}),
  };
}

function createAgentBridgeSessionMetadata(): Record<string, unknown> {
  const editorGit = readGitWorkspaceInfo(localFpsGameEditorRepo);
  const projectGit = readGitWorkspaceInfo(__dirname);
  const workspaceRoot = editorGit?.root ?? localFpsGameEditorRepo;
  const projectRoot = projectGit?.root ?? __dirname;
  return {
    ...(workspaceRoot ? { workspaceRoot } : {}),
    ...(editorGit?.repoRemote ? { repoRemote: editorGit.repoRemote } : {}),
    ...(editorGit?.branch ? { branch: editorGit.branch } : {}),
    ...(editorGit?.gitSha ? { gitSha: editorGit.gitSha } : {}),
    projectRoot,
    paTemplateRoot: projectRoot,
    ...(projectGit?.repoRemote ? { projectRepoRemote: projectGit.repoRemote } : {}),
    ...(projectGit?.branch ? { projectBranch: projectGit.branch } : {}),
    ...(projectGit?.gitSha ? { projectGitSha: projectGit.gitSha } : {}),
    editorBuildInfo: createEditorBuildInfoMetadata(),
  };
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
const playableEditorAssetAuthoringHandlersFactoryPromise = loadPlayableEditorAssetAuthoringHandlersFactory();

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
  let cursor: any = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    const nextPart = parts[index + 1]!;
    const key = Array.isArray(cursor) && /^\d+$/.test(part) ? Number(part) : part;
    const next = cursor[key];
    if (!next || typeof next !== 'object') {
      cursor[key] = /^\d+$/.test(nextPart) ? [] : {};
    }
    cursor = cursor[key];
  }
  const leaf = parts[parts.length - 1]!;
  const key = Array.isArray(cursor) && /^\d+$/.test(leaf) ? Number(leaf) : leaf;
  cursor[key] = value;
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
      const assetAuthoringHandlersPromise = createProjectAssetAuthoringHandlers(server);
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
          async loadManifest(route) {
            const handlers = await assetAuthoringHandlersPromise;
            if (!handlers.loadManifest) throw new Error('asset_manifest_handler_unavailable');
            return handlers.loadManifest(route);
          },
          async loadEditorAssetLibrary(route) {
            const handlers = await assetAuthoringHandlersPromise;
            if (!handlers.loadEditorAssetLibrary) throw new Error('asset_library_handler_unavailable');
            return handlers.loadEditorAssetLibrary(route);
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
            const { enrichEditorSceneDocumentAssets } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-asset-library.ts');
            const {
              ensureEditorSceneEnvironmentDefaults,
              repairEditorSceneMaterialAssetsFromSceneConfig,
            } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-scene-session.ts');
            const editorAssets = await listEditorAssetLibrary(server);
            const normalizedEditorScene = editorScene
              ? ensureEditorSceneEnvironmentDefaults(
                repairEditorSceneMaterialAssetsFromSceneConfig(
                  enrichEditorSceneDocumentAssets(ensureEditorSceneAuthoringSource(editorScene), editorAssets),
                  runtimeScene,
                ),
              )
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
          async runCommand(input) {
            const handlers = await assetAuthoringHandlersPromise;
            if (!handlers.runCommand) throw new Error('asset_command_handler_unavailable');
            return handlers.runCommand(input);
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
            const {
              ensureEditorSceneEnvironmentDefaults,
              repairEditorSceneMaterialAssetsFromSceneConfig,
              assertEditorSceneMaterialAssetIntegrity,
            } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-scene-session.ts');
            const { bumpEditorSceneAuthoringSourceRevision, ensureEditorSceneAuthoringSource } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-authoring-source.ts');
            const { normalizeRenderingProfile } = await server.ssrLoadModule('/src/rendering/rendering-profile.ts');
            const { assertSceneJsonV2 } = await import('./scripts/platform-sim/lib/scene-json-v2-schema.mjs');
            assertEditorSceneDocument(rawEditorScene);
            const normalizedRenderingConfig = renderingConfig ? normalizeRenderingProfile(renderingConfig) : null;
            const editorAssets = await listEditorAssetLibrary(server);
            const repairedEditorScene = ensureEditorSceneEnvironmentDefaults(
              repairEditorSceneMaterialAssetsFromSceneConfig(
                enrichEditorSceneDocumentAssets(ensureEditorSceneAuthoringSource(rawEditorScene), editorAssets),
                previousSceneConfig,
              ),
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

async function createProjectAssetAuthoringHandlers(server: any) {
  const { projectAssetRegistryConfig, projectTextureRegistryConfig } = await import('./scripts/asset-registry/project-asset-catalog-config.mjs');
  const createPlayableEditorAssetAuthoringHandlers = await playableEditorAssetAuthoringHandlersFactoryPromise;
  return createPlayableEditorAssetAuthoringHandlers({
    assetRegistryConfig: projectAssetRegistryConfig,
    textureRegistryConfig: projectTextureRegistryConfig,
    loadAssetCatalogEntries: () => loadProjectEditorAssetCatalogEntries(server),
    additionalInvalidationFiles: [resolve(__dirname, 'src/assets/index.ts')],
    invalidateFiles(files) {
      invalidateViteFileModules(server, [...files]);
    },
  });
}

async function loadPlayableEditorAssetAuthoringHandlersFactory() {
  if (localFpsGameEditorRepo) {
    const viteDistPath = resolve(localFpsGameEditorRepo, 'packages/editor-playable-sdk/dist/vite/index.js');
    if (!existsSync(viteDistPath)) {
      compileLocalPlayableSdk(localFpsGameEditorRepo);
    }
    const module = await import(`${pathToFileURL(viteDistPath).href}?vite-config=${Date.now()}`);
    return readPlayableEditorAssetAuthoringHandlersFactory(module, viteDistPath);
  }

  const module = await import('@fps-games/editor/playable-sdk/vite');
  return readPlayableEditorAssetAuthoringHandlersFactory(module, '@fps-games/editor/playable-sdk/vite');
}

function readPlayableEditorAssetAuthoringHandlersFactory(module: unknown, source: string) {
  const factory = (module as {
    createPlayableEditorAssetAuthoringHandlers?: unknown;
  })?.createPlayableEditorAssetAuthoringHandlers;
  if (typeof factory !== 'function') {
    throw new Error(
      `${source} does not provide createPlayableEditorAssetAuthoringHandlers. `
      + 'Install a newer @fps-games/editor package or set FPS_GAME_EDITOR_REPO to a local fps-game-editor checkout.',
    );
  }
  return factory;
}

function compileLocalPlayableSdk(repoRoot: string): void {
  const result = spawnSync('npx', ['tsc', '-p', 'packages/editor-playable-sdk/tsconfig.json'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`Failed to compile local fps-game-editor playable SDK (exit ${result.status ?? 'unknown'}).`);
  }

  const fixResult = spawnSync('node', ['scripts/fix-esm-imports.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (fixResult.status !== 0) {
    throw new Error(`Failed to prepare local fps-game-editor playable SDK ESM output (exit ${fixResult.status ?? 'unknown'}).`);
  }
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

async function loadProjectEditorAssetCatalogEntries(server: any): Promise<Array<Record<string, unknown>>> {
  const assetsModule = await server.ssrLoadModule('/src/assets/index.ts');
  return [
    ...assetsModule.getAssetCatalogEntries({ kind: 'model', placeable: true }),
    ...assetsModule.getAssetCatalogEntries({ kind: 'texture', placeable: true }),
  ];
}

async function listEditorAssetLibrary(server: any): Promise<Array<Record<string, unknown>>> {
  return createEditorSceneAssetLibrary(await loadProjectEditorAssetCatalogEntries(server)) as Array<Record<string, unknown>>;
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

// VFX debug overrides API（仅 dev serve）：读取/写入 src/assets/vfx/effects/<id>/vfx-params.json。
function vfxDebugOverridesApiPlugin() {
  return {
    name: 'vfx-debug-overrides-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__vfx_debug_overrides', async (req: any, res: any) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(readAllVfxEffectParams(), null, 2));
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const effectId = typeof body.effectId === 'string' ? body.effectId.trim() : '';
          const params = readOptionalRecord(body.params);
          if (!effectId || !params) {
            sendJson(res, 400, { ok: false, error: 'missing_effect_id_or_params' });
            return;
          }

          const paramsPath = resolveVfxEffectParamsPath(effectId);
          if (!paramsPath) {
            sendJson(res, 400, { ok: false, error: 'unsupported_effect_id' });
            return;
          }

          const payload = {
            schemaVersion: 'vfx-params/1.0',
            effectId,
            updatedAt: new Date().toISOString(),
            params,
          };
          await mkdir(path.dirname(paramsPath), { recursive: true });
          await writeFile(paramsPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
          invalidateViteFileModules(server, [
            paramsPath,
            resolve(__dirname, 'src/assets/vfx/index.ts'),
          ]);
          sendJson(res, 200, { ok: true, path: paramsPath, params: payload });
        } catch (error) {
          sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}

// VFX usage overrides API（仅 dev serve）：写入 src/assets/vfx/usages.json 中某个 usage 的实例参数。
function vfxUsageOverridesApiPlugin() {
  return {
    name: 'vfx-usage-overrides-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__vfx_usage_overrides', async (req: any, res: any) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(readVfxUsagesDocument(), null, 2));
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const usageId = typeof body.usageId === 'string' ? body.usageId.trim() : '';
          const params = readOptionalRecord(body.params);
          const offset = readOptionalRecord(body.offset);
          if (!usageId || !params) {
            sendJson(res, 400, { ok: false, error: 'missing_usage_id_or_params' });
            return;
          }

          const usagesPath = resolveVfxUsagesPath();
          const document = readVfxUsagesDocument();
          const usages = Array.isArray(document.usages) ? document.usages : [];
          const usage = usages.find((entry: any) => entry && typeof entry === 'object' && entry.id === usageId);
          if (!usage) {
            sendJson(res, 404, { ok: false, error: 'unknown_usage_id' });
            return;
          }

          usage.params = params;
          if (offset) {
            usage.offset = sanitizeVfxUsageOffset(offset);
          }
          document.$schema = typeof document.$schema === 'string' ? document.$schema : VFX_USAGES_SCHEMA_REF;
          document.schemaVersion = typeof document.schemaVersion === 'string' ? document.schemaVersion : VFX_USAGES_SCHEMA_VERSION;
          document.updatedAt = new Date().toISOString();
          const validationErrors = validateVfxUsagesDocument(document);
          if (validationErrors.length > 0) {
            sendJson(res, 400, { ok: false, error: 'invalid_vfx_usages_document', issues: validationErrors });
            return;
          }

          await mkdir(path.dirname(usagesPath), { recursive: true });
          await writeFile(usagesPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
          invalidateViteFileModules(server, [
            usagesPath,
            resolve(__dirname, 'src/systems/ProjectVfxDirector.ts'),
          ]);
          sendJson(res, 200, { ok: true, path: usagesPath, usage });
        } catch (error) {
          sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}

function resolveVfxEffectParamsPath(effectId: string): string | null {
  // debug-only 端点:仅需保证落点不逃出 effects 目录；不做字符白名单，所以下划线 id 也支持。
  const effectDir = resolve(__dirname, 'src/assets/vfx/effects', effectId);
  const vfxRoot = resolve(__dirname, 'src/assets/vfx/effects');
  if (!effectDir.startsWith(`${vfxRoot}${path.sep}`)) return null;
  return resolve(effectDir, 'vfx-params.json');
}

function resolveVfxUsagesPath(): string {
  return resolve(__dirname, 'src/assets/vfx/usages.json');
}

function readVfxUsagesDocument(): any {
  const usagesPath = resolveVfxUsagesPath();
  if (!existsSync(usagesPath)) {
    return {
      $schema: VFX_USAGES_SCHEMA_REF,
      schemaVersion: VFX_USAGES_SCHEMA_VERSION,
      usages: [],
    };
  }
  return JSON.parse(stripVfxJsonBom(readFileSync(usagesPath, 'utf8')) || '{}');
}

function validateVfxUsagesDocument(document: any): string[] {
  const issues: string[] = [];
  const add = (pathLabel: string, message: string) => issues.push(`${pathLabel}: ${message}`);
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return ['document: must be an object'];
  }
  if (document.$schema !== undefined && document.$schema !== VFX_USAGES_SCHEMA_REF) {
    add('$schema', `expected ${VFX_USAGES_SCHEMA_REF}`);
  }
  if (document.schemaVersion !== VFX_USAGES_SCHEMA_VERSION) {
    add('schemaVersion', `expected ${VFX_USAGES_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(document.usages)) {
    add('usages', 'must be an array');
    return issues;
  }

  const ids = new Map<string, number>();
  document.usages.forEach((usage: any, index: number) => {
    const base = `usages[${index}]`;
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
      add(base, 'must be an object');
      return;
    }
    const id = typeof usage.id === 'string' ? usage.id.trim() : '';
    if (!id) add(`${base}.id`, 'must be a non-empty string');
    if (id && ids.has(id)) add(`${base}.id`, `duplicates usages[${ids.get(id)}].id`);
    if (id) ids.set(id, index);
    if (typeof usage.effect !== 'string' || usage.effect.trim().length === 0) add(`${base}.effect`, 'must be a non-empty string');

    const placement = typeof usage.placement === 'string' ? usage.placement : '';
    if (!VFX_USAGE_TARGET_KINDS.has(placement)) add(`${base}.placement`, 'must be socket or node');
    validateVfxUsagePositionSourceConfig(usage.positionSource, placement, `${base}.positionSource`, add);

    if (usage.inputs !== undefined) validateVfxUsageInputsConfig(usage.inputs, `${base}.inputs`, add);

    const lifecycle = typeof usage.lifecycle === 'string' ? usage.lifecycle : '';
    if (!VFX_USAGE_LIFECYCLES.has(lifecycle)) add(`${base}.lifecycle`, 'must be follow, loop, or oneshot');
    if (usage.repeatIntervalSec !== undefined) {
      if (!isFiniteConfigNumber(usage.repeatIntervalSec) || usage.repeatIntervalSec < 0) add(`${base}.repeatIntervalSec`, 'must be a non-negative number');
      if (lifecycle !== 'loop') add(`${base}.repeatIntervalSec`, 'is only valid when lifecycle is loop');
    }
    if (usage.offset !== undefined) validateVfxUsageOffsetConfig(usage.offset, `${base}.offset`, add);
    if (usage.params !== undefined) validateVfxUsageParamsConfig(usage.params, `${base}.params`, add);
  });
  return issues;
}

function validateVfxUsagePositionSourceConfig(
  source: unknown,
  placement: string,
  pathLabel: string,
  add: (pathLabel: string, message: string) => void,
): void {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    add(pathLabel, 'must be an object');
    return;
  }
  const value = source as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    if (key !== 'kind' && key !== 'nodeId') add(`${pathLabel}.${key}`, 'unknown position source field');
  }
  const kind = typeof value.kind === 'string' ? value.kind : '';
  if (!VFX_USAGE_TARGET_KINDS.has(kind)) add(`${pathLabel}.kind`, 'must be socket or node');
  if (placement && kind && placement !== kind) add(`${pathLabel}.kind`, 'must match placement');
  if (typeof value.nodeId !== 'string' || value.nodeId.trim().length === 0) {
    add(`${pathLabel}.nodeId`, 'must be a non-empty string');
  }
}

function validateVfxUsageInputsConfig(
  inputs: unknown,
  pathLabel: string,
  add: (pathLabel: string, message: string) => void,
): void {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    add(pathLabel, 'must be an object');
    return;
  }
  const value = inputs as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length === 0) add(pathLabel, 'must contain at least one input');
  for (const key of keys) {
    if (key !== 'reference') add(`${pathLabel}.${key}`, 'unknown input field');
  }
  if (value.reference !== undefined) {
    validateVfxUsagePositionSourceConfig(value.reference, '', `${pathLabel}.reference`, add);
  }
}

function validateVfxUsageOffsetConfig(offset: unknown, pathLabel: string, add: (pathLabel: string, message: string) => void): void {
  if (!offset || typeof offset !== 'object' || Array.isArray(offset)) {
    add(pathLabel, 'must be an object');
    return;
  }
  const source = offset as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (key !== 'position' && key !== 'rotation' && key !== 'scale') add(`${pathLabel}.${key}`, 'unknown offset field');
  }
  if (source.position !== undefined) validateVfxUsageVector3Config(source.position, `${pathLabel}.position`, add);
  if (source.rotation !== undefined) validateVfxUsageVector3Config(source.rotation, `${pathLabel}.rotation`, add);
  if (source.scale !== undefined && !isFiniteConfigNumber(source.scale)) {
    validateVfxUsageVector3Config(source.scale, `${pathLabel}.scale`, add);
  }
}

function validateVfxUsageVector3Config(value: unknown, pathLabel: string, add: (pathLabel: string, message: string) => void): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add(pathLabel, 'must be a vector object');
    return;
  }
  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.length === 0) add(pathLabel, 'must contain at least one axis');
  for (const key of keys) {
    if (key !== 'x' && key !== 'y' && key !== 'z') {
      add(`${pathLabel}.${key}`, 'unknown vector axis');
      continue;
    }
    if (!isFiniteConfigNumber(source[key])) add(`${pathLabel}.${key}`, 'must be a finite number');
  }
}

function validateVfxUsageParamsConfig(params: unknown, pathLabel: string, add: (pathLabel: string, message: string) => void): void {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    add(pathLabel, 'must be an object');
    return;
  }
  validateNoDebugVfxUsageParamKeys(params, pathLabel, add);
}

function validateNoDebugVfxUsageParamKeys(value: unknown, pathLabel: string, add: (pathLabel: string, message: string) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoDebugVfxUsageParamKeys(item, `${pathLabel}[${index}]`, add));
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = `${pathLabel}.${key}`;
    if (key.startsWith('__debug.')) add(nextPath, 'debug-only params must not be persisted');
    validateNoDebugVfxUsageParamKeys(item, nextPath, add);
  }
}

function isFiniteConfigNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readAllVfxEffectParams(): Record<string, unknown> {
  const effectsRoot = resolve(__dirname, 'src/assets/vfx/effects');
  const result: Record<string, unknown> = {};
  if (!existsSync(effectsRoot)) return result;
  for (const effectId of readdirSync(effectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)) {
    const paramsPath = resolveVfxEffectParamsPath(effectId);
    if (!paramsPath || !existsSync(paramsPath)) continue;
    try {
      const value = JSON.parse(stripVfxJsonBom(readFileSync(paramsPath, 'utf8')) || '{}') as { params?: unknown };
      result[effectId] = value.params && typeof value.params === 'object' && !Array.isArray(value.params)
        ? value.params
        : value;
    } catch {
      result[effectId] = {};
    }
  }
  return result;
}

function sanitizeVfxUsageOffset(offset: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const position = readOptionalVector3Config(offset.position);
  const rotation = readOptionalVector3Config(offset.rotation);
  const scale = readOptionalScaleConfig(offset.scale);
  if (position) result.position = position;
  if (rotation) result.rotation = rotation;
  if (scale !== undefined) result.scale = scale;
  return result;
}

function readOptionalVector3Config(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const axis of ['x', 'y', 'z']) {
    const axisValue = source[axis];
    if (typeof axisValue === 'number' && Number.isFinite(axisValue)) {
      result[axis] = axisValue;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function readOptionalScaleConfig(value: unknown): number | Record<string, number> | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return readOptionalVector3Config(value) ?? undefined;
}

function readOptionalRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function sendJson(res: any, statusCode: number, body: Record<string, unknown>): void {
  res.statusCode = statusCode;
  setProjectAuthoringCorsHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function stripVfxJsonBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR || `node_modules/.vite-fps-editor-${readFpsEditorVersion()}`,
  define: {
    __LITE_BUILD__: JSON.stringify(liteBuild),
    // 在生产构建时完全移除开发功能
    __PROD_BUILD__: JSON.stringify(isProduction),
    __SCENE_WALKTHROUGH_BUILD__: JSON.stringify(sceneWalkthroughBuild),
    __LOCALE__: JSON.stringify(locale),
    __CHANNEL__: JSON.stringify(channel),
    __RTL__: JSON.stringify(localeMeta.isRTL),
    __MULTI_LOCALE__: JSON.stringify(isMultiLocale),
    __BUNDLED_LOCALES__: JSON.stringify(bundledLocales),
    __FPS_EDITOR_AGENT_SESSION_METADATA__: JSON.stringify(createAgentBridgeSessionMetadata()),
  },
  plugins: [
    // 平台 bridge 自动注入（仅开发模式）
    bridgePlugin({
      port: 8080,
      delay: 2000,
      enabled: bridgeEnabled,
    }),
    // Debug panel / inspector preload tooling is dev-only. Keep it out of package builds.
    ...(enableDevDebugTooling ? [
      inspectorPlugin(),
      debugPanelConfigApiPlugin(),
      vfxDebugOverridesApiPlugin(),
      vfxUsageOverridesApiPlugin(),
    ] : []),
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
      ...(enableDevDebugTooling ? ['@babylonjs/inspector'] : []),
    ],
  },
  optimizeDeps: {
    exclude: localFpsGameEditorRepo ? [...editorPackageIds] : [],
    include: [
      '@babylonjs/core',
      ...(enableDevDebugTooling ? [
        '@babylonjs/core/Layers/effectLayerSceneComponent',
        '@babylonjs/inspector',
        '@babylonjs/core/Rendering/depthRendererSceneComponent',
        '@babylonjs/core/Gizmos/gizmoManager',
      ] : []),
    ],
  },
  assetsInclude: ['**/*.env'],
  build: {
    target: 'esnext',
    outDir: buildMatrix ? 'dist/_build' : sceneWalkthroughBuild ? 'dist/scene-walkthrough' : 'dist',
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
    port: 3011,
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
