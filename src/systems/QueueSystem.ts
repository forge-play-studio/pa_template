import type { GameplayModule } from '../gameplay';
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

  constructor(
    private readonly queues: ProjectQueueConfig[],
    private readonly paymentSettlement: ProjectPaymentSettlementConfig,
    private readonly inventory: InventorySystem,
    private readonly economy: EconomySystem,
    private readonly gameplayState: GameplayStateSystem,
  ) {}

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

  getDefaultRewardCash(fallbackRewardCash = 1): number {
    return this.queues[0]?.rewardCash ?? fallbackRewardCash;
  }

  dispose(): void {
  }
}
