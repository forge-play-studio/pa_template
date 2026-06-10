import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';

import type {
  ColorRGB,
  ColorRGBA,
} from '../../config';
import type {
  ProjectOutlineProp,
  ProjectOutlineValue,
  ProjectPersistentBinding,
} from '../types';
import type { RuntimeNode } from './types';

export const OUTLINE_PROPERTY_KEYS = [
  'renderOutline',
  'outlineColor',
  'outlineWidth',
  'renderOverlay',
  'overlayColor',
  'overlayAlpha',
  'edgesRendering',
  'edgesRenderer',
  'edgesWidth',
  'edgesColor',
] as const;

export type OutlinePropertyKey = (typeof OUTLINE_PROPERTY_KEYS)[number];

export type OutlineTargetState = {
  target: any | null;
  shared: boolean;
};

export const OUTLINE_CANONICAL_PATHS = [
  'outline.renderOutline',
  'outline.outlineWidth',
  'outline.outlineColor',
  'outline.renderOverlay',
  'outline.overlayColor',
  'outline.overlayAlpha',
  'outline.edgesRendering',
  'outline.edgesWidth',
  'outline.edgesColor',
] as const satisfies readonly ProjectOutlineProp[];

export type CanonicalOutlineChange = {
  runtimeNode: RuntimeNode;
  binding: ProjectPersistentBinding;
  ownerNodePath: string;
  target: 'root' | 'childOutline';
  shared: boolean;
  path: ProjectOutlineProp;
  before: ProjectOutlineValue;
  after: ProjectOutlineValue;
};

type OutlinePropertyChangeArgs = {
  entity: any;
  property: OutlinePropertyKey;
  value: unknown;
  initialValue?: unknown;
};

type AdaptOutlinePropertyChangeOptions = {
  selectedEntity: RuntimeNode | null;
  propertyKey: unknown;
  oldValue: unknown;
  newValue: unknown;
  resolveBinding: (node: RuntimeNode) => ProjectPersistentBinding | null;
};

const SKIP = Symbol('outline-property-skip');

function getNodeClassName(node: any): string {
  return node?.getClassName?.() || node?.constructor?.name || '';
}

function hasRenderableVertices(node: any): boolean {
  if (!node || typeof node.getTotalVertices !== 'function') return false;
  const count = node.getTotalVertices();
  return typeof count === 'number' && Number.isFinite(count) && count > 0;
}

function restoreOriginalOutlineValue(entity: any, property: OutlinePropertyKey, initialValue: unknown): void {
  if (!entity) return;
  try {
    if (
      getNodeClassName(entity) === 'InstancedMesh'
      && (property === 'renderOutline' || property === 'outlineColor' || property === 'outlineWidth')
    ) {
      Reflect.deleteProperty(entity, property);
      return;
    }
    if (initialValue === undefined) {
      if (Object.prototype.hasOwnProperty.call(entity, property)) {
        Reflect.deleteProperty(entity, property);
      } else {
        (entity as any)[property] = undefined;
      }
      return;
    }
    (entity as any)[property] = initialValue;
  } catch {}
}

export function isOutlinePropertyKey(value: string): value is OutlinePropertyKey {
  return (OUTLINE_PROPERTY_KEYS as readonly string[]).includes(value);
}

export function normalizeInstancedMeshOutlineProperties(entity: any): void {
  if (getNodeClassName(entity) !== 'InstancedMesh') return;
  for (const property of ['outlineColor', 'outlineWidth'] as const) {
    if (!Object.prototype.hasOwnProperty.call(entity, property)) continue;
    try {
      Reflect.deleteProperty(entity, property);
    } catch {}
  }
}

export function resolveOutlineTarget(entity: any): OutlineTargetState {
  if (!entity) return { target: null, shared: false };

  const className = getNodeClassName(entity);
  if (className === 'InstancedMesh') {
    normalizeInstancedMeshOutlineProperties(entity);
    return {
      target: entity.sourceMesh ?? null,
      shared: true,
    };
  }

  if (className === 'Mesh' && hasRenderableVertices(entity)) {
    return {
      target: entity,
      shared: false,
    };
  }

  const children = typeof entity.getChildMeshes === 'function'
    ? entity.getChildMeshes(false)
    : [];
  for (const child of children) {
    const childClassName = getNodeClassName(child);
    if (childClassName === 'InstancedMesh') {
      normalizeInstancedMeshOutlineProperties(child);
      return {
        target: child.sourceMesh ?? null,
        shared: true,
      };
    }
    if (childClassName === 'Mesh' && hasRenderableVertices(child)) {
      return {
        target: child,
        shared: false,
      };
    }
  }

  if (className === 'Mesh') {
    return {
      target: entity,
      shared: false,
    };
  }

  return { target: null, shared: false };
}

