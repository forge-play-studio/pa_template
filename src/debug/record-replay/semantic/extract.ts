import {
  assertDemoRecording,
  normalizeMovementInput,
  normalizeRecordedDt,
  type DemoRecording,
  type DemoRecordingStateSample,
} from '../schema';
import {
  detectRecordReplayMilestones,
  readRecordReplayEconomyFromSnapshots,
  readRecordReplayFactsFromSnapshots,
  type RecordReplayEconomyGateExpectation,
  type RecordReplayEconomyState,
  type RecordReplayObservation,
} from '../providers';
import type { SemanticTrailPoint } from './path-tracker';

export type SemanticInputSegmentKind = 'drag' | 'idle';
export type SemanticMilestoneKind = string;

export interface SemanticScript {
  meta: {
    schemaVersion: 1;
    sourceTape: string;
    seed: number;
    durationSec: number;
    extractedAt: string;
    /**
     * 示教移动速度中位数(u/s,排除 <0.3 u/s 的驻留/噪声段)。
     * 回放侧卡死看门狗用它导出「有意义进度」阈值 —— 示教即真值,不用固定魔法数字;
     * 换游戏(慢速潜行/高速载具)阈值自动跟着该游戏的示教走。
     * 可选:老剧本不带此字段,回放侧回退固定阈值。
     */
    trailMovingSpeedP50?: number;
  };
  inputSegments: SemanticInputSegment[];
  milestones: SemanticMilestone[];
  waypoints: SemanticWaypoint[];
  /**
   * 抽稀后的完整示教航迹(时间参数化)。Mode B 的轨迹跟踪用它复现「扫过路径」与节奏;
   * waypoints 只留作 verdict 统计与老脚本兼容。老 tape 无 trail 时该字段缺省。
   */
  trail?: SemanticTrailPoint[];
  economyFinal: SemanticEconomyState;
}

export type { SemanticTrailPoint };

export interface SemanticInputSegment {
  tStart: number;
  tEnd: number;
  kind: SemanticInputSegmentKind;
  keypoints: SemanticInputKeypoint[];
}

export interface SemanticInputKeypoint {
  t: number;
  x: number;
  y: number;
  magnitude: number;
}

export interface SemanticMilestone {
  t: number;
  kind: SemanticMilestoneKind;
  detail: Record<string, number | string>;
  economyAtGate?: SemanticEconomyGateExpectation;
}

export interface SemanticWaypoint {
  t: number;
  x: number;
  z: number;
  dwellSec?: number;
}

export type SemanticEconomyState = RecordReplayEconomyState;

export type SemanticEconomyGateExpectation = RecordReplayEconomyGateExpectation;

export type SemanticObservation = RecordReplayObservation;

export interface ExtractSemanticScriptOptions {
  sourceTape?: string;
  extractedAt?: string;
  inputTolerance?: number;
  waypointTolerance?: number;
  trimLeadingIdle?: boolean;
  dwellDistanceEpsilon?: number;
  dwellMinSec?: number;
  /** trail 抽稀:相邻保留点的最小空间间距。 */
  trailSpacing?: number;
  /** trail 抽稀:即使没移动,超过该时间间隔也保留一个点(保住 dwell 的时间分辨率)。 */
  trailMaxTimeGap?: number;
}

export interface ExtractSemanticSummary {
  sourceTape: string;
  sourceFrames: number;
  sourceStateSamples: number;
  durationSec: number;
  inputSegments: number;
  dragSegments: number;
  idleSegments: number;
  inputKeypoints: number;
  milestones: number;
  waypoints: number;
  sourceBytes: number | null;
  semanticBytes: number;
  compressionRatio: number | null;
}

export interface ExtractSemanticScriptResult {
  recording: DemoRecording;
  script: SemanticScript;
  summary: ExtractSemanticSummary;
  /** Non-fatal problems that make the script weak or worthless. Empty = clean. */
  warnings: string[];
}

/**
 * Why a script may be unusable for certification.
 *
 * `milestones` come from `recording.stateSamples` and `waypoints` from `recording.trail`.
 * A tape that carries neither (e.g. one assembled without them) still extracts *something* —
 * input segments — and would otherwise sail through `semanticReplay` asserting nothing.
 * That silent pass is worse than a failure, so name the gaps explicitly.
 */
