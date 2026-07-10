import type { Game } from '../../core/Game';
import {
  registerRecordReplayProviders,
  type MilestoneDetector,
  type RecordReplayMilestoneEvent,
  type RecordReplayObservation,
} from './providers';
import type { RecordingHudBanner } from './recording-hud';

/**
 * 接入示例 —— 每个游戏 fork 这个文件,换成自己的系统。
 *
 * 这里演示 record-replay 的**全部四个注册面**:
 *   1. `snapshotProviders`  每帧进 state hash 的世界快照 + `facts` / `economy`
 *   2. `playerPosition`     Mode B 的 waypoint / trail 全靠它
 *   3. `milestoneDetectors` 玩家决策点;`critical` 决定它进不进主线因果链(四档 verdict)
 *   4. `inputAuthority`     「此刻玩家输入说了算吗」—— 过场 / 剧情自动移动 / 输入锁
 *
 * 另有一个不在 providers 里、但同属游戏侧的扩展点:
 *   5. `createTemplateRecordingBanner()` 录制 HUD 的游戏专属警告条(见文件末尾)
 *
 * 接入规范(实证教训,详见 fps-3d-harness `docs/06-record-replay-dual-mode.md` §6.3)。
 */
export function registerTemplateRecordReplayProviders(getGame: () => Game | null): () => void {
  return registerRecordReplayProviders({
    snapshotProviders: [
      {
        name: 'template.simplePlayer',
        getSnapshot() {
          const player = getGame()?.getPlayer();
          if (!player) return null;
          return {
            position: {
              x: player.position.x,
              y: player.position.y,
              z: player.position.z,
            },
            radius: player.radius,
          };
        },
      },
      {
        name: 'template.exampleFacts',
        getSnapshot() {
          const player = getGame()?.getPlayer();
          // ⚠️ 快照里的每一个字段都进 state hash,所以它只能是**仿真状态的函数**。
          // 绝不能读 `game.getPaused()` 之类的**宿主状态** —— Mode A 是在暂停态下用
          // `stepFrame()` 逐帧驱动的,录制时 paused=false、回放时 paused=true,
          // 于是每一帧的 hash 都对不上(实测 `firstDivergence: 0`)。
          const nearOrigin = !!player && Math.hypot(player.position.x, player.position.z) < 5;
          return {
            recordReplay: {
              facts: {
                // 布尔 fact **必须 latch**(一旦 true 永远 true),数值 fact 必须单调。
                // 反例:一个随走位来回翻转的 `gatePassed` 会产出一串伪里程碑;而如果一次完整的
                // `false → true → false` 恰好落在两次 stateSample 之间,逐帧 detector 会把这串噪声
                // 全录进 tape。录制期的契约校验器会当场 console.warn。
                ready: true,
                // 状态观测型 fact:随走位来回翻转,但没有任何 detector 拿它产里程碑
                // (qy 的 `insideBoundary` 就是这类)。必须报备豁免,见下方 `observationOnlyFacts`。
                nearOrigin,
              },
            },
          };
        },
        // ⚠️ 豁免声明放在**注册面**,绝不能塞进 `getSnapshot()` 的返回值 ——
        // 快照逐帧进 state hash,往里加一个字段就会改掉 `startStateHash`,
        // 所有已录 tape 的 Mode A 当场失配。(qy 实测踩过:593582e0 → f9c22e44。)
        observationOnlyFacts: ['nearOrigin'],
      },
    ],

    /**
     * ⚠️ **最容易踩的坑**:这里必须指向**玩法真正消费的实体**。
     *
     * 模板的 `getPlayer()` 返回 scaffold 的 `SimplePlayer`。真实游戏往往另有一套角色控制器
     * (qy-blade-goldrush 是 `ThreeCSystem` 的 actor),而 `SimplePlayer` 只是个没人看的遗留隐形体。
     * 指错了,Mode B 会驾着一个「幽灵身体」在地图上跑,里程碑一个也碰不到 —— 而且没有任何报错。
     *
     * 换成你的角色控制器,别原样留着。
     */
    playerPosition() {
      const player = getGame()?.getPlayer();
      return player ? { x: player.position.x, y: player.position.y, z: player.position.z } : null;
    },

    milestoneDetectors: [
      createTemplateExampleMilestoneDetector(),
      createTemplateOutcomeMilestoneDetector(),
    ],

    /**
     * 返回 `false` = 游戏正在自己驱动角色(过场 / 剧情自动移动 / 输入被锁),
     * 回放注入的输入这段时间根本不起作用。不报的话,轨迹跟踪会把「跟不上」误判成「跑偏了」,
     * 把示教时钟按死在原地。
     *
     * ⚠️ **必须是所有夺权路径的合取**。只查一条是经典 bug:qy 有「剧情禁输入」与
     * 「过场锁位移」两条**互相独立**的路径,只查前者时,过场期间标定矩阵照样被投毒。
     * 模板只有一条(`InputService.setEnabled`),真实游戏请把每条都 `&&` 进来。
     *
     * 不注册 = 永远授权 = 与本特性引入前行为完全一致。
     */
    inputAuthority() {
      const inputEnabled = getGame()?.getInputService()?.isEnabled() ?? true;
      return inputEnabled;
    },
  });
}

