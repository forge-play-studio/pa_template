/**
 * 录制期通用点按捕获 —— 决策点接线的**缺口探测器**(只侦察,不回放)。
 *
 * 背景:点击式决策(选卡/确认门)必须由游戏侧三段接线(漏斗 → notifyRecordReplayAction →
 * ActionProvider)才能进 tape;漏接**零报错**,回放卡死才暴露(train_oil 升级门实证,2026-07-13)。
 * 本模块在录制期挂 document 级监听,把"短促点按"(非摇杆拖动)按帧记下 → 准入审计比对
 * 「点按数 vs 语义动作数」,缺口当场点名,而不是等回放卡死后猜。
 *
 * 判据:pointerdown→pointerup 间隔 < 350ms 且位移 < 10px = 点按(摇杆拖动是长时移动手势,
 * 天然排除);落在 debug UI 上的点按不算(录制胶囊 Stop 键等)。
 * 坐标不入 tape ——只记帧号:探测器要回答的是"漏了几次、漏在何时",不是"点在哪"。
 */

export interface RecordedPointerTap {
  frame: number;
}

export interface RecordingPointerCaptureOptions {
  /** 返回当前录制相对帧号(点按发生时挂到哪一帧)。 */
  getFrame: () => number;
  /** 额外的 debug UI 选择器(与内建集合并;点在这些容器内的点按不计)。 */
  extraDebugSelectors?: readonly string[];
}

const BUILTIN_DEBUG_SELECTORS = [
  '#rr-demo-hud',
  '#debug-hud',
  '#debug-panel-framework-root',
  '[data-debug-panel]',
  '[data-debug-panel-id]',
  '[data-runtime-debug-panel-container]',
];

const TAP_MAX_DURATION_MS = 350;
const TAP_MAX_TRAVEL_PX = 10;

export function installRecordingPointerCapture(
  options: RecordingPointerCaptureOptions,
): { readTaps(): RecordedPointerTap[]; dispose(): void } {
  const taps: RecordedPointerTap[] = [];
  const debugSelector = [...BUILTIN_DEBUG_SELECTORS, ...(options.extraDebugSelectors ?? [])].join(', ');
  let down: { x: number; y: number; at: number; frame: number; onDebugUi: boolean } | null = null;

  const isDebugTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    try {
      return target.closest(debugSelector) !== null;
    } catch {
      return false;
    }
  };

  const onPointerDown = (event: PointerEvent): void => {
    down = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
      frame: Math.max(0, Math.floor(options.getFrame())),
      onDebugUi: isDebugTarget(event.target),
    };
  };
  const onPointerUp = (event: PointerEvent): void => {
    const start = down;
    down = null;
    if (!start || start.onDebugUi) return;
    if (performance.now() - start.at > TAP_MAX_DURATION_MS) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_MAX_TRAVEL_PX) return;
    taps.push({ frame: start.frame });
  };

  // capture 阶段监听:UI 层常在 handler 里 stopPropagation,冒泡阶段会漏(这正是要侦察的对象)。
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', onPointerUp, true);

  return {
    readTaps: () => taps.map((tap) => ({ ...tap })),
    dispose: () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
    },
  };
}
