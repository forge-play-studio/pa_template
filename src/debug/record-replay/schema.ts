import type { MovementInputState } from '../../services/InputService';

export const RECORD_REPLAY_SCHEMA_VERSION = 1;
export const RECORD_REPLAY_HASH_VERSION_V1 = 1;
export const RECORD_REPLAY_HASH_VERSION_V2 = 2;
export const RECORD_REPLAY_HASH_VERSION_V3 = 3;
export const RECORD_REPLAY_HASH_VERSION_V4 = 4;
export const LATEST_RECORD_REPLAY_HASH_VERSION = RECORD_REPLAY_HASH_VERSION_V4;
export const RECORD_REPLAY_SETTLED_MARKER = 'gameplay-settled-v1';

export type RecordReplayHashVersion =
  | typeof RECORD_REPLAY_HASH_VERSION_V1
  | typeof RECORD_REPLAY_HASH_VERSION_V2
  | typeof RECORD_REPLAY_HASH_VERSION_V3
  | typeof RECORD_REPLAY_HASH_VERSION_V4;

export type RecordReplayStatus = 'idle' | 'recording' | 'replaying' | 'diverged' | 'aborted';

export interface DemoRecordingEnvelope {
  schemaVersion: typeof RECORD_REPLAY_SCHEMA_VERSION;
  hashVersion?: RecordReplayHashVersion;
  settledMarker?: boolean | string;
  anchorFrame?: number;
  templateVersion: string;
  projectId: string;
  createdAt: string;
  seed: number;
  startFrame: number;
  startStateHash: string;
  frames: number;
  label: string;
}

export interface DemoRecordingFrame {
  frame: number;
  dt: number;
  input: MovementInputState;
}

export interface DemoRecordingEvent {
  frame: number;
  kind: string;
  payload?: unknown;
}

export interface DemoRecordingVisualSample {
  frame: number;
  pixelHash: string;
}

export interface DemoRecordingStateSample {
  frame: number;
  gameFrame: number;
  hashVersion: RecordReplayHashVersion;
  hash: string;
  snapshot: unknown;
}

export interface DemoRecording {
  envelope: DemoRecordingEnvelope;
  frames: DemoRecordingFrame[];
  stateHashes: string[];
  events?: DemoRecordingEvent[];
  visual?: DemoRecordingVisualSample[];
  stateSamples?: DemoRecordingStateSample[];
  /** 逐帧玩家世界坐标 [x, z](与 frames 同长,1e-3 量化)。可选:老 tape 缺省;可由 Mode A 回放重建。 */
  trail?: Array<[number, number]>;
}

export const IDLE_MOVEMENT_INPUT: Readonly<MovementInputState> = Object.freeze({
  x: 0,
  y: 0,
  magnitude: 0,
  isActive: false,
});

export function normalizeMovementInput(input: Partial<MovementInputState> | null | undefined): MovementInputState {
  const x = finiteOrZero(input?.x);
  const y = finiteOrZero(input?.y);
  const magnitude = Math.max(0, finiteOrZero(input?.magnitude));
  return {
    x: roundInput(x),
    y: roundInput(y),
    magnitude: roundInput(magnitude),
    isActive: input?.isActive ?? (magnitude > 0.0001 || Math.abs(x) > 0.0001 || Math.abs(y) > 0.0001),
  };
}

export function normalizeRecordedDt(dt: number): number {
  if (!Number.isFinite(dt) || dt < 0) return 0;
  return dt;
}

export function parseDemoRecordingJson(json: string): DemoRecording {
  const parsed = JSON.parse(json) as DemoRecording;
  assertDemoRecording(parsed);
  return parsed;
}

export function getRecordingHashVersion(recording: DemoRecording): RecordReplayHashVersion {
  return normalizeHashVersion(recording.envelope?.hashVersion);
}

