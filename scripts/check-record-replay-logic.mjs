import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const outDir = mkdtempSync(join(tmpdir(), 'pa-template-rr-logic-'));

try {
  const tsc = resolve('node_modules/.bin/tsc');
  const compile = spawnSync(tsc, [
    '--target', 'ES2020',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--strict',
    '--skipLibCheck',
    '--esModuleInterop',
    '--outDir', outDir,
    '--rootDir', 'src',
    '--noEmit', 'false',
    'src/debug/record-replay/schema.ts',
    'src/debug/record-replay/providers.ts',
    'src/debug/record-replay/RecorderSource.ts',
    'src/debug/record-replay/ReplaySource.ts',
    'src/debug/record-replay/frame-state.ts',
    'src/debug/record-replay/verify.ts',
    'src/debug/record-replay/semantic/extract.ts',
    'src/debug/record-replay/semantic/replay.ts',
    'src/debug/record-replay/benchmark.ts',
    'src/core/determinism.ts',
    'src/core/engine-clock.ts',
    'src/services/InputService.ts',
  ], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (compile.status !== 0) process.exit(compile.status ?? 1);
  symlinkSync(resolve('node_modules'), join(outDir, 'node_modules'), 'dir');

  const require = createRequire(import.meta.url);
  const schema = require(join(outDir, 'debug/record-replay/schema.js'));
  const providers = require(join(outDir, 'debug/record-replay/providers.js'));
  const { RecorderSource } = require(join(outDir, 'debug/record-replay/RecorderSource.js'));
  const { ReplaySource } = require(join(outDir, 'debug/record-replay/ReplaySource.js'));
  const frameState = require(join(outDir, 'debug/record-replay/frame-state.js'));
  const verify = require(join(outDir, 'debug/record-replay/verify.js'));
  const semanticExtract = require(join(outDir, 'debug/record-replay/semantic/extract.js'));
  const semanticReplay = require(join(outDir, 'debug/record-replay/semantic/replay.js'));
  const benchmark = require(join(outDir, 'debug/record-replay/benchmark.js'));
  const { createDeterminismContext } = require(join(outDir, 'core/determinism.js'));
  const { pinEngineDeltaTimeForFrame } = require(join(outDir, 'core/engine-clock.js'));

  const {
    LATEST_RECORD_REPLAY_HASH_VERSION,
    RECORD_REPLAY_HASH_VERSION_V2,
    RECORD_REPLAY_HASH_VERSION_V3,
    RECORD_REPLAY_HASH_VERSION_V4,
    RECORD_REPLAY_SCHEMA_VERSION,
    RECORD_REPLAY_SETTLED_MARKER,
    assertDenseRecordingFrames,
    assertDemoRecording,
    findFirstNonDenseRecordingFrameGap,
    getRecordingAnchorFrame,
    getRecordingHashVersion,
    normalizeHashVersion,
  } = schema;
  const {
    clearRecordReplayProviders,
    registerRecordReplayProviders,
  } = providers;
  const {
    installPostUpdateStateCapture,
    replayRecordingFrameStates,
  } = frameState;
  const {
    diffSnapshots,
    normalizeSnapshotForComparison,
    stableStringify,
    stateHash,
  } = verify;
  const {
    diffSemanticObservations,
    extractSemanticScript,
    simplifyInputKeypoints,
  } = semanticExtract;
  const {
    normalizeSemanticReplayScript,
    SemanticReplayController,
    SemanticStuckWatchdog,
  } = semanticReplay;

  assertRecorderSourceDense({ RecorderSource, ReplaySource, assertDenseRecordingFrames });
  assertSchemaVersioning({
    RECORD_REPLAY_SCHEMA_VERSION,
    LATEST_RECORD_REPLAY_HASH_VERSION,
    RECORD_REPLAY_HASH_VERSION_V2,
    RECORD_REPLAY_HASH_VERSION_V3,
    RECORD_REPLAY_HASH_VERSION_V4,
    assertDemoRecording,
    getRecordingAnchorFrame,
    getRecordingHashVersion,
    normalizeHashVersion,
    findFirstNonDenseRecordingFrameGap,
  });
  assertPinnedEngineDeltaTimeConsistency(pinEngineDeltaTimeForFrame);
  assertDerivedRandomStreams(createDeterminismContext);
  assertProviderBackedStateHash({
    clearRecordReplayProviders,
    registerRecordReplayProviders,
    stateHash,
    diffSnapshots,
    normalizeSnapshotForComparison,
    stableStringify,
    RECORD_REPLAY_HASH_VERSION_V2,
    RECORD_REPLAY_HASH_VERSION_V3,
    RECORD_REPLAY_HASH_VERSION_V4,
    LATEST_RECORD_REPLAY_HASH_VERSION,
  });
  await assertAutostartRoundTrip({
    clearRecordReplayProviders,
    registerRecordReplayProviders,
    RecorderSource,
    installPostUpdateStateCapture,
    replayRecordingFrameStates,
    stateHash,
    assertDemoRecording,
    RECORD_REPLAY_SCHEMA_VERSION,
    RECORD_REPLAY_SETTLED_MARKER,
    LATEST_RECORD_REPLAY_HASH_VERSION,
  });
  await assertInputDisabledWindowRecordsDense({
    clearRecordReplayProviders,
    registerRecordReplayProviders,
    RecorderSource,
    installPostUpdateStateCapture,
    replayRecordingFrameStates,
    assertDenseRecordingFrames,
    assertDemoRecording,
    stateHash,
    RECORD_REPLAY_SCHEMA_VERSION,
    LATEST_RECORD_REPLAY_HASH_VERSION,
  });
  assertSemanticExtractionRdp({ simplifyInputKeypoints });
  assertSemanticProviderDetectorExtraction({
    clearRecordReplayProviders,
    registerRecordReplayProviders,
    diffSemanticObservations,
    extractSemanticScript,
    RECORD_REPLAY_SCHEMA_VERSION,
  });
  assertSemanticLegacyEconomyMilestoneNormalization({ normalizeSemanticReplayScript });
  assertSemanticStuckWatchdog({ SemanticStuckWatchdog });
  assertSemanticCalibrationZReverse({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController });
  assertSemanticProgressDrivenGate({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController });
  assertSemanticEconomyGateAndStageLoop({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController });
  assertSemanticStageLoopLimit({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController });
  assertSemanticDwellReplay({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController });
  assertSemanticCascadeAndOrder({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController });
  assertSemanticStuckRecovery({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController });
  assertBenchmarkAggregation(benchmark);

  console.log('[check-record-replay-logic] OK');
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

function assertRecorderSourceDense({ RecorderSource, ReplaySource, assertDenseRecordingFrames }) {
  let frame = 0;
  let currentDt = null;
  let lastDt = 0;
  const clock = {
    getFrameCount: () => frame,
    getCurrentFrameDeltaTime: () => currentDt,
    getLastFrameDeltaTime: () => lastDt,
  };
  const source = {
    getInput: () => ({
      x: frame % 2 === 0 ? 1 : -0.5,
      y: frame % 3 === 0 ? 0.25 : 0.75,
      magnitude: 1,
      isActive: true,
    }),
  };
  const recorder = new RecorderSource(source, clock, { maxFrames: 16 });
  const dts = [0.016, 0.017, 0.015, 0.018, 0.0165];

  for (let index = 0; index < dts.length; index += 1) {
    currentDt = dts[index];
    recorder.getInput();
    recorder.getInput();
    recorder.recordUpdate(frame, currentDt);
    lastDt = dts[index];
    currentDt = null;
    frame += 1;
  }

  const frames = recorder.getFrames();
  assert.equal(frames.length, dts.length, 'RecorderSource records one input per update');
  assert.deepEqual(frames.map((item) => item.dt), dts, 'RecorderSource stores consumed dt');
  assertDenseRecordingFrames(frames, 'logic check frames');

  const replaySource = new ReplaySource(frames);
  for (let index = 0; index < frames.length; index += 1) {
    replaySource.setFrameIndex(index);
    assert.deepEqual(replaySource.getInput(), frames[index].input, `ReplaySource returns frame ${index} input`);
  }
}

function assertSchemaVersioning({
  RECORD_REPLAY_SCHEMA_VERSION,
  LATEST_RECORD_REPLAY_HASH_VERSION,
  RECORD_REPLAY_HASH_VERSION_V2,
  RECORD_REPLAY_HASH_VERSION_V3,
  RECORD_REPLAY_HASH_VERSION_V4,
  assertDemoRecording,
  getRecordingAnchorFrame,
  getRecordingHashVersion,
  normalizeHashVersion,
  findFirstNonDenseRecordingFrameGap,
}) {
  const frames = [
    { frame: 0, dt: 0.016, input: { x: 0, y: 0, magnitude: 0, isActive: false } },
    { frame: 1, dt: 0.017, input: { x: 1, y: 0, magnitude: 1, isActive: true } },
  ];
  const recording = createBaseRecording(RECORD_REPLAY_SCHEMA_VERSION, frames, frames.map((item) => `hash:${item.frame}`));
  assertDemoRecording(recording);
  assert.equal(getRecordingHashVersion(recording), 1, 'old recordings without hashVersion import as v1');
  assert.equal(getRecordingAnchorFrame(recording), null, 'old recordings without anchorFrame import as unknown-anchor tapes');
  assert.equal(normalizeHashVersion(2), RECORD_REPLAY_HASH_VERSION_V2, 'hashVersion 2 remains addressable');
  assert.equal(normalizeHashVersion(3), RECORD_REPLAY_HASH_VERSION_V3, 'hashVersion 3 remains addressable');
  assert.equal(normalizeHashVersion(4), RECORD_REPLAY_HASH_VERSION_V4, 'hashVersion 4 remains addressable');
  assert.equal(LATEST_RECORD_REPLAY_HASH_VERSION, RECORD_REPLAY_HASH_VERSION_V4, 'latest recordings use v4');
  assert.deepEqual(
    findFirstNonDenseRecordingFrameGap([
      frames[0],
      { ...frames[1], frame: 3 },
    ]),
    { index: 1, previousFrame: 0, frame: 3, expectedFrame: 1 },
    'non-dense old tape gap is detected before replay',
  );
  assert.throws(
    () => assertDemoRecording({ ...recording, stateHashes: recording.stateHashes.slice(1) }),
    /state hash count mismatch/,
    'schema rejects hash/frame count mismatch',
  );
  assert.throws(
    () => assertDemoRecording({ ...recording, envelope: { ...recording.envelope, anchorFrame: -1 } }),
    /anchorFrame/,
    'schema rejects invalid anchorFrame values',
  );
}

function assertPinnedEngineDeltaTimeConsistency(pinEngineDeltaTimeForFrame) {
  const dts = [0.0042, 0.016, 0.0175, 0.015, 0.02];
  const liveGame = createEngineClockMockGame(pinEngineDeltaTimeForFrame);
  const stepGame = createEngineClockMockGame(pinEngineDeltaTimeForFrame);

  for (const dt of dts) {
    liveGame.gameLoop(dt);
    stepGame.stepFrame(dt);
  }

  assert.deepEqual(liveGame.updateDts, dts, 'live path updates with supplied dt');
  assert.deepEqual(stepGame.updateDts, dts, 'step path updates with tape dt');
  assert.deepEqual(liveGame.renderDeltaTimeMs, dts.map((dt) => dt * 1000), 'live render reads pinned engine dt');
  assert.deepEqual(stepGame.renderDeltaTimeMs, liveGame.renderDeltaTimeMs, 'step render dt matches live render dt');
  assert.throws(
    () => pinEngineDeltaTimeForFrame({ _deltaTime: 0 }, -0.001),
    /finite non-negative dt/,
    'engine dt pinning rejects negative dt',
  );
}

function assertDerivedRandomStreams(createDeterminismContext) {
  const cleanContext = createDeterminismContext(123);
  const cleanB = cleanContext.deriveRandom('SystemB');
  const expectedB = [cleanB(), cleanB(), cleanB()];

  const interleavedContext = createDeterminismContext(123);
  const systemA = interleavedContext.deriveRandom('SystemA');
  const systemB = interleavedContext.deriveRandom('SystemB');
  systemA();
  systemA();
  const actualB = [systemB()];
  systemA();
  actualB.push(systemB(), systemB());
  assert.deepEqual(actualB, expectedB, 'derived RNG streams are isolated by name');

  const stats = interleavedContext.getRandomStats();
  assert.equal(stats.total, 6, 'random stats count total consumption');
  assert.deepEqual(stats.byCaller, { SystemA: 3, SystemB: 3 }, 'random stats bucket by stream name');

  const context = createDeterminismContext(123);
  context.advance(0.1);
  context.advance(-1);
  assert.equal(context.elapsedTimeSec, 0.1, 'deterministic elapsed time advances only by valid positive dt');
}

function assertProviderBackedStateHash({
  clearRecordReplayProviders,
  registerRecordReplayProviders,
  stateHash,
  diffSnapshots,
  normalizeSnapshotForComparison,
  stableStringify,
  RECORD_REPLAY_HASH_VERSION_V2,
  RECORD_REPLAY_HASH_VERSION_V3,
  RECORD_REPLAY_HASH_VERSION_V4,
  LATEST_RECORD_REPLAY_HASH_VERSION,
}) {
  clearRecordReplayProviders();
  const model = createProviderHashModel();
  const unregister = registerRecordReplayProviders({
    snapshotProviders: [
      {
        name: 'mock.numeric',
        getSnapshot: () => ({
          negZero: -0,
          nan: NaN,
          posInf: Infinity,
          negInf: -Infinity,
          noisy: 1.1234567894,
        }),
      },
    ],
    playerPosition: () => model.player.position,
  });
  try {
    const game = createHashMockGame(model);
    const legacyHash = stateHash(game, 1);
    const v2Hash = stateHash(game, RECORD_REPLAY_HASH_VERSION_V2);
    const v3Hash = stateHash(game, RECORD_REPLAY_HASH_VERSION_V3);
    const v4Hash = stateHash(game, RECORD_REPLAY_HASH_VERSION_V4);
    assert.notEqual(legacyHash.hash, v2Hash.hash, 'v2 hash includes registered providers/frame/time');
    assert.notEqual(v2Hash.hash, v4Hash.hash, 'v4 hash has its own hash surface');
    assert.equal(LATEST_RECORD_REPLAY_HASH_VERSION, RECORD_REPLAY_HASH_VERSION_V4, 'latest hash is v4');
    assert.equal(v2Hash.snapshot.providers[0].snapshot.nan, 0, 'v2 preserves legacy NaN-to-zero behavior');
    assert.equal(v3Hash.snapshot.player.position.y, 0, 'v3 normalizes player signed zero');
    assert.equal(v3Hash.snapshot.providers[0].snapshot.nan, '[NaN]', 'v3 tags NaN');
    assert.equal(v4Hash.snapshot.providers[0].snapshot.noisy, 1.123457, 'v4 rounds finite numbers to 1e-6');
    assert.deepEqual(diffSnapshots({ y: 0 }, { y: -0 }), [], 'snapshot diff treats +0 and -0 as equal');
    assert.equal(
      stableStringify(normalizeSnapshotForComparison({ y: -0, nan: NaN, posInf: Infinity }, RECORD_REPLAY_HASH_VERSION_V3)),
      '{"nan":"[NaN]","posInf":"[Infinity]","y":0}',
      'stable stringify receives normalized signed-zero and non-finite values',
    );
  } finally {
    unregister();
    clearRecordReplayProviders();
  }
}

async function assertAutostartRoundTrip({
  clearRecordReplayProviders,
  registerRecordReplayProviders,
  RecorderSource,
  installPostUpdateStateCapture,
  replayRecordingFrameStates,
  stateHash,
  assertDemoRecording,
  RECORD_REPLAY_SCHEMA_VERSION,
  RECORD_REPLAY_SETTLED_MARKER,
  LATEST_RECORD_REPLAY_HASH_VERSION,
}) {
  clearRecordReplayProviders();
  const recordGame = createDeterministicMockGame();
  const unregister = registerMockGameProviders(registerRecordReplayProviders, recordGame.model);
  try {
    const dts = [0.0042, 0.016, 0.017, 0.015, 0.018, 0.0165, 0.014, 0.02, 0.016, 0.0175, 0.0155, 0.016];
    const recorder = new RecorderSource(createFrameInputSource(recordGame.getFrameCount), recordGame, { maxFrames: dts.length });
    const inputService = recordGame.getInputService();
    const start = stateHash(recordGame, LATEST_RECORD_REPLAY_HASH_VERSION);
    const stateHashes = [];
    const stateSamples = [];
    const restoreCapture = installPostUpdateStateCapture(recordGame, LATEST_RECORD_REPLAY_HASH_VERSION, (result, update) => {
      recorder.recordUpdate(update.frame, update.dt);
      const index = stateHashes.length;
      stateHashes.push(result.hash);
      if (index % 6 === 0 || index === dts.length - 1) {
        stateSamples.push({
          frame: index,
          gameFrame: update.frame,
          hashVersion: LATEST_RECORD_REPLAY_HASH_VERSION,
          hash: result.hash,
          snapshot: result.snapshot,
        });
      }
    });

    inputService.setMovementSource(recorder);
    try {
      for (const dt of dts) recordGame.stepFrame(dt);
    } finally {
      inputService.setMovementSource(null);
      recordGame.setDtOverride(null);
      restoreCapture();
    }

    const frames = recorder.getFrames();
    assert.equal(frames[0].frame, 0, 'frame-0 recording starts at game frame 0');
    assert.equal(frames[0].dt, dts[0], 'frame-0 stores consumed dt');
    assert.equal(stateHashes.length, frames.length, 'post-update hash captured once per frame');

    const recording = {
      envelope: {
        schemaVersion: RECORD_REPLAY_SCHEMA_VERSION,
        hashVersion: LATEST_RECORD_REPLAY_HASH_VERSION,
        templateVersion: '0.1.0',
        projectId: 'pa_template',
        createdAt: new Date(0).toISOString(),
        seed: recordGame.getDeterminismContext().seed,
        settledMarker: RECORD_REPLAY_SETTLED_MARKER,
        anchorFrame: 0,
        startFrame: 0,
        startStateHash: start.hash,
        frames: frames.length,
        label: 'autostart mock roundtrip',
      },
      frames,
      stateHashes,
      events: [],
      stateSamples,
    };
    assertDemoRecording(recording);

    unregister();
    const replayGame = createDeterministicMockGame();
    const unregisterReplay = registerMockGameProviders(registerRecordReplayProviders, replayGame.model);
    try {
      assert.equal(
        stateHash(replayGame, LATEST_RECORD_REPLAY_HASH_VERSION).hash,
        recording.envelope.startStateHash,
        'replay begins from recorded startStateHash',
      );
      const replayRun = await replayRecordingFrameStates({
        game: replayGame,
        inputService: replayGame.getInputService(),
        recording,
        hashVersion: LATEST_RECORD_REPLAY_HASH_VERSION,
      });
      assert.equal(replayRun.aborted, false, 'frame-state replay completes');
      assert.deepEqual(replayRun.stateHashes, stateHashes, 'replay compares at post-update/pre-finalizer point');
      assert.equal(replayGame.suppressPausedRenderCalls.at(-1), false, 'replay restores suppressPausedRender');
      assert.equal(replayGame.suppressPausedRenderCalls[0], true, 'replay suppresses paused RAF render');
    } finally {
      unregisterReplay();
    }
  } finally {
    unregister();
    clearRecordReplayProviders();
  }
}

async function assertInputDisabledWindowRecordsDense({
  clearRecordReplayProviders,
  registerRecordReplayProviders,
  RecorderSource,
  installPostUpdateStateCapture,
  replayRecordingFrameStates,
  assertDenseRecordingFrames,
  assertDemoRecording,
  stateHash,
  RECORD_REPLAY_SCHEMA_VERSION,
  LATEST_RECORD_REPLAY_HASH_VERSION,
}) {
  clearRecordReplayProviders();
  const disabledStart = 3;
  const disabledEnd = 7;
  const recordGame = createDeterministicMockGame({ disabledStart, disabledEnd });
  const unregister = registerMockGameProviders(registerRecordReplayProviders, recordGame.model);
  try {
    const dts = [0.016, 0.017, 0.015, 0.018, 0.0165, 0.014, 0.02, 0.016, 0.0175, 0.0155];
    const polledFrames = [];
    const source = {
      getInput() {
        const frame = recordGame.getFrameCount();
        polledFrames.push(frame);
        return { x: 1, y: frame % 2 === 0 ? 0.2 : -0.2, magnitude: 1, isActive: true };
      },
    };
    const recorder = new RecorderSource(source, recordGame, { maxFrames: dts.length });
    const start = stateHash(recordGame, LATEST_RECORD_REPLAY_HASH_VERSION);
    const stateHashes = [];
    const restoreCapture = installPostUpdateStateCapture(recordGame, LATEST_RECORD_REPLAY_HASH_VERSION, (result, update) => {
      recorder.recordUpdate(update.frame, update.dt);
      stateHashes.push(result.hash);
    });

    recordGame.getInputService().setMovementSource(recorder);
    try {
      for (const dt of dts) recordGame.stepFrame(dt);
    } finally {
      recordGame.getInputService().setMovementSource(null);
      restoreCapture();
    }

    const frames = recorder.getFrames();
    assert.equal(frames.length, dts.length, 'records every update even without source polling');
    assertDenseRecordingFrames(frames, 'disabled-input frames');
    assert.deepEqual(polledFrames, [0, 1, 2, 7, 8, 9], 'disabled-input window does not poll source');
    for (let index = disabledStart; index < disabledEnd; index += 1) {
      assert.deepEqual(frames[index].input, { x: 0, y: 0, magnitude: 0, isActive: false }, `disabled frame ${index} records idle`);
    }

    const recording = {
      envelope: {
        schemaVersion: RECORD_REPLAY_SCHEMA_VERSION,
        hashVersion: LATEST_RECORD_REPLAY_HASH_VERSION,
        templateVersion: '0.1.0',
        projectId: 'pa_template',
        createdAt: new Date(0).toISOString(),
        seed: recordGame.getDeterminismContext().seed,
        anchorFrame: 0,
        startFrame: 0,
        startStateHash: start.hash,
        frames: frames.length,
        label: 'disabled input dense mock',
      },
      frames,
      stateHashes,
      events: [],
    };
    assertDemoRecording(recording);

    unregister();
    const replayGame = createDeterministicMockGame({ disabledStart, disabledEnd });
    const unregisterReplay = registerMockGameProviders(registerRecordReplayProviders, replayGame.model);
    try {
      const replayRun = await replayRecordingFrameStates({
        game: replayGame,
        inputService: replayGame.getInputService(),
        recording,
        hashVersion: LATEST_RECORD_REPLAY_HASH_VERSION,
      });
      assert.deepEqual(replayRun.stateHashes, stateHashes, 'dense idle-window tape replays without drift');
    } finally {
      unregisterReplay();
    }
  } finally {
    unregister();
    clearRecordReplayProviders();
  }
}

function assertSemanticExtractionRdp({ simplifyInputKeypoints }) {
  const straight = simplifyInputKeypoints([
    { t: 0, x: 0, y: 0, magnitude: 1 },
    { t: 1, x: 0.5, y: 0.5, magnitude: 1 },
    { t: 2, x: 1, y: 1, magnitude: 1 },
  ], 0.001);
  assert.equal(straight.length, 2, 'semantic RDP collapses straight drag signal');

  const bent = simplifyInputKeypoints([
    { t: 0, x: 0, y: 0, magnitude: 1 },
    { t: 1, x: 0.5, y: 0.9, magnitude: 1 },
    { t: 2, x: 1, y: 1, magnitude: 1 },
  ], 0.001);
  assert.equal(bent.length, 3, 'semantic RDP preserves a bend');
}

function assertSemanticProviderDetectorExtraction({
  clearRecordReplayProviders,
  registerRecordReplayProviders,
  diffSemanticObservations,
  extractSemanticScript,
  RECORD_REPLAY_SCHEMA_VERSION,
}) {
  clearRecordReplayProviders();
  const unregister = registerRecordReplayProviders({
    milestoneDetectors: [createFactMilestoneDetector()],
  });
  try {
    const previous = createObservation(0, { cash: 0, totalEarned: 0, totalSpent: 0 }, { 'progress.ready': false }, { x: 0, z: 0 });
    const next = createObservation(2, { cash: 5, totalEarned: 10, totalSpent: 5 }, { 'progress.ready': true }, { x: 1, z: 1 });
    const diffs = diffSemanticObservations(previous, next);
    assert.equal(diffs.some((event) => event.kind === 'custom' && event.detail.id === 'progress.ready'), true, 'detector emits fact milestone');

    const recording = createSemanticMockRecording(RECORD_REPLAY_SCHEMA_VERSION);
    const { script, summary } = extractSemanticScript(recording, {
      sourceTape: 'semantic-mock.json',
      extractedAt: new Date(0).toISOString(),
    });
    assert.equal(script.meta.seed, 42, 'semantic script preserves source seed');
    assert.equal(summary.sourceFrames, recording.frames.length, 'semantic summary reports source frames');
    assert.equal(script.inputSegments.length >= 3, true, 'semantic extractor segments input');
    assert.equal(script.milestones.length, 2, 'semantic extractor emits detector milestones only');
    assert.deepEqual(
      script.milestones.find((event) => event.detail.id === 'mock.state.progress.ready')?.economyAtGate,
      { totalEarned: 10, totalSpent: 5 },
      'semantic extractor attaches cumulative economy to detector gate',
    );
    assert.equal(script.waypoints.length >= 2, true, 'semantic extractor emits simplified waypoints');
    assert.deepEqual(script.economyFinal, { cash: 8, totalEarned: 12, totalSpent: 5 }, 'semantic extractor records final economy');
  } finally {
    unregister();
    clearRecordReplayProviders();
  }
}

function assertSemanticLegacyEconomyMilestoneNormalization({ normalizeSemanticReplayScript }) {
  const legacy = createSemanticControllerScript({
    durationSec: 4,
    milestones: [
      { t: 0.5, kind: 'sale', detail: { totalEarned: 1 } },
      { t: 0.7, kind: 'sale', detail: { totalEarned: 2 } },
      { t: 1, kind: 'spend', detail: { totalSpent: 1 } },
      { t: 2, kind: 'custom', detail: { id: 'mock.state.progress.ready', to: 'true' } },
    ],
    waypoints: [],
    economyFinal: { cash: 2, totalEarned: 2, totalSpent: 1 },
  });
  const normalized = normalizeSemanticReplayScript(legacy);
  assert.equal(normalized.milestones.length, 1, 'micro economy milestones fold into one detector gate');
  assert.equal(normalized.milestones[0].kind, 'custom', 'normalization keeps the discrete detector gate');
  assert.deepEqual(normalized.milestones[0].economyAtGate, { totalEarned: 2, totalSpent: 1 }, 'cumulative economy carries to gate');
}

function assertSemanticStuckWatchdog({ SemanticStuckWatchdog }) {
  const watchdog = new SemanticStuckWatchdog({ windowSec: 2, distanceEpsilon: 0.05 });
  assert.equal(watchdog.observe({ t: 0, active: true, position: { x: 0, z: 0 } }), false, 'watchdog arms');
  assert.equal(watchdog.observe({ t: 1.9, active: true, position: { x: 0.01, z: 0 } }), false, 'watchdog waits');
  assert.equal(watchdog.observe({ t: 2.1, active: true, position: { x: 0.01, z: 0 } }), true, 'watchdog fires');
  watchdog.reset();
  assert.equal(watchdog.observe({ t: 3, active: true, position: { x: 0, z: 0 } }), false, 'reset clears window');
}

function assertSemanticCalibrationZReverse({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController }) {
  withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders, inputToWorld: (input) => ({ x: input.x, z: -input.y }) }, (game) => {
    const script = createSemanticControllerScript({
      durationSec: 8,
      waypoints: [
        { t: 0, x: 0, z: 0 },
        { t: 1, x: 0, z: -2 },
      ],
      economyFinal: { cash: 0, totalEarned: 0, totalSpent: 0 },
    });
    const controller = new SemanticReplayController(game, script, { waypointToleranceBand: 0.12, maxDurationSec: 8 });
    stepSemanticController(controller, game, { steps: 120, dt: 0.1, speed: 2 });
    const verdict = controller.getVerdict();
    assert.equal(verdict.calibration.status, 'ok', 'replay calibrates input axes');
    assert.equal(verdict.calibration.matrix.inputY.z < -0.9, true, 'calibration detects z-reversed input');
    assert.equal(game.getPosition().z < -1.8, true, 'inverse calibration moves toward negative z');
    assert.equal(verdict.waypoints.reached >= 2, true, 'calibrated replay reaches waypoints');
  });
}

