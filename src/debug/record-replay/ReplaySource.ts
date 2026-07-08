import type { MovementInputSource, MovementInputState } from '../../services/InputService';
import { IDLE_MOVEMENT_INPUT, normalizeMovementInput, type DemoRecordingFrame } from './schema';

export class ReplaySource implements MovementInputSource {
  private frameIndex = 0;

  constructor(private readonly frames: readonly DemoRecordingFrame[]) {}

  setFrameIndex(frameIndex: number): void {
    this.frameIndex = Math.max(0, Math.floor(frameIndex));
  }

  getFrameIndex(): number {
    return this.frameIndex;
  }

  getInput(): Readonly<MovementInputState> {
    return normalizeMovementInput(this.frames[this.frameIndex]?.input ?? IDLE_MOVEMENT_INPUT);
  }
}
