#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const playableSdk = await import('@fps-games/editor/playable-sdk');
const editorScene = await readJson(path.join(projectRoot, 'src/config/editor-scene.json'));
const manifest = await readJson(path.join(projectRoot, 'src/assets/generated/asset-catalog.manifest.json'));

const PREFAB_FIXTURE_ID = 'prefab_issue464_crate_reference';
const SOURCE_CODE_KEY = 'shadow_fixture_crate';

const sourceCatalogEntry = manifest.find(asset => asset?.codeKey === SOURCE_CODE_KEY && asset?.kind === 'model');
assert(sourceCatalogEntry, `prefab fixture source catalog entry with codeKey "${SOURCE_CODE_KEY}" must exist`);
const sourceAsset = editorScene.assets?.find(asset => asset?.id === sourceCatalogEntry.assetId && asset?.type === 'glb');
assert(sourceAsset, `prefab fixture source asset "${sourceCatalogEntry.assetId}" must exist as a lean editor-scene reference`);
assert.equal(sourceAsset.guid, sourceCatalogEntry.guid, 'prefab fixture source reference must preserve the catalog guid');

const prefabAsset = editorScene.assets?.find(asset => asset?.id === PREFAB_FIXTURE_ID);
assert(prefabAsset, `prefab fixture asset "${PREFAB_FIXTURE_ID}" must exist`);
assert.equal(playableSdk.isEditorScenePrefabAsset(prefabAsset), true, 'prefab fixture must satisfy playable SDK prefab asset contract');
assert.equal(prefabAsset.prefab.sourceAssetId, sourceAsset.id, 'prefab fixture must reference the expected source asset');
assert.equal(prefabAsset.prefab.sourceAssetGuid, sourceAsset.guid, 'prefab fixture must preserve source asset guid');

const rootNodeId = playableSdk.readEditorScenePrefabRootNodeId(prefabAsset);
assert.equal(rootNodeId, 'prefab-root', 'prefab fixture must expose a stable composition root');

const nodes = playableSdk.readEditorScenePrefabNodes(prefabAsset);
assert(nodes.some(node => node.id === rootNodeId && node.kind === 'root'), 'prefab fixture root node missing');
assert(nodes.some(node => (
  node.id === 'prefab-model'
  && node.kind === 'model'
  && node.parentId === rootNodeId
  && node.sourceAssetId === sourceAsset.id
)), 'prefab fixture must include a model child bound to the source asset');

const ensured = playableSdk.ensureEditorScenePrefabComposition(prefabAsset);
assert.equal(ensured.ok, true, 'prefab fixture composition must normalize successfully');

console.log('editor prefab stage fixture check passed');

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}
