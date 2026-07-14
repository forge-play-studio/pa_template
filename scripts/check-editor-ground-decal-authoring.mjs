import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const playableSdk = await import('@fps-games/editor/playable-sdk');

const editorConfig = await readText('fps.config.ts');
const projectSceneFeature = await readText('src/editor-features/scene-feature.ts');
const groundDecalFeatureConfig = await readText('src/editor-features/ground-decal-feature.ts');
const groundDecalPolicy = await readText('src/editor-features/ground-decal-config.ts');
const groundDecalAuthored = await readText('src/editor-features/ground-decal-authored.ts');
const projectionPreviewAdapter = await readText('src/editor-features/local-editor.ts');
const localEditorModeSwitcher = await readText('src/editor-features/local-editor.ts');
const groundDecalUiService = await readText('src/services/GroundDecalUiService.ts');
const assetCatalog = await readText('src/assets/generated/asset-catalog.generated.ts');

assert.match(editorConfig, /features:\s*\[groundDecalFeature\(paTemplateGroundDecalFeatureConfig\)\]/, 'fps.config.ts must declare GroundDecal through the product feature model');
assert.match(groundDecalPolicy, /documentPolicy:\s*paTemplateGroundDecalDocumentPolicy/, 'project GroundDecal authored policy must stay in declarative feature config');
assert.match(projectSceneFeature, /features:\s*editorConfig\.features/, 'standard scene assembly must resolve behavior from configured project features');
assert.doesNotMatch(projectSceneFeature, /resolveFeatureSceneContribution/, 'project must not assemble its own GroundDecal scene contribution resolver');

for (const exportName of [
  'createFpsGameEditorStandardSceneAssembly',
  'createFpsGameEditorPlayableProjectHostAssembly',
  'createFpsGameEditorProductProjectionPreview',
  'createPlayableGroundDecalInspectorServices',
  'createFpsGameEditorConfiguredGroundDecalSceneFeature',
  'createFpsGameEditorDeclarativeGroundDecalSceneFeature',
]) {
  assert.equal(typeof playableSdk[exportName], 'function', `packed playable SDK export missing: ${exportName}`);
}

assert.doesNotMatch(projectSceneFeature, /createFpsGameEditorConfiguredGroundDecalSceneFeature|createPlayableGroundDecalInspectorServices/, 'SDK must own GroundDecal scene and Inspector assembly');
assert.doesNotMatch(projectSceneFeature, /createPlayableGroundDecalDocumentBridge/, 'SDK must own the GroundDecal document bridge');
assert.match(groundDecalPolicy, /paTemplateGroundDecalDocumentPolicy/, 'project GroundDecal document policy missing');
assert.match(groundDecalPolicy, /paTemplateGroundDecalInspectorPolicy/, 'project GroundDecal Inspector policy missing');

assert.match(projectionPreviewAdapter, /createFpsGameEditorProductProjectionPreview/, 'project projection adapter must consume the product preview factory');
assert.match(projectionPreviewAdapter, /createDynamicTexture:\s*createGroundDecalUiDynamicTexture/, 'project projection adapter must inject its GroundDecal texture hook');

assert.match(localEditorModeSwitcher, /createFpsGameEditorPlayableProjectHostAssembly/, 'host must delegate standard capability wiring to the product factory');

assert.match(groundDecalAuthored, /texture\('ground_decal_border_reference'\)/, 'GroundDecal border texture must stay required');
assert.match(groundDecalAuthored, /texture\('ground_decal_conveyor_reference'\)/, 'GroundDecal conveyor texture must stay required');
assert.match(groundDecalAuthored, /texture\('ground_decal_money_reference'\)/, 'GroundDecal money texture must stay required');
assert.match(assetCatalog, /"ground_decal_border_reference":\s*"texture_969907ee4a1d453ea7b0ee3247cb6bb1"/, 'GroundDecal border asset id missing');
assert.match(assetCatalog, /"ground_decal_conveyor_reference":\s*"texture_ee97d50a7eb442b5905add9aaae74f2c"/, 'GroundDecal conveyor asset id missing');
assert.match(assetCatalog, /"ground_decal_money_reference":\s*"texture_331e16209e8c47cc94217508d719cbbb"/, 'GroundDecal money asset id missing');
assert.match(groundDecalAuthored, /ground_decal_border_reference:\s*'texture_969907ee4a1d453ea7b0ee3247cb6bb1'/, 'Node-safe GroundDecal border asset id drifted from the generated catalog');
assert.match(groundDecalAuthored, /ground_decal_conveyor_reference:\s*'texture_ee97d50a7eb442b5905add9aaae74f2c'/, 'Node-safe GroundDecal conveyor asset id drifted from the generated catalog');
assert.match(groundDecalAuthored, /ground_decal_money_reference:\s*'texture_331e16209e8c47cc94217508d719cbbb'/, 'Node-safe GroundDecal money asset id drifted from the generated catalog');
assert.doesNotMatch(groundDecalAuthored, /from\s+['"]\.\.\/assets['"]/, 'Node-safe GroundDecal authored config must not import the browser asset catalog');

console.log('editor ground decal authoring checks passed');

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}
