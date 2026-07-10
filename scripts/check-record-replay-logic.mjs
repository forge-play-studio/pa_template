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
    'src/debug/record-replay/semantic/grade.ts',
    'src/debug/record-replay/fact-contract.ts',
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
  const pathTracker = require(join(outDir, 'debug/record-replay/semantic/path-tracker.js'));
  const semanticGrade = require(join(outDir, 'debug/record-replay/semantic/grade.js'));
  const factContract = require(join(outDir, 'debug/record-replay/fact-contract.js'));
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
  assertSemanticPathTracker(pathTracker);
  assertSemanticTrailDecimation(semanticExtract);
  assertSemanticEmptyScriptRefusal({ ...semanticExtract, ...semanticReplay });
  assertRecordReplayInputAuthority(providers);
  assertSemanticCalibrationUnderScriptedMovement({ ...providers, ...semanticReplay });
  assertSemanticPathTrackerScriptedSegment(pathTracker);
  assertSemanticGradeLadder(semanticGrade);
  assertLayeredMilestoneCounts(semanticGrade);
  await assertSemanticGradeMajority(semanticGrade);
  assertMilestoneCriticality(providers);
  assertSemanticGradeFromController({ ...providers, ...semanticReplay });
  assertFactContractChecker(factContract);
  assertObservationOnlyFactRegistry(providers);
  assertShortLivedEventExtraction({ ...semanticExtract, ...providers });
  assertEconomyFinalCashTolerance({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController });
  assertTruncatedTapeRefusal(semanticExtract);
  assertScriptedGateRelease({ ...providers, ...semanticReplay });

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

/**
 * `kind` 决定该检测器发出的里程碑类型(进而决定 critical/optional 默认分层);
 * `accept` 过滤它负责哪些 fact —— 多个检测器共存时靠它避免同一 fact 被重复发两次。
 */
