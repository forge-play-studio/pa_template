/**
 * Vite Plugin: Playable Analytics Auto-Injection
 *
 * 在构建时自动注入渠道打点 SDK 及初始化代码，
 * 模拟平台自动集成的行为（方式二）。
 *
 * 支持渠道：applovin、unity、moloco、facebook、google、tiktok、snapchat
 *
 * 使用方式：在 vite.config.ts 中添加插件即可
 */

import type { Plugin } from 'vite';
import { readFileSync } from 'fs';

export type AdNetwork =
  | 'applovin'
  | 'unity'
  | 'moloco'
  | 'facebook'
  | 'google'
  | 'tiktok'
  | 'snapchat';

/**
 * 渠道 → SDK 文件映射。
 * Moloco/Facebook/Google/TikTok/Snapchat 通常由平台自行注入 SDK，
 * 这里复用 applovin 的 SDK 文件作为打点基础。
 */
const SDK_FILE_MAP: Record<AdNetwork, string> = {
  applovin: 'applovin.js',
  unity: 'unity.js',
  moloco: 'applovin.js',
  facebook: 'applovin.js',
  google: 'applovin.js',
  tiktok: 'applovin.js',
  snapchat: 'applovin.js',
};

export interface AnalyticsPluginOptions {
  /**
   * 广告渠道，决定使用哪个 SDK 文件
   * - 'applovin' -> analytics-applovin.js
   * - 'unity'    -> analytics-unity.js
   */
  adNetwork: AdNetwork;

  /** 素材唯一标识 */
  playableId?: string;

  /** 素材版本号 */
  playableVersion?: string;

  /** 发行商/项目名 */
  distributorName?: string;

  /** SDK 版本号（unity 渠道使用） */
  sdkVersion?: string;

  /** 是否横屏（unity 渠道使用） */
  isLandscape?: boolean;

  /** 最大宽度（unity 渠道使用） */
  maxWidth?: number;

  /** 最大高度（unity 渠道使用） */
  maxHeight?: number;

  /**
   * 是否启用开发模式日志
   * 默认：非 production 构建时启用
   */
  development?: boolean;
}

/**
 * Vite 插件：Playable Analytics 自动注入
 */
export function analyticsPlugin(options: AnalyticsPluginOptions): Plugin {
  const {
    adNetwork,
    playableId = '',
    playableVersion = '1.0.0',
    distributorName = '',
    sdkVersion = '1.0.0',
    isLandscape = false,
    maxWidth = 0,
    maxHeight = 0,
    development = false,
  } = options;

  // 读取对应渠道的 SDK 文件（使用 URL 相对于当前模块解析路径）
  const sdkFileName = SDK_FILE_MAP[adNetwork];
  const sdkFileUrl = new URL(`./${sdkFileName}`, import.meta.url);

  let sdkCode: string;
  try {
    sdkCode = readFileSync(sdkFileUrl, 'utf-8');
  } catch {
    throw new Error(
      `[analytics] SDK file not found: ${sdkFileUrl.pathname}\n` +
      `Please ensure ${sdkFileName} exists in vite-plugins/analytics/`
    );
  }

  // 构建初始化参数
  const initConfig = JSON.stringify({
    adNetwork,
    playableId,
    playableVersion,
    distributorName,
    sdkVersion,
    isLandscape,
    maxWidth,
    maxHeight,
    development: development ? 'development' : 'production',
  });

  const injectedScript =
`<script>
${sdkCode}
if (window.createPlayableAnalytics) {
  window.playableAnalytics = window.createPlayableAnalytics(${initConfig});
}
</script>`;

  return {
    name: 'vite-plugin-analytics',

    transformIndexHtml(html) {
      return html.replace('</head>', `${injectedScript}\n</head>`);
    },
  };
}
