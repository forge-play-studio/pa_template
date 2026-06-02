import type {
  EditorSceneMaterialAsset,
} from '@fps-games/editor/playable-sdk';
import {
  resolveEditorSceneMaterialAssetIntegrity,
} from '@fps-games/editor/playable-sdk';
import type {
  EditorSceneAsset,
  EditorSceneCameraRig,
  EditorSceneDocument,
  EditorSceneGameObject,
  EditorSceneLight,
} from './editor-scene-document';
import {
  findEditorSceneModelRenderer,
  findEditorScenePrimitiveRenderer,
  findEditorSceneTransform,
  readEditorSceneNodeKind,
} from './editor-scene-document';
import type {
  SceneAssetConfig,
  SceneCompiledArtifactProvenance,
  SceneConfig,
  SceneGroupNode,
  SceneInstanceNode,
  SceneMaterialAssetConfig,
  SceneNodeMaterialBindingConfig,
  SceneNodeConfig,
  SceneNodeVisualOverrides,
  ScenePrimitiveNode,
  SceneRuntimeSourceBinding,
  SceneTransformNode,
} from '../config';
import { getEditorSceneAuthoringSourceRef } from './editor-authoring-source';

const EDITOR_SCENE_COMPILER_ID = 'pa_template.editor-scene.compiler';
const EDITOR_SCENE_COMPILER_VERSION = '1';

export interface CompiledEditorSceneSummary {
  assetCount: number;
  gameObjectCount: number;
  nodeCount: number;
}

export interface CompileEditorSceneResult {
  sceneConfig: SceneConfig;
  summary: CompiledEditorSceneSummary;
}

export function compileEditorSceneDocumentToSceneConfig(
  editorDocument: EditorSceneDocument,
  baseSceneConfig: SceneConfig,
): CompileEditorSceneResult {
  const nextSceneConfig: SceneConfig = structuredClone(baseSceneConfig);
  const previousScene = nextSceneConfig.scene;
  const sourceRef = getEditorSceneAuthoringSourceRef(editorDocument);
  const generatedFrom: SceneCompiledArtifactProvenance = {
    ...sourceRef,
    compilerId: EDITOR_SCENE_COMPILER_ID,
    compilerVersion: EDITOR_SCENE_COMPILER_VERSION,
    compiledAt: new Date().toISOString(),
  };
  nextSceneConfig.schemaVersion = 2;
  nextSceneConfig.meta = {
    ...(nextSceneConfig.meta ?? {}),
    generatedFrom,
  };
  const rootId = previousScene?.rootId || 'root';
  const compiledGameObjects = editorDocument.scene.gameObjects
    .filter((gameObject) => gameObject.id !== rootId);
  nextSceneConfig.scene = {
    rootId,
    assets: editorDocument.assets.map(compileAsset),
    nodes: compiledGameObjects.map((gameObject) => compileGameObject(gameObject, sourceRef, editorDocument)),
    materialAssets: resolveCompiledEditorSceneMaterialAssets(editorDocument, previousScene?.materialAssets),
    materials: previousScene?.materials ?? [],
    textures: previousScene?.textures ?? [],
  };

  return {
    sceneConfig: nextSceneConfig,
    summary: {
      assetCount: nextSceneConfig.scene.assets.length,
      gameObjectCount: editorDocument.scene.gameObjects.length,
      nodeCount: nextSceneConfig.scene.nodes.length,
    },
  };
}

function resolveCompiledEditorSceneMaterialAssets(
  editorDocument: EditorSceneDocument,
  previousMaterialAssets: readonly SceneMaterialAssetConfig[] | undefined,
): SceneMaterialAssetConfig[] {
  const materialAssets: SceneMaterialAssetConfig[] = editorDocument.scene.materialAssets
    ? structuredClone(editorDocument.scene.materialAssets)
    : (previousMaterialAssets ?? []).map(materialAsset => structuredClone(materialAsset));
  const materialAssetIds = new Set(materialAssets.map(materialAsset => materialAsset.id));
  const previousMaterialAssetById = new Map(
    (previousMaterialAssets ?? []).map(materialAsset => [materialAsset.id, materialAsset]),
  );
  const integrity = resolveEditorSceneMaterialAssetIntegrity({
    ...editorDocument,
    scene: {
      ...editorDocument.scene,
      materialAssets: materialAssets as EditorSceneMaterialAsset[],
    },
  });
  for (const materialAssetId of integrity.missingMaterialAssetIds) {
    if (materialAssetIds.has(materialAssetId)) continue;
    const previousMaterialAsset = previousMaterialAssetById.get(materialAssetId);
    if (!previousMaterialAsset) continue;
    materialAssetIds.add(materialAssetId);
    materialAssets.push(structuredClone(previousMaterialAsset));
  }
  return materialAssets;
}

