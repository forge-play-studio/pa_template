import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GameplayBindingConfig, GameplayObjectType } from '../config';
import type { SceneBuilder } from './SceneBuilder';
import { gameplayBindingService } from './GameplayBindingService';

export type RuntimeBindingIssueType = 'missing-binding' | 'missing-entity-id' | 'missing-runtime-node';

export interface RuntimeBindingIssue {
  bindingId: string;
  type: RuntimeBindingIssueType;
  message: string;
}

export interface RuntimeBindingReadinessReport {
  ready: boolean;
  checkedBindingIds: string[];
  issues: RuntimeBindingIssue[];
}

export class RuntimeNodeService {
  constructor(private readonly sceneBuilder: SceneBuilder) {}

  getBinding(bindingId: string): GameplayBindingConfig | undefined {
    return gameplayBindingService.getById(bindingId);
  }

  getBindingsByLogicType(logicType: GameplayObjectType): GameplayBindingConfig[] {
    return gameplayBindingService.getByLogicType(logicType);
  }

  getRuntimeNode(bindingOrNodeId: string): TransformNode | undefined {
    const binding = gameplayBindingService.getById(bindingOrNodeId);
    if (binding?.entityId) return this.sceneBuilder.getSceneNodeRuntime(binding.entityId);
    return this.sceneBuilder.getSceneNodeRuntime(bindingOrNodeId);
  }

  getRuntimeNodeByEntityId(entityId: string): TransformNode | undefined {
    return this.sceneBuilder.getSceneNodeRuntime(entityId);
  }

  getRuntimeNodesByLogicType(logicType: GameplayObjectType): TransformNode[] {
    return this.getBindingsByLogicType(logicType)
      .map((binding) => binding.entityId ? this.sceneBuilder.getSceneNodeRuntime(binding.entityId) : undefined)
      .filter((node): node is TransformNode => !!node);
  }

  checkRequiredBindings(bindingIds: readonly string[]): RuntimeBindingReadinessReport {
    const issues: RuntimeBindingIssue[] = [];
    for (const bindingId of bindingIds) {
      const binding = gameplayBindingService.getById(bindingId);
      if (!binding) {
        issues.push({
          bindingId,
          type: 'missing-binding',
          message: `Missing gameplay binding "${bindingId}".`,
        });
        continue;
      }
      if (!binding.entityId) {
        issues.push({
          bindingId,
          type: 'missing-entity-id',
          message: `Gameplay binding "${bindingId}" has no entityId.`,
        });
        continue;
      }
      if (!this.sceneBuilder.getSceneNodeRuntime(binding.entityId)) {
        issues.push({
          bindingId,
          type: 'missing-runtime-node',
          message: `Gameplay binding "${bindingId}" points to missing runtime node "${binding.entityId}".`,
        });
      }
    }
    return {
      ready: issues.length === 0,
      checkedBindingIds: [...bindingIds],
      issues,
    };
  }
}
