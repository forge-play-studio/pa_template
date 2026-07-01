import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  createAssetGuid,
  createAssetId,
  generateAssetCatalogModule,
  normalizeCodeKey,
  normalizeDisplayName,
  stripKnownAssetExtension,
} from './core.mjs';
import { projectAssetCatalogConfig } from './project-asset-catalog-config.mjs';

const MODEL_MAP_NAME = 'MANUAL_MODEL_URL_MAP';
const GROUND_TEXTURE_MAP_NAME = 'MANUAL_GROUND_TEXTURE_URL_MAP';
const OLD_MODEL_MANIFEST = 'model-registry.manifest.json';
const OLD_MODEL_REGISTRY = 'model-registry.generated.ts';
const OLD_TEXTURE_MANIFEST = 'texture-registry.manifest.json';
const OLD_TEXTURE_REGISTRY = 'texture-registry.generated.ts';

const DIRECT_RUNTIME_MODEL_ASSETS = {};

const LEGACY_MODEL_ASSET_ID_OVERRIDES = {};

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const report = args.has('--report');
const cwd = projectAssetCatalogConfig.cwd;
const assetsIndexPath = path.join(cwd, 'src/assets/index.ts');
const manifestPath = projectAssetCatalogConfig.manifestPath;
const registryPath = projectAssetCatalogConfig.registryPath;
const scenePath = path.join(cwd, 'src/config/scene.json');
const editorScenePath = path.join(cwd, 'src/config/editor-scene.json');

const existingManifest = await readJsonArray(manifestPath);
const oldModelManifest = await readJsonArray(path.join(projectAssetCatalogConfig.generatedDir, OLD_MODEL_MANIFEST));
const oldTextureManifest = await readJsonArray(path.join(projectAssetCatalogConfig.generatedDir, OLD_TEXTURE_MANIFEST));
const assetsIndex = await fs.readFile(assetsIndexPath, 'utf8');
const importMap = parseUrlImports(assetsIndex);
const manualModelMap = parseFlatObjectMap(assetsIndex, MODEL_MAP_NAME);
const manualGroundTextureMap = parseFlatObjectMap(assetsIndex, GROUND_TEXTURE_MAP_NAME);
const uiImageMap = {
  ...Object.fromEntries(parseFlatObjectMap(assetsIndex, 'UIImages')),
  ...parseNestedFlatObjectMap(assetsIndex, 'TextureAssets', 'ui'),
};
const soundMap = Object.fromEntries(parseFlatObjectMap(assetsIndex, 'SoundAssets'));
const entries = [];

const existingByLegacyKey = new Map(existingManifest
  .filter((entry) => typeof entry?.codeKey === 'string')
  .map((entry) => [`${entry.kind}:${entry.codeKey}`, entry]));
const existingByPath = new Map(existingManifest
  .filter((entry) => typeof entry?.relativePath === 'string')
  .map((entry) => [entry.relativePath, entry]));

for (const [codeKey, importName] of manualModelMap) {
  addImportedEntry({
    entries,
    importMap,
    importName,
    codeKey,
    kind: 'model',
    placeable: true,
    priority: 10,
    existingByLegacyKey,
    existingByPath,
  });
}

for (const [codeKey, relativeAssetPath] of Object.entries(DIRECT_RUNTIME_MODEL_ASSETS)) {
  addFileEntry({
    entries,
    codeKey,
    kind: 'model',
    placeable: false,
    priority: 10,
    filePath: path.resolve(cwd, 'src/assets', relativeAssetPath),
    existingByLegacyKey,
    existingByPath,
  });
}

for (const [codeKey, importName] of manualGroundTextureMap) {
  addImportedEntry({
    entries,
    importMap,
    importName,
    codeKey,
    kind: 'texture',
    placeable: true,
    priority: 10,
    existingByLegacyKey,
    existingByPath,
  });
}

for (const [codeKey, importName] of Object.entries(uiImageMap)) {
  addImportedEntry({
    entries,
    importMap,
    importName,
    codeKey,
    kind: 'image',
    placeable: false,
    priority: 10,
    existingByLegacyKey,
    existingByPath,
  });
}

for (const [codeKey, importName] of Object.entries(soundMap)) {
  addImportedEntry({
    entries,
    importMap,
    importName,
    codeKey,
    kind: 'sound',
    placeable: false,
    priority: 10,
    existingByLegacyKey,
    existingByPath,
  });
}

for (const entry of oldModelManifest) {
  addLegacyManifestEntry({
    entries,
    entry,
    kind: 'model',
    priority: 20,
    placeable: true,
    existingByLegacyKey,
    existingByPath,
  });
}

