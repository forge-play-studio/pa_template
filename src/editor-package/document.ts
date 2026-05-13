import { configService } from '../config';
import type {
  ColorRGB,
  MaterialOverrideConfig,
  OutlineOverrideConfig,
  Position3D,
  Scale3D,
  SceneConfig,
  SceneAssetConfig,
  SceneGroupNode,
  SceneInstanceNode,
  SceneNodeConfig,
  SceneNodeVisualOverrides,
  SceneSharedMaterialConfig,
  SceneTransformNode,
  TransformConfig,
} from '../config';
import type {
  ProjectEditorDocumentCommitArgs,
  ProjectEditorDocumentExport,
  ProjectEditorDuplicateResult,
  ProjectEditorPluginContext,
  ProjectMaterialProp,
  ProjectMaterialValue,
  ProjectOutlineProp,
  ProjectOutlineValue,
  ProjectEditorRuntimeChange,
  ProjectPersistentBinding,
  ProjectPersistentBindingSnapshot,
  ProjectRotation3D,
  ProjectRuntimeProp,
} from './types';
import type { CanonicalMaterialChange } from './runtime-core/material-property-adapter';
import {
  applyMaterialValueToRuntimeMaterial,
  applyMaterialValueToRuntimeNode,
  resolveMaterialOwnerNode,
} from './runtime-core/material-property-adapter';
import type { CanonicalOutlineChange } from './runtime-core/outline-adapter';
import {
  applyOutlineValueToRuntimeNode,
  resolveOutlineOwnerNode,
} from './runtime-core/outline-adapter';
import {
  applySceneNodeDuplicateEntry,
  createSceneNodeDuplicateEntry,
  redoSceneNodeDuplicateEntry,
  type SceneNodeDuplicateCommandEntry,
  undoSceneNodeDuplicateEntry,
} from './scene-node-duplicate';

export interface ProjectEditorDocumentState {
  original: SceneConfig | null;
  workingCopy: SceneConfig | null;
}

export interface ProjectDocumentBindingLocation {
  kind: 'sceneNode';
  nodeId: string;
  path: string;
  pathSegments: ['scene', 'nodes', number];
  value: SceneGroupNode | SceneInstanceNode | SceneTransformNode;
}

type TransformSnapshot = TransformConfig | null;
type MaterialSnapshot = MaterialOverrideConfig | null;
type OutlineSnapshot = OutlineOverrideConfig | null;

type TransformTarget = 'root' | 'childTransform';
type MaterialTarget = 'root' | 'childMaterial';
type OutlineTarget = 'root' | 'childOutline';

type ProjectEditorTransformHistoryEntry = {
  kind: 'transform';
  binding: ProjectPersistentBindingSnapshot;
  prop: ProjectRuntimeProp;
  target: TransformTarget;
  ownerNodePath: string;
  before: TransformSnapshot;
  after: TransformSnapshot;
  runtimeBefore: Position3D | Scale3D | ProjectRotation3D;
  runtimeAfter: Position3D | Scale3D | ProjectRotation3D;
};

type ProjectEditorMaterialHistoryEntry = {
  kind: 'material';
  binding: ProjectPersistentBindingSnapshot;
  storage: 'override' | 'shared';
  assetId: string;
  materialName: string;
  materialType: string | null;
  prop: ProjectMaterialProp;
  target: MaterialTarget;
  ownerNodePath: string;
  before: MaterialSnapshot;
  after: MaterialSnapshot;
  runtimeBefore: ProjectMaterialValue;
  runtimeAfter: ProjectMaterialValue;
};

type ProjectEditorOutlineHistoryEntry = {
  kind: 'outline';
  binding: ProjectPersistentBindingSnapshot;
  storage: 'override' | 'shared';
  assetId: string;
  prop: ProjectOutlineProp;
  target: OutlineTarget;
  ownerNodePath: string;
  before: OutlineSnapshot;
  after: OutlineSnapshot;
  runtimeBefore: ProjectOutlineValue;
  runtimeAfter: ProjectOutlineValue;
};

type ProjectEditorDuplicateHistoryEntry = SceneNodeDuplicateCommandEntry & {
  kind: 'duplicate';
};

type ProjectEditorTransformBatchHistoryEntry = {
  kind: 'transformBatch';
  entries: ProjectEditorTransformHistoryEntry[];
};

type ProjectEditorHistoryEntry =
  | ProjectEditorTransformHistoryEntry
  | ProjectEditorMaterialHistoryEntry
  | ProjectEditorOutlineHistoryEntry
  | ProjectEditorTransformBatchHistoryEntry
  | ProjectEditorDuplicateHistoryEntry;

const documentState: ProjectEditorDocumentState = {
  original: null,
  workingCopy: null,
};

const historyState: {
  undoStack: ProjectEditorHistoryEntry[];
  redoStack: ProjectEditorHistoryEntry[];
  activeTransformBatch: ProjectEditorTransformHistoryEntry[] | null;
} = {
  undoStack: [],
  redoStack: [],
  activeTransformBatch: null,
};

let originalSnapshot = '';

function logDocument(message: string, data?: Record<string, unknown>): void {
  if (data) {
    console.log(`[ProjectEditor][Document] ${message}`, data);
    return;
  }
  console.log(`[ProjectEditor][Document] ${message}`);
}

function cloneSceneConfig(sceneConfig: SceneConfig): SceneConfig {
  return JSON.parse(JSON.stringify(sceneConfig)) as SceneConfig;
}

function snapshotSceneConfig(sceneConfig: SceneConfig | null): string {
  return sceneConfig ? JSON.stringify(sceneConfig) : '';
}

function requireWorkingCopy(): SceneConfig {
  return ensureProjectEditorDocumentLoaded().workingCopy as SceneConfig;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type SceneJsonDiff = {
  path: string;
  reason: string;
  local?: unknown;
  saved?: unknown;
};

const PLATFORM_SAVE_METADATA_KEYS = new Set(['version', 'updatedAt']);
const MAX_SCENE_SAVE_DIFFS = 25;

function normalizePlatformSavedSceneJson(value: unknown, path: string[] = []): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizePlatformSavedSceneJson(item, path));
  }
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (path.length === 0 && PLATFORM_SAVE_METADATA_KEYS.has(key)) continue;
    out[key] = normalizePlatformSavedSceneJson(child, [...path, key]);
  }
  return out;
}

function formatSceneJsonPath(path: Array<string | number>): string {
  if (path.length === 0) return '$';
  let out = '$';
  for (const segment of path) {
    out = typeof segment === 'number' ? `${out}[${segment}]` : `${out}.${segment}`;
  }
  return out;
}

