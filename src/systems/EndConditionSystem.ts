import type { GameplayModule } from '../gameplay';
import type { ProjectEndConditionConfig } from '../config/projectGameplayConfig';
import type { GameplayStateSystem } from './GameplayStateSystem';

export class EndConditionSystem implements GameplayModule {
  constructor(
    private readonly conditions: ProjectEndConditionConfig[],
    private readonly gameplayState: GameplayStateSystem,
  ) {}

  init(): void {}

  update(): void {
    if (this.gameplayState.isComplete()) return;
    for (const condition of this.conditions) {
      if (condition.completedUpgradeId && this.gameplayState.isUpgradeComplete(condition.completedUpgradeId)) {
        this.gameplayState.markMilestone(condition.id);
        this.gameplayState.setComplete(true);
        return;
      }
      if (condition.completedMilestoneId && this.gameplayState.hasMilestone(condition.completedMilestoneId)) {
        this.gameplayState.markMilestone(condition.id);
        this.gameplayState.setComplete(true);
        return;
      }
    }
  }
}
