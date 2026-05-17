import sceneConfigJson from '../config/scene.json';
import type { SceneConfig, SceneZoneConfig } from '../config';
import type { BaseSystem } from './BaseSystem';

export type ZonePhase = 'enter' | 'tick' | 'leave';

export interface ZonePoint {
  x: number;
  z: number;
}

export interface ZoneActor {
  id: string;
  position: ZonePoint;
  radius?: number;
  enabled?: boolean;
}

export interface ZoneConfig {
  id: string;
  location: ZonePoint;
  size: {
    width: number;
    depth: number;
  };
  rotationDeg?: number;
  meta?: string;
}

export interface ZoneEvent {
  phase: ZonePhase;
  zoneId: string;
  actorId: string;
  stayTimeSec: number;
  deltaTimeSec: number;
  zone: ZoneConfig;
}

export type ZoneListener = (event: ZoneEvent) => void;

export interface ZonePlayerLike {
  position: { x: number; z: number };
  radius?: number;
}

export interface ZoneSystemOptions {
  getPlayer?: () => ZonePlayerLike | null;
  getActors?: () => ZoneActor[];
}

interface ZoneState {
  inside: boolean;
  stayTimeSec: number;
}

const DEFAULT_PLAYER_RADIUS = 0.35;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

export class ZoneSystem implements BaseSystem {
  private readonly getPlayer: () => ZonePlayerLike | null;
  private actorProvider: (() => ZoneActor[]) | null;

  private zones: ZoneConfig[] = [];
  private enterListeners: ZoneListener[] = [];
  private tickListeners: ZoneListener[] = [];
  private leaveListeners: ZoneListener[] = [];
  private state = new Map<string, ZoneState>();

  constructor(options: ZoneSystemOptions = {}) {
    this.getPlayer = options.getPlayer ?? (() => null);
    this.actorProvider = options.getActors ?? null;
    this.reloadFromSceneConfig();
  }

  reloadFromSceneConfig(sceneConfig: SceneConfig = sceneConfigJson as SceneConfig): void {
    this.zones = this.resolveRuntimeZones(sceneConfig);
    this.reset();
  }

  update(deltaTime: number): void {
    const actors = this.getActors();
    if (actors.length === 0) {
      this.leaveAllActive();
      return;
    }

    const activeKeys = new Set<string>();

    for (const zone of this.zones) {
      for (const actor of actors) {
        if (actor.enabled === false) continue;

        const stateKey = this.getStateKey(zone.id, actor.id);
        activeKeys.add(stateKey);

        const isInside = this.checkCollision(zone, actor);
        const current = this.state.get(stateKey) ?? { inside: false, stayTimeSec: 0 };

        if (isInside) {
          const stayTimeSec = current.inside ? current.stayTimeSec + deltaTime : 0;
          this.state.set(stateKey, { inside: true, stayTimeSec });

          if (!current.inside) {
            this.emit(this.enterListeners, 'enter', zone, actor.id, 0, 0);
          }

          this.emit(this.tickListeners, 'tick', zone, actor.id, stayTimeSec, deltaTime);
          continue;
        }

        if (current.inside) {
          this.state.set(stateKey, { inside: false, stayTimeSec: 0 });
          this.emit(this.leaveListeners, 'leave', zone, actor.id, current.stayTimeSec, 0);
        }
      }
    }

    this.leaveInactiveStates(activeKeys);
  }

  onEnter(listener: ZoneListener): () => void {
    this.enterListeners.push(listener);
    return () => this.removeListener(this.enterListeners, listener);
  }

  onTick(listener: ZoneListener): () => void {
    this.tickListeners.push(listener);
    return () => this.removeListener(this.tickListeners, listener);
  }

  onLeave(listener: ZoneListener): () => void {
    this.leaveListeners.push(listener);
    return () => this.removeListener(this.leaveListeners, listener);
  }

  getZones(): ZoneConfig[] {
    return this.zones;
  }

  getZoneById(zoneId: string): ZoneConfig | null {
    return this.zones.find((zone) => zone.id === zoneId) ?? null;
  }

  isActorInside(zoneId: string, actorId = 'player'): boolean {
    return this.state.get(this.getStateKey(zoneId, actorId))?.inside === true;
  }

  getInsideActorIds(zoneId: string): string[] {
    const actorIds: string[] = [];
    for (const [stateKey, current] of this.state) {
      if (!current.inside) continue;
      const parsed = this.parseStateKey(stateKey);
      if (parsed.zoneId === zoneId) actorIds.push(parsed.actorId);
    }
    return actorIds;
  }

  setActorProvider(provider: (() => ZoneActor[]) | null): void {
    this.actorProvider = provider;
    this.reset();
  }

