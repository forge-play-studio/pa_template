import type { GameplayModule } from '../gameplay';
import type { DebugActionRegistry } from '../services';
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
  private unregisterFill: (() => void) | null = null;
  private unregisterClear: (() => void) | null = null;
  private unsubscribeInventory: (() => void) | null = null;

  constructor(
    private readonly config: ProjectBackpackConfig,
    private readonly inventory: InventorySystem,
    private readonly resources: ResourcesSystem,
    private readonly debugActions: DebugActionRegistry,
    private readonly debugFillAmount: number,
  ) {}

  init(): void {
    this.inventory.configureContainer({
      id: this.config.containerId,
      capacityByResource: this.config.capacityByResource,
    });
    this.unsubscribeInventory = this.inventory.onChange((event) => this.handleInventoryChange(event));
    this.unregisterFill = this.debugActions.register({
      id: 'backpack.fill',
      label: 'Fill backpack',
      run: ({ payload }) => this.debugFill(payload),
    });
    this.unregisterClear = this.debugActions.register({
      id: 'backpack.clear',
      label: 'Clear backpack',
      run: () => {
        this.clear('debug');
        return { ok: true, snapshot: this.getSnapshot() };
      },
    });
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

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.unregisterFill?.();
    this.unregisterClear?.();
    this.unsubscribeInventory?.();
    this.listeners.clear();
  }

  private debugFill(payload: unknown): { ok: boolean; snapshot: BackpackSnapshot; message?: string } {
    const data = isRecord(payload) ? payload : {};
    const resourceId = typeof data.resourceId === 'string'
      ? data.resourceId
      : this.resources.getBackpackResourceIds()[0] ?? this.resources.getResourceIds()[0] ?? 'debug_resource';
    const amount = typeof data.amount === 'number' ? data.amount : this.debugFillAmount;
    this.add(resourceId, amount, 'debug');
    return { ok: true, snapshot: this.getSnapshot() };
  }

  private handleInventoryChange(event: InventoryChangeEvent): void {
    if (event.containerId !== this.config.containerId) return;
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
