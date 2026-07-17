import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import { createShadowMapStressController } from '../src/debug/shadow-map-stress-harness.ts';

const engine = new NullEngine();
const scene = new Scene(engine);
const editorStatic = new TransformNode('shadow_stress_editor_static_0000', scene);
const editorDynamic = new TransformNode('shadow_stress_editor_dynamic_0000', scene);
const editorSkinned = new TransformNode('shadow_stress_editor_skinned_0000', scene);
const skinnedAnimation = new AnimationGroup('idle', scene);
const sources = new Map();
let registrationDisposeCount = 0;
let registeredRuntimeObjects = [];
let gameplayPauseCount = 0;
let gameplayResumeCount = 0;
let animationPlayCount = 0;
let animationPauseCount = 0;
let animationStopCount = 0;

const sceneBuilder = {
  sceneNodeRuntimes: new Map([
    [editorStatic.id, editorStatic],
    [editorDynamic.id, editorDynamic],
    [editorSkinned.id, editorSkinned],
  ]),
  getSceneNodeAnimationGroups(entityId) {
    return entityId === editorSkinned.id ? [skinnedAnimation] : [];
  },
  registerRuntimeGeneratedShadowCasters(inputs) {
    registeredRuntimeObjects = [...inputs];
    return {
      dispose() { registrationDisposeCount += 1; },
    };
  },
  registerShadowCasterActivitySource(input) {
    const key = `${input.entityId}\0${input.sourceId}`;
    const source = {
      active: false,
      disposeCount: 0,
      setActive(active) {
        const changed = this.active !== active;
        this.active = active;
        return changed;
      },
      invalidate() { return this.active; },
      dispose() { this.disposeCount += 1; },
    };
    sources.set(key, source);
    return source;
  },
};
const modelAnimationService = {
  play(animations, clipName) {
    animationPlayCount += 1;
    const animation = animations.find(candidate => candidate.name === clipName) ?? null;
    if (animation) Object.defineProperty(animation, 'isPlaying', { configurable: true, value: true });
    return animation;
  },
  pause(animations) {
    animationPauseCount += 1;
    for (const animation of animations) {
      Object.defineProperty(animation, 'isPlaying', { configurable: true, value: false });
    }
    return animations.length;
  },
  stop(animations) {
    animationStopCount += 1;
    for (const animation of animations) {
      Object.defineProperty(animation, 'isPlaying', { configurable: true, value: false });
    }
  },
};
const game = {
  getScene: () => scene,
  getSceneBuilder: () => sceneBuilder,
  getShadowMapExperimentEvidence: () => ({ refreshCount: 0 }),
  getModelAnimationService: () => modelAnimationService,
  pause() { gameplayPauseCount += 1; },
  resume() { gameplayResumeCount += 1; },
};

const controller = createShadowMapStressController(game);
const configured = controller.configureCodeGenerated({ staticCount: 3, dynamicCount: 2 });
assert.equal(configured.editorStaticCount, 1);
assert.equal(configured.editorDynamicCount, 1);
assert.equal(configured.editorSkinnedCount, 1);
assert.equal(configured.skinnedAnimationGroupCount, 1);
assert.equal(configured.codeStaticCount, 3);
assert.equal(configured.codeDynamicCount, 2);
assert.equal(registeredRuntimeObjects.length, 5);
assert.equal(registeredRuntimeObjects.filter(object => object.updateClass === 'dynamic').length, 2);

controller.startDynamic();
assert.equal(animationPlayCount, 1);
assert.equal(controller.getSnapshot().playingSkinnedAnimationCount, 1);
for (const [key, source] of sources) {
  if (key.includes('dynamic') || key.includes('editor')) assert.equal(source.active, true);
}
scene.onBeforeRenderObservable.notifyObservers(scene);
controller.stopDynamic();
assert.equal(animationPauseCount, 1);
assert.equal(controller.getSnapshot().playingSkinnedAnimationCount, 0);
for (const source of sources.values()) assert.equal(source.active, false);
controller.pauseGameplay();
controller.resumeGameplay();
assert.equal(gameplayPauseCount, 1);
assert.equal(gameplayResumeCount, 1);

const cleared = controller.clearCodeGenerated();
assert.equal(cleared.codeStaticCount, 0);
assert.equal(cleared.codeDynamicCount, 0);
assert.equal(registrationDisposeCount, 1);

controller.refreshEditorGenerated();
controller.pauseGameplay();
controller.dispose();
controller.dispose();
assert.equal(animationStopCount, 2);
assert.equal(gameplayPauseCount, 2);
assert.equal(gameplayResumeCount, 2);
scene.dispose();
engine.dispose();
console.log('shadow-map stress runtime harness: ok');
