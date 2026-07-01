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
const MATERIAL_ASSET_KINDS = new Set(sceneJsonV2Rules.materialAssetKinds);
const MATERIAL_ASSET_SYSTEM_PRESETS = new Set(sceneJsonV2Rules.materialAssetSystemPresets);
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
  if (!Array.isArray(scene.materialAssets)) add('$.scene.materialAssets', 'materialAssets must be an array');
  if (!Array.isArray(scene.materials)) add('$.scene.materials', 'materials must be an array');
  if (!Array.isArray(scene.textures)) add('$.scene.textures', 'textures must be an array');
  if (errors.length > 0) return errors;

  const assetIds = new Set<string>();
  const materialAssetIds = new Set<string>();
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

  const materialAssets = scene.materialAssets as unknown[];
  materialAssets.forEach((materialAsset, index) => {
    const path = `$.scene.materialAssets[${index}]`;
    if (!isRecord(materialAsset)) {
      add(path, 'material asset must be an object');
      return;
    }
    if (!nonEmptyString(materialAsset.id)) add(`${path}.id`, 'material asset id must be a non-empty string');
    else if (materialAssetIds.has(materialAsset.id)) add(`${path}.id`, `duplicate material asset id: ${materialAsset.id}`);
    else materialAssetIds.add(materialAsset.id);
    if (!nonEmptyString(materialAsset.name)) add(`${path}.name`, 'material asset name must be a non-empty string');
    if (materialAsset.guid != null && !nonEmptyString(materialAsset.guid)) add(`${path}.guid`, 'material asset guid must be a non-empty string when present');
    if (materialAsset.materialKind != null && !MATERIAL_ASSET_KINDS.has(materialAsset.materialKind)) {
      add(`${path}.materialKind`, 'materialKind must be pbr or standard');
    }
    validateArtistMaterialProfile(materialAsset.profile, `${path}.profile`, add);
    validateMaterialAssetSystem(materialAsset.system, `${path}.system`, add);
    validateMaterialAssetOrigin(materialAsset.origin, `${path}.origin`, add);
    validateMaterialAssetSystemKindConsistency(materialAsset, path, add);
  });

  scene.nodes.forEach((node, index) => {
    if (!isRecord(node)) return;
    const path = `$.scene.nodes[${index}]`;
    const parentId = nonEmptyString(node.parentId) ? node.parentId : scene.rootId;
    validateNodeParentTarget(parentId, scene.rootId, nodeIds, `${path}.parentId`, add);
    if (nonEmptyString(node.id)) validateNodeParentCycle(node.id, scene, `${path}.parentId`, add);
    validateRuntimeSourceBinding(node.source, `${path}.source`, add);
    validateTransform(node.transform, `${path}.transform`, add);
    validateNodeRendering(node.rendering, `${path}.rendering`, add);
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
      validateSceneLight(node.light, `${path}.light`, add);
    }
    if (node.kind === 'instance' || node.kind === 'transform' || node.kind === 'primitive') {
      validateNodeVisualOverrides(node.overrides, `${path}.overrides`, materialAssetIds, add);
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

function validateNodeVisualOverrides(
  overrides: unknown,
  path: string,
  materialAssetIds: Set<string>,
  add: (path: string, message: string) => void,
): void {
  if (overrides == null) return;
  if (!isRecord(overrides)) {
    add(path, 'overrides must be an object when present');
    return;
  }
  validateNodeMaterialBinding(overrides.materialBinding, `${path}.materialBinding`, materialAssetIds, add);
  validateNodeMaterialBindingMap(overrides.materialSlotBindings, `${path}.materialSlotBindings`, 'slotId', materialAssetIds, add);
  validateNodeMaterialBindingMap(overrides.childMaterialBindings, `${path}.childMaterialBindings`, 'ownerNodePath', materialAssetIds, add);
}

function validateNodeMaterialBindingMap(
  bindings: unknown,
  path: string,
  keyName: string,
  materialAssetIds: Set<string>,
  add: (path: string, message: string) => void,
): void {
  if (bindings == null) return;
  if (!isRecord(bindings)) {
    add(path, 'material binding map must be an object when present');
    return;
  }
  for (const [key, binding] of Object.entries(bindings)) {
    const bindingPath = `${path}.${key}`;
    if (!nonEmptyString(key)) add(bindingPath, `${keyName} must be a non-empty string`);
    validateNodeMaterialBinding(binding, bindingPath, materialAssetIds, add);
  }
}

function validateNodeMaterialBinding(
  binding: unknown,
  path: string,
  materialAssetIds: Set<string>,
  add: (path: string, message: string) => void,
): void {
  if (binding == null) return;
  if (!isRecord(binding)) {
    add(path, 'material binding must be an object when present');
    return;
  }
  if (binding.materialAssetId != null) {
    if (!nonEmptyString(binding.materialAssetId)) {
      add(`${path}.materialAssetId`, 'materialAssetId must be non-empty when present');
    } else if (!materialAssetIds.has(binding.materialAssetId)) {
      add(`${path}.materialAssetId`, `materialAssetId must reference scene.materialAssets: ${binding.materialAssetId}`);
    }
  }
  if (binding.override != null) validateArtistMaterialProfile(binding.override, `${path}.override`, add);
}

function validateArtistMaterialProfile(
  profile: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (!isRecord(profile)) {
    add(path, 'material asset profile must be an object');
    return;
  }
  if (profile.lightingModel != null && profile.lightingModel !== 'lit' && profile.lightingModel !== 'unlit') {
    add(`${path}.lightingModel`, 'lightingModel must be lit or unlit');
  }
  if (profile.baseColor != null) {
    if (!isRecord(profile.baseColor)) add(`${path}.baseColor`, 'baseColor must be an object');
    else {
      validateColor(profile.baseColor.color, `${path}.baseColor.color`, add);
      validateMaterialTextureRef(profile.baseColor.texture, `${path}.baseColor.texture`, add);
      for (const key of ['brightness', 'saturation', 'contrast', 'hue']) {
        if (profile.baseColor[key] != null && !isFiniteNumber(profile.baseColor[key])) add(`${path}.baseColor.${key}`, `${key} must be a finite number`);
      }
    }
  }
  for (const key of ['metallic', 'roughness']) {
    if (profile[key] != null && !isFiniteNumber(profile[key])) add(`${path}.${key}`, `${key} must be a finite number`);
  }
  if (profile.normal != null) {
    if (!isRecord(profile.normal)) add(`${path}.normal`, 'normal must be an object');
    else {
      validateMaterialTextureRef(profile.normal.texture, `${path}.normal.texture`, add);
      if (profile.normal.strength != null && !isFiniteNumber(profile.normal.strength)) add(`${path}.normal.strength`, 'normal strength must be a finite number');
    }
  }
  if (profile.metallicRoughness != null) {
    if (!isRecord(profile.metallicRoughness)) add(`${path}.metallicRoughness`, 'metallicRoughness must be an object');
    else validateMaterialTextureRef(profile.metallicRoughness.texture, `${path}.metallicRoughness.texture`, add);
  }
  if (profile.occlusion != null) {
    if (!isRecord(profile.occlusion)) add(`${path}.occlusion`, 'occlusion must be an object');
    else {
      validateMaterialTextureRef(profile.occlusion.texture, `${path}.occlusion.texture`, add);
      if (profile.occlusion.strength != null && !isFiniteNumber(profile.occlusion.strength)) add(`${path}.occlusion.strength`, 'occlusion strength must be a finite number');
    }
  }
  if (profile.emission != null) {
    if (!isRecord(profile.emission)) add(`${path}.emission`, 'emission must be an object');
    else {
      validateColor(profile.emission.color, `${path}.emission.color`, add);
      if (profile.emission.intensity != null && !isFiniteNumber(profile.emission.intensity)) add(`${path}.emission.intensity`, 'emission intensity must be a finite number');
      validateMaterialTextureRef(profile.emission.texture, `${path}.emission.texture`, add);
      validateMaterialTextureRef(profile.emission.maskTexture, `${path}.emission.maskTexture`, add);
    }
  }
  if (profile.alpha != null) {
    if (!isRecord(profile.alpha)) add(`${path}.alpha`, 'alpha must be an object');
    else {
      if (
        profile.alpha.mode != null
        && profile.alpha.mode !== 'opaque'
        && profile.alpha.mode !== 'mask'
        && profile.alpha.mode !== 'blend'
      ) {
        add(`${path}.alpha.mode`, 'alpha mode must be opaque, mask, or blend');
      }
      if (profile.alpha.opacity != null && !isFiniteNumber(profile.alpha.opacity)) add(`${path}.alpha.opacity`, 'alpha opacity must be a finite number');
      if (profile.alpha.cutoff != null && !isFiniteNumber(profile.alpha.cutoff)) add(`${path}.alpha.cutoff`, 'alpha cutoff must be a finite number');
      validateMaterialTextureRef(profile.alpha.texture, `${path}.alpha.texture`, add);
    }
  }
}

function validateMaterialTextureRef(
  texture: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (texture == null) return;
  if (!isRecord(texture)) {
    add(path, 'texture ref must be an object');
    return;
  }
  if (texture.url != null && !nonEmptyString(texture.url)) add(`${path}.url`, 'texture url must be non-empty when present');
  if (texture.textureAssetId != null && !nonEmptyString(texture.textureAssetId)) add(`${path}.textureAssetId`, 'textureAssetId must be non-empty when present');
}

function validateMaterialAssetSystem(
  system: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (system == null) return;
  if (!isRecord(system)) {
    add(path, 'material asset system must be an object');
    return;
  }
  if (system.readonly != null && typeof system.readonly !== 'boolean') add(`${path}.readonly`, 'readonly must be boolean');
  if (system.preset != null && !MATERIAL_ASSET_SYSTEM_PRESETS.has(system.preset)) {
    add(`${path}.preset`, 'preset must be default-pbr or default-standard');
  }
}

function validateMaterialAssetOrigin(
  origin: unknown,
  path: string,
  add: (path: string, message: string) => void,
): void {
  if (origin == null) return;
  if (!isRecord(origin)) {
    add(path, 'material asset origin must be an object');
    return;
  }
  if (origin.type !== 'imported' && origin.type !== 'created' && origin.type !== 'duplicated' && origin.type !== 'preset') {
    add(`${path}.type`, 'origin type must be imported, created, duplicated, or preset');
  }
  if (origin.sourceAssetGuid != null && !nonEmptyString(origin.sourceAssetGuid)) add(`${path}.sourceAssetGuid`, 'sourceAssetGuid must be non-empty when present');
  if (origin.sourceAssetId != null && !nonEmptyString(origin.sourceAssetId)) add(`${path}.sourceAssetId`, 'sourceAssetId must be non-empty when present');
  if (origin.sourceSlotId != null && !nonEmptyString(origin.sourceSlotId)) add(`${path}.sourceSlotId`, 'sourceSlotId must be non-empty when present');
  if (origin.sourceMaterialIndex != null && !Number.isInteger(origin.sourceMaterialIndex)) add(`${path}.sourceMaterialIndex`, 'sourceMaterialIndex must be an integer when present');
  if (origin.sourceMaterialName != null && !nonEmptyString(origin.sourceMaterialName)) add(`${path}.sourceMaterialName`, 'sourceMaterialName must be non-empty when present');
  if (origin.sourceMaterialAssetId != null && !nonEmptyString(origin.sourceMaterialAssetId)) add(`${path}.sourceMaterialAssetId`, 'sourceMaterialAssetId must be non-empty when present');
}

function validateMaterialAssetSystemKindConsistency(
  materialAsset: Record<string, any>,
  path: string,
  add: (path: string, message: string) => void,
): void {
  const preset = isRecord(materialAsset.system) ? materialAsset.system.preset : undefined;
  if (preset === 'default-pbr' && materialAsset.materialKind != null && materialAsset.materialKind !== 'pbr') {
    add(`${path}.materialKind`, 'default-pbr material assets must use materialKind pbr');
  }
  if (preset === 'default-standard' && materialAsset.materialKind != null && materialAsset.materialKind !== 'standard') {
    add(`${path}.materialKind`, 'default-standard material assets must use materialKind standard');
  }
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

function validateVec2(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'value must be a vector object');
    return;
  }
  for (const axis of ['x', 'y']) {
    if (typeof value[axis] !== 'number' || !Number.isFinite(value[axis])) {
      add(`${path}.${axis}`, 'vector component must be a finite number');
    }
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isUnitRangeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
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

  if (value.projection != null && value.projection !== 'orthographic' && value.projection !== 'perspective') {
    add(`${path}.projection`, 'camera projection must be orthographic or perspective');
  }

  for (const key of ['alpha', 'beta']) {
    if (!isFiniteNumber(value[key])) add(`${path}.${key}`, 'camera property must be a finite number');
  }
  for (const key of ['radius', 'orthoSize']) {
    if (!isPositiveFiniteNumber(value[key])) add(`${path}.${key}`, 'camera property must be a positive finite number');
  }
  if (value.fov != null && !isPositiveFiniteNumber(value.fov)) add(`${path}.fov`, 'camera fov must be a positive finite number');

  validateVec3(value.targetOffset, `${path}.targetOffset`, add);
  validateVec2(value.targetScreenOffset, `${path}.targetScreenOffset`, add);

  for (const key of ['minZ', 'maxZ', 'lowerRadiusLimit', 'upperRadiusLimit']) {
    if (value[key] != null && !isPositiveFiniteNumber(value[key])) {
      add(`${path}.${key}`, 'camera property must be a positive finite number');
    }
  }
  for (const key of ['lowerBetaLimit', 'upperBetaLimit']) {
    if (value[key] != null && !isFiniteNumber(value[key])) {
      add(`${path}.${key}`, 'camera property must be a finite number');
    }
  }
  if (value.inertia != null && !isUnitRangeNumber(value.inertia)) {
    add(`${path}.inertia`, 'camera inertia must be between 0 and 1');
  }

  if (isPositiveFiniteNumber(value.minZ) && isPositiveFiniteNumber(value.maxZ) && value.maxZ <= value.minZ) {
    add(`${path}.maxZ`, 'camera maxZ must be greater than minZ');
  }
  if (isFiniteNumber(value.lowerBetaLimit) && isFiniteNumber(value.upperBetaLimit) && value.upperBetaLimit < value.lowerBetaLimit) {
    add(`${path}.upperBetaLimit`, 'camera upperBetaLimit must be greater than or equal to lowerBetaLimit');
  }
  if (isPositiveFiniteNumber(value.lowerRadiusLimit) && isPositiveFiniteNumber(value.upperRadiusLimit) && value.upperRadiusLimit < value.lowerRadiusLimit) {
    add(`${path}.upperRadiusLimit`, 'camera upperRadiusLimit must be greater than or equal to lowerRadiusLimit');
  }
}

function validateSceneLight(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'light must be an object');
    return;
  }
  if (value.type !== 'directional' && value.type !== 'hemispheric') {
    add(`${path}.type`, 'light.type must be directional or hemispheric');
  }
  if (typeof value.intensity !== 'number' || !Number.isFinite(value.intensity) || value.intensity < 0) {
    add(`${path}.intensity`, 'light intensity must be a non-negative finite number');
  }
  if (value.type === 'directional') validateVec3(value.direction, `${path}.direction`, add);
  validateColor(value.diffuseColor, `${path}.diffuseColor`, add);
  validateColor(value.groundColor, `${path}.groundColor`, add);
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
  validateGroundDecalUi(value, path, add);
}

