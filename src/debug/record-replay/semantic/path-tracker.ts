/**
 * 语义回放的轨迹跟踪器(框架侧,游戏无关)。
 *
 * ── 为什么要它 ──
 * 原本的 Mode B 控制律是「奔向下一个 RDP waypoint,进容差带就换下一个」。
 * 这在两个方面丢真:
 *   1. **空间**:RDP(默认容差 0.5)把上千个 trail 点压成几十个拐点,腿与腿之间走直线。
 *      凡是「扫过路径」才产生的因果(本仓:腰间矿镐扫过矿点)都会大幅缩水。
 *   2. **时间**:waypoint 序列不带节奏。人类的 idle / 加减速 / 折返全部丢失。
 *      对有硬时间约束的游戏(本仓:出罩 7s 必死,人类最险一趟只剩 0.83s 余量),
 *      任何变慢都直接变成失败。
 *
 * ── 做法 ──
 * 沿录制 trail 做**时间参数化的纯追踪**(pure pursuit):
 *   - 维护一个「示教时钟」schedule,目标点 = trail(schedule + lookahead)。
 *   - schedule 前进速率由跟踪误差调制:actor 偏离航迹 / 落后进度时,时钟减速甚至暂停,
 *     等 actor 跟上;actor 领先时时钟全速。=> 复现人类节奏,且永远不会把 actor 甩下。
 *   - 人类站着不动的那几秒(dwell),trail 在空间上不动而时间在走 ——
 *     目标点自然停在原地,actor 也就停下。**dwell 不需要单独建模。**
 *
 * 纯几何 + 时间,不含任何游戏概念。
 */

export interface SemanticTrailPoint {
  t: number;
  x: number;
  z: number;
}

export interface SemanticPathTrackerOptions {
  /** 目标点取在示教时钟前方多少秒。越大越"抄近道",越小越贴合。 */
  lookaheadSec?: number;
  /** 横向偏离多少以内,示教时钟全速前进。 */
  crossErrorFullSpeed?: number;
  /** 横向偏离达到此值,示教时钟完全暂停(等 actor 回到航迹)。 */
  crossErrorStall?: number;
  /** 沿航迹落后多少秒以内,时钟全速前进。 */
  behindFullSpeed?: number;
  /** 沿航迹落后达到此值,时钟完全暂停。 */
  behindStall?: number;
  /** 搜索最近点时,向后 / 向前看的时间窗。 */
  projectBackSec?: number;
  projectAheadSec?: number;
}

export interface SemanticPathAdvanceOptions {
  /**
   * 玩家输入此刻是否说了算(默认 true)。
   *
   * `false` = 游戏正在自己驱动角色(过场 / 剧情自动移动 / 输入锁)。这段时间里:
   *   - 回放注入的输入不起作用,"角色跟不跟得上"不再反映回放进度;
   *   - 角色还可能被脚本瞬移到航迹上远得多的位置,把 `crossError` 顶穿 —— 一旦增益归零,
   *     示教时钟停住,而投影窗口是**跟着时钟走的**,于是窗口再也追不上角色:**永久死锁**。
   * 所以这段时间改为**按示教时钟自然推进**,不做误差门控。
   */
  inputAuthoritative?: boolean;
}

export interface SemanticPathTrackerStep {
  /** actor 应该朝其移动的世界坐标。 */
  target: { x: number; z: number };
  /** 当前示教时钟对应的航迹点。 */
  reference: { x: number; z: number };
  /** 示教时钟(秒,与 script 的 t 同一坐标系)。 */
  scheduleSec: number;
  /** actor 到航迹的最近距离(横向偏离)。 */
  crossError: number;
  /** actor 沿航迹落后示教时钟多少秒(领先为 0)。 */
  behindSec: number;
  /** 本帧示教时钟的前进增益 0..1。 */
  gain: number;
  /** 本帧输入是否说了算(false = 游戏在自己驱动角色,时钟自然推进)。 */
  inputAuthoritative: boolean;
  atEnd: boolean;
}

const DEFAULTS = {
  lookaheadSec: 0.2,
  crossErrorFullSpeed: 0.3,
  crossErrorStall: 1.2,
  behindFullSpeed: 0.25,
  behindStall: 1.0,
  projectBackSec: 0.6,
  projectAheadSec: 1.2,
} as const;

