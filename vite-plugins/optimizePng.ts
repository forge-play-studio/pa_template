import type { Plugin } from 'vite';
import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface OptimizeImageOptions {
  /** Enable/disable (default: true) */
  enabled?: boolean;
  /** optipng -o level 0-7 (default: 2) */
  optipngLevel?: number;
  /** cwebp quality 0-100 (default: 80, lossless if set to 100) */
  webpQuality?: number;
  /** Print per-image savings (default: true) */
  verbose?: boolean;
}

/**
 * Post-build Vite plugin that optimizes inlined PNG assets.
 *
 * For each `data:image/png;base64,...` in the bundle, tries:
 *   1. optipng  (lossless PNG re-compression)
 *   2. cwebp    (lossy/lossless WebP conversion)
 * and picks whichever is smallest.
 *
 * Place this plugin AFTER viteSingleFile in the plugins array.
 * Requires `optipng` and/or `cwebp` in PATH.
 */
export function optimizePngPlugin(options: OptimizeImageOptions = {}): Plugin {
  const {
    enabled = true,
    optipngLevel = 2,
    webpQuality = 80,
    verbose = true,
  } = options;

  let projectRoot = '';

  // Resolve full path of a CLI tool (npm scripts may have truncated PATH)
  function findTool(name: string): string | null {
    // Try `which` first (shell inherits user PATH)
    try {
      const fullPath = execSync(`which ${name}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (fullPath && fs.existsSync(fullPath)) return fullPath;
    } catch { /* not found */ }
    // Fallback: common Homebrew paths
    for (const p of [`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`]) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  return {
    name: 'optimize-png',
    apply: 'build',

    configResolved(config) {
      projectRoot = config.root;
    },

    generateBundle(_, bundle) {
      if (!enabled) return;

      const optipngPath = findTool('optipng');
      const cwebpPath = findTool('cwebp');

      if (!optipngPath && !cwebpPath) {
        console.warn('[optimize-png] Neither optipng nor cwebp found — skipping');
        return;
      }

      const tools = [optipngPath && 'optipng', cwebpPath && 'cwebp'].filter(Boolean);
      if (verbose) console.log(`[optimize-png] Tools: ${tools.join(', ')}`);


      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vite-imgopt-'));
      const pngB64Re = /data:image\/png;base64,([A-Za-z0-9+/=]+)/g;
      const cache = new Map<string, { dataUrl: string } | null>();

      // Build content-hash → filename lookup for logging
      // Uses first 64 bytes of file content as fingerprint (covers PNG header + IHDR)
      const hashToName = new Map<string, string>();
      function scanDir(absDir: string, relDir: string) {
        if (!fs.existsSync(absDir)) return;
        for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
          if (entry.name === 'node_modules') continue;
          const rel = `${relDir}/${entry.name}`;
          if (entry.isDirectory()) {
            scanDir(path.join(absDir, entry.name), rel);
          } else if (entry.name.toLowerCase().endsWith('.png')) {
            try {
              const fd = fs.openSync(path.join(absDir, entry.name), 'r');
              const head = Buffer.alloc(64);
              fs.readSync(fd, head, 0, 64, 0);
              fs.closeSync(fd);
              hashToName.set(head.toString('base64'), rel);
            } catch { /* ignore */ }
          }
        }
      }
      scanDir(path.resolve(projectRoot, 'src'), 'src');

      let totalSaved = 0;
      let count = 0;
      let fileIdx = 0;

      for (const output of Object.values(bundle)) {
        const isStringAsset = output.type === 'asset' && typeof output.source === 'string';
        const isChunk = output.type === 'chunk';
        if (!isStringAsset && !isChunk) continue;

        const source = isStringAsset ? (output.source as string) : output.code;
        let changed = false;

        const result = source.replace(pngB64Re, (match, b64: string) => {
          const buf = Buffer.from(b64, 'base64');
          if (buf.length < 512) return match;

          const key = b64.substring(0, 128);
          if (cache.has(key)) {
            const cached = cache.get(key);
            if (cached) { changed = true; return cached.dataUrl; }
            return match;
          }

          const idx = fileIdx++;
          const srcPng = path.join(tmpDir, `${idx}.png`);
          fs.writeFileSync(srcPng, buf);

          // --- Candidate 1: optipng ---
          let pngBuf: Buffer | null = null;
          if (optipngPath) {
            const optFile = path.join(tmpDir, `${idx}_opt.png`);
            fs.copyFileSync(srcPng, optFile);
            try {
              execFileSync(optipngPath!, [`-o${optipngLevel}`, '-quiet', '-strip', 'all', optFile], {
                timeout: 60_000,
              });
              pngBuf = fs.readFileSync(optFile);
            } catch { /* ignore */ }
          }

          // --- Candidate 2: cwebp ---
          let webpBuf: Buffer | null = null;
          if (cwebpPath) {
            const webpFile = path.join(tmpDir, `${idx}.webp`);
            try {
              execFileSync(cwebpPath!, [
                '-q', String(webpQuality),
                '-alpha_q', '80',
                '-m', '6',        // max compression effort
                '-quiet',
                srcPng, '-o', webpFile,
              ], { timeout: 60_000 });
              webpBuf = fs.readFileSync(webpFile);
            } catch { /* ignore */ }
          }

          // --- Pick best ---
          const pngSize = pngBuf && pngBuf.length < buf.length ? pngBuf.length : buf.length;
          const webpSize = webpBuf ? webpBuf.length : Infinity;

          let bestBuf: Buffer;
          let bestMime: string;
          let bestLabel: string;

          if (webpSize < pngSize) {
            bestBuf = webpBuf!;
            bestMime = 'image/webp';
            bestLabel = 'webp';
          } else if (pngBuf && pngBuf.length < buf.length) {
            bestBuf = pngBuf;
            bestMime = 'image/png';
            bestLabel = 'png';
          } else {
            cache.set(key, null);
            return match;
          }

          const saved = buf.length - bestBuf.length;
          totalSaved += saved;
          count++;
          changed = true;

          const dataUrl = `data:${bestMime};base64,${bestBuf.toString('base64')}`;
          cache.set(key, { dataUrl });

          if (verbose) {
            const pct = ((saved / buf.length) * 100).toFixed(0);
            const headKey = buf.length >= 64 ? buf.subarray(0, 64).toString('base64') : '';
            const name = hashToName.get(headKey) ?? `(${buf.length}B)`;
            console.log(
              `  [${bestLabel}] ${name}: ${(buf.length / 1024).toFixed(1)}KB → ${(bestBuf.length / 1024).toFixed(1)}KB (−${pct}%)`
            );
          }

          return dataUrl;
        });

        if (changed) {
          if (isStringAsset) (output as any).source = result;
          else (output as any).code = result;
        }
      }

      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }

      if (verbose) {
        console.log(`[optimize-png] ${count} image(s) optimized, saved ${(totalSaved / 1024).toFixed(1)}KB`);
      }
    },
  };
}