function validateGroundDecalUi(value: Record<string, any>, path: string, add: (path: string, message: string) => void): void {
  if (value.uiKind !== 'operation' && value.uiKind !== 'delivery') {
    add(`${path}.uiKind`, 'groundDecal UI kind must be operation or delivery');
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
  if (value.aspectSourceLayerId != null && !nonEmptyString(value.aspectSourceLayerId)) {
    add(`${path}.aspectSourceLayerId`, 'aspectSourceLayerId must be non-empty when present');
  }
  if (value.lockAspectToBorder != null && typeof value.lockAspectToBorder !== 'boolean') {
    add(`${path}.lockAspectToBorder`, 'lockAspectToBorder must be boolean when present');
  }
  validateGroundDecalUiMask(value.mask, `${path}.mask`, add);
  validateGroundDecalUiRendering(value.rendering, `${path}.rendering`, add);
  if (!Array.isArray(value.layers)) {
    add(`${path}.layers`, 'groundDecal UI layers must be an array');
    return;
  }
  value.layers.forEach((layer: unknown, index: number) => validateGroundDecalUiLayer(layer, `${path}.layers[${index}]`, add));
  validateGroundDecalUiLayerIds(value.layers, `${path}.layers`, add);
  if (value.uiKind === 'delivery') {
    validateDeliveryGroundDecalUiPairs(value.layers, `${path}.layers`, add);
  }
}

function validateGroundDecalUiMask(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'groundDecal UI mask must be an object');
    return;
  }
  if (value.enabled != null && typeof value.enabled !== 'boolean') add(`${path}.enabled`, 'mask.enabled must be boolean');
  if (value.source != null && value.source !== 'roundedRect' && value.source !== 'borderAlpha' && value.source !== 'texture') {
    add(`${path}.source`, 'mask.source must be roundedRect, borderAlpha, or texture');
  }
  if (value.textureId != null && !nonEmptyString(value.textureId)) add(`${path}.textureId`, 'mask.textureId must be non-empty when present');
  for (const key of ['cornerRadius', 'padding']) {
    if (value[key] != null && (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] < 0)) {
      add(`${path}.${key}`, `${key} must be a non-negative finite number`);
    }
  }
}

