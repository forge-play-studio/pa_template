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

/** 确保沙盒/动态注入场景下入口只启动一次 */
let initStarted = false;

/** 当前初始化任务，用于重启入口等待游戏世界真正 ready */
let initPromise: Promise<void> | null = null;

type ProjectGameRestartContext = {
  reason?: string;
};

interface RecordReplayStartupControl {
  autoStart: boolean;
  autoReplay: boolean;
  tapeKey: string;
}

interface RecordReplayAgentApiLike {
  startRec(options?: { label?: string; maxFrames?: number }): unknown;
  import(json: string): unknown;
  replay(recording?: unknown, options?: { restart?: boolean; resumeOnComplete?: boolean }): Promise<unknown>;
}

const RECORD_REPLAY_AUTO_RECORD_MAX_FRAMES = 200_000;
const RECORD_REPLAY_DEFAULT_AUTO_REPLAY_TAPE_KEY = 'pa-template.record-replay.autoReplayTape';
const RECORD_REPLAY_SETTLED_TIMEOUT_MS = 10_000;

async function registerRuntimeEditorBridge(): Promise<void> {
  const editorModule = await import('./fps-game-editor-adapter/runtime');
  editorModule.registerProjectFpsGameEditorRuntimeBridge();
}

function disposeRuntimeDebug(): void {
  runtimeDebug?.dispose();
  runtimeDebug = null;
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
    const { createTemplateRecordingBanner } = await import('./debug/record-replay/template-providers');
    disposeRuntimeDebug();
    const flags = readRecordReplayPanelFlags();
    runtimeDebug = mountRuntimeDebug({
      root: document.body,
      getGame: () => game,
      getGameplayRuntime: () => game?.getProjectGameplayRuntime() ?? null,
      disposeGameWorld: disposeProjectGameWorldForEditor,
      humanRecording: flags.humanRecording,
      forceShowPanels: flags.panelsForced,
      recordingBanner: createTemplateRecordingBanner(() => game),
    });
  } catch (error) {
    console.warn('[runtime-debug-bootstrap] mount failed', error);
  }
}

function readRecordReplayStartupControl(): RecordReplayStartupControl {
  const params = new URLSearchParams(window.location.search);
  return {
    autoStart: isTruthyQueryParam(params.get('rrAutoStart')),
    autoReplay: isTruthyQueryParam(params.get('rrAutoReplay')),
    tapeKey: params.get('rrTapeKey')?.trim() || RECORD_REPLAY_DEFAULT_AUTO_REPLAY_TAPE_KEY,
  };
}

function isTruthyQueryParam(value: string | null): boolean {
  if (value === null) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === '1' || normalized === 'true' || normalized === 'yes';
}

async function prepareRecordReplayStartupControl(): Promise<RecordReplayStartupControl | null> {
  const control = readRecordReplayStartupControl();
  if (!control.autoStart && !control.autoReplay) return null;
  if (control.autoStart && control.autoReplay) {
    throw new Error('rrAutoStart and rrAutoReplay cannot be enabled at the same time.');
  }
  await mountRuntimeDebugForDev();
  game?.pause();
  return control;
}

async function runRecordReplayStartupControl(control: RecordReplayStartupControl): Promise<void> {
  if (control.autoStart) {
    await runRecordReplayAutoStart();
    return;
  }
  await runRecordReplayAutoReplay(control);
}

/**
 * `?rrPanels=1` 是逃生口:强制显示面板(agent 调试回放时要看)。
 * `?rrAutoStart=1` 且没带它 ⇒ 真人示教模式,面板全隐藏。
 */
function readRecordReplayPanelFlags(): { panelsForced: boolean; humanRecording: boolean } {
  const params = new URLSearchParams(window.location.search);
  const panelsForced = isTruthyQueryParam(params.get('rrPanels'));
  const autoStart = isTruthyQueryParam(params.get('rrAutoStart'));
  return { panelsForced, humanRecording: autoStart && !panelsForced };
}

async function runRecordReplayAutoStart(): Promise<void> {
  const currentGame = game;
  if (!currentGame) throw new Error('Game is not ready for rrAutoStart.');
  currentGame.pause();
  await waitForRecordReplayGameplaySettled(currentGame, 'rrAutoStart');
  // 走 controller 而不是裸 startRec:这条 session 归 controller 所有,会走增量落盘 /
  // pagehide flush / CTA finalize。controller 不在(挂载失败)时退回裸 startRec。
  const controller = window.__demoRec;
  if (controller) {
    await controller.start('rrAutoStart');
    console.info('[record-replay] rrAutoStart armed', controller.getStatus());
  } else {
    const result = readRecordReplayApi()?.startRec({
      label: 'rrAutoStart',
      maxFrames: RECORD_REPLAY_AUTO_RECORD_MAX_FRAMES,
    });
    console.info('[record-replay] rrAutoStart armed (no sink)', result);
  }
  currentGame.resume();
}

async function runRecordReplayAutoReplay(control: RecordReplayStartupControl): Promise<void> {
  const api = readRecordReplayApi();
  if (!api) throw new Error('record-replay API is not mounted.');
  const tapeJson = window.localStorage.getItem(control.tapeKey);
  if (!tapeJson) {
    console.warn(`[record-replay] rrAutoReplay paused at frame 0; localStorage key "${control.tapeKey}" has no tape.`);
    return;
  }
  const recording = api.import(tapeJson);
  await api.replay(recording, { restart: false, resumeOnComplete: false });
}

function readRecordReplayApi(): RecordReplayAgentApiLike | undefined {
  return (window as unknown as { __rr?: RecordReplayAgentApiLike }).__rr;
}

function waitForRecordReplayGameplaySettled(currentGame: Game, label: string): Promise<Game> {
  if (currentGame.isGameplaySettled()) return Promise.resolve(currentGame);
  const startedAt = performance.now();
  const anchorFrame = currentGame.getFrameCount();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (currentGame.getFrameCount() !== anchorFrame) {
        reject(new Error(`Gameplay frame advanced before ${label} settled: anchor=${anchorFrame}, current=${currentGame.getFrameCount()}`));
        return;
      }
      if (currentGame.isGameplaySettled()) {
        resolve(currentGame);
        return;
      }
      if (performance.now() - startedAt > RECORD_REPLAY_SETTLED_TIMEOUT_MS) {
        reject(new Error(`Timed out waiting for gameplay settled before ${label}.`));
        return;
      }
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(poll);
      else window.setTimeout(poll, 16);
    };
    poll();
  });
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

    // 暴露给调试。record-replay auto 模式需要在 start() 前拿到 frame-0 game。
    window.gameInstance = game;
    window.game = game;

    const recordReplayStartupControl = import.meta.env.DEV
      ? await prepareRecordReplayStartupControl()
      : null;

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

    if (import.meta.env.DEV) {
      if (recordReplayStartupControl) {
        await runRecordReplayStartupControl(recordReplayStartupControl);
      } else {
        await mountRuntimeDebugForDev();
      }
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
