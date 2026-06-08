import type {
  AssetExternalRef,
  Scale3D,
  SceneAssetConfig,
  SceneAssetMaterialMode,
} from '../../../config';

export type ManagedAssetKind = 'model' | 'texture' | 'image' | 'sound';

export interface AssetManagerMetadataRule {
  key: string;
  value: unknown;
}

export interface AssetManagerErrorCodes {
  assetIdConflict: string;
  assetStillReferenced: string;
  missingAssetId: string;
  nodeNotFound: string;
  [key: string]: string;
}

export interface AssetManagerCoreRules {
  metadata: AssetManagerMetadataRule;
  errorCodes: AssetManagerErrorCodes;
}

export interface AssetIdentityInput {
  guid?: string;
  assetId?: string;
  kind?: ManagedAssetKind | string;
  assetName?: string;
  assetPath?: string;
  assetUrl?: string;
  external?: AssetExternalRef;
  platformAssetId?: string;
}

export interface AssetBuildInput extends AssetIdentityInput {
  displayName?: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  defaultScale?: number | Scale3D;
  metadata?: Record<string, unknown>;
}

export interface AssetBuildResult {
  guid: string;
  assetId: string;
  kind: ManagedAssetKind;
  displayName: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  metadata?: Record<string, unknown>;
  external?: AssetExternalRef;
}

export interface AssetRegistrationPlanInput extends AssetBuildInput {
  requestId?: string;
  payloadPath?: string;
  registerCommand?: string;
}

export interface AssetRegistrationPayload {
  sourcePath?: string;
  assetPath?: string;
  assetUrl?: string;
  guid: string;
  projectAssetId: string;
  assetType: ManagedAssetKind;
  assetName: string;
  displayName: string;
  category?: string;
  materialMode?: SceneAssetMaterialMode;
  scale?: number | Scale3D;
  metadata?: Record<string, unknown>;
  external?: AssetExternalRef;
  platformAssetId?: string;
}

export interface AssetTransportWrite {
  path: string;
  contentType: 'application/json' | 'text/plain';
  content: unknown;
}

export interface AssetTransportCommand {
  cmd: string;
  cwd?: string;
  timeoutMs?: number;
}

export interface AssetTransportPlan {
  writes: AssetTransportWrite[];
  commands: AssetTransportCommand[];
}

export interface AssetRegistrationPlanCore {
  requestId?: string;
  guid: string;
  assetId: string;
  kind: ManagedAssetKind;
  displayName: string;
  external?: AssetExternalRef;
  transportPlan: AssetTransportPlan;
  sceneAsset?: SceneAssetConfig;
}

export interface AssetUnregistrationPlanInput {
  requestId?: string;
  guid?: string;
  assetId?: string;
  payloadPath?: string;
  deleteFile?: boolean;
  unregisterCommand?: string;
}

export interface AssetUnregistrationPlanCore {
  requestId?: string;
  guid?: string;
  assetId: string;
  transportPlan: AssetTransportPlan;
}

export interface AssetCatalogSnapshot {
  assets: SceneAssetConfig[];
}

export class AssetManagerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AssetManagerError';
  }
}

export function createAssetGuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? createFallbackGuid();
}

export function guidToStableToken(guid: string): string {
  return guid.trim().toLowerCase().replace(/-/g, '');
}

export function createAssetId(kind: ManagedAssetKind, guid: string): string {
  const prefix = kind === 'model'
    ? 'asset'
    : kind === 'texture'
      ? 'texture'
      : kind === 'sound'
        ? 'sound'
        : 'image';
  return `${prefix}_${guidToStableToken(guid)}`;
}

export function sanitizeAssetName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .trim();
}

