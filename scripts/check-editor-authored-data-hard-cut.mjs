#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertPlayableEditorScenePersistedSourceContract } from '@fps-games/editor/playable-sdk';
import { loadPlayableEditorAssetManifest } from '@fps-games/editor/playable-sdk/vite';

const root = process.env.EDITOR_AUTHORED_DATA_ROOT
  ? path.resolve(process.env.EDITOR_AUTHORED_DATA_ROOT)
  : process.cwd();
const files = [
  'src/config/editor-scene.json',
  'src/config/scene.json',
  'src/config/rendering.json',
];
const violations = [];
const prefabSourceAssetById = new Map();
const catalog = await loadPlayableEditorAssetManifest({
  manifestPath: path.join(root, 'src/assets/generated/asset-catalog.manifest.json'),
});
const slotIdsByAssetId = new Map();
const catalogModelAssetIds = new Set();
for (const asset of catalog) {
  const slotIds = new Set();
  collectMaterialSlotIds(asset, slotIds);
  if (typeof asset?.assetId === 'string' && asset.assetId.trim()) {
    if (asset.kind === 'model') catalogModelAssetIds.add(asset.assetId.trim());
    slotIdsByAssetId.set(asset.assetId.trim(), slotIds);
  }
}

const authoredValues = await Promise.all(files.map(async relativePath => ({
  relativePath,
  value: JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8')),
})));
const editorScene = authoredValues.find(entry => entry.relativePath === 'src/config/editor-scene.json')?.value;
assertPlayableEditorScenePersistedSourceContract(editorScene);
const authoredModelAssetIds = new Set(
  (Array.isArray(editorScene?.assets) ? editorScene.assets : [])
    .filter(asset => asset?.type === 'glb' && typeof asset.id === 'string')
    .map(asset => asset.id),
);
for (const assetId of authoredModelAssetIds) {
  if (!catalogModelAssetIds.has(assetId)) {
    violations.push(`src/config/editor-scene.json.assets (authored model ${assetId} is absent from the generated catalog)`);
  }
}
for (const asset of Array.isArray(editorScene?.assets) ? editorScene.assets : []) {
  if (asset?.type !== 'glb' || typeof asset.id !== 'string') continue;
  const unexpectedFields = Object.keys(asset).filter(key => key !== 'id' && key !== 'guid' && key !== 'type');
  if (unexpectedFields.length > 0) {
    violations.push(`src/config/editor-scene.json.assets (model ${asset.id} must be a lean catalog reference; unexpected ${unexpectedFields.join(', ')})`);
  }
}
const validModelAssetIds = new Set(
  [...authoredModelAssetIds].filter(assetId => catalogModelAssetIds.has(assetId)),
);
for (const asset of Array.isArray(editorScene?.assets) ? editorScene.assets : []) collectPrefabSourceAsset(asset);
for (const { relativePath, value } of authoredValues) {
  inspect(value, relativePath, null);
}

assert.deepEqual(violations, [], `authored data contains retired schema:\n${violations.join('\n')}`);
console.log('[editor-authored-data-hard-cut] current authored contract verified; no migration debt found');