function assertSemanticProgressDrivenGate({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController }) {
  withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders }, (game) => {
    game.addFactRule('progress.ready', ({ position }) => position.x >= 1.8);
    const script = createSemanticControllerScript({
      durationSec: 1,
      waypoints: [
        { t: 0, x: 0, z: 0 },
        { t: 0.4, x: 2, z: 0 },
      ],
      milestones: [
        { t: 0.5, kind: 'custom', detail: { id: 'mock.state.progress.ready', to: 'true' } },
      ],
      economyFinal: { cash: 0, totalEarned: 0, totalSpent: 0 },
    });
    const controller = new SemanticReplayController(game, script, {
      waypointToleranceBand: 0.18,
      maxDurationSec: 8,
      stageTimeoutSlackSec: 4,
    });
    stepSemanticController(controller, game, { steps: 120, dt: 0.1, speed: 0.5 });
    const verdict = controller.getVerdict();
    assert.equal(verdict.ok, true, 'progress-driven replay reaches gate even slower than source timeline');
    assert.equal(verdict.milestones.matched, 1, 'detector gate matched');
  });
}

function assertSemanticEconomyGateAndStageLoop({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController }) {
  withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders }, (game) => {
    game.addFactRule('progress.ready', ({ position }) => position.x >= 0.75);
    game.addEconomyRule(({ position, economy }) => {
      if (position.x >= 0.75) economy.totalEarned = Math.min(10, economy.totalEarned + 1);
    });
    const script = createSemanticControllerScript({
      durationSec: 4,
      waypoints: [
        { t: 0, x: 0, z: 0 },
        { t: 1, x: 1, z: 0 },
      ],
      milestones: [
        { t: 1, kind: 'custom', detail: { id: 'mock.state.progress.ready', to: 'true' }, economyAtGate: { totalEarned: 5, totalSpent: 0 } },
      ],
      economyFinal: { cash: 0, totalEarned: 5, totalSpent: 0 },
    });
    const controller = new SemanticReplayController(game, script, {
      waypointToleranceBand: 0.12,
      maxDurationSec: 12,
      maxLoopsPerStage: 8,
    });
    stepSemanticController(controller, game, { steps: 160, dt: 0.1, speed: 1 });
    const verdict = controller.getVerdict();
    assert.equal(verdict.ok, true, 'economy gate can pass after the discrete event fired');
    assert.equal(verdict.economyGates[0].pass, true, 'economy gate passes with tolerance');
    assert.equal(verdict.stages[0].loops > 1, true, 'stage loops while waiting for economy threshold');
    assert.equal(verdict.quality, 'recovered', 'stage loop marks successful verdict recovered');
  });
}

