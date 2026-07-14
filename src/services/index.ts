/**
 * Services 模块导出 (Scaffold)
 */

export { AssetLoader } from './AssetLoader';
export type { LoadProgress } from './AssetLoader';
export {
  importGlbMeshesFromUrlAsync,
  loadGlbContainerFromUrlAsync,
} from './glbUrlLoader';

export { ModelPool } from './ModelPool';
export type { PooledInstance, ModelConfig, ModelWarmupAssetConfig, ModelWarmupResult } from './ModelPool';

export { AnimationService } from './AnimationService';
export type { PlayOptions } from './AnimationService';

export { AudioService } from './AudioService';
export type { AudioDebugState, AudioPlayOptions, AudioSoundId } from './AudioService';

export { InputService } from './InputService';
export type { MovementInputSource, MovementInputState } from './InputService';

export { SceneBuilder } from './SceneBuilder';
export type { SceneEnvironment } from './SceneBuilder';

export { MaterialConfigService } from './MaterialConfigService';
export { SceneVfxService } from './SceneVfxService';
export { PlayableAnalyticsService, playableAnalyticsService } from './PlayableAnalyticsService';
export type { AnalyticsLike } from './PlayableAnalyticsService';
export { PlayableCtaService, playableCtaService } from './PlayableCtaService';
export type { CtaSource, PlayableCtaServiceOptions } from './PlayableCtaService';
export { gameplayBindingService } from './GameplayBindingService';
export type { GameplayBindingRuntimeRef } from './GameplayBindingService';
export { RuntimeNodeService } from './RuntimeNodeService';
export type {
  RuntimeBindingIssue,
  RuntimeBindingIssueType,
  RuntimeBindingReadinessReport,
} from './RuntimeNodeService';
// 配置服务（便于服务层直接引用）
export { configService, ConfigService } from '../config';

// 配置校验服务
export { configValidator } from './ConfigValidator';
