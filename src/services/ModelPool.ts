/**
 * ModelPool - 模型对象池服务
 *
 * 职责：管理模型实例的复用，避免频繁创建销毁，提升性能
 *
 * 使用方式：
 * - acquire(modelId): 获取池化实例，用于需要频繁创建/销毁的实体
 * - acquireOnce(modelId): 获取单例实例，用于场景等只需要一份的模型
 * - release(instance): 归还池化实例
 */

import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { AssetLoader } from './AssetLoader';
import { MaterialConfigService } from './MaterialConfigService';

// 导入用于类型注解（Scene.addMaterial 等方法需要）
import '@babylonjs/core/Materials/material';
import '@babylonjs/core/Materials/Textures/texture';

/**
 * 池化实例
 */
export interface PooledInstance {
  /** 模型 ID（显式存储，不从名称解析） */
  modelId: string;
  /** 根节点 */
  node: TransformNode;
  /** 动画组 */
  animations: AnimationGroup[];
}

/**
 * 内部池条目
 */
interface PoolEntry {
  instance: PooledInstance;
  inUse: boolean;
}

/**
 * 模型配置
 */
export interface ModelConfig {
  /** 缩放 */
  scale?: number | { x: number; y: number; z: number };
  /** Y 轴旋转偏移（运行时动态旋转的基础偏移） */
  rotationOffset?: number;
  /** 固定 X 轴旋转（弧度），用于模型朝向校正 */
  rotationX?: number;
  /** 固定 Y 轴旋转（弧度），用于模型朝向校正 */
  rotationY?: number;
  /** 固定 Z 轴旋转（弧度），用于模型朝向校正 */
  rotationZ?: number;
}


/**
 * ModelPool 服务
 */
export class ModelPool {
  private assetLoader: AssetLoader;
  private materialConfigService: MaterialConfigService | null = null;

  // 对象池：modelId -> PoolEntry[]
  private pools = new Map<string, PoolEntry[]>();

  // 模型配置缓存（从 ConfigService 加载）
  private modelConfigs = new Map<string, ModelConfig>();

  // 实例计数器（用于生成唯一名称）
  private instanceCounters = new Map<string, number>();

  // 已添加材质的模型（避免重复添加）
  private materialsAddedForModel = new Set<string>();

  // 单例模型缓存
  private singletons = new Map<string, PooledInstance>();

  constructor(_scene: Scene, assetLoader: AssetLoader) {
    // _scene 保留以兼容 API，实际使用 container.scene
    this.assetLoader = assetLoader;
  }

  /**
   * 设置材质配置服务
   * 设置后，acquire() 时会自动应用材质配置
   */
  setMaterialConfigService(service: MaterialConfigService): void {
    this.materialConfigService = service;
  }

  /**
   * 获取池化模型实例
   *
   * 用于需要频繁创建/销毁的实体（植物、掉落物、NPC 等）
   *
   * @param modelId 模型 ID
   * @returns 池化实例（包含 modelId，便于后续 release）
   */
  acquire(modelId: string): PooledInstance {
    const pool = this.getPool(modelId);

    // 查找可用实例
    const entry = pool.find(e => !e.inUse);
    if (entry) {
      entry.inUse = true;
      entry.instance.node.setEnabled(true);
      this.resetInstance(entry.instance);
      return entry.instance;
    }

    // 池空了，同步创建新实例
    const container = this.assetLoader.getContainerSync(modelId);
    if (!container) {
      throw new Error(`[ModelPool] Model ${modelId} not preloaded. Call AssetLoader.loadAssetContainer() first.`);
    }

    const instance = this.instantiateFromContainer(container, modelId);
    pool.push({ instance, inUse: true });

    return instance;
  }

