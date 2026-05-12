import type { Engine } from '@babylonjs/core/Engines/engine';
import type { Scene } from '@babylonjs/core/scene';
import { buildScene } from './scene';
import { Emitter } from './utils/emitter';

export interface GameEvents {
  win: void;
  lose: void;
  progress: number;
}

/**
 * 游戏主循环骨架。替换成你的玩法逻辑：
 *   - 在 buildScene() 里加你的资产、物理、相机
 *   - 在 update() 里推进玩法状态
 *   - 适当时机 emit('win' | 'lose')，触发 end card
 *   - 玩家点 CTA 按钮时 emit('cta')，跳转商店
 */
export class Game {
  readonly scene: Scene;
  readonly events = new Emitter<GameEvents>();

  private elapsed = 0;
  private done = false;

  constructor(_engine: Engine, canvas: HTMLCanvasElement) {
    this.scene = buildScene(_engine, canvas);
    this.scene.onBeforeRenderObservable.add(() => this.update());
  }

  start(): void {
    this.elapsed = 0;
    this.done = false;
  }

  reset(): void {
    this.start();
  }

  private update(): void {
    if (this.done) return;

    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    this.elapsed += dt;

    // 占位玩法：演示 30 秒后自动 win。替换成你的胜负判定。
    const target = 30;
    this.events.emit('progress', Math.min(1, this.elapsed / target));

    if (this.elapsed >= target) {
      this.done = true;
      this.events.emit('win', undefined);
    }
  }
}
