import type { Plugin } from 'vite';

/**
 * Exposes @babylonjs/inspector on globalThis.INSPECTOR (like Babylon.js Playground).
 * Also ensures EffectLayer scene component is initialized for SelectionOutlineLayer.
 * Dev-only — inspector is not needed in production builds.
 *
 * Uses an external src file (not inline script) so Vite's transform pipeline
 * resolves bare specifiers like '@babylonjs/inspector'.
 */
export function inspectorPlugin(): Plugin {
  return {
    name: 'vite-plugin-babylon-inspector',
    apply: 'serve',

    transformIndexHtml() {
      return [{
        tag: 'script',
        attrs: { type: 'module', src: '/vite-plugins/inspector/init.ts' },
        injectTo: 'head',
      }];
    },
  };
}
