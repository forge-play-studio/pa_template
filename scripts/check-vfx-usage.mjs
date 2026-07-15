#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliPath = fileURLToPath(new URL('./manage-vfx-usage.mjs', import.meta.url));
const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'fps-vfx-usage-'));

try {
  await seedFixture();
  assertSuccess(run(['validate']), /static active 0\/3/);
  await writeJson('src/assets/vfx/budget.json', createBudget());

  const emptyBeforeDryRun = await readUsages();
  assertSuccess(run([
    'add', '--effect', 'persistent-a', '--socket', 'socket-a', '--id', 'persistent-follow-a', '--lifecycle', 'follow', '--dry-run',
  ]), /Would write usage "persistent-follow-a"/);
  assert.deepEqual(await readUsages(), emptyBeforeDryRun, 'dry-run must not mutate usages.json');

  assertSuccess(run([
    'add', '--effect', 'persistent-a', '--socket', 'socket-a', '--id', 'persistent-follow-a', '--lifecycle', 'follow',
  ]));
  assertSuccess(run([
    'add', '--effect', 'persistent-a', '--socket', 'socket-b', '--id', 'persistent-follow-b', '--lifecycle', 'loop', '--repeat-interval-sec', '1',
  ]));
  assertSuccess(run(['validate']), /static active 2\/3/);

  assertFailure(run([
    'add', '--effect', 'persistent-a', '--socket', 'socket-c', '--id', 'persistent-follow-c', '--lifecycle', 'follow',
  ]), /VFX Usage Capacity Conflict: effect "persistent-a" has 3 static follow\/loop usages but expectedPeak is 2/);
  assertFailure(run([
    'add', '--effect', 'persistent-a', '--socket', 'socket-c', '--id', 'persistent-oneshot', '--lifecycle', 'oneshot',
  ]), /VFX Usage Lifecycle Conflict/);
  assertFailure(run([
    'add', '--effect', 'one-shot-a', '--socket', 'socket-c', '--id', 'one-shot-follow', '--lifecycle', 'follow',
  ]), /VFX Usage Lifecycle Conflict/);

  assertSuccess(run([
    'add', '--effect', 'one-shot-a', '--socket', 'socket-c', '--id', 'one-shot-trigger', '--lifecycle', 'oneshot',
  ]));
  assertSuccess(run([
    'add', '--effect', 'mixed-a', '--node', 'runtime-host', '--id', 'runtime-follow', '--lifecycle', 'follow',
  ]));
  assertSuccess(run(['validate']), /static active 3\/3/);

  assertFailure(run([
    'add', '--effect', 'persistent-b', '--socket', 'socket-c', '--id', 'global-overflow', '--lifecycle', 'follow',
  ]), /static follow\/loop demand 4 exceeds expectedGlobalPeak 3/);
  assertFailure(run([
    'add', '--effect', 'mixed-a', '--node', 'missing-runtime', '--id', 'missing-runtime', '--lifecycle', 'oneshot',
  ]), /no static RuntimeNodeService\.registerRuntimeNode/);
  assertFailure(run([
    'add', '--effect', 'mixed-a', '--node', 'false-positive', '--id', 'false-positive', '--lifecycle', 'oneshot',
  ]), /no static RuntimeNodeService\.registerRuntimeNode/);
  assertSuccess(run([
    'add', '--effect', 'mixed-a', '--node', 'computed-runtime', '--id', 'computed-runtime', '--lifecycle', 'oneshot', '--no-validate-target', '--dry-run',
  ]));
  assertFailure(run([
    'add', '--effect', 'one-shot-a', '--socket', 'missing-socket', '--id', 'missing-socket', '--lifecycle', 'oneshot', '--no-validate-target',
  ]), /Socket node "missing-socket" was not found/);
  assertFailure(run([
    'add', '--effect', 'missing-effect', '--socket', 'socket-a', '--id', 'missing-effect', '--lifecycle', 'oneshot', '--allow-missing-effect',
  ]), /Unknown effect "missing-effect"/);

  await writeJson('src/assets/vfx/budget.json', createBudget({ status: 'unconfirmed' }));
  assertFailure(run(['validate']), /budget\.json must be status "confirmed"/);
  await writeJson('src/assets/vfx/budget.json', createBudget());

  assertSuccess(run(['remove', '--id', 'persistent-follow-b']));
  assertSuccess(run(['validate']), /static active 2\/3/);

  console.log('VFX usage schema, lifecycle, target, dry-run, and capacity checks passed');
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}

async function seedFixture() {
  await writeJson('src/assets/vfx/usages.json', {
    $schema: './usages.schema.json',
    schemaVersion: 'project-vfx-usages/1.0',
    usages: [],
  });
  await writeJson('src/assets/vfx/budget.json', createBudget({ status: 'unconfirmed' }));
  await writeJson('src/config/scene.json', {
    nodes: ['socket-a', 'socket-b', 'socket-c'].map(id => ({ id, marker: { type: 'effect-socket' } })),
  });
  await writeText('src/runtime-nodes.ts', [
    "const unrelatedId = 'false-positive';",
    "runtimeNodes.registerRuntimeNode({ id: 'runtime-host', node: runtimeHost });",
    "runtimeNodes.registerRuntimeNode({ id: 'different-runtime', node: differentRuntime });",
    '',
  ].join('\n'));
  await createEffect('persistent-a', { poolSize: 2, expectedPeak: 2, lifecycle: 'persistent' });
  await createEffect('persistent-b', { poolSize: 1, expectedPeak: 1, lifecycle: 'persistent' });
  await createEffect('one-shot-a', { poolSize: 2, expectedPeak: 2, lifecycle: 'one-shot' });
  await createEffect('mixed-a', { poolSize: 1, expectedPeak: 1, lifecycle: 'mixed' });
}

async function createEffect(effectId, overrides) {
  await writeText(`src/assets/vfx/effects/${effectId}/index.ts`, `export const effectId = '${effectId}';\n`);
  await writeJson(`src/assets/vfx/effects/${effectId}/vfx-runtime.json`, {
    schemaVersion: 'project-vfx-runtime/1.0',
    effectId,
    ...overrides,
  });
}

function createBudget(overrides = {}) {
  return {
    schemaVersion: 'project-vfx-budget/1.0',
    status: 'confirmed',
    globalActiveLimit: 3,
    expectedGlobalPeak: 3,
    ...overrides,
  };
}

function run(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: fixtureRoot,
    env: { ...process.env, VFX_USAGE_PROJECT_ROOT: fixtureRoot },
    encoding: 'utf8',
  });
}

function assertSuccess(result, outputPattern) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  if (outputPattern) assert.match(result.stdout, outputPattern);
}

function assertFailure(result, errorPattern) {
  assert.notEqual(result.status, 0, 'command unexpectedly succeeded');
  assert.match(`${result.stderr}\n${result.stdout}`, errorPattern);
}

async function readUsages() {
  return JSON.parse(await readFile(path.join(fixtureRoot, 'src/assets/vfx/usages.json'), 'utf8'));
}

async function writeJson(relativePath, value) {
  await writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(relativePath, value) {
  const absolutePath = path.join(fixtureRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, value, 'utf8');
}
