#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const files = {
  core: path.join(root, 'src/services/assets/core/AssetManagerCore.ts'),
  facade: path.join(root, 'src/services/AssetManager.ts'),
  adapter: path.join(root, 'src/fps-game-editor-adapter/asset-adapter.ts'),
  placement: path.join(root, 'src/services/SceneAssetPlacement.ts'),
  usage: path.join(root, 'src/services/SceneAssetUsage.ts'),
  localBridge: path.join(root, 'src/debug/local-editor-mode-switcher.ts'),
};

const entries = await Promise.all(
  Object.entries(files).map(async ([key, filePath]) => [key, await fs.readFile(filePath, 'utf8')]),
);
const source = Object.fromEntries(entries);

for (const key of ['core', 'facade', 'adapter', 'placement', 'usage']) {
  assert.doesNotMatch(source[key], /\bsourceId\b/, `${key} must not expose asset sourceId identity`);
}

assert.match(source.core, /\bprojectAssetId:\s*assetArgs\.assetId\b/, 'registration payload must use projectAssetId');
assert.match(source.core, /\bconst assetId = createAssetId\(kind, guid\);/, 'asset manager identity must derive assetId from guid');
assert.match(source.core, /Project asset id "[^"]+" does not match guid/, 'asset manager must reject non-canonical requested project assetId');
assert.match(source.core, /Requested guid "[^"]+" does not match existing asset guid/, 'asset manager must reject requested guid conflicts with reusable assets');
assert.doesNotMatch(source.core, /existing\?\.id\s*\?\?\s*requestedAssetId|requestedAssetId\s*\?\?\s*createAssetId/, 'requested assetId must not override guid-derived assetId');
assert.doesNotMatch(source.core, /\bsourceId\b/, 'asset manager core must not write sourceId');
assert.match(source.core, /\bplatformAssetId:\s*assetArgs\.external\.platformAssetId\b/, 'registration payload must carry external.platformAssetId');
assert.match(source.core, /\bguid:\s*assetArgs\.guid\b/, 'registration payload must carry guid');

assert.match(source.adapter, /platformAssetId:\s*optionalString\(params\.platformAssetId\)\s*\?\?\s*optionalString\(params\.assetId\)/, 'platform payload assetId must be interpreted as raw platform id');
assert.match(source.adapter, /projectAssetId\)\s*\?\?\s*optionalString\(params\.assetId\)/, 'unregistration must accept canonical projectAssetId first');
assert.match(source.adapter, /const registered = inferredAssetPath[\s\S]*await executeTransportPlan\(registrationPlan\.transportPlan\)/, 'asset import must register before placement to receive canonical assetId');
assert.match(source.adapter, /assetId:\s*canonical\.assetId/, 'asset import must place canonical project assetId');
assert.doesNotMatch(source.adapter, /void executeTransportPlan/, 'asset import must not fire-and-forget registry registration');

assert.match(source.localBridge, /readOptionalString\(payload\.platformAssetId\)[\s\S]*readOptionalString\(payload\.assetId\)/, 'local bridge must interpret payload.assetId as raw platform id');
assert.match(source.localBridge, /readOptionalString\(payload\.projectAssetId\)/, 'local bridge must distinguish optional projectAssetId');
assert.doesNotMatch(source.localBridge, /readPlatformAssetSourceId|findRegistered(Model|Texture)(SourceId|AssetId)ForPlatformAsset|sanitizePlatformAssetId/, 'local bridge must not use filename/sourceId platform helpers');

assert.match(source.usage, /\bfindSceneAssetUsageByAssetId\b/, 'scene usage guard must be assetId-driven');
assert.doesNotMatch(source.usage, /\bfindSceneAssetUsageBySourceId\b/, 'scene usage guard must not be sourceId-driven');

console.log('asset manager guid/external check passed');
