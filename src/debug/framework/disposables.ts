export interface Disposable {
  dispose(): void;
}

export type DisposeFn = () => void;

export class DisposableStack implements Disposable {
  private readonly disposables: Disposable[] = [];

  use<T extends Disposable | null | undefined>(disposable: T): T {
    if (disposable) this.disposables.push(disposable);
    return disposable;
  }

  defer(dispose: DisposeFn): void {
    this.disposables.push({ dispose });
  }

  dispose(): void {
    const errors: unknown[] = [];
    for (let index = this.disposables.length - 1; index >= 0; index -= 1) {
      try {
        this.disposables[index]?.dispose();
        this.disposables.splice(index, 1);
      } catch (error) {
        console.warn('[debug] dispose failed', error);
        errors.push(error);
      }
    }
    if (errors.length > 0) throw new AggregateError(errors, 'debug.disposableStackDisposeFailed');
  }
}
