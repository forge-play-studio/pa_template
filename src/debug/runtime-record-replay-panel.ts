import packageJson from '../../package.json';
import type { Game } from '../core/Game';
import type { DeterminismRandomStats } from '../core/determinism';
import type { InputService } from '../services';
import type { Disposable } from './framework/disposables';
import { createDebugButton, createDebugButtonRow, createDebugStatusLine } from './framework/controls';
import { mountRuntimeDebugPanel } from './debug-panel-layout';
import { RecorderSource } from './record-replay/RecorderSource';
import { ReplaySource } from './record-replay/ReplaySource';
import {
  installPostUpdateStateCapture,
  replayRecordingFrameStates,
  type PostUpdateStateCapture,
  type ReplayFrameState,
} from './record-replay/frame-state';
import {
  LATEST_RECORD_REPLAY_HASH_VERSION,
  RECORD_REPLAY_SCHEMA_VERSION,
  RECORD_REPLAY_SETTLED_MARKER,
  assertDenseRecordingFrames,
  assertDemoRecording,
  findFirstNonDenseRecordingFrameGap,
  getRecordingAnchorFrame,
  getRecordingHashVersion,
  normalizeHashVersion,
  parseDemoRecordingJson,
  type DemoRecording,
  type DemoRecordingEnvelope,
  type DemoRecordingEvent,
  type DemoRecordingFrame,
  type DemoRecordingStateSample,
  type RecordReplayHashVersion,
  type RecordReplayStatus,
} from './record-replay/schema';
import { runRecordReplaySelfTest, type RecordReplaySelfTestResult } from './record-replay/self-test';
import {
  createRecordReplayBenchmarkResult,
  formatBenchmarkConclusion,
  runRecordReplayBenchmarkMajority,
  type BenchmarkPerfSample,
  type RecordReplayBenchmarkMajorityResult,
  type RecordReplayBenchmarkResult,
} from './record-replay/benchmark';
import {
  runSemanticGradeMajority,
  type SemanticMajorityDecision,
  type SemanticMajorityOptions,
} from './record-replay/semantic/grade';
import {
  diffSemanticObservations,
  extractSemanticScript,
  isDiscreteSemanticMilestone,
  readSemanticObservationFromSnapshot,
  type SemanticObservation,
  type SemanticScript,
} from './record-replay/semantic/extract';
import { FactContractChecker, formatFactContractViolation } from './record-replay/fact-contract';
import {
  runSemanticReplay,
  type SemanticReplayOptions,
  type SemanticVerdict,
} from './record-replay/semantic/replay';
import {
  diffSnapshots,
  normalizeSnapshotForComparison,
  stableStringify,
  stateHash,
  type JsonSnapshot,
  type StateDiff,
  type StateHashResult,
} from './record-replay/verify';
import {
  applyRecordedFrameActions,
  getRecordReplayProviderSemanticsVersion,
  readRecordReplayObservationOnlyFactKeys,
  readRecordReplayPlayerPosition,
} from './record-replay/providers';
import { collapseDebugUiForRecording } from './record-replay/debug-ui-visibility';
import { registerTemplateRecordReplayProviders } from './record-replay/template-providers';

export interface RuntimeRecordReplayPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
  restartGame?: (context?: { reason?: string }) => Promise<void>;
}

export interface RecordReplayRunOptions {
  restart?: boolean;
  maxFrames?: number;
  resumeOnComplete?: boolean;
}

export interface RecordReplayPlaybackOptions {
  restart?: boolean;
  speed?: number;
  maxFrames?: number;
}

export interface RecordReplayPlaybackResult {
  ok: boolean;
  status: RecordReplayStatus;
  frames: number;
  aborted: boolean;
}

export interface RecordReplayTrailResult {
  ok: boolean;
  aborted: boolean;
  frames: number;
  missingPositions: number;
  recordingWithTrail: DemoRecording | null;
}

export interface RecordReplayRunResult {
  ok: boolean;
  status: RecordReplayStatus;
  frames: number;
  firstDivergence: number | null;
  expectedHash?: string;
  actualHash?: string;
  diffs?: StateDiff[];
  nearestSnapshotSampleFrame?: number | null;
  serializedDivergence?: RecordReplaySerializedDivergence;
  stateHashes: string[];
}

export interface RecordReplaySerializedDivergence {
  frame: number;
  expectedHash?: string;
  actualHash: string;
  expectedSource: 'exact-state-sample' | 'recorded-session-snapshot' | 'hash-only';
  expectedStableJson?: string;
  actualStableJson: string;
  note: string;
}

export interface RecordReplaySampleValidationPoint {
  frame: number;
  gameFrame: number | null;
  pass: boolean;
  expectedHash?: string;
  actualHash?: string;
  diffCount: number;
  diffs?: StateDiff[];
}

export interface RecordReplaySampleValidationResult {
  ok: boolean;
  status: RecordReplayStatus;
  frames: number;
  samples: RecordReplaySampleValidationPoint[];
  firstFailure: RecordReplaySampleValidationPoint | null;
  stateHashes: string[];
}

export interface RecordReplayAgentApi {
  startRec(options?: { label?: string; maxFrames?: number }): {
    status: RecordReplayStatus;
    startStateHash: string;
    seed: number;
    hashVersion: RecordReplayHashVersion;
    anchorFrame: number;
    warning: string | null;
  };
  stopRec(label?: string): DemoRecording;
  /** Non-destructive incremental read of the active recording; null when not recording. */
  peekRec(fromIndex?: number): RecordReplayRecordingPeek | null;
  replay(recording?: DemoRecording | string, options?: RecordReplayRunOptions): Promise<RecordReplayRunResult>;
  playback(recording?: DemoRecording | string, options?: RecordReplayPlaybackOptions): Promise<RecordReplayPlaybackResult>;
  reconstructTrail(recording?: DemoRecording | string, options?: RecordReplayRunOptions): Promise<RecordReplayTrailResult>;
  replayValidateSamples(
    recording?: DemoRecording | string,
    options?: RecordReplayRunOptions,
  ): Promise<RecordReplaySampleValidationResult>;
  extractSemantic(recording?: DemoRecording | string): SemanticScript;
  semanticReplay(
    script?: SemanticScript | DemoRecording | string,
    options?: SemanticReplayOptions & { restart?: boolean },
  ): Promise<SemanticVerdict>;
  /** 双跑一致定档;分裂自动第三跑取多数(契约 §6.2)。每跑都 restart。 */
  semanticReplayMajority(
    script?: SemanticScript | DemoRecording | string,
    options?: SemanticReplayMajorityOptions,
  ): Promise<SemanticReplayMajorityResult>;
  runBenchmark(options?: RecordReplayBenchmarkOptions): Promise<RecordReplayBenchmarkResult>;
  runBenchmarkMajority(options?: RecordReplayBenchmarkMajorityOptions): Promise<RecordReplayBenchmarkMajorityResult>;
  stepTo(recording: DemoRecording | string, frameCount: number): Promise<RecordReplayRunResult>;
  selfTest(): Promise<RecordReplaySelfTestResult>;
  snapshot(hashVersion?: RecordReplayHashVersion): StateHashResult;
  getState(): RecordReplayPanelState;
  export(): string;
  import(json: string): DemoRecording;
  abort(): { status: RecordReplayStatus };
}

/** Live, incremental view of an in-flight recording. Used by the disk-checkpoint controller. */
export interface RecordReplayRecordingPeek {
  envelope: DemoRecordingEnvelope;
  /** Index the returned slice starts at. */
  fromIndex: number;
  /** Total frames captured so far (== envelope.frames). */
  totalFrames: number;
  frames: DemoRecordingFrame[];
  stateHashes: string[];
  /**
   * Per-frame player [x, z] for `[fromIndex, totalFrames)`, or null if any frame lacked a position.
   * Streamed alongside the frames so a tape assembled from checkpoints still yields waypoints.
   */
  trail: Array<[number, number]> | null;
  /** State samples whose `frame` falls inside the returned slice. Feed the semantic extractor. */
  stateSamples: DemoRecordingStateSample[];
  /** Per-frame detector events inside the returned slice. Short-lived events live only here. */
  events: DemoRecordingEvent[];
  /** >0 means RecorderSource ring-buffered and absolute indices shifted — checkpointing must stop. */
  droppedFrames: number;
}

