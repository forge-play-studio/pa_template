/** Project build, locale, analytics, and debug/VFX Vite configuration. */
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from '../package.json';

import {
  analyticsPlugin,
  type AdNetwork,
  bridgePlugin,
  glbGzipPlugin,
  gzipBundlePlugin,
  inspectorPlugin,
  localePlugin,
  modelCachePlugin,
  molocoCtaPlugin,
  optimizePngPlugin,
  projectDebugApiPlugins,
  stripBabylonPlugin,
  thirdPartyWhitelistPlugin,
} from './index';

export interface ProjectViteIntegration {
  editorPackageIds: readonly string[];
  localFpsGameEditorRepo: string | null;
  readFpsEditorVersion(): string;
  createAgentBridgeSessionMetadata(): Record<string, unknown>;
  playableEditorVitePlugin(): unknown;
  projectAuthoringApiPlugin(): unknown;
  pluginManifestVitePlugin(): unknown;
}

type TemplateLocaleConfig = {
  htmlLang: string;
  isRTL: boolean;
  region?: string;
};

type TemplateAppConfig = {
  analytics: {
    adNetwork?: AdNetwork;
    playableId?: string;
    playableVersion?: string;
    distributorName?: string;
    sdkVersion?: string;
    isLandscape?: boolean;
    maxWidth?: number;
    maxHeight?: number;
  };
  i18n: {
    buildVersions: string[];
    locales: Record<string, TemplateLocaleConfig>;
    channels: {
      tracked: AdNetwork[];
      untracked: AdNetwork[];
    };
  };
  naming: {
    projectCode: string;
    materialId: string;
    creator: string;
    vendor: string;
    materialName: string;
  };
};

const appConfig = (pkg as typeof pkg & { appConfig: TemplateAppConfig }).appConfig;
const analyticsConfig = appConfig.analytics;
const i18nConfig = appConfig.i18n;
const liteBuild = process.env.LITE_BUILD === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const bridgeEnabled = process.env.BRIDGE_ENABLED === 'true';
const bundleStatsEnabled = process.env.BUNDLE_STATS === 'true';
const buildMatrix = process.env.BUILD_MATRIX === 'true';
const sceneWalkthroughRequested = process.env.SCENE_WALKTHROUGH_BUILD === 'true';
const defaultBuildLocale = (i18nConfig.buildVersions[0] || 'EN').toUpperCase();
const locale = (process.env.LOCALE || defaultBuildLocale).toUpperCase();
const channel = (process.env.CHANNEL || analyticsConfig.adNetwork || 'applovin') as AdNetwork;
const tracking = process.env.TRACKING !== 'false';
const dedicatedBuildLocales = new Set(i18nConfig.buildVersions.slice(1).map(value => value.toUpperCase()));
const isMultiLocale = locale === defaultBuildLocale;
const bundledLocales = isMultiLocale
  ? Object.keys(i18nConfig.locales).filter(value => !dedicatedBuildLocales.has(value.toUpperCase()))
  : [locale];
const localeMeta = i18nConfig.locales[locale] || i18nConfig.locales[defaultBuildLocale] || {
  htmlLang: locale.toLowerCase(),
  isRTL: false,
};

