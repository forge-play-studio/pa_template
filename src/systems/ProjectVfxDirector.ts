import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GameplayModule } from '../gameplay';
import type { RuntimeNodeService, VfxParams, VfxPlaybackHandle, VfxService } from '../services';
import usagesDocument from '../assets/vfx/usages.json';

type ProjectVfxLifecycle = 'follow' | 'loop' | 'oneshot';

interface ProjectVfxSocketPositionSource {
  kind: 'socket';
  nodeId: string;
}

interface ProjectVfxNodePositionSource {
  kind: 'node';
  nodeId: string;
}

type ProjectVfxPositionSource = ProjectVfxSocketPositionSource | ProjectVfxNodePositionSource;

export interface ProjectVfxVector3Config {
  x?: number;
  y?: number;
  z?: number;
}

interface ProjectVfxVector3Value {
  x: number;
  y: number;
  z: number;
}

export interface ProjectVfxOffsetConfig {
  position?: ProjectVfxVector3Config;
  rotation?: ProjectVfxVector3Config;
  scale?: number | ProjectVfxVector3Config;
}

interface ProjectVfxInputsConfig {
  reference?: ProjectVfxPositionSource;
}

interface ProjectVfxUsageConfig {
  id: string;
  label?: string;
  effect: string;
  placement: ProjectVfxPositionSource['kind'];
  positionSource: ProjectVfxPositionSource;
  inputs?: ProjectVfxInputsConfig;
  offset?: ProjectVfxOffsetConfig;
  lifecycle: ProjectVfxLifecycle;
  repeatIntervalSec?: number;
  params?: VfxParams;
}

interface ProjectVfxUsagesDocument {
  usages?: ProjectVfxUsageConfig[];
}

export interface ProjectVfxUsageTarget {
  id: string;
  label: string;
  effectId: string;
  placement: ProjectVfxUsageConfig['placement'];
  positionSource: ProjectVfxPositionSource;
  offset?: ProjectVfxOffsetConfig;
  lifecycle: ProjectVfxLifecycle;
  params: VfxParams;
}

const PROJECT_VFX_USAGES = sanitizeUsagesDocument(usagesDocument as ProjectVfxUsagesDocument);

export class ProjectVfxDirector implements GameplayModule {
  private readonly handles = new Map<string, VfxPlaybackHandle>();
  private readonly savedParams = new Map<string, VfxParams>();
  private readonly previewParams = new Map<string, VfxParams>();
  private readonly savedOffsets = new Map<string, ProjectVfxOffsetConfig>();
  private readonly previewOffsets = new Map<string, ProjectVfxOffsetConfig>();
  private readonly repeatElapsed = new Map<string, number>();

  constructor(
    private readonly runtimeNodes: RuntimeNodeService,
    private readonly vfxService: VfxService,
  ) {
    for (const usage of PROJECT_VFX_USAGES) {
      this.savedParams.set(usage.id, cloneParams(usage.params));
      this.savedOffsets.set(usage.id, cloneOffset(usage.offset));
    }
  }

  init(): void {
    for (const usage of PROJECT_VFX_USAGES) {
      if (usage.lifecycle === 'oneshot') continue;
      this.playUsage(usage);
      if (usage.lifecycle === 'loop' && readRepeatInterval(usage) > 0) {
        this.repeatElapsed.set(usage.id, 0);
      }
    }
  }

  update(deltaTime: number): void {
    for (const usage of PROJECT_VFX_USAGES) {
      if (usage.lifecycle !== 'loop') continue;
      const repeatIntervalSec = readRepeatInterval(usage);
      if (repeatIntervalSec <= 0) continue;
      const nextElapsed = (this.repeatElapsed.get(usage.id) ?? 0) + deltaTime;
      if (nextElapsed < repeatIntervalSec) {
        this.repeatElapsed.set(usage.id, nextElapsed);
        continue;
      }
      this.repeatElapsed.set(usage.id, 0);
      this.playUsage(usage);
    }
  }

  dispose(): void {
    for (const usage of PROJECT_VFX_USAGES) this.vfxService.releaseByOwner(createUsageOwner(usage.id));
    this.handles.clear();
    this.previewParams.clear();
    this.previewOffsets.clear();
    this.repeatElapsed.clear();
  }