export interface RecordReplayPanelState {
  status: RecordReplayStatus;
  lastError: string | null;
  lastRecordingFrames: number;
  firstDivergence: number | null;
  replayFrame: number | null;
  startStateHash: string | null;
  seed: number | null;
  hashVersion: RecordReplayHashVersion | null;
  anchorFrame: number | null;
  droppedFrames: number;
  randomStats: DeterminismRandomStats | null;
  warning: string | null;
}

export interface RecordReplayBenchmarkOptions extends SemanticReplayOptions {
  url?: string;
  restart?: boolean;
  sampleIntervalMs?: number;
}

export interface RecordReplayBenchmarkMajorityOptions extends RecordReplayBenchmarkOptions, SemanticMajorityOptions {}

export interface SemanticReplayMajorityOptions extends SemanticReplayOptions, SemanticMajorityOptions {}

export interface SemanticReplayMajorityResult {
  decision: SemanticMajorityDecision;
  /** 定档那一档里最先出现的 verdict;抖动时已盖 `flaky` 章。 */
  verdict: SemanticVerdict;
  verdicts: readonly SemanticVerdict[];
}

interface RecordingSession {
  game: Game;
  inputService: InputService;
  originalSource: ReturnType<InputService['getMovementSource']>;
  recorder: RecorderSource;
  startFrame: number;
  anchorFrame: number;
  startStateHash: string;
  hashVersion: RecordReplayHashVersion;
  label: string;
  stateHashes: string[];
  snapshots: JsonSnapshot[];
  stateSamples: DemoRecordingStateSample[];
  /** 逐帧跑 detector 抓到的离散事件。稀疏 stateSample 之间的短命事件只有这里有。 */
  events: DemoRecordingEvent[];
  previousObservation: SemanticObservation | null;
  factContract: FactContractChecker;
  restoreUpdate: () => void;
  restoreDebugUi: () => void;
  droppedStateHashes: number;
  lastHashedFrame: number | null;
}

interface MutablePanelState {
  status: RecordReplayStatus;
  recordingSession: RecordingSession | null;
  lastRecording: DemoRecording | null;
  lastSnapshots: JsonSnapshot[];
  lastError: string | null;
  firstDivergence: number | null;
  replayFrame: number | null;
  abortRequested: boolean;
}

interface ReplayDivergence {
  frameState: ReplayFrameState;
  expectedHash: string | undefined;
}

const packageInfo = packageJson as { name?: string; version?: string };
const RECORD_REPLAY_BENCHMARK_URL = '/benchmarks/record-replay/baseline-v1.semantic.json';
const RECORD_REPLAY_BENCHMARK_SAMPLE_INTERVAL_MS = 1000;
const STATE_SAMPLE_INTERVAL_FRAMES = 60;
const GAMEPLAY_SETTLED_TIMEOUT_MS = 10_000;
const NON_FRAME_ZERO_ANCHOR_WARNING = 'WARNING: non-frame-0 anchored tape; replay requires the same frame offset.';
export function mountRuntimeRecordReplayPanel(options: RuntimeRecordReplayPanelOptions): Disposable {
  const root = options.root ?? document.body;
  const state: MutablePanelState = {
    status: 'idle',
    recordingSession: null,
    lastRecording: null,
    lastSnapshots: [],
    lastError: null,
    firstDivergence: null,
    replayFrame: null,
    abortRequested: false,
  };

  const unregisterTemplateProviders = registerTemplateRecordReplayProviders(options.getGame);
  const api = createRecordReplayApi(options, state);
  window.__rr = api;

  const panel = mountRuntimeDebugPanel({
    id: 'runtime-record-replay-panel',
    title: 'Record Replay',
    phase: 'framework',
    root,
    render(content) {
      return renderPanel(content, api);
    },
  });

  return {
    dispose() {
      cleanupRecordingSession(state);
      if (window.__rr === api) delete window.__rr;
      unregisterTemplateProviders();
      panel.dispose();
    },
  };
}

function createRecordReplayApi(options: RuntimeRecordReplayPanelOptions, state: MutablePanelState): RecordReplayAgentApi {
  return {
    startRec(recordOptions = {}) {
      ensureVisibleDocument();
      cleanupRecordingSession(state);
      const game = requireGame(options);
      const inputService = requireInputService(game);
      const hashVersion = LATEST_RECORD_REPLAY_HASH_VERSION;
      const start = stateHash(game, hashVersion);
      const recorder = new RecorderSource(inputService.getMovementSource(), game, {
        maxFrames: recordOptions.maxFrames,
      });
      const session: RecordingSession = {
        game,
        inputService,
        originalSource: inputService.getMovementSource(),
        recorder,
        startFrame: game.getFrameCount(),
        anchorFrame: game.getFrameCount(),
        startStateHash: start.hash,
        hashVersion,
        label: recordOptions.label ?? 'recording',
        stateHashes: [],
        snapshots: [],
        stateSamples: [],
        events: [],
        previousObservation: null,
        factContract: createFactContractChecker(),
        restoreUpdate: () => undefined,
        restoreDebugUi: collapseDebugUiForRecording(document),
        droppedStateHashes: 0,
        lastHashedFrame: null,
      };
      try {
        session.restoreUpdate = installRecordingUpdateHook(session);
        inputService.setMovementSource(recorder);
      } catch (error) {
        session.restoreDebugUi();
        throw error;
      }
      state.status = 'recording';
      state.recordingSession = session;
      state.lastError = null;
      state.firstDivergence = null;
      state.replayFrame = null;
      return {
        status: state.status,
        startStateHash: session.startStateHash,
        seed: game.getDeterminismContext().seed,
        hashVersion,
        anchorFrame: session.anchorFrame,
        warning: getAnchorFrameWarning(session.anchorFrame),
      };
    },

    stopRec(label) {
      const session = state.recordingSession;
      if (!session || state.status !== 'recording') {
        throw new Error('No active recording session.');
      }
      try {
        const recording = finishRecordingSession(session, label ?? session.label);
        state.status = 'idle';
        state.recordingSession = null;
        state.lastRecording = recording;
        state.lastSnapshots = session.snapshots.slice(0, recording.frames.length);
        state.lastError = null;
        return recording;
      } catch (error) {
        state.status = 'idle';
        state.recordingSession = null;
        state.lastError = error instanceof Error ? error.message : String(error);
        throw error;
      }
    },

    async replay(recordingInput, runOptions = {}) {
      const recording = resolveRecording(recordingInput, state);
      return replayRecording(options, state, recording, runOptions);
    },

    async playback(recordingInput, playbackOptions = {}) {
      const recording = resolveRecording(recordingInput, state);
      return playbackRecording(options, state, recording, playbackOptions);
    },

    async reconstructTrail(recordingInput, runOptions = {}) {
      const recording = resolveRecording(recordingInput, state);
      return reconstructTrail(options, state, recording, runOptions);
    },

    async replayValidateSamples(recordingInput, runOptions = {}) {
      const recording = resolveRecording(recordingInput, state);
      return replayValidateSamples(options, state, recording, runOptions);
    },

    extractSemantic(recordingInput) {
      const recording = resolveRecording(recordingInput, state);
      return extractSemanticScript(recording, {
        sourceTape: recording.envelope.label,
      }).script;
    },

    peekRec(fromIndex = 0) {
      const session = state.recordingSession;
      if (!session || state.status !== 'recording') return null;
      const totalFrames = session.recorder.getRecordedFrameCount();
      const start = Math.max(0, Math.min(Math.floor(fromIndex), totalFrames));
      const frames = session.recorder.getFrameSlice(start);
      // stateHashes are appended post-update, so they can lag frames by at most one entry.
      const usable = Math.min(frames.length, Math.max(0, session.stateHashes.length - start));
      const end = start + usable;
      return {
        envelope: createRecordingEnvelope(session, end, session.label),
        fromIndex: start,
        totalFrames: end,
        frames: frames.slice(0, usable),
        stateHashes: session.stateHashes.slice(start, end),
        trail: buildTrailFromSnapshots(session.snapshots.slice(start, end), usable),
        stateSamples: session.stateSamples.filter((sample) => sample.frame >= start && sample.frame < end),
        events: session.events.filter((event) => event.frame >= start && event.frame < end),
        droppedFrames: session.recorder.getDroppedFrameCount(),
      };
    },

    async semanticReplay(scriptInput, semanticOptions = {}) {
      const script = resolveSemanticScript(scriptInput, state);
      return semanticReplayScript(options, state, script, semanticOptions);
    },

    async semanticReplayMajority(scriptInput, majorityOptions = {}) {
      const script = resolveSemanticScript(scriptInput, state);
      const { minRuns, maxRuns, ...replayOptions } = majorityOptions;
      const { decision, runs } = await runSemanticGradeMajority(
        // 每一跑都必须 restart —— 否则第二跑从上一跑的终局态起步,档位毫无意义。
        () => semanticReplayScript(options, state, script, { ...replayOptions, restart: true }),
        (verdict) => verdict.grade,
        { minRuns, maxRuns },
      );
      const verdicts = runs.map((run) => run.verdict);
      const matching = verdicts.filter((verdict) => verdict.grade === decision.grade);
      const representative = (matching.length > 0 ? matching : verdicts)[0]!;
      return {
        decision,
        verdict: decision.flaky ? { ...representative, flaky: true } : representative,
        verdicts,
      };
    },

    async runBenchmark(benchmarkOptions = {}) {
      return runRecordReplayBenchmark(options, state, benchmarkOptions);
    },

    async runBenchmarkMajority(benchmarkOptions = {}) {
      const { minRuns, maxRuns, ...rest } = benchmarkOptions;
      return runRecordReplayBenchmarkMajority(
        () => runRecordReplayBenchmark(options, state, { ...rest, restart: true }),
        { minRuns, maxRuns },
      );
    },

    async stepTo(recordingInput, frameCount) {
      const recording = resolveRecording(recordingInput, state);
      return replayRecording(options, state, recording, {
        restart: true,
        maxFrames: Math.max(0, Math.floor(frameCount)),
        resumeOnComplete: false,
      });
    },

    selfTest() {
      return runRecordReplaySelfTest({
        getGame: options.getGame,
        restartGame: options.restartGame,
        packageInfo: {
          projectId: packageInfo.name ?? 'pa_template',
          templateVersion: packageInfo.version ?? '0.0.0',
        },
      });
    },

    snapshot(hashVersion = LATEST_RECORD_REPLAY_HASH_VERSION) {
      return stateHash(requireGame(options), hashVersion);
    },

    getState() {
      return readPanelState(state, options.getGame());
    },

    export() {
      if (!state.lastRecording) throw new Error('No recording available to export.');
      return JSON.stringify(state.lastRecording);
    },

    import(json) {
      const recording = parseDemoRecordingJson(json);
      state.lastRecording = recording;
      state.lastSnapshots = [];
      state.lastError = null;
      return recording;
    },

    abort() {
      state.abortRequested = true;
      if (state.status === 'recording') cleanupRecordingSession(state);
      state.status = 'aborted';
      return { status: state.status };
    },
  };
}

