#!/usr/bin/env node

import assert from 'node:assert/strict';
import path from 'node:path';
import { loadConfigFromFile } from 'vite';
import { PLAYABLE_EDITOR_BUNDLED_ALIAS_PACKAGE_IDS } from '@fps-games/editor/playable-sdk';

const projectRoot = process.cwd();
const previousRepo = process.env.FPS_GAME_EDITOR_REPO;
process.env.FPS_GAME_EDITOR_REPO = '/tmp/poisoned-fps-game-editor-source-checkout';

try {
  const loaded = await loadConfigFromFile(
    { command: 'serve', mode: 'development' },
    path.join(projectRoot, 'vite.config.ts'),
    projectRoot,
  );
  assert(loaded, 'Vite must load the pa_template config');
  const plugins = (loaded.config.plugins ?? []).flat(Infinity).filter(Boolean);
  const editorPlugin = plugins.find(plugin => plugin.name === 'fps-editor-playable-vite');
  assert(editorPlugin, 'Vite config must install fps-editor-playable-vite');
  const editorPluginConfig = await editorPlugin.config?.({}, { command: 'serve', mode: 'development' });
  const aliases = Array.isArray(editorPluginConfig?.resolve?.alias) ? editorPluginConfig.resolve.alias : [];
  const editorAliases = PLAYABLE_EDITOR_BUNDLED_ALIAS_PACKAGE_IDS.map(packageId => {
    const entry = aliases.find(candidate => candidate?.find instanceof RegExp && candidate.find.test(packageId));
    assert(entry, `Vite config must alias ${packageId}`);
    return entry;
  });
  for (const entry of editorAliases) {
    assert.match(entry.replacement, /node_modules\/@fps-games\/editor(?:\/|$)/, `alias must resolve through packed @fps-games/editor: ${entry.replacement}`);
    assert.doesNotMatch(entry.replacement, /fps-game-editor[^/]*\/packages\//, `alias must ignore FPS_GAME_EDITOR_REPO: ${entry.replacement}`);
  }
  console.log(`editor packed Vite resolution check passed (${editorAliases.length} aliases)`);
} finally {
  if (previousRepo === undefined) delete process.env.FPS_GAME_EDITOR_REPO;
  else process.env.FPS_GAME_EDITOR_REPO = previousRepo;
}
