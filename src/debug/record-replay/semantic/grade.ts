/**
 * 认证分级 v2 —— Mode B 的四档 verdict。
 *
 * 契约:`fps-3d-harness/docs/06-record-replay-dual-mode.md` §6.2(2026-07-10 定稿)。
 * 本文件是**纯函数**:不碰 game、不碰 providers、不碰 DOM,只对一组已经算好的指标下判断。
 * 这样分档判据可以在 node 里逐条变异验证,也可以被 harness 侧的 runner 复用。
 *
 * 为什么要分档:二值 ok 把「全绿正本」和「critical 全中但绕了两次路」压成同一个 false/true,
 * 业务上要的门槛(能不能当基线 / 能不能进回归门禁)因此读不出来。四档把这条线显式化。
 */

export type SemanticGrade = 'clean' | 'good' | 'degraded' | 'failed';

/** 由差到好。索引即严重度序 —— 比较档位一律走这张表,别在别处硬编码顺序。 */
export const SEMANTIC_GRADE_ORDER: readonly SemanticGrade[] = ['failed', 'degraded', 'good', 'clean'];

export function compareSemanticGrade(left: SemanticGrade, right: SemanticGrade): number {
  return SEMANTIC_GRADE_ORDER.indexOf(left) - SEMANTIC_GRADE_ORDER.indexOf(right);
}

/** 登记基线的必要条件是 `isSemanticGradeAtLeast(grade, 'good')`(契约 §6.2)。 */
export function isSemanticGradeAtLeast(grade: SemanticGrade, minimum: SemanticGrade): boolean {
  return compareSemanticGrade(grade, minimum) >= 0;
}

export function worstSemanticGrade(grades: readonly SemanticGrade[]): SemanticGrade {
  let worst: SemanticGrade = 'clean';
  for (const grade of grades) {
    if (compareSemanticGrade(grade, worst) < 0) worst = grade;
  }
  return worst;
}

export interface SemanticGradeThresholds {
  /** optional 里程碑允许缺失的比例上限(超过 ⇒ 掉到 degraded)。契约默认 20%。 */
  optionalMissingRatio: number;
  /** 绕路 / 重试的严重度阈值,达到即「显著」⇒ degraded。 */
  detourScore: number;
}

export const DEFAULT_SEMANTIC_GRADE_THRESHOLDS: Readonly<SemanticGradeThresholds> = Object.freeze({
  optionalMissingRatio: 0.2,
  detourScore: 3,
});

/**
 * 分档所需的全部输入。调用方(replay.ts / harness runner)负责把 verdict 折算成这些标量,
 * 分档逻辑本身不认识 verdict 的结构 —— 这样 schema 演进不会牵动判据。
 */
export interface SemanticGradeInput {
  /** 剧本什么都断言不了,压根没跑。 */
  refused: boolean;
  /**
   * 标定失败 = 回放从来没能建立「输入 → 世界位移」的基。
   * 此时哪怕里程碑全中,也可能是游戏自己演完的(剧情自动移动),不算回放复现 —— 与空剧本拒绝同源。
   */
  calibrationFailed: boolean;
  /** 示教里从不存在的终局态(例:回放把自己玩死了)。非 null ⇒ failed。 */
  terminalDivergence: string | null;
  /** 缺失的 critical 里程碑数(主线因果链)。> 0 ⇒ failed。 */
  criticalMissing: number;
  /** 缺失的 optional 里程碑数(路过型)。 */
  optionalMissing: number;
  /** 剧本里 optional 里程碑总数(分母;0 ⇒ 比例记 0)。 */
  optionalTotal: number;
  /**
   * 剧本里 critical 里程碑总数。**0 表示这条剧本没断言任何主线因果** ——
   * 它可以被回放(纯导航 tape 也有价值),但拿不到 clean(见 gradeSemanticVerdict)。
   */
  criticalTotal: number;
  /** 经济终值 + 全部经济闸门都在容差内。 */
  economyPass: boolean;
  /** 有 stage 没能正常走完(failed / active / skipped)。 */
  stageDisrupted: boolean;
  /** 绕路 / 重试 / 卡死恢复的累计严重度。 */
  detourScore: number;
  /** 现行二值判据,原样透传 —— clean 档等价于「旧判据全过且零绕路」。 */
  ok: boolean;
  quality: 'clean' | 'recovered' | 'failed';
}

export interface SemanticGradeResult {
  grade: SemanticGrade;
  /** 一句话说明**为什么**是这一档 —— 定档理由不落盘,排查时就得重跑。 */
  reason: string;
  optionalMissingRatio: number;
  detourScore: number;
  thresholds: SemanticGradeThresholds;
}

/**
 * 判据顺序即优先级,从最硬的失败往下走。任何一条 failed 命中就不再看后面的。
 *
 *   failed   critical 缺失 / terminal divergence / 标定失败 / 空剧本拒绝
 *   clean    旧判据全过 且 零绕路(quality === 'clean')
 *   degraded critical 全中,但 optional 缺失超阈值 / 经济超容差 / stage 没走完 / 绕路显著
 *   good     其余(critical 全中,optional 缺失 ≤ 阈值,无 terminal divergence)
 */