function renderPanel(content: HTMLElement, api: RecordReplayAgentApi): Disposable {
  const doc = content.ownerDocument;
  content.style.cssText = 'display:grid;gap:8px;padding:10px;min-width:320px;box-sizing:border-box';

  const status = createDebugStatusLine(doc, 'idle');
  const text = doc.createElement('textarea');
  text.spellcheck = false;
  text.style.cssText = [
    'width:100%',
    'height:86px',
    'box-sizing:border-box',
    'border:1px solid rgba(148,163,184,.32)',
    'border-radius:6px',
    'background:rgba(15,23,42,.82)',
    'color:#e2e8f0',
    'font:10px ui-monospace,SFMono-Regular,Menlo,monospace',
    'resize:vertical',
  ].join(';');

  const refreshStatus = (message?: string) => {
    const current = api.getState();
    const warning = current.warning ? ` · ${current.warning}` : '';
    status.textContent = message ?? `${current.status} · frames ${current.lastRecordingFrames} · seed ${current.seed ?? '-'} · hv${current.hashVersion ?? '-'} · anchor ${current.anchorFrame ?? '?'} · dropped ${current.droppedFrames}${warning}`;
  };
  const run = (task: () => Promise<unknown> | unknown, success?: (value: unknown) => string) => {
    void Promise.resolve()
      .then(task)
      .then((value) => refreshStatus(success?.(value) ?? 'done'))
      .catch((error) => refreshStatus(error instanceof Error ? error.message : String(error)));
  };

  const start = createActionButton(doc, 'Start', () => run(() => api.startRec(), () => 'recording'));
  const stop = createActionButton(doc, 'Stop', () => run(() => api.stopRec(), (value) => {
    const recording = value as DemoRecording;
    text.value = JSON.stringify(recording);
    return `recorded ${recording.frames.length} frames`;
  }));
  const replay = createActionButton(doc, 'Replay', () => run(() => api.replay(text.value || undefined), (value) => {
    const result = value as RecordReplayRunResult;
    return result.ok ? `replay ok: ${result.frames} frames` : `diverged at ${result.firstDivergence}`;
  }));
  const samples = createActionButton(doc, 'Samples', () => run(() => api.replayValidateSamples(text.value || undefined), (value) => {
    const result = value as RecordReplaySampleValidationResult;
    return result.ok
      ? `samples ok: ${result.samples.length}/${result.samples.length}`
      : `sample fail: ${result.firstFailure?.frame ?? 'none'}`;
  }));
  const extractSemanticButton = createActionButton(doc, 'ExtractB', () => run(() => {
    const script = api.extractSemantic(text.value || undefined);
    text.value = JSON.stringify(script);
    return script;
  }, (value) => `semantic ${(value as SemanticScript).waypoints.length} waypoints`));
  const semanticReplayButton = createActionButton(doc, 'ReplayB', () => run(() => api.semanticReplay(text.value || undefined), (value) => {
    const verdict = value as SemanticVerdict;
    return `modeB ${verdict.quality}: ${verdict.milestones.matched} milestones`;
  }));
  const selfTest = createActionButton(doc, 'SelfTest', () => run(() => api.selfTest(), (value) => (value as RecordReplaySelfTestResult).message));
  const exportButton = createActionButton(doc, 'Export', () => run(() => {
    text.value = api.export();
    return text.value;
  }, () => 'exported'));
  const importButton = createActionButton(doc, 'Import', () => run(() => api.import(text.value), (value) => `imported ${(value as DemoRecording).frames.length} frames`));
  const abort = createActionButton(doc, 'Abort', () => run(() => api.abort(), () => 'aborted'));

  content.append(
    createButtonRow(doc, [start, stop, replay, selfTest]),
    createButtonRow(doc, [samples, exportButton, importButton, abort]),
    createButtonRow(doc, [extractSemanticButton, semanticReplayButton]),
    status,
    text,
  );
  refreshStatus();
  const interval = window.setInterval(() => refreshStatus(), 750);
  return {
    dispose() {
      window.clearInterval(interval);
    },
  };
}

function createButtonRow(doc: Document, buttons: HTMLButtonElement[]): HTMLElement {
  return createDebugButtonRow(doc, buttons);
}

function createActionButton(doc: Document, label: string, onClick: () => void): HTMLButtonElement {
  const button = createDebugButton(doc, label, onClick);
  button.style.height = '28px';
  button.style.minWidth = '0';
  button.style.padding = '0 8px';
  button.style.fontSize = '11px';
  return button;
}


/** 豁免来自 providers 注册表(静态元数据),不来自逐帧快照 —— 快照进 hash。 */
function createFactContractChecker(): FactContractChecker {
  const checker = new FactContractChecker();
  checker.addExemptions(readRecordReplayObservationOnlyFactKeys());
  return checker;
}

function installRecordingUpdateHook(session: RecordingSession): () => void {
  return installPostUpdateStateCapture(session.game, session.hashVersion, (result, update) => {
    captureRecordedFrameState(session, result, update);
  });
}

