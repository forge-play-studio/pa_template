/**
 * Providers 契约校验:布尔 fact 必须 latch,数值 fact 必须单调。
 *
 * 契约:`fps-3d-harness/docs/06-record-replay-dual-mode.md` §6.3 第 4 条。
 *
 * 为什么是硬规则(两条都是实战里真的踩过):
 *
 * - **布尔必须 latch(一旦 true 永远 true)**。一个随走位来回翻转的 `gatePassed` 会在每次翻转时
 *   产出一个里程碑 —— qy-last-stand 因此凭空多出 8 个伪里程碑。更糟的是:如果一次
 *   `false → true → false` 恰好完整发生在两个 60 帧 stateSample 之间,这个事件在旧的
 *   基于采样的提取里**彻底消失**;逐帧检测能抓到它,但抓到的是一串噪声。
 * - **数值必须单调**。`thirdStageOrdinal` 从 10 回落到 9,会让 `>=` 型的闸门被误判为「已满足」。
 *
 * 本检查器在**录制期**逐帧跑,每个 key 只报一次(第一次违约),避免刷屏。
 * 它不会阻止录制 —— 它只是把「你的 provider 不满足契约」这件事在录制当场喊出来,
 * 而不是等到几小时后 Mode B 给出一堆莫名其妙的 extra 里程碑。
 */

export type FactContractViolationKind = 'boolean-unlatched' | 'number-decreased';

export interface FactContractViolation {
  key: string;
  kind: FactContractViolationKind;
  frame: number;
  from: number | string | boolean;
  to: number | string | boolean;
}

export type RecordReplayFactValue = number | string | boolean;

/**
 * 有些 fact 天生是**状态观测**而不是进度:「玩家此刻在罩内吗」会随走位来回翻转,它进 state hash、
 * 供快照读,但没有任何 detector 拿它产里程碑。这类 fact 由 provider 在**注册时**声明豁免:
 *
 * ```ts
 * snapshotProviders: [{ name: 'qy.oxygen', getSnapshot, observationOnlyFacts: ['insideBoundary'] }]
 * ```
 *
 * ⚠️ 声明放在注册面,**绝不能放进 `getSnapshot()` 的返回值** —— 快照逐帧进 state hash,
 * 加一个字段就会改掉 `startStateHash`,所有已录 tape 的 Mode A 当场失配。
 *
 * 不给豁免口的话,校验器会对着这类 fact 一直喊,真正的违约反而被淹没 ——
 * 一个天天报警的告警等于没有告警。
 */
export class FactContractChecker {
  private readonly lastValues = new Map<string, RecordReplayFactValue>();
  private readonly reported = new Set<string>();
  private readonly exempt = new Set<string>();
  private readonly violations: FactContractViolation[] = [];

  /** 豁免这些 fact key(完整前缀名)。幂等,可重复调。 */
  addExemptions(keys: Iterable<string>): void {
    for (const key of keys) this.exempt.add(key);
  }

  /**
   * 观察一帧的 facts,返回**本帧新发现**的违约(每个 key 只报一次)。
   * 字符串 fact 不受约束(它们是标签,不是进度)。
   */
  observe(frame: number, facts: Readonly<Record<string, RecordReplayFactValue>>): FactContractViolation[] {
    const fresh: FactContractViolation[] = [];
    for (const [key, value] of Object.entries(facts)) {
      const previous = this.lastValues.get(key);
      this.lastValues.set(key, value);
      if (previous === undefined || this.reported.has(key) || this.exempt.has(key)) continue;

      let kind: FactContractViolationKind | null = null;
      if (typeof previous === 'boolean' && typeof value === 'boolean') {
        if (previous && !value) kind = 'boolean-unlatched';
      } else if (typeof previous === 'number' && typeof value === 'number') {
        if (Number.isFinite(previous) && Number.isFinite(value) && value < previous) kind = 'number-decreased';
      }
      if (!kind) continue;

      this.reported.add(key);
      const violation: FactContractViolation = { key, kind, frame, from: previous, to: value };
      this.violations.push(violation);
      fresh.push(violation);
    }
    return fresh;
  }

  getViolations(): readonly FactContractViolation[] {
    return this.violations;
  }

  reset(): void {
    this.lastValues.clear();
    this.reported.clear();
    this.exempt.clear();
    this.violations.length = 0;
  }
}

export function formatFactContractViolation(violation: FactContractViolation): string {
  const where = `frame ${violation.frame}`;
  if (violation.kind === 'boolean-unlatched') {
    return `[record-replay] provider contract: boolean fact "${violation.key}" went true → false at ${where}. `
      + 'Boolean facts must latch (once true, always true) — an unlatched flag emits a milestone on every flip, '
      + 'and a full false→true→false inside one state-sample interval is invisible to sample-based extraction. '
      + 'Latch it in the provider.';
  }
  return `[record-replay] provider contract: numeric fact "${violation.key}" decreased ${String(violation.from)} → `
    + `${String(violation.to)} at ${where}. Numeric facts must be monotonic — a decrease makes ">=" style gates `
    + 'read as already-satisfied. Expose a monotonic counter instead.';
}