export class SemanticPathTracker {
  private readonly points: readonly SemanticTrailPoint[];
  private readonly options: Required<SemanticPathTrackerOptions>;
  private schedule: number;

  constructor(points: readonly SemanticTrailPoint[], options: SemanticPathTrackerOptions = {}) {
    if (points.length < 2) throw new Error('SemanticPathTracker requires at least 2 trail points.');
    this.points = points;
    this.options = {
      lookaheadSec: positive(options.lookaheadSec, DEFAULTS.lookaheadSec),
      crossErrorFullSpeed: positive(options.crossErrorFullSpeed, DEFAULTS.crossErrorFullSpeed),
      crossErrorStall: positive(options.crossErrorStall, DEFAULTS.crossErrorStall),
      behindFullSpeed: positive(options.behindFullSpeed, DEFAULTS.behindFullSpeed),
      behindStall: positive(options.behindStall, DEFAULTS.behindStall),
      projectBackSec: positive(options.projectBackSec, DEFAULTS.projectBackSec),
      projectAheadSec: positive(options.projectAheadSec, DEFAULTS.projectAheadSec),
    };
    this.schedule = this.startSec;
  }

  get startSec(): number {
    return this.points[0]!.t;
  }

  get endSec(): number {
    return this.points[this.points.length - 1]!.t;
  }

  get scheduleSec(): number {
    return this.schedule;
  }

  get atEnd(): boolean {
    return this.schedule >= this.endSec - 1e-6;
  }

  resetTo(tSec: number): void {
    this.schedule = clamp(tSec, this.startSec, this.endSec);
  }

  /** 线性插值出示教时刻 t 的航迹位置。 */
  positionAt(tSec: number): { x: number; z: number } {
    const t = clamp(tSec, this.startSec, this.endSec);
    const index = this.segmentIndexFor(t);
    const a = this.points[index]!;
    const b = this.points[index + 1] ?? a;
    const span = b.t - a.t;
    if (span <= 1e-9) return { x: a.x, z: a.z };
    const ratio = clamp((t - a.t) / span, 0, 1);
    return { x: a.x + (b.x - a.x) * ratio, z: a.z + (b.z - a.z) * ratio };
  }

  /**
   * 推进示教时钟并给出本帧的追踪目标。
   * `dt` 是回放侧的真实帧时长。
   *
   * `maxScheduleSec` 是硬上限:示教时钟和 lookahead 都不许越过它。
   * 调用方用它把时钟钉在「当前闸门的示教时刻」上 —— 闸门没过就停在人类当时所站的位置
   * (对交付类闸门,那正是交付盒里),而不是继续沿航迹往前走、把 actor 拖出触发区。
   */
  advance(
    dt: number,
    actor: { x: number; z: number },
    maxScheduleSec?: number,
    options: SemanticPathAdvanceOptions = {},
  ): SemanticPathTrackerStep {
    const inputAuthoritative = options.inputAuthoritative !== false;
    const cap = clamp(maxScheduleSec ?? this.endSec, this.startSec, this.endSec);
    const projectedSec = Math.min(this.projectOntoPath(actor), cap);
    const reference = this.positionAt(this.schedule);
    const projected = this.positionAt(projectedSec);
    const crossError = distance(actor, projected);
    const behindSec = Math.max(0, this.schedule - projectedSec);

    // 输入不算数时,跟踪误差不再是进度的证据 —— 时钟按示教节奏自然推进(仍受 cap 约束)。
    const gain = inputAuthoritative
      ? Math.min(
          rampDown(crossError, this.options.crossErrorFullSpeed, this.options.crossErrorStall),
          rampDown(behindSec, this.options.behindFullSpeed, this.options.behindStall),
        )
      : 1;
    this.schedule = clamp(Math.min(this.schedule + Math.max(0, dt) * gain, cap), this.startSec, this.endSec);

    // 目标锚在「示教时钟」与「actor 实际进度」中更靠前的那个上,避免把 actor 往回拽;
    // 但一律不许越过 cap。输入不算数时不去追投影(它可能被窗口钳到毫无意义的位置),
    // 直接锚在示教时钟上,授权恢复时就从正确的地方接着走。
    const anchorSec = inputAuthoritative ? Math.max(this.schedule, projectedSec) : this.schedule;
    const target = this.positionAt(Math.min(cap, anchorSec + this.options.lookaheadSec));

    return {
      target,
      reference,
      scheduleSec: this.schedule,
      crossError,
      behindSec,
      gain,
      inputAuthoritative,
      atEnd: this.atEnd,
    };
  }