function captureRecordedFrameState(
  session: RecordingSession,
  result: StateHashResult,
  update: PostUpdateStateCapture,
): void {
  const recorded = session.recorder.recordUpdate(update.frame, update.dt);
  const dropped = session.recorder.getDroppedFrameCount();
  if (dropped > session.droppedStateHashes) {
    const droppedNow = dropped - session.droppedStateHashes;
    session.stateHashes.splice(0, droppedNow);
    session.snapshots.splice(0, droppedNow);
    for (const sample of session.stateSamples) sample.frame -= droppedNow;
    session.stateSamples = session.stateSamples.filter((sample) => sample.frame >= 0);
    // 事件按**索引**存(与 stateSamples 同一坐标系),环形丢帧后一起左移并丢弃越界的。
    for (const event of session.events) event.frame -= droppedNow;
    session.events = session.events.filter((event) => event.frame >= 0);
    session.droppedStateHashes = dropped;
  }

  const index = recorded.index;
  session.stateHashes[index] = result.hash;
  session.snapshots[index] = result.snapshot;
  captureRecordedFrameEvents(session, result.snapshot, index, update);
  if (index % STATE_SAMPLE_INTERVAL_FRAMES === 0) {
    upsertStateSample(session, index, recorded.frame.frame, result);
  }
  session.lastHashedFrame = recorded.frame.frame;
}

/**
 * 逐帧跑 detector,把离散事件持久化进 tape。
 *
 * 为什么必须逐帧:`stateSamples` 每 60 帧才存一份,一个完整发生在两次采样之间的
 * `false → true → false`(短命事件:一次性拾取、瞬时触发、一帧内开合的门)在基于采样的
 * 提取里**完全消失** —— 示教剧本里没有它,Mode B 自然也不会去验它。
 *
 * 顺带在这里做 providers 契约校验(布尔要 latch / 数值要单调):违约的 provider 会让
 * 逐帧检测产出一串伪里程碑,当场喊出来比几小时后在 verdict 里读到一堆 extra 便宜得多。
 */
function captureRecordedFrameEvents(
  session: RecordingSession,
  snapshot: JsonSnapshot,
  index: number,
  update: PostUpdateStateCapture,
): void {
  const observation = readSemanticObservationFromSnapshot(snapshot, update.frame);
  for (const violation of session.factContract.observe(update.frame, observation.facts)) {
    console.warn(formatFactContractViolation(violation));
  }

  const previous = session.previousObservation;
  session.previousObservation = observation;
  if (!previous) return;

  for (const milestone of diffSemanticObservations(previous, observation)) {
    if (!isDiscreteSemanticMilestone(milestone)) continue;
    session.events.push({
      frame: index,
      kind: milestone.kind,
      payload: {
        detail: { ...milestone.detail },
        economy: { ...observation.economy },
      },
    });
  }
}

function readPlayerPositionFromSnapshot(snapshot: unknown): [number, number] | null {
  const root = snapshot as {
    playerPosition?: { x?: unknown; z?: unknown };
    player?: { position?: { x?: unknown; z?: unknown } };
  } | undefined;
  const candidates = [root?.playerPosition, root?.player?.position];
  for (const position of candidates) {
    if (typeof position?.x === 'number' && typeof position?.z === 'number') {
      return [Math.round(position.x * 1000) / 1000, Math.round(position.z * 1000) / 1000];
    }
  }
  return null;
}

function readPlayerWorldPosition(game: Game): [number, number] | null {
  const registered = readRecordReplayPlayerPosition();
  if (registered) {
    return [Math.round(registered.x * 1000) / 1000, Math.round(registered.z * 1000) / 1000];
  }
  const player = game.getPlayer?.() as { position?: { x?: unknown; z?: unknown } } | null;
  if (typeof player?.position?.x === 'number' && typeof player?.position?.z === 'number') {
    return [Math.round(player.position.x * 1000) / 1000, Math.round(player.position.z * 1000) / 1000];
  }
  return null;
}

function buildTrailFromSnapshots(snapshots: JsonSnapshot[], frameCount: number): Array<[number, number]> | null {
  if (frameCount <= 0) return null;
  const trail: Array<[number, number]> = [];
  for (let index = 0; index < frameCount; index += 1) {
    const point = readPlayerPositionFromSnapshot(snapshots[index]);
    if (!point) return null;
    trail.push(point);
  }
  return trail;
}

function upsertStateSample(
  session: RecordingSession,
  frame: number,
  gameFrame: number,
  result: StateHashResult,
): void {
  const sample: DemoRecordingStateSample = {
    frame,
    gameFrame,
    hashVersion: session.hashVersion,
    hash: result.hash,
    snapshot: result.snapshot,
  };
  const existing = session.stateSamples.findIndex((item) => item.frame === frame);
  if (existing >= 0) session.stateSamples[existing] = sample;
  else session.stateSamples.push(sample);
}

/** Envelope for a recording slice. Shared by `stopRec()` and the incremental `peekRec()`. */
function createRecordingEnvelope(session: RecordingSession, frameCount: number, label: string): DemoRecordingEnvelope {
  // maxFrames 溢出后 RecorderSource 环形丢掉了最早的帧,而下面这些字段描述的仍是**被丢掉的那个起点**。
  // 不打标的话,tape 就在谎报自己从哪开始 —— Mode A 会从第 0 帧发散,且看起来像"世界不确定"。
  const droppedFrames = session.recorder.getDroppedFrameCount();
  const semanticsVersion = getRecordReplayProviderSemanticsVersion();
  return {
    ...(droppedFrames > 0 ? { truncated: true as const, droppedFrames } : {}),
    ...(semanticsVersion !== null ? { providerSemanticsVersion: semanticsVersion } : {}),
    schemaVersion: RECORD_REPLAY_SCHEMA_VERSION,
    hashVersion: session.hashVersion,
    templateVersion: packageInfo.version ?? '0.0.0',
    projectId: packageInfo.name ?? 'pa_template',
    createdAt: new Date().toISOString(),
    seed: session.game.getDeterminismContext().seed,
    settledMarker: RECORD_REPLAY_SETTLED_MARKER,
    anchorFrame: session.anchorFrame,
    startFrame: session.startFrame,
    startStateHash: session.startStateHash,
    frames: frameCount,
    label,
  };
}

function finishRecordingSession(session: RecordingSession, label: string): DemoRecording {
  session.restoreUpdate();
  session.inputService.setMovementSource(session.originalSource);
  session.game.setDtOverride(null);
  session.restoreDebugUi();
  const frames = session.recorder.getFrames();
  assertDenseRecordingFrames(frames, 'recording.frames');
  const stateHashes = session.stateHashes.slice(0, frames.length);
  if (stateHashes.length !== frames.length || stateHashes.some((hash) => typeof hash !== 'string')) {
    throw new Error(`Recording incomplete: ${stateHashes.length} state hashes for ${frames.length} frames.`);
  }
  const lastFrameIndex = frames.length - 1;
  if (lastFrameIndex >= 0 && !session.stateSamples.some((sample) => sample.frame === lastFrameIndex)) {
    const snapshot = session.snapshots[lastFrameIndex];
    const hash = stateHashes[lastFrameIndex];
    if (snapshot && hash) {
      session.stateSamples.push({
        frame: lastFrameIndex,
        gameFrame: frames[lastFrameIndex]?.frame ?? lastFrameIndex,
        hashVersion: session.hashVersion,
        hash,
        snapshot,
      });
    }
  }
  const droppedFrames = session.recorder.getDroppedFrameCount();
  const trail = buildTrailFromSnapshots(session.snapshots, frames.length);
  const recording: DemoRecording = {
    envelope: createRecordingEnvelope(session, frames.length, label),
    frames,
    stateHashes,
    events: [
      ...(droppedFrames > 0
        ? [{ frame: frames[0]?.frame ?? 0, kind: 'warning:droppedFrames', payload: { droppedFrames } }]
        : []),
      ...(session.anchorFrame > 0
        ? [{
            frame: frames[0]?.frame ?? session.anchorFrame,
            kind: 'warning:nonFrame0Anchor',
            payload: { anchorFrame: session.anchorFrame, message: NON_FRAME_ZERO_ANCHOR_WARNING },
          }]
        : []),
      // 逐帧 detector 事件。稀疏 stateSample 之间的短命事件(false→true→false)只有这里有。
      ...session.events.filter((event) => event.frame >= 0 && event.frame < frames.length),
    ],
    stateSamples: session.stateSamples
      .filter((sample) => sample.frame >= 0 && sample.frame < frames.length)
      .sort((a, b) => a.frame - b.frame),
    ...(trail ? { trail } : {}),
  };
  assertDemoRecording(recording);
  return recording;
}

