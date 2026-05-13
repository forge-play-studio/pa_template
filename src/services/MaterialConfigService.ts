/**
 * MaterialConfigService - 材质配置服务
 *
 * 职责：从 rendering.json 读取材质配置并应用到场景中的材质
 * 移植自旧系统的 MaterialConfigManager
 */

import { Scene } from '@babylonjs/core/scene';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Material } from '@babylonjs/core/Materials/material';

// 导入配置
import renderingConfig from '../config/rendering.json';

// ============================================================
// 类型定义
// ============================================================

/** 颜色配置 */
interface ColorConfig {
  r: number;
  g: number;
  b: number;
}

/** 单个材质配置 */
interface MaterialConfig {
  environmentIntensity?: number;
  directIntensity?: number;
  albedoColor?: ColorConfig;
  emissiveColor?: ColorConfig;
  emissiveIntensity?: number;
  metallic?: number;
  roughness?: number;
  f0Factor?: number;
  indexOfRefraction?: number;
  materialType?: string;
  _comment?: string;
}

/** 完整材质配置文件结构 */
interface MaterialsConfig {
  sceneMaterials: Record<string, MaterialConfig>;
  plantMaterials: Record<string, MaterialConfig>;
}

// ============================================================
// MaterialConfigService 类
// ============================================================

/**
 * MaterialConfigService
 *
 * 管理场景材质配置的应用
 */
export class MaterialConfigService {
  private scene: Scene;
  private config: MaterialsConfig;
  private appliedMaterials = new Map<string, Material>();

  constructor(scene: Scene) {
    this.scene = scene;
    this.config = renderingConfig.materials as MaterialsConfig;
  }

  // ============================================================
  // 公共方法
  // ============================================================

  /**
   * 应用所有材质配置
   *
   * 应在模型加载完成后调用
   */
  applyAllConfigs(): void {

    // 应用场景材质配置
    this.applyMaterialConfigs(this.config.sceneMaterials);

    // 应用植物材质配置
    this.applyMaterialConfigs(this.config.plantMaterials);

  }

  /**
   * 应用植物材质配置
   *
   * 注意：现在材质配置在 ModelPool.addMaterialsToScene() 中自动应用，
   * 此方法保留用于手动调用场景。
   */
  applyPlantMaterialConfigs(): void {
    this.applyMaterialConfigs(this.config.plantMaterials);
  }

  /**
   * 根据材质名称获取配置
   */
  getConfigByName(materialName: string): MaterialConfig | null {
    return (
      this.config.sceneMaterials[materialName] ||
      this.config.plantMaterials[materialName] ||
      null
    );
  }

  /**
   * 动态更新单个材质的配置
   */
  updateMaterial(materialName: string, newConfig: Partial<MaterialConfig>): void {
    const material = this.scene.getMaterialByName(materialName);
    if (!material) {
      return;
    }

    // 合并配置
    const existingConfig = this.getConfigByName(materialName) || {};
    const mergedConfig = { ...existingConfig, ...newConfig };

    this.applyConfigToMaterial(material, mergedConfig);
  }

  /**
   * 重新应用所有配置（用于热重载）
   */
  reapplyAllConfigs(): void {
    this.appliedMaterials.clear();
    this.applyAllConfigs();
  }

  /**
   * 获取已应用配置的材质列表
   */
  getAppliedMaterials(): string[] {
    return Array.from(this.appliedMaterials.keys());
  }

  /**
   * 列出场景中所有材质名称（调试用）
   */
  listAllSceneMaterials(): string[] {
    return this.scene.materials.map(m => m.name);
  }

  /**
   * 打印未找到的材质（调试用）
   */
  logMissingMaterials(): void {
    const allConfigNames = [
      ...Object.keys(this.config.sceneMaterials),
      ...Object.keys(this.config.plantMaterials),
    ];

    const missing = allConfigNames.filter(name => !this.appliedMaterials.has(name));

    if (missing.length > 0) {
    }
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 应用指定的材质配置集合
   */
  private applyMaterialConfigs(configs: Record<string, MaterialConfig>): void {
    for (const [materialName, config] of Object.entries(configs)) {
      const material = this.scene.getMaterialByName(materialName);
      if (material) {
        this.applyConfigToMaterial(material, config);
        this.appliedMaterials.set(materialName, material);
      }
    }
  }

  /**
   * 将配置应用到单个材质
   */
  private applyConfigToMaterial(material: Material, config: MaterialConfig): void {
    // 处理 PBRMaterial
    if (material instanceof PBRMaterial) {
      this.applyToPBRMaterial(material, config);
    }
    // 处理 StandardMaterial
    else if (material instanceof StandardMaterial) {
      this.applyToStandardMaterial(material, config);
    }
  }

  /**
   * 应用配置到 PBRMaterial
   */
  private applyToPBRMaterial(material: PBRMaterial, config: MaterialConfig): void {
    // 环境光强度
    if (config.environmentIntensity !== undefined) {
      material.environmentIntensity = config.environmentIntensity;
    }

    // 直接光强度
    if (config.directIntensity !== undefined) {
      material.directIntensity = config.directIntensity;
    }

    // 反照率颜色 (从 gamma 空间转换到线性空间)
    if (config.albedoColor) {
      material.albedoColor = this.gammaToLinear(config.albedoColor);
    }

    // 自发光颜色
    if (config.emissiveColor) {
      material.emissiveColor = this.gammaToLinear(config.emissiveColor);
    }
    if (config.emissiveIntensity !== undefined) {
      material.emissiveIntensity = config.emissiveIntensity;
    }

    // 金属度
    if (config.metallic !== undefined) {
      material.metallic = config.metallic;
    }

    // 粗糙度
    if (config.roughness !== undefined) {
      material.roughness = config.roughness;
    }

    // F0 因子
    if (config.f0Factor !== undefined) {
      material.metallicF0Factor = config.f0Factor;
    }

    // 折射率
    if (config.indexOfRefraction !== undefined) {
      material.indexOfRefraction = config.indexOfRefraction;
    }
  }

  /**
   * 应用配置到 StandardMaterial
   */
  private applyToStandardMaterial(material: StandardMaterial, config: MaterialConfig): void {
    // 漫反射颜色 (对应 albedoColor)
    if (config.albedoColor) {
      material.diffuseColor = this.gammaToLinear(config.albedoColor);
    }

    // 自发光颜色
    if (config.emissiveColor) {
      material.emissiveColor = this.gammaToLinear(config.emissiveColor);
    }
  }

  /**
   * 将 gamma 空间颜色转换为线性空间
   *
   * Inspector 显示的是 gamma 空间值，Babylon.js 内部使用线性空间
   */
  private gammaToLinear(color: ColorConfig): Color3 {
    const gamma = 2.2;
    return new Color3(
      Math.pow(color.r, gamma),
      Math.pow(color.g, gamma),
      Math.pow(color.b, gamma)
    );
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 销毁服务
   */
  dispose(): void {
    this.appliedMaterials.clear();
  }
}
