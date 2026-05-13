const EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;
const INSPECTOR = '#babylon-inspector-container, #inspector-host';
const forwarded = new WeakSet<Event>();

const guard = { active: false, canvas: null as HTMLCanvasElement | null };

function isWithinCanvasViewport(e: PointerEvent | WheelEvent): boolean {
  const canvas = guard.canvas;
  if (!canvas) return false;
  if (e.target === canvas) return true;
  const rect = canvas.getBoundingClientRect();
  return e.clientX >= rect.left
    && e.clientX <= rect.right
    && e.clientY >= rect.top
    && e.clientY <= rect.bottom;
}

function isOutsideGame(target: EventTarget | null): boolean {
  const container = guard.canvas?.parentElement;
  if (!container || !target) return false;
  return !container.contains(target as Node);
}

function handler(e: PointerEvent): void {
  if (!guard.active) return;
  if (forwarded.has(e)) return;

  if ((e.target as Element)?.closest?.(INSPECTOR)) return;
  if (isOutsideGame(e.target)) return;

  if (guard.canvas && isWithinCanvasViewport(e)) {
    e.stopImmediatePropagation();
    const clone = new PointerEvent(e.type, e);
    forwarded.add(clone);
    guard.canvas.dispatchEvent(clone);
    return;
  }

  e.stopImmediatePropagation();
  e.preventDefault();
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  for (const type of EVENTS) {
    document.addEventListener(type, handler, true);
  }

  document.addEventListener('wheel', (e) => {
    if (!guard.active) return;
    if ((e.target as Element)?.closest?.(INSPECTOR)) return;
    if (isOutsideGame(e.target)) return;
    if (guard.canvas && isWithinCanvasViewport(e)) return;
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);

  for (const type of ['keydown', 'keyup'] as const) {
    window.addEventListener(type, (e) => {
      if (!guard.active) return;
      if ((e.target as Element)?.closest?.(INSPECTOR)) return;
      if (isOutsideGame(e.target)) return;
      if (guard.canvas && e.target === guard.canvas) return;
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
  }
}

export function activateProjectEventGuard(canvas: HTMLCanvasElement): void {
  guard.canvas = canvas;
  guard.active = true;
}

export function deactivateProjectEventGuard(): void {
  guard.active = false;
  guard.canvas = null;
}

