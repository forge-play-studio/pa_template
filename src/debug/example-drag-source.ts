import type { MovementInputSource, MovementInputState } from '../services/InputService';
import { normalizeMovementInput } from './record-replay/schema';

export interface ExampleDragSourceOptions {
  getFrameIndex: () => number;
}

/**
 * DEV-only scripted movement source for record-replay self tests.
 * Real projects should replace this with their own touch/joystick/AI source.
 */
export function createExampleDragSource(options: ExampleDragSourceOptions): MovementInputSource {
  return {
    getInput(): Readonly<MovementInputState> {
      const frame = options.getFrameIndex();
      if (frame < 30) return normalizeMovementInput({ x: 1, y: 0.15, magnitude: 1, isActive: true });
      if (frame < 60) return normalizeMovementInput({ x: 0.2, y: 1, magnitude: 0.85, isActive: true });
      if (frame < 90) return normalizeMovementInput({ x: -0.85, y: 0.25, magnitude: 0.9, isActive: true });
      if (frame < 120) return normalizeMovementInput({ x: 0, y: -1, magnitude: 0.7, isActive: true });
      return normalizeMovementInput({ x: 0, y: 0, magnitude: 0, isActive: false });
    },
  };
}
