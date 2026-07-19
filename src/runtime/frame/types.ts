export interface FrameContext {
  frame: number;
  nowMs: number;
  deltaSeconds: number;
  elapsedSeconds: number;
}

export interface FrameDirectorPhases {
  input?(frame: FrameContext): void;
  update(frame: FrameContext): void;
  lateUpdate?(frame: FrameContext): void;
  deferredCleanup?(frame: FrameContext): void;
  render(frame: FrameContext): void;
  end?(frame: FrameContext): void;
}
