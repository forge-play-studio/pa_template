import type {
  PlayableEditorEntryBackend,
  PlayableEditorEntryOperationContext,
} from '@fps-games/editor/playable-sdk';

export type ProjectGameRestartContext = {
  reason?: string;
};

export interface LocalEditorEntryApplication<TWorld> {
  start(): Promise<TWorld>;
  destroy(): Promise<void>;
}

export interface LocalEditorEntryRuntimeDebug {
  detachForEditor(): void;
  dispose(): Promise<void>;
}

export interface LocalEditorEntryModeSwitcher {
  enterEditor(): Promise<void>;
  discardAndRunGame(): Promise<void>;
  detachForEditor(): void;
  dispose(): Promise<void>;
}

export interface LocalEditorEntryModeSwitcherOptions {
  disposeGameWorld: () => Promise<void>;
  onBeforeEnterEditor: () => void;
  onBeforeReload: () => void;
  restartGame: (context?: ProjectGameRestartContext) => Promise<void>;
}

export interface LocalWorldEntryEnvironment<TWorld> {
  prepareRuntime(): Promise<void>;
  createApplication(): LocalEditorEntryApplication<TWorld>;
  destroyApplication(application: LocalEditorEntryApplication<TWorld>): Promise<void>;
  publishGame(world: TWorld | null): void;
  clearRuntimeBridge(): void;
  mountRuntimeDebug(input: {
    getGame: () => TWorld | null;
    disposeGameWorld: () => Promise<void>;
  }): LocalEditorEntryRuntimeDebug | Promise<LocalEditorEntryRuntimeDebug>;
  mountEditorSwitcher(
    options: LocalEditorEntryModeSwitcherOptions,
    signal: AbortSignal,
  ): Promise<LocalEditorEntryModeSwitcher>;
}

export interface LocalWorldEntryBackendOptions<TWorld> {
  environment: LocalWorldEntryEnvironment<TWorld>;
  onStateChanged?: () => void;
  onReturnedToGame?: () => void;
}

export interface LocalWorldEntryPrepared {
  readonly switcher: LocalEditorEntryModeSwitcher;
}

