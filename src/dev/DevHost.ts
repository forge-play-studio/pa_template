import {
  createPlayableEditorEntryController,
  createPlayableEditorEntryModuleLoader,
  createPlayableEditorEntryPerformanceTracker,
  type PlayableEditorEntryBuildIdentity,
  type PlayableEditorEntryController,
  type PlayableEditorEntryPerformanceMark,
  type PlayableEditorEntryPerformanceMeasurement,
  type PlayableEditorEntryResult,
  type PlayableEditorEntryState,
} from '@fps-games/editor/playable-sdk';
import { GameApplication } from '../entry/GameApplication';
import type { GameWorld } from '../runtime/GameWorld';
import { configValidator } from '../services';
import {
  LocalWorldEntryBackend,
  type LocalEditorEntryApplication,
  type ProjectGameRestartContext,
} from './LocalWorldEntryBackend';

export type { ProjectGameRestartContext } from './LocalWorldEntryBackend';

type RenderCanvasPlacement = {
  canvas: HTMLCanvasElement;
  parent: Node;
  nextSibling: ChildNode | null;
};

export interface DevHostEditorEntryViewState {
  readonly entry: PlayableEditorEntryState;
  readonly gameReady: boolean;
}

export interface DevHostEditorEntryDiagnostics {
  readonly build: PlayableEditorEntryBuildIdentity | null;
  readonly editorModuleImportAttempt: number;
  readonly editorModuleWarmup: PlayableEditorEntryPerformanceMeasurement | null;
  readonly enter: PlayableEditorEntryPerformanceMeasurement | null;
}

/** Development-only composition root for gameplay, debug UI and editor switching. */
export class DevHost {
  private readonly backend: LocalWorldEntryBackend<GameWorld>;
  private readonly entryController: PlayableEditorEntryController;
  private readonly entryViewListeners = new Set<(state: DevHostEditorEntryViewState) => void>();
  private readonly unsubscribeEntryController: () => void;
  private readonly entryPerformance = createPlayableEditorEntryPerformanceTracker();
  private editorEnterMark: PlayableEditorEntryPerformanceMark | null = null;
  private entryDiagnostics: DevHostEditorEntryDiagnostics = freezeEntryDiagnostics();
  private disposed = false;

  constructor() {
    const editorModuleLoader = createPlayableEditorEntryModuleLoader<LocalEditorModule>({
      baseUrl: window.location.href,
      importModule: url => import(/* @vite-ignore */ url) as Promise<LocalEditorModule>,
    });
    this.backend = new LocalWorldEntryBackend<GameWorld>({
      environment: {
        async prepareRuntime() {
          const BABYLON = await import('@babylonjs/core');
          (window as Window & { BABYLON?: unknown }).BABYLON = BABYLON;
          configValidator.validate();
        },
        createApplication: () => new GameApplication(),
        async destroyApplication(application: LocalEditorEntryApplication<GameWorld>) {
          const placement = captureRenderCanvasPlacement();
          try {
            await application.destroy();
          } finally {
            restoreRenderCanvasPlacement(placement);
          }
        },
        publishGame(world) {
          window.gameInstance = world;
          window.game = world;
        },
        clearRuntimeBridge() {
          window.__bridgeProjectRuntime = null;
          window.__pendingEditorRuntime = null;
        },
        async mountRuntimeDebug(input) {
          const { mountRuntimeDebug } = await import('../debug/runtime-debug-bootstrap');
          return mountRuntimeDebug({
            root: document.body,
            getGame: input.getGame,
            getGameplayRuntime: () => input.getGame()?.getProjectGameplayRuntime() ?? null,
            disposeGameWorld: input.disposeGameWorld,
          });
        },
        mountEditorSwitcher: async (options, signal) => {
          const mark = this.entryPerformance.mark();
          let editorModule: LocalEditorModule;
          try {
            editorModule = await editorModuleLoader.load(signal);
          } finally {
            this.entryDiagnostics = freezeEntryDiagnostics({
              build: editorModuleLoader.getManifest()?.build ?? null,
              editorModuleImportAttempt: editorModuleLoader.getImportAttempt(),
              editorModuleWarmup: this.entryPerformance.measure(mark),
              enter: this.entryDiagnostics.enter,
            });
            this.publishEditorEntryDiagnostics();
          }
          return editorModule.mountLocalEditorModeSwitcher({
            root: document.body,
            ...options,
          });
        },
      },
      onStateChanged: () => this.emitEditorEntryViewState(),
      onReturnedToGame: () => this.handleReturnedToGame(),
    });
    this.entryController = createPlayableEditorEntryController({
      backend: this.backend,
      reportFailure: ({ failure, cause, rollbackCause }) => {
        const details = rollbackCause === undefined ? cause : new AggregateError(
          [cause, rollbackCause],
          failure.message,
        );
        console.error(`[DevHost] editor entry ${failure.code}`, details);
      },
      reportListenerError: error => console.error('[DevHost] editor entry listener failed', error),
    });
    this.unsubscribeEntryController = this.entryController.subscribe(() => {
      this.recordEditorEntryPerformance(this.entryController.getState());
      this.emitEditorEntryViewState();
    });
    this.publishEditorEntryDiagnostics();
  }

