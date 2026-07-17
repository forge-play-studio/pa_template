import type { FrameContext } from './types.ts';

export interface FrameClockOptions {
  maxDeltaSeconds?: number;
}

export class FrameClock {
  private readonly maxDeltaSeconds: number;
  private frame = 0;
  private elapsedSeconds = 0;
  private previousNowMs: number | null = null;

  constructor(options: FrameClockOptions = {}) {
    this.maxDeltaSeconds = options.maxDeltaSeconds ?? 0.1;
    if (!Number.isFinite(this.maxDeltaSeconds) || this.maxDeltaSeconds <= 0) {
      throw new Error('FrameClock maxDeltaSeconds must be a positive finite number.');
    }
  }

  beginFrame(nowMs: number): FrameContext {
    const safeNowMs = Number.isFinite(nowMs) ? nowMs : 0;
    const rawDeltaSeconds = this.previousNowMs === null
      ? 0
      : Math.max(0, (safeNowMs - this.previousNowMs) / 1000);
    const deltaSeconds = Math.min(rawDeltaSeconds, this.maxDeltaSeconds);

    this.previousNowMs = safeNowMs;
    this.elapsedSeconds += deltaSeconds;
    this.frame += 1;

    return {
      frame: this.frame,
      nowMs: safeNowMs,
      deltaSeconds,
      elapsedSeconds: this.elapsedSeconds,
    };
  }

  resetTime(): void {
    this.previousNowMs = null;
  }

  reset(): void {
    this.frame = 0;
    this.elapsedSeconds = 0;
    this.previousNowMs = null;
  }
}
