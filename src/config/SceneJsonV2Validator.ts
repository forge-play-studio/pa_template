import type { SceneConfig } from './types';
import sceneJsonV2Rules from './scene-json-v2-rules.json';

export interface SceneJsonV2ValidationError {
  path: string;
  message: string;
}

export interface SceneJsonV2ValidationOptions {
  allowOrphanSharedMaterials?: boolean;
  allowOrphanNodeMaterials?: boolean;
  strictAssetIds?: string[];
  strictNodeIds?: string[];
  maxErrors?: number;
}

const NODE_KINDS = new Set(sceneJsonV2Rules.nodeKinds);
const PRIMITIVE_SHAPES = new Set(sceneJsonV2Rules.primitiveShapes);
const ASSET_TYPES = new Set(sceneJsonV2Rules.assetTypes);
const MATERIAL_MODES = new Set(sceneJsonV2Rules.materialModes);
const MATERIAL_SCOPES = new Set(sceneJsonV2Rules.materialScopes);
const TRANSFORM_TYPES = new Set(sceneJsonV2Rules.transformTypes);
const HIERARCHY_PARENT_TARGETS = new Set(sceneJsonV2Rules.hierarchy.parentTargets);
const RUNTIME_ONLY_TOKENS = sceneJsonV2Rules.runtimeOnlyTokens;

