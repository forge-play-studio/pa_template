import type {
  Position3D,
  SceneConfig,
  SceneInstanceNode,
  SceneNodeConfig,
} from '../config';
import type {
  ProjectEditorPluginContext,
  ProjectPersistentBinding,
  ProjectPersistentBindingSnapshot,
} from './types';

export interface SceneNodeDuplicateCommandEntry {
  sourceBinding: ProjectPersistentBindingSnapshot;
  createdBinding: ProjectPersistentBindingSnapshot;
  parentNodeName: string | null;
  insertIndex: number;
  node: SceneInstanceNode;
}

function logDuplicate(message: string, data?: Record<string, unknown>): void {
  if (data) {
    console.log(`[ProjectEditor][Duplicate] ${message}`, data);
    return;
  }
  console.log(`[ProjectEditor][Duplicate] ${message}`);
}

export function canDuplicateSceneNodeBinding(binding: ProjectPersistentBinding): boolean {
  return binding.kind === 'sceneNode';
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureSceneNodes(sceneConfig: SceneConfig): SceneNodeConfig[] {
  if (!sceneConfig.scene || typeof sceneConfig.scene !== 'object') {
    sceneConfig.scene = {
      rootId: 'root',
      assets: [],
      nodes: [],
      materialAssets: [],
      materials: [],
      textures: [],
    };
  }
  if (!Array.isArray(sceneConfig.scene.nodes)) {
    sceneConfig.scene.nodes = [];
  }
  return sceneConfig.scene.nodes;
}

function getSceneBuilder(context?: ProjectEditorPluginContext): any | null {
  const game = context?.game as any;
  return game?.getSceneBuilder?.() ?? game?.sceneBuilder ?? null;
}

function resolveSavedParentNode(parentNodeName: string | null, context?: ProjectEditorPluginContext): any | null {
  if (!parentNodeName) return null;
  const sceneBuilder = getSceneBuilder(context);
  const rootNode = sceneBuilder?.getRootNode?.() ?? null;
  if (rootNode?.name === parentNodeName) return rootNode;
  const scene = (context?.scene as any) ?? (context?.game as any)?.scene ?? null;
  return scene?.getNodeByName?.(parentNodeName) ?? null;
}

function resolveDuplicateParent(
  entry: SceneNodeDuplicateCommandEntry,
  context?: ProjectEditorPluginContext,
  sourceNodeHint?: any,
): any | null {
  const savedParent = resolveSavedParentNode(entry.parentNodeName, context);
  if (savedParent) return savedParent;

  const hintedParent = sourceNodeHint?.parent ?? null;
  if (hintedParent) return hintedParent;

  const sourceRootNode =
    context?.game && typeof (context.game as any).getSceneNodeRuntime === 'function'
      ? (context.game as any).getSceneNodeRuntime(entry.sourceBinding.nodeId)
      : null;
  return sourceRootNode?.parent ?? null;
}

function addRuntimeSceneNode(
  node: SceneInstanceNode,
  context?: ProjectEditorPluginContext,
  parent?: any,
): any | null {
  const sceneBuilder = getSceneBuilder(context);
  if (!sceneBuilder?.addSceneNodeFromConfig) return null;
  return sceneBuilder.addSceneNodeFromConfig(cloneJson(node), parent ?? null);
}

function removeRuntimeSceneNode(nodeId: string, context?: ProjectEditorPluginContext): boolean {
  const sceneBuilder = getSceneBuilder(context);
  return sceneBuilder?.removeSceneNode?.(nodeId) ?? false;
}

function createDuplicateInstanceId(sourceId: string, sceneConfig: SceneConfig): string {
  const existingIds = new Set(ensureSceneNodes(sceneConfig).map((node) => node.id));
  const baseId = `${sourceId}_copy`;
  if (!existingIds.has(baseId)) return baseId;

  let suffix = 2;
  while (existingIds.has(`${baseId}_${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}_${suffix}`;
}

function getDuplicateOffset(node: any): Position3D {
  void node;
  return { x: 0, y: 0, z: 0 };
}

function buildDuplicatedSceneNode(
  source: SceneInstanceNode,
  nextId: string,
  node: any,
): SceneInstanceNode {
  const duplicated = cloneJson(source);
  duplicated.id = nextId;
  const offset = getDuplicateOffset(node);
  const originalPosition = duplicated.transform?.position ?? { x: 0, y: 0, z: 0 };
  duplicated.transform = {
    ...(duplicated.transform ?? {}),
    position: {
      x: originalPosition.x + offset.x,
      y: originalPosition.y + offset.y,
      z: originalPosition.z + offset.z,
    },
  };
  return duplicated;
}

export function createSceneNodeDuplicateEntry(args: {
  binding: ProjectPersistentBinding;
  node: any;
  workingCopy: SceneConfig;
}): SceneNodeDuplicateCommandEntry | null {
  if (args.binding.kind !== 'sceneNode') return null;

  const sceneNodes = ensureSceneNodes(args.workingCopy);
  const sourceIndex = sceneNodes.findIndex(
    (node) => node.id === args.binding.nodeId && node.kind === 'instance',
  );
  if (sourceIndex < 0) return null;

  const sourceInstance = sceneNodes[sourceIndex];
  if (sourceInstance.kind !== 'instance') return null;
  const duplicatedInstance = buildDuplicatedSceneNode(
    sourceInstance,
    createDuplicateInstanceId(args.binding.nodeId, args.workingCopy),
    args.node,
  );

  const entry: SceneNodeDuplicateCommandEntry = {
    sourceBinding: { kind: 'sceneNode', nodeId: args.binding.nodeId },
    createdBinding: { kind: 'sceneNode', nodeId: duplicatedInstance.id },
    parentNodeName: args.node?.parent?.name ?? null,
    insertIndex: sourceIndex + 1,
    node: duplicatedInstance,
  };

  logDuplicate('created duplicate command entry', {
    sourceNodeId: entry.sourceBinding.nodeId,
    createdNodeId: entry.createdBinding.nodeId,
    parentNodeName: entry.parentNodeName,
    sourceParentName: args.node?.parent?.name ?? null,
  });

  return entry;
}

export function applySceneNodeDuplicateEntry(
  entry: SceneNodeDuplicateCommandEntry,
  workingCopy: SceneConfig,
  context?: ProjectEditorPluginContext,
  sourceNodeHint?: any,
): { rootNode?: any } | null {
  const sceneNodes = ensureSceneNodes(workingCopy);
  const existingIndex = sceneNodes.findIndex((node) => node.id === entry.createdBinding.nodeId);
  if (existingIndex < 0) {
    const insertIndex = Math.max(0, Math.min(entry.insertIndex, sceneNodes.length));
    sceneNodes.splice(insertIndex, 0, cloneJson(entry.node));
  }

  const parent = resolveDuplicateParent(entry, context, sourceNodeHint);
  logDuplicate('applying duplicate entry', {
    sourceNodeId: entry.sourceBinding.nodeId,
    createdNodeId: entry.createdBinding.nodeId,
    parentNodeName: entry.parentNodeName,
    resolvedParentName: parent?.name ?? null,
    sourceNodeHintParentName: sourceNodeHint?.parent?.name ?? null,
  });
  const rootNode = addRuntimeSceneNode(entry.node, context, parent);
  if (!rootNode) {
    const createdIndex = sceneNodes.findIndex((node) => node.id === entry.createdBinding.nodeId);
    if (createdIndex >= 0) {
      sceneNodes.splice(createdIndex, 1);
    }
    return null;
  }

  logDuplicate('duplicate entry applied', {
    createdNodeId: entry.createdBinding.nodeId,
    actualParentName: rootNode.parent?.name ?? null,
  });

  return { rootNode };
}

export function undoSceneNodeDuplicateEntry(
  entry: SceneNodeDuplicateCommandEntry,
  workingCopy: SceneConfig,
  context?: ProjectEditorPluginContext,
): { selectedRootNode?: any | null } {
  const sceneNodes = ensureSceneNodes(workingCopy);
  const createdIndex = sceneNodes.findIndex((node) => node.id === entry.createdBinding.nodeId);
  if (createdIndex >= 0) {
    sceneNodes.splice(createdIndex, 1);
  }
  removeRuntimeSceneNode(entry.createdBinding.nodeId, context);

  const sourceRootNode =
    context?.game && typeof (context.game as any).getSceneNodeRuntime === 'function'
      ? (context.game as any).getSceneNodeRuntime(entry.sourceBinding.nodeId)
      : null;

  logDuplicate('duplicate entry undone', {
    sourceNodeId: entry.sourceBinding.nodeId,
    createdNodeId: entry.createdBinding.nodeId,
    parentNodeName: entry.parentNodeName,
    selectedRootNodeName: sourceRootNode?.name ?? null,
  });

  return {
    selectedRootNode: sourceRootNode ?? null,
  };
}

export function redoSceneNodeDuplicateEntry(
  entry: SceneNodeDuplicateCommandEntry,
  workingCopy: SceneConfig,
  context?: ProjectEditorPluginContext,
): { selectedRootNode?: any | null } | null {
  logDuplicate('redo duplicate entry requested', {
    sourceNodeId: entry.sourceBinding.nodeId,
    createdNodeId: entry.createdBinding.nodeId,
    parentNodeName: entry.parentNodeName,
  });
  const applied = applySceneNodeDuplicateEntry(entry, workingCopy, context);
  if (!applied) return null;
  logDuplicate('redo duplicate entry finished', {
    createdNodeId: entry.createdBinding.nodeId,
    actualParentName: applied.rootNode?.parent?.name ?? null,
  });
  return {
    selectedRootNode: applied.rootNode ?? null,
  };
}
