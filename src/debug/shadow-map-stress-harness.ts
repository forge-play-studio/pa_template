import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import type { Game } from '../core/Game';
import type {
  SceneRuntimeGeneratedShadowCasterRegistration,
  SceneShadowCasterActivityController,
} from '../services/SceneBuilder';

const EDITOR_STATIC_PREFIX = 'shadow_stress_editor_static_';
const EDITOR_DYNAMIC_PREFIX = 'shadow_stress_editor_dynamic_';
const EDITOR_SKINNED_PREFIX = 'shadow_stress_editor_skinned_';
const CODE_STATIC_PREFIX = 'shadow_stress_code_static_';
const CODE_DYNAMIC_PREFIX = 'shadow_stress_code_dynamic_';
const STRESS_PROBE_ID = 'shadow-map-stress-probe';
const MAX_CASTER_COUNT_PER_CLASS = 2_000;
const GRID_SPACING = 0.55;
const BOX_SIZE = 0.34;
const MOVE_AMPLITUDE = 0.12;

interface StressNode {
  node: TransformNode;
  homeY: number;
  phase: number;
}

interface RuntimeStressNode extends StressNode {
  mesh: AbstractMesh;
  entityId: string;
  dynamic: boolean;
}

interface SkinnedStressEntry {
  animations: AnimationGroup[];
  activity: SceneShadowCasterActivityController;
  clipName: string | null;
}

export interface ShadowMapStressSnapshot {
  editorStaticCount: number;
  editorDynamicCount: number;
  editorSkinnedCount: number;
  skinnedAnimationGroupCount: number;
  playingSkinnedAnimationCount: number;
  codeStaticCount: number;
  codeDynamicCount: number;
  dynamicActive: boolean;
  sceneMeshCount: number;
  engineFps: number;
  evidence: ReturnType<Game['getShadowMapExperimentEvidence']>;
}

export interface ShadowMapStressPerformanceSample {
  requestedFrames: number;
  measuredFrames: number;
  durationMs: number;
  averageFrameMs: number;
  p50FrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  minFrameMs: number;
  maxFrameMs: number;
  fps: number;
  longFrameCount: number;
  refreshDelta: number;
  layerRefreshDelta: {
    static: number;
    dynamic: number;
    composite: number;
  };
  coverageRevisionDelta: number;
  cullingRebuildDelta: number;
  heapUsedBytes: number | null;
  snapshot: ShadowMapStressSnapshot;
}

export interface ShadowMapStressController {
  configureCodeGenerated(input: {
    staticCount: number;
    dynamicCount: number;
    offsetX?: number;
    offsetZ?: number;
  }): ShadowMapStressSnapshot;
  refreshEditorGenerated(): ShadowMapStressSnapshot;
  startDynamic(): ShadowMapStressSnapshot;
  stopDynamic(): ShadowMapStressSnapshot;
  clearCodeGenerated(): ShadowMapStressSnapshot;
  pauseGameplay(): ShadowMapStressSnapshot;
  resumeGameplay(): ShadowMapStressSnapshot;
  sampleFrames(frameCount?: number): Promise<ShadowMapStressPerformanceSample>;
  getSnapshot(): ShadowMapStressSnapshot;
  dispose(): void;
}

export function mountRuntimeShadowMapStressHarness(options: {
  getGame: () => Game | null;
}): { dispose(): void } {
  const game = options.getGame();
  if (!game) throw new Error('shadowMapStress.gameUnavailable');
  const controller = createShadowMapStressController(game);
  window.__PA_SHADOW_STRESS__?.dispose();
  window.__PA_SHADOW_STRESS__ = controller;
  const probe = mountShadowMapStressProbe(controller);
  return {
    dispose() {
      probe.remove();
      if (window.__PA_SHADOW_STRESS__ === controller) delete window.__PA_SHADOW_STRESS__;
      controller.dispose();
    },
  };
}

