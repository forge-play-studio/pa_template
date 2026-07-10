import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Dev-only tape landing channel.
 *
 * Game-agnostic: this plugin knows nothing about qy — it only persists opaque `frames` /
 * `stateHashes` arrays plus an envelope blob. Safe to copy verbatim into any pa_template game.
 *
 * Why a server channel at all: a browser-side recording lives in memory. A refresh, a CTA
 * navigation, a crash or simply forgetting to press Export loses the whole session. Streaming
 * append-only checkpoints to disk means the worst case is losing the last checkpoint interval.
 *
 * Durability model:
 *   - `begin`    writes `sessions/<id>/meta.json` (the envelope draft)
 *   - `append`   appends NDJSON lines to `sessions/<id>/frames.jsonl` (crash-safe by construction)
 *   - `finalize` composes (or accepts) a complete DemoRecording and writes `<id>.tape.json`
 *
 * A dev-server restart loses nothing already appended: the frame counter is rebuilt by counting
 * lines in `frames.jsonl` on first touch.
 *
 * Route prefix is deliberately `__demo-tape` (not `__rr` / `record-replay`) so no forbidden
 * production-debug token can ever reach `dist/` through a URL string.
 */

const ROUTE_PREFIX = '/__demo-tape';
const MAX_BODY_BYTES = 512 * 1024 * 1024;

export interface TapeServerPluginOptions {
  /** Directory (relative to project root) where tapes land. Default `.rr-tapes`. */
  outDir?: string;
  projectRoot?: string;
}

interface SessionMeta {
  sessionId: string;
  startedAt: string;
  envelope: Record<string, unknown>;
}

interface FrameLine {
  frame: number;
  dt: number;
  input: unknown;
  hash: string | null;
  /** Player [x, z] for this frame. Needed to rebuild `recording.trail` (semantic waypoints). */
  pos: [number, number] | null;
}

interface SampleLine {
  frame: number;
  [key: string]: unknown;
}

/** Composing must not race an append beacon that the browser fired moments earlier. */
const FINALIZE_WAIT_TIMEOUT_MS = 1_500;
const FINALIZE_WAIT_POLL_MS = 25;

