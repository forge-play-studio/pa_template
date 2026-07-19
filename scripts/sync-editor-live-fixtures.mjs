#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const editorScenePath = path.join(projectRoot, 'src/config/editor-scene.json');
const scenePath = path.join(projectRoot, 'src/config/scene.json');
const assetManifestPath = path.join(projectRoot, 'src/assets/generated/asset-catalog.manifest.json');
const playableSdk = await import('@fps-games/editor/playable-sdk');

const PREFAB_FIXTURE = {
  id: 'prefab_issue464_crate_reference',
  guid: 'prefab_issue464_crate_reference',
  sourceCodeKey: 'shadow_fixture_crate',
};

const GROUND_DECAL_FIXTURES = [
  {
    id: 'issue464_ground_decal_operation',
    guid: 'go_issue464_ground_decal_operation',
    name: 'Issue 464 Operation Ground Decal Fixture',
    uiKind: 'operation',
    position: { x: -3.2, y: 0.02, z: 2.8 },
  },
  {
    id: 'issue464_ground_decal_delivery',
    guid: 'go_issue464_ground_decal_delivery',
    name: 'Issue 464 Delivery Ground Decal Fixture',
    uiKind: 'delivery',
    position: { x: -1.2, y: 0.02, z: 2.8 },
  },
];

let editorScene = await readJson(editorScenePath);
const previousSceneConfig = await readJson(scenePath);
const assetManifest = await readJson(assetManifestPath);
let changed = false;

changed = ensurePrefabStageFixture(editorScene) || changed;
changed = ensureGroundDecalLiveFixtures(editorScene, assetManifest) || changed;

if (changed) {
  editorScene = playableSdk.bumpEditorSceneAuthoringSourceRevision?.(editorScene) ?? editorScene;
  const compiled = playableSdk.compileEditorSceneDocumentToSceneConfig(editorScene, previousSceneConfig, {
    readCustomTransformRuntimeData: gameObject => (
      isGroundDecalUiConfig(gameObject.groundDecal)
        ? { groundDecal: structuredClone(gameObject.groundDecal) }
        : null
    ),
  });
  await writeJson(editorScenePath, editorScene);
  await writeJson(scenePath, compiled.sceneConfig);
  console.log('editor live fixtures synchronized');
} else {
  console.log('editor live fixtures already synchronized');
}

function ensurePrefabStageFixture(document) {
  if (document.assets?.some(asset => asset?.id === PREFAB_FIXTURE.id)) return false;
  const sourceAsset = document.assets?.find(asset => asset?.metadata?.codeKey === PREFAB_FIXTURE.sourceCodeKey);
  if (!sourceAsset) {
    throw new Error(`Unable to create prefab fixture: source asset with codeKey "${PREFAB_FIXTURE.sourceCodeKey}" was not found.`);
  }
  const prefabAsset = playableSdk.createEditorScenePrefabDefinitionFromAsset(sourceAsset, {
    id: PREFAB_FIXTURE.id,
    guid: PREFAB_FIXTURE.guid,
  });
  document.assets.push(prefabAsset);
  return true;
}

function ensureGroundDecalLiveFixtures(document, manifest) {
  const rootId = resolveRootContainerId(document);
  const textureIds = readGroundDecalTextureIds(manifest);
  let changed = false;
  for (const fixture of GROUND_DECAL_FIXTURES) {
    if (document.scene?.gameObjects?.some(gameObject => gameObject?.id === fixture.id)) continue;
    document.scene.gameObjects.push(createGroundDecalFixtureGameObject(fixture, rootId, textureIds));
    changed = true;
  }
  return changed;
}

function createGroundDecalFixtureGameObject(fixture, rootId, textureIds) {
  return {
    id: fixture.id,
    guid: fixture.guid,
    name: fixture.name,
    kind: 'transform',
    ...(rootId ? { parentId: rootId } : {}),
    active: true,
    transformType: 'groundDecal',
    groundDecal: createDefaultGroundDecalUiConfig(fixture.uiKind, textureIds),
    components: [{
      type: 'Transform',
      position: fixture.position,
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    }],
  };
}