function mountShadowMapStressProbe(controller: ShadowMapStressController): HTMLDivElement {
  document.getElementById(STRESS_PROBE_ID)?.remove();
  const root = document.createElement('div');
  root.id = STRESS_PROBE_ID;
  root.style.cssText = 'position:fixed;left:2px;top:0;width:4px;height:2px;opacity:0.001;z-index:2147483647';
  const input = document.createElement('input');
  input.type = 'text';
  input.setAttribute('aria-label', 'Shadow Map stress command JSON');
  input.style.cssText = 'width:2px;height:2px;padding:0;border:0';
  const probe = document.createElement('button');
  probe.type = 'button';
  probe.setAttribute('aria-label', 'Run Shadow Map stress command');
  probe.style.cssText = 'width:2px;height:2px;padding:0;border:0';
  probe.addEventListener('click', async () => {
    const request = parseStressProbeRequest(input.value);
    if (!request) return;
    root.dataset.status = `pending:${request.id}`;
    try {
      const value = await executeStressProbeRequest(controller, request);
      root.dataset.result = JSON.stringify({ id: request.id, ok: true, value });
    } catch (error) {
      root.dataset.result = JSON.stringify({
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      root.dataset.status = `complete:${request.id}`;
    }
  });
  root.append(input, probe);
  document.body.append(root);
  return root;
}

type StressProbeRequest = {
  id: string;
  action: 'snapshot' | 'configureCodeGenerated' | 'refreshEditorGenerated'
    | 'startDynamic' | 'stopDynamic' | 'clearCodeGenerated'
    | 'pauseGameplay' | 'resumeGameplay' | 'sampleFrames' | 'stopDynamicAndSample';
  input?: Record<string, unknown>;
};

function parseStressProbeRequest(value: string | undefined): StressProbeRequest | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StressProbeRequest>;
    if (typeof parsed.id !== 'string' || typeof parsed.action !== 'string') return null;
    return parsed as StressProbeRequest;
  } catch {
    return null;
  }
}

async function executeStressProbeRequest(
  controller: ShadowMapStressController,
  request: StressProbeRequest,
): Promise<unknown> {
  switch (request.action) {
    case 'snapshot': return controller.getSnapshot();
    case 'configureCodeGenerated': return controller.configureCodeGenerated({
      staticCount: Number(request.input?.staticCount),
      dynamicCount: Number(request.input?.dynamicCount),
      offsetX: Number(request.input?.offsetX ?? 0),
      offsetZ: Number(request.input?.offsetZ ?? 0),
    });
    case 'refreshEditorGenerated': return controller.refreshEditorGenerated();
    case 'startDynamic': return controller.startDynamic();
    case 'stopDynamic': return controller.stopDynamic();
    case 'clearCodeGenerated': return controller.clearCodeGenerated();
    case 'pauseGameplay': return controller.pauseGameplay();
    case 'resumeGameplay': return controller.resumeGameplay();
    case 'sampleFrames': return controller.sampleFrames(Number(request.input?.frameCount ?? 120));
    case 'stopDynamicAndSample':
      controller.stopDynamic();
      return controller.sampleFrames(Number(request.input?.frameCount ?? 4));
    default: throw new Error(`shadowMapStress.unknownProbeAction:${request.action}`);
  }
}

