import { configService } from '../config';
import { ASSET_CATALOG, isModelAssetRegistered } from '../assets';
import { validateSceneJsonV2 } from '../config/SceneJsonV2Validator';
import sceneJsonV2Rules from '../config/scene-json-v2-rules.json';
import type {
  CanonicalMaterialChange,
  CanonicalOutlineChange,
} from '@fps-games/editor-babylon';
import {
  applyMaterialValueToRuntimeMaterial,
  applyMaterialValueToRuntimeNode,
  applyOutlineValueToRuntimeNode,
  resolveMaterialOwnerNode,
  resolveOutlineOwnerNode,
} from '@fps-games/editor-babylon';

import type {
  ColorRGB,
  MaterialOverrideConfig,
  OutlineOverrideConfig,
  Position3D,
  Scale3D,
  SceneConfig,
  SceneAssetConfig,
  SceneCameraRigConfig,
  SceneDirectionalLightConfig,
  SceneGroupNode,
  SceneInstanceNode,
  SceneNodeConfig,
  ScenePrimitiveNode,
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
  ProjectMaterialRuntimeKind,
  ProjectMaterialValue,
  ProjectOutlineProp,
  ProjectOutlineValue,
  ProjectEditorRuntimeChange,
  ProjectPersistentBinding,
  ProjectPersistentBindingSnapshot,
  ProjectRotation3D,
  ProjectRuntimeProp,
} from './types';
import {
  applySceneNodeDuplicateEntry,
  createSceneNodeDuplicateEntry,
  redoSceneNodeDuplicateEntry,
  type SceneNodeDuplicateCommandEntry,
  undoSceneNodeDuplicateEntry,
} from './scene-node-duplicate';
import {
  resolveSceneNodeFieldSchema,
  type SceneNodeFieldPatch,
} from './scene-node-field-schema';

// Legacy document state for the Forge Play bridge runtime-scene editing path.
// New independent EditorWorld edits should go through @fps-games/editor-core
// EditorSession and project SceneDocument adapters instead.
export const PROJECT_EDITOR_SCENE_NODE_ERROR_CODES = sceneJsonV2Rules.errorCodes;
export type ProjectEditorSceneNodeErrorCode = typeof PROJECT_EDITOR_SCENE_NODE_ERROR_CODES[keyof typeof PROJECT_EDITOR_SCENE_NODE_ERROR_CODES];

export class ProjectEditorSceneNodeError extends Error {
  constructor(
    readonly code: ProjectEditorSceneNodeErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ProjectEditorSceneNodeError';
  }
}

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
  storage: 'override' | 'shared' | 'nodeMaterial';
  assetId?: string;
  nodeId?: string;
  materialName: string;
  materialType: string | null;
  materialRuntimeKind: ProjectMaterialRuntimeKind;
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

type ProjectEditorAddNodeHistoryEntry = {
  kind: 'addNode';
  binding: ProjectPersistentBindingSnapshot;
  asset: SceneAssetConfig;
  assetInserted: boolean;
  assetIndex: number;
  node: SceneInstanceNode;
  insertIndex: number;
};

type ProjectEditorRemoveNodeHistoryEntry = {
  kind: 'removeNode';
  binding: ProjectPersistentBindingSnapshot;
  node: SceneNodeConfig;
  removeIndex: number;
  removedAsset?: SceneAssetConfig;
  removedAssetIndex?: number;
  removedNodes?: Array<{ node: SceneNodeConfig; removeIndex: number }>;
  removedAssets?: Array<{ asset: SceneAssetConfig; assetIndex: number }>;
};

type ProjectEditorAddSceneNodeHistoryEntry = {
  kind: 'addSceneNode';
  binding: ProjectPersistentBindingSnapshot;
  node: SceneNodeConfig;
  insertIndex: number;
};

