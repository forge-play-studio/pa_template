export interface DeterminismContext {
  seed: number;
  random: () => number;
}

export function createDeterminismContext(seed: number): DeterminismContext {
  return {
    seed: normalizeSeed(seed),
    random: createSeededRandom(seed),
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