function validateGroundDecalUiRendering(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'groundDecal UI rendering must be an object');
    return;
  }
  for (const key of ['textureWidth', 'textureHeight']) {
    if (value[key] != null && (!Number.isInteger(value[key]) || value[key] <= 0)) {
      add(`${path}.${key}`, `${key} must be a positive integer`);
    }
  }
  for (const key of ['alphaIndex', 'diffuseTextureLevel', 'emissiveTextureLevel']) {
    if (value[key] != null && (typeof value[key] !== 'number' || !Number.isFinite(value[key]))) {
      add(`${path}.${key}`, `${key} must be a finite number`);
    }
  }
}

function validateGroundDecalUiLayer(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (!isRecord(value)) {
    add(path, 'groundDecal UI layer must be an object');
    return;
  }
  if (!nonEmptyString(value.id)) add(`${path}.id`, 'layer.id must be non-empty');
  if (!['base', 'border', 'mainLogo', 'subLogo', 'amount', 'progressFill'].includes(String(value.role))) {
    add(`${path}.role`, 'layer.role is invalid');
  }
  if (value.enabled != null && typeof value.enabled !== 'boolean') add(`${path}.enabled`, 'layer.enabled must be boolean');
  if (typeof value.zOrder !== 'number' || !Number.isFinite(value.zOrder)) add(`${path}.zOrder`, 'layer.zOrder must be a finite number');
  if (value.opacity != null && (typeof value.opacity !== 'number' || !Number.isFinite(value.opacity))) add(`${path}.opacity`, 'layer.opacity must be finite');
  validateGroundDecalUiRect(value.rect, `${path}.rect`, add);
  if (value.kind === 'texture') {
    if (!nonEmptyString(value.textureId)) add(`${path}.textureId`, 'texture layer textureId must be non-empty');
    validateGroundDecalUiColor(value.tint, `${path}.tint`, add);
  } else if (value.kind === 'color') {
    validateGroundDecalUiColor(value.color, `${path}.color`, add);
  } else if (value.kind === 'progress') {
    if (typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value < 0 || value.value > 1) {
      add(`${path}.value`, 'progress value must be between 0 and 1');
    }
    if (value.direction != null && !['leftToRight', 'rightToLeft', 'bottomToTop', 'topToBottom'].includes(String(value.direction))) {
      add(`${path}.direction`, 'progress direction is invalid');
    }
    validateGroundDecalUiColor(value.color, `${path}.color`, add);
  } else if (value.kind === 'text') {
    validateGroundDecalUiText(value.text, `${path}.text`, add);
  } else {
    add(`${path}.kind`, 'layer.kind must be texture, color, progress, or text');
  }
}

