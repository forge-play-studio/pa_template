#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const editorEntrySource = readFileSync(
  new URL('../src/services/fps-game-editor/editor-entry.ts', import.meta.url),
  'utf8',
);

assert.match(
  editorEntrySource,
  /\bbaseUrl:\s*import\.meta\.url\b/,
  'Editor entry routes must use the Vite-served module URL as their base.',
);
assert.doesNotMatch(
  editorEntrySource,
  /\bbaseUrl:\s*window\.location\.href\b/,
  'about:srcdoc cannot be used as the editor entry route base.',
);

const manifestPath = '/__fps_editor/entry-manifest.json';
assert.throws(() => new URL(manifestPath, 'about:srcdoc'), TypeError);
assert.equal(
  new URL(manifestPath, 'https://project-vite.example/src/services/fps-game-editor/editor-entry.ts').href,
  'https://project-vite.example/__fps_editor/entry-manifest.json',
);

console.log('editor entry srcdoc base URL check passed');
