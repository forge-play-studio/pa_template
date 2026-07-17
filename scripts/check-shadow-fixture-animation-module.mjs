#!/usr/bin/env node

import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { ShadowFixtureAnimationModule } from '../src/gameplay/ShadowFixtureAnimationModule.ts';

assertActivityRegistrationAndMotionLifecycle();
assertPauseResumeAndDisposeLifecycle();
assertMissingClipsRemainInactive();
assertInitializationRollbackDisposesAcquiredSources();
assertDisposeContinuesAfterAnimationStopFailure();
assertResumeKeepsActivityAfterPauseFailure();
assertResumeFailureCanBeRetried();

console.log('Shadow fixture animation activity checks passed');

function assertActivityRegistrationAndMotionLifecycle() {
  withFixture(({ module, sources }) => {
    module.init();

    assert.deepEqual([...sources.keys()].sort(), [
      'shadow_fixture_player\0animation\0shadow-fixture-player-animation',
      'shadow_fixture_player\0transform\0shadow-fixture-player-root-motion',
      'shadow_fixture_worker\0animation\0shadow-fixture-worker-animation',
    ]);
    assert.equal(source(sources, 'shadow-fixture-player-root-motion').active, true);
    assert.equal(source(sources, 'shadow-fixture-player-animation').active, true);
    assert.equal(source(sources, 'shadow-fixture-worker-animation').active, true);

    module.update(1);
    assert.equal(module.getDebugState().playerState, 'idle');
    assert.equal(source(sources, 'shadow-fixture-player-root-motion').active, false);
    assert.equal(source(sources, 'shadow-fixture-player-animation').active, true);

    module.update(1);
    assert.equal(module.getDebugState().playerState, 'moving');
    assert.equal(source(sources, 'shadow-fixture-player-root-motion').active, true);
  });
}

function assertPauseResumeAndDisposeLifecycle() {
  withFixture(({ module, sources, animationService }) => {
    module.init();
    module.pause();
    module.pause();
    assert.equal(source(sources, 'shadow-fixture-player-root-motion').active, false);
    assert.equal(source(sources, 'shadow-fixture-player-animation').active, false);
    assert.equal(source(sources, 'shadow-fixture-worker-animation').active, false);
    assert.equal(animationService.pauseCalls, 2);

    module.resume();
    module.resume();
    assert.equal(source(sources, 'shadow-fixture-player-root-motion').active, true);
    assert.equal(source(sources, 'shadow-fixture-player-animation').active, true);
    assert.equal(source(sources, 'shadow-fixture-worker-animation').active, true);
    assert.equal(animationService.resumeCalls, 2);

    module.dispose();
    module.dispose();
    for (const activity of sources.values()) {
      assert.equal(activity.active, false);
      assert.equal(activity.disposeCalls, 1);
    }
    assert.equal(animationService.stopCalls, 2);
  });
}

function assertMissingClipsRemainInactive() {
  withFixture(({ module, sources }) => {
    module.init();
    assert.equal(source(sources, 'shadow-fixture-player-root-motion').active, true);
    assert.equal(source(sources, 'shadow-fixture-player-animation').active, false);
    assert.equal(source(sources, 'shadow-fixture-worker-animation').active, false);
  }, { includeAnimations: false });
}

function assertInitializationRollbackDisposesAcquiredSources() {
  withFixture(({ module, sources }) => {
    assert.throws(() => module.init(), /injected-registration-failure/);
    const acquired = source(sources, 'shadow-fixture-player-root-motion');
    assert.equal(acquired.active, false);
    assert.equal(acquired.disposeCalls, 1);
  }, { registrationFailureSourceId: 'shadow-fixture-player-animation' });
}

function assertDisposeContinuesAfterAnimationStopFailure() {
  withFixture(({ module, sources, animationService }) => {
    module.init();
    assert.throws(() => module.dispose(), /injected-stop-failure/);
    assert.equal(animationService.stopCalls, 2, 'worker stop must still run after player stop fails');
    for (const activity of sources.values()) {
      assert.equal(activity.active, false);
      assert.equal(activity.disposeCalls, 1);
    }
  }, { stopFailureCall: 1 });
}

function assertResumeKeepsActivityAfterPauseFailure() {
  withFixture(({ module, sources }) => {
    module.init();
    assert.throws(() => module.pause(), /injected-pause-failure/);
    assert.equal(
      source(sources, 'shadow-fixture-player-animation').active,
      true,
      'a failed pause must conservatively keep activity enabled',
    );

    module.pause();
    assert.equal(source(sources, 'shadow-fixture-player-animation').active, false);
    assert.equal(source(sources, 'shadow-fixture-worker-animation').active, false);
    module.resume();
    assert.equal(
      source(sources, 'shadow-fixture-player-animation').active,
      true,
      'an already-playing clip must remain active after resume',
    );
    assert.equal(source(sources, 'shadow-fixture-worker-animation').active, true);
  }, { pauseFailureCall: 1 });
}

