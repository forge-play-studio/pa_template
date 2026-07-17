import type { Engine } from '@babylonjs/core/Engines/engine';
import { FrameClock } from './FrameClock.ts';
import { FrameDirector } from './FrameDirector.ts';

export interface FramePumpOptions {
  engine: Engine;
  clock: FrameClock;
  director: FrameDirector;
  isSimulationPaused: () => boolean;
  now?: () => number;
}

export class FramePump {
  private readonly options: FramePumpOptions;
  private running = false;
  private readonly now: () => number;
  private readonly renderLoop = (): void => {
    if (!this.running) return;
    const frame = this.options.clock.beginFrame(this.now());
    this.options.director.tick(frame, this.options.isSimulationPaused());
  };

  constructor(options: FramePumpOptions) {
    this.options = options;
    this.now = options.now ?? (() => performance.now());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.options.clock.resetTime();
    this.options.engine.runRenderLoop(this.renderLoop);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.options.engine.stopRenderLoop(this.renderLoop);
    this.options.clock.resetTime();
  }

  get isRunning(): boolean {
    return this.running;
  }
}