export function createShadowMapStressController(game: Game): ShadowMapStressController {
  const scene = game.getScene();
  const sceneBuilder = game.getSceneBuilder();
  if (!sceneBuilder) throw new Error('shadowMapStress.sceneBuilderUnavailable');
  const modelAnimationService = game.getModelAnimationService();

  const codeNodes: RuntimeStressNode[] = [];
  const codeActivities = new Map<string, SceneShadowCasterActivityController>();
  const editorNodes = new Map<string, StressNode>();
  const editorActivities = new Map<string, SceneShadowCasterActivityController>();
  const editorSkinnedEntries = new Map<string, SkinnedStressEntry>();
  let codeRegistration: SceneRuntimeGeneratedShadowCasterRegistration | null = null;
  let codeMaterial: StandardMaterial | null = null;
  let dynamicActive = false;
  let gameplayPausedByHarness = false;
  let movementElapsed = 0;
  let disposed = false;

  const movementObserver = scene.onBeforeRenderObservable.add(() => {
    if (!dynamicActive || disposed) return;
    movementElapsed += Math.min(0.1, Math.max(0, scene.getEngine().getDeltaTime() / 1000));
    updateMovingNodes(codeNodes.filter(entry => entry.dynamic), movementElapsed);
    updateMovingNodes([...editorNodes.values()], movementElapsed);
  });

  const assertUsable = (): void => {
    if (disposed) throw new Error('shadowMapStress.controllerDisposed');
  };

  const setActivitiesActive = (
    activities: ReadonlyMap<string, SceneShadowCasterActivityController>,
    active: boolean,
  ): void => {
    const errors: unknown[] = [];
    for (const activity of activities.values()) {
      try { activity.setActive(active); } catch (error) { errors.push(error); }
    }
    if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.activityTransitionFailed');
  };

  const disposeActivities = (
    activities: Map<string, SceneShadowCasterActivityController>,
  ): unknown[] => {
    const errors: unknown[] = [];
    for (const activity of activities.values()) {
      try { activity.setActive(false); } catch (error) { errors.push(error); }
      try { activity.dispose(); } catch (error) { errors.push(error); }
    }
    activities.clear();
    return errors;
  };

  const clearCodeGenerated = (): void => {
    const errors = disposeActivities(codeActivities);
    try { codeRegistration?.dispose(); } catch (error) { errors.push(error); }
    codeRegistration = null;
    for (const entry of codeNodes.splice(0)) {
      try { entry.mesh.dispose(); } catch (error) { errors.push(error); }
    }
    try { codeMaterial?.dispose(); } catch (error) { errors.push(error); }
    codeMaterial = null;
    if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.codeCleanupFailed');
  };

  const stopSkinnedAnimations = (): unknown[] => {
    const errors: unknown[] = [];
    for (const entry of editorSkinnedEntries.values()) {
      try { entry.activity.setActive(false); } catch (error) { errors.push(error); }
      if (entry.animations.length > 0) {
        try { modelAnimationService?.stop(entry.animations); } catch (error) { errors.push(error); }
      }
      try { entry.activity.dispose(); } catch (error) { errors.push(error); }
    }
    editorSkinnedEntries.clear();
    return errors;
  };

  const playSkinnedAnimations = (): void => {
    if (editorSkinnedEntries.size > 0 && !modelAnimationService) {
      throw new Error('shadowMapStress.modelAnimationServiceUnavailable');
    }
    const started: SkinnedStressEntry[] = [];
    try {
      let index = 0;
      for (const entry of editorSkinnedEntries.values()) {
        const clipName = entry.animations[0]?.name ?? null;
        entry.clipName = clipName;
        const animation = clipName
          ? modelAnimationService?.play(entry.animations, clipName, {
              loop: true,
              speedRatio: 0.85 + (index++ % 5) * 0.075,
            }) ?? null
          : null;
        entry.activity.setActive(animation !== null);
        if (animation) started.push(entry);
      }
    } catch (error) {
      for (const entry of started) {
        try { modelAnimationService?.pause(entry.animations); } catch { /* Preserve the primary error. */ }
        try { entry.activity.setActive(false); } catch { /* Preserve the primary error. */ }
      }
      throw error;
    }
  };

  const pauseSkinnedAnimations = (): void => {
    const errors: unknown[] = [];
    for (const entry of editorSkinnedEntries.values()) {
      try { modelAnimationService?.pause(entry.animations); } catch (error) { errors.push(error); }
      try { entry.activity.setActive(false); } catch (error) { errors.push(error); }
    }
    if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.skinnedPauseFailed');
  };

  const refreshEditorGenerated = (): void => {
    const errors = disposeActivities(editorActivities);
    errors.push(...stopSkinnedAnimations());
    editorNodes.clear();
    let phase = 0;
    for (const [entityId, node] of sceneBuilder.sceneNodeRuntimes) {
      if (entityId.startsWith(EDITOR_SKINNED_PREFIX)) {
        const activity = sceneBuilder.registerShadowCasterActivitySource({
          entityId,
          kind: 'animation',
          sourceId: 'shadow-stress-editor-animation',
        });
        if (!activity) continue;
        editorSkinnedEntries.set(entityId, {
          animations: sceneBuilder.getSceneNodeAnimationGroups(entityId),
          activity,
          clipName: null,
        });
        continue;
      }
      if (!entityId.startsWith(EDITOR_DYNAMIC_PREFIX)) continue;
      const activity = sceneBuilder.registerShadowCasterActivitySource({
        entityId,
        kind: 'transform',
        sourceId: 'shadow-stress-editor-transform',
      });
      if (!activity) continue;
      editorActivities.set(entityId, activity);
      editorNodes.set(entityId, { node, homeY: node.position.y, phase: phase++ * 0.37 });
    }
    if (dynamicActive) {
      try { setActivitiesActive(editorActivities, true); } catch (error) { errors.push(error); }
      try { playSkinnedAnimations(); } catch (error) { errors.push(error); }
    }
    if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.editorRefreshFailed');
  };

  refreshEditorGenerated();

  const controller: ShadowMapStressController = {
    configureCodeGenerated(input) {
      assertUsable();
      const staticCount = normalizeCount(input.staticCount, 'staticCount');
      const dynamicCount = normalizeCount(input.dynamicCount, 'dynamicCount');
      const offsetX = normalizeOffset(input.offsetX ?? 0, 'offsetX');
      const offsetZ = normalizeOffset(input.offsetZ ?? 0, 'offsetZ');
      clearCodeGenerated();
      if (staticCount + dynamicCount === 0) return controller.getSnapshot();

      codeMaterial = new StandardMaterial('shadow_stress_code_material', scene);
      codeMaterial.diffuseColor = new Color3(0.24, 0.62, 0.88);
      codeMaterial.specularColor = new Color3(0.04, 0.04, 0.04);
      const total = staticCount + dynamicCount;
      const columns = Math.ceil(Math.sqrt(total));
      const inputs = [];
      try {
        for (let index = 0; index < total; index += 1) {
          const dynamic = index >= staticCount;
          const localIndex = dynamic ? index - staticCount : index;
          const entityId = `${dynamic ? CODE_DYNAMIC_PREFIX : CODE_STATIC_PREFIX}${String(localIndex).padStart(4, '0')}`;
          const mesh = MeshBuilder.CreateBox(entityId, { size: BOX_SIZE }, scene);
          mesh.id = entityId;
          mesh.name = entityId;
          mesh.material = codeMaterial;
          const position = createGridPosition(index, total, columns, 0.22);
          mesh.position.set(position.x + offsetX, position.y, position.z + offsetZ);
          mesh.metadata = {
            ...(mesh.metadata && typeof mesh.metadata === 'object' ? mesh.metadata : {}),
            shadowStress: { source: 'code', dynamic },
          };
          codeNodes.push({
            node: mesh,
            mesh,
            entityId,
            dynamic,
            homeY: mesh.position.y,
            phase: index * 0.37,
          });
          inputs.push({
            entityId,
            renderableId: entityId,
            mesh,
            updateClass: dynamic ? 'dynamic' as const : 'static' as const,
            receive: true,
          });
        }
        codeRegistration = sceneBuilder.registerRuntimeGeneratedShadowCasters(inputs);
        if (!codeRegistration) throw new Error('shadowMapStress.experimentUnavailable');
        for (const entry of codeNodes) {
          if (!entry.dynamic) continue;
          const activity = sceneBuilder.registerShadowCasterActivitySource({
            entityId: entry.entityId,
            kind: 'transform',
            sourceId: 'shadow-stress-code-transform',
          });
          if (!activity) throw new Error(`shadowMapStress.activityUnavailable:${entry.entityId}`);
          codeActivities.set(entry.entityId, activity);
        }
        if (dynamicActive) setActivitiesActive(codeActivities, true);
      } catch (error) {
        try { clearCodeGenerated(); } catch (cleanupError) {
          if (error && typeof error === 'object') Object.assign(error, { cleanupError });
        }
        throw error;
      }
      return controller.getSnapshot();
    },
    refreshEditorGenerated() {
      assertUsable();
      refreshEditorGenerated();
      return controller.getSnapshot();
    },
    startDynamic() {
      assertUsable();
      if (!dynamicActive) {
        setActivitiesActive(codeActivities, true);
        try {
          setActivitiesActive(editorActivities, true);
          playSkinnedAnimations();
        } catch (error) {
          setActivitiesActive(codeActivities, false);
          try { setActivitiesActive(editorActivities, false); } catch { /* Preserve the primary error. */ }
          try { pauseSkinnedAnimations(); } catch { /* Preserve the primary error. */ }
          throw error;
        }
        dynamicActive = true;
      }
      return controller.getSnapshot();
    },
    stopDynamic() {
      assertUsable();
      if (dynamicActive) {
        const errors: unknown[] = [];
        try { setActivitiesActive(codeActivities, false); } catch (error) { errors.push(error); }
        try { setActivitiesActive(editorActivities, false); } catch (error) { errors.push(error); }
        try { pauseSkinnedAnimations(); } catch (error) { errors.push(error); }
        dynamicActive = false;
        if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.stopFailed');
      }
      return controller.getSnapshot();
    },
    clearCodeGenerated() {
      assertUsable();
      clearCodeGenerated();
      return controller.getSnapshot();
    },
    pauseGameplay() {
      assertUsable();
      game.pause();
      gameplayPausedByHarness = true;
      return controller.getSnapshot();
    },
    resumeGameplay() {
      assertUsable();
      game.resume();
      gameplayPausedByHarness = false;
      return controller.getSnapshot();
    },
    async sampleFrames(frameCount = 120) {
      assertUsable();
      const requestedFrames = Math.max(2, Math.min(600, Math.floor(frameCount)));
      const beforeRefresh = readShadowMapRefreshCounters(game.getShadowMapExperimentEvidence());
      const frameTimes = await collectFrameTimes(scene, requestedFrames);
      const afterRefresh = readShadowMapRefreshCounters(game.getShadowMapExperimentEvidence());
      const sorted = [...frameTimes].sort((left, right) => left - right);
      const durationMs = frameTimes.reduce((sum, value) => sum + value, 0);
      const averageFrameMs = durationMs / Math.max(1, frameTimes.length);
      return {
        requestedFrames,
        measuredFrames: frameTimes.length,
        durationMs,
        averageFrameMs,
        p50FrameMs: percentile(sorted, 0.5),
        p95FrameMs: percentile(sorted, 0.95),
        p99FrameMs: percentile(sorted, 0.99),
        minFrameMs: sorted[0] ?? 0,
        maxFrameMs: sorted[sorted.length - 1] ?? 0,
        fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
        longFrameCount: frameTimes.filter(value => value > 33.34).length,
        refreshDelta: afterRefresh.total - beforeRefresh.total,
        layerRefreshDelta: {
          static: afterRefresh.static - beforeRefresh.static,
          dynamic: afterRefresh.dynamic - beforeRefresh.dynamic,
          composite: afterRefresh.composite - beforeRefresh.composite,
        },
        coverageRevisionDelta: afterRefresh.coverageRevision - beforeRefresh.coverageRevision,
        cullingRebuildDelta: afterRefresh.cullingRebuild - beforeRefresh.cullingRebuild,
        heapUsedBytes: readHeapUsedBytes(),
        snapshot: controller.getSnapshot(),
      };
    },
    getSnapshot() {
      assertUsable();
      let editorStaticCount = 0;
      let editorDynamicCount = 0;
      let editorSkinnedCount = 0;
      for (const entityId of sceneBuilder.sceneNodeRuntimes.keys()) {
        if (entityId.startsWith(EDITOR_STATIC_PREFIX)) editorStaticCount += 1;
        else if (entityId.startsWith(EDITOR_DYNAMIC_PREFIX)) editorDynamicCount += 1;
        else if (entityId.startsWith(EDITOR_SKINNED_PREFIX)) editorSkinnedCount += 1;
      }
      return {
        editorStaticCount,
        editorDynamicCount,
        editorSkinnedCount,
        skinnedAnimationGroupCount: [...editorSkinnedEntries.values()]
          .reduce((count, entry) => count + entry.animations.length, 0),
        playingSkinnedAnimationCount: [...editorSkinnedEntries.values()]
          .reduce((count, entry) => count + entry.animations.filter(animation => animation.isPlaying).length, 0),
        codeStaticCount: codeNodes.filter(entry => !entry.dynamic).length,
        codeDynamicCount: codeNodes.filter(entry => entry.dynamic).length,
        dynamicActive,
        sceneMeshCount: scene.meshes.length,
        engineFps: scene.getEngine().getFps(),
        evidence: game.getShadowMapExperimentEvidence(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const errors: unknown[] = [];
      try { setActivitiesActive(codeActivities, false); } catch (error) { errors.push(error); }
      try { setActivitiesActive(editorActivities, false); } catch (error) { errors.push(error); }
      try { pauseSkinnedAnimations(); } catch (error) { errors.push(error); }
      dynamicActive = false;
      errors.push(...disposeActivities(editorActivities));
      errors.push(...stopSkinnedAnimations());
      editorNodes.clear();
      try { clearCodeGenerated(); } catch (error) { errors.push(error); }
      try { scene.onBeforeRenderObservable.remove(movementObserver); } catch (error) { errors.push(error); }
      if (gameplayPausedByHarness) {
        try { game.resume(); } catch (error) { errors.push(error); }
        gameplayPausedByHarness = false;
      }
      if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.disposeFailed');
    },
  };
  return controller;
}

function readShadowMapRefreshCounters(
  evidence: ReturnType<Game['getShadowMapExperimentEvidence']>,
): {
  total: number;
  static: number;
  dynamic: number;
  composite: number;
  coverageRevision: number;
  cullingRebuild: number;
} {
  return {
    total: evidence?.refreshCount ?? 0,
    static: evidence?.depth?.static.refreshCount ?? 0,
    dynamic: evidence?.depth?.dynamic.refreshCount ?? 0,
    composite: evidence?.depth?.compositeRefreshCount ?? 0,
    coverageRevision: evidence?.culling.coverageRevision ?? 0,
    cullingRebuild: evidence?.culling.rebuildCount ?? 0,
  };
}

function normalizeCount(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_CASTER_COUNT_PER_CLASS) {
    throw new Error(`shadowMapStress.invalidCount:${field}`);
  }
  return value;
}

function normalizeOffset(value: number, field: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000) {
    throw new Error(`shadowMapStress.invalidOffset:${field}`);
  }
  return value;
}