for (const entry of oldTextureManifest) {
  addLegacyManifestEntry({
    entries,
    entry,
    kind: 'texture',
    priority: 40,
    placeable: true,
    existingByLegacyKey,
    existingByPath,
  });
}

for (const entry of existingManifest) {
  if (!entry || typeof entry !== 'object') continue;
  entries.push({
    ...entry,
    legacyKey: entry.codeKey,
    priority: 30,
  });
}

const catalog = finalizeCatalogEntries(entries);
const manifestCatalog = stripMigrationOnlyFields(catalog);
const legacy = buildLegacyMaps(catalog);
const scene = await readJson(scenePath);
const editorScene = await readJson(editorScenePath);
const migratedScene = migrateSceneConfig(scene, legacy, manifestCatalog);
const migratedEditorScene = migrateEditorScene(editorScene, legacy);
const registryContent = generateAssetCatalogModule(manifestCatalog);
const summary = {
  dryRun,
  catalogEntries: manifestCatalog.length,
  byKind: countBy(manifestCatalog, (entry) => entry.kind),
  sceneAssetCount: migratedScene.scene?.assets?.length ?? 0,
  editorSceneAssetCount: migratedEditorScene.assets?.length ?? 0,
  legacyAssetIdMappings: legacy.assetId.size,
  textureIdMappings: legacy.textureId.size,
  oldRegistryFilesRemoved: [
    OLD_MODEL_MANIFEST,
    OLD_MODEL_REGISTRY,
    OLD_TEXTURE_MANIFEST,
    OLD_TEXTURE_REGISTRY,
  ],
};

if (!dryRun) {
  await fs.writeFile(manifestPath, `${JSON.stringify(manifestCatalog, null, 2)}\n`);
  await fs.writeFile(registryPath, registryContent);
  await fs.writeFile(scenePath, `${JSON.stringify(migratedScene, null, 2)}\n`);
  await fs.writeFile(editorScenePath, `${JSON.stringify(migratedEditorScene, null, 2)}\n`);
  for (const fileName of summary.oldRegistryFilesRemoved) {
    await fs.rm(path.join(projectAssetCatalogConfig.generatedDir, fileName), { force: true });
  }
}

if (report || dryRun) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`Migrated ${summary.catalogEntries} catalog assets`);
}

function addImportedEntry(input) {
  const importPath = input.importMap.get(input.importName);
  if (!importPath) return;
  const filePath = path.resolve(cwd, 'src/assets', importPath);
  addFileEntry({ ...input, filePath });
}

function addFileEntry(input) {
  const filePath = input.filePath;
  const relativePath = toGeneratedRelativePath(filePath);
  const originalFileName = path.basename(filePath);
  input.entries.push(createCatalogCandidate({
    codeKey: input.codeKey,
    legacyKey: input.codeKey,
    kind: input.kind,
    placeable: input.placeable,
    priority: input.priority,
    relativePath,
    originalFileName,
    displayName: normalizeDisplayName(null, originalFileName),
    existingByLegacyKey: input.existingByLegacyKey,
    existingByPath: input.existingByPath,
  }));
}

function addLegacyManifestEntry(input) {
  if (!input.entry || typeof input.entry !== 'object') return;
  const codeKey = typeof input.entry.sourceId === 'string' ? input.entry.sourceId : null;
  const relativePath = typeof input.entry.relativePath === 'string' ? input.entry.relativePath : null;
  if (!codeKey || !relativePath) return;
  input.entries.push(createCatalogCandidate({
    codeKey,
    legacyKey: codeKey,
    kind: input.kind,
    placeable: input.placeable,
    priority: input.priority,
    relativePath,
    originalFileName: typeof input.entry.originalFileName === 'string'
      ? input.entry.originalFileName
      : path.basename(relativePath),
    displayName: normalizeDisplayName(input.entry.displayName, input.entry.originalFileName ?? codeKey),
    contentHash: input.entry.contentHash,
    byteSize: input.entry.byteSize,
    createdAt: input.entry.createdAt,
    updatedAt: input.entry.updatedAt,
    existingByLegacyKey: input.existingByLegacyKey,
    existingByPath: input.existingByPath,
  }));
}

