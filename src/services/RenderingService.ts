/**
 * RenderingService - 渲染管线服务
 *
 * 职责：管理渲染管线配置，包括后处理效果、图像处理等
 * 从 rendering.json 配置读取并应用渲染设置
 */

import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import {
  createBabylonDefaultPostProcessPipelineController,
  resolveBabylonDefaultPostProcessVolumeStack,
  type BabylonDefaultPostProcessPipelineController,
} from '@fps-games/editor/playable-sdk';

// 导入配置
import renderingConfig from '../config/rendering.json';

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
  }
}
