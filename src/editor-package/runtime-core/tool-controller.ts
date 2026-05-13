import type { RuntimeScene } from './types';
import type { ProjectEditorTool } from './input-controller';
import { syncInspectorToolState } from './inspector-adapter';

interface CreateProjectToolControllerOptions {
  getScene: () => RuntimeScene | null;
  getSelectedEntity: () => any;
  enablePicking: () => void;
}

export function createProjectToolController(options: CreateProjectToolControllerOptions) {
  let tool: ProjectEditorTool = 'pick';
  let gizmoManager: any = null;

  function entityHasTransform(entity: any): boolean {
    return !!entity?.position && !!entity?.scaling && (!!entity?.rotation || !!entity?.rotationQuaternion);
  }

  function ensureGizmoManager() {
    if (gizmoManager) return gizmoManager;
    const scene = options.getScene();
    if (!scene) return null;
    const GizmoManager = (window as any).BABYLON?.GizmoManager || (window as any).__forgeGizmoManagerCtor;
    if (!GizmoManager) return null;
    const gm = new GizmoManager(scene);
    gm.usePointerToAttachGizmos = false;
    gm.clearGizmoOnEmptyPointerEvent = false;
    gm.boundingBoxGizmoEnabled = false;
    gizmoManager = gm;
    return gm;
  }

  return {
    currentTool() {
      return tool;
    },

    syncSelection(entity?: any): boolean {
      const nextEntity = entity ?? options.getSelectedEntity() ?? null;
      const handledByInspector = syncInspectorToolState(tool);
      const gm = ensureGizmoManager();
      if (!gm) return handledByInspector;

      if (handledByInspector) {
        gm.positionGizmoEnabled = false;
        gm.rotationGizmoEnabled = false;
        gm.scaleGizmoEnabled = false;
        try { gm.attachToNode?.(null); } catch {}
        return true;
      }

      gm.positionGizmoEnabled = tool === 'move';
      gm.rotationGizmoEnabled = tool === 'rotate';
      gm.scaleGizmoEnabled = tool === 'scale';

      if (tool === 'pick') {
        try { gm.attachToNode?.(null); } catch {}
        return true;
      }

      const target = entityHasTransform(nextEntity) ? nextEntity : null;
      try {
        gm.attachToNode?.(target);
      } catch {}
      return true;
    },

    setTool(nextTool: ProjectEditorTool): boolean {
      tool = nextTool;
      if (nextTool === 'pick') options.enablePicking();
      return this.syncSelection();
    },

    dispose() {
      const gm = gizmoManager;
      if (!gm) return;
      try { gm.attachToNode?.(null); } catch {}
      try { gm.dispose?.(); } catch {}
      gizmoManager = null;
    },
  };
}
