import {
  isSemanticGradeAtLeast,
  runSemanticGradeMajority,
  type SemanticGrade,
  type SemanticMajorityDecision,
  type SemanticMajorityOptions,
} from './semantic/grade';
import type { SemanticVerdict } from './semantic/replay';

export interface BenchmarkPerfSample {
  fps?: number | null;
  frameMs?: number | null;
  drawCalls?: number | null;
}

export interface BenchmarkPerfSummary {
  avgFps: number | null;
  p95FrameMs: number | null;
  avgDrawCalls: number | null;
  samples: number;
}

export interface RecordReplayBenchmarkResult {
  verdict: SemanticVerdict;
  perf: BenchmarkPerfSummary;
  /** 保持原语义 = `verdict.ok`(二值)。门槛判断请用 `grade`。 */
  pass: boolean;
  /** 四档等级,等于 `verdict.grade`,提到顶层方便 runner 直接读。 */
  grade: SemanticGrade;
}

/** 登记基线的必要条件(契约 §6.2):Mode B ≥ good。 */
export function meetsBaselineRegistrationBar(grade: SemanticGrade): boolean {
  return isSemanticGradeAtLeast(grade, 'good');
}

export interface RecordReplayBenchmarkMajorityResult {
  decision: SemanticMajorityDecision;
  /** 代表性 verdict:定档那一跑里**最差**的一条(便于直接看失败证据)。已盖 `flaky` 章。 */
  verdict: SemanticVerdict;
  results: readonly RecordReplayBenchmarkResult[];
}

/**
 * 双跑一致定档;1/2 分裂自动第三跑取多数(契约 §6.2)。
 *
 * `runOnce` 由调用方提供 —— 浏览器里是「restart + semanticReplay + 采样 perf」,
 * 单测里可以直接喂假结果。抖动的运行会被标 `flaky`,别把它当基线登记。
 */
export async function runRecordReplayBenchmarkMajority(
  runOnce: (runIndex: number) => Promise<RecordReplayBenchmarkResult> | RecordReplayBenchmarkResult,
  options: SemanticMajorityOptions = {},
): Promise<RecordReplayBenchmarkMajorityResult> {
  const { decision, runs } = await runSemanticGradeMajority(
    runOnce,
    (result) => result.grade,
    options,
  );
  const results = runs.map((run) => run.verdict);
  // 代表 verdict 取「定档档位里最差的那一跑」;没有恰好等于定档的(平票取最差档时可能发生),
  // 就退回全部里最差的一条。总之给出的证据必须是最难看的那份。
  const matching = results.filter((result) => result.grade === decision.grade);
  const pool = matching.length > 0 ? matching : results;
  const representative = pool.reduce((worst, result) => (result.verdict.ok ? worst : result), pool[0]!);
  const verdict: SemanticVerdict = decision.flaky
    ? { ...representative.verdict, flaky: true }
    : representative.verdict;
  return { decision, verdict, results };
}

export function summarizeBenchmarkPerf(samples: readonly BenchmarkPerfSample[]): BenchmarkPerfSummary {
  const fpsValues = finiteNumbers(samples.map((sample) => sample.fps));
  const frameMsValues = finiteNumbers(samples.map((sample) => sample.frameMs));
  const drawCallValues = finiteNumbers(samples.map((sample) => sample.drawCalls));
  return {
    avgFps: average(fpsValues, 1),
    p95FrameMs: percentile(frameMsValues, 0.95, 1),
    avgDrawCalls: average(drawCallValues, 1),
    samples: samples.length,
  };
}

export function createRecordReplayBenchmarkResult(
  verdict: SemanticVerdict,
  samples: readonly BenchmarkPerfSample[],
): RecordReplayBenchmarkResult {
  return {
    verdict,
    perf: summarizeBenchmarkPerf(samples),
    pass: verdict.ok,
    grade: verdict.grade,
  };
}

export function formatBenchmarkConclusion(result: RecordReplayBenchmarkResult): string {
  const verdict = result.verdict;
  const expectedMilestones = verdict.milestones.matched + verdict.milestones.missing.length;
  const milestoneText = expectedMilestones > 0
    ? `${verdict.milestones.matched}/${expectedMilestones}`
    : `${verdict.milestones.matched}`;
  const criticalText = `${verdict.milestones.criticalMissing} critical missing`;
  return [
    `BENCHMARK ${result.pass ? 'PASS' : 'FAIL'}`,
    `grade=${verdict.grade}${verdict.flaky ? ' (flaky)' : ''}`,
    `avgFps=${formatMetric(result.perf.avgFps)}`,
    `p95FrameMs=${formatMetric(result.perf.p95FrameMs)}`,
    `avgDrawCalls=${formatMetric(result.perf.avgDrawCalls)}`,
    `quality=${verdict.quality}`,
    `milestones=${milestoneText}`,
    criticalText,
    `waypoints=${verdict.waypoints.reached} reached/${verdict.waypoints.skipped} skipped`,
  ].join(' ');
}

function finiteNumbers(values: ReadonlyArray<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function average(values: readonly number[], digits: number): number | null {
  if (values.length <= 0) return null;
  return roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, digits);
}

function percentile(values: readonly number[], rank: number, digits: number): number | null {
  if (values.length <= 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1));
  return roundTo(sorted[index] ?? 0, digits);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatMetric(value: number | null): string {
  return value === null ? 'n/a' : String(value);
}
