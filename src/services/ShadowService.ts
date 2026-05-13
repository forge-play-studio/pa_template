/**
 * ShadowService - 阴影管理服务
 *
 * 职责：管理场景阴影系统，包括 CSM 阴影和阴影投射/接收配置
 * 移植自旧系统的 ShadowManager
 */

import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Observer } from '@babylonjs/core/Misc/observable';
import { Scene } from '@babylonjs/core/scene';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';

// 副作用导入：注册阴影场景组件
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';

// 导入配置
import renderingConfig from '../config/rendering.json';

// ============================================================
// 类型定义
// ============================================================

interface ColorConfig {
  r: number;
  g: number;
  b: number;
}

interface ShadowSettings {
  mapSize: number;
  darkness: number;
  blurKernel: number;
  bias: number;
  normalBias: number;
  useBlurExponentialShadowMap: boolean;
  shadowMinZ: number;
  shadowMaxZ: number;
  shadowColor: ColorConfig;
}

interface CSMSettings {
  numCascades: number;
  lambda: number;
  cascadeBlendPercentage: number;
  stabilizeCascades: boolean;
}

interface ShadowOrtho {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface ShadowsConfig {
  enabled: boolean;
  useCsm: boolean;
  useBlobShadow: boolean;
  settings: ShadowSettings;
  blobSettings: {
    opacity: number;
    yOffset: number;
    sizeMultiplier: number;
    minSize: number;
  };
  shadowRange: {
    minZ: number;
    maxZ: number;
  };
  shadowOrtho: ShadowOrtho;
  csm: CSMSettings;
}

interface ShadowMeshesConfig {
  shadowReceivers: string[];
  shadowCasters: string[];
  excludeFromShadow: string[];
}

// ============================================================
// ShadowService 类
// ============================================================

/**
 * ShadowService
 *
 * 管理场景阴影系统
 */
export class ShadowService {
  private scene: Scene;
  private camera: Camera | null;
  private light: DirectionalLight;
  private shadowGenerator: ShadowGenerator | null = null;
  private config: ShadowsConfig;
  private meshConfig: ShadowMeshesConfig;
  private shadowReceivers: string[];
  private shadowCasters: string[];
  private excluded: string[];
  private newMeshObserver: Observer<AbstractMesh> | null = null;

  constructor(scene: Scene, light: DirectionalLight, camera?: Camera | null) {
    this.scene = scene;
    this.light = light;
    this.camera = camera || null;
    this.config = renderingConfig.shadows as ShadowsConfig;
    this.meshConfig = renderingConfig.shadowMeshes as ShadowMeshesConfig;
    this.shadowReceivers = this.meshConfig.shadowReceivers || [];
    this.shadowCasters = this.meshConfig.shadowCasters || [];
    this.excluded = this.meshConfig.excludeFromShadow || [];
  }

  // ============================================================
  // 公共方法
  // ============================================================

  /**
   * 初始化阴影系统
   */
  initialize(): void {
    if (!this.config.enabled) {
      this.scene.shadowsEnabled = false;
      return;
    }

    this.scene.shadowsEnabled = true;

    // 确保光源不被父节点影响（对阴影关键）
    this.light.parent = null;
    this.light.shadowEnabled = true;

    const settings = this.config.settings;
    const csm = this.config.csm;
    const useCsm = this.config.useCsm ?? true;
    const useBlur = settings.useBlurExponentialShadowMap;

    // 创建阴影生成器（优先 CSM，不支持时回退）
    if (useCsm && CascadedShadowGenerator.IsSupported) {
      const csmGenerator = new CascadedShadowGenerator(
        settings.mapSize,
        this.light,
        undefined,
        this.camera || undefined
      );

      csmGenerator.shadowMaxZ = settings.shadowMaxZ;

      if (csm.numCascades !== undefined) {
        csmGenerator.numCascades = csm.numCascades;
      }
      if (csm.lambda !== undefined) {
        csmGenerator.lambda = csm.lambda;
      }
      if (csm.cascadeBlendPercentage !== undefined) {
        csmGenerator.cascadeBlendPercentage = csm.cascadeBlendPercentage;
      }
      if (csm.stabilizeCascades !== undefined) {
        csmGenerator.stabilizeCascades = csm.stabilizeCascades;
      }

      csmGenerator.usePercentageCloserFiltering = true;
      csmGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;

      this.shadowGenerator = csmGenerator;
    } else {
      this.shadowGenerator = new ShadowGenerator(settings.mapSize, this.light);
    }

    if (!this.shadowGenerator) {
      return;
    }

    // 应用模糊设置
    if (useBlur) {
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = settings.blurKernel;
    }

    // 应用其他设置
    this.shadowGenerator.setDarkness(settings.darkness);
    this.shadowGenerator.bias = settings.bias;
    this.shadowGenerator.normalBias = settings.normalBias;

    // 设置光源阴影范围
    this.light.shadowMinZ = settings.shadowMinZ;
    this.light.shadowMaxZ = settings.shadowMaxZ;

    // 配置方向光的正交投影边界
    this.light.orthoLeft = this.config.shadowOrtho.left;
    this.light.orthoRight = this.config.shadowOrtho.right;
    this.light.orthoTop = this.config.shadowOrtho.top;
    this.light.orthoBottom = this.config.shadowOrtho.bottom;

    // 应用阴影网格配置
    this.applyShadowMeshes();

    // 监听新网格添加
    this.attachNewMeshObserver();

  }

