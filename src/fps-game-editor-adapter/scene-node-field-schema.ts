import {
  EDITOR_SCENE_FIELD_SCHEMA,
  resolveEditorSceneFieldSchema,
  isEditorSceneShadowMode,
  type EditorSceneFieldPatch,
  type EditorSceneFieldSchemaEntry,
} from '@fps-games/editor/playable-sdk';
import type { SceneNodeConfig } from '../config';

export type SceneNodeFieldPatch = EditorSceneFieldPatch;

type SceneNodeFieldSchemaEntry = EditorSceneFieldSchemaEntry<SceneNodeConfig['kind']>;

export const SCENE_NODE_FIELD_SCHEMA = EDITOR_SCENE_FIELD_SCHEMA as ReadonlyArray<SceneNodeFieldSchemaEntry>;

export function resolveSceneNodeFieldSchema(
  path: string,
  nodeKind: SceneNodeConfig['kind'],
): SceneNodeFieldSchemaEntry | null {
  if (path === 'shadowMode' && nodeKind !== 'group') {
    return {
      path: 'shadowMode',
      appliesTo: ['instance', 'transform', 'primitive'],
      validate: (value) => value == null || isEditorSceneShadowMode(value),
    };
  }
  return resolveEditorSceneFieldSchema(path, nodeKind) as SceneNodeFieldSchemaEntry | null;
}
