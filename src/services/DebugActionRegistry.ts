import type { GameplayModule } from '../gameplay';

export interface DebugActionContext {
  id: string;
  payload?: unknown;
}

export interface DebugAction {
  id: string;
  label?: string;
  run(context: DebugActionContext): unknown;
}

type DebugActionWindow = Window & {
  __paDebugActions?: Record<string, (payload?: unknown) => unknown>;
};

export class DebugActionRegistry implements GameplayModule {
  private readonly actions = new Map<string, DebugAction>();

  init(): void {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return;
    const win = window as DebugActionWindow;
    win.__paDebugActions ??= {};
    for (const action of this.actions.values()) this.installWindowAction(action);
  }

  register(action: DebugAction): () => void {
    this.actions.set(action.id, action);
    this.installWindowAction(action);
    return () => this.unregister(action.id);
  }

  unregister(id: string): void {
    this.actions.delete(id);
    if (typeof window === 'undefined' || !import.meta.env.DEV) return;
    delete (window as DebugActionWindow).__paDebugActions?.[id];
  }

  run(id: string, payload?: unknown): unknown {
    const action = this.actions.get(id);
    if (!action) return { ok: false, message: `Unknown debug action "${id}".` };
    return action.run({ id, payload });
  }

  dispose(): void {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      const win = window as DebugActionWindow;
      for (const id of this.actions.keys()) delete win.__paDebugActions?.[id];
    }
    this.actions.clear();
  }

  private installWindowAction(action: DebugAction): void {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return;
    const win = window as DebugActionWindow;
    win.__paDebugActions ??= {};
    win.__paDebugActions[action.id] = (payload?: unknown) => action.run({ id: action.id, payload });
  }
}
