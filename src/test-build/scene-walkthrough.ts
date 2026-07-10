import type { Game } from '../core/Game';
import type { MovementInputSource, MovementInputState } from '../services';

const WALKTHROUGH_BUILD_ATTRIBUTE = 'data-scene-walkthrough-build';
const WALKTHROUGH_BUILD_VALUE = 'wasd';
const WALKTHROUGH_KEYS = new Set(['w', 'a', 's', 'd']);

export interface SceneWalkthroughHandle {
  dispose(): void;
}

/**
 * Test-build-only input for walking the template's SimplePlayer through a scene.
 *
 * This module must only be dynamically imported behind
 * __SCENE_WALKTHROUGH_BUILD__, so regular dev and release bundles do not mount
 * keyboard listeners or include this test control path.
 */
export function mountSceneWalkthrough(game: Game): SceneWalkthroughHandle {
  const inputService = game.getInputService();
  if (!inputService) return { dispose() {} };

  const input = new KeyboardWalkthroughInput(window, document);
  inputService.setMovementSource(input);
  document.body?.setAttribute(WALKTHROUGH_BUILD_ATTRIBUTE, WALKTHROUGH_BUILD_VALUE);
  console.info('[SceneWalkthrough] WASD movement is enabled for this test build.');

  return {
    dispose() {
      inputService.clearMovementSource();
      input.dispose();
      if (document.body?.getAttribute(WALKTHROUGH_BUILD_ATTRIBUTE) === WALKTHROUGH_BUILD_VALUE) {
        document.body.removeAttribute(WALKTHROUGH_BUILD_ATTRIBUTE);
      }
    },
  };
}

class KeyboardWalkthroughInput implements MovementInputSource {
  private readonly pressedKeys = new Set<string>();
  private readonly input: MovementInputState = { x: 0, y: 0, magnitude: 0, isActive: false };

  constructor(
    private readonly ownerWindow: Window,
    private readonly ownerDocument: Document,
  ) {
    ownerWindow.addEventListener('keydown', this.handleKeyDown, { capture: true });
    ownerWindow.addEventListener('keyup', this.handleKeyUp, { capture: true });
    ownerWindow.addEventListener('blur', this.clearPressedKeys);
    ownerDocument.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  getInput(): Readonly<MovementInputState> {
    const x = (this.pressedKeys.has('d') ? 1 : 0) - (this.pressedKeys.has('a') ? 1 : 0);
    const y = (this.pressedKeys.has('w') ? 1 : 0) - (this.pressedKeys.has('s') ? 1 : 0);
    const magnitude = Math.hypot(x, y);
    if (magnitude === 0) {
      this.input.x = 0;
      this.input.y = 0;
      this.input.magnitude = 0;
      this.input.isActive = false;
      return this.input;
    }

    this.input.x = x / magnitude;
    this.input.y = y / magnitude;
    this.input.magnitude = 1;
    this.input.isActive = true;
    return this.input;
  }

  dispose(): void {
    this.ownerWindow.removeEventListener('keydown', this.handleKeyDown, { capture: true });
    this.ownerWindow.removeEventListener('keyup', this.handleKeyUp, { capture: true });
    this.ownerWindow.removeEventListener('blur', this.clearPressedKeys);
    this.ownerDocument.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.clearPressedKeys();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!WALKTHROUGH_KEYS.has(key) || isEditableTarget(event.target)) return;
    this.pressedKeys.add(key);
    event.preventDefault();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (!WALKTHROUGH_KEYS.has(key)) return;
    this.pressedKeys.delete(key);
    if (!isEditableTarget(event.target)) event.preventDefault();
  };

  private readonly handleVisibilityChange = (): void => {
    if (this.ownerDocument.visibilityState !== 'visible') this.clearPressedKeys();
  };

  private readonly clearPressedKeys = (): void => {
    this.pressedKeys.clear();
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement;
}
