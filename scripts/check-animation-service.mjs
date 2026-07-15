#!/usr/bin/env node

import assert from 'node:assert/strict';
import { Animation } from '@babylonjs/core/Animations/animation.js';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { AnimationService } from '../src/services/AnimationService.ts';

assertInstanceIsolation();
assertRealCrossFade();
assertBabylonAnimationGroups();
assertPauseResumeBoundary();
assertDisposeCancelsTransitions();

console.log('Animation service instance-isolation and cross-fade checks passed');

function assertInstanceIsolation() {
  const service = new AnimationService();
  const actorA = [createAnimation('actor_idle'), createAnimation('actor_walk')];
  const actorB = [createAnimation('actor_idle'), createAnimation('actor_walk')];

  service.play(actorA, 'idle');
  service.play(actorB, 'idle');
  service.play(actorA, 'walk');

  assert.equal(service.getCurrentAnimationName(actorA), 'actor_walk');
  assert.equal(service.getCurrentAnimationName(actorB), 'actor_idle');
  assert.equal(actorB[0].isPlaying, true, 'same-name clips on another pooled actor must keep playing');

  service.stop(actorA, 'walk');
  assert.equal(service.getCurrentAnimationName(actorA), null);
  assert.equal(service.getCurrentAnimationName(actorB), 'actor_idle');
  service.dispose();
}

function assertRealCrossFade() {
  const service = new AnimationService();
  const idle = createAnimation('idle');
  const walk = createAnimation('walk');
  const animations = [idle, walk];

  service.play(animations, 'idle');
  const result = service.crossFade(animations, 'idle', 'walk', 200, {
    loop: true,
    speed: 1.25,
  });

  assert.equal(result, walk);
  assert.equal(idle.isPlaying, true, 'source remains active during the blend');
  assert.equal(walk.isPlaying, true, 'destination starts before the blend advances');
  assert.equal(idle.weight, 1);
  assert.equal(walk.weight, 0);
  assert.equal(walk.speedRatio, 1.25);
  assert.equal(service.getDiagnostics().activeTransitions, 1);

  service.update(0.1);
  assert.equal(idle.weight, 0.5);
  assert.equal(walk.weight, 0.5);
  assert.equal(idle.isPlaying, true);

  service.update(0.1);
  assert.equal(idle.isStarted, false, 'source stops only after the blend completes');
  assert.equal(walk.isPlaying, true);
  assert.equal(walk.weight, -1, 'destination returns to ordinary unweighted playback');
  assert.equal(service.getCurrentAnimationName(animations), 'walk');
  assert.equal(service.getDiagnostics().activeTransitions, 0);
  service.dispose();
}

function assertBabylonAnimationGroups() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const target = { value: 0 };
  const idle = createBabylonAnimationGroup(scene, target, 'idle', 0, 1);
  const walk = createBabylonAnimationGroup(scene, target, 'walk', 1, 2);
  const animations = [idle, walk];
  const service = new AnimationService();

  service.play(animations, 'idle');
  service.crossFade(animations, 'idle', 'walk', 100);
  service.update(0.05);
  assert.equal(idle.weight, 0.5);
  assert.equal(walk.weight, 0.5);
  assert.equal(idle.isStarted, true);
  assert.equal(walk.isStarted, true);

  service.update(0.05);
  assert.equal(idle.isStarted, false);
  assert.equal(walk.isPlaying, true);
  assert.equal(walk.weight, -1);

  service.dispose();
  scene.dispose();
  engine.dispose();
}

function assertPauseResumeBoundary() {
  const service = new AnimationService();
  const idle = createAnimation('idle');
  const unused = createAnimation('unused');
  const animations = [idle, unused];

  service.play(animations, 'idle');
  service.pause(animations);
  assert.equal(idle.isPlaying, false);
  assert.equal(idle.isStarted, true);
  assert.equal(unused.isStarted, false);

  service.resume(animations);
  assert.equal(idle.isPlaying, true);
  assert.equal(unused.isStarted, false, 'resume must not start clips that were never active');
  service.dispose();
}

function assertDisposeCancelsTransitions() {
  const service = new AnimationService();
  const idle = createAnimation('idle');
  const action = createAnimation('action');
  const animations = [idle, action];

  service.play(animations, 'idle');
  service.crossFade(animations, 'idle', 'action', 500);
  service.dispose();

  assert.equal(idle.isStarted, false);
  assert.equal(action.isStarted, false);
  assert.equal(service.getDiagnostics().activeTransitions, 0);
}

function createAnimation(name) {
  return {
    name,
    isStarted: false,
    isPlaying: false,
    loopAnimation: false,
    speedRatio: 1,
    weight: -1,
    play(loop = false) {
      this.loopAnimation = loop;
      this.isStarted = true;
      this.isPlaying = true;
      return this;
    },
    stop() {
      this.isStarted = false;
      this.isPlaying = false;
      return this;
    },
    pause() {
      if (this.isStarted) this.isPlaying = false;
      return this;
    },
    restart() {
      if (this.isStarted) this.isPlaying = true;
      return this;
    },
  };
}

function createBabylonAnimationGroup(scene, target, name, fromValue, toValue) {
  const animation = new Animation(
    `${name}_value`,
    'value',
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  animation.setKeys([
    { frame: 0, value: fromValue },
    { frame: 30, value: toValue },
  ]);
  const group = new AnimationGroup(name, scene);
  group.addTargetedAnimation(animation, target);
  return group;
}
