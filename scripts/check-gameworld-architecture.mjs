#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const projectRoot = process.cwd();
const srcRoot = resolve(projectRoot, 'src');
const failures = [];

const sourceFiles = [...walkFiles(srcRoot)]
  .filter(file => /\.(?:ts|tsx|mts|cts)$/.test(file));

assertSingleOwner(/\brunRenderLoop\s*\(/g, 'runtime/frame/FramePump.ts', 'Engine.runRenderLoop');
assertSingleOwner(/\bscene\.render\s*\(/g, 'runtime/frame/RenderCoordinator.ts', 'Scene.render');
assertSingleOwner(/\bawait\s+attachProjectRenderer\s*\(/g, 'runtime/GameWorld.ts', 'Renderer attach');
for (const ownerFactory of [
  'createPlayableBabylonRuntimeRenderingControllers',
  'createBabylonDefaultPostProcessPipelineController',
  'createBabylonEnvironmentTextureController',
]) {
  assertNoOwner(
    new RegExp(`\\b${ownerFactory}\\b`, 'g'),
    `Runtime rendering owner factory ${ownerFactory} must be owned by the generated Renderer entry`,
  );
}

if (existsSync(resolve(projectRoot, 'src/services/RenderingService.ts'))) {
  failures.push('legacy src/services/RenderingService.ts must not be restored');
}

for (const file of sourceFiles) {
  const sourcePath = normalize(relative(srcRoot, file));
  const content = readFileSync(file, 'utf8');
  if (!content.includes('@fps-games/editor')) continue;
  if (
    sourcePath.startsWith('runtime/integrations/fps-runtime/')
    || sourcePath.startsWith('services/fps-game-editor/')
    || sourcePath.startsWith('debug/')
  ) {
    continue;
  }
  failures.push(`${sourcePath} imports @fps-games/editor outside an approved adapter/tooling boundary`);
}

const gameWorld = read('src/runtime/GameWorld.ts');
for (const forbidden of [
  "from '../debug/",
  "from '../dev/",
  "from '../services/fps-game-editor/",
  'import.meta.env',
  'configValidator',
  '__restartProjectGame',
  'window.game',
]) {
  if (gameWorld.includes(forbidden)) failures.push(`src/runtime/GameWorld.ts contains forbidden host concern: ${forbidden}`);
}

assertOrder(gameWorld, 'await startProjectRuntimePlugins()', 'new Engine(', 'runtime plugins before Engine creation');
assertOrder(gameWorld, 'await this.initRuntimeServices(scene)', "this.stateValue = 'ready'", 'services before ready state');
assertOrder(
  gameWorld.slice(gameWorld.indexOf('async destroy(): Promise<void>')),
  'this.framePump?.stop()',
  'await this.resources.dispose()',
  'frame stop before resource cleanup',
);

const application = read('src/entry/GameApplication.ts');
assertOrder(application, 'await world.init()', 'world.start()', 'GameWorld init before start');
for (const forbidden of ['../debug/', '../dev/', 'services/fps-game-editor', '__restartProjectGame', 'window.game']) {
  if (application.includes(forbidden)) failures.push(`src/entry/GameApplication.ts contains dev/editor concern: ${forbidden}`);
}

const main = read('src/main.ts');
if (!main.includes("import 'virtual:pa-app-entry'")) {
  failures.push('src/main.ts must delegate entry selection to virtual:pa-app-entry');
}
const viteFactory = read('vite-plugins/projectViteConfig.ts');
if (!viteFactory.includes("command === 'build' ? 'src/entry/game-entry.ts' : 'src/dev/dev-entry.ts'")) {
  failures.push('Vite must resolve virtual:pa-app-entry from its build/serve command');
}
if (existsSync(resolve(projectRoot, 'src/project-runtime-entry.ts'))) {
  failures.push('legacy src/project-runtime-entry.ts must not be restored');
}

const packageJson = JSON.parse(read('package.json'));
if (packageJson.dependencies?.['@fps-games/editor'] !== '0.2.0-beta.4') {
  failures.push('@fps-games/editor must stay pinned to 0.2.0-beta.4');
}

if (failures.length > 0) {
  console.error('[check-gameworld-architecture] Architecture boundary violations:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[check-gameworld-architecture] OK');

function assertSingleOwner(pattern, expectedOwner, label) {
  const matches = [];
  for (const file of sourceFiles) {
    const content = readFileSync(file, 'utf8');
    const count = [...content.matchAll(pattern)].length;
    if (count > 0) matches.push({ file: normalize(relative(srcRoot, file)), count });
  }
  if (matches.length !== 1 || matches[0].file !== expectedOwner || matches[0].count !== 1) {
    failures.push(`${label} must have exactly one callsite in src/${expectedOwner}; found ${JSON.stringify(matches)}`);
  }
}

function assertNoOwner(pattern, label) {
  const matches = [];
  for (const file of sourceFiles) {
    const content = readFileSync(file, 'utf8');
    const count = [...content.matchAll(pattern)].length;
    if (count > 0) matches.push({ file: normalize(relative(srcRoot, file)), count });
  }
  if (matches.length > 0) failures.push(`${label}; found ${JSON.stringify(matches)}`);
}

function assertOrder(content, first, second, label) {
  const firstIndex = content.indexOf(first);
  const secondIndex = content.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    failures.push(`invalid lifecycle order (${label})`);
  }
}

function read(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

function* walkFiles(root) {
  for (const entry of readdirSync(root)) {
    const file = join(root, entry);
    const stat = statSync(file);
    if (stat.isDirectory()) yield* walkFiles(file);
    else if (stat.isFile()) yield file;
  }
}

function normalize(path) {
  return path.split('\\').join('/');
}
