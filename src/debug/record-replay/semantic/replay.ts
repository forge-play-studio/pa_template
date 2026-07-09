import type { MovementInputSource, MovementInputState } from '../../../services/InputService';
import {
  collectRecordReplaySnapshotEntries,
  getRecordReplayMilestoneIdentity,
  isRecordReplayMilestoneSatisfied,
  readRecordReplayPlayerPosition,
} from '../providers';
import {
  diffSemanticObservations,
  isDiscreteSemanticMilestone,
  isEconomyOnlySemanticMilestone,
  readSemanticObservationFromSnapshot,
  type SemanticEconomyGateExpectation,
  type SemanticMilestone,
  type SemanticObservation,
  type SemanticScript,
  type SemanticWaypoint,
} from './extract';

export interface SemanticReplayOptions {
  waypointToleranceBand?: number;
  milestoneSlackSec?: number;
  stageTimeoutSlackSec?: number;
  stuckWindowSec?: number;
  stuckDistanceEpsilon?: number;
  calibrationPulseSec?: number;
  calibrationSettleSec?: number;
  calibrationMinDisplacement?: number;
  economyGateTolerance?: number;
  skipFailedStage?: boolean;
  maxLoopsPerStage?: number;
  maxDurationSec?: number;
}

export interface SemanticVerdict {
  ok: boolean;
  quality: 'clean' | 'recovered' | 'failed';
  milestones: {
    matched: number;
    missing: MilestoneDiff[];
    extra: MilestoneDiff[];
    orderViolations: number;
  };
  economyFinal: {
    pass: boolean;
    diffs: Record<string, { expected: number; actual: number }>;
  };
  economyGates: SemanticEconomyGateVerdict[];
  waypoints: {
    reached: number;
    skipped: number;
    maxDeviation: number;
    toleranceBand: number;
  };
  calibration: SemanticCalibrationVerdict;
  waypointsPerStage: number[];
  stages: SemanticStageVerdict[];
  stuckEvents: SemanticStuckEvent[];
  durationSec: number;
}

export interface SemanticEconomyGateVerdict {
  gate: {
    index: number;
    t: number;
    kind: SemanticMilestone['kind'];
    detail: Record<string, number | string>;
  };
  expected: SemanticEconomyGateExpectation;
  actual: SemanticEconomyGateExpectation;
  tolerance: number;
  pass: boolean;
}

export interface SemanticCalibrationVerdict {
  status: 'pending' | 'ok' | 'failed';
  attempts: number;
  pulseSec: number;
  settleSec: number;
  minDisplacement: number;
  displacement: {
    inputX: number;
    inputY: number;
  };
  matrix: {
    inputX: { x: number; z: number };
    inputY: { x: number; z: number };
  } | null;
  determinant: number | null;
  error?: string;
}

export interface MilestoneDiff {
  index: number;
  expected?: SemanticMilestone;
  actual?: SemanticMilestone;
  reason: string;
}

export interface SemanticStageVerdict {
  index: number;
  status: 'ok' | 'failed' | 'skipped';
  recoveries: number;
  loops: number;
  durationSec: number;
}

export interface SemanticStuckEvent {
  t: number;
  pos: { x: number; z: number };
  targetWaypoint: number;
  resolvedBy: string;
}

export interface SemanticReplayGame {
  getFrameCount(): number;
  getLastFrameDeltaTime(): number;
  getDeterminismContext(): { seed: number; elapsedTimeSec: number };
  getPlayer(): { position: { x: number; y: number; z: number } } | null;
  getCamera(): {
    position: { x: number; y: number; z: number };
    target: { x: number; y: number; z: number };
  } | null;
  getInputService(): SemanticReplayInputService | null;
  getPaused?(): boolean;
  resume?(): void;
  setDtOverride?(override: (() => number) | null): void;
}

export interface SemanticReplayInputService {
  getMovementSource(): MovementInputSource | null;
  setMovementSource(source: MovementInputSource | null): void;
}

export interface RunSemanticReplayOptions {
  game: SemanticReplayGame;
  inputService: SemanticReplayInputService;
  script: SemanticScript;
  options?: SemanticReplayOptions;
  shouldAbort?: () => boolean;
  onFrame?: (controller: SemanticReplayController) => void;
}

interface MutableStageVerdict {
  index: number;
  status: 'ok' | 'failed' | 'skipped' | 'active';
  recoveries: number;
  loops: number;
  startedAt: number;
  durationSec: number;
}

interface RecoveryState {
  kind: 'deflect' | 'backtrack';
  startedAt: number;
  until: number;
  angleRad: number;
}

type SemanticReplayPhase =
  | 'calibrate-x'
  | 'settle-after-x'
  | 'calibrate-y'
  | 'settle-after-y'
  | 'calibration-nudge'
  | 'navigating';

interface InputWorldCalibration {
  inputX: { x: number; z: number };
  inputY: { x: number; z: number };
  determinant: number;
}

const IDLE_INPUT: Readonly<MovementInputState> = Object.freeze({
  x: 0,
  y: 0,
  magnitude: 0,
  isActive: false,
});
const CASCADE_WINDOW_SEC = 3;
const DEFAULT_ECONOMY_GATE_TOLERANCE = 0.15;

