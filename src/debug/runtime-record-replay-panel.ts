import packageJson from '../../package.json';
import type { Game } from '../core/Game';
import type { InputService } from '../services';
import type { Disposable } from './framework/disposables';
import { createDebugButton, createDebugButtonRow, createDebugStatusLine } from './framework/controls';
import { mountRuntimeDebugPanel } from './debug-panel-layout';
import { RecorderSource } from './record-replay/RecorderSource';
import { ReplaySource } from './record-replay/ReplaySource';
import {
  RECORD_REPLAY_SCHEMA_VERSION,
  assertDemoRecording,
  parseDemoRecordingJson,
  type DemoRecording,
  type RecordReplayStatus,
} from './record-replay/schema';
import { runRecordReplaySelfTest, type RecordReplaySelfTestResult } from './record-replay/self-test';
import { diffSnapshots, stateHash, type JsonSnapshot, type StateDiff } from './record-replay/verify';

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

export interface RecordReplayRunResult {
  ok: boolean;
  status: RecordReplayStatus;
  frames: number;
  firstDivergence: number | null;
  expectedHash?: string;
  actualHash?: string;
  diffs?: StateDiff[];
  stateHashes: string[];
}

export interface RecordReplayAgentApi {
  startRec(options?: { label?: string; maxFrames?: number }): { status: RecordReplayStatus; startStateHash: string; seed: number };
  stopRec(label?: string): DemoRecording;
  replay(recording?: DemoRecording | string, options?: RecordReplayRunOptions): Promise<RecordReplayRunResult>;
  stepTo(recording: DemoRecording | string, frameCount: number): Promise<RecordReplayRunResult>;
  selfTest(): Promise<RecordReplaySelfTestResult>;
  getState(): RecordReplayPanelState;
  export(): string;
  import(json: string): DemoRecording;
  abort(): { status: RecordReplayStatus };
}

export interface RecordReplayPanelState {
  status: RecordReplayStatus;
  lastError: string | null;
  lastRecordingFrames: number;
  firstDivergence: number | null;
  replayFrame: number | null;
  startStateHash: string | null;
  seed: number | null;
}

interface RecordingSession {
  game: Game;
  inputService: InputService;
  originalSource: ReturnType<InputService['getMovementSource']>;
  recorder: RecorderSource;
  startFrame: number;
  startStateHash: string;
  label: string;
  stateHashes: string[];
  snapshots: JsonSnapshot[];
  restoreUpdate: () => void;
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

const packageInfo = packageJson as { name?: string; version?: string };

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
      delete window.__rr;
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
      const start = stateHash(game);
      const recorder = new RecorderSource(inputService.getMovementSource(), game, {
        maxFrames: recordOptions.maxFrames,
      });
      const session: RecordingSession = {
        game,
        inputService,
        originalSource: inputService.getMovementSource(),
        recorder,
        startFrame: game.getFrameCount(),
        startStateHash: start.hash,
        label: recordOptions.label ?? 'recording',
        stateHashes: [],
        snapshots: [],
        restoreUpdate: () => undefined,
        droppedStateHashes: 0,
        lastHashedFrame: null,
      };
      session.restoreUpdate = installRecordingUpdateHook(session);
      inputService.setMovementSource(recorder);
      state.status = 'recording';
      state.recordingSession = session;
      state.lastError = null;
      state.firstDivergence = null;
      state.replayFrame = null;
      return {
        status: state.status,
        startStateHash: session.startStateHash,
        seed: game.getDeterminismContext().seed,
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
  content.style.cssText = 'display:grid;gap:8px;padding:10px;min-width:300px;box-sizing:border-box';

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
    status.textContent = message ?? `${current.status} · frames ${current.lastRecordingFrames} · seed ${current.seed ?? '-'}`;
  };
  const run = (task: () => Promise<unknown> | unknown, success?: (value: unknown) => string) => {
    void Promise.resolve()
      .then(task)
      .then((value) => refreshStatus(success?.(value) ?? 'done'))
      .catch((error) => refreshStatus(error instanceof Error ? error.message : String(error)));
  };

  const start = createDebugButton(doc, 'Start', () => run(() => api.startRec(), () => 'recording'));
  const stop = createDebugButton(doc, 'Stop', () => run(() => api.stopRec(), (value) => {
    const recording = value as DemoRecording;
    text.value = JSON.stringify(recording);
    return `recorded ${recording.frames.length} frames`;
  }));
  const replay = createDebugButton(doc, 'Replay', () => run(() => api.replay(text.value || undefined), (value) => {
    const result = value as RecordReplayRunResult;
    return result.ok ? `replay ok: ${result.frames} frames` : `diverged at ${result.firstDivergence}`;
  }));
  const selfTest = createDebugButton(doc, 'SelfTest', () => run(() => api.selfTest(), (value) => (value as RecordReplaySelfTestResult).message));
  const exportButton = createDebugButton(doc, 'Export', () => run(() => {
    text.value = api.export();
    return text.value;
  }, () => 'exported'));
  const importButton = createDebugButton(doc, 'Import', () => run(() => api.import(text.value), (value) => `imported ${(value as DemoRecording).frames.length} frames`));
  const abort = createDebugButton(doc, 'Abort', () => run(() => api.abort(), () => 'aborted'));

