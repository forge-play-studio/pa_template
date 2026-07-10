/**
 * 应用入口
 * 初始化游戏应用（新系统）
 */

import { LoadingScreen } from './ui';
import { Game } from './core/Game';
import { playableAnalyticsService } from './services';

// ============================================================
// 全局实例
// ============================================================

/** 游戏实例 */
let game: Game | null = null;

/** 加载屏幕 */
let loadingScreen: LoadingScreen | null = null;

/** DEV-only runtime debug bootstrap */
let runtimeDebug: { dispose(): void; detachForEditor?: () => void } | null = null;

/** Explicit test-build-only WASD scene walkthrough. */
let sceneWalkthrough: { dispose(): void } | null = null;

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

function disposeRuntimeDebug(): void {
  runtimeDebug?.dispose();
  runtimeDebug = null;
}

function disposeSceneWalkthrough(): void {
  sceneWalkthrough?.dispose();
  sceneWalkthrough = null;
}

async function mountSceneWalkthroughForTestBuild(): Promise<void> {
  if (!__SCENE_WALKTHROUGH_BUILD__ || !game) return;
  const { mountSceneWalkthrough } = await import('./test-build/scene-walkthrough');
  disposeSceneWalkthrough();
  sceneWalkthrough = mountSceneWalkthrough(game);
}

function detachRuntimeDebugForEditor(): void {
  runtimeDebug?.detachForEditor?.();
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

async function mountRuntimeDebugForDev(): Promise<void> {
  try {
    const { mountRuntimeDebug } = await import('./debug/runtime-debug-bootstrap');
    disposeRuntimeDebug();
    runtimeDebug = mountRuntimeDebug({
      root: document.body,
      getGame: () => game,
      getGameplayRuntime: () => game?.getProjectGameplayRuntime() ?? null,
      disposeGameWorld: disposeProjectGameWorldForEditor,
    });
  } catch (error) {
    console.warn('[runtime-debug-bootstrap] mount failed', error);
  }
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

type RenderCanvasPlacement = {
  canvas: HTMLCanvasElement;
  parent: Node;
  nextSibling: ChildNode | null;
};

function captureRenderCanvasPlacement(): RenderCanvasPlacement | null {
  const canvas = document.getElementById('renderCanvas');
  if (!(canvas instanceof HTMLCanvasElement) || !canvas.parentNode) return null;
  return {
    canvas,
    parent: canvas.parentNode,
    nextSibling: canvas.nextSibling,
  };
}

function restoreRenderCanvasPlacement(placement: RenderCanvasPlacement | null): void {
  if (!placement || placement.canvas.isConnected) return;
  const parent = placement.parent.isConnected ? placement.parent : document.body;
  const nextSibling = placement.nextSibling?.parentNode === parent ? placement.nextSibling : null;
  parent.insertBefore(placement.canvas, nextSibling);
}

async function disposeProjectGameWorldCore(): Promise<void> {
  disposeSceneWalkthrough();
  const gameToDispose = game;
  const renderCanvasPlacement = captureRenderCanvasPlacement();
  game = null;
  clearProjectRuntimeGlobals();
  if (gameToDispose) {
    await waitForSceneReadyBeforeDispose(gameToDispose);
    gameToDispose.dispose();
    restoreRenderCanvasPlacement(renderCanvasPlacement);
  }
  clearLoadingScreen();
}

async function disposeProjectGameWorld(): Promise<void> {
  disposeRuntimeDebug();
  await disposeProjectGameWorldCore();
}

async function disposeProjectGameWorldForEditor(): Promise<void> {
  detachRuntimeDebugForEditor();
  await disposeProjectGameWorldCore();
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

    playableAnalyticsService.resetForNewSession();
    playableAnalyticsService.reportInitPlayable();

    // 创建并显示加载页面
    clearLoadingScreen();
    loadingScreen = new LoadingScreen();

    // 创建游戏实例
    game = new Game({
      canvasId: 'renderCanvas',
      debug: true,
      enableAudio: true,
    });

    // 初始化游戏（包括资源加载和场景构建）
    await game.init();
    playableAnalyticsService.reportLoaded();

    if (import.meta.env.VITE_ENABLE_LEGACY_RUNTIME_EDITOR === 'true') {
      await registerRuntimeEditorBridge();
    }

    // 隐藏加载页面
    loadingScreen?.hide();

    // 启动游戏循环
    game.start();
    window.requestAnimationFrame(() => {
      playableAnalyticsService.reportDisplay();
      playableAnalyticsService.reportProgressMilestone(0);
    });

    // 暴露给调试
    window.gameInstance = game;
    window.game = game;

    if (import.meta.env.DEV) {
      await mountRuntimeDebugForDev();
    }

    if (__SCENE_WALKTHROUGH_BUILD__) {
      await mountSceneWalkthroughForTestBuild();
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

window.addEventListener('beforeunload', () => playableAnalyticsService.reportCompleted());
window.addEventListener('pagehide', () => playableAnalyticsService.reportCompleted());

if (import.meta.env.DEV) {
  const disposeDevTools = () => {
    disposeRuntimeDebug();
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
