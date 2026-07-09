export interface RecordReplayPlayerPosition {
  x: number;
  z: number;
  y?: number;
}

export interface RecordReplaySnapshotProvider {
  name: string;
  getSnapshot(): unknown;
}

export interface RecordReplayEconomyState {
  cash: number;
  totalEarned: number;
  totalSpent: number;
}

export interface RecordReplayEconomyGateExpectation {
  totalEarned: number;
  totalSpent: number;
}

export interface RecordReplayObservation {
  t: number;
  economy: RecordReplayEconomyState;
  facts: Record<string, number | string | boolean>;
  snapshots: Record<string, unknown>;
  playerPosition: { t: number; x: number; z: number } | null;
}

export interface RecordReplayMilestoneEvent {
  t?: number;
  kind: string;
  detail: Record<string, number | string>;
  economyAtGate?: RecordReplayEconomyGateExpectation;
}

export interface MilestoneDetector {
  kind: string;
  detect(previous: RecordReplayObservation, next: RecordReplayObservation): RecordReplayMilestoneEvent[];
  isSatisfied?(milestone: RecordReplayMilestoneEvent, observation: RecordReplayObservation): boolean;
  getIdentity?(milestone: Pick<RecordReplayMilestoneEvent, 'kind' | 'detail'>): string | null;
}

export interface RegisterRecordReplayProvidersOptions {
  snapshotProviders?: readonly RecordReplaySnapshotProvider[];
  milestoneDetectors?: readonly MilestoneDetector[];
  playerPosition?: (() => RecordReplayPlayerPosition | null | undefined) | null;
}

export interface RecordReplaySnapshotEntry {
  name: string;
  snapshot: unknown;
}

interface Registered<T> {
  id: number;
  value: T;
}

let nextRegistrationId = 1;
const snapshotProviders: Array<Registered<RecordReplaySnapshotProvider>> = [];
const milestoneDetectors: Array<Registered<MilestoneDetector>> = [];
const playerPositionProviders: Array<Registered<() => RecordReplayPlayerPosition | null | undefined>> = [];

export function registerRecordReplayProviders(options: RegisterRecordReplayProvidersOptions): () => void {
  const id = nextRegistrationId++;
  for (const provider of options.snapshotProviders ?? []) {
    snapshotProviders.push({ id, value: provider });
  }
  for (const detector of options.milestoneDetectors ?? []) {
    milestoneDetectors.push({ id, value: detector });
  }
  if (options.playerPosition) {
    playerPositionProviders.push({ id, value: options.playerPosition });
  }

  return () => {
    removeRegistered(snapshotProviders, id);
    removeRegistered(milestoneDetectors, id);
    removeRegistered(playerPositionProviders, id);
  };
}

export function clearRecordReplayProviders(): void {
  snapshotProviders.length = 0;
  milestoneDetectors.length = 0;
  playerPositionProviders.length = 0;
}

