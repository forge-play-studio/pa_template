import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';

export interface DebugOverlayGroup {
  root: TransformNode;
  clear(): void;
  dispose(): void;
}

export function createDebugOverlayGroup(scene: Scene, id: string): DebugOverlayGroup {
  const root = new TransformNode(`debugOverlay.${id}`, scene);
  return {
    root,
    clear() {
      for (const child of root.getChildTransformNodes(false)) child.dispose();
      for (const mesh of root.getChildMeshes(false)) mesh.dispose();
    },
    dispose() {
      root.dispose();
    },
  };
}

export function drawDebugPoint(
  group: DebugOverlayGroup,
  id: string,
  position: Vector3,
  color = new Color3(0.2, 0.8, 1),
): void {
  const scene = group.root.getScene();
  const marker = MeshBuilder.CreateSphere(`debugPoint.${id}`, { diameter: 0.22 }, scene);
  marker.position.copyFrom(position);
  marker.parent = group.root;
  marker.material = createDebugMaterial(scene, `debugPoint.${id}.material`, color);
}

export function drawDebugPath(
  group: DebugOverlayGroup,
  id: string,
  points: Vector3[],
  color = new Color3(1, 0.8, 0.2),
): void {
  if (points.length < 2) return;
  const scene = group.root.getScene();
  const lines = MeshBuilder.CreateLines(`debugPath.${id}`, { points }, scene);
  lines.color = color;
  lines.parent = group.root;
}

function createDebugMaterial(scene: Scene, name: string, color: Color3): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(0.35);
  return material;
}
