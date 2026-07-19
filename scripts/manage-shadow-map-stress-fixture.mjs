#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const EDITOR_STATIC_PREFIX = 'shadow_stress_editor_static_';
const EDITOR_DYNAMIC_PREFIX = 'shadow_stress_editor_dynamic_';
const EDITOR_SKINNED_PREFIX = 'shadow_stress_editor_skinned_';
const EDITOR_ORDINARY_PREFIX = 'shadow_stress_editor_ordinary_';
const EDITOR_FOLIAGE_PREFIX = 'shadow_stress_editor_foliage_';
const EDITOR_COMPLEX_PREFIX = 'shadow_stress_editor_complex_';
const WORKER_ASSET_ID = 'asset_ade25007e0964563b197b21c2759c027';
const CHICKEN_ASSET_ID = 'asset_97121f40170c40d1aaf63b8c2cf0bf24';
const ORDINARY_ASSET_ID = 'asset_759b595e81934517ba0251b16bd31061';
const FOLIAGE_ASSET_IDS = [
  'asset_edc2f992438c4450afc1c6354ec21500',
  'asset_af82a4f117d84ff58bedb41aa11bad5c',
  'asset_e726be04042849088cf73e4f2f92c00f',
];
const COMPLEX_ASSET_ID = 'asset_9e7f1093a530405798a4140705e6bbea';
const MAX_COUNT_PER_CLASS = 2_000;
const GRID_SPACING = 0.55;
const SKINNED_GRID_SPACING = 1.35;

const args = parseArgs(process.argv.slice(2));
const projectRoot = process.cwd();
const editorScenePath = path.join(projectRoot, 'src/config/editor-scene.json');
const scenePath = path.join(projectRoot, 'src/config/scene.json');
const assetManifestPath = path.join(projectRoot, 'src/assets/generated/asset-catalog.manifest.json');
const shadowsConfigPath = path.join(projectRoot, 'src/config/shadows.json');
const sdk = await import('@fps-games/editor/playable-sdk');

let document = await readJson(editorScenePath);
const previousSceneConfig = await readJson(scenePath);
const assetManifest = await readJson(assetManifestPath);
let shadowMapExperimentConfig = await readJson(shadowsConfigPath);
const assetLibrary = sdk.createEditorSceneAssetLibrary(assetManifest.map(normalizeStressAssetCatalogEntry));
const workerAsset = assetLibrary.find(asset => asset.assetId === WORKER_ASSET_ID);
const chickenAsset = assetLibrary.find(asset => asset.assetId === CHICKEN_ASSET_ID);
const ordinaryAsset = assetLibrary.find(asset => asset.assetId === ORDINARY_ASSET_ID);
const foliageAssets = FOLIAGE_ASSET_IDS.map(assetId => assetLibrary.find(asset => asset.assetId === assetId));
const complexAsset = assetLibrary.find(asset => asset.assetId === COMPLEX_ASSET_ID);
const previousStressIds = document.scene.gameObjects
  .filter(object => isStressObjectId(object.id))
  .map(object => object.id);
let shadowSettingsChanged = false;

if (args.stressProfile) {
  const resolved = createTemporaryStressProfile(shadowMapExperimentConfig, args.stressProfile);
  shadowMapExperimentConfig = resolved.config;
  const previousSettings = document.scene.shadowMapExperiment ?? {};
  const nextSettings = {
    ...previousSettings,
    qualityProfile: resolved.qualityProfileId,
  };
  shadowSettingsChanged = JSON.stringify(previousSettings) !== JSON.stringify(nextSettings);
  document = {
    ...document,
    scene: { ...document.scene, shadowMapExperiment: nextSettings },
  };
}