export function createPaTemplateViteConfig(integration: ProjectViteIntegration) {
const projectRoot = resolve(__dirname, '..');
const allowedThirdPartyPackages = ['@babylonjs/core', '@babylonjs/loaders', '@fps-games/vfx', ...integration.editorPackageIds];
return defineConfig(({ command }) => {
  const devServer = command === 'serve';
  if (sceneWalkthroughRequested && (command !== 'build' || !isProduction || buildMatrix)) {
    throw new Error('SCENE_WALKTHROUGH_BUILD is only valid for the dedicated non-matrix production build command');
  }
  const sceneWalkthroughBuild = command === 'build'
    && isProduction
    && !buildMatrix
    && sceneWalkthroughRequested;

  return {
  cacheDir: process.env.VITE_CACHE_DIR || `node_modules/.vite-fps-editor-${integration.readFpsEditorVersion()}`,
  define: {
    __LITE_BUILD__: JSON.stringify(liteBuild),
    // 在生产构建时完全移除开发功能
    __PROD_BUILD__: JSON.stringify(isProduction),
    __SCENE_WALKTHROUGH_BUILD__: JSON.stringify(sceneWalkthroughBuild),
    __LOCALE__: JSON.stringify(locale),
    __CHANNEL__: JSON.stringify(channel),
    __RTL__: JSON.stringify(localeMeta.isRTL),
    __MULTI_LOCALE__: JSON.stringify(isMultiLocale),
    __BUNDLED_LOCALES__: JSON.stringify(bundledLocales),
    __FPS_EDITOR_AGENT_SESSION_METADATA__: JSON.stringify(integration.createAgentBridgeSessionMetadata()),
  },
  plugins: [
    // The legacy platform bridge is opt-in so ordinary local runs do not probe
    // the external bridge port.
    ...(devServer ? [bridgePlugin({
      port: 8080,
      delay: 2000,
      enabled: bridgeEnabled,
    })] : []),
    // Production builds do not inject Babylon Inspector UI.
    ...(devServer ? [inspectorPlugin()] : []),
    integration.playableEditorVitePlugin(),
    integration.pluginManifestVitePlugin(),
    ...(devServer ? projectDebugApiPlugins({ projectRoot }) : []),
    ...(devServer ? [integration.projectAuthoringApiPlugin()] : []),
    // 开发模式模型强缓存 + URL 版本化（mtime）
    ...(devServer ? [modelCachePlugin({
      extensions: [
        '.glb', '.gltf',
        '.png', '.jpg', '.jpeg',
        '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
      ],
      roots: ['src'],
      cacheMaxAgeSeconds: 31536000,
    })] : []),
    thirdPartyWhitelistPlugin({
      allowedPackages: allowedThirdPartyPackages,
      projectRoot,
    }),
    // GLB 预压缩（只在生产构建时启用）
    glbGzipPlugin({
      enabled: isProduction,
      minSize: 10 * 1024, // 只压缩 > 10KB 的文件
      verbose: true,
    }),
    // Strip unused Babylon.js code (WGSL shaders, submodules, OpenPBR, texture loaders)
    stripBabylonPlugin(),
    localePlugin({
      locale,
      htmlLang: localeMeta.htmlLang,
      isRTL: localeMeta.isRTL,
      imgRoot: resolve(projectRoot, 'src/assets/ui'),
    }),
    ...(channel === 'moloco' ? [molocoCtaPlugin()] : []),
    ...(tracking ? [
      analyticsPlugin({
        adNetwork: channel,
        playableId: analyticsConfig.playableId,
        playableVersion: analyticsConfig.playableVersion,
        distributorName: analyticsConfig.distributorName,
        sdkVersion: analyticsConfig.sdkVersion,
        isLandscape: analyticsConfig.isLandscape,
        maxWidth: analyticsConfig.maxWidth,
        maxHeight: analyticsConfig.maxHeight,
        development: process.env.NODE_ENV !== 'production',
      }),
    ] : []),
    viteSingleFile(),
    // 构建后图片压缩：PNG → WebP (cwebp) 或 optipng 无损重压，取最小值
    // 需要: brew install webp optipng
    optimizePngPlugin({ enabled: isProduction, optipngLevel: 2, webpQuality: 80 }),
    // 构建后压缩 single-file HTML 中的内联 JS bundle。
    // 放在 optimizePngPlugin 后面，避免先压 JS 导致图片优化看不到内联 PNG。
    gzipBundlePlugin({ enabled: isProduction, minSize: 100 * 1024, verbose: true }),
    ...(bundleStatsEnabled ? [
      visualizer({
        filename: buildMatrix ? 'dist/_build/stats.html' : 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
      visualizer({
        filename: buildMatrix ? 'dist/_build/stats.json' : 'dist/stats.json',
        template: 'raw-data',
        gzipSize: true,
        brotliSize: true,
      }),
    ] : []),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      {
        find: /^virtual:pa-app-entry$/,
        replacement: resolve(
          projectRoot,
          command === 'build' ? 'src/entry/game-entry.ts' : 'src/dev/dev-entry.ts',
        ),
      },
    ],
    dedupe: [
      '@babylonjs/core',
      '@babylonjs/loaders',
      '@babylonjs/inspector',
    ],
  },
  optimizeDeps: {
    exclude: integration.localFpsGameEditorRepo ? [...integration.editorPackageIds] : [],
    include: [
      '@babylonjs/core',
      '@babylonjs/core/Layers/effectLayerSceneComponent',
      '@babylonjs/inspector',
      '@babylonjs/core/Rendering/depthRendererSceneComponent',
      '@babylonjs/core/Gizmos/gizmoManager',
    ],
  },
  assetsInclude: ['**/*.env'],
  build: {
    target: 'esnext',
    outDir: buildMatrix ? 'dist/_build' : sceneWalkthroughBuild ? 'dist/scene-walkthrough' : 'dist',
    // 临时降低内联阈值：查看文件大小分布
    assetsInlineLimit: 100000000, // 内联所有资源
    chunkSizeWarningLimit: 1000000,
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],  // 保留 warn 和 error
        passes: 3,  // 增加压缩次数
        sequences: true,  // 连续语句合并
        dead_code: true,  // 移除死代码
        conditionals: true,  // 优化条件语句
        booleans: true,  // 优化布尔值
        unused: true,  // 移除未使用的变量
        if_return: true,  // 优化 if return
        join_vars: true,  // 连接变量声明
        // 生产构建时移除开发功能
        global_defs: isProduction ? {
          'import.meta.env.PROD': true
        } : {},
      },
      mangle: {
        toplevel: false,  // 保持兼容性
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
      // 标记 Babylon.js 的副作用模块，帮助 tree-shaking
      treeshake: {
        moduleSideEffects: (id) => {
          // 标记不需要的 Babylon.js 模块为无副作用
          if (id.includes('@babylonjs/core')) {
            // 排除不需要的模块
            const excludePatterns = [
              '/XR/',
              '/Physics/',
              '/Debug/',
              '/DeviceInput/',
              '/Offline/',
              '/LibDecoder/',
              '/LensFlare/',
              '/Layer/',
              '/Sprites/',
              '/Morph/',
              '/Bones/',
              '/Navigation/',
              '/Audio/',
              '/GUI/',
              '/FluidRenderer/',
              '/GreasedLine/',
              '/ComputeEffect/',
              '/Materials/Node/',
              '/Materials/Textures/Procedurals/',
              '/Culling/Octrees/',
              '/BakedVertexAnimation/',
              '/Gamepads/',
              '/Misc/basis/',
            ];
            if (excludePatterns.some(pattern => id.includes(pattern))) {
              return false;
            }
          }
          return true;
        },
      },
    },
  },
  server: {
    port: 3011,
    strictPort: true,
    cors: true,
    allowedHosts: ['.e2b.app'],
    fs: integration.localFpsGameEditorRepo
      ? {
          allow: [projectRoot, integration.localFpsGameEditorRepo],
        }
      : undefined,
    headers: {
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    }
  },
  };
});
}
