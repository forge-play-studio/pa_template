import type { GameplayModule } from '../gameplay';

export interface EconomySnapshot {
  ready: boolean;
}

export class EconomySystem implements GameplayModule {
  private ready = false;

  init(): void {
    this.ready = true;
  }

  getSnapshot(): EconomySnapshot {
    return { ready: this.ready };
  }

  dispose(): void {
    this.ready = false;
  }
}