function assertSemanticStageLoopLimit({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController }) {
  withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders }, (game) => {
    game.addFactRule('progress.ready', () => false);
    const script = createSemanticControllerScript({
      durationSec: 4,
      waypoints: [
        { t: 0, x: 0, z: 0 },
        { t: 1, x: 1, z: 0 },
      ],
      milestones: [
        { t: 1, kind: 'custom', detail: { id: 'mock.state.progress.ready', to: 'true' } },
      ],
      economyFinal: { cash: 0, totalEarned: 0, totalSpent: 0 },
    });
    const controller = new SemanticReplayController(game, {
      ...script,
      meta: { ...script.meta, durationSec: 20 },
    }, {
      waypointToleranceBand: 0.12,
      maxDurationSec: 12,
      maxLoopsPerStage: 2,
      stageTimeoutSlackSec: 100,
    });
    stepSemanticController(controller, game, { steps: 180, dt: 0.1, speed: 1 });
    const verdict = controller.getVerdict();
    assert.equal(verdict.ok, false, 'loop limit fails missing gate');
    assert.equal(verdict.milestones.missing.some((item) => /loop limit/.test(item.reason)), true, 'missing reason records loop limit');
  });
}

function assertSemanticDwellReplay({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController }) {
  withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders }, (game) => {
    const script = createSemanticControllerScript({
      durationSec: 5,
      waypoints: [
        { t: 0, x: 0, z: 0 },
        { t: 1, x: 1, z: 0, dwellSec: 1.2 },
        { t: 3, x: 2, z: 0 },
      ],
      economyFinal: { cash: 0, totalEarned: 0, totalSpent: 0 },
    });
    const controller = new SemanticReplayController(game, script, { waypointToleranceBand: 0.12, maxDurationSec: 10 });
    stepSemanticController(controller, game, { steps: 130, dt: 0.1, speed: 1.5 });
    const verdict = controller.getVerdict();
    assert.equal(verdict.ok, true, 'dwell waypoint replay completes');
    assert.equal(verdict.durationSec >= 1.2, true, 'dwell contributes to replay duration');
  });
}

