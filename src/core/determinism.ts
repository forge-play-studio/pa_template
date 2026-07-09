export interface DeterminismContext {
  seed: number;
  elapsedTimeSec: number;
  random: (caller?: string) => number;
  deriveRandom(streamName: string): () => number;
  getRandomStats(): DeterminismRandomStats;
  advance(deltaTimeSec: number): void;
}

export interface DeterminismRandomStats {
  total: number;
  byCaller: Record<string, number>;
}

export function createDeterminismContext(seed: number): DeterminismContext {
  const normalizedSeed = normalizeSeed(seed);
  let elapsedTimeSec = 0;
  let randomTotal = 0;
  const randomByCaller = new Map<string, number>();
  const derivedStreams = new Map<string, () => number>();
  const legacyRandom = createSeededRandom(normalizedSeed);

  const recordRandomConsumption = (caller: string): void => {
    randomTotal += 1;
    randomByCaller.set(caller, (randomByCaller.get(caller) ?? 0) + 1);
  };

  return {
    seed: normalizedSeed,
    get elapsedTimeSec() { return elapsedTimeSec; },
    random(caller = 'context.random') {
      recordRandomConsumption(caller);
      return legacyRandom();
    },
    deriveRandom(streamName: string): () => number {
      const normalizedStreamName = normalizeStreamName(streamName);
      const existing = derivedStreams.get(normalizedStreamName);
      if (existing) return existing;

      const streamSeed = hashString(`${normalizedSeed}:${normalizedStreamName}`);
      const random = createSeededRandom(streamSeed);
      const countedRandom = (): number => {
        recordRandomConsumption(normalizedStreamName);
        return random();
      };
      derivedStreams.set(normalizedStreamName, countedRandom);
      return countedRandom;
    },
    getRandomStats(): DeterminismRandomStats {
      const byCaller: Record<string, number> = {};
      for (const [caller, count] of [...randomByCaller.entries()].sort(([left], [right]) => left.localeCompare(right))) {
        byCaller[caller] = count;
      }
      return { total: randomTotal, byCaller };
    },
    advance(deltaTimeSec: number): void {
      if (!Number.isFinite(deltaTimeSec) || deltaTimeSec <= 0) return;
      elapsedTimeSec += deltaTimeSec;
    },
  };
}

export function createSeededRandom(seed: number): () => number {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) return 1;
  return seed >>> 0;
}

function normalizeStreamName(streamName: string): string {
  const normalized = String(streamName ?? '').trim();
  return normalized.length > 0 ? normalized : 'unnamed';
}

function hashString(value: string): number {
  let state = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    state ^= value.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}