export function describeSemanticScriptGaps(
  recording: DemoRecording,
  script: SemanticScript,
): string[] {
  const warnings: string[] = [];
  const sampleCount = recording.stateSamples?.length ?? 0;
  const trailCount = recording.trail?.length ?? 0;
  if (sampleCount === 0) {
    warnings.push('recording.stateSamples is empty — no observations, so no milestones can be extracted.');
  }
  if (trailCount === 0) {
    warnings.push('recording.trail is empty — waypoints fall back to sparse state samples, and Mode B loses trail following.');
  }
  if (script.milestones.length === 0 && script.waypoints.length === 0) {
    warnings.push('semantic script asserts nothing (0 milestones, 0 waypoints); it cannot certify a replay.');
  }
  if (recording.envelope?.truncated) {
    warnings.push(
      `recording was truncated: RecorderSource dropped ${recording.envelope?.droppedFrames ?? 'some'} leading frames `
      + '(maxFrames overflow). The envelope\'s anchorFrame/startStateHash describe a start that is no longer in the tape, '
      + 'so Mode A refuses it. Waypoints and milestones remain usable, but the script no longer covers the demo\'s opening.',
    );
  }
  return warnings;
}

/** A script with neither milestones nor waypoints can only ever produce a vacuous pass. */
export function isSemanticScriptCertifiable(script: SemanticScript): boolean {
  return script.milestones.length > 0 || script.waypoints.length > 0;
}

const DEFAULT_INPUT_RDP_TOLERANCE = 0.02;
const DEFAULT_WAYPOINT_RDP_TOLERANCE = 0.5;
const DEFAULT_DWELL_DISTANCE_EPSILON = 0.5;
const DEFAULT_DWELL_MIN_SEC = 1.5;
const DEFAULT_TRAIL_SPACING = 0.08;
const DEFAULT_TRAIL_MAX_TIME_GAP = 0.2;
const MAX_LEADING_IDLE_SEC = 2;
const ACTIVE_INPUT_EPSILON = 0.0001;

export function parseSemanticRecordingInput(input: DemoRecording | string): DemoRecording {
  let parsed: unknown = typeof input === 'string' ? JSON.parse(input) : input;
  if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  const recording = parsed as DemoRecording;
  assertDemoRecording(recording);
  return recording;
}

