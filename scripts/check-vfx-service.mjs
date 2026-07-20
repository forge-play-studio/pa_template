#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { VfxService } from '../src/services/vfx/VfxService.ts';

await assertTemplateBoundary();
await assertEmptyTemplateInitializes();
await assertPoolLifecycle();
await assertGlobalRuntimeLimit();
await assertBudgetConflictBlocksLoading();
await assertPrepareFailureDisposesSharedResources();
await assertDisposeCancelsPreload();
await assertDisposeCancelsWarmup();

console.log('VFX service lifecycle, pool, budget, and template-boundary checks passed');

async function assertEmptyTemplateInitializes() {
  const service = new VfxService({
    scene: {},
    budget: createBudget({ status: 'unconfirmed', globalActiveLimit: 0, expectedGlobalPeak: 0 }),
  });
  await service.init();
  assert.equal(service.isReady(), true);
  assert.deepEqual(service.getRegisteredEffects(), []);
  service.dispose();
}

async function assertPoolLifecycle() {
  const counters = {
    prepare: 0,
    create: 0,
    warmup: 0,
    play: 0,
    recycle: 0,
    destroy: 0,
    dispose: 0,
    render: 0,
  };
  const instances = [];
  const definition = {
    id: 'mock-burst',
    prepare() { counters.prepare += 1; },
    createInstance({ instanceIndex }) {
      counters.create += 1;
      const instance = { instanceIndex, complete: null, active: false };
      instances.push(instance);
      return instance;
    },
    warmup(instance) {
      counters.warmup += 1;
      instance.active = true;
    },
    play(instance, request, lifecycle) {
      counters.play += 1;
      assert.equal(instance.active, false, 'play must receive a recycled idle instance');
      instance.active = true;
      instance.owner = request.owner;
      instance.complete = lifecycle.complete;
    },
    recycle(instance) {
      counters.recycle += 1;
      instance.active = false;
      instance.owner = undefined;
      instance.complete = null;
    },
    destroy(instance) {
      counters.destroy += 1;
      instance.active = false;
    },
    dispose() { counters.dispose += 1; },
  };
  const service = new VfxService({
    scene: {},
    budget: createBudget({ globalActiveLimit: 3, expectedGlobalPeak: 2 }),
    renderWarmupFrame: async () => { counters.render += 1; },
  });
  service.register({
    definition,
    config: createRuntimeConfig({ effectId: definition.id, poolSize: 2, expectedPeak: 2 }),
    defaultParams: { color: 'orange' },
  });
  await service.init();

  assert.deepEqual(counters, {
    prepare: 1,
    create: 2,
    warmup: 2,
    play: 0,
    recycle: 2,
    destroy: 0,
    dispose: 0,
    render: 4,
  });
  assert.throws(() => service.register({
    definition,
    config: createRuntimeConfig({ effectId: definition.id }),
  }), /registrations are frozen/);

  const first = service.play(definition.id, { owner: 'owner-a' });
  const second = service.play(definition.id, { owner: 'owner-a' });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(service.getDiagnostics().budget.active, 2);
  const overflow = service.play(definition.id, { owner: 'owner-b' });
  assert.deepEqual(overflow.ok && null, false);
  if (!overflow.ok) assert.equal(overflow.code, 'pool-exhausted');
  assert.equal(counters.create, 2, 'runtime exhaustion must not create another instance');

  assert(first.ok);
  assert.equal(first.handle.release(), true);
  assert.equal(first.handle.release(), false, 'release must be idempotent');
  const third = service.play(definition.id, { owner: 'owner-b' });
  assert.equal(third.ok, true);
  assert.equal(counters.create, 2, 'reacquire must reuse a pooled instance');

  const completedInstance = instances.find(instance => instance.owner === 'owner-b' && typeof instance.complete === 'function');
  assert(completedInstance);
  completedInstance.complete();
  assert.equal(service.getDiagnostics().budget.active, 1);
  assert.equal(service.releaseByOwner('owner-a'), 1);
  assert.equal(service.releaseByOwner('owner-a'), 0);
  assert.equal(service.getDiagnostics().budget.active, 0);

  const effectDiagnostics = service.getDiagnostics().effects[0];
  assert.equal(effectDiagnostics.created, 2);
  assert.equal(effectDiagnostics.peakActive, 2);
  assert.equal(effectDiagnostics.available, 2);
  assert.equal(effectDiagnostics.completed, 1);
  assert(effectDiagnostics.recycled >= 5);

  service.dispose();
  assert.equal(counters.destroy, 2);
  assert.equal(counters.dispose, 1);
}

async function assertGlobalRuntimeLimit() {
  const service = new VfxService({
    scene: {},
    budget: createBudget({ globalActiveLimit: 2, expectedGlobalPeak: 2 }),
  });
  for (const effectId of ['global-a', 'global-b']) {
    service.register({
      definition: createNoopDefinition(effectId),
      config: createRuntimeConfig({ effectId, poolSize: 2, expectedPeak: 1 }),
    });
  }
  await service.init();
  assert.equal(service.play('global-a', { owner: 'global-owner' }).ok, true);
  assert.equal(service.play('global-b', { owner: 'global-owner' }).ok, true);
  const overflow = service.play('global-a', { owner: 'global-owner' });
  assert.equal(overflow.ok, false);
  if (!overflow.ok) assert.equal(overflow.code, 'global-budget-exhausted');
  assert.equal(service.releaseByOwner('global-owner'), 2);
  service.dispose();
}

