/**
 * 应用入口
 * 初始化游戏应用（新系统）
 */

import { LoadingScreen } from './ui';
import { Game } from './core/Game';
import { registerProjectEditorPlugin, registerProjectEditorRuntimeBridge } from './editor-package';

// ============================================================
// 全局实例
// ============================================================

/** 游戏实例 */
let game: Game | null = null;

/** 加载屏幕 */
let loadingScreen: LoadingScreen | null = null;

function installBridgeInspectorPatch(): void {
  if (!import.meta.env.DEV) return;

  const w = window as any;
  let attempts = 0;
  const maxAttempts = 120;

  const tryPatch = () => {
    const editor = w.__bridge?.editor;
    if (!editor) {
      if (attempts < maxAttempts) {
        attempts++;
        window.setTimeout(tryPatch, 250);
      }
      return;
    }

    if (editor.__localInspectorLoadPatched) return;

    const ensureLocalInspector = async () => {
      const localInspector = typeof w.ensureInspectorReady === 'function'
        ? await w.ensureInspectorReady()
        : null;
      if (localInspector?.ShowInspector) {
        w.INSPECTOR = localInspector;
      }
      return localInspector;
    };

    if (typeof editor.showInspector === 'function') {
      const originalShowInspector = editor.showInspector.bind(editor);
      editor.showInspector = async (...args: unknown[]) => {
        await ensureLocalInspector();
        return originalShowInspector(...args);
      };
    }

    if (typeof editor.loadV2 === 'function') {
      const originalLoadV2 = editor.loadV2.bind(editor);
      editor.loadV2 = async (...args: unknown[]) => {
        const localInspector = await ensureLocalInspector();
        if (localInspector?.ShowInspector) {
          return localInspector;
        }
        return originalLoadV2(...args);
      };
    }
    editor.__localInspectorLoadPatched = true;
  };

  tryPatch();
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
      installBridgeInspectorPatch();
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

    registerProjectEditorPlugin();
    registerProjectEditorRuntimeBridge();

    // 隐藏加载页面
    loadingScreen?.hide();

    // 启动游戏循环
    game.start();

    // 暴露给调试
    window.gameInstance = game;

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
