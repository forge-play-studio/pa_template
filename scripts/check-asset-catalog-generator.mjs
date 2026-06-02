import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AssetRegistryError, createAssetId, registerAsset, unregisterAsset, loadManifest, toImportName } from './asset-registry/core.mjs';
import { projectAssetCatalogConfig } from './asset-registry/project-asset-catalog-config.mjs';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-catalog-check-'));
const cwd = tempRoot;
const assetsDir = path.join(cwd, 'assets');
const generatedDir = path.join(assetsDir, 'generated');
const importedDir = path.join(assetsDir, 'imported');
const scenePath = path.join(cwd, 'scene.json');
const sourceModel = path.join(cwd, '中文模型.glb');
const explicitProjectModel = path.join(cwd, '显式项目资产.glb');
const invalidProjectModel = path.join(cwd, '错误项目资产.glb');
const sourceTexture = path.join(cwd, '地贴.png');
const preservedModel = path.join(assetsDir, '静态模型.glb');
const slotMetadataModel = path.join(cwd, 'slot-metadata.gltf');
const duplicateSlotMetadataModel = path.join(cwd, 'duplicate-slot-metadata.gltf');
const emptySlotMetadataModel = path.join(cwd, 'empty-slot-metadata.gltf');
const codeFile = path.join(assetsDir, 'index.ts');

await fs.writeFile(scenePath, JSON.stringify({ scene: { nodes: [] } }));
await fs.writeFile(sourceModel, 'glb-bytes');
await fs.writeFile(explicitProjectModel, 'explicit-project-glb-bytes');
await fs.writeFile(invalidProjectModel, 'invalid-project-glb-bytes');
await fs.writeFile(sourceTexture, 'png-bytes');
await fs.writeFile(slotMetadataModel, JSON.stringify({
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [
    { name: 'Root', children: [1] },
    { name: 'Body', mesh: 0 },
  ],
  meshes: [{ name: 'BodyMesh', primitives: [{ material: 0 }, { material: 1 }] }],
  materials: [{ name: 'Paint' }, { name: 'Frame' }],
}));
await fs.writeFile(duplicateSlotMetadataModel, JSON.stringify({
  scene: 0,
  scenes: [{ nodes: [0, 1] }],
  nodes: [
    { name: 'Bolt', mesh: 0 },
    { name: 'Bolt', mesh: 1 },
  ],
  meshes: [
    { name: 'BoltA', primitives: [{ material: 0 }] },
    { name: 'BoltB', primitives: [{ material: 1 }] },
  ],
  materials: [{ name: 'Metal' }, { name: 'Paint' }],
}));
await fs.writeFile(emptySlotMetadataModel, JSON.stringify({
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Empty' }],
  meshes: [],
  materials: [],
}));
await fs.mkdir(assetsDir, { recursive: true });
await fs.writeFile(preservedModel, 'preserved-glb-bytes');
await fs.writeFile(codeFile, 'export const untouched = true;\n');

const config = {
  cwd,
  assetsDir,
  importedDir,
  generatedDir,
  manifestPath: path.join(generatedDir, 'asset-catalog.manifest.json'),
  registryPath: path.join(generatedDir, 'asset-catalog.generated.ts'),
  scenePath,
  supportedExtensions: ['.glb', '.png'],
  commands: {
    register: 'npm run asset:register',
    unregister: 'npm run asset:unregister',
  },
  async loadRules() {
    return { errorCodes: {} };
  },
  relativeImportedPath(kind, fileName) {
    return kind === 'model' ? `../imported/${fileName}` : `../imported/textures/${fileName}`;
  },
  publicUrlForImportedAsset(kind, fileName) {
    return kind === 'model' ? `/assets/${fileName}` : `/assets/textures/${fileName}`;
  },
  publicUrlForCatalogRelativePath(relativePath) {
    const targetPath = path.resolve(generatedDir, relativePath);
    const relativeToAssets = path.relative(assetsDir, targetPath).split(path.sep).join('/');
    return `/assets/${relativeToAssets}`;
  },
  generateRegistry(manifest) {
    const imports = manifest
      .map((entry) => `import ${toImportName(entry.assetId)} from '${entry.relativePath}?url';`)
      .join('\n');
    const entries = manifest
      .map((entry) => `  ${JSON.stringify(entry.assetId)}: { guid: ${JSON.stringify(entry.guid)}, assetId: ${JSON.stringify(entry.assetId)}, kind: ${JSON.stringify(entry.kind)}, displayName: ${JSON.stringify(entry.displayName)}, url: ${toImportName(entry.assetId)}, relativePath: ${JSON.stringify(entry.relativePath)} },`)
      .join('\n');
    return [
      imports,
      'export const GENERATED_ASSET_CATALOG = {',
      entries,
      '} as const;',
      'export const GENERATED_ASSET_URL_MAP = Object.fromEntries(Object.entries(GENERATED_ASSET_CATALOG).map(([assetId, entry]) => [assetId, entry.url]));',
      '',
    ].join('\n');
  },
};

