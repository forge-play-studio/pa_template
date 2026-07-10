import { configService } from '../config';

export type CtaSource = 'hud' | 'success' | 'fail';

interface CtaAnalyticsLike {
  onRetry?: () => void;
  onInstall?: (label?: string) => void;
}

export interface PlayableCtaServiceOptions {
  getAnalytics?: () => CtaAnalyticsLike | undefined;
  getUrl?: () => string;
  getChannel?: () => string;
}

function readConfiguredCtaUrl(): string {
  const playableAdInfo = configService.getPlayableAdInfo();
  const url = playableAdInfo.ctaUrl;
  return typeof url === 'string' ? url.trim() : '';
}

function readRuntimeChannel(): string {
  return typeof __CHANNEL__ === 'string' ? __CHANNEL__ : '';
}

function getRuntimeAnalytics(): CtaAnalyticsLike | undefined {
  return (window as unknown as { playableAnalytics?: CtaAnalyticsLike }).playableAnalytics;
}

/**
 * Hooks that must run before the page navigates away to the CTA target.
 *
 * The record-replay recording lifeline registers here: a CTA click destroys the page, and with it
 * any in-memory tape that was never flushed to disk. `openUrlLikePlayable()` below is the single
 * funnel every CTA path goes through (`handleCtaClick` and `openCtaUrlInNewPage`), so one hook site
 * covers them all. Hooks must be **synchronous and fast** — `sendBeacon`, not `fetch`.
 *
 * No-op in production: only DEV bootstrap ever registers a hook.
 */
type BeforeCtaHook = () => void;

const beforeCtaHooks = new Set<BeforeCtaHook>();

export function registerBeforeCta(hook: BeforeCtaHook): () => void {
  beforeCtaHooks.add(hook);
  return () => {
    beforeCtaHooks.delete(hook);
  };
}

export function runBeforeCtaHooks(): void {
  for (const hook of [...beforeCtaHooks]) {
    try {
      hook();
    } catch (error) {
      console.warn('[cta] before-navigate hook failed:', error);
    }
  }
}

export class PlayableCtaService {
  private readonly getAnalytics: () => CtaAnalyticsLike | undefined;
  private readonly getUrl: () => string;
  private readonly getChannel: () => string;

  constructor(options: PlayableCtaServiceOptions = {}) {
    this.getAnalytics = options.getAnalytics ?? getRuntimeAnalytics;
    this.getUrl = options.getUrl ?? readConfiguredCtaUrl;
    this.getChannel = options.getChannel ?? readRuntimeChannel;
  }

  getCtaTargetUrl(): string {
    return this.getUrl();
  }

  handleCtaClick(source: CtaSource): void {
    if (source === 'fail') {
      this.getAnalytics()?.onRetry?.();
    }

    this.getAnalytics()?.onInstall?.('Global');
    this.openUrlLikePlayable(this.getCtaTargetUrl());
  }

  openCtaUrlInNewPage(): void {
    if (this.getChannel() === 'unity') {
      return;
    }
    this.openUrlLikePlayable(this.getCtaTargetUrl());
  }

  private openUrlLikePlayable(url: string): void {
    // 页面即将被导航掉 —— 先给所有 before-navigate 钩子一次同步落盘的机会。
    runBeforeCtaHooks();

    const runtime = window as unknown as {
      mraid?: { open?: (target: string) => void };
      super_html?: { download?: (target: string) => void };
    };

    if (runtime.super_html?.download) {
      runtime.super_html.download(url);
      return;
    }

    if (runtime.mraid?.open) {
      runtime.mraid.open(url);
      return;
    }

    if (!url) return;

    const opened = window.open(url, '_blank');
    if (!opened) {
      window.location.href = url;
    }
  }
}

export const playableCtaService = new PlayableCtaService();
