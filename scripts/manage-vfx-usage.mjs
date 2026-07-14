#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), '..');
const DEFAULT_SCHEMA_REF = './usages.schema.json';
const DEFAULT_SCHEMA_VERSION = 'project-vfx-usages/1.0';
const VALID_LIFECYCLES = new Set(['follow', 'loop', 'oneshot']);
const VALID_TARGET_KINDS = new Set(['socket', 'node']);
const VALID_USAGE_KEYS = new Set([
  'id',
  'label',
  'effect',
  'placement',
  'positionSource',
  'inputs',
  'offset',
  'lifecycle',
  'repeatIntervalSec',
  'params',
]);
const VALID_DOCUMENT_KEYS = new Set(['$schema', 'schemaVersion', 'updatedAt', 'usages']);
const VALID_INPUT_KEYS = new Set(['reference']);
const VALID_OFFSET_KEYS = new Set(['position', 'rotation', 'scale']);
const VALID_VECTOR_KEYS = new Set(['x', 'y', 'z']);

try {
  run(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function run(argv) {
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  const [command, ...tokens] = args;
  const options = parseArgs(tokens);

  switch (command) {
    case 'list':
    case 'ls':
      listUsages(options);
      return;
    case 'add':
    case 'create':
      addUsage(options);
      return;
    case 'remove':
    case 'delete':
    case 'rm':
      removeUsage(options);
      return;
    case 'validate':
    case 'check':
      validateUsages(options);
      return;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      return;
    default:
      throw new Error(`Unknown command "${command}". Run: pnpm vfx:usage -- help`);
  }
}

function listUsages(options) {
  const document = readUsagesDocument(readUsagesPath(options));
  const usages = getUsagesArray(document);
  if (options.json) {
    console.log(JSON.stringify(usages, null, 2));
    return;
  }

  if (usages.length === 0) {
    console.log('No VFX usages.');
    return;
  }

  const rows = usages.map((usage) => ({
    id: String(usage.id ?? ''),
    effect: String(usage.effect ?? ''),
    kind: String(usage.positionSource?.kind ?? usage.placement ?? ''),
    node: String(usage.positionSource?.nodeId ?? ''),
    lifecycle: String(usage.lifecycle ?? ''),
    label: String(usage.label ?? ''),
  }));
  printRows(rows, ['id', 'effect', 'kind', 'node', 'lifecycle', 'label']);
}

function validateUsages(options) {
  const usagesPath = readUsagesPath(options);
  const document = readUsagesDocument(usagesPath);
  validateUsagesDocument(document, usagesPath);
  console.log(`OK ${relativePath(usagesPath)} (${getUsagesArray(document).length} usages)`);
}

function addUsage(options) {
  const usagesPath = readUsagesPath(options);
  const document = readUsagesDocument(usagesPath);
  const usages = getUsagesArray(document);
  const effectId = readRequiredString(options.effect, '--effect');
  const target = readTarget(options);
  const inputs = readInputs(options);
  const lifecycle = readLifecycle(options.lifecycle);
  const usageId = readString(options.id) || createUniqueUsageId(usages, `${target.nodeId}-${effectId}`);
  const existingIndex = usages.findIndex((usage) => usage?.id === usageId);
  const replace = Boolean(options.replace || options.upsert);

  validateEffect(effectId, options);
  validateTarget(target, options);
  if (inputs?.reference) validateTarget(inputs.reference, options);

  if (existingIndex >= 0 && !replace) {
    throw new Error(`Usage "${usageId}" already exists. Pass --replace to update it.`);
  }

  const usage = compactObject({
    id: usageId,
    label: readString(options.label) || `${target.nodeId} / ${effectId}`,
    effect: effectId,
    placement: target.kind,
    positionSource: {
      kind: target.kind,
      nodeId: target.nodeId,
    },
    inputs,
    offset: readOffset(options),
    lifecycle,
    repeatIntervalSec: lifecycle === 'loop' ? readRepeatInterval(options.repeatIntervalSec) : undefined,
    params: readParams(options),
  });

  if (existingIndex >= 0) {
    usages.splice(existingIndex, 1, usage);
  } else {
    usages.push(usage);
  }

  document.$schema = readString(document.$schema) || DEFAULT_SCHEMA_REF;
  document.schemaVersion = readString(document.schemaVersion) || DEFAULT_SCHEMA_VERSION;
  document.usages = usages;
  document.updatedAt = new Date().toISOString();
  writeUsagesDocument(usagesPath, document, options);
  console.log(`${options.dryRun ? 'Would write' : 'Wrote'} usage "${usageId}" -> ${formatTarget(target)} (${effectId})`);
}

function removeUsage(options) {
  const usagesPath = readUsagesPath(options);
  const document = readUsagesDocument(usagesPath);
  const usages = getUsagesArray(document);
  const usageId = readRequiredString(options.id, '--id');
  const nextUsages = usages.filter((usage) => usage?.id !== usageId);

  if (nextUsages.length === usages.length) {
    throw new Error(`Unknown usage "${usageId}".`);
  }

  document.$schema = readString(document.$schema) || DEFAULT_SCHEMA_REF;
  document.schemaVersion = readString(document.schemaVersion) || DEFAULT_SCHEMA_VERSION;
  document.usages = nextUsages;
  document.updatedAt = new Date().toISOString();
  writeUsagesDocument(usagesPath, document, options);
  console.log(`${options.dryRun ? 'Would remove' : 'Removed'} usage "${usageId}"`);
}

function readUsagesPath(options) {
  return resolveProjectPath(readString(options.usages) || 'src/assets/vfx/usages.json');
}

function readUsagesDocument(usagesPath) {
  if (!existsSync(usagesPath)) {
    return {
      $schema: DEFAULT_SCHEMA_REF,
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      usages: [],
    };
  }
  const text = stripBom(readFileSync(usagesPath, 'utf8')).trim();
  if (!text) {
    return {
      $schema: DEFAULT_SCHEMA_REF,
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      usages: [],
    };
  }
  const document = JSON.parse(text);
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error(`${relativePath(usagesPath)} must contain a JSON object.`);
  }
  return document;
}

function writeUsagesDocument(usagesPath, document, options) {
  validateUsagesDocument(document, usagesPath);

  if (options.dryRun) {
    console.log(JSON.stringify(document, null, 2));
    return;
  }

  mkdirSync(path.dirname(usagesPath), { recursive: true });
  writeFileSync(usagesPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

function getUsagesArray(document) {
  if (!Array.isArray(document.usages)) {
    document.usages = [];
  }
  return document.usages;
}

function validateUsagesDocument(document, usagesPath) {
  const errors = [];
  const add = (fieldPath, message) => errors.push(`${fieldPath}: ${message}`);

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error(`${relativePath(usagesPath)} must contain a JSON object.`);
  }

  for (const key of Object.keys(document)) {
    if (!VALID_DOCUMENT_KEYS.has(key)) add(key, 'unknown document field');
  }

  if (document.$schema !== undefined && document.$schema !== DEFAULT_SCHEMA_REF) {
    add('$schema', `expected "${DEFAULT_SCHEMA_REF}"`);
  }
  if (document.schemaVersion !== DEFAULT_SCHEMA_VERSION) {
    add('schemaVersion', `expected "${DEFAULT_SCHEMA_VERSION}"`);
  }
  if (document.updatedAt !== undefined && typeof document.updatedAt !== 'string') {
    add('updatedAt', 'must be a string when present');
  }
  if (!Array.isArray(document.usages)) {
    add('usages', 'must be an array');
  }

  const usages = Array.isArray(document.usages) ? document.usages : [];
  const ids = new Map();
  usages.forEach((usage, index) => {
    validateUsage(usage, index, ids, add);
  });

  if (errors.length > 0) {
    throw new Error(`Invalid ${relativePath(usagesPath)}:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  }
}

function validateUsage(usage, index, ids, add) {
  const basePath = `usages[${index}]`;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    add(basePath, 'must be an object');
    return;
  }

  for (const key of Object.keys(usage)) {
    if (!VALID_USAGE_KEYS.has(key)) add(`${basePath}.${key}`, 'unknown usage field');
  }

  const id = readString(usage.id);
  if (!id) {
    add(`${basePath}.id`, 'must be a non-empty string');
  } else if (ids.has(id)) {
    add(`${basePath}.id`, `duplicates usages[${ids.get(id)}].id "${id}"`);
  } else {
    ids.set(id, index);
  }

  if (!readString(usage.effect)) add(`${basePath}.effect`, 'must be a non-empty string');
  if (usage.label !== undefined && typeof usage.label !== 'string') add(`${basePath}.label`, 'must be a string when present');

  const placement = readString(usage.placement);
  if (!VALID_TARGET_KINDS.has(placement)) {
    add(`${basePath}.placement`, 'must be socket or node');
  }

  validatePositionSource(usage.positionSource, placement, `${basePath}.positionSource`, add);

  const lifecycle = readString(usage.lifecycle);
  if (!VALID_LIFECYCLES.has(lifecycle)) {
    add(`${basePath}.lifecycle`, 'must be follow, loop, or oneshot');
  }
  if (usage.repeatIntervalSec !== undefined) {
    if (!isFiniteNumber(usage.repeatIntervalSec) || usage.repeatIntervalSec < 0) {
      add(`${basePath}.repeatIntervalSec`, 'must be a non-negative number');
    }
    if (lifecycle && lifecycle !== 'loop') {
      add(`${basePath}.repeatIntervalSec`, 'is only valid when lifecycle is loop');
    }
  }

  if (usage.inputs !== undefined) validateInputs(usage.inputs, `${basePath}.inputs`, add);
  if (usage.offset !== undefined) validateOffset(usage.offset, `${basePath}.offset`, add);
  if (usage.params !== undefined) validateParams(usage.params, `${basePath}.params`, add);
}

function validateInputs(inputs, fieldPath, add) {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    add(fieldPath, 'must be an object');
    return;
  }
  const keys = Object.keys(inputs);
  if (keys.length === 0) add(fieldPath, 'must contain at least one input');
  for (const key of keys) {
    if (!VALID_INPUT_KEYS.has(key)) add(`${fieldPath}.${key}`, 'unknown input field');
  }
  if (inputs.reference !== undefined) {
    validatePositionSource(inputs.reference, '', `${fieldPath}.reference`, add);
  }
}

function validatePositionSource(value, placement, fieldPath, add) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add(fieldPath, 'must be an object');
    return;
  }
  for (const key of Object.keys(value)) {
    if (key !== 'kind' && key !== 'nodeId') add(`${fieldPath}.${key}`, 'unknown positionSource field');
  }
  const kind = readString(value.kind);
  if (!VALID_TARGET_KINDS.has(kind)) add(`${fieldPath}.kind`, 'must be socket or node');
  if (placement && kind && placement !== kind) add(`${fieldPath}.kind`, `must match placement "${placement}"`);
  if (!readString(value.nodeId)) add(`${fieldPath}.nodeId`, 'must be a non-empty string');
}

function validateOffset(offset, fieldPath, add) {
  if (!offset || typeof offset !== 'object' || Array.isArray(offset)) {
    add(fieldPath, 'must be an object');
    return;
  }
  for (const key of Object.keys(offset)) {
    if (!VALID_OFFSET_KEYS.has(key)) add(`${fieldPath}.${key}`, 'unknown offset field');
  }
  if (offset.position !== undefined) validateVector3(offset.position, `${fieldPath}.position`, add);
  if (offset.rotation !== undefined) validateVector3(offset.rotation, `${fieldPath}.rotation`, add);
  if (offset.scale !== undefined) {
    if (isFiniteNumber(offset.scale)) return;
    validateVector3(offset.scale, `${fieldPath}.scale`, add);
  }
}

function validateVector3(value, fieldPath, add) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add(fieldPath, 'must be a vector object');
    return;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) add(fieldPath, 'must contain at least one axis');
  for (const key of keys) {
    if (!VALID_VECTOR_KEYS.has(key)) {
      add(`${fieldPath}.${key}`, 'unknown vector axis');
      continue;
    }
    if (!isFiniteNumber(value[key])) add(`${fieldPath}.${key}`, 'must be a finite number');
  }
}

function validateParams(params, fieldPath, add) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    add(fieldPath, 'must be an object');
    return;
  }
  validateNoDebugParamKeys(params, fieldPath, add);
}

function validateNoDebugParamKeys(value, fieldPath, add) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoDebugParamKeys(item, `${fieldPath}[${index}]`, add));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${fieldPath}.${key}`;
    if (key.startsWith('__debug.')) add(nextPath, 'debug-only params must not be persisted');
    validateNoDebugParamKeys(item, nextPath, add);
  }
}

function readTarget(options) {
  const socketNodeId = readString(options.socket);
  const runtimeNodeId = readString(options.node);
  let kind = readString(options.kind);
  let nodeId = readString(options.target || options.mount || options.nodeId);

  if (socketNodeId) {
    if (kind && kind !== 'socket') throw new Error('--socket cannot be combined with --kind node.');
    kind = 'socket';
    nodeId = socketNodeId;
  }

  if (runtimeNodeId) {
    if (kind && kind !== 'node') throw new Error('--node cannot be combined with --kind socket.');
    if (nodeId && nodeId !== runtimeNodeId) throw new Error('--node cannot point at a different --target.');
    kind = 'node';
    nodeId = runtimeNodeId;
  }

  if (!VALID_TARGET_KINDS.has(kind)) {
    throw new Error('Missing target kind. Use --socket <nodeId>, --node <nodeId>, or --kind socket|node --target <nodeId>.');
  }
  if (!nodeId) {
    throw new Error('Missing target node id. Use --target <nodeId>, --socket <nodeId>, or --node <nodeId>.');
  }
  return { kind, nodeId };
}

function readInputs(options) {
  const reference = readReferenceSource(options);
  return compactObject({
    reference,
  });
}

function readReferenceSource(options) {
  const socketNodeId = readString(options.referenceSocket);
  const runtimeNodeId = readString(options.referenceNode);
  let kind = readString(options.referenceKind);
  let nodeId = readString(options.referenceTarget || options.referenceNodeId);

  if (socketNodeId) {
    if (kind && kind !== 'socket') throw new Error('--reference-socket cannot be combined with --reference-kind node.');
    kind = 'socket';
    nodeId = socketNodeId;
  }

  if (runtimeNodeId) {
    if (kind && kind !== 'node') throw new Error('--reference-node cannot be combined with --reference-kind socket.');
    if (nodeId && nodeId !== runtimeNodeId) throw new Error('--reference-node cannot point at a different --reference-target.');
    kind = 'node';
    nodeId = runtimeNodeId;
  }

  if (!kind && !nodeId) return undefined;
  if (!VALID_TARGET_KINDS.has(kind)) {
    throw new Error('Invalid reference kind. Use --reference-socket <nodeId>, --reference-node <nodeId>, or --reference-kind socket|node --reference-target <nodeId>.');
  }
  if (!nodeId) {
    throw new Error('Missing reference node id. Use --reference-target <nodeId>, --reference-socket <nodeId>, or --reference-node <nodeId>.');
  }
  return { kind, nodeId };
}

function validateEffect(effectId, options) {
  if (options.allowMissingEffect) return;
  const effectsRoot = resolveProjectPath(readString(options.effectsRoot) || 'src/assets/vfx/effects');
  const effectDir = path.join(effectsRoot, effectId);
  if (!existsSync(effectDir) || !statSync(effectDir).isDirectory()) {
    throw new Error(`Unknown effect "${effectId}". Expected directory: ${relativePath(effectDir)}. Pass --allow-missing-effect to bypass.`);
  }
  const indexPath = path.join(effectDir, 'index.ts');
  const runtimePath = path.join(effectDir, 'vfx-runtime.json');
  if (!existsSync(indexPath)) {
    throw new Error(`Effect "${effectId}" is missing ${relativePath(indexPath)}.`);
  }
  if (!existsSync(runtimePath)) {
    throw new Error(`Effect "${effectId}" is missing ${relativePath(runtimePath)}; production VFX must declare pool capacity and lifecycle.`);
  }
  const runtime = JSON.parse(stripBom(readFileSync(runtimePath, 'utf8')));
  if (runtime?.effectId !== effectId) {
    throw new Error(`${relativePath(runtimePath)} effectId must equal "${effectId}".`);
  }
  if (!Number.isInteger(runtime?.poolSize) || runtime.poolSize < 1) {
    throw new Error(`${relativePath(runtimePath)} poolSize must be a positive integer.`);
  }
}

function validateTarget(target, options) {
  if (options.validateTarget === false) return;
  const records = readConfigNodeRecords(target.nodeId);

  if (target.kind === 'socket') {
    if (records.length === 0) {
      throw new Error(`Socket node "${target.nodeId}" was not found in src/config/scene.json or src/config/editor-scene.json. Pass --no-validate-target to bypass.`);
    }
    if (!records.some((record) => readMarkerType(record.value) === 'effect-socket')) {
      throw new Error(`Node "${target.nodeId}" exists but is not marked as effect-socket. Pass --no-validate-target to bypass.`);
    }
    return;
  }

  if (records.length > 0 || sourceContainsLiteral(resolveProjectPath('src'), target.nodeId)) {
    return;
  }

  const message = `Runtime node "${target.nodeId}" was not found statically. This can be OK for nodes registered at runtime.`;
  if (options.strictTarget) {
    throw new Error(`${message} Remove --strict-target or pass --no-validate-target to bypass.`);
  }
  console.warn(`[warn] ${message}`);
}

function readConfigNodeRecords(nodeId) {
  const configPaths = [
    resolveProjectPath('src/config/scene.json'),
    resolveProjectPath('src/config/editor-scene.json'),
  ];
  const records = [];
  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;
    const document = JSON.parse(stripBom(readFileSync(configPath, 'utf8')));
    collectObjectsById(document, nodeId, configPath, records);
  }
  return records;
}

function collectObjectsById(value, nodeId, sourcePath, records) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectsById(item, nodeId, sourcePath, records);
    }
    return;
  }

  if (value.id === nodeId) {
    records.push({ sourcePath, value });
  }

  for (const child of Object.values(value)) {
    collectObjectsById(child, nodeId, sourcePath, records);
  }
}