export function extractSemanticScript(
  input: DemoRecording | string,
  options: ExtractSemanticScriptOptions = {},
): ExtractSemanticScriptResult {
  const recording = parseSemanticRecordingInput(input);
  const frameTimes = buildFrameTimes(recording);
  const rawInputSegments = extractInputSegments(
    recording,
    frameTimes,
    options.inputTolerance ?? DEFAULT_INPUT_RDP_TOLERANCE,
  );
  const trimOffset = options.trimLeadingIdle === false
    ? 0
    : calculateLeadingIdleTrimOffset(rawInputSegments);
  const observations = trimSemanticObservations(
    buildSemanticObservations(recording, frameTimes),
    trimOffset,
  );
  const inputSegments = trimInputSegments(rawInputSegments, trimOffset);
  // 逐帧事件优先:稀疏 stateSample 之间的短命事件(false→true→false)只有它有。
  // 老 tape 没有 events,退回基于采样的提取(会漏短命事件,但不改变既有行为)。
  const milestones = extractMilestonesFromEvents(recording, frameTimes, trimOffset)
    ?? extractMilestones(observations);
  const rawTrailPoints: SemanticWaypoint[] = (recording.trail ?? [])
    .slice(0, frameTimes.length)
    .map((pair, index) => ({ t: roundTime(frameTimes[index] ?? 0), x: pair[0], z: pair[1] }));
  const trailPoints = trimSemanticWaypoints(rawTrailPoints, trimOffset);
  const observationPoints = observations
    .map((observation) => observation.playerPosition)
    .filter((point): point is SemanticWaypoint => !!point);
  const waypointSource = trailPoints.length > 1 ? trailPoints : observationPoints;
  const waypointTolerance = options.waypointTolerance ?? DEFAULT_WAYPOINT_RDP_TOLERANCE;
  const waypoints = simplifySemanticWaypoints(
    withDwellWaypoints(
      waypointSource,
      detectWaypointDwells(
        waypointSource,
        options.dwellDistanceEpsilon ?? DEFAULT_DWELL_DISTANCE_EPSILON,
        options.dwellMinSec ?? DEFAULT_DWELL_MIN_SEC,
      ),
      waypointTolerance,
    ),
    waypointTolerance,
  );
  const trail = decimateSemanticTrail(
    trailPoints,
    options.trailSpacing ?? DEFAULT_TRAIL_SPACING,
    options.trailMaxTimeGap ?? DEFAULT_TRAIL_MAX_TIME_GAP,
  );
  const durationSec = roundTime(
    observations[observations.length - 1]?.t
      ?? Math.max(0, (frameTimes[frameTimes.length - 1] ?? 0) - trimOffset),
  );
  const economyFinal = observations[observations.length - 1]?.economy ?? {
    cash: 0,
    totalEarned: 0,
    totalSpent: 0,
  };
  const sourceTape = options.sourceTape
    ?? recording.envelope.label
    ?? 'recording';
  const trailMovingSpeedP50 = computeTrailMovingSpeedP50(trailPoints);
  const script: SemanticScript = {
    meta: {
      schemaVersion: 1,
      sourceTape,
      seed: recording.envelope.seed,
      durationSec,
      extractedAt: options.extractedAt ?? new Date().toISOString(),
      ...(trailMovingSpeedP50 !== null ? { trailMovingSpeedP50 } : {}),
    },
    inputSegments,
    milestones,
    waypoints,
    ...(trail.length > 1 ? { trail } : {}),
    economyFinal,
  };
  const summary = summarizeSemanticScript(recording, script, null);
  const warnings = describeSemanticScriptGaps(recording, script);
  if (warnings.length > 0) {
    console.warn('[record-replay] semantic script has gaps:', warnings);
  }
  return { recording, script, summary, warnings };
}

/**
 * trail 抽稀:保留形状(空间间距)与节奏(时间间隔)。
 * 时间间隔那一条很关键 —— 人类站着不动的 dwell 在空间上是同一个点,
 * 只有靠时间间隔才能把「站了多久」保留下来。
 */
export function decimateSemanticTrail(
  points: readonly SemanticWaypoint[],
  minSpacing: number,
  maxTimeGap: number,
): SemanticTrailPoint[] {
  if (points.length <= 2) return points.map((point) => ({ t: point.t, x: point.x, z: point.z }));
  const spacing = Math.max(0.001, minSpacing);
  const timeGap = Math.max(0.001, maxTimeGap);
  const first = points[0]!;
  const kept: SemanticTrailPoint[] = [{ t: first.t, x: first.x, z: first.z }];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]!;
    const last = kept[kept.length - 1]!;
    const moved = Math.hypot(point.x - last.x, point.z - last.z);
    if (moved >= spacing || point.t - last.t >= timeGap) {
      kept.push({ t: point.t, x: point.x, z: point.z });
    }
  }
  const final = points[points.length - 1]!;
  const last = kept[kept.length - 1]!;
  if (final.t > last.t) kept.push({ t: final.t, x: final.x, z: final.z });
  return kept;
}

export function summarizeSemanticScript(
  recording: DemoRecording,
  script: SemanticScript,
  sourceBytes: number | null,
): ExtractSemanticSummary {
  const semanticBytes = JSON.stringify(script).length;
  return {
    sourceTape: script.meta.sourceTape,
    sourceFrames: recording.frames.length,
    sourceStateSamples: recording.stateSamples?.length ?? 0,
    durationSec: script.meta.durationSec,
    inputSegments: script.inputSegments.length,
    dragSegments: script.inputSegments.filter((segment) => segment.kind === 'drag').length,
    idleSegments: script.inputSegments.filter((segment) => segment.kind === 'idle').length,
    inputKeypoints: script.inputSegments.reduce((sum, segment) => sum + segment.keypoints.length, 0),
    milestones: script.milestones.length,
    waypoints: script.waypoints.length,
    sourceBytes,
    semanticBytes,
    compressionRatio: sourceBytes && sourceBytes > 0 ? roundTo(sourceBytes / semanticBytes, 2) : null,
  };
}

