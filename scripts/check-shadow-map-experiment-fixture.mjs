import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const editorScene = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/config/editor-scene.json'), 'utf8'));
const runtimeScene = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/config/scene.json'), 'utf8'));

const expectedCasters = [
  'capsule',
  'cube',
  'shadow_fixture_barrel',
  'shadow_fixture_bush',
  'shadow_fixture_chicken',
  'shadow_fixture_counter',
  'shadow_fixture_crate',
  'shadow_fixture_fence',
  'shadow_fixture_hay_bale',
  'shadow_fixture_log_bundle',
  'shadow_fixture_pine_tree',
  'shadow_fixture_player',
  'shadow_fixture_rocks',
  'shadow_fixture_truck',
  'shadow_fixture_worker',
  'sphere',
].sort();
const expectedSkinnedCasters = [
  'shadow_fixture_chicken',
  'shadow_fixture_player',
  'shadow_fixture_truck',
  'shadow_fixture_worker',
].sort();
const expectedReceiverOnly = [
  'asset_3',
  'plane',
  'shadow_map_experiment_vertical_receiver',
].sort();

assert.equal(editorScene.scene.shadowMapExperiment?.enabled, true);
const editorObjects = new Map(editorScene.scene.gameObjects.map(object => [object.id, object]));
const authoredCasters = [...editorObjects.values()]
  .filter(object => object.shadowMapExperiment?.cast === 'enabled')
  .map(object => object.id)
  .sort();
assert.deepEqual(authoredCasters, expectedCasters, 'authoring fixture must explicitly register every intended caster');
assert.deepEqual(
  authoredCasters.filter(id => editorObjects.get(id)?.shadowMapExperiment?.updateClass === 'skinned'),
  expectedSkinnedCasters,
  'skinned caster update classes must match asset analysis',
);
for (const id of expectedReceiverOnly) {
  assert.deepEqual(
    editorObjects.get(id)?.shadowMapExperiment,
    { cast: 'disabled', receive: 'enabled', updateClass: 'static' },
    `${id} must remain an automatic receiver without entering the caster budget`,
  );
}

const runtimePlugin = runtimeScene.plugins.find(plugin => plugin.pluginId === 'fps.shadow-map-experiment');
assert.ok(runtimePlugin, 'compiled runtime scene must contain the ShadowMap experiment plugin payload');
assert.equal(runtimePlugin.data.enabled, true);
assert.equal(
  runtimePlugin.data.revision,
  editorScene.meta.authoringSource.revision,
  'compiled plan revision must match the authoring source revision',
);
assert.equal(
  runtimeScene.meta.generatedFrom.revision,
  editorScene.meta.authoringSource.revision,
  'compiled scene metadata must match the authoring source revision',
);

const runtimeObjects = new Map(runtimePlugin.data.objects.map(object => [object.entityId, object]));
const compiledCasters = [...runtimeObjects.values()].filter(object => object.cast).map(object => object.entityId).sort();
assert.deepEqual(compiledCasters, expectedCasters, 'compiled plan must preserve every intended caster');
assert.deepEqual(
  compiledCasters.filter(id => runtimeObjects.get(id)?.updateClass === 'skinned'),
  expectedSkinnedCasters,
  'compiled plan must preserve skinned update classes',
);
for (const id of expectedReceiverOnly) {
  assert.deepEqual(
    { cast: runtimeObjects.get(id)?.cast, receive: runtimeObjects.get(id)?.receive },
    { cast: false, receive: true },
    `${id} must compile as receiver-only`,
  );
}

console.log('shadow-map experiment fixture: ok (16 casters, 4 skinned, automatic planar/vertical receivers)');
