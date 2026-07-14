#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createEditorSceneAssetLibrary } from '@fps-games/editor/playable-sdk';

const root = process.cwd();
const catalogPath = path.join(root, 'src/assets/generated/asset-catalog.manifest.json');
const editorScenePath = path.join(root, 'src/config/editor-scene.json');
const scenePath = path.join(root, 'src/config/scene.json');

const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const catalogById = new Map(catalog.map((entry) => [entry.assetId, entry]));
const editorScene = JSON.parse(await fs.readFile(editorScenePath, 'utf8'));
const scene = JSON.parse(await fs.readFile(scenePath, 'utf8'));

assert(Array.isArray(editorScene.assets), 'editor scene assets must be an array');
for (const [index, asset] of editorScene.assets.entries()) {
  assert.equal(Object.hasOwn(asset, 'sourceId'), false, `editorScene.assets[${index}] must not contain sourceId`);
  if (asset.type === 'prefab' || asset.kind === 'prefab' || asset.prefab) {
    assert.equal(asset.type, 'prefab', `editorScene.assets[${index}] prefab asset must use type prefab`);
    assert(
      asset.kind == null || asset.kind === 'prefab',
      `editorScene.assets[${index}] prefab asset kind must be absent or prefab`,
    );
    assert(asset.prefab && typeof asset.prefab === 'object', `editorScene.assets[${index}] prefab asset must contain prefab definition`);
    const sourceAssetId = asset.prefab.sourceAssetId;
    assert.equal(typeof sourceAssetId, 'string', `editorScene.assets[${index}] prefab asset must reference sourceAssetId`);
    const sourceEntry = catalogById.get(sourceAssetId);
    assert(sourceEntry, `editorScene.assets[${index}] prefab sourceAssetId must reference catalog assetId`);
    assert.equal(sourceEntry.kind, 'model', `editorScene.assets[${index}] prefab sourceAssetId must reference a model asset`);
    continue;
  }
  const entry = catalogById.get(asset.id);
  assert(entry, `editorScene.assets[${index}] must reference catalog assetId`);
  assert.equal(entry.kind, 'model', `editorScene.assets[${index}] must reference a model asset`);
  assert.equal(asset.guid, entry.guid, `editorScene.assets[${index}] guid must match catalog`);
}

for (const [index, asset] of scene.scene.assets.entries()) {
  assert.equal(Object.hasOwn(asset, 'sourceId'), false, `scene.assets[${index}] must not contain sourceId`);
}

for (const [index, gameObject] of editorScene.scene.gameObjects.entries()) {
  const groundDecal = gameObject.groundDecal;
  if (!groundDecal || typeof groundDecal !== 'object' || Array.isArray(groundDecal)) continue;
  for (const key of ['version', 'textureId', 'color', 'alphaIndex', 'diffuseTextureLevel', 'emissiveTextureLevel']) {
    assert.equal(Object.hasOwn(groundDecal, key), false, `groundDecal gameObject[${index}] must not contain removed field ${key}`);
  }
  for (const { path, textureId } of collectGroundDecalTextureRefs(groundDecal, `gameObject[${index}].groundDecal`)) {
    const entry = catalogById.get(textureId);
    assert(entry, `groundDecal ${path} textureId must reference catalog`);
    assert.equal(entry.kind, 'texture', `groundDecal ${path} textureId must reference a texture`);
    assert.doesNotMatch(textureId, /^texture_texture_/, `groundDecal ${path} textureId must not be double-prefixed`);
  }
}

await assertEditorAssetLibraryRuntime();

const sourceChecks = [
  ['src/editor-features/scene-feature.ts', /sourceId:\s*asset\.sourceId/, false],
  ['src/editor-features/local-editor.ts', /asset\.sourceId|sourceId:\s*groundDecalTextureId|readOptionalString\(value\.sourceId\)/, false],
  ['vite.config.ts', /createProjectEditorAssetLibrary\(modelIds|manifestBySourceId|textureManifestBySourceId/, false],
];

await assert.rejects(
  fs.access(path.join(root, 'src/fps-game-editor-adapter')),
  'retired adapter root must stay deleted',
);

for (const [relativePath, pattern, shouldMatch] of sourceChecks) {
  const text = await fs.readFile(path.join(root, relativePath), 'utf8');
  if (shouldMatch) assert.match(text, pattern, relativePath);
  else assert.doesNotMatch(text, pattern, relativePath);
}

console.log('editor canonical asset checks passed');

function collectGroundDecalTextureRefs(groundDecal, basePath) {
  const refs = [];
  if (groundDecal.mask && typeof groundDecal.mask === 'object' && typeof groundDecal.mask.textureId === 'string') {
    refs.push({ path: `${basePath}.mask`, textureId: groundDecal.mask.textureId });
  }
  if (Array.isArray(groundDecal.layers)) {
    groundDecal.layers.forEach((layer, index) => {
      if (layer && typeof layer === 'object' && typeof layer.textureId === 'string') {
        refs.push({ path: `${basePath}.layers[${index}]`, textureId: layer.textureId });
      }
    });
  }
  return refs;
}

async function assertEditorAssetLibraryRuntime() {
    const library = createEditorSceneAssetLibrary([
      {
        guid: '11111111-2222-4333-8444-555555555555',
        assetId: 'asset_11111111222243338444555555555555',
        kind: 'model',
        displayName: '中文模型',
        relativePath: '../中文模型.glb',
        originalFileName: '中文模型.glb',
        codeKey: 'tree_lv1',
        placeable: true,
      },
      {
        guid: '66666666-7777-4888-8999-aaaaaaaaaaaa',
        assetId: 'texture_66666666777748888999aaaaaaaaaaaa',
        kind: 'texture',
        displayName: '中文地贴',
        relativePath: '../中文地贴.png',
        originalFileName: '中文地贴.png',
        placeable: true,
      },
    ]);
    const model = library.find((item) => item.assetId === 'asset_11111111222243338444555555555555');
    const texture = library.find((item) => item.assetId === 'texture_66666666777748888999aaaaaaaaaaaa');
    assert(model, 'model library item missing');
    assert(texture, 'texture library item missing');
    assert.equal(model.id, model.assetId);
    assert.equal(model.displayName, '中文模型');
    assert.equal(model.origin, 'project');
    assert.equal(Object.hasOwn(model, 'sourceId'), false);
    assert.equal(texture.id, texture.assetId);
    assert.equal(texture.type, 'texture');
    assert.equal(texture.kind, 'texture');
    assert.equal(Object.hasOwn(texture, 'sourceId'), false);
}
