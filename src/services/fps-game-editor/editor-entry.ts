import {
  mountFpsGameEditorLocalEditorEntry,
  type FpsGameEditorLocalEditorEntry,
  type FpsGameEditorProjectModeTransitions,
} from '@fps-games/editor/playable-sdk';
import {
  readPaTemplateEditorHostEnvironment,
  type PaTemplateEditorHostEnvironment,
} from './editor-host-environment';

type LocalEditorModule = typeof import('./local-editor');

export type PaTemplateEditorEntryProjectMode = FpsGameEditorProjectModeTransitions;

/** Editor-only entry assembly. Project runtime lifetime stays in src/dev/DevHost. */
export function mountPaTemplateEditorEntry(
  projectMode: PaTemplateEditorEntryProjectMode,
  hostEnvironment: PaTemplateEditorHostEnvironment = readPaTemplateEditorHostEnvironment(),
): FpsGameEditorLocalEditorEntry {
  return mountFpsGameEditorLocalEditorEntry<LocalEditorModule>({
    browser: {
      // Hosted sandboxes own mode switching; keep the manual entry affordance local-only.
      showEntryButton: !hostEnvironment.hostedSandbox,
    },
    projectMode,
    editorModule: {
      // The Forge Play sandbox runs this module inside an about:srcdoc frame.
      // Keep editor routes anchored to the Vite-served module origin instead.
      baseUrl: import.meta.url,
      importModule: url => import(/* @vite-ignore */ url) as Promise<LocalEditorModule>,
      mount: (module, options) => module.mountLocalEditorModeSwitcher({
          root: document.body,
          ...options,
        }),
    },
    reportError(scope, error) {
      console.error(`[PaTemplateEditorEntry] ${scope}`, error);
    },
  });
}
