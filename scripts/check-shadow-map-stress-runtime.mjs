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
let runtimeRegistrationCallCount = 0;
let registeredRuntimeObjects = [];
let gameplayPauseCount = 0;
let gameplayResumeCount = 0;
let animationPlayCount = 0;
let animationPauseCount = 0;
let animationStopCount = 0;
let shadowEvidence = {
  refreshCount: 10,
  depth: {
    static: { refreshCount: 2 },
    dynamic: { refreshCount: 4 },
    compositeRefreshCount: 6,
  },
  culling: {
    coverageRevision: 3,
    rebuildCount: 5,
  },
};

const sceneBuilder = {
  sceneNodeRuntimes: new Map([
    [editorStatic.id, editorStatic],
    [editorDynamic.id, editorDynamic],
    [editorSkinned.id, editorSkinned],
  ]),
  getSceneNodeAnimationGroups(entityId) {
    return entityId === editorSkinned.id ? [skinnedAnimation] : [];
  },
  registerRuntimeShadowObjects(input) {
    runtimeRegistrationCallCount += 1;
    registeredRuntimeObjects = [...input.objects];
    const ownedSourceKeys = [];
    for (const object of registeredRuntimeObjects) {
      for (const activity of object.activities ?? []) {
        const key = `${object.entityId}\0${activity.sourceId}`;
        ownedSourceKeys.push(key);
        const source = this.registerShadowCasterActivitySource({
          entityId: object.entityId,
          kind: activity.kind,
          sourceId: activity.sourceId,
        });
        source.setActive(activity.initiallyActive === true);
      }
    }
    return {
      entityIds: registeredRuntimeObjects.map(object => object.entityId),
      renderableIds: registeredRuntimeObjects.flatMap(object => object.renderables.map(renderable => renderable.renderableId)),
      getBehaviorProfileId(entityId) {
        return registeredRuntimeObjects.find(object => object.entityId === entityId)?.behaviorProfileId ?? null;
      },
      getActivityController(entityId, sourceId) {
        return sources.get(`${entityId}\0${sourceId}`) ?? null;
      },
      dispose() {
        registrationDisposeCount += 1;
        for (const key of ownedSourceKeys) sources.get(key)?.dispose();
      },
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
  getShadowMapExperimentEvidence: () => shadowEvidence,
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
assert.equal(registeredRuntimeObjects.filter(object => object.behaviorProfileId === 'dynamic-caster').length, 2);
assert.equal(registeredRuntimeObjects.some(object => 'updateClass' in object || 'cast' in object || 'receive' in object), false);
assert.equal(registeredRuntimeObjects[0].renderables[0].mesh.position.x, -0.55);

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

const samplePromise = controller.sampleFrames(3);
shadowEvidence = {
  refreshCount: 13,
  depth: {
    static: { refreshCount: 2 },
    dynamic: { refreshCount: 7 },
    compositeRefreshCount: 9,
  },
  culling: {
    coverageRevision: 4,
    rebuildCount: 6,
  },
};
scene.onAfterRenderObservable.notifyObservers(scene);
scene.onAfterRenderObservable.notifyObservers(scene);
scene.onAfterRenderObservable.notifyObservers(scene);
const sample = await samplePromise;
assert.equal(sample.refreshDelta, 3);
assert.deepEqual(sample.layerRefreshDelta, { static: 0, dynamic: 3, composite: 3 });
assert.equal(sample.coverageRevisionDelta, 1);
assert.equal(sample.cullingRebuildDelta, 1);

const cleared = controller.clearCodeGenerated();
assert.equal(cleared.codeStaticCount, 0);
assert.equal(cleared.codeDynamicCount, 0);
assert.equal(registrationDisposeCount, 1);

controller.configureCodeGenerated({ staticCount: 1, dynamicCount: 1, offsetX: 200, offsetZ: -100 });
assert.equal(registeredRuntimeObjects[0].renderables[0].mesh.position.x, 199.725);
assert.equal(registeredRuntimeObjects[0].renderables[0].mesh.position.z, -100);
controller.clearCodeGenerated();
assert.equal(registrationDisposeCount, 2);

const mixed = controller.configureMixed({
  primitiveStatic: 1,
  primitiveDynamic: 1,
  instanceStatic: 1,
  instanceDynamic: 1,
  morph: 1,
  physics: 1,
});
assert.equal(mixed.codeStaticCount, 2);
assert.equal(mixed.codeDynamicCount, 4);
assert.equal(registeredRuntimeObjects.length, 6);
assert.equal(registeredRuntimeObjects.filter(object => object.behaviorProfileId === 'static-caster').length, 2);
assert.equal(registeredRuntimeObjects.filter(object => object.behaviorProfileId === 'skinned-dynamic').length, 1);
assert.deepEqual(
  registeredRuntimeObjects.flatMap(object => object.activities?.map(activity => activity.kind) ?? []).sort(),
  ['morph', 'physics', 'transform', 'transform'],
);
controller.startDynamic();
scene.onBeforeRenderObservable.notifyObservers(scene);
controller.stopDynamic();
controller.clearCodeGenerated();
assert.equal(registrationDisposeCount, 3);
assert.equal(controller.getSnapshot().codeStaticCount, 0);
assert.equal(controller.getSnapshot().codeDynamicCount, 0);

const disabledBaselineMeshCount = scene.meshes.length;
const disabledBaselineRegistrationCalls = runtimeRegistrationCallCount;
const disabledMixed = controller.configureMixed({
  primitiveStatic: 1,
  primitiveDynamic: 1,
  instanceStatic: 1,
  instanceDynamic: 1,
  morph: 1,
  physics: 1,
  registerShadows: false,
});
assert.equal(disabledMixed.codeStaticCount, 2);
assert.equal(disabledMixed.codeDynamicCount, 4);
assert.equal(runtimeRegistrationCallCount, disabledBaselineRegistrationCalls);
controller.startDynamic();
scene.onBeforeRenderObservable.notifyObservers(scene);
const disabledSamplePromise = controller.sampleFrames(2);
scene.onAfterRenderObservable.notifyObservers(scene);
scene.onAfterRenderObservable.notifyObservers(scene);
const disabledSample = await disabledSamplePromise;
assert.deepEqual(disabledSample.layerRefreshDelta, { static: 0, dynamic: 0, composite: 0 });
assert.deepEqual(disabledSample.layerRenderDelta, { static: 0, dynamic: 0, composite: 0 });
controller.stopDynamic();
controller.clearCodeGenerated();
assert.equal(scene.meshes.length, disabledBaselineMeshCount);
assert.equal(runtimeRegistrationCallCount, disabledBaselineRegistrationCalls);

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