export function validateSceneJsonV2(
  sceneConfig: SceneConfig,
  options: SceneJsonV2ValidationOptions = {},
): SceneJsonV2ValidationError[] {
  const {
    allowOrphanSharedMaterials = true,
    allowOrphanNodeMaterials = true,
    strictAssetIds = [],
    strictNodeIds = [],
    maxErrors = 50,
  } = options;
  const errors: SceneJsonV2ValidationError[] = [];
  const strictAssets = new Set(strictAssetIds);
  const strictNodes = new Set(strictNodeIds);
  const add = (path: string, message: string): void => {
    if (errors.length < maxErrors) errors.push({ path, message });
  };

  if (!isRecord(sceneConfig)) {
    add('$', 'scene json must be an object');
    return errors;
  }
  if (sceneConfig.schemaVersion !== 2) add('$.schemaVersion', 'schemaVersion must be 2');
  validateGeneratedFrom(sceneConfig.meta?.generatedFrom, '$.meta.generatedFrom', add);
  const scene = sceneConfig.scene;
  if (!isRecord(scene)) {
    add('$.scene', 'scene must be an object');
    return errors;
  }
  if (!nonEmptyString(scene.rootId)) add('$.scene.rootId', 'rootId must be a non-empty string');
  if (!Array.isArray(scene.assets)) add('$.scene.assets', 'assets must be an array');
  if (!Array.isArray(scene.nodes)) add('$.scene.nodes', 'nodes must be an array');
  if (!Array.isArray(scene.materials)) add('$.scene.materials', 'materials must be an array');
  if (!Array.isArray(scene.textures)) add('$.scene.textures', 'textures must be an array');
  if (errors.length > 0) return errors;

  const assetIds = new Set<string>();
  const nodeIds = new Set<string>();
  const nodeKinds = new Map<string, string>();

  scene.assets.forEach((asset, index) => {
    const path = `$.scene.assets[${index}]`;
    if (!isRecord(asset)) {
      add(path, 'asset must be an object');
      return;
    }
    if (!nonEmptyString(asset.id)) add(`${path}.id`, 'asset.id must be a non-empty string');
    else if (assetIds.has(asset.id)) add(`${path}.id`, `duplicate asset id: ${asset.id}`);
    else assetIds.add(asset.id);
    if (!ASSET_TYPES.has(asset.type)) add(`${path}.type`, 'asset.type must be glb');
    if (asset.guid != null && !nonEmptyString(asset.guid)) add(`${path}.guid`, 'asset.guid must be a non-empty string when present');
    if (asset.external != null && !isRecord(asset.external)) add(`${path}.external`, 'external must be an object when present');
    if (asset.displayName != null && !nonEmptyString(asset.displayName)) add(`${path}.displayName`, 'displayName must be a non-empty string when present');
    if (asset.category != null && !nonEmptyString(asset.category)) add(`${path}.category`, 'category must be a non-empty string when present');
    if (asset.materialMode != null && !MATERIAL_MODES.has(asset.materialMode)) {
      add(`${path}.materialMode`, 'materialMode must be shared or instance');
    }
    validateAssetDefaults(asset.defaults, `${path}.defaults`, add);
    if (asset.metadata != null && !isRecord(asset.metadata)) add(`${path}.metadata`, 'metadata must be an object when present');
    if (strictAssets.has(asset.id)) assertNoRuntimeOnlyFields(asset, path, add);
  });

  scene.nodes.forEach((node, index) => {
    const path = `$.scene.nodes[${index}]`;
    if (!isRecord(node)) {
      add(path, 'node must be an object');
      return;
    }
    if (!nonEmptyString(node.id)) add(`${path}.id`, 'node.id must be a non-empty string');
    else if (nodeIds.has(node.id)) add(`${path}.id`, `duplicate node id: ${node.id}`);
    else {
      nodeIds.add(node.id);
      if (typeof node.kind === 'string') nodeKinds.set(node.id, node.kind);
    }
    if (!NODE_KINDS.has(node.kind)) add(`${path}.kind`, 'node.kind must be group, instance, transform, or primitive');
  });

  scene.nodes.forEach((node, index) => {
    if (!isRecord(node)) return;
    const path = `$.scene.nodes[${index}]`;
    const parentId = nonEmptyString(node.parentId) ? node.parentId : scene.rootId;
    validateNodeParentTarget(parentId, scene.rootId, nodeIds, `${path}.parentId`, add);
    if (nonEmptyString(node.id)) validateNodeParentCycle(node.id, scene, `${path}.parentId`, add);
    validateRuntimeSourceBinding(node.source, `${path}.source`, add);
    validateTransform(node.transform, `${path}.transform`, add);
    if (node.kind === 'instance') {
      if (!isRecord(node.instance)) add(`${path}.instance`, 'instance node must contain instance object');
      else if (!assetIds.has(node.instance.assetId)) {
        add(`${path}.instance.assetId`, `assetId must reference scene.assets: ${node.instance.assetId}`);
      }
    }
    if (node.kind === 'primitive') {
      if (!isRecord(node.primitive)) add(`${path}.primitive`, 'primitive node must contain primitive object');
      else if (!PRIMITIVE_SHAPES.has(node.primitive.shape)) {
        add(`${path}.primitive.shape`, 'primitive.shape must be cube, sphere, plane, or capsule');
      }
    }
    if (node.kind === 'transform' && node.transformType != null && !TRANSFORM_TYPES.has(node.transformType)) {
      add(`${path}.transformType`, 'transformType must be plain, light, camera, or groundDecal');
    }
    if (node.kind === 'transform' && node.transformType === 'groundDecal') {
      validateGroundDecal(node.groundDecal, `${path}.groundDecal`, add);
    }
    if (node.kind === 'transform') {
      validateCameraRig(node.camera, `${path}.camera`, add);
      validateDirectionalLight(node.light, `${path}.light`, add);
    }
    if (strictNodes.has(node.id)) assertNoRuntimeOnlyFields(node, path, add);
  });

  scene.materials.forEach((material, index) => {
    const path = `$.scene.materials[${index}]`;
    if (!isRecord(material)) {
      add(path, 'material must be an object');
      return;
    }
    if (!nonEmptyString(material.id)) add(`${path}.id`, 'material.id must be a non-empty string');
    if (material.scope != null && !MATERIAL_SCOPES.has(material.scope)) {
      add(`${path}.scope`, 'material scope must be sharedAsset or nodeMaterial');
    }
    if (material.scope === 'sharedAsset' && (!nonEmptyString(material.assetId) || !assetIds.has(material.assetId)) && !allowOrphanSharedMaterials) {
      add(`${path}.assetId`, `shared material assetId must reference scene.assets: ${material.assetId}`);
    }
    if (material.scope === 'nodeMaterial') {
      if ((!nonEmptyString(material.nodeId) || !nodeIds.has(material.nodeId)) && !allowOrphanNodeMaterials) {
        add(`${path}.nodeId`, `node material nodeId must reference scene.nodes: ${material.nodeId}`);
      } else if (nonEmptyString(material.nodeId) && nodeIds.has(material.nodeId)) {
        const nodeKind = nodeKinds.get(material.nodeId);
        if (nodeKind !== 'instance' && nodeKind !== 'transform' && nodeKind !== 'primitive') {
          add(`${path}.nodeId`, `node material nodeId must reference an instance, transform, or primitive node: ${material.nodeId}`);
        }
      }
    }
    if (!nonEmptyString(material.materialName)) add(`${path}.materialName`, 'materialName must be a non-empty string');
    if (!isRecord(material.properties)) add(`${path}.properties`, 'properties must be an object');
    else validateMaterialProperties(material.properties, `${path}.properties`, add);
  });

  return errors;
}

