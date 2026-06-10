import type { GameplayModule } from '../gameplay';

export interface GameplayBlocker {
  type: 'doc' | 'binding' | 'asset' | 'verification' | 'implementation';
  id: string;
  message: string;
}

export interface GameplayStateSnapshot {
  stage: string;
  milestones: string[];
  completedUpgrades: string[];
  blockers: GameplayBlocker[];
  complete: boolean;
}

type Listener = (snapshot: GameplayStateSnapshot) => void;

export class GameplayStateSystem implements GameplayModule {
  private stage = 'bootstrap';
  private complete = false;
  private readonly milestones = new Set<string>();
  private readonly completedUpgrades = new Set<string>();
  private blockers: GameplayBlocker[] = [];
  private readonly listeners = new Set<Listener>();

  init(): void {}

  setStage(stage: string): void {
    if (this.stage === stage) return;
    this.stage = stage;
    this.emit();
  }

  getStage(): string {
    return this.stage;
  }

  markMilestone(id: string): void {
    if (this.milestones.has(id)) return;
    this.milestones.add(id);
    this.emit();
  }

  hasMilestone(id: string): boolean {
    return this.milestones.has(id);
  }

  completeUpgrade(id: string): void {
    if (this.completedUpgrades.has(id)) return;
    this.completedUpgrades.add(id);
    this.emit();
  }

  isUpgradeComplete(id: string): boolean {
    return this.completedUpgrades.has(id);
  }

  setComplete(complete = true): void {
    if (this.complete === complete) return;
    this.complete = complete;
    if (complete) this.stage = 'complete';
    this.emit();
  }

  isComplete(): boolean {
    return this.complete;
  }

  setBlockers(blockers: GameplayBlocker[]): void {
    this.blockers = blockers.map((blocker) => ({ ...blocker }));
    this.emit();
  }

  getSnapshot(): GameplayStateSnapshot {
    return {
      stage: this.stage,
      milestones: [...this.milestones],
      completedUpgrades: [...this.completedUpgrades],
      blockers: this.blockers.map((blocker) => ({ ...blocker })),
      complete: this.complete,
    };
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
