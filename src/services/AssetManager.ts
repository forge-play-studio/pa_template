import type {
  AssetExternalRef,
  Scale3D,
  SceneAssetConfig,
  SceneAssetMaterialMode,
} from '../config';
import sceneJsonV2Rules from '../config/scene-json-v2-rules.json';
import { projectAssetCatalogAdapter } from './assets/adapters/ProjectAssetCatalogAdapter';
import {
  buildAssetArgs,
  createSceneAsset,
  planAssetRegistrationCore,
  planAssetUnregistrationCore,
  type AssetManagerCoreRules,
  type AssetRegistrationPlanCore,
  type AssetTransportCommand,
  type AssetTransportPlan,
  type AssetTransportWrite,
  type AssetUnregistrationPlanCore,
  type ManagedAssetKind,
} from './assets/core/AssetManagerCore';

export interface AssetRegistrationPlanParams {
  requestId?: string;
  guid?: string;
  assetName?: string;
  assetPath?: string;
  assetUrl?: string;
  assetId?: string;
  kind?: ManagedAssetKind | string;
  assetType?: ManagedAssetKind | string;
  platformAssetId?: string;
  external?: AssetExternalRef;
  displayName?: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  defaultScale?: number | Scale3D;
  metadata?: Record<string, unknown>;
  payloadPath?: string;
}

export type AssetRegistrationPlan = AssetRegistrationPlanCore;

export interface AssetUnregistrationPlanParams {
  requestId?: string;
  guid?: string;
  assetId?: string;
  payloadPath?: string;
  deleteFile?: boolean;
}

export type AssetUnregistrationPlan = AssetUnregistrationPlanCore;

export interface AssetReferenceParams {
  guid?: string;
  assetId: string;
  assetName?: string;
  external?: AssetExternalRef;
  displayName?: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  defaultScale?: number | Scale3D;
  metadata?: Record<string, unknown>;
}

export interface AssetReference {
  guid: string;
  assetId: string;
  displayName: string;
  asset: SceneAssetConfig;
}

const ASSET_MANAGER_RULES: AssetManagerCoreRules = {
  metadata: sceneJsonV2Rules.assetManagerMetadata,
  errorCodes: sceneJsonV2Rules.errorCodes,
};

export const ASSET_MANAGER_ERROR_CODES = ASSET_MANAGER_RULES.errorCodes;
export type AssetManagerErrorCode = typeof ASSET_MANAGER_ERROR_CODES[keyof typeof ASSET_MANAGER_ERROR_CODES];
export type {
  AssetTransportCommand,
  AssetTransportPlan,
  AssetTransportWrite,
};

function getAssetCatalogSnapshot() {
  return {
    assets: projectAssetCatalogAdapter.getAssets(),
  };
}

export function planAssetRegistration(params: AssetRegistrationPlanParams): AssetRegistrationPlan {
  return planAssetRegistrationCore(getAssetCatalogSnapshot(), normalizeRegistrationParams(params), ASSET_MANAGER_RULES);
}

export function planAssetRegistrationWithAssets(
  assets: SceneAssetConfig[],
  params: AssetRegistrationPlanParams,
): AssetRegistrationPlan {
  return planAssetRegistrationCore({ assets }, normalizeRegistrationParams(params), ASSET_MANAGER_RULES);
}

export function planAssetUnregistration(params: AssetUnregistrationPlanParams): AssetUnregistrationPlan {
  return planAssetUnregistrationCore(params, ASSET_MANAGER_RULES);
}

export function resolveAssetReference(params: AssetReferenceParams): AssetReference {
  const assetArgs = buildAssetArgs(getAssetCatalogSnapshot(), params, ASSET_MANAGER_RULES);
  const asset = createSceneAsset(assetArgs, ASSET_MANAGER_RULES);
  if (!asset) {
    throw new Error(`Asset "${assetArgs.assetId}" is not a placeable model asset`);
  }
  return {
    guid: assetArgs.guid,
    assetId: assetArgs.assetId,
    displayName: assetArgs.displayName,
    asset,
  };
}

function normalizeRegistrationParams(params: AssetRegistrationPlanParams) {
  return {
    ...params,
    kind: params.kind ?? params.assetType,
  };
}