  getVfxUsageTargets(): ProjectVfxUsageTarget[] {
    return PROJECT_VFX_USAGES.map(usage => ({
      id: usage.id,
      label: usage.label?.trim() || usage.id,
      effectId: usage.effect,
      placement: usage.placement,
      positionSource: usage.positionSource,
      offset: this.getVfxUsageOffset(usage.id),
      lifecycle: usage.lifecycle,
      params: this.getVfxUsageParams(usage.id),
    }));
  }

  getVfxUsageParams(usageId: string): VfxParams {
    return cloneParams(this.previewParams.get(usageId) ?? this.savedParams.get(usageId));
  }

  getVfxUsageOffset(usageId: string): ProjectVfxOffsetConfig {
    return cloneOffset(this.previewOffsets.get(usageId) ?? this.savedOffsets.get(usageId));
  }

  /** Debug-only read used by the shared VFX panel's XYZ reference. */
  getVfxUsageRoot(usageId: string): TransformNode | null {
    const usage = findUsage(usageId);
    return usage ? this.resolvePositionSourceNode(usage.positionSource, usage.id, 'mount') : null;
  }

  playVfxUsage(usageId: string): boolean {
    const usage = findUsage(usageId);
    return usage ? this.playUsage(usage) : false;
  }

  previewVfxUsageParams(usageId: string, params: VfxParams, offset?: ProjectVfxOffsetConfig): boolean {
    const usage = findUsage(usageId);
    if (!usage) return false;
    this.previewParams.set(usage.id, cloneParams(params));
    if (offset) this.previewOffsets.set(usage.id, cloneOffset(offset));
    return this.playUsage(usage, 'debug');
  }

  saveVfxUsageParams(usageId: string, params: VfxParams, offset?: ProjectVfxOffsetConfig): boolean {
    const usage = findUsage(usageId);
    if (!usage) return false;
    this.savedParams.set(usage.id, cloneParams(params));
    if (offset) this.savedOffsets.set(usage.id, cloneOffset(offset));
    this.previewParams.delete(usage.id);
    this.previewOffsets.delete(usage.id);
    return this.playUsage(usage, 'debug');
  }

  resetVfxUsagePreview(usageId: string): boolean {
    const usage = findUsage(usageId);
    if (!usage) return false;
    this.previewParams.delete(usage.id);
    this.previewOffsets.delete(usage.id);
    return this.playUsage(usage, 'debug');
  }

  private playUsage(usage: ProjectVfxUsageConfig, source: 'runtime' | 'debug' = 'runtime'): boolean {
    const mountNode = this.resolvePositionSourceNode(usage.positionSource, usage.id, 'mount');
    if (!mountNode) return false;
    const owner = createUsageOwner(usage.id);
    if (usage.lifecycle !== 'oneshot') {
      this.handles.get(usage.id)?.release();
      this.handles.delete(usage.id);
    }

    const result = this.vfxService.play(usage.effect, {
      owner,
      params: this.getEffectiveParams(usage.id),
      source,
      placement: {
        parent: mountNode,
        ...normalizeOffset(this.getEffectiveOffset(usage.id)),
        offsetIsLocal: true,
        inputs: this.resolveInputs(usage),
      },
    });
    if (!result.ok) {
      console.warn(`[ProjectVfxDirector] ${result.message}`);
      return false;
    }
    if (usage.lifecycle !== 'oneshot' && result.handle.active) this.handles.set(usage.id, result.handle);
    return true;
  }

  private resolveInputs(usage: ProjectVfxUsageConfig): Readonly<Record<string, unknown>> | undefined {
    const referenceSource = usage.inputs?.reference;
    if (!referenceSource) return undefined;
    const referenceNode = this.resolvePositionSourceNode(referenceSource, usage.id, 'reference');
    if (!referenceNode) return undefined;
    return { reference: () => referenceNode.getAbsolutePosition().clone() };
  }