async function playbackRecording(
  options: RuntimeRecordReplayPanelOptions,
  state: MutablePanelState,
  recording: DemoRecording,
  playbackOptions: RecordReplayPlaybackOptions,
): Promise<RecordReplayPlaybackResult> {
  ensureVisibleDocument();
  assertDemoRecording(recording);
  cleanupRecordingSession(state);
  state.status = 'replaying';
  state.abortRequested = false;
  state.replayFrame = null;
  state.lastError = null;
  const restoreDebugUi = collapseDebugUiForRecording(document);
  const speed = Math.max(0.1, playbackOptions.speed ?? 1);

  try {
    const game = await prepareReplayGame(options, recording, playbackOptions.restart !== false);
    const inputService = requireInputService(game);
    const originalSource = inputService.getMovementSource();
    const replaySource = new ReplaySource(recording.frames);
    const maxFrames = Math.min(
      recording.frames.length,
      Math.max(0, Math.floor(playbackOptions.maxFrames ?? recording.frames.length)),
    );

    inputService.setMovementSource(replaySource);
    try {
      for (let index = 0; index < maxFrames; index += 1) {
        if (state.abortRequested) {
          state.status = 'aborted';
          return { ok: false, status: state.status, frames: index, aborted: true };
        }
        state.replayFrame = index;
        const dt = recording.frames[index]?.dt ?? 0;
        applyRecordedFrameActions(recording.frames[index]);
        replaySource.setFrameIndex(index);
        game.stepFrame(dt);
        const waitMs = Math.min(250, (dt * 1000) / speed);
        if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    } finally {
      inputService.setMovementSource(originalSource);
      game.setDtOverride(null);
    }

    state.status = 'idle';
    state.replayFrame = null;
    return { ok: true, status: state.status, frames: maxFrames, aborted: false };
  } catch (error) {
    state.status = 'idle';
    state.replayFrame = null;
    state.lastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    restoreDebugUi();
  }
}

async function replayRecording(
  options: RuntimeRecordReplayPanelOptions,
  state: MutablePanelState,
  recording: DemoRecording,
  runOptions: RecordReplayRunOptions,
): Promise<RecordReplayRunResult> {
  ensureVisibleDocument();
  assertDemoRecording(recording);
  cleanupRecordingSession(state);
  state.status = 'replaying';
  state.abortRequested = false;
  state.firstDivergence = null;
  state.replayFrame = null;
  state.lastError = null;
  const restoreDebugUi = collapseDebugUiForRecording(document);

  try {
    const game = await prepareReplayGame(options, recording, runOptions.restart !== false);
    const inputService = requireInputService(game);
    const maxFrames = Math.min(recording.frames.length, Math.max(0, Math.floor(runOptions.maxFrames ?? recording.frames.length)));
    const hashVersion = getRecordingHashVersion(recording);
    const expectedSnapshots = state.lastRecording === recording ? state.lastSnapshots : [];
    const expectedSampleByFrame = new Map((recording.stateSamples ?? []).map((sample) => [sample.frame, sample]));
    const actualSampleByFrame = new Map<number, JsonSnapshot>();
    let divergence: ReplayDivergence | null = null;

    const replayRun = await replayRecordingFrameStates({
      game,
      inputService,
      recording,
      maxFrames,
      hashVersion,
      shouldAbort: () => state.abortRequested,
      onBeforeFrame: (index) => {
        state.replayFrame = index;
      },
      onFrameState: (frameState) => {
        if (expectedSampleByFrame.has(frameState.frameIndex)) {
          actualSampleByFrame.set(frameState.frameIndex, frameState.snapshot);
        }
        const expectedHash = recording.stateHashes[frameState.frameIndex];
        if (expectedHash !== frameState.hash) {
          divergence = { frameState, expectedHash };
          return false;
        }
        return undefined;
      },
    });

    const stateHashes = replayRun.stateHashes;
    const resolvedDivergence = divergence as ReplayDivergence | null;
    if (replayRun.aborted) {
      state.status = 'aborted';
      return {
        ok: false,
        status: state.status,
        frames: stateHashes.length,
        firstDivergence: null,
        stateHashes,
      };
    }

    if (resolvedDivergence) {
      const { frameState, expectedHash } = resolvedDivergence;
      const index = frameState.frameIndex;
      state.status = 'diverged';
      state.firstDivergence = index;
      const exactSample = expectedSampleByFrame.get(index);
      const nearestSample = exactSample ?? findNearestStateSample(recording.stateSamples, index);
      const sampleActual = exactSample
        ? frameState.snapshot
        : nearestSample
          ? actualSampleByFrame.get(nearestSample.frame)
          : undefined;
      const diffs = nearestSample && sampleActual
        ? diffSnapshots(
            normalizeSampleSnapshotForComparison(nearestSample, recording),
            normalizeSnapshotForComparison(sampleActual, readStateSampleHashVersion(nearestSample, recording)),
          )
        : expectedSnapshots[index]
          ? diffSnapshots(
              normalizeSnapshotForComparison(expectedSnapshots[index], hashVersion),
              normalizeSnapshotForComparison(frameState.snapshot, hashVersion),
            )
          : undefined;
      const serializedDivergence = createSerializedDivergence({
        recording,
        frameState,
        expectedHash,
        exactSample,
        expectedSnapshot: expectedSnapshots[index],
        hashVersion,
      });
      return {
        ok: false,
        status: state.status,
        frames: stateHashes.length,
        firstDivergence: index,
        expectedHash,
        actualHash: frameState.hash,
        diffs,
        nearestSnapshotSampleFrame: nearestSample?.frame ?? null,
        serializedDivergence,
        stateHashes,
      };
    }

    if (runOptions.resumeOnComplete) game.resume();
    state.status = 'idle';
    state.replayFrame = null;
    return {
      ok: true,
      status: state.status,
      frames: stateHashes.length,
      firstDivergence: null,
      stateHashes,
    };
  } catch (error) {
    state.status = 'idle';
    state.replayFrame = null;
    state.lastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    restoreDebugUi();
  }
}


const yieldToEventLoopViaChannel = (() => {
  let channel: MessageChannel | null = null;
  const resolvers: Array<() => void> = [];
  return (): Promise<void> => new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') { setTimeout(resolve, 0); return; }
    if (!channel) {
      channel = new MessageChannel();
      channel.port1.onmessage = () => resolvers.shift()?.();
    }
    resolvers.push(resolve);
    channel.port2.postMessage(null);
  });
})();

