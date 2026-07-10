/**
 * Client transport for the dev-server tape landing channel (`vite-plugins/tapeServer.ts`).
 *
 * Game-agnostic. Knows only about opaque frames / stateHashes / envelope blobs.
 *
 * Two write modes, because the unload path has a hard size budget:
 *   - `finalizeFull`     normal Stop. Ships the complete DemoRecording (trail + stateSamples
 *                        included) over a regular fetch. The server stores it verbatim.
 *   - `finalizeCompose`  unload / CTA path. Ships only the frames since the last checkpoint and
 *                        lets the server splice them onto `frames.jsonl`. Small enough for
 *                        `navigator.sendBeacon`, which is the only request that reliably survives
 *                        a navigation.
 */

const DEFAULT_BASE_URL = '/__demo-tape';
/** navigator.sendBeacon is capped (~64KB in Chrome). Fall back to keepalive fetch above this. */
const BEACON_BYTE_BUDGET = 60_000;
/**
 * The beacon quota is **per page, across all in-flight beacons** — not per call. Firing
 * append+append+finalize synchronously can therefore have the *last* one rejected, and the
 * keepalive-fetch fallback dies with the navigation. Measured in qy-blade-goldrush (113fps, ~4s
 * tail): append 29,062 B ok, append 30,320 B ok, finalize 23,201 B **rejected** → tape never
 * finalized. So budget the whole flush, and always keep room for the finalize.
 */
const BEACON_TOTAL_BUDGET = 60_000;
/** A frames-less compose finalize is a few hundred bytes; reserve comfortably more. */
const BEACON_FINALIZE_RESERVE = 4_000;
/** A hung dev server must not leave the availability probe pending forever. */
const PING_TIMEOUT_MS = 2_000;
/**
 * Frames per unload beacon. A checkpoint tail now carries frames + hashes + trail + state samples,
 * so a 5s tail at high refresh rates can exceed the beacon cap. Chunk it and let the server splice.
 */
const MAX_BEACON_FRAMES = 200;

export interface TapeSinkSession {
  sessionId: string;
  startedAt: string;
  seed: number | null;
  label: string | null;
  frames: number;
  finalized: boolean;
  dir: string;
  tapePath: string | null;
}

export interface TapeSinkFinalizeResult {
  ok: boolean;
  frames: number;
  tapePath: string | null;
  relativePath: string | null;
}

/** Everything a tape needs, sliced to `[fromIndex, fromIndex + frames.length)`. */
export interface TapeChunk {
  fromIndex: number;
  frames: unknown[];
  stateHashes: string[];
  /** Per-frame [x, z]; null when unavailable for the slice. */
  trail: Array<[number, number]> | null;
  /** Sparse; each carries its own absolute `frame`. */
  stateSamples: Array<{ frame: number }>;
}

export interface TapeSink {
  readonly baseUrl: string;
  ping(): Promise<boolean>;
  begin(sessionId: string, envelope: unknown): Promise<void>;
  append(sessionId: string, chunk: TapeChunk): Promise<number>;
  finalizeFull(sessionId: string, recording: unknown): Promise<TapeSinkFinalizeResult>;
  /** `beacon: true` makes this survive an in-flight navigation (CTA / reload). */
  finalizeCompose(
    sessionId: string,
    envelope: unknown,
    chunk: TapeChunk,
    options?: { beacon?: boolean },
  ): Promise<TapeSinkFinalizeResult> | boolean;
  appendBeacon(sessionId: string, chunk: TapeChunk): boolean;
  listSessions(): Promise<TapeSinkSession[]>;
}

/** Split a chunk into beacon-sized pieces, keeping trail and samples aligned to their frames. */
export function splitTapeChunk(chunk: TapeChunk, maxFrames = MAX_BEACON_FRAMES): TapeChunk[] {
  if (chunk.frames.length <= maxFrames) return [chunk];
  const pieces: TapeChunk[] = [];
  for (let offset = 0; offset < chunk.frames.length; offset += maxFrames) {
    const end = Math.min(offset + maxFrames, chunk.frames.length);
    const start = chunk.fromIndex + offset;
    const stop = chunk.fromIndex + end;
    pieces.push({
      fromIndex: start,
      frames: chunk.frames.slice(offset, end),
      stateHashes: chunk.stateHashes.slice(offset, end),
      trail: chunk.trail ? chunk.trail.slice(offset, end) : null,
      stateSamples: chunk.stateSamples.filter((s) => s.frame >= start && s.frame < stop),
    });
  }
  return pieces;
}

