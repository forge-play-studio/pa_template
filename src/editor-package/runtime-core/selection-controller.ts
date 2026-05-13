import { getInspectorContainer, setInspectorPicking } from './inspector-adapter';
import type { ProjectSelectionController } from '../types';
import type { RuntimeScene } from './types';

type SelectionContextKind = 'viewport' | 'tree' | 'programmatic' | 'unknown';

type SelectionMonitorLike = {
  isDragging?: boolean;
};

type NormalizeSelectionResult = {
  normalizedEntity: any;
  hasPersistentBinding: boolean;
};

type CreateProjectSelectionControllerOptions = {
  getScene: () => RuntimeScene | null;
  getMonitor?: () => SelectionMonitorLike | null;
  shouldHandleViewportSelection?: () => boolean;
  normalizeSelection: (args: {
    source: SelectionContextKind;
    rawEntity: any;
  }) => NormalizeSelectionResult;
  onSelectionCommitted: (entity: any | null) => void;
};

type PendingSelectionContext =
  | {
    kind: 'viewport';
    token: number;
    createdAt: number;
    additive: boolean;
  }
  | {
    kind: 'tree';
    token: number;
    createdAt: number;
    additive: boolean;
  }
  | null;

interface SelectionTrackingCtx {
  onPointerDown: (event: PointerEvent) => void;
}

const PENDING_SELECTION_CONTEXT_TTL_MS = 1000;

