import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AssetRegistryError, createAssetId, registerAsset, unregisterAsset, loadManifest } from './asset-registry/core.mjs';
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
const projectLocalModel = path.join(assetsDir, '项目内模型.glb');
const quotedProjectModel = path.join(assetsDir, "it's.glb");
const preservedModel = path.join(assetsDir, '静态模型.glb');
const slotMetadataModel = path.join(cwd, 'slot-metadata.gltf');
const embeddedTextureSlotMetadataModel = path.join(cwd, 'embedded-texture-slot-metadata.gltf');
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
  materials: [{
    name: 'Paint',
    pbrMetallicRoughness: {
      baseColorFactor: [0.25, 0.5, 0.75, 0.8],
      metallicFactor: 0.3,
      roughnessFactor: 0.6,
      baseColorTexture: { index: 0 },
      metallicRoughnessTexture: { index: 1 },
    },
    normalTexture: { index: 2, scale: 0.4 },
    occlusionTexture: { index: 3, strength: 0.7 },
    emissiveFactor: [0.1, 0.2, 0.3],
    emissiveTexture: { index: 4 },
    alphaMode: 'MASK',
    alphaCutoff: 0.33,
  }, {
    name: 'Frame',
    pbrMetallicRoughness: {
      baseColorFactor: [1, 0, 0, 0.25],
    },
    emissiveTexture: { index: 5 },
  }],
  textures: [
    { source: 0 },
    { source: 1 },
    { source: 2 },
    { source: 3 },
    { source: 4 },
    { source: 5 },
  ],
  images: [
    { uri: '/src/assets/textures/body-base.png' },
    { uri: '/src/assets/textures/body-metal-rough.png' },
    { uri: '/src/assets/textures/body-normal.png' },
    { uri: '/src/assets/textures/body-ao.png' },
    { uri: '/src/assets/textures/body-emissive.png' },
    { uri: '/src/assets/textures/frame-emissive.png' },
  ],
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
await fs.writeFile(embeddedTextureSlotMetadataModel, JSON.stringify({
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [
    { name: 'MaskedBody', mesh: 0 },
  ],
  meshes: [{ name: 'MaskedBodyMesh', primitives: [{ material: 0 }] }],
  materials: [{
    name: 'Masked Paint',
    pbrMetallicRoughness: {
      baseColorTexture: { index: 0 },
    },
    alphaMode: 'MASK',
  }],
  textures: [{ source: 0 }],
  images: [{ bufferView: 0, mimeType: 'image/png' }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 4 }],
  buffers: [{ byteLength: 4 }],
}));
await fs.writeFile(emptySlotMetadataModel, JSON.stringify({
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Empty' }],
  meshes: [],
  materials: [],
}));
await fs.mkdir(assetsDir, { recursive: true });
await fs.writeFile(projectLocalModel, 'project-local-glb-bytes');
await fs.writeFile(quotedProjectModel, 'quoted-project-glb-bytes');
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
const projectLocalGuid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const projectLocalAssetId = createAssetId('model', projectLocalGuid);
const projectLocalPayload = path.join(cwd, 'project-local-payload.json');
await fs.writeFile(projectLocalPayload, JSON.stringify({
  sourcePath: projectLocalModel,
  assetPath: projectLocalModel,
  assetName: '项目内模型.glb',
  displayName: '项目内模型',
  assetType: 'model',
  guid: projectLocalGuid,
  projectAssetId: projectLocalAssetId,
  platformAssetId: 'raw_project_local_model',
}));
const projectLocal = await registerAsset(config, { payload: projectLocalPayload });
const quotedProjectGuid = '99999999-aaaa-4bbb-8ccc-dddddddddddd';
const quotedProjectAssetId = createAssetId('model', quotedProjectGuid);
const quotedProjectPayload = path.join(cwd, 'quoted-project-payload.json');
await fs.writeFile(quotedProjectPayload, JSON.stringify({
  sourcePath: quotedProjectModel,
  assetPath: quotedProjectModel,
  assetName: "it's.glb",
  displayName: "it's",
  assetType: 'model',
  guid: quotedProjectGuid,
  projectAssetId: quotedProjectAssetId,
  platformAssetId: 'raw_quoted_project_model',
}));
const quotedProject = await registerAsset(config, { payload: quotedProjectPayload });
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
const manifestByAssetId = new Map(manifest.map((entry) => [entry.assetId, entry]));

