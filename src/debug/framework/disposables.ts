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
    for (let index = this.disposables.length - 1; index >= 0; index -= 1) {
      try {
        this.disposables[index]?.dispose();
      } catch (error) {
        console.warn('[debug] dispose failed', error);
      }
    }
    this.disposables.length = 0;
  }
}