  get game(): GameWorld | null {
    return this.backend.game;
  }

  start(): Promise<void> {
    return this.entryController.start();
  }

  restart(context?: ProjectGameRestartContext): Promise<void> {
    return this.backend.restart(context);
  }

  enterEditor(): Promise<PlayableEditorEntryResult> {
    return this.entryController.enter();
  }

  retryEditorEntry(): Promise<PlayableEditorEntryResult> {
    return this.entryController.retry();
  }

  getEditorEntryViewState(): DevHostEditorEntryViewState {
    return Object.freeze({
      entry: this.entryController.getState(),
      gameReady: this.backend.gameReady,
    });
  }

  getEditorEntryDiagnostics(): DevHostEditorEntryDiagnostics {
    return this.entryDiagnostics;
  }

  subscribeEditorEntryView(
    listener: (state: DevHostEditorEntryViewState) => void,
  ): () => void {
    if (this.disposed) return () => undefined;
    this.entryViewListeners.add(listener);
    listener(this.getEditorEntryViewState());
    return () => {
      this.entryViewListeners.delete(listener);
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeEntryController();
    this.entryViewListeners.clear();
    try {
      await this.entryController.dispose();
    } finally {
      window.__FPS_EDITOR_ENTRY_DIAGNOSTICS__ = undefined;
    }
  }

  private handleReturnedToGame(): void {
    if (this.disposed) return;
    this.entryController.reset();
    // The product lifecycle closes the complete old Plugin application scope
    // before invoking restartGame, so the replacement switcher can mount here
    // without racing the previous editor's deferred cleanup.
    void this.entryController.start().catch(error => {
      console.error('[DevHost] editor warmup after game restart failed', error);
    });
  }

  private emitEditorEntryViewState(): void {
    if (this.disposed) return;
    const state = this.getEditorEntryViewState();
    for (const listener of [...this.entryViewListeners]) {
      try {
        listener(state);
      } catch (error) {
        console.error('[DevHost] editor entry view listener failed', error);
      }
    }
  }

  private recordEditorEntryPerformance(state: PlayableEditorEntryState): void {
    if (state.phase === 'preparing') {
      this.editorEnterMark = this.entryPerformance.mark();
      this.entryDiagnostics = freezeEntryDiagnostics({
        build: this.entryDiagnostics.build,
        editorModuleImportAttempt: this.entryDiagnostics.editorModuleImportAttempt,
        editorModuleWarmup: this.entryDiagnostics.editorModuleWarmup,
        enter: null,
      });
      this.publishEditorEntryDiagnostics();
      return;
    }
    const entrySettled = state.phase === 'editing'
      || (state.phase === 'failed' && state.failure?.phase !== 'warmup');
    if (!entrySettled || !this.editorEnterMark) return;
    const mark = this.editorEnterMark;
    this.editorEnterMark = null;
    this.entryDiagnostics = freezeEntryDiagnostics({
      build: this.entryDiagnostics.build,
      editorModuleImportAttempt: this.entryDiagnostics.editorModuleImportAttempt,
      editorModuleWarmup: this.entryDiagnostics.editorModuleWarmup,
      enter: this.entryPerformance.measure(mark),
    });
    this.publishEditorEntryDiagnostics();
  }

  private publishEditorEntryDiagnostics(): void {
    window.__FPS_EDITOR_ENTRY_DIAGNOSTICS__ = this.entryDiagnostics;
  }
}

type LocalEditorModule = typeof import('../services/fps-game-editor/local-editor');

function freezeEntryDiagnostics(
  value: Partial<DevHostEditorEntryDiagnostics> = {},
): DevHostEditorEntryDiagnostics {
  return Object.freeze({
    build: value.build ?? null,
    editorModuleImportAttempt: value.editorModuleImportAttempt ?? 0,
    editorModuleWarmup: value.editorModuleWarmup ?? null,
    enter: value.enter ?? null,
  });
}

function captureRenderCanvasPlacement(): RenderCanvasPlacement | null {
  const canvas = document.getElementById('renderCanvas');
  if (!(canvas instanceof HTMLCanvasElement) || !canvas.parentNode) return null;
  return { canvas, parent: canvas.parentNode, nextSibling: canvas.nextSibling };
}

function restoreRenderCanvasPlacement(placement: RenderCanvasPlacement | null): void {
  if (!placement || placement.canvas.isConnected) return;
  const parent = placement.parent.isConnected ? placement.parent : document.body;
  const nextSibling = placement.nextSibling?.parentNode === parent ? placement.nextSibling : null;
  parent.insertBefore(placement.canvas, nextSibling);
}

declare global {
  interface Window {
    BABYLON?: unknown;
    gameInstance: GameWorld | null;
    game: GameWorld | null;
    __restartProjectGame?: (context?: ProjectGameRestartContext) => Promise<void>;
    ensureInspectorReady?: () => Promise<unknown>;
    INSPECTOR?: unknown;
    __bridgeProjectRuntime?: unknown;
    __pendingEditorRuntime?: unknown;
    __FPS_EDITOR_ENTRY_DIAGNOSTICS__?: DevHostEditorEntryDiagnostics;
  }
}
