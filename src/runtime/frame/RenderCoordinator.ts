import type { Scene } from '@babylonjs/core/scene';
import type { FrameContext } from './types.ts';

export class RenderCoordinator {
  private readonly scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  renderFrame(_frame: FrameContext): void {
    this.render();
  }

  async renderOnce(): Promise<void> {
    await this.scene.whenReadyAsync(false);
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => resolve());
        return;
      }
      window.setTimeout(resolve, 0);
    });
    this.render();
  }

  private render(): void {
    this.scene.render();
  }
}
