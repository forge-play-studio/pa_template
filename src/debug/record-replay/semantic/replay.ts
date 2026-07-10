import type { MovementInputSource, MovementInputState } from '../../../services/InputService';
import {
  collectRecordReplaySnapshotEntries,
  getRecordReplayMilestoneIdentity,
  isRecordReplayMilestoneCritical,
  isRecordReplayMilestoneSatisfied,
  readRecordReplayInputAuthority,
  readRecordReplayPlayerPosition,
} from '../providers';
import {
  countLayeredMilestones,
  gradeSemanticVerdict,
  type SemanticGrade,
  type SemanticGradeResult,
  type SemanticGradeThresholds,
} from './grade';
import { SemanticPathTracker } from './path-tracker';
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
  isSemanticScriptCertifiable,
} from './extract';

export interface SemanticReplayOptions {
  waypointToleranceBand?: number;
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
  /** 关掉轨迹跟踪,退回旧的 RDP waypoint 直线奔向(脚本无 trail 时自动退回)。 */
  trailFollowing?: boolean;
  /** 轨迹跟踪:目标点取在示教时钟前方多少秒。 */
  trailLookaheadSec?: number;
  /** 轨迹跟踪:闸门处「停下来等」多久没有任何进展就放行示教时钟(秒)。 */
  gateHoldPatienceSec?: number;
  /** 轨迹跟踪:示教时钟与游戏状态双双静止多久判负(秒)。 */
  gateStallTimeoutSec?: number;
  /** 四档 verdict 的阈值覆盖(默认见 grade.ts)。 */
  gradeThresholds?: Partial<SemanticGradeThresholds>;
  /**
   * 该 tape 的 Mode A 确定性水平线(帧号;全长零分歧传 `'green-full'`)。
   *
   * 传了才会产出 `verdict.determinism`:失败点落在 horizon 内 = 高置信真失败;
   * 落在 horizon 外 = 低置信,可能只是世界漂移,先跑 Mode A 定性再动手。
   * 不传 = `verdict.determinism` 为 null,行为与分级 v2 之前完全一致。
   */
  determinismHorizon?: number | 'green-full' | null;
}

/** Set when the run never happened because the script could not certify anything. */
export interface SemanticRefusal {
  reason: string;
  milestones: number;
  waypoints: number;
}

/** Mode A 的确定性水平线 + 本次 Mode B 失败点的相对位置(契约 §6.1)。 */
export interface SemanticDeterminismStamp {
  /** 帧号 = 「前 N 帧逐帧可信」;`'green-full'` = 全长零分歧。 */
  horizon: number | 'green-full';
  /** 本次回放第一次出问题时,距回放起点的帧数;全程无失败为 null。 */
  failurePointFrame: number | null;
  /** 失败点是否落在 horizon 之内;无失败为 null。 */
  failureWithinHorizon: boolean | null;
  /** horizon 内失败 = high(策略/游戏改动);horizon 外 = low(先怀疑世界漂移)。 */
  confidence: 'high' | 'low' | null;
}

export interface SemanticVerdict {
  ok: boolean;
  quality: 'clean' | 'recovered' | 'failed';
  /** 四档认证等级(契约 §6.2)。`ok` / `quality` 保持原语义,grade 是新增维度。 */
  grade: SemanticGrade;
  /** 定档理由 + 参与判据的指标(optional 缺失比例 / 绕路分 / 生效阈值)。 */
  grading: SemanticGradeResult;
  /** 多数决判定为抖动时由 runner 盖章;单跑不设。 */
  flaky?: boolean;
  /** 示教里从不存在的终局态的 identity;没有则 null。 */
  terminalDivergence: string | null;
  /** 传了 `determinismHorizon` 才有;否则 null。 */
  determinism: SemanticDeterminismStamp | null;
  /** Present ⇒ nothing was replayed; `ok` is false. Absent on a real run. */
  refused?: SemanticRefusal;
  milestones: {
    matched: number;
    missing: MilestoneDiff[];
    extra: MilestoneDiff[];
    orderViolations: number;
    /** 分层统计:主线因果链 vs 路过型(契约 §6.2 前置)。 */
    criticalMissing: number;
    optionalMissing: number;
    criticalTotal: number;
    optionalTotal: number;
  };
  economyFinal: {
    pass: boolean;
    /** 生效的容差(与经济闸门同一口径)。 */
    tolerance: number;
    /**
     * 三个键的实际 vs 期望。**`pass` ⟺ 每一项 `withinTolerance`** —— 以前 diffs 用精确相等,
     * 于是「pass:true 却有 diffs」,读的人不知道该信哪个。
     */
    diffs: Record<string, { expected: number; actual: number; withinTolerance: boolean }>;
  };
  economyGates: SemanticEconomyGateVerdict[];
  waypoints: {
    reached: number;
    skipped: number;
    maxDeviation: number;
    toleranceBand: number;
  };
  /** 轨迹跟踪模式的诊断数据;未启用时为 null。 */
  trailTracking: SemanticTrailTrackingVerdict | null;
  calibration: SemanticCalibrationVerdict;
  waypointsPerStage: number[];
  stages: SemanticStageVerdict[];
  stuckEvents: SemanticStuckEvent[];
  durationSec: number;
}

