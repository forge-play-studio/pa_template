import type { GameplayModule } from '../gameplay';
import type { ProjectAreaConfig } from '../config/projectGameplayConfig';
import type { ZoneEvent, ZoneSystem } from './ZoneSystem';

export interface AreaSnapshot {
  activeAreaIds: string[];
  activeZoneIds: string[];
  debugBoundsVisible: boolean;
}

export class AreaSystem implements GameplayModule {
  private readonly activeZoneIds = new Set<string>();
  private readonly areaByZoneId = new Map<string, ProjectAreaConfig>();
  private debugBoundsVisible = false;
  private unsubscribeEnter: (() => void) | null = null;
  private unsubscribeLeave: (() => void) | null = null;

  constructor(
    areas: ProjectAreaConfig[],
    private readonly zoneSystem: ZoneSystem,
  ) {
    for (const area of areas) this.areaByZoneId.set(area.zoneId, { ...area });
  }

  init(): void {
    this.unsubscribeEnter = this.zoneSystem.onEnter((event) => this.handleEnter(event));
    this.unsubscribeLeave = this.zoneSystem.onLeave((event) => this.handleLeave(event));
  }

  isAreaActive(areaId: string): boolean {
    const area = [...this.areaByZoneId.values()].find((candidate) => candidate.id === areaId);
    return !!area && this.activeZoneIds.has(area.zoneId);
  }

  getAreasByCategory(category: ProjectAreaConfig['category']): ProjectAreaConfig[] {
    return [...this.areaByZoneId.values()].filter((area) => area.category === category);
  }

  getSnapshot(): AreaSnapshot {
    const activeAreaIds = [...this.activeZoneIds]
      .map((zoneId) => this.areaByZoneId.get(zoneId)?.id)
      .filter((areaId): areaId is string => !!areaId);
    return {
      activeAreaIds,
      activeZoneIds: [...this.activeZoneIds],
      debugBoundsVisible: this.debugBoundsVisible,
    };
  }

  getDebugBounds(): Array<{ areaId: string; zoneId: string; category: string; label: string }> {
    return [...this.areaByZoneId.values()].map((area) => ({
      areaId: area.id,
      zoneId: area.zoneId,
      category: area.category,
      label: area.debugLabel ?? area.id,
    }));
  }

  setDebugBoundsVisible(visible: boolean): AreaSnapshot {
    this.debugBoundsVisible = visible;
    return this.getSnapshot();
  }

  toggleDebugBounds(): AreaSnapshot {
    return this.setDebugBoundsVisible(!this.debugBoundsVisible);
  }

  dispose(): void {
    this.unsubscribeEnter?.();
    this.unsubscribeLeave?.();
    this.activeZoneIds.clear();
  }

  private handleEnter(event: ZoneEvent): void {
    if (event.actorId !== 'player') return;
    if (this.areaByZoneId.has(event.zoneId)) this.activeZoneIds.add(event.zoneId);
  }

  private handleLeave(event: ZoneEvent): void {
    if (event.actorId !== 'player') return;
    this.activeZoneIds.delete(event.zoneId);
  }
}
