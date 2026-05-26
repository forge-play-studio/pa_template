#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

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
  const entry = catalogById.get(asset.id);
  assert(entry, `editorScene.assets[${index}] must reference catalog assetId`);
  assert.equal(entry.kind, 'model', `editorScene.assets[${index}] must reference a model asset`);
  assert.equal(asset.guid, entry.guid, `editorScene.assets[${index}] guid must match catalog`);
}

for (const [index, asset] of scene.scene.assets.entries()) {
  assert.equal(Object.hasOwn(asset, 'sourceId'), false, `scene.assets[${index}] must not contain sourceId`);
}

for (const [index, gameObject] of editorScene.scene.gameObjects.entries()) {
  const textureId = gameObject.groundDecal?.textureId;
  if (typeof textureId !== 'string') continue;
  const entry = catalogById.get(textureId);
  assert(entry, `groundDecal gameObject[${index}] textureId must reference catalog`);
  assert.equal(entry.kind, 'texture', `groundDecal gameObject[${index}] textureId must reference a texture`);
  assert.doesNotMatch(textureId, /^texture_texture_/, `groundDecal gameObject[${index}] textureId must not be double-prefixed`);
}

await assertEditorAssetLibraryRuntime();

const sourceChecks = [
  ['src/fps-game-editor-adapter/editor-scene-document.ts', /\bsourceId\b/, false],
  ['src/fps-game-editor-adapter/editor-asset-library.ts', /\bsourceId\b/, false],
  ['src/fps-game-editor-adapter/editor-scene-compiler.ts', /sourceId:\s*asset\.sourceId/, false],
  ['src/fps-game-editor-adapter/editor-scene-session.ts', /assetItem\.sourceId|asset\.sourceId|textureId:\s*assetItem\.sourceId/, false],
  ['src/debug/local-editor-mode-switcher.ts', /asset\.sourceId|sourceId:\s*groundDecalTextureId|readOptionalString\(value\.sourceId\)/, false],
  ['vite.config.ts', /createProjectEditorAssetLibrary\(modelIds|manifestBySourceId|textureManifestBySourceId/, false],
];

for (const [relativePath, pattern, shouldMatch] of sourceChecks) {
  const text = await fs.readFile(path.join(root, relativePath), 'utf8');
  if (shouldMatch) assert.match(text, pattern, relativePath);
  else assert.doesNotMatch(text, pattern, relativePath);
}

console.log('editor canonical asset checks passed');

async function assertEditorAssetLibraryRuntime() {
  const sourcePath = path.join(root, 'src/fps-game-editor-adapter/editor-asset-library.ts');
  const source = await fs.readFile(sourcePath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'editor-asset-library-check-'));
  const modulePath = path.join(tempDir, 'editor-asset-library.mjs');
  await fs.writeFile(modulePath, output);
  try {
    const module = await import(pathToFileURL(modulePath).href);
    const library = module.createProjectEditorAssetLibrary([
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
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