  /** 示教时钟是否已经顶到给定上限(闸门位)。 */
  isHoldingAt(maxScheduleSec: number): boolean {
    return this.schedule >= Math.min(maxScheduleSec, this.endSec) - 1e-6;
  }

  /**
   * **全程**投影,把示教时钟重锚到 actor 在航迹上的最近点。
   *
   * 剧情段(输入不算数)结束时必须调一次:剧情把 actor 搬到时间窗够不着的地方,
   * 而 `projectOntoPath()` 只在 `schedule ± (projectBackSec, projectAheadSec)` 里找
   * —— 它会返回一个毫无意义的近端点,`crossError` 因此虚高(last-stand 实测 13.36),
   * `gain` 归零,时钟再也走不动,归航永远跨不过这个缺口。
   *
   * 全程搜索在自交航迹上可能跳段 —— 这是**刻意的取舍**:剧情段结束时旧 anchor 已经脏了
   * (与标定重开 `beginCalibrationAttempt()` 同一哲学),宁可重新找,也不要抱着一个错锚点。
   * 上界仍受 cap 约束,不会越过尚未匹配的闸门。
   */
  reanchorToActor(actor: { x: number; z: number }, maxScheduleSec?: number): number {
    const cap = clamp(maxScheduleSec ?? this.endSec, this.startSec, this.endSec);
    let bestSec = this.schedule;
    let bestDistanceSq = Infinity;
    const lastIndex = this.points.length - 2;
    for (let index = 0; index <= lastIndex; index += 1) {
      const a = this.points[index]!;
      const b = this.points[index + 1]!;
      if (a.t > cap) break;
      const { ratio, distanceSq } = closestPointOnSegment(actor, a, b);
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestSec = a.t + (b.t - a.t) * ratio;
      }
    }
    this.schedule = clamp(Math.min(bestSec, cap), this.startSec, this.endSec);
    return this.schedule;
  }

  /**
   * 在示教时钟附近的时间窗里,找 actor 到航迹折线的最近点,返回该点的示教时刻。
   * 用时间窗而不是全局搜索,避免航迹自交时跳到很远的另一段上。
   */
  private projectOntoPath(actor: { x: number; z: number }): number {
    const from = clamp(this.schedule - this.options.projectBackSec, this.startSec, this.endSec);
    const to = clamp(this.schedule + this.options.projectAheadSec, this.startSec, this.endSec);
    let bestSec = this.schedule;
    let bestDistanceSq = Infinity;

    let index = this.segmentIndexFor(from);
    const lastIndex = this.points.length - 2;
    while (index <= lastIndex) {
      const a = this.points[index]!;
      const b = this.points[index + 1]!;
      if (a.t > to) break;
      const { ratio, distanceSq } = closestPointOnSegment(actor, a, b);
      if (distanceSq < bestDistanceSq) {
        bestDistanceSq = distanceSq;
        bestSec = a.t + (b.t - a.t) * ratio;
      }
      index += 1;
    }
    return clamp(bestSec, from, to);
  }

  /** 返回 t 落在的线段起点下标(二分)。 */
  private segmentIndexFor(t: number): number {
    let low = 0;
    let high = this.points.length - 2;
    if (high < 0) return 0;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.points[mid]!.t <= t) low = mid;
      else high = mid - 1;
    }
    return low;
  }
}

function closestPointOnSegment(
  point: { x: number; z: number },
  a: SemanticTrailPoint,
  b: SemanticTrailPoint,
): { ratio: number; distanceSq: number } {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const lengthSq = vx * vx + vz * vz;
  const ratio = lengthSq <= 1e-12
    ? 0
    : clamp(((point.x - a.x) * vx + (point.z - a.z) * vz) / lengthSq, 0, 1);
  const cx = a.x + vx * ratio;
  const cz = a.z + vz * ratio;
  const dx = point.x - cx;
  const dz = point.z - cz;
  return { ratio, distanceSq: dx * dx + dz * dz };
}

/** value <= full 时返回 1,>= stall 时返回 0,中间线性。 */
function rampDown(value: number, full: number, stall: number): number {
  if (value <= full) return 1;
  if (value >= stall || stall <= full) return 0;
  return (stall - value) / (stall - full);
}

function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