export class SemanticReplayController implements MovementInputSource {
  private readonly waypointToleranceBand: number;
  private readonly stageTimeoutSlackSec: number;
  private readonly economyGateTolerance: number;
  private readonly skipFailedStage: boolean;
  private readonly maxLoopsPerStage: number;
  private readonly maxDurationSec: number;
  private readonly watchdog: SemanticStuckWatchdog;
  private readonly calibrationPulseSec: number;
  private readonly calibrationSettleSec: number;
  private readonly calibrationMinDisplacement: number;
  private readonly nominalMagnitude: number;
  private elapsedSec = 0;
  private scriptStageStartSec = 0;
  private replayStageStartSec = 0;
  private currentStageIndex = 0;
  private stageWaypointStartIndex = 0;
  private waypointIndex = 0;
  private reachedWaypoints = 0;
  private skippedWaypoints = 0;
  private maxReachDeviation = 0;
  private matchedMilestones = 0;
  private missingMilestones: MilestoneDiff[] = [];
  private extraMilestones: MilestoneDiff[] = [];
  private orderViolations = 0;
  private satisfiedMilestoneIndexes = new Set<number>();
  private readonly economyGates: SemanticEconomyGateVerdict[] = [];
  private readonly stageVerdicts: MutableStageVerdict[] = [];
  private readonly stuckEvents: SemanticStuckEvent[] = [];
  private previousObservation: SemanticObservation;
  private recovery: RecoveryState | null = null;
  private recoveryAttemptForWaypoint = 0;
  private consecutiveSkippedWaypoints = 0;
  private dwellUntilSec: number | null = null;
  private dwellWaypointIndex: number | null = null;
  private readonly dwelledWaypoints = new Set<number>();
  private phase: SemanticReplayPhase = 'calibrate-x';
  private phaseStartedAt = 0;
  private calibrationAttempt = 1;
  private calibrationAttemptStart: { x: number; z: number };
  private calibrationAfterX: { x: number; z: number } | null = null;
  private calibrationYStart: { x: number; z: number } | null = null;
  private calibrationAfterY: { x: number; z: number } | null = null;
  private inputWorldCalibration: InputWorldCalibration | null = null;
  private calibrationVerdict: SemanticCalibrationVerdict;
  private done = false;
  private failed = false;
  private finalVerdict: SemanticVerdict | null = null;
  private readonly script: SemanticScript;

  constructor(
    private readonly game: SemanticReplayGame,
    script: SemanticScript,
    options: SemanticReplayOptions = {},
  ) {
    this.script = normalizeSemanticReplayScript(script);
    this.waypointToleranceBand = Math.max(0.05, options.waypointToleranceBand ?? 0.8);
    this.stageTimeoutSlackSec = Math.max(0, options.stageTimeoutSlackSec ?? 5);
    this.economyGateTolerance = clampTolerance(options.economyGateTolerance ?? DEFAULT_ECONOMY_GATE_TOLERANCE);
    this.skipFailedStage = options.skipFailedStage === true;
    this.maxLoopsPerStage = readPositiveInteger(options.maxLoopsPerStage, 8);
    this.maxDurationSec = Math.max(
      1,
      options.maxDurationSec ?? (this.script.meta.durationSec * 2 + this.stageTimeoutSlackSec + 10),
    );
    this.watchdog = new SemanticStuckWatchdog({
      windowSec: options.stuckWindowSec ?? 2,
      distanceEpsilon: options.stuckDistanceEpsilon ?? 0.05,
    });
    this.calibrationPulseSec = Math.max(0.05, options.calibrationPulseSec ?? 0.25);
    this.calibrationSettleSec = Math.max(0, options.calibrationSettleSec ?? 0.2);
    this.calibrationMinDisplacement = Math.max(0.0001, options.calibrationMinDisplacement ?? 0.02);
    this.nominalMagnitude = computeNominalDragMagnitude(this.script);
    this.previousObservation = this.readObservation();
    this.calibrationAttemptStart = this.readCurrentPosition();
    this.calibrationVerdict = {
      status: 'pending',
      attempts: 1,
      pulseSec: this.calibrationPulseSec,
      settleSec: this.calibrationSettleSec,
      minDisplacement: this.calibrationMinDisplacement,
      displacement: {
        inputX: 0,
        inputY: 0,
      },
      matrix: null,
      determinant: null,
    };
    this.stageVerdicts.push({
      index: 0,
      status: 'active',
      recoveries: 0,
      loops: 1,
      startedAt: 0,
      durationSec: 0,
    });
  }