function createGridPosition(index: number, total: number, columns: number, y: number): {
  x: number;
  y: number;
  z: number;
} {
  const rows = Math.ceil(total / columns);
  return {
    x: (index % columns - (columns - 1) * 0.5) * GRID_SPACING,
    y,
    z: (Math.floor(index / columns) - (rows - 1) * 0.5) * GRID_SPACING,
  };
}

function updateMovingNodes(nodes: readonly StressNode[], elapsed: number): void {
  for (const entry of nodes) {
    entry.node.position.y = entry.homeY + Math.sin(elapsed * 2.2 + entry.phase) * MOVE_AMPLITUDE;
  }
}

function collectFrameTimes(scene: Scene, frameCount: number): Promise<number[]> {
  return new Promise(resolve => {
    const values: number[] = [];
    let previous = performance.now();
    let observer: Observer<Scene> | null = null;
    observer = scene.onAfterRenderObservable.add(() => {
      const now = performance.now();
      values.push(now - previous);
      previous = now;
      if (values.length < frameCount) return;
      if (observer) scene.onAfterRenderObservable.remove(observer);
      resolve(values);
    });
  });
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function readHeapUsedBytes(): number | null {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize?: unknown } }).memory;
  return typeof memory?.usedJSHeapSize === 'number' && Number.isFinite(memory.usedJSHeapSize)
    ? memory.usedJSHeapSize
    : null;
}

declare global {
  interface Window {
    __PA_SHADOW_STRESS__?: ShadowMapStressController;
  }
}
