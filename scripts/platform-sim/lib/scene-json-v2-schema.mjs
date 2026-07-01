import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../src/config/scene-json-v2-rules.json'), 'utf8'));
const NODE_KINDS = new Set(rules.nodeKinds);
const TRANSFORM_TYPES = new Set(rules.transformTypes);
const ASSET_TYPES = new Set(rules.assetTypes);
const MATERIAL_SCOPES = new Set(rules.materialScopes);
const MATERIAL_MODES = new Set(rules.materialModes);
const HIERARCHY_PARENT_TARGETS = new Set(rules.hierarchy?.parentTargets ?? ['root', 'sceneNode']);
const RUNTIME_ONLY_TOKENS = rules.runtimeOnlyTokens;

export function validateSceneJsonV2(sceneConfig, {
  strictAssetIds = [],
  strictNodeIds = [],
  allowOrphanSharedMaterials = true,
  allowOrphanNodeMaterials = true,
  maxErrors = 50,
} = {}) {
  const errors = [];
  const strictAssets = new Set(strictAssetIds);
  const strictNodes = new Set(strictNodeIds);
  const add = (path, message) => {
    if (errors.length < maxErrors) errors.push({ path, message });
  };

  if (!isObject(sceneConfig)) {
    add('$', 'scene json must be an object');
    return { ok: false, errors };
  }
  if (sceneConfig.schemaVersion !== 2) add('$.schemaVersion', 'schemaVersion must be 2');
  if (!isObject(sceneConfig.scene)) {
    add('$.scene', 'scene must be an object');
    return { ok: false, errors };
  }
  validateGeneratedFrom(sceneConfig.meta?.generatedFrom, '$.meta.generatedFrom', add);

  const scene = sceneConfig.scene;
  if (!nonEmptyString(scene.rootId)) add('$.scene.rootId', 'rootId must be a non-empty string');
  if (!Array.isArray(scene.assets)) add('$.scene.assets', 'assets must be an array');
  if (!Array.isArray(scene.nodes)) add('$.scene.nodes', 'nodes must be an array');
  if (!Array.isArray(scene.materials)) add('$.scene.materials', 'materials must be an array');
  if (!Array.isArray(scene.textures)) add('$.scene.textures', 'textures must be an array');
  if (errors.length > 0) return { ok: false, errors };

  const assetIds = new Set();
  const nodeIds = new Set();
  const duplicateAssetIds = new Set();
  const duplicateNodeIds = new Set();

  scene.assets.forEach((asset, index) => {
    const path = `$.scene.assets[${index}]`;
    if (!isObject(asset)) {
      add(path, 'asset must be an object');
      return;
    }
    if (!nonEmptyString(asset.id)) add(`${path}.id`, 'asset.id must be a non-empty string');
    else if (assetIds.has(asset.id)) duplicateAssetIds.add(asset.id);
    else assetIds.add(asset.id);

    if (!ASSET_TYPES.has(asset.type)) add(`${path}.type`, 'asset.type must be "glb"');
    if (asset.guid != null && !nonEmptyString(asset.guid)) add(`${path}.guid`, 'asset.guid must be a non-empty string when present');
    if (asset.external != null && !isObject(asset.external)) add(`${path}.external`, 'external must be an object when present');
    if (asset.materialMode != null && !MATERIAL_MODES.has(asset.materialMode)) {
      add(`${path}.materialMode`, 'materialMode must be "shared" or "instance"');
    }
    if (strictAssets.has(asset.id)) assertNoRuntimeOnlyFields(asset, path, add);
  });

  scene.nodes.forEach((node, index) => {
    const path = `$.scene.nodes[${index}]`;
    if (!isObject(node)) {
      add(path, 'node must be an object');
      return;
    }
    if (!nonEmptyString(node.id)) add(`${path}.id`, 'node.id must be a non-empty string');
    else if (nodeIds.has(node.id)) duplicateNodeIds.add(node.id);
    else nodeIds.add(node.id);
    if (!NODE_KINDS.has(node.kind)) add(`${path}.kind`, 'node.kind must be group, instance, transform, or primitive');
  });

  for (const id of duplicateAssetIds) add('$.scene.assets', `duplicate asset id: ${id}`);
  for (const id of duplicateNodeIds) add('$.scene.nodes', `duplicate node id: ${id}`);

  scene.nodes.forEach((node, index) => {
    if (!isObject(node)) return;
    const path = `$.scene.nodes[${index}]`;
    const parentId = nonEmptyString(node.parentId) ? node.parentId : scene.rootId;
    validateNodeParentTarget(parentId, scene.rootId, nodeIds, `${path}.parentId`, add);
    if (nonEmptyString(node.id)) validateNodeParentCycle(node.id, scene, `${path}.parentId`, add);
    validateRuntimeSourceBinding(node.source, `${path}.source`, add);
    validateTransform(node.transform, `${path}.transform`, add);

    if (node.kind === 'instance') {
      if (!isObject(node.instance)) add(`${path}.instance`, 'instance node must contain instance object');
      else if (!assetIds.has(node.instance.assetId)) {
        add(`${path}.instance.assetId`, `assetId must reference scene.assets: ${node.instance.assetId}`);
      }
    }

    if (node.kind === 'transform') {
      if (node.transformType != null && !TRANSFORM_TYPES.has(node.transformType)) {
        add(`${path}.transformType`, 'transformType must be plain, light, camera, or groundDecal');
      }
      if (node.transformType === 'groundDecal' && node.groundDecal != null) {
        validateGroundDecal(node.groundDecal, `${path}.groundDecal`, add);
      }
    }

    if (strictNodes.has(node.id)) assertNoRuntimeOnlyFields(node, path, add);
  });

  scene.materials.forEach((material, index) => {
    const path = `$.scene.materials[${index}]`;
    if (!isObject(material)) {
      add(path, 'material must be an object');
      return;
    }
    if (!nonEmptyString(material.id)) add(`${path}.id`, 'material.id must be a non-empty string');
    if (material.scope != null && !MATERIAL_SCOPES.has(material.scope)) {
      add(`${path}.scope`, 'material scope must be sharedAsset or nodeMaterial');
    }
    if (material.scope === 'sharedAsset' && !assetIds.has(material.assetId) && !allowOrphanSharedMaterials) {
      add(`${path}.assetId`, `shared material assetId must reference scene.assets: ${material.assetId}`);
    }
    if (material.scope === 'nodeMaterial' && !nodeIds.has(material.nodeId) && !allowOrphanNodeMaterials) {
      add(`${path}.nodeId`, `node material nodeId must reference scene.nodes: ${material.nodeId}`);
    }
    if (!nonEmptyString(material.materialName)) add(`${path}.materialName`, 'materialName must be a non-empty string');
    if (!isObject(material.properties)) add(`${path}.properties`, 'properties must be an object');
  });

  return { ok: errors.length === 0, errors };
}