function validateGroundDecalUiLayerIds(layers: unknown[], path: string, add: (path: string, message: string) => void): void {
  const seen = new Map<string, number>();
  layers.forEach((layer, index) => {
    if (!isRecord(layer) || !nonEmptyString(layer.id)) return;
    const previousIndex = seen.get(layer.id);
    if (previousIndex != null) {
      add(`${path}[${index}].id`, `layer.id must be unique; duplicate of layers[${previousIndex}]`);
      return;
    }
    seen.set(layer.id, index);
  });
}

function validateDeliveryGroundDecalUiPairs(layers: unknown[], path: string, add: (path: string, message: string) => void): void {
  const records = layers.filter(isRecord);
  const subLogoLayers = records.filter(layer => layer.role === 'subLogo');
  const amountLayers = records.filter(layer => layer.role === 'amount');
  if (subLogoLayers.length < 1 || amountLayers.length < 1) {
    add(path, 'delivery groundDecal UI requires at least one subLogo + amount pair');
  }
  if (subLogoLayers.length > 2 || amountLayers.length > 2) {
    add(path, 'delivery groundDecal UI supports at most two subLogo + amount pairs');
  }
  if (subLogoLayers.length !== amountLayers.length) {
    add(path, 'delivery groundDecal UI subLogo and amount layers must be paired');
  }

  validateDeliveryGroundDecalUiPairSlot(records, path, add, {
    index: 1,
    subLogoId: 'subLogo',
    amountId: 'amount',
    required: true,
  });
  validateDeliveryGroundDecalUiPairSlot(records, path, add, {
    index: 2,
    subLogoId: 'subLogo2',
    amountId: 'amount2',
    required: false,
  });

  for (const layer of subLogoLayers) {
    if (layer.id !== 'subLogo' && layer.id !== 'subLogo2') {
      add(`${path}.${String(layer.id)}`, 'delivery subLogo layer id must be subLogo or subLogo2');
    }
  }
  for (const layer of amountLayers) {
    if (layer.id !== 'amount' && layer.id !== 'amount2') {
      add(`${path}.${String(layer.id)}`, 'delivery amount layer id must be amount or amount2');
    }
  }
}