  getInput(): Readonly<MovementInputState> {
    if (this.done || this.failed) return IDLE_INPUT;
    if (this.phase !== 'navigating') return this.getCalibrationInput();
    if (this.isDwelling()) return IDLE_INPUT;
    const magnitude = this.nominalMagnitude;
    if (magnitude <= 0.0001) return IDLE_INPUT;
    const target = this.getCurrentWaypoint();
    if (!target) return IDLE_INPUT;
    const position = this.readCurrentPosition();
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= this.waypointToleranceBand) return IDLE_INPUT;
    const direction = this.applyRecoveryDirection(dx / distance, dz / distance);
    return this.toCalibratedInput(direction.x, direction.z, magnitude);
  }

  afterUpdate(deltaTime: number): void {
    if (this.done || this.failed) return;
    this.elapsedSec = roundTo(this.elapsedSec + Math.max(0, deltaTime), 4);
    if (this.phase !== 'navigating') {
      this.updateCalibrationPhase();
      this.checkCompletion();
      return;
    }
    this.clearExpiredRecovery();
    this.updateWaypointProgress();
    this.updateMilestones();
    this.updateStuckWatchdog();
    this.checkStageTimeout();
    this.maybeLoopCurrentStageWaypoints();
    this.checkCompletion();
  }

  abort(reason = 'aborted'): SemanticVerdict {
    if (!this.finalVerdict) {
      this.failed = true;
      this.failCurrentStage(reason);
      this.finalVerdict = this.buildVerdict();
    }
    return this.finalVerdict;
  }

  isDone(): boolean {
    return this.done || this.failed;
  }

  getVerdict(): SemanticVerdict {
    if (!this.finalVerdict) this.finalVerdict = this.buildVerdict();
    return this.finalVerdict;
  }

  getReplayFrame(): number {
    return this.game.getFrameCount();
  }

  private updateWaypointProgress(): void {
    const position = this.readCurrentPosition();
    let target = this.getCurrentWaypoint();
    while (target) {
      const distance = Math.hypot(target.x - position.x, target.z - position.z);
      if (distance > this.waypointToleranceBand) return;
      if (this.shouldHoldForWaypointDwell(target)) return;
      this.maxReachDeviation = Math.max(this.maxReachDeviation, distance);
      this.reachedWaypoints += 1;
      this.waypointIndex += 1;
      this.recoveryAttemptForWaypoint = 0;
      this.consecutiveSkippedWaypoints = 0;
      this.watchdog.reset();
      target = this.getCurrentWaypoint();
    }
  }

  private updateMilestones(): void {
    const current = this.readObservation();
    const actualEvents = diffSemanticObservations(this.previousObservation, current);
    this.previousObservation = current;
    const expected = this.script.milestones[this.matchedMilestones];

    for (const actual of actualEvents) {
      if (expected && milestonesHaveSameIdentity(expected, actual)) {
        this.satisfiedMilestoneIndexes.add(this.matchedMilestones);
      }
      const unexpected = this.classifyUnexpectedMilestone(actual);
      if (unexpected === 'ignore') continue;
      if (unexpected === 'order') this.orderViolations += 1;
      if (unexpected === 'extra' || unexpected === 'order') {
        this.extraMilestones.push({
          index: this.matchedMilestones,
          actual,
          reason: unexpected === 'order'
            ? 'event matched a later milestone before the current gate'
            : 'unexpected event before the matching milestone',
        });
      }
    }

    if (!expected) return;
    const gateConditionSatisfied = this.isStageGateSatisfied(expected, current);
    if (!gateConditionSatisfied) return;
    this.recordEconomyGate(this.matchedMilestones, expected, current);
    if (!this.isEconomyGateSatisfied(expected, current)) return;
    this.matchedMilestones += 1;
    this.finishCurrentStage('ok');
    this.advanceStage(expected.t);
  }

  private updateStuckWatchdog(): void {
    const target = this.getCurrentWaypoint();
    const active = !!target && !this.isDwelling() && this.nominalMagnitude > 0.3;
    const position = this.readCurrentPosition();
    const stuck = this.watchdog.observe({
      t: this.elapsedSec,
      active,
      position,
    });
    if (!stuck || this.recovery) return;
    this.startRecovery(position);
  }

  private startRecovery(position: { x: number; z: number }): void {
    const targetWaypoint = this.waypointIndex;
    const attempt = this.recoveryAttemptForWaypoint;
    this.recoveryAttemptForWaypoint += 1;
    this.markStageRecovery();

    if (attempt === 0 || attempt === 1) {
      const angleRad = attempt === 0 ? Math.PI / 4 : -Math.PI / 4;
      this.recovery = {
        kind: 'deflect',
        startedAt: this.elapsedSec,
        until: this.elapsedSec + 1.5,
        angleRad,
      };
      this.stuckEvents.push({
        t: this.elapsedSec,
        pos: { ...position },
        targetWaypoint,
        resolvedBy: attempt === 0 ? 'deflect-left' : 'deflect-right',
      });
      this.watchdog.reset();
      return;
    }

    if (attempt === 2) {
      this.recovery = {
        kind: 'backtrack',
        startedAt: this.elapsedSec,
        until: this.elapsedSec + 1,
        angleRad: Math.PI,
      };
      this.stuckEvents.push({
        t: this.elapsedSec,
        pos: { ...position },
        targetWaypoint,
        resolvedBy: 'backtrack',
      });
      this.watchdog.reset();
      return;
    }

    this.skippedWaypoints += 1;
    this.consecutiveSkippedWaypoints += 1;
    this.waypointIndex += 1;
    this.recoveryAttemptForWaypoint = 0;
    this.stuckEvents.push({
      t: this.elapsedSec,
      pos: { ...position },
      targetWaypoint,
      resolvedBy: 'skip-waypoint',
    });
    this.watchdog.reset();
    if (this.consecutiveSkippedWaypoints >= 3) {
      this.failCurrentStage('three consecutive skipped waypoints');
    }
  }

  private clearExpiredRecovery(): void {
    if (!this.recovery || this.elapsedSec < this.recovery.until) return;
    this.recovery = null;
    this.watchdog.reset();
  }

  private checkStageTimeout(): void {
    if (this.failed || this.done) return;
    const expected = this.script.milestones[this.matchedMilestones];
    if (!expected) return;
    const expectedStageDuration = Math.max(0.001, expected.t - this.scriptStageStartSec);
    const stageElapsed = this.elapsedSec - this.replayStageStartSec;
    if (stageElapsed > expectedStageDuration * 2 + this.stageTimeoutSlackSec) {
      this.missingMilestones.push({
        index: this.matchedMilestones,
        expected,
        reason: 'stage timeout elapsed',
      });
      this.handleStageFailure('stage timeout elapsed');
    }
  }

  private maybeLoopCurrentStageWaypoints(): void {
    if (this.failed || this.done) return;
    const expected = this.script.milestones[this.matchedMilestones];
    if (!expected) {
      this.maybeLoopTailForEconomyFinal();
      return;
    }
    const stageWaypointEndIndex = this.getCurrentStageWaypointEndIndex();
    if (this.stageWaypointStartIndex >= stageWaypointEndIndex) return;
    if (this.waypointIndex < stageWaypointEndIndex) return;
    const current = this.readObservation();
    if (this.isStageGateSatisfied(expected, current)) return;

    const stage = this.stageVerdicts[this.stageVerdicts.length - 1];
    if (!stage || stage.status !== 'active') return;
    if (stage.loops >= this.maxLoopsPerStage) {
      this.missingMilestones.push({
        index: this.matchedMilestones,
        expected,
        reason: `stage waypoint loop limit reached (${this.maxLoopsPerStage})`,
      });
      this.handleStageFailure('stage waypoint loop limit reached');
      return;
    }

    stage.loops += 1;
    this.waypointIndex = this.stageWaypointStartIndex;
    this.recovery = null;
    this.recoveryAttemptForWaypoint = 0;
    this.consecutiveSkippedWaypoints = 0;
    this.clearWaypointDwell();
    this.clearDwelledWaypointsInRange(this.stageWaypointStartIndex, stageWaypointEndIndex);
    this.watchdog.reset();
  }

  private handleStageFailure(reason: string): void {
    if (this.skipFailedStage) {
      this.finishCurrentStage('skipped');
      const expected = this.script.milestones[this.matchedMilestones];
      this.matchedMilestones += expected ? 1 : 0;
      this.advanceStage(expected?.t ?? this.scriptStageStartSec);
      return;
    }
    this.failCurrentStage(reason);
  }

  private failCurrentStage(_reason: string): void {
    this.failed = true;
    this.finishCurrentStage('failed');
    this.finalVerdict = this.buildVerdict();
  }


  private maybeLoopTailForEconomyFinal(): void {
    const stageWaypointEndIndex = this.script.waypoints.length;
    if (this.stageWaypointStartIndex >= stageWaypointEndIndex) return;
    if (this.waypointIndex < stageWaypointEndIndex) return;
    const current = this.readObservation();
    if (this.isEconomyFinalSatisfied(current.economy)) return;

    const stage = this.stageVerdicts[this.stageVerdicts.length - 1];
    if (!stage || stage.status !== 'active') return;
    if (stage.loops >= this.maxLoopsPerStage) {
      this.handleStageFailure('tail loop limit reached before economyFinal threshold');
      return;
    }
    stage.loops += 1;
    this.waypointIndex = this.stageWaypointStartIndex;
    this.recovery = null;
    this.recoveryAttemptForWaypoint = 0;
    this.consecutiveSkippedWaypoints = 0;
    this.clearWaypointDwell();
    this.clearDwelledWaypointsInRange(this.stageWaypointStartIndex, stageWaypointEndIndex);
  }

  private checkCompletion(): void {
    if (this.failed || this.done) return;
    if (this.elapsedSec > this.maxDurationSec) {
      this.failCurrentStage('semantic replay maxDurationSec elapsed');
      return;
    }
    const allMilestonesMatched = this.matchedMilestones >= this.script.milestones.length;
    const allWaypointsHandled = this.waypointIndex >= this.script.waypoints.length;
    const economyFinalSatisfied = this.isEconomyFinalSatisfied(this.readObservation().economy);
    if (this.phase === 'navigating' && allMilestonesMatched && allWaypointsHandled && economyFinalSatisfied) {
      this.finishCurrentStage('ok');
      this.done = true;
      this.finalVerdict = this.buildVerdict();
    }
  }

  private advanceStage(scriptStartSec: number): void {
    this.currentStageIndex += 1;
    this.scriptStageStartSec = scriptStartSec;
    this.replayStageStartSec = this.elapsedSec;
    this.recoveryAttemptForWaypoint = 0;
    this.consecutiveSkippedWaypoints = 0;
    this.clearWaypointDwell();
    while (
      this.waypointIndex < this.script.waypoints.length
      && (this.script.waypoints[this.waypointIndex]?.t ?? 0) < scriptStartSec - 0.001
    ) {
      this.waypointIndex += 1;
    }
    this.stageWaypointStartIndex = this.waypointIndex;
    this.stageVerdicts.push({
      index: this.currentStageIndex,
      status: 'active',
      recoveries: 0,
      loops: 1,
      startedAt: this.elapsedSec,
      durationSec: 0,
    });
  }

  private finishCurrentStage(status: 'ok' | 'failed' | 'skipped'): void {
    const stage = this.stageVerdicts[this.stageVerdicts.length - 1];
    if (!stage || stage.status !== 'active') return;
    stage.status = status;
    stage.durationSec = roundTo(this.elapsedSec - stage.startedAt, 4);
  }

  private markStageRecovery(): void {
    const stage = this.stageVerdicts[this.stageVerdicts.length - 1];
    if (stage) stage.recoveries += 1;
  }

  private getCurrentWaypoint(): SemanticWaypoint | null {
    const waypoint = this.script.waypoints[this.waypointIndex];
    if (!waypoint) return null;
    if (this.waypointIndex >= this.getCurrentStageWaypointEndIndex()) return null;
    return waypoint;
  }

  private getCurrentStageWaypointEndIndex(): number {
    const stageEnd = this.script.milestones[this.matchedMilestones]?.t ?? this.script.meta.durationSec;
    let index = this.stageWaypointStartIndex;
    while (
      index < this.script.waypoints.length
      && (this.script.waypoints[index]?.t ?? 0) <= stageEnd + 0.001
    ) {
      index += 1;
    }
    return index;
  }

  private applyRecoveryDirection(x: number, z: number): { x: number; z: number } {
    if (!this.recovery) return { x, z };
    const cos = Math.cos(this.recovery.angleRad);
    const sin = Math.sin(this.recovery.angleRad);
    return {
      x: x * cos - z * sin,
      z: x * sin + z * cos,
    };
  }

  private toCalibratedInput(worldX: number, worldZ: number, magnitude: number): MovementInputState {
    const calibration = this.inputWorldCalibration;
    let x = worldX;
    let y = worldZ;
    if (calibration) {
      x = (calibration.inputY.z * worldX - calibration.inputY.x * worldZ) / calibration.determinant;
      y = (-calibration.inputX.z * worldX + calibration.inputX.x * worldZ) / calibration.determinant;
    }
    const inputLength = Math.hypot(x, y);
    if (inputLength <= 0.0001) return IDLE_INPUT;
    return {
      x: roundTo(x / inputLength, 4),
      y: roundTo(y / inputLength, 4),
      magnitude: roundTo(magnitude, 4),
      isActive: true,
    };
  }

  private getCalibrationInput(): Readonly<MovementInputState> {
    if (this.phase === 'calibrate-x') return { x: 1, y: 0, magnitude: 1, isActive: true };
    if (this.phase === 'calibrate-y') return { x: 0, y: 1, magnitude: 1, isActive: true };
    if (this.phase === 'calibration-nudge') {
      return { x: -0.7071, y: -0.7071, magnitude: 0.8, isActive: true };
    }
    return IDLE_INPUT;
  }

  private updateCalibrationPhase(): void {
    const phaseElapsed = this.elapsedSec - this.phaseStartedAt;
    if (this.phase === 'calibrate-x' && phaseElapsed >= this.calibrationPulseSec) {
      this.calibrationAfterX = this.readCurrentPosition();
      this.transitionCalibrationPhase('settle-after-x');
      return;
    }
    if (this.phase === 'settle-after-x' && phaseElapsed >= this.calibrationSettleSec) {
      this.calibrationYStart = this.readCurrentPosition();
      this.transitionCalibrationPhase('calibrate-y');
      return;
    }
    if (this.phase === 'calibrate-y' && phaseElapsed >= this.calibrationPulseSec) {
      this.calibrationAfterY = this.readCurrentPosition();
      this.transitionCalibrationPhase('settle-after-y');
      return;
    }
    if (this.phase === 'settle-after-y' && phaseElapsed >= this.calibrationSettleSec) {
      this.finishCalibrationAttempt();
      return;
    }
    if (this.phase === 'calibration-nudge' && phaseElapsed >= 0.35) {
      this.calibrationAttempt += 1;
      this.beginCalibrationAttempt();
    }
  }

  private transitionCalibrationPhase(phase: SemanticReplayPhase): void {
    this.phase = phase;
    this.phaseStartedAt = this.elapsedSec;
  }

  private beginCalibrationAttempt(): void {
    this.calibrationAttemptStart = this.readCurrentPosition();
    this.calibrationAfterX = null;
    this.calibrationYStart = null;
    this.calibrationAfterY = null;
    this.calibrationVerdict = {
      ...this.calibrationVerdict,
      status: 'pending',
      attempts: this.calibrationAttempt,
      displacement: {
        inputX: 0,
        inputY: 0,
      },
      matrix: null,
      determinant: null,
      error: undefined,
    };
    this.transitionCalibrationPhase('calibrate-x');
  }

  private finishCalibrationAttempt(): void {
    const afterX = this.calibrationAfterX;
    const yStart = this.calibrationYStart;
    const afterY = this.calibrationAfterY;
    if (!afterX || !yStart || !afterY) {
      this.failCalibration('calibration samples were incomplete');
      return;
    }

    const d1 = {
      x: afterX.x - this.calibrationAttemptStart.x,
      z: afterX.z - this.calibrationAttemptStart.z,
    };
    const d2 = {
      x: afterY.x - yStart.x,
      z: afterY.z - yStart.z,
    };
    const d1Length = Math.hypot(d1.x, d1.z);
    const d2Length = Math.hypot(d2.x, d2.z);
    this.calibrationVerdict = {
      ...this.calibrationVerdict,
      attempts: this.calibrationAttempt,
      displacement: {
        inputX: roundTo(d1Length, 4),
        inputY: roundTo(d2Length, 4),
      },
    };

    if (d1Length < this.calibrationMinDisplacement || d2Length < this.calibrationMinDisplacement) {
      if (this.calibrationAttempt < 2) {
        this.transitionCalibrationPhase('calibration-nudge');
        return;
      }
      this.failCalibration('calibration displacement was below threshold');
      return;
    }

    const inputX = { x: d1.x / d1Length, z: d1.z / d1Length };
    const inputY = { x: d2.x / d2Length, z: d2.z / d2Length };
    const determinant = inputX.x * inputY.z - inputY.x * inputX.z;
    if (Math.abs(determinant) < 0.0001) {
      this.failCalibration('calibration basis vectors were nearly collinear');
      return;
    }

    this.inputWorldCalibration = {
      inputX,
      inputY,
      determinant,
    };
    this.calibrationVerdict = {
      ...this.calibrationVerdict,
      status: 'ok',
      matrix: {
        inputX: { x: roundTo(inputX.x, 4), z: roundTo(inputX.z, 4) },
        inputY: { x: roundTo(inputY.x, 4), z: roundTo(inputY.z, 4) },
      },
      determinant: roundTo(determinant, 4),
      error: undefined,
    };
    this.startNavigationAfterCalibration();
  }

  private failCalibration(error: string): void {
    this.inputWorldCalibration = null;
    this.calibrationVerdict = {
      ...this.calibrationVerdict,
      status: 'failed',
      matrix: null,
      determinant: null,
      error,
    };
    this.startNavigationAfterCalibration();
  }

  private startNavigationAfterCalibration(): void {
    this.phase = 'navigating';
    this.phaseStartedAt = this.elapsedSec;
    this.replayStageStartSec = this.elapsedSec;
    const stage = this.stageVerdicts[this.stageVerdicts.length - 1];
    if (stage?.status === 'active') {
      stage.startedAt = this.elapsedSec;
      stage.durationSec = 0;
    }
    this.previousObservation = this.readObservation();
    this.watchdog.reset();
  }

  private isDwelling(): boolean {
    return this.dwellUntilSec !== null && this.elapsedSec < this.dwellUntilSec;
  }

  private shouldHoldForWaypointDwell(target: SemanticWaypoint): boolean {
    const dwellSec = Math.max(0, target.dwellSec ?? 0);
    if (dwellSec <= 0 || this.dwelledWaypoints.has(this.waypointIndex)) return false;
    if (this.dwellWaypointIndex !== this.waypointIndex || this.dwellUntilSec === null) {
      this.dwellWaypointIndex = this.waypointIndex;
      this.dwellUntilSec = roundTo(this.elapsedSec + dwellSec, 4);
      this.watchdog.reset();
      return true;
    }
    if (this.elapsedSec < this.dwellUntilSec) return true;
    this.dwelledWaypoints.add(this.waypointIndex);
    this.clearWaypointDwell();
    return false;
  }

  private clearWaypointDwell(): void {
    this.dwellUntilSec = null;
    this.dwellWaypointIndex = null;
  }

  private clearDwelledWaypointsInRange(startIndex: number, endIndex: number): void {
    for (let index = startIndex; index < endIndex; index += 1) {
      this.dwelledWaypoints.delete(index);
    }
  }

  private readObservation(): SemanticObservation {
    const playerPosition = this.readCurrentPosition();
    return readSemanticObservationFromSnapshot({
      time: this.elapsedSec,
      playerPosition: { x: playerPosition.x, y: 0, z: playerPosition.z },
      providers: collectRecordReplaySnapshotEntries(),
    }, this.elapsedSec);
  }

  private readCurrentPosition(): { x: number; z: number } {
    const registered = readRecordReplayPlayerPosition();
    if (registered) return { x: registered.x, z: registered.z };
    const player = this.game.getPlayer();
    if (player) return { x: player.position.x, z: player.position.z };
    const firstWaypoint = this.script.waypoints[0];
    return { x: firstWaypoint?.x ?? 0, z: firstWaypoint?.z ?? 0 };
  }

  private isMilestoneSatisfied(milestone: SemanticMilestone, observation: SemanticObservation): boolean {
    return this.satisfiedMilestoneIndexes.has(this.matchedMilestones)
      || isRecordReplayMilestoneSatisfied(milestone, observation);
  }

  private isEconomyGateSatisfied(milestone: SemanticMilestone, observation: SemanticObservation): boolean {
    return economyGatePasses(
      normalizeEconomyExpectation(milestone.economyAtGate),
      normalizeEconomyExpectation(observation.economy),
      this.economyGateTolerance,
    );
  }

  private isStageGateSatisfied(milestone: SemanticMilestone, observation: SemanticObservation): boolean {
    return this.isMilestoneSatisfied(milestone, observation)
      && this.isEconomyGateSatisfied(milestone, observation);
  }

  private recordEconomyGate(
    index: number,
    gate: SemanticMilestone,
    observation: SemanticObservation,
  ): void {
    const expected = normalizeEconomyExpectation(gate.economyAtGate);
    const actual = normalizeEconomyExpectation(observation.economy);
    const verdict = {
      gate: {
        index,
        t: gate.t,
        kind: gate.kind,
        detail: { ...gate.detail },
      },
      expected,
      actual,
      tolerance: this.economyGateTolerance,
      pass: economyGatePasses(expected, actual, this.economyGateTolerance),
    };
    const existingIndex = this.economyGates.findIndex((item) => item.gate.index === index);
    if (existingIndex >= 0) this.economyGates[existingIndex] = verdict;
    else this.economyGates.push(verdict);
  }

  private classifyUnexpectedMilestone(actual: SemanticMilestone): 'ignore' | 'extra' | 'order' {
    if (!isDiscreteSemanticMilestone(actual)) return 'ignore';
    const current = this.script.milestones[this.matchedMilestones];
    if (current && milestonesHaveSameIdentity(current, actual)) return 'ignore';
    for (let index = this.matchedMilestones + 1; index < this.script.milestones.length; index += 1) {
      const expected = this.script.milestones[index];
      if (!expected || !milestonesHaveSameIdentity(expected, actual)) continue;
      if (current && Math.abs(expected.t - current.t) <= CASCADE_WINDOW_SEC) return 'ignore';
      return 'order';
    }
    // 级联窗口:录制里与当前闸门在 CASCADE_WINDOW_SEC 内、同 kind 的事件,视为级联微观时序抖动(付款→解锁→雇佣在同一秒级联)。
    if (current) {
      for (const expected of this.script.milestones) {
        if (expected.kind === actual.kind && Math.abs(expected.t - current.t) <= CASCADE_WINDOW_SEC) {
          return 'ignore';
        }
      }
    }
    return 'extra';
  }


  private isEconomyFinalSatisfied(economy: { cash: number; totalEarned: number; totalSpent: number }): boolean {
    for (const key of ['totalEarned', 'totalSpent'] as const) {
      const expected = this.script.economyFinal[key];
      if (economy[key] < expected * (1 - this.economyGateTolerance)) return false;
    }
    return true;
  }

  private buildVerdict(): SemanticVerdict {
    const current = this.readObservation();
    const economyDiffs: Record<string, { expected: number; actual: number }> = {};
    for (const key of ['cash', 'totalEarned', 'totalSpent'] as const) {
      const expected = this.script.economyFinal[key];
      const actual = current.economy[key];
      if (expected !== actual) economyDiffs[key] = { expected, actual };
    }
    const failedStage = this.stageVerdicts.some((stage) => stage.status === 'failed' || stage.status === 'active');
    const economyGateFailed = this.economyGates.some((gate) => !gate.pass);
    const economyFinalPass = this.isEconomyFinalSatisfied(current.economy);
    const ok = this.missingMilestones.length === 0
      && this.extraMilestones.length === 0
      && this.orderViolations === 0
      && !economyGateFailed
      && economyFinalPass
      && this.calibrationVerdict.status === 'ok'
      && !failedStage;
    const recovered = this.stuckEvents.length > 0
      || this.skippedWaypoints > 0
      || this.stageVerdicts.some((stage) => stage.recoveries > 0 || stage.loops > 1 || stage.status === 'skipped');
    return {
      ok,
      quality: ok ? (recovered ? 'recovered' : 'clean') : 'failed',
      milestones: {
        matched: this.matchedMilestones,
        missing: [...this.missingMilestones],
        extra: [...this.extraMilestones],
        orderViolations: this.orderViolations,
      },
      economyFinal: {
        pass: economyFinalPass,
        diffs: economyDiffs,
      },
      economyGates: this.economyGates.map((gate) => ({
        gate: {
          index: gate.gate.index,
          t: gate.gate.t,
          kind: gate.gate.kind,
          detail: { ...gate.gate.detail },
        },
        expected: { ...gate.expected },
        actual: { ...gate.actual },
        tolerance: gate.tolerance,
        pass: gate.pass,
      })),
      waypoints: {
        reached: this.reachedWaypoints,
        skipped: this.skippedWaypoints,
        maxDeviation: roundTo(this.maxReachDeviation, 4),
        toleranceBand: this.waypointToleranceBand,
      },
      calibration: cloneCalibrationVerdict(this.calibrationVerdict),
      waypointsPerStage: computeWaypointsPerStage(this.script),
      stages: this.stageVerdicts.map((stage) => ({
        index: stage.index,
        status: stage.status === 'active' ? 'failed' : stage.status,
        recoveries: stage.recoveries,
        loops: stage.loops,
        durationSec: stage.status === 'active'
          ? roundTo(this.elapsedSec - stage.startedAt, 4)
          : stage.durationSec,
      })),
      stuckEvents: this.stuckEvents.map((event) => ({ ...event, pos: { ...event.pos } })),
      durationSec: roundTo(this.elapsedSec, 4),
    };
  }
}

