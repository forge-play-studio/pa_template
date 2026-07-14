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
  SceneBuilder,
  SceneVfxService,
} from '../services';
import type { FpsShadowRendererService } from '@fps-games/editor/playable-runtime/babylon';
import type { ZoneSystem } from '../systems';

export interface GameplayModule {
  init?(): void | Promise<void>;
  update?(deltaTime: number): void;
  dispose?(): void;
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
  sceneBuilder: SceneBuilder;
  sceneVfxService: SceneVfxService;
  rendererShadows: FpsShadowRendererService;
  analytics: PlayableAnalyticsService;
  cta: PlayableCtaService;
  player: SimplePlayer;
  zoneSystem: ZoneSystem;
}
