import type { Disposable } from '../framework/disposables';
import {
  createHttpTapeSink,
  downloadTapeFallback,
  type TapeChunk,
  type TapeSink,
  type TapeSinkSession,
} from './tape-sink';

/**
 * Owns the *lifeline* of a human demo recording: nothing about the tape may depend on the operator
 * remembering to do something.
 *
 *   arm ──▶ checkpoint every N seconds ──▶ finalize on Stop
 *            │                              ▲
 *            ├─ pagehide / beforeunload ────┤ (best-effort tail flush via sendBeacon)
 *            └─ CTA navigation ─────────────┘ (synchronous stopRec + beacon finalize)
 *
 * Worst case data loss is one checkpoint interval. A tape that was never finalized still leaves
 * `sessions/<id>/frames.jsonl` on disk, and `listResidue()` surfaces it on the next page load.
 *
 * Game-agnostic. The only game-specific seam is `registerBeforeNavigate` (wired to the project's
 * CTA funnel by the caller).
 */

const DEFAULT_CHECKPOINT_INTERVAL_MS = 5_000;
/**
 * Also checkpoint whenever this many frames have piled up since the last one.
 *
 * The interval alone was tuned for ~60fps. At 113fps (measured in qy-blade-goldrush) a 5s tail is
 * ~565 frames ≈ 82KB — larger than `navigator.sendBeacon`'s whole ~64KB per-page quota, so the
 * unload/CTA flush could not ship it and the tape was left un-finalized. Capping the tail by frame
 * count keeps every unload path inside the quota regardless of refresh rate.
 */
const DEFAULT_CHECKPOINT_MAX_FRAMES = 300;
const STATUS_POLL_INTERVAL_MS = 250;
/** ~55 min @60fps. RecorderSource defaults to 20k (≈5.5 min) and then ring-buffers — far too small. */
const DEFAULT_MAX_FRAMES = 200_000;

/** Structural subset of RecordReplayAgentApi — keeps this module decoupled from the panel. */
export interface DemoRecordingApiLike {
  getState(): { status: string; lastRecordingFrames: number; seed: number | null };
  startRec(options?: { label?: string; maxFrames?: number }): {
    seed: number;
    anchorFrame: number;
    startStateHash: string;
    warning: string | null;
  };
  stopRec(label?: string): {
    envelope: { seed: number; label: string; frames: number };
    frames: unknown[];
    stateHashes: string[];
    trail?: Array<[number, number]> | null;
    stateSamples?: Array<{ frame: number }>;
    events?: Array<{ frame: number }>;
  };
  peekRec(fromIndex?: number): {
    envelope: unknown;
    fromIndex: number;
    totalFrames: number;
    frames: unknown[];
    stateHashes: string[];
    trail: Array<[number, number]> | null;
    stateSamples: Array<{ frame: number }>;
    events: Array<{ frame: number }>;
    droppedFrames: number;
  } | null;
}

export type DemoRecordingPhase = 'idle' | 'recording' | 'stopped' | 'foreign';

export interface DemoRecordingStatus {
  phase: DemoRecordingPhase;
  /** `__rr.getState().status` verbatim — 'replaying' / 'benchmarking' etc. when not ours. */
  foreignStatus: string | null;
  frames: number;
  elapsedSec: number;
  seed: number | null;
  sessionId: string | null;
  checkpointedFrames: number;
  savedPath: string | null;
  downloaded: boolean;
  sinkAvailable: boolean;
  lastError: string | null;
  residue: TapeSinkSession[];
}

export interface DemoRecordingControllerOptions {
  getApi: () => DemoRecordingApiLike | undefined;
  sink?: TapeSink;
  checkpointIntervalMs?: number;
  /** Force a checkpoint once this many frames are uncheckpointed, regardless of the interval. */
  checkpointMaxFrames?: number;
  maxFrames?: number;
  /** Game wiring: called with a synchronous hook that must run before the CTA navigates away. */
  registerBeforeNavigate?: (hook: () => void) => () => void;
  onChange?: (status: DemoRecordingStatus) => void;
}

export interface DemoRecordingController extends Disposable {
  start(label?: string): Promise<void>;
  stop(): Promise<void>;
  getStatus(): DemoRecordingStatus;
  refreshResidue(): Promise<void>;
  /** Hide a leftover session from the HUD. Local only — the files stay on disk. */
  dismissResidue(sessionId: string): void;
}