function assertSemanticCascadeAndOrder({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController }) {
  withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders }, (game) => {
    game.addFactRule('gate.second', ({ position }) => position.x >= 0.8);
    game.addFactRule('gate.first', ({ position }) => position.x >= 1.2);
    const cascadeScript = createSemanticControllerScript({
      durationSec: 4,
      waypoints: [
        { t: 0, x: 0, z: 0 },
        { t: 1, x: 1.3, z: 0 },
      ],
      milestones: [
        { t: 1, kind: 'custom', detail: { id: 'mock.state.gate.first', to: 'true' } },
        { t: 2.5, kind: 'custom', detail: { id: 'mock.state.gate.second', to: 'true' } },
      ],
      economyFinal: { cash: 0, totalEarned: 0, totalSpent: 0 },
    });
    const cascade = new SemanticReplayController(game, cascadeScript, {
      waypointToleranceBand: 0.12,
      maxDurationSec: 8,
      stageTimeoutSlackSec: 4,
    });
    stepSemanticController(cascade, game, { steps: 100, dt: 0.1, speed: 1.5 });
    const cascadeVerdict = cascade.getVerdict();
    assert.equal(cascadeVerdict.orderViolations ?? cascadeVerdict.milestones.orderViolations, 0, 'nearby cascade event is tolerated');

    game.reset();
    game.addFactRule('gate.second', ({ position }) => position.x >= 0.8);
    game.addFactRule('gate.first', ({ position }) => position.x >= 1.2);
    const orderScript = createSemanticControllerScript({
      durationSec: 8,
      waypoints: [
        { t: 0, x: 0, z: 0 },
        { t: 1, x: 1.3, z: 0 },
      ],
      milestones: [
        { t: 1, kind: 'custom', detail: { id: 'mock.state.gate.first', to: 'true' } },
        { t: 8, kind: 'custom', detail: { id: 'mock.state.gate.second', to: 'true' } },
      ],
      economyFinal: { cash: 0, totalEarned: 0, totalSpent: 0 },
    });
    const ordered = new SemanticReplayController(game, orderScript, {
      waypointToleranceBand: 0.12,
      maxDurationSec: 8,
      stageTimeoutSlackSec: 4,
    });
    stepSemanticController(ordered, game, { steps: 100, dt: 0.1, speed: 1.5 });
    const orderVerdict = ordered.getVerdict();
    assert.equal(orderVerdict.ok, false, 'far order violation fails verdict');
    assert.equal(orderVerdict.milestones.orderViolations > 0, true, 'far future event before current gate records order violation');
  });
}

