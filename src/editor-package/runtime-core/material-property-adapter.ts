import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';

import type {
  ProjectMaterialProp,
  ProjectMaterialRuntimeKind,
  ProjectMaterialValue,
  ProjectPersistentBinding,
} from '../types';
import type { RuntimeNode, RuntimeScene } from './types';

export const MATERIAL_CANONICAL_PATHS = [
  'material.albedoColor',
  'material.emissiveColor',
  'material.metallic',
  'material.roughness',
  'material.alpha',
  'material.backFaceCulling',
  'material.albedoTexture.url',
  'material.normalTexture.url',
  'material.metallicTexture.url',
  'material.pbr.albedoColor',
  'material.pbr.baseWeight',
  'material.pbr.reflectivityColor',
  'material.pbr.microSurface',
  'material.pbr.emissiveColor',
  'material.pbr.ambientColor',
  'material.pbr.lightFalloff',
  'material.standard.diffuseColor',
  'material.standard.specularColor',
  'material.standard.specularPower',
  'material.standard.emissiveColor',
  'material.standard.ambientColor',
  'material.standard.useSpecularOverAlpha',
] as const satisfies readonly ProjectMaterialProp[];

export type CanonicalMaterialChange = {
  runtimeNode: RuntimeNode;
  binding: ProjectPersistentBinding;
  ownerNodePath: string;
  target: 'root' | 'childMaterial';
  materialName: string;
  materialType: string | null;
  materialRuntimeKind: ProjectMaterialRuntimeKind;
  path: ProjectMaterialProp;
  before: ProjectMaterialValue;
  after: ProjectMaterialValue;
};

type AdaptMaterialPropertyChangeOptions = {
  scene: RuntimeScene | null;
  selectedEntity: RuntimeNode | null;
  entity: any;
  propertyKey: unknown;
  oldValue: unknown;
  newValue: unknown;
  resolveBinding: (node: RuntimeNode) => ProjectPersistentBinding | null;
};

const MATERIAL_SHARED_KEY_TO_PATH: Record<string, ProjectMaterialProp> = {
  alpha: 'material.alpha',
  _alpha: 'material.alpha',
  backFaceCulling: 'material.backFaceCulling',
  _backFaceCulling: 'material.backFaceCulling',
  albedoTexture: 'material.albedoTexture.url',
  _albedoTexture: 'material.albedoTexture.url',
  diffuseTexture: 'material.albedoTexture.url',
  _diffuseTexture: 'material.albedoTexture.url',
  normalTexture: 'material.normalTexture.url',
  _normalTexture: 'material.normalTexture.url',
  bumpTexture: 'material.normalTexture.url',
  _bumpTexture: 'material.normalTexture.url',
  metallicTexture: 'material.metallicTexture.url',
  _metallicTexture: 'material.metallicTexture.url',
};

const MATERIAL_PBR_KEY_TO_PATH: Record<string, ProjectMaterialProp> = {
  albedoColor: 'material.pbr.albedoColor',
  _albedoColor: 'material.pbr.albedoColor',
  baseWeight: 'material.pbr.baseWeight',
  _baseWeight: 'material.pbr.baseWeight',
  reflectivityColor: 'material.pbr.reflectivityColor',
  _reflectivityColor: 'material.pbr.reflectivityColor',
  microSurface: 'material.pbr.microSurface',
  _microSurface: 'material.pbr.microSurface',
  emissiveColor: 'material.pbr.emissiveColor',
  _emissiveColor: 'material.pbr.emissiveColor',
  ambientColor: 'material.pbr.ambientColor',
  _ambientColor: 'material.pbr.ambientColor',
  lightFalloff: 'material.pbr.lightFalloff',
  _lightFalloff: 'material.pbr.lightFalloff',
};