export function createProjectSelectionController(
  options: CreateProjectSelectionControllerOptions,
): ProjectSelectionController {
  let v2SelectionService: any = null;
  let selectedEntity: any = null;
  let selectedEntities: any[] = [];
  let highlightedMeshes = new Map<any, {
    showBoundingBox: boolean;
  }>();
  let normalizingSelection = false;
  let selectionTrackingCtx: SelectionTrackingCtx | null = null;
  let pendingSelectionContext: PendingSelectionContext = null;
  let nextSelectionToken = 1;

  function getNodeIdentity(node: any): string | null {
    if (!node || typeof node !== 'object') return null;
    if (typeof node.uniqueId === 'number' && Number.isFinite(node.uniqueId)) {
      return `uid:${node.uniqueId}`;
    }
    if (typeof node.id === 'string' && node.id.trim()) {
      return `id:${node.id.trim()}`;
    }
    return null;
  }

  function getNodeParentIdentity(node: any): string | null {
    const parent = node?.parent ?? null;
    if (!parent) return 'root';
    if (typeof parent.uniqueId === 'number' && Number.isFinite(parent.uniqueId)) {
      return `uid:${parent.uniqueId}`;
    }
    if (typeof parent.id === 'string' && parent.id.trim()) {
      return `id:${parent.id.trim()}`;
    }
    if (typeof parent.name === 'string' && parent.name.trim()) {
      return `name:${parent.name.trim()}`;
    }
    return null;
  }

  function clearSelectionHighlight(): void {
    for (const [mesh, state] of highlightedMeshes.entries()) {
      try {
        if (mesh && 'showBoundingBox' in mesh) mesh.showBoundingBox = state.showBoundingBox;
      } catch {}
    }
    highlightedMeshes = new Map();
  }

  function collectHighlightMeshesFromNode(node: any): any[] {
    if (!node) return [];
    const result: any[] = [];
    if ('showBoundingBox' in node) {
      result.push(node);
    }
    const children = typeof node.getChildMeshes === 'function'
      ? node.getChildMeshes(false)
      : [];
    for (const mesh of children) {
      if (mesh && 'showBoundingBox' in mesh) {
        result.push(mesh);
      }
    }
    return result;
  }

  function syncSelectionHighlight(): void {
    clearSelectionHighlight();
    const nextMeshes = new Map<any, {
      showBoundingBox: boolean;
    }>();
    for (const entity of selectedEntities) {
      for (const mesh of collectHighlightMeshesFromNode(entity)) {
        try {
          const prevState = {
            showBoundingBox: !!mesh.showBoundingBox,
          };
          mesh.showBoundingBox = true;
          nextMeshes.set(mesh, prevState);
        } catch {}
      }
    }
    highlightedMeshes = nextMeshes;
  }

  function createSelectionToken(): number {
    const token = nextSelectionToken;
    nextSelectionToken += 1;
    return token;
  }

  function setPendingSelectionContext(context: PendingSelectionContext): void {
    pendingSelectionContext = context;
  }

  function clearPendingSelectionContext(expectedToken?: number): void {
    if (
      expectedToken != null
      && pendingSelectionContext
      && pendingSelectionContext.token !== expectedToken
    ) {
      return;
    }
    pendingSelectionContext = null;
  }

  function peekPendingSelectionContext(expectedToken?: number): PendingSelectionContext {
    const context = pendingSelectionContext;
    if (!context) return null;
    if (expectedToken != null && context.token !== expectedToken) return null;
    if (Date.now() - context.createdAt > PENDING_SELECTION_CONTEXT_TTL_MS) {
      clearPendingSelectionContext(context.token);
      return null;
    }
    return context;
  }

  function consumePendingSelectionContext(expectedToken?: number): PendingSelectionContext {
    const context = peekPendingSelectionContext(expectedToken);
    if (!context) return null;
    pendingSelectionContext = null;
    return context;
  }

  function commitSelection(
    entity: any,
    syncInspector = true,
    selectionOptions?: { additive?: boolean; toggle?: boolean },
  ): void {
    const additive = !!selectionOptions?.additive;
    const toggle = selectionOptions?.toggle ?? additive;
    const nextEntity = entity ?? null;

    if (!additive || !nextEntity) {
      selectedEntity = nextEntity;
      selectedEntities = nextEntity ? [nextEntity] : [];
    } else {
      const identity = getNodeIdentity(nextEntity);
      if (!identity) {
        selectedEntity = nextEntity;
        selectedEntities = [nextEntity];
      } else {
        const nextParentIdentity = getNodeParentIdentity(nextEntity);
        const currentParentIdentity = selectedEntities.length > 0
          ? getNodeParentIdentity(selectedEntities[0])
          : null;
        if (
          selectedEntities.length > 0
          && currentParentIdentity != null
          && nextParentIdentity != null
          && currentParentIdentity !== nextParentIdentity
        ) {
          return;
        }

        const index = selectedEntities.findIndex(item => getNodeIdentity(item) === identity);
        if (index >= 0 && toggle) {
          const nextList = selectedEntities.slice();
          nextList.splice(index, 1);
          selectedEntities = nextList;
          if (selectedEntities.length === 0) {
            selectedEntity = null;
          } else if (getNodeIdentity(selectedEntity) === identity) {
            selectedEntity = selectedEntities[selectedEntities.length - 1] ?? null;
          }
        } else if (index < 0) {
          selectedEntities = [...selectedEntities, nextEntity];
          selectedEntity = nextEntity;
        } else {
          selectedEntity = nextEntity;
        }
      }
    }

    options.onSelectionCommitted(selectedEntity ?? null);
    syncSelectionHighlight();
    if (!syncInspector || !v2SelectionService) return;
    if (v2SelectionService.selectedEntity === (selectedEntity ?? null)) return;
    if (normalizingSelection) return;
    normalizingSelection = true;
    try {
      v2SelectionService.selectedEntity = selectedEntity ?? null;
    } finally {
      queueMicrotask(() => {
        normalizingSelection = false;
      });
    }
  }

  function setInspectorPickingState(enabled: boolean, tries = 0): void {
    const container = getInspectorContainer();
    if (!container) {
      if (tries < 15) {
        setTimeout(() => setInspectorPickingState(enabled, tries + 1), 200);
      }
      return;
    }
    if (setInspectorPicking(enabled, container)) return;
    if (tries < 15) {
      setTimeout(() => setInspectorPickingState(enabled, tries + 1), 200);
    }
  }

  return {
    createV2SelectionBridge(v2: any) {
      const SelectionServiceIdentity = v2?.SelectionServiceIdentity;
      if (!SelectionServiceIdentity) return null;
      return {
        friendlyName: 'Project Inspector Selection Sync',
        consumes: [SelectionServiceIdentity],
        factory: (selectionService: any) => {
          v2SelectionService = selectionService;
          const selObs = selectionService.onSelectedEntityChanged?.add(() => {
            if (normalizingSelection) return;
            if (options.getMonitor?.()?.isDragging) return;

            let entity = selectionService.selectedEntity;
            const consumedContext = consumePendingSelectionContext();
            if (!consumedContext) {
              commitSelection(entity ?? null, false);
              return;
            }

            const normalized = options.normalizeSelection({
              source: consumedContext.kind,
              rawEntity: entity,
            });

            if (consumedContext.kind === 'viewport' && !normalized.hasPersistentBinding) {
              return;
            }
            if (!normalized.normalizedEntity) {
              return;
            }
            entity = normalized.normalizedEntity;
            commitSelection(
              entity ?? null,
              consumedContext.kind === 'viewport',
              {
                additive: consumedContext.additive,
                toggle: consumedContext.additive,
              },
            );
          });

          return {
            dispose: () => {
              if (selObs) selectionService.onSelectedEntityChanged?.remove(selObs);
              if (v2SelectionService === selectionService) v2SelectionService = null;
              if (selectedEntity === selectionService.selectedEntity) selectedEntity = null;
              clearSelectionHighlight();
              selectedEntities = [];
            },
          };
        },
      };
    },

    bindSelectionSourceTracking(): void {
      this.unbindSelectionSourceTracking?.();
      const onPointerDown = (event: PointerEvent) => {
        const rawTarget = event.target as EventTarget | null;
        const target = rawTarget instanceof HTMLElement ? rawTarget : null;
        const scene = options.getScene();
        const canvas = scene?.getEngine?.()?.getRenderingCanvas?.() ?? null;
        if (!target) return;

        const withinCanvasViewport = (() => {
          if (!canvas) return false;
          if (rawTarget === canvas) return true;
          const rect = canvas.getBoundingClientRect();
          return event.clientX >= rect.left
            && event.clientX <= rect.right
            && event.clientY >= rect.top
            && event.clientY <= rect.bottom;
        })();

        const isInspectorInteractive = !!target.closest?.(
          '#inspector-host button, #babylon-inspector-container button, '
          + '#inspector-host input, #babylon-inspector-container input, '
          + '#inspector-host textarea, #babylon-inspector-container textarea, '
          + '#inspector-host select, #babylon-inspector-container select, '
          + '#inspector-host a, #babylon-inspector-container a, '
          + '#inspector-host [role], #babylon-inspector-container [role], '
          + '#inspector-host [contenteditable="true"], #babylon-inspector-container [contenteditable="true"]'
        );

        if (withinCanvasViewport && (!target.closest?.('#inspector-host, #babylon-inspector-container') || !isInspectorInteractive)) {
          if (event.button !== 0 || !scene || !canvas) return;
          if (!(options.shouldHandleViewportSelection?.() ?? true)) return;
          setPendingSelectionContext({
            kind: 'viewport',
            token: createSelectionToken(),
            createdAt: Date.now(),
            additive: !!event.shiftKey,
          });
          return;
        }

        if (target.closest?.('#inspector-host, #babylon-inspector-container')) {
          if (isInspectorInteractive) {
            setPendingSelectionContext({
              kind: 'tree',
              token: createSelectionToken(),
              createdAt: Date.now(),
              additive: !!event.shiftKey,
            });
            return;
          }
          clearPendingSelectionContext();
        }
      };

      document.addEventListener('pointerdown', onPointerDown, true);
      selectionTrackingCtx = { onPointerDown };
    },

    unbindSelectionSourceTracking(): void {
      if (!selectionTrackingCtx) return;
      document.removeEventListener('pointerdown', selectionTrackingCtx.onPointerDown, true);
      selectionTrackingCtx = null;
      pendingSelectionContext = null;
    },

    enablePicking(): void {
      setInspectorPickingState(true);
    },

    reset(): void {
      this.unbindSelectionSourceTracking?.();
      normalizingSelection = false;
      v2SelectionService = null;
      selectedEntity = null;
      clearSelectionHighlight();
      selectedEntities = [];
      pendingSelectionContext = null;
    },

    getSelectedEntity(): any | null {
      return selectedEntity;
    },

    getSelectedEntities(): any[] {
      return [...selectedEntities];
    },

    selectEntity(entity: any, syncInspector = true, selectionOptions?: { additive?: boolean; toggle?: boolean }): void {
      commitSelection(entity ?? null, syncInspector, selectionOptions);
    },
  };
}
