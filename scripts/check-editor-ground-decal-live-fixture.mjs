#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const editorScene = await readJson(path.join(projectRoot, 'src/config/editor-scene.json'));
const sceneConfig = await readJson(path.join(projectRoot, 'src/config/scene.json'));
const manifest = await readJson(path.join(projectRoot, 'src/assets/generated/asset-catalog.manifest.json'));

const textureIds = {
  borderWhite: readRequiredAssetIdByCodeKey('ground_decal_border_reference', 'texture'),
  conveyor: readRequiredAssetIdByCodeKey('ground_decal_conveyor_reference', 'texture'),
  moneyLarge: readRequiredAssetIdByCodeKey('ground_decal_money_reference', 'texture'),
};

const fixtureSpecs = [
  {
    id: 'issue464_ground_decal_operation',
    uiKind: 'operation',
    expectedLayerIds: ['base', 'mainLogo', 'border'],
    textureRefs: {
      mainLogo: textureIds.moneyLarge,
      border: textureIds.borderWhite,
    },
  },
  {
    id: 'issue464_ground_decal_delivery',
    uiKind: 'delivery',
    expectedLayerIds: ['base', 'progressFill', 'mainLogo', 'subLogo', 'amount', 'border'],
    textureRefs: {
      mainLogo: textureIds.conveyor,
      subLogo: textureIds.moneyLarge,
      border: textureIds.borderWhite,
    },
  },
];

for (const spec of fixtureSpecs) {
  const gameObject = editorScene.scene?.gameObjects?.find(candidate => candidate?.id === spec.id);
  assert(gameObject, `GroundDecal fixture "${spec.id}" must exist in editor-scene.json`);
  assert.equal(gameObject.kind, 'transform', `${spec.id} must be a transform object`);
  assert.equal(gameObject.parentId, 'root', `${spec.id} must stay under the scene root for E2E selection`);
  assert.equal(gameObject.active, true, `${spec.id} must be active`);
  assert.equal(gameObject.transformType, 'groundDecal', `${spec.id} must use transformType=groundDecal`);
  assertTransform(gameObject, spec.id);
  assertGroundDecalConfig(gameObject.groundDecal, spec);

  const runtimeNode = findRuntimeNode(spec.id);
  assert(runtimeNode, `GroundDecal fixture "${spec.id}" must compile into scene.json`);
  assert.equal(runtimeNode.transformType, 'groundDecal', `${spec.id} runtime node must keep transformType=groundDecal`);
  assert(runtimeNode.groundDecal, `${spec.id} runtime node must keep groundDecal config`);
}

console.log('editor ground decal live fixture check passed');

function assertGroundDecalConfig(groundDecal, spec) {
  assert(groundDecal && typeof groundDecal === 'object' && !Array.isArray(groundDecal), `${spec.id}.groundDecal must be an object`);
  assert.equal(groundDecal.uiKind, spec.uiKind, `${spec.id}.groundDecal.uiKind`);
  assert.deepEqual(groundDecal.size, { width: 1.8, depth: 1.8 }, `${spec.id}.groundDecal.size`);
  assert.equal(groundDecal.aspectSourceLayerId, 'border', `${spec.id}.groundDecal.aspectSourceLayerId`);
  assert.equal(groundDecal.lockAspectToBorder, true, `${spec.id}.groundDecal.lockAspectToBorder`);
  assert.deepEqual(groundDecal.mask, {
    enabled: true,
    source: 'roundedRect',
    cornerRadius: 0.18,
    padding: 0.02,
  }, `${spec.id}.groundDecal.mask`);
  assert.deepEqual(groundDecal.rendering, {
    textureWidth: 512,
    textureHeight: 512,
    alphaIndex: 100,
    diffuseTextureLevel: 1,
    emissiveTextureLevel: 0,
  }, `${spec.id}.groundDecal.rendering`);

  const layers = groundDecal.layers;
  assert(Array.isArray(layers), `${spec.id}.groundDecal.layers must be an array`);
  assert.deepEqual(layers.map(layer => layer.id), spec.expectedLayerIds, `${spec.id}.groundDecal layer order`);
  const layerById = new Map(layers.map(layer => [layer.id, layer]));
  assert.equal(layerById.get('base')?.role, 'base', `${spec.id} base layer role`);
  assert.equal(layerById.get('base')?.kind, 'color', `${spec.id} base layer kind`);
  assert.equal(layerById.get('border')?.role, 'border', `${spec.id} border layer role`);
  assert.equal(layerById.get('border')?.kind, 'texture', `${spec.id} border layer kind`);

  for (const [layerId, textureId] of Object.entries(spec.textureRefs)) {
    const layer = layerById.get(layerId);
    assert(layer, `${spec.id} layer "${layerId}" missing`);
    assert.equal(layer.kind, 'texture', `${spec.id} layer "${layerId}" must be a texture layer`);
    assert.equal(layer.textureId, textureId, `${spec.id} layer "${layerId}" textureId`);
    assertCatalogTexture(textureId, `${spec.id}.${layerId}`);
  }

  if (spec.uiKind === 'delivery') {
    assert.equal(layerById.get('progressFill')?.kind, 'progress', `${spec.id} progressFill layer kind`);
    assert.equal(layerById.get('progressFill')?.direction, 'bottomToTop', `${spec.id} progress direction`);
    assert.equal(layerById.get('amount')?.kind, 'text', `${spec.id} amount layer kind`);
    assert.equal(layerById.get('amount')?.text?.value, '30', `${spec.id} amount text`);
  }

  for (const key of ['version', 'textureId', 'color', 'alphaIndex', 'diffuseTextureLevel', 'emissiveTextureLevel']) {
    assert.equal(Object.hasOwn(groundDecal, key), false, `${spec.id}.groundDecal must not contain removed field ${key}`);
  }
}

function assertTransform(gameObject, id) {
  const transform = gameObject.components?.find(component => component?.type === 'Transform');
  assert(transform, `${id} must have a Transform component`);
  assert.equal(transform.position?.y, 0.02, `${id} must sit slightly above the receiver plane`);
  assert.deepEqual(transform.rotation, { x: 0, y: 0, z: 0 }, `${id}.rotation`);
  assert.deepEqual(transform.scale, { x: 1, y: 1, z: 1 }, `${id}.scale`);
}

function findRuntimeNode(id) {
  const nodes = sceneConfig.scene?.nodes ?? sceneConfig.scene?.gameObjects ?? [];
  return nodes.find(candidate => candidate?.id === id);
}

function assertCatalogTexture(assetId, label) {
  const entry = manifest.find(candidate => candidate?.assetId === assetId);
  assert(entry, `${label} textureId must exist in asset catalog manifest`);
  assert.equal(entry.kind, 'texture', `${label} textureId must reference a texture`);
}

function readRequiredAssetIdByCodeKey(codeKey, kind) {
  const entry = manifest.find(candidate => candidate?.codeKey === codeKey);
  assert(entry, `asset catalog must contain ${codeKey}`);
  assert.equal(entry.kind, kind, `${codeKey} must be a ${kind}`);
  return entry.assetId;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}
