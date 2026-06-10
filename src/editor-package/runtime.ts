import type { ProjectEditorDocumentCommitArgs, ProjectEditorDocumentExport, ProjectEditorRuntime } from './types';
import { paScaffoldEditorPlugin } from './adapter';
import {
  canRedoProjectEditorDocumentChange,
  canUndoProjectEditorDocumentChange,
  commitProjectEditorDocumentSave,
  ensureProjectEditorDocumentLoaded,
  exportProjectEditorDocument,
  isProjectEditorDocumentDirty,
  loadProjectEditorDocument,
  redoProjectEditorDocumentChange,
  undoProjectEditorDocumentChange,
} from './document';
import { createProjectEditSession } from './runtime-core/edit-session';
import { createProjectInspectorHost } from './runtime-core/inspector-host';
import { createProjectRuntimeMonitor, type ProjectRuntimeMonitorChange } from './runtime-core/monitor';
import { createProjectSelectionController } from './runtime-core/selection-controller';

const COMMAND_NAME = {
  // forge-play contract commands (see docs/editor-game-api.md):
  MODE_CHANGE: 'mode:change',
  DOCUMENT_RESTORE: 'document:restore',
  DOCUMENT_EXPORT: 'document:export',
  DOCUMENT_COMMIT: 'document:commit',
  // pa_template internal extensions (must use template prefix):
  UNDO: 'babylon:historyUndo',
  REDO: 'babylon:historyRedo',
  INSPECTOR_FLUSH: 'babylon:inspectorFlush',
} as const;

const EVENT_NAME = {
  // forge-play contract events:
  MODE_CHANGED: 'mode:changed',
  DOCUMENT_CHANGED: 'document:changed',
  DOCUMENT_EXPORTED: 'document:exported',
  SELECTION_CHANGED: 'selection:changed',
  EDIT_APPLIED: 'edit:applied',
  // pa_template internal extensions:
  INSPECTOR_FLUSHED: 'babylon:inspectorFlushed',
} as const;

const MODE = {
  EDIT: 'edit',
  PLAY: 'play',
} as const;

function logRuntime(message: string, data?: Record<string, unknown>): void {
  if (data) {
    console.log(`[ProjectEditor][Runtime] ${message}`, data);
    return;
  }
  console.log(`[ProjectEditor][Runtime] ${message}`);
}

function hasSceneJsonText(exported: ProjectEditorDocumentExport | null): exported is NonNullable<ProjectEditorDocumentExport> {
  return Boolean(exported && typeof exported.sceneJsonText === 'string' && exported.sceneJsonText.length > 0);
}

function toCommitArgs(params: Record<string, any>): ProjectEditorDocumentCommitArgs {
  return {
    ...(typeof params.version === 'number' ? { version: params.version } : {}),
    ...(typeof params.updatedAt === 'string' ? { updatedAt: params.updatedAt } : {}),
    ...(typeof params.sceneJsonText === 'string' ? { sceneJsonText: params.sceneJsonText } : {}),
    ...(typeof params.scenePath === 'string' ? { scenePath: params.scenePath } : {}),
  };
}

function summarizeCommitArgs(args: ProjectEditorDocumentCommitArgs): Record<string, unknown> {
  return {
    version: typeof args.version === 'number' ? args.version : null,
    updatedAt: typeof args.updatedAt === 'string' ? args.updatedAt : null,
    scenePath: typeof args.scenePath === 'string' ? args.scenePath : null,
    hasSceneJsonText: typeof args.sceneJsonText === 'string',
    sceneJsonTextLength: typeof args.sceneJsonText === 'string' ? args.sceneJsonText.length : 0,
  };
}

function emitBridgeEvent(name: string, data: Record<string, any>): void {
  const messenger = window.__bridge?.messenger as { event?: (eventName: string, payload: Record<string, any>) => void } | undefined;
  if (messenger?.event) {
    messenger.event(name, data);
    return;
  }

  try {
    window.parent?.postMessage?.({
      source: 'forge-play-game-bridge',
      type: 'event',
      payload: { name, ...data },
      timestamp: Date.now(),
    }, '*');
  } catch {}
}

