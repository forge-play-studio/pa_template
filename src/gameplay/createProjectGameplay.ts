import type { GameplayModule, GameplayRuntimeContext } from './types';
import { PROJECT_GAMEPLAY_CONFIG } from '../config/projectGameplayConfig';
import { RuntimeNodeService } from '../services';
import {
  AreaSystem,
  BackpackSystem,
  EconomySystem,
  EndConditionSystem,
  GameplayStateSystem,
  GuideSystem,
  InventorySystem,
  QueueSystem,
  ResourcesSystem,
  ThreeCSystem,
  UpgradeSystem,
} from '../systems';

export interface ProjectGameplayRuntime {
  modules: GameplayModule[];
  services: {
    runtimeNodes: RuntimeNodeService;
  };
  systems: {
    gameplayState: GameplayStateSystem;
    inventory: InventorySystem;
    economy: EconomySystem;
    resources: ResourcesSystem;
    backpack: BackpackSystem;
    area: AreaSystem;
    threeC: ThreeCSystem;
    queue: QueueSystem;
    upgrades: UpgradeSystem;
    guide: GuideSystem;
    endConditions: EndConditionSystem;
  };
}

export function createProjectGameplayRuntime(context: GameplayRuntimeContext): ProjectGameplayRuntime {
  const runtimeNodes = new RuntimeNodeService(context.sceneBuilder);
  const gameplayState = new GameplayStateSystem();
  const inventory = new InventorySystem([
    {
      id: PROJECT_GAMEPLAY_CONFIG.backpack.containerId,
      capacityByResource: PROJECT_GAMEPLAY_CONFIG.backpack.capacityByResource,
    },
  ]);
  const resources = new ResourcesSystem(
    PROJECT_GAMEPLAY_CONFIG.resources,
    runtimeNodes,
    PROJECT_GAMEPLAY_CONFIG.resourceVisualStacks,
  );
  const economy = new EconomySystem();
  const backpack = new BackpackSystem(
    PROJECT_GAMEPLAY_CONFIG.backpack,
    inventory,
  );
  const area = new AreaSystem(PROJECT_GAMEPLAY_CONFIG.areas, context.zoneSystem);
  const queue = new QueueSystem(PROJECT_GAMEPLAY_CONFIG.queues);
  const upgrades = new UpgradeSystem(PROJECT_GAMEPLAY_CONFIG.upgrades, gameplayState);
  const threeC = new ThreeCSystem({
    scene: context.scene,
    camera: context.camera,
    player: context.player,
    inputService: context.inputService,
    zoneSystem: context.zoneSystem,
    gameplayState,
  });
  const guide = new GuideSystem(PROJECT_GAMEPLAY_CONFIG.guideTargets, runtimeNodes);
  const endConditions = new EndConditionSystem(PROJECT_GAMEPLAY_CONFIG.endConditions, gameplayState);

  const modules: GameplayModule[] = [
    gameplayState,
    inventory,
    economy,
    resources,
    backpack,
    area,
    threeC,
    queue,
    upgrades,
    guide,
    endConditions,
  ];

  return {
    modules,
    services: {
      runtimeNodes,
    },
    systems: {
      gameplayState,
      inventory,
      economy,
      resources,
      backpack,
      area,
      threeC,
      queue,
      upgrades,
      guide,
      endConditions,
    },
  };
}

export function createProjectGameplayModules(context: GameplayRuntimeContext): GameplayModule[] {
  return createProjectGameplayRuntime(context).modules;
}