export function gradeSemanticVerdict(
  input: SemanticGradeInput,
  overrides: Partial<SemanticGradeThresholds> = {},
): SemanticGradeResult {
  const thresholds: SemanticGradeThresholds = {
    optionalMissingRatio: clamp01(overrides.optionalMissingRatio ?? DEFAULT_SEMANTIC_GRADE_THRESHOLDS.optionalMissingRatio),
    detourScore: Math.max(1, Math.floor(overrides.detourScore ?? DEFAULT_SEMANTIC_GRADE_THRESHOLDS.detourScore)),
  };
  const optionalMissingRatio = input.optionalTotal > 0
    ? roundTo(input.optionalMissing / input.optionalTotal, 4)
    : 0;
  const detourScore = Math.max(0, Math.floor(input.detourScore));
  const base = { optionalMissingRatio, detourScore, thresholds };

  if (input.refused) {
    return { ...base, grade: 'failed', reason: 'script asserts nothing — run refused' };
  }
  if (input.terminalDivergence) {
    return { ...base, grade: 'failed', reason: `terminal divergence: ${input.terminalDivergence}` };
  }
  if (input.criticalMissing > 0) {
    return { ...base, grade: 'failed', reason: `${input.criticalMissing} critical milestone(s) missing` };
  }
  if (input.calibrationFailed) {
    // 里程碑可能全中,但那不是回放开出来的 —— 拒绝给这种运行任何正面名分。
    return { ...base, grade: 'failed', reason: 'calibration failed — replay never established an input basis' };
  }

  if (input.ok && input.quality === 'clean') {
    // 一条 critical 里程碑都不断言的剧本(例:纯导航 tape,或玩家什么都没做完就停了录制)
    // 会让上面每一条 clean 判据**空真** —— 没有里程碑可缺、没有终局态可分歧、经济恒等。
    // 它可以是合格的回归门禁目标(good),但 clean 的业务含义是「正本基线 / 素材生成」,
    // 不能让一条什么都没证明的 tape 拿到那个名分。宁可低估,不可空绿。
    if (input.criticalTotal <= 0) {
      return {
        ...base,
        grade: 'good',
        reason: 'script asserts no critical milestone — replayable, but cannot certify as a canonical baseline',
      };
    }
    return { ...base, grade: 'clean', reason: 'all milestones matched, no detour, economy within tolerance' };
  }

  if (optionalMissingRatio > thresholds.optionalMissingRatio) {
    return {
      ...base,
      grade: 'degraded',
      reason: `optional milestones missing ${formatPercent(optionalMissingRatio)} > ${formatPercent(thresholds.optionalMissingRatio)}`,
    };
  }
  if (!input.economyPass) {
    return { ...base, grade: 'degraded', reason: 'economy outside tolerance' };
  }
  if (input.stageDisrupted) {
    return { ...base, grade: 'degraded', reason: 'a stage did not complete normally' };
  }
  if (detourScore >= thresholds.detourScore) {
    return { ...base, grade: 'degraded', reason: `detour/retry score ${detourScore} >= ${thresholds.detourScore}` };
  }

  return {
    ...base,
    grade: 'good',
    reason: input.criticalMissing === 0 && optionalMissingRatio === 0 && detourScore === 0
      ? 'all critical milestones matched'
      : `critical milestones matched; optional missing ${formatPercent(optionalMissingRatio)}, detour ${detourScore}`,
  };
}

// ---------------------------------------------------------------------------
// 里程碑分层统计
// ---------------------------------------------------------------------------

export interface LayeredMilestoneCounts {
  criticalMissing: number;
  optionalMissing: number;
  criticalTotal: number;
  optionalTotal: number;
}

/**
 * 把「剧本里程碑 + 缺失清单」折算成分层计数。
 *
 * 缺失按**剧本里程碑下标去重** —— 同一个里程碑可能被 terminal divergence 和 stage timeout
 * 各记一次,重复计分会把一次失败放大成两次,把 good 误伤成 degraded。
 *
 * `isCritical` 由调用方注入(游戏内走 providers 注册表;harness 侧可以只用 kind 默认表),
 * 所以本函数不依赖任何注册状态,可以对着一份序列化的 verdict 复算。
 */
export function countLayeredMilestones(
  scriptMilestones: ReadonlyArray<{ kind: string }>,
  missing: ReadonlyArray<{ index: number; expected?: { kind: string } }>,
  isCritical: (milestone: { kind: string }) => boolean,
): LayeredMilestoneCounts {
  let criticalTotal = 0;
  let optionalTotal = 0;
  for (const milestone of scriptMilestones) {
    if (isCritical(milestone)) criticalTotal += 1;
    else optionalTotal += 1;
  }

  let criticalMissing = 0;
  let optionalMissing = 0;
  const seen = new Set<number>();
  for (const diff of missing) {
    const milestone = diff.expected;
    if (!milestone) continue;
    if (seen.has(diff.index)) continue;
    seen.add(diff.index);
    if (isCritical(milestone)) criticalMissing += 1;
    else optionalMissing += 1;
  }
  return { criticalMissing, optionalMissing, criticalTotal, optionalTotal };
}