function compileAsset(asset: EditorSceneAsset): SceneAssetConfig {
  return {
    id: asset.id,
    type: asset.type,
    ...(asset.guid ? { guid: asset.guid } : {}),
    ...(asset.displayName ? { displayName: asset.displayName } : {}),
    ...(asset.category ? { category: asset.category } : {}),
    ...(asset.materialMode ? { materialMode: asset.materialMode } : {}),
    ...(asset.defaults ? { defaults: structuredClone(asset.defaults) } : {}),
    ...(asset.external ? { external: structuredClone(asset.external) } : {}),
    ...(asset.metadata ? { metadata: structuredClone(asset.metadata) } : {}),
  };
}

function compileGameObject(
  gameObject: EditorSceneGameObject,
  sourceRef: SceneRuntimeSourceBinding,
  editorDocument: EditorSceneDocument,
): SceneNodeConfig {
  const transform = findEditorSceneTransform(gameObject);
  const modelRenderer = findEditorSceneModelRenderer(gameObject);
  const primitiveRenderer = findEditorScenePrimitiveRenderer(gameObject);
  const nodeKind = readEditorSceneNodeKind(gameObject);
  const visualOverrides = compileEditorSceneVisualOverrides(gameObject, editorDocument);
  const source: SceneRuntimeSourceBinding = {
    sourceId: sourceRef.sourceId,
    sourceType: sourceRef.sourceType,
    revision: sourceRef.revision,
    ...(gameObject.guid ? { objectGuid: gameObject.guid } : {}),
    objectId: gameObject.id,
    component: modelRenderer ? 'ModelRenderer' : (primitiveRenderer || nodeKind === 'primitive') ? 'PrimitiveRenderer' : nodeKind === 'transform' ? 'Transform' : 'GameObject',
  };
  const base = {
    id: gameObject.id,
    ...(gameObject.name ? { name: gameObject.name } : {}),
    ...(gameObject.parentId ? { parentId: gameObject.parentId } : {}),
    ...(gameObject.active === false ? { enabled: false } : {}),
    source,
    ...(transform
      ? {
          transform: {
            position: transform.position,
            rotation: transform.rotation,
            ...(transform.scale ? { scale: transform.scale } : {}),
          },
        }
      : {}),
  };

  if (nodeKind === 'primitive') {
    return {
      ...base,
      kind: 'primitive',
      primitive: {
        shape: primitiveRenderer?.shape ?? 'cube',
      },
      ...(visualOverrides ? { overrides: visualOverrides } : {}),
    } satisfies ScenePrimitiveNode;
  }

  if (!modelRenderer) {
    if (nodeKind === 'transform') {
      return {
        ...base,
        kind: 'transform',
        ...(gameObject.transformType ? { transformType: gameObject.transformType } : {}),
        ...(gameObject.camera ? { camera: compileEditorSceneCamera(gameObject.camera) } : {}),
        ...(gameObject.light ? { light: compileEditorSceneLight(gameObject.light) } : {}),
        ...(gameObject.groundDecal ? { groundDecal: structuredClone(gameObject.groundDecal) } : {}),
        ...(visualOverrides ? { overrides: visualOverrides } : {}),
      } satisfies SceneTransformNode;
    }
    return {
      ...base,
      kind: 'group',
    } satisfies SceneGroupNode;
  }

  return {
    ...base,
    kind: 'instance',
    instance: {
      assetId: modelRenderer.assetId,
    },
    ...(visualOverrides ? { overrides: visualOverrides } : {}),
  } satisfies SceneInstanceNode;
}

