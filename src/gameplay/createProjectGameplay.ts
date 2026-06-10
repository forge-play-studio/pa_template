import type { GameplayModule, GameplayRuntimeContext } from './types';
import { PROJECT_GAMEPLAY_CONFIG } from '../config/projectGameplayConfig';
import { DebugActionRegistry, RuntimeNodeService } from '../services';
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

export function createProjectGameplayModules(context: GameplayRuntimeContext): GameplayModule[] {
  const runtimeNodes = new RuntimeNodeService(context.sceneBuilder);
  const debugActions = new DebugActionRegistry();
  const gameplayState = new GameplayStateSystem();
  const inventory = new InventorySystem([
    {
      id: PROJECT_GAMEPLAY_CONFIG.backpack.containerId,
      capacityByResource: PROJECT_GAMEPLAY_CONFIG.backpack.capacityByResource,
    },
  ]);
  const resources = new ResourcesSystem(PROJECT_GAMEPLAY_CONFIG.resources, runtimeNodes);
  const economy = new EconomySystem();
  const backpack = new BackpackSystem(
    PROJECT_GAMEPLAY_CONFIG.backpack,
    inventory,
    resources,
    debugActions,
    PROJECT_GAMEPLAY_CONFIG.tuning.debugBackpackFillAmount,
  );
  const area = new AreaSystem(PROJECT_GAMEPLAY_CONFIG.areas, context.zoneSystem, debugActions);
  const queue = new QueueSystem(
    PROJECT_GAMEPLAY_CONFIG.queues,
    economy,
    gameplayState,
    debugActions,
    PROJECT_GAMEPLAY_CONFIG.tuning.debugQueueSaleRewardCash,
  );
  const upgrades = new UpgradeSystem(
    PROJECT_GAMEPLAY_CONFIG.upgrades,
    area,
    economy,
    gameplayState,
    debugActions,
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

  return [
    debugActions,
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
