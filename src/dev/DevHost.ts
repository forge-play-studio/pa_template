import type { RuntimeDebugBootstrap } from '../debug/runtime-debug-bootstrap';
import { GameApplication } from '../entry/GameApplication';
import type { GameWorld } from '../runtime/GameWorld';
import { configValidator } from '../services';

export type ProjectGameRestartContext = {
  reason?: string;
};

type RenderCanvasPlacement = {
  canvas: HTMLCanvasElement;
  parent: Node;
  nextSibling: ChildNode | null;
};

/** Development-only composition root for gameplay, debug UI and editor switching. */
export class DevHost {
  private application: GameApplication | null = null;
  private gameValue: GameWorld | null = null;
  private runtimeDebug: RuntimeDebugBootstrap | null = null;
  private runtimeDebugDisposal: Promise<void> | null = null;
  private startPromise: Promise<void> | null = null;

  get game(): GameWorld | null {
    return this.gameValue;
  }

  start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    const pending = this.startNow();
    this.startPromise = pending;
    return pending.finally(() => {
      if (this.startPromise === pending) this.startPromise = null;
    });
  }

  async restart(context?: ProjectGameRestartContext): Promise<void> {
    const restartingFromEditor = context?.reason === 'save' || context?.reason === 'discard';
    if (restartingFromEditor) {
      this.runtimeDebug = null;
    } else {
      await this.disposeRuntimeDebug();
    }
    await this.disposeApplication();
    await this.start();
  }

  async dispose(): Promise<void> {
    const errors: unknown[] = [];
    try {
      await this.disposeRuntimeDebug();
    } catch (error) {
      errors.push(error);
    }
    try {
      await this.disposeApplication();
    } catch (error) {
      errors.push(error);
    }
    this.clearRuntimeGlobals();
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'DevHost cleanup failed.');
  }

  private async startNow(): Promise<void> {
    if (this.application) return;

    try {
      const BABYLON = await import('@babylonjs/core');
      (window as any).BABYLON = BABYLON;
      configValidator.validate();

      const application = new GameApplication();
      this.application = application;
      const world = await application.start();
      this.gameValue = world;
      window.gameInstance = world;
      window.game = world;

      const { mountRuntimeDebug } = await import('../debug/runtime-debug-bootstrap');
      await this.disposeRuntimeDebug();
      this.runtimeDebug = mountRuntimeDebug({
        root: document.body,
        getGame: () => this.gameValue,
        getGameplayRuntime: () => this.gameValue?.getProjectGameplayRuntime() ?? null,
        disposeGameWorld: () => this.disposeGameWorldForEditor(),
      });
    } catch (error) {
      try {
        await this.disposeApplication();
      } catch (cleanupError) {
        console.error('[DevHost] Failed to clean up after initialization error:', cleanupError);
      }
      console.error('[DevHost] Failed to initialize development runtime:', error);
      throw error;
    }
  }

  private async disposeGameWorldForEditor(): Promise<void> {
    this.runtimeDebug?.detachForEditor();
    await this.disposeApplication();
  }

  private async disposeRuntimeDebug(): Promise<void> {
    if (this.runtimeDebugDisposal) return this.runtimeDebugDisposal;
    const current = this.runtimeDebug;
    if (!current) return;

    const pending = current.dispose().finally(() => {
      if (this.runtimeDebug === current) this.runtimeDebug = null;
    });
    this.runtimeDebugDisposal = pending;
    try {
      await pending;
    } finally {
      if (this.runtimeDebugDisposal === pending) this.runtimeDebugDisposal = null;
    }
  }

  private async disposeApplication(): Promise<void> {
    const application = this.application;
    const placement = captureRenderCanvasPlacement();
    this.application = null;
    this.gameValue = null;
    this.clearRuntimeGlobals();
    try {
      await application?.destroy();
    } finally {
      restoreRenderCanvasPlacement(placement);
    }
  }

  private clearRuntimeGlobals(): void {
    window.gameInstance = null;
    window.game = null;
    window.__bridgeProjectRuntime = null;
    window.__pendingEditorRuntime = null;
  }
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
    gameInstance: GameWorld | null;
    game: GameWorld | null;
    __restartProjectGame?: (context?: ProjectGameRestartContext) => Promise<void>;
    ensureInspectorReady?: () => Promise<unknown>;
    INSPECTOR?: unknown;
    __bridgeProjectRuntime?: unknown;
    __pendingEditorRuntime?: unknown;
  }
}
