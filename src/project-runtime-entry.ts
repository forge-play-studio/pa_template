/**
 * 应用入口
 * 初始化游戏应用（新系统）
 *
 * Thin editor-adapter note.
 * Last updated: 2026-07-05.
 *
 * This file remains the project runtime entry. It only conditionally loads the
 * dev-only debug bootstrap. The editor is now mounted through the product
 * local-editor host path rather than the retired runtime bridge.
 */

import { LoadingScreen } from './ui';
import { Game } from './core/Game';
import { playableAnalyticsService } from './services';
import {
  disposeProjectRuntimePlugins,
  startProjectRuntimePlugins,
} from './services/fps-game-editor/runtime-plugin-host';

// ============================================================
// 全局实例
// ============================================================

/** 游戏实例 */
let game: Game | null = null;

/** 加载屏幕 */
let loadingScreen: LoadingScreen | null = null;

/** DEV-only runtime debug bootstrap */
let runtimeDebug: { dispose(): Promise<void>; detachForEditor?: () => void } | null = null;
let runtimeDebugDisposal: Promise<void> | null = null;

/** DEV-only runtime inspector; follows the page document, not one Game instance. */
let runtimeInspector: { beforeSceneChange(): void; dispose(): void } | null = null;

/** Explicit dedicated-build-only WASD scene walkthrough. */
let sceneWalkthrough: { dispose(): void } | null = null;

/** 确保沙盒/动态注入场景下入口只启动一次 */
let initStarted = false;

/** 当前初始化任务，用于重启入口等待游戏世界真正 ready */
let initPromise: Promise<void> | null = null;

type ProjectGameRestartContext = {
  reason?: string;
};

async function disposeRuntimeDebug(): Promise<void> {
  if (runtimeDebugDisposal) return runtimeDebugDisposal;
  const current = runtimeDebug;
  if (!current) return;
  const pending = (async () => {
    await current.dispose();
    if (runtimeDebug === current) runtimeDebug = null;
  })();
  runtimeDebugDisposal = pending;
  try {
    await pending;
  } finally {
    if (runtimeDebugDisposal === pending) runtimeDebugDisposal = null;
  }
}

function disposeRuntimeInspector(): void {
  runtimeInspector?.dispose();
  runtimeInspector = null;
}

function disposeSceneWalkthrough(): void {
  const current = sceneWalkthrough;
  sceneWalkthrough = null;
  current?.dispose();
}

async function mountSceneWalkthroughForDedicatedBuild(): Promise<void> {
  if (!__SCENE_WALKTHROUGH_BUILD__ || !game) return;
  const { mountSceneWalkthrough } = await import('./test-build/scene-walkthrough');
  disposeSceneWalkthrough();
  sceneWalkthrough = mountSceneWalkthrough(game);
}

function detachRuntimeDebugForEditor(): void {
  runtimeDebug?.detachForEditor?.();
}

function releaseRuntimeDebugOwnershipForEditorRestart(): void {
  runtimeDebug = null;
}

function clearLoadingScreen(): void {
  const current = loadingScreen;
  loadingScreen = null;
  current?.dispose();
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
    await disposeRuntimeDebug();
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

async function ensureRuntimeInspectorForDev(): Promise<void> {
  if (runtimeInspector) return;
  try {
    const { mountTemplateRuntimeInspector } = await import('./debug/runtime-inspector/template');
    runtimeInspector = mountTemplateRuntimeInspector({
      getGame: () => game,
    });
  } catch (error) {
    console.warn('[runtime-inspector] mount failed', error);
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
  const errors: unknown[] = [];
  try { disposeSceneWalkthrough(); } catch (error) { errors.push(error); }
  const gameToDispose = game;
  try { runtimeInspector?.beforeSceneChange(); } catch (error) { errors.push(error); }
  const renderCanvasPlacement = captureRenderCanvasPlacement();
  game = null;
  try { clearProjectRuntimeGlobals(); } catch (error) { errors.push(error); }
  if (gameToDispose) {
    try {
      await waitForSceneReadyBeforeDispose(gameToDispose);
      gameToDispose.dispose();
    } catch (error) {
      errors.push(error);
    } finally {
      try { restoreRenderCanvasPlacement(renderCanvasPlacement); } catch (error) { errors.push(error); }
    }
  }
  try { clearLoadingScreen(); } catch (error) { errors.push(error); }
  try { await disposeProjectRuntimePlugins(); } catch (error) { errors.push(error); }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw Object.assign(new Error('Project game world cleanup failed.'), { errors });
}

async function disposeProjectGameWorld(): Promise<void> {
  const errors: unknown[] = [];
  try { await disposeRuntimeDebug(); } catch (error) { errors.push(error); }
  try { await disposeProjectGameWorldCore(); } catch (error) { errors.push(error); }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw Object.assign(new Error('Project game world disposal failed.'), { errors });
}

async function disposeProjectGameWorldForEditor(): Promise<void> {
  const errors: unknown[] = [];
  try { detachRuntimeDebugForEditor(); } catch (error) { errors.push(error); }
  try { await disposeProjectGameWorldCore(); } catch (error) { errors.push(error); }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw Object.assign(new Error('Editor game world disposal failed.'), { errors });
}

// ============================================================
// 初始化函数
// ============================================================

/**
 * 主初始化函数
 */
async function init(): Promise<void> {
  try {
    await startProjectRuntimePlugins();
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
      await ensureRuntimeInspectorForDev();
      await mountRuntimeDebugForDev();
    }

    if (__SCENE_WALKTHROUGH_BUILD__) {
      await mountSceneWalkthroughForDedicatedBuild();
    }

  } catch (error) {
    try {
      await disposeProjectGameWorldCore();
    } catch (cleanupError) {
      console.error('[Main] Failed to clean up after initialization error:', cleanupError);
    }
    console.error('[Main] Failed to initialize game:', error);
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

async function restartProjectGame(context?: ProjectGameRestartContext): Promise<void> {
  const restartingFromEditor = context?.reason === 'save' || context?.reason === 'discard';
  if (restartingFromEditor) {
    releaseRuntimeDebugOwnershipForEditorRestart();
    await disposeProjectGameWorldCore();
  } else {
    await disposeProjectGameWorld();
  }
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
    void disposeRuntimeDebug().catch(error => console.warn('[runtime-debug-bootstrap] dispose failed', error));
    disposeRuntimeInspector();
  };
  const disposeDevToolsForHotReload = () => {
    window.removeEventListener('beforeunload', disposeDevTools);
    disposeDevTools();
  };
  window.addEventListener('beforeunload', disposeDevTools);
  import.meta.hot?.accept('./debug/runtime-inspector/template', module => {
    if (!module) return;
    disposeRuntimeInspector();
    runtimeInspector = module.mountTemplateRuntimeInspector({ getGame: () => game });
  });
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
