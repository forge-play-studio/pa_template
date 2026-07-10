import type { Disposable } from '../framework/disposables';
import type { DemoRecordingController, DemoRecordingStatus } from './demo-recording-controller';
import { downloadTapeFallback, type TapeSinkSession } from './tape-sink';

/**
 * Minimal floating control for demo recording. Game-agnostic; a pure view over
 * `DemoRecordingController` status.
 *
 * It exists for two reasons:
 *   1. In `?rrAutoStart=1` every debug panel is hidden, so this is the only way to stop a
 *      recording — mandatory, because the CTA navigates away.
 *   2. On a bare dev URL nothing is recording. Without a loud indicator an operator can play a
 *      whole session and lose it (this happened). The idle state is deliberately alarming and
 *      offers one-click arming.
 *
 * Kept to a single pill (bottom-right) so it never covers gameplay.
 */

const HUD_ELEMENT_ID = 'rr-demo-hud';

const COLOR = {
  rec: '#ff4d4f',
  ok: '#7cff8b',
  warn: '#ffb648',
  info: '#4d9dff',
  muted: '#8a8a90',
} as const;

const BANNER_BG = {
  danger: 'rgba(120,20,20,.86)',
  success: 'rgba(20,90,40,.86)',
  warn: 'rgba(110,70,10,.86)',
  neutral: 'rgba(40,40,50,.86)',
} as const;

export type RecordingHudBannerTone = keyof typeof BANNER_BG;

export interface RecordingHudBanner {
  text: string;
  tone: RecordingHudBannerTone;
}

export interface RecordingHudOptions {
  root?: HTMLElement;
  controller: DemoRecordingController;
  /** Raw agent API, used only for the Export fallback button. */
  exportTape?: () => string;
  togglePanels?: () => void;
  arePanelsHidden?: () => boolean;
  /**
   * Game-supplied hazard line, polled while recording. Ranked above the default reminder because a
   * game can lose a tape in ways the framework cannot see (a death timer, an imminent CTA screen).
   * Return null when there is nothing to say. Kept as a callback so this module stays game-agnostic.
   */
  gameBanner?: () => RecordingHudBanner | null;
}