function assertSemanticStuckRecovery({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController }) {
  withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders }, (game) => {
    game.setMovementBlockedRange(1.1, 2.0);
    const script = createSemanticControllerScript({
      durationSec: 6,
      waypoints: [
        { t: 0, x: 0, z: 0 },
        { t: 1, x: 2, z: 0 },
      ],
      economyFinal: { cash: 0, totalEarned: 0, totalSpent: 0 },
    });
    const controller = new SemanticReplayController(game, script, {
      waypointToleranceBand: 0.15,
      maxDurationSec: 12,
      stuckWindowSec: 0.2,
      stuckDistanceEpsilon: 0.02,
    });
    stepSemanticController(controller, game, { steps: 160, dt: 0.1, speed: 1.4 });
    const verdict = controller.getVerdict();
    assert.equal(verdict.ok, true, 'stuck recovery can still complete semantic replay');
    assert.equal(verdict.stuckEvents.length > 0, true, 'stuck event recorded');
    assert.equal(verdict.quality, 'recovered', 'stuck recovery marks verdict recovered');
  });
}

function assertBenchmarkAggregation({
  createRecordReplayBenchmarkResult,
  formatBenchmarkConclusion,
  summarizeBenchmarkPerf,
}) {
  const perf = summarizeBenchmarkPerf([
    { fps: 60, frameMs: 16, drawCalls: 100 },
    { fps: 30, frameMs: 33, drawCalls: 140 },
    { fps: null, frameMs: 20, drawCalls: 120 },
  ]);
  assert.deepEqual(perf, { avgFps: 45, p95FrameMs: 33, avgDrawCalls: 120, samples: 3 }, 'benchmark perf aggregates values');
  const verdict = {
    ok: true,
    quality: 'clean',
    milestones: { matched: 2, missing: [], extra: [], orderViolations: 0 },
    economyFinal: { pass: true, diffs: {} },
    economyGates: [],
    waypoints: { reached: 3, skipped: 0, maxDeviation: 0.1, toleranceBand: 0.8 },
    calibration: {
      status: 'ok',
      attempts: 1,
      pulseSec: 0.25,
      settleSec: 0.2,
      minDisplacement: 0.02,
      displacement: { inputX: 1, inputY: 1 },
      matrix: { inputX: { x: 1, z: 0 }, inputY: { x: 0, z: 1 } },
      determinant: 1,
    },
    waypointsPerStage: [2, 1],
    stages: [],
    stuckEvents: [],
    durationSec: 3,
  };
  const result = createRecordReplayBenchmarkResult(verdict, [{ fps: 60, frameMs: 16, drawCalls: 100 }]);
  assert.equal(result.pass, true, 'benchmark pass follows semantic verdict');
  assert.match(formatBenchmarkConclusion(result), /BENCHMARK PASS/, 'benchmark formatter includes pass status');
}

