import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { RuntimeInspectorObjectKind } from './schema';

export type BabylonRuntimeNode = TransformNode;

export type BabylonMeshVisibilityState = {
  isVisible: boolean;
  visibility: number;
};

export function listBabylonRuntimeNodes(scene: Scene): BabylonRuntimeNode[] {
  const nodes = new Map<string, BabylonRuntimeNode>();
  for (const node of [...scene.transformNodes, ...scene.meshes]) {
    if (!node) continue;
    nodes.set(String(node.uniqueId), node);
  }
  return [...nodes.values()].sort(compareNodes);
}

export function getBabylonNodeKind(node: BabylonRuntimeNode): RuntimeInspectorObjectKind {
  const className = node.getClassName?.() ?? node.constructor?.name ?? 'TransformNode';
  if (className === 'InstancedMesh') return 'instancedMesh';
  if (hasMeshFields(node)) return 'mesh';
  return 'transformNode';
}

export function getBabylonNodeClassName(node: BabylonRuntimeNode): string {
  return node.getClassName?.() ?? node.constructor?.name ?? 'TransformNode';
}

export function isBabylonNodeDisposed(node: BabylonRuntimeNode): boolean {
  return typeof node.isDisposed === 'function' ? node.isDisposed() : false;
}

export function isBabylonNodeEnabled(node: BabylonRuntimeNode): boolean {
  return typeof node.isEnabled === 'function' ? node.isEnabled() : true;
}

export function readBabylonNodeVisible(node: BabylonRuntimeNode): boolean | null {
  return hasMeshFields(node) ? node.isVisible : null;
}

export function isBabylonMeshNode(node: BabylonRuntimeNode): node is AbstractMesh {
  return hasMeshFields(node);
}

export function readBabylonMeshVisibility(
  node: BabylonRuntimeNode,
): BabylonMeshVisibilityState | null {
  if (!hasMeshFields(node)) return null;
  return {
    isVisible: node.isVisible,
    visibility: node.visibility,
  };
}

export function writeBabylonMeshVisibility(
  node: BabylonRuntimeNode,
  state: BabylonMeshVisibilityState,
): void {
  if (!hasMeshFields(node)) return;
  node.isVisible = state.isVisible;
  node.visibility = state.visibility;
}

export function readBabylonNodeMaterial(node: BabylonRuntimeNode): { name: string; uniqueId: string } | null {
  if (!hasMeshFields(node) || !node.material) return null;
  return {
    name: String(node.material.name ?? ''),
    uniqueId: String(node.material.uniqueId),
  };
}

export function readBabylonNodeGeometry(node: BabylonRuntimeNode): { uniqueId: string } | null {
  if (!hasMeshFields(node) || !node.geometry) return null;
  return { uniqueId: String(node.geometry.uniqueId) };
}

export function readBabylonNodeSkeleton(node: BabylonRuntimeNode): { name: string; uniqueId: string } | null {
  if (!hasMeshFields(node) || !node.skeleton) return null;
  return {
    name: String(node.skeleton.name ?? ''),
    uniqueId: String(node.skeleton.uniqueId),
  };
}

export function readBabylonSourceMesh(node: BabylonRuntimeNode): BabylonRuntimeNode | null {
  if (getBabylonNodeKind(node) !== 'instancedMesh') return null;
  const sourceMesh = (node as AbstractMesh & { sourceMesh?: AbstractMesh | null }).sourceMesh;
  return sourceMesh ?? null;
}

export function readBabylonBoundingBox(node: BabylonRuntimeNode): {
  minimumWorld: [number, number, number];
  maximumWorld: [number, number, number];
} | null {
  if (!hasMeshFields(node)) return null;
  try {
    node.computeWorldMatrix(true);
    const boundingBox = node.getBoundingInfo().boundingBox;
    const minimumWorld = vector3(boundingBox.minimumWorld);
    const maximumWorld = vector3(boundingBox.maximumWorld);
    if (!minimumWorld || !maximumWorld) return null;
    return {
      minimumWorld,
      maximumWorld,
    };
  } catch {
    return null;
  }
}

export function readBabylonAbsolutePosition(node: BabylonRuntimeNode): [number, number, number] | null {
  try {
    node.computeWorldMatrix(true);
    return vector3(node.getAbsolutePosition());
  } catch {
    return null;
  }
}

export function readBabylonAbsoluteScaling(node: BabylonRuntimeNode): [number, number, number] | null {
  try {
    node.computeWorldMatrix(true);
    return vector3(node.absoluteScaling);
  } catch {
    return null;
  }
}

export function readBabylonEngineVersion(scene: Scene): string | null {
  const engine = scene.getEngine() as unknown as {
    version?: unknown;
    constructor?: { Version?: unknown };
  };
  return readString(engine.version) ?? readString(engine.constructor?.Version);
}

export function readBabylonSceneId(scene: Scene): string {
  const value = (scene as unknown as { uid?: unknown; uniqueId?: unknown }).uid
    ?? (scene as unknown as { uniqueId?: unknown }).uniqueId;
  return value === undefined || value === null ? 'scene:unknown' : String(value);
}

export function vector3(value: { x: number; y: number; z: number } | null | undefined): [number, number, number] | null {
  return value ? [round(value.x), round(value.y), round(value.z)] : null;
}

export function quaternion(value: { x: number; y: number; z: number; w: number } | null | undefined): [number, number, number, number] | null {
  return value ? [round(value.x), round(value.y), round(value.z), round(value.w)] : null;
}

function hasMeshFields(node: BabylonRuntimeNode): node is AbstractMesh {
  return 'isVisible' in node && typeof (node as AbstractMesh).getBoundingInfo === 'function';
}

function compareNodes(left: BabylonRuntimeNode, right: BabylonRuntimeNode): number {
  return Number(left.uniqueId) - Number(right.uniqueId);
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
