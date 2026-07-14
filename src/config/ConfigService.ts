/**
 * ConfigService - 配置服务
 *
 * 职责：
 * - 统一管理项目配置
 * - 以当前 scene json 作为主配置模型
 */

import type {
  SceneConfig,
  GameConfig,
  SceneAssetConfig,
  SceneAssetMaterialMode,
  SceneCameraRigConfig,
  SceneCameraProjection,
  SceneDirectionalLightConfig,
  SceneHemisphericLightConfig,
  SceneMaterialAssetConfig,
  SceneNodeMaterialBindingConfig,
  SceneInstanceNode,
  SceneLightConfig,
  ScenePrimitiveNode,
  SceneMaterialScope,
  SceneNodeVisualOverrides,
  MaterialOverrideConfig,
  MaterialTextureOverrideConfig,
  ArtistMaterialProfile,
  ArtistMaterialTextureRef,
  PbrMaterialLightingOverrideConfig,
  OutlineOverrideConfig,
  ColorRGB,
  SceneSharedMaterialConfig,
  SceneNodeConfig,
  StandardMaterialLightingOverrideConfig,
  SceneVfxConfig,
  LayoutPlaceholderSurfaceConfig,
  GroundOverlayPlaneConfig,
  GameplayBindingConfig,
  SceneTransformNode,
  TransformConfig,
} from './types';
import {
  normalizeEditorSceneMaterialSlotOwnerPath,
} from '@fps-games/editor/playable-sdk';

import sceneConfigJson from './scene.json';
import gameConfigJson from './game.json';
import renderingConfigJson from './rendering.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeColorRGB(value: unknown): ColorRGB | undefined {
  if (!isRecord(value)) return undefined;
  const r = typeof value.r === 'number' && Number.isFinite(value.r) ? value.r : undefined;
  const g = typeof value.g === 'number' && Number.isFinite(value.g) ? value.g : undefined;
  const b = typeof value.b === 'number' && Number.isFinite(value.b) ? value.b : undefined;
  if (r == null || g == null || b == null) return undefined;
  return { r, g, b };
}

function normalizePosition3D(value: unknown): TransformConfig['position'] | undefined {
  if (!isRecord(value)) return undefined;
  const x = typeof value.x === 'number' && Number.isFinite(value.x) ? value.x : undefined;
  const y = typeof value.y === 'number' && Number.isFinite(value.y) ? value.y : undefined;
  const z = typeof value.z === 'number' && Number.isFinite(value.z) ? value.z : undefined;
  if (x == null || y == null || z == null) return undefined;
  return { x, y, z };
}

function normalizeScale3D(value: unknown): Exclude<TransformConfig['scale'], number> | undefined {
  if (!isRecord(value)) return undefined;
  const x = typeof value.x === 'number' && Number.isFinite(value.x) ? value.x : undefined;
  const y = typeof value.y === 'number' && Number.isFinite(value.y) ? value.y : undefined;
  const z = typeof value.z === 'number' && Number.isFinite(value.z) ? value.z : undefined;
  if (x == null || y == null || z == null) return undefined;
  return { x, y, z };
}