function collectSceneJsonDiffs(
  local: unknown,
  saved: unknown,
  path: Array<string | number> = [],
  diffs: SceneJsonDiff[] = [],
): SceneJsonDiff[] {
  if (diffs.length >= MAX_SCENE_SAVE_DIFFS) return diffs;
  if (Object.is(local, saved)) return diffs;

  if (Array.isArray(local) || Array.isArray(saved)) {
    if (!Array.isArray(local) || !Array.isArray(saved)) {
      diffs.push({ path: formatSceneJsonPath(path), reason: 'type_mismatch', local, saved });
      return diffs;
    }
    if (local.length !== saved.length) {
      diffs.push({ path: formatSceneJsonPath(path), reason: 'array_length_mismatch', local: local.length, saved: saved.length });
    }
    const length = Math.min(local.length, saved.length);
    for (let index = 0; index < length; index += 1) {
      collectSceneJsonDiffs(local[index], saved[index], [...path, index], diffs);
      if (diffs.length >= MAX_SCENE_SAVE_DIFFS) break;
    }
    return diffs;
  }

  const localIsObject = !!local && typeof local === 'object';
  const savedIsObject = !!saved && typeof saved === 'object';
  if (localIsObject || savedIsObject) {
    if (!localIsObject || !savedIsObject) {
      diffs.push({ path: formatSceneJsonPath(path), reason: 'type_mismatch', local, saved });
      return diffs;
    }
    const localRecord = local as Record<string, unknown>;
    const savedRecord = saved as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(localRecord), ...Object.keys(savedRecord)])].sort();
    for (const key of keys) {
      if (!(key in localRecord)) {
        diffs.push({ path: formatSceneJsonPath([...path, key]), reason: 'extra_saved_key', saved: savedRecord[key] });
      } else if (!(key in savedRecord)) {
        diffs.push({ path: formatSceneJsonPath([...path, key]), reason: 'missing_saved_key', local: localRecord[key] });
      } else {
        collectSceneJsonDiffs(localRecord[key], savedRecord[key], [...path, key], diffs);
      }
      if (diffs.length >= MAX_SCENE_SAVE_DIFFS) break;
    }
    return diffs;
  }

  diffs.push({ path: formatSceneJsonPath(path), reason: 'value_mismatch', local, saved });
  return diffs;
}

function validatePlatformSavedSceneJsonText(localSceneConfig: SceneConfig, savedSceneJsonText?: string): boolean {
  if (typeof savedSceneJsonText !== 'string' || !savedSceneJsonText.trim()) {
    logDocument('skip platform saved scene json validation: no returned scene json text');
    return true;
  }

  let savedSceneConfig: unknown;
  try {
    savedSceneConfig = JSON.parse(savedSceneJsonText);
  } catch (error) {
    console.error('[ProjectEditor][Document] platform saved scene json validation failed: invalid json', {
      error: error instanceof Error ? error.message : String(error),
      returnedSceneJsonTextLength: savedSceneJsonText.length,
    });
    return false;
  }

  const localComparable = normalizePlatformSavedSceneJson(localSceneConfig);
  const savedComparable = normalizePlatformSavedSceneJson(savedSceneConfig);
  const diffs = collectSceneJsonDiffs(localComparable, savedComparable);
  if (diffs.length > 0) {
    console.error('[ProjectEditor][Document] platform saved scene json differs from local working copy', {
      diffCount: diffs.length,
      diffLimit: MAX_SCENE_SAVE_DIFFS,
      diffs,
      savedVersion: (savedSceneConfig as any)?.version ?? null,
      savedUpdatedAt: (savedSceneConfig as any)?.updatedAt ?? null,
    });
    return false;
  }

  logDocument('platform saved scene json validated', {
    returnedSceneJsonTextLength: savedSceneJsonText.length,
    savedVersion: (savedSceneConfig as any)?.version ?? null,
    savedUpdatedAt: (savedSceneConfig as any)?.updatedAt ?? null,
  });
  return true;
}

type TransformContainer = {
  transform?: TransformConfig;
};

type VisualOverrideContainer = {
  overrides?: SceneNodeVisualOverrides;
};

function ensureSceneNodes(sceneConfig: SceneConfig): SceneNodeConfig[] {
  if (!sceneConfig.scene || typeof sceneConfig.scene !== 'object') {
    sceneConfig.scene = {
      rootId: 'root',
      assets: [],
      nodes: [],
      materials: [],
      textures: [],
    };
  }
  if (!Array.isArray(sceneConfig.scene.nodes)) {
    sceneConfig.scene.nodes = [];
  }
  return sceneConfig.scene.nodes;
}

function ensureSceneSection(sceneConfig: SceneConfig): NonNullable<SceneConfig['scene']> {
  if (!sceneConfig.scene || typeof sceneConfig.scene !== 'object') {
    sceneConfig.scene = {
      rootId: 'root',
      assets: [],
      nodes: [],
      materials: [],
      textures: [],
    };
  }
  if (!Array.isArray(sceneConfig.scene.assets)) {
    sceneConfig.scene.assets = [];
  }
  if (!Array.isArray(sceneConfig.scene.nodes)) {
    sceneConfig.scene.nodes = [];
  }
  if (!Array.isArray(sceneConfig.scene.materials)) {
    sceneConfig.scene.materials = [];
  }
  if (!Array.isArray(sceneConfig.scene.textures)) {
    sceneConfig.scene.textures = [];
  }
  return sceneConfig.scene;
}

function ensureSceneMaterials(sceneConfig: SceneConfig): SceneSharedMaterialConfig[] {
  return ensureSceneSection(sceneConfig).materials;
}

function getSceneAsset(sceneConfig: SceneConfig, assetId: string): SceneAssetConfig | null {
  const scene = ensureSceneSection(sceneConfig);
  return scene.assets.find((asset) => asset.id === assetId) ?? null;
}

function ensureSceneAssetDefaults(asset: SceneAssetConfig): NonNullable<SceneAssetConfig['defaults']> {
  if (!asset.defaults || typeof asset.defaults !== 'object') {
    asset.defaults = {};
  }
  return asset.defaults;
}

function ensureTransform(value: TransformContainer): TransformConfig {
  if (!value.transform || typeof value.transform !== 'object') {
    value.transform = {};
  }
  return value.transform;
}

function toBindingSnapshot(binding: ProjectPersistentBinding): ProjectPersistentBindingSnapshot {
  return { kind: 'sceneNode', nodeId: binding.nodeId };
}

function clearProjectEditorHistory(): void {
  historyState.undoStack = [];
  historyState.redoStack = [];
  historyState.activeTransformBatch = null;
}

function pushProjectEditorHistory(entry: ProjectEditorHistoryEntry): void {
  historyState.undoStack.push(entry);
  historyState.redoStack = [];
}

function pushProjectEditorTransformHistory(entry: ProjectEditorTransformHistoryEntry): void {
  if (historyState.activeTransformBatch) {
    historyState.activeTransformBatch.push(entry);
    historyState.redoStack = [];
    return;
  }
  pushProjectEditorHistory(entry);
}

