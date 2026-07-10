/**
 * Vite 插件集合 — 游戏/3D 资源的开发体验与构建优化。
 *
 * | 插件                | 模式  | 说明                                           |
 * |---------------------|-------|------------------------------------------------|
 * | bridgePlugin        | dev   | 自动注入 MCP Server 的 bridge.js               |
 * | inspectorPlugin     | dev   | 暴露 @babylonjs/inspector 到 globalThis        |
 * | modelCachePlugin    | dev   | 模型/贴图资源版本化强缓存                       |
 * | glbGzipPlugin       | build | GLB 文件 gzip 压缩内联                         |
 * | stripBabylonPlugin  | build | 剥离 Babylon.js 未使用的 WGSL / 子模块          |
 * | optimizePngPlugin   | build | 内联 PNG 无损优化 (optipng / cwebp)            |
 * | gzipBundlePlugin    | build | single-file HTML 内联 JS gzip 自解压           |
 * | analyticsPlugin     | build | 有埋点版本注入渠道 analytics SDK               |
 * | molocoCtaPlugin     | build | Moloco 渠道 CTA 兼容 shim                      |
 *
 * 注意: inspector-init.ts 是 inspectorPlugin 注入的运行时脚本，
 *       不是插件本身，不在此处导出。
 */

export { bridgePlugin } from './bridge';
export type { BridgePluginOptions } from './bridge';

export { inspectorPlugin } from './inspector';

export { modelCachePlugin } from './modelCache';

export { glbGzipPlugin, COMPRESSED_GLB_MIME } from './glbGzip';

export { stripBabylonPlugin } from './stripBabylon';

export { optimizePngPlugin } from './optimizePng';

export { gzipBundlePlugin } from './gzipBundle';
export type { GzipBundlePluginOptions } from './gzipBundle';

export { thirdPartyWhitelistPlugin } from './thirdPartyWhitelist';
export type { ThirdPartyWhitelistPluginOptions } from './thirdPartyWhitelist';

export { localePlugin } from './locale';
export type { LocalePluginOptions } from './locale';

export { analyticsPlugin } from './analytics';
export type { AdNetwork, AnalyticsPluginOptions } from './analytics';

export { molocoCtaPlugin } from './molocoCta';

export { tapeServerPlugin } from './tapeServer';
export type { TapeServerPluginOptions } from './tapeServer';