  /**
   * 刷新阴影网格配置
   *
   * 在场景模型加载后调用
   */
  refreshShadowMeshes(): void {
    if (!this.shadowGenerator) return;
    this.applyShadowMeshes();
  }

  /**
   * 获取阴影生成器实例
   */
  getShadowGenerator(): ShadowGenerator | null {
    return this.shadowGenerator;
  }

  /**
   * 手动添加阴影投射者
   */
  addShadowCaster(mesh: AbstractMesh): void {
    if (this.shadowGenerator) {
      this.shadowGenerator.addShadowCaster(mesh, true);
    }
  }

  /**
   * 手动移除阴影投射者
   */
  removeShadowCaster(mesh: AbstractMesh): void {
    if (this.shadowGenerator) {
      this.shadowGenerator.removeShadowCaster(mesh, true);
    }
  }

  /**
   * 设置网格为阴影接收者
   */
  setShadowReceiver(mesh: AbstractMesh, receive: boolean): void {
    mesh.receiveShadows = receive;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 监听新网格添加
   */
  private attachNewMeshObserver(): void {
    this.newMeshObserver = this.scene.onNewMeshAddedObservable.add((mesh) => {
      if (!this.shadowGenerator) return;
      this.applyShadowToMesh(mesh);
    });
  }

  /**
   * 应用阴影配置到所有网格
   */
  private applyShadowMeshes(): void {
    if (!this.shadowGenerator) return;

    let receiverCount = 0;
    let casterCount = 0;
    let excludedCount = 0;

    for (const mesh of this.scene.meshes) {
      if (this.isExcluded(mesh.name)) {
        mesh.receiveShadows = false;
        this.shadowGenerator.removeShadowCaster(mesh, true);
        excludedCount++;
        continue;
      }

      if (this.isShadowReceiver(mesh.name)) {
        mesh.receiveShadows = true;
        receiverCount++;
      }

      if (this.isShadowCaster(mesh.name)) {
        this.shadowGenerator.addShadowCaster(mesh, true);
        casterCount++;
      }
    }
  }

  /**
   * 应用阴影配置到单个网格
   */
  private applyShadowToMesh(mesh: AbstractMesh): void {
    if (this.isExcluded(mesh.name)) {
      mesh.receiveShadows = false;
      this.shadowGenerator?.removeShadowCaster(mesh, true);
      return;
    }

    if (this.isShadowReceiver(mesh.name)) {
      mesh.receiveShadows = true;
    }

    if (this.isShadowCaster(mesh.name)) {
      this.shadowGenerator?.addShadowCaster(mesh, true);
    }
  }

  /**
   * 检查网格是否为阴影接收者
   */
  private isShadowReceiver(name: string): boolean {
    return this.isNameMatched(name, this.shadowReceivers);
  }

  /**
   * 检查网格是否为阴影投射者
   */
  private isShadowCaster(name: string): boolean {
    return this.isNameMatched(name, this.shadowCasters);
  }

  /**
   * 检查网格是否被排除
   */
  private isExcluded(name: string): boolean {
    return this.isNameMatched(name, this.excluded);
  }

  /**
   * 模糊匹配网格名称
   */
  private isNameMatched(name: string, candidates: string[]): boolean {
    for (const candidate of candidates) {
      if (name === candidate || name.includes(candidate)) {
        return true;
      }
    }
    return false;
  }

  // ============================================================
  // 生命周期
  // ============================================================

  /**
   * 销毁服务
   */
  dispose(): void {
    if (this.newMeshObserver) {
      this.scene.onNewMeshAddedObservable.remove(this.newMeshObserver);
      this.newMeshObserver = null;
    }

    if (this.shadowGenerator) {
      this.shadowGenerator.dispose();
      this.shadowGenerator = null;
    }

  }
}