function validateNodeParentTarget(
  parentId: string,
  rootId: unknown,
  nodeIds: Set<string>,
  path: string,
  add: (path: string, message: string) => void,
): void {
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

function validateNodeParentCycle(
  nodeId: string,
  scene: Record<string, any>,
  path: string,
  add: (path: string, message: string) => void,
): void {
  const rootId = scene.rootId;
  if (!nonEmptyString(rootId) || !Array.isArray(scene.nodes)) return;
  const byId = new Map<string, Record<string, any>>();
  for (const node of scene.nodes) {
    if (isRecord(node) && nonEmptyString(node.id)) byId.set(node.id, node);
  }
  const visited = new Set<string>([nodeId]);
  let cursorId = nonEmptyString(byId.get(nodeId)?.parentId) ? byId.get(nodeId)?.parentId : rootId;
  while (nonEmptyString(cursorId) && cursorId !== rootId) {
    if (visited.has(cursorId)) {
      add(path, `parentId creates a node cycle involving ${nodeId}`);
      return;
    }
    visited.add(cursorId);
    const cursor = byId.get(cursorId);
    if (!cursor) return;
    cursorId = nonEmptyString(cursor.parentId) ? cursor.parentId : rootId;
  }
}

function validateAssetDefaults(
  defaults: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (defaults == null) return;
  if (!isRecord(defaults)) {
    add(path, 'defaults must be an object');
    return;
  }
  validateTransform(defaults.transform, `${path}.transform`, add);
  validateOutline(defaults.outline, `${path}.outline`, add);
  if (defaults.childOutlines != null) {
    if (!isRecord(defaults.childOutlines)) {
      add(`${path}.childOutlines`, 'childOutlines must be an object');
    } else {
      for (const [key, outline] of Object.entries(defaults.childOutlines)) {
        validateOutline(outline, `${path}.childOutlines.${key}`, add);
      }
    }
  }
}

function validateGeneratedFrom(
  generatedFrom: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (generatedFrom == null) return;
  if (!isRecord(generatedFrom)) {
    add(path, 'generatedFrom must be an object when present');
    return;
  }
  validateAuthoringSourceRef(generatedFrom, path, add);
  if (!nonEmptyString(generatedFrom.compilerId)) add(`${path}.compilerId`, 'compilerId must be a non-empty string');
  if (!nonEmptyString(generatedFrom.compilerVersion)) add(`${path}.compilerVersion`, 'compilerVersion must be a non-empty string');
  if (!nonEmptyString(generatedFrom.compiledAt)) add(`${path}.compiledAt`, 'compiledAt must be a non-empty string');
}

function validateRuntimeSourceBinding(
  source: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (source == null) return;
  if (!isRecord(source)) {
    add(path, 'source must be an object when present');
    return;
  }
  validateAuthoringSourceRef(source, path, add);
  if (source.objectGuid != null && !nonEmptyString(source.objectGuid)) add(`${path}.objectGuid`, 'objectGuid must be a non-empty string when present');
  if (source.objectId != null && !nonEmptyString(source.objectId)) add(`${path}.objectId`, 'objectId must be a non-empty string when present');
  if (source.component != null && !nonEmptyString(source.component)) add(`${path}.component`, 'component must be a non-empty string when present');
  if (source.propertyPath != null && !nonEmptyString(source.propertyPath)) add(`${path}.propertyPath`, 'propertyPath must be a non-empty string when present');
}

function validateAuthoringSourceRef(
  source: Record<string, any>,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (!nonEmptyString(source.sourceId)) add(`${path}.sourceId`, 'sourceId must be a non-empty string');
  if (!nonEmptyString(source.sourceType)) add(`${path}.sourceType`, 'sourceType must be a non-empty string');
  if (source.revision != null && (typeof source.revision !== 'number' || !Number.isFinite(source.revision))) {
    add(`${path}.revision`, 'revision must be a finite number when present');
  }
}

export function assertSceneJsonV2(sceneConfig: SceneConfig, options?: SceneJsonV2ValidationOptions): void {
  const errors = validateSceneJsonV2(sceneConfig, options);
  if (errors.length === 0) return;
  throw new Error(`[SceneJsonV2Validator] ${JSON.stringify(errors, null, 2)}`);
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateTransform(transform: unknown, path: string, add: (path: string, message: string) => void): void {
  if (transform == null) return;
  if (!isRecord(transform)) {
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

function validateVec3(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'value must be a vector object');
    return;
  }
  for (const axis of ['x', 'y', 'z']) {
    if (typeof value[axis] !== 'number' || !Number.isFinite(value[axis])) {
      add(`${path}.${axis}`, 'vector component must be a finite number');
    }
  }
}

function validateColor(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'color must be an object');
    return;
  }
  for (const key of ['r', 'g', 'b']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      add(`${path}.${key}`, 'color component must be a finite number');
    }
  }
}

