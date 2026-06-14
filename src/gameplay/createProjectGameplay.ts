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
import { GameHud, GuideArrowView, VirtualJoystick } from '../ui';

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
  ui: {
    joystick: VirtualJoystick;
    hud: GameHud;
    guideArrow: GuideArrowView;
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
    {
      id: PROJECT_GAMEPLAY_CONFIG.paymentSettlement.moneyStackContainerId,
      capacityByResource: {
        [PROJECT_GAMEPLAY_CONFIG.paymentSettlement.moneyResourceId]: null,
      },
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
    resources,
  );
  const area = new AreaSystem(PROJECT_GAMEPLAY_CONFIG.areas, context.zoneSystem);
  const queue = new QueueSystem(
    PROJECT_GAMEPLAY_CONFIG.queues,
    PROJECT_GAMEPLAY_CONFIG.paymentSettlement,
    inventory,
    economy,
    gameplayState,
  );
  const upgrades = new UpgradeSystem(
    PROJECT_GAMEPLAY_CONFIG.upgrades,
    area,
    economy,
    gameplayState,
    PROJECT_GAMEPLAY_CONFIG.tuning.upgradePayRateCashPerSecond,
  );
  const joystick = new VirtualJoystick();
  const threeC = new ThreeCSystem({
    scene: context.scene,
    camera: context.camera,
    player: context.player,
    inputService: context.inputService,
    movementSource: joystick,
    zoneSystem: context.zoneSystem,
    gameplayState,
  });
  const guide = new GuideSystem({
    targets: PROJECT_GAMEPLAY_CONFIG.guideTargets,
    runtimeNodes,
    threeC,
    upgrades,
    gameplayState,
  });
  const hud = new GameHud();
  const guideArrow = new GuideArrowView(guide);
  const endConditions = new EndConditionSystem(PROJECT_GAMEPLAY_CONFIG.endConditions, gameplayState);
  const hudBindings = createHudBindingModule(hud, economy, backpack);

  const modules: GameplayModule[] = [
    joystick,
    hud,
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
    guideArrow,
    endConditions,
    hudBindings,
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
    ui: {
      joystick,
      hud,
      guideArrow,
    },
  };
}

export function createProjectGameplayModules(context: GameplayRuntimeContext): GameplayModule[] {
  return createProjectGameplayRuntime(context).modules;
}

function createHudBindingModule(
  hud: GameHud,
  economy: EconomySystem,
  backpack: BackpackSystem,
): GameplayModule {
  let disposeCash: (() => void) | null = null;
  let disposeBackpack: (() => void) | null = null;
  return {
    init: () => {
      disposeCash = economy.onCashChanged((event) => hud.updateCash(event.cash));
      disposeBackpack = backpack.onChange((snapshot) => hud.updateBackpack(snapshot));
    },
    dispose: () => {
      disposeCash?.();
      disposeBackpack?.();
    },
  };
}
