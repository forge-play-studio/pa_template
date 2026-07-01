import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  createAssetId,
} from './asset-registry/core.mjs';

const manifest = await readJson('src/assets/generated/asset-catalog.manifest.json');
const sceneConfig = await readJson('src/config/scene.json');
const editorScene = await readJson('src/config/editor-scene.json');

assert.ok(Array.isArray(manifest), 'asset catalog manifest must be an array');

const catalogIds = new Set();
const catalogGuids = new Set();
const modelIds = new Set();
const textureIds = new Set();
const kinds = new Set();

for (const [index, entry] of manifest.entries()) {
  assert.equal(typeof entry.guid, 'string', `manifest[${index}].guid`);
  assert.equal(typeof entry.assetId, 'string', `manifest[${index}].assetId`);
  assert.equal(typeof entry.displayName, 'string', `manifest[${index}].displayName`);
  assert.equal(typeof entry.relativePath, 'string', `manifest[${index}].relativePath`);
  assert.ok(['model', 'texture', 'image', 'sound'].includes(entry.kind), `manifest[${index}].kind`);
  assert.equal(entry.assetId, createAssetId(entry.kind, entry.guid), `manifest[${index}].assetId must match SDK identity`);
  assert.equal(Object.hasOwn(entry, 'sourceId'), false, `manifest[${index}] must not contain sourceId`);
  assert.equal(catalogIds.has(entry.assetId), false, `duplicate assetId ${entry.assetId}`);
  assert.equal(catalogGuids.has(entry.guid), false, `duplicate guid ${entry.guid}`);
  catalogIds.add(entry.assetId);
  catalogGuids.add(entry.guid);
  kinds.add(entry.kind);
  if (entry.kind === 'model') modelIds.add(entry.assetId);
  if (entry.kind === 'texture') textureIds.add(entry.assetId);
}

checkSceneConfig(sceneConfig);
checkEditorScene(editorScene);

console.log('asset guid migration checks passed');

function checkSceneConfig(config) {
  const sceneAssets = Array.isArray(config.scene?.assets) ? config.scene.assets : [];
  const sceneAssetIds = new Set(sceneAssets.map((asset) => asset.id));
  for (const [index, asset] of sceneAssets.entries()) {
    assert.equal(Object.hasOwn(asset, 'sourceId'), false, `scene.assets[${index}] must not contain sourceId`);
    assert.ok(modelIds.has(asset.id), `scene.assets[${index}].id must point to catalog model`);
    assert.equal(typeof asset.guid, 'string', `scene.assets[${index}].guid`);
  }
  walk(config.scene, (path, key, value) => {
    if (key === 'assetId') {
      if (path.includes('.nodes[')) assert.ok(sceneAssetIds.has(value), `${path} must reference scene.assets`);
      else assert.ok(modelIds.has(value) || textureIds.has(value), `${path} must reference catalog asset`);
    }
    if (key === 'textureId') assert.ok(textureIds.has(value), `${path} must reference catalog texture`);
  });
}

function checkEditorScene(document) {
  const sceneAssetIds = new Set((document.assets ?? []).map((asset) => asset.id));
  for (const [index, asset] of (document.assets ?? []).entries()) {
    assert.equal(Object.hasOwn(asset, 'sourceId'), false, `editor.assets[${index}] must not contain sourceId`);
    assert.ok(modelIds.has(asset.id), `editor.assets[${index}].id must point to catalog model`);
    assert.equal(typeof asset.guid, 'string', `editor.assets[${index}].guid`);
  }
  walk(document, (path, key, value) => {
    if (key === 'assetId') {
      if (path.includes('.components[')) assert.ok(sceneAssetIds.has(value), `${path} must reference editor assets`);
      else assert.ok(modelIds.has(value) || textureIds.has(value), `${path} must reference catalog asset`);
    }
    if (key === 'textureId') assert.ok(textureIds.has(value), `${path} must reference catalog texture`);
  });
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