function validateDeliveryGroundDecalUiPairSlot(
  layers: Record<string, any>[],
  path: string,
  add: (path: string, message: string) => void,
  slot: { index: 1 | 2; subLogoId: string; amountId: string; required: boolean },
): void {
  const subLogoLayer = layers.find(layer => layer.id === slot.subLogoId);
  const amountLayer = layers.find(layer => layer.id === slot.amountId);
  if (slot.required && (!subLogoLayer || !amountLayer)) {
    add(path, `delivery groundDecal UI requires pair ${slot.index}`);
  }
  if (!!subLogoLayer !== !!amountLayer) {
    add(path, `delivery groundDecal UI pair ${slot.index} must contain both subLogo and amount`);
  }
  if (subLogoLayer) {
    if (subLogoLayer.role !== 'subLogo') add(`${path}.${slot.subLogoId}.role`, `pair ${slot.index} subLogo role must be subLogo`);
    if (subLogoLayer.kind !== 'texture') add(`${path}.${slot.subLogoId}.kind`, `pair ${slot.index} subLogo must be a texture layer`);
  }
  if (amountLayer) {
    if (amountLayer.role !== 'amount') add(`${path}.${slot.amountId}.role`, `pair ${slot.index} amount role must be amount`);
    if (amountLayer.kind !== 'text') add(`${path}.${slot.amountId}.kind`, `pair ${slot.index} amount must be a text layer`);
  }
}

