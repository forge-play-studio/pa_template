import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const packageJson = await readText('package.json');
const localEditorModeSwitcher = await readText('src/debug/local-editor-mode-switcher.ts');
const editorSceneSession = await readText('src/fps-game-editor-adapter/editor-scene-session.ts');
const groundDecalUiService = await readText('src/services/GroundDecalUiService.ts');
const assetCatalog = await readText('src/assets/generated/asset-catalog.generated.ts');
const editorBrowserPanels = await readEditorBrowserPanels();

assert.match(packageJson, /"@fps-games\/editor":\s*"0\.1\.7-beta\.1"/, 'pa_template must consume @fps-games/editor 0.1.7-beta.1');

assert.match(localEditorModeSwitcher, /hierarchyActions:\s*{\s*contextActions:/s, 'local editor host must register hierarchy actions');
assert.match(localEditorModeSwitcher, /id:\s*'ground-decal-ui\.create-operation'/, 'operation GroundDecal UI hierarchy action missing');
assert.match(localEditorModeSwitcher, /label:\s*'添加操作类地贴 UI'/, 'operation GroundDecal UI Chinese label missing');
assert.match(localEditorModeSwitcher, /id:\s*'ground-decal-ui\.create-delivery'/, 'delivery GroundDecal UI hierarchy action missing');
assert.match(localEditorModeSwitcher, /label:\s*'添加交付类地贴 UI'/, 'delivery GroundDecal UI Chinese label missing');
assert.match(localEditorModeSwitcher, /createEditorSceneGroundDecalUiPatch\(context\.document,\s*'operation'\)/, 'operation hierarchy action must use adapter patch factory');
assert.match(localEditorModeSwitcher, /createEditorSceneGroundDecalUiPatch\(context\.document,\s*'delivery'\)/, 'delivery hierarchy action must use adapter patch factory');
assert.match(localEditorModeSwitcher, /groundDecalUi:\s*structuredClone\(gameObject\.groundDecal\)/, 'projection metadata must carry current groundDecalUi config');
assert.match(localEditorModeSwitcher, /readPreviewGroundDecalUiConfig/, 'projection importer must read groundDecalUi metadata');
assert.match(localEditorModeSwitcher, /createGroundDecalUiProjectionResult/, 'projection importer must render groundDecalUi projection');
assert.match(localEditorModeSwitcher, /isSelectable:\s*isEditorSceneSelectableHierarchyId/, 'selection guard must delegate to project adapter');
assert.doesNotMatch(localEditorModeSwitcher, /isSelectable:\s*\(_document,\s*id\)\s*=>\s*id !== 'root'/, 'selection guard must not allow arbitrary non-root ids');
assert.match(localEditorModeSwitcher, /mesh\.isPickable\s*=\s*true/, 'GroundDecal UI projection mesh must stay pickable after selection is cleared');
assert.doesNotMatch(localEditorModeSwitcher, /EditorSceneRuntimePreviewGroundDecalDescriptor|importPlan\.kind\s*===\s*'groundDecal'|createGroundDecalProjectionResult/, 'legacy ground decal projection path must not return');

assert.match(editorSceneSession, /export function createEditorSceneGroundDecalUiPatch/, 'GroundDecal UI patch factory missing');
assert.match(editorSceneSession, /export function isEditorSceneSelectableHierarchyId/, 'project selection guard missing');
assert.match(editorSceneSession, /findEditorSceneGameObject\(document,\s*id\)/, 'project selection guard must allow real GameObject ids');
assert.match(editorSceneSession, /resolveEditorSceneAssetMeshSelectionTarget\(document,\s*id\)/, 'project selection guard must preserve material slot selection ids');
assert.match(editorSceneSession, /transformType:\s*'groundDecal'/, 'GroundDecal UI creation must author a groundDecal transform');
assert.match(editorSceneSession, /groundDecal:\s*createDefaultGroundDecalUiConfig\(uiKind\)/, 'GroundDecal UI creation must use current UI defaults');
assert.match(editorSceneSession, /kind:\s*'game-object\.ground-decal-ui\.replace'/, 'GroundDecal UI replace patch kind missing');
assert.match(editorSceneSession, /ground-decal-ui\.delivery-pair\.add/, 'delivery pair add action id missing');
assert.match(editorSceneSession, /ground-decal-ui\.delivery-pair\.remove/, 'delivery pair remove action id missing');
assert.match(editorSceneSession, /Add Sub Logo \+ Number/, 'delivery pair add Inspector action missing');
assert.match(editorSceneSession, /Remove Sub Logo \+ Number/, 'delivery pair remove Inspector action missing');
assert.match(editorSceneSession, /isEditorSceneGroundDecalUiGameObject/, 'GroundDecal UI object guard missing');
assert.match(editorSceneSession, /function canShowEditorSceneGroundDecalInspector/, 'GroundDecal Inspector display guard missing');
assert.match(editorSceneSession, /gameObject\.transformType === 'groundDecal'\s*\|\|\s*isGroundDecalUiConfig\(gameObject\.groundDecal\)/, 'GroundDecal Inspector must remain visible for authored groundDecal configs');
assert.match(editorSceneSession, /enableGroundDecalUiActions:\s*isEditorSceneGroundDecalUiGameObject\(gameObject\)/, 'GroundDecal UI actions must use strict object guard');
assert.match(editorSceneSession, /options\.enableGroundDecalUiActions\s*&&\s*decal\.uiKind === 'delivery'/, 'delivery pair Inspector actions must stay gated behind GroundDecal UI guard');
assert.match(editorSceneSession, /createReadonlyInspectorProperty\(\s*'groundDecal\.uiKind'/, 'GroundDecal UI type should be readonly to avoid destructive kind switching');
assert.match(editorSceneSession, /path:\s*'groundDecal\.rendering\.textureWidth'/, 'GroundDecal texture width Inspector field missing');
assert.match(editorSceneSession, /path:\s*'groundDecal\.rendering\.textureHeight'/, 'GroundDecal texture height Inspector field missing');
assert.match(editorSceneSession, /customControl:\s*'ground-decal-layout'[\s\S]*?commitMode:\s*'live'/, 'GroundDecal layout Inspector control must use live commit mode');
assert.match(editorSceneSession, /function isProjectEditableGroundDecalLayer[\s\S]*?return layer\.role !== 'base'/, 'GroundDecal base layer must stay hidden from project authoring controls');
assert.match(editorSceneSession, /function isGroundDecalLayoutEditableLayer[\s\S]*?layer\.role === 'mainLogo'[\s\S]*?layer\.role === 'subLogo'[\s\S]*?layer\.role === 'amount'/, 'GroundDecal layout must expose only mainLogo, subLogo, and amount handles');
assert.match(editorSceneSession, /layers:\s*layoutEditableLayers\.map[\s\S]*?previewLayers:\s*decal\.layers\.map/s, 'GroundDecal layout value must separate editable layers from preview-only layers');
assert.match(editorSceneSession, /function createGroundDecalTextureInspectorProperty/, 'GroundDecal texture asset Inspector property missing');
assert.match(editorSceneSession, /customControl:\s*'asset-picker-card'[\s\S]*?GroundDecalUI[\s\S]*?TextureAsset/s, 'GroundDecal texture control must use the asset picker card');
assert.match(editorSceneSession, /groundDecal\.layers\.\$\{layerIndex\}\.textureId/, 'GroundDecal texture layer patch path missing');
assert.match(editorSceneSession, /groundDecal\.layers\.\$\{index\}\.text\.value/, 'GroundDecal text layer Inspector patch path missing');
assert.match(editorSceneSession, /function createGroundDecalMultiInspectorSection/, 'GroundDecal multi Inspector section missing');
assert.match(editorSceneSession, /createGroundDecalInspectorProperties\(nodeKind,\s*activeTarget\.decal[\s\S]*?enableGroundDecalUiActions:\s*false/, 'GroundDecal multi Inspector must reuse project properties without delivery action buttons');
assert.match(editorSceneSession, /function haveCompatibleGroundDecalLayerSignatures/, 'GroundDecal multi Inspector must guard compatible layer signatures');
assert.match(editorSceneSession, /function isGroundDecalMultiInspectorProperty/, 'GroundDecal multi Inspector property filter missing');
assert.match(editorSceneSession, /function isGroundDecalLayoutPatchCompatibleWithDecal/, 'GroundDecal multi layout patch signature guard missing');
assert.match(editorSceneSession, /patches\.length !== editableLayers\.length/, 'GroundDecal multi layout patch must require the full editable layer signature');
assert.match(editorSceneSession, /editableLayers\.every\(\(layer,\s*index\)\s*=>\s*patches\[index\]\?\.id === layer\.id\)/, 'GroundDecal multi layout patch must match layer ids by index');
assert.match(editorSceneSession, /command\.patch\.kind === 'game-object\.field' && isGroundDecalInspectorPatchPath\(command\.patch\.path\)[\s\S]*?patchEditorSceneGameObjectField/, 'GroundDecal field commands must route through project patch guards');
assert.match(editorSceneSession, /function validateGroundDecalInspectorField/, 'GroundDecal Inspector validator missing');
assert.match(editorSceneSession, /function patchEditorSceneGroundDecalInspectorField/, 'GroundDecal Inspector reducer patch missing');
assert.match(editorSceneSession, /function patchEditorSceneGroundDecalLayer/, 'GroundDecal layer reducer missing');
assert.match(editorSceneSession, /function parseGroundDecalLayerPatchPath/, 'GroundDecal layer patch parser missing');
assert.match(editorSceneSession, /function isGroundDecalRenderingTextureDimensionPath/, 'GroundDecal texture size patch guard missing');
assert.match(editorSceneSession, /!isProjectEditableGroundDecalLayer\(layer\)/, 'GroundDecal reducer must reject hidden base/border layer patches');
assert.match(editorSceneSession, /function createGroundDecalProgressPreviewInspectorProperty[\s\S]*?commitMode:\s*'blur'/, 'GroundDecal editor preview percent must commit on blur/Enter to avoid live Inspector refresh while typing');
assert.match(editorSceneSession, /export function canPatchEditorSceneGroundDecalMultiField/, 'GroundDecal multi target support helper missing');
assert.match(editorSceneSession, /function canPatchGroundDecalLayerField/, 'GroundDecal multi layer kind support guard missing');
assert.match(editorSceneSession, /function isEditorSceneGroundDecalSerializedMultiFieldPath/, 'GroundDecal multi Inspector field whitelist missing in adapter');
assert.match(editorSceneSession, /path === 'groundDecal\.size\.width'[\s\S]*?path === 'groundDecal\.layers'[\s\S]*?isGroundDecalInspectorPatchPath\(path\)/, 'GroundDecal multi whitelist must include size, layout, texture size, and layer patch fields');
assert.match(editorSceneSession, /isEditorSceneGroundDecalSerializedMultiFieldPath\(input\.path\)[\s\S]*?!canPatchEditorSceneGroundDecalMultiField/, 'GroundDecal multi patch targets must reject unsupported object/path pairs');
assert.match(editorSceneSession, /isEditorSceneSerializedMultiProjectionPath\(input\.path\)[\s\S]*?reprojectIds:\s*targetIds/, 'GroundDecal multi field-batch patches must request projection refresh');
assert.match(editorSceneSession, /isEditorSceneGroundDecalProjectionPath\(path\)/, 'GroundDecal field patches must request projection refresh');
assert.match(editorSceneSession, /function isEditorSceneGroundDecalProjectionPath/, 'GroundDecal projection path guard missing');
assert.match(editorSceneSession, /normalizeGroundDecalUiScalesForCommand/, 'GroundDecal UI scale reducer guard missing');
assert.match(editorSceneSession, /createGroundDecalUiScaleInspectorPatch/, 'GroundDecal UI scale Inspector patch missing');
assert.match(editorSceneSession, /const uiKind = source\?\.uiKind === 'delivery' \|\| source\?\.uiKind === 'operation'[\s\S]*?createDefaultGroundDecalUiConfig\(uiKind\)/, 'GroundDecal default merge must preserve delivery defaults for partial delivery configs');

assert.match(localEditorModeSwitcher, /function isEditorSceneGroundDecalSerializedMultiFieldPath/, 'GroundDecal multi Inspector field whitelist missing in local host wrapper');
assert.match(localEditorModeSwitcher, /getInspectorMultiObject:\s*\(document,\s*selectedIds,\s*activeId\)[\s\S]*?textureAssets:\s*createEditorSceneInspectorTextureAssets\(currentEditorAssetLibrary\)/, 'local host wrapper must pass texture context to GroundDecal multi Inspector');
assert.match(localEditorModeSwitcher, /getEditorSceneSerializedMultiPropertyPatchTargets/, 'local host wrapper must probe multi field patch targets');
assert.match(localEditorModeSwitcher, /canPatchEditorSceneGroundDecalMultiField/, 'local host wrapper must reuse adapter GroundDecal multi target guard');
assert.match(localEditorModeSwitcher, /isEditorSceneGroundDecalSerializedMultiFieldPath\(input\.path\)[\s\S]*?!canPatchEditorSceneGroundDecalMultiField/, 'local host wrapper must reject unsupported GroundDecal multi paths');
assert.match(localEditorModeSwitcher, /isEditorSceneSerializedMultiProjectionPath\(input\.path\)[\s\S]*?reprojectIds:\s*targetIds/, 'local host wrapper must reproject GroundDecal multi patches');
assert.match(localEditorModeSwitcher, /isGroundDecalLayerProgressPreviewPercentPath\(path\)[\s\S]*?return 75/, 'local host wrapper must probe GroundDecal preview percent multi fields');
assert.match(localEditorModeSwitcher, /editorPreviewPercent/, 'local host wrapper must whitelist GroundDecal preview percent fields');

assertGroundDecalMixedKindLayoutGuard(editorSceneSession);

assert.match(groundDecalUiService, /readRequiredGroundDecalTextureId\('ground_decal_border_reference'\)/, 'GroundDecal border default texture must be required');
assert.match(groundDecalUiService, /readRequiredGroundDecalTextureId\('ground_decal_conveyor_reference'\)/, 'GroundDecal conveyor default texture must be required');
assert.match(groundDecalUiService, /readRequiredGroundDecalTextureId\('ground_decal_money_reference'\)/, 'GroundDecal money default texture must be required');
assert.match(assetCatalog, /"ground_decal_conveyor_reference":\s*"texture_ee97d50a7eb442b5905add9aaae74f2c"/, 'GroundDecal conveyor default texture codeKey missing from ASSET_IDS');
assert.match(assetCatalog, /"ground_decal_money_reference":\s*"texture_331e16209e8c47cc94217508d719cbbb"/, 'GroundDecal money default texture codeKey missing from ASSET_IDS');
assert.match(assetCatalog, /"ground_decal_border_reference":\s*"texture_969907ee4a1d453ea7b0ee3247cb6bb1"/, 'GroundDecal border default texture codeKey missing from ASSET_IDS');

assert.match(editorBrowserPanels, /previewLayers\?:\s*unknown\[\]/, 'GroundDecal layout custom control must support preview-only layers');
assert.match(editorBrowserPanels, /const previewLayers = readInspectorGroundDecalLayoutPreviewLayers\(property,\s*layers\)/, 'GroundDecal layout custom control must read previewLayers separately from editable layers');
assert.match(editorBrowserPanels, /const editableLayers = layers\.filter\(isInspectorGroundDecalLayoutLayerEditable\)/, 'GroundDecal layout custom control must filter editable drag handles');
assert.match(editorBrowserPanels, /renderInspectorGroundDecalLayoutPreview\([\s\S]*?previewLayers/s, 'GroundDecal layout preview must render previewLayers');
assert.match(editorBrowserPanels, /commitLayout\('input'\)/, 'GroundDecal layout custom control must emit live input commits');
assert.match(editorBrowserPanels, /commitInspectorGroundDecalLayoutValue\(input,\s*layers,\s*fieldInputsByLayer,\s*composite,\s*eventType\)/, 'GroundDecal layout commit helper must preserve event type');
assert.match(editorBrowserPanels, /new Event\(eventType,\s*\{\s*bubbles:\s*true\s*\}\)/, 'GroundDecal layout custom control must dispatch input/change events explicitly');

console.log('editor ground decal authoring checks passed');

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function readEditorBrowserPanels() {
  const candidates = [
    process.env.FPS_GAME_EDITOR_REPO
      ? `${process.env.FPS_GAME_EDITOR_REPO}/packages/editor-browser/src/local-editor-ui-panels.ts`
      : null,
    '../fps-game-editor/packages/editor-browser/src/local-editor-ui-panels.ts',
    '../../packages/editor-browser/src/local-editor-ui-panels.ts',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return await readText(candidate);
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
      throw error;
    }
  }

  throw new Error('Unable to find fps-game-editor packages/editor-browser/src/local-editor-ui-panels.ts. Set FPS_GAME_EDITOR_REPO to the local fps-game-editor checkout.');
}

function assertGroundDecalMixedKindLayoutGuard(source) {
  const multiSection = readFunctionBody(source, 'createGroundDecalMultiInspectorSection');
  assert.match(multiSection, /haveCompatibleGroundDecalLayerSignatures/, 'GroundDecal multi Inspector must compute compatible layer signatures');
  assert.match(multiSection, /isGroundDecalMultiInspectorProperty\(property,\s*compatibleLayerSignature\)/, 'GroundDecal multi Inspector must hide layout/layer properties for incompatible layer signatures');

  const propertyFilter = readFunctionBody(source, 'isGroundDecalMultiInspectorProperty');
  assert.match(propertyFilter, /property\.path === 'groundDecal\.layers' \|\| parseGroundDecalLayerPatchPath\(property\.path\)/, 'GroundDecal multi property filter must treat layout and layer fields as signature-gated');
  assert.match(propertyFilter, /return compatibleLayerSignature/, 'GroundDecal multi layout/layer fields must require compatible layer signatures');

  const supportGuard = readFunctionBody(source, 'canPatchEditorSceneGroundDecalMultiField');
  assert.match(supportGuard, /isGroundDecalLayoutPatchCompatibleWithDecal\(decal,\s*patches\)/, 'GroundDecal multi patch guard must use layout signature compatibility');

  const layoutGuard = readFunctionBody(source, 'isGroundDecalLayoutPatchCompatibleWithDecal');
  assert.match(layoutGuard, /patches\.length !== editableLayers\.length/, 'GroundDecal layout signature guard must reject partial or mixed-kind layout patches');
  assert.match(layoutGuard, /patches\[index\]\?\.id === layer\.id/, 'GroundDecal layout signature guard must preserve layer order');
}

function readFunctionBody(source, functionName) {
  const marker = `function ${functionName}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${functionName} missing`);
  const open = findFunctionBodyOpenBrace(source, start + marker.length);
  assert.notEqual(open, -1, `${functionName} missing opening brace`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`${functionName} body is unterminated`);
}

function findFunctionBodyOpenBrace(source, start) {
  let parenDepth = 0;
  let sawParams = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      sawParams = true;
      parenDepth += 1;
      continue;
    }
    if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (sawParams && parenDepth === 0 && char === '{') return index;
  }
  return -1;
}
