export type SafeSerializeOptions = {
  maxDepth?: number;
  maxKeys?: number;
  maxArray?: number;
  maxString?: number;
};

export function safeSerialize(value: unknown, options: SafeSerializeOptions = {}): unknown {
  const maxDepth = clampInteger(options.maxDepth, 0, 8, 3);
  const maxKeys = clampInteger(options.maxKeys, 1, 200, 32);
  const maxArray = clampInteger(options.maxArray, 1, 200, 24);
  const maxString = clampInteger(options.maxString, 8, 2_000, 240);
  const seen = new WeakSet<object>();

  const visit = (current: unknown, depth: number): unknown => {
    if (current === null || current === undefined) return current;
    if (typeof current === 'number' || typeof current === 'boolean') return current;
    if (typeof current === 'string') {
      return current.length > maxString ? `${current.slice(0, maxString)}…` : current;
    }
    if (typeof current === 'function') return '<function>';
    if (typeof current !== 'object') return String(current);
    if (seen.has(current)) return '<circular>';
    seen.add(current);

    const record = current as Record<string, unknown>;
    const getClassName = record.getClassName;
    if (depth > 0 && typeof getClassName === 'function') {
      return {
        __class: String(getClassName.call(current)),
        name: readOptionalString(record.name),
        uniqueId: readOptionalPrimitive(record.uniqueId),
      };
    }

    if (depth >= maxDepth) return '<depth-limit>';
    if (ArrayBuffer.isView(current)) {
      const view = current as unknown as { length: number; [index: number]: unknown };
      const values = Array.from({ length: Math.min(view.length, maxArray) }, (_, index) => visit(view[index], depth + 1));
      return view.length > maxArray ? { values, truncated: view.length - maxArray } : values;
    }
    if (Array.isArray(current)) {
      const values = current.slice(0, maxArray).map(entry => visit(entry, depth + 1));
      if (current.length > maxArray) values.push(`<+${current.length - maxArray} items>`);
      return values;
    }

    const output: Record<string, unknown> = {};
    const keys = Object.keys(record).sort();
    for (const key of keys.slice(0, maxKeys)) {
      try {
        output[key] = visit(record[key], depth + 1);
      } catch (error) {
        output[key] = `<error:${error instanceof Error ? error.message : String(error)}>`;
      }
    }
    if (keys.length > maxKeys) output['…'] = `${keys.length - maxKeys} more keys`;
    return output;
  };

  return visit(value, 0);
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value!)));
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readOptionalPrimitive(value: unknown): string | number | null {
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}
