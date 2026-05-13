export interface MovementInputState {
  x: number;
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