function createBaseRecording(schemaVersion, frames, stateHashes) {
  return {
    envelope: {
      schemaVersion,
      templateVersion: '0.1.0',
      projectId: 'pa_template',
      createdAt: new Date(0).toISOString(),
      seed: 1,
      startFrame: 0,
      startStateHash: 'fnv1a32:test',
      frames: frames.length,
      label: 'logic check',
    },
    frames,
    stateHashes,
    events: [],
  };
}

function createEngineClockMockGame(pinEngineDeltaTimeForFrame) {
  const engine = {
    _deltaTime: 999,
    getDeltaTime() {
      return this._deltaTime;
    },
  };
  const updateDts = [];
  const renderDeltaTimeMs = [];
  return {
    updateDts,
    renderDeltaTimeMs,
    gameLoop(deltaTime) {
      this.update(deltaTime);
      this.renderWithPinnedEngineDelta(deltaTime);
    },
    stepFrame(deltaTime) {
      this.update(deltaTime);
      this.renderWithPinnedEngineDelta(deltaTime);
    },
    update(deltaTime) {
      updateDts.push(deltaTime);
    },
    renderWithPinnedEngineDelta(deltaTime) {
      pinEngineDeltaTimeForFrame(engine, deltaTime);
      renderDeltaTimeMs.push(engine.getDeltaTime());
    },
  };
}