export function simplifyInputKeypoints(
  points: readonly SemanticInputKeypoint[],
  tolerance = DEFAULT_INPUT_RDP_TOLERANCE,
): SemanticInputKeypoint[] {
  return simplifyByRdp(points, tolerance, inputSignalDistance);
}

export function simplifySemanticWaypoints(
  points: readonly SemanticWaypoint[],
  tolerance = DEFAULT_WAYPOINT_RDP_TOLERANCE,
): SemanticWaypoint[] {
  const simplified = simplifyByRdp(points, tolerance, waypointDistance);
  const dwellMarkers = points.filter((point) => (point.dwellSec ?? 0) > 0);
  return withDwellWaypoints(simplified, dwellMarkers, tolerance);
}

export function diffSemanticObservations(
  previous: SemanticObservation,
  next: SemanticObservation,
): SemanticMilestone[] {
  const t = roundTime((previous.t + next.t) / 2);
  return detectRecordReplayMilestones(previous, next).map((event) => ({
    t: roundTime(event.t ?? t),
    kind: event.kind,
    detail: { ...event.detail },
    economyAtGate: event.economyAtGate ? { ...event.economyAtGate } : undefined,
  }));
}

export function isEconomyOnlySemanticMilestone(milestone: SemanticMilestone): boolean {
  if (milestone.kind === 'sale') return true;
  if (milestone.kind !== 'spend' && milestone.kind !== 'hire') return false;
  const detail = milestone.detail;
  const hasSpendDetail = detail.totalSpent !== undefined || detail.totalSpentDelta !== undefined;
  const hasIdentityDetail = detail.id !== undefined || detail.field !== undefined;
  return hasSpendDetail && !hasIdentityDetail;
}

export function isDiscreteSemanticMilestone(milestone: SemanticMilestone): boolean {
  if (isEconomyOnlySemanticMilestone(milestone)) return false;
  return milestone.kind !== 'sale' && milestone.kind !== 'spend';
}

export function readSemanticObservationFromSnapshot(snapshot: unknown, fallbackTime: number): SemanticObservation {
  const root = asRecord(snapshot);
  const snapshots = readProviderSnapshots(root);
  const t = readFiniteNumber(root.time, fallbackTime);
  return {
    t,
    economy: readRecordReplayEconomyFromSnapshots(snapshots),
    facts: readRecordReplayFactsFromSnapshots(snapshots),
    snapshots,
    playerPosition: readPlayerPosition(root, fallbackTime),
  };
}

function buildFrameTimes(recording: DemoRecording): number[] {
  const times: number[] = [];
  let elapsed = 0;
  for (const frame of recording.frames) {
    elapsed += normalizeRecordedDt(frame.dt);
    times.push(roundTime(elapsed));
  }
  return times;
}

function extractInputSegments(
  recording: DemoRecording,
  frameTimes: readonly number[],
  tolerance: number,
): SemanticInputSegment[] {
  const segments: SemanticInputSegment[] = [];
  let currentKind: SemanticInputSegmentKind | null = null;
  let currentPoints: SemanticInputKeypoint[] = [];

  const flush = (): void => {
    if (!currentKind || currentPoints.length <= 0) return;
    const keypoints = currentKind === 'drag'
      ? simplifyInputKeypoints(currentPoints, tolerance)
      : reduceIdleKeypoints(currentPoints);
    segments.push({
      tStart: roundTime(currentPoints[0]?.t ?? 0),
      tEnd: roundTime(currentPoints[currentPoints.length - 1]?.t ?? 0),
      kind: currentKind,
      keypoints,
    });
    currentKind = null;
    currentPoints = [];
  };

  for (let index = 0; index < recording.frames.length; index += 1) {
    const frame = recording.frames[index];
    const input = normalizeMovementInput(frame?.input);
    const kind: SemanticInputSegmentKind = input.isActive && input.magnitude > ACTIVE_INPUT_EPSILON ? 'drag' : 'idle';
    const point: SemanticInputKeypoint = {
      t: roundTime(frameTimes[index] ?? 0),
      x: input.x,
      y: input.y,
      magnitude: input.magnitude,
    };
    if (currentKind && kind !== currentKind) flush();
    currentKind = kind;
    currentPoints.push(point);
  }
  flush();
  return segments;
}

