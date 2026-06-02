/**
 * 应用入口
 * 初始化游戏应用（新系统）
 */

import { LoadingScreen } from './ui';
import { Game } from './core/Game';
import type { LocalEditorModeSwitcher } from './debug/local-editor-mode-switcher';

// ============================================================
// 全局实例
// ============================================================

/** 游戏实例 */
let game: Game | null = null;

/** 加载屏幕 */
let loadingScreen: LoadingScreen | null = null;

/** DEV-only local editor/game mode switcher */
let localEditorModeSwitcher: LocalEditorModeSwitcher | null = null;

/** DEV-only runtime camera debug panel */
let cameraDebugPanel: { dispose(): void } | null = null;

/** DEV-only runtime lighting debug panel */
let lightingDebugPanel: { dispose(): void } | null = null;

/** 确保沙盒/动态注入场景下入口只启动一次 */
let initStarted = false;

/** 当前初始化任务，用于重启入口等待游戏世界真正 ready */
let initPromise: Promise<void> | null = null;

type ProjectGameRestartContext = {
  reason?: string;
};

async function registerRuntimeEditorBridge(): Promise<void> {
  const editorModule = await import('./fps-game-editor-adapter/runtime');
  editorModule.registerProjectFpsGameEditorRuntimeBridge();
}

function disposeLocalEditorModeSwitcher(): void {
  localEditorModeSwitcher?.dispose();
  localEditorModeSwitcher = null;
}

function disposeCameraDebugPanel(): void {
  cameraDebugPanel?.dispose();
  cameraDebugPanel = null;
}

function disposeLightingDebugPanel(): void {
  lightingDebugPanel?.dispose();
  lightingDebugPanel = null;
}

function clearLoadingScreen(): void {
  loadingScreen?.dispose();
  loadingScreen = null;
}

function clearProjectRuntimeGlobals(): void {
  window.gameInstance = null;
  window.game = null;
  (window as any).__bridgeProjectRuntime = null;
  (window as any).__pendingEditorRuntime = null;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

async function waitForSceneReadyBeforeDispose(targetGame: Game): Promise<void> {
  const scene = targetGame.getScene();
  const readyPromise = scene?.whenReadyAsync?.();
  if (!readyPromise || typeof readyPromise.then !== 'function') return;
  await Promise.race([
    readyPromise.catch(() => undefined),
    delay(750),
  ]);
}

async function disposeProjectGameWorld(): Promise<void> {
  const gameToDispose = game;
  game = null;
  clearProjectRuntimeGlobals();
  disposeLightingDebugPanel();
  disposeCameraDebugPanel();
  if (gameToDispose) {
    await waitForSceneReadyBeforeDispose(gameToDispose);
    gameToDispose.dispose();
  }
  clearLoadingScreen();
}

// ============================================================
// 初始化函数
// ============================================================

/**
 * 主初始化函数
 */
async function init(): Promise<void> {
  try {
    // 开发模式：暴露 BABYLON 供 AI 调试脚本使用
    if (import.meta.env.DEV) {
      const BABYLON = await import('@babylonjs/core');
      (window as any).BABYLON = BABYLON;
    }

    // 创建并显示加载页面
    clearLoadingScreen();
    loadingScreen = new LoadingScreen();

    // 创建游戏实例
    game = new Game({
      canvasId: 'renderCanvas',
      debug: true,
      enableAudio: true,
      showPlayerPlaceholder: false,
    });

    // 初始化游戏（包括资源加载和场景构建）
    await game.init();

    if (import.meta.env.VITE_ENABLE_LEGACY_RUNTIME_EDITOR === 'true') {
      await registerRuntimeEditorBridge();
    }

    // 隐藏加载页面
    loadingScreen?.hide();

    // 启动游戏循环
    game.start();

    // 暴露给调试
    window.gameInstance = game;
    window.game = game;

    if (import.meta.env.DEV) {
      void import('./debug/camera-debug-panel')
        .then(({ mountCameraDebugPanel }) => {
          disposeCameraDebugPanel();
          cameraDebugPanel = mountCameraDebugPanel({
            root: document.body,
            getGame: () => game,
          });
        })
        .catch((error) => console.warn('[camera-debug-panel] mount failed', error));

      void import('./debug/runtime-lighting-debug-panel')
        .then(({ mountRuntimeLightingDebugPanel }) => {
          disposeLightingDebugPanel();
          lightingDebugPanel = mountRuntimeLightingDebugPanel({
            root: document.body,
            getGame: () => game,
          });
        })
        .catch((error) => console.warn('[runtime-lighting-debug-panel] mount failed', error));

      void import('./debug/local-editor-mode-switcher')
        .then(({ mountLocalEditorModeSwitcher }) => {
          disposeLocalEditorModeSwitcher();
          localEditorModeSwitcher = mountLocalEditorModeSwitcher({
            root: document.body,
            disposeGameWorld: disposeProjectGameWorld,
            onBeforeReload: () => {
              disposeLocalEditorModeSwitcher();
            },
          });
        })
        .catch((error) => console.warn('[local-editor-mode-switcher] mount failed', error));
    }

  } catch (error) {
    console.error('[Main] Failed to initialize game:', error);
    // 发生错误时也隐藏加载页面
    clearLoadingScreen();
  }
}

function hasRenderCanvas(): boolean {
  return document.getElementById('renderCanvas') instanceof HTMLCanvasElement;
}

function waitForDomReadyAndStart(): Promise<void> {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', () => {
      void startInitOnce().then(resolve);
    }, { once: true });
  });
}

function startInitOnce(): Promise<void> {
  if (initStarted) return initPromise ?? Promise.resolve();
  if (!hasRenderCanvas()) return waitForDomReadyAndStart();
  initStarted = true;
  initPromise = init().finally(() => {
    initPromise = null;
  });
  return initPromise;
}

async function restartProjectGame(_context?: ProjectGameRestartContext): Promise<void> {
  await disposeProjectGameWorld();
  initStarted = false;
  initPromise = null;
  await startInitOnce();
}

// ============================================================
// 启动
// ============================================================

window.__restartProjectGame = restartProjectGame;

// 等待 DOM 加载完成；平台沙盒 srcdoc/动态注入时 DOMContentLoaded 可能已被错过，所以加微任务兜底。
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void startInitOnce();
  }, { once: true });
  queueMicrotask(() => {
    void startInitOnce();
  });
} else {
  void startInitOnce();
}

if (import.meta.env.DEV) {
  const disposeDevTools = () => {
    disposeLocalEditorModeSwitcher();
    disposeCameraDebugPanel();
    disposeLightingDebugPanel();
  };
  const disposeDevToolsForHotReload = () => {
    window.removeEventListener('beforeunload', disposeDevTools);
    disposeDevTools();
  };
  window.addEventListener('beforeunload', disposeDevTools);
  import.meta.hot?.dispose(disposeDevToolsForHotReload);
}

// ============================================================
// 调试接口
// ============================================================

declare global {
  interface Window {
    /** 游戏实例 */
    gameInstance: Game | null;
    /** 兼容部分平台脚本读取 window.game */
    game: Game | null;
    /** 沙盒/编辑器切回游戏模式时使用的无刷新重启入口 */
    __restartProjectGame?: (context?: ProjectGameRestartContext) => Promise<void>;
    /** Babylon.js 命名空间 (仅开发模式) */
    BABYLON?: any;
    ensureInspectorReady?: () => Promise<any>;
    INSPECTOR?: any;
  }
}

export { game };
