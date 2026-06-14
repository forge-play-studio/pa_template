import type { Disposable } from './disposables';

export interface RuntimeDebugActionContext {
  id: string;
  payload?: unknown;
}

export interface RuntimeDebugActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  snapshot?: unknown;
  [key: string]: unknown;
}

export interface RuntimeDebugAction {
  id: string;
  label?: string;
  phase?: number | 'presentation' | 'framework';
  owner?: string;
  description?: string;
  run(context: RuntimeDebugActionContext): unknown;
}

export interface RuntimeDebugActionInfo {
  id: string;
  label?: string;
  phase?: number | 'presentation' | 'framework';
  owner?: string;
  description?: string;
}

type RuntimeDebugActionWindow = Window & {
  __paDebugActions?: Record<string, (payload?: unknown) => unknown>;
  __paDebugActionRegistry?: {
    list: () => RuntimeDebugActionInfo[];
    run: (id: string, payload?: unknown) => unknown;
  };
};

export class RuntimeDebugActionRegistry implements Disposable {
  private readonly actions = new Map<string, RuntimeDebugAction>();
  private readonly win: RuntimeDebugActionWindow;

  constructor(ownerWindow: Window = window) {
    this.win = ownerWindow as RuntimeDebugActionWindow;
    this.installWindowBridge();
  }

  register(action: RuntimeDebugAction): () => void {
    this.actions.set(action.id, action);
    this.installWindowAction(action);
    return () => this.unregister(action.id);
  }

  unregister(id: string): void {
    this.actions.delete(id);
    delete this.win.__paDebugActions?.[id];
  }

  list(): RuntimeDebugActionInfo[] {
    return [...this.actions.values()].map((action) => ({
      id: action.id,
      label: action.label,
      phase: action.phase,
      owner: action.owner,
      description: action.description,
    }));
  }

  run(id: string, payload?: unknown): unknown {
    const action = this.actions.get(id);
    if (!action) return { ok: false, message: `Unknown debug action "${id}".` } satisfies RuntimeDebugActionResult;
    try {
      return action.run({ id, payload });
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies RuntimeDebugActionResult;
    }
  }

  dispose(): void {
    for (const id of this.actions.keys()) delete this.win.__paDebugActions?.[id];
    this.actions.clear();
    delete this.win.__paDebugActions;
    delete this.win.__paDebugActionRegistry;
  }

  private installWindowBridge(): void {
    this.win.__paDebugActions ??= {};
    this.win.__paDebugActionRegistry = {
      list: () => this.list(),
      run: (id, payload) => this.run(id, payload),
    };
    for (const action of this.actions.values()) this.installWindowAction(action);
  }

  private installWindowAction(action: RuntimeDebugAction): void {
    this.win.__paDebugActions ??= {};
    this.win.__paDebugActions[action.id] = (payload?: unknown) => this.run(action.id, payload);
  }
}
