/**
 * RenderingService - 渲染管线服务
 *
 * 职责：管理渲染管线配置，包括后处理效果、图像处理等
 * 从 rendering.json 配置读取并应用渲染设置
 */

import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import {
  createBabylonEnvironmentTextureController,
  createBabylonDefaultPostProcessPipelineController,
  resolveEditorSceneRuntimePreviewAssetUrl,
  resolveBabylonDefaultPostProcessVolumeStack,
  type BabylonEnvironmentTextureController,
  type BabylonEnvironmentTextureProfile,
  type BabylonDefaultPostProcessPipelineController,
} from '@fps-games/editor/playable-sdk';

// 导入配置
import renderingConfig from '../config/rendering.json';
import * as editorAssets from '../assets';

/**
 * 全局渲染配置接口
 */
interface GlobalVolumeConfig {
  imageProcessing: {
    exposure: number;
    contrast: number;
  };
  environment: {
    intensity: number;
    iblIntensity: number;
    useCocosIBL: boolean;
    texture?: {
      textureAssetId?: string | null;
      url?: string | null;
    } | null;
    textureAssetId?: string | null;
    textureUrl?: string | null;
    rotationY?: number;
  };
  lights: {
    hemispheric: {
      intensity: number;
      skyLightColor: { r: number; g: number; b: number; a: number };
    };
    directional: {
      intensity: number;
      direction: { x: number; y: number; z: number };
    };
  };
  rendering: {
    maxDpr: number;
    hardwareScalingLevel: number | null;
  };
  textures: {
    anisotropicFilteringLevel: number;
    samplingMode: string;
  };
  postProcessing: {
    bloom: {
      enabled: boolean;
      threshold: number;
      weight: number;
      kernel: number;
      scale: number;
    };
  };
  camera: {
    fov: number;
    radius: number | null;
    target: { x: number; y: number; z: number } | null;
  };
}

/**
 * RenderingService 类
 *
 * 管理游戏的渲染管线和后处理效果
 */
export class RenderingService {
  private scene: Scene;
  private pipeline: BabylonDefaultPostProcessPipelineController | null = null;
  private environmentTexture: BabylonEnvironmentTextureController | null = null;
  private config: GlobalVolumeConfig;

  constructor(scene: Scene) {
    this.scene = scene;
    this.config = renderingConfig.globalVolume as GlobalVolumeConfig;
  }

  /**
   * 初始化渲染管线
   *
   * @param cameras 要应用管线的相机列表
   */
  initialize(cameras: Camera[]): void {
    this.environmentTexture = createBabylonEnvironmentTextureController(
      this.scene as any,
      this.createEnvironmentTextureProfile(),
    );
    const resolved = resolveBabylonDefaultPostProcessVolumeStack(renderingConfig);
    this.pipeline = createBabylonDefaultPostProcessPipelineController(
      this.scene as any,
      cameras as any,
      resolved.profile,
      { name: 'defaultPipeline' },
    );
  }

  // ============================================================
  // 公共访问方法
  // ============================================================

  /**
   * 获取渲染管线实例
   */
  getPipeline(): unknown | null {
    return this.pipeline?.getPipeline() ?? null;
  }

  /**
   * 获取配置
   */
  getConfig(): GlobalVolumeConfig {
    return this.config;
  }

  /**
   * 获取光照配置
   */
  getLightsConfig() {
    return this.config.lights;
  }

  /**
   * 获取环境贴图 / IBL 配置
   */
  getEnvironmentConfig() {
    return this.config.environment;
  }

  /**
   * 获取渲染配置
   */
  getRenderingConfig() {
    return this.config.rendering;
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 销毁渲染管线
   */
  dispose(): void {
    this.pipeline?.dispose();
    this.pipeline = null;
    this.environmentTexture?.dispose();
    this.environmentTexture = null;
  }

  private createEnvironmentTextureProfile(): BabylonEnvironmentTextureProfile {
    const environment = this.config.environment;
    return {
      textureUrl: resolveEnvironmentTextureUrl(environment),
      intensity: readFiniteNumber(environment.iblIntensity ?? environment.intensity, 1),
      rotationY: readFiniteNumber(environment.rotationY, 0),
    };
  }
}

function resolveEnvironmentTextureUrl(environment: GlobalVolumeConfig['environment']): string | null {
  const texture = environment.texture && typeof environment.texture === 'object'
    ? environment.texture
    : null;
  const textureAssetId = readString(texture?.textureAssetId)
    || readString(environment.textureAssetId);
  const textureUrl = readString(texture?.url)
    || readString(environment.textureUrl);
  if (!textureAssetId) return isEnvironmentTextureUrl(textureUrl) ? textureUrl : null;
  if (!isEnvironmentTextureAssetId(textureAssetId)) return isEnvironmentTextureUrl(textureUrl) ? textureUrl : null;
  const resolvedUrl = resolveEditorSceneRuntimePreviewAssetUrl(
    editorAssets,
    { assetId: textureAssetId },
    'texture',
  );
  return resolvedUrl && isEnvironmentTextureUrl(resolvedUrl) ? resolvedUrl : null;
}

function isEnvironmentTextureAssetId(textureAssetId: string): boolean {
  const catalogEntry = editorAssets.ASSET_CATALOG[textureAssetId] as { metadata?: unknown; relativePath?: string } | undefined;
  const metadata = catalogEntry?.metadata && typeof catalogEntry.metadata === 'object' && !Array.isArray(catalogEntry.metadata)
    ? catalogEntry.metadata as Record<string, unknown>
    : {};
  if (metadata.textureUsage === 'environment' || metadata.usage === 'environment') return true;
  const capabilities = metadata.capabilities && typeof metadata.capabilities === 'object' && !Array.isArray(metadata.capabilities)
    ? metadata.capabilities as Record<string, unknown>
    : null;
  if (capabilities?.environmentTexture === true) return true;
  if (capabilities?.environmentTexture === false) return false;
  const relativePath = typeof metadata.relativePath === 'string'
    ? metadata.relativePath
    : typeof catalogEntry?.relativePath === 'string'
      ? catalogEntry.relativePath
      : '';
  return isEnvironmentTextureUrl(relativePath);
}

function isEnvironmentTextureUrl(textureUrl: string): boolean {
  return /\.(env|hdr|dds|ktx|ktx2)(?:[?#].*)?$/i.test(textureUrl);
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
