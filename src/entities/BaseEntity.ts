/**
 * BaseEntity - 实体基类
 *
 * 职责：定义所有游戏实体的通用接口和基础行为
 *
 * 节点结构：
 *   rootNode (TransformNode)     ← 控制节点，用于位置/旋转
 *     └── modelNode (GLB root)   ← 模型节点，从对象池获取
 *           └── meshes, bones, etc.
 *
 * 这种结构的好处：
 * - 节点树清晰，根节点名称可控
 * - 不需要处理 GLB 的 rotationQuaternion
 * - 模型内部结构变化不影响外部逻辑
 */

import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { ModelPool, PooledInstance } from '../services/ModelPool';
import { AnimationService } from '../services/AnimationService';

/**
 * 实体状态枚举
 */
export type EntityState = 'idle' | 'moving' | 'working' | 'disabled';

/**
 * 实体配置接口
 */
export interface EntityConfig {
  /** 模型ID */
  modelId: string;
  /** 初始位置 */
  position: Vector3;
  /** 初始旋转（Y轴弧度） */
  rotation?: number;
  /** 模型缩放 */
  scale?: number;
  /** 模型旋转偏移（用于修正GLB朝向） */
  rotationOffset?: number;
}

/**
 * 实体基类
 */
export abstract class BaseEntity {
  /** 唯一ID */
  public readonly id: string;

  /** 模型ID */
  public readonly modelId: string;

  /** 场景引用 */
  protected readonly scene: Scene;

  /** 服务引用 */
  protected readonly modelPool: ModelPool;
  protected readonly animationService: AnimationService;

  /** 根节点（控制节点，用于位置/旋转） */
  protected rootNode: TransformNode | null = null;

  /** 从对象池获取的模型实例 */
  protected pooledInstance: PooledInstance | null = null;

  /** 动画组 */
  protected animations: AnimationGroup[] = [];

  /** 当前状态 */
  protected _state: EntityState = 'idle';

  /** 位置 */
  protected _position: Vector3;

  /** Y轴旋转（弧度） */
  protected _rotation: number = 0;

  /** 模型旋转偏移 */
  protected rotationOffset: number = 0;

  /** 是否已初始化 */
  protected initialized: boolean = false;

  /** 是否激活 */
  protected _active: boolean = true;

  constructor(
    id: string,
    scene: Scene,
    modelPool: ModelPool,
    animationService: AnimationService,
    config: EntityConfig
  ) {
    this.id = id;
    this.modelId = config.modelId;
    this.scene = scene;
    this.modelPool = modelPool;
    this.animationService = animationService;

    this._position = config.position.clone();
    this._rotation = config.rotation ?? 0;
    this.rotationOffset = config.rotationOffset ?? 0;
  }

  // ============ 公共属性 ============

  /**
   * 获取根节点（控制节点）
   * 用于挂载子对象（如背包、特效）
   */
  getNode(): TransformNode | null {
    return this.rootNode;
  }

  /**
   * 获取模型节点（GLB 根节点）
   * 用于访问模型内部的网格和骨骼
   */
  getModelNode(): TransformNode | null {
    return this.pooledInstance?.node ?? null;
  }

  /** 当前状态 */
  get state(): EntityState {
    return this._state;
  }

  /** 位置（只读，本地坐标） */
  get position(): Vector3 {
    return this._position;
  }

  /**
   * 获取世界坐标位置
   * 如果有 parent 节点，会考虑 parent 的变换
   *
   * ⚠️ **确定性**:如果本节点的**祖先**在同一 tick 里被写过 transform,而你在 `update()` 里读它的世界
   * 坐标,读到的值取决于 Babylon 的渲染缓存(`_currentRenderId`),实时循环与 `Game.stepFrame()` 会
   * 给出不同结果 —— record-replay 因此分歧。这种情况下**先调 `refreshWorldMatrixChain(this.rootNode)`**
   * (`src/core/world-matrix.ts`);只对节点自身 `computeWorldMatrix(true)` 是不够的。
   * 本 scaffold 的 rootNode 没有会被同 tick 移动的祖先,所以这里直接读。
   */
  getWorldPosition(): Vector3 {
    if (this.rootNode) {
      return this.rootNode.getAbsolutePosition();
    }
    return this._position.clone();
  }

  /** Y轴旋转 */
  get rotation(): number {
    return this._rotation;
  }

