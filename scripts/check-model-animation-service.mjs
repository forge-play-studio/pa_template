#!/usr/bin/env node

import assert from 'node:assert/strict';
import { Animation } from '@babylonjs/core/Animations/animation.js';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ModelAnimationService } from '../src/services/ModelAnimationService.ts';

assertPlaybackControlSurface();
assertInstanceIsolation();
assertPlaybackOptionsAndReset();
assertPauseResume();
assertMissingAndDuplicateClipsAreRejected();

console.log('Model animation playback checks passed');

function assertPlaybackControlSurface() {
  const methods = Object.getOwnPropertyNames(ModelAnimationService.prototype)
    .filter(name => name !== 'constructor')
    .sort();
  assert.deepEqual(methods, ['pause', 'play', 'resume', 'stop']);
  const service = new ModelAnimationService();
  assert.equal('update' in service, false, 'model animation must not join the project update loop');
  assert.equal('crossFade' in service, false, 'project-facing model animation exposes no transition scheduler');
}

function assertPauseResume() {
  withScene(scene => {
    const service = new ModelAnimationService();
    const idle = createGroup(scene, 'Idle');
    const animations = [idle];
    service.play(animations, 'idle');

    assert.equal(service.pause(animations), 1);
    assert.equal(idle.isStarted, true);
    assert.equal(idle.isPlaying, false);
    assert.equal(service.pause(animations), 0, 'pause must be idempotent');

    assert.equal(service.resume(animations), 1);
    assert.equal(idle.isPlaying, true);
    assert.equal(service.resume(animations), 1, 'resume reports actual playback after an idempotent call');
  });
}

function assertInstanceIsolation() {
  withScene(scene => {
    const service = new ModelAnimationService();
    const actorA = [createGroup(scene, 'idle'), createGroup(scene, 'walk')];
    const actorB = [createGroup(scene, 'idle'), createGroup(scene, 'walk')];

    service.play(actorA, 'idle');
    service.play(actorB, 'idle');
    service.play(actorA, 'walk');

    assert.equal(actorA[0].isStarted, false);
    assert.equal(actorA[1].isPlaying, true);
    assert.equal(actorB[0].isPlaying, true, 'same-name clip on another model instance must keep playing');

    service.stop(actorA);
    assert.equal(actorA[1].isStarted, false);
    assert.equal(actorB[0].isPlaying, true);
  });
}

function assertPlaybackOptionsAndReset() {
  withScene(scene => {
    const service = new ModelAnimationService();
    const idle = createGroup(scene, 'Idle');
    const walk = createGroup(scene, 'Walk');
    const animations = [idle, walk];

    assert.equal(service.play(animations, 'walk', { loop: true, speedRatio: 1.5 }), walk);
    assert.equal(walk.isPlaying, true);
    assert.equal(walk.loopAnimation, true);
    assert.equal(walk.speedRatio, 1.5);

    service.stop(animations, 'WALK');
    assert.equal(walk.isStarted, false);
    assert.equal(walk.weight, -1);
    assert.equal(walk.speedRatio, 1);
    assert.equal(walk.loopAnimation, false);

    assert.equal(service.play(animations, 'idle', { from: 5, to: 20 }), idle);
    assert.equal(idle.isPlaying, true);
    service.stop(animations);
  });
}

function assertMissingAndDuplicateClipsAreRejected() {
  withScene(scene => {
    const service = new ModelAnimationService();
    const animations = [
      createGroup(scene, 'idle'),
      createGroup(scene, 'idle'),
      createGroup(scene, 'idle'),
    ];
    assert.equal(service.play(animations, 'missing'), null);
    assert.equal(service.play(animations, 'idle'), null, 'duplicate exact clip names must be resolved in project config');
  });
}

function withScene(run) {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    run(scene);
  } finally {
    scene.dispose();
    engine.dispose();
  }
}

function createGroup(scene, name) {
  const target = { value: 0 };
  const animation = new Animation(
    `${name}_value`,
    'value',
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  animation.setKeys([
    { frame: 0, value: 0 },
    { frame: 30, value: 1 },
  ]);
  const group = new AnimationGroup(name, scene);
  group.addTargetedAnimation(animation, target);
  return group;
}
