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

export interface RecorderUpdateRecord {
  frame: DemoRecordingFrame;
  index: number;
  droppedFrames: number;
}

export class RecorderSource implements MovementInputSource {
  private readonly maxFrames: number;
  private readonly frames: DemoRecordingFrame[] = [];
  private polledInputFrame: number | null = null;
  private polledInput: MovementInputState | null = null;
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
    this.polledInputFrame = frame;
    this.polledInput = input;
    return input;
  }

  recordUpdate(frame = this.game.getFrameCount(), dt = this.game.getCurrentFrameDeltaTime() ?? this.game.getLastFrameDeltaTime()): RecorderUpdateRecord {
    const normalizedFrame = Math.max(0, Math.floor(frame));
    const input = this.polledInputFrame === normalizedFrame
      ? normalizeMovementInput(this.polledInput)
      : { ...IDLE_MOVEMENT_INPUT };
    const latest = this.frames[this.frames.length - 1];

    if (latest && latest.frame === normalizedFrame) {
      latest.dt = normalizeRecordedDt(dt);
      latest.input = input;
      return {
        frame: {
          frame: latest.frame,
          dt: latest.dt,
          input: { ...latest.input },
        },
        index: this.frames.length - 1,
        droppedFrames: this.droppedFrames,
      };
    }

    const recorded: DemoRecordingFrame = {
      frame: normalizedFrame,
      dt: normalizeRecordedDt(dt),
      input,
    };
    this.frames.push(recorded);
    while (this.frames.length > this.maxFrames) {
      this.frames.shift();
      this.droppedFrames += 1;
    }
    const index = this.frames.findIndex((item) => item.frame === normalizedFrame);
    return {
      frame: {
        frame: recorded.frame,
        dt: recorded.dt,
        input: { ...recorded.input },
      },
      index: index >= 0 ? index : this.frames.length - 1,
      droppedFrames: this.droppedFrames,
    };
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
