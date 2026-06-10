/**
 * GameplayBindingService - gameplay contract 查询层 (Scaffold)
 *
 * 只负责把 authored `gameplay.gameplayBindings` 变成稳定查询入口。
 * 具体玩法系统通过该服务或 RuntimeNodeService 读取 binding，不把 gameplay 规则写在这里。
 */

import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import {
  configService,
  type GameplayBindingConfig,
  type GameplayObjectType,
} from '../config';
import type { SceneBuilder } from './SceneBuilder';

export interface GameplayBindingRuntimeRef {
  binding: GameplayBindingConfig;
  node: TransformNode | undefined;
}

class GameplayBindingService {
  getAll(): GameplayBindingConfig[] {
    return configService.getGameplayBindings();
  }

  getById(id: string): GameplayBindingConfig | undefined {
    return this.getAll().find((binding) => binding.id === id);
  }

  requireById(id: string): GameplayBindingConfig {
    const binding = this.getById(id);
    if (!binding) {
      throw new Error(`[GameplayBindingService] Missing gameplay binding "${id}"`);
    }
    return binding;
  }

  getByLogicType(logicType: GameplayObjectType): GameplayBindingConfig[] {
    return this.getAll().filter((binding) => binding.logicType === logicType);
  }

  getByEntityId(entityId: string): GameplayBindingConfig[] {
    return this.getAll().filter((binding) => binding.entityId === entityId);
  }

  getByTag(tag: string): GameplayBindingConfig[] {
    return this.getAll().filter((binding) => binding.tags?.includes(tag));
  }

  getRuntimeNode(bindingOrId: GameplayBindingConfig | string, sceneBuilder: SceneBuilder): TransformNode | undefined {
    const binding = typeof bindingOrId === 'string' ? this.getById(bindingOrId) : bindingOrId;
    if (!binding?.entityId) return undefined;
    return sceneBuilder.getSceneNodeRuntime(binding.entityId);
  }

  getRuntimeRefs(logicType: GameplayObjectType, sceneBuilder: SceneBuilder): GameplayBindingRuntimeRef[] {
    return this.getByLogicType(logicType).map((binding) => ({
      binding,
      node: this.getRuntimeNode(binding, sceneBuilder),
    }));
  }

  getRuntimeSpawnRoots(): GameplayBindingConfig[];
  getRuntimeSpawnRoots(sceneBuilder: SceneBuilder): GameplayBindingRuntimeRef[];
  getRuntimeSpawnRoots(sceneBuilder?: SceneBuilder): GameplayBindingConfig[] | GameplayBindingRuntimeRef[] {
    const roots = this.getByLogicType('RuntimeSpawnRoot');
    if (!sceneBuilder) return roots;
    return roots.map((binding) => ({
      binding,
      node: this.getRuntimeNode(binding, sceneBuilder),
    }));
  }

  getSpawnRootBinding(bindingOrId: GameplayBindingConfig | string): GameplayBindingConfig | undefined {
    const binding = typeof bindingOrId === 'string' ? this.getById(bindingOrId) : bindingOrId;
    if (!binding?.spawnRootId) return undefined;
    return this.getById(binding.spawnRootId) ?? this.getByEntityId(binding.spawnRootId)[0];
  }
}

export const gameplayBindingService = new GameplayBindingService();
