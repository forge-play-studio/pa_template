/**
 * 运行时 Brotli 解压工具
 *
 * 使用 brotli-dec-wasm（WASM）解压预压缩的 GLB 文件。
 * WASM 二进制由 Vite singlefile 构建内联为 base64 data URL，
 * 通过 initSync 同步初始化，无需额外网络请求。
 */

import brotliWasmUrl from 'brotli-dec-wasm/web/bg.wasm?url';
import { initSync, decompress as brotliDecompress } from 'brotli-dec-wasm/web';

/** 压缩 GLB 的 MIME 类型标识 */
export const COMPRESSED_GLB_MIME = 'application/x-glb-brotli';

let brotliReady = false;

function ensureBrotliInit(): void {
  if (brotliReady) return;

  const base64 = brotliWasmUrl.split(',')[1];
  if (!base64) {
    throw new Error('Invalid brotli wasm data URL');
  }

  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }

  initSync(new WebAssembly.Module(bytes.buffer));
  brotliReady = true;
}

/**
 * 检测 URL 是否为压缩的 GLB data URL
 */
export function isCompressedGlb(url: string): boolean {
  return url.startsWith(`data:${COMPRESSED_GLB_MIME}`);
}

/**
 * 解压 Brotli 压缩的 data URL，返回普通的 GLB data URL
 *
 * @param compressedDataUrl 压缩后的 data URL (data:application/x-glb-brotli;base64,...)
 * @returns 解压后的 GLB data URL (data:model/gltf-binary;base64,...)
 */
export async function decompressGlbDataUrl(compressedDataUrl: string): Promise<string> {
  ensureBrotliInit();

  // 提取 base64 数据
  const base64Data = compressedDataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid compressed GLB data URL');
  }

  // Base64 解码为 Uint8Array
  const binaryString = atob(base64Data);
  const compressedBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    compressedBytes[i] = binaryString.charCodeAt(i);
  }

  const decompressedBytes = brotliDecompress(compressedBytes);

  // 转回 base64
  const decompressedBase64 = uint8ArrayToBase64(decompressedBytes);

  // 返回标准 GLB data URL
  return `data:model/gltf-binary;base64,${decompressedBase64}`;
}

/**
 * 解压 Brotli 压缩的 data URL，返回 Blob URL
 *
 * @param compressedDataUrl 压缩后的 data URL
 * @returns Blob URL (blob:...)
 */
export async function decompressGlbToBlobUrl(compressedDataUrl: string): Promise<string> {
  ensureBrotliInit();

  // 提取 base64 数据
  const base64Data = compressedDataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid compressed GLB data URL');
  }

  // Base64 解码
  const binaryString = atob(base64Data);
  const compressedBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    compressedBytes[i] = binaryString.charCodeAt(i);
  }

  const decompressedBytes = brotliDecompress(compressedBytes);

  // 创建 Blob URL
  const arrayBuffer = new Uint8Array(decompressedBytes).buffer as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
  return URL.createObjectURL(blob);
}

/**
 * Uint8Array 转 Base64（使用分块处理避免栈溢出）
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // 分块处理，避免 String.fromCharCode 栈溢出
  const chunkSize = 0x8000; // 32KB chunks
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }

  return btoa(chunks.join(''));
}

/**
 * 缓存已解压的 URL，避免重复解压
 */
const decompressedUrlCache = new Map<string, string>();

/**
 * 获取可用的 GLB URL（自动处理 Brotli 压缩格式）
 *
 * @param url 原始 URL（可能是压缩的 data URL）
 * @returns 可直接使用的 URL（压缩格式返回 blob URL）
 */
export async function getUsableGlbUrl(url: string): Promise<string> {
  // 非压缩格式直接返回
  if (!isCompressedGlb(url)) {
    return url;
  }

  // 检查缓存
  const cached = decompressedUrlCache.get(url);
  if (cached) {
    return cached;
  }

  // 解压并缓存。对大型 GLB 使用 blob URL 更稳，避免 Babylon/浏览器对超长 data URL 的解析问题。
  const blobUrl = await decompressGlbToBlobUrl(url);
  decompressedUrlCache.set(url, blobUrl);
  return blobUrl;
}

/**
 * 清理缓存的已解压 URL
 */
export function clearDecompressedCache(): void {
  for (const value of decompressedUrlCache.values()) {
    if (value.startsWith('blob:')) {
      URL.revokeObjectURL(value);
    }
  }
  decompressedUrlCache.clear();
}
