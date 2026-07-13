export interface RecordReplayPlayerPosition {
  x: number;
  z: number;
  y?: number;
}

export interface RecordReplaySnapshotProvider {
  name: string;
  getSnapshot(): unknown;
  /**
   * 本 provider 里哪些 fact 是**状态观测**而不是进度(会来回翻转 / 会回落),
   * 因而豁免「布尔必须 latch、数值必须单调」的契约校验。
   *
   * ⚠️ 这是**注册期的静态元数据**,故意不放进 `getSnapshot()` 的返回值:
   * 快照会逐帧进 state hash,往里加任何字段都会改变 `startStateHash`,
   * 让所有已录 tape 的 Mode A 立刻失配。(2026-07-10 实测踩到:加进快照后
   * Page 的 5003 帧 tape 从 `fnv1a32:593582e0` 变成 `fnv1a32:f9c22e44`。)
   *
   * 豁免只让校验器闭嘴,**不会**替你把这些 fact 从 detector 里筛掉。
   */
  observationOnlyFacts?: readonly string[];
}

export interface RecordReplayEconomyState {
  cash: number;
  totalEarned: number;
  totalSpent: number;
}

export interface RecordReplayEconomyGateExpectation {
  totalEarned: number;
  totalSpent: number;
}

export interface RecordReplayObservation {
  t: number;
  economy: RecordReplayEconomyState;
  facts: Record<string, number | string | boolean>;
  snapshots: Record<string, unknown>;
  playerPosition: { t: number; x: number; z: number } | null;
}

export interface RecordReplayMilestoneEvent {
  t?: number;
  kind: string;
  detail: Record<string, number | string>;
  economyAtGate?: RecordReplayEconomyGateExpectation;
}

export interface MilestoneDetector {
  kind: string;
  detect(previous: RecordReplayObservation, next: RecordReplayObservation): RecordReplayMilestoneEvent[];
  isSatisfied?(milestone: RecordReplayMilestoneEvent, observation: RecordReplayObservation): boolean;
  getIdentity?(milestone: Pick<RecordReplayMilestoneEvent, 'kind' | 'detail'>): string | null;
  /**
   * detail 里的**强断言键**:匹配双方都带这些键时,值必须相等才算同一里程碑。
   *
   * 用于把"第 N 次升级"升格为"具体升级了哪一件"(反例实证:axe 回放斧头等级与示教
   * 不一致仍 14/14 全绿——计数对了,内容错了,2026-07-12)。只约束**双方都带键**的情形:
   * 老 tape 的事件没有该键 ⇒ 不构成约束,回退计数/身份语义,向后兼容。
   */
  strictDetailKeys?: readonly string[];
  /**
   * 这个里程碑在不在**主线因果链**上?
   *
   * `true`(critical)—— 缺一个就判 failed:通关 / 死亡等终局态,以及推进阶段的关键节点。
   * `false`(optional)—— 路过型:交付档位、装备拾取。缺失只按比例扣分(见 semantic/grade.ts)。
   *
   * 不声明 = 按 kind 走默认表(`RECORD_REPLAY_DEFAULT_CRITICAL_KINDS`)。
   * 契约:`fps-3d-harness/docs/06-record-replay-dual-mode.md` §6.2。
   */
  critical?: boolean;
}

/**
 * 默认 critical 的 kind。游戏可用 `MilestoneDetector.critical` 逐个覆盖。
 *
 * 导出是为了让 harness 侧的 runner 在**没有游戏运行时**也能从 `kind` 复算分层
 * (verdict / 剧本里只留 kind,不落 critical 标记)。
 */
export const RECORD_REPLAY_DEFAULT_CRITICAL_KINDS: readonly string[] = ['outcome', 'stage'];

/** 没有注册检测器时的兜底:只认默认表。 */
export function getDefaultRecordReplayMilestoneCriticality(kind: string): boolean {
  return RECORD_REPLAY_DEFAULT_CRITICAL_KINDS.includes(String(kind ?? '').trim());
}

/**
 * 「此刻玩家输入说了算吗?」
 *
 * 返回 `false` 表示**游戏正在自己驱动角色** —— 过场动画、剧情自动移动、输入被锁死等等。
 * 这段时间里回放注入的输入根本不起作用,于是「角色跟不跟得上目标」不再能反映回放的进度,
 * 语义回放的轨迹跟踪必须知道这一点,否则会把「跟不上」误判成「跑偏了」而把示教时钟按死。
 *
 * 不注册 = 一直授权 = 与注册前行为完全一致。
 */
export type RecordReplayInputAuthorityProvider = () => boolean;

/**
 * 离散动作面(点击选卡类游戏动词)。游戏注册「出现了什么选择 + 怎么执行」,
 * 框架录**语义 ID**(promptId/chosen),不录像素坐标。
 * `invoke` 必须与人点击走**同一条代码路径**(同一漏斗函数)且同步执行;
 * `getPending` 返回当前待决选择(Mode B 轮询它决定何时替玩家做选择)。
 */