function createCatalogCandidate(input) {
  const existing = input.existingByLegacyKey.get(`${input.kind}:${input.codeKey}`) ?? input.existingByPath.get(input.relativePath);
  const guid = existing?.guid ?? createAssetGuid();
  const assetId = existing?.assetId ?? createAssetId(input.kind, guid);
  return {
    guid,
    assetId,
    kind: input.kind,
    displayName: input.displayName,
    relativePath: input.relativePath,
    originalFileName: input.originalFileName,
    codeKey: input.codeKey,
    legacyKey: input.legacyKey,
    placeable: input.placeable,
    ...(input.contentHash ? { contentHash: input.contentHash } : {}),
    ...(typeof input.byteSize === 'number' ? { byteSize: input.byteSize } : {}),
    createdAt: input.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? existing?.updatedAt ?? new Date().toISOString(),
    priority: input.priority,
  };
}

function finalizeCatalogEntries(candidates) {
  const byPath = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.relativePath}`;
    const previous = byPath.get(key);
    if (!previous || candidate.priority > previous.priority) byPath.set(key, candidate);
  }

  const byAssetId = new Map();
  for (const candidate of byPath.values()) {
    const previous = byAssetId.get(candidate.assetId);
    if (!previous || candidate.priority > previous.priority) byAssetId.set(candidate.assetId, candidate);
  }

  const entries = [...byAssetId.values()].sort((a, b) => b.priority - a.priority);
  const codeKeyOwners = new Map();
  for (const entry of entries) {
    if (!entry.codeKey) continue;
    const previous = codeKeyOwners.get(entry.codeKey);
    if (!previous) {
      codeKeyOwners.set(entry.codeKey, entry);
      continue;
    }
    const winner = previous.priority >= entry.priority ? previous : entry;
    const loser = winner === previous ? entry : previous;
    loser.codeKey = createUniqueCodeKey(`${loser.codeKey}_static`, codeKeyOwners);
    codeKeyOwners.set(winner.codeKey, winner);
    codeKeyOwners.set(loser.codeKey, loser);
  }

  return entries
    .map(({ priority, ...entry }) => entry)
    .sort((a, b) => a.kind.localeCompare(b.kind)
      || (a.codeKey ?? '').localeCompare(b.codeKey ?? '')
      || a.assetId.localeCompare(b.assetId));
}

function stripMigrationOnlyFields(catalog) {
  return catalog.map(({ legacyKey: _legacyKey, ...entry }) => entry);
}

function buildLegacyMaps(catalog) {
  const byCodeKey = new Map(catalog
    .filter((entry) => entry.legacyKey)
    .map((entry) => [`${entry.kind}:${entry.legacyKey}`, entry]));
  const assetId = new Map();
  const textureId = new Map();
  for (const entry of catalog) {
    if (!entry.legacyKey) continue;
    if (entry.kind === 'model') {
      assetId.set(`asset_${entry.legacyKey}`, entry.assetId);
    }
    if (entry.kind === 'texture') {
      assetId.set(`texture_${entry.legacyKey}`, entry.assetId);
      textureId.set(entry.legacyKey, entry.assetId);
    }
  }
  for (const [codeKey, oldAssetId] of Object.entries(LEGACY_MODEL_ASSET_ID_OVERRIDES)) {
    const entry = byCodeKey.get(`model:${codeKey}`);
    if (entry) assetId.set(oldAssetId, entry.assetId);
  }
  return { byCodeKey, assetId, textureId };
}

function migrateSceneConfig(sceneConfig, legacy, catalog) {
  const next = structuredClone(sceneConfig);
  if (Array.isArray(next.scene?.assets)) {
    next.scene.assets = next.scene.assets.map((asset) => migrateSceneAsset(asset, legacy));
  }
  rewriteReferences(next, legacy);
  validateSceneReferences(next, catalog);
  return next;
}

function migrateEditorScene(editorScene, legacy) {
  const next = structuredClone(editorScene);
  if (Array.isArray(next.assets)) {
    next.assets = next.assets.map((asset) => migrateSceneAsset(asset, legacy));
  }
  rewriteReferences(next, legacy);
  return next;
}

function migrateSceneAsset(asset, legacy) {
  if (!asset || typeof asset !== 'object') return asset;
  const sourceEntry = typeof asset.sourceId === 'string' ? legacy.byCodeKey.get(`model:${asset.sourceId}`) : null;
  const idEntryAssetId = typeof asset.id === 'string' ? legacy.assetId.get(asset.id) : null;
  const nextAssetId = sourceEntry?.assetId ?? idEntryAssetId ?? asset.id;
  const guid = sourceEntry?.guid ?? findCatalogEntryByAssetId(legacy, nextAssetId)?.guid;
  const { sourceId: _sourceId, metadata, ...rest } = asset;
  return {
    ...rest,
    id: nextAssetId,
    ...(guid ? { guid } : {}),
    ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

function rewriteReferences(value, legacy) {
  if (Array.isArray(value)) {
    for (const item of value) rewriteReferences(item, legacy);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, raw] of Object.entries(value)) {
    if (key === 'assetId' && typeof raw === 'string' && legacy.assetId.has(raw)) {
      value[key] = legacy.assetId.get(raw);
      continue;
    }
    if (key === 'textureId' && typeof raw === 'string' && legacy.textureId.has(raw)) {
      value[key] = legacy.textureId.get(raw);
      continue;
    }
    rewriteReferences(raw, legacy);
  }
}

function validateSceneReferences(sceneConfig, catalog) {
  const scene = sceneConfig.scene;
  if (!scene || !Array.isArray(scene.assets)) return;
  const assetIds = new Set(scene.assets.map((asset) => asset.id));
  const catalogIds = new Set(catalog.map((asset) => asset.assetId));
  const textureIds = new Set(catalog.filter((asset) => asset.kind === 'texture').map((asset) => asset.assetId));
  const missing = [];
  scene.assets.forEach((asset, index) => {
    if (!catalogIds.has(asset.id)) missing.push({ path: `$.assets[${index}].id`, assetId: asset.id });
  });
  collectReferences(scene, (pathLabel, assetId, key) => {
    if (key === 'assetId' && pathLabel.includes('.nodes[') && !assetIds.has(assetId)) {
      missing.push({ path: pathLabel, assetId, expected: 'scene.assets' });
      return;
    }
    if (key === 'assetId' && !catalogIds.has(assetId)) {
      missing.push({ path: pathLabel, assetId, expected: 'catalog' });
      return;
    }
    if (key === 'textureId' && !textureIds.has(assetId)) {
      missing.push({ path: pathLabel, assetId, expected: 'catalog texture' });
    }
  });
  if (missing.length > 0) {
    throw new Error(`migration produced missing scene asset refs: ${JSON.stringify(missing.slice(0, 20))}`);
  }
}

function collectReferences(value, visit, pathLabel = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectReferences(item, visit, `${pathLabel}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, raw] of Object.entries(value)) {
    const childPath = `${pathLabel}.${key}`;
    if ((key === 'assetId' || key === 'textureId') && typeof raw === 'string') visit(childPath, raw, key);
    collectReferences(raw, visit, childPath);
  }
}

