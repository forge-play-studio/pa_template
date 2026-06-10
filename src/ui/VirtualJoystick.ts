import type { GameplayModule } from '../gameplay';
import type { MovementInputSource, MovementInputState } from '../services';

export class VirtualJoystick implements GameplayModule, MovementInputSource {
  private root: HTMLDivElement | null = null;
  private knob: HTMLDivElement | null = null;
  private pointerId: number | null = null;
  private centerX = 0;
  private centerY = 0;
  private state: MovementInputState = { x: 0, y: 0, magnitude: 0, isActive: false };

  init(): void {
    if (typeof document === 'undefined') return;
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed',
      'left:22px',
      'bottom:22px',
      'width:112px',
      'height:112px',
      'border-radius:999px',
      'background:rgba(15,23,42,.22)',
      'border:1px solid rgba(255,255,255,.22)',
      'touch-action:none',
      'z-index:20',
    ].join(';');
    const knob = document.createElement('div');
    knob.style.cssText = [
      'position:absolute',
      'left:36px',
      'top:36px',
      'width:40px',
      'height:40px',
      'border-radius:999px',
      'background:rgba(255,255,255,.72)',
      'box-shadow:0 8px 24px rgba(0,0,0,.28)',
      'pointer-events:none',
    ].join(';');
    root.appendChild(knob);
    root.addEventListener('pointerdown', this.handlePointerDown);
    root.addEventListener('pointermove', this.handlePointerMove);
    root.addEventListener('pointerup', this.handlePointerUp);
    root.addEventListener('pointercancel', this.handlePointerUp);
    document.body.appendChild(root);
    this.root = root;
    this.knob = knob;
  }

  getInput(): Readonly<MovementInputState> {
    return this.state;
  }

  dispose(): void {
    if (this.root) {
      this.root.removeEventListener('pointerdown', this.handlePointerDown);
      this.root.removeEventListener('pointermove', this.handlePointerMove);
      this.root.removeEventListener('pointerup', this.handlePointerUp);
      this.root.removeEventListener('pointercancel', this.handlePointerUp);
      this.root.remove();
    }
    this.root = null;
    this.knob = null;
    this.pointerId = null;
    this.state = { x: 0, y: 0, magnitude: 0, isActive: false };
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.root) return;
    this.pointerId = event.pointerId;
    this.root.setPointerCapture(event.pointerId);
    const rect = this.root.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.updateFromPointer(event);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.updateFromPointer(event);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.state = { x: 0, y: 0, magnitude: 0, isActive: false };
    this.moveKnob(0, 0);
  };

  private updateFromPointer(event: PointerEvent): void {
    const maxDistance = 42;
    const dx = event.clientX - this.centerX;
    const dy = event.clientY - this.centerY;
    const distance = Math.min(maxDistance, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    const magnitude = distance / maxDistance;
    this.state = {
      x: x / maxDistance,
      y: -y / maxDistance,
      magnitude,
      isActive: magnitude > 0.05,
    };
    this.moveKnob(x, y);
  }

  private moveKnob(x: number, y: number): void {
    if (!this.knob) return;
    this.knob.style.transform = `translate(${x}px, ${y}px)`;
  }
}
