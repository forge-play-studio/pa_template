import type { Game } from '../core/Game';
import type { ProjectGameplayRuntime } from '../gameplay';
import { mountCameraDebugPanel } from './camera-debug-panel';
import { mountLocalEditorModeSwitcher } from './local-editor-mode-switcher';
import { mountRuntimeGameplayDebugPanels } from './runtime-gameplay-debug-panels';
import { mountRuntimeLightingDebugPanel } from './runtime-lighting-debug-panel';
import { mountRuntimeRecordReplayPanel } from './runtime-record-replay-panel';
import { mountRuntimeVfxDebugPanel } from './runtime-vfx-debug-panel';
import { DisposableStack, type Disposable } from './framework/disposables';
import { createRuntimeDebugPanelManager } from './framework/panel-manager';
import {
  installHiddenDebugUiStyle,
  isDebugUiHidden,
  setDebugUiCollapseEnabled,
} from './record-replay/debug-ui-visibility';
import { createDemoRecordingController, type DemoRecordingApiLike } from './record-replay/demo-recording-controller';
import { mountRecordingHud, type RecordingHudBanner } from './record-replay/recording-hud';
import { registerBeforeCta } from '../services/PlayableCtaService';

export interface RuntimeDebugBootstrapOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
  getGameplayRuntime: () => ProjectGameplayRuntime | null;
  disposeGameWorld: () => void | Promise<void>;
  /**
   * 真人示教录制模式(`?rrAutoStart=1` 且未带 `?rrPanels=1`)。
   * 用 stylesheet 隐藏所有 debug 面板 —— 它会覆盖之后才创建的浮层,面板完全不会闪一下。
   */
  humanRecording?: boolean;
  /** `?rrPanels=1`:强制显示完整面板,并关掉录制/回放期间的面板折叠(agent 调试用)。 */
  forceShowPanels?: boolean;
  /**
   * 录制 HUD 上的游戏专属警告条(例:「快没血了,死了会 reload」)。
   * 框架不可能知道某个游戏会怎样弄丢 tape —— 由游戏自己提供,返回 null 表示此刻无需警告。
   */
  recordingBanner?: () => RecordingHudBanner | null;
}

export interface RuntimeDebugBootstrap extends Disposable {
  detachForEditor(): void;
}

/** DEV-only handle so `main.ts` can arm a *checkpointed* session for `?rrAutoStart=1`. */
declare global {
  interface Window {
    __demoRec?: ReturnType<typeof createDemoRecordingController>;
  }
}

export function mountRuntimeDebug(options: RuntimeDebugBootstrapOptions): RuntimeDebugBootstrap {
  const root = options.root ?? document.body;
  // rrPanels=1 时连录制/回放期间的临时折叠也一并关掉,否则 startRec() 仍会把面板 inline 隐藏。
  setDebugUiCollapseEnabled(!options.forceShowPanels);
  const runtimePanels = new DisposableStack();
  const panelManager = runtimePanels.use(createRuntimeDebugPanelManager({ root }));
  const actions = panelManager.actions;

  runtimePanels.use(mountCameraDebugPanel({
    root,
    getGame: options.getGame,
  }));
  runtimePanels.use(mountRuntimeLightingDebugPanel({
    root,
    getGame: options.getGame,
  }));
  runtimePanels.use(mountRuntimeVfxDebugPanel({
    root,
    getGame: options.getGame,
  }));
  runtimePanels.use(mountRuntimeRecordReplayPanel({
    root,
    getGame: options.getGame,
    restartGame: async (context) => {
      if (!window.__restartProjectGame) throw new Error('__restartProjectGame is not available.');
      await window.__restartProjectGame(context);
    },
  }));
  runtimePanels.use(mountRuntimeGameplayDebugPanels({
    root,
    getGame: options.getGame,
    getGameplayRuntime: options.getGameplayRuntime,
    actions,
  }));

  const doc = root.ownerDocument;
  // 真人示教:stylesheet 隐藏,覆盖之后才创建的面板(游戏的 stats overlay 往往在 game.start() 之后才建)。
  let hiddenStyle: Disposable | null = options.humanRecording ? installHiddenDebugUiStyle(doc) : null;
  runtimePanels.defer(() => {
    hiddenStyle?.dispose();
    hiddenStyle = null;
  });

  // 录制生命线 + 浮动控件在**所有 dev 模式**下都挂:裸 URL 打开时要靠它喊「未在录制」。
  const controller = createDemoRecordingController({
    getApi: () => window.__rr as unknown as DemoRecordingApiLike | undefined,
    registerBeforeNavigate: registerBeforeCta,
  });
  window.__demoRec = controller;
  runtimePanels.defer(() => {
    if (window.__demoRec === controller) delete window.__demoRec;
    controller.dispose();
  });

  runtimePanels.use(mountRecordingHud({
    root,
    controller,
    exportTape: () => {
      const api = window.__rr;
      if (!api) throw new Error('record-replay API is not mounted.');
      return api.export();
    },
    gameBanner: options.recordingBanner,
    arePanelsHidden: () => isDebugUiHidden(doc),
    togglePanels: () => {
      if (hiddenStyle) {
        hiddenStyle.dispose();
        hiddenStyle = null;
      } else {
        hiddenStyle = installHiddenDebugUiStyle(doc);
      }
    },
  }));

  let disposedForReload = false;
  let runtimePanelsDetached = false;
  const detachRuntimePanelsForEditor = () => {
    if (runtimePanelsDetached) return;
    runtimePanelsDetached = true;
    runtimePanels.dispose();
    editorSwitcher.detachForEditor();
  };
  const editorSwitcher = mountLocalEditorModeSwitcher({
    root,
    disposeGameWorld: async () => {
      detachRuntimePanelsForEditor();
      await options.disposeGameWorld();
    },
    onBeforeEnterEditor: detachRuntimePanelsForEditor,
    onBeforeReload: () => {
      disposedForReload = true;
      runtimePanels.dispose();
      editorSwitcher.dispose();
    },
  });

  return {
    detachForEditor: detachRuntimePanelsForEditor,
    dispose() {
      if (disposedForReload) return;
      runtimePanels.dispose();
      editorSwitcher.dispose();
    },
  };
}