function calculateLeadingIdleTrimOffset(inputSegments: readonly SemanticInputSegment[]): number {
  const firstDrag = inputSegments.find((segment) => segment.kind === 'drag');
  if (!firstDrag) return 0;
  return Math.max(0, roundTime(firstDrag.tStart - MAX_LEADING_IDLE_SEC));
}

function trimInputSegments(
  inputSegments: readonly SemanticInputSegment[],
  trimOffset: number,
): SemanticInputSegment[] {
  if (trimOffset <= 0) {
    return inputSegments.map((segment) => ({
      ...segment,
      keypoints: segment.keypoints.map((point) => ({ ...point })),
    }));
  }
  return inputSegments
    .filter((segment) => segment.tEnd >= trimOffset)
    .map((segment) => {
      const points = segment.keypoints.filter((point) => point.t >= trimOffset);
      const keypoints = segment.tStart < trimOffset
        ? [interpolateInputKeypointAt(segment.keypoints, trimOffset), ...points]
        : points;
      const trimmedKeypoints = keypoints.map((point) => ({
        ...point,
        t: roundTime(Math.max(0, point.t - trimOffset)),
      }));
      const uniqueKeypoints = dedupeKeypointsByTime(trimmedKeypoints);
      return {
        tStart: roundTime(Math.max(0, segment.tStart - trimOffset)),
        tEnd: roundTime(Math.max(0, segment.tEnd - trimOffset)),
        kind: segment.kind,
        keypoints: uniqueKeypoints,
      };
    })
    .filter((segment) => segment.keypoints.length > 0 && segment.tEnd >= segment.tStart);
}

function trimSemanticObservations(
  observations: readonly SemanticObservation[],
  trimOffset: number,
): SemanticObservation[] {
  if (trimOffset <= 0) return observations.map((observation) => cloneObservation(observation));
  const beforeCandidates = observations.filter((observation) => observation.t <= trimOffset);
  const before = beforeCandidates[beforeCandidates.length - 1];
  const after = observations.filter((observation) => observation.t > trimOffset);
  const trimmed: SemanticObservation[] = [];
  if (before) {
    trimmed.push({
      ...cloneObservation(before),
      t: 0,
      playerPosition: before.playerPosition
        ? { ...before.playerPosition, t: 0 }
        : null,
    });
  }
  for (const observation of after) {
    const t = roundTime(observation.t - trimOffset);
    trimmed.push({
      ...cloneObservation(observation),
      t,
      playerPosition: observation.playerPosition
        ? { ...observation.playerPosition, t }
        : null,
    });
  }
  return trimmed;
}

function trimSemanticWaypoints(
  waypoints: readonly SemanticWaypoint[],
  trimOffset: number,
): SemanticWaypoint[] {
  if (trimOffset <= 0) return waypoints.map((waypoint) => ({ ...waypoint }));
  const trimmed: SemanticWaypoint[] = [];
  const boundary = interpolateWaypointAt(waypoints, trimOffset);
  if (boundary) trimmed.push({ ...boundary, t: 0 });
  for (const waypoint of waypoints) {
    if (waypoint.t <= trimOffset) continue;
    trimmed.push({
      ...waypoint,
      t: roundTime(waypoint.t - trimOffset),
    });
  }
  return dedupeWaypointsByTime(trimmed);
}

