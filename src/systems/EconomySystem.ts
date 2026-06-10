import type { GameplayModule } from '../gameplay';

export interface EconomyChangeEvent {
  cash: number;
  delta: number;
  reason?: string;
}

type Listener = (event: EconomyChangeEvent) => void;

export class EconomySystem implements GameplayModule {
  private cash = 0;
  private readonly listeners = new Set<Listener>();

  init(): void {}

  getCash(): number {
    return this.cash;
  }

  setCash(cash: number, reason?: string): void {
    const next = Math.max(0, Math.floor(cash));
    const delta = next - this.cash;
    if (delta === 0) return;
    this.cash = next;
    this.emit({ cash: this.cash, delta, reason });
  }

  addCash(amount: number, reason?: string): void {
    if (amount <= 0) return;
    this.setCash(this.cash + amount, reason);
  }

  canAfford(amount: number): boolean {
    return this.cash >= Math.max(0, amount);
  }

  spendCash(amount: number, reason?: string): boolean {
    const cost = Math.max(0, Math.floor(amount));
    if (!this.canAfford(cost)) return false;
    this.setCash(this.cash - cost, reason);
    return true;
  }

  onCashChanged(listener: Listener): () => void {
    this.listeners.add(listener);
    listener({ cash: this.cash, delta: 0, reason: 'initial' });
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  private emit(event: EconomyChangeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
