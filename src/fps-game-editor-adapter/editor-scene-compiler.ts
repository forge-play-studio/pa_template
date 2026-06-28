import {
  compileEditorSceneDocumentToSceneConfig as compileSdkEditorSceneDocumentToSceneConfig,
  PLAYABLE_EDITOR_SCENE_COMPILER_ID,
  PLAYABLE_EDITOR_SCENE_COMPILER_VERSION,
} from '@fps-games/editor/playable-sdk';
import type {
  EditorSceneDocument,
} from './editor-scene-document';
import type {
  SceneConfig,
} from '../config';

export const EDITOR_SCENE_COMPILER_ID = PLAYABLE_EDITOR_SCENE_COMPILER_ID;
export const EDITOR_SCENE_COMPILER_VERSION = PLAYABLE_EDITOR_SCENE_COMPILER_VERSION;

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
  return compileSdkEditorSceneDocumentToSceneConfig(editorDocument, baseSceneConfig);
}
