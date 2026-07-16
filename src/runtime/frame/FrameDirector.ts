import type { FrameContext, FrameDirectorPhases } from './types.ts';

export class FrameDirector {
  constructor(private readonly phases: FrameDirectorPhases) {}

  tick(frame: FrameContext, simulationPaused: boolean): void {
    if (!simulationPaused) {
      this.phases.input?.(frame);
      this.phases.update(frame);
      this.phases.lateUpdate?.(frame);
      this.phases.deferredCleanup?.(frame);
    }
    this.phases.render(frame);
    this.phases.end?.(frame);
  }
}
