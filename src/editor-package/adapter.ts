import {
  applyProjectDocumentChange,
  canRedoProjectEditorDocumentChange,
  canUndoProjectEditorDocumentChange,
  commitProjectEditorDocumentSave,
  duplicateProjectEditorSelection,
  exportProjectEditorDocument,
  isProjectEditorDocumentDirty,
  redoProjectEditorDocumentChange,
  undoProjectEditorDocumentChange,
} from './document';
import { canDuplicateSceneNodeBinding } from './scene-node-duplicate';
import type {
  ProjectEditorPlugin,
  ProjectPersistentBinding,
} from './types';

const NODE_ID_HINT_KEYS = ['sceneNodeId', 'configId', 'nodeId'] as const;

function getSceneBuilder(game: any): any | null {
  return game?.getSceneBuilder?.() ?? game?.sceneBuilder ?? null;
}

function getSceneNodeRuntimeMap(game: any): Map<string, any> | null {
  const sceneBuilder = getSceneBuilder(game);
  const sceneNodeRuntimes = sceneBuilder?.sceneNodeRuntimes;
  if (sceneNodeRuntimes && typeof sceneNodeRuntimes.entries === 'function') {
    return sceneNodeRuntimes as Map<string, any>;
  }
  return null;
}

function toStringId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveSceneNodeRoot(nodeId: string, game: any): any | null {
  if (game && typeof game.getSceneNodeRuntime === 'function') {
    const resolved = game.getSceneNodeRuntime(nodeId);
    if (resolved) return resolved;
  }
  return getSceneNodeRuntimeMap(game)?.get(nodeId) ?? null;
}

function findSceneNodeBinding(node: any, game: any): Extract<ProjectPersistentBinding, { kind: 'sceneNode' }> | null {
  const sceneNodeRuntimes = getSceneNodeRuntimeMap(game);
  if (!sceneNodeRuntimes) return null;

  const uidMap = new Map<number, { id: string; node: any }>();
  for (const [id, registeredNode] of sceneNodeRuntimes.entries()) {
    const uid = registeredNode?.uniqueId;
    if (typeof uid === 'number') uidMap.set(uid, { id: String(id), node: registeredNode });
  }
  if (uidMap.size === 0) return null;

  let current: any = node;
  while (current) {
    const uid = current?.uniqueId;
    if (typeof uid === 'number') {
      const match = uidMap.get(uid);
      if (match) return { kind: 'sceneNode', nodeId: match.id, rootNode: current };
    }
    current = current?.parent || null;
  }

  return null;
}

function findMetadataSceneNodeBinding(node: any, game: any): Extract<ProjectPersistentBinding, { kind: 'sceneNode' }> | null {
  let current: any = node;
  while (current) {
    const metadata = current?.metadata;
    if (metadata && typeof metadata === 'object') {
      for (const key of NODE_ID_HINT_KEYS) {
        const nodeId = toStringId(metadata[key]);
        if (!nodeId) continue;
        const rootNode = resolveSceneNodeRoot(nodeId, game) ?? current;
        return { kind: 'sceneNode', nodeId, rootNode };
      }
    }
    current = current?.parent || null;
  }
  return null;
}

function resolveProjectPersistentBinding(node: any, game: any): ProjectPersistentBinding | null {
  const sceneNodeBinding = findSceneNodeBinding(node, game);
  if (sceneNodeBinding) return sceneNodeBinding;

  const metadataBinding = findMetadataSceneNodeBinding(node, game);
  if (metadataBinding) return metadataBinding;

  return null;
}

export const paScaffoldEditorPlugin: ProjectEditorPlugin = {
  id: 'pa-scaffold',
  normalizeSelection({ source, rawEntity, context }) {
    if (!rawEntity || typeof rawEntity !== 'object') return null;
    if (source !== 'viewport') return rawEntity;

    const binding = resolveProjectPersistentBinding(rawEntity, context.game);
    return binding?.rootNode ?? rawEntity;
  },
  resolvePersistentBinding(node, context) {
    return resolveProjectPersistentBinding(node, context.game);
  },
  applyDocumentChange({ binding, node, prop, oldValue, newValue }) {
    if (!binding || !node) return false;
    return applyProjectDocumentChange(binding, node, prop, oldValue, newValue);
  },
  duplicateSelection({ binding, node, context }) {
    if (!binding || !node || !canDuplicateSceneNodeBinding(binding)) return null;
    return duplicateProjectEditorSelection(binding, node, context);
  },
  isDirty() {
    return isProjectEditorDocumentDirty();
  },
  canUndo() {
    return canUndoProjectEditorDocumentChange();
  },
  canRedo() {
    return canRedoProjectEditorDocumentChange();
  },
  undoDocumentChange(context) {
    return undoProjectEditorDocumentChange(context);
  },
  redoDocumentChange(context) {
    return redoProjectEditorDocumentChange(context);
  },
  exportDocument() {
    return exportProjectEditorDocument();
  },
  commitSavedDocument(args, context) {
    return commitProjectEditorDocumentSave(args, context);
  },
};
