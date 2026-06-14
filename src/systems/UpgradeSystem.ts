import type { GameplayModule } from '../gameplay';
import type { ProjectUpgradeConfig } from '../config/projectGameplayConfig';
import type { GameplayStateSystem } from './GameplayStateSystem';

export interface UpgradeState {
  id: string;
  completed: boolean;
}

export class UpgradeSystem implements GameplayModule {
  private readonly states = new Map<string, UpgradeState>();

  constructor(
    private readonly upgrades: ProjectUpgradeConfig[],
    private readonly gameplayState: GameplayStateSystem,
  ) {}

  init(): void {
    for (const upgrade of this.upgrades) {
      this.states.set(upgrade.id, {
        id: upgrade.id,
        completed: false,
      });
    }
  }

  getUpgradeStates(): UpgradeState[] {
    return [...this.states.values()].map((state) => ({ ...state }));
  }

  getDefaultUpgradeId(): string | null {
    return this.upgrades[0]?.id ?? null;
  }

  complete(id: string): void {
    const state = this.states.get(id);
    if (!state || state.completed) return;
    state.completed = true;
    this.gameplayState.completeUpgrade(id);
    const config = this.upgrades.find((upgrade) => upgrade.id === id);
    for (const milestone of config?.unlocks ?? []) this.gameplayState.markMilestone(milestone);
  }

  getUpgradeConfigs(): ProjectUpgradeConfig[] {
    return this.upgrades.map((upgrade) => ({
      ...upgrade,
      revealAfter: [...(upgrade.revealAfter ?? [])],
      unlocks: [...(upgrade.unlocks ?? [])],
    }));
  }

  dispose(): void {
  }
}