  content.append(
    createDebugButtonRow(doc, [start, stop, replay, selfTest]),
    createDebugButtonRow(doc, [exportButton, importButton, abort]),
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

function installRecordingUpdateHook(session: RecordingSession): () => void {
  const updateTarget = session.game as unknown as { update?: (deltaTime: number) => void };
  const originalUpdate = updateTarget.update;
  if (typeof originalUpdate !== 'function') {
    throw new Error('Game.update hook is unavailable for record-replay.');
  }
  const wrappedUpdate = (deltaTime: number) => {
    originalUpdate.call(session.game, deltaTime);
    captureRecordedFrameState(session);
  };
  updateTarget.update = wrappedUpdate;
  return () => {
    if (updateTarget.update === wrappedUpdate) {
      updateTarget.update = originalUpdate;
    }
  };
}

function captureRecordedFrameState(session: RecordingSession): void {
  const dropped = session.recorder.getDroppedFrameCount();
  if (dropped > session.droppedStateHashes) {
    const droppedNow = dropped - session.droppedStateHashes;
    session.stateHashes.splice(0, droppedNow);
    session.snapshots.splice(0, droppedNow);
    session.droppedStateHashes = dropped;
  }

  const frames = session.recorder.getFrames();
  const latest = frames[frames.length - 1];
  if (!latest || latest.frame === session.lastHashedFrame) return;
  const result = stateHash(session.game);
  const index = frames.length - 1;
  session.stateHashes[index] = result.hash;
  session.snapshots[index] = result.snapshot;
  session.lastHashedFrame = latest.frame;
}

function finishRecordingSession(session: RecordingSession, label: string): DemoRecording {
  session.restoreUpdate();
  session.inputService.setMovementSource(session.originalSource);
  session.game.setDtOverride(null);
  const frames = session.recorder.getFrames();
  const stateHashes = session.stateHashes.slice(0, frames.length);
  if (stateHashes.length !== frames.length || stateHashes.some((hash) => typeof hash !== 'string')) {
    throw new Error(`Recording incomplete: ${stateHashes.length} state hashes for ${frames.length} frames.`);
  }
  const recording: DemoRecording = {
    envelope: {
      schemaVersion: RECORD_REPLAY_SCHEMA_VERSION,
      templateVersion: packageInfo.version ?? '0.0.0',
      projectId: packageInfo.name ?? 'pa_template',
      createdAt: new Date().toISOString(),
      seed: session.game.getDeterminismContext().seed,
      startFrame: session.startFrame,
      startStateHash: session.startStateHash,
      frames: frames.length,
      label,
    },
    frames,
    stateHashes,
    events: [],
  };
  assertDemoRecording(recording);
  return recording;
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

  try {
    const game = await prepareReplayGame(options, recording, runOptions.restart !== false);
    const inputService = requireInputService(game);
    const originalSource = inputService.getMovementSource();
    const replaySource = new ReplaySource(recording.frames);
    const stateHashes: string[] = [];
    const maxFrames = Math.min(recording.frames.length, Math.max(0, Math.floor(runOptions.maxFrames ?? recording.frames.length)));
    const expectedSnapshots = state.lastRecording === recording ? state.lastSnapshots : [];

    inputService.setMovementSource(replaySource);
    try {
      for (let index = 0; index < maxFrames; index += 1) {
        if (state.abortRequested) {
          state.status = 'aborted';
          return {
            ok: false,
            status: state.status,
            frames: stateHashes.length,
            firstDivergence: null,
            stateHashes,
          };
        }
        state.replayFrame = index;
        replaySource.setFrameIndex(index);
        game.stepFrame(recording.frames[index]?.dt ?? 0);
        const actual = stateHash(game);
        stateHashes.push(actual.hash);
        const expectedHash = recording.stateHashes[index];
        if (expectedHash !== actual.hash) {
          state.status = 'diverged';
          state.firstDivergence = index;
          return {
            ok: false,
            status: state.status,
            frames: stateHashes.length,
            firstDivergence: index,
            expectedHash,
            actualHash: actual.hash,
            diffs: expectedSnapshots[index] ? diffSnapshots(expectedSnapshots[index], actual.snapshot) : undefined,
            stateHashes,
          };
        }
      }
    } finally {
      inputService.setMovementSource(originalSource);
      game.setDtOverride(null);
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
  }
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
    return precheckReplayStart(restarted, recording);
  }

  const game = requireGame(options);
  game.pause();
  return precheckReplayStart(game, recording);
}

function precheckReplayStart(game: Game, recording: DemoRecording): Game {
  const currentSeed = game.getDeterminismContext().seed;
  if (recording.envelope.seed !== currentSeed) {
    throw new Error(`seed mismatch: recording=${recording.envelope.seed}, current=${currentSeed}`);
  }
  const start = stateHash(game);
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
  state.recordingSession = null;
  if (state.status === 'recording') state.status = 'idle';
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

function readPanelState(state: MutablePanelState, game: Game | null): RecordReplayPanelState {
  return {
    status: state.status,
    lastError: state.lastError,
    lastRecordingFrames: state.lastRecording?.frames.length ?? state.recordingSession?.recorder.getRecordedFrameCount() ?? 0,
    firstDivergence: state.firstDivergence,
    replayFrame: state.replayFrame,
    startStateHash: state.recordingSession?.startStateHash ?? state.lastRecording?.envelope.startStateHash ?? null,
    seed: game?.getDeterminismContext().seed ?? state.lastRecording?.envelope.seed ?? null,
  };
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

declare global {
  interface Window {
    __rr?: RecordReplayAgentApi;
  }
}