async function assertBudgetConflictBlocksLoading() {
  const service = new VfxService({
    scene: {},
    budget: createBudget({ globalActiveLimit: 1, expectedGlobalPeak: 2 }),
  });
  const definition = createNoopDefinition('budget-conflict');
  service.register({
    definition,
    config: createRuntimeConfig({ effectId: definition.id }),
  });
  await assert.rejects(service.init(), /VFX Global Budget Conflict/);
  assert.equal(service.getState(), 'failed');
  assert.match(service.getDiagnostics().budget.conflict ?? '', /expected peak 2/);
  service.dispose();
}

async function assertPrepareFailureDisposesSharedResources() {
  const disposed = [];
  const service = new VfxService({
    scene: {},
    budget: createBudget({ globalActiveLimit: 2, expectedGlobalPeak: 2 }),
  });
  for (const effectId of ['prepared-before-failure', 'partial-prepare-failure']) {
    const definition = createNoopDefinition(effectId);
    definition.dispose = () => { disposed.push(effectId); };
    if (effectId === 'partial-prepare-failure') {
      definition.prepare = () => { throw new Error('prepare failed'); };
    }
    service.register({
      definition,
      config: createRuntimeConfig({ effectId }),
    });
  }
  await assert.rejects(service.init(), /prepare failed/);
  assert.deepEqual(disposed, ['partial-prepare-failure', 'prepared-before-failure']);
  service.dispose();
}

async function assertDisposeCancelsPreload() {
  let finishPrepare;
  let disposed = 0;
  const service = new VfxService({
    scene: {},
    budget: createBudget(),
  });
  const definition = createNoopDefinition('cancelled-preload');
  definition.prepare = () => new Promise(resolve => { finishPrepare = resolve; });
  definition.dispose = () => { disposed += 1; };
  service.register({
    definition,
    config: createRuntimeConfig({ effectId: definition.id }),
  });
  const initialization = service.init();
  service.dispose();
  finishPrepare();
  await assert.rejects(initialization, /cancelled/);
  assert.equal(service.getState(), 'disposed');
  assert.equal(disposed, 1);
}

async function assertDisposeCancelsWarmup() {
  let finishWarmup;
  let announceWarmup;
  let destroyed = 0;
  let disposed = 0;
  const warmupStarted = new Promise(resolve => { announceWarmup = resolve; });
  const service = new VfxService({
    scene: {},
    budget: createBudget(),
  });
  const definition = createNoopDefinition('cancelled-warmup');
  definition.warmup = () => {
    announceWarmup();
    return new Promise(resolve => { finishWarmup = resolve; });
  };
  definition.destroy = () => { destroyed += 1; };
  definition.dispose = () => { disposed += 1; };
  service.register({
    definition,
    config: createRuntimeConfig({ effectId: definition.id }),
  });
  const initialization = service.init();
  await warmupStarted;
  service.dispose();
  finishWarmup();
  await assert.rejects(initialization, /disposed/);
  assert.equal(service.getState(), 'disposed');
  assert.equal(destroyed, 1);
  assert.equal(disposed, 1);
}

async function assertTemplateBoundary() {
  const forbidden = [
    'SceneVfxService',
    'EffectPackageService',
    'getEffectPackageService',
    'warmupRegisteredEffectPackages',
    'gameplay.tuning.sceneVfx',
  ];
  const files = await listFiles('src');
  for (const file of files.filter(file => /\.(ts|json|md)$/.test(file))) {
    const text = await fs.readFile(file, 'utf8');
    for (const marker of forbidden) {
      assert.equal(text.includes(marker), false, `${file} restores retired VFX marker ${marker}`);
    }
    if (!file.startsWith('src/assets/vfx/effects/')) {
      assert.doesNotMatch(text, /new\s+(?:GPU)?ParticleSystem\s*\(/, `${file} creates a particle system outside a project effect definition`);
    }
    if (text.includes("from '@fps-games/vfx") || text.includes('from "@fps-games/vfx')) {
      assert(file.startsWith('src/assets/vfx/effects/'), `${file} imports the VFX asset package outside a project effect adapter`);
    }
  }
  const gameWorld = await fs.readFile('src/runtime/GameWorld.ts', 'utf8');
  assert.match(gameWorld, /await vfxService\.init\(\)/);
  assert.match(gameWorld, /await this\.initGameplayModules\(\)/);
  assert(gameWorld.indexOf('await vfxService.init()') < gameWorld.indexOf('await this.initGameplayModules()'));
  assert.match(gameWorld, /renderWarmupFrame:\s*\(\)\s*=>\s*this\.renderCoordinator!\.renderOnce\(\)/);
  const service = await fs.readFile('src/services/vfx/VfxService.ts', 'utf8');
  assert.doesNotMatch(service, /from ['"]@fps-games\/vfx/);
  assert.match(service, /registryFrozen = true/);
  const pool = await fs.readFile('src/services/vfx/VfxEffectPool.ts', 'utf8');
  assert.doesNotMatch(pool, /entries\.find\(/, 'runtime acquire must use the event-maintained idle stack');
  const manager = await fs.readFile('src/services/vfx/VfxPoolManager.ts', 'utf8');
  assert.match(manager, /return this\.activeCount/, 'global active count must be event-maintained');
}

function createBudget(overrides = {}) {
  return {
    schemaVersion: 'project-vfx-budget/1.0',
    status: 'confirmed',
    globalActiveLimit: 1,
    expectedGlobalPeak: 1,
    ...overrides,
  };
}

function createRuntimeConfig(overrides = {}) {
  return {
    schemaVersion: 'project-vfx-runtime/1.0',
    effectId: 'mock-effect',
    poolSize: 1,
    expectedPeak: 1,
    lifecycle: 'mixed',
    ...overrides,
  };
}

function createNoopDefinition(id) {
  return {
    id,
    prepare() {},
    createInstance() { return {}; },
    warmup() {},
    play() {},
    recycle() {},
    destroy() {},
    dispose() {},
  };
}

async function listFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = `${root}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await listFiles(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}
