#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createPlayableEditorAssetId,
  planPlayableEditorAssetRegistrationCore,
} from '@fps-games/editor/playable-sdk';

const root = process.cwd();

const productHostSource = await fs.readFile(path.join(root, 'src/services/fps-game-editor/local-editor.ts'), 'utf8');

for (const retiredPath of [
  'src/fps-game-editor-adapter/assets',
  'src/services/AssetManager.ts',
  'src/services/SceneAssetPlacement.ts',
  'src/services/SceneAssetUsage.ts',
  'src/services/assets/core/AssetManagerCore.ts',
  'src/services/assets/adapters/BabylonRuntimeAssetAdapter.ts',
]) {
  await assert.rejects(fs.access(path.join(root, retiredPath)), `${retiredPath} must stay deleted`);
}

const sdkRegistrationPlan = planPlayableEditorAssetRegistrationCore(
  { assets: [] },
  {
    guid: '11111111-1111-4111-8111-111111111111',
    kind: 'model',
    assetName: 'demo-tree.glb',
    assetPath: 'assets/models/demo-tree.glb',
    platformAssetId: 'platform-tree-1',
    createPayloadPath: () => '/tmp/check-asset-manager-guid-external.json',
  },
  {
    metadata: { key: 'managedBy', value: 'check' },
    errorCodes: {
      assetIdConflict: 'asset_id_conflict',
      assetStillReferenced: 'asset_still_referenced',
      missingAssetId: 'missing_asset_id',
      nodeNotFound: 'node_not_found',
    },
  },
);
const sdkRegistrationPayload = sdkRegistrationPlan.transportPlan.writes[0]?.content;
assert.equal(sdkRegistrationPlan.assetId, createPlayableEditorAssetId('model', sdkRegistrationPlan.guid), 'SDK registration plan must derive canonical assetId from guid');
assert.ok(sdkRegistrationPayload && typeof sdkRegistrationPayload === 'object', 'SDK registration plan must write a JSON payload');
assert.equal(sdkRegistrationPayload.projectAssetId, sdkRegistrationPlan.assetId, 'registration payload must use projectAssetId');
assert.equal(sdkRegistrationPayload.guid, sdkRegistrationPlan.guid, 'registration payload must carry guid');
assert.equal(sdkRegistrationPayload.platformAssetId, 'platform-tree-1', 'registration payload must carry external.platformAssetId');

assert.match(productHostSource, /\bcreateFpsGameEditorProductProjectHostServices\b/, 'project host must delegate platform asset commands to the SDK product service');
assert.match(productHostSource, /\breadFpsGameEditorPlatformAssetLookup\b/, 'project host must use the package-visible platform asset lookup');
assert.doesNotMatch(productHostSource, /readPlatformAssetSourceId|findRegistered(Model|Texture)(SourceId|AssetId)ForPlatformAsset|sanitizePlatformAssetId/, 'project host must not restore filename/sourceId platform helpers');

console.log('asset manager guid/external check passed');
