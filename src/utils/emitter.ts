type Handler<T> = (payload: T) => void;

export class Emitter<Events> {
  private handlers = new Map<keyof Events, Set<(p: unknown) => void>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as (p: unknown) => void);
    return () => set!.delete(handler as (p: unknown) => void);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }
}
