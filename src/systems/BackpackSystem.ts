import type { GameplayModule } from '../gameplay';
import type { ProjectBackpackConfig } from '../config/projectGameplayConfig';
import type { InventoryChangeEvent, InventorySystem } from './InventorySystem';

export interface BackpackSnapshot {
  containerId: string;
  resources: Record<string, number>;
}

type Listener = (snapshot: BackpackSnapshot) => void;

export class BackpackSystem implements GameplayModule {
  private readonly listeners = new Set<Listener>();
  private unsubscribeInventory: (() => void) | null = null;

  constructor(
    private readonly config: ProjectBackpackConfig,
    private readonly inventory: InventorySystem,
  ) {}

  init(): void {
    this.inventory.configureContainer({
      id: this.config.containerId,
      capacityByResource: this.config.capacityByResource,
    });
    this.unsubscribeInventory = this.inventory.onChange((event) => this.handleInventoryChange(event));
  }

  getSnapshot(): BackpackSnapshot {
    return {
      containerId: this.config.containerId,
      resources: this.inventory.getSnapshot(this.config.containerId),
    };
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.unsubscribeInventory?.();
    this.listeners.clear();
  }

  private handleInventoryChange(event: InventoryChangeEvent): void {
    if (event.containerId !== this.config.containerId) return;
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
