import type { GameplayModule } from '../gameplay';
import type { ProjectEndConditionConfig } from '../config/projectGameplayConfig';
import type { GameplayStateSystem } from './GameplayStateSystem';

export class EndConditionSystem implements GameplayModule {
  constructor(
    private readonly conditions: ProjectEndConditionConfig[],
    private readonly gameplayState: GameplayStateSystem,
  ) {}

  init(): void {}

  getConditionConfigs(): ProjectEndConditionConfig[] {
    return this.conditions.map((condition) => ({ ...condition }));
  }

  getSnapshot(): { conditionIds: string[]; complete: boolean } {
    return {
      conditionIds: this.conditions.map((condition) => condition.id),
      complete: this.gameplayState.isComplete(),
    };
  }
}
