/**
 * 资源管理模块 (Scaffold)
 *
 * 项目内资产以 GUID 派生的 canonical assetId 作为运行时身份。
 * 文件名只作为 displayName/originalFileName，不参与系统 ID 生成。
 */

import {
  ASSET_IDS,
  GENERATED_ASSET_CATALOG,
  GENERATED_ASSET_URL_MAP,
  GENERATED_IMAGE_ASSET_URL_MAP,
  GENERATED_MODEL_ASSET_URL_MAP,
  GENERATED_SOUND_ASSET_URL_MAP,
  GENERATED_TEXTURE_ASSET_URL_MAP,
  type GeneratedAssetCatalogEntry,
  type GeneratedAssetCatalogKind,
} from './generated/asset-catalog.generated';
import blankPng from './placeholders/blank.png?url';
import { isCompressedGlb, getUsableGlbUrl } from '../utils/glbDecompress';

export type AssetCatalogKind = GeneratedAssetCatalogKind;
export type AssetCatalogEntry = GeneratedAssetCatalogEntry;

export { ASSET_IDS };

export const ASSET_CATALOG: Record<string, AssetCatalogEntry> = Object.fromEntries(
  Object.entries(GENERATED_ASSET_CATALOG).map(([assetId, entry]) => [
    assetId,
    entry.kind === 'model'
      ? { ...entry, materialMode: entry.materialMode ?? 'shared' }
      : entry,
  ]),
);
export const ASSET_URL_MAP: Record<string, string> = GENERATED_ASSET_URL_MAP;
export const MODEL_ASSET_URL_MAP: Record<string, string> = GENERATED_MODEL_ASSET_URL_MAP;
export const TEXTURE_ASSET_URL_MAP: Record<string, string> = GENERATED_TEXTURE_ASSET_URL_MAP;
export const IMAGE_ASSET_URL_MAP: Record<string, string> = GENERATED_IMAGE_ASSET_URL_MAP;
export const SOUND_ASSET_URL_MAP: Record<string, string> = GENERATED_SOUND_ASSET_URL_MAP;

export function resolveAssetUrl(assetId: string): string | undefined {
  return ASSET_URL_MAP[assetId];
}

export function resolveModelAssetUrl(assetId: string): string | undefined {
  return MODEL_ASSET_URL_MAP[assetId];
}

export function resolveTextureAssetUrl(assetId: string): string | undefined {
  return TEXTURE_ASSET_URL_MAP[assetId];
}

export function resolveImageAssetUrl(assetId: string): string | undefined {
  return IMAGE_ASSET_URL_MAP[assetId];
}

export function resolveSoundAssetUrl(assetId: string): string | undefined {
  return SOUND_ASSET_URL_MAP[assetId];
}

export function getAssetCatalogEntries(filter?: { kind?: AssetCatalogKind; placeable?: boolean }): AssetCatalogEntry[] {
  return Object.values(ASSET_CATALOG).filter((entry) => {
    if (filter?.kind && entry.kind !== filter.kind) return false;
    if (typeof filter?.placeable === 'boolean' && entry.placeable !== filter.placeable) return false;
    return true;
  });
}

export function getModelAssetIds(filter?: { placeable?: boolean }): string[] {
  return getAssetCatalogEntries({ kind: 'model', placeable: filter?.placeable }).map((entry) => entry.assetId);
}

export function getTextureAssetIds(filter?: { placeable?: boolean }): string[] {
  return getAssetCatalogEntries({ kind: 'texture', placeable: filter?.placeable }).map((entry) => entry.assetId);
}

export function getImageAssetIds(filter?: { placeable?: boolean }): string[] {
  return getAssetCatalogEntries({ kind: 'image', placeable: filter?.placeable }).map((entry) => entry.assetId);
}

export function getSoundAssetIds(filter?: { placeable?: boolean }): string[] {
  return getAssetCatalogEntries({ kind: 'sound', placeable: filter?.placeable }).map((entry) => entry.assetId);
}

export function isModelAssetRegistered(assetId: string): boolean {
  return Boolean(MODEL_ASSET_URL_MAP[assetId]);
}

export function isTextureAssetRegistered(assetId: string): boolean {
  return Boolean(TEXTURE_ASSET_URL_MAP[assetId]);
}

export function isImageAssetRegistered(assetId: string): boolean {
  return Boolean(IMAGE_ASSET_URL_MAP[assetId]);
}

export function isSoundAssetRegistered(assetId: string): boolean {
  return Boolean(SOUND_ASSET_URL_MAP[assetId]);
}

export const UIImages: Record<string, string> = {
  blank: blankPng,
  gameLogo: blankPng,
  particleSpark: blankPng,
  particleSoft: blankPng,
};

export const TextureAssets = {
  ui: {
    gameLogo: blankPng,
  },
  ground: {
    ...TEXTURE_ASSET_URL_MAP,
  },
};

export interface ModelPathInfo {
  path: string;
  filename: string;
  isDataUrl: boolean;
  isCompressed: boolean;
}

export async function getModelPathAndFileAsync(url: string): Promise<ModelPathInfo> {
  if (isCompressedGlb(url)) {
    const usableUrl = await getUsableGlbUrl(url);
    return splitUrlToPathAndFile(usableUrl, true);
  }

  if (url.startsWith('data:')) {
    return {
      path: '',
      filename: url,
      isDataUrl: true,
      isCompressed: false,
    };
  }

  return splitUrlToPathAndFile(url, false);
}

function splitUrlToPathAndFile(url: string, isCompressed: boolean): ModelPathInfo {
  const idx = url.lastIndexOf('/');
  if (idx === -1) {
    return {
      path: '',
      filename: url,
      isDataUrl: false,
      isCompressed,
    };
  }

  return {
    path: url.slice(0, idx + 1),
    filename: url.slice(idx + 1),
    isDataUrl: false,
    isCompressed,
  };
}