export function tapeServerPlugin(options: TapeServerPluginOptions = {}): Plugin {
  const projectRoot = options.projectRoot ?? process.cwd();
  const outRoot = resolve(projectRoot, options.outDir ?? '.rr-tapes');
  const sessionsRoot = join(outRoot, 'sessions');
  /** sessionId -> frames already persisted. Rebuilt from disk on first touch after a restart. */
  const writtenFrames = new Map<string, number>();

  const sessionDir = (id: string): string => join(sessionsRoot, id);
  const framesPath = (id: string): string => join(sessionDir(id), 'frames.jsonl');
  const samplesPath = (id: string): string => join(sessionDir(id), 'samples.jsonl');
  const eventsPath = (id: string): string => join(sessionDir(id), 'events.jsonl');
  const metaPath = (id: string): string => join(sessionDir(id), 'meta.json');
  const finalizedPath = (id: string): string => join(sessionDir(id), 'finalized.json');
  const tapePath = (id: string): string => join(outRoot, `${id}.tape.json`);

  const countPersistedFrames = (id: string): number => {
    const cached = writtenFrames.get(id);
    if (cached !== undefined) return cached;
    const path = framesPath(id);
    if (!existsSync(path)) {
      writtenFrames.set(id, 0);
      return 0;
    }
    // Rebuild after a dev-server restart.
    const text = readFileSync(path, 'utf8');
    const count = text.length === 0 ? 0 : text.split('\n').filter((line) => line.trim().length > 0).length;
    writtenFrames.set(id, count);
    return count;
  };

  const readFrameLines = (id: string): FrameLine[] => {
    const path = framesPath(id);
    if (!existsSync(path)) return [];
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as FrameLine);
  };

  /** State samples are sparse and may arrive twice (retried beacon); keep the last per frame. */
  const readSampleLines = (id: string): SampleLine[] => {
    const path = samplesPath(id);
    if (!existsSync(path)) return [];
    const byFrame = new Map<number, SampleLine>();
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const sample = JSON.parse(line) as SampleLine;
      byFrame.set(Number(sample.frame), sample);
    }
    return [...byFrame.values()].sort((left, right) => left.frame - right.frame);
  };

  /** Detector events are append-only and frame-indexed, exactly like samples. */
  const readEventLines = (id: string): unknown[] => {
    const path = eventsPath(id);
    if (!existsSync(path)) return [];
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as unknown);
  };

  const appendEventLines = (id: string, events: unknown[]): void => {
    if (events.length === 0) return;
    appendFileSync(eventsPath(id), `${events.map((e) => JSON.stringify(e)).join('\n')}\n`);
  };

  const appendSampleLines = (id: string, samples: unknown[]): void => {
    if (!Array.isArray(samples) || samples.length === 0) return;
    appendFileSync(samplesPath(id), `${samples.map((s) => JSON.stringify(s)).join('\n')}\n`);
  };

  return {
    name: 'demo-tape-server',
    apply: 'serve',
    configureServer(server) {
      mkdirSync(sessionsRoot, { recursive: true });
      server.config.logger.info(`  ➜  demo tapes:  ${outRoot}`);

      server.middlewares.use(ROUTE_PREFIX, (req, res) => {
        const url = (req.url ?? '/').split('?')[0] ?? '/';
        void handle(url, req, res).catch((error: unknown) => {
          sendJson(res, 500, { ok: false, error: errorText(error) });
        });
      });

      async function handle(url: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (url === '/ping') {
          sendJson(res, 200, { ok: true, outDir: outRoot });
          return;
        }

        if (url === '/sessions' && req.method === 'GET') {
          sendJson(res, 200, { ok: true, sessions: listSessions() });
          return;
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: `Unsupported ${req.method} ${url}` });
          return;
        }

        const body = await readJsonBody(req);

        if (url === '/begin') return begin(res, body);
        if (url === '/append') return append(res, body);
        if (url === '/finalize') return finalize(res, body);
        if (url === '/discard') return discard(res, body);

        sendJson(res, 404, { ok: false, error: `Unknown route ${url}` });
      }

      function begin(res: ServerResponse, body: Record<string, unknown>): void {
        const sessionId = requireSessionId(body.sessionId);
        const dir = sessionDir(sessionId);
        mkdirSync(dir, { recursive: true });
        const meta: SessionMeta = {
          sessionId,
          startedAt: new Date().toISOString(),
          envelope: (body.envelope ?? {}) as Record<string, unknown>,
        };
        writeFileSync(metaPath(sessionId), JSON.stringify(meta, null, 2));
        writeFileSync(framesPath(sessionId), '');
        writeFileSync(samplesPath(sessionId), '');
        writeFileSync(eventsPath(sessionId), '');
        writtenFrames.set(sessionId, 0);
        sendJson(res, 200, { ok: true, sessionId, dir, written: 0 });
      }

      function append(res: ServerResponse, body: Record<string, unknown>): void {
        const sessionId = requireSessionId(body.sessionId);
        if (!existsSync(sessionDir(sessionId))) {
          sendJson(res, 404, { ok: false, error: `Unknown session ${sessionId}` });
          return;
        }
        const written = countPersistedFrames(sessionId);
        const fromIndex = Number(body.fromIndex ?? 0);
        const frames = Array.isArray(body.frames) ? body.frames : [];
        const stateHashes = Array.isArray(body.stateHashes) ? body.stateHashes : [];

        if (fromIndex > written) {
          // Gap — the client is ahead of disk. Tell it where to resume from.
          sendJson(res, 409, { ok: false, error: 'frame gap', written });
          return;
        }

        const trail = Array.isArray(body.trail) ? body.trail : null;

        // Overlap is normal (a retried beacon). Skip what is already on disk.
        const skip = written - fromIndex;
        const appended = appendFrameLines(
          sessionId,
          frames.slice(skip),
          stateHashes.slice(skip),
          trail ? trail.slice(skip) : null,
        );
        appendSampleLines(sessionId, (body.stateSamples as unknown[] ?? []).filter(
          (sample) => Number((sample as SampleLine)?.frame) >= written,
        ));
        appendEventLines(sessionId, (body.events as unknown[] ?? []).filter(
          (event) => Number((event as { frame?: number })?.frame) >= written,
        ));
        sendJson(res, 200, { ok: true, sessionId, written: written + appended, appended });
      }

      function appendFrameLines(
        sessionId: string,
        frames: unknown[],
        stateHashes: unknown[],
        trail: unknown[] | null,
      ): number {
        if (frames.length === 0) return 0;
        const lines = frames.map((frame, index) => {
          const record = frame as { frame?: number; dt?: number; input?: unknown };
          const point = trail?.[index] as [number, number] | undefined;
          const line: FrameLine = {
            frame: Number(record.frame ?? 0),
            dt: Number(record.dt ?? 0),
            input: record.input ?? null,
            hash: typeof stateHashes[index] === 'string' ? (stateHashes[index] as string) : null,
            pos: Array.isArray(point) && point.length === 2 ? [Number(point[0]), Number(point[1])] : null,
          };
          return JSON.stringify(line);
        });
        appendFileSync(framesPath(sessionId), `${lines.join('\n')}\n`);
        writtenFrames.set(sessionId, countPersistedFrames(sessionId) + frames.length);
        return frames.length;
      }

      async function finalize(res: ServerResponse, body: Record<string, unknown>): Promise<void> {
        const sessionId = requireSessionId(body.sessionId);
        const mode = body.mode === 'full' ? 'full' : 'compose';

        let recording: Record<string, unknown>;
        if (mode === 'full') {
          recording = body.recording as Record<string, unknown>;
          if (!recording || !Array.isArray(recording.frames)) {
            sendJson(res, 400, { ok: false, error: 'finalize(full) requires recording.frames' });
            return;
          }
        } else {
          // Compose from what is on disk + whatever tail the client managed to ship.
          if (!existsSync(sessionDir(sessionId))) {
            sendJson(res, 404, { ok: false, error: `Unknown session ${sessionId}` });
            return;
          }
          const fromIndex = Number(body.fromIndex ?? countPersistedFrames(sessionId));
          const tailFrames = Array.isArray(body.frames) ? body.frames : [];
          const tailHashes = Array.isArray(body.stateHashes) ? body.stateHashes : [];
          const tailTrail = Array.isArray(body.trail) ? body.trail : null;
          const written = countPersistedFrames(sessionId);
          const skip = Math.max(0, written - fromIndex);
          appendFrameLines(
            sessionId,
            tailFrames.slice(skip),
            tailHashes.slice(skip),
            tailTrail ? tailTrail.slice(skip) : null,
          );
          appendSampleLines(sessionId, (body.stateSamples as unknown[] ?? []).filter(
            (sample) => Number((sample as SampleLine)?.frame) >= written,
          ));
          appendEventLines(sessionId, (body.events as unknown[] ?? []).filter(
            (event) => Number((event as { frame?: number })?.frame) >= written,
          ));

          // Unload beacons are fired in order but served concurrently; wait for any still-in-flight
          // append so the composed tape is not silently truncated.
          const expectFrames = Number(body.expectFrames ?? 0);
          if (expectFrames > 0) await waitForFrames(sessionId, expectFrames);

          const lines = readFrameLines(sessionId);
          const samples = readSampleLines(sessionId);
          const events = readEventLines(sessionId);
          const meta = JSON.parse(readFileSync(metaPath(sessionId), 'utf8')) as SessionMeta;
          const envelope = {
            ...meta.envelope,
            ...((body.envelope as Record<string, unknown>) ?? {}),
            frames: lines.length,
          };
          // `trail` must be dense (one point per frame) or absent — a partial trail would silently
          // mis-align waypoints against frame times.
          const trail = lines.every((line) => Array.isArray(line.pos))
            ? lines.map((line) => line.pos as [number, number])
            : null;
          recording = {
            envelope,
            frames: lines.map((line) => ({ frame: line.frame, dt: line.dt, input: line.input })),
            stateHashes: lines.map((line) => line.hash ?? ''),
            events,
            ...(trail ? { trail } : {}),
            ...(samples.length > 0 ? { stateSamples: samples } : {}),
          };
        }

        const path = tapePath(sessionId);
        writeFileSync(path, JSON.stringify(recording));
        const frameCount = (recording.frames as unknown[]).length;
        writeFileSync(finalizedPath(sessionId), JSON.stringify({
          tapePath: path,
          frames: frameCount,
          finalizedAt: new Date().toISOString(),
          mode,
        }, null, 2));

        sendJson(res, 200, {
          ok: true,
          sessionId,
          frames: frameCount,
          trail: Array.isArray(recording.trail) ? (recording.trail as unknown[]).length : 0,
          stateSamples: Array.isArray(recording.stateSamples) ? (recording.stateSamples as unknown[]).length : 0,
          tapePath: path,
          relativePath: path.startsWith(projectRoot) ? path.slice(projectRoot.length + 1) : path,
        });
      }

      async function waitForFrames(sessionId: string, expectFrames: number): Promise<void> {
        const deadline = Date.now() + FINALIZE_WAIT_TIMEOUT_MS;
        while (countPersistedFrames(sessionId) < expectFrames && Date.now() < deadline) {
          writtenFrames.delete(sessionId);   // force a re-count from disk
          if (countPersistedFrames(sessionId) >= expectFrames) return;
          await new Promise((resolvePromise) => setTimeout(resolvePromise, FINALIZE_WAIT_POLL_MS));
        }
      }

      function discard(res: ServerResponse, body: Record<string, unknown>): void {
        const sessionId = requireSessionId(body.sessionId);
        rmSync(sessionDir(sessionId), { recursive: true, force: true });
        writtenFrames.delete(sessionId);
        sendJson(res, 200, { ok: true, sessionId });
      }

      function listSessions(): unknown[] {
        if (!existsSync(sessionsRoot)) return [];
        return readdirSync(sessionsRoot)
          .filter((id) => existsSync(metaPath(id)))
          .map((id) => {
            const meta = JSON.parse(readFileSync(metaPath(id), 'utf8')) as SessionMeta;
            const finalized = existsSync(finalizedPath(id));
            return {
              sessionId: id,
              startedAt: meta.startedAt,
              seed: meta.envelope?.seed ?? null,
              label: meta.envelope?.label ?? null,
              frames: countPersistedFrames(id),
              finalized,
              dir: sessionDir(id),
              tapePath: finalized ? tapePath(id) : null,
            };
          })
          .sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)));
      }
    },
  };
}

function requireSessionId(value: unknown): string {
  const id = String(value ?? '').trim();
  if (!id || !/^[A-Za-z0-9._-]{1,120}$/.test(id)) {
    throw new Error(`Invalid sessionId: ${JSON.stringify(value)}`);
  }
  return id;
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectPromise(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) {
        resolvePromise({});
        return;
      }
      try {
        resolvePromise(JSON.parse(text) as Record<string, unknown>);
      } catch (error) {
        rejectPromise(new Error(`Invalid JSON body: ${errorText(error)}`));
      }
    });
    req.on('error', rejectPromise);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const text = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(text);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
