import type { GameplayModule } from '../gameplay';

export interface InventoryChangeEvent {
  containerId: string;
  resourceId: string;
  amount: number;
  delta: number;
  reason?: string;
}

export interface InventoryContainerConfig {
  id: string;
  capacityByResource?: Record<string, number | null>;
}

interface ContainerState {
  resources: Map<string, number>;
  capacityByResource: Map<string, number | null>;
}

type Listener = (event: InventoryChangeEvent) => void;

export class InventorySystem implements GameplayModule {
  private readonly containers = new Map<string, ContainerState>();
  private readonly listeners = new Set<Listener>();

  constructor(configs: InventoryContainerConfig[] = []) {
    for (const config of configs) this.configureContainer(config);
  }

  init(): void {}

  configureContainer(config: InventoryContainerConfig): void {
    const container = this.ensureContainer(config.id);
    for (const [resourceId, capacity] of Object.entries(config.capacityByResource ?? {})) {
      container.capacityByResource.set(resourceId, normalizeCapacity(capacity));
    }
  }

  getAmount(containerId: string, resourceId: string): number {
    return this.containers.get(containerId)?.resources.get(resourceId) ?? 0;
  }

  getSnapshot(containerId: string): Record<string, number> {
    const container = this.containers.get(containerId);
    if (!container) return {};
    return Object.fromEntries(container.resources);
  }

  getAvailableCapacity(containerId: string, resourceId: string): number {
    const container = this.ensureContainer(containerId);
    const capacity = container.capacityByResource.get(resourceId) ?? null;
    if (capacity === null) return Number.POSITIVE_INFINITY;
    return Math.max(0, capacity - this.getAmount(containerId, resourceId));
  }

  add(containerId: string, resourceId: string, amount: number, reason?: string): number {
    const requested = Math.max(0, Math.floor(amount));
    if (requested <= 0) return 0;
    const accepted = Math.min(requested, this.getAvailableCapacity(containerId, resourceId));
    if (accepted <= 0) return 0;
    const next = this.getAmount(containerId, resourceId) + accepted;
    this.setAmount(containerId, resourceId, next, reason);
    return accepted;
  }

  removeUpTo(containerId: string, resourceId: string, amount: number, reason?: string): number {
    const removed = Math.min(Math.max(0, Math.floor(amount)), this.getAmount(containerId, resourceId));
    if (removed <= 0) return 0;
    this.setAmount(containerId, resourceId, this.getAmount(containerId, resourceId) - removed, reason);
    return removed;
  }

  clear(containerId: string, reason?: string): void {
    const snapshot = this.getSnapshot(containerId);
    for (const [resourceId, amount] of Object.entries(snapshot)) {
      if (amount > 0) this.removeUpTo(containerId, resourceId, amount, reason);
    }
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
    this.containers.clear();
  }

  private ensureContainer(containerId: string): ContainerState {
    let container = this.containers.get(containerId);
    if (!container) {
      container = { resources: new Map(), capacityByResource: new Map() };
      this.containers.set(containerId, container);
    }
    return container;
  }

  private setAmount(containerId: string, resourceId: string, amount: number, reason?: string): void {
    const container = this.ensureContainer(containerId);
    const previous = container.resources.get(resourceId) ?? 0;
    const next = Math.max(0, Math.floor(amount));
    if (previous === next) return;
    container.resources.set(resourceId, next);
    const event = { containerId, resourceId, amount: next, delta: next - previous, reason };
    for (const listener of this.listeners) listener(event);
  }
}

function normalizeCapacity(capacity: number | null | undefined): number | null {
  if (capacity == null || !Number.isFinite(capacity)) return null;
  return Math.max(0, Math.floor(capacity));
}