function createFactMilestoneDetector(kind = 'custom', accept = () => true, critical = undefined) {
  return {
    kind,
    ...(typeof critical === 'boolean' ? { critical } : {}),
    detect(previous, next) {
      const events = [];
      const keys = new Set([...Object.keys(previous.facts), ...Object.keys(next.facts)]);
      for (const key of [...keys].sort()) {
        if (!accept(key)) continue;
        const before = previous.facts[key];
        const after = next.facts[key];
        if (before === after || after === undefined) continue;
        events.push({
          kind,
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
  trail = null,
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
    ...(trail ? { trail } : {}),
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
    milestoneDetectors: options.milestoneDetectors ?? [createFactMilestoneDetector()],
    playerPosition: () => ({ x: game.position.x, y: 0, z: game.position.z }),
    ...(options.inputAuthority ? { inputAuthority: options.inputAuthority } : {}),
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
    /** 剧情自动移动:游戏自己把角色搬走,与玩家输入无关。 */
    scriptedMoveTo(x, z) {
      state.position.x = x;
      state.position.z = z;
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

/** providers 契约:布尔必须 latch,数值必须单调。每个 key 只报一次。 */
function assertFactContractChecker({ FactContractChecker, formatFactContractViolation }) {
  const checker = new FactContractChecker();
  assert.deepEqual(checker.observe(0, { 'a.flag': false, 'a.count': 1 }), [], 'first observation establishes a baseline');
  assert.deepEqual(checker.observe(1, { 'a.flag': true, 'a.count': 2 }), [], 'latching true and increasing are fine');

  const unlatched = checker.observe(2, { 'a.flag': false, 'a.count': 2 });
  assert.equal(unlatched.length, 1, 'true → false is a violation');
  assert.equal(unlatched[0].kind, 'boolean-unlatched');
  assert.equal(unlatched[0].key, 'a.flag');
  assert.equal(unlatched[0].frame, 2);
  assert.match(formatFactContractViolation(unlatched[0]), /must latch/, 'message explains the rule');

  // 同一个 key 不再重复报
  assert.deepEqual(checker.observe(3, { 'a.flag': true }), [], 'a latched-again flip is not re-reported');
  assert.deepEqual(checker.observe(4, { 'a.flag': false }), [], 'each key is reported at most once');

  const decreased = checker.observe(5, { 'a.count': 1 });
  assert.equal(decreased.length, 1, 'a decreasing number is a violation');
  assert.equal(decreased[0].kind, 'number-decreased');
  assert.match(formatFactContractViolation(decreased[0]), /monotonic/, 'message explains the rule');

  // 字符串 fact 不受约束
  const strings = new FactContractChecker();
  strings.observe(0, { 'a.label': 'x' });
  assert.deepEqual(strings.observe(1, { 'a.label': 'y' }), [], 'string facts are labels, not progress');

  assert.equal(checker.getViolations().length, 2, 'violations accumulate');
  checker.reset();
  assert.equal(checker.getViolations().length, 0, 'reset clears');

  // 豁免:状态观测型 fact(「此刻在罩内吗」)天生来回翻转,不该一直喊
  const exempted = new FactContractChecker();
  exempted.addExemptions(['qy.oxygen.insideBoundary']);
  exempted.observe(0, { 'qy.oxygen.insideBoundary': true, 'qy.other.flag': true });
  const fresh = exempted.observe(1, { 'qy.oxygen.insideBoundary': false, 'qy.other.flag': false });
  assert.equal(fresh.length, 1, 'only the non-exempt fact is reported');
  assert.equal(fresh[0].key, 'qy.other.flag', 'the exempt observation-only fact stays quiet');
}

/** observationOnlyFacts 声明在**注册面**(不进快照 ⇒ 不进 state hash),读出来带 provider 前缀。 */
function assertObservationOnlyFactRegistry({
  clearRecordReplayProviders,
  registerRecordReplayProviders,
  readRecordReplayObservationOnlyFactKeys,
  collectRecordReplaySnapshotEntries,
}) {
  clearRecordReplayProviders();
  assert.deepEqual(readRecordReplayObservationOnlyFactKeys(), [], 'nothing registered ⇒ nothing exempt');

  const unregister = registerRecordReplayProviders({
    snapshotProviders: [
      {
        name: 'qy.oxygen',
        getSnapshot: () => ({ recordReplay: { facts: { insideBoundary: true } } }),
        observationOnlyFacts: ['insideBoundary', ' edgeWarning ', ''],
      },
      { name: 'qy.mining', getSnapshot: () => ({ recordReplay: { facts: { consumed: 1 } } }) },
    ],
  });
  assert.deepEqual(
    readRecordReplayObservationOnlyFactKeys().sort(),
    ['qy.oxygen.edgeWarning', 'qy.oxygen.insideBoundary'],
    'keys are provider-prefixed and trimmed; empties dropped',
  );

  // 关键:声明**不得**出现在快照里,否则它会进 state hash
  const entries = collectRecordReplaySnapshotEntries();
  const oxygen = entries.find((entry) => entry.name === 'qy.oxygen');
  assert.equal(
    JSON.stringify(oxygen.snapshot).includes('observationOnlyFacts'),
    false,
    'observationOnlyFacts must never leak into the hashed snapshot',
  );
  unregister();
  clearRecordReplayProviders();
}
/**
 * 短命事件:一个完整发生在两次 stateSample 之间的 false→true→false,
 * 基于采样的提取**看不见**;逐帧持久化的 events 能看见。
 */
function assertShortLivedEventExtraction({
  extractSemanticScript,
  clearRecordReplayProviders,
  registerRecordReplayProviders,
}) {
  clearRecordReplayProviders();
  const unregister = registerRecordReplayProviders({
    milestoneDetectors: [createFactMilestoneDetector('custom')],
  });
  try {
    const frames = Array.from({ length: 130 }, (_, index) => ({ frame: index, dt: 0.1, input: { x: 0, y: 0, magnitude: 0, isActive: false } }));
    const base = {
      envelope: {
        schemaVersion: 1, hashVersion: 4, templateVersion: '0.0.0', projectId: 'test',
        createdAt: new Date(0).toISOString(), seed: 1, startFrame: 0, anchorFrame: 0,
        settledMarker: 'gameplay-settled-v1', startStateHash: 'h0', frames: frames.length, label: 'short-lived',
      },
      frames,
      stateHashes: frames.map((_, index) => `h${index}`),
      stateSamples: [0, 60, 120].map((frame) => ({
        frame, gameFrame: frame, hashVersion: 4, hash: `h${frame}`,
        snapshot: { 'mock.state': { recordReplay: { economy: { cash: 0, totalEarned: 0, totalSpent: 0 }, facts: { ready: false } } } },
      })),
      trail: frames.map((_, index) => [index * 0.01, 0]),
    };

    // 没有 events:采样之间的 false→true→false 完全消失
    const withoutEvents = extractSemanticScript(base, {}).script;
    assert.equal(withoutEvents.milestones.length, 0, 'sample-based extraction cannot see a short-lived event');

    // 有 events:逐帧 detector 在 frame 30 抓到了 ready:false→true
    const withEvents = extractSemanticScript({
      ...base,
      events: [
        { frame: 5, kind: 'warning:droppedFrames', payload: { droppedFrames: 3 } },
        { frame: 30, kind: 'custom', payload: { detail: { id: 'mock.state.ready', from: 'false', to: 'true' }, economy: { cash: 0, totalEarned: 0, totalSpent: 0 } } },
      ],
    }, {}).script;
    assert.equal(withEvents.milestones.length, 1, 'per-frame events resurrect the short-lived milestone');
    assert.equal(withEvents.milestones[0].kind, 'custom');
    assert.equal(withEvents.milestones[0].detail.id, 'mock.state.ready');
    assert.equal(Math.abs(withEvents.milestones[0].t - 3.1) < 0.05, true, `milestone t maps through frame times, got ${withEvents.milestones[0].t}`);
  } finally {
    unregister();
    clearRecordReplayProviders();
  }
}

/** economyFinal.cash 必须参与判定;diffs 的 withinTolerance 与 pass 同口径。 */
function assertEconomyFinalCashTolerance({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController }) {
  const run = (endCash) => {
    let verdict = null;
    withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders }, (game) => {
      game.addEconomyRule(({ economy }) => { economy.cash = endCash; });
      const script = createSemanticControllerScript({
        durationSec: 2,
        waypoints: [{ t: 0, x: 0, z: 0 }, { t: 1, x: 1, z: 0 }],
        economyFinal: { cash: 100, totalEarned: 0, totalSpent: 0 },
      });
      const controller = new SemanticReplayController(game, script, { waypointToleranceBand: 0.12, maxDurationSec: 6 });
      stepSemanticController(controller, game, { steps: 90, dt: 0.1, speed: 1 });
      verdict = controller.getVerdict();
    });
    return verdict;
  };

  const poor = run(50);
  assert.equal(poor.economyFinal.pass, false, 'ending poorer than the demo fails — cash used to be ignored entirely');
  assert.equal(poor.economyFinal.diffs.cash.withinTolerance, false, 'the failing key is flagged');
  assert.equal(poor.ok, false, 'ok follows economyFinal');

  const rich = run(140);
  assert.equal(rich.economyFinal.pass, true, 'ending richer than the demo is not a failure');
  assert.equal(rich.economyFinal.diffs.cash.withinTolerance, true, 'diffs report the delta but mark it in-tolerance');

  const nearly = run(86); // 100 * (1 - 0.15) = 85
  assert.equal(nearly.economyFinal.pass, true, 'inside the tolerance band passes');
  assert.equal(run(84).economyFinal.pass, false, 'just outside the band fails');

  // pass ⟺ 每一项 withinTolerance
  for (const verdict of [poor, rich, nearly]) {
    const allWithin = Object.values(verdict.economyFinal.diffs).every((diff) => diff.withinTolerance);
    assert.equal(verdict.economyFinal.pass, allWithin, 'pass and diffs share one 口径');
  }
}

/** 溢出截断的 tape:提取带 warning(Mode A 的拒绝在面板层,这里验 warning 通道)。 */
function assertTruncatedTapeRefusal({ extractSemanticScript }) {
  const frames = Array.from({ length: 10 }, (_, index) => ({ frame: index + 500, dt: 0.1, input: { x: 0, y: 0, magnitude: 0, isActive: false } }));
  const recording = {
    envelope: {
      schemaVersion: 1, hashVersion: 4, templateVersion: '0.0.0', projectId: 'test',
      createdAt: new Date(0).toISOString(), seed: 1, startFrame: 0, anchorFrame: 0,
      settledMarker: 'gameplay-settled-v1', startStateHash: 'h0', frames: frames.length, label: 'truncated',
      truncated: true, droppedFrames: 500,
    },
    frames,
    stateHashes: frames.map((_, index) => `h${index}`),
    trail: frames.map((_, index) => [index * 0.01, 0]),
  };
  const { warnings } = extractSemanticScript(recording, {});
  assert.equal(warnings.some((warning) => /truncated/.test(warning)), true, 'truncated tapes carry a loud warning');
  assert.equal(warnings.some((warning) => /500 leading frames/.test(warning)), true, 'the warning names the dropped count');
}

/**
 * P0:剧情段(输入不算数)里的闸门必须立即放行,否则示教时钟被钉死在闸门时刻,
 * 而剧情把角色带走 —— 解禁后再也追不回来。
 */
function assertScriptedGateRelease({ clearRecordReplayProviders, registerRecordReplayProviders, SemanticReplayController }) {
  let authoritative = true;
  let verdict = null;
  withSemanticMockGame({
    clearRecordReplayProviders,
    registerRecordReplayProviders,
    inputAuthority: () => authoritative,
  }, (game) => {
    // 闸门里程碑永远不会被满足 —— 它是否被「放行」只取决于剧情段的处理。
    game.addFactRule('gate.open', () => false);
    const trail = Array.from({ length: 61 }, (_, index) => ({ t: index * 0.1, x: index * 0.5, z: 0 }));
    const script = createSemanticControllerScript({
      durationSec: 6,
      waypoints: [{ t: 0, x: 0, z: 0 }, { t: 6, x: 30, z: 0 }],
      trail,
      milestones: [{ t: 0.4, kind: 'custom', detail: { id: 'mock.state.gate.open', to: 'true' } }],
    });
    const controller = new SemanticReplayController(game, script, {
      waypointToleranceBand: 0.5,
      maxDurationSec: 20,
      calibrationPulseSec: 0.1,
      calibrationSettleSec: 0.1,
      gateHoldPatienceSec: 100,   // 授权态下绝不会因"耐心耗尽"放行,排除混淆变量
      gateStallTimeoutSec: 100,
    });

    // 1) 有权限:跑完标定,进入 navigating。
    //    ⚠️ 这里**不能**调 getVerdict() —— 它会把 finalVerdict 缓存下来,后面的断言就读到旧快照了。
    stepSemanticController(controller, game, { steps: 20, dt: 0.1, speed: 1 });

    // 2) 剧情段:输入不算数,游戏自己把角色搬走 28 个单位
    authoritative = false;
    for (let index = 0; index < 25; index += 1) {
      if (controller.isDone()) break;
      controller.getInput();
      game.scriptedMoveTo(index * 1.2, 0);
      game.applyInput({ x: 0, y: 0, magnitude: 0, isActive: false }, 0.1, 0);
      controller.afterUpdate(0.1);
    }
    verdict = controller.getVerdict();
  });

  const tracking = verdict.trailTracking;
  assert.equal(tracking.enabled, true, 'trail tracking is on');
  assert.equal(tracking.scriptedGateReleases >= 1, true,
    `a gate inside the cutscene must be released immediately, got ${tracking.scriptedGateReleases}`);
  assert.equal(tracking.scheduleSec > 0.4 + 1e-6, true,
    `the teach clock must move past the pinned gate, got scheduleSec=${tracking.scheduleSec}`);
  assert.equal(tracking.scriptedSec > 1, true, 'the whole cutscene counts as scripted time');
  assert.equal(verdict.milestones.matched, 0, 'releasing a gate does NOT match its milestone');
  assert.equal(verdict.calibration.status, 'ok', 'calibration ran while input was still authoritative');
}

/**
 * 认证分级 v2 —— 四档判据(契约 harness docs/06 §6.2)。
 * 纯函数,逐条走判据优先级;边界值(恰好等于阈值)必须落在**宽松**一侧。
 */
function assertSemanticGradeLadder({
  gradeSemanticVerdict,
  isSemanticGradeAtLeast,
  worstSemanticGrade,
  SEMANTIC_GRADE_ORDER,
}) {
  const base = {
    refused: false,
    calibrationFailed: false,
    terminalDivergence: null,
    criticalMissing: 0,
    optionalMissing: 0,
    optionalTotal: 4,
    criticalTotal: 2,
    economyPass: true,
    stageDisrupted: false,
    detourScore: 0,
    ok: true,
    quality: 'clean',
  };
  const gradeOf = (overrides, thresholds) => gradeSemanticVerdict({ ...base, ...overrides }, thresholds).grade;

  assert.deepEqual([...SEMANTIC_GRADE_ORDER], ['failed', 'degraded', 'good', 'clean'], 'grade order is worst→best');
  assert.equal(gradeOf({}), 'clean', 'all-green run grades clean');

  // ---- failed:四条硬失败,任何一条命中都压过下面所有判据
  assert.equal(gradeOf({ refused: true }), 'failed', 'refused run is failed');
  assert.equal(
    gradeOf({ terminalDivergence: 'outcome:death' }),
    'failed',
    'terminal divergence is failed even with everything else green',
  );
  assert.equal(gradeOf({ criticalMissing: 1, ok: false, quality: 'failed' }), 'failed', 'missing critical is failed');
  assert.equal(
    gradeOf({ calibrationFailed: true }),
    'failed',
    'calibration failure is failed even when ok=true — the replay never drove anything',
  );

  // ---- good:critical 全中,轻微绕路 / 少量 optional 缺失
  assert.equal(gradeOf({ quality: 'recovered', detourScore: 1 }), 'good', 'mild recovery grades good (old recovered)');
  assert.equal(
    gradeOf({ optionalMissing: 1, optionalTotal: 5, ok: false, quality: 'failed' }),
    'good',
    'optional missing exactly at 20% stays good (boundary is inclusive)',
  );
  assert.equal(gradeOf({ quality: 'recovered', detourScore: 2 }), 'good', 'detour below threshold stays good');
  assert.equal(gradeOf({ optionalMissing: 0, optionalTotal: 0, quality: 'recovered', detourScore: 1 }), 'good',
    'zero optional milestones ⇒ ratio 0, not NaN');

  // ---- 空绿护栏:一条 critical 都不断言的剧本(纯导航 tape)拿不到 clean
  assert.equal(
    gradeOf({ criticalTotal: 0 }),
    'good',
    'a script asserting no critical milestone is replayable (good) but never a canonical baseline (clean)',
  );
  assert.match(
    gradeSemanticVerdict({ ...base, criticalTotal: 0 }).reason,
    /no critical milestone/,
    'grading says why clean was withheld',
  );
  assert.equal(gradeOf({ criticalTotal: 1 }), 'clean', 'one critical milestone is enough to earn clean');

  // ---- degraded:critical 全中,但明显不干净
  assert.equal(
    gradeOf({ optionalMissing: 1, optionalTotal: 4, ok: false, quality: 'failed' }),
    'degraded',
    'optional missing 25% > 20% drops to degraded',
  );
  assert.equal(gradeOf({ economyPass: false, ok: false, quality: 'failed' }), 'degraded', 'economy out of tolerance ⇒ degraded');
  assert.equal(gradeOf({ stageDisrupted: true, ok: false, quality: 'failed' }), 'degraded', 'disrupted stage ⇒ degraded');
  assert.equal(gradeOf({ quality: 'recovered', detourScore: 3 }), 'degraded', 'detour at threshold ⇒ degraded');

  // ---- 阈值可覆盖
  assert.equal(
    gradeOf({ optionalMissing: 1, optionalTotal: 4, ok: false, quality: 'failed' }, { optionalMissingRatio: 0.5 }),
    'good',
    'loosened optional threshold promotes degraded→good',
  );
  assert.equal(
    gradeOf({ quality: 'recovered', detourScore: 2 }, { detourScore: 2 }),
    'degraded',
    'tightened detour threshold demotes good→degraded',
  );

  // ---- 定档理由与指标必须落盘(排查时不重跑)
  const detail = gradeSemanticVerdict({ ...base, optionalMissing: 1, optionalTotal: 4, ok: false, quality: 'failed' });
  assert.equal(detail.optionalMissingRatio, 0.25, 'grading reports the optional missing ratio');
  assert.equal(detail.thresholds.optionalMissingRatio, 0.2, 'grading reports the thresholds actually applied');
  assert.match(detail.reason, /optional/, 'grading explains why');

  // ---- 档位序关系
  assert.equal(isSemanticGradeAtLeast('good', 'good'), true, 'baseline bar: good meets good');
  assert.equal(isSemanticGradeAtLeast('clean', 'good'), true, 'clean meets good');
  assert.equal(isSemanticGradeAtLeast('degraded', 'good'), false, 'degraded misses the baseline bar');
  assert.equal(worstSemanticGrade(['clean', 'degraded', 'good']), 'degraded', 'worst grade wins a tie');
}

/** 分层计数:分母取剧本总数;缺失按剧本下标去重(一次失败不能计两笔)。 */
function assertLayeredMilestoneCounts({ countLayeredMilestones }) {
  const isCritical = (milestone) => milestone.kind === 'stage' || milestone.kind === 'outcome';
  const script = [{ kind: 'stage' }, { kind: 'deposit' }, { kind: 'deposit' }, { kind: 'outcome' }];

  const none = countLayeredMilestones(script, [], isCritical);
  assert.deepEqual(none, { criticalMissing: 0, optionalMissing: 0, criticalTotal: 2, optionalTotal: 2 }, 'totals split by kind');

  const mixed = countLayeredMilestones(
    script,
    [{ index: 0, expected: { kind: 'stage' } }, { index: 1, expected: { kind: 'deposit' } }],
    isCritical,
  );
  assert.equal(mixed.criticalMissing, 1, 'missing stage counts critical');
  assert.equal(mixed.optionalMissing, 1, 'missing deposit counts optional');

  // 同一个里程碑被记两次(terminal divergence + stage timeout)只能算一笔
  const duplicated = countLayeredMilestones(
    script,
    [
      { index: 0, expected: { kind: 'stage' } },
      { index: 0, expected: { kind: 'stage' } },
      { index: 1, expected: { kind: 'deposit' } },
      { index: 1, expected: { kind: 'deposit' } },
    ],
    isCritical,
  );
  assert.equal(duplicated.criticalMissing, 1, 'duplicate missing entries for one milestone count once');
  assert.equal(duplicated.optionalMissing, 1, 'duplicate optional missing entries count once');

  // expected 缺席(terminal divergence 发生在最后一个里程碑之后)不参与计数
  const headless = countLayeredMilestones(script, [{ index: 4, reason: 'terminal divergence' }], isCritical);
  assert.equal(headless.criticalMissing + headless.optionalMissing, 0, 'missing entries without `expected` are skipped');
}

/** 多数决:双跑同档定档;分裂第三跑取多数;平票取最差档 + flaky。 */
async function assertSemanticGradeMajority({ decideSemanticGradeMajority, runSemanticGradeMajority }) {
  assert.equal(decideSemanticGradeMajority(['clean']), null, 'one run is never enough');
  const unanimous = decideSemanticGradeMajority(['clean', 'clean']);
  assert.equal(unanimous.grade, 'clean', 'two agreeing runs settle');
  assert.equal(unanimous.flaky, false, 'agreement is not flaky');
  assert.equal(unanimous.decidedBy, 'unanimous');

  assert.equal(decideSemanticGradeMajority(['clean', 'good']), null, 'a 1/2 split needs a third run');
  const majority = decideSemanticGradeMajority(['clean', 'good', 'good']);
  assert.equal(majority.grade, 'good', 'third run breaks the split by majority');
  assert.equal(majority.flaky, true, 'a split is flaky even after the majority settles it');
  assert.equal(majority.decidedBy, 'majority');

  const tie = decideSemanticGradeMajority(['clean', 'good', 'degraded']);
  assert.equal(tie.grade, 'degraded', 'a three-way tie takes the WORST grade, never the best');
  assert.equal(tie.flaky, true);
  assert.equal(tie.decidedBy, 'tie');

  // runner:跑够就停,分裂才加跑
  let calls = 0;
  const clean = await runSemanticGradeMajority(() => { calls += 1; return { grade: 'clean' }; }, (v) => v.grade);
  assert.equal(calls, 2, 'unanimous stops at two runs');
  assert.equal(clean.decision.flaky, false);
  assert.equal(clean.runs.length, 2);

  calls = 0;
  const split = await runSemanticGradeMajority(
    () => { calls += 1; return { grade: calls === 1 ? 'clean' : 'good' }; },
    (v) => v.grade,
  );
  assert.equal(calls, 3, 'a split triggers exactly one extra run');
  assert.equal(split.decision.grade, 'good', 'majority of {clean, good, good}');
  assert.equal(split.decision.flaky, true, 'verdict is stamped flaky');
  assert.deepEqual(split.decision.tally, { clean: 1, good: 2, degraded: 0, failed: 0 }, 'tally is reported');
}

/** 里程碑分层:kind 默认表 + 游戏侧 critical 覆盖(向上/向下)。 */
function assertMilestoneCriticality({
  clearRecordReplayProviders,
  registerRecordReplayProviders,
  isRecordReplayMilestoneCritical,
  getDefaultRecordReplayMilestoneCriticality,
  RECORD_REPLAY_DEFAULT_CRITICAL_KINDS,
}) {
  clearRecordReplayProviders();
  assert.deepEqual([...RECORD_REPLAY_DEFAULT_CRITICAL_KINDS], ['outcome', 'stage'], 'default critical kinds');
  for (const kind of ['outcome', 'stage']) {
    assert.equal(getDefaultRecordReplayMilestoneCriticality(kind), true, `${kind} defaults critical`);
    assert.equal(isRecordReplayMilestoneCritical({ kind }), true, `${kind} critical with no detector registered`);
  }
  for (const kind of ['deposit', 'equip', 'custom', 'something-new']) {
    assert.equal(getDefaultRecordReplayMilestoneCriticality(kind), false, `${kind} defaults optional`);
    assert.equal(isRecordReplayMilestoneCritical({ kind }), false, `${kind} optional with no detector registered`);
  }

  // 游戏侧向上覆盖:deposit 在某个游戏里就是主线
  let unregister = registerRecordReplayProviders({
    milestoneDetectors: [createFactMilestoneDetector('deposit', () => true, true)],
  });
  assert.equal(isRecordReplayMilestoneCritical({ kind: 'deposit' }), true, 'game can promote deposit to critical');
  unregister();

  // 向下覆盖:某个游戏的 outcome 只是过场
  unregister = registerRecordReplayProviders({
    milestoneDetectors: [createFactMilestoneDetector('outcome', () => true, false)],
  });
  assert.equal(isRecordReplayMilestoneCritical({ kind: 'outcome' }), false, 'game can demote outcome to optional');
  unregister();

  // 同 kind 多个检测器,有一个说 critical 就是 critical(保守合并)。
  // **两种注册顺序都要验** —— 只验一种的话,「最后一个说了算」的实现也能蒙混过关。
  for (const [first, second] of [[false, true], [true, false]]) {
    unregister = registerRecordReplayProviders({
      milestoneDetectors: [
        createFactMilestoneDetector('equip', () => true, first),
        createFactMilestoneDetector('equip', () => true, second),
      ],
    });
    assert.equal(
      isRecordReplayMilestoneCritical({ kind: 'equip' }),
      true,
      `any critical declaration wins (registered ${first} then ${second})`,
    );
    unregister();
  }
  clearRecordReplayProviders();
}

/**
 * 端到端:**同一种失败形状**,里程碑 kind 不同 ⇒ 档位不同。
 * 这条是分层真正接进 verdict 的证据(不是纯函数自说自话),顺带验 determinism 戳。
 */
function assertSemanticGradeFromController({
  clearRecordReplayProviders,
  registerRecordReplayProviders,
  SemanticReplayController,
}) {
  const detectors = [
    createFactMilestoneDetector('custom', (id) => !id.includes('.stage.')),
    createFactMilestoneDetector('stage', (id) => id.includes('.stage.')),
  ];
  const runUnreachableMilestone = (factId, kind, replayOptions = {}) => {
    let verdict = null;
    withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders, milestoneDetectors: detectors }, (game) => {
      game.addFactRule(factId.replace(/^mock\.state\./, ''), () => false);
      const script = createSemanticControllerScript({
        durationSec: 2,
        waypoints: [{ t: 0, x: 0, z: 0 }, { t: 1, x: 1, z: 0 }],
        milestones: [{ t: 1, kind, detail: { id: factId, to: 'true' } }],
      });
      const controller = new SemanticReplayController(game, script, {
        waypointToleranceBand: 0.12,
        maxDurationSec: 8,
        maxLoopsPerStage: 1,
        stageTimeoutSlackSec: 0.5,
        ...replayOptions,
      });
      stepSemanticController(controller, game, { steps: 120, dt: 0.1, speed: 1 });
      verdict = controller.getVerdict();
    });
    return verdict;
  };

  const optional = runUnreachableMilestone('mock.state.progress.ready', 'custom');
  assert.equal(optional.milestones.optionalTotal, 1, 'custom milestone counts as optional');
  assert.equal(optional.milestones.criticalTotal, 0);
  assert.equal(optional.milestones.optionalMissing, 1, 'the missed optional milestone is layered');
  assert.equal(optional.milestones.criticalMissing, 0);
  assert.equal(optional.grade, 'degraded', 'missing 100% of optional milestones ⇒ degraded, not failed');

  const critical = runUnreachableMilestone('mock.state.stage.cleared', 'stage');
  assert.equal(critical.milestones.criticalTotal, 1, 'stage milestone counts as critical');
  assert.equal(critical.milestones.criticalMissing, 1);
  assert.equal(critical.grade, 'failed', 'the SAME failure on a critical milestone ⇒ failed');
  assert.match(critical.grading.reason, /critical/, 'grading names the critical miss');

  // determinism 戳:不传 horizon 就没有这个字段(行为不变)
  assert.equal(critical.determinism, null, 'no determinismHorizon ⇒ determinism is null');

  const inHorizon = runUnreachableMilestone('mock.state.stage.cleared', 'stage', { determinismHorizon: 100000 });
  assert.equal(inHorizon.determinism.horizon, 100000);
  assert.equal(typeof inHorizon.determinism.failurePointFrame, 'number', 'failure point is recorded in frames');
  assert.equal(inHorizon.determinism.failureWithinHorizon, true);
  assert.equal(inHorizon.determinism.confidence, 'high', 'failure inside the horizon ⇒ high confidence');

  const outOfHorizon = runUnreachableMilestone('mock.state.stage.cleared', 'stage', { determinismHorizon: 1 });
  assert.equal(outOfHorizon.determinism.failureWithinHorizon, false);
  assert.equal(outOfHorizon.determinism.confidence, 'low', 'failure past the horizon ⇒ low confidence (suspect drift)');
  assert.equal(
    outOfHorizon.determinism.failurePointFrame,
    inHorizon.determinism.failurePointFrame,
    'the failure point itself does not depend on the horizon',
  );

  const greenFull = runUnreachableMilestone('mock.state.stage.cleared', 'stage', { determinismHorizon: 'green-full' });
  assert.equal(greenFull.determinism.failureWithinHorizon, true, 'green-full horizon contains every failure point');
  assert.equal(greenFull.determinism.confidence, 'high');

  // 失败点必须是**最早**那次,不能被后面的级联覆盖。
  // 场景:开局位移被锁 ⇒ 标定失败(很早);之后里程碑永远不满足 ⇒ stage timeout(很晚)。
  let blockedVerdict = null;
  withSemanticMockGame({ clearRecordReplayProviders, registerRecordReplayProviders, milestoneDetectors: detectors }, (game) => {
    game.setMovementBlockedUntil(60);
    game.addFactRule('stage.cleared', () => false);
    const script = createSemanticControllerScript({
      durationSec: 2,
      waypoints: [{ t: 0, x: 0, z: 0 }, { t: 1, x: 1, z: 0 }],
      milestones: [{ t: 1, kind: 'stage', detail: { id: 'mock.state.stage.cleared', to: 'true' } }],
    });
    const controller = new SemanticReplayController(game, script, {
      waypointToleranceBand: 0.12,
      maxDurationSec: 8,
      maxLoopsPerStage: 1,
      stageTimeoutSlackSec: 0.5,
      determinismHorizon: 'green-full',
    });
    stepSemanticController(controller, game, { steps: 120, dt: 0.1, speed: 1 });
    blockedVerdict = controller.getVerdict();
  });
  assert.equal(blockedVerdict.calibration.status, 'failed', 'blocked movement fails calibration');
  assert.equal(blockedVerdict.grade, 'failed', 'a run that never established an input basis is failed');
  // 这一跑里有两次失败:标定失败(早)+ 随后里程碑永不满足的 stage timeout(晚,发生在 run 结束那一刻)。
  // 失败点必须停在第一次。若实现允许覆盖,failurePointFrame 会滑到 run 末尾(≈ durationSec*10)。
  assert.equal(
    blockedVerdict.determinism.failurePointFrame < blockedVerdict.durationSec * 10 - 10,
    true,
    'the earliest failure (calibration) wins — the later stage timeout must not overwrite it',
  );
}

/**
 * 轨迹跟踪器:时间参数化插值、dwell 保留、闸门 cap 钳制、跟踪误差调制示教时钟。
 */
function assertSemanticPathTracker({ SemanticPathTracker }) {
  // 一条直线:0s(0,0) -> 1s(5,0),然后在 (5,0) 站 2 秒(dwell),再走到 3s(10,0)。
  const trail = [
    { t: 0, x: 0, z: 0 },
    { t: 1, x: 5, z: 0 },
    { t: 3, x: 5, z: 0 },
    { t: 4, x: 10, z: 0 },
  ];
  const tracker = new SemanticPathTracker(trail, { lookaheadSec: 0.2 });
  assert.equal(tracker.startSec, 0);
  assert.equal(tracker.endSec, 4);

  // 时间插值
  assert.deepEqual(tracker.positionAt(0.5), { x: 2.5, z: 0 });
  // dwell 段:1s..3s 位置恒定
  assert.deepEqual(tracker.positionAt(2), { x: 5, z: 0 });

  // actor 完美贴合 -> 示教时钟全速前进
  let step = tracker.advance(0.1, { x: 0, z: 0 });
  assert.ok(step.gain > 0.99, `perfect tracking should run the clock at full gain, got ${step.gain}`);
  assert.ok(step.scheduleSec > 0.09 && step.scheduleSec <= 0.1001, `schedule=${step.scheduleSec}`);
  assert.ok(step.target.x > 0, 'target should lead the actor along the path');

  // actor 被远远甩下 -> 示教时钟停住(crossError 增益归零)
  const stalled = new SemanticPathTracker(trail);
  stalled.resetTo(0.5);
  const before = stalled.scheduleSec;
  const stalledStep = stalled.advance(0.2, { x: 2.5, z: 9 });
  assert.equal(stalledStep.gain, 0, 'far off-path actor must stall the teach clock');
  assert.equal(stalled.scheduleSec, before, 'stalled clock must not advance');

  // cap 钳制:示教时钟与 lookahead 都不许越过闸门时刻
  const capped = new SemanticPathTracker(trail, { lookaheadSec: 0.5 });
  capped.resetTo(0.9);
  const cappedStep = capped.advance(0.5, capped.positionAt(0.9), 1.0);
  assert.ok(capped.scheduleSec <= 1.0 + 1e-9, `schedule must clamp at cap, got ${capped.scheduleSec}`);
  assert.ok(cappedStep.target.x <= 5 + 1e-9, `lookahead must clamp at cap, got ${cappedStep.target.x}`);
  assert.ok(capped.isHoldingAt(1.0), 'tracker should report holding at the cap');

  // dwell:时钟走过 1s..3s 时目标点原地不动 -> actor 自然停住
  const dwelling = new SemanticPathTracker(trail, { lookaheadSec: 0.2 });
  dwelling.resetTo(1.5);
  const dwellStep = dwelling.advance(0.1, { x: 5, z: 0 });
  assert.deepEqual(dwellStep.target, { x: 5, z: 0 }, 'dwell target must stay put');
}

/** trail 抽稀必须保住形状(空间)与节奏(时间间隔,dwell 靠它活下来)。 */
function assertSemanticTrailDecimation({ decimateSemanticTrail }) {
  const points = [];
  for (let index = 0; index <= 100; index += 1) points.push({ t: index * 0.01, x: index * 0.01, z: 0 });
  // 再站 1 秒不动
  for (let index = 1; index <= 100; index += 1) points.push({ t: 1 + index * 0.01, x: 1, z: 0 });

  const decimated = decimateSemanticTrail(points, 0.08, 0.2);
  assert.ok(decimated.length >= 8, `expected shape to survive, got ${decimated.length}`);
  assert.ok(decimated.length < points.length, 'decimation must actually drop points');
  assert.equal(decimated[0].t, 0);
  assert.equal(decimated[decimated.length - 1].t, points[points.length - 1].t);
  // dwell 段(x 恒为 1)必须靠 maxTimeGap 保留至少两个点,否则回放会把「站着」压成一瞬
  const dwellPoints = decimated.filter((point) => Math.abs(point.x - 1) < 1e-9);
  assert.ok(dwellPoints.length >= 3, `dwell must keep time resolution, got ${dwellPoints.length}`);
  // 单调
  for (let index = 1; index < decimated.length; index += 1) {
    assert.ok(decimated[index].t > decimated[index - 1].t, 'trail times must be strictly increasing');
  }
}

/**
 * 空剧本必须被拒绝。一条 0 milestone + 0 waypoint 的剧本什么都不断言,
 * 驱动它会在 1 秒内返回 ok:true —— **假绿基线比红灯危险得多**。
 */
function assertSemanticEmptyScriptRefusal({
  isSemanticScriptCertifiable,
  describeSemanticScriptGaps,
  createRefusedSemanticVerdict,
}) {
  const emptyScript = {
    meta: { schemaVersion: 1, sourceTape: 't', seed: 1, durationSec: 0, extractedAt: '' },
    inputSegments: [],
    milestones: [],
    waypoints: [],
    economyFinal: { cash: 0, totalEarned: 0, totalSpent: 0 },
  };
  assert.equal(isSemanticScriptCertifiable(emptyScript), false, 'empty script must not be certifiable');
  assert.equal(isSemanticScriptCertifiable({ ...emptyScript, waypoints: [{ t: 0, x: 0, z: 0 }] }), true);
  assert.equal(isSemanticScriptCertifiable({ ...emptyScript, milestones: [{ t: 0, kind: 'k', detail: {} }] }), true);

  const gaps = describeSemanticScriptGaps({ stateSamples: [], trail: [] }, emptyScript);
  assert.equal(gaps.length, 3, `expected 3 gap warnings, got ${JSON.stringify(gaps)}`);
  assert.equal(describeSemanticScriptGaps(
    { stateSamples: [{ frame: 0 }], trail: [[0, 0]] },
    { ...emptyScript, waypoints: [{ t: 0, x: 0, z: 0 }] },
  ).length, 0, 'a script with samples + trail + waypoints must be clean');

  const verdict = createRefusedSemanticVerdict(emptyScript);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.quality, 'failed');
  assert.ok(verdict.refused, 'refused verdict must carry a `refused` block');
  assert.equal(verdict.refused.milestones, 0);
  assert.equal(verdict.refused.waypoints, 0);
  // 与 trail 跟随合并后的字段:回放从未发生,必须是 null 而不是缺失
  assert.equal(verdict.trailTracking, null, 'refused verdict must expose trailTracking: null');
}

/** inputAuthority 注册制:不注册恒 true;任一注册方说 false 就是 false;注销 / clear 复位。 */
function assertRecordReplayInputAuthority({
  registerRecordReplayProviders,
  clearRecordReplayProviders,
  readRecordReplayInputAuthority,
}) {
  clearRecordReplayProviders();
  assert.equal(readRecordReplayInputAuthority(), true, 'no registration ⇒ input is authoritative');

  let lockedA = false;
  let lockedB = false;
  const offA = registerRecordReplayProviders({ inputAuthority: () => !lockedA });
  const offB = registerRecordReplayProviders({ inputAuthority: () => !lockedB });
  assert.equal(readRecordReplayInputAuthority(), true);
  lockedB = true;
  assert.equal(readRecordReplayInputAuthority(), false, 'any provider saying false wins');
  lockedA = true;
  assert.equal(readRecordReplayInputAuthority(), false);
  offB();
  assert.equal(readRecordReplayInputAuthority(), false, 'the remaining provider still holds the lock');
  offA();
  assert.equal(readRecordReplayInputAuthority(), true, 'unregistering restores the default');

  // 抛异常的 provider 不许把整条链带崩
  const offThrow = registerRecordReplayProviders({ inputAuthority: () => { throw new Error('boom'); } });
  assert.equal(readRecordReplayInputAuthority(), true, 'a throwing provider must not deny authority');
  offThrow();
  clearRecordReplayProviders();
}

/**
 * 「输入非授权」片段:示教时钟必须按 dt 自然推进,不受跟踪误差门控。
 * 这正是 last-stand 的过场自动移动踩到的死锁 —— 角色被脚本拖到窗口之外,
 * crossError 顶穿 ⇒ gain=0 ⇒ 时钟停 ⇒ 窗口跟着时钟走,永远追不上。
 */
function assertSemanticPathTrackerScriptedSegment({ SemanticPathTracker }) {
  const trail = [
    { t: 0, x: 0, z: 0 },
    { t: 1, x: 5, z: 0 },
    { t: 2, x: 10, z: 0 },
  ];
  const farAway = { x: 0, z: 40 };   // 离航迹 40 单位:crossError 远超 crossErrorStall

  // 授权状态:增益归零,时钟纹丝不动(现行为,必须保持)
  const gated = new SemanticPathTracker(trail);
  gated.resetTo(0.5);
  const gatedStep = gated.advance(0.25, farAway);
  assert.equal(gatedStep.gain, 0, 'authoritative + far off-path ⇒ clock stalls');
  assert.equal(gated.scheduleSec, 0.5, 'stalled clock must not advance');
  assert.equal(gatedStep.inputAuthoritative, true);

  // 非授权状态:同样的位置,时钟按 dt 前进
  const scripted = new SemanticPathTracker(trail);
  scripted.resetTo(0.5);
  const step = scripted.advance(0.25, farAway, undefined, { inputAuthoritative: false });
  assert.equal(step.gain, 1, 'non-authoritative ⇒ clock runs at teach pace');
  assert.equal(step.inputAuthoritative, false);
  assert.ok(Math.abs(scripted.scheduleSec - 0.75) < 1e-9, `expected 0.75, got ${scripted.scheduleSec}`);
  // 目标锚在示教时钟上,而不是被窗口钳死的投影上
  assert.deepEqual(step.target, scripted.positionAt(0.75 + 0.2));

  // cap 仍然有效
  scripted.resetTo(0.9);
  scripted.advance(0.5, farAway, 1.0, { inputAuthoritative: false });
  assert.ok(scripted.scheduleSec <= 1.0 + 1e-9, 'cap must still clamp a scripted segment');

  // 授权恢复后回到正常门控
  const resumed = scripted.advance(0.1, scripted.positionAt(scripted.scheduleSec));
  assert.equal(resumed.inputAuthoritative, true);
  assert.ok(resumed.gain > 0.99, 'back on path ⇒ full gain again');
}

/**
 * 标定阶段也必须受 authority 门控。
 *
 * 回归来自 qy-last-stand:剧情自动移动玩家时,标定照发脉冲、照量位移 —— 剧情的位移被归因给脉冲,
 * 于是 `calibration.status = ok` 而矩阵是错的;而且示教时钟在整个剧情段纹丝不动(scriptedSec = 0)。
 */
function assertSemanticCalibrationUnderScriptedMovement({
  clearRecordReplayProviders,
  registerRecordReplayProviders,
  SemanticReplayController,
}) {
  let authoritative = false;   // 开局:剧情接管,输入不算数
  withSemanticMockGame({
    clearRecordReplayProviders,
    registerRecordReplayProviders,
    inputAuthority: () => authoritative,
  }, (game) => {
    const script = createSemanticControllerScript({
      durationSec: 8,
      waypoints: [{ t: 0, x: 0, z: 0 }, { t: 6, x: 6, z: 0 }],
      trail: [{ t: 0, x: 0, z: 0 }, { t: 6, x: 6, z: 0 }],
    });
    const controller = new SemanticReplayController(game, script, { maxDurationSec: 60 });

    // ---- 剧情段:输入不算数,游戏自己把角色从 (0,0) 搬到 (0,6)(离航迹 6 个单位)
    const scriptedSteps = 20;
    const dt = 0.1;
    for (let index = 0; index < scriptedSteps; index += 1) {
      const input = controller.getInput();
      assert.equal(input.isActive, false, 'no calibration pulses while input is not authoritative');
      assert.equal(input.magnitude, 0, 'scripted segment must emit idle input');
      game.scriptedMoveTo(0, 6 * (index + 1) / scriptedSteps);   // 剧情自动移动
      controller.afterUpdate(dt);
    }

    // ---- 剧情结束,输入解禁;角色被留在 (0,6)
    authoritative = true;
    game.scriptedMoveTo(0, 0);   // 剧情把角色送回航迹起点(它在示教里也是这么做的)
    stepSemanticController(controller, game, { steps: 400, dt: 0.05, speed: 2 });

    const verdict = controller.getVerdict();
    // 1. 标定推迟到解禁之后,且矩阵没有被剧情位移投毒
    assert.equal(verdict.calibration.status, 'ok', 'calibration must succeed after authority returns');
    assert.ok(verdict.calibration.matrix.inputX.x > 0.9,
      `inputX must map to +x, got ${JSON.stringify(verdict.calibration.matrix)}`);
    assert.ok(verdict.calibration.matrix.inputY.z > 0.9,
      `inputY must map to +z, got ${JSON.stringify(verdict.calibration.matrix)}`);
    // 剧情搬了 6 个单位;若被归因给标定脉冲,displacement 会是 6 量级而不是 0.5 量级
    assert.ok(verdict.calibration.displacement.inputX < 1,
      `calibration displacement must not absorb the cutscene move, got ${verdict.calibration.displacement.inputX}`);

    // 2. 剧情段被记账,且示教时钟在那段时间照常推进
    assert.ok(verdict.trailTracking.scriptedSec >= scriptedSteps * dt - 1e-6,
      `scriptedSec must cover the whole cutscene, got ${verdict.trailTracking.scriptedSec}`);
    assert.ok(verdict.trailTracking.scheduleSec >= scriptedSteps * dt - 1e-6,
      `teach clock must advance through the cutscene, got ${verdict.trailTracking.scheduleSec}`);
  });
}