  /** 是否激活 */
  get active(): boolean {
    return this._active;
  }

  /** 变换节点（只读，返回根节点） */
  get transformNode(): TransformNode | null {
    return this.rootNode;
  }

  /**
   * 兼容旧代码：node 属性返回根节点
   * @deprecated 使用 getNode() 或 getModelNode()
   */
  protected get node(): TransformNode | null {
    return this.rootNode;
  }

  // ============ 公共方法 ============

  /**
   * 初始化实体
   *
   * 创建节点结构：
   *   rootNode (控制节点)
   *     └── modelNode (模型节点)
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }


    try {
      // 1. 创建根节点（控制节点）
      this.rootNode = new TransformNode(`${this.id}_root`, this.scene);

      // 2. 从对象池获取模型实例
      this.pooledInstance = this.modelPool.acquire(this.modelId);
      this.animations = this.pooledInstance.animations;

      // 3. 将模型挂载到根节点
      this.pooledInstance.node.parent = this.rootNode;
      this.pooledInstance.node.position.set(0, 0, 0);
      this.pooledInstance.node.rotation.set(0, 0, 0);


      // 4. 设置初始变换
      this.syncTransform();

      // 5. 子类自定义初始化
      await this.onInit();

      this.initialized = true;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 设置位置
   */
  setPosition(x: number, y: number, z: number): void {
    this._position.set(x, y, z);
    this.syncTransform();
  }

  /**
   * 移动到目标位置
   */
  moveTo(target: Vector3): void {
    this._position.copyFrom(target);
    this.syncTransform();
  }

  /**
   * 设置Y轴旋转
   */
  setRotation(radians: number): void {
    this._rotation = radians;
    this.syncTransform();
  }

  /**
   * 面向目标点
   */
  lookAt(target: Vector3): void {
    const direction = target.subtract(this._position);
    if (direction.lengthSquared() > 0.001) {
      this._rotation = Math.atan2(direction.x, direction.z);
      this.syncTransform();
    }
  }

  /**
   * 播放动画
   */
  playAnimation(name: string, loop: boolean = true, speed: number = 1): void {
    this.animationService.play(this.animations, name, { loop, speed });
  }

  /**
   * 停止动画
   */
  stopAnimation(name?: string): void {
    this.animationService.stop(this.animations, name);
  }

  /**
   * 设置激活状态
   */
  setActive(active: boolean): void {
    this._active = active;
    if (this.rootNode) {
      this.rootNode.setEnabled(active);
    }
    if (!active) {
      this.stopAnimation();
    }
  }

  /**
   * 更新（每帧调用）
   */
  update(deltaTime: number): void {
    if (!this._active || !this.initialized) return;
    this.onUpdate(deltaTime);
  }

  /**
   * 销毁实体
   */
  dispose(): void {
    this.onDispose();

    // 归还模型到对象池
    if (this.pooledInstance) {
      this.pooledInstance.node.parent = null;
      this.modelPool.release(this.pooledInstance);
      this.pooledInstance = null;
    }

    // 销毁根节点
    if (this.rootNode) {
      this.rootNode.dispose();
      this.rootNode = null;
    }

    this.animations = [];
    this.initialized = false;
    this._active = false;
  }

  // ============ 受保护方法 ============

  /**
   * 同步变换到根节点
   *
   * 只操作 rootNode，不需要处理 rotationQuaternion
   */
  protected syncTransform(): void {
    if (!this.rootNode) return;

    this.rootNode.position.copyFrom(this._position);
    this.rootNode.rotation.y = this._rotation + this.rotationOffset;
  }

  /**
   * 切换状态
   */
  protected setState(newState: EntityState): void {
    if (this._state === newState) return;

    const oldState = this._state;
    this._state = newState;
    this.onStateChange(oldState, newState);
  }

  // ============ 子类钩子 ============

  /**
   * 初始化钩子（子类重写）
   */
  protected async onInit(): Promise<void> {
    // 子类实现
  }

  /**
   * 更新钩子（子类重写）
   */
  protected onUpdate(_deltaTime: number): void {
    // 子类实现
  }

  /**
   * 状态变化钩子（子类重写）
   */
  protected onStateChange(_oldState: EntityState, _newState: EntityState): void {
    // 子类实现
  }

  /**
   * 销毁钩子（子类重写）
   */
  protected onDispose(): void {
    // 子类实现
  }
}