function normalizeTransformConfig(value: unknown): TransformConfig | undefined {
  if (!isRecord(value)) return undefined;

  const normalized: TransformConfig = {};
  const position = normalizePosition3D(value.position);
  if (position) normalized.position = position;
  const rotationDeg = normalizePosition3D(value.rotationDeg);
  if (rotationDeg) normalized.rotationDeg = rotationDeg;
  const rotation = normalizePosition3D(value.rotation);
  if (rotation) normalized.rotation = rotation;

  if (typeof value.scale === 'number' && Number.isFinite(value.scale)) {
    normalized.scale = value.scale;
  } else {
    const scale = normalizeScale3D(value.scale);
    if (scale) normalized.scale = scale;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isUnitRangeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function normalizeCameraProjection(value: unknown): SceneCameraProjection {
  return value === 'perspective' ? 'perspective' : 'orthographic';
}

function readRenderingCameraFovDefault(): number {
  const camera = (renderingConfigJson as Record<string, any>).globalVolume?.camera;
  return isPositiveFiniteNumber(camera?.fov) ? camera.fov : 0.85;
}

function normalizeCameraScreenOffset(value: unknown): SceneCameraRigConfig['targetScreenOffset'] | undefined {
  if (!isRecord(value)) return undefined;
  const x = isFiniteNumber(value.x) ? value.x : undefined;
  const y = isFiniteNumber(value.y) ? value.y : undefined;
  if (x == null || y == null) return undefined;
  return { x, y };
}

function normalizeSceneCameraRigConfig(value: unknown): SceneCameraRigConfig | undefined {
  if (!isRecord(value)) return undefined;
  if (!isFiniteNumber(value.alpha)) return undefined;
  if (!isFiniteNumber(value.beta)) return undefined;
  if (!isPositiveFiniteNumber(value.radius)) return undefined;
  if (!isPositiveFiniteNumber(value.orthoSize)) return undefined;

  const normalized: SceneCameraRigConfig = {
    projection: normalizeCameraProjection(value.projection),
    alpha: value.alpha,
    beta: value.beta,
    radius: value.radius,
    orthoSize: value.orthoSize,
    fov: isPositiveFiniteNumber(value.fov) ? value.fov : readRenderingCameraFovDefault(),
  };

  const targetOffset = normalizePosition3D(value.targetOffset);
  if (targetOffset) normalized.targetOffset = targetOffset;

  if (isPositiveFiniteNumber(value.minZ)) normalized.minZ = value.minZ;
  if (isPositiveFiniteNumber(value.maxZ) && (normalized.minZ == null || value.maxZ > normalized.minZ)) normalized.maxZ = value.maxZ;

  if (isFiniteNumber(value.lowerBetaLimit)) normalized.lowerBetaLimit = value.lowerBetaLimit;
  if (isFiniteNumber(value.upperBetaLimit) && (normalized.lowerBetaLimit == null || value.upperBetaLimit >= normalized.lowerBetaLimit)) {
    normalized.upperBetaLimit = value.upperBetaLimit;
  }

  if (isPositiveFiniteNumber(value.lowerRadiusLimit)) normalized.lowerRadiusLimit = value.lowerRadiusLimit;
  if (isPositiveFiniteNumber(value.upperRadiusLimit) && (normalized.lowerRadiusLimit == null || value.upperRadiusLimit >= normalized.lowerRadiusLimit)) {
    normalized.upperRadiusLimit = value.upperRadiusLimit;
  }

  if (isUnitRangeNumber(value.inertia)) normalized.inertia = value.inertia;

  const targetScreenOffset = normalizeCameraScreenOffset(value.targetScreenOffset);
  if (targetScreenOffset) normalized.targetScreenOffset = targetScreenOffset;

  return normalized;
}

function normalizeSceneDirectionalLightConfig(value: unknown): SceneDirectionalLightConfig | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type !== 'directional') return undefined;
  if (!isNonNegativeFiniteNumber(value.intensity)) return undefined;
  const direction = normalizePosition3D(value.direction);
  if (!direction) return undefined;
  const diffuseColor = normalizeColorRGB(value.diffuseColor);
  return {
    type: 'directional',
    intensity: value.intensity,
    direction,
    ...(diffuseColor ? { diffuseColor } : {}),
  };
}

function normalizeSceneHemisphericLightConfig(value: unknown): SceneHemisphericLightConfig | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type !== 'hemispheric') return undefined;
  if (!isNonNegativeFiniteNumber(value.intensity)) return undefined;
  const diffuseColor = normalizeColorRGB(value.diffuseColor);
  const groundColor = normalizeColorRGB(value.groundColor);
  return {
    type: 'hemispheric',
    intensity: value.intensity,
    ...(diffuseColor ? { diffuseColor } : {}),
    ...(groundColor ? { groundColor } : {}),
  };
}

function normalizeSceneLightConfig(value: unknown): SceneLightConfig | undefined {
  return normalizeSceneHemisphericLightConfig(value)
    ?? normalizeSceneDirectionalLightConfig(value);
}

function normalizeSceneAssetMaterialMode(value: unknown): SceneAssetMaterialMode | undefined {
  return value === 'shared' || value === 'instance' ? value : undefined;
}

function normalizeTextureOverride(value: unknown): MaterialTextureOverrideConfig | undefined {
  if (!isRecord(value)) return undefined;
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  if (!url) return undefined;
  return { url };
}

function normalizeArtistMaterialTextureRef(value: unknown): ArtistMaterialTextureRef | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  const textureAssetId = typeof value.textureAssetId === 'string' ? value.textureAssetId.trim() : '';
  if (!url && !textureAssetId) return undefined;
  return {
    ...(url ? { url } : {}),
    ...(textureAssetId ? { textureAssetId } : {}),
  };
}