function assertResumeFailureCanBeRetried() {
  withFixture(({ module, sources, animationService }) => {
    module.init();
    module.pause();
    assert.throws(() => module.resume(), /injected-resume-failure/);
    assert.equal(
      source(sources, 'shadow-fixture-player-animation').active,
      true,
      'uncertain resume failure must conservatively keep activity enabled',
    );

    module.resume();
    assert.equal(animationService.resumeCalls, 4, 'a failed resume must remain retryable for both clip sets');
    assert.equal(source(sources, 'shadow-fixture-player-animation').active, true);
    assert.equal(source(sources, 'shadow-fixture-worker-animation').active, true);
    assert.equal(source(sources, 'shadow-fixture-player-root-motion').active, true);
  }, { resumeFailureCall: 1 });
}

function withFixture(run, options = {}) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const player = new TransformNode('shadow_fixture_player', scene);
  const sources = new Map();
  const animationService = createAnimationService(options);
  const includeAnimations = options.includeAnimations ?? true;
  const animationGroups = new Map([
    ['shadow_fixture_player', includeAnimations ? [{ name: 'Idle' }, { name: 'Run' }] : []],
    ['shadow_fixture_worker', includeAnimations ? [{ name: 'Walk' }] : []],
  ]);
  const sceneBuilder = {
    registerShadowCasterActivitySource(input) {
      if (input.sourceId === options.registrationFailureSourceId) {
        throw new Error('injected-registration-failure');
      }
      const key = `${input.entityId}\0${input.kind}\0${input.sourceId}`;
      const controller = createActivityController();
      sources.set(key, controller);
      return controller;
    },
    getSceneNodeRuntime(entityId) {
      return entityId === 'shadow_fixture_player' ? player : null;
    },
    getSceneNodeAnimationGroups(entityId) {
      return animationGroups.get(entityId) ?? [];
    },
  };
  const module = new ShadowFixtureAnimationModule(
    { sceneBuilder, modelAnimationService: animationService },
    {
      playerMoveRadius: 0.1,
      playerMoveSpeed: 10,
      playerIdleMinSec: 0,
      playerIdleMaxSec: 0,
      random: () => 0,
    },
  );
  try {
    run({ module, sources, animationService });
  } finally {
    module.dispose();
    scene.dispose();
    engine.dispose();
  }
}

function createActivityController() {
  return {
    active: false,
    disposeCalls: 0,
    setActive(active) {
      if (this.active === active) return false;
      this.active = active;
      return true;
    },
    invalidate() {
      return this.active;
    },
    dispose() {
      this.disposeCalls += 1;
    },
  };
}

function createAnimationService(options) {
  const active = new Set();
  const paused = new Set();
  return {
    pauseCalls: 0,
    resumeCalls: 0,
    stopCalls: 0,
    play(animations, clipName) {
      const animation = animations.find(candidate => candidate.name.toLowerCase() === clipName.toLowerCase()) ?? null;
      if (animation) {
        active.add(animation);
        paused.delete(animation);
      }
      return animation;
    },
    pause(animations) {
      this.pauseCalls += 1;
      if (this.pauseCalls === options.pauseFailureCall) throw new Error('injected-pause-failure');
      let count = 0;
      for (const animation of animations) {
        if (!active.delete(animation)) continue;
        paused.add(animation);
        count += 1;
      }
      return count;
    },
    resume(animations) {
      this.resumeCalls += 1;
      if (this.resumeCalls === options.resumeFailureCall) throw new Error('injected-resume-failure');
      let playing = 0;
      for (const animation of animations) {
        if (paused.delete(animation)) active.add(animation);
        if (active.has(animation)) playing += 1;
      }
      return playing;
    },
    stop(animations) {
      this.stopCalls += 1;
      if (this.stopCalls === options.stopFailureCall) throw new Error('injected-stop-failure');
      for (const animation of animations) {
        active.delete(animation);
        paused.delete(animation);
      }
    },
  };
}

function source(sources, sourceId) {
  const match = [...sources.entries()].find(([key]) => key.endsWith(`\0${sourceId}`));
  assert.ok(match, `missing activity source: ${sourceId}`);
  return match[1];
}
