import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { GameplayModule } from '../gameplay';
import type { ProjectGuideTargetConfig } from '../config/projectGameplayConfig';
import type { RuntimeNodeService } from '../services';

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
  private activeTargetId: string | null = null;

  constructor(
    private readonly targets: ProjectGuideTargetConfig[],
    private readonly runtimeNodes: RuntimeNodeService,
  ) {}

  init(): void {}

  setActiveTarget(targetId: string | null, sourcePosition: Vector3 | null = null): GuideSnapshot {
    this.activeTargetId = targetId;
    const target = targetId ? this.targets.find((candidate) => candidate.id === targetId) ?? null : null;
    if (!target?.bindingId) {
      this.snapshot = { targetId, sourcePosition, targetPosition: null, visible: false };
      return this.getSnapshot();
    }
    const node = this.runtimeNodes.getRuntimeNode(target.bindingId);
    if (!node) {
      this.snapshot = { targetId, sourcePosition, targetPosition: null, visible: false };
      return this.getSnapshot();
    }
    this.snapshot = {
      targetId: target.id,
      sourcePosition,
      targetPosition: node.getAbsolutePosition().clone(),
      visible: true,
    };
    return this.getSnapshot();
  }

  clearTarget(): GuideSnapshot {
    return this.setActiveTarget(null);
  }

  getGuideTargets(): ProjectGuideTargetConfig[] {
    return this.targets.map((target) => ({ ...target }));
  }

  update(): void {
    if (this.activeTargetId) this.setActiveTarget(this.activeTargetId, this.snapshot.sourcePosition);
  }

  getSnapshot(): GuideSnapshot {
    return {
      targetId: this.snapshot.targetId,
      sourcePosition: this.snapshot.sourcePosition?.clone() ?? null,
      targetPosition: this.snapshot.targetPosition?.clone() ?? null,
      visible: this.snapshot.visible,
    };
  }

}