function createDefaultGroundDecalUiConfig(uiKind, textureIds) {
  const common = {
    uiKind,
    size: { width: 1.8, depth: 1.8 },
    aspectSourceLayerId: 'border',
    lockAspectToBorder: true,
    mask: {
      enabled: true,
      source: 'roundedRect',
      cornerRadius: 0.18,
      padding: 0.02,
    },
    rendering: {
      textureWidth: 512,
      textureHeight: 512,
      alphaIndex: 100,
      diffuseTextureLevel: 1,
      emissiveTextureLevel: 0,
    },
  };

  if (uiKind === 'operation') {
    return {
      ...common,
      layers: [
        createBaseLayer(),
        {
          id: 'mainLogo',
          role: 'mainLogo',
          kind: 'texture',
          textureId: textureIds.moneyLarge,
          zOrder: 20,
          rect: { x: 0, z: 0, width: 1, depth: 1 },
        },
        createBorderLayer(textureIds),
      ],
    };
  }

  return {
    ...common,
    layers: [
      createBaseLayer(),
      {
        id: 'progressFill',
        role: 'progressFill',
        kind: 'progress',
        value: 0,
        direction: 'bottomToTop',
        color: { r: 0.16, g: 0.56, b: 1, a: 0.88 },
        zOrder: 10,
        rect: { x: 0, z: 0, width: 1, depth: 1 },
      },
      {
        id: 'mainLogo',
        role: 'mainLogo',
        kind: 'texture',
        textureId: textureIds.conveyor,
        zOrder: 20,
        rect: { x: 0, z: 0, width: 1, depth: 1 },
      },
      {
        id: 'subLogo',
        role: 'subLogo',
        kind: 'texture',
        textureId: textureIds.moneyLarge,
        zOrder: 25,
        rect: { x: -0.25, z: -0.25, width: 0.5, depth: 0.5 },
      },
      {
        id: 'amount',
        role: 'amount',
        kind: 'text',
        text: {
          value: '30',
          fontFamily: 'system-ui, Arial, sans-serif',
          fontSize: 96,
          fontWeight: '800',
          color: { r: 1, g: 1, b: 1, a: 1 },
          strokeColor: { r: 0, g: 0, b: 0, a: 0.45 },
          strokeWidth: 8,
          align: 'center',
          baseline: 'middle',
        },
        zOrder: 30,
        rect: { x: 0.2, z: -0.25, width: 0.28, depth: 0.22 },
      },
      createBorderLayer(textureIds),
    ],
  };
}

function isGroundDecalUiConfig(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value.uiKind === 'operation' || value.uiKind === 'delivery')
    && value.size
    && typeof value.size === 'object'
    && Number.isFinite(value.size.width)
    && Number.isFinite(value.size.depth),
  );
}

function createBaseLayer() {
  return {
    id: 'base',
    role: 'base',
    kind: 'color',
    color: { r: 0.08, g: 0.08, b: 0.08, a: 0.56 },
    zOrder: 0,
    rect: { x: 0, z: 0, width: 1, depth: 1 },
  };
}

function createBorderLayer(textureIds) {
  return {
    id: 'border',
    role: 'border',
    kind: 'texture',
    textureId: textureIds.borderWhite,
    zOrder: 100,
    rect: { x: 0, z: 0, width: 1, depth: 1 },
  };
}

function readGroundDecalTextureIds(manifest) {
  return {
    borderWhite: readRequiredAssetIdByCodeKey(manifest, 'ground_decal_border_reference', 'texture'),
    conveyor: readRequiredAssetIdByCodeKey(manifest, 'ground_decal_conveyor_reference', 'texture'),
    moneyLarge: readRequiredAssetIdByCodeKey(manifest, 'ground_decal_money_reference', 'texture'),
  };
}

function readRequiredAssetIdByCodeKey(manifest, codeKey, kind) {
  const entry = manifest.find(candidate => candidate?.codeKey === codeKey);
  if (!entry) throw new Error(`Missing asset catalog fixture dependency: ${codeKey}`);
  if (entry.kind !== kind) throw new Error(`Asset catalog entry "${codeKey}" must be a ${kind}, got ${entry.kind}.`);
  return entry.assetId;
}

function resolveRootContainerId(document) {
  const gameObjects = document.scene?.gameObjects ?? [];
  return gameObjects.some(gameObject => gameObject?.id === 'root') ? 'root' : gameObjects[0]?.id ?? null;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
