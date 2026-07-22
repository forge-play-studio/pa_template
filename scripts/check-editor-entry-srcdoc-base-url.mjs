#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPaTemplateEditorHostEnvironment } from '../src/services/fps-game-editor/editor-host-environment.ts';

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
assert.match(
  editorEntrySource,
  /\bshowEntryButton:\s*!hostEnvironment\.hostedSandbox\b/,
  'The manual editor entry button must be hidden in hosted modes.',
);

assert.deepEqual(
  readPaTemplateEditorHostEnvironment({ location: { href: 'https://local.example/' } }),
  { bootMode: null, hostedSandbox: false },
);
const localTopLevel = { location: { href: 'https://local.example/' } };
localTopLevel.parent = localTopLevel;
assert.deepEqual(
  readPaTemplateEditorHostEnvironment(localTopLevel),
  { bootMode: null, hostedSandbox: false },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({
    location: { href: 'https://local.example/' },
    __FPS_EDITOR_HOSTED_SANDBOX__: true,
  }),
  { bootMode: null, hostedSandbox: true },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({ location: { href: 'https://local.example/' }, __BOOT_MODE: 'play' }),
  { bootMode: 'play', hostedSandbox: true },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({
    location: { href: 'https://project-vite.example/' },
    parent: {},
  }),
  { bootMode: null, hostedSandbox: true },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({ location: { href: 'about:srcdoc' } }),
  { bootMode: null, hostedSandbox: true },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({ location: { href: 'about:srcdoc#editor' }, __BOOT_MODE: 'edit' }),
  { bootMode: 'edit', hostedSandbox: true },
);

const manifestPath = '/__fps_editor/entry-manifest.json';
assert.throws(() => new URL(manifestPath, 'about:srcdoc'), TypeError);
assert.equal(
  new URL(manifestPath, 'https://project-vite.example/src/services/fps-game-editor/editor-entry.ts').href,
  'https://project-vite.example/__fps_editor/entry-manifest.json',
);

console.log('editor entry srcdoc base URL check passed');