export function collectRecordReplaySnapshotEntries(): RecordReplaySnapshotEntry[] {
  const entries: RecordReplaySnapshotEntry[] = [];
  const nameCounts = new Map<string, number>();

  for (const registered of snapshotProviders) {
    const baseName = normalizeProviderName(registered.value.name);
    const count = nameCounts.get(baseName) ?? 0;
    nameCounts.set(baseName, count + 1);
    const name = count === 0 ? baseName : `${baseName}#${count + 1}`;
    entries.push({
      name,
      snapshot: safeGetProviderSnapshot(registered.value),
    });
  }

  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

export function readRecordReplayPlayerPosition(): RecordReplayPlayerPosition | null {
  for (let index = playerPositionProviders.length - 1; index >= 0; index -= 1) {
    const provider = playerPositionProviders[index]?.value;
    if (!provider) continue;
    try {
      const position = provider();
      if (isFinitePlayerPosition(position)) {
        return {
          x: position.x,
          y: typeof position.y === 'number' && Number.isFinite(position.y) ? position.y : 0,
          z: position.z,
        };
      }
    } catch (error) {
      console.warn('[record-replay] player position provider failed:', error);
    }
  }
  return null;
}

export function detectRecordReplayMilestones(
  previous: RecordReplayObservation,
  next: RecordReplayObservation,
): RecordReplayMilestoneEvent[] {
  const events: RecordReplayMilestoneEvent[] = [];
  for (const registered of milestoneDetectors) {
    try {
      for (const event of registered.value.detect(previous, next) ?? []) {
        if (!event || typeof event.kind !== 'string' || !event.kind.trim()) continue;
        events.push({
          ...event,
          kind: event.kind.trim(),
          detail: cloneMilestoneDetail(event.detail),
          economyAtGate: event.economyAtGate ? { ...event.economyAtGate } : undefined,
        });
      }
    } catch (error) {
      events.push({
        kind: 'custom',
        detail: {
          id: `${registered.value.kind}:detector-error`,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
  return events;
}

export function isRecordReplayMilestoneSatisfied(
  milestone: RecordReplayMilestoneEvent,
  observation: RecordReplayObservation,
): boolean {
  for (const registered of milestoneDetectors) {
    if (registered.value.kind !== milestone.kind || !registered.value.isSatisfied) continue;
    try {
      if (registered.value.isSatisfied(milestone, observation)) return true;
    } catch (error) {
      console.warn('[record-replay] milestone satisfaction detector failed:', error);
    }
  }
  return false;
}

export function getRecordReplayMilestoneIdentity(
  milestone: Pick<RecordReplayMilestoneEvent, 'kind' | 'detail'>,
): string {
  for (const registered of milestoneDetectors) {
    if (registered.value.kind !== milestone.kind || !registered.value.getIdentity) continue;
    try {
      const identity = registered.value.getIdentity(milestone);
      if (identity) return `${milestone.kind}:${identity}`;
    } catch (error) {
      console.warn('[record-replay] milestone identity detector failed:', error);
    }
  }
  return `${milestone.kind}:${stableDetailIdentity(milestone.detail)}`;
}

export function readRecordReplayEconomyFromSnapshots(
  snapshots: Record<string, unknown>,
): RecordReplayEconomyState {
  let economy: RecordReplayEconomyState = { cash: 0, totalEarned: 0, totalSpent: 0 };
  for (const snapshot of Object.values(snapshots)) {
    const record = asRecord(snapshot);
    const candidate = asRecord(asRecord(record.recordReplay).economy);
    const direct = Object.keys(candidate).length > 0 ? candidate : asRecord(record.economy);
    if (Object.keys(direct).length <= 0) continue;
    economy = {
      cash: readFiniteNumber(direct.cash, economy.cash),
      totalEarned: readFiniteNumber(direct.totalEarned, economy.totalEarned),
      totalSpent: readFiniteNumber(direct.totalSpent, economy.totalSpent),
    };
  }
  return economy;
}

export function readRecordReplayFactsFromSnapshots(
  snapshots: Record<string, unknown>,
): Record<string, number | string | boolean> {
  const facts: Record<string, number | string | boolean> = {};
  for (const [providerName, snapshot] of Object.entries(snapshots)) {
    const record = asRecord(snapshot);
    const nestedFacts = asRecord(asRecord(record.recordReplay).facts);
    const directFacts = Object.keys(nestedFacts).length > 0 ? nestedFacts : asRecord(record.facts);
    for (const [key, value] of Object.entries(directFacts)) {
      if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        facts[`${providerName}.${key}`] = value;
      }
    }
  }
  return facts;
}

function removeRegistered<T>(items: Array<Registered<T>>, id: number): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.id === id) items.splice(index, 1);
  }
}

function normalizeProviderName(name: string): string {
  const normalized = String(name ?? '').trim();
  return normalized.length > 0 ? normalized : 'unnamed';
}

function safeGetProviderSnapshot(provider: RecordReplaySnapshotProvider): unknown {
  try {
    return provider.getSnapshot();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function isFinitePlayerPosition(value: unknown): value is RecordReplayPlayerPosition {
  const candidate = value as RecordReplayPlayerPosition | null | undefined;
  return typeof candidate?.x === 'number'
    && Number.isFinite(candidate.x)
    && typeof candidate.z === 'number'
    && Number.isFinite(candidate.z);
}

function cloneMilestoneDetail(detail: Record<string, number | string> | undefined): Record<string, number | string> {
  const clone: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(detail ?? {})) {
    if (typeof value === 'number' || typeof value === 'string') clone[key] = value;
  }
  return clone;
}

function stableDetailIdentity(detail: Record<string, number | string>): string {
  return Object.keys(detail)
    .sort()
    .map((key) => `${key}=${String(detail[key])}`)
    .join('|');
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
