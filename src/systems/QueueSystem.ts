import type { GameplayModule } from '../gameplay';
import type { DebugActionRegistry } from '../services';
import type { ProjectQueueConfig } from '../config/projectGameplayConfig';
import type { EconomySystem } from './EconomySystem';
import type { GameplayStateSystem } from './GameplayStateSystem';

export interface QueueSnapshot {
  saleCount: number;
  lastRewardCash: number;
}

export class QueueSystem implements GameplayModule {
  private saleCount = 0;
  private lastRewardCash = 0;
  private unregisterSellOnce: (() => void) | null = null;

  constructor(
    private readonly queues: ProjectQueueConfig[],
    private readonly economy: EconomySystem,
    private readonly gameplayState: GameplayStateSystem,
    private readonly debugActions: DebugActionRegistry,
    private readonly fallbackRewardCash: number,
  ) {}

  init(): void {
    this.unregisterSellOnce = this.debugActions.register({
      id: 'queue.sellOnce',
      label: 'Complete one queue sale',
      run: ({ payload }) => {
        const reward = readNumber(payload, 'rewardCash') ?? this.queues[0]?.rewardCash ?? this.fallbackRewardCash;
        this.completeSale(reward, 'debug');
        return { ok: true, snapshot: this.getSnapshot() };
      },
    });
  }

  completeSale(rewardCash: number, reason?: string): void {
    const reward = Math.max(0, Math.floor(rewardCash));
    this.saleCount += 1;
    this.lastRewardCash = reward;
    this.economy.addCash(reward, reason ?? 'queue_sale');
    this.gameplayState.markMilestone('queue_sale_completed');
  }

  getSnapshot(): QueueSnapshot {
    return {
      saleCount: this.saleCount,
      lastRewardCash: this.lastRewardCash,
    };
  }

  dispose(): void {
    this.unregisterSellOnce?.();
  }
}

function readNumber(payload: unknown, key: string): number | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