type ProjectEditorPatchSceneNodeHistoryEntry = {
  kind: 'patchSceneNode';
  binding: ProjectPersistentBindingSnapshot;
  before: SceneNodeConfig;
  after: SceneNodeConfig;
  nodeIndex: number;
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
  | ProjectEditorDuplicateHistoryEntry
  | ProjectEditorAddNodeHistoryEntry
  | ProjectEditorRemoveNodeHistoryEntry
  | ProjectEditorAddSceneNodeHistoryEntry
  | ProjectEditorPatchSceneNodeHistoryEntry;

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

function isSharedAssetMaterialEntry(entry: SceneSharedMaterialConfig): boolean {
  return entry.scope === 'sharedAsset' || (!!entry.assetId && !entry.nodeId);
}

function isNodeMaterialEntry(entry: SceneSharedMaterialConfig): boolean {
  return entry.scope === 'nodeMaterial' || (!!entry.nodeId && !entry.assetId);
}

function getSceneAsset(sceneConfig: SceneConfig, assetId: string): SceneAssetConfig | null {
  const scene = ensureSceneSection(sceneConfig);
  return scene.assets.find((asset) => asset.id === assetId) ?? null;
}

function getSceneBuilder(context?: ProjectEditorPluginContext): any | null {
  const game = context?.game as any;
  return game?.getSceneBuilder?.() ?? game?.sceneBuilder ?? null;
}

function addRuntimeSceneNode(
  node: SceneNodeConfig,
  asset?: SceneAssetConfig | null,
  context?: ProjectEditorPluginContext,
): any | null {
  const sceneBuilder = getSceneBuilder(context);
  if (!sceneBuilder?.addSceneNodeFromConfig) return null;
  if (asset) sceneBuilder.upsertSceneAssetConfig?.(cloneJson(asset));
  return sceneBuilder.addSceneNodeFromConfig(cloneJson(node), null);
}

function removeRuntimeSceneNode(nodeId: string, context?: ProjectEditorPluginContext): boolean {
  const sceneBuilder = getSceneBuilder(context);
  return sceneBuilder?.removeSceneNode?.(nodeId) ?? false;
}

function isAssetReferenced(sceneConfig: SceneConfig, assetId: string): boolean {
  return ensureSceneNodes(sceneConfig).some((node) => node.kind === 'instance' && node.instance.assetId === assetId);
}

function isAssetManagerOwnedAsset(asset: SceneAssetConfig | null | undefined): boolean {
  const metadata = sceneJsonV2Rules.assetManagerMetadata;
  return asset?.metadata?.[metadata.key] === metadata.value;
}

function collectSceneNodeDescendantIds(sceneNodes: SceneNodeConfig[], nodeId: string): Set<string> {
  const ids = new Set<string>([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of sceneNodes) {
      if (ids.has(node.id)) continue;
      if (node.parentId && ids.has(node.parentId)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }
  return ids;
}

function validateProjectEditorSceneJson(sceneConfig: SceneConfig, phase: string): boolean {
  const errors = validateSceneJsonV2(sceneConfig, {
    allowOrphanSharedMaterials: true,
    allowOrphanNodeMaterials: true,
  });
  if (errors.length === 0) return true;
  logDocument('scene json v2 validation failed', {
    phase,
    errors: errors.slice(0, 20),
    errorCount: errors.length,
  });
  return false;
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
  for (const lightingKey of ['pbr', 'standard'] as const) {
    const lightingValue = next[lightingKey];
    if (lightingValue && typeof lightingValue === 'object' && isEmptyObject(lightingValue)) {
      delete next[lightingKey];
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

  const material = pruneMaterialSnapshot(overrides.material ?? null);
  if (material) overrides.material = material;
  else delete overrides.material;

  for (const [key, childMaterial] of Object.entries(overrides.childMaterials ?? {})) {
    const normalized = pruneMaterialSnapshot(childMaterial);
    if (normalized) overrides.childMaterials![key] = normalized;
    else delete overrides.childMaterials![key];
  }
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

function ensurePbrMaterialLightingSnapshot(value: MaterialOverrideConfig): NonNullable<MaterialOverrideConfig['pbr']> {
  if (!value.pbr || typeof value.pbr !== 'object') {
    value.pbr = {};
  }
  return value.pbr;
}

function ensureStandardMaterialLightingSnapshot(
  value: MaterialOverrideConfig,
): NonNullable<MaterialOverrideConfig['standard']> {
  if (!value.standard || typeof value.standard !== 'object') {
    value.standard = {};
  }
  return value.standard;
}

function alignMaterialSnapshotToRuntimeKind(
  snapshot: MaterialOverrideConfig,
  materialRuntimeKind: ProjectMaterialRuntimeKind,
): void {
  if (materialRuntimeKind === 'pbr') {
    delete snapshot.standard;
    return;
  }
  if (materialRuntimeKind === 'standard') {
    delete snapshot.pbr;
  }
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

function buildNodeMaterialId(nodeId: string, materialName: string, ownerNodePath: string): string {
  const ownerPart = ownerNodePath
    ? `_${sanitizeSharedMaterialIdPart(ownerNodePath.replace(/\//g, '_'))}`
    : '';
  return `nodemat_${sanitizeSharedMaterialIdPart(nodeId)}_${sanitizeSharedMaterialIdPart(materialName)}${ownerPart}`;
}

function findSharedMaterialIndex(
  materials: SceneSharedMaterialConfig[],
  assetId: string,
  materialName: string,
): number {
  return materials.findIndex((entry) => isSharedAssetMaterialEntry(entry) && entry.assetId === assetId && entry.materialName === materialName);
}

function findNodeMaterialIndex(
  materials: SceneSharedMaterialConfig[],
  nodeId: string,
  materialName: string,
  ownerNodePath: string,
): number {
  return materials.findIndex((entry) => (
    isNodeMaterialEntry(entry)
    && entry.nodeId === nodeId
    && entry.materialName === materialName
    && (entry.ownerNodePath ?? '') === ownerNodePath
  ));
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
    scope: 'sharedAsset',
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

function getNodeMaterialSnapshot(
  sceneConfig: SceneConfig,
  nodeId: string,
  materialName: string,
  ownerNodePath: string,
): MaterialSnapshot {
  const materials = ensureSceneMaterials(sceneConfig);
  const index = findNodeMaterialIndex(materials, nodeId, materialName, ownerNodePath);
  if (index < 0) return null;
  return cloneMaterialSnapshot(materials[index].properties);
}

function setNodeMaterialSnapshot(
  sceneConfig: SceneConfig,
  nodeId: string,
  materialName: string,
  ownerNodePath: string,
  materialType: string | null,
  snapshot: MaterialSnapshot,
): void {
  const materials = ensureSceneMaterials(sceneConfig);
  const normalized = pruneMaterialSnapshot(snapshot);
  const index = findNodeMaterialIndex(materials, nodeId, materialName, ownerNodePath);

  if (!normalized) {
    if (index >= 0) {
      materials.splice(index, 1);
    }
    return;
  }

  const nextEntry: SceneSharedMaterialConfig = {
    id: index >= 0 ? materials[index].id : buildNodeMaterialId(nodeId, materialName, ownerNodePath),
    scope: 'nodeMaterial',
    nodeId,
    materialName,
    ...(ownerNodePath ? { ownerNodePath } : {}),
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

function shouldStoreMaterialChangeAsOverride(
  sceneConfig: SceneConfig,
  sceneNode: SceneInstanceNode,
  change: CanonicalMaterialChange,
): boolean {
  const asset = getSceneAsset(sceneConfig, sceneNode.instance.assetId);
  if (!asset || asset.materialMode === 'instance') return false;
  const existingOverride = getMaterialSnapshot(sceneNode, change.target, change.ownerNodePath);
  return !!existingOverride;
}

function getMaterialSnapshot(
  sceneNode: SceneInstanceNode | SceneTransformNode,
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
  sceneNode: SceneInstanceNode | SceneTransformNode,
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
    case 'material.pbr.albedoColor':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.albedoColor;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).albedoColor = cloneJson(value as ColorRGB);
      delete snapshot.albedoColor;
      delete snapshot.diffuseColor;
      return;
    case 'material.pbr.baseWeight':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.baseWeight;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).baseWeight = value as number;
      return;
    case 'material.pbr.reflectivityColor':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.reflectivityColor;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).reflectivityColor = cloneJson(value as ColorRGB);
      return;
    case 'material.pbr.microSurface':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.microSurface;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).microSurface = value as number;
      return;
    case 'material.pbr.emissiveColor':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.emissiveColor;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).emissiveColor = cloneJson(value as ColorRGB);
      delete snapshot.emissiveColor;
      return;
    case 'material.pbr.ambientColor':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.ambientColor;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).ambientColor = cloneJson(value as ColorRGB);
      return;
    case 'material.pbr.lightFalloff':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.lightFalloff;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).lightFalloff = value as number;
      return;
    case 'material.pbr.directIntensity':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.directIntensity;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).directIntensity = value as number;
      return;
    case 'material.pbr.emissiveIntensity':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.emissiveIntensity;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).emissiveIntensity = value as number;
      return;
    case 'material.pbr.environmentIntensity':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.environmentIntensity;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).environmentIntensity = value as number;
      return;
    case 'material.pbr.specularIntensity':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.specularIntensity;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).specularIntensity = value as number;
      return;
    case 'material.pbr.metallicF0Factor':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.metallicF0Factor;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).metallicF0Factor = value as number;
      return;
    case 'material.pbr.indexOfRefraction':
      if (value == null) {
        if (snapshot.pbr) delete snapshot.pbr.indexOfRefraction;
        return;
      }
      ensurePbrMaterialLightingSnapshot(snapshot).indexOfRefraction = value as number;
      return;
    case 'material.standard.diffuseColor':
      if (value == null) {
        if (snapshot.standard) delete snapshot.standard.diffuseColor;
        return;
      }
      ensureStandardMaterialLightingSnapshot(snapshot).diffuseColor = cloneJson(value as ColorRGB);
      delete snapshot.albedoColor;
      delete snapshot.diffuseColor;
      return;
    case 'material.standard.specularColor':
      if (value == null) {
        if (snapshot.standard) delete snapshot.standard.specularColor;
        return;
      }
      ensureStandardMaterialLightingSnapshot(snapshot).specularColor = cloneJson(value as ColorRGB);
      return;
    case 'material.standard.specularPower':
      if (value == null) {
        if (snapshot.standard) delete snapshot.standard.specularPower;
        return;
      }
      ensureStandardMaterialLightingSnapshot(snapshot).specularPower = value as number;
      return;
    case 'material.standard.emissiveColor':
      if (value == null) {
        if (snapshot.standard) delete snapshot.standard.emissiveColor;
        return;
      }
      ensureStandardMaterialLightingSnapshot(snapshot).emissiveColor = cloneJson(value as ColorRGB);
      delete snapshot.emissiveColor;
      return;
    case 'material.standard.ambientColor':
      if (value == null) {
        if (snapshot.standard) delete snapshot.standard.ambientColor;
        return;
      }
      ensureStandardMaterialLightingSnapshot(snapshot).ambientColor = cloneJson(value as ColorRGB);
      return;
    case 'material.standard.useSpecularOverAlpha':
      if (value == null) {
        if (snapshot.standard) delete snapshot.standard.useSpecularOverAlpha;
        return;
      }
      ensureStandardMaterialLightingSnapshot(snapshot).useSpecularOverAlpha = value as boolean;
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
  migrateSceneInstancesToV2(sceneConfig);
  const original = cloneSceneConfig(sceneConfig);
  const workingCopy = cloneSceneConfig(sceneConfig);
  documentState.original = original;
  documentState.workingCopy = workingCopy;
  originalSnapshot = snapshotSceneConfig(original);
  clearProjectEditorHistory();
  return documentState;
}