  private resolvePositionSourceNode(
    source: ProjectVfxPositionSource,
    usageId: string,
    role: 'mount' | 'reference',
  ): TransformNode | null {
    const node = this.runtimeNodes.getRuntimeNode(source.nodeId);
    if (!node) {
      console.warn(`[ProjectVfxDirector] Missing ${source.kind} ${role} node "${source.nodeId}" for usage "${usageId}".`);
      return null;
    }
    if (source.kind === 'socket' && readSceneMarker(node)?.type !== 'effect-socket') {
      console.warn(`[ProjectVfxDirector] Node "${source.nodeId}" is not an effect-socket.`);
      return null;
    }
    return node;
  }

  private getEffectiveParams(usageId: string): VfxParams {
    return cloneParams(this.previewParams.get(usageId) ?? this.savedParams.get(usageId));
  }

  private getEffectiveOffset(usageId: string): ProjectVfxOffsetConfig {
    return cloneOffset(this.previewOffsets.get(usageId) ?? this.savedOffsets.get(usageId));
  }
}

function createUsageOwner(usageId: string): string {
  return `project-vfx-usage:${usageId}`;
}

function sanitizeUsagesDocument(document: ProjectVfxUsagesDocument): ProjectVfxUsageConfig[] {
  return (document.usages ?? []).filter((usage): usage is ProjectVfxUsageConfig => !!usage
    && typeof usage.id === 'string' && usage.id.length > 0
    && typeof usage.effect === 'string' && usage.effect.length > 0
    && (usage.placement === 'socket' || usage.placement === 'node')
    && isPositionSource(usage.positionSource)
    && usage.placement === usage.positionSource.kind
    && (usage.inputs === undefined || isInputsConfig(usage.inputs))
    && (usage.lifecycle === 'follow' || usage.lifecycle === 'loop' || usage.lifecycle === 'oneshot'));
}

function isInputsConfig(value: unknown): value is ProjectVfxInputsConfig {
  if (!value || typeof value !== 'object') return false;
  const inputs = value as { reference?: unknown };
  return inputs.reference === undefined || isPositionSource(inputs.reference);
}

function isPositionSource(value: unknown): value is ProjectVfxPositionSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as { kind?: unknown; nodeId?: unknown };
  return (source.kind === 'socket' || source.kind === 'node')
    && typeof source.nodeId === 'string'
    && source.nodeId.length > 0;
}

function findUsage(usageId: string): ProjectVfxUsageConfig | null {
  return PROJECT_VFX_USAGES.find(usage => usage.id === usageId) ?? null;
}

function readRepeatInterval(usage: ProjectVfxUsageConfig): number {
  const value = usage.repeatIntervalSec;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function readSceneMarker(node: TransformNode): { type?: unknown } | null {
  const metadata = node.metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const marker = (metadata as { sceneMarker?: unknown }).sceneMarker;
  return marker && typeof marker === 'object' ? marker as { type?: unknown } : null;
}

function cloneParams(params: VfxParams | undefined): VfxParams {
  return { ...(params ?? {}) };
}

function cloneOffset(offset: ProjectVfxOffsetConfig | undefined): ProjectVfxOffsetConfig {
  return {
    ...(offset?.position ? { position: { ...offset.position } } : {}),
    ...(offset?.rotation ? { rotation: { ...offset.rotation } } : {}),
    ...(typeof offset?.scale === 'number'
      ? { scale: offset.scale }
      : offset?.scale ? { scale: { ...offset.scale } } : {}),
  };
}

function normalizeOffset(offset: ProjectVfxOffsetConfig | undefined): {
  position: Vector3;
  rotation: ProjectVfxVector3Value;
  scale: number | ProjectVfxVector3Value;
} {
  return {
    position: toVector3(offset?.position),
    rotation: toVector3Config(offset?.rotation),
    scale: typeof offset?.scale === 'number' ? offset.scale : toVector3Config(offset?.scale, 1),
  };
}

function toVector3(value: ProjectVfxVector3Config | undefined, fallback = 0): Vector3 {
  return new Vector3(readNumber(value?.x, fallback), readNumber(value?.y, fallback), readNumber(value?.z, fallback));
}

function toVector3Config(value: ProjectVfxVector3Config | undefined, fallback = 0): ProjectVfxVector3Value {
  return { x: readNumber(value?.x, fallback), y: readNumber(value?.y, fallback), z: readNumber(value?.z, fallback) };
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
