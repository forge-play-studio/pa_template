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