/**
 * Migrate legacy `sceneInstances[]` entries into V2 `scene.assets[]` + `scene.nodes[]`.
 * This handles the case where the platform bridge wrote legacy format data during save.
 * After migration, `sceneInstances` is removed from the config.
 */
function migrateSceneInstancesToV2(sceneConfig: SceneConfig): void {
  const raw = sceneConfig as Record<string, any>;
  const instances: any[] = raw.sceneInstances;
  if (!Array.isArray(instances) || instances.length === 0) return;

  const scene = (sceneConfig.scene ?? {}) as {
    assets?: SceneAssetConfig[];
    nodes?: SceneNodeConfig[];
  };
  if (!sceneConfig.scene) (sceneConfig as any).scene = scene;
  if (!scene.assets) scene.assets = [];
  if (!scene.nodes) scene.nodes = [];

  const existingAssetIds = new Set(scene.assets.map((a) => a.id));
  const existingNodeIds = new Set(scene.nodes.map((n) => n.id));

  for (const inst of instances) {
    if (!inst || typeof inst !== 'object') continue;
    const modelId = typeof inst.modelId === 'string' ? inst.modelId : '';
    const instanceId = typeof inst.id === 'string' ? inst.id : '';
    if (!modelId || !instanceId) continue;

    const assetId = modelId.trim();
    if (!isModelAssetRegistered(assetId)) continue;
    const guid = ASSET_CATALOG[assetId]?.guid;

    // Ensure asset entry exists (deduplicate by assetId)
    if (!existingAssetIds.has(assetId)) {
      scene.assets.push({
        id: assetId,
        type: 'glb',
        ...(guid ? { guid } : {}),
        defaults: {},
      } as SceneAssetConfig);
      existingAssetIds.add(assetId);
    }

    // Ensure node entry exists (deduplicate by instance id)
    if (!existingNodeIds.has(instanceId)) {
      const transform: TransformConfig = {};
      if (inst.transform?.position) {
        transform.position = {
          x: Number(inst.transform.position.x) || 0,
          y: Number(inst.transform.position.y) || 0,
          z: Number(inst.transform.position.z) || 0,
        };
      }
      if (inst.transform?.rotation) {
        transform.rotation = inst.transform.rotation;
      }
      if (inst.transform?.scale != null) {
        transform.scale = inst.transform.scale;
      }

      const node: SceneInstanceNode = {
        id: instanceId,
        name: modelId,
        kind: 'instance',
        enabled: true,
        instance: { assetId },
        transform,
      };
      scene.nodes.push(node);
      existingNodeIds.add(instanceId);
    }
  }

  // Remove legacy field after migration
  delete raw.sceneInstances;
  logDocument('migrateSceneInstancesToV2 completed', {
    migratedInstances: instances.length,
    totalAssets: scene.assets.length,
    totalNodes: scene.nodes.length,
  });
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
  validateProjectEditorSceneJson(workingCopy, 'export');
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
  if (!validateProjectEditorSceneJson(workingCopy, 'commit')) {
    logDocument('commit save rejected: scene json v2 validation failed', {
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

export interface ProjectEditorAddAssetNodeArgs {
  asset: SceneAssetConfig;
  node: SceneInstanceNode;
}

export interface ProjectEditorCreateSceneNodeArgs {
  id?: string;
  name?: string;
  kind: SceneNodeConfig['kind'];
  parentId?: string;
  enabled?: boolean;
  transform?: TransformConfig;
  instance?: SceneInstanceNode['instance'];
  primitive?: ScenePrimitiveNode['primitive'];
  transformType?: SceneTransformNode['transformType'];
  groundDecal?: SceneTransformNode['groundDecal'];
  camera?: SceneCameraRigConfig;
  light?: SceneDirectionalLightConfig;
}

export interface ProjectEditorPatchSceneNodeArgs {
  nodeId: string;
  patches: SceneNodeFieldPatch[];
}

function sanitizeSceneNodeId(value: unknown, fallback: string): string {
  const raw = String(value ?? fallback).trim().toLowerCase();
  const sanitized = raw
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  return sanitized || fallback;
}

function createUniqueSceneNodeId(sceneConfig: SceneConfig, preferredId: unknown, fallback: string): string {
  const used = new Set(ensureSceneNodes(sceneConfig).map((node) => node.id));
  const base = sanitizeSceneNodeId(preferredId, fallback);
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

function getSceneNodeParentId(sceneConfig: SceneConfig, node: SceneNodeConfig): string {
  return node.parentId || ensureSceneSection(sceneConfig).rootId;
}

function assertNoSceneNodeParentCycle(sceneConfig: SceneConfig, nodeId: string, parentId: string | undefined): void {
  if (!parentId) return;
  const scene = ensureSceneSection(sceneConfig);
  if (parentId === scene.rootId) return;
  const sceneNodes = ensureSceneNodes(sceneConfig);
  const byId = new Map(sceneNodes.map((node) => [node.id, node]));
  const visited = new Set<string>([nodeId]);
  let cursorId: string | undefined = parentId;
  while (cursorId && cursorId !== scene.rootId) {
    if (visited.has(cursorId)) {
      throw new ProjectEditorSceneNodeError(
        PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.sceneNodeParentCycle,
        `[ProjectEditor][Document] parentId creates a scene node cycle: ${nodeId} -> ${parentId}`,
        { nodeId, parentId },
      );
    }
    visited.add(cursorId);
    const cursor = byId.get(cursorId);
    if (!cursor) return;
    cursorId = getSceneNodeParentId(sceneConfig, cursor);
  }
}

function assertValidSceneParent(sceneConfig: SceneConfig, parentId: string | undefined, nodeId?: string): void {
  if (!parentId) return;
  if (nodeId && parentId === nodeId) {
    throw new ProjectEditorSceneNodeError(
      PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.sceneNodeParentCycle,
      `[ProjectEditor][Document] parentId cannot point to the same node: ${parentId}`,
      { nodeId, parentId },
    );
  }
  const scene = ensureSceneSection(sceneConfig);
  if (parentId === scene.rootId) return;
  const parent = scene.nodes.find((node) => node.id === parentId);
  if (!parent) {
    throw new ProjectEditorSceneNodeError(
      PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.invalidSceneNodeParent,
      `[ProjectEditor][Document] parentId must point to root or scene node: ${parentId}`,
      { nodeId, parentId },
    );
  }
  if (nodeId) assertNoSceneNodeParentCycle(sceneConfig, nodeId, parentId);
}

function createSceneNodeFromArgs(sceneConfig: SceneConfig, args: ProjectEditorCreateSceneNodeArgs): SceneNodeConfig {
  if (!['group', 'instance', 'transform', 'primitive'].includes(args.kind)) {
    throw new ProjectEditorSceneNodeError(
      PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.invalidSceneNodeKind,
      `[ProjectEditor][Document] Unsupported scene node kind: ${String(args.kind)}`,
      { kind: args.kind },
    );
  }
  const baseName = args.name?.trim() || args.id?.trim() || args.kind;
  const id = createUniqueSceneNodeId(sceneConfig, args.id ?? args.name, baseName);
  const base = {
    id,
    ...(args.name ? { name: args.name } : { name: baseName }),
    kind: args.kind,
    ...(args.parentId ? { parentId: args.parentId } : {}),
    ...(typeof args.enabled === 'boolean' ? { enabled: args.enabled } : {}),
    ...(args.transform ? { transform: cloneJson(args.transform) } : {}),
  };

  if (args.kind === 'group') {
    return base as SceneGroupNode;
  }

  if (args.kind === 'instance') {
    const assetId = args.instance?.assetId?.trim();
    if (!assetId || !getSceneAsset(sceneConfig, assetId)) {
      throw new ProjectEditorSceneNodeError(
        PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.invalidSceneNodeFieldValue,
        `[ProjectEditor][Document] instance node assetId must reference scene.assets: ${assetId ?? ''}`,
        { path: 'instance.assetId', assetId },
      );
    }
    return {
      ...base,
      kind: 'instance',
      instance: { assetId },
    };
  }

  if (args.kind === 'primitive') {
    const shape = args.primitive?.shape;
    if (!shape || !['cube', 'sphere', 'plane', 'capsule'].includes(shape)) {
      throw new ProjectEditorSceneNodeError(
        PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.invalidSceneNodeFieldValue,
        `[ProjectEditor][Document] primitive node shape must be cube, sphere, plane, or capsule: ${String(shape ?? '')}`,
        { path: 'primitive.shape', shape },
      );
    }
    return {
      ...base,
      kind: 'primitive',
      primitive: { shape },
    };
  }

  const transformType = args.transformType ?? 'plain';
  const node: SceneTransformNode = {
    ...base,
    kind: 'transform',
    transformType,
  };
  if (transformType === 'groundDecal') {
    node.groundDecal = cloneJson(args.groundDecal ?? {
      size: { width: 1, depth: 1 },
      color: { r: 1, g: 1, b: 1 },
    });
  } else if (args.groundDecal) {
    node.groundDecal = cloneJson(args.groundDecal);
  }
  if (transformType === 'camera' && args.camera) {
    node.camera = cloneJson(args.camera);
  }
  if (transformType === 'light' && args.light) {
    node.light = cloneJson(args.light);
  }
  return node;
}

function validateSceneNodeCandidate(sceneConfig: SceneConfig, nodeId: string): void {
  const errors = validateSceneJsonV2(sceneConfig, {
    strictNodeIds: [nodeId],
    allowOrphanSharedMaterials: true,
    allowOrphanNodeMaterials: true,
  });
  if (errors.length === 0) return;
  throw new ProjectEditorSceneNodeError(
    PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.sceneNodeSchemaValidationFailed,
    `[ProjectEditor][Document] Scene node schema validation failed: ${errors.map((item) => `${item.path} ${item.message}`).join('; ')}`,
    { errors },
  );
}

export function addProjectEditorAssetNode(
  args: ProjectEditorAddAssetNodeArgs,
  context?: ProjectEditorPluginContext,
): { node: SceneInstanceNode; asset: SceneAssetConfig; rootNode: any | null } {
  const workingCopy = requireWorkingCopy();
  const scene = ensureSceneSection(workingCopy);
  const sceneNodes = ensureSceneNodes(workingCopy);

  const asset = cloneJson(args.asset);
  const node = cloneJson(args.node);
  if (sceneNodes.some((item) => item.id === node.id)) {
    throw new Error(`[ProjectEditor][Document] Scene node already exists: ${node.id}`);
  }

  const existingAssetIndex = scene.assets.findIndex((item) => item.id === asset.id);
  const assetInserted = existingAssetIndex < 0;
  const assetIndex = assetInserted ? scene.assets.length : existingAssetIndex;
  if (assetInserted) {
    scene.assets.push(asset);
  } else {
    const existingAsset = scene.assets[existingAssetIndex];
    if (existingAsset.guid && asset.guid && existingAsset.guid !== asset.guid) {
      throw new Error(`[ProjectEditor][Document] Scene asset GUID conflict: ${asset.id}`);
    }
  }

  const insertIndex = sceneNodes.length;
  sceneNodes.push(node);
  let rootNode: any | null = null;
  try {
    rootNode = addRuntimeSceneNode(node, asset, context);
    if (!rootNode) {
      throw new ProjectEditorSceneNodeError(
        PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.assetImportFailed,
        `[ProjectEditor][Document] Runtime scene node creation failed: ${node.id}`,
        { nodeId: node.id, assetId: asset.id, guid: asset.guid },
      );
    }
  } catch (error) {
    sceneNodes.splice(insertIndex, 1);
    if (assetInserted) scene.assets.splice(assetIndex, 1);
    throw error;
  }

  pushProjectEditorHistory({
    kind: 'addNode',
    binding: { kind: 'sceneNode', nodeId: node.id },
    asset,
    assetInserted,
    assetIndex,
    node,
    insertIndex,
  });

  return {
    node,
    asset,
    rootNode,
  };
}

export function addProjectEditorSceneNode(
  args: ProjectEditorCreateSceneNodeArgs,
  context?: ProjectEditorPluginContext,
): { node: SceneNodeConfig; rootNode: any | null } {
  const workingCopy = requireWorkingCopy();
  const candidate = cloneSceneConfig(workingCopy);
  const sceneNodes = ensureSceneNodes(candidate);
  const node = createSceneNodeFromArgs(candidate, args);
  assertValidSceneParent(candidate, args.parentId, node.id);
  const insertIndex = sceneNodes.length;
  sceneNodes.push(node);
  validateSceneNodeCandidate(candidate, node.id);

  const actualNodes = ensureSceneNodes(workingCopy);
  actualNodes.push(cloneJson(node));
  const rootNode = addRuntimeSceneNode(node, node.kind === 'instance' ? getSceneAsset(workingCopy, node.instance.assetId) : null, context);

  pushProjectEditorHistory({
    kind: 'addSceneNode',
    binding: { kind: 'sceneNode', nodeId: node.id },
    node: cloneJson(node),
    insertIndex,
  });

  return {
    node,
    rootNode,
  };
}

function applyJsonFieldPatch(target: Record<string, any>, patch: SceneNodeFieldPatch): void {
  const segments = patch.path.split('.').filter(Boolean);
  if (segments.length === 0) throw new Error('[ProjectEditor][Document] empty patch path');
  let cursor: Record<string, any> = target;
  for (const segment of segments.slice(0, -1)) {
    const next = cursor[segment];
    if (segment === 'scale' && isTransformScaleAxisPath(segments) && typeof next === 'number' && Number.isFinite(next)) {
      cursor[segment] = { x: next, y: next, z: next };
      cursor = cursor[segment] as Record<string, any>;
      continue;
    }
    if (segment === 'scale' && isTransformScaleAxisPath(segments) && next == null) {
      cursor[segment] = { x: 1, y: 1, z: 1 };
      cursor = cursor[segment] as Record<string, any>;
      continue;
    }
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, any>;
  }
  const leaf = segments[segments.length - 1];
  if (patch.value == null) {
    delete cursor[leaf];
    return;
  }
  cursor[leaf] = cloneJson(patch.value);
}

function isTransformScaleAxisPath(segments: readonly string[]): boolean {
  return segments.length === 3
    && segments[0] === 'transform'
    && segments[1] === 'scale'
    && (segments[2] === 'x' || segments[2] === 'y' || segments[2] === 'z');
}

function normalizeSceneNodePatchValue(path: string, value: unknown): unknown {
  if ([
    'overrides.material.albedoTexture.url',
    'overrides.material.normalTexture.url',
    'overrides.material.metallicTexture.url',
  ].includes(path)) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
}

export function patchProjectEditorSceneNode(
  args: ProjectEditorPatchSceneNodeArgs,
  context?: ProjectEditorPluginContext,
): { node: SceneNodeConfig; rootNode: any | null } {
  const workingCopy = requireWorkingCopy();
  const nodeIndex = ensureSceneNodes(workingCopy).findIndex((node) => node.id === args.nodeId);
  if (nodeIndex < 0) {
    throw new ProjectEditorSceneNodeError(
      PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.nodeNotFound,
      `[ProjectEditor][Document] Scene node not found: ${args.nodeId}`,
      { nodeId: args.nodeId },
    );
  }
  if (!Array.isArray(args.patches) || args.patches.length === 0) {
    throw new ProjectEditorSceneNodeError(
      PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.sceneNodePatchEmpty,
      '[ProjectEditor][Document] scene.node.patch requires at least one patch',
      { nodeId: args.nodeId },
    );
  }

  const before = cloneJson(ensureSceneNodes(workingCopy)[nodeIndex]);
  const candidate = cloneSceneConfig(workingCopy);
  const candidateNodes = ensureSceneNodes(candidate);
  const candidateNode = cloneJson(candidateNodes[nodeIndex]) as SceneNodeConfig;
  for (const patch of args.patches) {
    const schema = resolveSceneNodeFieldSchema(patch.path, candidateNode.kind);
    const normalizedPatch: SceneNodeFieldPatch = {
      path: patch.path,
      value: normalizeSceneNodePatchValue(patch.path, patch.value),
    };
    if (!schema) {
      throw new ProjectEditorSceneNodeError(
        PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.unsupportedSceneNodeField,
        `[ProjectEditor][Document] Unsupported scene node field path: ${patch.path}`,
        { nodeId: args.nodeId, path: patch.path },
      );
    }
    if (normalizedPatch.value == null && schema.allowDelete === false) {
      throw new ProjectEditorSceneNodeError(
        PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.invalidSceneNodeFieldDelete,
        `[ProjectEditor][Document] Scene node field cannot be deleted: ${patch.path}`,
        { nodeId: args.nodeId, path: patch.path },
      );
    }
    if (!schema.validate(normalizedPatch.value)) {
      throw new ProjectEditorSceneNodeError(
        PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.invalidSceneNodeFieldValue,
        `[ProjectEditor][Document] Invalid value for scene node field path: ${patch.path}`,
        { nodeId: args.nodeId, path: patch.path, value: patch.value },
      );
    }
    applyJsonFieldPatch(candidateNode as unknown as Record<string, any>, normalizedPatch);
    cleanupSceneNodeOverrides(candidateNode as VisualOverrideContainer);
  }
  if (candidateNode.parentId) assertValidSceneParent(candidate, candidateNode.parentId, candidateNode.id);
  candidateNodes[nodeIndex] = candidateNode;
  validateSceneNodeCandidate(candidate, candidateNode.id);

  const actualNodes = ensureSceneNodes(workingCopy);
  actualNodes[nodeIndex] = cloneJson(candidateNode);
  removeRuntimeSceneNode(args.nodeId, context);
  const rootNode = addRuntimeSceneNode(
    candidateNode,
    candidateNode.kind === 'instance' ? getSceneAsset(workingCopy, candidateNode.instance.assetId) : null,
    context,
  );

  pushProjectEditorHistory({
    kind: 'patchSceneNode',
    binding: { kind: 'sceneNode', nodeId: candidateNode.id },
    before,
    after: cloneJson(candidateNode),
    nodeIndex,
  });

  return {
    node: candidateNode,
    rootNode,
  };
}

export function removeProjectEditorSceneNode(
  nodeId: string,
  context?: ProjectEditorPluginContext,
): { node: SceneNodeConfig; selectedRootNode: null } | null {
  const workingCopy = requireWorkingCopy();
  const scene = ensureSceneSection(workingCopy);
  const sceneNodes = ensureSceneNodes(workingCopy);
  const removeIndex = sceneNodes.findIndex((node) => node.id === nodeId);
  if (removeIndex < 0) return null;

  const descendantIds = collectSceneNodeDescendantIds(sceneNodes, nodeId);
  const removedNodes = sceneNodes
    .map((node, index) => ({ node, removeIndex: index }))
    .filter((item) => descendantIds.has(item.node.id));
  for (const item of [...removedNodes].sort((a, b) => b.removeIndex - a.removeIndex)) {
    sceneNodes.splice(item.removeIndex, 1);
    removeRuntimeSceneNode(item.node.id, context);
  }
  const node = removedNodes.find((item) => item.node.id === nodeId)?.node ?? removedNodes[0].node;

  const candidateAssetIds = [...new Set(removedNodes
    .map((item) => item.node.kind === 'instance' ? item.node.instance.assetId : '')
    .filter(Boolean))];
  const removedAssets: Array<{ asset: SceneAssetConfig; assetIndex: number }> = [];
  for (const assetId of candidateAssetIds) {
    const assetIndex = scene.assets.findIndex((asset) => asset.id === assetId);
    const asset = assetIndex >= 0 ? scene.assets[assetIndex] : null;
    if (!asset || !isAssetManagerOwnedAsset(asset) || isAssetReferenced(workingCopy, asset.id)) continue;
    removedAssets.push({ asset: cloneJson(asset), assetIndex });
  }
  for (const item of [...removedAssets].sort((a, b) => b.assetIndex - a.assetIndex)) {
    scene.assets.splice(item.assetIndex, 1);
  }
  const removedAsset = removedAssets[0]?.asset;
  const removedAssetIndex = removedAssets[0]?.assetIndex;

  pushProjectEditorHistory({
    kind: 'removeNode',
    binding: { kind: 'sceneNode', nodeId },
    node: cloneJson(node),
    removeIndex,
    removedNodes: removedNodes.map((item) => ({ node: cloneJson(item.node), removeIndex: item.removeIndex })),
    removedAssets,
    ...(removedAsset ? { removedAsset, removedAssetIndex } : {}),
  });

  return {
    node,
    selectedRootNode: null,
  };
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
  const snapshot = direction === 'undo' ? entry.before : entry.after;
  const runtimeValue = cloneJson(direction === 'undo' ? entry.runtimeBefore : entry.runtimeAfter);

  if (entry.storage === 'shared') {
    const workingCopy = requireWorkingCopy();
    if (!entry.assetId) return null;
    setSharedMaterialSnapshot(workingCopy, entry.assetId, entry.materialName, entry.materialType, snapshot);

    const runtimeMaterial = typeof context?.scene?.getMaterialByName === 'function'
      ? context.scene.getMaterialByName(entry.materialName)
      : null;
    if (runtimeMaterial) {
      applyMaterialValueToRuntimeMaterial(runtimeMaterial, context?.scene ?? null, entry.prop as any, runtimeValue);
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

  if (entry.storage === 'nodeMaterial') {
    const workingCopy = requireWorkingCopy();
    const nodeId = entry.nodeId ?? entry.binding.nodeId;
    setNodeMaterialSnapshot(workingCopy, nodeId, entry.materialName, entry.ownerNodePath, entry.materialType, snapshot);

    const rootNode =
      context?.game && typeof context.game.getSceneNodeRuntime === 'function'
        ? context.game.getSceneNodeRuntime(entry.binding.nodeId)
        : null;
    const ownerNode = resolveMaterialOwnerNode(rootNode, entry.ownerNodePath)
      ?? (!entry.ownerNodePath ? rootNode?.getChildMeshes?.(false)?.find((mesh: any) => !!mesh?.material) ?? null : null);
    if (ownerNode) {
      applyMaterialValueToRuntimeNode(ownerNode, context?.scene ?? null, entry.prop as any, runtimeValue);
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

  const location = resolveProjectDocumentBindingLocation(entry.binding);
  if (!location || (location.value.kind !== 'instance' && location.value.kind !== 'transform')) return null;

  const workingCopy = requireWorkingCopy();
  const sceneNodes = ensureSceneNodes(workingCopy);
  const sceneNode = sceneNodes[location.pathSegments[2]];
  if (!sceneNode || (sceneNode.kind !== 'instance' && sceneNode.kind !== 'transform')) return null;

  setMaterialSnapshot(sceneNode, entry.target, entry.ownerNodePath, snapshot);

  const rootNode =
    context?.game && typeof context.game.getSceneNodeRuntime === 'function'
      ? context.game.getSceneNodeRuntime(entry.binding.nodeId)
      : null;
  const ownerNode = resolveMaterialOwnerNode(rootNode, entry.ownerNodePath)
    ?? (!entry.ownerNodePath ? rootNode?.getChildMeshes?.(false)?.find((mesh: any) => !!mesh?.material) ?? null : null);
  if (ownerNode) {
    applyMaterialValueToRuntimeNode(ownerNode, context?.scene ?? null, entry.prop as any, runtimeValue);
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

function applyAddNodeHistoryEntry(
  entry: ProjectEditorAddNodeHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  const workingCopy = requireWorkingCopy();
  const scene = ensureSceneSection(workingCopy);
  const sceneNodes = ensureSceneNodes(workingCopy);

  if (direction === 'undo') {
    const nodeIndex = sceneNodes.findIndex((node) => node.id === entry.node.id);
    if (nodeIndex >= 0) {
      sceneNodes.splice(nodeIndex, 1);
    }
    removeRuntimeSceneNode(entry.node.id, context);

    if (entry.assetInserted && !isAssetReferenced(workingCopy, entry.asset.id)) {
      const assetIndex = scene.assets.findIndex((asset) => asset.id === entry.asset.id);
      if (assetIndex >= 0) {
        scene.assets.splice(assetIndex, 1);
      }
    }

    return {
      kind: 'selection',
      selectedRootNode: null,
    };
  }

  if (entry.assetInserted && !scene.assets.some((asset) => asset.id === entry.asset.id)) {
    scene.assets.splice(Math.max(0, Math.min(entry.assetIndex, scene.assets.length)), 0, cloneJson(entry.asset));
  }

  if (!sceneNodes.some((node) => node.id === entry.node.id)) {
    sceneNodes.splice(Math.max(0, Math.min(entry.insertIndex, sceneNodes.length)), 0, cloneJson(entry.node));
  }
  const rootNode = addRuntimeSceneNode(entry.node, entry.asset, context);

  return {
    kind: 'selection',
    selectedRootNode: rootNode ?? null,
  };
}

function applyAddSceneNodeHistoryEntry(
  entry: ProjectEditorAddSceneNodeHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  const workingCopy = requireWorkingCopy();
  const sceneNodes = ensureSceneNodes(workingCopy);

  if (direction === 'undo') {
    const nodeIndex = sceneNodes.findIndex((node) => node.id === entry.node.id);
    if (nodeIndex >= 0) sceneNodes.splice(nodeIndex, 1);
    removeRuntimeSceneNode(entry.node.id, context);
    return {
      kind: 'selection',
      selectedRootNode: null,
    };
  }

  if (!sceneNodes.some((node) => node.id === entry.node.id)) {
    sceneNodes.splice(Math.max(0, Math.min(entry.insertIndex, sceneNodes.length)), 0, cloneJson(entry.node));
  }
  const rootNode = addRuntimeSceneNode(
    entry.node,
    entry.node.kind === 'instance' ? getSceneAsset(workingCopy, entry.node.instance.assetId) : null,
    context,
  );

  return {
    kind: 'selection',
    selectedRootNode: rootNode ?? null,
  };
}

function applyPatchSceneNodeHistoryEntry(
  entry: ProjectEditorPatchSceneNodeHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  const workingCopy = requireWorkingCopy();
  const sceneNodes = ensureSceneNodes(workingCopy);
  const snapshot = cloneJson(direction === 'undo' ? entry.before : entry.after);
  const existingIndex = sceneNodes.findIndex((node) => node.id === snapshot.id);
  const nodeIndex = existingIndex >= 0 ? existingIndex : Math.max(0, Math.min(entry.nodeIndex, sceneNodes.length));
  sceneNodes[nodeIndex] = snapshot;
  removeRuntimeSceneNode(entry.before.id, context);
  if (entry.after.id !== entry.before.id) removeRuntimeSceneNode(entry.after.id, context);
  const rootNode = addRuntimeSceneNode(
    snapshot,
    snapshot.kind === 'instance' ? getSceneAsset(workingCopy, snapshot.instance.assetId) : null,
    context,
  );

  return {
    kind: 'selection',
    selectedRootNode: rootNode ?? null,
  };
}

function applyRemoveNodeHistoryEntry(
  entry: ProjectEditorRemoveNodeHistoryEntry,
  direction: 'undo' | 'redo',
  context?: ProjectEditorPluginContext,
): ProjectEditorRuntimeChange | null {
  const workingCopy = requireWorkingCopy();
  const scene = ensureSceneSection(workingCopy);
  const sceneNodes = ensureSceneNodes(workingCopy);

  if (direction === 'redo') {
    const removedNodes = entry.removedNodes ?? [{ node: entry.node, removeIndex: entry.removeIndex }];
    for (const item of [...removedNodes].sort((a, b) => b.removeIndex - a.removeIndex)) {
      const nodeIndex = sceneNodes.findIndex((node) => node.id === item.node.id);
      if (nodeIndex >= 0) sceneNodes.splice(nodeIndex, 1);
      removeRuntimeSceneNode(item.node.id, context);
    }
    const removedAssets = entry.removedAssets
      ?? (entry.removedAsset ? [{ asset: entry.removedAsset, assetIndex: entry.removedAssetIndex ?? scene.assets.length }] : []);
    for (const item of [...removedAssets].sort((a, b) => b.assetIndex - a.assetIndex)) {
      if (isAssetReferenced(workingCopy, item.asset.id)) continue;
      const assetIndex = scene.assets.findIndex((asset) => asset.id === item.asset.id);
      if (assetIndex >= 0) scene.assets.splice(assetIndex, 1);
    }
    return {
      kind: 'selection',
      selectedRootNode: null,
    };
  }

  const removedAssets = entry.removedAssets
    ?? (entry.removedAsset ? [{ asset: entry.removedAsset, assetIndex: entry.removedAssetIndex ?? scene.assets.length }] : []);
  for (const item of [...removedAssets].sort((a, b) => a.assetIndex - b.assetIndex)) {
    if (scene.assets.some((asset) => asset.id === item.asset.id)) continue;
    scene.assets.splice(
      Math.max(0, Math.min(item.assetIndex, scene.assets.length)),
      0,
      cloneJson(item.asset),
    );
  }

  const removedNodes = entry.removedNodes ?? [{ node: entry.node, removeIndex: entry.removeIndex }];
  for (const item of [...removedNodes].sort((a, b) => a.removeIndex - b.removeIndex)) {
    if (sceneNodes.some((node) => node.id === item.node.id)) continue;
    sceneNodes.splice(Math.max(0, Math.min(item.removeIndex, sceneNodes.length)), 0, cloneJson(item.node));
  }
  let rootNode: any | null = null;
  for (const item of removedNodes) {
    const asset = item.node.kind === 'instance'
      ? getSceneAsset(workingCopy, item.node.instance.assetId)
      : null;
    const nextRootNode = addRuntimeSceneNode(item.node, asset, context);
    if (item.node.id === entry.node.id) rootNode = nextRootNode;
  }

  return {
    kind: 'selection',
    selectedRootNode: rootNode ?? null,
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
  if (entry.kind === 'addNode') {
    return applyAddNodeHistoryEntry(entry, direction, context);
  }
  if (entry.kind === 'addSceneNode') {
    return applyAddSceneNodeHistoryEntry(entry, direction, context);
  }
  if (entry.kind === 'removeNode') {
    return applyRemoveNodeHistoryEntry(entry, direction, context);
  }
  if (entry.kind === 'patchSceneNode') {
    return applyPatchSceneNodeHistoryEntry(entry, direction, context);
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
  if (!location || (location.value.kind !== 'instance' && location.value.kind !== 'transform')) {
    logDocument('skip material document change for unsupported binding kind', {
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
  if (!sceneNode) return false;
  if (sceneNode.kind !== 'instance' && sceneNode.kind !== 'transform') return false;

  let storage: ProjectEditorMaterialHistoryEntry['storage'] = 'nodeMaterial';
  if (sceneNode.kind === 'instance' && shouldStoreMaterialChangeAsShared(workingCopy, sceneNode, change)) {
    storage = 'shared';
  } else if (sceneNode.kind === 'instance' && shouldStoreMaterialChangeAsOverride(workingCopy, sceneNode, change)) {
    storage = 'override';
  }
  const assetId = sceneNode.kind === 'instance' ? sceneNode.instance.assetId : undefined;

  if (storage === 'shared') {
    if (!assetId) return false;
    const beforeSnapshot = getSharedMaterialSnapshot(workingCopy, assetId, change.materialName);
    const afterSnapshot = cloneMaterialSnapshot(beforeSnapshot) ?? {};
    applyMaterialPropToSnapshot(afterSnapshot, change.path, change.after);
    alignMaterialSnapshotToRuntimeKind(afterSnapshot, change.materialRuntimeKind);
    const normalizedAfterSnapshot = pruneMaterialSnapshot(afterSnapshot);
    if (sameSnapshot(beforeSnapshot, normalizedAfterSnapshot)) return false;

    setSharedMaterialSnapshot(workingCopy, assetId, change.materialName, change.materialType, normalizedAfterSnapshot);
    const entry: ProjectEditorMaterialHistoryEntry = {
      kind: 'material',
      storage: 'shared',
      assetId,
      nodeId: sceneNode.id,
      materialName: change.materialName,
      materialType: change.materialType,
      materialRuntimeKind: change.materialRuntimeKind,
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

  if (storage === 'nodeMaterial') {
    const beforeSnapshot = getNodeMaterialSnapshot(workingCopy, sceneNode.id, change.materialName, change.ownerNodePath);
    const afterSnapshot = cloneMaterialSnapshot(beforeSnapshot) ?? {};
    applyMaterialPropToSnapshot(afterSnapshot, change.path, change.after);
    alignMaterialSnapshotToRuntimeKind(afterSnapshot, change.materialRuntimeKind);
    const normalizedAfterSnapshot = pruneMaterialSnapshot(afterSnapshot);
    if (sameSnapshot(beforeSnapshot, normalizedAfterSnapshot)) return false;

    setNodeMaterialSnapshot(
      workingCopy,
      sceneNode.id,
      change.materialName,
      change.ownerNodePath,
      change.materialType,
      normalizedAfterSnapshot,
    );
    const entry: ProjectEditorMaterialHistoryEntry = {
      kind: 'material',
      storage: 'nodeMaterial',
      assetId,
      nodeId: sceneNode.id,
      materialName: change.materialName,
      materialType: change.materialType,
      materialRuntimeKind: change.materialRuntimeKind,
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
    logDocument('node material history pushed', {
      bindingNodeId: entry.binding.nodeId,
      materialName: entry.materialName,
      ownerNodePath: entry.ownerNodePath,
      prop: entry.prop,
      undoDepth: historyState.undoStack.length,
      redoDepth: historyState.redoStack.length,
    });
    return true;
  }

  const beforeSnapshot = getMaterialSnapshot(sceneNode, change.target, change.ownerNodePath);
  const afterSnapshot = cloneMaterialSnapshot(beforeSnapshot) ?? {};
  applyMaterialPropToSnapshot(afterSnapshot, change.path, change.after);
  alignMaterialSnapshotToRuntimeKind(afterSnapshot, change.materialRuntimeKind);
  const normalizedAfterSnapshot = pruneMaterialSnapshot(afterSnapshot);
  if (sameSnapshot(beforeSnapshot, normalizedAfterSnapshot)) return false;

  setMaterialSnapshot(sceneNode, change.target, change.ownerNodePath, normalizedAfterSnapshot);
  const entry: ProjectEditorMaterialHistoryEntry = {
    kind: 'material',
    storage: 'override',
    assetId,
    nodeId: sceneNode.id,
    materialName: change.materialName,
    materialType: change.materialType,
    materialRuntimeKind: change.materialRuntimeKind,
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
