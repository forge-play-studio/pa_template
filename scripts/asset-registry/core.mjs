import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';

export const ASSET_CATALOG_KINDS = ['model', 'texture', 'image', 'sound'];

const MODEL_EXTENSIONS = ['.glb', '.gltf'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const ENVIRONMENT_TEXTURE_EXTENSIONS = ['.env', '.hdr', '.dds', '.ktx', '.ktx2'];
const TEXTURE_EXTENSIONS = [...IMAGE_EXTENSIONS, ...ENVIRONMENT_TEXTURE_EXTENSIONS];
const SOUND_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'];
const DEFAULT_EXTENSIONS = [...MODEL_EXTENSIONS, ...TEXTURE_EXTENSIONS, ...SOUND_EXTENSIONS];

export function guidToStableToken(guid) {
  return String(guid ?? '').trim().toLowerCase().replace(/-/g, '');
}

export function createAssetGuid() {
  return crypto.randomUUID();
}

export function createAssetId(kind, guid) {
  const token = guidToStableToken(guid);
  const prefix = kind === 'model'
    ? 'asset'
    : kind === 'texture'
      ? 'texture'
      : kind === 'sound'
        ? 'sound'
        : 'image';
  return `${prefix}_${token}`;
}

export function toImportName(value) {
  const raw = String(value ?? '').trim();
  const segments = raw.split(/[^a-zA-Z0-9_$]+/).filter(Boolean);
  const camel = segments
    .map((segment, index) => index === 0
      ? segment
      : `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join('');
  const safe = camel.replace(/[^a-zA-Z0-9_$]/g, '') || 'assetUrl';
  return /^[a-zA-Z_$]/.test(safe) ? safe : `asset${safe}`;
}

export function normalizeAssetKind(value, filePath = '') {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'glb' || raw === 'gltf' || raw === 'model') return 'model';
  if (raw === 'groundtexture' || raw === 'ground-texture' || raw === 'texture') return 'texture';
  if (raw === 'ui' || raw === 'image' || raw === 'img') return 'image';
  if (raw === 'audio' || raw === 'sound') return 'sound';

  const extension = path.extname(filePath).toLowerCase();
  if (MODEL_EXTENSIONS.includes(extension)) return 'model';
  if (SOUND_EXTENSIONS.includes(extension)) return 'sound';
  if (TEXTURE_EXTENSIONS.includes(extension)) return 'texture';
  return null;
}

export function stripKnownAssetExtension(value) {
  let raw = String(value ?? '').trim();
  const lower = raw.toLowerCase();
  for (const extension of [...DEFAULT_EXTENSIONS].sort((a, b) => b.length - a.length)) {
    if (lower.endsWith(extension)) {
      raw = raw.slice(0, -extension.length);
      break;
    }
  }
  return raw;
}

export function normalizeDisplayName(value, fallback) {
  const displayName = String(value ?? '').trim() || stripKnownAssetExtension(fallback);
  return displayName || 'Asset';
}

export function normalizeCodeKey(value, fallback) {
  const raw = stripKnownAssetExtension(value || fallback)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  return raw || null;
}

export async function runAssetRegistryCli(config, argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const rules = await config.loadRules();
  const errorCodes = rules.errorCodes ?? {};
  const fail = (message, details = {}) => {
    const error = { ok: false, error: message, ...details };
    process.stderr.write(`${JSON.stringify(error, null, 2)}\n`);
    process.exit(1);
  };

  try {
    if (args.help) {
      process.stdout.write([
        'Usage:',
        `  ${config.commands.register} -- --payload /path/to/payload.json`,
        `  ${config.commands.unregister} -- --payload /path/to/payload.json`,
        `  ${config.commands.unregister} -- --asset-id asset_xxx [--keep-file] [--force]`,
        `  ${config.commands.unregister} -- --guid xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx [--keep-file] [--force]`,
        '',
      ].join('\n'));
      return;
    }
    if (args.unregister) {
      const result = await unregisterAsset(config, args, errorCodes);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return;
    }
    const result = await registerAsset(config, args, errorCodes);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    if (error instanceof AssetRegistryError) {
      fail(error.message, error.details);
    }
    fail('asset_register_failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function registerAsset(config, args, errorCodes = {}) {
  if (!args.payload) throw new AssetRegistryError('missing_payload_arg');
  const payload = await loadPayload(config, args);
  const sourcePath = path.resolve(config.cwd, String(payload.sourcePath ?? payload.assetPath ?? ''));
  const sourceExtension = resolveSourceExtension(config, sourcePath);
  if (!sourceExtension) {
    throw new AssetRegistryError(config.unsupportedSourceErrorCode ?? errorCodes.sourceMustBeSupportedAsset ?? 'source_must_be_supported_asset', {
      sourcePath,
      supportedExtensions: normalizeSupportedExtensions(config),
    });
  }
  try {
    await fs.access(sourcePath);
  } catch {
    throw new AssetRegistryError(errorCodes.sourceFileNotFound ?? 'source_file_not_found', { sourcePath });
  }

  await fs.mkdir(config.generatedDir, { recursive: true });

  const manifest = await loadManifest(config);
  const audit = await getFileAudit(sourcePath);
  const kind = normalizeAssetKind(payload.kind ?? payload.assetKind ?? payload.assetType, sourcePath);
  if (!kind) {
    throw new AssetRegistryError('unsupported_asset_kind', { sourcePath, assetType: payload.assetType });
  }
  assertAssetKindExtension(kind, sourcePath, 'source_path');

  const originalFileName = String(payload.assetName ?? path.basename(sourcePath));
  const existing = findReusableCatalogEntry(manifest, payload, sourcePath, audit, kind);
  const requestedGuid = readOptionalString(payload.guid);
  if (existing && requestedGuid && existing.guid !== requestedGuid) {
    throw new AssetRegistryError('payload_guid_must_match_existing_asset', {
      guid: requestedGuid,
      existingGuid: existing.guid,
      existingAssetId: existing.assetId,
    });
  }
  const guid = existing?.guid ?? requestedGuid ?? createAssetGuid();
  const requestedProjectAssetId = readOptionalString(payload.projectAssetId);
  const assetId = createAssetId(kind, guid);
  if (existing?.assetId && existing.assetId !== assetId) {
    throw new AssetRegistryError('manifest_asset_id_must_match_guid', {
      guid,
      assetId: existing.assetId,
      expectedAssetId: assetId,
    });
  }
  if (requestedProjectAssetId && requestedProjectAssetId !== assetId) {
    throw new AssetRegistryError('project_asset_id_must_match_guid', {
      guid,
      projectAssetId: requestedProjectAssetId,
      expectedAssetId: assetId,
    });
  }
  const targetFileName = `${assetId}${sourceExtension}`;
  const targetRelativePath = resolveTargetRelativePath(config, {
    existing,
    sourcePath,
    kind,
    targetFileName,
  });
  const targetPath = resolveCatalogAssetPath(config, targetRelativePath, kind, 'target_path');
  const now = new Date().toISOString();

  let copiedNewTarget = false;
  let registeredEntry = null;
  try {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const targetMatchesSource = isSamePath(sourcePath, targetPath);
    const targetExists = targetMatchesSource || await fileExists(targetPath);
    const targetNeedsRefresh = !existing || existing.contentHash !== audit.contentHash || !targetExists;
    const shouldCopy = !targetMatchesSource && targetNeedsRefresh;
    if (shouldCopy) {
      await fs.copyFile(sourcePath, targetPath);
      copiedNewTarget = !existing;
    }

    const nextEntry = normalizeManifestEntry({
      ...(existing ?? {}),
      guid,
      assetId,
      kind,
      displayName: normalizeDisplayName(payload.displayName, originalFileName),
      relativePath: targetRelativePath,
      originalFileName,
      codeKey: normalizeCodeKey(payload.codeKey ?? payload.assetName, originalFileName),
      placeable: payload.placeable === false ? false : (kind === 'model' || kind === 'texture'),
      contentHash: audit.contentHash,
      byteSize: audit.byteSize,
      external: normalizeExternalRef(payload.external ?? {
        platformAssetId: payload.platformAssetId ?? payload.assetId,
        assetPath: payload.assetPath,
        assetUrl: payload.assetUrl,
      }),
      metadata: await resolveManifestEntryMetadata(config, {
        existing,
        payload,
        sourcePath,
        targetPath,
        kind,
        guid,
        assetId,
      }),
      createdAt: existing?.createdAt ?? now,
      updatedAt: targetNeedsRefresh ? now : (existing?.updatedAt ?? now),
    });
    if (!nextEntry) throw new AssetRegistryError('invalid_manifest_entry', { assetId, guid });
    registeredEntry = nextEntry;

    const existingIndex = manifest.findIndex((entry) => entry.guid === guid || entry.assetId === assetId);
    if (existingIndex >= 0) manifest[existingIndex] = nextEntry;
    else manifest.push(nextEntry);
    manifest.sort(compareCatalogEntries);

    await writeGeneratedRegistry(config, manifest, errorCodes);
  } catch (error) {
    if (copiedNewTarget) {
      await fs.rm(targetPath, { force: true }).catch(() => {});
    }
    throw error;
  }

  return {
    ok: true,
    guid,
    assetId,
    kind,
    ...(registeredEntry?.external ? { external: registeredEntry.external } : {}),
    displayName: registeredEntry?.displayName,
    originalFileName: registeredEntry?.originalFileName,
    assetUrl: publicUrlForCatalogRelativePath(config, targetRelativePath, kind),
    targetPath,
    manifestPath: config.manifestPath,
    registryPath: config.registryPath,
  };
}

export async function unregisterAsset(config, args, errorCodes = {}) {
  const payload = await loadPayload(config, args);
  const assetId = readOptionalString(args.assetId ?? payload?.assetId);
  const guid = readOptionalString(args.guid ?? payload?.guid);
  if (!assetId && !guid) {
    throw new AssetRegistryError(errorCodes.missingAssetId ?? 'missing_asset_id');
  }
  const deleteFile = resolveDeleteFile(args, payload);
  const force = resolveForce(args, payload);

  await fs.mkdir(config.generatedDir, { recursive: true });
  const manifest = await loadManifest(config);
  const entryIndex = manifest.findIndex((entry) => (assetId && entry.assetId === assetId) || (guid && entry.guid === guid));
  if (entryIndex < 0) {
    throw new AssetRegistryError(errorCodes.manifestEntryNotFound ?? 'manifest_entry_not_found', {
      assetId,
      guid,
      manifestPath: config.manifestPath,
    });
  }

  const entry = manifest[entryIndex];
  await assertAssetCanBeUnregistered(config, entry.assetId, force, errorCodes);
  manifest.splice(entryIndex, 1);

  let deletedFile = false;
  let targetPath = null;
  if (deleteFile) {
    targetPath = resolveCatalogAssetPath(config, entry.relativePath, entry.kind, 'unregister_target_path');
    await fs.rm(targetPath, { force: true });
    deletedFile = true;
  }

  await writeGeneratedRegistry(config, manifest, errorCodes);
  return {
    ok: true,
    guid: entry.guid,
    assetId: entry.assetId,
    kind: entry.kind,
    removed: true,
    deleteFile,
    force,
    deletedFile,
    targetPath,
    manifestPath: config.manifestPath,
    registryPath: config.registryPath,
  };
}

export class AssetRegistryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'AssetRegistryError';
    this.details = details;
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === '--unregister') {
      args.unregister = true;
      continue;
    }
    if (item === '--payload') {
      args.payload = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === '--asset-id') {
      args.assetId = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === '--guid') {
      args.guid = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === '--delete-file') {
      args.deleteFile = true;
      continue;
    }
    if (item === '--keep-file') {
      args.deleteFile = false;
      continue;
    }
    if (item === '--force') {
      args.force = true;
      continue;
    }
    if (item === '--help' || item === '-h') {
      args.help = true;
    }
  }
  return args;
}

function normalizeExtensionList(value) {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => {
      const normalized = entry.trim().toLowerCase();
      return normalized.startsWith('.') ? normalized : `.${normalized}`;
    });
}

function normalizeSupportedExtensions(config) {
  const extensions = normalizeExtensionList(config.supportedExtensions ?? config.supportedExtension);
  return extensions.length > 0 ? extensions : normalizeExtensionList(DEFAULT_EXTENSIONS);
}

function resolveSourceExtension(config, sourcePath) {
  const lowerPath = sourcePath.toLowerCase();
  return normalizeSupportedExtensions(config).find((extension) => lowerPath.endsWith(extension)) ?? null;
}

function resolveTargetRelativePath(config, { existing, sourcePath, kind, targetFileName }) {
  if (existing?.relativePath) return existing.relativePath;
  return resolveReusableProjectAssetRelativePath(config, sourcePath, kind)
    ?? config.relativeImportedPath(kind, targetFileName);
}

function resolveReusableProjectAssetRelativePath(config, sourcePath, kind) {
  const assetRoot = config.assetRootDir ?? config.assetsDir;
  if (!assetRoot) return null;

  const absoluteSource = path.resolve(sourcePath);
  if (!isInsideOrSamePath(path.resolve(assetRoot), absoluteSource)) return null;
  if (isInsideOrSamePath(path.resolve(config.generatedDir), absoluteSource)) return null;
  assertAssetKindExtension(kind, absoluteSource, 'source_path');

  return path.relative(config.generatedDir, absoluteSource).split(path.sep).join('/');
}

function isInsideOrSamePath(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function isSamePath(left, right) {
  return path.relative(path.resolve(left), path.resolve(right)) === '';
}

function assertInside(parent, child, label) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AssetRegistryError(`${label}_outside_allowed_directory`, { parent, child });
  }
}

function assertOutside(parent, child, label) {
  const relative = path.relative(parent, child);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    throw new AssetRegistryError(`${label}_inside_forbidden_directory`, { parent, child });
  }
}

function resolveCatalogAssetPath(config, relativePath, kind, label) {
  const targetPath = path.resolve(config.generatedDir, relativePath);
  const assetRoot = path.resolve(config.assetRootDir ?? config.assetsDir ?? config.importedDir);
  assertInside(assetRoot, targetPath, label);
  assertOutside(path.resolve(config.generatedDir), targetPath, label);
  assertAssetKindExtension(kind, targetPath, label);
  return targetPath;
}

function publicUrlForCatalogRelativePath(config, relativePath, kind) {
  const targetPath = resolveCatalogAssetPath(config, relativePath, kind, 'asset_url_path');
  if (typeof config.publicUrlForCatalogRelativePath === 'function') {
    return config.publicUrlForCatalogRelativePath(relativePath);
  }
  if (typeof config.publicUrlForRelativePath === 'function') {
    return config.publicUrlForRelativePath(relativePath);
  }
  const relativeToCwd = path.relative(config.cwd, targetPath).split(path.sep).join('/');
  return `/${relativeToCwd}`;
}

function assertAssetKindExtension(kind, filePath, label) {
  const extension = path.extname(filePath).toLowerCase();
  const supportedExtensions = getAssetKindExtensions(kind);
  if (supportedExtensions.includes(extension)) return;
  throw new AssetRegistryError(`${label}_unsupported_extension`, {
    kind,
    filePath,
    extension,
    supportedExtensions,
  });
}

function getAssetKindExtensions(kind) {
  if (kind === 'model') return MODEL_EXTENSIONS;
  if (kind === 'sound') return SOUND_EXTENSIONS;
  if (kind === 'texture') return TEXTURE_EXTENSIONS;
  if (kind === 'image') return IMAGE_EXTENSIONS;
  return [];
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function loadPayload(config, args) {
  if (!args.payload) return null;
  const payloadPath = path.resolve(config.cwd, args.payload);
  const payload = await readJson(payloadPath, null);
  if (!payload || typeof payload !== 'object') {
    throw new AssetRegistryError('invalid_payload_json', { payloadPath });
  }
  return payload;
}

function normalizeManifestEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const guid = readOptionalString(entry.guid);
  const assetId = readOptionalString(entry.assetId);
  const kind = normalizeAssetKind(entry.kind ?? entry.assetKind ?? entry.assetType, entry.relativePath);
  const displayName = readOptionalString(entry.displayName);
  const relativePath = readOptionalString(entry.relativePath);
  if (!guid || !assetId || !kind || !displayName || !relativePath) return null;
  const metadata = normalizeMetadata(entry.metadata);
  return {
    guid,
    assetId,
    kind,
    displayName,
    relativePath,
    ...(readOptionalString(entry.originalFileName) ? { originalFileName: readOptionalString(entry.originalFileName) } : {}),
    ...(readOptionalString(entry.codeKey) ? { codeKey: readOptionalString(entry.codeKey) } : {}),
    ...(typeof entry.placeable === 'boolean' ? { placeable: entry.placeable } : {}),
    ...(readOptionalString(entry.contentHash) ? { contentHash: readOptionalString(entry.contentHash) } : {}),
    ...(typeof entry.byteSize === 'number' ? { byteSize: entry.byteSize } : {}),
    ...(normalizeExternalRef(entry.external) ? { external: normalizeExternalRef(entry.external) } : {}),
    ...(metadata ? { metadata } : {}),
    ...(readOptionalString(entry.createdAt) ? { createdAt: readOptionalString(entry.createdAt) } : {}),
    ...(readOptionalString(entry.updatedAt) ? { updatedAt: readOptionalString(entry.updatedAt) } : {}),
  };
}

export async function loadManifest(config) {
  return (await readJson(config.manifestPath, []))
    .map(normalizeManifestEntry)
    .filter(Boolean);
}

function normalizeExternalRef(value) {
  if (!value || typeof value !== 'object') return null;
  const platformAssetId = readOptionalString(value.platformAssetId);
  const assetPath = readOptionalString(value.assetPath);
  const assetUrl = readOptionalString(value.assetUrl);
  if (!platformAssetId && !assetPath && !assetUrl) return null;
  return {
    ...(platformAssetId ? { platformAssetId } : {}),
    ...(assetPath ? { assetPath } : {}),
    ...(assetUrl ? { assetUrl } : {}),
  };
}

function normalizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return structuredClone(value);
}

async function resolveManifestEntryMetadata(config, context) {
  const payloadMetadata = normalizeMetadata(context.payload?.metadata);
  if (typeof config.resolveAssetMetadata === 'function') {
    const resolved = await config.resolveAssetMetadata({
      ...context,
      existingMetadata: normalizeMetadata(context.existing?.metadata),
      payloadMetadata,
    });
    const normalized = normalizeMetadata(resolved);
    if (normalized) return normalized;
    return null;
  }
  return payloadMetadata ?? normalizeMetadata(context.existing?.metadata);
}

function findReusableCatalogEntry(manifest, payload, sourcePath, audit, kind) {
  const guid = readOptionalString(payload.guid);
  const assetId = readOptionalString(payload.projectAssetId);
  const external = normalizeExternalRef(payload.external ?? {
    platformAssetId: payload.platformAssetId ?? payload.assetId,
    assetPath: payload.assetPath,
    assetUrl: payload.assetUrl,
  });
  if (guid) {
    const byGuid = manifest.find((entry) => entry.guid === guid);
    if (byGuid) return byGuid;
  }
  if (assetId) {
    const byAssetId = manifest.find((entry) => entry.assetId === assetId);
    if (byAssetId) return byAssetId;
  }
  if (external?.platformAssetId) {
    const byPlatformId = manifest.find((entry) => entry.kind === kind && entry.external?.platformAssetId === external.platformAssetId);
    if (byPlatformId) return byPlatformId;
  }
  if (external?.assetPath) {
    const byAssetPath = manifest.find((entry) => entry.kind === kind && entry.external?.assetPath === external.assetPath);
    if (byAssetPath) return byAssetPath;
  }
  if (audit.contentHash) {
    const byHash = manifest.find((entry) => entry.kind === kind && entry.contentHash === audit.contentHash);
    if (byHash) return byHash;
  }
  const normalizedSource = path.resolve(sourcePath);
  return manifest.find((entry) => entry.kind === kind && entry.external?.assetPath && path.resolve(entry.external.assetPath) === normalizedSource) ?? null;
}

function compareCatalogEntries(a, b) {
  return a.kind.localeCompare(b.kind)
    || a.displayName.localeCompare(b.displayName)
    || a.assetId.localeCompare(b.assetId);
}

function validateGeneratedTypescript(content, errorCodes) {
  const output = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
    reportDiagnostics: true,
  });
  const diagnostics = output.diagnostics ?? [];
  const blocking = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error);
  if (blocking.length > 0) {
    throw new AssetRegistryError(errorCodes.generatedRegistrySyntaxError ?? 'generated_registry_syntax_error', {
      diagnostics: blocking.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')),
    });
  }
}

async function atomicWrite(filePath, content) {
  try {
    const previous = await fs.readFile(filePath, 'utf8');
    if (previous === content) return false;
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, content);
  await fs.rename(tmpPath, filePath);
  return true;
}

async function getFileAudit(filePath) {
  const bytes = await fs.readFile(filePath);
  const stats = await fs.stat(filePath);
  return {
    contentHash: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`,
    byteSize: stats.size,
  };
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeGeneratedRegistry(config, manifest, errorCodes) {
  const registryContent = config.generateRegistry(manifest);
  validateGeneratedTypescript(registryContent, errorCodes);
  await fs.mkdir(path.dirname(config.manifestPath), { recursive: true });
  await fs.mkdir(path.dirname(config.registryPath), { recursive: true });
  await atomicWrite(config.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await atomicWrite(config.registryPath, registryContent);
}

function resolveDeleteFile(args, payload) {
  if (typeof args.deleteFile === 'boolean') return args.deleteFile;
  if (payload && typeof payload.deleteFile === 'boolean') return payload.deleteFile;
  return true;
}

function resolveForce(args, payload) {
  return Boolean(args.force || payload?.force === true);
}

async function assertAssetCanBeUnregistered(config, assetId, force, errorCodes) {
  if (force) return;
  const sceneConfig = await readJson(config.scenePath, null);
  const nodes = Array.isArray(sceneConfig?.scene?.nodes) ? sceneConfig.scene.nodes : [];
  const nodeIds = nodes
    .filter((node) => node?.kind === 'instance' && node?.instance?.assetId === assetId)
    .map((node) => node.id)
    .filter(Boolean);
  if (nodeIds.length === 0) return;
  throw new AssetRegistryError(errorCodes.assetStillReferenced ?? 'asset_still_referenced', {
    assetId,
    scenePath: config.scenePath,
    nodeIds,
  });
}

function readOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