function normalizeArtistBaseColorProfile(value: unknown): ArtistMaterialProfile['baseColor'] | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: NonNullable<ArtistMaterialProfile['baseColor']> = {};
  const color = normalizeColorRGB(value.color);
  if (color) normalized.color = color;
  const texture = normalizeArtistMaterialTextureRef(value.texture);
  if (texture !== undefined) normalized.texture = texture;
  if (isFiniteNumber(value.brightness)) normalized.brightness = value.brightness;
  if (isFiniteNumber(value.saturation)) normalized.saturation = value.saturation;
  if (isFiniteNumber(value.contrast)) normalized.contrast = value.contrast;
  if (isFiniteNumber(value.hue)) normalized.hue = value.hue;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeArtistNormalProfile(value: unknown): ArtistMaterialProfile['normal'] | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: NonNullable<ArtistMaterialProfile['normal']> = {};
  const texture = normalizeArtistMaterialTextureRef(value.texture);
  if (texture !== undefined) normalized.texture = texture;
  if (isFiniteNumber(value.strength)) normalized.strength = value.strength;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeArtistMetallicRoughnessProfile(value: unknown): ArtistMaterialProfile['metallicRoughness'] | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: NonNullable<ArtistMaterialProfile['metallicRoughness']> = {};
  const texture = normalizeArtistMaterialTextureRef(value.texture);
  if (texture !== undefined) normalized.texture = texture;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeArtistOcclusionProfile(value: unknown): ArtistMaterialProfile['occlusion'] | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: NonNullable<ArtistMaterialProfile['occlusion']> = {};
  const texture = normalizeArtistMaterialTextureRef(value.texture);
  if (texture !== undefined) normalized.texture = texture;
  if (isFiniteNumber(value.strength)) normalized.strength = value.strength;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeArtistEmissionProfile(value: unknown): ArtistMaterialProfile['emission'] | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: NonNullable<ArtistMaterialProfile['emission']> = {};
  const color = normalizeColorRGB(value.color);
  if (color) normalized.color = color;
  if (isFiniteNumber(value.intensity)) normalized.intensity = value.intensity;
  const texture = normalizeArtistMaterialTextureRef(value.texture);
  if (texture !== undefined) normalized.texture = texture;
  const maskTexture = normalizeArtistMaterialTextureRef(value.maskTexture);
  if (maskTexture !== undefined) normalized.maskTexture = maskTexture;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeArtistAlphaMode(value: unknown): NonNullable<ArtistMaterialProfile['alpha']>['mode'] | undefined {
  return value === 'opaque' || value === 'mask' || value === 'blend' ? value : undefined;
}

function normalizeArtistMaterialLightingModel(value: unknown): ArtistMaterialProfile['lightingModel'] | undefined {
  return value === 'lit' || value === 'unlit' ? value : undefined;
}

function normalizeArtistAlphaProfile(value: unknown): ArtistMaterialProfile['alpha'] | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: NonNullable<ArtistMaterialProfile['alpha']> = {};
  const mode = normalizeArtistAlphaMode(value.mode);
  if (mode) normalized.mode = mode;
  if (isFiniteNumber(value.opacity)) normalized.opacity = value.opacity;
  if (isFiniteNumber(value.cutoff)) normalized.cutoff = value.cutoff;
  const texture = normalizeArtistMaterialTextureRef(value.texture);
  if (texture !== undefined) normalized.texture = texture;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeArtistMaterialProfile(value: unknown): ArtistMaterialProfile | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: ArtistMaterialProfile = {};
  const lightingModel = normalizeArtistMaterialLightingModel(value.lightingModel);
  if (lightingModel) normalized.lightingModel = lightingModel;
  const baseColor = normalizeArtistBaseColorProfile(value.baseColor);
  if (baseColor) normalized.baseColor = baseColor;
  const normal = normalizeArtistNormalProfile(value.normal);
  if (normal) normalized.normal = normal;
  if (isFiniteNumber(value.metallic)) normalized.metallic = value.metallic;
  if (isFiniteNumber(value.roughness)) normalized.roughness = value.roughness;
  const metallicRoughness = normalizeArtistMetallicRoughnessProfile(value.metallicRoughness);
  if (metallicRoughness) normalized.metallicRoughness = metallicRoughness;
  const occlusion = normalizeArtistOcclusionProfile(value.occlusion);
  if (occlusion) normalized.occlusion = occlusion;
  const emission = normalizeArtistEmissionProfile(value.emission);
  if (emission) normalized.emission = emission;
  const alpha = normalizeArtistAlphaProfile(value.alpha);
  if (alpha) normalized.alpha = alpha;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeSceneMaterialAssetKind(value: unknown): SceneMaterialAssetConfig['materialKind'] | undefined {
  return value === 'pbr' || value === 'standard' ? value : undefined;
}

function normalizeSceneMaterialAssetSystemConfig(value: unknown): SceneMaterialAssetConfig['system'] | undefined {
  if (!isRecord(value)) return undefined;
  const readonly = value.readonly === true;
  const preset = value.preset === 'default-pbr' || value.preset === 'default-standard'
    ? value.preset
    : undefined;
  if (!readonly && !preset) return undefined;
  return {
    ...(readonly ? { readonly } : {}),
    ...(preset ? { preset } : {}),
  };
}

function inferSceneMaterialAssetKindFromSystemPreset(
  preset: unknown,
): SceneMaterialAssetConfig['materialKind'] | undefined {
  if (preset === 'default-pbr') return 'pbr';
  if (preset === 'default-standard') return 'standard';
  return undefined;
}

