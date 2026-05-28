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
    loadingScreen = new LoadingScreen();

    // 创建游戏实例
    game = new Game({
      canvasId: 'renderCanvas',
      debug: true,
      enableAudio: true,
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
            disposeGameWorld: () => {
              disposeLightingDebugPanel();
              disposeCameraDebugPanel();
              game?.dispose();
              game = null;
              window.gameInstance = null;
              (window as any).game = null;
              (window as any).__bridgeProjectRuntime = null;
              (window as any).__pendingEditorRuntime = null;
            },
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
    loadingScreen?.hide();
  }
}

// ============================================================
// 启动
// ============================================================

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
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
    /** Babylon.js 命名空间 (仅开发模式) */
    BABYLON?: any;
    ensureInspectorReady?: () => Promise<any>;
    INSPECTOR?: any;
  }
}

export { game };
