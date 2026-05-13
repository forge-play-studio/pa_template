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
  WorldBoundsConfig,
  SceneAssetConfig,
  SceneAssetMaterialMode,
  SceneInstanceNode,
  SceneMaterialScope,
  SceneNodeVisualOverrides,
  MaterialOverrideConfig,
  MaterialTextureOverrideConfig,
  PbrMaterialLightingOverrideConfig,
  OutlineOverrideConfig,
  ColorRGB,
  SceneSharedMaterialConfig,
  SceneNodeConfig,
  StandardMaterialLightingOverrideConfig,
  SceneVfxConfig,
  LayoutPlaceholderSurfaceConfig,
  GroundOverlayPlaneConfig,
  TransformConfig,
} from './types';

import sceneConfigJson from './scene.json';
import gameConfigJson from './game.json';

const DEFAULT_WORLD_BOUNDS: WorldBoundsConfig = {
  minX: -10,
  maxX: 10,
  minZ: -10,
  maxZ: 10,
};

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

function normalizeSceneAssetMaterialMode(value: unknown): SceneAssetMaterialMode | undefined {
  return value === 'shared' || value === 'instance' ? value : undefined;
}

function normalizeTextureOverride(value: unknown): MaterialTextureOverrideConfig | undefined {
  if (!isRecord(value)) return undefined;
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  if (!url) return undefined;
  return { url };
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
    if (!Array.isArray(scene.materials)) scene.materials = [];
    if (!Array.isArray(scene.textures)) scene.textures = [];
    for (const asset of scene.assets) {
      this.normalizeSceneAssetConfig(asset);
    }
    scene.materials = scene.materials
      .map((material) => normalizeSceneSharedMaterial(material))
      .filter((material): material is SceneSharedMaterialConfig => !!material);
    for (const node of scene.nodes) {
      this.normalizeSceneNode(node);
    }
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
    if (node.kind !== 'instance') return;
    this.normalizeSceneInstanceNode(node);
  }

  private normalizeSceneInstanceNode(node: SceneInstanceNode): void {
    const normalizedOverrides = normalizeSceneNodeOverrides(node.overrides);
    if (normalizedOverrides) {
      node.overrides = normalizedOverrides;
      return;
    }
    delete node.overrides;
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

  getRenderConfig(): Record<string, unknown> {
    return (this.sceneConfig.render ?? {}) as Record<string, unknown>;
  }

  getGameplayConfig(): Record<string, unknown> {
    return (this.sceneConfig.gameplay ?? {}) as Record<string, unknown>;
  }

  getWorldBounds(): WorldBoundsConfig {
    return this.sceneConfig.gameplay?.worldBounds ?? DEFAULT_WORLD_BOUNDS;
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

export const configService = new ConfigService();