export function getRecordingAnchorFrame(recording: DemoRecording): number | null {
  const value = recording.envelope?.anchorFrame;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

export function normalizeHashVersion(value: unknown): RecordReplayHashVersion {
  if (value === RECORD_REPLAY_HASH_VERSION_V4) return RECORD_REPLAY_HASH_VERSION_V4;
  if (value === RECORD_REPLAY_HASH_VERSION_V3) return RECORD_REPLAY_HASH_VERSION_V3;
  if (value === RECORD_REPLAY_HASH_VERSION_V2) return RECORD_REPLAY_HASH_VERSION_V2;
  return RECORD_REPLAY_HASH_VERSION_V1;
}

export interface NonDenseRecordingFrameGap {
  index: number;
  previousFrame: number;
  frame: number;
  expectedFrame: number;
}

export function findFirstNonDenseRecordingFrameGap(
  frames: readonly DemoRecordingFrame[],
): NonDenseRecordingFrameGap | null {
  for (let index = 1; index < frames.length; index += 1) {
    const previousFrame = frames[index - 1]?.frame;
    const frame = frames[index]?.frame;
    if (
      typeof previousFrame !== 'number'
      || typeof frame !== 'number'
      || !Number.isFinite(previousFrame)
      || !Number.isFinite(frame)
    ) {
      return {
        index,
        previousFrame: Number(previousFrame),
        frame: Number(frame),
        expectedFrame: Number(previousFrame) + 1,
      };
    }
    const expectedFrame = previousFrame + 1;
    if (frame !== expectedFrame) {
      return {
        index,
        previousFrame,
        frame,
        expectedFrame,
      };
    }
  }
  return null;
}

export function assertDenseRecordingFrames(
  frames: readonly DemoRecordingFrame[],
  context = 'recording.frames',
): void {
  const gap = findFirstNonDenseRecordingFrameGap(frames);
  if (!gap) return;
  throw new Error(
    `${context} is not dense at index ${gap.index}: previous frame=${gap.previousFrame}, `
    + `current frame=${gap.frame}, expected frame=${gap.expectedFrame}.`,
  );
}

export function assertDemoRecording(recording: DemoRecording): void {
  if (!recording || typeof recording !== 'object') {
    throw new Error('recording must be an object');
  }
  if (recording.envelope?.schemaVersion !== RECORD_REPLAY_SCHEMA_VERSION) {
    throw new Error(`schemaVersion mismatch: expected ${RECORD_REPLAY_SCHEMA_VERSION}, got ${recording.envelope?.schemaVersion}`);
  }
  if (!Array.isArray(recording.frames)) {
    throw new Error('recording.frames must be an array');
  }
  if (!Array.isArray(recording.stateHashes)) {
    throw new Error('recording.stateHashes must be an array');
  }
  if (recording.envelope.frames !== recording.frames.length) {
    throw new Error(`frame count mismatch: envelope=${recording.envelope.frames}, frames=${recording.frames.length}`);
  }
  if (recording.stateHashes.length !== recording.frames.length) {
    throw new Error(`state hash count mismatch: hashes=${recording.stateHashes.length}, frames=${recording.frames.length}`);
  }
  normalizeHashVersion(recording.envelope.hashVersion);
  const settledMarker = recording.envelope.settledMarker;
  if (
    settledMarker !== undefined
    && typeof settledMarker !== 'boolean'
    && typeof settledMarker !== 'string'
  ) {
    throw new Error(`settledMarker must be a boolean or string when present, got ${typeof settledMarker}`);
  }
  const anchorFrame = recording.envelope.anchorFrame;
  if (
    anchorFrame !== undefined
    && (typeof anchorFrame !== 'number' || !Number.isFinite(anchorFrame) || anchorFrame < 0)
  ) {
    throw new Error(`anchorFrame must be a finite non-negative number when present, got ${anchorFrame}`);
  }
  if (recording.stateSamples !== undefined && !Array.isArray(recording.stateSamples)) {
    throw new Error('recording.stateSamples must be an array when present');
  }
}

function finiteOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roundInput(value: number): number {
  return roundTo(value, 4);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
