import type { AssetExternalRef } from '../config';
import type {
  EditorSceneAsset,
  EditorSceneAssetLibraryItem,
  EditorSceneDocument,
} from './editor-scene-document';

export interface ProjectEditorAssetCatalogEntry {
  guid: string;
  assetId: string;
  kind: 'model' | 'texture' | 'image' | 'sound';
  displayName: string;
  relativePath: string;
  originalFileName?: string;
  codeKey?: string;
  placeable?: boolean;
  contentHash?: string;
  byteSize?: number;
  external?: AssetExternalRef;
}

export function createProjectEditorAssetLibrary(
  catalogEntries: ProjectEditorAssetCatalogEntry[],
): EditorSceneAssetLibraryItem[] {
  return catalogEntries
    .filter((entry) => (entry.kind === 'model' || entry.kind === 'texture') && entry.placeable !== false)
    .map(createProjectEditorAssetLibraryItem)
    .sort(compareEditorAssetLibraryItems);
}

export function enrichEditorSceneDocumentAssets(
  editorScene: EditorSceneDocument,
  assetLibrary: EditorSceneAssetLibraryItem[],
): EditorSceneDocument {
  const libraryByAssetId = new Map(assetLibrary
    .filter((asset) => asset.type === 'glb')
    .map((asset) => [asset.assetId, asset]));
  return {
    ...editorScene,
    assets: editorScene.assets.map((asset) => {
      const libraryItem = libraryByAssetId.get(asset.id);
      return libraryItem ? mergeEditorSceneAssetWithLibraryItem(asset, libraryItem) : asset;
    }),
  };
}

export function mergeEditorSceneAssetWithLibraryItem(
  asset: EditorSceneAsset,
  libraryItem: EditorSceneAssetLibraryItem,
): EditorSceneAsset {
  return {
    ...asset,
    guid: libraryItem.guid ?? asset.guid,
    displayName: libraryItem.displayName || asset.displayName,
    category: libraryItem.category ?? asset.category,
    materialMode: libraryItem.materialMode ?? asset.materialMode,
    defaults: cloneOptional(libraryItem.defaults ?? asset.defaults),
    external: cloneOptional(libraryItem.external ?? asset.external),
    metadata: cloneOptional(libraryItem.metadata ?? asset.metadata),
  };
}

function createProjectEditorAssetLibraryItem(entry: ProjectEditorAssetCatalogEntry): EditorSceneAssetLibraryItem {
  const type = entry.kind === 'texture' ? 'texture' : 'glb';
  return {
    id: entry.assetId,
    guid: entry.guid,
    assetId: entry.assetId,
    type,
    kind: entry.kind === 'texture' ? 'texture' : 'model',
    displayName: entry.displayName,
    category: inferEditorAssetCategory(entry),
    external: cloneOptional(entry.external),
    metadata: {
      originalFileName: entry.originalFileName,
      relativePath: entry.relativePath,
      codeKey: entry.codeKey,
      contentHash: entry.contentHash,
      byteSize: entry.byteSize,
    },
    origin: 'project',
    dedupeKey: entry.guid || entry.external?.platformAssetId || entry.assetId,
    placeable: entry.placeable !== false,
  };
}

function compareEditorAssetLibraryItems(a: EditorSceneAssetLibraryItem, b: EditorSceneAssetLibraryItem): number {
  return (a.category ?? '').localeCompare(b.category ?? '')
    || a.displayName.localeCompare(b.displayName)
    || a.assetId.localeCompare(b.assetId)
    || a.type.localeCompare(b.type);
}

function inferEditorAssetCategory(entry: ProjectEditorAssetCatalogEntry): string {
  if (entry.kind === 'texture') return 'Texture';
  if (entry.kind === 'image') return 'Image';
  if (entry.kind === 'sound') return 'Sound';
  return 'Model';
}

function cloneOptional<T>(value: T | undefined): T | undefined {
  return value == null ? undefined : structuredClone(value);
}
