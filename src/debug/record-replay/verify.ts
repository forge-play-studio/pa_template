import {
  LATEST_RECORD_REPLAY_HASH_VERSION,
  normalizeHashVersion,
  type RecordReplayHashVersion,
} from './schema';
import {
  collectRecordReplaySnapshotEntries,
  readRecordReplayPlayerPosition,
} from './providers';

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

interface RecordReplayHashGame {
  getPlayer(): { position: { x: number; y: number; z: number }; radius: number } | null;
  getInputService(): { isEnabled(): boolean } | null;
  getCamera(): {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
    alpha: number;
    beta: number;
    radius: number;
  } | null;
  getFrameCount(): number;
  getLastFrameDeltaTime(): number;
  getDeterminismContext(): { elapsedTimeSec: number };
}

export function stateHash(
  game: RecordReplayHashGame,
  hashVersion: RecordReplayHashVersion = LATEST_RECORD_REPLAY_HASH_VERSION,
): StateHashResult {
  const snapshot = captureStateSnapshot(game, hashVersion);
  const stableJson = stableStringify(snapshot);
  return {
    hash: hashString(stableJson),
    snapshot,
    stableJson,
  };
}

export function captureStateSnapshot(
  game: RecordReplayHashGame,
  hashVersion: RecordReplayHashVersion = LATEST_RECORD_REPLAY_HASH_VERSION,
): JsonSnapshot {
  const normalizedHashVersion = normalizeHashVersion(hashVersion);
  const player = game.getPlayer();
  const inputService = game.getInputService();
  const camera = game.getCamera();
  const registeredPlayerPosition = readRecordReplayPlayerPosition();
  const providerSnapshots = normalizedHashVersion >= 2
    ? captureRegisteredProviderSnapshots(normalizedHashVersion)
    : [];

  const snapshot = {
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
    playerPosition: registeredPlayerPosition
      ? readVectorSnapshot({
          x: registeredPlayerPosition.x,
          y: registeredPlayerPosition.y ?? 0,
          z: registeredPlayerPosition.z,
        }, normalizedHashVersion)
      : null,
    camera: camera
      ? {
          position: readVectorSnapshot(camera.position, normalizedHashVersion),
          target: readVectorSnapshot(camera.target, normalizedHashVersion),
          alpha: camera.alpha,
          beta: camera.beta,
          radius: camera.radius,
        }
      : null,
    providers: providerSnapshots,
  };

  if (normalizedHashVersion >= 2) {
    return normalizeSnapshotValue({
      ...snapshot,
      hashVersion: normalizedHashVersion,
      frame: game.getFrameCount(),
      dt: game.getLastFrameDeltaTime(),
      time: game.getDeterminismContext().elapsedTimeSec,
    }, normalizedHashVersion);
  }

  return normalizeSnapshotValue(snapshot, normalizedHashVersion);
}

export function diffSnapshots(expected: JsonSnapshot, actual: JsonSnapshot, maxDiffs = 16): StateDiff[] {
  const diffs: StateDiff[] = [];
  collectDiffs(expected, actual, '$', diffs, maxDiffs);
  return diffs;
}

export function normalizeSnapshotForComparison(
  value: unknown,
  hashVersion: RecordReplayHashVersion = LATEST_RECORD_REPLAY_HASH_VERSION,
): JsonSnapshot {
  return normalizeSnapshotValue(value, normalizeHashVersion(hashVersion));
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

function captureRegisteredProviderSnapshots(
  hashVersion: RecordReplayHashVersion,
): JsonSnapshot[] {
  return collectRecordReplaySnapshotEntries().map((entry, index) => normalizeSnapshotValue({
    index,
    name: entry.name,
    snapshot: entry.snapshot,
  }, hashVersion));
}

function readVectorSnapshot(
  value: { x: number; y: number; z: number },
  hashVersion: RecordReplayHashVersion,
): JsonSnapshot {
  return normalizeSnapshotValue({
    x: value.x,
    y: value.y,
    z: value.z,
  }, hashVersion);
}

function normalizeSnapshotValue(
  value: unknown,
  hashVersion: RecordReplayHashVersion,
  depth = 0,
): JsonSnapshot {
  if (depth > 8) return '[MaxDepth]';
  if (value === null) return null;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    return normalizeSnapshotNumber(value, hashVersion);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSnapshotValue(item, hashVersion, depth + 1));
  }
  if (typeof value !== 'object') return null;

  const record: { [key: string]: JsonSnapshot } = {};
  for (const key of Object.keys(value).sort()) {
    const item = (value as Record<string, unknown>)[key];
    if (typeof item === 'function' || typeof item === 'symbol' || typeof item === 'undefined') continue;
    record[key] = normalizeSnapshotValue(item, hashVersion, depth + 1);
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
  if (snapshotScalarsEqual(expected, actual)) return;
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

function snapshotScalarsEqual(expected: JsonSnapshot | undefined, actual: JsonSnapshot | undefined): boolean {
  if (expected === actual) return true;
  return typeof expected === 'number'
    && typeof actual === 'number'
    && Number.isNaN(expected)
    && Number.isNaN(actual);
}

function normalizeSnapshotNumber(value: number, hashVersion: RecordReplayHashVersion): JsonSnapshot {
  if (Number.isNaN(value)) return hashVersion >= 3 ? '[NaN]' : 0;
  if (value === Infinity) return hashVersion >= 3 ? '[Infinity]' : 0;
  if (value === -Infinity) return hashVersion >= 3 ? '[-Infinity]' : 0;
  return normalizeFiniteSnapshotNumber(value, hashVersion >= 4 ? 6 : hashVersion >= 3 ? 9 : 6);
}

function normalizeFiniteSnapshotNumber(value: number, digits: number): number {
  const rounded = roundTo(value, digits);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