function sameSnapshot(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function readAxis(value: any, axis: 'x' | 'y' | 'z'): number | null {
  if (!value || typeof value !== 'object') return null;
  const direct = value[axis];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const hidden = value[`_${axis}`];
  if (typeof hidden === 'number' && Number.isFinite(hidden)) return hidden;
  return null;
}

function readPosition(value: any): Position3D | null {
  const x = readAxis(value, 'x');
  const y = readAxis(value, 'y');
  const z = readAxis(value, 'z');
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

function readScaling(value: any): Scale3D | null {
  const x = readAxis(value, 'x');
  const y = readAxis(value, 'y');
  const z = readAxis(value, 'z');
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

function readRotation(value: any): ProjectRotation3D | null {
  const x = readAxis(value, 'x');
  const y = readAxis(value, 'y');
  const z = readAxis(value, 'z');
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

function readRuntimeValue(prop: ProjectRuntimeProp, value: any): Position3D | Scale3D | ProjectRotation3D | null {
  if (prop === 'position') return readPosition(value);
  if (prop === 'rotation') return readRotation(value);
  return readScaling(value);
}

function toTransformSnapshot(
  prop: ProjectRuntimeProp,
  value: Position3D | Scale3D | ProjectRotation3D,
): TransformSnapshot {
  if (prop === 'position') {
    return { position: cloneJson(value as Position3D) };
  }
  if (prop === 'rotation') {
    return { rotation: cloneJson(value as ProjectRotation3D) };
  }
  const scaling = value as Scale3D;
  return { scale: { x: scaling.x, y: scaling.y, z: scaling.z } };
}

function applyTransformPropSnapshot(
  target: TransformConfig,
  prop: ProjectRuntimeProp,
  snapshot: TransformSnapshot,
): void {
  if (prop === 'position') {
    delete target.position;
    if (snapshot?.position) target.position = cloneJson(snapshot.position);
    return;
  }

  if (prop === 'rotation') {
    delete target.rotation;
    delete target.rotationDeg;
    if (snapshot?.rotation) target.rotation = cloneJson(snapshot.rotation);
    if (snapshot?.rotationDeg) target.rotationDeg = cloneJson(snapshot.rotationDeg);
    return;
  }

  delete target.scale;
  if (snapshot?.scale !== undefined) target.scale = cloneJson(snapshot.scale);
}

function getTransformPropSnapshot(
  target: TransformConfig | undefined,
  prop: ProjectRuntimeProp,
): TransformSnapshot {
  if (!target) return null;

  if (prop === 'position') {
    return target.position ? { position: cloneJson(target.position) } : null;
  }

  if (prop === 'rotation') {
    const snapshot: TransformConfig = {};
    if (target.rotation) snapshot.rotation = cloneJson(target.rotation);
    if (target.rotationDeg) snapshot.rotationDeg = cloneJson(target.rotationDeg);
    return Object.keys(snapshot).length > 0 ? snapshot : null;
  }

  return target.scale !== undefined ? { scale: cloneJson(target.scale) } : null;
}

function cleanupTransformContainer(value: TransformContainer): void {
  if (value.transform && isEmptyObject(value.transform)) {
    delete value.transform;
  }
}

function applyRuntimeValue(
  node: any,
  prop: ProjectRuntimeProp,
  value: Position3D | Scale3D | ProjectRotation3D,
): void {
  if (!node) return;
  if (prop === 'position' && node.position?.set) {
    const v = value as Position3D;
    node.position.set(v.x, v.y, v.z);
    return;
  }
  if (prop === 'rotation' && node.rotation?.set) {
    const v = value as ProjectRotation3D;
    node.rotationQuaternion = null;
    node.rotation.set(v.x, v.y, v.z);
    return;
  }
  if (prop === 'scaling' && node.scaling?.set) {
    const v = value as Scale3D;
    node.scaling.set(v.x, v.y, v.z);
  }
}

function cloneMaterialSnapshot(snapshot: MaterialSnapshot): MaterialSnapshot {
  return snapshot ? cloneJson(snapshot) : null;
}

function cloneOutlineSnapshot(snapshot: OutlineSnapshot): OutlineSnapshot {
  return snapshot ? cloneJson(snapshot) : null;
}

function isEmptyObject(value: unknown): boolean {
  return !!value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0;
}

function pruneMaterialSnapshot(snapshot: MaterialSnapshot): MaterialSnapshot {
  if (!snapshot) return null;

  const next = cloneJson(snapshot);
  for (const textureKey of ['albedoTexture', 'normalTexture', 'metallicTexture'] as const) {
    const textureValue = next[textureKey];
    if (textureValue && typeof textureValue === 'object' && isEmptyObject(textureValue)) {
      delete next[textureKey];
    }
  }

  return isEmptyObject(next) ? null : next;
}

function pruneOutlineSnapshot(snapshot: OutlineSnapshot): OutlineSnapshot {
  if (!snapshot) return null;
  const next = cloneJson(snapshot);
  return isEmptyObject(next) ? null : next;
}

function ensureSceneNodeOverrides(value: VisualOverrideContainer): SceneNodeVisualOverrides {
  if (!value.overrides || typeof value.overrides !== 'object') {
    value.overrides = {};
  }
  return value.overrides;
}

function cleanupSceneNodeOverrides(value: VisualOverrideContainer): void {
  const overrides = value.overrides;
  if (!overrides) return;

  if (overrides.childMaterials && Object.keys(overrides.childMaterials).length === 0) {
    delete overrides.childMaterials;
  }
  if (overrides.childTransforms && Object.keys(overrides.childTransforms).length === 0) {
    delete overrides.childTransforms;
  }
  if (overrides.childOutlines && Object.keys(overrides.childOutlines).length === 0) {
    delete overrides.childOutlines;
  }

  if (!overrides.material && !overrides.outline && !overrides.childMaterials && !overrides.childTransforms && !overrides.childOutlines) {
    delete value.overrides;
  }
}

function ensureChildMaterials(value: VisualOverrideContainer): Record<string, MaterialOverrideConfig> {
  const overrides = ensureSceneNodeOverrides(value);
  if (!overrides.childMaterials || typeof overrides.childMaterials !== 'object') {
    overrides.childMaterials = {};
  }
  return overrides.childMaterials;
}

function ensureChildTransforms(value: VisualOverrideContainer): Record<string, TransformConfig> {
  const overrides = ensureSceneNodeOverrides(value);
  if (!overrides.childTransforms || typeof overrides.childTransforms !== 'object') {
    overrides.childTransforms = {};
  }
  return overrides.childTransforms;
}

function ensureChildTransform(value: VisualOverrideContainer, ownerNodePath: string): TransformConfig {
  const childTransforms = ensureChildTransforms(value);
  if (!childTransforms[ownerNodePath] || typeof childTransforms[ownerNodePath] !== 'object') {
    childTransforms[ownerNodePath] = {};
  }
  return childTransforms[ownerNodePath];
}

function cleanupChildTransform(value: VisualOverrideContainer, ownerNodePath: string): void {
  const childTransforms = value.overrides?.childTransforms;
  const childTransform = childTransforms?.[ownerNodePath];
  if (childTransform && childTransforms && isEmptyObject(childTransform)) {
    delete childTransforms[ownerNodePath];
  }
  cleanupSceneNodeOverrides(value);
}

function ensureChildOutlines(value: VisualOverrideContainer): Record<string, OutlineOverrideConfig> {
  const overrides = ensureSceneNodeOverrides(value);
  if (!overrides.childOutlines || typeof overrides.childOutlines !== 'object') {
    overrides.childOutlines = {};
  }
  return overrides.childOutlines;
}

function sanitizeSharedMaterialIdPart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'material';
}

function normalizeSharedOwnerNodePath(ownerNodePath: string): string {
  if (!ownerNodePath) return '';
  return ownerNodePath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) return '';
      const suffix = trimmed.includes(':') ? trimmed.slice(trimmed.lastIndexOf(':') + 1) : trimmed;
      return suffix.trim();
    })
    .filter(Boolean)
    .join('/');
}

function buildSharedMaterialId(assetId: string, materialName: string): string {
  return `sharedmat_${sanitizeSharedMaterialIdPart(assetId)}_${sanitizeSharedMaterialIdPart(materialName)}`;
}

function findSharedMaterialIndex(
  materials: SceneSharedMaterialConfig[],
  assetId: string,
  materialName: string,
): number {
  return materials.findIndex((entry) => entry.assetId === assetId && entry.materialName === materialName);
}

function getSharedMaterialSnapshot(
  sceneConfig: SceneConfig,
  assetId: string,
  materialName: string,
): MaterialSnapshot {
  const materials = ensureSceneMaterials(sceneConfig);
  const index = findSharedMaterialIndex(materials, assetId, materialName);
  if (index < 0) return null;
  return cloneMaterialSnapshot(materials[index].properties);
}

function setSharedMaterialSnapshot(
  sceneConfig: SceneConfig,
  assetId: string,
  materialName: string,
  materialType: string | null,
  snapshot: MaterialSnapshot,
): void {
  const materials = ensureSceneMaterials(sceneConfig);
  const normalized = pruneMaterialSnapshot(snapshot);
  const index = findSharedMaterialIndex(materials, assetId, materialName);

  if (!normalized) {
    if (index >= 0) {
      materials.splice(index, 1);
    }
    return;
  }

  const nextEntry: SceneSharedMaterialConfig = {
    id: index >= 0 ? materials[index].id : buildSharedMaterialId(assetId, materialName),
    assetId,
    materialName,
    ...(materialType ? { type: materialType } : {}),
    properties: cloneJson(normalized),
  };

  if (index >= 0) {
    materials[index] = nextEntry;
    return;
  }
  materials.push(nextEntry);
}

