#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const playableSdk = await import('@fps-games/editor/playable-sdk');
const editorScene = await readJson(path.join(projectRoot, 'src/config/editor-scene.json'));

const PREFAB_FIXTURE_ID = 'prefab_issue464_crate_reference';
const SOURCE_CODE_KEY = 'shadow_fixture_crate';

const sourceAsset = editorScene.assets?.find(asset => asset?.metadata?.codeKey === SOURCE_CODE_KEY);
assert(sourceAsset, `prefab fixture source asset with codeKey "${SOURCE_CODE_KEY}" must exist`);

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
