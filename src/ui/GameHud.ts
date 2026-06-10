import type { GameplayModule } from '../gameplay';
import type { BackpackSnapshot } from '../systems/BackpackSystem';

export class GameHud implements GameplayModule {
  private root: HTMLDivElement | null = null;
  private cashValue: HTMLDivElement | null = null;
  private backpackValue: HTMLDivElement | null = null;

  init(): void {
    if (typeof document === 'undefined') return;
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed',
      'left:16px',
      'top:16px',
      'z-index:20',
      'display:flex',
      'flex-direction:column',
      'gap:6px',
      'font:700 14px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'color:#fff',
      'text-shadow:0 2px 8px rgba(0,0,0,.45)',
      'pointer-events:none',
    ].join(';');
    this.cashValue = document.createElement('div');
    this.backpackValue = document.createElement('div');
    root.append(this.cashValue, this.backpackValue);
    document.body.appendChild(root);
    this.root = root;
    this.updateCash(0);
    this.updateBackpack({ containerId: 'player_backpack', resources: {} });
  }

  updateCash(cash: number): void {
    if (this.cashValue) this.cashValue.textContent = `$ ${Math.floor(cash)}`;
  }

  updateBackpack(snapshot: BackpackSnapshot): void {
    if (!this.backpackValue) return;
    const entries = Object.entries(snapshot.resources).filter(([, amount]) => amount > 0);
    this.backpackValue.textContent = entries.length
      ? entries.map(([id, amount]) => `${id}: ${amount}`).join('  ')
      : 'Backpack: empty';
  }

  dispose(): void {
    this.root?.remove();
    this.root = null;
    this.cashValue = null;
    this.backpackValue = null;
  }
}