function compileEditorSceneVisualOverrides(
  gameObject: EditorSceneGameObject,
  editorDocument: EditorSceneDocument,
): SceneNodeVisualOverrides | undefined {
  const nodeKind = readEditorSceneNodeKind(gameObject);
  if (nodeKind !== 'instance' && nodeKind !== 'transform' && nodeKind !== 'primitive') return undefined;
  if (!gameObject.overrides) return undefined;
  const modelRenderer = findEditorSceneModelRenderer(gameObject);
  const asset = modelRenderer ? editorDocument.assets.find((entry) => entry.id === modelRenderer.assetId) : undefined;
  return migrateSceneMaterialSlotBindings(structuredClone(gameObject.overrides), asset);
}

function migrateSceneMaterialSlotBindings(
  overrides: SceneNodeVisualOverrides,
  asset: EditorSceneAsset | undefined,
): SceneNodeVisualOverrides {
  const materialSlots = collectCompiledEditorSceneMaterialSlots(asset);
  if (materialSlots.length === 0 || !overrides.childMaterialBindings) return overrides;
  const materialSlotBindings: Record<string, SceneNodeMaterialBindingConfig> = {
    ...(overrides.materialSlotBindings ?? {}),
  };
  const childMaterialBindings: Record<string, SceneNodeMaterialBindingConfig> = {
    ...overrides.childMaterialBindings,
  };
  for (const slot of materialSlots) {
    const legacy = findLegacySceneMaterialSlotBinding(childMaterialBindings, slot.ownerNodePath);
    const legacyBinding = legacy?.binding;
    if (!legacyBinding || materialSlotBindings[slot.slotId]) continue;
    materialSlotBindings[slot.slotId] = structuredClone(legacyBinding);
    delete childMaterialBindings[legacy.ownerNodePath];
  }
  if (Object.keys(materialSlotBindings).length > 0) overrides.materialSlotBindings = materialSlotBindings;
  if (Object.keys(childMaterialBindings).length > 0) overrides.childMaterialBindings = childMaterialBindings;
  else delete overrides.childMaterialBindings;
  return overrides;
}

function collectCompiledEditorSceneMaterialSlots(
  asset: EditorSceneAsset | undefined,
): Array<{ slotId: string; ownerNodePath: string }> {
  const rawSlots = Array.isArray(asset?.metadata?.materialSlots) ? asset.metadata.materialSlots : [];
  const slots: Array<{ slotId: string; ownerNodePath: string }> = [];
  for (const rawSlot of rawSlots) {
    if (!rawSlot || typeof rawSlot !== 'object' || Array.isArray(rawSlot)) continue;
    const record = rawSlot as Record<string, unknown>;
    const slotId = typeof record.slotId === 'string' ? record.slotId.trim() : '';
    const ownerNodePath = normalizeSceneMaterialSlotMigrationOwnerPath(
      typeof record.ownerNodePath === 'string'
        ? record.ownerNodePath
        : typeof record.path === 'string'
          ? record.path
          : '',
    );
    if (slotId && ownerNodePath) slots.push({ slotId, ownerNodePath });
  }
  return slots;
}

function findLegacySceneMaterialSlotBinding(
  childMaterialBindings: Record<string, SceneNodeMaterialBindingConfig>,
  ownerNodePath: string,
): { ownerNodePath: string; binding: SceneNodeMaterialBindingConfig } | null {
  const exact = childMaterialBindings[ownerNodePath];
  if (exact) return { ownerNodePath, binding: exact };
  const normalizedOwnerNodePath = normalizeSceneMaterialSlotMigrationOwnerPath(ownerNodePath);
  for (const [legacyOwnerNodePath, binding] of Object.entries(childMaterialBindings)) {
    if (normalizeSceneMaterialSlotMigrationOwnerPath(legacyOwnerNodePath) === normalizedOwnerNodePath) {
      return { ownerNodePath: legacyOwnerNodePath, binding };
    }
  }
  return null;
}

function normalizeSceneMaterialSlotMigrationOwnerPath(ownerNodePath: string): string {
  return String(ownerNodePath ?? '').split('/').filter(Boolean).join('/');
}

function compileEditorSceneCamera(camera: EditorSceneCameraRig): SceneTransformNode['camera'] {
  const compiled = structuredClone(camera) as EditorSceneCameraRig;
  delete compiled.inspectorLanguage;
  return compiled;
}

function compileEditorSceneLight(light: EditorSceneLight): SceneTransformNode['light'] {
  const compiled = structuredClone(light) as EditorSceneLight;
  delete compiled.inspectorLanguage;
  return compiled;
}
