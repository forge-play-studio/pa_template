import {
  applyProjectMaterialDocumentChange,
  applyProjectOutlineDocumentChange,
  applyProjectDocumentChange,
  beginProjectEditorTransformBatch,
  endProjectEditorTransformBatch,
} from '../document';
import type { ProjectPersistentBinding } from '../types';
import { adaptMaterialPropertyChange, type CanonicalMaterialChange } from './material-property-adapter';
import {
  adaptOutlinePropertyChange,
  resolveOutlineTarget,
  type CanonicalOutlineChange,
} from './outline-adapter';
import type { RuntimeNode, RuntimeScene } from './types';

type TransformSnapshot = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scaling: { x: number; y: number; z: number };
};

type PendingTransformChange = {
  start: TransformSnapshot;
  latest: TransformSnapshot;
};

type PendingMaterialChange = CanonicalMaterialChange;
type PendingOutlineChange = CanonicalOutlineChange;

export type ProjectRuntimeMonitorChange = {
  time: number;
  obj: RuntimeNode;
  binding: ProjectPersistentBinding | null;
  prop: string;
  old: unknown;
  new: unknown;
};

type ProjectRuntimeMonitorOptions = {
  getScene: () => RuntimeScene | null;
  getSelectedEntity: () => RuntimeNode | null;
  getSelectedEntities?: () => RuntimeNode[];
  resolveBinding: (node: RuntimeNode) => ProjectPersistentBinding | null;
  onSelectionChanged?: (node: RuntimeNode | null) => void;
  onDocumentChanged?: () => void;
  onChangesFlushed?: (changes: ProjectRuntimeMonitorChange[]) => void;
  debounceMs?: number;
};

const EPS = 1e-6;
const MATERIAL_FIELD_PATHS = [
  'material.albedoColor',
  'material.emissiveColor',
  'material.metallic',
  'material.roughness',
  'material.alpha',
  'material.backFaceCulling',
  'material.albedoTexture.url',
  'material.normalTexture.url',
  'material.metallicTexture.url',
] as const;

const OUTLINE_FIELD_PATHS = [
  'outline.renderOutline',
  'outline.outlineWidth',
  'outline.outlineColor',
  'outline.renderOverlay',
  'outline.overlayColor',
  'outline.overlayAlpha',
  'outline.edgesRendering',
  'outline.edgesWidth',
  'outline.edgesColor',
] as const;

function vecEq(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): boolean {
  return Math.abs(a.x - b.x) < EPS
    && Math.abs(a.y - b.y) < EPS
    && Math.abs(a.z - b.z) < EPS;
}

function cloneVec3Like(source: any): { x: number; y: number; z: number } | null {
  if (!source || typeof source !== 'object') return null;
  const x = typeof source.x === 'number' ? source.x : null;
  const y = typeof source.y === 'number' ? source.y : null;
  const z = typeof source.z === 'number' ? source.z : null;
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

function cloneColor3(value: any): { r: number; g: number; b: number } | null {
  if (!value || typeof value !== 'object') return null;
  const r = typeof value.r === 'number' ? value.r : (typeof value._r === 'number' ? value._r : null);
  const g = typeof value.g === 'number' ? value.g : (typeof value._g === 'number' ? value._g : null);
  const b = typeof value.b === 'number' ? value.b : (typeof value._b === 'number' ? value._b : null);
  if (r == null || g == null || b == null) return null;
  return { r, g, b };
}

function cloneColor4(value: any): { r: number; g: number; b: number; a: number } | null {
  if (!value || typeof value !== 'object') return null;
  const r = typeof value.r === 'number' ? value.r : (typeof value._r === 'number' ? value._r : null);
  const g = typeof value.g === 'number' ? value.g : (typeof value._g === 'number' ? value._g : null);
  const b = typeof value.b === 'number' ? value.b : (typeof value._b === 'number' ? value._b : null);
  const a = typeof value.a === 'number' ? value.a : (typeof value._a === 'number' ? value._a : null);
  if (r == null || g == null || b == null || a == null) return null;
  return { r, g, b, a };
}

function readTextureUrl(value: any): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object') return null;
  if (typeof value.url === 'string' && value.url.trim()) return value.url.trim();
  if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
  return null;
}