export interface RecordReplayActionProvider {
  id: string;
  invoke(params: Record<string, string | number>): void;
  getPending(): { promptId: string; options: string[] } | null;
}

export interface RegisterRecordReplayProvidersOptions {
  snapshotProviders?: readonly RecordReplaySnapshotProvider[];
  milestoneDetectors?: readonly MilestoneDetector[];
  playerPosition?: (() => RecordReplayPlayerPosition | null | undefined) | null;
  inputAuthority?: RecordReplayInputAuthorityProvider | null;
  actions?: readonly RecordReplayActionProvider[];
  /**
   * 观测语义版本。**观测口径变了就 +1**(经济换传感器/里程碑换身份规则/facts 换含义)。
   * 录制时写进 tape envelope,提取时写进剧本 meta,回放时与现注册版本比对 ——
   * 错配 = 剧本目标与传感器读数不可比,直接拒绝认证(实证:axe economyFinal cash:500
   * 旧脚手架死数 vs 新背包传感器 ≤85,目标物理不可达,尾段死等到超时,2026-07-12)。
   */
  semanticsVersion?: number;
}

export interface RecordReplaySnapshotEntry {
  name: string;
  snapshot: unknown;
}

interface Registered<T> {
  id: number;
  value: T;
}

let nextRegistrationId = 1;
const snapshotProviders: Array<Registered<RecordReplaySnapshotProvider>> = [];
const milestoneDetectors: Array<Registered<MilestoneDetector>> = [];
const playerPositionProviders: Array<Registered<() => RecordReplayPlayerPosition | null | undefined>> = [];
const inputAuthorityProviders: Array<Registered<RecordReplayInputAuthorityProvider>> = [];
const actionProviders: Array<Registered<RecordReplayActionProvider>> = [];
/** 帧间发生的动作缓冲;RecorderSource 在采集钩子逐帧 drain(未录制也 drain,防泄漏)。 */
const pendingActionNotifications: Array<{ id: string; params: Record<string, string | number> }> = [];
/** 现注册的观测语义版本(见 RegisterRecordReplayProvidersOptions.semanticsVersion)。 */
let providerSemanticsVersion: number | null = null;

export function getRecordReplayProviderSemanticsVersion(): number | null {
  return providerSemanticsVersion;
}

export function registerRecordReplayProviders(options: RegisterRecordReplayProvidersOptions): () => void {
  const id = nextRegistrationId++;
  if (typeof options.semanticsVersion === 'number' && Number.isFinite(options.semanticsVersion)) {
    providerSemanticsVersion = options.semanticsVersion;
  }
  for (const provider of options.snapshotProviders ?? []) {
    snapshotProviders.push({ id, value: provider });
  }
  for (const detector of options.milestoneDetectors ?? []) {
    milestoneDetectors.push({ id, value: detector });
  }
  if (options.playerPosition) {
    playerPositionProviders.push({ id, value: options.playerPosition });
  }
  if (options.inputAuthority) {
    inputAuthorityProviders.push({ id, value: options.inputAuthority });
  }
  for (const action of options.actions ?? []) {
    actionProviders.push({ id, value: action });
  }

  return () => {
    removeRegistered(snapshotProviders, id);
    removeRegistered(milestoneDetectors, id);
    removeRegistered(playerPositionProviders, id);
    removeRegistered(inputAuthorityProviders, id);
    removeRegistered(actionProviders, id);
  };
}

/**
 * 游戏在「执行选择的漏斗函数」里调用(人点击与回放 invoke 都过同一漏斗;
 * 录制未激活时最终被 drain 丢弃,无害)。
 */
export function notifyRecordReplayAction(id: string, params: Record<string, string | number>): void {
  const normalizedId = String(id ?? '').trim();
  if (!normalizedId) return;
  const cleaned: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) cleaned[key] = value;
  }
  pendingActionNotifications.push({ id: normalizedId, params: cleaned });
}

/** RecorderSource 每帧调用:取走缓冲(挂到当前帧,语义=本帧 update 前已生效)。 */
export function drainRecordReplayPendingActions(): Array<{ id: string; params: Record<string, string | number> }> {
  if (pendingActionNotifications.length === 0) return [];
  return pendingActionNotifications.splice(0, pendingActionNotifications.length);
}

export function readRecordReplayActionProviders(): RecordReplayActionProvider[] {
  return actionProviders.map((registered) => registered.value);
}

/**
 * 回放侧:在执行帧 N 的 update **之前**重演该帧记录的动作。
 * 未注册的 action id 抛错(宁可红,不可静默漂移)。
 */
