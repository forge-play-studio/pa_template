export type ResourceDisposer = () => void | Promise<void>;

/**
 * Owns resources created during one GameWorld lifetime.
 * Disposers run in reverse registration order and cleanup continues after errors.
 */
export class ResourceScope {
  private disposers: ResourceDisposer[] = [];
  private disposal: Promise<void> | null = null;
  private disposed = false;

  defer(disposer: ResourceDisposer): void {
    if (this.disposed || this.disposal) {
      throw new Error('Cannot register a resource after ResourceScope disposal has started.');
    }
    this.disposers.push(disposer);
  }

  dispose(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.disposal) return this.disposal;

    const pending = this.disposeNow();
    this.disposal = pending;
    return pending;
  }

  private async disposeNow(): Promise<void> {
    const errors: unknown[] = [];
    for (let index = this.disposers.length - 1; index >= 0; index -= 1) {
      try {
        await this.disposers[index]();
      } catch (error) {
        errors.push(error);
      }
    }
    this.disposers = [];
    this.disposed = true;
    this.disposal = null;

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'ResourceScope disposal failed.');
  }
}