function shouldStoreMaterialChangeAsShared(
  sceneConfig: SceneConfig,
  sceneNode: SceneInstanceNode,
  change: CanonicalMaterialChange,
): boolean {
  const asset = getSceneAsset(sceneConfig, sceneNode.instance.assetId);
  if (!asset || asset.materialMode === 'instance') return false;
  const existingOverride = getMaterialSnapshot(sceneNode, change.target, change.ownerNodePath);
  return !existingOverride;
}

function getMaterialSnapshot(
  sceneNode: SceneInstanceNode,
  target: MaterialTarget,
  ownerNodePath: string,
): MaterialSnapshot {
  if (target === 'root') {
    return sceneNode.overrides?.material ? cloneMaterialSnapshot(sceneNode.overrides.material) : null;
  }
  return sceneNode.overrides?.childMaterials?.[ownerNodePath]
    ? cloneMaterialSnapshot(sceneNode.overrides.childMaterials[ownerNodePath])
    : null;
}

function getOutlineSnapshot(
  sceneNode: SceneInstanceNode,
  target: OutlineTarget,
  ownerNodePath: string,
): OutlineSnapshot {
  if (target === 'root') {
    return sceneNode.overrides?.outline ? cloneOutlineSnapshot(sceneNode.overrides.outline) : null;
  }
  return sceneNode.overrides?.childOutlines?.[ownerNodePath]
    ? cloneOutlineSnapshot(sceneNode.overrides.childOutlines[ownerNodePath])
    : null;
}

function getSharedOutlineSnapshot(
  sceneConfig: SceneConfig,
  assetId: string,
  target: OutlineTarget,
  ownerNodePath: string,
): OutlineSnapshot {
  const asset = getSceneAsset(sceneConfig, assetId);
  if (!asset?.defaults) return null;
  if (target === 'root') {
    return asset.defaults.outline ? cloneOutlineSnapshot(asset.defaults.outline) : null;
  }
  return asset.defaults.childOutlines?.[ownerNodePath]
    ? cloneOutlineSnapshot(asset.defaults.childOutlines[ownerNodePath])
    : null;
}

function setMaterialSnapshot(
  sceneNode: SceneInstanceNode,
  target: MaterialTarget,
  ownerNodePath: string,
  snapshot: MaterialSnapshot,
): void {
  const normalized = pruneMaterialSnapshot(snapshot);
  if (target === 'root') {
    if (normalized) {
      ensureSceneNodeOverrides(sceneNode).material = cloneJson(normalized);
    } else if (sceneNode.overrides?.material) {
      delete sceneNode.overrides.material;
      cleanupSceneNodeOverrides(sceneNode);
    }
    return;
  }

  if (!normalized) {
    if (sceneNode.overrides?.childMaterials?.[ownerNodePath]) {
      delete sceneNode.overrides.childMaterials[ownerNodePath];
      cleanupSceneNodeOverrides(sceneNode);
    }
    return;
  }

  ensureChildMaterials(sceneNode)[ownerNodePath] = cloneJson(normalized);
}

function setOutlineSnapshot(
  sceneNode: SceneInstanceNode,
  target: OutlineTarget,
  ownerNodePath: string,
  snapshot: OutlineSnapshot,
): void {
  const normalized = pruneOutlineSnapshot(snapshot);
  if (target === 'root') {
    if (normalized) {
      ensureSceneNodeOverrides(sceneNode).outline = cloneJson(normalized);
    } else if (sceneNode.overrides?.outline) {
      delete sceneNode.overrides.outline;
      cleanupSceneNodeOverrides(sceneNode);
    }
    return;
  }

  if (!normalized) {
    if (sceneNode.overrides?.childOutlines?.[ownerNodePath]) {
      delete sceneNode.overrides.childOutlines[ownerNodePath];
      cleanupSceneNodeOverrides(sceneNode);
    }
    return;
  }

  ensureChildOutlines(sceneNode)[ownerNodePath] = cloneJson(normalized);
}

function setSharedOutlineSnapshot(
  sceneConfig: SceneConfig,
  assetId: string,
  target: OutlineTarget,
  ownerNodePath: string,
  snapshot: OutlineSnapshot,
): void {
  const asset = getSceneAsset(sceneConfig, assetId);
  if (!asset) return;
  const defaults = ensureSceneAssetDefaults(asset);
  const normalized = pruneOutlineSnapshot(snapshot);

  if (target === 'root') {
    if (normalized) {
      defaults.outline = cloneJson(normalized);
    } else {
      delete defaults.outline;
    }
  } else if (!normalized) {
    if (defaults.childOutlines?.[ownerNodePath]) {
      delete defaults.childOutlines[ownerNodePath];
      if (defaults.childOutlines && Object.keys(defaults.childOutlines).length === 0) {
        delete defaults.childOutlines;
      }
    }
  } else {
    if (!defaults.childOutlines || typeof defaults.childOutlines !== 'object') {
      defaults.childOutlines = {};
    }
    defaults.childOutlines[ownerNodePath] = cloneJson(normalized);
  }

  if (!defaults.transform && !defaults.outline && !defaults.childOutlines) {
    delete asset.defaults;
  }
}

function clearSceneNodeOutlineSnapshot(
  sceneNode: SceneInstanceNode,
  target: OutlineTarget,
  ownerNodePath: string,
): void {
  setOutlineSnapshot(sceneNode, target, ownerNodePath, null);
}

function clearSharedOutlineOverridesForAsset(
  sceneConfig: SceneConfig,
  assetId: string,
  target: OutlineTarget,
  ownerNodePath: string,
): void {
  for (const node of ensureSceneNodes(sceneConfig)) {
    if (node.kind !== 'instance' || node.instance.assetId !== assetId) continue;
    clearSceneNodeOutlineSnapshot(node, target, ownerNodePath);
  }
}

function applyMaterialPropToSnapshot(
  snapshot: MaterialOverrideConfig,
  prop: ProjectMaterialProp,
  value: ProjectMaterialValue,
): void {
  switch (prop) {
    case 'material.albedoColor':
      if (value == null) {
        delete snapshot.albedoColor;
        delete snapshot.diffuseColor;
        return;
      }
      snapshot.albedoColor = cloneJson(value as ColorRGB);
      delete snapshot.diffuseColor;
      return;
    case 'material.emissiveColor':
      if (value == null) {
        delete snapshot.emissiveColor;
        return;
      }
      snapshot.emissiveColor = cloneJson(value as ColorRGB);
      return;
    case 'material.metallic':
      if (value == null) {
        delete snapshot.metallic;
        return;
      }
      snapshot.metallic = value as number;
      return;
    case 'material.roughness':
      if (value == null) {
        delete snapshot.roughness;
        return;
      }
      snapshot.roughness = value as number;
      return;
    case 'material.alpha':
      if (value == null) {
        delete snapshot.alpha;
        return;
      }
      snapshot.alpha = value as number;
      return;
    case 'material.backFaceCulling':
      if (value == null) {
        delete snapshot.backFaceCulling;
        return;
      }
      snapshot.backFaceCulling = value as boolean;
      return;
    case 'material.albedoTexture.url':
      if (value == null) {
        delete snapshot.albedoTexture;
        return;
      }
      snapshot.albedoTexture = { url: value as string };
      return;
    case 'material.normalTexture.url':
      if (value == null) {
        delete snapshot.normalTexture;
        return;
      }
      snapshot.normalTexture = { url: value as string };
      return;
    case 'material.metallicTexture.url':
      if (value == null) {
        delete snapshot.metallicTexture;
        return;
      }
      snapshot.metallicTexture = { url: value as string };
      return;
    default:
      return;
  }
}