function validateCameraRig(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'camera must be an object');
    return;
  }
  for (const key of ['alpha', 'beta', 'radius', 'orthoSize']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) {
      add(`${path}.${key}`, 'camera property must be a finite number');
    }
  }
  if (typeof value.radius === 'number' && value.radius <= 0) add(`${path}.radius`, 'camera radius must be positive');
  if (typeof value.orthoSize === 'number' && value.orthoSize <= 0) add(`${path}.orthoSize`, 'camera orthoSize must be positive');
}

function validateDirectionalLight(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'light must be an object');
    return;
  }
  if (value.type !== 'directional') add(`${path}.type`, 'light.type must be directional');
  if (typeof value.intensity !== 'number' || !Number.isFinite(value.intensity) || value.intensity < 0) {
    add(`${path}.intensity`, 'light intensity must be a non-negative finite number');
  }
  validateVec3(value.direction, `${path}.direction`, add);
  validateColor(value.diffuseColor, `${path}.diffuseColor`, add);
}

function validateOutline(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'outline must be an object');
    return;
  }
  if (value.renderOutline != null && typeof value.renderOutline !== 'boolean') add(`${path}.renderOutline`, 'renderOutline must be boolean');
  if (value.outlineWidth != null && (typeof value.outlineWidth !== 'number' || !Number.isFinite(value.outlineWidth))) {
    add(`${path}.outlineWidth`, 'outlineWidth must be a finite number');
  }
  validateColor(value.outlineColor, `${path}.outlineColor`, add);
}

function validateGroundDecal(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'groundDecal must be an object');
    return;
  }
  if (!isRecord(value.size)) {
    add(`${path}.size`, 'groundDecal.size must be an object');
  } else {
    for (const key of ['width', 'depth']) {
      if (typeof value.size[key] !== 'number' || !Number.isFinite(value.size[key]) || value.size[key] <= 0) {
        add(`${path}.size.${key}`, 'groundDecal size must be a positive finite number');
      }
    }
  }
  if (value.textureId != null && !nonEmptyString(value.textureId)) add(`${path}.textureId`, 'textureId must be non-empty when present');
  validateColor(value.color, `${path}.color`, add);
  for (const key of ['alphaIndex', 'diffuseTextureLevel', 'emissiveTextureLevel']) {
    if (value[key] != null && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) {
      add(`${path}.${key}`, `${key} must be a finite number`);
    }
  }
}

function validateMaterialProperties(value: Record<string, any>, path: string, add: (path: string, message: string) => void): void {
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (['albedoColor', 'diffuseColor', 'emissiveColor', 'outlineColor'].includes(key)) validateColor(child, childPath, add);
    if (['metallic', 'roughness', 'contrast', 'brightness', 'saturation', 'hue', 'colorDensity', 'alpha', 'alphaCutOff', 'transparencyMode'].includes(key)) {
      if (typeof child !== 'number' || !Number.isFinite(child)) add(childPath, `${key} must be a finite number`);
    }
    if (key === 'backFaceCulling' && typeof child !== 'boolean') add(childPath, 'backFaceCulling must be boolean');
    if (['albedoTexture', 'normalTexture', 'metallicTexture'].includes(key)) {
      if (!isRecord(child)) add(childPath, `${key} must be an object`);
      else if (child.url != null && !nonEmptyString(child.url)) add(`${childPath}.url`, 'texture url must be non-empty when present');
    }
    if (['pbr', 'standard'].includes(key)) {
      if (!isRecord(child)) add(childPath, `${key} must be an object`);
      else validateMaterialProperties(child, childPath, add);
    }
  }
}

function assertNoRuntimeOnlyFields(
  value: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  const serialized = JSON.stringify(value);
  const found = RUNTIME_ONLY_TOKENS.filter((token) => serialized.includes(token));
  if (found.length > 0) add(path, `contains runtime-only asset fields: ${found.join(', ')}`);
}