function normalizeSceneMaterialAssetOrigin(value: unknown): SceneMaterialAssetConfig['origin'] | undefined {
  if (!isRecord(value)) return undefined;
  const type = value.type === 'imported'
    || value.type === 'created'
    || value.type === 'duplicated'
    || value.type === 'preset'
    ? value.type
    : undefined;
  if (!type) return undefined;
  const sourceAssetGuid = typeof value.sourceAssetGuid === 'string' ? value.sourceAssetGuid.trim() : '';
  const sourceAssetId = typeof value.sourceAssetId === 'string' ? value.sourceAssetId.trim() : '';
  const sourceSlotId = typeof value.sourceSlotId === 'string' ? value.sourceSlotId.trim() : '';
  const sourceMaterialName = typeof value.sourceMaterialName === 'string' ? value.sourceMaterialName.trim() : '';
  const sourceMaterialAssetId = typeof value.sourceMaterialAssetId === 'string' ? value.sourceMaterialAssetId.trim() : '';
  return {
    type,
    ...(sourceAssetGuid ? { sourceAssetGuid } : {}),
    ...(sourceAssetId ? { sourceAssetId } : {}),
    ...(sourceSlotId ? { sourceSlotId } : {}),
    ...(Number.isInteger(value.sourceMaterialIndex) ? { sourceMaterialIndex: value.sourceMaterialIndex as number } : {}),
    ...(sourceMaterialName ? { sourceMaterialName } : {}),
    ...(sourceMaterialAssetId ? { sourceMaterialAssetId } : {}),
  };
}

function normalizeSceneMaterialAsset(value: unknown): SceneMaterialAssetConfig | undefined {
  if (!isRecord(value)) return undefined;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const guid = typeof value.guid === 'string' ? value.guid.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const profile = normalizeArtistMaterialProfile(value.profile);
  if (!id || !name || !profile) return undefined;
  const system = normalizeSceneMaterialAssetSystemConfig(value.system);
  const origin = normalizeSceneMaterialAssetOrigin(value.origin);
  const materialKind = normalizeSceneMaterialAssetKind(value.materialKind);
  const presetKind = inferSceneMaterialAssetKindFromSystemPreset(system?.preset);
  if (materialKind && presetKind && materialKind !== presetKind) return undefined;
  return {
    id,
    ...(guid ? { guid } : {}),
    name,
    profile,
    ...(materialKind ?? presetKind ? { materialKind: materialKind ?? presetKind } : {}),
    ...(system ? { system } : {}),
    ...(origin ? { origin } : {}),
  };
}

function normalizeSceneNodeMaterialBinding(value: unknown): SceneNodeMaterialBindingConfig | undefined {
  if (!isRecord(value)) return undefined;
  const materialAssetId = typeof value.materialAssetId === 'string' ? value.materialAssetId.trim() : '';
  const override = normalizeArtistMaterialProfile(value.override);
  if (!materialAssetId && !override) return undefined;
  return {
    ...(materialAssetId ? { materialAssetId } : {}),
    ...(override ? { override } : {}),
  };
}

