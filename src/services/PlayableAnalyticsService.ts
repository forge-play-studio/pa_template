export interface AnalyticsLike {
  onInitPlayable?: () => void;
  onLoaded?: () => void;
  onDisplay?: () => void;
  onCompleted?: () => void;
  onShowEndCard?: () => void;
  trackCustomEvent?: (eventName: string, payload: { progress: number }) => void;
}

export interface PlayableAnalyticsServiceOptions {
  getAnalytics?: () => AnalyticsLike | undefined;
}

function getRuntimeAnalytics(): AnalyticsLike | undefined {
  return (window as unknown as { playableAnalytics?: AnalyticsLike }).playableAnalytics;
}

export class PlayableAnalyticsService {
  private readonly getAnalytics: () => AnalyticsLike | undefined;
  private completed = false;
  private endCardShown = false;
  private readonly progressReported = new Set<number>();

  constructor(options: PlayableAnalyticsServiceOptions = {}) {
    this.getAnalytics = options.getAnalytics ?? getRuntimeAnalytics;
  }

  resetForNewSession(): void {
    this.completed = false;
    this.endCardShown = false;
    this.progressReported.clear();
  }

  reportInitPlayable(): void {
    this.invokeLifecycle('onInitPlayable');
  }

  reportLoaded(): void {
    this.invokeLifecycle('onLoaded');
  }

  reportDisplay(): void {
    this.invokeLifecycle('onDisplay');
  }

  reportCompleted(): void {
    if (this.completed) return;
    this.completed = true;
    this.invokeLifecycle('onCompleted');
  }

  reportProgressMilestone(progress: number): void {
    if (!Number.isFinite(progress) || this.progressReported.has(progress)) return;
    this.progressReported.add(progress);
    this.getAnalytics()?.trackCustomEvent?.('challenge_progress', { progress });
  }

  reportEndCardShown(): void {
    if (this.endCardShown) return;
    this.endCardShown = true;
    this.getAnalytics()?.onShowEndCard?.();
  }

  private invokeLifecycle(method: 'onInitPlayable' | 'onLoaded' | 'onDisplay' | 'onCompleted'): void {
    this.getAnalytics()?.[method]?.();
  }
}

export const playableAnalyticsService = new PlayableAnalyticsService();
