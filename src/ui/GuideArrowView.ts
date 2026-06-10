import type { GameplayModule } from '../gameplay';
import type { GuideSystem } from '../systems/GuideSystem';

export class GuideArrowView implements GameplayModule {
  private element: HTMLDivElement | null = null;

  constructor(private readonly guide: GuideSystem) {}

  init(): void {
    if (typeof document === 'undefined') return;
    const element = document.createElement('div');
    element.style.cssText = [
      'position:fixed',
      'left:50%',
      'top:18%',
      'width:0',
      'height:0',
      'border-left:12px solid transparent',
      'border-right:12px solid transparent',
      'border-bottom:28px solid rgba(255,222,89,.92)',
      'filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))',
      'transform-origin:50% 70%',
      'z-index:20',
      'display:none',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(element);
    this.element = element;
  }

  update(): void {
    if (!this.element) return;
    const snapshot = this.guide.getSnapshot();
    if (!snapshot.visible || !snapshot.sourcePosition || !snapshot.targetPosition) {
      this.element.style.display = 'none';
      return;
    }
    const delta = snapshot.targetPosition.subtract(snapshot.sourcePosition);
    const angle = Math.atan2(delta.x, delta.z);
    this.element.style.display = 'block';
    this.element.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
  }

  dispose(): void {
    this.element?.remove();
    this.element = null;
  }
}
