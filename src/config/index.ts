/**
 * 配置模块入口
 *
 * 当前 scene json 的统一导出入口
 */

export * from './types';
export * from './projectGameplayConfig';
export * from './projectFlightTuning';
export { ConfigService, configService, resolveSceneAssetRuntimeUrl } from './ConfigService';
export {
  assertSceneJson,
  assertSceneJsonV2,
  validateSceneJson,
  validateSceneJsonV2,
} from './SceneJsonV2Validator';
export type {
  SceneJsonValidationError,
  SceneJsonValidationOptions,
  SceneJsonV2ValidationError,
  SceneJsonV2ValidationOptions,
} from './SceneJsonV2Validator';