function stableNodeSegment(node: any): string | null {
  const candidates = [node?.name, node?.id];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function buildOwnerNodePath(ownerNode: RuntimeNode, rootNode: RuntimeNode): string | null {
  if (ownerNode === rootNode) return '';
  const segments: string[] = [];
  let current: any = ownerNode;
  while (current && current !== rootNode) {
    const segment = stableNodeSegment(current);
    if (!segment) return null;
    segments.push(segment);
    current = current.parent ?? null;
  }
  if (current !== rootNode) return null;
  return segments.reverse().join('/');
}

export function resolveOutlineOwnerNode(rootNode: RuntimeNode | null): {
  ownerNode: RuntimeNode | null;
  shared: boolean;
} {
  if (!rootNode) return { ownerNode: null, shared: false };

  const className = getNodeClassName(rootNode);
  if (className === 'InstancedMesh') {
    normalizeInstancedMeshOutlineProperties(rootNode);
    return { ownerNode: rootNode, shared: true };
  }
  if (className === 'Mesh' && hasRenderableVertices(rootNode)) {
    return { ownerNode: rootNode, shared: false };
  }

  const children = typeof rootNode.getChildMeshes === 'function'
    ? rootNode.getChildMeshes(false)
    : [];
  for (const child of children) {
    const childClassName = getNodeClassName(child);
    if (childClassName === 'InstancedMesh') {
      normalizeInstancedMeshOutlineProperties(child);
      return { ownerNode: child, shared: true };
    }
    if (childClassName === 'Mesh' && hasRenderableVertices(child)) {
      return { ownerNode: child, shared: false };
    }
  }

  if (className === 'Mesh') {
    return { ownerNode: rootNode, shared: false };
  }

  return { ownerNode: null, shared: false };
}

function normalizeOutlinePropertyKey(propertyKey: unknown): ProjectOutlineProp | null {
  if (typeof propertyKey !== 'string') return null;
  const trimmed = propertyKey.trim();
  if (!trimmed) return null;
  if ((OUTLINE_CANONICAL_PATHS as readonly string[]).includes(trimmed)) {
    return trimmed as ProjectOutlineProp;
  }
  if (trimmed === 'renderOutline') return 'outline.renderOutline';
  if (trimmed === 'outlineWidth') return 'outline.outlineWidth';
  if (trimmed === 'outlineColor') return 'outline.outlineColor';
  if (trimmed === 'renderOverlay') return 'outline.renderOverlay';
  if (trimmed === 'overlayColor') return 'outline.overlayColor';
  if (trimmed === 'overlayAlpha') return 'outline.overlayAlpha';
  if (trimmed === 'edgesRendering' || trimmed === 'edgesRenderer') return 'outline.edgesRendering';
  if (trimmed === 'edgesWidth') return 'outline.edgesWidth';
  if (trimmed === 'edgesColor') return 'outline.edgesColor';
  return null;
}

function normalizeColor3(value: unknown): ProjectOutlineValue | typeof SKIP {
  if (value == null) return null;
  if (!value || typeof value !== 'object') return SKIP;
  const source = value as {
    r?: unknown;
    g?: unknown;
    b?: unknown;
    _r?: unknown;
    _g?: unknown;
    _b?: unknown;
  };
  const r = typeof source.r === 'number' ? source.r : typeof source._r === 'number' ? source._r : null;
  const g = typeof source.g === 'number' ? source.g : typeof source._g === 'number' ? source._g : null;
  const b = typeof source.b === 'number' ? source.b : typeof source._b === 'number' ? source._b : null;
  if (r == null || g == null || b == null) return SKIP;
  return { r, g, b };
}

function normalizeColor4(value: unknown): ProjectOutlineValue | typeof SKIP {
  if (value == null) return null;
  if (!value || typeof value !== 'object') return SKIP;
  const source = value as {
    r?: unknown;
    g?: unknown;
    b?: unknown;
    a?: unknown;
    _r?: unknown;
    _g?: unknown;
    _b?: unknown;
    _a?: unknown;
  };
  const r = typeof source.r === 'number' ? source.r : typeof source._r === 'number' ? source._r : null;
  const g = typeof source.g === 'number' ? source.g : typeof source._g === 'number' ? source._g : null;
  const b = typeof source.b === 'number' ? source.b : typeof source._b === 'number' ? source._b : null;
  const a = typeof source.a === 'number' ? source.a : typeof source._a === 'number' ? source._a : null;
  if (r == null || g == null || b == null || a == null) return SKIP;
  return { r, g, b, a };
}

function normalizeOutlineValue(
  path: ProjectOutlineProp,
  value: unknown,
): ProjectOutlineValue | typeof SKIP {
  switch (path) {
    case 'outline.renderOutline':
    case 'outline.renderOverlay':
      return typeof value === 'boolean' ? value : SKIP;
    case 'outline.edgesRendering':
      return typeof value === 'boolean' ? value : !!value;
    case 'outline.outlineWidth':
    case 'outline.overlayAlpha':
    case 'outline.edgesWidth':
      if (value == null) return null;
      return typeof value === 'number' && Number.isFinite(value) ? value : SKIP;
    case 'outline.outlineColor':
    case 'outline.overlayColor':
      return normalizeColor3(value);
    case 'outline.edgesColor':
      return normalizeColor4(value);
    default:
      return SKIP;
  }
}

export function adaptOutlinePropertyChange(
  options: AdaptOutlinePropertyChangeOptions,
): CanonicalOutlineChange | null {
  const path = normalizeOutlinePropertyKey(options.propertyKey);
  if (!path) return null;
  const selectedEntity = options.selectedEntity;
  if (!selectedEntity) return null;

  const binding = options.resolveBinding(selectedEntity);
  if (!binding || binding.kind !== 'sceneNode') return null;
  const rootNode = binding.rootNode ?? selectedEntity;
  const owner = resolveOutlineOwnerNode(rootNode);
  if (!owner.ownerNode) return null;

  const ownerNodePath = buildOwnerNodePath(owner.ownerNode, rootNode);
  if (ownerNodePath == null) return null;

  const before = normalizeOutlineValue(path, options.oldValue);
  const after = normalizeOutlineValue(path, options.newValue);
  if (before === SKIP || after === SKIP) return null;
  if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return null;

  return {
    runtimeNode: owner.ownerNode,
    binding,
    ownerNodePath,
    target: ownerNodePath ? 'childOutline' : 'root',
    shared: owner.shared,
    path,
    before,
    after,
  };
}

export function applyOutlineValueToRuntimeNode(
  entity: RuntimeNode | null,
  path: ProjectOutlineProp,
  value: ProjectOutlineValue,
): boolean {
  const { target } = resolveOutlineTarget(entity);
  if (!target) return false;

  switch (path) {
    case 'outline.renderOutline':
      if (typeof value !== 'boolean') return false;
      (target as any).renderOutline = value;
      return true;
    case 'outline.outlineWidth':
      if (value == null) {
        Reflect.deleteProperty(target, 'outlineWidth');
        return true;
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      (target as any).outlineWidth = value;
      return true;
    case 'outline.outlineColor':
      if (value == null) {
        Reflect.deleteProperty(target, 'outlineColor');
        return true;
      }
      if (!value || typeof value !== 'object') return false;
      const color = value as ColorRGB;
      const current = (target as any).outlineColor;
      if (current?.copyFromFloats) {
        current.copyFromFloats(color.r, color.g, color.b);
      } else {
        (target as any).outlineColor = new Color3(color.r, color.g, color.b);
      }
      return true;
    case 'outline.renderOverlay':
      if (typeof value !== 'boolean') return false;
      (target as any).renderOverlay = value;
      return true;
    case 'outline.overlayAlpha':
      if (value == null) {
        Reflect.deleteProperty(target, 'overlayAlpha');
        return true;
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      (target as any).overlayAlpha = value;
      return true;
    case 'outline.overlayColor':
      if (value == null) {
        Reflect.deleteProperty(target, 'overlayColor');
        return true;
      }
      if (!value || typeof value !== 'object') return false;
      const overlayColor = value as ColorRGB;
      const currentOverlay = (target as any).overlayColor;
      if (currentOverlay?.copyFromFloats) {
        currentOverlay.copyFromFloats(overlayColor.r, overlayColor.g, overlayColor.b);
      } else {
        (target as any).overlayColor = new Color3(overlayColor.r, overlayColor.g, overlayColor.b);
      }
      return true;
    case 'outline.edgesRendering':
      if (typeof value !== 'boolean') return false;
      if (value) {
        (target as any).enableEdgesRendering?.();
      } else {
        (target as any).disableEdgesRendering?.();
      }
      return true;
    case 'outline.edgesWidth':
      if (value == null) {
        Reflect.deleteProperty(target, 'edgesWidth');
        return true;
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) return false;
      (target as any).edgesWidth = value;
      return true;
    case 'outline.edgesColor':
      if (value == null) {
        Reflect.deleteProperty(target, 'edgesColor');
        return true;
      }
      if (!value || typeof value !== 'object') return false;
      const edgesColor = value as ColorRGBA;
      const currentEdges = (target as any).edgesColor;
      if (currentEdges?.copyFromFloats) {
        currentEdges.copyFromFloats(edgesColor.r, edgesColor.g, edgesColor.b, edgesColor.a);
      } else {
        (target as any).edgesColor = new Color4(edgesColor.r, edgesColor.g, edgesColor.b, edgesColor.a);
      }
      return true;
    default:
      return false;
  }
}

export function applyOutlinePropertyChange(args: OutlinePropertyChangeArgs): OutlineTargetState {
  const { entity, property, value, initialValue } = args;
  const resolved = resolveOutlineTarget(entity);
  const { target } = resolved;
  if (!target) return resolved;

  const path = normalizeOutlinePropertyKey(property);
  const normalized = path ? normalizeOutlineValue(path, value) : SKIP;
  if (path && normalized !== SKIP) {
    applyOutlineValueToRuntimeNode(target, path, normalized);
  } else {
    try {
      (target as any)[property] = value;
    } catch {}
  }

  if (target !== entity) {
    restoreOriginalOutlineValue(entity, property, initialValue);
  }

  return resolved;
}
