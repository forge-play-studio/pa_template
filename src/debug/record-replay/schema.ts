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
  /**
   * 录制超过 `maxFrames`,RecorderSource 环形缓冲丢掉了最早的若干帧。
   *
   * 此时 `anchorFrame` / `startFrame` / `startStateHash` 描述的仍是**被丢掉的那个起点**,
   * 而 `frames[0]` 已经是后来的某一帧 —— tape 谎报了自己的起点。Mode A 必然从第 0 帧就发散,
   * 而且发散原因看起来像"世界不确定",极具误导性。所以 Mode A 直接拒绝这类 tape。
   *
   * 语义提取仍可继续(航迹与里程碑不依赖绝对起点),但会带一条 warning。
   */
  truncated?: boolean;
  /** 被环形缓冲丢弃的帧数(`truncated` 为真时 > 0)。 */
  droppedFrames?: number;
  /**
   * 录制时注册的观测语义版本(providers `semanticsVersion`)。观测口径变更即 +1。
   * 回放/提取与现注册版本错配 = 剧本目标与传感器读数不可比 → 拒绝认证;
   * 老 tape 缺省 = legacy,仅警告不拒(向后兼容)。
   */
  providerSemanticsVersion?: number;
}

/**
 * 离散动作(点击选卡类):录**语义 ID** 不录像素坐标。
 * 挂帧语义 = 「在本帧 update 之前已生效」——DOM click 在帧间触发、游戏态立即变化,
 * 帧 N 的 hash 已含选择效果,故动作记在帧 N、回放时于帧 N update 前 invoke。
 * 输入侧数据,不进 state hash;老 tape 无此字段,回放路径 no-op。
 */
export interface DemoRecordingFrameAction {
  id: string;
  params: Record<string, string | number>;
}

export interface DemoRecordingFrame {
  frame: number;
  dt: number;
  input: MovementInputState;
  actions?: DemoRecordingFrameAction[];
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
  /**
   * 录制期通用点按侦察(pointer-capture.ts):非 debug UI 上的短促点按,按帧记录。
   * 只用于准入审计比对「点按数 vs 语义动作数」,探测决策点漏接线(不参与回放/hash)。
   * 可选:老 tape 缺省。
   */
  pointerTaps?: Array<{ frame: number }>;
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