function createProviderHashModel() {
  return {
    frame: 12,
    lastDt: -0,
    elapsedTimeSec: -0,
    player: { position: { x: 1, y: -0, z: 3 }, radius: 0.5 },
  };
}

function createHashMockGame(model) {
  return {
    getPlayer: () => model.player,
    getInputService: () => ({ isEnabled: () => true }),
    getCamera: () => ({
      position: { x: -0, y: 6, z: -7 },
      target: { x: 1, y: -0, z: 3 },
      alpha: 1,
      beta: 0.7,
      radius: 9,
    }),
    getFrameCount: () => model.frame,
    getLastFrameDeltaTime: () => model.lastDt,
    getDeterminismContext: () => ({ seed: 42, elapsedTimeSec: model.elapsedTimeSec }),
  };
}

function createMockInputService() {
  let source = null;
  let enabled = true;
  const idle = { x: 0, y: 0, magnitude: 0, isActive: false };
  return {
    getMovementSource: () => source,
    setMovementSource(next) {
      source = next;
    },
    setEnabled(next) {
      enabled = next;
    },
    isEnabled: () => enabled,
    getInput: () => (enabled ? source?.getInput?.() ?? idle : idle),
  };
}

function createDeterministicMockGame(options = {}) {
  let frame = 0;
  let currentDt = null;
  let lastDt = 0;
  let elapsedTimeSec = 0;
  let dtOverride = null;
  const inputService = createMockInputService();
  const model = {
    player: { position: { x: 0, y: 0, z: 0 }, radius: 0.5 },
    economy: { cash: 0, totalEarned: 0, totalSpent: 0 },
    facts: { 'progress.activeFrames': 0, 'progress.inactiveFrames': 0 },
  };
  const suppressPausedRenderCalls = [];
  const game = {
    model,
    suppressPausedRenderCalls,
    update(deltaTime) {
      const enabled = frame < (options.disabledStart ?? Number.POSITIVE_INFINITY)
        || frame >= (options.disabledEnd ?? Number.POSITIVE_INFINITY);
      inputService.setEnabled(enabled);
      const input = inputService.getInput();
      if (input.isActive) {
        model.facts['progress.activeFrames'] += 1;
        model.player.position.x += input.x * deltaTime;
        model.player.position.z += input.y * deltaTime;
        model.economy.totalEarned += 1;
      } else {
        model.facts['progress.inactiveFrames'] += 1;
      }
    },
    stepFrame(deltaTime) {
      const effectiveDt = dtOverride?.() ?? deltaTime;
      currentDt = effectiveDt;
      try {
        elapsedTimeSec += effectiveDt;
        game.update(effectiveDt);
      } finally {
        lastDt = effectiveDt;
        currentDt = null;
        frame += 1;
      }
    },
    setDtOverride(override) {
      dtOverride = override;
    },
    setSuppressPausedRender(flag) {
      suppressPausedRenderCalls.push(flag);
    },
    getFrameCount: () => frame,
    getCurrentFrameDeltaTime: () => currentDt,
    getLastFrameDeltaTime: () => lastDt,
    getDeterminismContext: () => ({ seed: 42, elapsedTimeSec }),
    getInputService: () => inputService,
    getPlayer: () => model.player,
    getCamera: () => ({
      position: { x: model.player.position.x, y: 6, z: model.player.position.z - 8 },
      target: { x: model.player.position.x, y: 0, z: model.player.position.z },
      alpha: 1,
      beta: 0.75,
      radius: 9,
    }),
  };
  return game;
}

function registerMockGameProviders(registerRecordReplayProviders, model) {
  return registerRecordReplayProviders({
    snapshotProviders: [
      {
        name: 'mock.state',
        getSnapshot: () => ({
          recordReplay: {
            economy: model.economy,
            facts: model.facts,
          },
        }),
      },
    ],
    milestoneDetectors: [createFactMilestoneDetector()],
    playerPosition: () => model.player.position,
  });
}

function createFrameInputSource(getFrameCount) {
  return {
    getInput() {
      const frame = getFrameCount();
      return {
        x: frame % 3 === 0 ? 1 : frame % 3 === 1 ? -0.35 : 0.5,
        y: frame % 4 < 2 ? 0.2 : -0.7,
        magnitude: 1,
        isActive: true,
      };
    },
  };
}

function createFactMilestoneDetector() {
  return {
    kind: 'custom',
    detect(previous, next) {
      const events = [];
      const keys = new Set([...Object.keys(previous.facts), ...Object.keys(next.facts)]);
      for (const key of [...keys].sort()) {
        const before = previous.facts[key];
        const after = next.facts[key];
        if (before === after || after === undefined) continue;
        events.push({
          kind: 'custom',
          detail: {
            id: key,
            from: before === undefined ? '[missing]' : String(before),
            to: String(after),
          },
        });
      }
      return events;
    },
    isSatisfied(milestone, observation) {
      const id = milestone.detail.id;
      if (typeof id !== 'string') return false;
      return String(observation.facts[id]) === String(milestone.detail.to);
    },
    getIdentity(milestone) {
      return typeof milestone.detail.id === 'string' ? milestone.detail.id : null;
    },
  };
}