function findCatalogEntryByAssetId(legacy, assetId) {
  for (const entry of legacy.byCodeKey.values()) {
    if (entry.assetId === assetId) return entry;
  }
  return null;
}

function parseUrlImports(content) {
  const map = new Map();
  const pattern = /import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]\.\/([^'"]+)\?url['"];?/g;
  let match;
  while ((match = pattern.exec(content))) {
    map.set(match[1], match[2]);
  }
  return map;
}

function parseFlatObjectMap(content, name) {
  const body = extractObjectBody(content, name);
  if (!body) return [];
  return [...body.matchAll(/([A-Za-z0-9_$]+)\s*:\s*([A-Za-z_$][\w$]*)\s*,?/g)]
    .map((match) => [match[1], match[2]]);
}

function parseNestedFlatObjectMap(content, objectName, propertyName) {
  const body = extractObjectBody(content, objectName);
  if (!body) return {};
  const propertyMatch = new RegExp(`${propertyName}\\s*:\\s*\\{([\\s\\S]*?)\\}`, 'm').exec(body);
  if (!propertyMatch) return {};
  return Object.fromEntries([...propertyMatch[1].matchAll(/([A-Za-z0-9_$]+)\s*:\s*([A-Za-z_$][\w$]*)\s*,?/g)]
    .map((match) => [match[1], match[2]]));
}

function extractObjectBody(content, name) {
  const startPattern = new RegExp(`(?:export\\s+)?const\\s+${name}[^=]*=\\s*\\{`, 'm');
  const startMatch = startPattern.exec(content);
  if (!startMatch) return null;
  let depth = 1;
  let index = startMatch.index + startMatch[0].length;
  const start = index;
  for (; index < content.length; index += 1) {
    const char = content[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return content.slice(start, index);
    }
  }
  return null;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readJsonArray(filePath) {
  try {
    const value = await readJson(filePath);
    return Array.isArray(value) ? value : [];
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function toGeneratedRelativePath(filePath) {
  return path.relative(projectAssetCatalogConfig.generatedDir, filePath).split(path.sep).join('/');
}

function createUniqueCodeKey(base, owners) {
  let candidate = base;
  let suffix = 2;
  while (owners.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function countBy(items, keyFn) {
  const result = {};
  for (const item of items) {
    const key = keyFn(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}
