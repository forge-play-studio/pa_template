#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = process.cwd();
const bridgeSourcePath = path.join(root, 'vite-plugins/bridge.ts');
const projectViteConfig = await fs.readFile(
  path.join(root, 'vite-plugins/projectViteConfig.ts'),
  'utf8',
);
const bridgeSource = await fs.readFile(bridgeSourcePath, 'utf8');

assert.match(projectViteConfig, /process\.env\.BRIDGE_ENABLED === 'true'/, 'legacy bridge injection must be opt-in for local editor lab runs');
assert.doesNotMatch(projectViteConfig, /process\.env\.BRIDGE_ENABLED !== 'false'/, 'legacy bridge must not be enabled by default');
assert.match(projectViteConfig, /\benabled:\s*bridgeEnabled\b/, 'project Vite config must pass the opt-in flag to bridgePlugin');
assert.match(bridgeSource, /const enabled = opts\.enabled \?\? false/, 'bridgePlugin default enabled value must be false');

const module = await importTranspiledBridgePlugin(bridgeSource);
const disabledPlugin = module.bridgePlugin();
const disabledHtml = disabledPlugin.transformIndexHtml('<html><head></head><body></body></html>');
assert.equal(disabledHtml.includes('/script/bridge.js'), false, 'bridgePlugin must not inject bridge.js by default');

const enabledPlugin = module.bridgePlugin({ enabled: true, port: 8080, delay: 0 });
const enabledHtml = enabledPlugin.transformIndexHtml('<html><head></head><body></body></html>');
assert.match(enabledHtml, /localhost:\$\{port\}\/script\/bridge\.js|localhost:8080\/script\/bridge\.js/, 'bridgePlugin must still support explicit legacy bridge injection');
assert.match(enabledHtml, /optional bridge script not available/, 'bridgePlugin unavailable diagnostic should be explicit and optional');

console.log('bridge plugin optional check passed');

async function importTranspiledBridgePlugin(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-plugin-check-'));
  const modulePath = path.join(tempDir, 'bridge.mjs');
  await fs.writeFile(modulePath, output);
  return import(pathToFileURL(modulePath).href);
}