function createObservation(t, economy, facts, position) {
  return {
    t,
    economy,
    facts,
    snapshots: {},
    playerPosition: { t, x: position.x, z: position.z },
  };
}

function createSemanticMockRecording(schemaVersion) {
  const frames = Array.from({ length: 12 }, (_, index) => ({
    frame: index,
    dt: 0.1,
    input: index < 4
      ? { x: 1, y: 0, magnitude: 1, isActive: true }
      : index < 8
        ? { x: 0, y: 0, magnitude: 0, isActive: false }
        : { x: 0, y: 1, magnitude: 0.8, isActive: true },
  }));
  return {
    envelope: {
      schemaVersion,
      hashVersion: 4,
      templateVersion: '0.1.0',
      projectId: 'pa_template',
      createdAt: new Date(0).toISOString(),
      seed: 42,
      startFrame: 0,
      startStateHash: 'fnv1a32:test',
      frames: frames.length,
      label: 'semantic mock',
    },
    frames,
    stateHashes: frames.map((item) => `hash:${item.frame}`),
    stateSamples: [
      createSemanticStateSample(0, 0, { x: 0, z: 0 }, { cash: 0, totalEarned: 0, totalSpent: 0 }, { 'progress.ready': false, 'progress.done': false }),
      createSemanticStateSample(4, 0.4, { x: 1, z: 0 }, { cash: 5, totalEarned: 10, totalSpent: 5 }, { 'progress.ready': true, 'progress.done': false }),
      createSemanticStateSample(11, 1.1, { x: 1, z: 1 }, { cash: 8, totalEarned: 12, totalSpent: 5 }, { 'progress.ready': true, 'progress.done': true }),
    ],
    trail: frames.map((_, index) => [Math.min(index * 0.1, 1), Math.max(0, index - 7) * 0.1]),
    events: [],
  };
}

function createSemanticStateSample(frame, time, position, economy, facts) {
  return {
    frame,
    gameFrame: frame,
    hashVersion: 4,
    hash: `hash:${frame}`,
    snapshot: {
      time,
      playerPosition: { x: position.x, y: 0, z: position.z },
      providers: [
        {
          name: 'mock.state',
          snapshot: {
            recordReplay: {
              economy,
              facts,
            },
          },
        },
      ],
    },
  };
}

function createSemanticControllerScript({
  durationSec,
  inputSegments = [{ tStart: 0, tEnd: durationSec, kind: 'drag', keypoints: [{ t: 0, x: 1, y: 0, magnitude: 1 }] }],
  milestones = [],
  waypoints = [],
  economyFinal = { cash: 0, totalEarned: 0, totalSpent: 0 },
}) {
  return {
    meta: {
      schemaVersion: 1,
      sourceTape: 'controller mock',
      seed: 42,
      durationSec,
      extractedAt: new Date(0).toISOString(),
    },
    inputSegments,
    milestones,
    waypoints,
    economyFinal,
  };
}

function withSemanticMockGame(options, callback) {
  options.clearRecordReplayProviders();
  const game = createSemanticControllerMockGame(options);
  const unregister = options.registerRecordReplayProviders({
    snapshotProviders: [
      {
        name: 'mock.state',
        getSnapshot: () => ({
          recordReplay: {
            economy: game.economy,
            facts: game.facts,
          },
        }),
      },
    ],
    milestoneDetectors: [createFactMilestoneDetector()],
    playerPosition: () => ({ x: game.position.x, y: 0, z: game.position.z }),
  });
  try {
    callback(game);
  } finally {
    unregister();
    options.clearRecordReplayProviders();
  }
}

function createSemanticControllerMockGame(options = {}) {
  let elapsedTimeSec = 0;
  let movementBlockedFrom = Number.POSITIVE_INFINITY;
  let movementBlockedUntil = 0;
  const initial = () => ({
    position: { x: 0, z: 0 },
    economy: { cash: 0, totalEarned: 0, totalSpent: 0 },
    facts: {},
    factRules: [],
    economyRules: [],
  });
  let state = initial();
  const inputToWorld = options.inputToWorld ?? ((input) => ({ x: input.x, z: input.y }));
  return {
    get position() { return state.position; },
    get economy() { return state.economy; },
    get facts() { return state.facts; },
    getPosition: () => ({ ...state.position }),
    reset() {
      elapsedTimeSec = 0;
      movementBlockedFrom = Number.POSITIVE_INFINITY;
      movementBlockedUntil = 0;
      state = initial();
    },
    addFactRule(id, rule) {
      state.facts[id] = false;
      state.factRules.push({ id, rule });
    },
    addEconomyRule(rule) {
      state.economyRules.push(rule);
    },
    setMovementBlockedUntil(value) {
      movementBlockedFrom = 0;
      movementBlockedUntil = value;
    },
    setMovementBlockedRange(from, until) {
      movementBlockedFrom = from;
      movementBlockedUntil = until;
    },
    getFrameCount: () => Math.floor(elapsedTimeSec * 10),
    getLastFrameDeltaTime: () => 0.1,
    getDeterminismContext: () => ({ seed: 42, elapsedTimeSec }),
    getPlayer: () => ({ position: { x: state.position.x, y: 0, z: state.position.z } }),
    getCamera: () => ({
      position: { x: 0, y: 6, z: -8 },
      target: { x: state.position.x, y: 0, z: state.position.z },
    }),
    getInputService: () => null,
    applyInput(input, deltaTime, speed) {
      elapsedTimeSec += deltaTime;
      const blocked = elapsedTimeSec >= movementBlockedFrom && elapsedTimeSec < movementBlockedUntil;
      if (input.isActive && !blocked) {
        const world = inputToWorld(input);
        state.position.x += world.x * input.magnitude * speed * deltaTime;
        state.position.z += world.z * input.magnitude * speed * deltaTime;
      }
      for (const rule of state.factRules) {
        state.facts[rule.id] = !!rule.rule({ position: state.position, economy: state.economy, elapsedTimeSec });
      }
      for (const rule of state.economyRules) {
        rule({ position: state.position, economy: state.economy, elapsedTimeSec });
      }
    },
  };
}

function stepSemanticController(controller, game, { steps, dt, speed }) {
  for (let index = 0; index < steps; index += 1) {
    if (controller.isDone()) break;
    const input = controller.getInput();
    game.applyInput(input, dt, speed);
    controller.afterUpdate(dt);
  }
}
