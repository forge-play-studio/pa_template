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
  SceneNodeConfig,
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
    nodes: compiledGameObjects.map((gameObject) => compileGameObject(gameObject, sourceRef)),
    materialAssets: editorDocument.scene.materialAssets
      ? structuredClone(editorDocument.scene.materialAssets)
      : previousScene?.materialAssets ?? [],
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
): SceneNodeConfig {
  const transform = findEditorSceneTransform(gameObject);
  const modelRenderer = findEditorSceneModelRenderer(gameObject);
  const primitiveRenderer = findEditorScenePrimitiveRenderer(gameObject);
  const nodeKind = readEditorSceneNodeKind(gameObject);
  const visualOverrides = (nodeKind === 'instance' || nodeKind === 'transform' || nodeKind === 'primitive') && gameObject.overrides
    ? structuredClone(gameObject.overrides)
    : undefined;
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
