import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import path, { resolve } from 'path';

const VFX_USAGES_SCHEMA_REF = './usages.schema.json';
const VFX_USAGES_SCHEMA_VERSION = 'project-vfx-usages/1.0';
const VFX_USAGE_TARGET_KINDS = new Set(['socket', 'node']);
const VFX_USAGE_LIFECYCLES = new Set(['follow', 'loop', 'oneshot']);

export interface ProjectDebugApiPluginOptions {
  projectRoot: string;
  debugPanelConfigRoot?: string;
}

export function projectDebugApiPlugins(options: ProjectDebugApiPluginOptions) {
  return [
    debugPanelConfigApiPlugin(options),
    vfxDebugOverridesApiPlugin(options),
    vfxUsageOverridesApiPlugin(options),
  ];
}

export function debugPanelConfigApiPlugin(options: ProjectDebugApiPluginOptions) {
  const debugPanelConfigRoot = options.debugPanelConfigRoot ?? resolve(options.projectRoot, 'src/config');
  return {
    name: 'debug-panel-config-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__debug_panel_config', async (req: any, res: any) => {
        const requestUrl = new URL(req.url ?? '', 'http://localhost');
        const configPath = resolveDebugPanelConfigFile(debugPanelConfigRoot, requestUrl.searchParams.get('file'));
        if (!configPath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Unsupported debug panel config file' }));
          return;
        }

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(existsSync(configPath) ? readFileSync(configPath, 'utf8') : '{}');
          return;
        }

        if (req.method === 'POST') {
          const body = await readJsonBody(req) as { changes?: Record<string, unknown> };
          const current = existsSync(configPath)
            ? JSON.parse(readFileSync(configPath, 'utf8') || '{}') as Record<string, any>
            : {};
          for (const [pathKey, value] of Object.entries(body.changes ?? {})) {
            setNestedValue(current, pathKey, value);
          }
          mkdirSync(debugPanelConfigRoot, { recursive: true });
          writeFileSync(configPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        res.statusCode = 405;
        res.end('Method Not Allowed');
      });
    },
  };
}