if (args.shadowQuality) {
  const previousSettings = document.scene.shadowMapExperiment;
  if (!previousSettings || typeof previousSettings !== 'object' || Array.isArray(previousSettings)) {
    throw new Error('Unable to configure missing scene.shadowMapExperiment settings.');
  }
  const nextSettings = {
    ...previousSettings,
    qualityProfile: args.shadowQuality,
  };
  shadowSettingsChanged = JSON.stringify(previousSettings) !== JSON.stringify(nextSettings);
  document = {
    ...document,
    scene: {
      ...document.scene,
      shadowMapExperiment: nextSettings,
    },
  };
}

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
    document = sdk.patchEditorSceneGameObjectField(
      document,
      expectedId,
      'shadowMapExperiment.behaviorProfile',
      dynamic ? 'dynamic-caster' : 'static-caster',
    );
  }

  if (args.skinnedCount > 0 && !workerAsset) {
    throw new Error(`Unable to find skinned stress worker asset: ${WORKER_ASSET_ID}`);
  }
  const skinnedColumns = Math.min(8, Math.max(1, args.skinnedCount));
  for (let index = 0; index < args.skinnedCount; index += 1) {
    const expectedId = `${EDITOR_SKINNED_PREFIX}${String(index).padStart(4, '0')}`;
    const position = createSkinnedGridPosition(index, args.skinnedCount, skinnedColumns);
    const skinnedAsset = index % 2 === 0 ? workerAsset : chickenAsset ?? workerAsset;
    const creation = sdk.createEditorSceneAssetPlacementPatch({
      document,
      asset: skinnedAsset,
      hit: { position },
      name: expectedId,
    });
    if (creation.createdId !== expectedId) {
      throw new Error(`Editor skinned stress fixture identity drift: expected ${expectedId}, got ${creation.createdId}`);
    }
    document = sdk.applyEditorSceneDocumentMutationPatch({ document, patch: creation.patch });
    document = sdk.patchEditorSceneGameObjectField(document, expectedId, 'transform.scale', {
      x: 0.72,
      y: 0.72,
      z: 0.72,
    });
    document = sdk.patchEditorSceneGameObjectField(
      document,
      expectedId,
      'metadata.shadowStressSource',
      'editor-skinned',
    );
    document = sdk.patchEditorSceneGameObjectField(
      document,
      expectedId,
      'shadowMapExperiment.behaviorProfile',
      'skinned-dynamic',
    );
  }

  document = addAssetStressObjects(document, {
    sdk,
    asset: ordinaryAsset,
    count: args.ordinaryCount,
    prefix: EDITOR_ORDINARY_PREFIX,
    behaviorProfile: 'static-caster',
    scale: 0.35,
    rowOffset: 0,
  });
  for (let index = 0; index < args.foliageCount; index += 1) {
    document = addAssetStressObjects(document, {
      sdk,
      asset: foliageAssets[index % foliageAssets.length],
      count: 1,
      prefix: `${EDITOR_FOLIAGE_PREFIX}${String(index).padStart(4, '0')}_`,
      behaviorProfile: 'static-caster',
      scale: 0.28,
      rowOffset: 2.5 + index * 0.03,
    });
  }
  document = addAssetStressObjects(document, {
    sdk,
    asset: complexAsset,
    count: args.complexCount,
    prefix: EDITOR_COMPLEX_PREFIX,
    behaviorProfile: 'static-caster',
    scale: 0.08,
    rowOffset: 5,
  });
}

const nextStressObjects = document.scene.gameObjects.filter(object => isStressObjectId(object.id));
const changed = shadowSettingsChanged || previousStressIds.length > 0 || nextStressObjects.length > 0;
if (changed) document = sdk.bumpEditorSceneAuthoringSourceRevision(document);
const hydrated = sdk.enrichEditorSceneDocumentAssets(document, assetLibrary);
const compiled = sdk.compileEditorSceneDocumentToSceneConfig(hydrated, previousSceneConfig, {
  shadowMapExperimentConfig,
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

const expectedCount = args.remove ? 0 : args.staticCount + args.dynamicCount + args.skinnedCount
  + args.ordinaryCount + args.foliageCount + args.complexCount;
if (nextStressObjects.length !== expectedCount) {
  throw new Error(`Authored stress fixture count mismatch: expected ${expectedCount}, got ${nextStressObjects.length}`);
}
const expectedCompiledCount = args.stressProfile === 'disabled' ? 0 : expectedCount;
if (compiledStressObjects.length !== expectedCompiledCount || compiledStressObjects.some(object => object.cast !== true)) {
  throw new Error(`Compiled stress fixture mismatch: expected ${expectedCompiledCount} active caster policies.`);
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
  editorSkinnedCount: nextStressObjects.filter(object => object.id.startsWith(EDITOR_SKINNED_PREFIX)).length,
  editorOrdinaryCount: nextStressObjects.filter(object => object.id.startsWith(EDITOR_ORDINARY_PREFIX)).length,
  editorFoliageCount: nextStressObjects.filter(object => object.id.startsWith(EDITOR_FOLIAGE_PREFIX)).length,
  editorComplexCount: nextStressObjects.filter(object => object.id.startsWith(EDITOR_COMPLEX_PREFIX)).length,
  compiledStressCasterCount: compiledStressObjects.length,
  stressProfile: args.stressProfile,
  shadowQuality: document.scene.shadowMapExperiment?.qualityProfile ?? null,
  compiledShadowResolution: compiledPlan?.generator?.maps?.compositeResolution ?? null,
  compiledShadowFilter: compiledPlan?.generator?.filter ?? null,
  authoringRevision: document.meta?.authoringSource?.revision ?? null,
}));

function parseArgs(values) {
  const remove = values.includes('--remove');
  const dryRun = values.includes('--dry-run');
  const staticCount = readCount(values, '--static', remove ? 0 : null);
  const dynamicCount = readCount(values, '--dynamic', remove ? 0 : null);
  const skinnedCount = readCount(values, '--skinned', remove ? 0 : null);
  const ordinaryCount = readCount(values, '--ordinary', 0);
  const foliageCount = readCount(values, '--foliage', 0);
  const complexCount = readCount(values, '--complex', 0);
  const shadowQuality = readShadowQuality(values);
  const stressProfile = readStressProfile(values);
  if (!remove && staticCount === 0 && dynamicCount === 0 && skinnedCount === 0
    && ordinaryCount === 0 && foliageCount === 0 && complexCount === 0) {
    throw new Error('Provide at least one stress object count, or use --remove.');
  }
  return {
    remove,
    dryRun,
    staticCount,
    dynamicCount,
    skinnedCount,
    ordinaryCount,
    foliageCount,
    complexCount,
    shadowQuality,
    stressProfile,
  };
}

