import { paScaffoldEditorPlugin } from './adapter';
import { ensureProjectEditorDocumentLoaded } from './document';
import { createProjectEditorRuntimeBridge } from './runtime';
import type { ProjectEditorRuntime } from './types';

export function registerProjectEditorPlugin(): void {
  ensureProjectEditorDocumentLoaded();
  const bridge = window.__bridge;
  if (bridge?.registerEditorPlugin) {
    bridge.registerEditorPlugin(paScaffoldEditorPlugin);
    return;
  }

  window.__pendingEditorPlugin = paScaffoldEditorPlugin;
}

export function registerProjectEditorRuntime(runtime: ProjectEditorRuntime): void {
  const bridge = window.__bridge;
  if (bridge?.registerEditorRuntime) {
    bridge.registerEditorRuntime(runtime);
    return;
  }

  window.__pendingEditorRuntime = runtime;
}

export function registerProjectEditorRuntimeBridge(): void {
  registerProjectEditorRuntime(createProjectEditorRuntimeBridge());
}

export { paScaffoldEditorPlugin } from './adapter';
export {
  canRedoProjectEditorDocumentChange,
  canUndoProjectEditorDocumentChange,
  ensureProjectEditorDocumentLoaded,
  exportProjectEditorDocument,
  getProjectEditorDocumentState,
  getProjectEditorOriginalDocument,
  getProjectEditorWorkingDocument,
  isProjectEditorDocumentDirty,
  loadProjectEditorDocument,
  redoProjectEditorDocumentChange,
  resetProjectEditorDocument,
  resolveProjectDocumentBindingLocation,
  undoProjectEditorDocumentChange,
} from './document';
export { createProjectEditorRuntimeBridge } from './runtime';
export type { ProjectEditorPlugin, ProjectEditorRuntime, ProjectPersistentBinding } from './types';
export type { ProjectDocumentBindingLocation, ProjectEditorDocumentState } from './document';
