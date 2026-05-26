import type { SceneAssetConfig } from '../../../config';
import { getProjectEditorWorkingDocument } from '../../../fps-game-editor-adapter/document';

export interface ProjectAssetCatalogAdapter {
  getAssets(): SceneAssetConfig[];
}

export const projectAssetCatalogAdapter: ProjectAssetCatalogAdapter = {
  getAssets() {
    const workingCopy = getProjectEditorWorkingDocument();
    return Array.isArray(workingCopy.scene?.assets) ? workingCopy.scene.assets : [];
  },
};
