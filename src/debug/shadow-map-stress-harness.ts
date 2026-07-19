import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { MorphTarget } from '@babylonjs/core/Morph/morphTarget.js';
import { MorphTargetManager } from '@babylonjs/core/Morph/morphTargetManager.js';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Observer } from '@babylonjs/core/Misc/observable';
import type { Scene } from '@babylonjs/core/scene';
import { EngineInstrumentation } from '@babylonjs/core/Instrumentation/engineInstrumentation.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import type { Game } from '../core/Game';
import type {
  SceneRuntimeShadowObjectsOwner,
  SceneRuntimeShadowObjectsRegistration,
  SceneShadowCasterActivityController,
} from '../services/SceneBuilder';

const EDITOR_STATIC_PREFIX = 'shadow_stress_editor_static_';
const EDITOR_DYNAMIC_PREFIX = 'shadow_stress_editor_dynamic_';
const EDITOR_SKINNED_PREFIX = 'shadow_stress_editor_skinned_';
const EDITOR_ORDINARY_PREFIX = 'shadow_stress_editor_ordinary_';
const EDITOR_FOLIAGE_PREFIX = 'shadow_stress_editor_foliage_';
const EDITOR_COMPLEX_PREFIX = 'shadow_stress_editor_complex_';
const CODE_STATIC_PREFIX = 'shadow_stress_code_static_';
const CODE_DYNAMIC_PREFIX = 'shadow_stress_code_dynamic_';
const STRESS_PROBE_ID = 'shadow-map-stress-probe';
const MAX_CASTER_COUNT_PER_CLASS = 2_000;
const GRID_SPACING = 0.55;
const BOX_SIZE = 0.34;
const MOVE_AMPLITUDE = 0.12;

function readRuntimeShadowObjectsRecoveryOwner(error: unknown): SceneRuntimeShadowObjectsOwner | null {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) return null;
  const owner = (error as { runtimeShadowObjectsRecoveryOwner?: unknown }).runtimeShadowObjectsRecoveryOwner;
  return owner && typeof owner === 'object' && typeof (owner as SceneRuntimeShadowObjectsOwner).dispose === 'function'
    ? owner as SceneRuntimeShadowObjectsOwner
    : null;
}

interface StressNode {
  node: TransformNode;
  homeY: number;
  phase: number;
}

interface RuntimeStressNode extends StressNode {
  mesh: AbstractMesh;
  entityId: string;
  dynamic: boolean;
  activityKind?: 'transform' | 'morph' | 'physics';
  morphTarget?: MorphTarget;
}

export interface ShadowMapMixedStressCounts {
  primitiveStatic: number;
  primitiveDynamic: number;
  instanceStatic: number;
  instanceDynamic: number;
  morph: number;
  physics: number;
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
  editorOrdinaryCount: number;
  editorFoliageCount: number;
  editorComplexCount: number;
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
  layerRenderDelta: {
    static: number;
    dynamic: number;
    composite: number;
  };
  coverageRevisionDelta: number;
  cullingRebuildDelta: number;
  heapUsedBytes: number | null;
  instrumentation: {
    gpuFrameMs: number | null;
    renderTargetsMs: number | null;
    activeMeshesMs: number | null;
    drawCallsPerFrame: number | null;
  };
  snapshot: ShadowMapStressSnapshot;
}

