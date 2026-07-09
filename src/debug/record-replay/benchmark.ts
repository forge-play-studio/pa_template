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
  pass: boolean;
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
  };
}

export function formatBenchmarkConclusion(result: RecordReplayBenchmarkResult): string {
  const verdict = result.verdict;
  const expectedMilestones = verdict.milestones.matched + verdict.milestones.missing.length;
  const milestoneText = expectedMilestones > 0
    ? `${verdict.milestones.matched}/${expectedMilestones}`
    : `${verdict.milestones.matched}`;
  return [
    `BENCHMARK ${result.pass ? 'PASS' : 'FAIL'}`,
    `avgFps=${formatMetric(result.perf.avgFps)}`,
    `p95FrameMs=${formatMetric(result.perf.p95FrameMs)}`,
    `avgDrawCalls=${formatMetric(result.perf.avgDrawCalls)}`,
    `quality=${verdict.quality}`,
    `milestones=${milestoneText}`,
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
