import { mountRuntimeDebug, type RuntimeDebugBootstrap } from '../debug/runtime-debug-bootstrap';
import { GameApplication } from '../entry/GameApplication';
import type { GameWorld } from '../runtime/GameWorld';
import { configValidator } from '../services/ConfigValidator';
import { mountPaTemplateEditorEntry } from '../services/fps-game-editor/editor-entry';
import { readPaTemplateEditorHostEnvironment } from '../services/fps-game-editor/editor-host-environment';

export interface PaTemplateDevHost {
  dispose(): Promise<void>;
}

interface PaTemplateModeTransitionContext {
  reason?: string;
  [key: string]: unknown;
}

export function mountPaTemplateDevHost(): PaTemplateDevHost {
  const host = new PaTemplateDevHostImpl();
  host.start();
  return host;
}

class PaTemplateDevHostImpl implements PaTemplateDevHost {
  private application: GameApplication | null = null;
  private gameValue: GameWorld | null = null;
  private runtimeDebug: RuntimeDebugBootstrap | null = null;
  private editorEntry: ReturnType<typeof mountPaTemplateEditorEntry> | null = null;
  private playModeStart: Promise<void> | null = null;
  private disposal: Promise<void> | null = null;
  private disposed = false;

  start(): void {
    const hostEnvironment = readPaTemplateEditorHostEnvironment();
    this.editorEntry = mountPaTemplateEditorEntry({
      enterEditorMode: context => this.enterEditorMode(context),
      enterPlayMode: context => this.enterPlayMode(context),
    }, hostEnvironment);
    if (hostEnvironment.bootMode !== 'edit') {
      void this.startPlayMode().catch(error => console.error('[PaTemplateDevHost] startup failed', error));
    }
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    const pending = (async () => {
      await Promise.allSettled(this.playModeStart ? [this.playModeStart] : []);
      const errors: unknown[] = [];
      const editorEntry = this.editorEntry;
      this.editorEntry = null;
      try { await editorEntry?.dispose(); } catch (error) { errors.push(error); }
      try { await this.stopPlayMode(); } catch (error) { errors.push(error); }
      throwCollectedErrors(errors, 'pa_template development host cleanup failed.');
    })();
    this.disposal = pending;
    void pending.catch(() => { if (this.disposal === pending) this.disposal = null; });
    return pending;
  }

  private startPlayMode(): Promise<void> {
    if (this.disposed) return Promise.reject(createAbortError());
    if (this.gameValue) return Promise.resolve();
    if (this.playModeStart) return this.playModeStart;
    const pending = this.startPlayModeNow();
    this.playModeStart = pending;
    void pending.finally(() => {
      if (this.playModeStart === pending) this.playModeStart = null;
    }).catch(() => undefined);
    return pending;
  }

  private async startPlayModeNow(): Promise<void> {
    configValidator.validate();
    const application = new GameApplication();
    this.application = application;
    try {
      const game = await application.start();
      if (this.disposed || this.application !== application) throw createAbortError();
      this.gameValue = game;
      publishGame(game);
      this.runtimeDebug = mountRuntimeDebug({
        root: document.body,
        getGame: () => this.gameValue,
        getGameplayRuntime: () => this.gameValue?.getProjectGameplayRuntime() ?? null,
      });
    } catch (error) {
      const cleanupErrors: unknown[] = [];
      if (this.application === application) {
        this.application = null;
        this.gameValue = null;
        publishGame(null);
        clearRuntimeBridge();
        try { await application.destroy(); } catch (cleanupError) { cleanupErrors.push(cleanupError); }
      }
      if (cleanupErrors.length > 0) {
        throw new AggregateError([error, ...cleanupErrors], 'pa_template play-mode startup cleanup failed.');
      }
      throw error;
    }
  }

  private enterEditorMode(context?: PaTemplateModeTransitionContext): Promise<void> {
    void context;
    return this.stopPlayMode();
  }

  private async stopPlayMode(): Promise<void> {
    const pendingStart = this.playModeStart;
    if (pendingStart) await Promise.allSettled([pendingStart]);

    const errors: unknown[] = [];
    const runtimeDebug = this.runtimeDebug;
    this.runtimeDebug = null;
    try { await runtimeDebug?.dispose(); } catch (error) { errors.push(error); }

    const application = this.application;
    this.application = null;
    this.gameValue = null;
    publishGame(null);
    clearRuntimeBridge();
    try { await application?.destroy(); } catch (error) { errors.push(error); }
    throwCollectedErrors(errors, 'pa_template play-mode cleanup failed.');
  }

  private async enterPlayMode(context?: PaTemplateModeTransitionContext): Promise<void> {
    void context;
    if (this.application || this.runtimeDebug || this.gameValue) await this.stopPlayMode();
    await this.startPlayMode();
  }
}

function publishGame(game: GameWorld | null): void {
  window.gameInstance = game;
  window.game = game;
}

function clearRuntimeBridge(): void {
  window.__bridgeProjectRuntime = null;
  window.__pendingEditorRuntime = null;
}

function throwCollectedErrors(errors: readonly unknown[], message: string): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, message);
}

function createAbortError(): Error {
  return Object.assign(new Error('pa_template development host was disposed.'), { name: 'AbortError' });
}
