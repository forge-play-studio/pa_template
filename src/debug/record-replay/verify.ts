import type { Game } from '../../core/Game';

export type JsonSnapshot =
  | null
  | boolean
  | number
  | string
  | JsonSnapshot[]
  | { [key: string]: JsonSnapshot };

export interface StateHashResult {
  hash: string;
  snapshot: JsonSnapshot;
  stableJson: string;
}

export interface StateDiff {
  path: string;
  expected: JsonSnapshot | undefined;
  actual: JsonSnapshot | undefined;
}

interface SnapshotProvider {
  getSnapshot(): unknown;
}

export function stateHash(game: Game): StateHashResult {
  const snapshot = captureStateSnapshot(game);
  const stableJson = stableStringify(snapshot);
  return {
    hash: hashString(stableJson),
    snapshot,
    stableJson,
  };
}

export function captureStateSnapshot(game: Game): JsonSnapshot {
  const player = game.getPlayer();
  const runtime = game.getProjectGameplayRuntime();
  const inputService = game.getInputService();
  const moduleSnapshots: JsonSnapshot[] = [];

  if (runtime) {
    for (const [name, system] of Object.entries(runtime.systems)) {
      if (!hasSnapshot(system)) continue;
      moduleSnapshots.push(normalizeSnapshotValue({
        name,
        snapshot: safeGetSnapshot(system),
      }));
    }
  }

  return normalizeSnapshotValue({
    input: {
      enabled: inputService?.isEnabled() ?? false,
    },
    player: player
      ? {
          position: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z,
          },
          radius: player.radius,
        }
      : null,
    modules: moduleSnapshots,
  });
}

export function diffSnapshots(expected: JsonSnapshot, actual: JsonSnapshot, maxDiffs = 16): StateDiff[] {
  const diffs: StateDiff[] = [];
  collectDiffs(expected, actual, '$', diffs, maxDiffs);
  return diffs;
}

export function stableStringify(value: JsonSnapshot): string {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key] ?? null)}`).join(',')}}`;
}

function hasSnapshot(value: unknown): value is SnapshotProvider {
  return !!value && typeof value === 'object' && typeof (value as SnapshotProvider).getSnapshot === 'function';
}

function safeGetSnapshot(provider: SnapshotProvider): unknown {
  try {
    return provider.getSnapshot();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function normalizeSnapshotValue(value: unknown, depth = 0): JsonSnapshot {
  if (depth > 8) return '[MaxDepth]';
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return roundTo(value, 6);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSnapshotValue(item, depth + 1));
  }
  if (typeof value !== 'object') return null;

  const record: { [key: string]: JsonSnapshot } = {};
  for (const key of Object.keys(value).sort()) {
    const item = (value as Record<string, unknown>)[key];
    if (typeof item === 'function' || typeof item === 'symbol' || typeof item === 'undefined') continue;
    record[key] = normalizeSnapshotValue(item, depth + 1);
  }
  return record;
}

function collectDiffs(
  expected: JsonSnapshot | undefined,
  actual: JsonSnapshot | undefined,
  path: string,
  diffs: StateDiff[],
  maxDiffs: number,
): void {
  if (diffs.length >= maxDiffs) return;
  if (Object.is(expected, actual)) return;
  if (expected === undefined || actual === undefined) {
    diffs.push({ path, expected, actual });
    return;
  }
  if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object') {
    diffs.push({ path, expected, actual });
    return;
  }
  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      diffs.push({ path, expected, actual });
      return;
    }
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      collectDiffs(expected[index], actual[index], `${path}[${index}]`, diffs, maxDiffs);
      if (diffs.length >= maxDiffs) return;
    }
    return;
  }

  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of [...keys].sort()) {
    collectDiffs(expected[key], actual[key], `${path}.${key}`, diffs, maxDiffs);
    if (diffs.length >= maxDiffs) return;
  }
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
