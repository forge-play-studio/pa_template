import type { AssetExternalRef } from '../config';
import {
  createEditorSceneAssetLibrary as createPlayableEditorSceneAssetLibrary,
  enrichEditorSceneDocumentAssets as enrichPlayableEditorSceneDocumentAssets,
  mergeEditorSceneAssetWithLibraryItem as mergePlayableEditorSceneAssetWithLibraryItem,
  type EditorSceneAssetCatalogEntry as PlayableEditorSceneAssetCatalogEntry,
} from '@fps-games/editor/playable-sdk';
import type {
  EditorSceneAsset,
  EditorSceneAssetLibraryItem,
  EditorSceneDocument,
} from './editor-scene-document';

export interface ProjectEditorAssetCatalogEntry extends PlayableEditorSceneAssetCatalogEntry<AssetExternalRef> {
  guid: string;
  assetId: string;
  kind: 'model' | 'prefab' | 'texture' | 'image' | 'sound';
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
  return createPlayableEditorSceneAssetLibrary(catalogEntries) as EditorSceneAssetLibraryItem[];
}

export function enrichEditorSceneDocumentAssets(
  editorScene: EditorSceneDocument,
  assetLibrary: EditorSceneAssetLibraryItem[],
): EditorSceneDocument {
  return enrichPlayableEditorSceneDocumentAssets(editorScene, assetLibrary) as EditorSceneDocument;
}

export function mergeEditorSceneAssetWithLibraryItem(
  asset: EditorSceneAsset,
  libraryItem: EditorSceneAssetLibraryItem,
): EditorSceneAsset {
  return mergePlayableEditorSceneAssetWithLibraryItem(asset, libraryItem) as EditorSceneAsset;
}
