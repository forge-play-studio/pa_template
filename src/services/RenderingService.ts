/**
 * RenderingService - 渲染管线服务
 *
 * 职责：管理渲染管线配置，包括后处理效果、图像处理等
 * 从 rendering.json 配置读取并应用渲染设置
 */

import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';

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
  private pipeline: DefaultRenderingPipeline | null = null;
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
    // 创建 DefaultRenderingPipeline
    this.pipeline = new DefaultRenderingPipeline(
      'defaultPipeline',  // 管线名称
      true,               // 启用 HDR
      this.scene,
      cameras
    );

    // 应用各项配置
    this.applyImageProcessing();
    this.applyBloomSettings();
    this.applyAdditionalSettings();

  }

  /**
   * 应用图像处理配置
   *
   * 包括曝光度、对比度、色调映射等
   */
  private applyImageProcessing(): void {
    if (!this.pipeline) return;

    const { imageProcessing } = this.config;

    // 启用图像处理
    this.pipeline.imageProcessingEnabled = true;

    // 设置曝光度
    this.pipeline.imageProcessing.exposure = imageProcessing.exposure;

    // 设置对比度
    this.pipeline.imageProcessing.contrast = imageProcessing.contrast;

    // 启用色调映射 (ACES Tone Mapping)
    this.pipeline.imageProcessing.toneMappingEnabled = true;
    this.pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  }

  /**
   * 应用泛光(Bloom)设置
   */
  private applyBloomSettings(): void {
    if (!this.pipeline) return;

    const { bloom } = this.config.postProcessing;

    // 启用/禁用泛光
    this.pipeline.bloomEnabled = bloom.enabled;

    if (bloom.enabled) {
      // 泛光阈值 - 亮度超过此值才会产生泛光
      this.pipeline.bloomThreshold = bloom.threshold;

      // 泛光权重/强度
      this.pipeline.bloomWeight = bloom.weight;

      // 泛光模糊核大小
      this.pipeline.bloomKernel = bloom.kernel;

      // 泛光缩放
      this.pipeline.bloomScale = bloom.scale;
    }
  }

  /**
   * 应用其他渲染设置
   *
   * 包括抗锯齿、锐化、色差等
   */
  private applyAdditionalSettings(): void {
    if (!this.pipeline) return;

    // 抗锯齿设置 - 4x MSAA
    this.pipeline.samples = 4;

    // 禁用不需要的效果
    this.pipeline.sharpenEnabled = false;           // 锐化
    this.pipeline.chromaticAberrationEnabled = false; // 色差
    this.pipeline.depthOfFieldEnabled = false;      // 景深
    this.pipeline.grainEnabled = false;             // 颗粒效果

  }

  // ============================================================
  // 公共访问方法
  // ============================================================

  /**
   * 获取渲染管线实例
   */
  getPipeline(): DefaultRenderingPipeline | null {
    return this.pipeline;
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
  // 动态调整方法
  // ============================================================

  /**
   * 动态更新曝光度
   * @param value 新的曝光度值
   */
  setExposure(value: number): void {
    if (this.pipeline) {
      this.pipeline.imageProcessing.exposure = value;
    }
  }

  /**
   * 动态更新对比度
   * @param value 新的对比度值
   */
  setContrast(value: number): void {
    if (this.pipeline) {
      this.pipeline.imageProcessing.contrast = value;
    }
  }

  /**
   * 动态启用/禁用泛光
   * @param enabled 是否启用
   */
  setBloomEnabled(enabled: boolean): void {
    if (this.pipeline) {
      this.pipeline.bloomEnabled = enabled;
    }
  }

  /**
   * 动态更新泛光强度
   * @param value 新的泛光强度
   */
  setBloomWeight(value: number): void {
    if (this.pipeline) {
      this.pipeline.bloomWeight = value;
    }
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 销毁渲染管线
   */
  dispose(): void {
    if (this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = null;
    }
  }
}
