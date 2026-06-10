export interface ProjectResourceConfig {
  id: string;
  displayName?: string;
  tags?: string[];
}

export interface ProjectBackpackConfig {
  containerId: string;
  capacityByResource?: Record<string, number | null>;
}

export interface ProjectAreaConfig {
  id: string;
  zoneId: string;
  category: 'resource' | 'backpack' | 'queue' | 'upgrade' | 'guide' | 'end' | 'custom';
  bindingId?: string;
  debugLabel?: string;
}

export interface ProjectQueueConfig {
  id: string;
  serviceAreaId?: string;
  rewardCash?: number;
}

export interface ProjectUpgradeConfig {
  id: string;
  areaId?: string;
  costCash: number;
  revealAfter?: string[];
  unlocks?: string[];
  debugLabel?: string;
}

export interface ProjectGuideTargetConfig {
  id: string;
  bindingId?: string;
  areaId?: string;
  priority?: number;
  requiresMilestone?: string;
  requiresUpgradeIncomplete?: string;
}

export interface ProjectEndConditionConfig {
  id: string;
  completedUpgradeId?: string;
  completedMilestoneId?: string;
}

export interface ProjectGameplaySkeletonConfig {
  resources: ProjectResourceConfig[];
  backpack: ProjectBackpackConfig;
  areas: ProjectAreaConfig[];
  queues: ProjectQueueConfig[];
  upgrades: ProjectUpgradeConfig[];
  guideTargets: ProjectGuideTargetConfig[];
  endConditions: ProjectEndConditionConfig[];
  tuning: {
    playerSpeed: number;
    upgradePayRateCashPerSecond: number;
    debugBackpackFillAmount: number;
    debugQueueSaleRewardCash: number;
  };
}

export const PROJECT_GAMEPLAY_CONFIG: ProjectGameplaySkeletonConfig = {
  resources: [
    { id: 'cash', displayName: 'Cash', tags: ['currency'] },
  ],
  backpack: {
    containerId: 'player_backpack',
    capacityByResource: {},
  },
  areas: [],
  queues: [
    { id: 'default_queue', rewardCash: 1 },
  ],
  upgrades: [],
  guideTargets: [],
  endConditions: [],
  tuning: {
    playerSpeed: 4.2,
    upgradePayRateCashPerSecond: 10,
    debugBackpackFillAmount: 10,
    debugQueueSaleRewardCash: 1,
  },
};

export const STANDARD_GAMEPLAY_PHASES = [
  {
    id: 'phase_1_3c_resources_hud',
    label: '3C + Resources + HUD',
    systems: ['ThreeCSystem', 'ResourcesSystem'],
  },
  {
    id: 'phase_2_backpack',
    label: 'Backpack',
    systems: ['BackpackSystem', 'ResourcesSystem'],
  },
  {
    id: 'phase_3_area',
    label: 'Area',
    systems: ['AreaSystem'],
  },
  {
    id: 'phase_4_queue_economy',
    label: 'Queue + Economy',
    systems: ['QueueSystem', 'EconomySystem'],
  },
  {
    id: 'phase_5_upgrade_guide_end',
    label: 'Upgrade + Guide + EndCondition',
    systems: ['UpgradeSystem', 'GuideSystem', 'EndConditionSystem'],
  },
] as const;
