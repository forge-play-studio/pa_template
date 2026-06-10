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
const bundleStatsEnabled = process.env.BUNDLE_STATS !== 'false';
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

// Vite 6 server.headers / cors middleware doesn't reach `?import&url`
// transform responses (they short-circuit before the headers middleware).
// Patch writeHead + end on every response so ACAO is injected at the
// last moment before flush, after vite's transform logic has run.
function forceCorsPlugin() {
  const middleware = (_req: any, res: any, next: any) => {
    const inject = () => {
      if (res.headersSent) return;
      try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      } catch {}
    };
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = function (...args: any[]) {
      inject();
      return origWriteHead(...args);
    };
    const origEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
      inject();
      return origEnd(...args);
    };
    inject();
    next();
  };
  return {
    name: 'force-cors-on-all',
    configureServer(server: any) {
      server.middlewares.use(middleware);
      // Other plugins (e.g. modelCachePlugin) unshift themselves to the
      // front of the stack and short-circuit on .png/.glb without calling
      // next(). Return a post-hook so we get the LAST unshift and end up
      // at position 0 — our writeHead/end hooks then persist on `res`
      // for every downstream handler.
      return () => {
        const stack = (server.middlewares as any).stack;
        if (!Array.isArray(stack)) return;
        const idx = stack.findIndex((l: any) => l.handle === middleware);
        if (idx > 0) {
          const [layer] = stack.splice(idx, 1);
          stack.unshift(layer);
        }
      };
    },
  };
}

export default defineConfig({
  define: {
    __LITE_BUILD__: JSON.stringify(liteBuild),
    // 在生产构建时完全移除开发功能
    __PROD_BUILD__: JSON.stringify(isProduction),
    __LOCALE__: JSON.stringify(locale),
    __CHANNEL__: JSON.stringify(channel),
    __RTL__: JSON.stringify(localeMeta.isRTL),
    __MULTI_LOCALE__: JSON.stringify(isMultiLocale),
    __BUNDLED_LOCALES__: JSON.stringify(bundledLocales),
  },
  plugins: [
    // MUST be first: force ACAO on every dev response (incl. ?import&url
    // transforms that bypass vite's own headers middleware).
    forceCorsPlugin(),
    // 平台 bridge 自动注入（仅开发模式）
    bridgePlugin({
      port: 8080,
      delay: 2000,
    }),
    // Inspector 暴露到 globalThis（仅开发模式）
    inspectorPlugin(),
    // 开发模式模型强缓存 + URL 版本化（mtime）
    modelCachePlugin({
      extensions: ['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.mp3'],
      roots: ['src'],
      cacheMaxAgeSeconds: 31536000,
    }),
    thirdPartyWhitelistPlugin({
      allowedPackages: allowedThirdPartyPackages,
      projectRoot: __dirname,
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
      imgRoot: resolve(__dirname, 'src/assets/ui'),
    }),
    viteSingleFile(),
    // 构建后图片压缩：PNG → WebP (cwebp) 或 optipng 无损重压，取最小值
    // 需要: brew install webp optipng
    optimizePngPlugin({ enabled: isProduction, optipngLevel: 2, webpQuality: 80 }),
    ...(bundleStatsEnabled ? [
      visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
      visualizer({
        filename: 'dist/stats.json',
        template: 'raw-data',
        gzipSize: true,
        brotliSize: true,
      }),
    ] : []),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    dedupe: [
      '@babylonjs/core',
      '@babylonjs/loaders',
      '@babylonjs/inspector',
    ],
  },
  optimizeDeps: {
    include: [
      '@babylonjs/core',
      '@babylonjs/core/Layers/effectLayerSceneComponent',
      '@babylonjs/inspector',
    ],
  },
  assetsInclude: ['**/*.env'],
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
      'Access-Control-Allow-Origin': '*',
      // 已经在你那边设了的可以保留：
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
});
