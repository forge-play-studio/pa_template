import { PROJECT_GAMEPLAY_CONFIG_SOURCE_FILE } from '../../config/projectGameplayConfig';

export type DebugConfigChanges = Record<string, unknown>;

export interface DebugConfigSaveResult {
  ok: boolean;
}

const DEBUG_CONFIG_ENDPOINT = '/__debug_panel_config';
const VFX_DEBUG_OVERRIDES_ENDPOINT = '/__vfx_debug_overrides';
const VFX_USAGE_OVERRIDES_ENDPOINT = '/__vfx_usage_overrides';

export async function readDebugJsonConfig<T = unknown>(file: string): Promise<T> {
  const response = await fetch(`${DEBUG_CONFIG_ENDPOINT}?file=${encodeURIComponent(file)}`);
  if (!response.ok) {
    throw new Error(`[debug-config] Failed to read ${file}: ${response.status} ${response.statusText}`);
  }
  return await response.json() as T;
}

export async function saveDebugJsonConfigChanges(
  file: string,
  changes: DebugConfigChanges,
): Promise<DebugConfigSaveResult> {
  const response = await fetch(`${DEBUG_CONFIG_ENDPOINT}?file=${encodeURIComponent(file)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ changes }),
  });
  if (!response.ok) {
    throw new Error(`[debug-config] Failed to save ${file}: ${response.status} ${response.statusText}`);
  }
  return await response.json() as DebugConfigSaveResult;
}

export async function readGameplayDebugConfig<T = unknown>(): Promise<T> {
  return readDebugJsonConfig<T>(PROJECT_GAMEPLAY_CONFIG_SOURCE_FILE);
}

export async function saveGameplayDebugConfigChanges(changes: DebugConfigChanges): Promise<DebugConfigSaveResult> {
  return saveDebugJsonConfigChanges(PROJECT_GAMEPLAY_CONFIG_SOURCE_FILE, changes);
}

export async function assertGameplayDebugConfigReadback(changes: DebugConfigChanges): Promise<void> {
  const config = await readGameplayDebugConfig<Record<string, unknown>>();
  for (const [path, expected] of Object.entries(changes)) {
    const actual = readPath(config, path);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`[debug-config] Readback mismatch at ${path}`);
    }
  }
}

/** Saves one effect's authored default parameters through the narrow dev-only writer. */
export async function saveVfxEffectDefaultParams(effectId: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await postDebugJson(VFX_DEBUG_OVERRIDES_ENDPOINT, { effectId, params });
  const saved = readRecord(readRecord(response.params)?.params);
  if (!sameJson(saved, params)) {
    throw new Error('[vfx-debug] Effect writer did not return the submitted parameters.');
  }

  const allEffects = await readVfxDebugJson<Record<string, unknown>>(VFX_DEBUG_OVERRIDES_ENDPOINT);
  if (!sameJson(readRecord(allEffects[effectId]), params)) {
    throw new Error(`[vfx-debug] Effect parameter readback mismatch for ${effectId}.`);
  }
  return params;
}

/** Saves one usage's overrides through the narrow dev-only writer. */
export async function saveVfxUsageOverride(
  usageId: string,
  params: Record<string, unknown>,
  offset: object,
): Promise<void> {
  const response = await postDebugJson(VFX_USAGE_OVERRIDES_ENDPOINT, { usageId, params, offset });
  const savedUsage = readRecord(response.usage);
  if (!sameJson(readRecord(savedUsage?.params), params) || !sameJson(readRecord(savedUsage?.offset), offset)) {
    throw new Error('[vfx-debug] Usage writer did not return the submitted override.');
  }

  const document = await readVfxDebugJson<{ usages?: unknown }>(VFX_USAGE_OVERRIDES_ENDPOINT);
  const usage = Array.isArray(document.usages)
    ? document.usages.find(entry => readRecord(entry)?.id === usageId)
    : undefined;
  const readback = readRecord(usage);
  if (!sameJson(readRecord(readback?.params), params) || !sameJson(readRecord(readback?.offset), offset)) {
    throw new Error(`[vfx-debug] Usage override readback mismatch for ${usageId}.`);
  }
}

async function readVfxDebugJson<T>(endpoint: string): Promise<T> {
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`[vfx-debug] Failed to read ${endpoint}: ${response.status} ${response.statusText}`);
  }
  return await response.json() as T;
}

async function postDebugJson(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || result.ok !== true) {
    throw new Error(`${endpoint} failed: ${String(result.error ?? `${response.status} ${response.statusText}`)}`);
  }
  return result;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function readPath(source: unknown, path: string): unknown {
  let cursor = source;
  for (const part of path.split('.').filter(Boolean)) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}