assert.equal(manifest.length, 6);
assert.equal(model.kind, 'model');
assert.equal(texture.kind, 'texture');
assert.equal(explicitProject.assetId, explicitProjectAssetId);
assert.equal(explicitProject.external.platformAssetId, 'raw_model_explicit');
assert.equal(projectLocal.assetId, projectLocalAssetId);
assert.equal(projectLocal.external.platformAssetId, 'raw_project_local_model');
assert.equal(projectLocal.assetUrl, '/assets/项目内模型.glb');
assert.equal(projectLocal.targetPath, projectLocalModel);
assert.equal(quotedProject.assetId, quotedProjectAssetId);
assert.equal(quotedProject.assetUrl, "/assets/it's.glb");
assert.equal(quotedProject.targetPath, quotedProjectModel);
assert.equal(preserved.assetId, preservedAssetId);
assert.equal(preserved.assetUrl, '/assets/静态模型.glb');
assert.equal(preserved.targetPath, preservedModel);
assert.match(model.assetId, /^asset_[a-f0-9]{32}$/);
assert.notEqual(model.assetId, 'raw_model_1');
assert.equal(model.external.platformAssetId, 'raw_model_1');
assert.equal(model.targetPath, path.join(importedDir, `${model.assetId}.glb`));
assert.equal(await fileExists(model.targetPath), true);
assert.equal(manifestByAssetId.get(model.assetId)?.relativePath, `../imported/${model.assetId}.glb`);
assert.match(texture.assetId, /^texture_[a-f0-9]{32}$/);
assert.equal(texture.targetPath, path.join(importedDir, 'textures', `${texture.assetId}.png`));
assert.equal(await fileExists(texture.targetPath), true);
assert.equal(manifestByAssetId.get(texture.assetId)?.relativePath, `../imported/textures/${texture.assetId}.png`);
assert.equal(manifestByAssetId.get(projectLocalAssetId)?.relativePath, '../项目内模型.glb');
assert.equal(manifestByAssetId.get(quotedProjectAssetId)?.relativePath, "../it's.glb");
assert.ok(generated.includes('from "../it\'s.glb?url";'));
assert.equal(await fileExists(path.join(importedDir, `${projectLocalAssetId}.glb`)), false);
assert.equal(await fs.readFile(projectLocalModel, 'utf8'), 'project-local-glb-bytes');
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
assert.equal(slotMetadata.materialSlots.length, 2);
assert.deepEqual(
  slotMetadata.materialSlots.map(slot => ({
    ownerNodePath: slot.ownerNodePath,
    label: slot.label,
    nodeIndex: slot.nodeIndex,
    nodeIndexPath: slot.nodeIndexPath,
    meshIndex: slot.meshIndex,
    primitiveIndex: slot.primitiveIndex,
    sourceMaterialIndex: slot.sourceMaterialIndex,
    sourceMaterialIndices: slot.sourceMaterialIndices,
    materialName: slot.materialName,
    materialNames: slot.materialNames,
  })),
  [{
    ownerNodePath: 'Body',
    label: 'Body / Primitive 0',
    nodeIndex: 1,
    nodeIndexPath: [0, 1],
    meshIndex: 0,
    primitiveIndex: 0,
    sourceMaterialIndex: 0,
    sourceMaterialIndices: [0],
    materialName: 'Paint',
    materialNames: ['Paint'],
  }, {
    ownerNodePath: 'Body',
    label: 'Body / Primitive 1',
    nodeIndex: 1,
    nodeIndexPath: [0, 1],
    meshIndex: 0,
    primitiveIndex: 1,
    sourceMaterialIndex: 1,
    sourceMaterialIndices: [1],
    materialName: 'Frame',
    materialNames: ['Frame'],
  }],
);
assert.notEqual(slotMetadata.materialSlots[0].slotId, 'slot_existing_body');
assert.notEqual(slotMetadata.materialSlots[1].slotId, 'slot_existing_body');
assert.notEqual(slotMetadata.materialSlots[0].slotId, slotMetadata.materialSlots[1].slotId);
assert.deepEqual(slotMetadata.materialSlots[0].sourceMaterialProfiles, [{
  sourceMaterialIndex: 0,
  materialName: 'Paint',
  profile: {
    baseColor: {
      color: { r: 0.25, g: 0.5, b: 0.75 },
      texture: { url: '/src/assets/textures/body-base.png' },
      brightness: 1,
      saturation: 1,
      contrast: 1,
      hue: 0,
    },
    normal: {
      texture: { url: '/src/assets/textures/body-normal.png' },
      strength: 0.4,
    },
    metallic: 0.3,
    roughness: 0.6,
    metallicRoughness: {
      texture: { url: '/src/assets/textures/body-metal-rough.png' },
    },
    occlusion: {
      texture: { url: '/src/assets/textures/body-ao.png' },
      strength: 0.7,
    },
    emission: {
      color: { r: 0.1, g: 0.2, b: 0.3 },
      texture: { url: '/src/assets/textures/body-emissive.png' },
      intensity: 1,
    },
    alpha: {
      mode: 'mask',
      texture: { url: '/src/assets/textures/body-base.png' },
      opacity: 0.8,
      cutoff: 0.33,
    },
  },
}]);
assert.deepEqual(slotMetadata.materialSlots[1].sourceMaterialProfiles, [{
  sourceMaterialIndex: 1,
  materialName: 'Frame',
  profile: {
    baseColor: {
      color: { r: 1, g: 0, b: 0 },
      brightness: 1,
      saturation: 1,
      contrast: 1,
      hue: 0,
    },
    metallic: 1,
    roughness: 1,
    emission: {
      texture: { url: '/src/assets/textures/frame-emissive.png' },
    },
  },
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

const embeddedTextureSlotMetadata = await projectAssetCatalogConfig.resolveAssetMetadata({
  kind: 'model',
  sourcePath: embeddedTextureSlotMetadataModel,
  guid: '77777777-8888-4999-aaaa-bbbbbbbbbbbb',
  assetId: 'asset_7777777788884999aaaabbbbbbbbbbbb',
  existingMetadata: {},
  payloadMetadata: {},
});
assert.deepEqual(embeddedTextureSlotMetadata.materialSlots[0].sourceMaterialProfiles, [{
  sourceMaterialIndex: 0,
  materialName: 'Masked Paint',
  profile: {
    metallic: 1,
    roughness: 1,
    alpha: {
      mode: 'mask',
      cutoff: 0.5,
    },
  },
  textureHints: [{
    profilePath: 'baseColor.texture',
    textureIndex: 0,
    imageIndex: 0,
    bufferView: 0,
    mimeType: 'image/png',
    reason: 'embedded-texture',
  }, {
    profilePath: 'alpha.texture',
    textureIndex: 0,
    imageIndex: 0,
    bufferView: 0,
    mimeType: 'image/png',
    reason: 'embedded-texture',
  }],
}]);

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
assert.ok(clearedSlotMetadata);
assert.equal(clearedSlotMetadata.materialSlots, undefined);
assert.equal(clearedSlotMetadata.assetAnalysis?.kind, 'gltf');
assert.equal(clearedSlotMetadata.assetAnalysis?.nodeCount, 1);
assert.equal(clearedSlotMetadata.assetAnalysis?.meshCount, 0);

await fs.rm(tempRoot, { recursive: true, force: true });
console.log('asset catalog generator check passed');

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