function validateGroundDecalUiRect(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (!isRecord(value)) {
    add(path, 'layer.rect must be an object');
    return;
  }
  for (const key of ['x', 'z', 'width', 'depth']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) add(`${path}.${key}`, `rect.${key} must be a finite number`);
  }
  for (const key of ['width', 'depth']) {
    if (typeof value[key] === 'number' && value[key] <= 0) add(`${path}.${key}`, `rect.${key} must be positive`);
  }
}

function validateGroundDecalUiText(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (!isRecord(value)) {
    add(path, 'text layer text must be an object');
    return;
  }
  if (typeof value.value !== 'string') add(`${path}.value`, 'text.value must be a string');
  if (value.fontFamily != null && typeof value.fontFamily !== 'string') add(`${path}.fontFamily`, 'fontFamily must be a string');
  if (value.fontSize != null && (typeof value.fontSize !== 'number' || !Number.isFinite(value.fontSize) || value.fontSize <= 0)) {
    add(`${path}.fontSize`, 'fontSize must be a positive finite number');
  }
  if (value.fontWeight != null && typeof value.fontWeight !== 'string') add(`${path}.fontWeight`, 'fontWeight must be a string');
  validateGroundDecalUiColor(value.color, `${path}.color`, add);
  validateGroundDecalUiColor(value.strokeColor, `${path}.strokeColor`, add);
  if (value.strokeWidth != null && (typeof value.strokeWidth !== 'number' || !Number.isFinite(value.strokeWidth) || value.strokeWidth < 0)) {
    add(`${path}.strokeWidth`, 'strokeWidth must be a non-negative finite number');
  }
}

function validateGroundDecalUiColor(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'color must be an object');
    return;
  }
  for (const key of ['r', 'g', 'b']) {
    if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) add(`${path}.${key}`, `color.${key} must be finite`);
  }
  if (value.a != null && (typeof value.a !== 'number' || !Number.isFinite(value.a))) add(`${path}.a`, 'color.a must be finite');
}

function validateNodeRendering(value: unknown, path: string, add: (path: string, message: string) => void): void {
  if (value == null) return;
  if (!isRecord(value)) {
    add(path, 'rendering must be an object');
    return;
  }
  if (
    value.renderingGroupId != null
    && value.renderingGroupId !== 0
    && value.renderingGroupId !== 1
    && value.renderingGroupId !== 2
    && value.renderingGroupId !== 3
  ) {
    add(`${path}.renderingGroupId`, 'renderingGroupId must be 0, 1, 2, or 3');
  }
  if (value.alphaIndex != null && (typeof value.alphaIndex !== 'number' || !Number.isFinite(value.alphaIndex))) {
    add(`${path}.alphaIndex`, 'alphaIndex must be a finite number');
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
