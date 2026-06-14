import type { GameplayModule } from '../gameplay';
import type { ProjectBackpackConfig } from '../config/projectGameplayConfig';
import type { InventoryChangeEvent, InventorySystem } from './InventorySystem';
import type { ResourcesSystem } from './ResourcesSystem';

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
    private readonly resources: ResourcesSystem,
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

  add(resourceId: string, amount: number, reason?: string): number {
    return this.inventory.add(this.config.containerId, resourceId, amount, reason);
  }

  removeUpTo(resourceId: string, amount: number, reason?: string): number {
    return this.inventory.removeUpTo(this.config.containerId, resourceId, amount, reason);
  }

  clear(reason?: string): void {
    this.inventory.clear(this.config.containerId, reason);
  }

  fillForPreview(resourceId: string | null, amount: number, reason = 'debug_preview'): BackpackSnapshot {
    const resolvedResourceId = resourceId
      ?? this.resources.getBackpackResourceIds()[0]
      ?? this.resources.getResourceIds()[0]
      ?? 'debug_resource';
    this.add(resolvedResourceId, amount, reason);
    return this.getSnapshot();
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
