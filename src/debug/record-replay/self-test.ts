import type { Game } from '../../core/Game';
import type { MovementInputSource } from '../../services/InputService';
import { RecorderSource } from './RecorderSource';
import { installPostUpdateStateCapture, replayRecordingFrameStates } from './frame-state';
import {
  LATEST_RECORD_REPLAY_HASH_VERSION,
  RECORD_REPLAY_SCHEMA_VERSION,
  RECORD_REPLAY_SETTLED_MARKER,
  assertDemoRecording,
  getRecordingHashVersion,
  normalizeMovementInput,
  type DemoRecording,
} from './schema';
import { stateHash } from './verify';

const GAMEPLAY_SETTLED_TIMEOUT_MS = 10_000;

export interface RecordReplayPackageInfo {
  projectId: string;
  templateVersion: string;
}

export interface RecordReplaySelfTestOptions {
  getGame: () => Game | null;
  restartGame?: (context?: { reason?: string }) => Promise<void>;
  packageInfo: RecordReplayPackageInfo;
  frameCount?: number;
}

export interface RecordReplaySelfTestResult {
  ok: boolean;
  frames: number;
  startStateHash: string;
  finalStateHash: string | null;
  firstDivergence: number | null;
  dtMatch: boolean;
  recording: DemoRecording;
  replayStateHashes: string[];
  message: string;
}

export async function runRecordReplaySelfTest(options: RecordReplaySelfTestOptions): Promise<RecordReplaySelfTestResult> {
  const frameCount = Math.max(1, Math.floor(options.frameCount ?? 180));
  const dts = createSelfTestDts(frameCount);
  const recordGame = await restartAndPause(options, 'record-replay-self-test-record');
  const recording = recordScriptedDemo(recordGame, dts, options.packageInfo);
  const replayGame = await restartAndPause(options, 'record-replay-self-test-replay');
  const replayStateHashes = await replayScriptedDemo(replayGame, recording);
  const firstDivergence = recording.stateHashes.findIndex((hash, index) => hash !== replayStateHashes[index]);
  const dtMatch = recording.frames.every((frame, index) => frame.dt === dts[index]);
  const ok = firstDivergence < 0 && dtMatch;

  return {
    ok,
    frames: recording.frames.length,
    startStateHash: recording.envelope.startStateHash,
    finalStateHash: replayStateHashes[replayStateHashes.length - 1] ?? null,
    firstDivergence: firstDivergence >= 0 ? firstDivergence : null,
    dtMatch,
    recording,
    replayStateHashes,
    message: ok
      ? `selfTest passed: ${recording.frames.length} frames replayed with recorded dt`
      : `selfTest failed: ${firstDivergence >= 0 ? `first divergence at frame ${firstDivergence}` : 'recorded dt mismatch'}`,
  };
}

function recordScriptedDemo(game: Game, dts: readonly number[], packageInfo: RecordReplayPackageInfo): DemoRecording {
  const inputService = game.getInputService();
  if (!inputService) throw new Error('selfTest requires InputService');
  const originalSource = inputService.getMovementSource();
  const hashVersion = LATEST_RECORD_REPLAY_HASH_VERSION;
  const start = stateHash(game, hashVersion);
  let scriptFrame = 0;
  const source = createSelfTestDragSource(() => scriptFrame);
  const recorder = new RecorderSource(source, game, { maxFrames: dts.length });
  const stateHashes: string[] = [];

  const restoreCapture = installPostUpdateStateCapture(game, hashVersion, (result, update) => {
    recorder.recordUpdate(update.frame, update.dt);
    stateHashes.push(result.hash);
  });
  inputService.setMovementSource(recorder);
  try {
    for (let index = 0; index < dts.length; index += 1) {
      scriptFrame = index;
      game.stepFrame(dts[index] ?? 0);
    }
  } finally {
    inputService.setMovementSource(originalSource);
    game.setDtOverride(null);
    restoreCapture();
  }

  const frames = recorder.getFrames();
  if (stateHashes.length !== frames.length) {
    throw new Error(`selfTest recorded ${stateHashes.length} state hashes for ${frames.length} frames`);
  }
  const recording: DemoRecording = {
    envelope: {
      schemaVersion: RECORD_REPLAY_SCHEMA_VERSION,
      hashVersion,
      templateVersion: packageInfo.templateVersion,
      projectId: packageInfo.projectId,
      createdAt: new Date().toISOString(),
      seed: game.getDeterminismContext().seed,
      settledMarker: RECORD_REPLAY_SETTLED_MARKER,
      anchorFrame: game.getFrameCount() - frames.length,
      startFrame: game.getFrameCount() - frames.length,
      startStateHash: start.hash,
      frames: frames.length,
      label: 'record-replay selfTest',
    },
    frames,
    stateHashes,
    events: [],
  };
  assertDemoRecording(recording);
  return recording;
}

async function replayScriptedDemo(game: Game, recording: DemoRecording): Promise<string[]> {
  assertDemoRecording(recording);
  const inputService = game.getInputService();
  if (!inputService) throw new Error('selfTest replay requires InputService');
  const seed = game.getDeterminismContext().seed;
  if (seed !== recording.envelope.seed) {
    throw new Error(`selfTest seed mismatch: recording=${recording.envelope.seed}, current=${seed}`);
  }
  const hashVersion = getRecordingHashVersion(recording);
  const start = stateHash(game, hashVersion);
  if (start.hash !== recording.envelope.startStateHash) {
    throw new Error(`selfTest startStateHash mismatch: recording=${recording.envelope.startStateHash}, current=${start.hash}`);
  }

  const replayRun = await replayRecordingFrameStates({
    game,
    inputService,
    recording,
    hashVersion,
  });
  return replayRun.stateHashes;
}

async function restartAndPause(options: RecordReplaySelfTestOptions, reason: string): Promise<Game> {
  if (!options.restartGame) {
    throw new Error('selfTest requires __restartProjectGame so recording and replay begin from the same initial state');
  }
  const previous = options.getGame();
  await options.restartGame({ reason });
  const game = await waitForReadyGame(options.getGame, previous);
  game.pause();
  game.setDtOverride(null);
  await waitForGameplaySettled(game, reason);
  return game;
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
        reject(new Error('Timed out waiting for restarted game'));
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
        reject(new Error(`selfTest frame advanced before ${label} settled: anchor=${anchorFrame}, current=${game.getFrameCount()}`));
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
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(poll);
      else window.setTimeout(poll, 16);
    };
    poll();
  });
}

function createSelfTestDts(frameCount: number): number[] {
  return Array.from({ length: frameCount }, (_, index) => {
    const wave = index % 5;
    return [0.016, 0.017, 0.015, 0.018, 0.0165][wave] ?? 0.016;
  });
}

function createSelfTestDragSource(getFrameIndex: () => number): MovementInputSource {
  return {
    getInput() {
      const frame = getFrameIndex();
      if (frame < 30) return normalizeMovementInput({ x: 1, y: 0.15, magnitude: 1, isActive: true });
      if (frame < 60) return normalizeMovementInput({ x: 0.2, y: 1, magnitude: 0.85, isActive: true });
      if (frame < 90) return normalizeMovementInput({ x: -0.85, y: 0.25, magnitude: 0.9, isActive: true });
      if (frame < 120) return normalizeMovementInput({ x: 0, y: -1, magnitude: 0.7, isActive: true });
      return normalizeMovementInput({ x: 0, y: 0, magnitude: 0, isActive: false });
    },
  };
}