export function applyRecordedFrameActions(
  frame: { actions?: Array<{ id: string; params: Record<string, string | number> }> } | undefined,
): void {
  const actions = frame?.actions;
  if (!actions || actions.length === 0) return;
  for (const action of actions) {
    const provider = actionProviders.find((registered) => registered.value.id === action.id)?.value;
    if (!provider) {
      throw new Error(`[record-replay] recorded action "${action.id}" has no registered provider — game must registerRecordReplayProviders({ actions: [...] }).`);
    }
    provider.invoke(action.params);
  }
}

export function clearRecordReplayProviders(): void {
  snapshotProviders.length = 0;
  milestoneDetectors.length = 0;
  playerPositionProviders.length = 0;
  inputAuthorityProviders.length = 0;
  actionProviders.length = 0;
  pendingActionNotifications.length = 0;
}

/**
 * 只要有**任何一个**注册方说「现在输入不算数」,就当作不算数 —— 锁是合取的。
 * 没有注册方时恒为 true(默认行为不变)。
 */
export function readRecordReplayInputAuthority(): boolean {
  for (const registered of inputAuthorityProviders) {
    try {
      if (registered.value() === false) return false;
    } catch (error) {
      console.warn('[record-replay] input authority provider failed:', error);
    }
  }
  return true;
}

/**
 * 注册方声明的豁免 fact key,已带 provider 名前缀(与 `readRecordReplayFactsFromSnapshots` 同一坐标系)。
 * 走注册表而不是快照 —— 快照进 hash,注册元数据不进。
 */
export function readRecordReplayObservationOnlyFactKeys(): string[] {
  const keys: string[] = [];
  for (const registered of snapshotProviders) {
    const declared = registered.value.observationOnlyFacts;
    if (!declared) continue;
    const name = normalizeProviderName(registered.value.name);
    for (const key of declared) {
      if (typeof key === 'string' && key.trim()) keys.push(`${name}.${key.trim()}`);
    }
  }
  return keys;
}

