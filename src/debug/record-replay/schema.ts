import type { MovementInputState } from '../../services/InputService';

export const RECORD_REPLAY_SCHEMA_VERSION = 1;

export type RecordReplayStatus = 'idle' | 'recording' | 'replaying' | 'diverged' | 'aborted';

export interface DemoRecordingEnvelope {
  schemaVersion: typeof RECORD_REPLAY_SCHEMA_VERSION;
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

export interface DemoRecording {
  envelope: DemoRecordingEnvelope;
  frames: DemoRecordingFrame[];
  stateHashes: string[];
  events?: DemoRecordingEvent[];
  visual?: DemoRecordingVisualSample[];
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