function readStressProfile(values) {
  const value = values.find(entry => entry.startsWith('--stress-profile='))?.slice('--stress-profile='.length);
  if (value === undefined) return null;
  if (!['disabled', 'hard-512', 'balanced-512', 'high-1024'].includes(value)) {
    throw new Error('--stress-profile must be disabled, hard-512, balanced-512, or high-1024.');
  }
  return value;
}

function createTemporaryStressProfile(config, profile) {
  const next = structuredClone(config);
  if (profile === 'disabled') {
    next.enabled = false;
    return { config: next, qualityProfileId: next.defaultQualityProfile };
  }
  const baseProfileId = profile === 'high-1024' ? 'high' : 'balanced';
  const base = next.qualityProfiles[baseProfileId];
  if (!base) throw new Error(`Missing base Shadow Map quality profile: ${baseProfileId}`);
  const qualityProfileId = `stress-${profile}`;
  next.qualityProfiles[qualityProfileId] = {
    ...structuredClone(base),
    maps: {
      staticResolution: profile === 'high-1024' ? 1024 : 512,
      dynamicResolution: profile === 'high-1024' ? 1024 : 512,
      compositeResolution: profile === 'high-1024' ? 1024 : 512,
    },
    receiverFilter: profile === 'hard-512' ? 'hard' : 'low-pcf',
  };
  return { config: next, qualityProfileId };
}

function readShadowQuality(values) {
  const value = values.find(entry => entry.startsWith('--shadow-quality='))?.slice('--shadow-quality='.length);
  if (value === undefined) return null;
  if (!['balanced', 'high'].includes(value)) {
    throw new Error('--shadow-quality must be balanced or high.');
  }
  return value;
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

function createSkinnedGridPosition(index, total, columns) {
  const rows = Math.ceil(total / columns);
  return {
    x: (index % columns - (columns - 1) * 0.5) * SKINNED_GRID_SPACING,
    y: 0,
    z: 7.8 + Math.floor(index / columns) * SKINNED_GRID_SPACING - (rows - 1) * SKINNED_GRID_SPACING * 0.5,
  };
}

function isStressObjectId(value) {
  return typeof value === 'string'
    && (
      value.startsWith(EDITOR_STATIC_PREFIX)
      || value.startsWith(EDITOR_DYNAMIC_PREFIX)
      || value.startsWith(EDITOR_SKINNED_PREFIX)
      || value.startsWith(EDITOR_ORDINARY_PREFIX)
      || value.startsWith(EDITOR_FOLIAGE_PREFIX)
      || value.startsWith(EDITOR_COMPLEX_PREFIX)
    );
}

function addAssetStressObjects(document, options) {
  if (options.count === 0) return document;
  if (!options.asset) throw new Error(`Unable to resolve stress asset for ${options.prefix}`);
  let nextDocument = document;
  const columns = Math.min(12, Math.max(1, options.count));
  for (let index = 0; index < options.count; index += 1) {
    const expectedId = `${options.prefix}${String(index).padStart(4, '0')}`;
    const position = {
      x: (index % columns - (columns - 1) * 0.5) * 0.9,
      y: 0,
      z: -9 + options.rowOffset + Math.floor(index / columns) * 0.8,
    };
    const creation = options.sdk.createEditorSceneAssetPlacementPatch({
      document: nextDocument,
      asset: options.asset,
      hit: { position },
      name: expectedId,
    });
    if (creation.createdId !== expectedId) {
      throw new Error(`Editor asset stress fixture identity drift: expected ${expectedId}, got ${creation.createdId}`);
    }
    nextDocument = options.sdk.applyEditorSceneDocumentMutationPatch({
      document: nextDocument,
      patch: creation.patch,
    });
    nextDocument = options.sdk.patchEditorSceneGameObjectField(
      nextDocument,
      expectedId,
      'transform.scale',
      { x: options.scale, y: options.scale, z: options.scale },
    );
    nextDocument = options.sdk.patchEditorSceneGameObjectField(
      nextDocument,
      expectedId,
      'metadata.shadowStressSource',
      'editor-mixed',
    );
    nextDocument = options.sdk.patchEditorSceneGameObjectField(
      nextDocument,
      expectedId,
      'shadowMapExperiment.behaviorProfile',
      options.behaviorProfile,
    );
  }
  return nextDocument;
}

function normalizeStressAssetCatalogEntry(entry) {
  if (entry.kind !== 'model') return entry;
  const materialSlots = entry.metadata?.materialSlots;
  return {
    ...entry,
    materialMode: entry.materialMode ?? 'shared',
    ...(Array.isArray(materialSlots) ? {
      metadata: {
        ...entry.metadata,
        materialSlots: materialSlots.map(slot => (
          Number.isInteger(slot.meshIndex) && typeof slot.sourceMeshName !== 'string'
            ? { ...slot, sourceMeshName: slot.label || slot.ownerNodePath }
            : slot
        )),
      },
    } : {}),
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

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
