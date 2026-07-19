import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const editorScene = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/config/editor-scene.json'), 'utf8'));
const runtimeScene = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/config/scene.json'), 'utf8'));
const shadowsConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'src/config/shadows.json'), 'utf8'));
const gameSource = fs.readFileSync(path.join(projectRoot, 'src/core/Game.ts'), 'utf8');
const gameplayTypesSource = fs.readFileSync(path.join(projectRoot, 'src/gameplay/types.ts'), 'utf8');

const expectedCasters = [
  'shadow_fixture_pine_tree',
  'shadow_fixture_worker',
].sort();
const expectedSkinnedCasters = ['shadow_fixture_worker'];
const expectedReceiverOnly = ['plane'];

assert.equal(
  editorScene.scene.shadowMapExperiment,
  undefined,
  'the reference scene must inherit global quality instead of persisting experiment-only scene overrides',
);
assert.equal(
  shadowsConfig.defaultBehaviorProfile,
  'receiver-static',
  'the full reference scene must remain receiver-only unless an object opts into casting',
);
const editorObjects = new Map(editorScene.scene.gameObjects.map(object => [object.id, object]));
const authoredCasters = [...editorObjects.values()]
  .filter(object => ['static-caster', 'skinned-dynamic'].includes(object.shadowMapExperiment?.behaviorProfile))
  .map(object => object.id)
  .sort();
assert.deepEqual(authoredCasters, expectedCasters, 'authoring fixture must explicitly register every intended caster');
assert.deepEqual(
  authoredCasters.filter(id => editorObjects.get(id)?.shadowMapExperiment?.behaviorProfile === 'skinned-dynamic'),
  expectedSkinnedCasters,
  'skinned caster behavior profiles must match asset analysis',
);
for (const id of expectedReceiverOnly) {
  assert.deepEqual(
    editorObjects.get(id)?.shadowMapExperiment,
    { behaviorProfile: 'receiver-static' },
    `${id} must remain an automatic receiver without entering the caster budget`,
  );
}

assert.match(
  gameplayTypesSource,
  /shadowService:\s*ShadowService\s*\|\s*null/,
  'the legacy ShadowService must remain optional while the ShadowMap experiment owns runtime shadows',
);
const gameplayDependencyGuard = gameSource.match(
  /private async initGameplayModules\(\): Promise<void> \{[\s\S]*?\n\s*\}\n\n\s*this\.projectGameplayRuntime/,
)?.[0];
assert.ok(gameplayDependencyGuard, 'Game gameplay dependency guard must remain discoverable');
assert.doesNotMatch(
  gameplayDependencyGuard,
  /!this\.shadowService/,
  'enabling the ShadowMap experiment must not skip all gameplay modules and activity-source registration',
);

const runtimePlugin = runtimeScene.plugins.find(plugin => plugin.pluginId === 'fps.shadow-map-experiment');
assert.ok(runtimePlugin, 'compiled runtime scene must contain the ShadowMap experiment plugin payload');
assert.equal(runtimePlugin.schemaVersion, 3);
assert.equal(runtimePlugin.data.schemaVersion, 3);
assert.equal(runtimePlugin.data.enabled, true);
assert.equal(runtimePlugin.data.qualityProfileId, 'balanced');
assert.deepEqual(runtimePlugin.data.generator.maps, shadowsConfig.qualityProfiles.balanced.maps);
assert.equal(runtimePlugin.data.generator.filter, shadowsConfig.qualityProfiles.balanced.receiverFilter);
assert.deepEqual(
  runtimePlugin.data.behaviorProfiles['receiver-static'],
  { cast: false, receive: true, updateClass: 'static' },
  'Plan v3 must carry the behavior profile catalog consumed by runtime registrations',
);
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

console.log('shadow-map experiment fixture: ok (full scene, 2 casters, 1 skinned, receiver-only default)');
