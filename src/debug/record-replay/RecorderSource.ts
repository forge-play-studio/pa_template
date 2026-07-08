import type { MovementInputSource, MovementInputState } from '../../services/InputService';
import { IDLE_MOVEMENT_INPUT, normalizeMovementInput, normalizeRecordedDt, type DemoRecordingFrame } from './schema';

export interface RecorderGameClock {
  getFrameCount(): number;
  getCurrentFrameDeltaTime(): number | null;
  getLastFrameDeltaTime(): number;
}

export interface RecorderSourceOptions {
  maxFrames?: number;
}

export class RecorderSource implements MovementInputSource {
  private readonly maxFrames: number;
  private readonly frames: DemoRecordingFrame[] = [];
  private lastRecordedFrame: number | null = null;
  private droppedFrames = 0;

  constructor(
    private readonly inner: MovementInputSource | null,
    private readonly game: RecorderGameClock,
    options: RecorderSourceOptions = {},
  ) {
    this.maxFrames = Math.max(1, Math.floor(options.maxFrames ?? 20_000));
  }

  getInput(): Readonly<MovementInputState> {
    const input = normalizeMovementInput(this.inner?.getInput() ?? IDLE_MOVEMENT_INPUT);
    const frame = this.game.getFrameCount();
    if (frame !== this.lastRecordedFrame) {
      this.frames.push({
        frame,
        dt: normalizeRecordedDt(this.game.getCurrentFrameDeltaTime() ?? this.game.getLastFrameDeltaTime()),
        input,
      });
      this.lastRecordedFrame = frame;
      while (this.frames.length > this.maxFrames) {
        this.frames.shift();
        this.droppedFrames += 1;
      }
    } else {
      const latest = this.frames[this.frames.length - 1];
      if (latest) latest.input = input;
    }
    return input;
  }

  getFrames(): DemoRecordingFrame[] {
    return this.frames.map((frame) => ({
      frame: frame.frame,
      dt: frame.dt,
      input: { ...frame.input },
    }));
  }

  getRecordedFrameCount(): number {
    return this.frames.length;
  }

  getDroppedFrameCount(): number {
    return this.droppedFrames;
  }
}