export class SemanticStuckWatchdog {
  private anchor: { t: number; position: { x: number; z: number } } | null = null;

  constructor(private readonly options: { windowSec: number; distanceEpsilon: number }) {}

  observe(input: { t: number; active: boolean; position: { x: number; z: number } }): boolean {
    if (!input.active) {
      this.reset();
      return false;
    }
    if (!this.anchor) {
      this.anchor = { t: input.t, position: { ...input.position } };
      return false;
    }
    const moved = Math.hypot(
      input.position.x - this.anchor.position.x,
      input.position.z - this.anchor.position.z,
    );
    if (moved >= this.options.distanceEpsilon) {
      this.anchor = { t: input.t, position: { ...input.position } };
      return false;
    }
    return input.t - this.anchor.t >= this.options.windowSec;
  }

  reset(): void {
    this.anchor = null;
  }
}

export function runSemanticReplay(options: RunSemanticReplayOptions): Promise<SemanticVerdict> {
  const { game, inputService } = options;
  const script = normalizeSemanticReplayScript(options.script);
  const currentSeed = game.getDeterminismContext().seed;
  if (currentSeed !== script.meta.seed) {
    throw new Error(`seed mismatch: semantic script=${script.meta.seed}, current=${currentSeed}`);
  }
  const originalSource = inputService.getMovementSource();
  const controller = new SemanticReplayController(game, script, options.options);
  const restoreUpdate = installSemanticPostUpdateHook(game, (deltaTime) => {
    if (options.shouldAbort?.()) {
      cleanup();
      resolveOnce(controller.abort('aborted'));
      return;
    }
    controller.afterUpdate(deltaTime);
    options.onFrame?.(controller);
    if (controller.isDone()) {
      cleanup();
      resolveOnce(controller.getVerdict());
    }
  });

  let resolved = false;
  let resolvePromise: (verdict: SemanticVerdict) => void = () => undefined;
  let rejectPromise: (error: unknown) => void = () => undefined;

  const cleanup = (): void => {
    inputService.setMovementSource(originalSource);
    game.setDtOverride?.(null);
    restoreUpdate();
  };
  const resolveOnce = (verdict: SemanticVerdict): void => {
    if (resolved) return;
    resolved = true;
    resolvePromise(verdict);
  };

  inputService.setMovementSource(controller);
  game.resume?.();

  return new Promise<SemanticVerdict>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
    window.setTimeout(() => {
      if (resolved) return;
      try {
        cleanup();
        resolveOnce(controller.abort('wall-clock semantic replay timeout'));
      } catch (error) {
        rejectPromise(error);
      }
    }, Math.max(1, (options.options?.maxDurationSec ?? script.meta.durationSec * 2 + 20) * 1000));
  }).catch((error) => {
    cleanup();
    throw error;
  });
}

