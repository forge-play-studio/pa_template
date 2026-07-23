import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'tests/inline-environment-texture/fixtures/photoStudio.env');
const output = path.join(root, 'dist-tests/inline-environment-texture/index.html');

assert.ok(existsSync(fixture), 'Issue #565 fixture is missing. Restore the pinned BabylonJS photoStudio.env file.');
execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'vite', 'build', '--config', 'tests/inline-environment-texture/vite.config.ts',
], { cwd: root, stdio: 'inherit' });

const html = readFileSync(output, 'utf8');
assert.match(html, /data:application\/octet-stream;base64,/, 'Single-file fixture must inline the .env as a Data URL.');
assert.match(html, /forcedExtension/, 'Fixture must pass the resource format to Babylon.');
assert.match(html, /\.env/, 'Fixture must retain the .env format contract.');

const normalBundle = path.join(root, 'dist/index.html');
if (existsSync(normalBundle)) {
  const normalHtml = readFileSync(normalBundle, 'utf8');
  assert.doesNotMatch(normalHtml, /Inline environment texture smoke/, 'Normal bundle must not include the isolated smoke page.');
  assert.doesNotMatch(normalHtml, /photoStudio\.env/, 'Normal bundle must not include the isolated environment fixture.');
}

console.log('Inline environment texture single-file fixture built successfully.');
console.log('Use Playwright against the served output and assert the bounded #inline-environment-texture-evidence JSON has status=ready.');
