import gameplayConfigJson from './gameplay.json';

export interface ProjectResourceConfig {
  id: string;
  displayName?: string;
  tags?: string[];
}

export interface ProjectVector3Config {
  x: number;
  y: number;
  z: number;
}

export interface ProjectResourceVisualStackLayoutConfig {
  mode?: 'grid' | 'line' | 'vertical' | 'custom';
  columns?: number;
  rows?: number;
  spacing?: ProjectVector3Config;
  origin?: ProjectVector3Config;
  rotation?: ProjectVector3Config;
  scale?: ProjectVector3Config;
  layerHeight?: number;
  align?: 'center' | 'start';
}

export interface ProjectResourceVisualStackConfig {
  id: string;
  containerId: string;
  resourceId: string;
  assetId: string;
  areaId?: string;
  bindingId?: string;
  rootNodeId?: string;
  runtimeParentId?: string;
  maxVisible?: number;
  layout?: ProjectResourceVisualStackLayoutConfig;
  updateTiming?: 'onInventoryChange' | 'onFlightArrive' | 'manual';
  debugLabel?: string;
}

export interface ProjectFlightTuningValues {
  durationSec?: number;
  arcHeight?: number;
  staggerSec?: number;
  startDelaySec?: number;
  triggerRadius?: number;
  pickupIntervalSec?: number;
  submitIntervalSec?: number;
  payIntervalSec?: number;
  processIntervalSec?: number;
  scaleShrinkAmount?: number;
  spinSpeed?: number;
  visualScale?: number;
  [key: string]: number | undefined;
}

export type ProjectFlightTuningConfig = Record<string, ProjectFlightTuningValues>;

export interface ProjectThreeCConfig {
  player: {
    speed: number;
    radius: number;
  };
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
  debugLabel?: string;
}

export interface ProjectUpgradeConfig {
  id: string;
  areaId?: string;
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

export const PROJECT_AUDIO_SOUND_MODES = ['oneShot', 'activeLoop'] as const;
export type ProjectAudioSoundMode = typeof PROJECT_AUDIO_SOUND_MODES[number];

export interface ProjectBgmAudioConfig {
  assetId: string;
  volume: number;
}

export interface ProjectAudioSoundConfig {
  id: string;
  assetId: string;
  mode: ProjectAudioSoundMode;
  volume: number;
  cooldownMs: number;
  maxVoices: number;
  intervalMs: number;
}

export interface ProjectAudioConfig {
  enabled: boolean;
  masterVolume: number;
  bgm: ProjectBgmAudioConfig;
  sounds: ProjectAudioSoundConfig[];
}

export interface ProjectGameplaySkeletonConfig {
  resources: ProjectResourceConfig[];
  resourceVisualStacks: ProjectResourceVisualStackConfig[];
  flightTuning: ProjectFlightTuningConfig;
  threeC: ProjectThreeCConfig;
  backpack: ProjectBackpackConfig;
  areas: ProjectAreaConfig[];
  queues: ProjectQueueConfig[];
  upgrades: ProjectUpgradeConfig[];
  guideTargets: ProjectGuideTargetConfig[];
  endConditions: ProjectEndConditionConfig[];
  audio: ProjectAudioConfig;
}

export const PROJECT_GAMEPLAY_CONFIG_SOURCE_FILE = 'gameplay.json';
export const PROJECT_GAMEPLAY_CONFIG_SOURCE_PATH = `src/config/${PROJECT_GAMEPLAY_CONFIG_SOURCE_FILE}`;
const RAW_PROJECT_GAMEPLAY_CONFIG =
  gameplayConfigJson as Omit<ProjectGameplaySkeletonConfig, 'audio'> & { audio?: unknown };

export const PROJECT_AUDIO_CONFIG = normalizeProjectAudioConfig(RAW_PROJECT_GAMEPLAY_CONFIG.audio);
export const PROJECT_GAMEPLAY_CONFIG: ProjectGameplaySkeletonConfig =
  { ...RAW_PROJECT_GAMEPLAY_CONFIG, audio: PROJECT_AUDIO_CONFIG } as ProjectGameplaySkeletonConfig;

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
    systems: ['AreaSystem', 'ResourcesSystem'],
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

export function getProjectAudioConfig(): ProjectAudioConfig {
  return PROJECT_AUDIO_CONFIG;
}

export function getProjectAudioSoundConfig(soundId: string): ProjectAudioSoundConfig | undefined {
  return PROJECT_AUDIO_CONFIG.sounds.find((sound) => sound.id === soundId);
}

function normalizeProjectAudioConfig(value: unknown): ProjectAudioConfig {
  const source = readRecord(value);
  const bgm = readRecord(source.bgm);
  const sounds = Array.isArray(source.sounds)
    ? source.sounds.map(normalizeProjectAudioSoundConfig).filter((sound): sound is ProjectAudioSoundConfig => Boolean(sound))
    : [];
  return {
    enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
    masterVolume: readVolume(source.masterVolume, 1),
    bgm: {
      assetId: readString(bgm.assetId),
      volume: readVolume(bgm.volume, 0.45),
    },
    sounds,
  };
}

function normalizeProjectAudioSoundConfig(value: unknown): ProjectAudioSoundConfig | null {
  const source = readRecord(value);
  const id = readString(source.id);
  if (!id) return null;
  return {
    id,
    assetId: readString(source.assetId),
    mode: readProjectAudioSoundMode(source.mode, 'oneShot'),
    volume: readVolume(source.volume, 0.8),
    cooldownMs: readNonNegativeNumber(source.cooldownMs, 80),
    maxVoices: Math.max(1, Math.floor(readNonNegativeNumber(source.maxVoices, 4))),
    intervalMs: Math.max(16, Math.floor(readNonNegativeNumber(source.intervalMs, 900))),
  };
}

function readProjectAudioSoundMode(value: unknown, fallback: ProjectAudioSoundMode): ProjectAudioSoundMode {
  return typeof value === 'string' && (PROJECT_AUDIO_SOUND_MODES as readonly string[]).includes(value)
    ? value as ProjectAudioSoundMode
    : fallback;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readVolume(value: unknown, fallback: number): number {
  return clamp(readFiniteNumber(value, fallback), 0, 1);
}

function readNonNegativeNumber(value: unknown, fallback: number): number {
  return Math.max(0, readFiniteNumber(value, fallback));
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
