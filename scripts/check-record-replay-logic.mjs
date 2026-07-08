import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
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
    'src/debug/record-replay/RecorderSource.ts',
    'src/debug/record-replay/ReplaySource.ts',
    'src/debug/example-drag-source.ts',
  ], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  if (compile.status !== 0) process.exit(compile.status ?? 1);

  const require = createRequire(import.meta.url);
  const {
    RECORD_REPLAY_SCHEMA_VERSION,
    assertDemoRecording,
  } = require(join(outDir, 'debug/record-replay/schema.js'));
  const { RecorderSource } = require(join(outDir, 'debug/record-replay/RecorderSource.js'));
  const { ReplaySource } = require(join(outDir, 'debug/record-replay/ReplaySource.js'));
  const { createExampleDragSource } = require(join(outDir, 'debug/example-drag-source.js'));

  let frame = 0;
  let currentDt = null;
  let lastDt = 0;
  let scriptFrame = 0;
  const clock = {
    getFrameCount: () => frame,
    getCurrentFrameDeltaTime: () => currentDt,
    getLastFrameDeltaTime: () => lastDt,
  };
  const source = createExampleDragSource({ getFrameIndex: () => scriptFrame });
  const recorder = new RecorderSource(source, clock, { maxFrames: 16 });
  const dts = [0.016, 0.017, 0.015, 0.018, 0.0165];

  for (let index = 0; index < dts.length; index += 1) {
    scriptFrame = index;
    currentDt = dts[index];
    recorder.getInput();
    recorder.getInput();
    lastDt = dts[index];
    currentDt = null;
    frame += 1;
  }

  const frames = recorder.getFrames();
  assert.equal(frames.length, dts.length, 'RecorderSource records one input per frame even when getInput is called twice');
  assert.deepEqual(frames.map((item) => item.dt), dts, 'RecorderSource stores the dt consumed by the frame');

  const replaySource = new ReplaySource(frames);
  for (let index = 0; index < frames.length; index += 1) {
    replaySource.setFrameIndex(index);
    assert.deepEqual(replaySource.getInput(), frames[index].input, `ReplaySource returns frame ${index} input`);
  }

  const recording = {
    envelope: {
      schemaVersion: RECORD_REPLAY_SCHEMA_VERSION,
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
    stateHashes: frames.map((item) => `hash:${item.frame}`),
    events: [],
  };
  assertDemoRecording(recording);
  assert.throws(
    () => assertDemoRecording({ ...recording, stateHashes: recording.stateHashes.slice(1) }),
    /state hash count mismatch/,
    'schema rejects hash/frame count mismatch',
  );

  console.log('[check-record-replay-logic] OK');
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