export function createDemoRecordingController(
  options: DemoRecordingControllerOptions,
): DemoRecordingController {
  const sink = options.sink ?? createHttpTapeSink();
  const checkpointIntervalMs = options.checkpointIntervalMs ?? DEFAULT_CHECKPOINT_INTERVAL_MS;
  const checkpointMaxFrames = Math.max(1, options.checkpointMaxFrames ?? DEFAULT_CHECKPOINT_MAX_FRAMES);
  const maxFrames = options.maxFrames ?? DEFAULT_MAX_FRAMES;

  let phase: DemoRecordingPhase = 'idle';
  let sessionId: string | null = null;
  let startedAtMs = 0;
  let stoppedElapsedSec = 0;
  let frames = 0;
  let checkpointedFrames = 0;
  let seed: number | null = null;
  let savedPath: string | null = null;
  let downloaded = false;
  let sinkAvailable = false;
  let lastError: string | null = null;
  let residue: TapeSinkSession[] = [];
  let checkpointInFlight = false;
  let lastEnvelope: unknown = null;
  /** Resolves once ping+begin settled. `start()` must NOT await this (see below). */
  let sinkHandshake: Promise<void> | null = null;

  const emit = (): void => options.onChange?.(getStatus());

  function getStatus(): DemoRecordingStatus {
    const api = options.getApi();
    const foreign = api?.getState().status ?? null;
    const resolvedPhase: DemoRecordingPhase = phase === 'idle' && foreign && foreign !== 'idle'
      ? 'foreign'
      : phase;
    return {
      phase: resolvedPhase,
      foreignStatus: resolvedPhase === 'foreign' ? foreign : null,
      frames,
      elapsedSec: phase === 'recording' ? (performance.now() - startedAtMs) / 1000 : stoppedElapsedSec,
      seed,
      sessionId,
      checkpointedFrames,
      savedPath,
      downloaded,
      sinkAvailable,
      lastError,
      residue,
    };
  }

  /**
   * Arms the recording. Returns as soon as the recorder is live.
   *
   * The sink handshake (ping + begin) deliberately runs *off* the critical path: `rrAutoStart`
   * pauses the game, calls `start()`, then resumes. Awaiting a network round-trip here means a slow
   * or hung dev server freezes the game after "arming" — observed with a stalled /ping. Recording is
   * armed synchronously by `startRec()`, so resuming immediately is safe; checkpointing simply
   * begins once the handshake lands (the first checkpoint ships everything from frame 0).
   */
  async function start(label = 'demo'): Promise<void> {
    const api = requireApi();
    if (phase === 'recording') return;
    lastError = null;
    savedPath = null;
    downloaded = false;
    checkpointedFrames = 0;
    frames = 0;
    sinkAvailable = false;

    const started = api.startRec({ label, maxFrames });
    seed = started.seed;
    phase = 'recording';
    startedAtMs = performance.now();
    sessionId = makeSessionId(label, started.seed);
    // Manual arming on an already-running game anchors past frame 0; Mode A replay then needs the
    // same frame offset. Surface it rather than letting the operator find out at replay time.
    if (started.warning) lastError = started.warning;
    emit();

    const activeSession = sessionId;
    sinkHandshake = (async () => {
      const available = await sink.ping();
      if (sessionId !== activeSession) return;
      if (!available) {
        sinkAvailable = false;
        lastError = '落盘通道不可用,停录后请用 Export 下载';
        emit();
        return;
      }
      try {
        lastEnvelope = api.peekRec(0)?.envelope ?? null;
        await sink.begin(activeSession, lastEnvelope);
        if (sessionId !== activeSession) return;
        sinkAvailable = true;
      } catch (error) {
        sinkAvailable = false;
        lastError = `落盘通道不可用,已退回浏览器下载: ${errorText(error)}`;
      }
      emit();
    })();
  }

  /** Ship every frame captured since the last checkpoint. */
  async function checkpoint(): Promise<void> {
    if (phase !== 'recording' || !sinkAvailable || !sessionId || checkpointInFlight) return;
    const api = options.getApi();
    const peek = api?.peekRec(checkpointedFrames);
    if (!peek || peek.frames.length === 0) return;
    if (peek.droppedFrames > 0) {
      // The recorder ring-buffered; absolute frame indices no longer line up with what is on disk.
      sinkAvailable = false;
      lastError = `录制超过 maxFrames,已丢 ${peek.droppedFrames} 帧,停止增量落盘`;
      emit();
      return;
    }
    checkpointInFlight = true;
    try {
      await sink.append(sessionId, peekToChunk(peek));
      checkpointedFrames = peek.totalFrames;
      lastEnvelope = peek.envelope;
    } catch (error) {
      lastError = `checkpoint 失败: ${errorText(error)}`;
    } finally {
      checkpointInFlight = false;
    }
  }

  /**
   * Synchronous tail flush for the unload / CTA path.
   * `finalize` = true also closes the session, producing a usable tape file.
   */
  function flushUnloadSafe(finalize: boolean): void {
    if (phase !== 'recording' || !sinkAvailable || !sessionId) return;
    const api = options.getApi();
    if (!api) return;
    try {
      if (finalize) {
        // stopRec() is synchronous and returns the full tape; only the tail needs shipping.
        // trail + stateSamples ride along, otherwise the composed tape yields an empty semantic
        // script and `semanticReplay` has nothing to certify.
        const recording = api.stopRec();
        const from = checkpointedFrames;
        sink.finalizeCompose(sessionId, recording.envelope, {
          fromIndex: from,
          frames: recording.frames.slice(from),
          stateHashes: recording.stateHashes.slice(from),
          trail: recording.trail ? recording.trail.slice(from) : null,
          stateSamples: (recording.stateSamples ?? []).filter((sample) => sample.frame >= from),
          // 短命事件只活在 events 里,不随 stateSamples 走 —— 不带上就等于没录。
          events: (recording.events ?? []).filter((event) => event.frame >= from),
        }, { beacon: true });
        phase = 'stopped';
        frames = recording.frames.length;
        stoppedElapsedSec = (performance.now() - startedAtMs) / 1000;
      } else {
        const peek = api.peekRec(checkpointedFrames);
        if (peek && peek.frames.length > 0 && peek.droppedFrames === 0) {
          sink.appendBeacon(sessionId, peekToChunk(peek));
          checkpointedFrames = peek.totalFrames;
        }
      }
    } catch {
      /* unload path: never throw */
    }
  }

  async function stop(): Promise<void> {
    const api = requireApi();
    if (phase !== 'recording') return;
    // The handshake may still be in flight for a very short recording; otherwise we would wrongly
    // fall back to a browser download while the session dir is being created.
    await sinkHandshake?.catch(() => undefined);
    const recording = api.stopRec();
    phase = 'stopped';
    frames = recording.frames.length;
    stoppedElapsedSec = (performance.now() - startedAtMs) / 1000;
    seed = recording.envelope.seed;

    if (sinkAvailable && sessionId) {
      try {
        const result = await sink.finalizeFull(sessionId, recording);
        savedPath = result.relativePath ?? result.tapePath;
        lastError = null;
      } catch (error) {
        lastError = `落盘失败,已退回浏览器下载: ${errorText(error)}`;
        downloadTapeFallback(recording, tapeFilename(recording.envelope.seed, frames));
        downloaded = true;
      }
    } else {
      downloadTapeFallback(recording, tapeFilename(recording.envelope.seed, frames));
      downloaded = true;
    }
    emit();
  }

  async function refreshResidue(): Promise<void> {
    const available = await sink.ping();
    // A transient /ping failure must not silently disable checkpointing for a live recording.
    if (phase !== 'recording') sinkAvailable = available;
    residue = available
      ? (await sink.listSessions()).filter((item) => !item.finalized && item.frames > 0 && item.sessionId !== sessionId)
      : [];
    emit();
  }

  function dismissResidue(id: string): void {
    residue = residue.filter((item) => item.sessionId !== id);
    emit();
  }

  function requireApi(): DemoRecordingApiLike {
    const api = options.getApi();
    if (!api) throw new Error('record-replay API is not mounted.');
    return api;
  }

  // ---- timers + lifecycle -------------------------------------------------
  const checkpointTimer = window.setInterval(() => void checkpoint(), checkpointIntervalMs);
  const pollTimer = window.setInterval(() => {
    if (phase === 'recording') {
      frames = options.getApi()?.getState().lastRecordingFrames ?? frames;
      // Keep the un-checkpointed tail small enough to survive an unload beacon (see the constant).
      if (frames - checkpointedFrames >= checkpointMaxFrames) void checkpoint();
    }
    emit();
  }, STATUS_POLL_INTERVAL_MS);

  const onPageHide = (): void => flushUnloadSafe(false);
  const onBeforeUnload = (): void => flushUnloadSafe(false);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onBeforeUnload);

  // CTA: stop + finalize before the navigation is allowed to proceed.
  const unregisterNavigate = options.registerBeforeNavigate?.(() => flushUnloadSafe(true)) ?? null;

  void refreshResidue();

  return {
    start,
    stop,
    getStatus,
    refreshResidue,
    dismissResidue,
    dispose() {
      // MUST flush before tearing down. `main.ts` registers `beforeunload -> disposeDevTools` at
      // module-evaluation time, i.e. before this controller ever mounts; on reload that handler runs
      // first and disposes us, so our own 'beforeunload' listener would never fire and the tail
      // (up to one checkpoint interval of frames) would be lost.
      flushUnloadSafe(false);
      window.clearInterval(checkpointTimer);
      window.clearInterval(pollTimer);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      unregisterNavigate?.();
    },
  };
}

function peekToChunk(peek: NonNullable<ReturnType<DemoRecordingApiLike['peekRec']>>): TapeChunk {
  return {
    fromIndex: peek.fromIndex,
    frames: peek.frames,
    stateHashes: peek.stateHashes,
    trail: peek.trail,
    stateSamples: peek.stateSamples,
    events: peek.events,
  };
}

function makeSessionId(label: string, seed: number): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '');
  const safeLabel = label.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24) || 'demo';
  return `${stamp}_${safeLabel}_seed${seed}`;
}

export function tapeFilename(seed: number, frames: number): string {
  return `tape-seed${seed}-${frames}f.json`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