function readMarkerType(value) {
  if (!value || typeof value !== 'object') return null;
  const directMarker = value.marker;
  if (directMarker && typeof directMarker === 'object' && typeof directMarker.type === 'string') {
    return directMarker.type;
  }
  const metadataMarker = value.metadata?.sceneMarker;
  if (metadataMarker && typeof metadataMarker === 'object' && typeof metadataMarker.type === 'string') {
    return metadataMarker.type;
  }
  const components = Array.isArray(value.components) ? value.components : [];
  for (const component of components) {
    if (component && typeof component === 'object' && typeof component.type === 'string' && component.type === 'effect-socket') {
      return 'effect-socket';
    }
    const marker = component?.marker;
    if (marker && typeof marker === 'object' && typeof marker.type === 'string') {
      return marker.type;
    }
  }
  return null;
}

function sourceContainsLiteral(root, literal) {
  if (!existsSync(root)) return false;
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (sourceContainsLiteral(fullPath, literal)) return true;
      continue;
    }
    if (!entry.isFile() || !/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    if (readFileSync(fullPath, 'utf8').includes(literal)) return true;
  }
  return false;
}

function readOffset(options) {
  const position = readVectorOption(options.offsetPosition ?? options.position ?? options.offset)
    ?? readPartialVector(options, 'offset');
  const rotation = readVectorOption(options.offsetRotation ?? options.rotation)
    ?? readPartialVector(options, 'rotation');
  const scale = readScaleOption(options.offsetScale ?? options.scale);

  return compactObject({
    position,
    rotation,
    scale,
  });
}

