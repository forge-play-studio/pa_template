import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Material } from '@babylonjs/core/Materials/material';
import type { Scene } from '@babylonjs/core/scene';

type MaterialRuntimeState = {
  instanceId: string;
  values: Record<string, unknown>;
};

const NUMBER_FIELDS = ['alpha', 'transparencyMode', 'metallic', 'roughness', 'microSurface', 'emissiveIntensity'] as const;
const BOOLEAN_FIELDS = ['backFaceCulling', 'disableDepthWrite', 'needDepthPrePass'] as const;
const COLOR_FIELDS = ['albedoColor', 'diffuseColor', 'emissiveColor'] as const;

export function captureMaterialRuntimeState(scene: Scene | null, instanceId: string): MaterialRuntimeState | null {
  const material = findMaterial(scene, instanceId);
  if (!material) return null;
  const candidate = material as Material & Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const field of NUMBER_FIELDS) {
    if (typeof candidate[field] === 'number') values[field] = candidate[field];
  }
  for (const field of BOOLEAN_FIELDS) {
    if (typeof candidate[field] === 'boolean') values[field] = candidate[field];
  }
  for (const field of COLOR_FIELDS) {
    const color = readColor(candidate[field]);
    if (color) values[field] = color;
  }
  return { instanceId, values };
}

export function previewMaterialRuntimeState(
  scene: Scene | null,
  instanceId: string,
  set: Record<string, unknown>,
): boolean {
  const material = findMaterial(scene, instanceId);
  if (!material) return false;
  const candidate = material as Material & Record<string, unknown>;
  for (const [field, value] of Object.entries(set)) {
    if (!(field in candidate)) return false;
    if ((COLOR_FIELDS as readonly string[]).includes(field)) {
      const color = readColor(value);
      const current = candidate[field] as { copyFromFloats?: (r: number, g: number, b: number) => void } | null;
      if (!color || typeof current?.copyFromFloats !== 'function') return false;
      current.copyFromFloats(color[0], color[1], color[2]);
    } else {
      candidate[field] = value;
    }
  }
  return true;
}

export function restoreMaterialRuntimeState(scene: Scene | null, state: unknown): boolean {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const record = state as MaterialRuntimeState;
  if (typeof record.instanceId !== 'string' || !record.values || typeof record.values !== 'object') return false;
  return previewMaterialRuntimeState(scene, record.instanceId, record.values);
}

function findMaterial(scene: Scene | null, instanceId: string): Material | null {
  if (!scene) return null;
  return scene.materials.find(material => String(material.uniqueId) === instanceId) ?? null;
}

function readColor(value: unknown): [number, number, number] | null {
  if (Array.isArray(value) && value.length === 3
    && value.every(channel => typeof channel === 'number' && Number.isFinite(channel))) {
    return [Number(value[0]), Number(value[1]), Number(value[2])];
  }
  if (!value || typeof value !== 'object') return null;
  const color = value as Color3;
  if (![color.r, color.g, color.b].every(channel => typeof channel === 'number' && Number.isFinite(channel))) return null;
  return [color.r, color.g, color.b];
}
