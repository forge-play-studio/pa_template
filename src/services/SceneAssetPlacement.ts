import type {
  Position3D,
  Scale3D,
  SceneInstanceNode,
  SceneNodeConfig,
  TransformConfig,
} from '../config';
import type { ProjectEditorPluginContext } from '../fps-game-editor-adapter/types';
import {
  ASSET_MANAGER_ERROR_CODES,
  resolveAssetReference,
  type AssetReferenceParams,
} from './AssetManager';
import { babylonRuntimeAssetAdapter } from './assets/adapters/BabylonRuntimeAssetAdapter';
import { projectSceneDocumentAdapter } from './assets/adapters/ProjectSceneDocumentAdapter';
import {
  AssetManagerError,
  readScale,
  sanitizeAssetName,
} from './assets/core/AssetManagerCore';

export interface AssetInstanceCreateParams extends AssetReferenceParams {
  requestId?: string;
  assetUrl?: string;
  instanceScale?: number | Scale3D;
  dropSurfaceName?: string;
  clientX?: number;
  clientY?: number;
  position?: Position3D;
}

export interface AssetInstancePlacementResult {
  requestId?: string;
  ok: boolean;
  guid?: string;
  assetId: string;
  nodeId?: string;
  rootNode?: any | null;
  code?: string;
  error?: string;
}

export async function createAssetInstance(
  params: AssetInstanceCreateParams,
  context?: ProjectEditorPluginContext,
): Promise<AssetInstancePlacementResult> {
  const requestedAssetId = params.assetId?.trim() ?? '';
  try {
    const assetReference = resolveAssetReference({
      assetId: params.assetId,
      guid: params.guid,
      assetName: params.assetName,
      external: params.external,
      displayName: params.displayName,
      category: params.category,
      materialMode: params.materialMode,
      scale: params.scale,
      defaultScale: params.defaultScale,
      metadata: params.metadata,
    });
    const nodeId = createUniqueNodeId(projectSceneDocumentAdapter.getNodes(), assetReference.displayName, assetReference.assetId);
    const position = babylonRuntimeAssetAdapter.resolveDropPosition(params, context);
    const node = createInstanceNode({
      nodeId,
      assetId: assetReference.assetId,
      displayName: assetReference.displayName,
      position,
      instanceScale: readScale(params.instanceScale),
    });

    await babylonRuntimeAssetAdapter.prepareRuntimeAsset(assetReference.asset, params.assetUrl, context);
    const added = projectSceneDocumentAdapter.addAssetNode({ asset: assetReference.asset, node }, context);
    return {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      ok: true,
      guid: assetReference.guid,
      assetId: assetReference.assetId,
      nodeId: added.node.id,
      rootNode: added.rootNode,
    };
  } catch (error) {
    return {
      ...(params.requestId ? { requestId: params.requestId } : {}),
      ok: false,
      ...(params.guid ? { guid: params.guid } : {}),
      assetId: requestedAssetId,
      ...(error instanceof AssetManagerError ? { code: error.code } : {}),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function removeAssetInstance(
  nodeId: string,
  context?: ProjectEditorPluginContext,
): AssetInstancePlacementResult {
  const removed = projectSceneDocumentAdapter.removeSceneNode(nodeId, context);
  return {
    ok: Boolean(removed),
    assetId: '',
    nodeId,
    ...(removed ? {} : { code: ASSET_MANAGER_ERROR_CODES.nodeNotFound, error: ASSET_MANAGER_ERROR_CODES.nodeNotFound }),
  };
}

function createUniqueNodeId(nodes: SceneNodeConfig[], displayName: string, assetId: string): string {
  const used = new Set(nodes.map((node) => node.id));
  const base = sanitizeAssetName(displayName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || assetId;
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

function createInstanceNode(args: {
  nodeId: string;
  assetId: string;
  displayName: string;
  position: Position3D;
  instanceScale?: number | Scale3D;
}): SceneInstanceNode {
  const transform: TransformConfig = {
    position: args.position,
    rotation: { x: 0, y: 0, z: 0 },
    ...(args.instanceScale ? { scale: args.instanceScale } : {}),
  };
  return {
    id: args.nodeId,
    name: args.displayName,
    kind: 'instance',
    instance: {
      assetId: args.assetId,
    },
    transform,
  };
}
