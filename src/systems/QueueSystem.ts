import type { GameplayModule } from '../gameplay';
import type { DebugActionRegistry } from '../services';
import type { ProjectPaymentSettlementConfig, ProjectQueueConfig } from '../config/projectGameplayConfig';
import type { EconomySystem } from './EconomySystem';
import type { GameplayStateSystem } from './GameplayStateSystem';
import type { InventorySystem } from './InventorySystem';

export interface QueueSnapshot {
  saleCount: number;
  lastRewardCash: number;
  pendingMoneyStackCash: number;
  paymentSettlementMode: ProjectPaymentSettlementConfig['mode'];
}

export class QueueSystem implements GameplayModule {
  private saleCount = 0;
  private lastRewardCash = 0;
  private unregisterSellOnce: (() => void) | null = null;
  private unregisterCollectMoneyStack: (() => void) | null = null;

  constructor(
    private readonly queues: ProjectQueueConfig[],
    private readonly paymentSettlement: ProjectPaymentSettlementConfig,
    private readonly inventory: InventorySystem,
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
    this.unregisterCollectMoneyStack = this.debugActions.register({
      id: 'queue.collectMoneyStack',
      label: 'Collect pending money stack',
      run: ({ payload }) => {
        const amount = readNumber(payload, 'amount') ?? Number.POSITIVE_INFINITY;
        const collected = this.collectMoneyStack(amount, 'debug_collect_money_stack');
        return { ok: true, collected, snapshot: this.getSnapshot() };
      },
    });
  }

  completeSale(rewardCash: number, reason?: string): void {
    const reward = Math.max(0, Math.floor(rewardCash));
    this.saleCount += 1;
    this.lastRewardCash = reward;
    if (this.paymentSettlement.mode === 'instant') {
      this.economy.addCash(reward, reason ?? 'queue_sale');
      this.gameplayState.markMilestone('queue_payment_collected');
    } else {
      this.inventory.add(
        this.paymentSettlement.moneyStackContainerId,
        this.paymentSettlement.moneyResourceId,
        reward,
        reason ?? 'queue_sale_to_money_stack',
      );
    }
    this.gameplayState.markMilestone('queue_sale_completed');
  }

  collectMoneyStack(amount = Number.POSITIVE_INFINITY, reason?: string): number {
    if (this.paymentSettlement.mode === 'instant') return 0;
    const requested = Number.isFinite(amount) ? amount : Number.MAX_SAFE_INTEGER;
    const collected = this.inventory.removeUpTo(
      this.paymentSettlement.moneyStackContainerId,
      this.paymentSettlement.moneyResourceId,
      requested,
      reason ?? 'money_stack_collected',
    );
    if (collected <= 0) return 0;
    this.economy.addCash(collected, reason ?? 'money_stack_collected');
    this.gameplayState.markMilestone('queue_payment_collected');
    return collected;
  }

  getSnapshot(): QueueSnapshot {
    return {
      saleCount: this.saleCount,
      lastRewardCash: this.lastRewardCash,
      pendingMoneyStackCash: this.inventory.getAmount(
        this.paymentSettlement.moneyStackContainerId,
        this.paymentSettlement.moneyResourceId,
      ),
      paymentSettlementMode: this.paymentSettlement.mode,
    };
  }

  dispose(): void {
    this.unregisterSellOnce?.();
    this.unregisterCollectMoneyStack?.();
  }
}

function readNumber(payload: unknown, key: string): number | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