function createFallbackGuid(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (bytes.every((byte) => byte === 0)) {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeAssetKind(value: unknown, fallbackPath?: string): ManagedAssetKind {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'glb' || raw === 'gltf' || raw === 'model') return 'model';
  if (raw === 'texture' || raw === 'groundtexture' || raw === 'ground-texture') return 'texture';
  if (raw === 'image' || raw === 'img' || raw === 'ui') return 'image';
  if (raw === 'sound' || raw === 'audio') return 'sound';
  const path = String(fallbackPath ?? '').toLowerCase();
  if (/\.(glb|gltf)$/.test(path)) return 'model';
  if (/\.(mp3|wav|ogg|m4a)$/.test(path)) return 'sound';
  if (/\.(png|jpe?g|webp)$/.test(path)) return 'texture';
  return 'model';
}

function normalizeExternalRef(input: AssetIdentityInput): AssetExternalRef | undefined {
  const external = input.external && typeof input.external === 'object' ? input.external : {};
  const platformAssetId = readOptionalString(external.platformAssetId) ?? readOptionalString(input.platformAssetId);
  const assetPath = readOptionalString(external.assetPath) ?? readOptionalString(input.assetPath);
  const assetUrl = readOptionalString(external.assetUrl) ?? readOptionalString(input.assetUrl);
  if (!platformAssetId && !assetPath && !assetUrl) return undefined;
  return {
    ...(platformAssetId ? { platformAssetId } : {}),
    ...(assetPath ? { assetPath } : {}),
    ...(assetUrl ? { assetUrl } : {}),
  };
}

function findExistingAsset(snapshot: AssetCatalogSnapshot, input: AssetIdentityInput): SceneAssetConfig | undefined {
  const guid = readOptionalString(input.guid);
  const assetId = readOptionalString(input.assetId);
  const external = normalizeExternalRef(input);
  return snapshot.assets.find((asset) => {
    if (guid && asset.guid === guid) return true;
    if (assetId && asset.id === assetId) return true;
    if (external?.platformAssetId && asset.external?.platformAssetId === external.platformAssetId) return true;
    if (external?.assetPath && asset.external?.assetPath === external.assetPath) return true;
    return false;
  });
}

export function resolveAssetIdentity(
  snapshot: AssetCatalogSnapshot,
  params: AssetIdentityInput,
  rules: AssetManagerCoreRules,
): { guid: string; assetId: string; kind: ManagedAssetKind; external?: AssetExternalRef } {
  const kind = normalizeAssetKind(params.kind, params.assetPath ?? params.assetName);
  const requestedGuid = readOptionalString(params.guid);
  const requestedAssetId = readOptionalString(params.assetId);
  const external = normalizeExternalRef(params);
  const existing = findExistingAsset(snapshot, params);
  if (existing && requestedGuid && existing.guid && existing.guid !== requestedGuid) {
    throw new AssetManagerError(
      rules.errorCodes.assetIdConflict,
      `Requested guid "${requestedGuid}" does not match existing asset guid "${existing.guid}"`,
    );
  }
  const guid = existing?.guid ?? requestedGuid ?? createAssetGuid();
  const assetId = createAssetId(kind, guid);

  if (existing?.id && existing.id !== assetId) {
    throw new AssetManagerError(
      rules.errorCodes.assetIdConflict,
      `Asset id "${existing.id}" does not match guid "${guid}" (expected "${assetId}")`,
    );
  }
  if (requestedAssetId && requestedAssetId !== assetId) {
    throw new AssetManagerError(
      rules.errorCodes.assetIdConflict,
      `Project asset id "${requestedAssetId}" does not match guid "${guid}" (expected "${assetId}")`,
    );
  }

  const conflictingAsset = snapshot.assets.find((asset) => asset.id === assetId && asset.guid && asset.guid !== guid);
  if (conflictingAsset) {
    throw new AssetManagerError(
      rules.errorCodes.assetIdConflict,
      `Asset id "${assetId}" already points to guid "${conflictingAsset.guid}"`,
    );
  }

  return {
    guid,
    assetId,
    kind,
    ...(external ? { external } : existing?.external ? { external: existing.external } : {}),
  };
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readScale(value: unknown): number | Scale3D | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const x = readNumber(record.x);
  const y = readNumber(record.y);
  const z = readNumber(record.z);
  if (x == null || y == null || z == null || x <= 0 || y <= 0 || z <= 0) return undefined;
  return { x, y, z };
}

export function buildAssetArgs(
  snapshot: AssetCatalogSnapshot,
  params: AssetBuildInput,
  rules: AssetManagerCoreRules,
): AssetBuildResult {
  const identity = resolveAssetIdentity(snapshot, params, rules);
  const displayName = params.displayName?.trim()
    || sanitizeAssetName(params.assetName)
    || sanitizeAssetName(params.assetPath?.split('/').pop())
    || 'Imported Asset';
  const category = params.category?.trim();
  const materialMode = readMaterialMode(params.materialMode);
  const scale = readScale(params.defaultScale ?? params.scale);
  const metadata = readMetadata(params.metadata);
  return {
    ...identity,
    displayName,
    ...(category ? { category } : {}),
    ...(materialMode ? { materialMode } : {}),
    ...(scale ? { scale } : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export function createSceneAsset(args: AssetBuildResult, rules: AssetManagerCoreRules): SceneAssetConfig | undefined {
  if (args.kind !== 'model') return undefined;
  return {
    id: args.assetId,
    guid: args.guid,
    type: 'glb',
    displayName: args.displayName,
    ...(args.category ? { category: args.category } : {}),
    ...(args.materialMode ? { materialMode: args.materialMode } : {}),
    ...(args.scale ? { defaults: { transform: { scale: args.scale } } } : {}),
    ...(args.external ? { external: args.external } : {}),
    metadata: {
      ...(args.metadata ?? {}),
      [rules.metadata.key]: rules.metadata.value,
    },
  };
}

export function planAssetRegistrationCore(
  snapshot: AssetCatalogSnapshot,
  params: AssetRegistrationPlanInput,
  rules: AssetManagerCoreRules,
): AssetRegistrationPlanCore {
  const assetName = params.assetName || params.assetPath?.split('/').pop() || 'imported_asset.glb';
  const assetArgs = buildAssetArgs(
    snapshot,
    {
      ...params,
      assetName,
    },
    rules,
  );
  const requestId = params.requestId;
  const payloadPath = params.payloadPath ?? `/tmp/forge-play-asset-${requestId ?? assetArgs.assetId}.json`;
  const sceneAsset = createSceneAsset(assetArgs, rules);
  const registerCommand = params.registerCommand ?? 'npm run asset:register';
  const payload: AssetRegistrationPayload = {
    ...(params.assetPath ? { sourcePath: params.assetPath, assetPath: params.assetPath } : {}),
    ...(params.assetUrl ? { assetUrl: params.assetUrl } : {}),
    guid: assetArgs.guid,
    projectAssetId: assetArgs.assetId,
    assetType: assetArgs.kind,
    assetName,
    displayName: assetArgs.displayName,
    ...(assetArgs.category ? { category: assetArgs.category } : {}),
    ...(assetArgs.materialMode ? { materialMode: assetArgs.materialMode } : {}),
    ...(assetArgs.scale ? { scale: assetArgs.scale } : {}),
    ...(assetArgs.metadata ? { metadata: assetArgs.metadata } : {}),
    ...(assetArgs.external ? { external: assetArgs.external } : {}),
    ...(assetArgs.external?.platformAssetId ? { platformAssetId: assetArgs.external.platformAssetId } : {}),
  };
  const script = `${registerCommand} -- --payload ${payloadPath}`;

  return {
    ...(requestId ? { requestId } : {}),
    guid: assetArgs.guid,
    assetId: assetArgs.assetId,
    kind: assetArgs.kind,
    displayName: assetArgs.displayName,
    ...(assetArgs.external ? { external: assetArgs.external } : {}),
    transportPlan: {
      writes: [
        {
          path: payloadPath,
          contentType: 'application/json',
          content: payload,
        },
      ],
      commands: [
        {
          cmd: script,
          cwd: '.',
          timeoutMs: 60000,
        },
      ],
    },
    ...(sceneAsset ? { sceneAsset } : {}),
  };
}

export function planAssetUnregistrationCore(
  params: AssetUnregistrationPlanInput,
  rules: AssetManagerCoreRules,
): AssetUnregistrationPlanCore {
  const assetId = readOptionalString(params.assetId);
  const guid = readOptionalString(params.guid);
  if (!assetId && !guid) {
    throw new AssetManagerError(rules.errorCodes.missingAssetId ?? 'missing_asset_id', 'Missing assetId or guid for asset unregistration');
  }
  const requestId = params.requestId;
  const payloadPath = params.payloadPath ?? `/tmp/forge-play-asset-unregister-${requestId ?? assetId ?? guid}.json`;
  const deleteFile = params.deleteFile !== false;
  const unregisterCommand = params.unregisterCommand ?? 'npm run asset:unregister';
  const payload = {
    ...(assetId ? { assetId } : {}),
    ...(guid ? { guid } : {}),
    deleteFile,
  };
  const script = `${unregisterCommand} -- --payload ${payloadPath}`;
  return {
    ...(requestId ? { requestId } : {}),
    ...(guid ? { guid } : {}),
    assetId: assetId ?? '',
    transportPlan: {
      writes: [
        {
          path: payloadPath,
          contentType: 'application/json',
          content: payload,
        },
      ],
      commands: [
        {
          cmd: script,
          cwd: '.',
          timeoutMs: 60000,
        },
      ],
    },
  };
}

function readMaterialMode(value: unknown): SceneAssetMaterialMode | undefined {
  return value === 'shared' || value === 'instance' ? value : undefined;
}

function readMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