function cloneValue<T>(value: T): T {
  if (value == null || typeof value !== 'object') return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function logMonitor(message: string, data?: Record<string, unknown>): void {
  if (data) {
    console.log(`[ProjectEditor][Monitor] ${message}`, data);
    return;
  }
  console.log(`[ProjectEditor][Monitor] ${message}`);
}

function valueEq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < EPS;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function readRotation(node: any): { x: number; y: number; z: number } | null {
  const quat = node?.rotationQuaternion;
  if (quat && typeof quat.toEulerAngles === 'function') {
    return cloneVec3Like(quat.toEulerAngles());
  }
  return cloneVec3Like(node?.rotation);
}

function snapshotMaterial(node: RuntimeNode | null): Record<string, unknown> {
  const material = (node as any)?.material;
  if (!material || typeof material !== 'object') return {};

  const out: Record<string, unknown> = {};
  for (const fieldPath of MATERIAL_FIELD_PATHS) {
    switch (fieldPath) {
      case 'material.albedoColor':
      case 'material.emissiveColor': {
        const key = fieldPath === 'material.albedoColor'
          ? ('albedoColor' in material ? 'albedoColor' : 'diffuseColor')
          : 'emissiveColor';
        const color = cloneColor3((material as any)[key]);
        if (color) out[fieldPath] = color;
        break;
      }
      case 'material.metallic':
      case 'material.roughness':
      case 'material.alpha': {
        const key = fieldPath.split('.')[1];
        const n = (material as any)[key];
        if (typeof n === 'number' && Number.isFinite(n)) out[fieldPath] = n;
        break;
      }
      case 'material.backFaceCulling': {
        const v = (material as any).backFaceCulling;
        if (typeof v === 'boolean') out[fieldPath] = v;
        break;
      }
      case 'material.albedoTexture.url':
      case 'material.normalTexture.url':
      case 'material.metallicTexture.url': {
        const key = fieldPath.split('.')[1];
        const url = readTextureUrl((material as any)[key]);
        out[fieldPath] = url;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function snapshotOutline(node: RuntimeNode | null): Record<string, unknown> {
  const { target } = resolveOutlineTarget(node);
  if (!target || typeof target !== 'object') return {};

  const out: Record<string, unknown> = {};
  for (const fieldPath of OUTLINE_FIELD_PATHS) {
    switch (fieldPath) {
      case 'outline.renderOutline': {
        out[fieldPath] = !!(target as any).renderOutline;
        break;
      }
      case 'outline.outlineWidth': {
        const width = (target as any).outlineWidth;
        if (typeof width === 'number' && Number.isFinite(width)) {
          out[fieldPath] = width;
        }
        break;
      }
      case 'outline.outlineColor': {
        const color = cloneColor3((target as any).outlineColor);
        if (color) out[fieldPath] = color;
        break;
      }
      case 'outline.renderOverlay': {
        out[fieldPath] = !!(target as any).renderOverlay;
        break;
      }
      case 'outline.overlayAlpha': {
        const alpha = (target as any).overlayAlpha;
        if (typeof alpha === 'number' && Number.isFinite(alpha)) {
          out[fieldPath] = alpha;
        }
        break;
      }
      case 'outline.overlayColor': {
        const color = cloneColor3((target as any).overlayColor);
        if (color) out[fieldPath] = color;
        break;
      }
      case 'outline.edgesRendering': {
        out[fieldPath] = !!(target as any).edgesRenderer;
        break;
      }
      case 'outline.edgesWidth': {
        const width = (target as any).edgesWidth;
        if (typeof width === 'number' && Number.isFinite(width)) {
          out[fieldPath] = width;
        }
        break;
      }
      case 'outline.edgesColor': {
        const color = cloneColor4((target as any).edgesColor);
        if (color) out[fieldPath] = color;
        break;
      }
      default:
        break;
    }
  }

  return out;
}

function snapshotTransform(node: RuntimeNode | null): TransformSnapshot | null {
  if (!node) return null;
  const position = cloneVec3Like((node as any).position);
  const rotation = readRotation(node as any);
  const scaling = cloneVec3Like((node as any).scaling);
  if (!position || !rotation || !scaling) return null;
  return { position, rotation, scaling };
}

function hasChanged(a: TransformSnapshot, b: TransformSnapshot): boolean {
  return !vecEq(a.position, b.position)
    || !vecEq(a.rotation, b.rotation)
    || !vecEq(a.scaling, b.scaling);
}

function cloneTransformSnapshot(value: TransformSnapshot): TransformSnapshot {
  return {
    position: { ...value.position },
    rotation: { ...value.rotation },
    scaling: { ...value.scaling },
  };
}

function hasTransform(node: any): boolean {
  return !!node?.position && (!!node?.rotation || !!node?.rotationQuaternion) && !!node?.scaling;
}

function resolveTrackedNode(scene: RuntimeScene | null, entity: any, previous: RuntimeNode | null): RuntimeNode | null {
  if (!entity) return null;
  if (hasTransform(entity)) return entity as RuntimeNode;

  if (previous && (previous as any).material === entity) {
    return previous;
  }

  const owner = (scene?.meshes || []).find((mesh: any) => mesh?.material === entity);
  if (owner && hasTransform(owner)) return owner as RuntimeNode;

  if (previous) return previous;
  return null;
}

export function createProjectRuntimeMonitor(options: ProjectRuntimeMonitorOptions) {
  const debounceMs = options.debounceMs ?? 250;
  let enabled = false;
  let sceneObs: any = null;
  let selectedNode: RuntimeNode | null = null;
  let selectedNodes: RuntimeNode[] = [];
  let baseline: TransformSnapshot | null = null;
  let materialBaseline: Record<string, unknown> = {};
  let outlineBaseline: Record<string, unknown> = {};
  let pending: PendingTransformChange | null = null;
  let pendingByNode = new Map<RuntimeNode, PendingTransformChange>();
  let pendingMaterialByKey = new Map<string, PendingMaterialChange>();
  let pendingOutlineByKey = new Map<string, PendingOutlineChange>();
  let transformTimer: ReturnType<typeof setTimeout> | null = null;
  let materialTimer: ReturnType<typeof setTimeout> | null = null;
  let outlineTimer: ReturnType<typeof setTimeout> | null = null;
  let contextTimer: ReturnType<typeof setTimeout> | null = null;
  let contextBuffer: ProjectRuntimeMonitorChange[] = [];
  let pointerActive = false;
  let hadDragDuringPointer = false;
  let hadMaterialChangeDuringPointer = false;
  let hadOutlineChangeDuringPointer = false;

  function isSameNode(a: RuntimeNode | null | undefined, b: RuntimeNode | null | undefined): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    const aId = (a as any).uniqueId;
    const bId = (b as any).uniqueId;
    return typeof aId === 'number' && typeof bId === 'number' && aId === bId;
  }

  function collectSelectedNodes(primary: RuntimeNode | null): RuntimeNode[] {
    const out: RuntimeNode[] = [];
    if (primary) out.push(primary);
    const fromOptions = options.getSelectedEntities?.() ?? [];
    for (const node of fromOptions) {
      if (!node || !hasTransform(node)) continue;
      if (out.some(item => isSameNode(item, node))) continue;
      out.push(node);
    }
    return out;
  }

  function upsertPendingNode(node: RuntimeNode, start: TransformSnapshot, latest: TransformSnapshot): void {
    const existing = pendingByNode.get(node);
    if (!existing) {
      pendingByNode.set(node, {
        start: cloneTransformSnapshot(start),
        latest: cloneTransformSnapshot(latest),
      });
      return;
    }
    existing.latest = cloneTransformSnapshot(latest);
  }

  function materialChangeKey(change: CanonicalMaterialChange): string {
    return [
      change.binding.kind,
      change.binding.kind === 'sceneNode' ? change.binding.nodeId : '',
      change.target,
      change.ownerNodePath,
      change.path,
    ].join('::');
  }

  function upsertPendingMaterial(change: CanonicalMaterialChange): void {
    const key = materialChangeKey(change);
    const existing = pendingMaterialByKey.get(key);
    if (!existing) {
      pendingMaterialByKey.set(key, {
        ...change,
        before: cloneValue(change.before),
        after: cloneValue(change.after),
      });
      return;
    }
    existing.runtimeNode = change.runtimeNode;
    existing.binding = change.binding;
    existing.after = cloneValue(change.after);
  }

  function outlineChangeKey(change: CanonicalOutlineChange): string {
    return [
      change.binding.kind,
      change.binding.kind === 'sceneNode' ? change.binding.nodeId : '',
      change.target,
      change.ownerNodePath,
      change.path,
    ].join('::');
  }

  function upsertPendingOutline(change: CanonicalOutlineChange): void {
    const key = outlineChangeKey(change);
    const existing = pendingOutlineByKey.get(key);
    if (!existing) {
      pendingOutlineByKey.set(key, {
        ...change,
        before: cloneValue(change.before),
        after: cloneValue(change.after),
      });
      return;
    }
    existing.runtimeNode = change.runtimeNode;
    existing.binding = change.binding;
    existing.after = cloneValue(change.after);
  }

  function applyDeltaToFollowers(previous: TransformSnapshot, next: TransformSnapshot): void {
    if (!selectedNode) return;
    const deltaPosition = {
      x: next.position.x - previous.position.x,
      y: next.position.y - previous.position.y,
      z: next.position.z - previous.position.z,
    };
    const deltaRotation = {
      x: next.rotation.x - previous.rotation.x,
      y: next.rotation.y - previous.rotation.y,
      z: next.rotation.z - previous.rotation.z,
    };
    const deltaScaling = {
      x: next.scaling.x - previous.scaling.x,
      y: next.scaling.y - previous.scaling.y,
      z: next.scaling.z - previous.scaling.z,
    };

    for (const node of selectedNodes) {
      if (isSameNode(node, selectedNode)) continue;
      const before = snapshotTransform(node);
      if (!before) continue;

      const position = (node as any).position;
      if (position?.addInPlaceFromFloats) {
        position.addInPlaceFromFloats(deltaPosition.x, deltaPosition.y, deltaPosition.z);
      } else if (position) {
        position.x += deltaPosition.x;
        position.y += deltaPosition.y;
        position.z += deltaPosition.z;
      }

      if ((node as any).rotationQuaternion) {
        (node as any).rotationQuaternion = null;
      }
      const rotation = (node as any).rotation;
      if (rotation?.addInPlaceFromFloats) {
        rotation.addInPlaceFromFloats(deltaRotation.x, deltaRotation.y, deltaRotation.z);
      } else if (rotation) {
        rotation.x += deltaRotation.x;
        rotation.y += deltaRotation.y;
        rotation.z += deltaRotation.z;
      }

      const scaling = (node as any).scaling;
      if (scaling?.addInPlaceFromFloats) {
        scaling.addInPlaceFromFloats(deltaScaling.x, deltaScaling.y, deltaScaling.z);
      } else if (scaling) {
        scaling.x += deltaScaling.x;
        scaling.y += deltaScaling.y;
        scaling.z += deltaScaling.z;
      }

      const after = snapshotTransform(node);
      if (!after) continue;
      upsertPendingNode(node, before, after);
    }
  }

  function flushContextChanges(): void {
    if (!contextBuffer.length) {
      if (contextTimer) {
        clearTimeout(contextTimer);
        contextTimer = null;
      }
      return;
    }
    if (pendingMaterialByKey.size > 0 && !pointerActive) {
      flushPendingMaterial();
    }
    if (pendingOutlineByKey.size > 0 && !pointerActive) {
      flushPendingOutline();
    }
    const payload = contextBuffer;
    contextBuffer = [];
    if (contextTimer) {
      clearTimeout(contextTimer);
      contextTimer = null;
    }
    options.onChangesFlushed?.(payload);
  }

  function scheduleContextFlush(): void {
    if (contextTimer) clearTimeout(contextTimer);
    contextTimer = setTimeout(flushContextChanges, debounceMs);
  }

  function pushContextChange(change: ProjectRuntimeMonitorChange): void {
    if (valueEq(change.old, change.new)) return;
    contextBuffer.push({
      ...change,
      old: cloneValue(change.old),
      new: cloneValue(change.new),
    });
    scheduleContextFlush();
  }

  function scheduleTransformFlush(): void {
    if (transformTimer) clearTimeout(transformTimer);
    transformTimer = setTimeout(flushPending, debounceMs);
  }

  function scheduleMaterialFlush(): void {
    if (materialTimer) clearTimeout(materialTimer);
    materialTimer = setTimeout(flushPendingMaterial, debounceMs);
  }

  function scheduleOutlineFlush(): void {
    if (outlineTimer) clearTimeout(outlineTimer);
    outlineTimer = setTimeout(flushPendingOutline, debounceMs);
  }

  function clearPending(): void {
    if (transformTimer) {
      clearTimeout(transformTimer);
      transformTimer = null;
    }
    pending = null;
    pendingByNode.clear();
  }

  function clearPendingMaterial(): void {
    if (materialTimer) {
      clearTimeout(materialTimer);
      materialTimer = null;
    }
    pendingMaterialByKey.clear();
  }

  function clearPendingOutline(): void {
    if (outlineTimer) {
      clearTimeout(outlineTimer);
      outlineTimer = null;
    }
    pendingOutlineByKey.clear();
  }

  function flushPending(): void {
    if (!pendingByNode.size) {
      clearPending();
      return;
    }
    const pendingCount = pendingByNode.size;
    logMonitor('flush transform pending', {
      pendingCount,
    });
    const timestamp = Date.now();
    let changed = false;
    beginProjectEditorTransformBatch();
    try {
      for (const [node, value] of pendingByNode.entries()) {
        const binding = options.resolveBinding(node);
        const { start, latest } = value;
        if (!vecEq(start.position, latest.position)) {
          pushContextChange({
            time: timestamp,
            obj: node,
            binding,
            prop: 'position',
            old: start.position,
            new: latest.position,
          });
          if (binding) {
            changed = applyProjectDocumentChange(binding, node, 'position', start.position, latest.position) || changed;
          }
        }
        if (!vecEq(start.rotation, latest.rotation)) {
          pushContextChange({
            time: timestamp,
            obj: node,
            binding,
            prop: 'rotation',
            old: start.rotation,
            new: latest.rotation,
          });
          if (binding) {
            changed = applyProjectDocumentChange(binding, node, 'rotation', start.rotation, latest.rotation) || changed;
          }
        }
        if (!vecEq(start.scaling, latest.scaling)) {
          pushContextChange({
            time: timestamp,
            obj: node,
            binding,
            prop: 'scaling',
            old: start.scaling,
            new: latest.scaling,
          });
          if (binding) {
            changed = applyProjectDocumentChange(binding, node, 'scaling', start.scaling, latest.scaling) || changed;
          }
        }
      }
    } finally {
      endProjectEditorTransformBatch();
    }

    clearPending();
    logMonitor('flush transform completed', {
      pendingCount,
      changed,
    });
    if (changed) {
      options.onDocumentChanged?.();
    }
  }

  function flushPendingMaterial(): void {
    if (!pendingMaterialByKey.size) {
      clearPendingMaterial();
      return;
    }

    const pendingCount = pendingMaterialByKey.size;
    logMonitor('flush material pending', {
      pendingCount,
    });
    let changed = false;
    for (const change of pendingMaterialByKey.values()) {
      changed = applyProjectMaterialDocumentChange(change) || changed;
    }

    clearPendingMaterial();
    logMonitor('flush material completed', {
      pendingCount,
      changed,
    });
    if (changed) {
      options.onDocumentChanged?.();
    }
  }

  function flushPendingOutline(): void {
    if (!pendingOutlineByKey.size) {
      clearPendingOutline();
      return;
    }

    const pendingCount = pendingOutlineByKey.size;
    logMonitor('flush outline pending', {
      pendingCount,
    });
    let changed = false;
    for (const change of pendingOutlineByKey.values()) {
      changed = applyProjectOutlineDocumentChange(change) || changed;
    }

    clearPendingOutline();
    logMonitor('flush outline completed', {
      pendingCount,
      changed,
    });
    if (changed) {
      options.onDocumentChanged?.();
    }
  }

  function queuePending(next: TransformSnapshot): void {
    if (!selectedNode) return;
    if (!pending) {
      const start = baseline
        ? { ...baseline, position: { ...baseline.position }, rotation: { ...baseline.rotation }, scaling: { ...baseline.scaling } }
        : next;
      pending = {
        start,
        latest: { ...next, position: { ...next.position }, rotation: { ...next.rotation }, scaling: { ...next.scaling } },
      };
    } else {
      pending.latest = { ...next, position: { ...next.position }, rotation: { ...next.rotation }, scaling: { ...next.scaling } };
    }
    upsertPendingNode(selectedNode, pending.start, pending.latest);
    if (pointerActive) {
      hadDragDuringPointer = true;
      if (transformTimer) {
        clearTimeout(transformTimer);
        transformTimer = null;
      }
      return;
    }
    scheduleTransformFlush();
  }

  function syncSelection(nextNode: RuntimeNode | null): void {
    const scene = options.getScene();
    const resolvedNode = resolveTrackedNode(scene, nextNode, selectedNode);
    if (resolvedNode === selectedNode) return;
    flushPending();
    flushPendingMaterial();
    flushPendingOutline();
    flushContextChanges();
    selectedNode = resolvedNode;
    selectedNodes = collectSelectedNodes(selectedNode);
    baseline = snapshotTransform(selectedNode);
    materialBaseline = snapshotMaterial(selectedNode);
    outlineBaseline = snapshotOutline(selectedNode);
    options.onSelectionChanged?.(selectedNode);
  }

  function rebaseSelection(nextNode?: RuntimeNode | null): void {
    if (nextNode !== undefined) {
      selectedNode = nextNode;
    }
    selectedNodes = collectSelectedNodes(selectedNode);
    clearPending();
    clearPendingMaterial();
    clearPendingOutline();
    baseline = snapshotTransform(selectedNode);
    materialBaseline = snapshotMaterial(selectedNode);
    outlineBaseline = snapshotOutline(selectedNode);
  }

  function checkMaterial(): void {
    if (!selectedNode) return;
    const next = snapshotMaterial(selectedNode);
    const allPaths = new Set<string>([
      ...Object.keys(materialBaseline),
      ...Object.keys(next),
    ]);
    const binding = options.resolveBinding(selectedNode);
    let recordedPendingMaterial = false;
    for (const path of allPaths) {
      const oldValue = materialBaseline[path];
      const newValue = next[path];
      if (valueEq(oldValue, newValue)) continue;
      pushContextChange({
        time: Date.now(),
        obj: selectedNode,
        binding,
        prop: path,
        old: oldValue,
        new: newValue,
      });
      if (binding) {
        const materialChange = adaptMaterialPropertyChange({
          scene: options.getScene(),
          selectedEntity: selectedNode,
          entity: selectedNode,
          propertyKey: path,
          oldValue,
          newValue,
          resolveBinding: (node) => options.resolveBinding(node),
        });
        if (materialChange) {
          upsertPendingMaterial(materialChange);
          recordedPendingMaterial = true;
        }
      }
    }
    materialBaseline = next;
    if (!recordedPendingMaterial) return;
    if (pointerActive) {
      hadMaterialChangeDuringPointer = true;
      if (materialTimer) {
        clearTimeout(materialTimer);
        materialTimer = null;
      }
      return;
    }
    scheduleMaterialFlush();
  }

  function recordCanonicalMaterialChange(change: CanonicalMaterialChange): void {
    upsertPendingMaterial(change);
    if (selectedNode && isSameNode(selectedNode, change.runtimeNode)) {
      materialBaseline[change.path] = cloneValue(change.after);
    }

    pushContextChange({
      time: Date.now(),
      obj: change.runtimeNode,
      binding: change.binding,
      prop: change.path,
      old: change.before,
      new: change.after,
    });
    if (pointerActive) {
      hadMaterialChangeDuringPointer = true;
      if (materialTimer) {
        clearTimeout(materialTimer);
        materialTimer = null;
      }
      if (contextTimer) {
        clearTimeout(contextTimer);
        contextTimer = null;
      }
      return;
    }
    scheduleMaterialFlush();
  }

  function checkOutline(): void {
    if (!selectedNode) return;
    const next = snapshotOutline(selectedNode);
    const allPaths = new Set<string>([
      ...Object.keys(outlineBaseline),
      ...Object.keys(next),
    ]);
    const binding = options.resolveBinding(selectedNode);
    let recordedPendingOutline = false;
    for (const path of allPaths) {
      const oldValue = outlineBaseline[path];
      const newValue = next[path];
      if (valueEq(oldValue, newValue)) continue;
      pushContextChange({
        time: Date.now(),
        obj: selectedNode,
        binding,
        prop: path,
        old: oldValue,
        new: newValue,
      });
      if (binding) {
        const outlineChange = adaptOutlinePropertyChange({
          selectedEntity: selectedNode,
          propertyKey: path,
          oldValue,
          newValue,
          resolveBinding: (node) => options.resolveBinding(node),
        });
        if (outlineChange) {
          upsertPendingOutline(outlineChange);
          recordedPendingOutline = true;
        }
      }
    }
    outlineBaseline = next;
    if (!recordedPendingOutline) return;
    if (pointerActive) {
      hadOutlineChangeDuringPointer = true;
      if (outlineTimer) {
        clearTimeout(outlineTimer);
        outlineTimer = null;
      }
      return;
    }
    scheduleOutlineFlush();
  }

  function tick(): void {
    const rawEntity = options.getSelectedEntity();
    const resolvedNode = resolveTrackedNode(options.getScene(), rawEntity, selectedNode);
    if (resolvedNode !== selectedNode) {
      syncSelection(rawEntity);
    }
    if (!selectedNode) return;
    selectedNodes = collectSelectedNodes(selectedNode);
    const next = snapshotTransform(selectedNode);
    if (next && baseline) {
      if (!hasChanged(baseline, next)) {
        if (pendingByNode.size > 0 && !pointerActive && !transformTimer) {
          scheduleTransformFlush();
        }
      } else {
        const previous = baseline;
        queuePending(next);
        applyDeltaToFollowers(previous, next);
        baseline = next;
      }
    } else if (next && !baseline) {
      baseline = next;
    }
    checkMaterial();
    checkOutline();
  }

  function onPointerDown(): void {
    if (!enabled) return;
    pointerActive = true;
    hadDragDuringPointer = false;
    hadMaterialChangeDuringPointer = false;
    hadOutlineChangeDuringPointer = false;
  }

  function onPointerUp(): void {
    if (!enabled) return;
    pointerActive = false;
    if (hadDragDuringPointer) {
      flushPending();
    }
    if (hadMaterialChangeDuringPointer) {
      flushPendingMaterial();
    }
    if (hadOutlineChangeDuringPointer) {
      flushPendingOutline();
    }
    flushContextChanges();
    hadDragDuringPointer = false;
    hadMaterialChangeDuringPointer = false;
    hadOutlineChangeDuringPointer = false;
  }

  return {
    get isDragging(): boolean {
      return pointerActive || pendingByNode.size > 0;
    },

    start(): void {
      if (enabled) return;
      const scene = options.getScene();
      if (!scene) return;
      syncSelection(options.getSelectedEntity());
      sceneObs = scene.onAfterRenderObservable?.add?.(() => tick()) ?? null;
      window.addEventListener('pointerdown', onPointerDown, true);
      window.addEventListener('pointerup', onPointerUp, true);
      enabled = true;
    },

    stop(): void {
      if (!enabled) return;
      flushPending();
      flushPendingMaterial();
      flushPendingOutline();
      flushContextChanges();
      const scene = options.getScene();
      if (sceneObs) {
        scene?.onAfterRenderObservable?.remove?.(sceneObs);
        sceneObs = null;
      }
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      pointerActive = false;
      hadDragDuringPointer = false;
      hadMaterialChangeDuringPointer = false;
      hadOutlineChangeDuringPointer = false;
      enabled = false;
    },

    reset(): void {
      this.stop();
      selectedNode = null;
      baseline = null;
      materialBaseline = {};
      outlineBaseline = {};
      contextBuffer = [];
      if (contextTimer) {
        clearTimeout(contextTimer);
        contextTimer = null;
      }
      clearPending();
      clearPendingMaterial();
      clearPendingOutline();
    },

    flush(): void {
      logMonitor('flush requested', {
        transformPending: pendingByNode.size,
        materialPending: pendingMaterialByKey.size,
        outlinePending: pendingOutlineByKey.size,
        contextPending: contextBuffer.length,
      });
      flushPending();
      flushPendingMaterial();
      flushPendingOutline();
      flushContextChanges();
      logMonitor('flush completed', {
        transformPending: pendingByNode.size,
        materialPending: pendingMaterialByKey.size,
        outlinePending: pendingOutlineByKey.size,
        contextPending: contextBuffer.length,
      });
    },

    rebase(nextNode?: RuntimeNode | null): void {
      rebaseSelection(nextNode);
    },

    recordCanonicalMaterialChange(change: CanonicalMaterialChange): void {
      recordCanonicalMaterialChange(change);
    },
  };
}
