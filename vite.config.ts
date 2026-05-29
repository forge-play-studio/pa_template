import { defineConfig } from 'vite';
import { resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { visualizer } from 'rollup-plugin-visualizer';
import {
  bridgePlugin,
  glbGzipPlugin,
  inspectorPlugin,
  localePlugin,
  modelCachePlugin,
  optimizePngPlugin,
  stripBabylonPlugin,
  thirdPartyWhitelistPlugin,
} from './vite-plugins';

const liteBuild = process.env.LITE_BUILD === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const bridgeEnabled = process.env.BRIDGE_ENABLED !== 'false';
const bundleStatsEnabled = process.env.BUNDLE_STATS !== 'false';
const locale = (process.env.LOCALE || 'EN').toUpperCase();
const channel = process.env.CHANNEL || 'applovin';
const isRTL = ['AR', 'FA', 'HE', 'UR'].includes(locale);
const localeMeta = {
  htmlLang: locale.toLowerCase(),
  isRTL,
};
const isMultiLocale = false;
const bundledLocales = [locale];
const debugPanelConfigRoot = resolve(__dirname, 'src/config');
const localFpsGameEditorRepo = process.env.FPS_GAME_EDITOR_REPO
  ? resolve(process.env.FPS_GAME_EDITOR_REPO)
  : null;
const bundledEditorPackagesRoot = resolve(__dirname, 'node_modules/@fps-games/editor/node_modules/@fps-games');
const directBabylonRendererPackageRoot = resolve(__dirname, 'node_modules/@fps-games/babylon-renderer');
const fpsEditorPackageJsonPath = localFpsGameEditorRepo
  ? resolve(localFpsGameEditorRepo, 'packages/editor/package.json')
  : resolve(__dirname, 'node_modules/@fps-games/editor/package.json');
const allowedThirdPartyPackages = [
  '@babylonjs/core',
  '@babylonjs/loaders',
  '@fps-games/editor',
  '@fps-games/babylon-renderer',
  '@fps-games/editor-babylon',
  '@fps-games/editor-browser',
  '@fps-games/editor-core',
  '@fps-games/editor-forge-play',
  '@fps-games/editor-protocol',
  'brotli-dec-wasm',
];

const editorPackageIds = [
  '@fps-games/editor',
  '@fps-games/babylon-renderer',
  '@fps-games/editor-babylon',
  '@fps-games/editor-browser',
  '@fps-games/editor-core',
  '@fps-games/editor-forge-play',
  '@fps-games/editor-protocol',
] as const;

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

function assertAliasFilesExist(aliasFiles: ReadonlyArray<readonly [string, string]>, intro: string): void {
  const missing = aliasFiles.filter(([, file]) => !existsSync(file));
  if (missing.length === 0) return;
  throw new Error(
    [
      intro,
      ...missing.map(([pkg, file]) => `- ${pkg}: ${file}`),
    ].join('\n'),
  );
}

function createLocalEditorSourceAliases(repoRoot: string): Array<{ find: string | RegExp; replacement: string }> {
  const aliasFiles = [
    ['@fps-games/editor-babylon/legacy-runtime', resolve(repoRoot, 'packages/editor-babylon/src/legacy-runtime.ts')],
    ['@fps-games/babylon-renderer', resolve(repoRoot, 'packages/babylon-renderer/src/index.ts')],
    ['@fps-games/editor-babylon', resolve(repoRoot, 'packages/editor-babylon/src/index.ts')],
    ['@fps-games/editor-browser', resolve(repoRoot, 'packages/editor-browser/src/index.ts')],
    ['@fps-games/editor-core', resolve(repoRoot, 'packages/editor-core/src/index.ts')],
    ['@fps-games/editor-forge-play', resolve(repoRoot, 'packages/editor-forge-play/src/index.ts')],
    ['@fps-games/editor-protocol', resolve(repoRoot, 'packages/editor-protocol/src/index.ts')],
    ['@fps-games/editor', resolve(repoRoot, 'packages/editor/src/index.ts')],
  ] as const;

  assertAliasFilesExist(
    aliasFiles,
    `FPS_GAME_EDITOR_REPO is set to "${repoRoot}", but the editor source files are missing.`,
  );

  return aliasFiles.map(([pkg, file]) => editorPackageAlias(packageIdRegex(pkg), file));
}

function createBundledEditorAliases(): Array<{ find: string | RegExp; replacement: string }> {
  const aliasFiles = [
    ['@fps-games/editor-babylon/legacy-runtime', resolve(bundledEditorPackagesRoot, 'editor-babylon/dist/legacy-runtime.js')],
    ['@fps-games/editor-babylon', resolve(bundledEditorPackagesRoot, 'editor-babylon/dist/index.js')],
    ['@fps-games/editor-browser', resolve(bundledEditorPackagesRoot, 'editor-browser/dist/index.js')],
    ['@fps-games/editor-core', resolve(bundledEditorPackagesRoot, 'editor-core/dist/index.js')],
    ['@fps-games/editor-forge-play', resolve(bundledEditorPackagesRoot, 'editor-forge-play/dist/index.js')],
    ['@fps-games/editor-protocol', resolve(bundledEditorPackagesRoot, 'editor-protocol/dist/index.js')],
  ] as const;

  assertAliasFilesExist(
    aliasFiles,
    'The bundled @fps-games/editor packages are missing. Run npm install or pnpm install before starting Vite.',
  );

  const aliases = aliasFiles.map(([pkg, file]) => editorPackageAlias(packageIdRegex(pkg), file));
  const rendererAliasFile = resolveBundledBabylonRendererAliasFile();
  if (rendererAliasFile) {
    aliases.unshift(editorPackageAlias(packageIdRegex('@fps-games/babylon-renderer'), rendererAliasFile));
  }
  return aliases;
}

function resolveBundledBabylonRendererAliasFile(): string | null {
  const candidates = [
    resolve(directBabylonRendererPackageRoot, 'src/index.ts'),
    resolve(directBabylonRendererPackageRoot, 'dist/index.js'),
    resolve(bundledEditorPackagesRoot, 'babylon-renderer/dist/index.js'),
  ];
  return candidates.find(candidate => existsSync(candidate)) ?? null;
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
        if (!isProjectAuthoringRoute && !isLegacyMockRoute) {
          next();
          return;
        }
        const route = pathname
          .replace(/^\/__fps_editor_authoring/, '')
          .replace(/^\/__mock_platform_assets/, '') || '/';
        if (
          !route.startsWith('/manifest')
          && !route.startsWith('/commit')
          && !route.startsWith('/editor-scene')
          && !route.startsWith('/editor-asset-library')
          && !route.startsWith('/save-editor-scene')
          && !route.startsWith('/file')
          && !route.startsWith('/exec')
        ) {
          next();
          return;
        }

        setProjectAuthoringCorsHeaders(res);
        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        try {
          const { projectAssetRegistryConfig, projectTextureRegistryConfig } = await import('./scripts/asset-registry/project-asset-catalog-config.mjs');
          const registryCore = await import('./scripts/asset-registry/core.mjs');
          const rules = await projectAssetRegistryConfig.loadRules();
          const errorCodes = rules.errorCodes ?? {};

          if (req.method === 'GET' && route.startsWith('/manifest')) {
            const manifest = existsSync(projectAssetRegistryConfig.manifestPath)
              ? JSON.parse(readFileSync(projectAssetRegistryConfig.manifestPath, 'utf8'))
              : [];
            const textureManifest = existsSync(projectTextureRegistryConfig.manifestPath)
              ? JSON.parse(readFileSync(projectTextureRegistryConfig.manifestPath, 'utf8'))
              : [];
            sendJson(res, 200, { ok: true, manifest, textureManifest });
            return;
          }

          if (req.method === 'GET' && route.startsWith('/editor-asset-library')) {
            const assets = await listEditorAssetLibrary(server);
            sendJson(res, 200, {
              ok: true,
              assets,
              summary: {
                assets: assets.length,
              },
            });
            return;
          }

          if (req.method === 'GET' && route.startsWith('/editor-scene')) {
            const editorScenePath = resolve(__dirname, 'src/config/editor-scene.json');
            const scenePath = resolve(__dirname, 'src/config/scene.json');
            const editorScene = existsSync(editorScenePath)
              ? JSON.parse(readFileSync(editorScenePath, 'utf8') || '{}')
              : null;
            const runtimeScene = existsSync(scenePath)
              ? JSON.parse(readFileSync(scenePath, 'utf8') || '{}')
              : null;
            const { ensureEditorSceneAuthoringSource, detectEditorSceneRuntimeInputDrift } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-authoring-source.ts');
            const normalizedEditorScene = editorScene ? ensureEditorSceneAuthoringSource(editorScene) : editorScene;
            sendJson(res, 200, {
              ok: true,
              editorScenePath,
              scenePath,
              editorScene: normalizedEditorScene,
              drift: normalizedEditorScene ? detectEditorSceneRuntimeInputDrift(normalizedEditorScene, runtimeScene) : null,
              summary: summarizeEditorScene(normalizedEditorScene),
            });
            return;
          }

          if (req.method !== 'POST') {
            sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
            return;
          }

          const body = await readJsonBody(req);
          if (route.startsWith('/file')) {
            const targetPath = normalizeTransportPath(String(body.path ?? ''));
            if (!targetPath) {
              sendJson(res, 400, { ok: false, error: 'missing_file_path' });
              return;
            }
            const content = body.content;
            const text = typeof content === 'string'
              ? content
              : `${JSON.stringify(content ?? {}, null, 2)}\n`;
            await mkdir(path.dirname(targetPath), { recursive: true });
            await writeFile(targetPath, text, 'utf8');
            sendJson(res, 200, { ok: true, path: targetPath });
            return;
          }

          if (route.startsWith('/exec')) {
            const cmd = String(body.cmd ?? '');
            const payloadPath = readPayloadPathFromCommand(cmd);
            if (!payloadPath) {
              sendJson(res, 400, { ok: false, error: 'missing_payload_arg', cmd });
              return;
            }
            const normalizedPayloadPath = normalizeTransportPath(payloadPath);
            const payload = readAssetRegistryPayload(normalizedPayloadPath);
            const registryConfig = selectAssetRegistryConfigForPayload(
              payload,
              projectAssetRegistryConfig,
              projectTextureRegistryConfig,
            );
            const result = cmd.includes('asset:unregister')
              ? await registryCore.unregisterAsset(registryConfig, { payload: normalizedPayloadPath }, errorCodes)
              : await registryCore.registerAsset(registryConfig, { payload: normalizedPayloadPath }, errorCodes);
            invalidateViteFileModules(
              server,
              [
                resolve(__dirname, 'src/assets/index.ts'),
                typeof result?.manifestPath === 'string' ? result.manifestPath : registryConfig.manifestPath,
                typeof result?.registryPath === 'string' ? result.registryPath : registryConfig.registryPath,
              ],
            );
            sendJson(res, 200, { ok: true, cmd, result });
            return;
          }

          if (route.startsWith('/save-editor-scene')) {
            const rawEditorScene = body.editorScene;
            const saveMode = body.mode === 'prepare-platform-save'
              ? 'prepare-platform-save'
              : 'local-commit-save';
            const editorScenePath = resolve(__dirname, 'src/config/editor-scene.json');
            const scenePath = resolve(__dirname, 'src/config/scene.json');
            const previousSceneConfig = existsSync(scenePath)
              ? JSON.parse(readFileSync(scenePath, 'utf8') || '{}')
              : {};
            const { compileEditorSceneDocumentToSceneConfig } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-scene-compiler.ts');
            const { enrichEditorSceneDocumentAssets } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-asset-library.ts');
            const { bumpEditorSceneAuthoringSourceRevision, ensureEditorSceneAuthoringSource } = await server.ssrLoadModule('/src/fps-game-editor-adapter/editor-authoring-source.ts');
            const { assertSceneJsonV2 } = await import('./scripts/platform-sim/lib/scene-json-v2-schema.mjs');
            assertEditorSceneDocument(rawEditorScene);
            const editorScene = bumpEditorSceneAuthoringSourceRevision(
              enrichEditorSceneDocumentAssets(ensureEditorSceneAuthoringSource(rawEditorScene), await listEditorAssetLibrary(server)),
            );
            const compiled = compileEditorSceneDocumentToSceneConfig(editorScene, previousSceneConfig);
            assertSceneJsonV2(compiled.sceneConfig);

            const previousVersion = typeof previousSceneConfig.version === 'number' ? previousSceneConfig.version : undefined;
            const version = typeof previousVersion === 'number' ? previousVersion + 1 : 1;
            const updatedAt = new Date().toISOString();
            const savedEditorSceneText = `${JSON.stringify(editorScene, null, 2)}\n`;
            const savedSceneJsonText = saveMode === 'local-commit-save'
              ? `${JSON.stringify({
                ...compiled.sceneConfig,
                version,
                updatedAt,
              }, null, 2)}\n`
              : `${JSON.stringify(compiled.sceneConfig, null, 2)}\n`;

            await writeFile(editorScenePath, savedEditorSceneText, 'utf8');
            if (saveMode === 'local-commit-save') {
              await writeFile(scenePath, savedSceneJsonText, 'utf8');
            }
            invalidateViteFileModules(
              server,
              saveMode === 'local-commit-save' ? [editorScenePath, scenePath] : [editorScenePath],
            );

            sendJson(res, 200, {
              ok: true,
              mode: saveMode,
              editorScenePath,
              scenePath,
              expectedVersion: previousVersion,
              ...(saveMode === 'local-commit-save' ? { version, updatedAt } : {}),
              editorScene,
              sceneJsonText: savedSceneJsonText,
              summary: {
                editorScene: summarizeEditorScene(editorScene),
                compiled: compiled.summary,
              },
            });
            return;
          }

          if (route.startsWith('/commit')) {
            sendJson(res, 410, {
              ok: false,
              error: 'legacy_mock_platform_commit_disabled',
              message: 'Save through /__fps_editor_authoring/save-editor-scene so scene.main remains the authoring source of truth.',
            });
            return;
          }

          sendJson(res, 404, { ok: false, error: 'not_found' });
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            details: (error as any)?.details,
          });
        }
      });
    },
  };
}