function readPartialVector(options, prefix) {
  const x = readOptionalNumber(options[`${prefix}X`]);
  const y = readOptionalNumber(options[`${prefix}Y`]);
  const z = readOptionalNumber(options[`${prefix}Z`]);
  if (x === undefined && y === undefined && z === undefined) return undefined;
  return compactObject({ x, y, z });
}

function readVectorOption(value) {
  const text = readString(value);
  if (!text) return undefined;
  const parts = text.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Expected vector value "x,y,z"; received "${text}".`);
  }
  return { x: parts[0], y: parts[1], z: parts[2] };
}

function readScaleOption(value) {
  const text = readString(value);
  if (!text) return undefined;
  if (text.includes(',')) return readVectorOption(text);
  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new Error(`Expected numeric scale or "x,y,z"; received "${text}".`);
  }
  return number;
}

function readParams(options) {
  const paramsFile = readString(options.paramsFile);
  const paramsJson = readString(options.paramsJson ?? options.params);
  if (paramsFile && paramsJson) {
    throw new Error('Use only one of --params-file or --params-json.');
  }
  if (paramsFile) {
    const value = JSON.parse(readFileSync(resolveProjectPath(paramsFile), 'utf8'));
    return assertRecord(value, '--params-file');
  }
  if (paramsJson) {
    const value = JSON.parse(paramsJson);
    return assertRecord(value, '--params-json');
  }
  return {};
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must contain a JSON object.`);
  }
  return value;
}