function applyOutlinePropToSnapshot(
  snapshot: OutlineOverrideConfig,
  prop: ProjectOutlineProp,
  value: ProjectOutlineValue,
): void {
  switch (prop) {
    case 'outline.renderOutline':
      if (value == null) {
        delete snapshot.renderOutline;
        return;
      }
      snapshot.renderOutline = !!value;
      return;
    case 'outline.outlineWidth':
      if (value == null) {
        delete snapshot.outlineWidth;
        return;
      }
      if (typeof value === 'number' && Number.isFinite(value)) {
        snapshot.outlineWidth = value;
      }
      return;
    case 'outline.outlineColor':
      if (value == null) {
        delete snapshot.outlineColor;
        return;
      }
      snapshot.outlineColor = cloneJson(value as ColorRGB);
      return;
    default:
      return;
  }
}

function findSceneNodeLocation(
  sceneConfig: SceneConfig,
  nodeId: string,
): ProjectDocumentBindingLocation | null {
  const sceneNodes = ensureSceneNodes(sceneConfig);
  const nodeIndex = sceneNodes.findIndex(
    (node) =>
      node.id === nodeId &&
      (node.kind === 'group' || node.kind === 'instance' || node.kind === 'transform'),
  );
  if (nodeIndex < 0) return null;
  const value = sceneNodes[nodeIndex];
  if (value.kind !== 'group' && value.kind !== 'instance' && value.kind !== 'transform') return null;
  return {
    kind: 'sceneNode',
    nodeId,
    path: `scene.nodes[${nodeIndex}]`,
    pathSegments: ['scene', 'nodes', nodeIndex],
    value,
  };
}

export function resolveProjectDocumentBindingLocation(
  binding: ProjectPersistentBindingSnapshot | ProjectPersistentBinding,
): ProjectDocumentBindingLocation | null {
  const sceneConfig = requireWorkingCopy();
  return findSceneNodeLocation(sceneConfig, binding.nodeId);
}

export function loadProjectEditorDocument(sceneConfig: SceneConfig = configService.getSceneConfig()): ProjectEditorDocumentState {
  const original = cloneSceneConfig(sceneConfig);
  const workingCopy = cloneSceneConfig(sceneConfig);
  documentState.original = original;
  documentState.workingCopy = workingCopy;
  originalSnapshot = snapshotSceneConfig(original);
  clearProjectEditorHistory();
  return documentState;
}

export function ensureProjectEditorDocumentLoaded(): ProjectEditorDocumentState {
  if (documentState.original && documentState.workingCopy) return documentState;
  return loadProjectEditorDocument();
}

export function getProjectEditorDocumentState(): ProjectEditorDocumentState {
  return ensureProjectEditorDocumentLoaded();
}

export function getProjectEditorOriginalDocument(): SceneConfig {
  return ensureProjectEditorDocumentLoaded().original as SceneConfig;
}

export function getProjectEditorWorkingDocument(): SceneConfig {
  return requireWorkingCopy();
}

export function resetProjectEditorDocument(): ProjectEditorDocumentState {
  const source = documentState.original ?? configService.getSceneConfig();
  return loadProjectEditorDocument(source);
}

export function isProjectEditorDocumentDirty(): boolean {
  return originalSnapshot !== snapshotSceneConfig(requireWorkingCopy());
}

export function exportProjectEditorDocument(): ProjectEditorDocumentExport {
  const workingCopy = getProjectEditorWorkingDocument();
  const sceneJsonText = `${JSON.stringify(workingCopy, null, 2)}\n`;
  const scene = (workingCopy as any).scene;
  logDocument('export scene json text', {
    dirty: isProjectEditorDocumentDirty(),
    sceneJsonTextLength: sceneJsonText.length,
    nodeCount: Array.isArray(scene?.nodes) ? scene.nodes.length : null,
    materialCount: Array.isArray(scene?.materials) ? scene.materials.length : null,
  });
  return {
    sceneJsonText,
  };
}

export function commitProjectEditorDocumentSave(
  args: ProjectEditorDocumentCommitArgs = {},
  context?: ProjectEditorPluginContext,
): boolean {
  const workingCopy = getProjectEditorWorkingDocument();
  logDocument('commit save requested', {
    dirtyBeforeCommit: isProjectEditorDocumentDirty(),
    version: typeof args.version === 'number' ? args.version : null,
    updatedAt: typeof args.updatedAt === 'string' ? args.updatedAt : null,
    scenePath: typeof args.scenePath === 'string' ? args.scenePath : null,
    hasReturnedSceneJsonText: typeof args.sceneJsonText === 'string',
    returnedSceneJsonTextLength: typeof args.sceneJsonText === 'string' ? args.sceneJsonText.length : 0,
  });
  if (!validatePlatformSavedSceneJsonText(workingCopy, args.sceneJsonText)) {
    logDocument('commit save rejected: platform saved scene json validation failed', {
      dirtyAfterRejectedCommit: isProjectEditorDocumentDirty(),
    });
    return false;
  }
  const next = cloneSceneConfig(workingCopy);
  documentState.original = cloneSceneConfig(next);
  documentState.workingCopy = cloneSceneConfig(next);
  originalSnapshot = snapshotSceneConfig(documentState.original);
  clearProjectEditorHistory();
  configService.replaceSceneConfig(cloneSceneConfig(next));
  const game = context?.game as any;
  if (game && typeof game.onEditorDocumentCommitted === 'function') {
    game.onEditorDocumentCommitted(cloneSceneConfig(next), args);
  }
  const scene = (next as any).scene;
  logDocument('commit save completed', {
    dirtyAfterCommit: isProjectEditorDocumentDirty(),
    historyCleared: true,
    nodeCount: Array.isArray(scene?.nodes) ? scene.nodes.length : null,
    materialCount: Array.isArray(scene?.materials) ? scene.materials.length : null,
  });
  return true;
}

export function canUndoProjectEditorDocumentChange(): boolean {
  return historyState.undoStack.length > 0;
}

export function canRedoProjectEditorDocumentChange(): boolean {
  return historyState.redoStack.length > 0;
}

export function beginProjectEditorTransformBatch(): void {
  if (historyState.activeTransformBatch) return;
  historyState.activeTransformBatch = [];
}

export function endProjectEditorTransformBatch(): void {
  const entries = historyState.activeTransformBatch;
  historyState.activeTransformBatch = null;
  if (!entries || entries.length === 0) return;
  if (entries.length === 1) {
    pushProjectEditorHistory(entries[0]);
    return;
  }
  pushProjectEditorHistory({
    kind: 'transformBatch',
    entries: entries.map(entry => cloneJson(entry)),
  });
}

function sameRuntimeNode(a: any, b: any): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const aId = a.uniqueId;
  const bId = b.uniqueId;
  return typeof aId === 'number' && typeof bId === 'number' && aId === bId;
}