// ---------------------------------------------------------------------------
// 多数决(契约 §6.2:双跑一致定档;1/2 分裂自动第三跑取多数,verdict 标 flaky)
// ---------------------------------------------------------------------------

export type SemanticMajorityDecidedBy = 'unanimous' | 'majority' | 'tie';

export interface SemanticMajorityDecision {
  grade: SemanticGrade;
  /** 各跑档位不一致 ⇒ 这条 tape / 这个游戏在抖。 */
  flaky: boolean;
  decidedBy: SemanticMajorityDecidedBy;
  votes: readonly SemanticGrade[];
  tally: Readonly<Record<SemanticGrade, number>>;
}

export interface SemanticMajorityOptions {
  /** 至少跑几次才允许定档。 */
  minRuns?: number;
  /** 最多跑几次(分裂时用满)。 */
  maxRuns?: number;
}

/**
 * 票数是否已经足以定档。`null` = 还得再跑一次。
 *
 * 平票(例:三跑三个档)不重跑到天荒地老,取**最差档** + flaky —— 宁可低估一条 tape,
 * 也不能让一次侥幸的 clean 把抖动的基线放进中心库。
 */
export function decideSemanticGradeMajority(
  votes: readonly SemanticGrade[],
  options: SemanticMajorityOptions = {},
): SemanticMajorityDecision | null {
  const minRuns = Math.max(1, Math.floor(options.minRuns ?? 2));
  const maxRuns = Math.max(minRuns, Math.floor(options.maxRuns ?? 3));
  if (votes.length < minRuns) return null;

  const tally = tallyGrades(votes);
  const unanimous = votes.every((grade) => grade === votes[0]);
  if (unanimous) {
    return { grade: votes[0]!, flaky: false, decidedBy: 'unanimous', votes: [...votes], tally };
  }

  const majorityGrade = findStrictMajority(tally, votes.length);
  if (majorityGrade) {
    return { grade: majorityGrade, flaky: true, decidedBy: 'majority', votes: [...votes], tally };
  }
  if (votes.length < maxRuns) return null;

  return { grade: worstSemanticGrade(votes), flaky: true, decidedBy: 'tie', votes: [...votes], tally };
}

export interface SemanticMajorityRun<TVerdict> {
  verdict: TVerdict;
  grade: SemanticGrade;
}

export interface SemanticMajorityResult<TVerdict> {
  decision: SemanticMajorityDecision;
  runs: ReadonlyArray<SemanticMajorityRun<TVerdict>>;
}

/**
 * 反复调用 `run` 直到票数足以定档。`run` 由调用方提供(浏览器里是一次 restart + semanticReplay),
 * 因此本函数在 node 单测里可以喂假 verdict 直接验多数决,不需要引擎。
 */
export async function runSemanticGradeMajority<TVerdict>(
  run: (runIndex: number) => Promise<TVerdict> | TVerdict,
  readGrade: (verdict: TVerdict) => SemanticGrade,
  options: SemanticMajorityOptions = {},
): Promise<SemanticMajorityResult<TVerdict>> {
  const minRuns = Math.max(1, Math.floor(options.minRuns ?? 2));
  const maxRuns = Math.max(minRuns, Math.floor(options.maxRuns ?? 3));
  const runs: Array<SemanticMajorityRun<TVerdict>> = [];
  let decision: SemanticMajorityDecision | null = null;

  while (runs.length < maxRuns) {
    const verdict = await run(runs.length);
    runs.push({ verdict, grade: readGrade(verdict) });
    decision = decideSemanticGradeMajority(runs.map((item) => item.grade), { minRuns, maxRuns });
    if (decision) break;
  }
  if (!decision) {
    // 只可能在 maxRuns < minRuns 这种被 clamp 掉的配置里出现;兜底取最差档。
    const votes = runs.map((item) => item.grade);
    decision = {
      grade: worstSemanticGrade(votes),
      flaky: votes.some((grade) => grade !== votes[0]),
      decidedBy: 'tie',
      votes,
      tally: tallyGrades(votes),
    };
  }
  return { decision, runs };
}

function tallyGrades(votes: readonly SemanticGrade[]): Record<SemanticGrade, number> {
  const tally: Record<SemanticGrade, number> = { clean: 0, good: 0, degraded: 0, failed: 0 };
  for (const grade of votes) tally[grade] += 1;
  return tally;
}

function findStrictMajority(tally: Record<SemanticGrade, number>, total: number): SemanticGrade | null {
  for (const grade of SEMANTIC_GRADE_ORDER) {
    if (tally[grade] * 2 > total) return grade;
  }
  return null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SEMANTIC_GRADE_THRESHOLDS.optionalMissingRatio;
  return Math.min(1, Math.max(0, value));
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatPercent(ratio: number): string {
  return `${roundTo(ratio * 100, 1)}%`;
}
