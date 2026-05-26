import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const manifest = await readJson('src/assets/generated/asset-catalog.manifest.json');
assert.ok(Array.isArray(manifest), 'asset catalog manifest must be an array');

for (const [index, entry] of manifest.entries()) {
  assert.equal(typeof entry.guid, 'string', `manifest[${index}].guid`);
  assert.equal(typeof entry.assetId, 'string', `manifest[${index}].assetId`);
  assert.ok(['model', 'texture', 'image', 'sound'].includes(entry.kind), `manifest[${index}].kind`);
  assert.equal(entry.assetId, createExpectedAssetId(entry.kind, entry.guid), `manifest[${index}].assetId must be derived from guid`);
  assert.equal(Object.hasOwn(entry, 'sourceId'), false, `manifest[${index}] must not contain sourceId`);
}

const assetFacade = await fs.readFile('src/assets/index.ts', 'utf8');
assertNoPattern(assetFacade, /MODEL_URL_MAP|TEXTURE_URL_MAP|getAllModelIds|getAllTextureIds|resolveModelUrl|resolveTextureUrl|isModelRegistered|isTextureRegistered/, 'src/assets/index.ts old model/texture asset APIs');
assert.match(assetFacade, /ASSET_CATALOG/, 'src/assets/index.ts must expose ASSET_CATALOG');
assert.match(assetFacade, /resolveModelAssetUrl/, 'src/assets/index.ts must expose resolveModelAssetUrl');
assert.match(assetFacade, /getAssetCatalogEntries/, 'src/assets/index.ts must expose getAssetCatalogEntries');

const runtimeFiles = [
  'src/core/Game.ts',
  'src/services/AssetLoader.ts',
  'src/services/ConfigValidator.ts',
  'src/services/SceneBuilder.ts',
  'src/services/assets/adapters/BabylonRuntimeAssetAdapter.ts',
  'src/fps-game-editor-adapter/document.ts',
];

for (const file of runtimeFiles) {
  const content = await fs.readFile(file, 'utf8');
  assertNoPattern(content, /asset\.sourceId/, `${file} asset.sourceId`);
  assertNoPattern(content, /MODEL_URL_MAP|TEXTURE_URL_MAP|getAllModelIds|getAllTextureIds|resolveModelUrl|resolveTextureUrl|isModelRegistered|isTextureRegistered/, `${file} old model/texture asset APIs`);
}

const sceneConfig = await readJson('src/config/scene.json');
const modelIds = new Set(manifest.filter((entry) => entry.kind === 'model').map((entry) => entry.assetId));
const textureIds = new Set(manifest.filter((entry) => entry.kind === 'texture').map((entry) => entry.assetId));

for (const [index, asset] of (sceneConfig.scene?.assets ?? []).entries()) {
  assert.ok(modelIds.has(asset.id), `scene.assets[${index}].id must be a catalog model assetId`);
}

walk(sceneConfig.scene, (path, key, value) => {
  if (key === 'textureId') assert.ok(textureIds.has(value), `${path} must be a catalog texture assetId`);
});

console.log('asset runtime catalog checks passed');

function assertNoPattern(content, pattern, label) {
  assert.equal(pattern.test(content), false, `${label} must be removed`);
}

function walk(value, visit, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if ((key === 'assetId' || key === 'textureId') && typeof child === 'string') visit(childPath, key, child);
    walk(child, visit, childPath);
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function createExpectedAssetId(kind, guid) {
  const token = guid.replace(/-/g, '').toLowerCase();
  const prefix = kind === 'model'
    ? 'asset'
    : kind === 'texture'
      ? 'texture'
      : kind === 'sound'
        ? 'sound'
        : 'image';
  return `${prefix}_${token}`;
}
