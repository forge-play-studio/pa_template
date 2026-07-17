import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Scene } from '@babylonjs/core/scene';
import type { SimplePlayer } from '../entities';
import type {
  AssetLoader,
  AudioService,
  InputService,
  MaterialConfigService,
  ModelAnimationService,
  ModelPool,
  PlayableAnalyticsService,
  PlayableCtaService,
  RenderingService,
  SceneBuilder,
  ShadowService,
  VfxService,
} from '../services';
import type { ZoneSystem } from '../systems';

export interface GameplayModule {
  init?(): void | Promise<void>;
  pause?(): void;
  resume?(): void;
  update?(deltaTime: number): void;
  dispose?(): void;
}

export interface GameplayRuntimeContext {
  scene: Scene;
  camera: ArcRotateCamera | null;
  assetLoader: AssetLoader;
  modelAnimationService: ModelAnimationService;
  audioService: AudioService | null;
  inputService: InputService;
  materialConfigService: MaterialConfigService;
  modelPool: ModelPool;
  renderingService: RenderingService;
  sceneBuilder: SceneBuilder;
  vfxService: VfxService;
  shadowService: ShadowService;
  analytics: PlayableAnalyticsService;
  cta: PlayableCtaService;
  player: SimplePlayer;
  zoneSystem: ZoneSystem;
}
