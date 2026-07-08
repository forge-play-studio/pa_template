import type { Game } from '../../core/Game';
import { createExampleDragSource } from '../example-drag-source';
import { RecorderSource } from './RecorderSource';
import { ReplaySource } from './ReplaySource';
import {
  RECORD_REPLAY_SCHEMA_VERSION,
  assertDemoRecording,
  type DemoRecording,
} from './schema';
import { stateHash } from './verify';

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
  const replayStateHashes = replayScriptedDemo(replayGame, recording);
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
  const start = stateHash(game);
  let scriptFrame = 0;
  const source = createExampleDragSource({ getFrameIndex: () => scriptFrame });
  const recorder = new RecorderSource(source, game, { maxFrames: dts.length });
  const stateHashes: string[] = [];

  inputService.setMovementSource(recorder);
  try {
    for (let index = 0; index < dts.length; index += 1) {
      scriptFrame = index;
      game.stepFrame(dts[index] ?? 0);
      stateHashes.push(stateHash(game).hash);
    }
  } finally {
    inputService.setMovementSource(originalSource);
    game.setDtOverride(null);
  }

  const frames = recorder.getFrames();
  const recording: DemoRecording = {
    envelope: {
      schemaVersion: RECORD_REPLAY_SCHEMA_VERSION,
      templateVersion: packageInfo.templateVersion,
      projectId: packageInfo.projectId,
      createdAt: new Date().toISOString(),
      seed: game.getDeterminismContext().seed,
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

function replayScriptedDemo(game: Game, recording: DemoRecording): string[] {
  assertDemoRecording(recording);
  const inputService = game.getInputService();
  if (!inputService) throw new Error('selfTest replay requires InputService');
  const seed = game.getDeterminismContext().seed;
  if (seed !== recording.envelope.seed) {
    throw new Error(`selfTest seed mismatch: recording=${recording.envelope.seed}, current=${seed}`);
  }
  const start = stateHash(game);
  if (start.hash !== recording.envelope.startStateHash) {
    throw new Error(`selfTest startStateHash mismatch: recording=${recording.envelope.startStateHash}, current=${start.hash}`);
  }

  const originalSource = inputService.getMovementSource();
  const replaySource = new ReplaySource(recording.frames);
  const stateHashes: string[] = [];
  inputService.setMovementSource(replaySource);
  try {
    for (let index = 0; index < recording.frames.length; index += 1) {
      replaySource.setFrameIndex(index);
      game.stepFrame(recording.frames[index]?.dt ?? 0);
      stateHashes.push(stateHash(game).hash);
    }
  } finally {
    inputService.setMovementSource(originalSource);
    game.setDtOverride(null);
  }
  return stateHashes;
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

function createSelfTestDts(frameCount: number): number[] {
  return Array.from({ length: frameCount }, (_, index) => {
    const wave = index % 5;
    return [0.016, 0.017, 0.015, 0.018, 0.0165][wave] ?? 0.016;
  });
}
