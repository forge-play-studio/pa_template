/**
 * 配置模块入口
 *
 * 当前 scene json 的统一导出入口
 */

export * from './types';
export { ConfigService, configService } from './ConfigService';
export {
  assertSceneJsonV2,
  validateSceneJsonV2,
} from './SceneJsonV2Validator';
export type {
  SceneJsonV2ValidationError,
  SceneJsonV2ValidationOptions,
} from './SceneJsonV2Validator';
