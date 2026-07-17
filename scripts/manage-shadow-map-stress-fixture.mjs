#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const EDITOR_STATIC_PREFIX = 'shadow_stress_editor_static_';
const EDITOR_DYNAMIC_PREFIX = 'shadow_stress_editor_dynamic_';
const MAX_COUNT_PER_CLASS = 2_000;
const GRID_SPACING = 0.55;

const args = parseArgs(process.argv.slice(2));
const projectRoot = process.cwd();
const editorScenePath = path.join(projectRoot, 'src/config/editor-scene.json');
const scenePath = path.join(projectRoot, 'src/config/scene.json');
const assetManifestPath = path.join(projectRoot, 'src/assets/generated/asset-catalog.manifest.json');
const sdk = await import('@fps-games/editor/playable-sdk');

let document = await readJson(editorScenePath);
const previousSceneConfig = await readJson(scenePath);
const assetManifest = await readJson(assetManifestPath);
const previousStressIds = document.scene.gameObjects
  .filter(object => isStressObjectId(object.id))
  .map(object => object.id);

if (previousStressIds.length > 0) {
  const deletion = sdk.createEditorSceneDeleteSubtreePatch(document, {
    ids: previousStressIds,
    activeId: null,
  });
  if (!deletion) throw new Error('Unable to create editor stress fixture cleanup patch.');
  document = sdk.applyEditorSceneDocumentMutationPatch({ document, patch: deletion.patch });
}

if (!args.remove) {
  const total = args.staticCount + args.dynamicCount;
  const columns = Math.ceil(Math.sqrt(total));
  for (let index = 0; index < total; index += 1) {
    const dynamic = index >= args.staticCount;
    const localIndex = dynamic ? index - args.staticCount : index;
    const expectedId = `${dynamic ? EDITOR_DYNAMIC_PREFIX : EDITOR_STATIC_PREFIX}${String(localIndex).padStart(4, '0')}`;
    const creation = sdk.createEditorSceneCreatePrimitivePatch(document, {
      activeId: 'root',
      parentId: 'root',
      shape: 'cube',
      name: expectedId,
    });
    if (!creation) throw new Error(`Unable to create editor stress primitive: ${expectedId}`);
    if (creation.createdId !== expectedId) {
      throw new Error(`Editor stress fixture identity drift: expected ${expectedId}, got ${creation.createdId}`);
    }
    document = sdk.applyEditorSceneDocumentMutationPatch({ document, patch: creation.patch });
    const position = createGridPosition(index, total, columns);
    document = sdk.patchEditorSceneGameObjectField(document, expectedId, 'transform.position', position);
    document = sdk.patchEditorSceneGameObjectField(document, expectedId, 'transform.scale', 0.34);
    document = sdk.patchEditorSceneGameObjectField(document, expectedId, 'metadata.shadowStressSource', 'editor');
    document = sdk.patchEditorSceneGameObjectField(document, expectedId, 'shadowMapExperiment.cast', 'enabled');
    document = sdk.patchEditorSceneGameObjectField(document, expectedId, 'shadowMapExperiment.receive', 'enabled');
    document = sdk.patchEditorSceneGameObjectField(
      document,
      expectedId,
      'shadowMapExperiment.updateClass',
      dynamic ? 'dynamic' : 'static',
    );
  }
}

const nextStressObjects = document.scene.gameObjects.filter(object => isStressObjectId(object.id));
const changed = previousStressIds.length > 0 || nextStressObjects.length > 0;
if (changed) document = sdk.bumpEditorSceneAuthoringSourceRevision(document);
const assetLibrary = sdk.createEditorSceneAssetLibrary(assetManifest.map(entry => (
  entry.kind === 'model' ? { ...entry, materialMode: entry.materialMode ?? 'shared' } : entry
)));
const hydrated = sdk.enrichEditorSceneDocumentAssets(document, assetLibrary);
const compiled = sdk.compileEditorSceneDocumentToSceneConfig(hydrated, previousSceneConfig, {
  readCustomTransformRuntimeData: gameObject => (
    isGroundDecalUiConfig(gameObject.groundDecal)
      ? { groundDecal: structuredClone(gameObject.groundDecal) }
      : null
  ),
});
const compiledPlan = compiled.sceneConfig.plugins?.find(
  entry => entry.pluginId === 'fps.shadow-map-experiment',
)?.data;
const compiledStressObjects = compiledPlan?.objects?.filter(object => isStressObjectId(object.entityId)) ?? [];

const expectedCount = args.remove ? 0 : args.staticCount + args.dynamicCount;
if (nextStressObjects.length !== expectedCount) {
  throw new Error(`Authored stress fixture count mismatch: expected ${expectedCount}, got ${nextStressObjects.length}`);
}
if (compiledStressObjects.length !== expectedCount || compiledStressObjects.some(object => object.cast !== true)) {
  throw new Error(`Compiled stress fixture mismatch: expected ${expectedCount} active caster policies.`);
}

if (!args.dryRun) {
  await writeJson(editorScenePath, document);
  await writeJson(scenePath, compiled.sceneConfig);
}

console.log(JSON.stringify({
  dryRun: args.dryRun,
  remove: args.remove,
  editorStaticCount: nextStressObjects.filter(object => object.id.startsWith(EDITOR_STATIC_PREFIX)).length,
  editorDynamicCount: nextStressObjects.filter(object => object.id.startsWith(EDITOR_DYNAMIC_PREFIX)).length,
  compiledStressCasterCount: compiledStressObjects.length,
  authoringRevision: document.meta?.authoringSource?.revision ?? null,
}));

function parseArgs(values) {
  const remove = values.includes('--remove');
  const dryRun = values.includes('--dry-run');
  const staticCount = readCount(values, '--static', remove ? 0 : null);
  const dynamicCount = readCount(values, '--dynamic', remove ? 0 : null);
  if (!remove && staticCount === 0 && dynamicCount === 0) {
    throw new Error('Provide --static=<count> and/or --dynamic=<count>, or use --remove.');
  }
  return { remove, dryRun, staticCount, dynamicCount };
}

function readCount(values, name, fallback) {
  const raw = values.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
  if (raw === undefined && fallback !== null) return fallback;
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 0 || count > MAX_COUNT_PER_CLASS) {
    throw new Error(`${name} must be an integer between 0 and ${MAX_COUNT_PER_CLASS}.`);
  }
  return count;
}

function createGridPosition(index, total, columns) {
  const rows = Math.ceil(total / columns);
  return {
    x: (index % columns - (columns - 1) * 0.5) * GRID_SPACING,
    y: 0.72,
    z: (Math.floor(index / columns) - (rows - 1) * 0.5) * GRID_SPACING,
  };
}

function isStressObjectId(value) {
  return typeof value === 'string'
    && (value.startsWith(EDITOR_STATIC_PREFIX) || value.startsWith(EDITOR_DYNAMIC_PREFIX));
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

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
