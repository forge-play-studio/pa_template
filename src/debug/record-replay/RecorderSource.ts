import type { MovementInputSource, MovementInputState } from '../../services/InputService';
import { drainRecordReplayPendingActions } from './providers';
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
    // 帧间发生的离散动作挂到本帧(语义=本帧 update 前已生效);单接缝原则:与 input/hash 同钩子采集
    const actions = drainRecordReplayPendingActions();
    const latest = this.frames[this.frames.length - 1];

    if (latest && latest.frame === normalizedFrame) {
      latest.dt = normalizeRecordedDt(dt);
      latest.input = input;
      if (actions.length > 0) latest.actions = [...(latest.actions ?? []), ...actions];
      return {
        frame: {
          frame: latest.frame,
          dt: latest.dt,
          input: { ...latest.input },
          ...(latest.actions ? { actions: latest.actions.map((a) => ({ id: a.id, params: { ...a.params } })) } : {}),
        },
        index: this.frames.length - 1,
        droppedFrames: this.droppedFrames,
      };
    }

    const recorded: DemoRecordingFrame = {
      frame: normalizedFrame,
      dt: normalizeRecordedDt(dt),
      input,
      ...(actions.length > 0 ? { actions } : {}),
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
        ...(recorded.actions ? { actions: recorded.actions.map((a) => ({ id: a.id, params: { ...a.params } })) } : {}),
      },
      index: index >= 0 ? index : this.frames.length - 1,
      droppedFrames: this.droppedFrames,
    };
  }

  getFrames(): DemoRecordingFrame[] {
    return this.getFrameSlice(0);
  }

  /**
   * Incremental read for checkpointing: copies only `[fromIndex, end)` instead of the whole tape.
   * A 55-minute session is ~200k frames; copying all of them every checkpoint would be quadratic.
   */
  getFrameSlice(fromIndex: number): DemoRecordingFrame[] {
    const start = Math.max(0, Math.min(Math.floor(fromIndex), this.frames.length));
    const slice: DemoRecordingFrame[] = [];
    for (let index = start; index < this.frames.length; index += 1) {
      const frame = this.frames[index];
      if (!frame) continue;
      slice.push({
        frame: frame.frame,
        dt: frame.dt,
        input: { ...frame.input },
        ...(frame.actions ? { actions: frame.actions.map((a) => ({ id: a.id, params: { ...a.params } })) } : {}),
      });
    }
    return slice;
  }

  getRecordedFrameCount(): number {
    return this.frames.length;
  }

  getDroppedFrameCount(): number {
    return this.droppedFrames;
  }
}
