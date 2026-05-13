import path from 'path';
import type { Plugin } from 'vite';

export interface ThirdPartyWhitelistPluginOptions {
  allowedPackages: string[];
  projectRoot: string;
}

const VIRTUAL_EMPTY = '\0third-party-empty';

function getPackageName(specifier: string): string | null {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('\0')) {
    return null;
  }
  if (specifier.startsWith('virtual:') || specifier.startsWith('vite/')) {
    return null;
  }
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return scope && name ? `${scope}/${name}` : specifier;
  }
  const [name] = specifier.split('/');
  return name || null;
}

function isProjectFile(id: string, projectRoot: string): boolean {
  return id.startsWith(projectRoot + path.sep) || id === projectRoot;
}

export function thirdPartyWhitelistPlugin(options: ThirdPartyWhitelistPluginOptions): Plugin {
  const allowed = new Set(options.allowedPackages);

  return {
    name: 'third-party-whitelist',
    apply: 'build',
    enforce: 'pre',

    resolveId(source, importer) {
      if (source === VIRTUAL_EMPTY) {
        return VIRTUAL_EMPTY;
      }

      const pkg = getPackageName(source);
      if (!pkg) {
        return null;
      }

      if (allowed.has(pkg)) {
        return null;
      }

      if (!importer) {
        throw new Error(
          `[third-party-whitelist] 非白名单第三方包: "${pkg}" (source: "${source}")`
        );
      }

      if (!isProjectFile(importer, options.projectRoot) && !importer.includes('/node_modules/')) {
        return null;
      }

      throw new Error(
        `[third-party-whitelist] 非白名单第三方包: "${pkg}"\n` +
        `  source: ${source}\n` +
        `  importer: ${importer}\n` +
        `  allowed: ${Array.from(allowed).sort().join(', ')}`
      );
    },

    load(id) {
      if (id === VIRTUAL_EMPTY) {
        return 'export default {};';
      }
      return null;
    },
  };
}