/**
 * 「路过型」里程碑:交付档位、装备拾取一类。`kind: 'custom'` 默认 **optional** ——
 * 缺失只按比例扣分(默认容忍 20%),不会把 verdict 打成 failed。
 */
function createTemplateExampleMilestoneDetector(): MilestoneDetector {
  return {
    kind: 'custom',
    // ⚠️ **非默认 kind 必须显式声明 critical**(harness docs/06 §6.3 规则 7)。
    // 不声明就靠默认表兜底,而默认表只认 outcome/stage —— 一个只产 custom 的游戏会
    // criticalTotal=0,于是**档位无声塌缩**:上不去 clean(§6.2 裁决③),也下不来 failed
    // (criticalMissing 恒 0),1/55 匹配的运行照样得 degraded,且没有任何报错。
    critical: false,
    detect(previous, next) {
      // ⚠️ 只对**进度型** fact 产里程碑。`template.exampleFacts.paused` 是状态观测(会来回翻转),
      // 把它也算进来会在每次暂停/继续时凭空多出两个里程碑 —— 这正是 `observationOnlyFacts` 想避免的事,
      // 而豁免只让契约校验器闭嘴,**不会**替你把它从 detector 里筛掉。
      return diffFactChanges(previous, next, 'custom')
        .filter((event) => String(event.detail.id) === 'template.exampleFacts.ready');
    },
    isSatisfied(milestone, observation) {
      const id = typeof milestone.detail.id === 'string' ? milestone.detail.id : null;
      if (!id) return false;
      const expected = milestone.detail.to;
      return String(observation.facts[id]) === String(expected);
    },
    getIdentity(milestone) {
      return typeof milestone.detail.id === 'string' ? milestone.detail.id : null;
    },
  };
}

/**
 * **终局态里程碑 —— 每个游戏都必须注册一个**(通关 / 失败 / 死亡)。
 *
 * 不注册的代价:回放把自己玩死之后,表现是一堆莫名其妙的 stage 超时,而不是一条可读的
 * `extra: outcome:death` + 立即判负。有了它,「示教里从未出现过的终局态」= terminal divergence,
 * 直接 failed,不再浪费几十秒去 deflect/重跑一个已经回不去的世界。
 *
 * `kind: 'outcome'` 已经在默认表里,`critical: true` 只是把这个面显式写出来给接入者看。
 */
function createTemplateOutcomeMilestoneDetector(): MilestoneDetector {
  return {
    kind: 'outcome',
    critical: true,
    detect(previous, next) {
      return diffFactChanges(previous, next, 'outcome')
        .filter((event) => String(event.detail.id).startsWith('template.outcome.'))
        .filter((event) => String(event.detail.to) === 'true');
    },
    isSatisfied(milestone, observation) {
      const id = typeof milestone.detail.id === 'string' ? milestone.detail.id : null;
      return !!id && String(observation.facts[id]) === 'true';
    },
    getIdentity(milestone) {
      return typeof milestone.detail.id === 'string' ? milestone.detail.id : null;
    },
  };
}

function diffFactChanges(
  previous: RecordReplayObservation,
  next: RecordReplayObservation,
  kind: string,
): RecordReplayMilestoneEvent[] {
  const events: RecordReplayMilestoneEvent[] = [];
  const keys = new Set([...Object.keys(previous.facts), ...Object.keys(next.facts)]);
  for (const key of [...keys].sort()) {
    const before = previous.facts[key];
    const after = next.facts[key];
    if (before === after || after === undefined) continue;
    events.push({
      kind,
      detail: {
        id: key,
        from: before === undefined ? '[missing]' : String(before),
        to: String(after),
      },
    });
  }
  return events;
}

/**
 * 录制 HUD 的游戏专属警告条。**框架不可能知道一个游戏会怎样把 tape 弄丢**,所以这个钩子由游戏实现。
 *
 * 真实案例(qy-blade-goldrush):
 *   - 罩外氧气耗尽 → 死亡 → 玩家点「重试」→ `location.reload()`,tape 没落盘就没了
 *   - 通关结算 → 玩家顺手点常驻的 Play Now → CTA 跳转,同上
 *
 * 生命线(增量落盘 / CTA 钩子 / reload 钩子)已经能兜住这些,最坏丢一个 checkpoint 间隔。
 * 但示教 tape 的价值在完整性 —— 提前喊一嗓子比事后补救便宜得多。
 *
 * 模板没有这类陷阱,只演示一个通用的:录制中把游戏暂停了,tape 不会前进。
 */
export function createTemplateRecordingBanner(getGame: () => Game | null): () => RecordingHudBanner | null {
  return () => {
    const game = getGame();
    if (!game) return null;
    if (game.getPaused()) {
      return { tone: 'warn', text: '⏸ 游戏已暂停 —— tape 不会前进' };
    }
    return null;
  };
}