export function normalizeSemanticReplayScript(script: SemanticScript): SemanticScript {
  return {
    ...script,
    meta: { ...script.meta },
    inputSegments: script.inputSegments.map((segment) => ({
      ...segment,
      keypoints: segment.keypoints.map((point) => ({ ...point })),
    })),
    milestones: normalizeSemanticMilestones(script.milestones),
    waypoints: script.waypoints.map((waypoint) => ({ ...waypoint })),
    economyFinal: { ...script.economyFinal },
  };
}

function installSemanticPostUpdateHook(
  game: SemanticReplayGame,
  onPostUpdate: (deltaTime: number) => void,
): () => void {
  const target = game as unknown as {
    update?: (deltaTime: number) => void;
  };
  const originalUpdate = target.update;
  if (typeof originalUpdate !== 'function') {
    throw new Error('Game.update hook is unavailable for semantic replay.');
  }
  const wrappedUpdate = (deltaTime: number): void => {
    originalUpdate.call(game, deltaTime);
    onPostUpdate(deltaTime);
  };
  target.update = wrappedUpdate;
  return () => {
    if (target.update === wrappedUpdate) target.update = originalUpdate;
  };
}

function normalizeSemanticMilestones(milestones: readonly SemanticMilestone[]): SemanticMilestone[] {
  const timeline = buildEconomyExpectationTimeline(milestones);
  return milestones
    .filter((milestone) => isDiscreteSemanticMilestone(milestone))
    .map((milestone) => {
      const economyAtGate = maxEconomyExpectation(
        economyExpectationAtOrBefore(timeline, milestone.t),
        normalizeEconomyExpectation(milestone.economyAtGate),
      );
      return {
        ...milestone,
        detail: { ...milestone.detail },
        economyAtGate,
      };
    });
}