const MATERIAL_STANDARD_KEY_TO_PATH: Record<string, ProjectMaterialProp> = {
  diffuseColor: 'material.standard.diffuseColor',
  _diffuseColor: 'material.standard.diffuseColor',
  specularColor: 'material.standard.specularColor',
  _specularColor: 'material.standard.specularColor',
  specularPower: 'material.standard.specularPower',
  _specularPower: 'material.standard.specularPower',
  emissiveColor: 'material.standard.emissiveColor',
  _emissiveColor: 'material.standard.emissiveColor',
  ambientColor: 'material.standard.ambientColor',
  _ambientColor: 'material.standard.ambientColor',
  useSpecularOverAlpha: 'material.standard.useSpecularOverAlpha',
  _useSpecularOverAlpha: 'material.standard.useSpecularOverAlpha',
};

const SKIP = Symbol('material-property-skip');

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function isMaterialLike(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  const className = value.getClassName?.();
  if (typeof className === 'string' && /material$/i.test(className)) return true;
  return 'albedoColor' in value
    || 'diffuseColor' in value
    || 'reflectivityColor' in value
    || 'specularColor' in value
    || 'metallic' in value
    || 'roughness' in value
    || 'microSurface' in value;
}

function hasMaterial(value: any): value is RuntimeNode & { material: any } {
  return !!value && typeof value === 'object' && !!value.material;
}

export function resolveMaterialRuntimeKind(material: any): ProjectMaterialRuntimeKind {
  if (!material || typeof material !== 'object') return 'unknown';
  const className = typeof material.getClassName === 'function' ? material.getClassName() : '';
  const normalizedClassName = typeof className === 'string' ? className.toLowerCase() : '';
  if (normalizedClassName.includes('standardmaterial')) return 'standard';
  if (normalizedClassName.includes('pbr')) return 'pbr';
  if ('diffuseColor' in material || 'specularColor' in material || 'specularPower' in material) return 'standard';
  if (
    'albedoColor' in material
    || '_albedoColor' in material
    || 'reflectivityColor' in material
    || '_reflectivityColor' in material
    || 'microSurface' in material
    || '_microSurface' in material
  ) {
    return 'pbr';
  }
  return 'unknown';
}

function normalizePropertyKey(
  propertyKey: unknown,
  materialRuntimeKind: ProjectMaterialRuntimeKind,
): ProjectMaterialProp | null {
  if (typeof propertyKey !== 'string') return null;
  const trimmed = propertyKey.trim();
  if (!trimmed) return null;
  if ((MATERIAL_CANONICAL_PATHS as readonly string[]).includes(trimmed)) {
    return trimmed as ProjectMaterialProp;
  }
  const normalized = trimmed.split('.').pop() ?? trimmed;
  if (materialRuntimeKind === 'pbr' && MATERIAL_PBR_KEY_TO_PATH[normalized]) {
    return MATERIAL_PBR_KEY_TO_PATH[normalized]!;
  }
  if (materialRuntimeKind === 'standard' && MATERIAL_STANDARD_KEY_TO_PATH[normalized]) {
    return MATERIAL_STANDARD_KEY_TO_PATH[normalized]!;
  }
  return MATERIAL_SHARED_KEY_TO_PATH[normalized] ?? null;
}

function normalizeColor3(value: unknown): ProjectMaterialValue | typeof SKIP {
  if (!value || typeof value !== 'object') return SKIP;
  const source = value as {
    r?: unknown;
    g?: unknown;
    b?: unknown;
    x?: unknown;
    y?: unknown;
    z?: unknown;
    _r?: unknown;
    _g?: unknown;
    _b?: unknown;
  };
  const r = typeof source.r === 'number'
    ? source.r
    : typeof source.x === 'number'
      ? source.x
      : typeof source._r === 'number'
        ? source._r
        : null;
  const g = typeof source.g === 'number'
    ? source.g
    : typeof source.y === 'number'
      ? source.y
      : typeof source._g === 'number'
        ? source._g
        : null;
  const b = typeof source.b === 'number'
    ? source.b
    : typeof source.z === 'number'
      ? source.z
      : typeof source._b === 'number'
        ? source._b
        : null;
  if (r == null || g == null || b == null) return SKIP;
  return { r, g, b };
}