function inspect(value, location, inheritedAssetId) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspect(entry, `${location}[${index}]`, inheritedAssetId));
    return;
  }
  if (!value || typeof value !== 'object') return;

  if (value.type === 'ModelRenderer' && (typeof value.assetId !== 'string' || !value.assetId.trim())) {
    violations.push(`${location}.assetId (ModelRenderer requires a catalog asset)`);
  }

  const referencedAssetId = resolveAssetId(value);
  if (referencedAssetId && !validModelAssetIds.has(referencedAssetId)) {
    violations.push(`${location} (asset ${referencedAssetId} is not an authored catalog model)`);
  }

  if (
    typeof value.childPrefabId === 'string'
    && value.childPrefabId.trim()
    && !prefabSourceAssetById.has(value.childPrefabId.trim())
  ) {
    violations.push(`${location}.childPrefabId (unknown prefab ${value.childPrefabId.trim()})`);
  }
  if (typeof value.childPrefabId === 'string' && value.childPrefabId.trim()) {
    const expectedSourceAssetId = prefabSourceAssetById.get(value.childPrefabId.trim());
    if (
      expectedSourceAssetId
      && typeof value.sourceAssetId === 'string'
      && value.sourceAssetId.trim()
      && value.sourceAssetId.trim() !== expectedSourceAssetId
    ) {
      violations.push(`${location}.sourceAssetId (expected child prefab source ${expectedSourceAssetId})`);
    }
  }
  const scenePrefab = value.prefab && typeof value.prefab === 'object' ? value.prefab : null;
  if (typeof scenePrefab?.prefabId === 'string' && scenePrefab.prefabId.trim()) {
    const prefabId = scenePrefab.prefabId.trim();
    const expectedSourceAssetId = prefabSourceAssetById.get(prefabId);
    if (!expectedSourceAssetId) violations.push(`${location}.prefab.prefabId (unknown prefab ${prefabId})`);
    else if (scenePrefab.sourceAssetId !== expectedSourceAssetId) {
      violations.push(`${location}.prefab.sourceAssetId (expected ${expectedSourceAssetId})`);
    } else {
      const instanceAssetId = typeof value.instance?.assetId === 'string' ? value.instance.assetId.trim() : '';
      if (instanceAssetId && instanceAssetId !== expectedSourceAssetId) {
        violations.push(`${location}.instance.assetId (expected ${expectedSourceAssetId})`);
      }
      const renderers = Array.isArray(value.components)
        ? value.components.filter(component => component?.type === 'ModelRenderer')
        : [];
      for (let index = 0; index < renderers.length; index += 1) {
        if (renderers[index]?.assetId !== expectedSourceAssetId) {
          violations.push(`${location}.components.ModelRenderer[${index}].assetId (expected ${expectedSourceAssetId})`);
        }
      }
    }
  }

  for (const retiredKey of ['shadowMode', 'sceneInstances', 'modelRegistry', 'childMaterialBindings', 'childMaterials', 'useBlobShadow', 'blobSettings']) {
    if (Object.hasOwn(value, retiredKey)) violations.push(`${location}.${retiredKey}`);
  }
  if (value.kind === 'box' && isMarkerGeometryLocation(location)) {
    for (const retiredKey of ['coordinateSpace', 'center', 'size', 'rotation']) {
      if (Object.hasOwn(value, retiredKey)) violations.push(`${location}.${retiredKey}`);
    }
  }
  if (location.endsWith('.globalVolume') && Object.hasOwn(value, 'samples')) violations.push(`${location}.samples`);
  if (location.endsWith('.shadows.staticProjected.bake')) {
    for (const retiredKey of ['resolution', 'maxSize']) {
      if (Object.hasOwn(value, retiredKey)) violations.push(`${location}.${retiredKey}`);
    }
  }
  if (location.endsWith('.globalVolume.environment')) {
    for (const retiredKey of ['textureAssetId', 'textureUrl', 'intensity']) {
      if (Object.hasOwn(value, retiredKey)) violations.push(`${location}.${retiredKey}`);
    }
  }
  if (value.materialSlotBindings && typeof value.materialSlotBindings === 'object') {
    const assetId = resolveAssetContext(value, inheritedAssetId);
    const knownSlotIds = assetId ? slotIdsByAssetId.get(assetId) : null;
    for (const slotId of Object.keys(value.materialSlotBindings)) {
      if (!assetId) violations.push(`${location}.materialSlotBindings.${slotId} (missing asset context)`);
      else if (!knownSlotIds?.has(slotId)) violations.push(`${location}.materialSlotBindings.${slotId} (slotId not owned by ${assetId})`);
    }
  }
  const assetId = resolveAssetContext(value, inheritedAssetId);
  for (const [key, entry] of Object.entries(value)) {
    if (key !== 'metadata') inspect(entry, `${location}.${key}`, assetId);
  }
}

function resolveAssetContext(value, inheritedAssetId) {
  if (typeof value.childPrefabId === 'string' && value.childPrefabId.trim()) {
    return prefabSourceAssetById.get(value.childPrefabId.trim()) ?? null;
  }
  return resolveAssetId(value) ?? inheritedAssetId;
}

function resolveAssetId(value) {
  if (value.type === 'ModelRenderer' && typeof value.assetId === 'string' && value.assetId.trim()) {
    return value.assetId.trim();
  }
  if (typeof value.childPrefabId === 'string' && value.childPrefabId.trim()) {
    return prefabSourceAssetById.get(value.childPrefabId.trim()) ?? null;
  }
  if (typeof value.sourceAssetId === 'string' && value.sourceAssetId.trim()) return value.sourceAssetId.trim();
  if (value.prefab && typeof value.prefab === 'object' && typeof value.prefab.sourceAssetId === 'string') {
    return value.prefab.sourceAssetId.trim() || null;
  }
  if (value.instance && typeof value.instance === 'object' && typeof value.instance.assetId === 'string') {
    return value.instance.assetId.trim() || null;
  }
  if (Array.isArray(value.components)) {
    const renderer = value.components.find(component => component?.type === 'ModelRenderer');
    if (typeof renderer?.assetId === 'string' && renderer.assetId.trim()) return renderer.assetId.trim();
  }
  return null;
}

function collectPrefabSourceAsset(value) {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'prefab' && typeof value.id === 'string' && typeof value.prefab?.sourceAssetId === 'string') {
    prefabSourceAssetById.set(value.id.trim(), value.prefab.sourceAssetId.trim());
  }
}

function isMarkerGeometryLocation(location) {
  return location.endsWith('.marker.geometry');
}

function collectMaterialSlotIds(value, target) {
  for (const slot of readMaterialSlots(value)) {
    if (typeof slot?.slotId === 'string' && slot.slotId.trim()) target.add(slot.slotId.trim());
  }
}

function readMaterialSlots(value) {
  return Array.isArray(value?.metadata?.materialSlots) ? value.metadata.materialSlots : [];
}