function emitEditApplied(data: Record<string, any>): void {
  emitBridgeEvent(EVENT_NAME.EDIT_APPLIED, data);
}

function resolveProjectPluginContext(scene?: any | null) {
  const game = (window as any).gameInstance ?? null;
  const resolvedScene = scene ?? game?.scene ?? null;
  return { scene: resolvedScene, game };
}

function readAxis(value: any, axis: 'x' | 'y' | 'z'): number | null {
  if (!value || typeof value !== 'object') return null;
  const direct = value[axis];
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct;
  const hidden = value[`_${axis}`];
  if (typeof hidden === 'number' && Number.isFinite(hidden)) return hidden;
  return null;
}

function cloneVec3Like(value: any): { x: number; y: number; z: number } | null {
  const x = readAxis(value, 'x');
  const y = readAxis(value, 'y');
  const z = readAxis(value, 'z');
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

function readRotation(node: any): { x: number; y: number; z: number } | null {
  const quat = node?.rotationQuaternion;
  if (quat && typeof quat.toEulerAngles === 'function') {
    return cloneVec3Like(quat.toEulerAngles());
  }
  return cloneVec3Like(node?.rotation);
}

function extractTransform(node: any): Record<string, unknown> | null {
  if (!node) return null;
  const position = cloneVec3Like(node.position);
  const rotation = readRotation(node);
  const scaling = cloneVec3Like(node.scaling);
  if (!position || !rotation || !scaling) return null;
  return { position, rotation, scaling };
}

function serializeEntity(node: any, binding: any): Record<string, unknown> {
  const parent = node?.parent ?? null;
  const material = node?.material;
  const persistentBinding = binding?.kind === 'sceneNode'
    ? { kind: 'sceneNode', nodeId: binding.nodeId }
    : null;
  return {
    name: node?.name ?? node?.id ?? '?',
    id: node?.id ?? null,
    uniqueId: node?.uniqueId ?? null,
    type: node?.getClassName?.() || node?.constructor?.name || 'Unknown',
    metadata: node?.metadata ?? null,
    ...(persistentBinding ? { persistentBinding } : {}),
    parent: parent
      ? {
        name: parent?.name ?? parent?.id ?? '?',
        id: parent?.uniqueId ?? parent?.id ?? null,
        type: parent?.getClassName?.() || parent?.constructor?.name || 'Unknown',
      }
      : null,
    transform: extractTransform(node),
    material: material
      ? {
        name: material?.name ?? null,
        type: material?.getClassName?.() || material?.constructor?.name || 'Unknown',
      }
      : null,
  };
}

function buildContextChanges(changes: ProjectRuntimeMonitorChange[]): Record<string, unknown>[] {
  return changes.map((change) => ({
    entity: serializeEntity(change.obj, change.binding),
    property: {
      path: change.prop,
      name: change.prop.split('.').pop() ?? change.prop,
    },
    change: {
      from: change.old,
      to: change.new,
    },
    timestamp: change.time,
  }));
}

function publishDocumentStatus(): void {
  emitEditApplied({
    changes: [],
    documentStatus: {
      dirty: isProjectEditorDocumentDirty(),
      canUndo: canUndoProjectEditorDocumentChange(),
      canRedo: canRedoProjectEditorDocumentChange(),
    },
  });
}

function parseSceneData(sceneData: Record<string, any> | string): Record<string, any> | null {
  if (typeof sceneData === 'string') {
    try {
      const parsed = JSON.parse(sceneData);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : null;
    } catch {
      return null;
    }
  }
  return sceneData && typeof sceneData === 'object' ? sceneData : null;
}

function warmupInspectorReady(): void {
  const ensureInspectorReady = (window as any).ensureInspectorReady;
  if (typeof ensureInspectorReady !== 'function') return;
  void Promise.resolve()
    .then(() => ensureInspectorReady())
    .catch(() => {});
}

export function createProjectEditorRuntimeBridge(): ProjectEditorRuntime {
  let selfRuntime: ProjectEditorRuntime;
  let pendingScene: any | null = null;
  let lastKnownSelection: any | null = null;
  let projectMonitor: ReturnType<typeof createProjectRuntimeMonitor>;
  let projectInspectorHost: ReturnType<typeof createProjectInspectorHost>;
  const rememberSelection = (node: any | null): void => {
    lastKnownSelection = node ?? null;
    projectEditSession.syncSelection(lastKnownSelection);
  };
  const focusWithProjectCamera = (node: any | null): boolean => {
    if (!node) return false;
    const focused = projectEditSession.focusSelected(node);
    if (focused) rememberSelection(node);
    return focused;
  };
  const focusLegacySelected = (): void => {
    if (focusWithProjectCamera(lastKnownSelection)) return;
    const selected = projectSelection.getSelectedEntity?.() ?? lastKnownSelection;
    focusWithProjectCamera(selected);
  };
  const projectSelection = createProjectSelectionController({
    getScene: () => pendingScene,
    getMonitor: () => projectMonitor,
    normalizeSelection: ({ source, rawEntity }) => {
      const context = resolveProjectPluginContext(pendingScene);
      const normalizedEntity = paScaffoldEditorPlugin.normalizeSelection?.({
        source,
        rawEntity,
        context,
      }) ?? rawEntity;
      const binding = normalizedEntity
        ? (paScaffoldEditorPlugin.resolvePersistentBinding?.(normalizedEntity, context) ?? null)
        : null;
      return {
        normalizedEntity,
        hasPersistentBinding: !!binding,
      };
    },
    onSelectionCommitted: (entity) => {
      rememberSelection(entity);
      projectMonitor?.rebase(entity);
    },
  });
  (window as any).__bridgeProjectSelectionController = projectSelection;
  const getSceneData = (): Record<string, any> | null => {
    ensureProjectEditorDocumentLoaded();
    const exported = exportProjectEditorDocument();
    if (!hasSceneJsonText(exported)) return null;
    return parseSceneData(exported.sceneJsonText);
  };
  const dispatchSceneChange = (source = 'manual'): Record<string, any> | null => {
    const sceneData = getSceneData();
    if (!sceneData) return null;
    const payload = {
      source,
      scene: sceneData,
      sceneJsonText: `${JSON.stringify(sceneData, null, 2)}\n`,
      documentStatus: {
        dirty: isProjectEditorDocumentDirty(),
        canUndo: canUndoProjectEditorDocumentChange(),
        canRedo: canRedoProjectEditorDocumentChange(),
      },
      timestamp: Date.now(),
    };
    emitBridgeEvent(EVENT_NAME.DOCUMENT_CHANGED, payload);
    return payload;
  };
  projectInspectorHost = createProjectInspectorHost({
    getScene: () => pendingScene,
    getSelectionController: () => projectSelection,
    getSelectedEntity: () => projectSelection.getSelectedEntity?.() ?? lastKnownSelection,
    getCurrentTool: () => projectEditSession.currentTool(),
    resolveBinding: (node) => (
      paScaffoldEditorPlugin.resolvePersistentBinding?.(
        node,
        resolveProjectPluginContext(pendingScene),
      ) ?? null
    ),
    onMaterialPropertyChanged: (change) => {
      projectMonitor?.recordCanonicalMaterialChange?.(change);
    },
  });
  const projectEditSession = createProjectEditSession({
    getScene: () => pendingScene,
    getGame: () => resolveProjectPluginContext(pendingScene).game,
    getSelectedEntity: () => projectSelection.getSelectedEntity?.() ?? lastKnownSelection,
    emitModeChange: (mode) => emitBridgeEvent(EVENT_NAME.MODE_CHANGED, { mode }),
    onSetTool: (tool) => {
      projectInspectorHost.syncTool(tool);
    },
    onEnablePicking: () => projectSelection.enablePicking?.(),
    onFocusSelected: focusLegacySelected,
    onUndo: () => {
      selfRuntime.Editor.undo();
    },
    onRedo: () => {
      selfRuntime.Editor.redo();
    },
    onDuplicateSelected: () => {
      void selfRuntime.Editor.duplicateSelected?.();
    },
  });
  projectMonitor = createProjectRuntimeMonitor({
    getScene: () => pendingScene,
    getSelectedEntity: () => projectSelection.getSelectedEntity?.() ?? lastKnownSelection,
    getSelectedEntities: () => {
      const selected = projectSelection.getSelectedEntities?.();
      if (selected && selected.length > 0) return selected;
      const fallback = projectSelection.getSelectedEntity?.() ?? lastKnownSelection;
      return fallback ? [fallback] : [];
    },
    resolveBinding: (node) => (
      paScaffoldEditorPlugin.resolvePersistentBinding?.(
        node,
        resolveProjectPluginContext(pendingScene),
      ) ?? null
    ),
    onSelectionChanged: (node) => {
      rememberSelection(node);
    },
    onChangesFlushed: (changes) => {
      emitEditApplied({
        changes: buildContextChanges(changes),
        documentStatus: {
          dirty: isProjectEditorDocumentDirty(),
          canUndo: canUndoProjectEditorDocumentChange(),
          canRedo: canRedoProjectEditorDocumentChange(),
        },
      });
    },
    onDocumentChanged: () => {
      dispatchSceneChange('runtime-change');
    },
  });
  selfRuntime = {
    owner: 'project',
    Editor: {
      get active() {
        return projectEditSession.active;
      },
      init(scene: any): void {
        pendingScene = scene;
        projectMonitor.reset();
        rememberSelection(null);
        ensureProjectEditorDocumentLoaded();
        publishDocumentStatus();
        projectInspectorHost.init(scene);
      },
      async showInspector(): Promise<void> {
        warmupInspectorReady();
        await projectInspectorHost.show();
      },
      hideInspector(): void {
        projectInspectorHost.hide();
      },
      getSceneData,
      dispatchSceneChange,
      async restoreSceneData(sceneData: Record<string, any> | string): Promise<boolean> {
        const parsed = parseSceneData(sceneData);
        if (!parsed) {
          console.warn('[ProjectEditor][Runtime] restoreSceneData ignored: invalid scene data');
          return false;
        }

        // Protect <canvas id="renderCanvas">: restoreSceneFromData rebuilds the
        // scene and projectInspectorHost.init swaps the scene reference, which
        // triggers a FluentProvider/inspector-v2 React re-render. That re-render
        // doesn't preserve the canvas DOM node, so Babylon ends up rendering
        // into a detached canvas (black screen, but activeRenderLoops=1 + fps>0).
        // Capture parent before, reattach after if it got dropped.
        const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement | null;
        const canvasParent = canvas?.parentNode ?? document.body;

        const wasEditing = !!selfRuntime.Edit.active;
        loadProjectEditorDocument(parsed as any);
        const game = resolveProjectPluginContext(pendingScene).game as any;
        if (game && typeof game.restoreSceneFromData === 'function') {
          await game.restoreSceneFromData(parsed);
          pendingScene = typeof game.getScene === 'function' ? game.getScene() : (game.scene ?? pendingScene);
        }
        projectMonitor.reset();
        rememberSelection(null);
        projectInspectorHost.init(pendingScene);
        if (wasEditing) {
          projectMonitor.start();
        }
        publishDocumentStatus();
        dispatchSceneChange('restore');

        if (canvas && !canvas.isConnected && canvasParent && (canvasParent as Node).isConnected) {
          (canvasParent as Node).appendChild(canvas);
          try { game?.engine?.resize?.(); } catch {}
        }

        return true;
      },
      setTool(tool: 'pick' | 'move' | 'rotate' | 'scale'): void {
        projectInspectorHost.syncTool(tool);
      },
      getSelectedEntity(): any | null {
        return projectSelection.getSelectedEntity?.() ?? lastKnownSelection;
      },
      selectEntity(entity: any | null, syncInspector = true): void {
        projectSelection.selectEntity?.(entity, syncInspector);
        rememberSelection(entity);
      },
      async duplicateSelected(): Promise<boolean> {
        if (!selfRuntime.Edit.active) return false;
        const node = projectSelection.getSelectedEntity?.() ?? lastKnownSelection;
        if (!node) return false;

        const context = resolveProjectPluginContext(pendingScene);
        const binding = paScaffoldEditorPlugin.resolvePersistentBinding?.(node, context) ?? null;
        logRuntime('duplicateSelected requested', {
          selectedNodeName: node?.name ?? null,
          selectedParentName: node?.parent?.name ?? null,
          bindingKind: binding?.kind ?? null,
          bindingNodeId: binding?.kind === 'sceneNode' ? binding.nodeId : null,
        });
        if (!binding) return false;

        const duplicated = await Promise.resolve(
          paScaffoldEditorPlugin.duplicateSelection?.({
            binding,
            node,
            context,
          }) ?? null,
        );
        const rootNode = duplicated?.rootNode ?? null;
        logRuntime('duplicateSelected result', {
          createdNodeName: rootNode?.name ?? null,
          createdParentName: rootNode?.parent?.name ?? null,
        });
        if (!rootNode) return false;

        projectSelection.selectEntity?.(rootNode, true);
        rememberSelection(rootNode);
        projectMonitor.rebase(rootNode);
        publishDocumentStatus();
        dispatchSceneChange('duplicate');
        return true;
      },
      undo(): boolean {
        if (!selfRuntime.Edit.active) return false;
        projectMonitor.flush();
        ensureProjectEditorDocumentLoaded();
        const change = undoProjectEditorDocumentChange(resolveProjectPluginContext(pendingScene));
        const undoRootNode = change?.kind === 'transform' ? change.rootNode ?? null : null;
        logRuntime('undo result', {
          changeKind: change?.kind ?? null,
          selectedRootNodeName: change?.selectedRootNode?.name ?? null,
          rootNodeName: undoRootNode?.name ?? null,
          selectedRootParentName: change?.selectedRootNode?.parent?.name ?? null,
          rootNodeParentName: undoRootNode?.parent?.name ?? null,
        });
        if (change) {
          if (change.kind === 'selection') {
            rememberSelection(change.selectedRootNode ?? null);
          } else if (change.rootNode) {
            rememberSelection(change.rootNode);
          } else if (change.selectedRootNode) {
            rememberSelection(change.selectedRootNode);
          }
          projectMonitor.rebase(projectSelection.getSelectedEntity?.() ?? lastKnownSelection);
          publishDocumentStatus();
          dispatchSceneChange('undo');
          return true;
        }
        return false;
      },
      redo(): boolean {
        if (!selfRuntime.Edit.active) return false;
        projectMonitor.flush();
        ensureProjectEditorDocumentLoaded();
        const change = redoProjectEditorDocumentChange(resolveProjectPluginContext(pendingScene));
        const redoRootNode = change?.kind === 'transform' ? change.rootNode ?? null : null;
        logRuntime('redo result', {
          changeKind: change?.kind ?? null,
          selectedRootNodeName: change?.selectedRootNode?.name ?? null,
          rootNodeName: redoRootNode?.name ?? null,
          selectedRootParentName: change?.selectedRootNode?.parent?.name ?? null,
          rootNodeParentName: redoRootNode?.parent?.name ?? null,
        });
        if (change) {
          if (change.kind === 'selection') {
            rememberSelection(change.selectedRootNode ?? null);
          } else if (change.rootNode) {
            rememberSelection(change.rootNode);
          } else if (change.selectedRootNode) {
            rememberSelection(change.selectedRootNode);
          }
          projectMonitor.rebase(projectSelection.getSelectedEntity?.() ?? lastKnownSelection);
          publishDocumentStatus();
          dispatchSceneChange('redo');
          return true;
        }
        return false;
      },
      exportDocument(): ProjectEditorDocumentExport | null {
        logRuntime('export document requested', {
          dirtyBeforeFlush: isProjectEditorDocumentDirty(),
          canUndo: canUndoProjectEditorDocumentChange(),
          canRedo: canRedoProjectEditorDocumentChange(),
        });
        projectMonitor.flush();
        ensureProjectEditorDocumentLoaded();
        const exported = exportProjectEditorDocument();
        logRuntime('export document completed', {
          hasSceneJsonText: hasSceneJsonText(exported),
          sceneJsonTextLength: exported?.sceneJsonText.length ?? 0,
          dirtyAfterExport: isProjectEditorDocumentDirty(),
        });
        return exported;
      },
      commitSavedDocument(args: ProjectEditorDocumentCommitArgs): boolean {
        logRuntime('commit document requested', {
          dirtyBeforeFlush: isProjectEditorDocumentDirty(),
          ...summarizeCommitArgs(args),
        });
        projectMonitor.flush();
        ensureProjectEditorDocumentLoaded();
        const committed = commitProjectEditorDocumentSave(args, resolveProjectPluginContext(pendingScene));
        if (committed) {
          publishDocumentStatus();
        }
        logRuntime('commit document completed', {
          committed,
          dirtyAfterCommit: isProjectEditorDocumentDirty(),
        });
        return committed;
      },
    },
    Edit: {
      get active() {
        return projectEditSession.active;
      },
      async enter(): Promise<void> {
        await projectEditSession.enter();
        projectMonitor.start();
        rememberSelection(projectSelection.getSelectedEntity?.() ?? lastKnownSelection);
      },
      async exit(save?: boolean): Promise<void> {
        projectMonitor.stop();
        await projectEditSession.exit(save ?? true);
      },
      _focusSelected(): void {
        focusLegacySelected();
      },
      isViewportNavigationActive(): boolean {
        return projectEditSession.isViewportNavigationActive();
      },
    },
    async handleCommand(name: string, params: Record<string, any>): Promise<void> {
      if (name === COMMAND_NAME.MODE_CHANGE) {
        const mode = typeof params.mode === 'string' ? params.mode : '';
        if (mode === MODE.EDIT) {
          warmupInspectorReady();
          await selfRuntime.Edit.enter();
          await selfRuntime.Editor.showInspector();
          return;
        }
        if (mode === MODE.PLAY) {
          selfRuntime.Editor.hideInspector();
          await selfRuntime.Edit.exit(params.save ?? true);
          return;
        }
      }

      if (name === COMMAND_NAME.UNDO) {
        selfRuntime.Editor.undo();
        return;
      }

      if (name === COMMAND_NAME.REDO) {
        selfRuntime.Editor.redo();
        return;
      }

      if (name === COMMAND_NAME.INSPECTOR_FLUSH) {
        logRuntime('inspector.flush command received', {
          dirtyBeforeFlush: isProjectEditorDocumentDirty(),
        });
        projectMonitor.flush();
        publishDocumentStatus();
        emitBridgeEvent(EVENT_NAME.INSPECTOR_FLUSHED, {});
        logRuntime('inspector.flush command completed', {
          dirtyAfterFlush: isProjectEditorDocumentDirty(),
        });
        return;
      }

      if (name === COMMAND_NAME.DOCUMENT_EXPORT) {
        const exported = selfRuntime.Editor.exportDocument();
        const requestId = typeof params.requestId === 'string' ? params.requestId : undefined;
        if (hasSceneJsonText(exported)) {
          emitBridgeEvent(EVENT_NAME.DOCUMENT_EXPORTED, {
            requestId,
            sceneJsonText: exported.sceneJsonText,
            ...(typeof exported.expectedVersion === 'number' ? { expectedVersion: exported.expectedVersion } : {}),
            ...(typeof exported.version === 'number' ? { version: exported.version } : {}),
          });
        } else {
          emitBridgeEvent(EVENT_NAME.DOCUMENT_EXPORTED, {
            requestId,
            error: 'document_export_unavailable',
          });
        }
        return;
      }

      if (name === COMMAND_NAME.DOCUMENT_COMMIT) {
        selfRuntime.Editor.commitSavedDocument(toCommitArgs(params));
        return;
      }

      if (name === COMMAND_NAME.DOCUMENT_RESTORE) {
        const sceneData = (params as { sceneData?: Record<string, any> | string }).sceneData;
        if (sceneData == null) {
          console.warn('[ProjectEditor][Runtime] document:restore ignored: missing sceneData');
          return;
        }
        await selfRuntime.Editor.restoreSceneData?.(sceneData);
        return;
      }

      // No legacy runtime command fallback in phase A2 finalized chain.
      // Unknown commands are ignored until Phase B command registry.
      return;
    },
  };

  return selfRuntime;
}