function detectWaypointDwells(
  points: readonly SemanticWaypoint[],
  distanceEpsilon: number,
  minSec: number,
): SemanticWaypoint[] {
  if (points.length <= 1) return [];
  const markers: SemanticWaypoint[] = [];
  let anchorIndex = 0;
  let lastWithinIndex = 0;
  const flush = (): void => {
    const anchor = points[anchorIndex];
    const lastWithin = points[lastWithinIndex];
    if (!anchor || !lastWithin) return;
    const dwellSec = roundTime(lastWithin.t - anchor.t);
    if (dwellSec >= minSec) {
      markers.push({
        t: anchor.t,
        x: anchor.x,
        z: anchor.z,
        dwellSec,
      });
    }
  };

  for (let index = 1; index < points.length; index += 1) {
    const anchor = points[anchorIndex];
    const point = points[index];
    if (!anchor || !point) continue;
    if (Math.hypot(point.x - anchor.x, point.z - anchor.z) <= distanceEpsilon) {
      lastWithinIndex = index;
      continue;
    }
    flush();
    anchorIndex = index;
    lastWithinIndex = index;
  }
  flush();
  return markers;
}

function withDwellWaypoints(
  points: readonly SemanticWaypoint[],
  dwellMarkers: readonly SemanticWaypoint[],
  tolerance: number,
): SemanticWaypoint[] {
  if (dwellMarkers.length <= 0) return points.map((point) => ({ ...point }));
  const result = points.map((point) => ({ ...point }));
  for (const marker of dwellMarkers) {
    const nearestIndex = findNearestWaypointIndex(result, marker);
    const nearest = nearestIndex >= 0 ? result[nearestIndex] : null;
    const mergeDistance = nearest ? Math.hypot(nearest.x - marker.x, nearest.z - marker.z) : Number.POSITIVE_INFINITY;
    if (nearest && mergeDistance <= Math.max(tolerance, DEFAULT_DWELL_DISTANCE_EPSILON)) {
      nearest.dwellSec = Math.max(nearest.dwellSec ?? 0, marker.dwellSec ?? 0);
      continue;
    }
    result.push({ ...marker });
  }
  result.sort((a, b) => a.t - b.t);
  return dedupeWaypointsByTime(result);
}

function cloneObservation(observation: SemanticObservation): SemanticObservation {
  return {
    t: observation.t,
    economy: { ...observation.economy },
    facts: { ...observation.facts },
    snapshots: { ...observation.snapshots },
    playerPosition: observation.playerPosition ? { ...observation.playerPosition } : null,
  };
}

function interpolateInputKeypointAt(
  points: readonly SemanticInputKeypoint[],
  t: number,
): SemanticInputKeypoint {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first) return { t, x: 0, y: 0, magnitude: 0 };
  if (!last || t <= first.t) return { ...first, t };
  if (t >= last.t) return { ...last, t };
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const next = points[index];
    if (!previous || !next || t > next.t) continue;
    const span = next.t - previous.t;
    const ratio = Math.abs(span) <= 0.000001 ? 1 : (t - previous.t) / span;
    return {
      t,
      x: lerp(previous.x, next.x, ratio),
      y: lerp(previous.y, next.y, ratio),
      magnitude: lerp(previous.magnitude, next.magnitude, ratio),
    };
  }
  return { ...last, t };
}

function interpolateWaypointAt(
  waypoints: readonly SemanticWaypoint[],
  t: number,
): SemanticWaypoint | null {
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  if (!first) return null;
  if (!last || t <= first.t) return { ...first, t };
  if (t >= last.t) return { ...last, t };
  for (let index = 1; index < waypoints.length; index += 1) {
    const previous = waypoints[index - 1];
    const next = waypoints[index];
    if (!previous || !next || t > next.t) continue;
    const span = next.t - previous.t;
    const ratio = Math.abs(span) <= 0.000001 ? 1 : (t - previous.t) / span;
    return {
      t,
      x: lerp(previous.x, next.x, ratio),
      z: lerp(previous.z, next.z, ratio),
    };
  }
  return { ...last, t };
}

function dedupeKeypointsByTime(points: readonly SemanticInputKeypoint[]): SemanticInputKeypoint[] {
  const result: SemanticInputKeypoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && Math.abs(previous.t - point.t) <= 0.000001) {
      result[result.length - 1] = { ...point };
      continue;
    }
    result.push({ ...point });
  }
  return result;
}