async function reconstructTrail(
  options: RuntimeRecordReplayPanelOptions,
  state: MutablePanelState,
  recording: DemoRecording,
  runOptions: RecordReplayRunOptions,
): Promise<RecordReplayTrailResult> {
  ensureVisibleDocument();
  assertDemoRecording(recording);
  cleanupRecordingSession(state);
  state.status = 'replaying';
  state.abortRequested = false;
  state.replayFrame = null;
  state.lastError = null;
  const restoreDebugUi = collapseDebugUiForRecording(document);

  try {
    const game = await prepareReplayGame(options, recording, runOptions.restart !== false);
    const inputService = requireInputService(game);
    const maxFrames = Math.min(recording.frames.length, Math.max(0, Math.floor(runOptions.maxFrames ?? recording.frames.length)));
    const trail: Array<[number, number]> = [];
    let missingPositions = 0;
    let aborted = false;

    // 精简循环:不装 hash 捕获钩子、零序列化(全量 hash 是 9061 帧跑 70 分钟的元凶/GC 风暴);
    // 只 step + 直读 player.position,每 25 帧 MessageChannel yield。
    const originalSource = inputService.getMovementSource();
    const replaySource = new ReplaySource(recording.frames);
    inputService.setMovementSource(replaySource);
    game.setSuppressPausedRender?.(true);
    try {
      for (let index = 0; index < maxFrames; index += 1) {
        if (state.abortRequested) { aborted = true; break; }
        if (index > 0 && index % 25 === 0) await yieldToEventLoopViaChannel();
        state.replayFrame = index;
        applyRecordedFrameActions(recording.frames[index]);
        replaySource.setFrameIndex(index);
        game.stepFrame(recording.frames[index]?.dt ?? 0);
        const point = readPlayerWorldPosition(game);
        if (point) trail.push(point);
        else missingPositions += 1;
      }
    } finally {
      inputService.setMovementSource(originalSource);
      game.setDtOverride(null);
      game.setSuppressPausedRender?.(false);
    }

    state.status = 'idle';
    state.replayFrame = null;
    const complete = !aborted && trail.length === maxFrames && missingPositions === 0;
    const recordingWithTrail: DemoRecording = complete ? { ...recording, trail } : recording;
    if (complete) {
      state.lastRecording = recordingWithTrail;
      state.lastSnapshots = [];
    }
    return {
      ok: complete,
      aborted,
      frames: trail.length,
      missingPositions,
      recordingWithTrail: complete ? recordingWithTrail : null,
    };
  } catch (error) {
    state.status = 'idle';
    state.replayFrame = null;
    state.lastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    restoreDebugUi();
  }
}

async function replayValidateSamples(
  options: RuntimeRecordReplayPanelOptions,
  state: MutablePanelState,
  recording: DemoRecording,
  runOptions: RecordReplayRunOptions,
): Promise<RecordReplaySampleValidationResult> {
  ensureVisibleDocument();
  assertDemoRecording(recording);
  cleanupRecordingSession(state);
  state.status = 'replaying';
  state.abortRequested = false;
  state.firstDivergence = null;
  state.replayFrame = null;
  state.lastError = null;
  const restoreDebugUi = collapseDebugUiForRecording(document);

  try {
    const samples = [...(recording.stateSamples ?? [])]
      .filter((sample) => Number.isFinite(sample.frame) && sample.frame >= 0)
      .sort((a, b) => a.frame - b.frame);
    if (samples.length <= 0) {
      throw new Error('recording has no stateSamples; sample-level validation is unavailable.');
    }

    const game = await prepareReplayGame(options, recording, runOptions.restart !== false);
    const inputService = requireInputService(game);
    const maxFrames = Math.min(recording.frames.length, Math.max(0, Math.floor(runOptions.maxFrames ?? recording.frames.length)));
    const hashVersion = getRecordingHashVersion(recording);
    const sampleByFrame = new Map(samples.map((sample) => [sample.frame, sample]));
    const validationSamples: RecordReplaySampleValidationPoint[] = [];

    const replayRun = await replayRecordingFrameStates({
      game,
      inputService,
      recording,
      maxFrames,
      hashVersion,
      shouldAbort: () => state.abortRequested,
      onBeforeFrame: (index) => {
        state.replayFrame = index;
      },
      onFrameState: (frameState) => {
        const sample = sampleByFrame.get(frameState.frameIndex);
        if (!sample) return undefined;
        const sampleHashVersion = readStateSampleHashVersion(sample, recording);
        const expected = normalizeSampleSnapshotForComparison(sample, recording);
        const actual = normalizeSnapshotForComparison(frameState.snapshot, sampleHashVersion);
        const diffs = diffSnapshots(expected, actual);
        validationSamples.push({
          frame: sample.frame,
          gameFrame: typeof sample.gameFrame === 'number' && Number.isFinite(sample.gameFrame) ? sample.gameFrame : null,
          pass: diffs.length === 0,
          expectedHash: sample.hash,
          actualHash: frameState.hash,
          diffCount: diffs.length,
          diffs: diffs.length > 0 ? diffs : undefined,
        });
        return undefined;
      },
    });

    if (replayRun.aborted) {
      state.status = 'aborted';
      return {
        ok: false,
        status: state.status,
        frames: replayRun.stateHashes.length,
        samples: validationSamples,
        firstFailure: validationSamples.find((sample) => !sample.pass) ?? null,
        stateHashes: replayRun.stateHashes,
      };
    }

    for (const sample of samples) {
      if (sample.frame >= maxFrames || validationSamples.some((item) => item.frame === sample.frame)) continue;
      validationSamples.push({
        frame: sample.frame,
        gameFrame: typeof sample.gameFrame === 'number' && Number.isFinite(sample.gameFrame) ? sample.gameFrame : null,
        pass: false,
        expectedHash: sample.hash,
        diffCount: 1,
        diffs: [{
          path: '$',
          expected: 'state sample was present in tape',
          actual: 'sample frame was not reached during replay',
        }],
      });
    }
    validationSamples.sort((a, b) => a.frame - b.frame);
    const firstFailure = validationSamples.find((sample) => !sample.pass) ?? null;

    if (runOptions.resumeOnComplete) game.resume();
    state.status = firstFailure ? 'diverged' : 'idle';
    state.firstDivergence = firstFailure?.frame ?? null;
    state.replayFrame = null;
    return {
      ok: !firstFailure,
      status: state.status,
      frames: replayRun.stateHashes.length,
      samples: validationSamples,
      firstFailure,
      stateHashes: replayRun.stateHashes,
    };
  } catch (error) {
    state.status = 'idle';
    state.replayFrame = null;
    state.lastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    restoreDebugUi();
  }
}

async function semanticReplayScript(
  options: RuntimeRecordReplayPanelOptions,
  state: MutablePanelState,
  script: SemanticScript,
  semanticOptions: SemanticReplayOptions & { restart?: boolean },
): Promise<SemanticVerdict> {
  ensureVisibleDocument();
  cleanupRecordingSession(state);
  state.status = 'replaying';
  state.abortRequested = false;
  state.firstDivergence = null;
  state.replayFrame = null;
  state.lastError = null;
  const restoreDebugUi = collapseDebugUiForRecording(document);

  try {
    const game = await prepareSemanticReplayGame(options, semanticOptions.restart !== false);
    const inputService = requireInputService(game);
    const verdict = await runSemanticReplay({
      game,
      inputService,
      script,
      options: semanticOptions,
      shouldAbort: () => state.abortRequested,
      onFrame: (controller) => {
        state.replayFrame = controller.getReplayFrame();
      },
    });
    state.status = verdict.ok ? 'idle' : 'diverged';
    state.firstDivergence = verdict.ok ? null : state.replayFrame;
    state.replayFrame = null;
    return verdict;
  } catch (error) {
    state.status = 'idle';
    state.replayFrame = null;
    state.lastError = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    restoreDebugUi();
  }
}

async function runRecordReplayBenchmark(
  options: RuntimeRecordReplayPanelOptions,
  state: MutablePanelState,
  benchmarkOptions: RecordReplayBenchmarkOptions,
): Promise<RecordReplayBenchmarkResult> {
  const {
    url = RECORD_REPLAY_BENCHMARK_URL,
    restart = true,
    sampleIntervalMs = RECORD_REPLAY_BENCHMARK_SAMPLE_INTERVAL_MS,
    ...semanticOptions
  } = benchmarkOptions;
  const script = await fetchBenchmarkSemanticScript(url);
  const sampler = startBenchmarkPerfSampler(options.getGame, sampleIntervalMs);
  try {
    const verdict = await semanticReplayScript(options, state, script, {
      ...semanticOptions,
      restart,
    });
    const result = createRecordReplayBenchmarkResult(verdict, sampler.stop());
    console.info(formatBenchmarkConclusion(result));
    return result;
  } catch (error) {
    sampler.stop();
    throw error;
  }
}

