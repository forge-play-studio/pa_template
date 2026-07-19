#!/usr/bin/env node

import assert from 'node:assert/strict';
import { FrameClock } from '../src/runtime/frame/FrameClock.ts';
import { FrameDirector } from '../src/runtime/frame/FrameDirector.ts';
import { FramePump } from '../src/runtime/frame/FramePump.ts';
import { RenderCoordinator } from '../src/runtime/frame/RenderCoordinator.ts';
import { ResourceScope } from '../src/runtime/lifecycle/ResourceScope.ts';

testFrameClock();
testFrameDirector();
testFramePump();
await testRenderCoordinator();
await testResourceScope();

console.log('[check-gameworld-lifecycle] frame and lifecycle checks passed');

function testFrameClock() {
  const clock = new FrameClock({ maxDeltaSeconds: 0.1 });
  assert.deepEqual(clock.beginFrame(1000), {
    frame: 1,
    nowMs: 1000,
    deltaSeconds: 0,
    elapsedSeconds: 0,
  });
  assert.equal(clock.beginFrame(1050).deltaSeconds, 0.05);
  assert.equal(clock.beginFrame(2050).deltaSeconds, 0.1, 'delta must be clamped');
  clock.resetTime();
  assert.equal(clock.beginFrame(9000).deltaSeconds, 0, 'resume/visibility reset must produce zero delta');
}

function testFrameDirector() {
  const events = [];
  const director = new FrameDirector({
    input: () => events.push('input'),
    update: () => events.push('update'),
    lateUpdate: () => events.push('late'),
    deferredCleanup: () => events.push('cleanup'),
    render: () => events.push('render'),
    end: () => events.push('end'),
  });
  const frame = { frame: 1, nowMs: 0, deltaSeconds: 0, elapsedSeconds: 0 };
  director.tick(frame, false);
  assert.deepEqual(events, ['input', 'update', 'late', 'cleanup', 'render', 'end']);
  events.length = 0;
  director.tick(frame, true);
  assert.deepEqual(events, ['render', 'end'], 'pause must skip simulation but keep render/end');
}

function testFramePump() {
  let renderLoop = null;
  let stoppedLoop = null;
  let now = 1000;
  const engine = {
    runRenderLoop(callback) { renderLoop = callback; },
    stopRenderLoop(callback) { stoppedLoop = callback; },
  };
  const deltas = [];
  const director = new FrameDirector({
    update: frame => deltas.push(frame.deltaSeconds),
    render: () => undefined,
  });
  const pump = new FramePump({
    engine,
    clock: new FrameClock(),
    director,
    isSimulationPaused: () => false,
    now: () => now,
  });
  pump.start();
  assert.equal(typeof renderLoop, 'function');
  renderLoop();
  now += 16;
  renderLoop();
  assert.deepEqual(deltas, [0, 0.016]);
  pump.stop();
  assert.equal(stoppedLoop, renderLoop, 'FramePump must stop the exact callback it started');
  renderLoop();
  assert.deepEqual(deltas, [0, 0.016], 'stopped pump must not tick');
}

async function testRenderCoordinator() {
  const previousRaf = globalThis.requestAnimationFrame;
  const previousWindow = globalThis.window;
  let renders = 0;
  let ready = 0;
  globalThis.requestAnimationFrame = callback => {
    callback(0);
    return 1;
  };
  globalThis.window = { setTimeout: callback => setTimeout(callback, 0) };
  try {
    const coordinator = new RenderCoordinator({
      async whenReadyAsync() { ready += 1; },
      render() { renders += 1; },
    });
    coordinator.renderFrame({ frame: 1, nowMs: 0, deltaSeconds: 0, elapsedSeconds: 0 });
    await coordinator.renderOnce();
    assert.equal(ready, 1);
    assert.equal(renders, 2, 'normal and warmup renders must share one coordinator');
  } finally {
    if (previousRaf === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previousRaf;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

async function testResourceScope() {
  const scope = new ResourceScope();
  const events = [];
  scope.defer(() => events.push('first'));
  scope.defer(() => { events.push('second'); throw new Error('expected cleanup failure'); });
  scope.defer(async () => { events.push('third'); });
  await assert.rejects(scope.dispose(), /expected cleanup failure/);
  assert.deepEqual(events, ['third', 'second', 'first'], 'cleanup must be reverse-order and continue after errors');
  await scope.dispose();
  assert.deepEqual(events, ['third', 'second', 'first'], 'repeated disposal must be a no-op');
}