export class LocalWorldEntryBackend<TWorld>
implements PlayableEditorEntryBackend<LocalWorldEntryPrepared> {
  private application: LocalEditorEntryApplication<TWorld> | null = null;
  private worldValue: TWorld | null = null;
  private runtimeDebug: LocalEditorEntryRuntimeDebug | null = null;
  private runtimeDebugDisposal: Promise<void> | null = null;
  private editorSwitcher: LocalEditorEntryModeSwitcher | null = null;
  private editorSwitcherLoad: Promise<LocalEditorEntryModeSwitcher> | null = null;
  private startPromise: Promise<void> | null = null;
  private disposal: Promise<void> | null = null;
  private disposed = false;

  constructor(private readonly options: LocalWorldEntryBackendOptions<TWorld>) {}

  get game(): TWorld | null {
    return this.worldValue;
  }

  get gameReady(): boolean {
    return this.worldValue !== null;
  }

  startGameWorld(): Promise<void> {
    if (this.disposed) return Promise.reject(createAbortError());
    if (this.worldValue) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    const pending = this.startGameWorldNow();
    this.startPromise = pending;
    void pending.finally(() => {
      if (this.startPromise === pending) this.startPromise = null;
    }).catch(() => undefined);
    return pending;
  }

  async restart(context?: ProjectGameRestartContext): Promise<void> {
    this.assertActive();
    await this.startPromise;
    this.assertActive();
    const returningFromEditor = context?.reason === 'save' || context?.reason === 'discard';
    if (returningFromEditor) this.editorSwitcher = null;
    await this.disposeRuntimeDebug();
    await this.disposeApplication();
    await this.startGameWorld();
    if (returningFromEditor) this.options.onReturnedToGame?.();
  }

  async warmup(signal: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    await this.startGameWorld();
    throwIfAborted(signal);
    await this.ensureEditorSwitcher(signal);
    throwIfAborted(signal);
  }

  async prepare(context: PlayableEditorEntryOperationContext): Promise<LocalWorldEntryPrepared> {
    throwIfAborted(context.signal);
    await this.startGameWorld();
    throwIfAborted(context.signal);
    const switcher = await this.ensureEditorSwitcher(context.signal);
    throwIfAborted(context.signal);
    return Object.freeze({ switcher });
  }

  async commit(
    prepared: LocalWorldEntryPrepared,
    context: PlayableEditorEntryOperationContext,
  ): Promise<void> {
    throwIfAborted(context.signal);
    if (prepared.switcher !== this.editorSwitcher) {
      throw new Error('Prepared local Editor switcher is no longer current.');
    }
    await prepared.switcher.enterEditor();
    throwIfAborted(context.signal);
  }

  async rollback(prepared: LocalWorldEntryPrepared, _cause: unknown): Promise<void> {
    const errors: unknown[] = [];
    try {
      await this.disposeEditorSwitcher(prepared.switcher);
    } catch (error) {
      errors.push(error);
    }
    if (!this.disposed) {
      try {
        if (this.worldValue) await this.remountRuntimeDebug();
        else await this.startGameWorld();
      } catch (error) {
        errors.push(error);
      }
    }
    throwCollectedErrors(errors, 'Local Editor entry rollback failed.');
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    const pending = (async () => {
      const activeOperations: Promise<unknown>[] = [];
      if (this.startPromise) activeOperations.push(this.startPromise);
      if (this.editorSwitcherLoad) activeOperations.push(this.editorSwitcherLoad);
      await Promise.allSettled(activeOperations);
      const errors: unknown[] = [];
      for (const cleanup of [
        () => this.disposeEditorSwitcher(),
        () => this.disposeRuntimeDebug(),
        () => this.disposeApplication(),
      ]) {
        try {
          await cleanup();
        } catch (error) {
          errors.push(error);
        }
      }
      this.options.environment.clearRuntimeBridge();
      throwCollectedErrors(errors, 'Local World entry backend cleanup failed.');
    })();
    this.disposal = pending;
    return pending;
  }

  private async startGameWorldNow(): Promise<void> {
    await this.options.environment.prepareRuntime();
    this.assertActive();
    const application = this.options.environment.createApplication();
    this.application = application;
    try {
      const world = await application.start();
      this.assertActive();
      if (this.application !== application) throw new Error('Game application ownership changed during startup.');
      this.worldValue = world;
      this.options.environment.publishGame(world);
      this.options.onStateChanged?.();
      await this.remountRuntimeDebug();
    } catch (error) {
      let cleanupError: unknown;
      if (this.application === application) {
        this.application = null;
        this.worldValue = null;
        this.options.environment.publishGame(null);
        this.options.environment.clearRuntimeBridge();
        this.options.onStateChanged?.();
        try {
          await this.options.environment.destroyApplication(application);
        } catch (caught) {
          cleanupError = caught;
        }
      }
      if (cleanupError) {
        throw new AggregateError([error, cleanupError], 'Game startup and rollback failed.');
      }
      throw error;
    }
  }

  private async ensureEditorSwitcher(signal: AbortSignal): Promise<LocalEditorEntryModeSwitcher> {
    this.assertActive();
    if (this.editorSwitcher) return this.editorSwitcher;
    if (!this.editorSwitcherLoad) {
      const pending = this.options.environment.mountEditorSwitcher({
        disposeGameWorld: () => this.disposeGameWorldForEditor(),
        onBeforeEnterEditor: () => this.runtimeDebug?.detachForEditor(),
        onBeforeReload: () => this.runtimeDebug?.detachForEditor(),
        restartGame: context => this.restart(context),
      }, signal).then(async switcher => {
        if (this.disposed) {
          await switcher.dispose();
          throw createAbortError();
        }
        this.editorSwitcher = switcher;
        return switcher;
      });
      this.editorSwitcherLoad = pending;
      void pending.finally(() => {
        if (this.editorSwitcherLoad === pending) this.editorSwitcherLoad = null;
      }).catch(() => undefined);
    }
    return this.editorSwitcherLoad;
  }

  private async disposeGameWorldForEditor(): Promise<void> {
    this.runtimeDebug?.detachForEditor();
    await this.disposeApplication();
  }

  private async remountRuntimeDebug(): Promise<void> {
    await this.disposeRuntimeDebug();
    this.assertActive();
    if (!this.worldValue) return;
    this.runtimeDebug = await this.options.environment.mountRuntimeDebug({
      getGame: () => this.worldValue,
      disposeGameWorld: () => this.disposeGameWorldForEditor(),
    });
  }

  private async disposeEditorSwitcher(expected?: LocalEditorEntryModeSwitcher): Promise<void> {
    const pending = this.editorSwitcherLoad;
    const loaded = this.editorSwitcher ?? await pending?.catch(() => null) ?? null;
    if (expected && loaded && loaded !== expected) return;
    if (!expected || this.editorSwitcher === expected) this.editorSwitcher = null;
    await loaded?.dispose();
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
    this.application = null;
    this.worldValue = null;
    this.options.environment.publishGame(null);
    this.options.environment.clearRuntimeBridge();
    this.options.onStateChanged?.();
    if (application) await this.options.environment.destroyApplication(application);
  }

  private assertActive(): void {
    if (this.disposed) throw createAbortError();
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw createAbortError();
}

function createAbortError(): Error {
  const error = new Error('Local World entry backend was disposed.');
  error.name = 'AbortError';
  return error;
}

function throwCollectedErrors(errors: unknown[], message: string): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, message);
}