function normalizeSceneNodeMaterialBindingMap(value: unknown): Record<string, SceneNodeMaterialBindingConfig> | undefined {
  if (!isRecord(value)) return undefined;
  const normalized = Object.fromEntries(
    Object.entries(value)
      .map(([ownerNodePath, binding]) => [ownerNodePath.trim(), normalizeSceneNodeMaterialBinding(binding)] as const)
      .filter((entry): entry is [string, SceneNodeMaterialBindingConfig] => !!entry[0] && !!entry[1]),
  );
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizePbrMaterialLightingOverride(value: unknown): PbrMaterialLightingOverrideConfig | undefined {
  if (!isRecord(value)) return undefined;

  const normalized: PbrMaterialLightingOverrideConfig = {};
  const albedoColor = normalizeColorRGB(value.albedoColor);
  if (albedoColor) normalized.albedoColor = albedoColor;
  const reflectivityColor = normalizeColorRGB(value.reflectivityColor);
  if (reflectivityColor) normalized.reflectivityColor = reflectivityColor;
  const emissiveColor = normalizeColorRGB(value.emissiveColor);
  if (emissiveColor) normalized.emissiveColor = emissiveColor;
  const ambientColor = normalizeColorRGB(value.ambientColor);
  if (ambientColor) normalized.ambientColor = ambientColor;

  if (typeof value.baseWeight === 'number' && Number.isFinite(value.baseWeight)) {
    normalized.baseWeight = value.baseWeight;
  }
  if (typeof value.microSurface === 'number' && Number.isFinite(value.microSurface)) {
    normalized.microSurface = value.microSurface;
  }
  if (typeof value.lightFalloff === 'number' && Number.isFinite(value.lightFalloff)) {
    normalized.lightFalloff = value.lightFalloff;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeStandardMaterialLightingOverride(value: unknown): StandardMaterialLightingOverrideConfig | undefined {
  if (!isRecord(value)) return undefined;

  const normalized: StandardMaterialLightingOverrideConfig = {};
  const diffuseColor = normalizeColorRGB(value.diffuseColor);
  if (diffuseColor) normalized.diffuseColor = diffuseColor;
  const specularColor = normalizeColorRGB(value.specularColor);
  if (specularColor) normalized.specularColor = specularColor;
  const emissiveColor = normalizeColorRGB(value.emissiveColor);
  if (emissiveColor) normalized.emissiveColor = emissiveColor;
  const ambientColor = normalizeColorRGB(value.ambientColor);
  if (ambientColor) normalized.ambientColor = ambientColor;

  if (typeof value.specularPower === 'number' && Number.isFinite(value.specularPower)) {
    normalized.specularPower = value.specularPower;
  }
  if (typeof value.useSpecularOverAlpha === 'boolean') {
    normalized.useSpecularOverAlpha = value.useSpecularOverAlpha;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeMaterialOverride(value: unknown): MaterialOverrideConfig | undefined {
  if (!isRecord(value)) return undefined;

  const normalized: MaterialOverrideConfig = {};
  const albedoColor = normalizeColorRGB(value.albedoColor);
  if (albedoColor) normalized.albedoColor = albedoColor;
  const diffuseColor = normalizeColorRGB(value.diffuseColor);
  if (diffuseColor) normalized.diffuseColor = diffuseColor;
  const emissiveColor = normalizeColorRGB(value.emissiveColor);
  if (emissiveColor) normalized.emissiveColor = emissiveColor;

  if (typeof value.metallic === 'number' && Number.isFinite(value.metallic)) {
    normalized.metallic = value.metallic;
  }
  if (typeof value.roughness === 'number' && Number.isFinite(value.roughness)) {
    normalized.roughness = value.roughness;
  }
  if (typeof value.alpha === 'number' && Number.isFinite(value.alpha)) {
    normalized.alpha = value.alpha;
  }
  if (typeof value.backFaceCulling === 'boolean') {
    normalized.backFaceCulling = value.backFaceCulling;
  }

  const albedoTexture = normalizeTextureOverride(value.albedoTexture);
  if (albedoTexture) normalized.albedoTexture = albedoTexture;
  const normalTexture = normalizeTextureOverride(value.normalTexture);
  if (normalTexture) normalized.normalTexture = normalTexture;
  const metallicTexture = normalizeTextureOverride(value.metallicTexture);
  if (metallicTexture) normalized.metallicTexture = metallicTexture;
  const pbr = normalizePbrMaterialLightingOverride(value.pbr);
  if (pbr) normalized.pbr = pbr;
  const standard = normalizeStandardMaterialLightingOverride(value.standard);
  if (standard) normalized.standard = standard;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeOutlineOverride(value: unknown): OutlineOverrideConfig | undefined {
  if (!isRecord(value)) return undefined;

  const normalized: OutlineOverrideConfig = {};
  if (typeof value.renderOutline === 'boolean') {
    normalized.renderOutline = value.renderOutline;
  }
  if (typeof value.outlineWidth === 'number' && Number.isFinite(value.outlineWidth)) {
    normalized.outlineWidth = value.outlineWidth;
  }
  const outlineColor = normalizeColorRGB(value.outlineColor);
  if (outlineColor) normalized.outlineColor = outlineColor;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeMaterialOverrideMap(value: unknown): Record<string, MaterialOverrideConfig> | undefined {
  if (!isRecord(value)) return undefined;

  const normalized = Object.fromEntries(
    Object.entries(value)
      .map(([path, override]) => [path, normalizeMaterialOverride(override)] as const)
      .filter((entry): entry is [string, MaterialOverrideConfig] => !!entry[1]),
  );
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeOutlineOverrideMap(value: unknown): Record<string, OutlineOverrideConfig> | undefined {
  if (!isRecord(value)) return undefined;

  const normalized = Object.fromEntries(
    Object.entries(value)
      .map(([path, override]) => [path, normalizeOutlineOverride(override)] as const)
      .filter((entry): entry is [string, OutlineOverrideConfig] => !!entry[1]),
  );
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeTransformOverrideMap(value: unknown): Record<string, TransformConfig> | undefined {
  if (!isRecord(value)) return undefined;

  const normalized = Object.fromEntries(
    Object.entries(value)
      .map(([path, transform]) => [path, normalizeTransformConfig(transform)] as const)
      .filter((entry): entry is [string, TransformConfig] => !!entry[1]),
  );
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeSceneNodeOverrides(value: unknown): SceneNodeVisualOverrides | undefined {
  if (!isRecord(value)) return undefined;

  const normalized: SceneNodeVisualOverrides = {};
  const materialBinding = normalizeSceneNodeMaterialBinding(value.materialBinding);
  if (materialBinding) normalized.materialBinding = materialBinding;
  const materialSlotBindings = normalizeSceneNodeMaterialBindingMap(value.materialSlotBindings);
  if (materialSlotBindings) normalized.materialSlotBindings = materialSlotBindings;
  const childMaterialBindings = normalizeSceneNodeMaterialBindingMap(value.childMaterialBindings);
  if (childMaterialBindings) normalized.childMaterialBindings = childMaterialBindings;
  const material = normalizeMaterialOverride(value.material);
  if (material) normalized.material = material;
  const childMaterials = normalizeMaterialOverrideMap(value.childMaterials);
  if (childMaterials) normalized.childMaterials = childMaterials;
  const childTransforms = normalizeTransformOverrideMap(value.childTransforms);
  if (childTransforms) normalized.childTransforms = childTransforms;
  const outline = normalizeOutlineOverride(value.outline);
  if (outline) normalized.outline = outline;
  const childOutlines = normalizeOutlineOverrideMap(value.childOutlines);
  if (childOutlines) normalized.childOutlines = childOutlines;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function migrateSceneMaterialSlotBindings(scene: NonNullable<SceneConfig['scene']>): void {
  const assetById = new Map(scene.assets.map(asset => [asset.id, asset]));
  for (const node of scene.nodes) {
    if (node.kind !== 'instance') continue;
    const overrides = node.overrides;
    if (!overrides?.childMaterialBindings) continue;
    const asset = assetById.get(node.instance.assetId);
    const slots = collectSceneMaterialSlotMigrationDescriptors(asset);
    if (slots.length === 0) continue;
    const materialSlotBindings = {
      ...(overrides.materialSlotBindings ?? {}),
    };
    const legacyChildMaterialBindings = {
      ...overrides.childMaterialBindings,
    };
    const nextChildMaterialBindings = {
      ...overrides.childMaterialBindings,
    };
    const migratedLegacyOwnerPaths = new Set<string>();
    let changed = false;
    for (const slot of slots) {
      const legacy = findLegacySceneMaterialSlotBinding(legacyChildMaterialBindings, slot.ownerNodePath);
      const legacyBinding = legacy?.binding;
      if (!legacyBinding || materialSlotBindings[slot.slotId]) continue;
      materialSlotBindings[slot.slotId] = structuredClone(legacyBinding);
      migratedLegacyOwnerPaths.add(legacy.ownerNodePath);
      changed = true;
    }
    if (!changed) continue;
    for (const ownerNodePath of migratedLegacyOwnerPaths) {
      delete nextChildMaterialBindings[ownerNodePath];
    }
    overrides.materialSlotBindings = materialSlotBindings;
    if (Object.keys(nextChildMaterialBindings).length > 0) overrides.childMaterialBindings = nextChildMaterialBindings;
    else delete overrides.childMaterialBindings;
  }
}

function collectSceneMaterialSlotMigrationDescriptors(
  asset: SceneAssetConfig | undefined,
): Array<{ slotId: string; ownerNodePath: string }> {
  const rawSlots = Array.isArray(asset?.metadata?.materialSlots) ? asset.metadata.materialSlots : [];
  const slots: Array<{ slotId: string; ownerNodePath: string }> = [];
  for (const rawSlot of rawSlots) {
    if (!isRecord(rawSlot)) continue;
    const slotId = typeof rawSlot.slotId === 'string' ? rawSlot.slotId.trim() : '';
    const ownerNodePath = normalizeEditorSceneMaterialSlotOwnerPath(
      typeof rawSlot.ownerNodePath === 'string'
        ? rawSlot.ownerNodePath
        : typeof rawSlot.path === 'string'
          ? rawSlot.path
          : '',
    );
    if (slotId && ownerNodePath) slots.push({ slotId, ownerNodePath });
  }
  return slots;
}

function findLegacySceneMaterialSlotBinding(
  childMaterialBindings: Record<string, SceneNodeMaterialBindingConfig>,
  ownerNodePath: string,
): { ownerNodePath: string; binding: SceneNodeMaterialBindingConfig } | null {
  const exact = childMaterialBindings[ownerNodePath];
  if (exact) return { ownerNodePath, binding: exact };
  const normalizedOwnerNodePath = normalizeEditorSceneMaterialSlotOwnerPath(ownerNodePath);
  for (const [legacyOwnerNodePath, binding] of Object.entries(childMaterialBindings)) {
    if (normalizeEditorSceneMaterialSlotOwnerPath(legacyOwnerNodePath) === normalizedOwnerNodePath) {
      return { ownerNodePath: legacyOwnerNodePath, binding };
    }
  }
  return null;
}

function normalizeSceneSharedMaterial(value: unknown): SceneSharedMaterialConfig | undefined {
  if (!isRecord(value)) return undefined;

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const assetId = typeof value.assetId === 'string' ? value.assetId.trim() : '';
  const nodeId = typeof value.nodeId === 'string' ? value.nodeId.trim() : '';
  const materialName = typeof value.materialName === 'string' ? value.materialName.trim() : '';
  const ownerNodePath = typeof value.ownerNodePath === 'string' ? value.ownerNodePath.trim() : '';
  const rawScope = typeof value.scope === 'string' ? value.scope.trim() : '';
  const scope: SceneMaterialScope | undefined =
    rawScope === 'sharedAsset' || rawScope === 'nodeMaterial'
      ? rawScope
      : assetId
        ? 'sharedAsset'
        : nodeId
          ? 'nodeMaterial'
          : undefined;
  const type = typeof value.type === 'string' && value.type.trim() ? value.type.trim() : undefined;
  const properties = normalizeMaterialOverride(value.properties);
  if (!id || !materialName || !properties) return undefined;
  if (scope === 'sharedAsset' && !assetId) return undefined;
  if (scope === 'nodeMaterial' && !nodeId) return undefined;
  if (!scope) return undefined;

  return {
    id,
    scope,
    ...(assetId ? { assetId } : {}),
    ...(nodeId ? { nodeId } : {}),
    materialName,
    ...(ownerNodePath ? { ownerNodePath } : {}),
    ...(type ? { type } : {}),
    properties,
  };
}

function normalizeSceneAssetDefaults(value: unknown): SceneAssetConfig['defaults'] | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: NonNullable<SceneAssetConfig['defaults']> = {};
  const transform = normalizeTransformConfig(value.transform);
  if (transform) normalized.transform = transform;
  const outline = normalizeOutlineOverride(value.outline);
  if (outline) normalized.outline = outline;
  const childOutlines = normalizeOutlineOverrideMap(value.childOutlines);
  if (childOutlines) normalized.childOutlines = childOutlines;
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export class ConfigService {
  private sceneConfig: SceneConfig;
  private gameConfig: GameConfig;

  private sceneAssetMap = new Map<string, SceneAssetConfig>();
  private sceneNodeMap = new Map<string, SceneNodeConfig>();

  constructor() {
    this.sceneConfig = sceneConfigJson as SceneConfig;
    this.gameConfig = gameConfigJson as GameConfig;

    this.buildIndexes();
  }

  private ensureSceneSection(): NonNullable<SceneConfig['scene']> {
    if (!this.sceneConfig.scene || typeof this.sceneConfig.scene !== 'object') {
      this.sceneConfig.scene = {
        rootId: 'root',
        assets: [],
        nodes: [],
        materialAssets: [],
        materials: [],
        textures: [],
      };
    }

    const scene = this.sceneConfig.scene;
    if (typeof scene.rootId !== 'string' || !scene.rootId.trim()) {
      scene.rootId = 'root';
    }
    if (!Array.isArray(scene.assets)) scene.assets = [];
    if (!Array.isArray(scene.nodes)) scene.nodes = [];
    if (!Array.isArray(scene.materialAssets)) scene.materialAssets = [];
    if (!Array.isArray(scene.materials)) scene.materials = [];
    if (!Array.isArray(scene.textures)) scene.textures = [];
    scene.materialAssets = scene.materialAssets
      .map((materialAsset) => normalizeSceneMaterialAsset(materialAsset))
      .filter((materialAsset): materialAsset is SceneMaterialAssetConfig => !!materialAsset);
    for (const asset of scene.assets) {
      this.normalizeSceneAssetConfig(asset);
    }
    scene.materials = scene.materials
      .map((material) => normalizeSceneSharedMaterial(material))
      .filter((material): material is SceneSharedMaterialConfig => !!material);
    for (const node of scene.nodes) {
      this.normalizeSceneNode(node);
    }
    migrateSceneMaterialSlotBindings(scene);
    return scene;
  }

  private normalizeSceneAssetConfig(asset: SceneAssetConfig): void {
    const materialMode = normalizeSceneAssetMaterialMode(asset.materialMode);
    if (materialMode) {
      asset.materialMode = materialMode;
    } else {
      delete asset.materialMode;
    }

    const defaults = normalizeSceneAssetDefaults(asset.defaults);
    if (defaults) {
      asset.defaults = defaults;
      return;
    }
    delete asset.defaults;
  }

  private normalizeSceneNode(node: SceneNodeConfig): void {
    const rendering = normalizeSceneNodeRendering(node.rendering);
    if (rendering) node.rendering = rendering;
    else delete node.rendering;
    if (node.kind !== 'instance' && node.kind !== 'transform' && node.kind !== 'primitive') return;
    this.normalizeSceneVisualNode(node);
    if (node.kind === 'transform') {
      this.normalizeSceneTransformNode(node);
    }
  }

  private normalizeSceneVisualNode(node: SceneInstanceNode | SceneTransformNode | ScenePrimitiveNode): void {
    const normalizedOverrides = normalizeSceneNodeOverrides(node.overrides);
    if (normalizedOverrides) {
      node.overrides = normalizedOverrides;
      return;
    }
    delete node.overrides;
  }

  private normalizeSceneTransformNode(node: SceneTransformNode): void {
    if (
      node.transformType !== undefined
      && node.transformType !== 'plain'
      && node.transformType !== 'light'
      && node.transformType !== 'camera'
      && node.transformType !== 'groundDecal'
    ) {
      delete node.transformType;
    }

    if (node.transformType === 'camera' || (node.transformType == null && node.camera)) {
      const camera = normalizeSceneCameraRigConfig(node.camera);
      if (camera) node.camera = camera;
      else delete node.camera;
    } else {
      delete node.camera;
    }

    if (node.transformType === 'light' || (node.transformType == null && node.light)) {
      const light = normalizeSceneLightConfig(node.light);
      if (light) node.light = light;
      else delete node.light;
    } else {
      delete node.light;
    }
  }

  private buildIndexes(): void {
    this.sceneAssetMap.clear();
    this.sceneNodeMap.clear();

    const scene = this.ensureSceneSection();

    for (const asset of scene.assets) {
      this.sceneAssetMap.set(asset.id, asset);
    }

    for (const node of scene.nodes) {
      this.sceneNodeMap.set(node.id, node);
    }
  }

  getSceneConfig(): SceneConfig {
    return this.sceneConfig;
  }

  getSceneDocument(): SceneConfig {
    return this.sceneConfig;
  }

  getStaticShadowArtifact(): unknown {
    return this.sceneConfig.staticShadows ?? null;
  }

  replaceSceneConfig(sceneConfig: SceneConfig): void {
    this.sceneConfig = sceneConfig;
    this.buildIndexes();
  }

  replaceSceneDocument(sceneConfig: SceneConfig): void {
    this.replaceSceneConfig(sceneConfig);
  }

  getGameConfig(): GameConfig {
    return this.gameConfig;
  }

  getSceneRootId(): string {
    return this.ensureSceneSection().rootId;
  }

  getSceneAssets(): SceneAssetConfig[] {
    return this.ensureSceneSection().assets;
  }

  getSceneAssetById(id: string): SceneAssetConfig | undefined {
    return this.sceneAssetMap.get(id);
  }

  getSceneNodes(): SceneNodeConfig[] {
    return this.ensureSceneSection().nodes;
  }

  getSceneNodeById(id: string): SceneNodeConfig | undefined {
    return this.sceneNodeMap.get(id);
  }

  getSceneCameraNode(): SceneTransformNode | undefined {
    const nodes = this.ensureSceneSection().nodes;
    return nodes.find((item): item is SceneTransformNode => (
      item.kind === 'transform'
      && !!item.camera
      && (item.transformType === 'camera' || item.transformType == null)
    ));
  }

  getSceneCameraRig(): SceneCameraRigConfig | undefined {
    const node = this.getSceneCameraNode();
    return node?.camera;
  }

  getSceneDirectionalLightNode(): SceneTransformNode | undefined {
    const nodes = this.ensureSceneSection().nodes;
    return nodes.find((item): item is SceneTransformNode => (
      item.kind === 'transform'
      && !!item.light
      && (item.transformType === 'light' || item.transformType == null)
      && item.light.type === 'directional'
    ));
  }

  getSceneDirectionalLight(): SceneDirectionalLightConfig | undefined {
    const node = this.getSceneDirectionalLightNode();
    return node?.light?.type === 'directional' ? node.light : undefined;
  }

  getSceneHemisphericLightNode(): SceneTransformNode | undefined {
    const nodes = this.ensureSceneSection().nodes;
    return nodes.find((item): item is SceneTransformNode => (
      item.kind === 'transform'
      && !!item.light
      && (item.transformType === 'light' || item.transformType == null)
      && item.light.type === 'hemispheric'
    ));
  }

  getSceneHemisphericLight(): SceneHemisphericLightConfig | undefined {
    const node = this.getSceneHemisphericLightNode();
    return node?.light?.type === 'hemispheric' ? node.light : undefined;
  }

  getRenderConfig(): Record<string, unknown> {
    return (this.sceneConfig.render ?? {}) as Record<string, unknown>;
  }

  getGameplayConfig(): Record<string, unknown> {
    return (this.sceneConfig.gameplay ?? {}) as Record<string, unknown>;
  }

  getGameplayBindings(): GameplayBindingConfig[] {
    const bindings = this.sceneConfig.gameplay?.gameplayBindings;
    return Array.isArray(bindings) ? bindings : [];
  }

  getSceneVfxConfig(): SceneVfxConfig | undefined {
    return this.sceneConfig.gameplay?.tuning?.sceneVfx;
  }

  getLayoutPlaceholderSurfaces(): LayoutPlaceholderSurfaceConfig[] {
    const surfaces = this.sceneConfig.gameplay?.layoutPlaceholderSurfaces;
    if (!Array.isArray(surfaces)) return [];
    return surfaces;
  }

  getGroundOverlayPlanes(): GroundOverlayPlaneConfig[] {
    const planes = this.sceneConfig.gameplay?.groundOverlayPlanes;
    if (!Array.isArray(planes)) return [];
    return planes;
  }

  getPlayableAdInfo(): Record<string, unknown> {
    const sceneMeta = this.sceneConfig.meta ?? {};
    const playableAdInfo = (sceneMeta as any).playableAdInfo;
    return (playableAdInfo ?? {}) as Record<string, unknown>;
  }

  reload(): void {
    this.buildIndexes();
  }
}

function normalizeSceneNodeRendering(value: unknown): SceneNodeConfig['rendering'] | undefined {
  if (!isRecord(value)) return undefined;
  const normalized: NonNullable<SceneNodeConfig['rendering']> = {};
  if (value.renderingGroupId === 0 || value.renderingGroupId === 1 || value.renderingGroupId === 2 || value.renderingGroupId === 3) {
    normalized.renderingGroupId = value.renderingGroupId;
  }
  if (typeof value.alphaIndex === 'number' && Number.isFinite(value.alphaIndex)) {
    normalized.alphaIndex = value.alphaIndex;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export const configService = new ConfigService();
