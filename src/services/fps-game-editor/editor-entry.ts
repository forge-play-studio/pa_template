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
    browser: {
      // Hosted sandboxes own mode switching; keep the manual entry affordance local-only.
      showEntryButton: window.__BOOT_MODE === undefined,
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
        // Forge Play 的 srcdoc 编辑帧没有 URL 可携带 mode(about:srcdoc),host 在
        // 写入 srcdoc 前注入 window.__BOOT_MODE = 'edit'。装配完成后直接进入编辑
        // 态,免去 host 侧 postMessage 轮询等待。未注入时行为不变(boot 进 play)。
        if (window.__BOOT_MODE === 'edit') {
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