function buildEconomyExpectationTimeline(
  milestones: readonly SemanticMilestone[],
): Array<{ t: number; economy: SemanticEconomyGateExpectation }> {
  let running: SemanticEconomyGateExpectation = { totalEarned: 0, totalSpent: 0 };
  const timeline: Array<{ t: number; economy: SemanticEconomyGateExpectation }> = [];
  for (const milestone of milestones) {
    running = maxEconomyExpectation(running, readEconomyExpectationFromMilestone(milestone));
    running = maxEconomyExpectation(running, normalizeEconomyExpectation(milestone.economyAtGate));
    timeline.push({
      t: milestone.t,
      economy: { ...running },
    });
  }
  return timeline;
}

function economyExpectationAtOrBefore(
  timeline: readonly { t: number; economy: SemanticEconomyGateExpectation }[],
  t: number,
): SemanticEconomyGateExpectation {
  let economy: SemanticEconomyGateExpectation = { totalEarned: 0, totalSpent: 0 };
  for (const item of timeline) {
    if (item.t > t + 0.001) continue;
    economy = maxEconomyExpectation(economy, item.economy);
  }
  return economy;
}

function readEconomyExpectationFromMilestone(milestone: SemanticMilestone): SemanticEconomyGateExpectation {
  if (milestone.kind === 'sale') {
    return {
      totalEarned: readDetailNumber(milestone.detail.totalEarned, 0),
      totalSpent: 0,
    };
  }
  if (isEconomyOnlySemanticMilestone(milestone)) {
    return {
      totalEarned: 0,
      totalSpent: readDetailNumber(milestone.detail.totalSpent, 0),
    };
  }
  return { totalEarned: 0, totalSpent: 0 };
}