export function mountRecordingHud(options: RecordingHudOptions): Disposable {
  const root = options.root ?? document.body;
  const doc = root.ownerDocument;
  doc.getElementById(HUD_ELEMENT_ID)?.remove();

  const hud = doc.createElement('div');
  hud.id = HUD_ELEMENT_ID;
  hud.style.cssText = css([
    'position:fixed', 'right:10px', 'bottom:10px', 'z-index:2147483000',
    'display:flex', 'flex-direction:column', 'align-items:flex-end', 'gap:4px',
    'font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    'pointer-events:none', 'user-select:none', 'max-width:min(52vw,420px)',
  ]);

  const pill = doc.createElement('div');
  pill.style.cssText = css([
    'display:flex', 'align-items:center', 'gap:6px', 'padding:5px 7px', 'border-radius:999px',
    'background:rgba(12,12,16,.88)', 'border:1px solid rgba(255,255,255,.16)',
    'box-shadow:0 2px 10px rgba(0,0,0,.45)', 'backdrop-filter:blur(3px)', 'pointer-events:auto',
  ]);

  const dot = doc.createElement('span');
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;flex:0 0 auto';

  const label = doc.createElement('span');
  label.style.cssText = 'color:#eaeaea;white-space:nowrap;letter-spacing:.02em';

  const startButton = makeButton(doc, '● 开始录制', COLOR.rec);
  const stopButton = makeButton(doc, 'Stop', COLOR.rec);
  const exportButton = makeButton(doc, 'Export', COLOR.info);
  const panelsButton = makeButton(doc, '⋯', COLOR.muted);
  panelsButton.title = '显示 / 隐藏 debug 面板';
  panelsButton.style.minWidth = '20px';

  pill.append(dot, label, startButton, stopButton, exportButton, panelsButton);

  const banner = doc.createElement('div');
  banner.style.cssText = css([
    'padding:3px 7px', 'border-radius:6px', 'color:#fff', 'font-weight:500',
    'pointer-events:none', 'text-align:right', 'line-height:1.35',
    'border:1px solid rgba(255,255,255,.18)', 'white-space:pre-line',
  ]);

  hud.append(pill, banner);
  root.append(hud);

  const dotPulse = dot.animate?.(
    [{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }],
    { duration: 1400, iterations: Infinity },
  );
  dotPulse?.pause();

  let transientBanner: { text: string; bg: string; untilMs: number } | null = null;

  const flash = (text: string, bg: string, ms = 4000): void => {
    transientBanner = { text, bg, untilMs: performance.now() + ms };
    render(options.controller.getStatus());
  };

  // ---- actions ------------------------------------------------------------
  const doStart = (): void => {
    void options.controller.start('demo').then(
      () => flash('● 已开始录制', BANNER_BG.success, 2500),
      (error: unknown) => flash(`✕ 开始录制失败: ${errorText(error)}`, BANNER_BG.danger, 6000),
    );
  };

  const doStop = (): void => {
    void options.controller.stop().then(
      () => {
        const status = options.controller.getStatus();
        if (status.savedPath) flash(`✓ 已落盘 ${status.savedPath}`, BANNER_BG.success, 12000);
        else if (status.downloaded) flash('✓ 已下载 tape（落盘通道不可用）', BANNER_BG.warn, 12000);
      },
      (error: unknown) => flash(`✕ Stop 失败: ${errorText(error)}`, BANNER_BG.danger, 6000),
    );
  };

  const doExport = (): void => {
    if (!options.exportTape) return;
    try {
      const json = options.exportTape();
      const parsed = JSON.parse(json) as { envelope: { seed: number }; frames: unknown[] };
      downloadTapeFallback(parsed, `tape-seed${parsed.envelope.seed}-${parsed.frames.length}f.json`, doc);
      flash(`✓ 已下载 ${parsed.frames.length} 帧`, BANNER_BG.success, 4000);
    } catch (error) {
      flash(`✕ Export 失败: ${errorText(error)}`, BANNER_BG.danger, 6000);
    }
  };

  const doTogglePanels = (): void => {
    options.togglePanels?.();
    flash(options.arePanelsHidden?.() ? '面板已隐藏' : '面板已显示', BANNER_BG.neutral, 2000);
  };

  // 游戏的触摸摇杆把 pointerdown 挂在 document 上;点 HUD 不能顺手唤起摇杆并注入位移,
  // 否则 tape 的尾巴会被污染。(qy-blade-goldrush 实测)
  const swallowPointer = (event: Event): void => event.stopPropagation();
  pill.addEventListener('pointerdown', swallowPointer);

  startButton.addEventListener('click', doStart);
  stopButton.addEventListener('click', doStop);
  exportButton.addEventListener('click', doExport);
  panelsButton.addEventListener('click', doTogglePanels);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const phase = options.controller.getStatus().phase;
    if (key === 's') {
      event.preventDefault();
      if (phase === 'recording') doStop();
      else if (phase === 'idle' || phase === 'stopped') doStart();
    } else if (key === 'e') {
      event.preventDefault();
      doExport();
    }
  };
  window.addEventListener('keydown', onKeyDown, true);

  // ---- render -------------------------------------------------------------
  function render(status: DemoRecordingStatus): void {
    const now = performance.now();
    if (transientBanner && now > transientBanner.untilMs) transientBanner = null;

    show(startButton, status.phase === 'idle' || status.phase === 'stopped');
    show(stopButton, status.phase === 'recording');
    show(exportButton, status.phase === 'stopped' && !!options.exportTape);
    show(panelsButton, true);

    switch (status.phase) {
      case 'recording': {
        dot.style.background = COLOR.rec;
        if (dotPulse?.playState !== 'running') dotPulse?.play();
        label.textContent = `REC ${formatDuration(status.elapsedSec)} · ${status.frames}f · seed ${status.seed ?? '-'}`;
        break;
      }
      case 'stopped': {
        dotPulse?.pause();
        dot.style.background = COLOR.ok;
        label.textContent = `⏹ ${status.frames}f · seed ${status.seed ?? '-'}`;
        break;
      }
      case 'foreign': {
        dotPulse?.pause();
        dot.style.background = COLOR.info;
        label.textContent = `● ${status.foreignStatus}`;
        show(startButton, false);
        break;
      }
      default: {
        dotPulse?.pause();
        dot.style.background = COLOR.warn;
        label.textContent = '⚠ 未在录制';
      }
    }

    if (transientBanner) {
      banner.style.display = '';
      banner.style.background = transientBanner.bg;
      banner.textContent = transientBanner.text;
      return;
    }

    const line = gameBannerLine(status) ?? defaultBanner(status);
    if (!line) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = '';
    banner.style.background = line.bg;
    banner.textContent = line.text;
  }

  /** Game hazard line wins over the generic reminder — it is the more urgent thing to read. */
  function gameBannerLine(status: DemoRecordingStatus): { text: string; bg: string } | null {
    if (status.phase !== 'recording' || !options.gameBanner) return null;
    try {
      const line = options.gameBanner();
      return line ? { text: line.text, bg: BANNER_BG[line.tone] } : null;
    } catch {
      return null;
    }
  }

  function defaultBanner(status: DemoRecordingStatus): { text: string; bg: string } | null {
    if (status.phase === 'recording') {
      const sink = status.sinkAvailable
        ? `已落盘 ${status.checkpointedFrames}f`
        : '⚠ 落盘通道不可用,停录后请 Export';
      return { text: `⚠ 通关 / Play Now 前先 Stop（⇧S） · ${sink}`, bg: BANNER_BG.danger };
    }
    if (status.phase === 'idle') {
      const residueLine = formatResidue(status.residue);
      return {
        text: `⚠ 未在录制 —— 现在玩不会留下数据。点「开始录制」或按 ⇧S${residueLine}`,
        bg: BANNER_BG.danger,
      };
    }
    if (status.phase === 'stopped') {
      if (status.savedPath) return { text: `✓ 已落盘 ${status.savedPath}`, bg: BANNER_BG.success };
      if (status.downloaded) return { text: '✓ 已下载 tape（落盘通道不可用）', bg: BANNER_BG.warn };
    }
    if (status.lastError) return { text: `⚠ ${status.lastError}`, bg: BANNER_BG.warn };
    return null;
  }

  const timer = window.setInterval(() => render(options.controller.getStatus()), 250);
  render(options.controller.getStatus());

  return {
    dispose() {
      window.clearInterval(timer);
      pill.removeEventListener('pointerdown', swallowPointer);
      window.removeEventListener('keydown', onKeyDown, true);
      dotPulse?.cancel();
      hud.remove();
    },
  };
}

function formatResidue(residue: TapeSinkSession[]): string {
  if (residue.length === 0) return '';
  const latest = residue[0];
  if (!latest) return '';
  return `\n⟲ 发现未完成录制 ${latest.sessionId}（${latest.frames} 帧已落盘）→ ${latest.dir}`;
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60).toString().padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function makeButton(doc: Document, text: string, accent: string): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.style.cssText = css([
    'appearance:none', 'cursor:pointer', 'padding:3px 7px', 'border-radius:999px',
    `border:1px solid ${accent}66`, 'background:rgba(255,255,255,.06)', `color:${accent}`,
    'font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
    'pointer-events:auto', 'white-space:nowrap',
  ]);
  return button;
}

function show(element: HTMLElement, visible: boolean): void {
  element.style.display = visible ? '' : 'none';
}

function css(parts: readonly string[]): string {
  return parts.join(';');
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