async function readJsonBody(req: any): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, any>;
}

function normalizePayloadPath(value: string): string {
  if (value.startsWith('/tmp/') || path.isAbsolute(value)) return value;
  return resolve(__dirname, '.platform-sim', value);
}

function normalizeTransportPath(value: string): string {
  if (!value.trim()) return '';
  return normalizePayloadPath(value);
}

function readPayloadPathFromCommand(cmd: string): string {
  const match = cmd.match(/(?:^|\s)--payload(?:=|\s+)("[^"]+"|'[^']+'|\S+)/);
  const value = match?.[1] ?? '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
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

function sendJson(res: any, statusCode: number, body: Record<string, unknown>): void {
  res.statusCode = statusCode;
  setProjectAuthoringCorsHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
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
}

function summarizeEditorScene(value: any): Record<string, unknown> {
  return {
    schemaVersion: value?.schemaVersion ?? null,
    sourceId: value?.meta?.authoringSource?.sourceId ?? null,
    sourceType: value?.meta?.authoringSource?.sourceType ?? null,
    revision: value?.meta?.authoringSource?.revision ?? null,
    assets: Array.isArray(value?.assets) ? value.assets.length : 0,
    gameObjects: Array.isArray(value?.scene?.gameObjects) ? value.scene.gameObjects.length : 0,
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
    viteSingleFile(),
    // 构建后图片压缩：PNG → WebP (cwebp) 或 optipng 无损重压，取最小值
    // 需要: brew install webp optipng
    optimizePngPlugin({ enabled: isProduction, optipngLevel: 2, webpQuality: 80 }),
    ...(bundleStatsEnabled ? [
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
      visualizer({
        filename: 'dist/stats.json',
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
    outDir: 'dist',
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