  /**
   * 获取非实例化的独立模型实例。
   *
   * 用于 shared asset 默认行为下，当前 node 仍需要
   * node-local material override 的场景。此时不能返回 InstancedMesh，
   * 否则 Babylon 不支持为该节点单独替换材质。
   */
  acquireUnique(modelId: string): PooledInstance {
    const container = this.assetLoader.getContainerSync(modelId);
    if (!container) {
      throw new Error(`[ModelPool] Model ${modelId} not preloaded. Call AssetLoader.loadAssetContainer() first.`);
    }

    return this.instantiateFromContainer(container, modelId, true);
  }

  /**
   * 获取单例模型实例
   *
   * 用于只需要一份的模型（如场景 farmScene）
   * 使用 addAllToScene() 而非 instantiateModelsToScene()
   *
   * @param modelId 模型 ID
   * @returns 单例实例
   */
  async acquireOnce(modelId: string): Promise<PooledInstance> {
    // 如果已经获取过，直接返回
    const existing = this.singletons.get(modelId);
    if (existing) {
      return existing;
    }

    // 加载容器
    const container = await this.assetLoader.loadAssetContainer(modelId);

    // 使用 addAllToScene 将所有内容添加到场景
    container.addAllToScene();

    // 找到根节点
    const rootNode = container.rootNodes[0] as TransformNode;
    if (!rootNode) {
      throw new Error(`[ModelPool] Model ${modelId} has no root node`);
    }

    // 只重命名根节点，不递归重命名子节点
    // 单例模型（如 farmScene）的子节点保持原始名称，便于其他代码查找
    rootNode.name = `${modelId}:${rootNode.name}`;

    // 创建单例实例
    const instance: PooledInstance = {
      modelId,
      node: rootNode,
      animations: container.animationGroups,
    };

    // 应用配置
    this.applyModelConfig(rootNode, this.getModelConfig(modelId));

    this.singletons.set(modelId, instance);
    return instance;
  }

  /**
   * 归还模型实例
   *
   * @param instance 要归还的池化实例
   */
  release(instance: PooledInstance): void {
    const pool = this.getPool(instance.modelId);
    const entry = pool.find(e => e.instance.node === instance.node);

    if (entry) {
      entry.inUse = false;
      instance.node.setEnabled(false);
      instance.node.position.set(0, -1000, 0); // 移出视野

      // 停止所有动画
      instance.animations.forEach(anim => anim.stop());
    }
  }

  /**
   * 设置模型配置
   */
  setModelConfig(modelId: string, config: ModelConfig): void {
    this.modelConfigs.set(modelId, config);
  }

  /**
   * 获取模型配置
   */
  getModelConfig(modelId: string): ModelConfig {
    return this.modelConfigs.get(modelId) || {};
  }

  /**
   * 获取池状态（调试用）
   */
  getPoolStats(): { modelId: string; total: number; available: number }[] {
    const stats: { modelId: string; total: number; available: number }[] = [];

    for (const [modelId, pool] of this.pools.entries()) {
      const available = pool.filter(e => !e.inUse).length;
      stats.push({ modelId, total: pool.length, available });
    }

    return stats;
  }

  /**
   * 清空所有池和单例
   */
  dispose(): void {
    // 清理池化实例
    for (const pool of this.pools.values()) {
      for (const entry of pool) {
        entry.instance.node.dispose();
        entry.instance.animations.forEach(anim => anim.dispose());
      }
    }
    this.pools.clear();
    this.instanceCounters.clear();

    // 清理单例实例
    for (const instance of this.singletons.values()) {
      instance.node.dispose();
      instance.animations.forEach(anim => anim.dispose());
    }
    this.singletons.clear();
  }

  /**
   * 获取或创建池
   */
  private getPool(modelId: string): PoolEntry[] {
    if (!this.pools.has(modelId)) {
      this.pools.set(modelId, []);
    }
    return this.pools.get(modelId)!;
  }

