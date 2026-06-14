/**
 * SimplePlayer (Scaffold)
 *
 * 这是一个“脚手架示例实体”：
 * - 不依赖任何具体 GLB 模型资源
 * - 演示实体的 init / update / dispose 生命周期
 * - 演示如何消费通用移动输入接口
 *
 * 你可以在实际项目中：
 * - 替换为继承 BaseEntity 的角色实体（使用 ModelPool + 动画）
 * - 或按项目需要实现更多组件化结构
 */

import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

import type { MovementInputSource } from '../services';
import { configService } from '../config';

export interface SimplePlayerConfig {
  /** 初始位置 */
  position: Vector3;
  /** 移动速度（单位/秒） */
  speed: number;
  /** 半径（视觉尺寸） */
  radius?: number;
}

export class SimplePlayer {
  private scene: Scene;
  private movementInput: MovementInputSource | null;

  private _position: Vector3;
  private baseSpeed: number;
  private speedMultiplier: number = 1;
  private _radius: number;

  constructor(scene: Scene, movementInput: MovementInputSource | null, config: SimplePlayerConfig) {
    this.scene = scene;
    this.movementInput = movementInput;
    this._position = config.position.clone();
    this.baseSpeed = config.speed;

    const radius = config.radius ?? 0.35;
    this._radius = radius;
  }

  get position(): Vector3 {
    return this._position;
  }

  get radius(): number {
    return this._radius;
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = Math.max(0, multiplier);
  }

  update(deltaTime: number): void {
    const input = this.movementInput?.getInput();

    // 输入向量：x 对应世界 X，y 对应世界 Z
    const dx = input?.x ?? 0;
    const dz = input?.y ?? 0;

    // 先用世界坐标构造，再尝试转换为“相机朝向”坐标
    let move = new Vector3(dx, 0, dz);
    const camera = this.scene.activeCamera as ArcRotateCamera | null;
    if (camera) {
      // 投影相机朝向到地面，计算前/右方向
      const forward = camera.target.subtract(camera.position);
      forward.y = 0;
      if (forward.lengthSquared() > 0.0001) {
        forward.normalize();
        const right = Vector3.Cross(Vector3.Up(), forward).normalize();
        move = forward.scale(dz).add(right.scale(dx));
      }
    }

    // 归一化移动（magnitude 由项目输入源提供）
    const magnitude = Math.sqrt(move.x * move.x + move.z * move.z);
    if (magnitude > 0.0001) {
      move.x /= magnitude;
      move.z /= magnitude;

      const speed = this.baseSpeed * (input?.magnitude ?? 1) * this.speedMultiplier;
      this._position.x += move.x * speed * deltaTime;
      this._position.z += move.z * speed * deltaTime;

      // 约束在世界边界内（如无配置，使用默认边界）
      const bounds = configService.getWorldBounds();
      this._position.x = Math.max(bounds.minX, Math.min(bounds.maxX, this._position.x));
      this._position.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, this._position.z));

    }
  }

  dispose(): void {
  }
}
