import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  PlayableEditorAssetRegistryError as AssetRegistryError,
  unregisterPlayableEditorAsset as unregisterAsset,
} from '@fps-games/editor/playable-sdk/vite';

const errorCodes = {
  assetStillReferenced: 'asset_still_referenced',
};
const guid = '11111111-2222-4333-8444-555555555555';
const assetId = 'asset_11111111222243338444555555555555';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'project-asset-registry-'));

try {
  const config = await createConfig(root);
  await seedRegistry(config);
  await writeScene(config, {
    assets: [{ id: assetId, guid, type: 'glb' }],
    nodes: [],
  });

  const removed = await unregisterAsset(config, { assetId }, errorCodes);
  assert.equal(removed.ok, true);
  assert.equal(removed.guid, guid);
  assert.equal(removed.assetId, assetId);
  assert.equal(removed.kind, 'model');

  await seedRegistry(config);
  await writeScene(config, {
    assets: [{ id: assetId, guid, type: 'glb' }],
    nodes: [{ id: 'foo_1', kind: 'instance', instance: { assetId } }],
  });

  await assert.rejects(
    unregisterAsset(config, { guid }, errorCodes),
    (error) => {
      assert.ok(error instanceof AssetRegistryError);
      assert.equal(error.message, errorCodes.assetStillReferenced);
      assert.deepEqual(error.details.nodeIds, ['foo_1']);
      return true;
    },
  );

  console.log('asset registry unregister guard checks passed');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}

async function createConfig(baseDir) {
  const assetsDir = path.join(baseDir, 'src/assets');
  const importedDir = path.join(assetsDir, 'imported');
  const generatedDir = path.join(assetsDir, 'generated');
  await fs.mkdir(importedDir, { recursive: true });
  await fs.mkdir(generatedDir, { recursive: true });
  return {
    cwd: baseDir,
    assetsDir,
    importedDir,
    generatedDir,
    manifestPath: path.join(generatedDir, 'asset-catalog.manifest.json'),
    registryPath: path.join(generatedDir, 'asset-catalog.generated.ts'),
    scenePath: path.join(baseDir, 'src/config/scene.json'),
    supportedExtension: '.glb',
    commands: {
      register: 'npm run asset:register',
      unregister: 'npm run asset:unregister',
    },
    loadRules: async () => ({ errorCodes }),
    relativeImportedPath: (_kind, fileName) => `../imported/${fileName}`,
    publicUrlForImportedAsset: (_kind, fileName) => `/src/assets/imported/${fileName}`,
  };
}

async function seedRegistry(config) {
  await fs.mkdir(config.importedDir, { recursive: true });
  await fs.mkdir(config.generatedDir, { recursive: true });
  await fs.writeFile(path.join(config.importedDir, 'foo.glb'), 'fake glb');
  await fs.writeFile(config.manifestPath, `${JSON.stringify([
    {
      guid,
      assetId,
      kind: 'model',
      displayName: 'Foo',
      relativePath: '../imported/foo.glb',
      originalFileName: 'foo.glb',
    },
  ], null, 2)}\n`);
}

async function writeScene(config, scene) {
  await fs.mkdir(path.dirname(config.scenePath), { recursive: true });
  await fs.writeFile(config.scenePath, `${JSON.stringify({ schemaVersion: 3, scene }, null, 2)}\n`);
}
