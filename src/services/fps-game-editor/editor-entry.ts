import {
  mountFpsGameEditorLocalEditorEntry,
  type FpsGameEditorLocalEditorEntry,
  type FpsGameEditorProjectModeTransitions,
} from '@fps-games/editor/playable-sdk';

type LocalEditorModule = typeof import('./local-editor');

export type PaTemplateEditorEntryProjectMode = FpsGameEditorProjectModeTransitions;

/** Editor-only entry assembly. Project runtime lifetime stays in src/dev/DevHost. */
export function mountPaTemplateEditorEntry(
  projectMode: PaTemplateEditorEntryProjectMode,
): FpsGameEditorLocalEditorEntry {
  return mountFpsGameEditorLocalEditorEntry<LocalEditorModule>({
    projectMode,
    editorModule: {
      baseUrl: window.location.href,
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
