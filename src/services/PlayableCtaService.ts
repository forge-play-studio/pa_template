import { configService } from '../config';

export type CtaSource = 'hud' | 'success' | 'fail';
export type CtaTargetPlatform = 'universal' | 'android' | 'ios';

interface CtaAnalyticsLike {
  onRetry?: () => void;
  onInstall?: (label?: string) => void;
}

export interface PlayableCtaServiceOptions {
  getAnalytics?: () => CtaAnalyticsLike | undefined;
  getUrl?: () => string;
  getChannel?: () => string;
  getPlatform?: () => CtaTargetPlatform;
}

function readConfiguredCtaUrl(platform = readRuntimeTargetPlatform()): string {
  const playableAdInfo = configService.getPlayableAdInfo();
  const legacyUrl = readUrl(playableAdInfo.ctaUrl);
  const cta = asRecord(playableAdInfo.cta);

  if (cta?.mode === 'platform-build') {
    const platformUrl = platform === 'android'
      ? readUrl(cta.androidUrl)
      : platform === 'ios'
        ? readUrl(cta.iosUrl)
        : '';
    return platformUrl || readUrl(cta.fallbackUrl) || legacyUrl;
  }

  return readUrl(cta?.smartUrl) || legacyUrl;
}

function readRuntimeChannel(): string {
  return typeof __CHANNEL__ === 'string' ? __CHANNEL__ : '';
}

function readRuntimeTargetPlatform(): CtaTargetPlatform {
  return typeof __TARGET_PLATFORM__ === 'string'
    && (__TARGET_PLATFORM__ === 'android' || __TARGET_PLATFORM__ === 'ios')
    ? __TARGET_PLATFORM__
    : 'universal';
}

function getRuntimeAnalytics(): CtaAnalyticsLike | undefined {
  return (window as unknown as { playableAnalytics?: CtaAnalyticsLike }).playableAnalytics;
}

export class PlayableCtaService {
  private readonly getAnalytics: () => CtaAnalyticsLike | undefined;
  private readonly getUrl: () => string;
  private readonly getChannel: () => string;
  private readonly getPlatform: () => CtaTargetPlatform;

  constructor(options: PlayableCtaServiceOptions = {}) {
    this.getAnalytics = options.getAnalytics ?? getRuntimeAnalytics;
    this.getPlatform = options.getPlatform ?? readRuntimeTargetPlatform;
    this.getUrl = options.getUrl ?? (() => readConfiguredCtaUrl(this.getPlatform()));
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