function normalizeEconomyExpectation(value: Partial<SemanticEconomyGateExpectation> | null | undefined): SemanticEconomyGateExpectation {
  return {
    totalEarned: finiteOrZero(value?.totalEarned),
    totalSpent: finiteOrZero(value?.totalSpent),
  };
}

function maxEconomyExpectation(
  a: SemanticEconomyGateExpectation,
  b: SemanticEconomyGateExpectation,
): SemanticEconomyGateExpectation {
  return {
    totalEarned: Math.max(a.totalEarned, b.totalEarned),
    totalSpent: Math.max(a.totalSpent, b.totalSpent),
  };
}

function economyGatePasses(
  expected: SemanticEconomyGateExpectation,
  actual: SemanticEconomyGateExpectation,
  tolerance: number,
): boolean {
  return actual.totalEarned >= expected.totalEarned * (1 - tolerance)
    && actual.totalSpent >= expected.totalSpent * (1 - tolerance);
}

function milestonesHaveSameIdentity(expected: SemanticMilestone, actual: SemanticMilestone): boolean {
  return expected.kind === actual.kind
    && getRecordReplayMilestoneIdentity(expected) === getRecordReplayMilestoneIdentity(actual);
}

function computeNominalDragMagnitude(script: SemanticScript): number {
  const magnitudes = script.inputSegments
    .filter((segment) => segment.kind === 'drag')
    .flatMap((segment) => segment.keypoints.map((point) => point.magnitude))
    .filter((value) => Number.isFinite(value) && value > 0.0001)
    .sort((a, b) => a - b);
  if (magnitudes.length <= 0) return 1;
  const middle = Math.floor(magnitudes.length / 2);
  const value = magnitudes.length % 2 === 1
    ? magnitudes[middle]
    : ((magnitudes[middle - 1] ?? 1) + (magnitudes[middle] ?? 1)) / 2;
  return roundTo(Math.max(0, Math.min(1, value ?? 1)), 4);
}

