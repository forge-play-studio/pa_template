/**
 * Services 模块导出 (Scaffold)
 */

export { AssetLoader } from './AssetLoader';
export type { LoadProgress } from './AssetLoader';

export { ModelPool } from './ModelPool';
export type { PooledInstance, ModelConfig, ModelWarmupAssetConfig, ModelWarmupResult } from './ModelPool';

export { AnimationService } from './AnimationService';
export type { PlayOptions } from './AnimationService';

export { AudioService } from './AudioService';
export type { SfxId } from './AudioService';

export { InputService } from './InputService';
export type { MovementInputSource, MovementInputState } from './InputService';

export { SceneBuilder } from './SceneBuilder';
export type { SceneEnvironment } from './SceneBuilder';

export { RenderingService } from './RenderingService';
export { ShadowService } from './ShadowService';
export { MaterialConfigService } from './MaterialConfigService';
export { SceneVfxService } from './SceneVfxService';
export { gameplayBindingService } from './GameplayBindingService';
export type { GameplayBindingRuntimeRef } from './GameplayBindingService';
export { RuntimeNodeService } from './RuntimeNodeService';
export type {
  RuntimeBindingIssue,
  RuntimeBindingIssueType,
  RuntimeBindingReadinessReport,
} from './RuntimeNodeService';
export { DebugActionRegistry } from './DebugActionRegistry';
export type { DebugAction, DebugActionContext } from './DebugActionRegistry';
export {
  ASSET_MANAGER_ERROR_CODES,
  planAssetRegistration,
  planAssetUnregistration,
  resolveAssetReference,
} from './AssetManager';
export type {
  AssetManagerErrorCode,
  AssetReference,
  AssetReferenceParams,
  AssetTransportPlan,
  AssetTransportWrite,
} from './AssetManager';
export {
  createAssetInstance,
  removeAssetInstance,
} from './SceneAssetPlacement';
export type {
  AssetInstanceCreateParams,
  AssetInstancePlacementResult,
} from './SceneAssetPlacement';
export {
  assertSceneAssetUnused,
  findSceneAssetUsageByAssetId,
} from './SceneAssetUsage';
export type { SceneAssetUsage } from './SceneAssetUsage';

// 配置服务（便于服务层直接引用）
export { configService, ConfigService } from '../config';

// 配置校验服务
export { configValidator } from './ConfigValidator';
