import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { createShadowMapStressController } from '../src/debug/shadow-map-stress-harness.ts';

const engine = new NullEngine();
const scene = new Scene(engine);
const editorStatic = new TransformNode('shadow_stress_editor_static_0000', scene);
const editorDynamic = new TransformNode('shadow_stress_editor_dynamic_0000', scene);
const sources = new Map();
let registrationDisposeCount = 0;
let registeredRuntimeObjects = [];

const sceneBuilder = {
  sceneNodeRuntimes: new Map([
    [editorStatic.id, editorStatic],
    [editorDynamic.id, editorDynamic],
  ]),
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
const game = {
  getScene: () => scene,
  getSceneBuilder: () => sceneBuilder,
  getShadowMapExperimentEvidence: () => ({ refreshCount: 0 }),
};

const controller = createShadowMapStressController(game);
const configured = controller.configureCodeGenerated({ staticCount: 3, dynamicCount: 2 });
assert.equal(configured.editorStaticCount, 1);
assert.equal(configured.editorDynamicCount, 1);
assert.equal(configured.codeStaticCount, 3);
assert.equal(configured.codeDynamicCount, 2);
assert.equal(registeredRuntimeObjects.length, 5);
assert.equal(registeredRuntimeObjects.filter(object => object.updateClass === 'dynamic').length, 2);

controller.startDynamic();
for (const [key, source] of sources) {
  if (key.includes('dynamic') || key.includes('editor')) assert.equal(source.active, true);
}
scene.onBeforeRenderObservable.notifyObservers(scene);
controller.stopDynamic();
for (const source of sources.values()) assert.equal(source.active, false);

const cleared = controller.clearCodeGenerated();
assert.equal(cleared.codeStaticCount, 0);
assert.equal(cleared.codeDynamicCount, 0);
assert.equal(registrationDisposeCount, 1);

controller.refreshEditorGenerated();
controller.dispose();
controller.dispose();
scene.dispose();
engine.dispose();
console.log('shadow-map stress runtime harness: ok');
