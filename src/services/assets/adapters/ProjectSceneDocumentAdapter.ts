import type { SceneAssetConfig, SceneInstanceNode, SceneNodeConfig } from '../../../config';
import {
  addProjectEditorAssetNode,
  getProjectEditorWorkingDocument,
  removeProjectEditorSceneNode,
} from '../../../fps-game-editor-adapter/document';
import type { ProjectEditorPluginContext } from '../../../fps-game-editor-adapter/types';

export interface ProjectSceneDocumentAdapter {
  getNodes(): SceneNodeConfig[];
  addAssetNode(
    args: { asset: SceneAssetConfig; node: SceneInstanceNode },
    context?: ProjectEditorPluginContext,
  ): { node: SceneInstanceNode; asset: SceneAssetConfig; rootNode: any | null };
  removeSceneNode(
    nodeId: string,
    context?: ProjectEditorPluginContext,
  ): { node: SceneNodeConfig; selectedRootNode: null } | null;
}

export const projectSceneDocumentAdapter: ProjectSceneDocumentAdapter = {
  getNodes() {
    const workingCopy = getProjectEditorWorkingDocument();
    return Array.isArray(workingCopy.scene?.nodes) ? workingCopy.scene.nodes : [];
  },

  addAssetNode(args, context) {
    return addProjectEditorAssetNode(args, context);
  },

  removeSceneNode(nodeId, context) {
    return removeProjectEditorSceneNode(nodeId, context);
  },
};