  /**
   * 从 AssetContainer 实例化
   *
   * 注意：instantiateModelsToScene() 会创建新的网格实例，
   * 但材质是共享的。我们需要确保材质被添加到场景中。
   *
   * 节点命名格式：{modelId}_inst_{index}:{originalName}
   * 例如：plant1_inst_0:__root__, drop_t1_inst_3:mesh
   */
  private instantiateFromContainer(
    container: AssetContainer,
    modelId: string,
    doNotInstantiate = false,
  ): PooledInstance {
    // 首次使用此模型时，确保材质和纹理被添加到场景
    if (!this.materialsAddedForModel.has(modelId)) {
      this.addMaterialsToScene(container, modelId);
      this.materialsAddedForModel.add(modelId);
    }

    // 获取实例索引
    const index = this.getNextIndex(modelId);

    // 实例化
    // 参数说明：
    // - nameFunction: 命名函数，使用新格式 {modelId}_inst_{index}:{originalName}
    // - cloneMaterials: false 表示共享材质，不克隆
    // - doNotInstantiate: false 走 InstancedMesh
    // - doNotInstantiate: true 走真实 mesh clone，便于节点级材质覆盖
    const result = container.instantiateModelsToScene(
      name => `${modelId}_inst_${index}:${name}`,
      false,
      { doNotInstantiate }
    );

    const node = result.rootNodes[0] as TransformNode;
    const animations = result.animationGroups;

    // 应用配置
    this.applyModelConfig(node, this.getModelConfig(modelId));

    return { modelId, node, animations };
  }

  /**
   * 将容器中的材质和纹理添加到场景
   *
   * instantiateModelsToScene() 创建的实例会引用容器中的材质，
   * 但这些材质需要被添加到场景中才能正确渲染。
   *
   * 注意：不能使用 addAllToScene()，因为那会把网格也添加到场景，
   * 与后续的 instantiateModelsToScene() 冲突。
   */
  private addMaterialsToScene(container: AssetContainer, _modelId: string): void {
    const scene = container.scene;

    // 将材质添加到场景
    for (const material of container.materials) {
      if (!scene.materials.includes(material)) {
        scene.addMaterial(material);

        // 自动应用材质配置
        if (this.materialConfigService) {
          const config = this.materialConfigService.getConfigByName(material.name);
          if (config) {
            this.materialConfigService.updateMaterial(material.name, config);
          }
        }
      }
    }

    // 将纹理添加到场景
    for (const texture of container.textures) {
      if (!scene.textures.includes(texture)) {
        scene.addTexture(texture);
      }
    }

    // 将骨骼添加到场景（动画需要）
    for (const skeleton of container.skeletons) {
      if (!scene.skeletons.includes(skeleton)) {
        scene.addSkeleton(skeleton);
      }
    }
  }

  /**
   * 重置实例状态
   */
  private resetInstance(instance: PooledInstance): void {
    instance.node.position.set(0, 0, 0);
    instance.node.rotation.set(0, 0, 0);
    instance.node.scaling.setAll(1);

    // 重新应用配置（直接使用 instance.modelId，不需要从名称解析）
    this.applyModelConfig(instance.node, this.getModelConfig(instance.modelId));
  }

  /**
   * 获取下一个实例索引
   */
  private getNextIndex(modelId: string): number {
    const current = this.instanceCounters.get(modelId) || 0;
    this.instanceCounters.set(modelId, current + 1);
    return current;
  }

  private applyModelConfig(node: TransformNode, config: ModelConfig): void {
    if (config.scale !== undefined) {
      if (typeof config.scale === 'number') {
        node.scaling.setAll(config.scale);
      } else {
        node.scaling.set(config.scale.x, config.scale.y, config.scale.z);
      }
    }

    const hasEulerRotation =
      config.rotationX !== undefined ||
      config.rotationY !== undefined ||
      config.rotationZ !== undefined;

    if (!hasEulerRotation) return;

    // 只有配置了旋转校正时才清除 quaternion，避免破坏 GLB 原始朝向。
    node.rotationQuaternion = null;
    if (config.rotationX !== undefined) {
      node.rotation.x = config.rotationX;
    }
    if (config.rotationY !== undefined) {
      node.rotation.y = config.rotationY;
    }
    if (config.rotationZ !== undefined) {
      node.rotation.z = config.rotationZ;
    }
  }
}
