import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { visualizer } from 'rollup-plugin-visualizer';
import {
  bridgePlugin,
  glbGzipPlugin,
  inspectorPlugin,
  localePlugin,
  modelCachePlugin,
  optimizePngPlugin,
  stripBabylonPlugin,
  thirdPartyWhitelistPlugin,
} from './vite-plugins';

const liteBuild = process.env.LITE_BUILD === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const locale = (process.env.LOCALE || 'EN').toUpperCase();
const channel = process.env.CHANNEL || 'applovin';
const isRTL = ['AR', 'FA', 'HE', 'UR'].includes(locale);
const localeMeta = {
  htmlLang: locale.toLowerCase(),
  isRTL,
};
const isMultiLocale = false;
const bundledLocales = [locale];
const allowedThirdPartyPackages = [
  '@babylonjs/core',
  '@babylonjs/loaders',
  'brotli-dec-wasm',
];
import {
  scriptInjectPlugin,
  inspectorBridgePlugin,
} from '@fps-games/vite-plugins';
import {
  stripBabylonPlugin,
  babylonInspectorPlugin,
} from '@fps-games/vite-plugins/babylon';

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [
    // Inspector 命令拦截 + 内置通用 handler (handler.iife.js)
    inspectorBridgePlugin({
      enabled: true,
      builtinHandler: true,
    }),
    // Game Bridge 自动注入（仅开发模式）
    scriptInjectPlugin({
      src: 'http://localhost:8080/script/bridge.js',
      delay: 2000,
      errorMessage: '[GameBridge] MCP Server not available',
      urlRewrite: `
        var e2b = location.href.match(/https?:\\/\\/\\d+-([a-z0-9]+)\\.e2b\\.(app|dev)/);
        return e2b ? 'https://8080-' + e2b[1] + '.e2b.app/script/bridge.js' : defaultSrc;
      `,
    }),
    // Inspector 暴露到 globalThis（仅开发模式）
    babylonInspectorPlugin(),
    // Strip unused Babylon.js code (WGSL shaders, submodules, OpenPBR, texture loaders)
    stripBabylonPlugin(),
    viteSingleFile(),
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    // 临时降低内联阈值：查看文件大小分布
    assetsInlineLimit: 100000000, // 内联所有资源
    chunkSizeWarningLimit: 1000000,
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // 保留 warn 和 error
        passes: 3, // 增加压缩次数
        sequences: true, // 连续语句合并
        dead_code: true, // 移除死代码
        conditionals: true, // 优化条件语句
        booleans: true, // 优化布尔值
        unused: true, // 移除未使用的变量
        if_return: true, // 优化 if return
        join_vars: true, // 连接变量声明
        // 生产构建时移除开发功能
        global_defs: isProduction
          ? {
              'import.meta.env.PROD': true,
            }
          : {},
      },
      mangle: {
        toplevel: false, // 保持兼容性
      },
      format: {
        comments: false,
      },
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 3,
        sequences: true,
        dead_code: true,
        conditionals: true,
        booleans: true,
        unused: true,
        if_return: true,
        join_vars: true,
        global_defs: isProduction ? {
          'import.meta.env.PROD': true
        } : {},
      },
      mangle: {
        toplevel: true, // 单文件 playable ad，可混淆顶层变量
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
          if (id.includes('/node_modules/@babylonjs/core/ShadersWGSL/')) {
            return false;
          }
          if (id.includes('@babylonjs/core')) {
            const excludePatterns = [
              '/XR/',
              '/Physics/',
              '/Debug/',
              '/Offline/',
              '/LibDecoder/',
              '/LensFlare/',
              '/Layer/',
              '/Sprites/',
              '/Morph/',
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
      // 标记 Babylon.js 的副作用模块，帮助 tree-shaking
      treeshake: {
        moduleSideEffects: (id) => {
          if (id.includes('/node_modules/@babylonjs/core/ShadersWGSL/')) {
            return false;
          }

          // 标记不需要的 Babylon.js 模块为无副作用
          if (id.includes('@babylonjs/core')) {
            // 排除不需要的模块
            const excludePatterns = [
              '/XR/',
              '/Physics/',
              '/Debug/',
              '/Offline/',
              '/LibDecoder/',
              '/LensFlare/',
              '/Layer/',
              '/Sprites/',
              '/Morph/',
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
            if (excludePatterns.some((pattern) => id.includes(pattern))) {
              return false;
            }
          }
          return true;
        },
      },
    },
  },
  server: {
    port: 3006,
    strictPort: true,
    cors: true,
    allowedHosts: ['.e2b.app'],
    headers: {
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
});