function stableRuntimeNodeSegment(node: any): string | null {
  const candidates = [node?.name, node?.id];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function buildRuntimeOwnerNodePath(ownerNode: any, rootNode: any): string | null {
  if (!ownerNode || !rootNode || sameRuntimeNode(ownerNode, rootNode)) return '';

  const segments: string[] = [];
  let current: any = ownerNode;
  while (current && !sameRuntimeNode(current, rootNode)) {
    const segment = stableRuntimeNodeSegment(current);
    if (!segment) return null;
    segments.push(segment);
    current = current.parent ?? null;
  }

  if (!current || !sameRuntimeNode(current, rootNode)) return null;
  return segments.reverse().join('/');
}

function resolveTransformTarget(
  binding: ProjectPersistentBinding,
  node: any,
): { target: TransformTarget; ownerNodePath: string } | null {
  if (!node || sameRuntimeNode(node, binding.rootNode)) {
    return { target: 'root', ownerNodePath: '' };
  }

  const ownerNodePath = buildRuntimeOwnerNodePath(node, binding.rootNode);
  if (ownerNodePath == null || ownerNodePath === '') return null;
  return {
    target: 'childTransform',
    ownerNodePath,
  };
}

function applyTransformHistoryEntry(
  entry: ProjectEditorTransformHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  const location = resolveProjectDocumentBindingLocation(entry.binding);
  if (!location) return null;

  const workingCopy = requireWorkingCopy();
  const sceneNodes = ensureSceneNodes(workingCopy);
  const sceneNode = sceneNodes[location.pathSegments[2]];
  if (!sceneNode) return null;

  let transform: TransformConfig;
  let childTransformSceneNode: SceneInstanceNode | SceneTransformNode | null = null;
  if (entry.target === 'childTransform') {
    if (sceneNode.kind !== 'instance' && sceneNode.kind !== 'transform') return null;
    childTransformSceneNode = sceneNode;
    transform = ensureChildTransform(childTransformSceneNode, entry.ownerNodePath);
  } else {
    transform = ensureTransform(sceneNode);
  }
  const snapshot = direction === 'undo' ? entry.before : entry.after;
  const runtimeValue = cloneJson(direction === 'undo' ? entry.runtimeBefore : entry.runtimeAfter);
  applyTransformPropSnapshot(transform, entry.prop, snapshot);
  if (childTransformSceneNode) {
    cleanupChildTransform(childTransformSceneNode, entry.ownerNodePath);
  } else {
    cleanupTransformContainer(sceneNode);
  }

  const rootNode =
    context?.game && typeof context.game.getSceneNodeRuntime === 'function'
      ? context.game.getSceneNodeRuntime(entry.binding.nodeId)
      : null;
  const runtimeNode = entry.target === 'childTransform'
    ? resolveMaterialOwnerNode(rootNode, entry.ownerNodePath)
    : rootNode;
  if (runtimeNode) {
    applyRuntimeValue(runtimeNode, entry.prop, runtimeValue);
  }

  return {
    kind: 'transform',
    binding: entry.binding,
    prop: entry.prop,
    value: runtimeValue,
    rootNode: runtimeNode ?? undefined,
    selectedRootNode: rootNode ?? null,
  };
}

function applyMaterialHistoryEntry(
  entry: ProjectEditorMaterialHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  if (entry.storage === 'shared') {
    const workingCopy = requireWorkingCopy();
    const snapshot = direction === 'undo' ? entry.before : entry.after;
    const runtimeValue = cloneJson(direction === 'undo' ? entry.runtimeBefore : entry.runtimeAfter);
    setSharedMaterialSnapshot(workingCopy, entry.assetId, entry.materialName, entry.materialType, snapshot);

    const runtimeMaterial = typeof context?.scene?.getMaterialByName === 'function'
      ? context.scene.getMaterialByName(entry.materialName)
      : null;
    if (runtimeMaterial) {
      applyMaterialValueToRuntimeMaterial(runtimeMaterial, context?.scene ?? null, entry.prop, runtimeValue);
    }

    return {
      kind: 'material',
      binding: entry.binding,
      prop: entry.prop,
      value: runtimeValue,
      ownerNodePath: entry.ownerNodePath,
      selectedRootNode: null,
    };
  }

  const location = resolveProjectDocumentBindingLocation(entry.binding);
  if (!location || location.value.kind !== 'instance') return null;

  const workingCopy = requireWorkingCopy();
  const sceneNodes = ensureSceneNodes(workingCopy);
  const sceneNode = sceneNodes[location.pathSegments[2]];
  if (!sceneNode || sceneNode.kind !== 'instance') return null;

  const snapshot = direction === 'undo' ? entry.before : entry.after;
  const runtimeValue = cloneJson(direction === 'undo' ? entry.runtimeBefore : entry.runtimeAfter);
  setMaterialSnapshot(sceneNode, entry.target, entry.ownerNodePath, snapshot);

  const rootNode =
    context?.game && typeof context.game.getSceneNodeRuntime === 'function'
      ? context.game.getSceneNodeRuntime(entry.binding.nodeId)
      : null;
  const ownerNode = resolveMaterialOwnerNode(rootNode, entry.ownerNodePath);
  if (ownerNode) {
    applyMaterialValueToRuntimeNode(ownerNode, context?.scene ?? null, entry.prop, runtimeValue);
  }

  return {
    kind: 'material',
    binding: entry.binding,
    prop: entry.prop,
    value: runtimeValue,
    ownerNodePath: entry.ownerNodePath,
    rootNode: ownerNode ?? undefined,
    selectedRootNode: rootNode ?? null,
  };
}

function applyOutlineHistoryEntry(
  entry: ProjectEditorOutlineHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  if (entry.storage === 'shared') {
    const workingCopy = requireWorkingCopy();
    const snapshot = direction === 'undo' ? entry.before : entry.after;
    const runtimeValue = cloneJson(direction === 'undo' ? entry.runtimeBefore : entry.runtimeAfter);
    setSharedOutlineSnapshot(workingCopy, entry.assetId, entry.target, entry.ownerNodePath, snapshot);
    clearSharedOutlineOverridesForAsset(workingCopy, entry.assetId, entry.target, entry.ownerNodePath);

    if (context?.game && typeof context.game.getSceneNodeRuntime === 'function') {
      for (const node of ensureSceneNodes(workingCopy)) {
        if (node.kind !== 'instance' || node.instance.assetId !== entry.assetId) continue;
        const rootNode = context.game.getSceneNodeRuntime(node.id);
        const ownerNode = entry.ownerNodePath
          ? resolveMaterialOwnerNode(rootNode, entry.ownerNodePath)
          : resolveOutlineOwnerNode(rootNode).ownerNode;
        if (ownerNode) {
          applyOutlineValueToRuntimeNode(ownerNode, entry.prop, runtimeValue);
        }
      }
    }

    return {
      kind: 'outline',
      binding: entry.binding,
      prop: entry.prop,
      value: runtimeValue,
      ownerNodePath: entry.ownerNodePath,
      selectedRootNode: null,
    };
  }

  const location = resolveProjectDocumentBindingLocation(entry.binding);
  if (!location || location.value.kind !== 'instance') return null;

  const workingCopy = requireWorkingCopy();
  const sceneNodes = ensureSceneNodes(workingCopy);
  const sceneNode = sceneNodes[location.pathSegments[2]];
  if (!sceneNode || sceneNode.kind !== 'instance') return null;

  const snapshot = direction === 'undo' ? entry.before : entry.after;
  const runtimeValue = cloneJson(direction === 'undo' ? entry.runtimeBefore : entry.runtimeAfter);
  setOutlineSnapshot(sceneNode, entry.target, entry.ownerNodePath, snapshot);

  const rootNode =
    context?.game && typeof context.game.getSceneNodeRuntime === 'function'
      ? context.game.getSceneNodeRuntime(entry.binding.nodeId)
      : null;
  const ownerNode = entry.ownerNodePath
    ? resolveMaterialOwnerNode(rootNode, entry.ownerNodePath)
    : resolveOutlineOwnerNode(rootNode).ownerNode;
  if (ownerNode) {
    applyOutlineValueToRuntimeNode(ownerNode, entry.prop, runtimeValue);
  }

  return {
    kind: 'outline',
    binding: entry.binding,
    prop: entry.prop,
    value: runtimeValue,
    ownerNodePath: entry.ownerNodePath,
    rootNode: ownerNode ?? undefined,
    selectedRootNode: rootNode ?? null,
  };
}

function applyDuplicateHistoryEntry(
  entry: ProjectEditorDuplicateHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  logDocument('apply duplicate history entry', {
    direction,
    sourceNodeId: entry.sourceBinding.nodeId,
    createdNodeId: entry.createdBinding.nodeId,
    parentNodeName: entry.parentNodeName,
  });
  const workingCopy = requireWorkingCopy();

  if (direction === 'undo') {
    const undone = undoSceneNodeDuplicateEntry(entry, workingCopy, context);
    return {
      kind: 'selection',
      selectedRootNode: undone.selectedRootNode ?? null,
    };
  }

  const redone = redoSceneNodeDuplicateEntry(entry, workingCopy, context);
  if (!redone) return null;

  return {
    kind: 'selection',
    selectedRootNode: redone.selectedRootNode ?? null,
  };
}

function applyTransformBatchHistoryEntry(
  entry: ProjectEditorTransformBatchHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  const ordered = direction === 'undo'
    ? [...entry.entries].reverse()
    : entry.entries;
  let selectedRootNode: any | null = null;

  for (const item of ordered) {
    const applied = applyTransformHistoryEntry(item, direction, context);
    if (applied?.kind === 'transform' && applied.rootNode) {
      selectedRootNode = applied.rootNode;
    } else if (applied?.selectedRootNode) {
      selectedRootNode = applied.selectedRootNode;
    }
  }

  return {
    kind: 'selection',
    selectedRootNode,
  };
}

function applyHistoryEntry(
  entry: ProjectEditorHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  if (entry.kind === 'duplicate') {
    return applyDuplicateHistoryEntry(entry, direction, context);
  }
  if (entry.kind === 'material') {
    return applyMaterialHistoryEntry(entry, direction, context);
  }
  if (entry.kind === 'outline') {
    return applyOutlineHistoryEntry(entry, direction, context);
  }
  if (entry.kind === 'transformBatch') {
    return applyTransformBatchHistoryEntry(entry, direction, context);
  }
  return applyTransformHistoryEntry(entry, direction, context);
}

export function undoProjectEditorDocumentChange(context?: ProjectEditorPluginContext): ProjectEditorRuntimeChange | null {
  const entry = historyState.undoStack.pop();
  if (!entry) {
    logDocument('undo requested but stack empty', {
      undoDepth: historyState.undoStack.length,
      redoDepth: historyState.redoStack.length,
    });
    return null;
  }
  historyState.redoStack.push(entry);
  logDocument('undo popped history entry', {
    entryKind: entry.kind,
    undoDepth: historyState.undoStack.length,
    redoDepth: historyState.redoStack.length,
  });
  return applyHistoryEntry(entry, 'undo', context);
}

export function redoProjectEditorDocumentChange(context?: ProjectEditorPluginContext): ProjectEditorRuntimeChange | null {
  const entry = historyState.redoStack.pop();
  if (!entry) {
    logDocument('redo requested but stack empty', {
      undoDepth: historyState.undoStack.length,
      redoDepth: historyState.redoStack.length,
    });
    return null;
  }
  historyState.undoStack.push(entry);
  logDocument('redo popped history entry', {
    entryKind: entry.kind,
    undoDepth: historyState.undoStack.length,
    redoDepth: historyState.redoStack.length,
  });
  return applyHistoryEntry(entry, 'redo', context);
}

export function applyProjectDocumentChange(
  binding: ProjectPersistentBinding,
  node: any,
  prop: string,
  oldValue?: unknown,
  newValue?: unknown,
): boolean {
  if (binding.kind !== 'sceneNode') return false;
  if (prop !== 'position' && prop !== 'rotation' && prop !== 'scaling') return false;

  const runtimeProp = prop as ProjectRuntimeProp;
  const runtimeBefore = readRuntimeValue(runtimeProp, oldValue);
  const runtimeAfter = readRuntimeValue(runtimeProp, newValue);
  if (!runtimeBefore || !runtimeAfter) return false;

  const location = resolveProjectDocumentBindingLocation(binding);
  if (!location) return false;
  const workingCopy = requireWorkingCopy();
  const sceneNodes = ensureSceneNodes(workingCopy);
  const sceneNode = sceneNodes[location.pathSegments[2]];
  if (!sceneNode) return false;

  const transformTarget = resolveTransformTarget(binding, node);
  if (!transformTarget) {
    logDocument('skip transform document change: unresolved target', {
      bindingNodeId: binding.nodeId,
      prop: runtimeProp,
      selectedNodeName: typeof node?.name === 'string' ? node.name : null,
      selectedNodeId: typeof node?.id === 'string' ? node.id : null,
    });
    return false;
  }

  let transform: TransformConfig;
  let childTransformSceneNode: SceneInstanceNode | SceneTransformNode | null = null;
  if (transformTarget.target === 'childTransform') {
    if (sceneNode.kind !== 'instance' && sceneNode.kind !== 'transform') return false;
    childTransformSceneNode = sceneNode;
    transform = ensureChildTransform(childTransformSceneNode, transformTarget.ownerNodePath);
  } else {
    transform = ensureTransform(sceneNode);
  }
  const beforeSnapshot = getTransformPropSnapshot(transform, runtimeProp);
  const afterSnapshot = toTransformSnapshot(runtimeProp, runtimeAfter);
  if (sameSnapshot(beforeSnapshot, afterSnapshot)) return false;

  applyTransformPropSnapshot(transform, runtimeProp, afterSnapshot);
  if (childTransformSceneNode) {
    cleanupChildTransform(childTransformSceneNode, transformTarget.ownerNodePath);
  } else {
    cleanupTransformContainer(sceneNode);
  }
  pushProjectEditorTransformHistory({
    kind: 'transform',
    binding: toBindingSnapshot(binding),
    prop: runtimeProp,
    target: transformTarget.target,
    ownerNodePath: transformTarget.ownerNodePath,
    before: beforeSnapshot,
    after: afterSnapshot,
    runtimeBefore: cloneJson(runtimeBefore),
    runtimeAfter: cloneJson(runtimeAfter),
  });
  logDocument('transform history pushed', {
    bindingNodeId: binding.nodeId,
    target: transformTarget.target,
    ownerNodePath: transformTarget.ownerNodePath,
    prop: runtimeProp,
    before: beforeSnapshot,
    after: afterSnapshot,
    undoDepth: historyState.undoStack.length,
    redoDepth: historyState.redoStack.length,
  });
  return true;
}

export function applyProjectMaterialDocumentChange(change: CanonicalMaterialChange): boolean {
  if (change.binding.kind !== 'sceneNode') return false;

  const location = resolveProjectDocumentBindingLocation(change.binding);
  if (!location || location.value.kind !== 'instance') {
    logDocument('skip material document change for non-instance binding', {
      bindingKind: change.binding.kind,
      bindingNodeId: change.binding.nodeId,
      target: change.target,
      ownerNodePath: change.ownerNodePath,
      prop: change.path,
      locationKind: location?.value.kind ?? null,
    });
    return false;
  }

  const workingCopy = requireWorkingCopy();
  const sceneNodes = ensureSceneNodes(workingCopy);
  const sceneNode = sceneNodes[location.pathSegments[2]];
  if (!sceneNode || sceneNode.kind !== 'instance') return false;

  const storage = shouldStoreMaterialChangeAsShared(workingCopy, sceneNode, change) ? 'shared' : 'override';
  const assetId = sceneNode.instance.assetId;

  if (storage === 'shared') {
    const beforeSnapshot = getSharedMaterialSnapshot(workingCopy, assetId, change.materialName);
    const afterSnapshot = cloneMaterialSnapshot(beforeSnapshot) ?? {};
    applyMaterialPropToSnapshot(afterSnapshot, change.path, change.after);
    const normalizedAfterSnapshot = pruneMaterialSnapshot(afterSnapshot);
    if (sameSnapshot(beforeSnapshot, normalizedAfterSnapshot)) return false;

    setSharedMaterialSnapshot(workingCopy, assetId, change.materialName, change.materialType, normalizedAfterSnapshot);
    const entry: ProjectEditorMaterialHistoryEntry = {
      kind: 'material',
      storage: 'shared',
      assetId,
      materialName: change.materialName,
      materialType: change.materialType,
      binding: toBindingSnapshot(change.binding),
      prop: change.path,
      target: change.target,
      ownerNodePath: change.ownerNodePath,
      before: beforeSnapshot,
      after: normalizedAfterSnapshot,
      runtimeBefore: cloneJson(change.before),
      runtimeAfter: cloneJson(change.after),
    };
    pushProjectEditorHistory(entry);
    logDocument('shared material history pushed', {
      assetId,
      materialName: change.materialName,
      prop: entry.prop,
      undoDepth: historyState.undoStack.length,
      redoDepth: historyState.redoStack.length,
    });
    return true;
  }

  const beforeSnapshot = getMaterialSnapshot(sceneNode, change.target, change.ownerNodePath);
  const afterSnapshot = cloneMaterialSnapshot(beforeSnapshot) ?? {};
  applyMaterialPropToSnapshot(afterSnapshot, change.path, change.after);
  const normalizedAfterSnapshot = pruneMaterialSnapshot(afterSnapshot);
  if (sameSnapshot(beforeSnapshot, normalizedAfterSnapshot)) return false;

  setMaterialSnapshot(sceneNode, change.target, change.ownerNodePath, normalizedAfterSnapshot);
  const entry: ProjectEditorMaterialHistoryEntry = {
    kind: 'material',
    storage: 'override',
    assetId,
    materialName: change.materialName,
    materialType: change.materialType,
    binding: toBindingSnapshot(change.binding),
    prop: change.path,
    target: change.target,
    ownerNodePath: change.ownerNodePath,
    before: beforeSnapshot,
    after: normalizedAfterSnapshot,
    runtimeBefore: cloneJson(change.before),
    runtimeAfter: cloneJson(change.after),
  };
  pushProjectEditorHistory(entry);
  logDocument('material history pushed', {
    bindingNodeId: entry.binding.nodeId,
    target: entry.target,
    ownerNodePath: entry.ownerNodePath,
    prop: entry.prop,
    undoDepth: historyState.undoStack.length,
    redoDepth: historyState.redoStack.length,
  });
  return true;
}

export function applyProjectOutlineDocumentChange(change: CanonicalOutlineChange): boolean {
  if (change.binding.kind !== 'sceneNode') return false;

  const location = resolveProjectDocumentBindingLocation(change.binding);
  if (!location || location.value.kind !== 'instance') {
    logDocument('skip outline document change for non-instance binding', {
      bindingKind: change.binding.kind,
      bindingNodeId: change.binding.nodeId,
      target: change.target,
      ownerNodePath: change.ownerNodePath,
      prop: change.path,
      locationKind: location?.value.kind ?? null,
    });
    return false;
  }

  const workingCopy = requireWorkingCopy();
  const sceneNodes = ensureSceneNodes(workingCopy);
  const sceneNode = sceneNodes[location.pathSegments[2]];
  if (!sceneNode || sceneNode.kind !== 'instance') return false;

  const assetId = sceneNode.instance.assetId;
  if (change.shared) {
    const sharedOwnerNodePath = normalizeSharedOwnerNodePath(change.ownerNodePath);
    const beforeSnapshot = getSharedOutlineSnapshot(workingCopy, assetId, change.target, sharedOwnerNodePath);
    const afterSnapshot = cloneOutlineSnapshot(beforeSnapshot) ?? {};
    applyOutlinePropToSnapshot(afterSnapshot, change.path, change.after);
    const normalizedAfterSnapshot = pruneOutlineSnapshot(afterSnapshot);
    if (sameSnapshot(beforeSnapshot, normalizedAfterSnapshot)) return false;

    if (sharedOwnerNodePath !== change.ownerNodePath) {
      setSharedOutlineSnapshot(workingCopy, assetId, change.target, change.ownerNodePath, null);
    }
    setSharedOutlineSnapshot(workingCopy, assetId, change.target, sharedOwnerNodePath, normalizedAfterSnapshot);
    clearSharedOutlineOverridesForAsset(workingCopy, assetId, change.target, sharedOwnerNodePath);
    const entry: ProjectEditorOutlineHistoryEntry = {
      kind: 'outline',
      storage: 'shared',
      assetId,
      binding: toBindingSnapshot(change.binding),
      prop: change.path,
      target: change.target,
      ownerNodePath: sharedOwnerNodePath,
      before: beforeSnapshot,
      after: normalizedAfterSnapshot,
      runtimeBefore: cloneJson(change.before),
      runtimeAfter: cloneJson(change.after),
    };
    pushProjectEditorHistory(entry);
    logDocument('shared outline history pushed', {
      assetId,
      target: entry.target,
      ownerNodePath: entry.ownerNodePath,
      prop: entry.prop,
      undoDepth: historyState.undoStack.length,
      redoDepth: historyState.redoStack.length,
    });
    return true;
  }

  const beforeSnapshot = getOutlineSnapshot(sceneNode, change.target, change.ownerNodePath);
  const afterSnapshot = cloneOutlineSnapshot(beforeSnapshot) ?? {};
  applyOutlinePropToSnapshot(afterSnapshot, change.path, change.after);
  const normalizedAfterSnapshot = pruneOutlineSnapshot(afterSnapshot);
  if (sameSnapshot(beforeSnapshot, normalizedAfterSnapshot)) return false;

  setOutlineSnapshot(sceneNode, change.target, change.ownerNodePath, normalizedAfterSnapshot);
  const entry: ProjectEditorOutlineHistoryEntry = {
    kind: 'outline',
    storage: 'override',
    assetId,
    binding: toBindingSnapshot(change.binding),
    prop: change.path,
    target: change.target,
    ownerNodePath: change.ownerNodePath,
    before: beforeSnapshot,
    after: normalizedAfterSnapshot,
    runtimeBefore: cloneJson(change.before),
    runtimeAfter: cloneJson(change.after),
  };
  pushProjectEditorHistory(entry);
  logDocument('outline history pushed', {
    bindingNodeId: entry.binding.nodeId,
    target: entry.target,
    ownerNodePath: entry.ownerNodePath,
    prop: entry.prop,
    undoDepth: historyState.undoStack.length,
    redoDepth: historyState.redoStack.length,
  });
  return true;
}

export function duplicateProjectEditorSelection(
  binding: ProjectPersistentBinding,
  node: any,
  context?: ProjectEditorPluginContext,
): ProjectEditorDuplicateResult | null {
  const workingCopy = requireWorkingCopy();
  const entry = createSceneNodeDuplicateEntry({
    binding,
    node,
    workingCopy,
  });
  if (!entry) return null;

  logDocument('create duplicate history entry', {
    sourceNodeId: entry.sourceBinding.nodeId,
    createdNodeId: entry.createdBinding.nodeId,
    parentNodeName: entry.parentNodeName,
    insertIndex: entry.insertIndex,
  });

  const applied = applySceneNodeDuplicateEntry(entry, workingCopy, context, node);
  if (!applied) return null;

  pushProjectEditorHistory({
    kind: 'duplicate',
    ...cloneJson(entry),
  });

  logDocument('duplicate history pushed', {
    createdNodeId: entry.createdBinding.nodeId,
    parentNodeName: entry.parentNodeName,
    undoDepth: historyState.undoStack.length,
    redoDepth: historyState.redoStack.length,
  });

  return { rootNode: applied.rootNode };
}
