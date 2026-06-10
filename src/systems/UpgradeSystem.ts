import type { GameplayModule } from '../gameplay';
import type { DebugActionRegistry } from '../services';
import type { ProjectUpgradeConfig } from '../config/projectGameplayConfig';
import type { AreaSystem } from './AreaSystem';
import type { EconomySystem } from './EconomySystem';
import type { GameplayStateSystem } from './GameplayStateSystem';

export interface UpgradeState {
  id: string;
  costCash: number;
  paidCash: number;
  visible: boolean;
  completed: boolean;
}

export class UpgradeSystem implements GameplayModule {
  private readonly states = new Map<string, UpgradeState>();
  private readonly paymentCarryByUpgradeId = new Map<string, number>();
  private unregisterComplete: (() => void) | null = null;

  constructor(
    private readonly upgrades: ProjectUpgradeConfig[],
    private readonly areaSystem: AreaSystem,
    private readonly economy: EconomySystem,
    private readonly gameplayState: GameplayStateSystem,
    private readonly debugActions: DebugActionRegistry,
    private readonly payRateCashPerSecond: number,
  ) {}

  init(): void {
    for (const upgrade of this.upgrades) {
      this.states.set(upgrade.id, {
        id: upgrade.id,
        costCash: upgrade.costCash,
        paidCash: 0,
        visible: this.isVisible(upgrade),
        completed: false,
      });
    }
    this.unregisterComplete = this.debugActions.register({
      id: 'upgrade.complete',
      label: 'Complete upgrade',
      run: ({ payload }) => {
        const id = readString(payload, 'id') ?? this.upgrades[0]?.id;
        if (!id) return { ok: false, message: 'No upgrade id available.' };
        this.complete(id);
        return { ok: true, upgrades: this.getUpgradeStates() };
      },
    });
  }

  update(deltaTime: number): void {
    for (const upgrade of this.upgrades) {
      const state = this.states.get(upgrade.id);
      if (!state || state.completed) continue;
      state.visible = this.isVisible(upgrade);
      if (!state.visible || !upgrade.areaId || !this.areaSystem.isAreaActive(upgrade.areaId)) continue;
      const remaining = Math.max(0, state.costCash - state.paidCash);
      const availableCash = this.economy.getCash();
      if (availableCash <= 0) {
        this.paymentCarryByUpgradeId.set(upgrade.id, 0);
        continue;
      }
      const carry = (this.paymentCarryByUpgradeId.get(upgrade.id) ?? 0) + this.payRateCashPerSecond * deltaTime;
      const paymentBudget = Math.floor(carry);
      if (paymentBudget <= 0) {
        this.paymentCarryByUpgradeId.set(upgrade.id, carry);
        continue;
      }
      const payment = Math.min(remaining, paymentBudget, availableCash);
      if (payment <= 0 || !this.economy.spendCash(payment, `upgrade_${upgrade.id}`)) continue;
      this.paymentCarryByUpgradeId.set(upgrade.id, carry - payment);
      state.paidCash += payment;
      if (state.paidCash >= state.costCash) this.complete(upgrade.id);
    }
  }

  getUpgradeStates(): UpgradeState[] {
    return [...this.states.values()].map((state) => ({ ...state }));
  }

  complete(id: string): void {
    const state = this.states.get(id);
    if (!state || state.completed) return;
    state.paidCash = state.costCash;
    state.completed = true;
    this.paymentCarryByUpgradeId.delete(id);
    this.gameplayState.completeUpgrade(id);
    const config = this.upgrades.find((upgrade) => upgrade.id === id);
    for (const milestone of config?.unlocks ?? []) this.gameplayState.markMilestone(milestone);
  }

  dispose(): void {
    this.unregisterComplete?.();
  }

  private isVisible(upgrade: ProjectUpgradeConfig): boolean {
    return (upgrade.revealAfter ?? []).every((id) => this.gameplayState.isUpgradeComplete(id));
  }
}

function readString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}
