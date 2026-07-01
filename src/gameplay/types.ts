import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Scene } from '@babylonjs/core/scene';
import type { SimplePlayer } from '../entities';
import type {
  AnimationService,
  AssetLoader,
  AudioService,
  InputService,
  MaterialConfigService,
  ModelPool,
  PlayableAnalyticsService,
  PlayableCtaService,
  RenderingService,
  SceneBuilder,
  SceneVfxService,
  ShadowService,
} from '../services';
import type { ZoneSystem } from '../systems';

export interface GameplayModule {
  init?(): void | Promise<void>;
  update?(deltaTime: number): void;
  dispose?(): void;
}

export interface CameraFollowController {
  readonly isCameraFollowEnabled: boolean;
  setCameraFollowEnabled(enabled: boolean): void;
}

export interface GameplayRuntimeContext {
  scene: Scene;
  camera: ArcRotateCamera | null;
  assetLoader: AssetLoader;
  animationService: AnimationService;
  audioService: AudioService | null;
  inputService: InputService;
  materialConfigService: MaterialConfigService;
  modelPool: ModelPool;
  renderingService: RenderingService;
  sceneBuilder: SceneBuilder;
  sceneVfxService: SceneVfxService;
  shadowService: ShadowService;
  analytics: PlayableAnalyticsService;
  cta: PlayableCtaService;
  player: SimplePlayer;
  zoneSystem: ZoneSystem;
  registerCameraFollowController?: (controller: CameraFollowController) => void;
}
