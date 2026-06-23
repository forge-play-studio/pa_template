/**
 * Vite 插件：GLB 文件 gzip 预压缩
 *
 * 在构建时将 GLB 文件用 gzip(level 9) 压缩后内联，
 * 运行时通过浏览器原生 DecompressionStream('gzip') 解压。
 */
import { Plugin } from 'vite';
import { gzipSync } from 'zlib';
import { readFileSync, statSync } from 'fs';

// 压缩后的 GLB 使用特殊 MIME 类型
export const COMPRESSED_GLB_MIME = 'application/x-glb-gzip';

interface GlbGzipPluginOptions {
  /** 是否启用压缩，默认 true */
  enabled?: boolean;
  /** 只压缩大于此字节的文件，默认 10KB */
  minSize?: number;
  /** 是否输出压缩日志 */
  verbose?: boolean;
}

export function glbGzipPlugin(options: GlbGzipPluginOptions = {}): Plugin {
  const {
    enabled = true,
    minSize = 10 * 1024, // 10KB
    verbose = true,
  } = options;

  const compressionStats: { file: string; original: number; compressed: number }[] = [];

  return {
    name: 'vite-plugin-glb-gzip',
    enforce: 'pre',

    // 在资源被处理前拦截 GLB 文件的 ?url 导入
    async load(id) {
      if (!enabled) return null;

      // 匹配 .glb?url 导入
      if (!id.endsWith('.glb?url') && !id.match(/\.glb\?.*url/)) {
        return null;
      }

      const filePath = id.replace(/\?.*$/, '');

      try {
        const file = filePath.split('/').pop() || filePath;
        const stat = statSync(filePath);
        const content = readFileSync(filePath);
        assertNoMeshoptCompression(content, file);

        // 小文件不压缩
        if (stat.size < minSize) {
          if (verbose) {
            console.log(`[glb-gzip] Skip (too small): ${filePath} (${(stat.size / 1024).toFixed(1)} KB)`);
          }
          return null;
        }

        const compressed = gzipSync(content, { level: 9 });

        const ratio = ((1 - compressed.length / content.length) * 100).toFixed(1);

        compressionStats.push({
          file,
          original: content.length,
          compressed: compressed.length,
        });

        if (verbose) {
          console.log(
            `[glb-gzip] Compressed: ${file} ` +
            `(${(content.length / 1024).toFixed(1)} KB -> ${(compressed.length / 1024).toFixed(1)} KB, -${ratio}%)`
          );
        }

        // 返回压缩后的 data URL
        const base64 = compressed.toString('base64');
        const dataUrl = `data:${COMPRESSED_GLB_MIME};base64,${base64}`;

        return `export default ${JSON.stringify(dataUrl)}`;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('[glb-gzip]')) {
          throw error;
        }
        console.warn(`[glb-gzip] Failed to compress ${filePath}:`, error);
        return null;
      }
    },

    // 构建结束时输出统计
    closeBundle() {
      if (!enabled || !verbose || compressionStats.length === 0) return;

      const totalOriginal = compressionStats.reduce((sum, s) => sum + s.original, 0);
      const totalCompressed = compressionStats.reduce((sum, s) => sum + s.compressed, 0);
      const totalRatio = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);

      console.log('\n[glb-gzip] Compression Summary:');
      console.log('┌────────────────────────────┬────────────┬────────────┬─────────┐');
      console.log('│ File                       │ Original   │ Compressed │ Ratio   │');
      console.log('├────────────────────────────┼────────────┼────────────┼─────────┤');

      for (const stat of compressionStats) {
        const name = stat.file.length > 26 ? stat.file.substring(0, 23) + '...' : stat.file;
        const ratio = ((1 - stat.compressed / stat.original) * 100).toFixed(0);
        console.log(
          `│ ${name.padEnd(26)} │ ${formatSize(stat.original).padStart(10)} │ ${formatSize(stat.compressed).padStart(10)} │ ${('-' + ratio + '%').padStart(7)} │`
        );
      }

      console.log('├────────────────────────────┼────────────┼────────────┼─────────┤');
      console.log(
        `│ Total                      │ ${formatSize(totalOriginal).padStart(10)} │ ${formatSize(totalCompressed).padStart(10)} │ ${('-' + totalRatio + '%').padStart(7)} │`
      );
      console.log('└────────────────────────────┴────────────┴────────────┴─────────┘');

      // Base64 开销
      const base64Size = totalCompressed * 1.33;
      const originalBase64Size = totalOriginal * 1.33;
      const saved = originalBase64Size - base64Size;

      console.log(`\n[glb-gzip] HTML size impact:`);
      console.log(`  Without compression: ${formatSize(originalBase64Size)} (Base64)`);
      console.log(`  With compression:    ${formatSize(base64Size)} (Gzip + Base64)`);
      console.log(`  Saved:               ${formatSize(saved)} (-${((saved / originalBase64Size) * 100).toFixed(1)}%)\n`);
    },
  };
}

function assertNoMeshoptCompression(content: Buffer, file: string): void {
  if (content.length < 20 || content.toString('ascii', 0, 4) !== 'glTF') return;

  const jsonLength = content.readUInt32LE(12);
  const jsonType = content.toString('ascii', 16, 20);
  if (jsonType !== 'JSON') return;

  try {
    const json = JSON.parse(content.subarray(20, 20 + jsonLength).toString('utf8')) as {
      extensionsUsed?: string[];
      extensionsRequired?: string[];
      bufferViews?: Array<{ extensions?: Record<string, unknown> }>;
    };
    const usesMeshopt =
      json.extensionsUsed?.includes('EXT_meshopt_compression') ||
      json.extensionsRequired?.includes('EXT_meshopt_compression') ||
      json.bufferViews?.some(view => view.extensions?.EXT_meshopt_compression);

    if (usesMeshopt) {
      throw new Error(
        `[glb-gzip] ${file} uses EXT_meshopt_compression. ` +
        'Decode meshopt before packaging; AppLovin Android can hang while loading the runtime decoder.'
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('[glb-gzip]')) throw error;
    throw new Error(`[glb-gzip] Failed to inspect ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}
