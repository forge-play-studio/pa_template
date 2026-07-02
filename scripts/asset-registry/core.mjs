import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REQUIRED_ASSET_REGISTRY_SDK_EXPORTS = [
  'PLAYABLE_EDITOR_ASSET_CATALOG_KINDS',
  'PlayableEditorAssetRegistryError',
  'runPlayableEditorAssetRegistryCli',
  'registerPlayableEditorAsset',
  'unregisterPlayableEditorAsset',
  'loadPlayableEditorAssetManifest',
  'generatePlayableEditorAssetCatalogModule',
  'resolvePlayableEditorAssetMetadata',
  'extractPlayableEditorGltfMaterialSlots',
  'createPlayableEditorAssetGuid',
  'createPlayableEditorAssetId',
  'guidToPlayableEditorAssetStableToken',
  'normalizePlayableEditorAssetKind',
  'normalizePlayableEditorAssetCodeKey',
  'normalizePlayableEditorAssetDisplayName',
  'stripKnownPlayableEditorAssetExtension',
  'toPlayableEditorAssetImportName',
];

const sdk = await loadEditorAssetRegistrySdk();

export const ASSET_CATALOG_KINDS = sdk.PLAYABLE_EDITOR_ASSET_CATALOG_KINDS;
export const AssetRegistryError = sdk.PlayableEditorAssetRegistryError;

export const runAssetRegistryCli = sdk.runPlayableEditorAssetRegistryCli;
export const registerAsset = sdk.registerPlayableEditorAsset;
export const unregisterAsset = sdk.unregisterPlayableEditorAsset;
export const loadManifest = sdk.loadPlayableEditorAssetManifest;
export const generateAssetCatalogModule = sdk.generatePlayableEditorAssetCatalogModule;
export const resolveAssetMetadata = sdk.resolvePlayableEditorAssetMetadata;
export const extractGltfMaterialSlots = sdk.extractPlayableEditorGltfMaterialSlots;

export const createAssetGuid = sdk.createPlayableEditorAssetGuid;
export const createAssetId = sdk.createPlayableEditorAssetId;
export const guidToStableToken = sdk.guidToPlayableEditorAssetStableToken;
export const normalizeAssetKind = sdk.normalizePlayableEditorAssetKind;
export const normalizeCodeKey = sdk.normalizePlayableEditorAssetCodeKey;
export const normalizeDisplayName = sdk.normalizePlayableEditorAssetDisplayName;
export const stripKnownAssetExtension = sdk.stripKnownPlayableEditorAssetExtension;
export const toImportName = sdk.toPlayableEditorAssetImportName;

async function loadEditorAssetRegistrySdk() {
  if (process.env.FPS_GAME_EDITOR_REPO) {
    return loadLocalEditorAssetRegistrySdk(resolveLocalFpsEditorRepoRoot());
  }

  try {
    const installed = await import('@fps-games/editor/playable-sdk/vite');
    if (hasAssetRegistryExports(installed).ok) {
      return installed;
    }
  } catch {
    // Fall back to the local fps-game-editor source checkout below.
  }

  const repoRoot = resolveLocalFpsEditorRepoRoot();
  return loadLocalEditorAssetRegistrySdk(repoRoot);
}

async function loadLocalEditorAssetRegistrySdk(repoRoot) {
  const viteDistPath = path.join(repoRoot, 'packages/editor-playable-sdk/dist/vite/index.js');
  compileLocalPlayableSdk(repoRoot);
  const local = await import(`${pathToFileURL(viteDistPath).href}?asset-registry=${Date.now()}`);
  const localExports = hasAssetRegistryExports(local);
  if (!localExports.ok) {
    throw new Error(`fps-game-editor playable-sdk/vite is missing required asset database exports: ${localExports.missing.join(', ')}`);
  }
  return local;
}

function hasAssetRegistryExports(module) {
  const missing = REQUIRED_ASSET_REGISTRY_SDK_EXPORTS.filter(name => module?.[name] == null);
  return {
    ok: missing.length === 0,
    missing,
  };
}

function resolveLocalFpsEditorRepoRoot() {
  if (process.env.FPS_GAME_EDITOR_REPO) {
    return path.resolve(process.env.FPS_GAME_EDITOR_REPO);
  }
  const currentFile = fileURLToPath(import.meta.url);
  const inferred = path.resolve(path.dirname(currentFile), '../../../..');
  if (existsSync(path.join(inferred, 'packages/editor-playable-sdk/tsconfig.json'))) {
    return inferred;
  }
  throw new Error(
    'Unable to locate fps-game-editor source checkout. Set FPS_GAME_EDITOR_REPO or install an @fps-games/editor version with playable-sdk/vite asset registry exports.',
  );
}

function compileLocalPlayableSdk(repoRoot) {
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
