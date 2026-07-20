/**
 * RenderingService - 渲染管线服务
 *
 * 职责：管理渲染管线配置，包括后处理效果、图像处理等
 * 从 rendering.json 配置读取并应用渲染设置
 */

import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import {
  resolveEditorSceneRuntimePreviewAssetUrl,
  createPlayableBabylonRuntimeRenderingControllers,
  createPlayableBabylonWorldRendering,
  type EditorSceneRenderingTextureAsset,
  type PlayableBabylonRuntimeRenderingControllers,
} from '../runtime/integrations/fps-runtime/rendering';

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
    iblIntensity: number;
    useCocosIBL: boolean;
    texture?: {
      textureAssetId?: string | null;
      url?: string | null;
    } | null;
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
  private controllers: PlayableBabylonRuntimeRenderingControllers | null = null;
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
    const worldRendering = createPlayableBabylonWorldRendering(RUNTIME_RENDERING_DOCUMENT, {
      getConfig: () => renderingConfig,
      setConfig: () => undefined,
      getTextureAssets: () => createRuntimeRenderingTextureAssets(),
      shadowPreview: false,
    });
    this.controllers = createPlayableBabylonRuntimeRenderingControllers({
      scene: this.scene as any,
      cameras: cameras as any[],
      initialRendering: worldRendering,
      postProcess: { name: 'defaultPipeline' },
    });
  }

  // ============================================================
  // 公共访问方法
  // ============================================================

  /**
   * 获取渲染管线实例
   */
  getPipeline(): unknown | null {
    return this.controllers?.postProcess.getPipeline() ?? null;
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
    this.controllers?.dispose();
    this.controllers = null;
  }
}

const RUNTIME_RENDERING_DOCUMENT = Object.freeze({ source: 'runtime' });

function createRuntimeRenderingTextureAssets(): EditorSceneRenderingTextureAsset[] {
  return Object.values(editorAssets.ASSET_CATALOG)
    .filter(entry => entry.kind === 'texture' || entry.kind === 'image')
    .flatMap((entry) => {
      const url = entry.kind === 'texture'
        ? resolveEditorSceneRuntimePreviewAssetUrl(editorAssets, { assetId: entry.assetId }, 'texture')
        : editorAssets.resolveImageAssetUrl(entry.assetId);
      if (!url) return [];
      const environmentTexture = isEnvironmentTextureAsset(entry, url);
      return [{
        id: entry.assetId,
        label: entry.displayName || entry.assetId,
        url,
        meta: environmentTexture ? `${entry.assetId} · IBL` : entry.assetId,
        usage: environmentTexture ? 'environment' : 'material',
        capabilities: {
          materialTexture: !environmentTexture,
          environmentTexture,
        },
      }];
    });
}

function isEnvironmentTextureAsset(
  asset: editorAssets.AssetCatalogEntry,
  resolvedUrl: string,
): boolean {
  const metadata = asset.metadata && typeof asset.metadata === 'object' && !Array.isArray(asset.metadata)
    ? asset.metadata as Record<string, unknown>
    : {};
  if (metadata.textureUsage === 'environment' || metadata.usage === 'environment') return true;
  const capabilities = metadata.capabilities && typeof metadata.capabilities === 'object' && !Array.isArray(metadata.capabilities)
    ? metadata.capabilities as Record<string, unknown>
    : null;
  if (capabilities?.environmentTexture === true) return true;
  if (capabilities?.environmentTexture === false) return false;
  const candidates = [
    resolvedUrl,
    asset.displayName,
    asset.assetId,
    typeof metadata.relativePath === 'string' ? metadata.relativePath : '',
    typeof metadata.originalFileName === 'string' ? metadata.originalFileName : '',
  ];
  return candidates.some(isEnvironmentTextureUrl);
}

function isEnvironmentTextureUrl(textureUrl: string): boolean {
  return /\.(env|hdr|dds|ktx|ktx2)(?:[?#].*)?$/i.test(textureUrl);
}