  reset(): void {
    this.leaveAllActive();
    this.state.clear();
  }

  dispose(): void {
    this.reset();
    this.zones = [];
    this.enterListeners = [];
    this.tickListeners = [];
    this.leaveListeners = [];
    this.actorProvider = null;
  }

  private resolveRuntimeZones(sceneConfig: SceneConfig): ZoneConfig[] {
    const zones = sceneConfig.gameplay?.zones;
    if (!Array.isArray(zones)) return [];

    return zones
      .map((zoneConfig) => this.resolveRuntimeZone(zoneConfig))
      .filter((zone): zone is ZoneConfig => !!zone);
  }

  private resolveRuntimeZone(zoneConfig: SceneZoneConfig): ZoneConfig | null {
    if (!zoneConfig.id) return null;
    if (!zoneConfig.location) return null;
    if (!isFiniteNumber(zoneConfig.location.x) || !isFiniteNumber(zoneConfig.location.z)) return null;
    if (!zoneConfig.size) return null;
    if (!isPositiveNumber(zoneConfig.size.width) || !isPositiveNumber(zoneConfig.size.depth)) return null;
    if (zoneConfig.rotationDeg != null && !isFiniteNumber(zoneConfig.rotationDeg)) return null;

    return {
      id: zoneConfig.id,
      location: {
        x: zoneConfig.location.x,
        z: zoneConfig.location.z,
      },
      size: {
        width: zoneConfig.size.width,
        depth: zoneConfig.size.depth,
      },
      rotationDeg: zoneConfig.rotationDeg,
      meta: zoneConfig.meta,
    };
  }

  private getActors(): ZoneActor[] {
    if (this.actorProvider) {
      return this.actorProvider();
    }

    const player = this.getPlayer();
    if (!player) return [];

    return [{
      id: 'player',
      position: {
        x: player.position.x,
        z: player.position.z,
      },
      radius: player.radius ?? DEFAULT_PLAYER_RADIUS,
    }];
  }

  private checkCollision(zone: ZoneConfig, actor: ZoneActor): boolean {
    const radius = actor.radius ?? 0;
    const dx = actor.position.x - zone.location.x;
    const dz = actor.position.z - zone.location.z;
    const halfX = zone.size.width / 2 + radius;
    const halfZ = zone.size.depth / 2 + radius;

    if (!zone.rotationDeg) {
      return Math.abs(dx) <= halfX && Math.abs(dz) <= halfZ;
    }

    const rad = -(zone.rotationDeg * Math.PI) / 180;
    const localX = dx * Math.cos(rad) - dz * Math.sin(rad);
    const localZ = dx * Math.sin(rad) + dz * Math.cos(rad);
    return Math.abs(localX) <= halfX && Math.abs(localZ) <= halfZ;
  }

  private leaveAllActive(): void {
    for (const [stateKey, current] of this.state) {
      if (!current.inside) continue;

      const { zoneId, actorId } = this.parseStateKey(stateKey);
      const zone = this.getZoneById(zoneId);
      this.state.set(stateKey, { inside: false, stayTimeSec: 0 });
      if (zone) this.emit(this.leaveListeners, 'leave', zone, actorId, current.stayTimeSec, 0);
    }
  }

  private leaveInactiveStates(activeKeys: Set<string>): void {
    for (const [stateKey, current] of this.state) {
      if (!current.inside || activeKeys.has(stateKey)) continue;

      const { zoneId, actorId } = this.parseStateKey(stateKey);
      const zone = this.getZoneById(zoneId);
      this.state.set(stateKey, { inside: false, stayTimeSec: 0 });
      if (zone) this.emit(this.leaveListeners, 'leave', zone, actorId, current.stayTimeSec, 0);
    }
  }

  private getStateKey(zoneId: string, actorId: string): string {
    return `${zoneId}::${actorId}`;
  }

  private parseStateKey(stateKey: string): { zoneId: string; actorId: string } {
    const separatorIndex = stateKey.lastIndexOf('::');
    return {
      zoneId: stateKey.slice(0, separatorIndex),
      actorId: stateKey.slice(separatorIndex + 2),
    };
  }

  private removeListener(listeners: ZoneListener[], listener: ZoneListener): void {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  }

  private emit(
    listeners: ZoneListener[],
    phase: ZonePhase,
    zone: ZoneConfig,
    actorId: string,
    stayTimeSec: number,
    deltaTimeSec: number,
  ): void {
    const event: ZoneEvent = {
      phase,
      zoneId: zone.id,
      actorId,
      stayTimeSec,
      deltaTimeSec,
      zone,
    };
    for (const listener of listeners) {
      listener(event);
    }
  }
}
