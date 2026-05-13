export type ProjectEditorTool = 'pick' | 'move' | 'rotate' | 'scale';

interface ProjectEditorInputOptions {
  getCanvas: () => HTMLCanvasElement | null;
  isEditActive: () => boolean;
  onSetTool: (tool: ProjectEditorTool) => void;
  onFocusSelected: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDuplicateSelected?: () => void | Promise<void>;
}

const TOOL_KEYS: Record<string, ProjectEditorTool> = {
  q: 'pick',
  w: 'move',
  e: 'rotate',
  r: 'scale',
};

const VIEWPORT_MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e']);
const VIEWPORT_DRAG_THRESHOLD_PX = 4;

function isTextEditingTarget(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function navigationButtonFromPointer(button: number): 'left' | 'middle' | 'right' | null {
  if (button === 0) return 'left';
  if (button === 1) return 'middle';
  if (button === 2) return 'right';
  return null;
}

export const ProjectEditorInput = {
  _options: null as ProjectEditorInputOptions | null,
  _initialized: false,
  _viewportNavigationActive: false,
  _viewportNavigationButton: null as 'left' | 'middle' | 'right' | null,
  _viewportPointerStart: null as { x: number; y: number } | null,
  _lastViewportPointer: null as { x: number; y: number } | null,
  _viewportPointerDragActive: false,
  _viewportPointerDelta: { dx: 0, dy: 0 },
  _pressedViewportKeys: new Set<string>(),
  _onKeyDown: null as ((e: KeyboardEvent) => void) | null,
  _onKeyUp: null as ((e: KeyboardEvent) => void) | null,
  _onPointerDown: null as ((e: PointerEvent) => void) | null,
  _onPointerMove: null as ((e: PointerEvent) => void) | null,
  _onPointerUp: null as ((e: PointerEvent) => void) | null,
  _onBlur: null as (() => void) | null,

  init(options: ProjectEditorInputOptions): void {
    this.dispose();
    this._options = options;

    this._onKeyDown = (e: KeyboardEvent) => {
      if (!this._options?.isEditActive()) return;
      if (isTextEditingTarget(e.target)) return;

      const key = e.key.toLowerCase();
      const primaryModifier = e.ctrlKey || e.metaKey;

      if (primaryModifier && !e.altKey && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this._options.onRedo?.();
        } else {
          this._options.onUndo?.();
        }
        return;
      }

      if (primaryModifier && !e.altKey && !e.shiftKey && key === 'd') {
        e.preventDefault();
        void this._options.onDuplicateSelected?.();
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && key === 'f') {
        e.preventDefault();
        this._options.onFocusSelected();
        return;
      }

      if (this._viewportNavigationActive && VIEWPORT_MOVE_KEYS.has(key)) {
        this._pressedViewportKeys.add(key);
        e.preventDefault();
        return;
      }

      if (this._viewportNavigationActive) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

      const tool = TOOL_KEYS[key];
      if (!tool) return;
      e.preventDefault();
      this._options.onSetTool(tool);
    };

    this._onKeyUp = (e: KeyboardEvent) => {
      if (!this._options?.isEditActive()) return;
      this._pressedViewportKeys.delete(e.key.toLowerCase());
    };

    this._onPointerDown = (e: PointerEvent) => {
      if (!this._options?.isEditActive()) return;
      const canvas = this._options.getCanvas();
      if (!canvas) return;
      const navButton = navigationButtonFromPointer(e.button);
      if (e.target === canvas && navButton && navButton !== 'left') {
        this._viewportNavigationActive = true;
        this._viewportNavigationButton = navButton;
        this._viewportPointerStart = { x: e.clientX, y: e.clientY };
        this._lastViewportPointer = { x: e.clientX, y: e.clientY };
        this._viewportPointerDragActive = false;
      }
    };

    this._onPointerMove = (e: PointerEvent) => {
      if (!this._options?.isEditActive()) return;
      if (!this._viewportNavigationActive || !this._viewportNavigationButton) return;
      if (!this._lastViewportPointer) {
        this._lastViewportPointer = { x: e.clientX, y: e.clientY };
        return;
      }
      const dx = e.clientX - this._lastViewportPointer.x;
      const dy = e.clientY - this._lastViewportPointer.y;
      if ((this._viewportNavigationButton === 'left' || this._viewportNavigationButton === 'middle')
        && !this._viewportPointerDragActive) {
        const start = this._viewportPointerStart || this._lastViewportPointer;
        const totalDx = e.clientX - start.x;
        const totalDy = e.clientY - start.y;
        if (Math.hypot(totalDx, totalDy) < VIEWPORT_DRAG_THRESHOLD_PX) {
          this._lastViewportPointer = { x: e.clientX, y: e.clientY };
          return;
        }
        this._viewportPointerDragActive = true;
        this._lastViewportPointer = { x: e.clientX, y: e.clientY };
        return;
      }
      this._viewportPointerDelta.dx += dx;
      this._viewportPointerDelta.dy += dy;
      this._lastViewportPointer = { x: e.clientX, y: e.clientY };
    };

    this._onPointerUp = (e: PointerEvent) => {
      if (!this._options?.isEditActive()) return;
      const navButton = navigationButtonFromPointer(e.button);
      if (!navButton || navButton !== this._viewportNavigationButton) return;
      this.resetViewportNavigation();
    };

    this._onBlur = () => {
      this.resetViewportNavigation();
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('pointerdown', this._onPointerDown, true);
    window.addEventListener('pointermove', this._onPointerMove, true);
    window.addEventListener('pointerup', this._onPointerUp, true);
    window.addEventListener('blur', this._onBlur);
    this._initialized = true;
  },

  dispose(): void {
    if (!this._initialized) return;
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    if (this._onKeyUp) window.removeEventListener('keyup', this._onKeyUp);
    if (this._onPointerDown) window.removeEventListener('pointerdown', this._onPointerDown, true);
    if (this._onPointerMove) window.removeEventListener('pointermove', this._onPointerMove, true);
    if (this._onPointerUp) window.removeEventListener('pointerup', this._onPointerUp, true);
    if (this._onBlur) window.removeEventListener('blur', this._onBlur);
    this._initialized = false;
    this._options = null;
    this._onKeyDown = null;
    this._onKeyUp = null;
    this._onPointerDown = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
    this._onBlur = null;
    this.resetViewportNavigation();
  },

  isViewportNavigationActive(): boolean {
    return this._viewportNavigationActive;
  },

  activeViewportNavigationButton(): 'left' | 'middle' | 'right' | null {
    return this._viewportNavigationButton;
  },

  consumeViewportPointerDelta(): { dx: number; dy: number } {
    const delta = { ...this._viewportPointerDelta };
    this._viewportPointerDelta.dx = 0;
    this._viewportPointerDelta.dy = 0;
    return delta;
  },

  pressedViewportMovementKeys(): Set<string> {
    return this._pressedViewportKeys;
  },

  resetViewportNavigation(): void {
    this._viewportNavigationActive = false;
    this._viewportNavigationButton = null;
    this._viewportPointerStart = null;
    this._lastViewportPointer = null;
    this._viewportPointerDragActive = false;
    this._viewportPointerDelta.dx = 0;
    this._viewportPointerDelta.dy = 0;
    this._pressedViewportKeys.clear();
  },
};