function cloneCalibrationVerdict(verdict: SemanticCalibrationVerdict): SemanticCalibrationVerdict {
  return {
    status: verdict.status,
    attempts: verdict.attempts,
    pulseSec: verdict.pulseSec,
    settleSec: verdict.settleSec,
    minDisplacement: verdict.minDisplacement,
    displacement: {
      inputX: verdict.displacement.inputX,
      inputY: verdict.displacement.inputY,
    },
    matrix: verdict.matrix
      ? {
          inputX: { ...verdict.matrix.inputX },
          inputY: { ...verdict.matrix.inputY },
        }
      : null,
    determinant: verdict.determinant,
    ...(verdict.error ? { error: verdict.error } : {}),
  };
}

function computeWaypointsPerStage(script: SemanticScript): number[] {
  const stages = Math.max(1, script.milestones.length + 1);
  return Array.from({ length: stages }, (_, index) => {
    const stageStart = index === 0 ? 0 : script.milestones[index - 1]?.t ?? 0;
    const stageEnd = script.milestones[index]?.t ?? script.meta.durationSec;
    return script.waypoints.filter((waypoint) => {
      const afterStart = index === 0 ? waypoint.t >= stageStart - 0.001 : waypoint.t > stageStart + 0.001;
      return afterStart && waypoint.t <= stageEnd + 0.001;
    }).length;
  });
}

function readDetailNumber(value: number | string | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function finiteOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function clampTolerance(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ECONOMY_GATE_TOLERANCE;
  return Math.max(0, Math.min(1, value));
}

function readPositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