function readLifecycle(value) {
  const lifecycle = readString(value) || 'follow';
  if (!VALID_LIFECYCLES.has(lifecycle)) {
    throw new Error(`Invalid lifecycle "${lifecycle}". Expected: follow, loop, or oneshot.`);
  }
  return lifecycle;
}

function readRepeatInterval(value) {
  if (value === undefined || value === true) return undefined;
  const repeatIntervalSec = Number(value);
  if (!Number.isFinite(repeatIntervalSec) || repeatIntervalSec < 0) {
    throw new Error('--repeat-interval-sec must be a non-negative number.');
  }
  return repeatIntervalSec;
}

function createUniqueUsageId(usages, seed) {
  const base = sanitizeId(seed) || 'vfx-usage';
  const usedIds = new Set(usages.map((usage) => usage?.id).filter(Boolean));
  if (!usedIds.has(base)) return base;

  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!usedIds.has(candidate)) return candidate;
  }
  throw new Error(`Could not create a unique usage id from "${base}".`);
}

function sanitizeId(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseArgs(tokens) {
  const options = { _: [] };
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) {
      options._.push(token);
      continue;
    }

    const rawKey = token.slice(2);
    if (!rawKey) continue;
    if (rawKey.startsWith('no-')) {
      options[toCamelCase(rawKey.slice(3))] = false;
      continue;
    }

    const key = toCamelCase(rawKey);
    const next = tokens[index + 1];
    if (next === undefined || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

function toCamelCase(value) {
  return value.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function readRequiredString(value, label) {
  const text = readString(value);
  if (!text) throw new Error(`Missing ${label}.`);
  return text;
}

function readString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalNumber(value) {
  if (value === undefined || value === true) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Expected number; received "${value}".`);
  }
  return number;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function compactObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const compacted = compactObject(item);
      if (Object.keys(compacted).length === 0) continue;
      result[key] = compacted;
      continue;
    }
    result[key] = item;
  }
  return result;
}

function resolveProjectPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

function relativePath(value) {
  return path.relative(projectRoot, value) || '.';
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function formatTarget(target) {
  return `${target.kind}:${target.nodeId}`;
}

function printRows(rows, fields) {
  const widths = {};
  for (const field of fields) {
    widths[field] = Math.max(field.length, ...rows.map((row) => row[field].length));
  }
  console.log(fields.map((field) => field.padEnd(widths[field])).join('  '));
  console.log(fields.map((field) => '-'.repeat(widths[field])).join('  '));
  for (const row of rows) {
    console.log(fields.map((field) => row[field].padEnd(widths[field])).join('  '));
  }
}

function printHelp() {
  console.log(`Project VFX usage helper

Usage:
  pnpm vfx:usage -- list
  pnpm vfx:usage -- validate
  pnpm vfx:usage -- add --effect <effectId> --socket <sceneNodeId> [--id <usageId>]
  pnpm vfx:usage -- add --effect <effectId> --node <runtimeNodeId> [--id <usageId>]
  pnpm vfx:usage -- remove --id <usageId>

Examples:
  pnpm vfx:usage -- add --effect energy-shield --socket marker-4 --id marker-4-energy-shield --label "Marker 4 / Energy Shield"
  pnpm vfx:usage -- add --effect thruster-flame --node runtime_effect_host --id runtime-effect-host-flame --label "Runtime Host / Flame" --position "0,0,-1.1" --no-validate-target
  pnpm vfx:usage -- remove --id marker-4-energy-shield

Options:
  --lifecycle follow|loop|oneshot   Default: follow
  --repeat-interval-sec <number>    Only used with --lifecycle loop
  --position "x,y,z"                Local position offset under the mount node
  --rotation "x,y,z"                Local Euler rotation offset
  --scale <number|"x,y,z">          Local scale offset
  --reference-socket <sceneNodeId>  Provide inputs.reference from an effect socket
  --reference-node <runtimeNodeId>  Provide inputs.reference from a runtime node
  --params-json '{"key":1}'         Initial instance params
  --params-file <path>              Initial instance params from JSON object
  --replace                         Replace an existing usage with the same id
  --dry-run                         Print the changed document without writing
  --no-validate-target              Skip static target validation
  --allow-missing-effect            Skip effect directory validation
`);
}
