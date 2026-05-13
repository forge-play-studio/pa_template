import type { Plugin } from 'vite';

/**
 * Strips unused Babylon.js code from the production bundle:
 *
 * 1. WGSL shaders — replaces WebGPU WGSL shader imports with no-ops.
 * 2. Unused submodules — Audio, GUI, FluidRenderer, etc. → empty virtual module.
 * 3. OpenPBR — forces the glTF OpenPBR branch to `false` so Rollup drops it.
 * 4. Unused texture loaders — removes dds/basis/env/hdr/ktx/tga/exr/ies branches
 *    from textureLoaderManager so Rollup can drop their decoder modules.
 */
export function stripBabylonPlugin(): Plugin {
  const VIRTUAL_EMPTY = '\0babylon-empty';
  const coreNeedle = '/node_modules/@babylonjs/core/';

  // --- WGSL strip patterns ---
  const wgslDynamicImportRe = /import\(\s*(['"])([^'"]*ShadersWGSL\/[^'"]*)\1\s*\)/g;
  const wgslSideEffectImportRe =
    /^\s*import\s+(['"])[^'"]*ShadersWGSL\/[^'"]*\1\s*;\s*$/gm;
  const wgslStaticImportFromRe =
    /^\s*import\s+[^;]*\s+from\s+(['"])[^'"]*ShadersWGSL\/[^'"]*\1\s*;\s*$/gm;

  // --- Unused submodule patterns ---
  const excludePatterns = [
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
    // Extended: mirrors treeshake.moduleSideEffects in vite.config
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
  ];

  // --- OpenPBR strip pattern ---
  const gltfLoaderNeedle = '/node_modules/@babylonjs/loaders/glTF/2.0/glTFLoader.js';
  const gltfIndexNeedle = '/node_modules/@babylonjs/loaders/glTF/2.0/index.js';
  const gltfExtensionsIndexNeedle = '/node_modules/@babylonjs/loaders/glTF/2.0/Extensions/index.js';
  const gltfExtensionsDynamicNeedle = '/node_modules/@babylonjs/loaders/glTF/2.0/Extensions/dynamic.js';
  const openPbrConditionRe =
    /if\s*\(\s*this\.parent\.useOpenPBR\s*\|\|\s*this\.isExtensionUsed\(\s*["']KHR_materials_openpbr["']\s*\)\s*\)\s*\{/g;
  const openPbrAssignmentBlockRe =
    /if\s*\(\s*this\.parent\.useOpenPBR\s*\|\|\s*this\.isExtensionUsed\(\s*["']KHR_materials_openpbr["']\s*\)\s*\)\s*\{[\s\S]*?\}\s*else\s*\{[\s\S]*?this\._pbrMaterialImpl\s*=\s*\{\s*materialClass:\s*\(await import\(["']@babylonjs\/core\/Materials\/PBR\/pbrMaterial\.js["']\)\)\.PBRMaterial,\s*adapterClass:\s*\(await import\(["']\.\/pbrMaterialLoadingAdapter\.js["']\)\)\.PBRMaterialLoadingAdapter,\s*\};\s*\}/g;
  const openPbrExportRe =
    /^\s*export\s+\*\s+from\s+["']\.\/openpbrMaterialLoadingAdapter\.js["'];\s*$/gm;
  const interactivityExportRe =
    /^\s*export\s+\*\s+from\s+["']\.\/(?:KHR_interactivity(?:\/index)?|KHR_node_hoverability|KHR_node_selectability)\.js["'];\s*$/gm;
  const interactivityDynamicRegistrationRe =
    /^\s*registerGLTFExtension\("KHR_(?:interactivity|node_hoverability|node_selectability)",[\s\S]*?\n\s*\}\);\s*$/gm;

  // --- Unused texture loader patterns ---
  const textureLoaderManagerNeedle =
    '/node_modules/@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager.js';
  const prefilteredCubeTextureNeedle =
    '/node_modules/@babylonjs/core/Engines/Extensions/engine.prefilteredCubeTexture.js';
  const textureExtPatterns: RegExp[] = [
    /if\s*\(\s*extension\.endsWith\(\s*["']\.ies["']\s*\)\s*\)\s*\{[\s\S]*?\}\s*/g,
    /if\s*\(\s*extension\.endsWith\(\s*["']\.dds["']\s*\)\s*\)\s*\{[\s\S]*?\}\s*/g,
    /if\s*\(\s*extension\.endsWith\(\s*["']\.basis["']\s*\)\s*\)\s*\{[\s\S]*?\}\s*/g,
    /if\s*\(\s*extension\.endsWith\(\s*["']\.env["']\s*\)\s*\)\s*\{[\s\S]*?\}\s*/g,
    /if\s*\(\s*extension\.endsWith\(\s*["']\.hdr["']\s*\)\s*\)\s*\{[\s\S]*?\}\s*/g,
    /if\s*\(\s*extension\.endsWith\(\s*["']\.ktx["']\s*\)\s*\|\|\s*extension\.endsWith\(\s*["']\.ktx2["']\s*\)\s*\)\s*\{[\s\S]*?\}\s*/g,
    /if\s*\(\s*extension\.endsWith\(\s*["']\.tga["']\s*\)\s*\)\s*\{[\s\S]*?\}\s*/g,
    /if\s*\(\s*extension\.endsWith\(\s*["']\.exr["']\s*\)\s*\)\s*\{[\s\S]*?\}\s*/g,
  ];

  return {
    name: 'strip-babylon',
    apply: 'build',
    enforce: 'pre',

    // Redirect unused submodule imports to an empty module
    resolveId(source, importer) {
      if (!importer) return null;
      if (!importer.includes('/node_modules/@babylonjs/')) return null;
      if (excludePatterns.some((p) => source.includes(p))) {
        return { id: VIRTUAL_EMPTY, syntheticNamedExports: true };
      }
      return null;
    },

    load(id) {
      if (id === VIRTUAL_EMPTY) {
        return 'export default {};';
      }
      return null;
    },

    transform(code, id) {
      // --- WGSL shader imports ---
      if (id.includes(coreNeedle) && code.includes('ShadersWGSL/')) {
        let out = code;
        out = out.replace(wgslDynamicImportRe, 'Promise.resolve()');
        out = out.replace(wgslSideEffectImportRe, '');
        out = out.replace(wgslStaticImportFromRe, '');
        if (out !== code) return { code: out, map: null };
      }

      // --- OpenPBR branch in glTF loader ---
      if (id.includes(gltfLoaderNeedle) && code.includes('KHR_materials_openpbr')) {
        let out = code.replace(
          openPbrAssignmentBlockRe,
          `this._pbrMaterialImpl = {
                        materialClass: (await import("@babylonjs/core/Materials/PBR/pbrMaterial.js")).PBRMaterial,
                        adapterClass: (await import("./pbrMaterialLoadingAdapter.js")).PBRMaterialLoadingAdapter,
                    };`
        );
        out = out.replace(openPbrConditionRe, 'if (false) {');
        if (out !== code) return { code: out, map: null };
      }

      // --- OpenPBR adapter export in glTF 2.0 barrel ---
      if (id.includes(gltfIndexNeedle) && code.includes('openpbrMaterialLoadingAdapter')) {
        const out = code.replace(openPbrExportRe, '');
        if (out !== code) return { code: out, map: null };
      }

      // --- KHR_interactivity extension registration in glTF loader ---
      if (id.includes(gltfExtensionsIndexNeedle) && code.includes('KHR_interactivity')) {
        const out = code.replace(interactivityExportRe, '');
        if (out !== code) return { code: out, map: null };
      }

      // --- Dynamic glTF interactivity-related extension registration ---
      if (id.includes(gltfExtensionsDynamicNeedle) && code.includes('KHR_interactivity')) {
        const out = code.replace(interactivityDynamicRegistrationRe, '');
        if (out !== code) return { code: out, map: null };
      }

      // --- Unused texture loader registrations ---
      if (id.includes(textureLoaderManagerNeedle) && code.includes('registerTextureLoader(')) {
        let out = code;
        for (const re of textureExtPatterns) {
          out = out.replace(re, '');
        }
        if (out !== code) return { code: out, map: null };
      }

      // --- DDS prefiltered cube texture import ---
      if (id.includes(prefilteredCubeTextureNeedle) && code.includes('import("../../Misc/dds.js")')) {
        let out = code;
        out = out.replace(
          /const\s*\{\s*DDSTools\s*\}\s*=\s*await\s*import\(\s*["']\.\.\/\.\.\/Misc\/dds\.js["']\s*\);\s*/g,
          ''
        );
        out = out.replace(
          /if\s*\(\s*loadData\.isDDS\s*\)\s*\{[\s\S]*?\}\s*else\s*\{\s*Logger\.Warn\(\s*["']DDS is the only prefiltered cube map supported so far\.\s*["']\s*\);\s*\}/g,
          'Logger.Warn("DDS prefiltered cube maps are disabled in this build.");'
        );
        if (out !== code) return { code: out, map: null };
      }

      return null;
    },
  };
}