export function vfxDebugOverridesApiPlugin(options: ProjectDebugApiPluginOptions) {
  return {
    name: 'vfx-debug-overrides-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__vfx_debug_overrides', async (req: any, res: any) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(readAllVfxEffectParams(options.projectRoot), null, 2));
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const effectId = typeof body.effectId === 'string' ? body.effectId.trim() : '';
          const params = readOptionalRecord(body.params);
          if (!effectId || !params) {
            sendJson(res, 400, { ok: false, error: 'missing_effect_id_or_params' });
            return;
          }

          const paramsPath = resolveVfxEffectParamsPath(options.projectRoot, effectId);
          if (!paramsPath) {
            sendJson(res, 400, { ok: false, error: 'unsupported_effect_id' });
            return;
          }

          const payload = {
            schemaVersion: 'vfx-params/1.0',
            effectId,
            updatedAt: new Date().toISOString(),
            params,
          };
          await mkdir(path.dirname(paramsPath), { recursive: true });
          await writeFile(paramsPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
          invalidateViteFileModules(server, [
            paramsPath,
            resolve(options.projectRoot, 'src/assets/vfx/index.ts'),
          ]);
          sendJson(res, 200, { ok: true, path: paramsPath, params: payload });
        } catch (error) {
          sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}

export function vfxUsageOverridesApiPlugin(options: ProjectDebugApiPluginOptions) {
  return {
    name: 'vfx-usage-overrides-api',
    apply: 'serve' as const,
    configureServer(server: any) {
      server.middlewares.use('/__vfx_usage_overrides', async (req: any, res: any) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(readVfxUsagesDocument(options.projectRoot), null, 2));
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
          return;
        }

        try {
          const body = await readJsonBody(req);
          const usageId = typeof body.usageId === 'string' ? body.usageId.trim() : '';
          const params = readOptionalRecord(body.params);
          const offset = readOptionalRecord(body.offset);
          if (!usageId || !params) {
            sendJson(res, 400, { ok: false, error: 'missing_usage_id_or_params' });
            return;
          }

          const usagesPath = resolveVfxUsagesPath(options.projectRoot);
          const document = readVfxUsagesDocument(options.projectRoot);
          const usages = Array.isArray(document.usages) ? document.usages : [];
          const usage = usages.find((entry: any) => entry && typeof entry === 'object' && entry.id === usageId);
          if (!usage) {
            sendJson(res, 404, { ok: false, error: 'unknown_usage_id' });
            return;
          }

          usage.params = params;
          if (offset) {
            usage.offset = sanitizeVfxUsageOffset(offset);
          }
          document.$schema = typeof document.$schema === 'string' ? document.$schema : VFX_USAGES_SCHEMA_REF;
          document.schemaVersion = typeof document.schemaVersion === 'string' ? document.schemaVersion : VFX_USAGES_SCHEMA_VERSION;
          document.updatedAt = new Date().toISOString();
          const validationErrors = validateVfxUsagesDocument(document);
          if (validationErrors.length > 0) {
            sendJson(res, 400, { ok: false, error: 'invalid_vfx_usages_document', issues: validationErrors });
            return;
          }

          await mkdir(path.dirname(usagesPath), { recursive: true });
          await writeFile(usagesPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
          invalidateViteFileModules(server, [
            usagesPath,
            resolve(options.projectRoot, 'src/systems/ProjectVfxDirector.ts'),
          ]);
          sendJson(res, 200, { ok: true, path: usagesPath, usage });
        } catch (error) {
          sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}

function resolveDebugPanelConfigFile(debugPanelConfigRoot: string, file: string | null): string | null {
  if (!file || file.includes('/') || file.includes('\\') || file.includes('..') || !file.endsWith('.json')) {
    return null;
  }
  return resolve(debugPanelConfigRoot, file);
}

function setNestedValue(target: Record<string, any>, pathKey: string, value: unknown): void {
  const parts = pathKey.split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]!] = value;
}

async function readJsonBody(req: any): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, any>;
}

function invalidateViteFileModules(server: any, files: string[]): void {
  for (const file of files) {
    const modules = server.moduleGraph?.getModulesByFile?.(file);
    if (!modules) continue;
    for (const moduleNode of modules) {
      server.moduleGraph.invalidateModule(moduleNode);
    }
  }
}

function resolveVfxEffectParamsPath(projectRoot: string, effectId: string): string | null {
  const effectDir = resolve(projectRoot, 'src/assets/vfx/effects', effectId);
  const vfxRoot = resolve(projectRoot, 'src/assets/vfx/effects');
  if (!effectDir.startsWith(`${vfxRoot}${path.sep}`)) return null;
  return resolve(effectDir, 'vfx-params.json');
}

function resolveVfxUsagesPath(projectRoot: string): string {
  return resolve(projectRoot, 'src/assets/vfx/usages.json');
}

function readVfxUsagesDocument(projectRoot: string): any {
  const usagesPath = resolveVfxUsagesPath(projectRoot);
  if (!existsSync(usagesPath)) {
    return {
      $schema: VFX_USAGES_SCHEMA_REF,
      schemaVersion: VFX_USAGES_SCHEMA_VERSION,
      usages: [],
    };
  }
  return JSON.parse(stripVfxJsonBom(readFileSync(usagesPath, 'utf8')) || '{}');
}

function validateVfxUsagesDocument(document: any): string[] {
  const issues: string[] = [];
  const add = (pathLabel: string, message: string) => issues.push(`${pathLabel}: ${message}`);
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return ['document: must be an object'];
  }
  if (document.$schema !== undefined && document.$schema !== VFX_USAGES_SCHEMA_REF) {
    add('$schema', `expected ${VFX_USAGES_SCHEMA_REF}`);
  }
  if (document.schemaVersion !== VFX_USAGES_SCHEMA_VERSION) {
    add('schemaVersion', `expected ${VFX_USAGES_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(document.usages)) {
    add('usages', 'must be an array');
    return issues;
  }

  const ids = new Map<string, number>();
  document.usages.forEach((usage: any, index: number) => {
    const base = `usages[${index}]`;
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
      add(base, 'must be an object');
      return;
    }
    const id = typeof usage.id === 'string' ? usage.id.trim() : '';
    if (!id) add(`${base}.id`, 'must be a non-empty string');
    if (id && ids.has(id)) add(`${base}.id`, `duplicates usages[${ids.get(id)}].id`);
    if (id) ids.set(id, index);
    if (typeof usage.effect !== 'string' || usage.effect.trim().length === 0) add(`${base}.effect`, 'must be a non-empty string');

    const placement = typeof usage.placement === 'string' ? usage.placement : '';
    if (!VFX_USAGE_TARGET_KINDS.has(placement)) add(`${base}.placement`, 'must be socket or node');
    validateVfxUsagePositionSourceConfig(usage.positionSource, placement, `${base}.positionSource`, add);

    if (usage.inputs !== undefined) validateVfxUsageInputsConfig(usage.inputs, `${base}.inputs`, add);

    const lifecycle = typeof usage.lifecycle === 'string' ? usage.lifecycle : '';
    if (!VFX_USAGE_LIFECYCLES.has(lifecycle)) add(`${base}.lifecycle`, 'must be follow, loop, or oneshot');
    if (usage.repeatIntervalSec !== undefined) {
      if (!isFiniteConfigNumber(usage.repeatIntervalSec) || usage.repeatIntervalSec < 0) add(`${base}.repeatIntervalSec`, 'must be a non-negative number');
      if (lifecycle !== 'loop') add(`${base}.repeatIntervalSec`, 'is only valid when lifecycle is loop');
    }
    if (usage.offset !== undefined) validateVfxUsageOffsetConfig(usage.offset, `${base}.offset`, add);
    if (usage.params !== undefined) validateVfxUsageParamsConfig(usage.params, `${base}.params`, add);
  });
  return issues;
}

function validateVfxUsagePositionSourceConfig(
  source: unknown,
  placement: string,
  pathLabel: string,
  add: (pathLabel: string, message: string) => void,
): void {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    add(pathLabel, 'must be an object');
    return;
  }
  const value = source as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    if (key !== 'kind' && key !== 'nodeId') add(`${pathLabel}.${key}`, 'unknown position source field');
  }
  const kind = typeof value.kind === 'string' ? value.kind : '';
  if (!VFX_USAGE_TARGET_KINDS.has(kind)) add(`${pathLabel}.kind`, 'must be socket or node');
  if (placement && kind && placement !== kind) add(`${pathLabel}.kind`, 'must match placement');
  if (typeof value.nodeId !== 'string' || value.nodeId.trim().length === 0) {
    add(`${pathLabel}.nodeId`, 'must be a non-empty string');
  }
}

function validateVfxUsageInputsConfig(
  inputs: unknown,
  pathLabel: string,
  add: (pathLabel: string, message: string) => void,
): void {
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    add(pathLabel, 'must be an object');
    return;
  }
  const value = inputs as Record<string, unknown>;
  const keys = Object.keys(value);
  if (keys.length === 0) add(pathLabel, 'must contain at least one input');
  for (const key of keys) {
    if (key !== 'reference') add(`${pathLabel}.${key}`, 'unknown input field');
  }
  if (value.reference !== undefined) {
    validateVfxUsagePositionSourceConfig(value.reference, '', `${pathLabel}.reference`, add);
  }
}

function validateVfxUsageOffsetConfig(offset: unknown, pathLabel: string, add: (pathLabel: string, message: string) => void): void {
  if (!offset || typeof offset !== 'object' || Array.isArray(offset)) {
    add(pathLabel, 'must be an object');
    return;
  }
  const source = offset as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (key !== 'position' && key !== 'rotation' && key !== 'scale') add(`${pathLabel}.${key}`, 'unknown offset field');
  }
  if (source.position !== undefined) validateVfxUsageVector3Config(source.position, `${pathLabel}.position`, add);
  if (source.rotation !== undefined) validateVfxUsageVector3Config(source.rotation, `${pathLabel}.rotation`, add);
  if (source.scale !== undefined && !isFiniteConfigNumber(source.scale)) {
    validateVfxUsageVector3Config(source.scale, `${pathLabel}.scale`, add);
  }
}

function validateVfxUsageVector3Config(value: unknown, pathLabel: string, add: (pathLabel: string, message: string) => void): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    add(pathLabel, 'must be a vector object');
    return;
  }
  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.length === 0) add(pathLabel, 'must contain at least one axis');
  for (const key of keys) {
    if (key !== 'x' && key !== 'y' && key !== 'z') {
      add(`${pathLabel}.${key}`, 'unknown vector axis');
      continue;
    }
    if (!isFiniteConfigNumber(source[key])) add(`${pathLabel}.${key}`, 'must be a finite number');
  }
}

function validateVfxUsageParamsConfig(params: unknown, pathLabel: string, add: (pathLabel: string, message: string) => void): void {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    add(pathLabel, 'must be an object');
    return;
  }
  validateNoDebugVfxUsageParamKeys(params, pathLabel, add);
}

function validateNoDebugVfxUsageParamKeys(value: unknown, pathLabel: string, add: (pathLabel: string, message: string) => void): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoDebugVfxUsageParamKeys(item, `${pathLabel}[${index}]`, add));
    return;
  }
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = `${pathLabel}.${key}`;
    if (key.startsWith('__debug.')) add(nextPath, 'debug-only params must not be persisted');
    validateNoDebugVfxUsageParamKeys(item, nextPath, add);
  }
}

function isFiniteConfigNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readAllVfxEffectParams(projectRoot: string): Record<string, unknown> {
  const effectsRoot = resolve(projectRoot, 'src/assets/vfx/effects');
  const result: Record<string, unknown> = {};
  if (!existsSync(effectsRoot)) return result;
  for (const effectId of readdirSync(effectsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)) {
    const paramsPath = resolveVfxEffectParamsPath(projectRoot, effectId);
    if (!paramsPath || !existsSync(paramsPath)) continue;
    try {
      const value = JSON.parse(stripVfxJsonBom(readFileSync(paramsPath, 'utf8')) || '{}') as { params?: unknown };
      result[effectId] = value.params && typeof value.params === 'object' && !Array.isArray(value.params)
        ? value.params
        : value;
    } catch {
      result[effectId] = {};
    }
  }
  return result;
}

function sanitizeVfxUsageOffset(offset: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const position = readOptionalVector3Config(offset.position);
  const rotation = readOptionalVector3Config(offset.rotation);
  const scale = readOptionalScaleConfig(offset.scale);
  if (position) result.position = position;
  if (rotation) result.rotation = rotation;
  if (scale !== undefined) result.scale = scale;
  return result;
}

function readOptionalVector3Config(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const axis of ['x', 'y', 'z']) {
    const axisValue = source[axis];
    if (typeof axisValue === 'number' && Number.isFinite(axisValue)) {
      result[axis] = axisValue;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function readOptionalScaleConfig(value: unknown): number | Record<string, number> | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return readOptionalVector3Config(value) ?? undefined;
}

function readOptionalRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function sendJson(res: any, statusCode: number, body: Record<string, unknown>): void {
  res.statusCode = statusCode;
  setProjectDebugCorsHeaders(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function setProjectDebugCorsHeaders(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
}

function stripVfxJsonBom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