async function fetchBenchmarkSemanticScript(url: string): Promise<SemanticScript> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch record-replay benchmark script: ${response.status} ${response.statusText}`);
  }
  const value = await response.json();
  return value as SemanticScript;
}

function startBenchmarkPerfSampler(
  getGame: () => Game | null,
  requestedIntervalMs: number,
): { stop(): BenchmarkPerfSample[] } {
  const intervalMs = Math.max(250, Math.floor(requestedIntervalMs || RECORD_REPLAY_BENCHMARK_SAMPLE_INTERVAL_MS));
  const samples: BenchmarkPerfSample[] = [];
  let observedScene: BenchmarkObservableScene | null = null;
  let beforeRenderObserver: unknown = null;
  let afterRenderObserver: unknown = null;
  let lastRenderAt: number | null = null;
  let latestFrameMs: number | null = null;
  let latestDrawCalls: number | null = null;

  const detachScene = (): void => {
    if (observedScene && beforeRenderObserver) {
      observedScene.onBeforeRenderObservable.remove(beforeRenderObserver);
    }
    if (observedScene && afterRenderObserver) {
      observedScene.onAfterRenderObservable.remove(afterRenderObserver);
    }
    observedScene = null;
    beforeRenderObserver = null;
    afterRenderObserver = null;
    lastRenderAt = null;
  };

  const attachCurrentScene = (): void => {
    const scene = getGame()?.getScene() as unknown as BenchmarkObservableScene | undefined;
    if (!scene || scene === observedScene) return;
    detachScene();
    observedScene = scene;
    beforeRenderObserver = scene.onBeforeRenderObservable.add(() => {
      readDrawCallsCounter(getGame()?.getEngine())?.fetchNewFrame?.();
    });
    afterRenderObserver = scene.onAfterRenderObservable.add(() => {
      const now = performance.now();
      if (lastRenderAt !== null) latestFrameMs = now - lastRenderAt;
      lastRenderAt = now;
      latestDrawCalls = readDrawCallsCounter(getGame()?.getEngine())?.current ?? latestDrawCalls;
    });
  };

  const sampleOnce = (): void => {
    attachCurrentScene();
    const engine = getGame()?.getEngine() as BenchmarkEngine | undefined;
    const fps = readFiniteNumber(engine?.getFps?.());
    const frameMs = fps !== null && fps > 0 ? 1000 / fps : latestFrameMs;
    const drawCalls = readDrawCallsCounter(engine)?.current ?? latestDrawCalls;
    if (fps === null && frameMs === null && drawCalls === null) return;
    samples.push({
      fps,
      frameMs,
      drawCalls,
    });
  };

  attachCurrentScene();
  const timer = window.setInterval(sampleOnce, intervalMs);

  return {
    stop() {
      window.clearInterval(timer);
      sampleOnce();
      detachScene();
      return samples.slice();
    },
  };
}

interface BenchmarkObservableScene {
  onBeforeRenderObservable: {
    add(callback: () => void): unknown;
    remove(observer: unknown): void;
  };
  onAfterRenderObservable: {
    add(callback: () => void): unknown;
    remove(observer: unknown): void;
  };
}

interface BenchmarkEngine {
  getFps?: () => number;
  _drawCalls?: {
    fetchNewFrame?: () => void;
    current?: number;
  };
}

function readDrawCallsCounter(engine: unknown): BenchmarkEngine['_drawCalls'] | null {
  const counter = (engine as BenchmarkEngine | null | undefined)?._drawCalls;
  return counter && typeof counter === 'object' ? counter : null;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function prepareReplayGame(
  options: RuntimeRecordReplayPanelOptions,
  recording: DemoRecording,
  restart: boolean,
): Promise<Game> {
  if (restart && options.restartGame) {
    const previous = options.getGame();
    await options.restartGame({ reason: 'record-replay' });
    const restarted = await waitForReadyGame(options.getGame, previous);
    restarted.pause();
    await waitForGameplaySettled(restarted, 'record-replay restart');
    return precheckReplayStart(restarted, recording);
  }

  const game = requireGame(options);
  game.pause();
  if (game.getFrameCount() === 0) {
    await waitForGameplaySettled(game, 'record-replay frame-0 replay');
  }
  return precheckReplayStart(game, recording);
}

/**
 * 语义回放的起跑线,必须与 Mode A 完全一致:**pause → 等 settled → resume**。
 *
 * 曾经是 `resume() → 等 settled`(靠一个放弃了 frame-0 断言的 `waitForGameplaySettledLive`)。
 * 如果某个游戏的 settled 栅栏要等墙钟计时器排空(qy-last-stand 就是),游戏会在**智能体接管之前**
 * 实时空跑几百帧 —— 实测 748 帧,剧情自己播完了。settled 几乎立即为真的游戏(本仓 / 模板)只是
 * 潜伏,不是没问题:起跑线取决于墙钟就已经不确定了。
 *
 * `waitForGameplaySettled()` 的 frame-0 断言(等待期间帧号不许前进)正是用来抓这件事的,
 * 所以这里必须用它,不能用那个放宽版本。
 */
async function prepareSemanticReplayGame(
  options: RuntimeRecordReplayPanelOptions,
  restart: boolean,
): Promise<Game> {
  if (restart && options.restartGame) {
    const previous = options.getGame();
    await options.restartGame({ reason: 'semantic-record-replay' });
    const restarted = await waitForReadyGame(options.getGame, previous);
    restarted.pause();
    await waitForGameplaySettled(restarted, 'semantic record-replay restart');
    restarted.resume();
    return restarted;
  }

  const game = requireGame(options);
  game.pause();
  await waitForGameplaySettled(game, 'semantic record-replay');
  game.resume();
  return game;
}

function precheckReplayStart(game: Game, recording: DemoRecording): Game {
  if (recording.envelope.truncated) {
    throw new Error(
      `truncated record-replay tape: RecorderSource dropped ${recording.envelope.droppedFrames ?? 'some'} leading frames `
      + '(maxFrames overflow), so envelope.anchorFrame/startStateHash describe a start that is no longer in frames[0]. '
      + 'Mode A cannot replay it — every frame would be off by the dropped count and the divergence would look like '
      + 'world non-determinism. Re-record with a larger maxFrames, or use Mode B (extractSemantic + semanticReplay), '
      + 'which does not depend on the absolute start frame.',
    );
  }
  const nonDenseGap = findFirstNonDenseRecordingFrameGap(recording.frames);
  if (nonDenseGap) {
    throw new Error(
      `non-dense record-replay tape: frames[${nonDenseGap.index - 1}].frame=${nonDenseGap.previousFrame}, `
      + `frames[${nonDenseGap.index}].frame=${nonDenseGap.frame}, expected ${nonDenseGap.expectedFrame}. `
      + `This tape was likely recorded before dense per-update recording; re-record with hashVersion ${LATEST_RECORD_REPLAY_HASH_VERSION}.`,
    );
  }
  const currentSeed = game.getDeterminismContext().seed;
  if (recording.envelope.seed !== currentSeed) {
    throw new Error(`seed mismatch: recording=${recording.envelope.seed}, current=${currentSeed}`);
  }
  const anchorFrame = getRecordingAnchorFrame(recording);
  if (anchorFrame !== null && game.getFrameCount() !== anchorFrame) {
    const anchorKind = anchorFrame === 0 ? 'frame-0 anchor' : 'same-frame-offset anchor';
    throw new Error(`${anchorKind} mismatch: recording anchorFrame=${anchorFrame}, currentFrame=${game.getFrameCount()}`);
  }
  const start = stateHash(game, getRecordingHashVersion(recording));
  if (start.hash !== recording.envelope.startStateHash) {
    const diffs = diffSnapshots({ hash: recording.envelope.startStateHash }, { hash: start.hash });
    throw new Error(`startStateHash mismatch: recording=${recording.envelope.startStateHash}, current=${start.hash}, diffs=${JSON.stringify(diffs)}`);
  }
  return game;
}

function cleanupRecordingSession(state: MutablePanelState): void {
  const session = state.recordingSession;
  if (!session) return;
  session.restoreUpdate();
  session.inputService.setMovementSource(session.originalSource);
  session.game.setDtOverride(null);
  session.restoreDebugUi();
  state.recordingSession = null;
  if (state.status === 'recording') state.status = 'idle';
}

function findNearestStateSample(
  samples: readonly DemoRecordingStateSample[] | undefined,
  frame: number,
): DemoRecordingStateSample | null {
  if (!samples || samples.length <= 0) return null;
  let nearest: DemoRecordingStateSample | null = null;
  for (const sample of samples) {
    if (sample.frame > frame) continue;
    if (!nearest || sample.frame > nearest.frame) nearest = sample;
  }
  return nearest;
}

function createSerializedDivergence(params: {
  recording: DemoRecording;
  frameState: ReplayFrameState;
  expectedHash: string | undefined;
  exactSample: DemoRecordingStateSample | undefined;
  expectedSnapshot: JsonSnapshot | undefined;
  hashVersion: RecordReplayHashVersion;
}): RecordReplaySerializedDivergence {
  const { recording, frameState, expectedHash, exactSample, expectedSnapshot, hashVersion } = params;
  if (exactSample) {
    const sampleHashVersion = readStateSampleHashVersion(exactSample, recording);
    return {
      frame: frameState.frameIndex,
      expectedHash,
      actualHash: frameState.hash,
      expectedSource: 'exact-state-sample',
      expectedStableJson: stableStringify(normalizeSampleSnapshotForComparison(exactSample, recording)),
      actualStableJson: stableStringify(normalizeSnapshotForComparison(frameState.snapshot, sampleHashVersion)),
      note: 'Diverged frame has an exact stateSamples snapshot; expectedStableJson and actualStableJson are directly comparable.',
    };
  }
  if (expectedSnapshot) {
    return {
      frame: frameState.frameIndex,
      expectedHash,
      actualHash: frameState.hash,
      expectedSource: 'recorded-session-snapshot',
      expectedStableJson: stableStringify(normalizeSnapshotForComparison(expectedSnapshot, hashVersion)),
      actualStableJson: frameState.stableJson,
      note: 'Expected snapshot came from the current in-memory recording session.',
    };
  }
  return {
    frame: frameState.frameIndex,
    expectedHash,
    actualHash: frameState.hash,
    expectedSource: 'hash-only',
    actualStableJson: frameState.stableJson,
    note: 'Tape has no per-frame snapshot for this frame; run replayValidateSamples() to compare sparse stateSamples checkpoints.',
  };
}

function normalizeSampleSnapshotForComparison(
  sample: DemoRecordingStateSample,
  recording: DemoRecording,
): JsonSnapshot {
  return normalizeSnapshotForComparison(
    jsonRoundTrip(sample.snapshot),
    readStateSampleHashVersion(sample, recording),
  );
}

function readStateSampleHashVersion(
  sample: DemoRecordingStateSample,
  recording: DemoRecording,
): RecordReplayHashVersion {
  return normalizeHashVersion(sample.hashVersion ?? recording.envelope.hashVersion);
}

function jsonRoundTrip(value: unknown): unknown {
  const json = JSON.stringify(value);
  return json === undefined ? null : JSON.parse(json);
}

function resolveRecording(recordingInput: DemoRecording | string | undefined, state: MutablePanelState): DemoRecording {
  if (typeof recordingInput === 'string') return parseDemoRecordingJson(recordingInput);
  if (recordingInput) {
    assertDemoRecording(recordingInput);
    return recordingInput;
  }
  if (!state.lastRecording) throw new Error('No recording available.');
  return state.lastRecording;
}

function resolveSemanticScript(
  scriptInput: SemanticScript | DemoRecording | string | undefined,
  state: MutablePanelState,
): SemanticScript {
  if (!scriptInput) {
    const recording = resolveRecording(undefined, state);
    return extractSemanticScript(recording, { sourceTape: recording.envelope.label }).script;
  }
  let parsed: unknown = scriptInput;
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  if (isSemanticScript(parsed)) return parsed;
  return extractSemanticScript(parsed as DemoRecording, {
    sourceTape: (parsed as DemoRecording).envelope?.label ?? 'recording',
  }).script;
}

function isSemanticScript(value: unknown): value is SemanticScript {
  const candidate = value as Partial<SemanticScript> | null;
  return !!candidate
    && typeof candidate === 'object'
    && candidate.meta?.schemaVersion === 1
    && Array.isArray(candidate.inputSegments)
    && Array.isArray(candidate.milestones)
    && Array.isArray(candidate.waypoints);
}

function readPanelState(state: MutablePanelState, game: Game | null): RecordReplayPanelState {
  const determinism = game?.getDeterminismContext() ?? null;
  const droppedFrames = state.recordingSession?.recorder.getDroppedFrameCount()
    ?? readDroppedFramesFromRecording(state.lastRecording);
  const anchorFrame = state.recordingSession?.anchorFrame
    ?? (state.lastRecording ? getRecordingAnchorFrame(state.lastRecording) : null);
  const warnings = [
    droppedFrames > 0 ? `WARNING: record-replay dropped ${droppedFrames} frame(s); tape is truncated.` : null,
    getAnchorFrameWarning(anchorFrame),
  ].filter((message): message is string => !!message);
  return {
    status: state.status,
    lastError: state.lastError,
    lastRecordingFrames: state.lastRecording?.frames.length ?? state.recordingSession?.recorder.getRecordedFrameCount() ?? 0,
    firstDivergence: state.firstDivergence,
    replayFrame: state.replayFrame,
    startStateHash: state.recordingSession?.startStateHash ?? state.lastRecording?.envelope.startStateHash ?? null,
    seed: determinism?.seed ?? state.lastRecording?.envelope.seed ?? null,
    hashVersion: state.recordingSession?.hashVersion ?? (state.lastRecording ? getRecordingHashVersion(state.lastRecording) : null),
    anchorFrame,
    droppedFrames,
    randomStats: determinism?.getRandomStats() ?? null,
    warning: warnings.length > 0 ? warnings.join(' ') : null,
  };
}

function readDroppedFramesFromRecording(recording: DemoRecording | null): number {
  const warning = recording?.events?.find((event) => event.kind === 'warning:droppedFrames');
  const payload = warning?.payload as { droppedFrames?: unknown } | undefined;
  return typeof payload?.droppedFrames === 'number' && Number.isFinite(payload.droppedFrames)
    ? Math.max(0, Math.floor(payload.droppedFrames))
    : 0;
}

function getAnchorFrameWarning(anchorFrame: number | null): string | null {
  return anchorFrame !== null && anchorFrame > 0 ? NON_FRAME_ZERO_ANCHOR_WARNING : null;
}

function requireGame(options: RuntimeRecordReplayPanelOptions): Game {
  const game = options.getGame();
  if (!game) throw new Error('Game is not ready.');
  return game;
}

function requireInputService(game: Game): InputService {
  const inputService = game.getInputService();
  if (!inputService) throw new Error('InputService is not ready.');
  return inputService;
}

function ensureVisibleDocument(): void {
  if (document.visibilityState !== 'visible') {
    throw new Error('record-replay requires document.visibilityState === "visible".');
  }
}

function waitForReadyGame(getGame: () => Game | null, previous: Game | null): Promise<Game> {
  const startedAt = performance.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      const game = getGame();
      if (game && game !== previous && game.getInputService()) {
        resolve(game);
        return;
      }
      if (performance.now() - startedAt > 10_000) {
        reject(new Error('Timed out waiting for restarted game.'));
        return;
      }
      window.setTimeout(poll, 50);
    };
    poll();
  });
}

function waitForGameplaySettled(game: Game, label: string): Promise<Game> {
  if (game.isGameplaySettled()) return Promise.resolve(game);
  const startedAt = performance.now();
  const anchorFrame = game.getFrameCount();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (game.getFrameCount() !== anchorFrame) {
        reject(new Error(`Gameplay frame advanced before ${label} settled: anchor=${anchorFrame}, current=${game.getFrameCount()}`));
        return;
      }
      if (game.isGameplaySettled()) {
        resolve(game);
        return;
      }
      if (performance.now() - startedAt > GAMEPLAY_SETTLED_TIMEOUT_MS) {
        reject(new Error(`Timed out waiting for gameplay settled before ${label}.`));
        return;
      }
      requestGameplaySettledPoll(poll);
    };
    poll();
  });
}


function requestGameplaySettledPoll(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(callback);
    return;
  }
  window.setTimeout(callback, 16);
}

declare global {
  interface Window {
    __rr?: RecordReplayAgentApi;
  }
}