function normalizeTextureUrl(value: unknown): ProjectMaterialValue | typeof SKIP {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value !== 'object') return SKIP;
  const source = value as { url?: unknown; name?: unknown };
  if (typeof source.url === 'string') return source.url.trim() || null;
  if (typeof source.name === 'string') return source.name.trim() || null;
  return SKIP;
}

function normalizeMaterialValue(
  path: ProjectMaterialProp,
  value: unknown,
): ProjectMaterialValue | typeof SKIP {
  switch (path) {
    case 'material.albedoColor':
    case 'material.emissiveColor':
    case 'material.pbr.albedoColor':
    case 'material.pbr.reflectivityColor':
    case 'material.pbr.emissiveColor':
    case 'material.pbr.ambientColor':
    case 'material.standard.diffuseColor':
    case 'material.standard.specularColor':
    case 'material.standard.emissiveColor':
    case 'material.standard.ambientColor':
      return normalizeColor3(value);
    case 'material.metallic':
    case 'material.roughness':
    case 'material.alpha':
    case 'material.pbr.baseWeight':
    case 'material.pbr.microSurface':
    case 'material.pbr.lightFalloff':
    case 'material.standard.specularPower':
      return typeof value === 'number' && Number.isFinite(value) ? value : SKIP;
    case 'material.backFaceCulling':
    case 'material.standard.useSpecularOverAlpha':
      return typeof value === 'boolean' ? value : SKIP;
    case 'material.albedoTexture.url':
    case 'material.normalTexture.url':
    case 'material.metallicTexture.url':
      return normalizeTextureUrl(value);
    default:
      return SKIP;
  }
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

function matchesNodeSegment(candidate: string | null, expected: string): boolean {
  if (!candidate) return false;
  if (candidate === expected) return true;
  const suffix = candidate.includes(':') ? candidate.slice(candidate.lastIndexOf(':') + 1) : candidate;
  return suffix === expected;
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

function findMaterialOwnerInRoot(rootNode: RuntimeNode | null, material: any): RuntimeNode | null {
  if (!rootNode) return null;
  if ((rootNode as any).material === material) return rootNode;
  const childMeshes = rootNode.getChildMeshes?.(false) ?? [];
  return childMeshes.find((mesh: any) => mesh?.material === material) ?? null;
}

function findMaterialOwnerInScene(scene: RuntimeScene | null, material: any): RuntimeNode | null {
  const meshes = scene?.meshes ?? [];
  return meshes.find((mesh: any) => mesh?.material === material) ?? null;
}

function resolveRuntimeMaterialProperty(material: any, path: ProjectMaterialProp): string | null {
  switch (path) {
    case 'material.albedoColor':
      return 'albedoColor' in material ? 'albedoColor' : 'diffuseColor' in material ? 'diffuseColor' : null;
    case 'material.emissiveColor':
      return 'emissiveColor' in material ? 'emissiveColor' : null;
    case 'material.metallic':
      return 'metallic' in material ? 'metallic' : null;
    case 'material.roughness':
      return 'roughness' in material ? 'roughness' : null;
    case 'material.alpha':
      return 'alpha' in material ? 'alpha' : null;
    case 'material.backFaceCulling':
      return 'backFaceCulling' in material ? 'backFaceCulling' : null;
    case 'material.albedoTexture.url':
      return 'albedoTexture' in material ? 'albedoTexture' : 'diffuseTexture' in material ? 'diffuseTexture' : null;
    case 'material.normalTexture.url':
      return 'normalTexture' in material ? 'normalTexture' : 'bumpTexture' in material ? 'bumpTexture' : null;
    case 'material.metallicTexture.url':
      return 'metallicTexture' in material ? 'metallicTexture' : null;
    case 'material.pbr.albedoColor':
      return '_albedoColor' in material ? '_albedoColor' : 'albedoColor' in material ? 'albedoColor' : null;
    case 'material.pbr.baseWeight':
      return '_baseWeight' in material ? '_baseWeight' : 'baseWeight' in material ? 'baseWeight' : null;
    case 'material.pbr.reflectivityColor':
      return '_reflectivityColor' in material ? '_reflectivityColor' : 'reflectivityColor' in material ? 'reflectivityColor' : null;
    case 'material.pbr.microSurface':
      return '_microSurface' in material ? '_microSurface' : 'microSurface' in material ? 'microSurface' : null;
    case 'material.pbr.emissiveColor':
      return '_emissiveColor' in material ? '_emissiveColor' : 'emissiveColor' in material ? 'emissiveColor' : null;
    case 'material.pbr.ambientColor':
      return '_ambientColor' in material ? '_ambientColor' : 'ambientColor' in material ? 'ambientColor' : null;
    case 'material.pbr.lightFalloff':
      return '_lightFalloff' in material ? '_lightFalloff' : 'lightFalloff' in material ? 'lightFalloff' : null;
    case 'material.standard.diffuseColor':
      return 'diffuseColor' in material ? 'diffuseColor' : '_diffuseColor' in material ? '_diffuseColor' : null;
    case 'material.standard.specularColor':
      return 'specularColor' in material ? 'specularColor' : '_specularColor' in material ? '_specularColor' : null;
    case 'material.standard.specularPower':
      return 'specularPower' in material ? 'specularPower' : '_specularPower' in material ? '_specularPower' : null;
    case 'material.standard.emissiveColor':
      return 'emissiveColor' in material ? 'emissiveColor' : '_emissiveColor' in material ? '_emissiveColor' : null;
    case 'material.standard.ambientColor':
      return 'ambientColor' in material ? 'ambientColor' : '_ambientColor' in material ? '_ambientColor' : null;
    case 'material.standard.useSpecularOverAlpha':
      return 'useSpecularOverAlpha' in material
        ? 'useSpecularOverAlpha'
        : '_useSpecularOverAlpha' in material
          ? '_useSpecularOverAlpha'
          : null;
    default:
      return null;
  }
}

function resolveMaterialOwner(
  options: AdaptMaterialPropertyChangeOptions,
  material: any,
): {
  runtimeNode: RuntimeNode;
  binding: ProjectPersistentBinding;
  ownerNodePath: string;
} | null {
  const explicitOwner = hasMaterial(options.entity) && options.entity.material === material
    ? options.entity
    : null;

  const candidateBindings: Array<{ owner: RuntimeNode | null; binding: ProjectPersistentBinding | null }> = [];
  if (options.selectedEntity) {
    const selectedBinding = options.resolveBinding(options.selectedEntity);
    const selectedOwner = findMaterialOwnerInRoot(selectedBinding?.rootNode ?? options.selectedEntity, material);
    candidateBindings.push({
      owner: selectedOwner,
      binding: selectedOwner
        ? (options.resolveBinding(selectedOwner) ?? selectedBinding)
        : selectedBinding,
    });
  }
  if (explicitOwner) {
    candidateBindings.push({ owner: explicitOwner, binding: options.resolveBinding(explicitOwner) });
  }
  const sceneOwner = findMaterialOwnerInScene(options.scene, material);
  if (sceneOwner) {
    candidateBindings.push({ owner: sceneOwner, binding: options.resolveBinding(sceneOwner) });
  }

  for (const candidate of candidateBindings) {
    if (!candidate.owner || !candidate.binding) continue;
    const ownerNodePath = buildOwnerNodePath(candidate.owner, candidate.binding.rootNode);
    if (ownerNodePath == null) continue;
    return {
      runtimeNode: candidate.owner,
      binding: candidate.binding,
      ownerNodePath,
    };
  }
  return null;
}

export function adaptMaterialPropertyChange(
  options: AdaptMaterialPropertyChangeOptions,
): CanonicalMaterialChange | null {
  const material = hasMaterial(options.entity)
    ? options.entity.material
    : isMaterialLike(options.entity)
      ? options.entity
      : null;
  if (!material) return null;
  const materialRuntimeKind = resolveMaterialRuntimeKind(material);
  const path = normalizePropertyKey(options.propertyKey, materialRuntimeKind);
  if (!path) return null;

  const owner = resolveMaterialOwner(options, material);
  if (!owner) return null;

  const before = normalizeMaterialValue(path, options.oldValue);
  const after = normalizeMaterialValue(path, options.newValue);
  if (before === SKIP || after === SKIP || sameValue(before, after)) return null;

  return {
    runtimeNode: owner.runtimeNode,
    binding: owner.binding,
    ownerNodePath: owner.ownerNodePath,
    target: owner.ownerNodePath ? 'childMaterial' : 'root',
    materialName: typeof material.name === 'string' && material.name.trim() ? material.name.trim() : '(unnamed-material)',
    materialType: typeof material.getClassName === 'function' ? material.getClassName() : null,
    materialRuntimeKind,
    path,
    before,
    after,
  };
}

export function applyMaterialValueToRuntimeMaterial(
  material: any,
  scene: RuntimeScene | null,
  path: ProjectMaterialProp,
  value: ProjectMaterialValue,
): boolean {
  if (!material || typeof material !== 'object') return false;

  const property = resolveRuntimeMaterialProperty(material, path);
  if (!property) return false;

  if (
    path === 'material.albedoColor'
    || path === 'material.emissiveColor'
    || path === 'material.pbr.albedoColor'
    || path === 'material.pbr.reflectivityColor'
    || path === 'material.pbr.emissiveColor'
    || path === 'material.pbr.ambientColor'
    || path === 'material.standard.diffuseColor'
    || path === 'material.standard.specularColor'
    || path === 'material.standard.emissiveColor'
    || path === 'material.standard.ambientColor'
  ) {
    if (!value || typeof value !== 'object') return false;
    const color = value as { r: number; g: number; b: number };
    const target = material[property];
    if (target?.copyFromFloats) {
      target.copyFromFloats(color.r, color.g, color.b);
      return true;
    }
    material[property] = new Color3(color.r, color.g, color.b);
    return true;
  }

  if (path === 'material.albedoTexture.url' || path === 'material.normalTexture.url' || path === 'material.metallicTexture.url') {
    if (value == null) {
      material[property] = null;
      return true;
    }
    if (typeof value !== 'string' || !scene) return false;
    material[property] = new Texture(value, scene, false, false);
    return true;
  }

  material[property] = value;
  return true;
}

export function resolveMaterialOwnerNode(rootNode: RuntimeNode | null, ownerNodePath: string): RuntimeNode | null {
  if (!rootNode) return null;
  if (!ownerNodePath) return rootNode;

  const segments = ownerNodePath.split('/').filter(Boolean);
  let current: any = rootNode;
  let index = 0;
  if (segments.length > 0 && matchesNodeSegment(stableNodeSegment(current), segments[0]!)) {
    index = 1;
  }
  for (; index < segments.length; index += 1) {
    const segment = segments[index]!;
    const children = current?.getChildren?.() ?? [];
    const next = children.find((child: any) => matchesNodeSegment(stableNodeSegment(child), segment)) ?? null;
    if (!next) return null;
    current = next;
  }
  return current;
}

export function applyMaterialValueToRuntimeNode(
  ownerNode: RuntimeNode | null,
  scene: RuntimeScene | null,
  path: ProjectMaterialProp,
  value: ProjectMaterialValue,
): boolean {
  return applyMaterialValueToRuntimeMaterial((ownerNode as any)?.material, scene, path, value);
}