export function collectRecordReplaySnapshotEntries(): RecordReplaySnapshotEntry[] {
  const entries: RecordReplaySnapshotEntry[] = [];
  const nameCounts = new Map<string, number>();

  for (const registered of snapshotProviders) {
    const baseName = normalizeProviderName(registered.value.name);
    const count = nameCounts.get(baseName) ?? 0;
    nameCounts.set(baseName, count + 1);
    const name = count === 0 ? baseName : `${baseName}#${count + 1}`;
    entries.push({
      name,
      snapshot: safeGetProviderSnapshot(registered.value),
    });
  }

  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

export function readRecordReplayPlayerPosition(): RecordReplayPlayerPosition | null {
  for (let index = playerPositionProviders.length - 1; index >= 0; index -= 1) {
    const provider = playerPositionProviders[index]?.value;
    if (!provider) continue;
    try {
      const position = provider();
      if (isFinitePlayerPosition(position)) {
        return {
          x: position.x,
          y: typeof position.y === 'number' && Number.isFinite(position.y) ? position.y : 0,
          z: position.z,
        };
      }
    } catch (error) {
      console.warn('[record-replay] player position provider failed:', error);
    }
  }
  return null;
}

export function detectRecordReplayMilestones(
  previous: RecordReplayObservation,
  next: RecordReplayObservation,
): RecordReplayMilestoneEvent[] {
  const events: RecordReplayMilestoneEvent[] = [];
  for (const registered of milestoneDetectors) {
    try {
      for (const event of registered.value.detect(previous, next) ?? []) {
        if (!event || typeof event.kind !== 'string' || !event.kind.trim()) continue;
        events.push({
          ...event,
          kind: event.kind.trim(),
          detail: cloneMilestoneDetail(event.detail),
          economyAtGate: event.economyAtGate ? { ...event.economyAtGate } : undefined,
        });
      }
    } catch (error) {
      events.push({
        kind: 'custom',
        detail: {
          id: `${registered.value.kind}:detector-error`,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
  return events;
}

export function isRecordReplayMilestoneSatisfied(
  milestone: RecordReplayMilestoneEvent,
  observation: RecordReplayObservation,
): boolean {
  for (const registered of milestoneDetectors) {
    if (registered.value.kind !== milestone.kind || !registered.value.isSatisfied) continue;
    try {
      if (registered.value.isSatisfied(milestone, observation)) return true;
    } catch (error) {
      console.warn('[record-replay] milestone satisfaction detector failed:', error);
    }
  }
  return false;
}

/**
 * 该里程碑是不是主线因果链上的?注册的检测器声明优先,其次落到 kind 默认表。
 *
 * 同一 kind 注册了多个检测器时,**只要有一个说 critical 就是 critical** —— 分层宁严勿松,
 * 与 `readRecordReplayInputAuthority` 的「有一个说不算数就不算数」是同一种保守取向。
 */
export function isRecordReplayMilestoneCritical(milestone: Pick<RecordReplayMilestoneEvent, 'kind'>): boolean {
  const kind = String(milestone.kind ?? '').trim();
  let declared: boolean | null = null;
  for (const registered of milestoneDetectors) {
    if (registered.value.kind !== kind || typeof registered.value.critical !== 'boolean') continue;
    if (registered.value.critical) return true;
    declared = false;
  }
  if (declared !== null) return declared;
  return getDefaultRecordReplayMilestoneCriticality(kind);
}

/**
 * 强断言键校验(见 MilestoneDetector.strictDetailKeys)。
 * 只有该 kind 注册了强键、且**两侧 detail 都携带**该键时才比对;缺键=不约束(老 tape 兼容)。
 */
export function recordReplayMilestoneStrictKeysMatch(
  expected: Pick<RecordReplayMilestoneEvent, 'kind' | 'detail'>,
  actual: Pick<RecordReplayMilestoneEvent, 'kind' | 'detail'>,
): boolean {
  if (expected.kind !== actual.kind) return false;
  for (const registered of milestoneDetectors) {
    const detector = registered.value;
    if (detector.kind !== expected.kind || !detector.strictDetailKeys?.length) continue;
    for (const key of detector.strictDetailKeys) {
      const left = expected.detail?.[key];
      const right = actual.detail?.[key];
      if (left === undefined || right === undefined) continue;
      if (left !== right) return false;
    }
  }
  return true;
}

export function getRecordReplayMilestoneIdentity(
  milestone: Pick<RecordReplayMilestoneEvent, 'kind' | 'detail'>,
): string {
  for (const registered of milestoneDetectors) {
    if (registered.value.kind !== milestone.kind || !registered.value.getIdentity) continue;
    try {
      const identity = registered.value.getIdentity(milestone);
      if (identity) return `${milestone.kind}:${identity}`;
    } catch (error) {
      console.warn('[record-replay] milestone identity detector failed:', error);
    }
  }
  return `${milestone.kind}:${stableDetailIdentity(milestone.detail)}`;
}

export function readRecordReplayEconomyFromSnapshots(
  snapshots: Record<string, unknown>,
): RecordReplayEconomyState {
  let economy: RecordReplayEconomyState = { cash: 0, totalEarned: 0, totalSpent: 0 };
  for (const snapshot of Object.values(snapshots)) {
    const record = asRecord(snapshot);
    const candidate = asRecord(asRecord(record.recordReplay).economy);
    const direct = Object.keys(candidate).length > 0 ? candidate : asRecord(record.economy);
    if (Object.keys(direct).length <= 0) continue;
    economy = {
      cash: readFiniteNumber(direct.cash, economy.cash),
      totalEarned: readFiniteNumber(direct.totalEarned, economy.totalEarned),
      totalSpent: readFiniteNumber(direct.totalSpent, economy.totalSpent),
    };
  }
  return economy;
}

export function readRecordReplayFactsFromSnapshots(
  snapshots: Record<string, unknown>,
): Record<string, number | string | boolean> {
  const facts: Record<string, number | string | boolean> = {};
  for (const [providerName, snapshot] of Object.entries(snapshots)) {
    const record = asRecord(snapshot);
    const nestedFacts = asRecord(asRecord(record.recordReplay).facts);
    const directFacts = Object.keys(nestedFacts).length > 0 ? nestedFacts : asRecord(record.facts);
    for (const [key, value] of Object.entries(directFacts)) {
      if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
        facts[`${providerName}.${key}`] = value;
      }
    }
  }
  return facts;
}

function removeRegistered<T>(items: Array<Registered<T>>, id: number): void {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index]?.id === id) items.splice(index, 1);
  }
}

function normalizeProviderName(name: string): string {
  const normalized = String(name ?? '').trim();
  return normalized.length > 0 ? normalized : 'unnamed';
}

function safeGetProviderSnapshot(provider: RecordReplaySnapshotProvider): unknown {
  try {
    return provider.getSnapshot();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function isFinitePlayerPosition(value: unknown): value is RecordReplayPlayerPosition {
  const candidate = value as RecordReplayPlayerPosition | null | undefined;
  return typeof candidate?.x === 'number'
    && Number.isFinite(candidate.x)
    && typeof candidate.z === 'number'
    && Number.isFinite(candidate.z);
}

function cloneMilestoneDetail(detail: Record<string, number | string> | undefined): Record<string, number | string> {
  const clone: Record<string, number | string> = {};
  for (const [key, value] of Object.entries(detail ?? {})) {
    if (typeof value === 'number' || typeof value === 'string') clone[key] = value;
  }
  return clone;
}

function stableDetailIdentity(detail: Record<string, number | string>): string {
  return Object.keys(detail)
    .sort()
    .map((key) => `${key}=${String(detail[key])}`)
    .join('|');
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