function dedupeWaypointsByTime(points: readonly SemanticWaypoint[]): SemanticWaypoint[] {
  const result: SemanticWaypoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && Math.abs(previous.t - point.t) <= 0.000001) {
      result[result.length - 1] = {
        ...point,
        dwellSec: Math.max(previous.dwellSec ?? 0, point.dwellSec ?? 0) || undefined,
      };
      continue;
    }
    result.push({ ...point });
  }
  return result;
}

function findNearestWaypointIndex(
  points: readonly SemanticWaypoint[],
  target: SemanticWaypoint,
): number {
  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    const distance = Math.hypot(point.x - target.x, point.z - target.z);
    const timePenalty = Math.abs(point.t - target.t) * 0.01;
    const score = distance + timePenalty;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function buildSemanticObservations(
  recording: DemoRecording,
  frameTimes: readonly number[],
): SemanticObservation[] {
  return [...(recording.stateSamples ?? [])]
    .filter((sample) => Number.isFinite(sample.frame) && sample.frame >= 0)
    .sort((a, b) => a.frame - b.frame)
    .map((sample) => readObservationFromSample(sample, frameTimes));
}

function readObservationFromSample(
  sample: DemoRecordingStateSample,
  frameTimes: readonly number[],
): SemanticObservation {
  return readSemanticObservationFromSnapshot(
    sample.snapshot,
    frameTimes[sample.frame] ?? sample.frame / 60,
  );
}

/** `warning:*` 是录制器自己塞进 events 的诊断条目,不是玩法事件。 */
function isDetectorEvent(event: { kind?: unknown }): boolean {
  return typeof event.kind === 'string' && event.kind.length > 0 && !event.kind.startsWith('warning:');
}

/**
 * 从 tape 里逐帧持久化的 detector 事件重建里程碑。
 *
 * 返回 `null` 表示这条 tape 没有可用的逐帧事件(老 tape),调用方退回基于 stateSample 的提取。
 * 事件的 `frame` 是**帧索引**(与 stateSample 同一坐标系),`payload.economy` 是该帧的经济读数。
 */
function extractMilestonesFromEvents(
  recording: DemoRecording,
  frameTimes: readonly number[],
  trimOffset: number,
): SemanticMilestone[] | null {
  const events = (recording.events ?? []).filter(isDetectorEvent);
  if (events.length === 0) return null;

  const milestones: SemanticMilestone[] = [];
  for (const event of [...events].sort((a, b) => a.frame - b.frame)) {
    const payload = event.payload as { detail?: Record<string, number | string>; economy?: unknown } | undefined;
    const t = frameTimes[event.frame];
    if (typeof t !== 'number') continue;
    if (t <= trimOffset) continue;
    const milestone: SemanticMilestone = {
      t: roundTime(t - trimOffset),
      kind: event.kind,
      detail: { ...(payload?.detail ?? {}) },
      economyAtGate: readEconomyGateExpectation(readEconomyFromUnknown(payload?.economy)),
    };
    if (!isDiscreteSemanticMilestone(milestone)) continue;
    milestones.push(milestone);
  }
  return milestones;
}

function readEconomyFromUnknown(value: unknown): { cash: number; totalEarned: number; totalSpent: number } {
  const record = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const read = (key: string): number => (typeof record[key] === 'number' && Number.isFinite(record[key] as number)
    ? record[key] as number
    : 0);
  return { cash: read('cash'), totalEarned: read('totalEarned'), totalSpent: read('totalSpent') };
}

function extractMilestones(observations: readonly SemanticObservation[]): SemanticMilestone[] {
  const milestones: SemanticMilestone[] = [];
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1];
    const next = observations[index];
    if (!previous || !next) continue;
    const economyAtGate = readEconomyGateExpectation(next.economy);
    for (const milestone of diffSemanticObservations(previous, next)) {
      if (!isDiscreteSemanticMilestone(milestone)) continue;
      milestones.push({
        ...milestone,
        detail: { ...milestone.detail },
        economyAtGate,
      });
    }
  }
  return milestones;
}

function readEconomyGateExpectation(economy: SemanticEconomyState): SemanticEconomyGateExpectation {
  return {
    totalEarned: economy.totalEarned,
    totalSpent: economy.totalSpent,
  };
}