export function createHttpTapeSink(baseUrl: string = DEFAULT_BASE_URL): TapeSink {
  const post = async (route: string, payload: unknown): Promise<Record<string, unknown>> => {
    const response = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await response.json()) as Record<string, unknown>;
    if (!response.ok || json.ok !== true) {
      throw new Error(`${route} failed: ${String(json.error ?? response.status)}`);
    }
    return json;
  };

  /** Best-effort unload-safe POST. Returns false if neither transport accepted the payload. */
  const postUnloadSafe = (route: string, payload: unknown): boolean => {
    const body = JSON.stringify(payload);
    const url = `${baseUrl}${route}`;
    if (body.length <= BEACON_BYTE_BUDGET && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return true;
    }
    try {
      // keepalive keeps the request alive across the navigation; also has a ~64KB cap in Chrome,
      // but it is the best remaining option and failure here is non-fatal (checkpoints survive).
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Ship tail pieces as `/append` beacons until the byte budget runs out.
   * Returns the absolute frame index actually persisted, so the caller can set `expectFrames`
   * to something the server can actually reach (otherwise it stalls for `waitForFrames`).
   */
  const shipTailWithinBeaconBudget = (
    sessionId: string,
    chunk: TapeChunk,
    budgetBytes: number,
  ): { shippedFrames: number; shippedAll: boolean } => {
    let remaining = budgetBytes;
    let shippedFrames = chunk.fromIndex;
    for (const piece of splitTapeChunk(chunk)) {
      const bytes = JSON.stringify({ sessionId, ...piece }).length;
      if (bytes > remaining) return { shippedFrames, shippedAll: false };
      if (!postUnloadSafe('/append', { sessionId, ...piece })) {
        return { shippedFrames, shippedAll: false };
      }
      remaining -= bytes;
      shippedFrames = piece.fromIndex + piece.frames.length;
    }
    return { shippedFrames, shippedAll: true };
  };

  return {
    baseUrl,

    async ping(): Promise<boolean> {
      const abort = new AbortController();
      const timer = window.setTimeout(() => abort.abort(), PING_TIMEOUT_MS);
      try {
        const response = await fetch(`${baseUrl}/ping`, { method: 'GET', signal: abort.signal });
        if (!response.ok) return false;
        const json = (await response.json()) as { ok?: boolean };
        return json.ok === true;
      } catch {
        return false;
      } finally {
        window.clearTimeout(timer);
      }
    },

    async begin(sessionId, envelope) {
      await post('/begin', { sessionId, envelope });
    },

    async append(sessionId, chunk) {
      if (chunk.frames.length === 0) return 0;
      const json = await post('/append', { sessionId, ...chunk });
      return Number(json.written ?? 0);
    },

    appendBeacon(sessionId, chunk) {
      if (chunk.frames.length === 0) return true;
      return shipTailWithinBeaconBudget(sessionId, chunk, BEACON_TOTAL_BUDGET).shippedAll;
    },

    async finalizeFull(sessionId, recording) {
      const json = await post('/finalize', { sessionId, mode: 'full', recording });
      return readFinalizeResult(json);
    },

    finalizeCompose(sessionId, envelope, chunk, options = {}) {
      if (!options.beacon) {
        const expectFrames = chunk.fromIndex + chunk.frames.length;
        return post('/finalize', { sessionId, mode: 'compose', envelope, expectFrames, ...chunk })
          .then(readFinalizeResult);
      }
      // Unload path. Ship the tail as plain `/append` beacons, reserving quota for a **frames-less**
      // finalize: the server composes from `frames.jsonl`, so finalize only needs the envelope and
      // `expectFrames`. Keeping it small is what makes the tape close at all — a rejected finalize
      // beacon means the session is left un-finalized forever.
      //
      // If the tail exceeds the quota we ship what fits and finalize anyway: a slightly truncated
      // tape that exists beats a complete one that was never written.
      const { shippedFrames } = shipTailWithinBeaconBudget(
        sessionId,
        chunk,
        BEACON_TOTAL_BUDGET - BEACON_FINALIZE_RESERVE,
      );
      return postUnloadSafe('/finalize', {
        sessionId,
        mode: 'compose',
        envelope,
        expectFrames: shippedFrames,
        fromIndex: shippedFrames,
        frames: [],
        stateHashes: [],
        trail: null,
        stateSamples: [],
      });
    },

    async listSessions() {
      try {
        const response = await fetch(`${baseUrl}/sessions`, { method: 'GET' });
        if (!response.ok) return [];
        const json = (await response.json()) as { sessions?: TapeSinkSession[] };
        return json.sessions ?? [];
      } catch {
        return [];
      }
    },
  };
}

function readFinalizeResult(json: Record<string, unknown>): TapeSinkFinalizeResult {
  return {
    ok: true,
    frames: Number(json.frames ?? 0),
    tapePath: typeof json.tapePath === 'string' ? json.tapePath : null,
    relativePath: typeof json.relativePath === 'string' ? json.relativePath : null,
  };
}

/** Browser-download fallback used when the dev-server channel is unreachable. */
export function downloadTapeFallback(recording: unknown, filename: string, doc: Document = document): void {
  const blob = new Blob([JSON.stringify(recording)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