export interface ShadowMapStressController {
  configureCodeGenerated(input: {
    staticCount: number;
    dynamicCount: number;
    offsetX?: number;
    offsetZ?: number;
  }): ShadowMapStressSnapshot;
  configureMixed(input: ShadowMapMixedStressCounts & {
    offsetX?: number;
    offsetZ?: number;
    registerShadows?: boolean;
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
  const previousController = window.__PA_SHADOW_STRESS__;
  previousController?.dispose();
  if (window.__PA_SHADOW_STRESS__ === previousController) delete window.__PA_SHADOW_STRESS__;
  let controller: ShadowMapStressController;
  try {
    controller = createShadowMapStressController(game);
  } catch (error) {
    const recoveryController = readShadowMapStressControllerRecovery(error);
    if (recoveryController) window.__PA_SHADOW_STRESS__ = recoveryController;
    throw error;
  }
  window.__PA_SHADOW_STRESS__ = controller;
  const probe = mountShadowMapStressProbe(controller);
  return {
    dispose() {
      probe.remove();
      controller.dispose();
      if (window.__PA_SHADOW_STRESS__ === controller) delete window.__PA_SHADOW_STRESS__;
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
  action: 'snapshot' | 'configureCodeGenerated' | 'configureMixed' | 'refreshEditorGenerated'
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
    case 'configureMixed': return controller.configureMixed({
      primitiveStatic: Number(request.input?.primitiveStatic),
      primitiveDynamic: Number(request.input?.primitiveDynamic),
      instanceStatic: Number(request.input?.instanceStatic),
      instanceDynamic: Number(request.input?.instanceDynamic),
      morph: Number(request.input?.morph),
      physics: Number(request.input?.physics),
      offsetX: Number(request.input?.offsetX ?? 0),
      offsetZ: Number(request.input?.offsetZ ?? 0),
      registerShadows: request.input?.registerShadows !== false,
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
  const engine = scene.getEngine();
  const engineInstrumentation = new EngineInstrumentation(engine);
  const sceneInstrumentation = new SceneInstrumentation(scene);
  let gpuTimingAvailable = false;
  try {
    engineInstrumentation.captureGPUFrameTime = true;
    gpuTimingAvailable = engineInstrumentation.captureGPUFrameTime;
  } catch {
    gpuTimingAvailable = false;
  }
  sceneInstrumentation.captureRenderTargetsRenderTime = true;
  sceneInstrumentation.captureActiveMeshesEvaluationTime = true;

  const codeNodes: RuntimeStressNode[] = [];
  const codeSupportMeshes: AbstractMesh[] = [];
  const codeActivities = new Map<string, SceneShadowCasterActivityController>();
  const editorNodes = new Map<string, StressNode>();
  const editorActivities = new Map<string, SceneShadowCasterActivityController>();
  const editorSkinnedEntries = new Map<string, SkinnedStressEntry>();
  const codeRegistrations: SceneRuntimeShadowObjectsOwner[] = [];
  let codeMaterial: StandardMaterial | null = null;
  let dynamicActive = false;
  let gameplayPausedByHarness = false;
  let movementElapsed = 0;
  let disposed = false;

  const movementObserver = scene.onBeforeRenderObservable.add(() => {
    if (!dynamicActive || disposed) return;
    movementElapsed += Math.min(0.1, Math.max(0, scene.getEngine().getDeltaTime() / 1000));
    updateMovingNodes(
      codeNodes.filter(entry => entry.activityKind === 'transform' || entry.activityKind === 'physics'),
      movementElapsed,
    );
    for (const entry of codeNodes) {
      if (entry.activityKind === 'morph' && entry.morphTarget) {
        entry.morphTarget.influence = 0.5 + Math.sin(movementElapsed * 2.1 + entry.phase) * 0.45;
      }
    }
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
    for (const [entityId, activity] of activities) {
      try { activity.setActive(false); } catch (error) { errors.push(error); }
      try {
        activity.dispose();
        activities.delete(entityId);
      } catch (error) {
        errors.push(error);
      }
    }
    return errors;
  };

  const clearCodeGenerated = (): void => {
    const errors: unknown[] = [];
    try { setActivitiesActive(codeActivities, false); } catch (error) { errors.push(error); }
    for (let index = codeRegistrations.length - 1; index >= 0; index -= 1) {
      const registration = codeRegistrations[index]!;
      try {
        registration.dispose();
        codeRegistrations.splice(index, 1);
      } catch (error) {
        errors.push(error);
      }
    }
    if (codeRegistrations.length === 0) codeActivities.clear();
    if (codeRegistrations.length > 0 || codeActivities.size > 0) {
      throw new AggregateError(errors, 'shadowMapStress.codeCleanupFailed');
    }
    for (let index = codeNodes.length - 1; index >= 0; index -= 1) {
      const entry = codeNodes[index]!;
      try {
        entry.mesh.dispose();
        codeNodes.splice(index, 1);
      } catch (error) {
        errors.push(error);
      }
    }
    for (let index = codeSupportMeshes.length - 1; index >= 0; index -= 1) {
      try {
        codeSupportMeshes[index]!.dispose();
        codeSupportMeshes.splice(index, 1);
      } catch (error) {
        errors.push(error);
      }
    }
    if (codeNodes.length === 0 && codeSupportMeshes.length === 0 && codeMaterial) {
      try {
        codeMaterial.dispose();
        codeMaterial = null;
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.codeCleanupFailed');
  };

  const stopSkinnedAnimations = (): unknown[] => {
    const errors: unknown[] = [];
    for (const [entityId, entry] of editorSkinnedEntries) {
      let failed = false;
      try { entry.activity.setActive(false); } catch (error) { errors.push(error); failed = true; }
      if (entry.animations.length > 0) {
        try { modelAnimationService?.stop(entry.animations); } catch (error) { errors.push(error); failed = true; }
      }
      try { entry.activity.dispose(); } catch (error) { errors.push(error); failed = true; }
      if (!failed) editorSkinnedEntries.delete(entityId);
    }
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
    if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.editorRefreshFailed');
    editorNodes.clear();
    let phase = 0;
    for (const [entityId, node] of sceneBuilder.sceneNodeRuntimes) {
      if (entityId.startsWith(EDITOR_SKINNED_PREFIX)) {
        const animations = sceneBuilder.getSceneNodeAnimationGroups(entityId);
        const activity = sceneBuilder.registerShadowCasterActivitySource({
          entityId,
          kind: 'animation',
          sourceId: 'shadow-stress-editor-animation',
        });
        if (!activity) continue;
        editorSkinnedEntries.set(entityId, {
          animations,
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
      const objects: SceneRuntimeShadowObjectsRegistration['objects'][number][] = [];
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
          objects.push({
            entityId,
            behaviorProfileId: dynamic ? 'dynamic-caster' : 'static-caster',
            renderables: [{ renderableId: entityId, mesh }],
            ...(dynamic ? {
              activities: [{
                kind: 'transform' as const,
                sourceId: 'shadow-stress-code-transform',
                initiallyActive: dynamicActive,
              }],
            } : {}),
          });
        }
        const codeRegistration = sceneBuilder.registerRuntimeShadowObjects({ objects });
        if (!codeRegistration) throw new Error('shadowMapStress.experimentUnavailable');
        codeRegistrations.push(codeRegistration);
        for (const entry of codeNodes) {
          if (!entry.dynamic) continue;
          const activity = codeRegistration.getActivityController(
            entry.entityId,
            'shadow-stress-code-transform',
          );
          if (!activity) throw new Error(`shadowMapStress.activityUnavailable:${entry.entityId}`);
          codeActivities.set(entry.entityId, activity);
        }
      } catch (error) {
        const recoveryRegistration = readRuntimeShadowObjectsRecoveryOwner(error);
        if (recoveryRegistration && !codeRegistrations.includes(recoveryRegistration)) {
          codeRegistrations.push(recoveryRegistration);
        }
        try { clearCodeGenerated(); } catch (cleanupError) {
          if (error && typeof error === 'object') Object.assign(error, { cleanupError });
        }
        throw error;
      }
      return controller.getSnapshot();
    },
    configureMixed(input) {
      assertUsable();
      const counts: ShadowMapMixedStressCounts = {
        primitiveStatic: normalizeCount(input.primitiveStatic, 'primitiveStatic'),
        primitiveDynamic: normalizeCount(input.primitiveDynamic, 'primitiveDynamic'),
        instanceStatic: normalizeCount(input.instanceStatic, 'instanceStatic'),
        instanceDynamic: normalizeCount(input.instanceDynamic, 'instanceDynamic'),
        morph: normalizeCount(input.morph, 'morph'),
        physics: normalizeCount(input.physics, 'physics'),
      };
      const offsetX = normalizeOffset(input.offsetX ?? 0, 'offsetX');
      const offsetZ = normalizeOffset(input.offsetZ ?? 0, 'offsetZ');
      const registerShadows = input.registerShadows !== false;
      clearCodeGenerated();
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
      if (total === 0) return controller.getSnapshot();

      codeMaterial = new StandardMaterial('shadow_stress_code_material', scene);
      codeMaterial.diffuseColor = new Color3(0.24, 0.62, 0.88);
      codeMaterial.specularColor = new Color3(0.04, 0.04, 0.04);
      const columns = Math.ceil(Math.sqrt(total));
      const objects: SceneRuntimeShadowObjectsRegistration['objects'][number][] = [];
      let instanceSource: ReturnType<typeof MeshBuilder.CreateBox> | null = null;
      if (counts.instanceStatic + counts.instanceDynamic > 0) {
        instanceSource = MeshBuilder.CreateBox('shadow_stress_instance_source', { size: BOX_SIZE }, scene);
        instanceSource.material = codeMaterial;
        instanceSource.position.set(10_000, 10_000, 10_000);
        codeSupportMeshes.push(instanceSource);
      }
      let globalIndex = 0;
      const addEntries = (
        category: string,
        count: number,
        dynamic: boolean,
        activityKind?: 'transform' | 'morph' | 'physics',
      ): void => {
        for (let index = 0; index < count; index += 1) {
          const entityId = `shadow_stress_code_${category}_${String(index).padStart(4, '0')}`;
          const mesh = category.startsWith('instance')
            ? instanceSource!.createInstance(entityId)
            : category === 'morph'
              ? MeshBuilder.CreateSphere(entityId, { diameter: BOX_SIZE, segments: 6 }, scene)
              : MeshBuilder.CreateBox(entityId, { size: BOX_SIZE }, scene);
          mesh.id = entityId;
          mesh.name = entityId;
          if (!category.startsWith('instance')) mesh.material = codeMaterial;
          const position = createGridPosition(globalIndex, total, columns, 0.22);
          mesh.position.set(position.x + offsetX, position.y, position.z + offsetZ);
          let morphTarget: MorphTarget | undefined;
          if (category === 'morph') {
            const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
            if (!positions) throw new Error(`shadowMapStress.morphPositionsUnavailable:${entityId}`);
            const targetPositions = [...positions];
            for (let vertex = 1; vertex < targetPositions.length; vertex += 3) {
              targetPositions[vertex] = targetPositions[vertex]! * 1.6;
            }
            const manager = new MorphTargetManager(scene, entityId);
            morphTarget = new MorphTarget(`${entityId}-target`, 0, scene, manager);
            morphTarget.setPositions(targetPositions);
            manager.addTarget(morphTarget);
            mesh.morphTargetManager = manager;
          }
          mesh.metadata = {
            ...(mesh.metadata && typeof mesh.metadata === 'object' ? mesh.metadata : {}),
            shadowStress: { source: 'code-mixed', category, dynamic },
          };
          codeNodes.push({
            node: mesh,
            mesh,
            entityId,
            dynamic,
            ...(activityKind ? { activityKind } : {}),
            ...(morphTarget ? { morphTarget } : {}),
            homeY: mesh.position.y,
            phase: globalIndex * 0.37,
          });
          objects.push({
            entityId,
            behaviorProfileId: category === 'morph'
              ? 'skinned-dynamic'
              : dynamic ? 'dynamic-caster' : 'static-caster',
            renderables: [{ renderableId: entityId, mesh }],
            ...(activityKind ? {
              activities: [{
                kind: activityKind,
                sourceId: `shadow-stress-code-${activityKind}`,
                initiallyActive: dynamicActive,
              }],
            } : {}),
          });
          globalIndex += 1;
        }
      };

      try {
        addEntries('primitive_static', counts.primitiveStatic, false);
        addEntries('primitive_dynamic', counts.primitiveDynamic, true, 'transform');
        addEntries('instance_static', counts.instanceStatic, false);
        addEntries('instance_dynamic', counts.instanceDynamic, true, 'transform');
        addEntries('morph', counts.morph, true, 'morph');
        addEntries('physics', counts.physics, true, 'physics');
        if (!registerShadows) return controller.getSnapshot();
        const registration = sceneBuilder.registerRuntimeShadowObjects({ objects });
        if (!registration) throw new Error('shadowMapStress.experimentUnavailable');
        codeRegistrations.push(registration);
        for (const entry of codeNodes) {
          if (!entry.activityKind) continue;
          const activity = registration.getActivityController(
            entry.entityId,
            `shadow-stress-code-${entry.activityKind}`,
          );
          if (!activity) throw new Error(`shadowMapStress.activityUnavailable:${entry.entityId}`);
          codeActivities.set(entry.entityId, activity);
        }
      } catch (error) {
        const recoveryRegistration = readRuntimeShadowObjectsRecoveryOwner(error);
        if (recoveryRegistration && !codeRegistrations.includes(recoveryRegistration)) {
          codeRegistrations.push(recoveryRegistration);
        }
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
        if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.stopFailed');
        dynamicActive = false;
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
      const instrumentationBefore = readInstrumentationTotals(engineInstrumentation, sceneInstrumentation);
      const frameTimes = await collectFrameTimes(scene, requestedFrames);
      const afterRefresh = readShadowMapRefreshCounters(game.getShadowMapExperimentEvidence());
      const instrumentationAfter = readInstrumentationTotals(engineInstrumentation, sceneInstrumentation);
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
        layerRenderDelta: {
          static: afterRefresh.staticRender - beforeRefresh.staticRender,
          dynamic: afterRefresh.dynamicRender - beforeRefresh.dynamicRender,
          composite: afterRefresh.compositeRender - beforeRefresh.compositeRender,
        },
        coverageRevisionDelta: afterRefresh.coverageRevision - beforeRefresh.coverageRevision,
        cullingRebuildDelta: afterRefresh.cullingRebuild - beforeRefresh.cullingRebuild,
        heapUsedBytes: readHeapUsedBytes(),
        instrumentation: createInstrumentationSample(
          instrumentationBefore,
          instrumentationAfter,
          gpuTimingAvailable,
        ),
        snapshot: controller.getSnapshot(),
      };
    },
    getSnapshot() {
      assertUsable();
      let editorStaticCount = 0;
      let editorDynamicCount = 0;
      let editorSkinnedCount = 0;
      let editorOrdinaryCount = 0;
      let editorFoliageCount = 0;
      let editorComplexCount = 0;
      for (const entityId of sceneBuilder.sceneNodeRuntimes.keys()) {
        if (entityId.startsWith(EDITOR_STATIC_PREFIX)) editorStaticCount += 1;
        else if (entityId.startsWith(EDITOR_DYNAMIC_PREFIX)) editorDynamicCount += 1;
        else if (entityId.startsWith(EDITOR_SKINNED_PREFIX)) editorSkinnedCount += 1;
        else if (entityId.startsWith(EDITOR_ORDINARY_PREFIX)) editorOrdinaryCount += 1;
        else if (entityId.startsWith(EDITOR_FOLIAGE_PREFIX)) editorFoliageCount += 1;
        else if (entityId.startsWith(EDITOR_COMPLEX_PREFIX)) editorComplexCount += 1;
      }
      return {
        editorStaticCount,
        editorDynamicCount,
        editorSkinnedCount,
        editorOrdinaryCount,
        editorFoliageCount,
        editorComplexCount,
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
      try { engineInstrumentation.dispose(); } catch (error) { errors.push(error); }
      try { sceneInstrumentation.dispose(); } catch (error) { errors.push(error); }
      if (gameplayPausedByHarness) {
        try { game.resume(); } catch (error) { errors.push(error); }
        gameplayPausedByHarness = false;
      }
      if (errors.length > 0) throw new AggregateError(errors, 'shadowMapStress.disposeFailed');
      disposed = true;
    },
  };
  try {
    refreshEditorGenerated();
  } catch (error) {
    try {
      controller.dispose();
    } catch (cleanupError) {
      if (error && typeof error === 'object') {
        Object.assign(error, { controller, cleanupError });
      } else {
        throw Object.assign(new Error('shadowMapStress.controllerCreationFailed'), {
          cause: error,
          controller,
          cleanupError,
        });
      }
    }
    throw error;
  }
  return controller;
}

interface StressInstrumentationTotals {
  gpuTotal: number;
  gpuCount: number;
  renderTargetsTotal: number;
  renderTargetsCount: number;
  activeMeshesTotal: number;
  activeMeshesCount: number;
  drawCallsTotal: number;
  drawCallsCount: number;
}

function readInstrumentationTotals(
  engineInstrumentation: EngineInstrumentation,
  sceneInstrumentation: SceneInstrumentation,
): StressInstrumentationTotals {
  const gpu = readPerformanceCounter(() => engineInstrumentation.gpuFrameTimeCounter);
  const renderTargets = readPerformanceCounter(() => sceneInstrumentation.renderTargetsRenderTimeCounter);
  const activeMeshes = readPerformanceCounter(() => sceneInstrumentation.activeMeshesEvaluationTimeCounter);
  const drawCalls = readPerformanceCounter(() => sceneInstrumentation.drawCallsCounter);
  return {
    gpuTotal: gpu.total,
    gpuCount: gpu.count,
    renderTargetsTotal: renderTargets.total,
    renderTargetsCount: renderTargets.count,
    activeMeshesTotal: activeMeshes.total,
    activeMeshesCount: activeMeshes.count,
    drawCallsTotal: drawCalls.total,
    drawCallsCount: drawCalls.count,
  };
}

function readPerformanceCounter(read: () => { total: number; count: number }): { total: number; count: number } {
  try {
    const counter = read();
    return { total: counter.total, count: counter.count };
  } catch {
    return { total: 0, count: 0 };
  }
}

function createInstrumentationSample(
  before: StressInstrumentationTotals,
  after: StressInstrumentationTotals,
  gpuTimingAvailable: boolean,
): ShadowMapStressPerformanceSample['instrumentation'] {
  return {
    gpuFrameMs: gpuTimingAvailable
      ? averageCounterDelta(before.gpuTotal, before.gpuCount, after.gpuTotal, after.gpuCount, 1e-6)
      : null,
    renderTargetsMs: averageCounterDelta(
      before.renderTargetsTotal,
      before.renderTargetsCount,
      after.renderTargetsTotal,
      after.renderTargetsCount,
    ),
    activeMeshesMs: averageCounterDelta(
      before.activeMeshesTotal,
      before.activeMeshesCount,
      after.activeMeshesTotal,
      after.activeMeshesCount,
    ),
    drawCallsPerFrame: averageCounterDelta(
      before.drawCallsTotal,
      before.drawCallsCount,
      after.drawCallsTotal,
      after.drawCallsCount,
    ),
  };
}

function averageCounterDelta(
  beforeTotal: number,
  beforeCount: number,
  afterTotal: number,
  afterCount: number,
  scale = 1,
): number | null {
  const count = afterCount - beforeCount;
  const total = afterTotal - beforeTotal;
  return count > 0 && Number.isFinite(total) ? total / count * scale : null;
}

function readShadowMapStressControllerRecovery(error: unknown): ShadowMapStressController | null {
  if (!error || typeof error !== 'object') return null;
  const controller = (error as { controller?: unknown }).controller;
  return controller && typeof controller === 'object' && typeof (controller as ShadowMapStressController).dispose === 'function'
    ? controller as ShadowMapStressController
    : null;
}

function readShadowMapRefreshCounters(
  evidence: ReturnType<Game['getShadowMapExperimentEvidence']>,
): {
  total: number;
  static: number;
  dynamic: number;
  composite: number;
  staticRender: number;
  dynamicRender: number;
  compositeRender: number;
  coverageRevision: number;
  cullingRebuild: number;
} {
  return {
    total: evidence?.refreshCount ?? 0,
    static: evidence?.depth?.static.refreshCount ?? 0,
    dynamic: evidence?.depth?.dynamic.refreshCount ?? 0,
    composite: evidence?.depth?.compositeRefreshCount ?? 0,
    staticRender: evidence?.depth?.static.renderCount ?? 0,
    dynamicRender: evidence?.depth?.dynamic.renderCount ?? 0,
    compositeRender: evidence?.depth?.compositeRenderCount ?? 0,
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