function reduceIdleKeypoints(points: readonly SemanticInputKeypoint[]): SemanticInputKeypoint[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first) return [];
  if (!last || first.t === last.t) return [{ ...first }];
  return [{ ...first }, { ...last }];
}

function simplifyByRdp<T>(
  points: readonly T[],
  tolerance: number,
  distance: (point: T, start: T, end: T) => number,
): T[] {
  if (points.length <= 2) return points.map((point) => ({ ...point }));
  let maxDistance = -1;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];
  if (!start || !end) return [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (!point) continue;
    const currentDistance = distance(point, start, end);
    if (currentDistance > maxDistance) {
      maxDistance = currentDistance;
      maxIndex = index;
    }
  }
  if (maxDistance <= tolerance) return [{ ...start }, { ...end }];
  return [
    ...simplifyByRdp(points.slice(0, maxIndex + 1), tolerance, distance).slice(0, -1),
    ...simplifyByRdp(points.slice(maxIndex), tolerance, distance),
  ];
}

function inputSignalDistance(
  point: SemanticInputKeypoint,
  start: SemanticInputKeypoint,
  end: SemanticInputKeypoint,
): number {
  const span = end.t - start.t;
  if (Math.abs(span) <= 0.000001) {
    return Math.hypot(point.x - start.x, point.y - start.y, point.magnitude - start.magnitude);
  }
  const ratio = Math.max(0, Math.min(1, (point.t - start.t) / span));
  const x = lerp(start.x, end.x, ratio);
  const y = lerp(start.y, end.y, ratio);
  const magnitude = lerp(start.magnitude, end.magnitude, ratio);
  return Math.hypot(point.x - x, point.y - y, point.magnitude - magnitude);
}

function waypointDistance(point: SemanticWaypoint, start: SemanticWaypoint, end: SemanticWaypoint): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  if (lengthSquared <= 0.000001) return Math.hypot(point.x - start.x, point.z - start.z);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  const x = start.x + dx * ratio;
  const z = start.z + dz * ratio;
  return Math.hypot(point.x - x, point.z - z);
}

function readProviderSnapshots(root: JsonRecord): Record<string, unknown> {
  const snapshots: Record<string, unknown> = {};
  const providers = Array.isArray(root.providers) ? root.providers : [];
  for (const provider of providers) {
    const record = asRecord(provider);
    const name = typeof record.name === 'string' && record.name.trim()
      ? record.name.trim()
      : null;
    if (!name) continue;
    snapshots[name] = record.snapshot;
  }
  return snapshots;
}

function readPlayerPosition(root: JsonRecord, fallbackTime: number): SemanticWaypoint | null {
  const registeredPosition = asRecord(root.playerPosition);
  const player = asRecord(root.player);
  const playerPosition = asRecord(player.position);
  const position = Number.isFinite(registeredPosition.x)
    ? registeredPosition
    : Number.isFinite(playerPosition.x)
    ? playerPosition
    : null;
  if (!position) return null;
  return {
    t: roundTime(readFiniteNumber(root.time, fallbackTime)),
    x: roundTo(readFiniteNumber(position.x, 0), 6),
    z: roundTo(readFiniteNumber(position.z, 0), 6),
  };
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function lerp(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio;
}

/** 排除驻留/噪声段(<0.3 u/s)后的示教移动速度中位数;段数不足时返回 null(老/异常 tape)。 */
const TRAIL_MOVING_SPEED_NOISE_FLOOR = 0.3;

function computeTrailMovingSpeedP50(points: readonly SemanticWaypoint[]): number | null {
  const movingSpeeds: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const dt = current.t - previous.t;
    if (dt <= 0) continue;
    const speed = Math.hypot(current.x - previous.x, current.z - previous.z) / dt;
    if (speed > TRAIL_MOVING_SPEED_NOISE_FLOOR) movingSpeeds.push(speed);
  }
  if (movingSpeeds.length < 10) return null;
  movingSpeeds.sort((left, right) => left - right);
  return roundTime(movingSpeeds[Math.floor(movingSpeeds.length / 2)]!);
}

function roundTime(value: number): number {
  return roundTo(value, 4);
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

type JsonRecord = Record<string, unknown>;
