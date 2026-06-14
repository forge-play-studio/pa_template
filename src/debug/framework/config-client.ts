import { PROJECT_GAMEPLAY_CONFIG_SOURCE_FILE } from '../../config/projectGameplayConfig';

export type DebugConfigChanges = Record<string, unknown>;

export interface DebugConfigSaveResult {
  ok: boolean;
}

const DEBUG_CONFIG_ENDPOINT = '/__debug_panel_config';

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

function readPath(source: unknown, path: string): unknown {
  let cursor = source;
  for (const part of path.split('.').filter(Boolean)) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}
