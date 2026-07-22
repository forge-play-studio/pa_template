import {
  mountFpsGameEditorLocalEditorEntry,
  type FpsGameEditorLocalEditorEntry,
  type FpsGameEditorProjectModeTransitions,
} from '@fps-games/editor/playable-sdk';
import {
  readPaTemplateEditorBootMode,
  type PaTemplateEditorBootMode,
} from './editor-host-environment';

type LocalEditorModule = typeof import('./local-editor');

export type PaTemplateEditorEntryProjectMode = FpsGameEditorProjectModeTransitions;

/** Editor-only entry assembly. Project runtime lifetime stays in src/dev/DevHost. */
export function mountPaTemplateEditorEntry(
  projectMode: PaTemplateEditorEntryProjectMode,
  bootMode: PaTemplateEditorBootMode = readPaTemplateEditorBootMode(),
): FpsGameEditorLocalEditorEntry {
  return mountFpsGameEditorLocalEditorEntry<LocalEditorModule>({
    browser: {
      // Hosted sandboxes own mode switching; keep the manual entry affordance local-only.
      showEntryButton: bootMode === null,
    },
    projectMode,
    editorModule: {
      // The Forge Play sandbox runs this module inside an about:srcdoc frame.
      // Keep editor routes anchored to the Vite-served module origin instead.
      baseUrl: import.meta.url,
      importModule: url => import(/* @vite-ignore */ url) as Promise<LocalEditorModule>,
      mount: async (module, options) => {
        const switcher = await module.mountLocalEditorModeSwitcher({
          root: document.body,
          ...options,
        });
        // Resolve the hosted editor mode before async assembly. Explicit host
        // injection wins; about:srcdoc remains a compatibility fallback.
        if (bootMode === 'edit') {
          void switcher.enterEditor().catch(error => console.error('[PaTemplateEditorEntry] boot enterEditor failed', error));
        }
        return switcher;
      },
    },
    reportError(scope, error) {
      console.error(`[PaTemplateEditorEntry] ${scope}`, error);
    },
  });
}
