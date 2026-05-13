import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';

interface ModelCachePluginOptions {
  extensions: string[];
  roots: string[];
  cacheMaxAgeSeconds: number;
}

export function modelCachePlugin(options: ModelCachePluginOptions): Plugin {
  const normalizedExtensions = options.extensions.map((ext) =>
    ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
  );
  let projectRoot = '';
  let rootsAbs: string[] = [];

  function isModelExtension(filePath: string): boolean {
    return normalizedExtensions.includes(path.extname(filePath).toLowerCase());
  }

  function resolveCandidateFile(importer: string, relativePath: string): string {
    const normalizedPath = relativePath.split('?', 1)[0].split('#', 1)[0];
    if (relativePath.startsWith('/')) {
      return path.resolve(projectRoot, '.' + normalizedPath);
    }
    if (importer.startsWith(projectRoot)) {
      return path.resolve(path.dirname(importer), normalizedPath);
    }
    return path.resolve(projectRoot, normalizedPath);
  }

  function isUnderRoots(filePath: string): boolean {
    return rootsAbs.some((root) => filePath.startsWith(root + path.sep) || filePath === root);
  }

  function getContentType(extension: string): string {
    switch (extension) {
      case '.glb':
        return 'model/gltf-binary';
      case '.gltf':
        return 'model/gltf+json';
      case '.bin':
        return 'application/octet-stream';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      case '.svg':
        return 'image/svg+xml';
      case '.avif':
        return 'image/avif';
      case '.bmp':
        return 'image/bmp';
      default:
        return 'application/octet-stream';
    }
  }

  function resolveFsPathFromUrl(urlPath: string): string | null {
    let decodedPath = urlPath;
    try {
      decodedPath = decodeURIComponent(urlPath);
    } catch {
      decodedPath = urlPath;
    }
    if (decodedPath.startsWith('/@fs/')) {
      const fsPath = decodedPath.slice('/@fs/'.length);
      return path.normalize(fsPath);
    }
    return path.resolve(projectRoot, '.' + decodedPath);
  }

  function getMtimeMs(filePath: string): string | null {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) return null;
      return String(stat.mtimeMs);
    } catch {
      return null;
    }
  }

  function createTransformRegex(extensionGroup: string): RegExp {
    return new RegExp(
      `new\\s+URL\\(\\s*(["'\`])([^"'\`]+\\.(?:${extensionGroup})(?:\\?[^"'\`]*)?)\\1\\s*,\\s*import\\.meta\\.url\\s*\\)`,
      'g'
    );
  }

  function appendVersionParam(rawPath: string, version: string): string {
    if (/[?&]v=/.test(rawPath)) return rawPath;
    const separator = rawPath.includes('?') ? '&' : '?';
    return `${rawPath}${separator}v=${version}`;
  }

  return {
    name: 'vite-plugin-model-cache',
    apply: 'serve',
    enforce: 'pre',

    configResolved(config) {
      projectRoot = config.root;
      rootsAbs = options.roots.map((root) => path.resolve(projectRoot, root));
    },

    transform(code, id) {
      const cleanId = id.split('?', 1)[0];
      if (!/\.tsx?$/.test(cleanId)) return null;

      const extensionGroup = normalizedExtensions.map((ext) => ext.slice(1)).join('|');
      const urlMatcher = createTransformRegex(extensionGroup);

      let hasReplacements = false;
      let rewritten = code.replace(urlMatcher, (full, quote, rawPath) => {
        const filePath = resolveCandidateFile(cleanId, rawPath);
        if (!isModelExtension(filePath)) return full;
        if (!isUnderRoots(filePath)) return full;

        this.addWatchFile(filePath);

        const version = getMtimeMs(filePath);
        if (!version) return full;

        const nextPath = appendVersionParam(rawPath, version);
        hasReplacements = true;
        return full.replace(rawPath, nextPath);
      });

      if (!hasReplacements) return null;
      return rewritten;
    },

    handleHotUpdate(ctx) {
      if (!isModelExtension(ctx.file)) return;
      if (!isUnderRoots(ctx.file)) return;
      ctx.server.ws.send({ type: 'full-reload' });
    },

    configureServer(server: ViteDevServer) {
      const handler = (req: any, res: any, next: any) => {
        if (!req.url) return next();
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();

        const url = new URL(req.url, 'http://localhost');
        const extension = path.extname(url.pathname).toLowerCase();
        if (!normalizedExtensions.includes(extension)) return next();

        const isUrlImportModuleRequest = url.searchParams.has('import') && url.searchParams.has('url');
        if (isUrlImportModuleRequest) {
          const absolutePath = resolveFsPathFromUrl(url.pathname);
          if (!absolutePath) return next();
          if (!isUnderRoots(absolutePath)) return next();
          if (!fs.existsSync(absolutePath)) return next();

          const version = getMtimeMs(absolutePath);
          const versionedPath = version ? `${url.pathname}?v=${version}` : url.pathname;
          const body = `export default ${JSON.stringify(versionedPath)}\n`;

          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Content-Type', 'text/javascript');
          res.setHeader('X-Model-Cache', version ? 'rewrite' : 'miss');

          if (req.method === 'HEAD') {
            res.statusCode = 200;
            res.end();
            return;
          }

          res.statusCode = 200;
          res.end(body);
          return;
        }

        const isTransformRequest =
          url.searchParams.has('url') ||
          url.searchParams.has('import') ||
          url.searchParams.has('raw') ||
          url.searchParams.has('inline') ||
          url.searchParams.has('worker');
        if (isTransformRequest) {
          return next();
        }

        const absolutePath = resolveFsPathFromUrl(url.pathname);
        if (!absolutePath) return next();
        if (!isUnderRoots(absolutePath)) return next();
        if (!fs.existsSync(absolutePath)) return next();

        const hasVersion = url.searchParams.has('v');
        const cacheControl = hasVersion
          ? `public, max-age=${options.cacheMaxAgeSeconds}, immutable`
          : 'no-cache';

        res.setHeader('X-Model-Cache', hasVersion ? 'hit' : 'miss');
        res.setHeader('Cache-Control', cacheControl);
        res.setHeader('Content-Type', getContentType(extension));

        if (req.method === 'HEAD') {
          res.statusCode = 200;
          res.end();
          return;
        }

        const stream = fs.createReadStream(absolutePath);
        stream.on('error', (error) => next(error));
        res.statusCode = 200;
        stream.pipe(res);
      };

      server.middlewares.use(handler);
      // Ensure our middleware runs before Vite's static/transform handlers.
      const stack = (server.middlewares as any).stack;
      if (Array.isArray(stack)) {
        const idx = stack.findIndex((layer: any) => layer.handle === handler);
        if (idx > -1) {
          const [layer] = stack.splice(idx, 1);
          stack.unshift(layer);
        }
      }
    },
  };
}
