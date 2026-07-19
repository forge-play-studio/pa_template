/**
 * 配置模块入口
 *
 * 当前 scene json 的统一导出入口
 */

export * from './types';
export * from './projectGameplayConfig';
export * from './projectFlightTuning';
export { ConfigService, configService, resolveSceneAssetRuntimeUrl } from './ConfigService';
