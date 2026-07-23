import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Isolated Issue #565 fixture; it never imports the project GameWorld or rendering config. */
export default defineConfig({
  root: __dirname,
  plugins: [viteSingleFile()],
  assetsInclude: ['**/*.env'],
  build: {
    outDir: '../../dist-tests/inline-environment-texture',
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
