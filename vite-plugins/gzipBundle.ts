import type { Plugin } from 'vite';
import { gzipSync } from 'zlib';

export interface GzipBundlePluginOptions {
  /** Enable/disable (default: true) */
  enabled?: boolean;
  /** Only compress inline module scripts larger than this (default: 100KB) */
  minSize?: number;
  /** Print savings (default: true) */
  verbose?: boolean;
}

const MODULE_SCRIPT_OPEN_RE = /<script\b(?=[^>]*\btype\s*=\s*(?:"module"|'module'|module\b))[^>]*>/gi;
const SCRIPT_CLOSE = '</script>';
const GZIP_BUNDLE_LOADER_MARKER =
  'pipeThrough(new DecompressionStream("gzip"))).text();var s=document.createElement("script");s.type="module";';

/**
 * Gzips the largest inlined module script in a single-file HTML build and
 * replaces it with a small DecompressionStream loader.
 */
export function gzipBundlePlugin(options: GzipBundlePluginOptions = {}): Plugin {
  const {
    enabled = true,
    minSize = 100 * 1024,
    verbose = true,
  } = options;

  return {
    name: 'gzip-bundle',
    apply: 'build',
    enforce: 'post',

    generateBundle(_, bundle) {
      if (!enabled) return;

      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || typeof output.source !== 'string') continue;
        if (!output.fileName.endsWith('.html')) continue;

        const html = output.source;
        if (html.includes(GZIP_BUNDLE_LOADER_MARKER)) continue;

        const script = findLargestInlineModuleScript(html);
        if (!script) continue;

        const code = html.slice(script.bodyStart, script.bodyEnd);
        if (code.length < minSize) continue;

        const compressedBase64 = gzipSync(Buffer.from(code, 'utf8'), { level: 9 }).toString('base64');
        const loader = createLoader(compressedBase64);

        output.source = html.slice(0, script.start) + loader + html.slice(script.end);

        if (verbose) {
          const saved = code.length - loader.length;
          const ratio = saved > 0 ? (saved / code.length) * 100 : 0;
          console.log(
            `[gzip-bundle] ${output.fileName}: JS ${formatSize(code.length)} -> ${formatSize(loader.length)} ` +
            `(gzip+base64, -${ratio.toFixed(0)}%)`,
          );
        }
      }
    },
  };
}

function findLargestInlineModuleScript(html: string): { start: number; bodyStart: number; bodyEnd: number; end: number } | null {
  let best: { start: number; bodyStart: number; bodyEnd: number; end: number } | null = null;
  let match: RegExpExecArray | null;

  MODULE_SCRIPT_OPEN_RE.lastIndex = 0;
  while ((match = MODULE_SCRIPT_OPEN_RE.exec(html))) {
    const bodyStart = match.index + match[0].length;
    const bodyEnd = html.indexOf(SCRIPT_CLOSE, bodyStart);
    if (bodyEnd < 0) continue;

    const end = bodyEnd + SCRIPT_CLOSE.length;
    if (!best || bodyEnd - bodyStart > best.bodyEnd - best.bodyStart) {
      best = { start: match.index, bodyStart, bodyEnd, end };
    }
  }

  return best;
}

function createLoader(compressedBase64: string): string {
  return (
    '<script>' +
    '(async()=>{' +
    `var b=Uint8Array.from(atob("${compressedBase64}"),function(c){return c.charCodeAt(0)});` +
    'var t=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();' +
    'var s=document.createElement("script");s.type="module";s.textContent=t;document.head.appendChild(s);' +
    '})().catch(function(e){console.error(e)});' +
    '</script>'
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
