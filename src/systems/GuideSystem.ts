import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { GameplayModule } from '../gameplay';
import type { ProjectGuideTargetConfig } from '../config/projectGameplayConfig';
import type { RuntimeNodeService } from '../services';
import type { GameplayStateSystem } from './GameplayStateSystem';
import type { ThreeCSystem } from './ThreeCSystem';
import type { UpgradeSystem } from './UpgradeSystem';

export interface GuideSnapshot {
  targetId: string | null;
  sourcePosition: Vector3 | null;
  targetPosition: Vector3 | null;
  visible: boolean;
}

export class GuideSystem implements GameplayModule {
  private snapshot: GuideSnapshot = {
    targetId: null,
    sourcePosition: null,
    targetPosition: null,
    visible: false,
  };

  constructor(private readonly options: {
    targets: ProjectGuideTargetConfig[];
    runtimeNodes: RuntimeNodeService;
    threeC: ThreeCSystem;
    upgrades: UpgradeSystem;
    gameplayState: GameplayStateSystem;
  }) {}

  init(): void {}

  update(): void {
    if (this.options.gameplayState.isComplete()) {
      this.snapshot = { targetId: null, sourcePosition: null, targetPosition: null, visible: false };
      return;
    }

    const source = this.options.threeC.getSnapshot().position;
    const sourcePosition = new Vector3(source.x, source.y, source.z);
    const target = this.resolveTarget();
    if (!target?.bindingId) {
      this.snapshot = { targetId: null, sourcePosition, targetPosition: null, visible: false };
      return;
    }
    const node = this.options.runtimeNodes.getRuntimeNode(target.bindingId);
    if (!node) {
      this.snapshot = { targetId: null, sourcePosition, targetPosition: null, visible: false };
      return;
    }
    this.snapshot = {
      targetId: target.id,
      sourcePosition,
      targetPosition: node.getAbsolutePosition().clone(),
      visible: true,
    };
  }

  getSnapshot(): GuideSnapshot {
    return {
      targetId: this.snapshot.targetId,
      sourcePosition: this.snapshot.sourcePosition?.clone() ?? null,
      targetPosition: this.snapshot.targetPosition?.clone() ?? null,
      visible: this.snapshot.visible,
    };
  }

  private resolveTarget(): ProjectGuideTargetConfig | null {
    const upgrades = this.options.upgrades.getUpgradeStates();
    const configured = [...this.options.targets].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    for (const target of configured) {
      if (target.requiresMilestone && !this.options.gameplayState.hasMilestone(target.requiresMilestone)) continue;
      if (target.requiresUpgradeIncomplete && upgrades.find((upgrade) => upgrade.id === target.requiresUpgradeIncomplete)?.completed) continue;
      return target;
    }
    return null;
  }
}
