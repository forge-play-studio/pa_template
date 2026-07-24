import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const playableSdk = await import('@fps-games/editor/playable-sdk');

const editorConfig = await readText('fps.config.ts');
const projectSceneFeature = await readText('src/services/fps-game-editor/scene-feature.ts');
const groundDecalFeatureConfig = await readText('src/services/fps-game-editor/ground-decal-feature.ts');
const groundDecalPolicy = await readText('src/services/fps-game-editor/ground-decal-config.ts');
const groundDecalAuthored = await readText('src/services/fps-game-editor/ground-decal-authored.ts');
const projectionPreviewAdapter = await readText('src/services/fps-game-editor/local-editor.ts');
const localEditorModeSwitcher = await readText('src/services/fps-game-editor/local-editor.ts');
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
assert.match(projectionPreviewAdapter, /createGroundDecalUiDynamicTexture\(name, scene, decal, \{ useEditorPreview: true \}\)/, 'project projection adapter must render authored editor preview state');

assert.match(localEditorModeSwitcher, /createFpsGameEditorPlayableProjectHostAssembly/, 'host must delegate standard capability wiring to the product factory');

assert.match(groundDecalAuthored, /texture\('ground_decal_border_reference'\)/, 'GroundDecal border texture must stay required');
assert.match(groundDecalAuthored, /texture\('ground_decal_conveyor_reference'\)/, 'GroundDecal conveyor texture must stay required');
assert.match(groundDecalAuthored, /texture\('ground_decal_money_reference'\)/, 'GroundDecal money texture must stay required');
assert.match(groundDecalAuthored, /texture\('ground_decal_custom_progress_normal'\)/, 'Custom progress normal background must stay required');
assert.match(groundDecalAuthored, /texture\('ground_decal_custom_progress_active'\)/, 'Custom progress active background must stay required');
assert.match(groundDecalAuthored, /texture\('ground_decal_custom_progress_fill'\)/, 'Custom progress fill texture must stay required');
assert.match(assetCatalog, /"ground_decal_border_reference":\s*"texture_969907ee4a1d453ea7b0ee3247cb6bb1"/, 'GroundDecal border asset id missing');
assert.match(assetCatalog, /"ground_decal_conveyor_reference":\s*"texture_ee97d50a7eb442b5905add9aaae74f2c"/, 'GroundDecal conveyor asset id missing');
assert.match(assetCatalog, /"ground_decal_money_reference":\s*"texture_331e16209e8c47cc94217508d719cbbb"/, 'GroundDecal money asset id missing');
assert.match(assetCatalog, /"ground_decal_custom_progress_normal":\s*"texture_9c7041dec3d745aeb20d692ba518017d"/, 'Custom progress normal background asset id missing');
assert.match(assetCatalog, /"ground_decal_custom_progress_active":\s*"texture_2f4cdfe94dff4487b2a4f172b59f57fe"/, 'Custom progress active background asset id missing');
assert.match(assetCatalog, /"ground_decal_custom_progress_fill":\s*"texture_97b07a11a0a0463585406c360c8bd1ca"/, 'Custom progress fill asset id missing');
assert.match(groundDecalAuthored, /ground_decal_border_reference:\s*'texture_969907ee4a1d453ea7b0ee3247cb6bb1'/, 'Node-safe GroundDecal border asset id drifted from the generated catalog');
assert.match(groundDecalAuthored, /ground_decal_conveyor_reference:\s*'texture_ee97d50a7eb442b5905add9aaae74f2c'/, 'Node-safe GroundDecal conveyor asset id drifted from the generated catalog');
assert.match(groundDecalAuthored, /ground_decal_money_reference:\s*'texture_331e16209e8c47cc94217508d719cbbb'/, 'Node-safe GroundDecal money asset id drifted from the generated catalog');
assert.match(groundDecalAuthored, /ground_decal_custom_progress_normal:\s*'texture_9c7041dec3d745aeb20d692ba518017d'/, 'Node-safe custom progress normal background asset id drifted from the generated catalog');
assert.match(groundDecalAuthored, /ground_decal_custom_progress_active:\s*'texture_2f4cdfe94dff4487b2a4f172b59f57fe'/, 'Node-safe custom progress active background asset id drifted from the generated catalog');
assert.match(groundDecalAuthored, /ground_decal_custom_progress_fill:\s*'texture_97b07a11a0a0463585406c360c8bd1ca'/, 'Node-safe custom progress fill asset id drifted from the generated catalog');
assert.match(groundDecalAuthored, /kind:\s*'textureProgress'[\s\S]*editorPreviewPercent:\s*50[\s\S]*direction:\s*'bottomToTop'/, 'Custom progress authored layer must use a bottom-to-top texture reveal');
assert.match(groundDecalPolicy, /canShowActivePreview:[\s\S]*uiKind === 'customProgress'/, 'Custom progress Inspector active preview policy missing');
assert.match(groundDecalUiService, /layer\.role !== 'activeBackground' \|\| state\.active/, 'Runtime active background visibility gate missing');
assert.match(groundDecalUiService, /ctx\.clip\(\);[\s\S]*await drawTextureLayer/, 'Texture progress must clip the full image rather than rescale it');
for (const method of [
  'showGroundDecalUiActive',
  'hideGroundDecalUiActive',
  'setGroundDecalUiProgress',
  'setGroundDecalUiProgressPercent',
]) {
  assert.match(await readText('src/services/SceneBuilder.ts'), new RegExp(`\\b${method}\\b`), `SceneBuilder runtime API missing: ${method}`);
}
assert.doesNotMatch(groundDecalAuthored, /from\s+['"]\.\.\/assets['"]/, 'Node-safe GroundDecal authored config must not import the browser asset catalog');

console.log('editor ground decal authoring checks passed');

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}
