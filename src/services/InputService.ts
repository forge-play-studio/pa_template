export interface MovementInputState {
  /** 屏幕横向输入：负值表示屏幕左，正值表示屏幕右；不是世界坐标 X。 */
  x: number;
  /** 屏幕纵向输入：负值表示屏幕后，正值表示屏幕前；不是世界坐标 Z。 */
  y: number;
  magnitude: number;
  isActive: boolean;
}

export interface MovementInputSource {
  getInput(): Readonly<MovementInputState>;
}

const IDLE_MOVEMENT_INPUT: Readonly<MovementInputState> = Object.freeze({
  x: 0,
  y: 0,
  magnitude: 0,
  isActive: false,
});

export class InputService implements MovementInputSource {
  private movementSource: MovementInputSource | null = null;
  private enabled = true;

  setMovementSource(source: MovementInputSource | null): void {
    this.movementSource = source;
  }

  getMovementSource(): MovementInputSource | null {
    return this.movementSource;
  }

  clearMovementSource(): void {
    this.movementSource = null;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getInput(): Readonly<MovementInputState> {
    if (!this.enabled) return IDLE_MOVEMENT_INPUT;
    return this.movementSource?.getInput() ?? IDLE_MOVEMENT_INPUT;
  }

  dispose(): void {
    this.movementSource = null;
    this.enabled = false;
  }
}
