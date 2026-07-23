#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
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
assert.match(
  editorEntrySource,
  /\binitialMode:\s*hostEnvironment\.bootMode\s*===\s*['"]edit['"]\s*\?\s*['"]edit['"]\s*:\s*['"]play['"]/,
  'Hosted edit boot must map to the public Editor Entry initialMode intent.',
);
assert.match(
  editorEntrySource,
  /\binitialModeIntent:\s*hostEnvironment\.initialModeIntent\b/,
  'Hosted reload intent must be forwarded to the public Editor Entry gate.',
);
assert.equal(
  hasMountOwnedEditorTransition(editorEntrySource),
  false,
  'Project editor module mounting must not enter the editor; SDK backend.commit owns that transition.',
);
assert.equal(
  hasMountOwnedEditorTransition(`mountFpsGameEditorLocalEditorEntry({ editorModule: { mount: async module => { const editorSwitcher = await module.mountLocalEditorModeSwitcher(); await editorSwitcher.enterEditor(); } } });`),
  true,
  'The scoped Editor Entry gate must reject renamed switcher receivers.',
);
assert.equal(
  hasMountOwnedEditorTransition(`const host = mountFpsGameEditorLocalEditorEntry({ editorModule: { mount: module => module.mountLocalEditorModeSwitcher() } }); await host.enterEditor();`),
  false,
  'The scoped Editor Entry gate must allow public host transitions outside mount.',
);

assert.deepEqual(
  readPaTemplateEditorHostEnvironment({ location: { href: 'https://local.example/' } }),
  { bootMode: null, initialModeIntent: 'fresh', hostedSandbox: false },
);
const localTopLevel = { location: { href: 'https://local.example/' } };
localTopLevel.parent = localTopLevel;
assert.deepEqual(
  readPaTemplateEditorHostEnvironment(localTopLevel),
  { bootMode: null, initialModeIntent: 'fresh', hostedSandbox: false },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({
    location: { href: 'https://local.example/' },
    __FPS_EDITOR_HOSTED_SANDBOX__: true,
  }),
  { bootMode: null, initialModeIntent: 'fresh', hostedSandbox: true },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({ location: { href: 'https://local.example/' }, __BOOT_MODE: 'play' }),
  { bootMode: 'play', initialModeIntent: 'fresh', hostedSandbox: true },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({
    location: { href: 'https://project-vite.example/' },
    parent: {},
  }),
  { bootMode: null, initialModeIntent: 'fresh', hostedSandbox: true },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({ location: { href: 'about:srcdoc' } }),
  { bootMode: null, initialModeIntent: 'fresh', hostedSandbox: true },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({ location: { href: 'about:srcdoc#editor' }, __BOOT_MODE: 'edit' }),
  { bootMode: 'edit', initialModeIntent: 'fresh', hostedSandbox: true },
);
assert.deepEqual(
  readPaTemplateEditorHostEnvironment({
    location: { href: 'about:srcdoc#editor' },
    __BOOT_MODE: 'edit',
    performance: { getEntriesByType: () => [{ type: 'reload' }] },
  }),
  { bootMode: 'edit', initialModeIntent: 'retained', hostedSandbox: true },
);

const manifestPath = '/__fps_editor/entry-manifest.json';
assert.throws(() => new URL(manifestPath, 'about:srcdoc'), TypeError);
assert.equal(
  new URL(manifestPath, 'https://project-vite.example/src/services/fps-game-editor/editor-entry.ts').href,
  'https://project-vite.example/__fps_editor/entry-manifest.json',
);

console.log('editor entry srcdoc base URL check passed');

// This is a source-local companion regression gate, not the public Upgrade
// Doctor: pa_template validates against its installed package and cannot import
// the repository's unpublished TypeScript analyzer without a package build.
function hasMountOwnedEditorTransition(source) {
  let root;
  try {
    root = parse(source, { sourceType: 'unambiguous', plugins: ['typescript', 'importAttributes'] });
  } catch {
    return false;
  }
  let found = false;
  walk(root, node => {
    if (found || node.type !== 'CallExpression' || node.callee?.type !== 'Identifier' || node.callee.name !== 'mountFpsGameEditorLocalEditorEntry') return;
    const options = node.arguments?.[0];
    const editorModule = objectProperty(options, 'editorModule');
    const mount = objectProperty(editorModule, 'mount');
    if (!mount) return;
    walk(mount, candidate => {
      if (candidate.type !== 'CallExpression' && candidate.type !== 'OptionalCallExpression') return;
      const callee = candidate.callee;
      if ((callee?.type === 'MemberExpression' || callee?.type === 'OptionalMemberExpression')
        && callee.object?.type === 'Identifier'
        && memberName(callee) === 'enterEditor') found = true;
    });
  });
  return found;
}

function objectProperty(object, name) {
  if (object?.type !== 'ObjectExpression') return null;
  let value = null;
  for (const property of object.properties) {
    if (property.type !== 'ObjectProperty' && property.type !== 'ObjectMethod') continue;
    if (memberName(property) !== name) continue;
    value = property.type === 'ObjectMethod' ? property : property.value;
  }
  return value;
}

function memberName(member) {
  if (member.computed) return member.property?.type === 'StringLiteral' ? member.property.value : null;
  return member.property?.type === 'Identifier' ? member.property.name : member.key?.type === 'Identifier' ? member.key.name : member.key?.value;
}

function walk(value, visit) {
  if (Array.isArray(value)) { for (const entry of value) walk(entry, visit); return; }
  if (!value || typeof value !== 'object' || typeof value.type !== 'string') return;
  visit(value);
  for (const [key, child] of Object.entries(value)) {
    if (!['loc', 'start', 'end', 'extra', 'comments', 'tokens'].includes(key)) walk(child, visit);
  }
}