const modelPayload = path.join(cwd, 'model-payload.json');
await fs.writeFile(modelPayload, JSON.stringify({
  sourcePath: sourceModel,
  assetName: '中文模型.glb',
  displayName: '中文模型',
  assetType: 'model',
  assetId: 'raw_model_1',
}));
const model = await registerAsset(config, { payload: modelPayload });
const explicitProjectGuid = '11111111-2222-4333-8444-555555555555';
const explicitProjectAssetId = createAssetId('model', explicitProjectGuid);
const explicitProjectPayload = path.join(cwd, 'explicit-project-payload.json');
await fs.writeFile(explicitProjectPayload, JSON.stringify({
  sourcePath: explicitProjectModel,
  assetName: '显式项目资产.glb',
  displayName: '显式项目资产',
  assetType: 'model',
  guid: explicitProjectGuid,
  projectAssetId: explicitProjectAssetId,
  assetId: 'raw_model_explicit',
}));
const explicitProject = await registerAsset(config, { payload: explicitProjectPayload });
const invalidProjectPayload = path.join(cwd, 'invalid-project-payload.json');
await fs.writeFile(invalidProjectPayload, JSON.stringify({
  sourcePath: invalidProjectModel,
  assetName: '错误项目资产.glb',
  displayName: '错误项目资产',
  assetType: 'model',
  guid: '99999999-2222-4333-8444-555555555555',
  projectAssetId: 'asset_aaaaaaaa222243338444555555555555',
  assetId: 'raw_model_invalid',
}));
await assert.rejects(
  registerAsset(config, { payload: invalidProjectPayload }),
  (error) => {
    assert.ok(error instanceof AssetRegistryError);
    assert.equal(error.message, 'project_asset_id_must_match_guid');
    return true;
  },
);
const texturePayload = path.join(cwd, 'texture-payload.json');
await fs.writeFile(texturePayload, JSON.stringify({
  sourcePath: sourceTexture,
  assetName: '地贴.png',
  displayName: '地贴',
  assetType: 'texture',
}));
const texture = await registerAsset(config, { payload: texturePayload });
const preservedGuid = '22222222-3333-4444-8555-666666666666';
const preservedAssetId = 'asset_22222222333344448555666666666666';
const preservedHash = `sha256:${crypto.createHash('sha256').update(await fs.readFile(preservedModel)).digest('hex')}`;
const existingManifest = await loadManifest(config);
await fs.writeFile(config.manifestPath, `${JSON.stringify([
  ...existingManifest,
  {
    guid: preservedGuid,
    assetId: preservedAssetId,
    kind: 'model',
    displayName: '静态模型',
    relativePath: '../静态模型.glb',
    originalFileName: '静态模型.glb',
    contentHash: preservedHash,
    external: { platformAssetId: 'raw_preserved_model' },
  },
], null, 2)}\n`);
const preservedPayload = path.join(cwd, 'preserved-payload.json');
await fs.writeFile(preservedPayload, JSON.stringify({
  sourcePath: preservedModel,
  assetName: '静态模型.glb',
  assetType: 'model',
  platformAssetId: 'raw_preserved_model',
}));
const preserved = await registerAsset(config, { payload: preservedPayload });
const manifest = await loadManifest(config);
const generated = await fs.readFile(config.registryPath, 'utf8');

assert.equal(manifest.length, 4);
assert.equal(model.kind, 'model');
assert.equal(texture.kind, 'texture');
assert.equal(explicitProject.assetId, explicitProjectAssetId);
assert.equal(explicitProject.external.platformAssetId, 'raw_model_explicit');
assert.equal(preserved.assetId, preservedAssetId);
assert.equal(preserved.assetUrl, '/assets/静态模型.glb');
assert.equal(preserved.targetPath, preservedModel);
assert.match(model.assetId, /^asset_[a-f0-9]{32}$/);
assert.notEqual(model.assetId, 'raw_model_1');
assert.equal(model.external.platformAssetId, 'raw_model_1');
assert.match(texture.assetId, /^texture_[a-f0-9]{32}$/);
assert.equal(manifest.some((entry) => Object.hasOwn(entry, 'sourceId')), false);
assert.match(generated, /GENERATED_ASSET_CATALOG/);
assert.doesNotMatch(generated, /sourceId/);

