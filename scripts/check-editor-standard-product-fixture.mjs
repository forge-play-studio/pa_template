#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fixtureRoot = path.join(root, 'scripts/fixtures/editor-standard-product');
const expectedFiles = ['fps.config.ts', 'main.ts', 'vite.config.ts'];
assert.deepEqual(fs.readdirSync(fixtureRoot).sort(), expectedFiles, 'standard fixture must contain exactly the three product entry files');

const sources = Object.fromEntries(expectedFiles.map(file => [file, fs.readFileSync(path.join(fixtureRoot, file), 'utf8')]));
assert.match(sources['fps.config.ts'], /defineFpsGameEditorProject/);
assert.match(sources['fps.config.ts'], /plugins:\s*Object\.freeze/);
assert.match(sources['vite.config.ts'], /createFpsConfiguredPluginManifestVitePlugin/);
assert.match(sources['vite.config.ts'], /createFpsGameEditorViteAdapter/);
assert.match(sources['main.ts'], /createFpsGameEditorAdapter/);
assert.match(sources['main.ts'], /mountFpsGameEditorStandardProject/);
assert.match(sources['main.ts'], /runtimePluginLifecycle\.start\(\)/);
assert.match(sources['main.ts'], /runtimePluginLifecycle\.dispose\(\)/);

execFileSync(process.execPath, [
  path.join(root, 'node_modules/typescript/bin/tsc'),
  '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022',
  '--module', 'ESNext', '--moduleResolution', 'Bundler', '--lib', 'ES2022,DOM',
  '--types', '@fps-games/editor/vite/client',
  ...expectedFiles.map(file => path.join(fixtureRoot, file)),
], { cwd: root, stdio: 'inherit' });

const sdk = await import('@fps-games/editor/playable-sdk');
for (const name of ['createFpsGameEditorAdapter', 'createFpsGameEditorStandardProjectRuntime', 'mountFpsGameEditorStandardProject', 'createFpsGameEditorPlayableProjectHostAssembly']) {
  assert.equal(typeof sdk[name], 'function', `packed product export missing: ${name}`);
}
console.log('editor standard product fixture check passed');
