import sceneJsonV2Rules from '../config/scene-json-v2-rules.json';
import { getProjectEditorWorkingDocument } from '../fps-game-editor-adapter/document';
import { AssetManagerError } from './assets/core/AssetManagerCore';

export interface SceneAssetUsage {
  assetId: string;
  nodeIds: string[];
}

export function findSceneAssetUsageByAssetId(assetId: string): SceneAssetUsage {
  const normalizedAssetId = assetId.trim();
  const workingCopy = getProjectEditorWorkingDocument();
  const nodes = Array.isArray(workingCopy.scene?.nodes) ? workingCopy.scene.nodes : [];
  const nodeIds = nodes
    .filter((node) => node.kind === 'instance' && node.instance?.assetId === normalizedAssetId)
    .map((node) => node.id);
  return {
    assetId: normalizedAssetId,
    nodeIds,
  };
}

export function assertSceneAssetUnused(assetId: string): void {
  const usage = findSceneAssetUsageByAssetId(assetId);
  if (usage.nodeIds.length === 0) return;
  throw new AssetManagerError(
    sceneJsonV2Rules.errorCodes.assetStillReferenced,
    `Asset id "${usage.assetId}" is still referenced by scene nodes`,
  );
}