await fs.writeFile(config.manifestPath, `${JSON.stringify([
  {
    guid: '33333333-4444-4555-8666-777777777777',
    assetId: 'asset_33333333444445558666777777777777',
    kind: 'model',
    displayName: 'Bad Escape',
    relativePath: '../../package.json',
  },
], null, 2)}\n`);
await assert.rejects(
  unregisterAsset(config, { assetId: 'asset_33333333444445558666777777777777' }),
  (error) => {
    assert.ok(error instanceof AssetRegistryError);
    assert.equal(error.message, 'unregister_target_path_outside_allowed_directory');
    return true;
  },
);

await fs.writeFile(config.manifestPath, `${JSON.stringify([
  {
    guid: '44444444-5555-4666-8777-888888888888',
    assetId: 'asset_44444444555546668777888888888888',
    kind: 'model',
    displayName: 'Bad Code File',
    relativePath: '../index.ts',
    external: { platformAssetId: 'raw_bad_code_file' },
  },
], null, 2)}\n`);
const badCodePayload = path.join(cwd, 'bad-code-payload.json');
await fs.writeFile(badCodePayload, JSON.stringify({
  sourcePath: sourceModel,
  assetType: 'model',
  platformAssetId: 'raw_bad_code_file',
}));
await assert.rejects(
  registerAsset(config, { payload: badCodePayload }),
  (error) => {
    assert.ok(error instanceof AssetRegistryError);
    assert.equal(error.message, 'target_path_unsupported_extension');
    return true;
  },
);
assert.equal(await fs.readFile(codeFile, 'utf8'), 'export const untouched = true;\n');

await assert.rejects(
  unregisterAsset(config, { assetId: 'asset_44444444555546668777888888888888' }),
  (error) => {
    assert.ok(error instanceof AssetRegistryError);
    assert.equal(error.message, 'unregister_target_path_unsupported_extension');
    return true;
  },
);
assert.equal(await fs.readFile(codeFile, 'utf8'), 'export const untouched = true;\n');

const slotMetadata = await projectAssetCatalogConfig.resolveAssetMetadata({
  kind: 'model',
  sourcePath: slotMetadataModel,
  guid: '55555555-6666-4777-8888-999999999999',
  assetId: 'asset_55555555666647778888999999999999',
  existingMetadata: {
    materialSlots: [{
      slotId: 'slot_existing_body',
      ownerNodePath: 'Body',
    }],
  },
  payloadMetadata: {},
});
assert.deepEqual(slotMetadata.materialSlots, [{
  slotId: 'slot_existing_body',
  ownerNodePath: 'Body',
  label: 'Body',
  nodeIndex: 1,
  meshIndex: 0,
  sourceMaterialIndex: 0,
  sourceMaterialIndices: [0, 1],
  materialName: 'Paint',
  materialNames: ['Paint', 'Frame'],
}]);

const duplicateSlotMetadata = await projectAssetCatalogConfig.resolveAssetMetadata({
  kind: 'model',
  sourcePath: duplicateSlotMetadataModel,
  guid: '66666666-7777-4888-8999-aaaaaaaaaaaa',
  assetId: 'asset_66666666777748888999aaaaaaaaaaaa',
  existingMetadata: {
    materialSlots: [{ slotId: 'slot_old_unique', ownerNodePath: 'Bolt' }],
  },
  payloadMetadata: {},
});
assert.equal(duplicateSlotMetadata.materialSlots.length, 2);
assert.equal(duplicateSlotMetadata.materialSlots[0].ownerNodePath, 'Bolt');
assert.equal(duplicateSlotMetadata.materialSlots[1].ownerNodePath, 'Bolt');
assert.notEqual(duplicateSlotMetadata.materialSlots[0].slotId, 'slot_old_unique');
assert.notEqual(duplicateSlotMetadata.materialSlots[1].slotId, 'slot_old_unique');
assert.notEqual(duplicateSlotMetadata.materialSlots[0].slotId, duplicateSlotMetadata.materialSlots[1].slotId);
assert.deepEqual(
  duplicateSlotMetadata.materialSlots.map(slot => [slot.nodeIndex, slot.meshIndex, slot.sourceMaterialIndex]),
  [[0, 0, 0], [1, 1, 1]],
);
assert.deepEqual(
  duplicateSlotMetadata.materialSlots.map(slot => slot.sourceMaterialIndices),
  [[0], [1]],
);

const clearedSlotMetadata = await projectAssetCatalogConfig.resolveAssetMetadata({
  kind: 'model',
  sourcePath: emptySlotMetadataModel,
  guid: '77777777-8888-4999-aaaa-bbbbbbbbbbbb',
  assetId: 'asset_7777777788884999aaaabbbbbbbbbbbb',
  existingMetadata: {
    materialSlots: [{ slotId: 'slot_stale', ownerNodePath: 'Old' }],
  },
  payloadMetadata: {},
});
assert.equal(clearedSlotMetadata, null);

await fs.rm(tempRoot, { recursive: true, force: true });
console.log('asset catalog generator check passed');
