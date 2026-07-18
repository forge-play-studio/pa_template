import {
  createPlayableEditorEntryController,
  type PlayableEditorEntryController,
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

/** Development-only composition root for gameplay, debug UI and editor switching. */
export class DevHost {
  private readonly backend: LocalWorldEntryBackend<GameWorld>;
  private readonly entryController: PlayableEditorEntryController;
  private readonly entryViewListeners = new Set<(state: DevHostEditorEntryViewState) => void>();
  private readonly unsubscribeEntryController: () => void;
  private disposed = false;

  constructor() {
    let editorModuleLoadAttempt = 0;
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
        async mountEditorSwitcher(options) {
          const { mountLocalEditorModeSwitcher } = await loadLocalEditorModule(
            ++editorModuleLoadAttempt,
          );
          return mountLocalEditorModeSwitcher({
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
      this.emitEditorEntryViewState();
    });
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
    await this.entryController.dispose();
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
}

type LocalEditorModule = typeof import('../services/fps-game-editor/local-editor');

async function loadLocalEditorModule(attempt: number): Promise<LocalEditorModule> {
  // Browsers cache a failed dynamic-import promise by URL. Use a distinct URL
  // per warmup attempt so a transient dev-server/network failure is retryable
  // without reloading and destroying the still-running GameWorld.
  const modulePath = '../services/fps-game-editor/local-editor.ts';
  const moduleUrl = new URL(modulePath, import.meta.url);
  moduleUrl.searchParams.set('fps-editor-entry-attempt', String(attempt));
  return import(/* @vite-ignore */ moduleUrl.href) as Promise<LocalEditorModule>;
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
  }
}