export function assertSceneJsonV2(sceneConfig, options = {}) {
  const result = validateSceneJsonV2(sceneConfig, options);
  if (result.ok) return;
  const rendered = JSON.stringify(result.errors, null, 2);
  throw new Error(`scene_json_v2_schema_failed:\n${rendered}`);
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateGeneratedFrom(generatedFrom, path, add) {
  if (generatedFrom == null) return;
  if (!isObject(generatedFrom)) {
    add(path, 'generatedFrom must be an object when present');
    return;
  }
  validateAuthoringSourceRef(generatedFrom, path, add);
  if (!nonEmptyString(generatedFrom.compilerId)) add(`${path}.compilerId`, 'compilerId must be a non-empty string');
  if (!nonEmptyString(generatedFrom.compilerVersion)) add(`${path}.compilerVersion`, 'compilerVersion must be a non-empty string');
  if (!nonEmptyString(generatedFrom.compiledAt)) add(`${path}.compiledAt`, 'compiledAt must be a non-empty string');
}

function validateRuntimeSourceBinding(source, path, add) {
  if (source == null) return;
  if (!isObject(source)) {
    add(path, 'source must be an object when present');
    return;
  }
  validateAuthoringSourceRef(source, path, add);
  if (source.objectId != null && !nonEmptyString(source.objectId)) add(`${path}.objectId`, 'objectId must be a non-empty string when present');
  if (source.component != null && !nonEmptyString(source.component)) add(`${path}.component`, 'component must be a non-empty string when present');
  if (source.propertyPath != null && !nonEmptyString(source.propertyPath)) add(`${path}.propertyPath`, 'propertyPath must be a non-empty string when present');
}

function validateAuthoringSourceRef(source, path, add) {
  if (!nonEmptyString(source.sourceId)) add(`${path}.sourceId`, 'sourceId must be a non-empty string');
  if (!nonEmptyString(source.sourceType)) add(`${path}.sourceType`, 'sourceType must be a non-empty string');
  if (source.revision != null && (typeof source.revision !== 'number' || !Number.isFinite(source.revision))) {
    add(`${path}.revision`, 'revision must be a finite number when present');
  }
}

function validateNodeParentTarget(parentId, rootId, nodeIds, path, add) {
  if (parentId === rootId) {
    if (!HIERARCHY_PARENT_TARGETS.has('root')) {
      add(path, `parentId must point to scene node: ${parentId}`);
    }
    return;
  }
  if (HIERARCHY_PARENT_TARGETS.has('sceneNode') && nodeIds.has(parentId)) return;
  const targetDescription = HIERARCHY_PARENT_TARGETS.has('root') && HIERARCHY_PARENT_TARGETS.has('sceneNode')
    ? 'root or scene node'
    : HIERARCHY_PARENT_TARGETS.has('sceneNode')
      ? 'scene node'
      : 'root';
  add(path, `parentId must point to ${targetDescription}: ${parentId}`);
}

function validateNodeParentCycle(nodeId, scene, path, add) {
  if (!nonEmptyString(scene.rootId) || !Array.isArray(scene.nodes)) return;
  const byId = new Map();
  for (const node of scene.nodes) {
    if (isObject(node) && nonEmptyString(node.id)) byId.set(node.id, node);
  }
  const visited = new Set([nodeId]);
  let cursorId = nonEmptyString(byId.get(nodeId)?.parentId) ? byId.get(nodeId).parentId : scene.rootId;
  while (nonEmptyString(cursorId) && cursorId !== scene.rootId) {
    if (visited.has(cursorId)) {
      add(path, `parentId creates a node cycle involving ${nodeId}`);
      return;
    }
    visited.add(cursorId);
    const cursor = byId.get(cursorId);
    if (!cursor) return;
    cursorId = nonEmptyString(cursor.parentId) ? cursor.parentId : scene.rootId;
  }
}

function validateTransform(transform, path, add) {
  if (transform == null) return;
  if (!isObject(transform)) {
    add(path, 'transform must be an object');
    return;
  }
  validateVec3(transform.position, `${path}.position`, add);
  validateVec3(transform.rotation, `${path}.rotation`, add);
  validateVec3(transform.rotationDeg, `${path}.rotationDeg`, add);
  if (typeof transform.scale === 'number') {
    if (!Number.isFinite(transform.scale)) add(`${path}.scale`, 'scale number must be finite');
  } else {
    validateVec3(transform.scale, `${path}.scale`, add);
  }
}

function validateVec3(value, path, add) {
  if (value == null) return;
  if (!isObject(value)) {
    add(path, 'value must be a vector object');
    return;
  }
  for (const axis of ['x', 'y', 'z']) {
    if (typeof value[axis] !== 'number' || !Number.isFinite(value[axis])) {
      add(`${path}.${axis}`, 'vector component must be a finite number');
    }
  }
}

function validateGroundDecal(value, path, add) {
  if (!isObject(value)) {
    add(path, 'groundDecal must be an object');
    return;
  }
  if (value.uiKind !== 'operation' && value.uiKind !== 'delivery') {
    add(`${path}.uiKind`, 'groundDecal uiKind must be operation or delivery');
  }
  if (!isObject(value.size)) {
    add(`${path}.size`, 'groundDecal.size must be an object');
  } else {
    for (const key of ['width', 'depth']) {
      if (typeof value.size[key] !== 'number' || !Number.isFinite(value.size[key]) || value.size[key] <= 0) {
        add(`${path}.size.${key}`, 'groundDecal size must be a positive finite number');
      }
    }
  }
  if (!Array.isArray(value.layers)) {
    add(`${path}.layers`, 'groundDecal layers must be an array');
    return;
  }
  value.layers.forEach((layer, index) => validateGroundDecalLayer(layer, `${path}.layers[${index}]`, add));
}

function validateGroundDecalLayer(value, path, add) {
  if (!isObject(value)) {
    add(path, 'groundDecal layer must be an object');
    return;
  }
  if (!nonEmptyString(value.id)) add(`${path}.id`, 'layer.id must be non-empty');
  if (!['base', 'border', 'mainLogo', 'subLogo', 'amount', 'progressFill'].includes(String(value.role))) {
    add(`${path}.role`, 'layer.role is invalid');
  }
  if (!['texture', 'color', 'progress', 'text'].includes(String(value.kind))) {
    add(`${path}.kind`, 'layer.kind is invalid');
  }
  if (!isObject(value.rect)) {
    add(`${path}.rect`, 'layer.rect must be an object');
    return;
  }
  for (const key of ['x', 'z', 'width', 'depth']) {
    if (typeof value.rect[key] !== 'number' || !Number.isFinite(value.rect[key])) {
      add(`${path}.rect.${key}`, `rect.${key} must be a finite number`);
    }
  }
  for (const key of ['width', 'depth']) {
    if (typeof value.rect[key] === 'number' && value.rect[key] <= 0) {
      add(`${path}.rect.${key}`, `rect.${key} must be positive`);
    }
  }
}

function assertNoRuntimeOnlyFields(value, path, add) {
  const serialized = JSON.stringify(value);
  const found = RUNTIME_ONLY_TOKENS.filter((token) => serialized.includes(token));
  if (found.length > 0) {
    add(path, `contains runtime-only asset fields: ${found.join(', ')}`);
  }
}