export interface SemanticTrailTrackingVerdict {
  enabled: boolean;
  trailPoints: number;
  /** 示教时钟推进到哪(秒)/ 示教总时长。 */
  scheduleSec: number;
  scriptDurationSec: number;
  /** 全程 actor 到航迹的最大 / 平均横向偏离。 */
  maxCrossError: number;
  meanCrossError: number;
  /** 全程沿航迹最大落后秒数。 */
  maxBehindSec: number;
  /** 示教时钟因跟踪误差被拖慢的总秒数(0 = 全程跟上)。 */
  stalledSec: number;
  /**
   * 输入不算数(游戏在自己驱动角色:过场 / 剧情自动移动 / 输入锁)的总秒数。
   * 这段时间的 crossError 无意义,已从上面的统计里排除。
   */
  scriptedSec: number;
  /** 剧情段里被立即放行的闸门数(>0 说明示教剧本的里程碑落在了过场窗口内)。 */
  scriptedGateReleases: number;
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
/** 追踪目标近到这个距离就不再给输入(人类站定时的死区)。 */
const PURSUIT_STOP_DISTANCE = 0.05;
/** 目标距离达到此值即全速;更近则线性减速 —— 到达阻尼,避免绕着目标点抖。 */
const PURSUIT_FULL_SPEED_DISTANCE = 0.6;
/** 有输入时的最小 magnitude 比例,保证低速段也能真的挪动。 */
const PURSUIT_MIN_MAGNITUDE_RATIO = 0.15;

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
  private readonly tracker: SemanticPathTracker | null;
  private pursuitTarget: { x: number; z: number } | null = null;
  private pursuitScheduleSec = 0;
  private lastInputActive = false;
  private trackCrossErrorMax = 0;
  private trackCrossErrorSum = 0;
  private trackSamples = 0;
  private trackBehindMax = 0;
  private trackStalledSec = 0;
  private trackScriptedSec = 0;
  private inputAuthoritative = true;
  private scheduleAdvancedThisFrame = false;
  /** 上一帧的横向偏离,用来判断「正在往航迹上走回去」。 */
  private previousCrossError = Number.POSITIVE_INFINITY;
  /** 本帧:示教时钟被跟踪误差按死(gain=0),但 actor 正在收敛回航迹。 */
  private recoveringToPath = false;
  /** 示教时钟是否已经被推进过(标定期的剧情段也会推)。用于避免进入 navigating 时把它清零。 */
  private trackerStarted = false;
  private terminalDivergence: string | null = null;
  /** 回放起点的引擎帧号。失败点用相对帧表示,才能和 tape 的 horizon 帧号对齐。 */
  private readonly replayStartFrame: number;
  private failurePointFrame: number | null = null;
  private readonly gradeThresholds: Partial<SemanticGradeThresholds>;
  private readonly determinismHorizon: number | 'green-full' | null;
  private readonly gateHoldPatienceSec: number;
  private readonly gateStallTimeoutSec: number;
  /** 已经放行了几个闸门(闸门处久等无进展时逐个前移 cap)。命中里程碑后清零。 */
  private releasedGates = 0;
  /** 其中有多少个是在「输入不算数」的剧情段里立即放行的(诊断用)。 */
  private scriptedGateReleases = 0;
  private gateHoldStalledSec = 0;
  private stageNoProgressSec = 0;
  private progressSignature = '';

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
    this.gateHoldPatienceSec = Math.max(0.1, options.gateHoldPatienceSec ?? 1.5);
    this.gateStallTimeoutSec = Math.max(0.5, options.gateStallTimeoutSec ?? 6);
    this.gradeThresholds = { ...options.gradeThresholds };
    this.determinismHorizon = normalizeDeterminismHorizon(options.determinismHorizon);
    this.replayStartFrame = game.getFrameCount();
    this.nominalMagnitude = computeNominalDragMagnitude(this.script);
    this.tracker = this.createPathTracker(options);
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
    if (this.done || this.failed) return this.recordInputActivity(IDLE_INPUT);
    if (this.phase !== 'navigating') return this.recordInputActivity(this.getCalibrationInput());
    if (this.nominalMagnitude <= 0.0001) return this.recordInputActivity(IDLE_INPUT);
    const input = this.tracker ? this.getPursuitInput() : this.getWaypointSeekInput();
    return this.recordInputActivity(input);
  }

  /** 轨迹跟踪:朝「示教时钟 + lookahead」处的航迹点走,按距离做到达阻尼。 */
  private getPursuitInput(): Readonly<MovementInputState> {
    // 游戏正在自己驱动角色(过场 / 输入锁):不要跟它抢,也别让 stuck watchdog 误判。
    if (!readRecordReplayInputAuthority()) return IDLE_INPUT;
    const target = this.pursuitTarget;
    if (!target) return IDLE_INPUT;
    const position = this.readCurrentPosition();
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= PURSUIT_STOP_DISTANCE) return IDLE_INPUT;
    // 目标点与 actor 的距离 ≈ 人类当时的速度 × lookahead + 跟踪误差。
    // 因此按距离缩放 magnitude,天然复现了人类的加减速与慢速微调。
    const ramp = Math.min(1, distance / PURSUIT_FULL_SPEED_DISTANCE);
    const magnitude = this.nominalMagnitude * Math.max(PURSUIT_MIN_MAGNITUDE_RATIO, ramp);
    const direction = this.applyRecoveryDirection(dx / distance, dz / distance);
    return this.toCalibratedInput(direction.x, direction.z, magnitude);
  }

  /** 旧行为:奔向下一个 RDP waypoint(脚本无 trail 时的回退路径)。 */
  private getWaypointSeekInput(): Readonly<MovementInputState> {
    if (this.isDwelling()) return IDLE_INPUT;
    const target = this.getCurrentWaypoint();
    if (!target) return IDLE_INPUT;
    const position = this.readCurrentPosition();
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= this.waypointToleranceBand) return IDLE_INPUT;
    const direction = this.applyRecoveryDirection(dx / distance, dz / distance);
    return this.toCalibratedInput(direction.x, direction.z, this.nominalMagnitude);
  }

  private recordInputActivity(input: Readonly<MovementInputState>): Readonly<MovementInputState> {
    this.lastInputActive = input.isActive === true;
    return input;
  }

  private createPathTracker(options: SemanticReplayOptions): SemanticPathTracker | null {
    if (options.trailFollowing === false) return null;
    const trail = this.script.trail;
    if (!trail || trail.length < 2) return null;
    try {
      return new SemanticPathTracker(trail, { lookaheadSec: options.trailLookaheadSec });
    } catch {
      return null;
    }
  }

  /**
   * 当前闸门的示教时刻 —— 示教时钟的硬上限。
   * 闸门没过就把 actor 钉在人类当时所站的位置上等(交付闸门 → 正好停在交付盒里),
   * 而不是继续沿航迹前进。这取代了旧的「走完本段再整段重跑」。
   */
  private getScheduleCapSec(): number {
    const fallback = this.tracker?.endSec ?? this.script.meta.durationSec;
    const gate = this.script.milestones[this.matchedMilestones + this.releasedGates];
    return gate ? gate.t : fallback;
  }

  /** 推进示教时钟,算出本帧的追踪目标(在 post-update 里做,getInput 读缓存)。 */
  private updatePathTracking(deltaTime: number): void {
    if (!this.tracker) return;
    const previousScheduleSec = this.tracker.scheduleSec;
    const authoritative = readRecordReplayInputAuthority();
    this.inputAuthoritative = authoritative;
    // **推进之前**放行剧情段里的闸门,否则 cap 会在本帧就把时钟钳住(见下)。
    if (!authoritative) this.releaseGatesBlockingScriptedSchedule(deltaTime);
    const capSec = this.getScheduleCapSec();

    const step = this.tracker.advance(deltaTime, this.readCurrentPosition(), capSec, {
      inputAuthoritative: authoritative,
    });
    this.trackerStarted = true;
    this.pursuitTarget = step.target;
    this.pursuitScheduleSec = step.scheduleSec;
    this.scheduleAdvancedThisFrame = step.scheduleSec > previousScheduleSec + 1e-6;
    // 剧情把 actor 拖离航迹后,crossError 会让 gain 归零、示教时钟冻住。
    //
    // 这时**授权态的耐心放行救不了**:`gateHoldPatienceSec` 那条路要求 `isHoldingAt(cap)`,
    // 而时钟停在 cap **之前**(last-stand:0.71 < 下一个闸门 3.1255),「顶在闸门上」永远为假。
    // 真正缺的判据是:actor 正在往航迹上走回去 —— 那**就是**进展,不能被 6 秒停滞超时杀掉。
    // (实测:去掉这一条,恢复中的运行在半路被判负,scheduleSec 冻在 4.42。)
    this.recoveringToPath = authoritative
      && step.gain === 0
      && step.crossError < this.previousCrossError - 1e-3;
    this.previousCrossError = step.crossError;

    if (authoritative) {
      // 只有「输入说了算」时,跟踪误差才是真实的保真度指标。
      this.trackCrossErrorMax = Math.max(this.trackCrossErrorMax, step.crossError);
      this.trackCrossErrorSum += step.crossError;
      this.trackSamples += 1;
      this.trackBehindMax = Math.max(this.trackBehindMax, step.behindSec);
      this.trackStalledSec += Math.max(0, deltaTime) * (1 - step.gain);
    } else {
      this.trackScriptedSec += Math.max(0, deltaTime);
    }
    this.updateGateHold(deltaTime, capSec);
  }

  /**
   * 剧情段(输入不算数)里,任何**落在示教时钟当前位置或身后**的闸门立即放行。
   *
   * 剧情段里回放注入的输入根本不起作用,「停在闸门等进展」是死等 —— 能不能满足这个里程碑
   * 完全由游戏自己决定。上游原行为是在非授权时直接 early-return,**连放行路径都没有**,
   * 于是 cap 把示教时钟钉死在闸门时刻,而剧情正把角色拖走。
   *
   * last-stand 的真实签名(`final_cert.json`):`swordPicked` 闸门 `t=0.62` 落在 3.78s 剧情段**之内**,
   * 剧情把角色拖离航迹约 6 个单位,`scheduleSec` 恒 0.71,里程碑 1/55,stage 判负。
   *
   * 放行只前移 schedule cap,**不跳过里程碑**:`matchedMilestones` 不变,该里程碑之后照样要被
   * detector 命中,漏了仍会判 missing。
   *
   * > 判据取「闸门相对时钟的位置」而不是 `tracker.isHoldingAt(cap)`,是为了在**推进之前**就放行,
   * > 少一帧钳制。两者在剧情段里等价(时钟被 cap 钳住后下一帧就 holding),不是行为差异。
   * > 剧情**结束之后**的那段冻结,靠的是另一条修复:见 `recoveringToPath`。
   */
  private releaseGatesBlockingScriptedSchedule(deltaTime: number): void {
    if (!this.tracker) return;
    // 本帧时钟最远能走到哪:闸门只要不在这之后,就会挡路。
    const horizon = this.tracker.scheduleSec + Math.max(0, deltaTime);
    for (let guard = this.script.milestones.length; guard > 0; guard -= 1) {
      const gate = this.script.milestones[this.matchedMilestones + this.releasedGates];
      if (!gate || gate.t > horizon + 1e-6) return;
      this.releasedGates += 1;
      this.scriptedGateReleases += 1;
      this.gateHoldStalledSec = 0;
    }
  }

  /**
   * 闸门处的耐心 / 放行。
   *
   * 停在闸门等,是为了让 actor 在人类当时所站的位置上把进度攒够(交付闸门 → 站在盒里继续交付)。
   * 但如果连资源都没了(例:背包空,还差一次交付),等下去永远不会有进展 ——
   * 而人类接下来做的正是「出去再挖一趟」。所以:**有进展就等,没进展就放行示教时钟**,
   * 让 actor 沿着示教航迹继续走,自然会挖到、再回来交付。
   */
  private updateGateHold(deltaTime: number, capSec: number): void {
    if (!this.tracker) return;
    const signature = this.computeProgressSignature();
    const madeProgress = signature !== this.progressSignature || this.recoveringToPath;
    this.progressSignature = signature;

    if (!this.inputAuthoritative) {
      // 游戏在自己驱动角色:这段时间既不算停滞(活性由全局 maxDurationSec 兜底),
      // 也不该由「有没有进展」来决定闸门去留 —— 闸门已在推进之前放行过了
      // (见 releaseGatesBlockingScriptedSchedule)。
      this.gateHoldStalledSec = 0;
      this.stageNoProgressSec = 0;
      return;
    }

    if (madeProgress) {
      this.gateHoldStalledSec = 0;
      this.stageNoProgressSec = 0;
      return;
    }

    // 「示教时钟没走 + 游戏状态没变」才算停滞。这既覆盖闸门处的等待,
    // 也覆盖时钟被跟踪误差按死的情形(后者原本无人计时,只能干耗到 maxDurationSec)。
    if (this.scheduleAdvancedThisFrame) this.stageNoProgressSec = 0;
    else this.stageNoProgressSec += Math.max(0, deltaTime);

    const holdingAtGate = this.tracker.isHoldingAt(capSec)
      && this.matchedMilestones + this.releasedGates < this.script.milestones.length;
    if (!holdingAtGate) return;
    this.gateHoldStalledSec += Math.max(0, deltaTime);
    if (this.gateHoldStalledSec >= this.gateHoldPatienceSec) {
      this.gateHoldStalledSec = 0;
      this.releasedGates += 1;
    }
  }

  /** 游戏状态是否在动(经济 + facts)。纯观测,不含游戏概念。 */
  private computeProgressSignature(): string {
    const observation = this.readObservation();
    const economy = observation.economy;
    const facts = Object.keys(observation.facts)
      .sort()
      .map((key) => `${key}=${String(observation.facts[key])}`)
      .join(',');
    return `${economy.cash}|${economy.totalEarned}|${economy.totalSpent}|${facts}`;
  }

  afterUpdate(deltaTime: number): void {
    if (this.done || this.failed) return;
    this.elapsedSec = roundTo(this.elapsedSec + Math.max(0, deltaTime), 4);
    if (this.phase !== 'navigating') {
      this.updateCalibrationTick(deltaTime);
      this.checkCompletion();
      return;
    }
    this.clearExpiredRecovery();
    this.updatePathTracking(deltaTime);
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
    if (this.tracker) {
      this.updateWaypointProgressFromSchedule();
      return;
    }
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

  /**
   * 轨迹跟踪模式下 waypoint 只是统计口径:示教时钟越过某个 waypoint 的 t 就算「到过」,
   * 偏差记为那一刻 actor 到该 waypoint 的距离。dwell 由航迹本身承载,不再单独 hold。
   */
  private updateWaypointProgressFromSchedule(): void {
    let target = this.getCurrentWaypoint();
    while (target && this.pursuitScheduleSec >= target.t - 1e-6) {
      // 追踪模式下「偏离」的正确度量是 actor 到示教航迹的横向距离(crossError),
      // 不是 actor 到某个 RDP 拐点的距离 —— 闸门处示教时钟会停下等 actor,
      // 放行后时钟会先于 actor 掠过若干拐点,后者读数毫无意义。
      this.maxReachDeviation = Math.max(this.maxReachDeviation, this.trackCrossErrorMax);
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
      if (unexpected === 'extra' && this.isTerminalDivergence(actual)) {
        this.terminalDivergence = getRecordReplayMilestoneIdentity(actual);
      }
    }

    if (this.terminalDivergence) {
      // 示教里从未出现过的离散事件(例:回放把自己玩死了)。
      // 世界已经不是示教的那个世界了 —— 继续 deflect / 重跑本段毫无意义,直接判负。
      this.recordMissingMilestone({
        index: this.matchedMilestones,
        expected,
        reason: `terminal divergence: observed ${this.terminalDivergence}, which never occurs in the script`,
      });
      this.failCurrentStage(`terminal divergence: ${this.terminalDivergence}`);
      return;
    }

    if (!expected) return;
    const gateConditionSatisfied = this.isStageGateSatisfied(expected, current);
    if (!gateConditionSatisfied) return;
    this.recordEconomyGate(this.matchedMilestones, expected, current);
    if (!this.isEconomyGateSatisfied(expected, current)) return;
    this.matchedMilestones += 1;
    this.releasedGates = 0;
    this.gateHoldStalledSec = 0;
    this.stageNoProgressSec = 0;
    this.finishCurrentStage('ok');
    this.advanceStage(expected.t);
  }

  /** 该实际事件的 identity 在整条示教剧本里根本不存在 → 回放已经偏离到示教之外的状态。 */
  private isTerminalDivergence(actual: SemanticMilestone): boolean {
    if (!isDiscreteSemanticMilestone(actual)) return false;
    const identity = getRecordReplayMilestoneIdentity(actual);
    return !this.script.milestones.some(
      (milestone) => getRecordReplayMilestoneIdentity(milestone) === identity,
    );
  }

  private updateStuckWatchdog(): void {
    // 追踪模式下 dwell 表现为「输入本来就是 IDLE」,不能算卡死。
    const active = this.tracker
      ? (this.lastInputActive && this.inputAuthoritative)
      : (!!this.getCurrentWaypoint() && !this.isDwelling() && this.nominalMagnitude > 0.3);
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

    if (this.tracker) {
      // 追踪模式下墙钟不是进度的度量:示教时钟会在闸门处停下来等 actor 攒进度,
      // 也会因跟踪误差减速。真正的「不动了」= 示教时钟停住 **且** 游戏状态毫无变化。
      // 活性由这里 + 全局 maxDurationSec + terminal divergence 共同保证。
      if (this.stageNoProgressSec > this.gateStallTimeoutSec) {
        this.recordMissingMilestone({
          index: this.matchedMilestones,
          expected,
          reason: `no teach-clock or game-state progress for ${this.gateStallTimeoutSec}s`,
        });
        this.handleStageFailure('semantic replay stalled with no progress');
      }
      return;
    }

    const expectedStageDuration = Math.max(0.001, expected.t - this.scriptStageStartSec);
    const stageElapsed = this.elapsedSec - this.replayStageStartSec;
    if (stageElapsed > expectedStageDuration * 2 + this.stageTimeoutSlackSec) {
      this.recordMissingMilestone({
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
    // 追踪模式:闸门未过时示教时钟被钉在闸门时刻(见 getScheduleCapSec),
    // actor 就停在人类当时的位置上继续攒进度。不需要、也不该整段重跑。
    if (this.tracker) return;
    const stageWaypointEndIndex = this.getCurrentStageWaypointEndIndex();
    if (this.stageWaypointStartIndex >= stageWaypointEndIndex) return;
    if (this.waypointIndex < stageWaypointEndIndex) return;
    const current = this.readObservation();
    if (this.isStageGateSatisfied(expected, current)) return;

    const stage = this.stageVerdicts[this.stageVerdicts.length - 1];
    if (!stage || stage.status !== 'active') return;
    if (stage.loops >= this.maxLoopsPerStage) {
      this.recordMissingMilestone({
        index: this.matchedMilestones,
        expected,
        reason: `stage waypoint loop limit reached (${this.maxLoopsPerStage})`,
      });
      this.handleStageFailure('stage waypoint loop limit reached');
      return;
    }

    stage.loops += 1;
    this.rewindStagePath();
    this.waypointIndex = this.stageWaypointStartIndex;
    this.recovery = null;
    this.recoveryAttemptForWaypoint = 0;
    this.consecutiveSkippedWaypoints = 0;
    this.clearWaypointDwell();
    this.clearDwelledWaypointsInRange(this.stageWaypointStartIndex, stageWaypointEndIndex);
    this.watchdog.reset();
  }

  /** 重跑本 stage 的航迹段:把示教时钟拨回该 stage 的起点。 */
  private rewindStagePath(): void {
    if (!this.tracker) return;
    this.tracker.resetTo(this.scriptStageStartSec);
    this.pursuitScheduleSec = this.tracker.scheduleSec;
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
    this.markFailurePoint();
    this.failed = true;
    this.finishCurrentStage('failed');
    this.finalVerdict = this.buildVerdict();
  }

  /** 所有「缺了一个里程碑」都从这里过,顺手记下失败点(第一次为准)。 */
  private recordMissingMilestone(diff: MilestoneDiff): void {
    this.markFailurePoint();
    this.missingMilestones.push(diff);
  }

  /**
   * 第一次出问题的帧号(相对回放起点)。之后再坏也不覆盖 —— 我们要的是**最早**的分歧点,
   * 后面的失败多半是它的级联。
   */
  private markFailurePoint(): void {
    if (this.failurePointFrame !== null) return;
    this.failurePointFrame = Math.max(0, this.game.getFrameCount() - this.replayStartFrame);
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
    this.rewindStagePath();
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
    // 输入不算数时**不发标定脉冲**:发了也没用,而且剧情此刻正在自动移动角色,
    // 那段位移会被错误地归因给标定脉冲 —— 标定会"成功"地算出一个错的矩阵。
    if (!readRecordReplayInputAuthority()) return IDLE_INPUT;
    if (this.phase === 'calibrate-x') return { x: 1, y: 0, magnitude: 1, isActive: true };
    if (this.phase === 'calibrate-y') return { x: 0, y: 1, magnitude: 1, isActive: true };
    if (this.phase === 'calibration-nudge') {
      return { x: -0.7071, y: -0.7071, magnitude: 0.8, isActive: true };
    }
    return IDLE_INPUT;
  }

  /**
   * 标定阶段的每帧推进 —— **同样受 authority 门控**。
   *
   * 原先 `afterUpdate()` 在 `phase !== 'navigating'` 时直接返回,而 `updatePathTracking()` 是唯一
   * 消费 `readRecordReplayInputAuthority()` 的地方 ⇒ 标定期完全不查 authority。后果有两个:
   *   1. 示教时钟在剧情段不推进(`scriptedSec` 恒 0,时钟钉死),
   *   2. 更糟:标定发脉冲、量位移,而剧情此刻正在自动移动角色 —— 位移被归因给脉冲,
   *      于是 `calibration.status = ok` 但矩阵是错的;等输入解禁,角色早被剧情带到几个单位之外,
   *      `crossError` 从此永久顶穿。
   *
   * 现在:无权限时不发脉冲、不归因位移、冻结标定相位计时,并把这段时间按 scripted 推进示教时钟;
   * 权限一恢复就**从当前位置重开一次标定**(旧的 anchor 已经被剧情弄脏了)。
   */
  private updateCalibrationTick(deltaTime: number): void {
    const wasAuthoritative = this.inputAuthoritative;
    const authoritative = readRecordReplayInputAuthority();
    this.inputAuthoritative = authoritative;

    if (!authoritative) {
      this.advanceScriptedSchedule(deltaTime);
      // 冻结 phaseElapsed:剧情期间流逝的时间不算进标定的脉冲 / settle 窗口。
      this.phaseStartedAt = roundTo(this.phaseStartedAt + Math.max(0, deltaTime), 4);
      return;
    }

    if (!wasAuthoritative) {
      // 刚拿回控制权:角色已被剧情带走,`calibrationAttemptStart` 等 anchor 全是脏的。
      this.beginCalibrationAttempt();
      return;
    }

    this.updateCalibrationPhase();
  }

  /** 剧情段:示教时钟按录制节奏推进(不做误差门控),但不碰标定状态机。 */
  private advanceScriptedSchedule(deltaTime: number): void {
    if (!this.tracker) return;
    const capSec = this.getScheduleCapSec();
    const step = this.tracker.advance(deltaTime, this.readCurrentPosition(), capSec, {
      inputAuthoritative: false,
    });
    this.trackerStarted = true;
    this.pursuitTarget = step.target;
    this.pursuitScheduleSec = step.scheduleSec;
    this.trackScriptedSec += Math.max(0, deltaTime);
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
    // 标定阶段会把 actor 推离出生点;进入导航时示教时钟从头起跑,
    // 由跟踪误差增益负责先把 actor 拉回航迹再前进。
    // 但如果标定期有过剧情段(示教时钟已经跟着剧情推进过),就**不能**清零 —— 那会把剧情的进度丢掉。
    if (phase === 'navigating' && this.tracker && !this.trackerStarted) {
      this.tracker.resetTo(this.tracker.startSec);
      this.pursuitScheduleSec = this.tracker.scheduleSec;
      this.pursuitTarget = this.tracker.positionAt(this.tracker.startSec);
    }
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
    // 标定失败不中断运行(继续瞎走,让 verdict 把证据攒全),但它就是失败点。
    this.markFailurePoint();
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


  /**
   * 经济终值是一条**下界**:回放可以比示教更富(多挖了几趟),不能更穷。
   *
   * `cash` 原先根本不参与判定 —— 一条「示教结束时背着 100 块石头」的 tape,
   * 回放空手走到终点也算过。三个键现在统一走同一条容差下界(与经济闸门同口径)。
   */
  private isEconomyValueSatisfied(expected: number, actual: number): boolean {
    return actual >= expected * (1 - this.economyGateTolerance);
  }

  private isEconomyFinalSatisfied(economy: { cash: number; totalEarned: number; totalSpent: number }): boolean {
    for (const key of ['cash', 'totalEarned', 'totalSpent'] as const) {
      if (!this.isEconomyValueSatisfied(this.script.economyFinal[key], economy[key])) return false;
    }
    return true;
  }

  /**
   * 收尾时把**所有还没匹配上的里程碑**补进 missing。
   *
   * 原来 `missingMilestones` 只在「某个 stage 被判负 / 超时 / 循环上限」时 push 一条:
   * 一个早死的运行(matched 1/55)只会留下 **1** 条 missing,后面 53 个从没被尝试过的里程碑
   * 根本不进列表 ⇒ `criticalMissing` 恒为 0 ⇒ **通往 `failed` 的唯一里程碑判据永不触发**。
   * 实测(last-stand):matched 1/55、经济全灭、两个 stage 一个 failed 的运行,
   * 声明了 criticality 之后**仍然**判成 `degraded`。分级 v2 的地板是坏的。
   *
   * 现在:凡是 `index >= matchedMilestones` 的里程碑都算 missing(理由写明「运行提前结束」)。
   * 已经有 missing 记录的下标不重复添加(terminal divergence / stage 超时各记过一次)。
   * 全部匹配的运行(matched == length)这里什么都不加,行为不变。
   */
  private buildMissingMilestones(): MilestoneDiff[] {
    const missing = [...this.missingMilestones];
    const seen = new Set(missing.map((diff) => diff.index));
    for (let index = this.matchedMilestones; index < this.script.milestones.length; index += 1) {
      if (seen.has(index)) continue;
      seen.add(index);
      const expected = this.script.milestones[index];
      if (!expected) continue;
      missing.push({
        index,
        expected,
        reason: 'run ended before this milestone was attempted',
      });
    }
    return missing.sort((left, right) => left.index - right.index);
  }

  private buildDeterminismStamp(): SemanticDeterminismStamp | null {
    const horizon = this.determinismHorizon;
    if (horizon === null) return null;
    const failurePointFrame = this.failurePointFrame;
    if (failurePointFrame === null) {
      return { horizon, failurePointFrame: null, failureWithinHorizon: null, confidence: null };
    }
    const failureWithinHorizon = horizon === 'green-full' ? true : failurePointFrame <= horizon;
    return {
      horizon,
      failurePointFrame,
      failureWithinHorizon,
      confidence: failureWithinHorizon ? 'high' : 'low',
    };
  }

  private buildVerdict(): SemanticVerdict {
    const current = this.readObservation();
    const economyDiffs: Record<string, { expected: number; actual: number; withinTolerance: boolean }> = {};
    for (const key of ['cash', 'totalEarned', 'totalSpent'] as const) {
      const expected = this.script.economyFinal[key];
      const actual = current.economy[key];
      if (expected === actual) continue;
      economyDiffs[key] = { expected, actual, withinTolerance: this.isEconomyValueSatisfied(expected, actual) };
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
    const quality: SemanticVerdict['quality'] = ok ? (recovered ? 'recovered' : 'clean') : 'failed';

    const missingMilestones = this.buildMissingMilestones();
    const layered = countLayeredMilestones(this.script.milestones, missingMilestones, isRecordReplayMilestoneCritical);
    // 绕路分:每一次卡死恢复 / 跳过的航点 / 整段重跑 / 多出来的事件都算一笔。
    // orderViolations 不单独计 —— 乱序事件已经进了 extraMilestones,再加就是重复计分。
    const detourScore = this.stuckEvents.length
      + this.skippedWaypoints
      + this.extraMilestones.length
      + this.stageVerdicts.reduce((sum, stage) => sum + stage.recoveries + Math.max(0, stage.loops - 1), 0);
    const grading = gradeSemanticVerdict(
      {
        refused: false,
        calibrationFailed: this.calibrationVerdict.status === 'failed',
        terminalDivergence: this.terminalDivergence,
        criticalMissing: layered.criticalMissing,
        optionalMissing: layered.optionalMissing,
        optionalTotal: layered.optionalTotal,
        criticalTotal: layered.criticalTotal,
        economyPass: !economyGateFailed && economyFinalPass,
        stageDisrupted: this.stageVerdicts.some((stage) => stage.status !== 'ok'),
        detourScore,
        ok,
        quality,
      },
      this.gradeThresholds,
    );

    return {
      ok,
      quality,
      grade: grading.grade,
      grading,
      terminalDivergence: this.terminalDivergence,
      determinism: this.buildDeterminismStamp(),
      milestones: {
        matched: this.matchedMilestones,
        missing: missingMilestones,
        extra: [...this.extraMilestones],
        orderViolations: this.orderViolations,
        criticalMissing: layered.criticalMissing,
        optionalMissing: layered.optionalMissing,
        criticalTotal: layered.criticalTotal,
        optionalTotal: layered.optionalTotal,
      },
      economyFinal: {
        pass: economyFinalPass,
        tolerance: this.economyGateTolerance,
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
      trailTracking: this.tracker
        ? {
            enabled: true,
            trailPoints: this.script.trail?.length ?? 0,
            scheduleSec: roundTo(this.pursuitScheduleSec, 4),
            scriptDurationSec: this.script.meta.durationSec,
            maxCrossError: roundTo(this.trackCrossErrorMax, 4),
            meanCrossError: roundTo(this.trackSamples > 0 ? this.trackCrossErrorSum / this.trackSamples : 0, 4),
            maxBehindSec: roundTo(this.trackBehindMax, 4),
            stalledSec: roundTo(this.trackStalledSec, 4),
            scriptedSec: roundTo(this.trackScriptedSec, 4),
            scriptedGateReleases: this.scriptedGateReleases,
          }
        : null,
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

/** 只接受非负整数帧号或 `'green-full'`;其余(undefined / NaN / 负数)一律当作「没传」。 */
function normalizeDeterminismHorizon(value: number | 'green-full' | null | undefined): number | 'green-full' | null {
  if (value === 'green-full') return 'green-full';
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
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

/**
 * A verdict for a script that was never driven. `ok: false` + `refused` so callers cannot mistake
 * it for a passing run, and `quality: 'failed'` so existing consumers treat it as a failure.
 */
export function createRefusedSemanticVerdict(script: SemanticScript): SemanticVerdict {
  const grading = gradeSemanticVerdict({
    refused: true,
    calibrationFailed: false,
    terminalDivergence: null,
    criticalMissing: 0,
    optionalMissing: 0,
    optionalTotal: 0,
    criticalTotal: 0,
    economyPass: false,
    stageDisrupted: false,
    detourScore: 0,
    ok: false,
    quality: 'failed',
  });
  return {
    ok: false,
    quality: 'failed',
    grade: grading.grade,
    grading,
    terminalDivergence: null,
    determinism: null,
    refused: {
      reason: 'semantic script asserts nothing (0 milestones, 0 waypoints) — nothing to certify. '
        + 'Most often the source tape carries no stateSamples/trail.',
      milestones: script.milestones.length,
      waypoints: script.waypoints.length,
    },
    milestones: {
      matched: 0,
      missing: [],
      extra: [],
      orderViolations: 0,
      criticalMissing: 0,
      optionalMissing: 0,
      criticalTotal: 0,
      optionalTotal: 0,
    },
    economyFinal: { pass: false, tolerance: 0, diffs: {} },
    economyGates: [],
    waypoints: { reached: 0, skipped: 0, maxDeviation: 0, toleranceBand: 0 },
    trailTracking: null,
    calibration: {
      status: 'pending',
      attempts: 0,
      pulseSec: 0,
      settleSec: 0,
      minDisplacement: 0,
      displacement: { inputX: 0, inputY: 0 },
      matrix: null,
      determinant: null,
    },
    waypointsPerStage: [],
    stages: [],
    stuckEvents: [],
    durationSec: 0,
  };
}

export function runSemanticReplay(options: RunSemanticReplayOptions): Promise<SemanticVerdict> {
  const { game, inputService } = options;
  const script = normalizeSemanticReplayScript(options.script);

  // A script with neither milestones nor waypoints asserts nothing: driving it would return
  // `ok: true` in under a second and look like a pass. Refuse loudly instead — a vacuous green
  // baseline is more dangerous than a red one.
  if (!isSemanticScriptCertifiable(script)) {
    return Promise.resolve(createRefusedSemanticVerdict(script));
  }

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
    ...(script.trail ? { trail: script.trail.map((point) => ({ ...point })) } : {}),
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
