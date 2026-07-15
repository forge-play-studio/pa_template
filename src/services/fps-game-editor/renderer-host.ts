import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import {
  FPS_RENDERER_SHADOWS,
  createFpsBabylonRendererHost,
  createFpsBabylonSceneBindings,
  type FpsBabylonRendererHost,
  type FpsBabylonRendererContext,
  type FpsBabylonSceneBindingsSnapshot,
  type FpsShadowRendererService,
  type FpsShadowObjectHandle,
  type FpsShadowObjectDescriptor,
  type FpsShadowContributionDescriptor,
  type FpsShadowDirtyReason,
  type StaticProjectedShadowArtifact,
} from '@fps-games/editor/playable-runtime/babylon';
import { createFpsRuntimeDataFromCompiledScene } from '@fps-games/editor/playable-runtime';
import * as rendererPluginModule from 'virtual:fps-plugins/renderer';
import renderingConfig from '../../config/rendering.json';
import { configService } from '../../config';
import { resolveTextureAssetUrl } from '../../assets';
import type { SceneBuilder, SceneBuilderRuntimeBindingChange } from '../SceneBuilder';

export interface ProjectRendererSession {
  readonly shadows: FpsShadowRendererService;
  bindRuntimeObject(descriptor: FpsShadowObjectDescriptor, root: TransformNode): FpsShadowObjectHandle;
  update(): Promise<void>;
  dispose(): Promise<void>;
}

export interface ProjectRendererSessionOptions {
  readonly getRendering?: () => unknown;
  readonly createEnvironmentTexture?: FpsBabylonRendererContext['createEnvironmentTexture'];
  readonly createBindings?: typeof createFpsBabylonSceneBindings;
  readonly createRendererHost?: typeof createFpsBabylonRendererHost;
}

/** Project bootstrap + bindings only; renderer semantics live in plugin entries. */
export async function createProjectRendererSession(
  scene: Scene,
  sceneBuilder: SceneBuilder,
  options: ProjectRendererSessionOptions = {},
): Promise<ProjectRendererSession> {
  // The public editor package bundles its Babylon implementation while the
  // project owns the concrete Babylon version. Keep that version bridge here.
  const bindings = (options.createBindings ?? createFpsBabylonSceneBindings)(scene.activeCamera as never);
  const createInput = () => createFpsRuntimeDataFromCompiledScene(
    configService.getSceneConfig() as any,
    options.getRendering?.() ?? renderingConfig,
  );
  const initialData = createInput();
  const initialBindings = createProjectBindingsSnapshot(scene, sceneBuilder, initialData.scene.nodes);
  bindings.replace(initialBindings, { notify: false });
  const initialArtifact = configService.getStaticShadowArtifact() as StaticProjectedShadowArtifact | null;
  const rendererContext = {
    scene: scene as never,
    cameras: scene.activeCamera ? [scene.activeCamera as never] : [],
    bindings,
    staticShadowArtifact: initialArtifact,
    resolveAssetUrl: (assetId: string) => resolveTextureAssetUrl(assetId) ?? null,
    ...(options.createEnvironmentTexture ? { createEnvironmentTexture: options.createEnvironmentTexture } : {}),
  };
  const host = await (options.createRendererHost ?? createFpsBabylonRendererHost)({
    pluginVersion: rendererPluginModule.manifests
      .find(manifest => manifest.id === 'fps.renderer.babylon')?.version ?? '0.0.0',
    data: initialData,
    module: rendererPluginModule,
    context: rendererContext,
  });
  const shadows = host.host.services.get(FPS_RENDERER_SHADOWS) as FpsShadowRendererService;
  const authoredShadowObjectHandles = new Map<string, FpsShadowObjectHandle>();
  const runtimeShadowObjectHandles = new Map<string, FpsShadowObjectHandle>();
  const runtimeShadowObjectBindings = new Map<string, Readonly<{
    root: TransformNode;
    bindingNodeIds: readonly string[];
  }>>();
  const authoredClaimBaselineRefreshers = new Map<string, (
    node: Readonly<{ active?: boolean; visible?: boolean }>,
    authoredBindings: FpsBabylonSceneBindingsSnapshot,
  ) => void>();
  const retireAuthoredShadowObject = (nodeId: string): void => {
    // A Gameplay claim borrows the authored Handle. Retire the wrapper first
    // so it restores its overlay while that Handle is still live, then clear
    // the authored owner and final Babylon binding as one lifecycle boundary.
    runtimeShadowObjectHandles.get(nodeId)?.dispose();
    authoredShadowObjectHandles.get(nodeId)?.dispose();
    authoredShadowObjectHandles.delete(nodeId);
    bindings.setNodeMeshes(nodeId, []);
  };
  const syncShadowObjects = (
    nodes: readonly { id: string; active?: boolean; visible?: boolean }[],
    authoredBindings: FpsBabylonSceneBindingsSnapshot = bindings.snapshot(),
  ): void => {
    const nextIds = new Set(nodes.map(node => node.id));
    for (const nodeId of authoredShadowObjectHandles.keys()) {
      if (nextIds.has(nodeId)) continue;
      retireAuthoredShadowObject(nodeId);
    }
    for (const node of nodes) {
      const existing = authoredShadowObjectHandles.get(node.id);
      if (!existing) {
        authoredShadowObjectHandles.set(node.id, shadows.bindObject({
          objectId: node.id,
          targetId: node.id,
          bindingNodeIds: [node.id],
          active: node.active !== false,
          visible: node.visible !== false,
        }));
      } else {
        const refreshClaimBaseline = authoredClaimBaselineRefreshers.get(node.id);
        if (refreshClaimBaseline) {
          refreshClaimBaseline(node, authoredBindings);
          continue;
        }
        existing.setActive(node.active !== false);
        existing.setVisible(node.visible !== false);
      }
    }
  };
  syncShadowObjects(initialData.scene.nodes);
  await shadows.whenSettled();
  let acceptingUpdates = true;
  let disposed = false;
  let hostDisposed = false;
  let bindingsCleared = false;
  const pendingUpdates = new Set<Promise<void>>();
  let unsubscribeBindings: (() => void) | null = null;

  const session: ProjectRendererSession = {
    shadows,
    bindRuntimeObject(descriptor, root) {
      if (!acceptingUpdates || disposed) throw new Error('Project renderer session is disposed.');
      const objectId = descriptor.objectId.trim();
      if (!objectId) throw new Error('Runtime shadow objectId must not be empty.');
      if (runtimeShadowObjectHandles.has(objectId)) throw new Error(`Runtime shadow object is already claimed: ${objectId}`);
      const authoredHandle = authoredShadowObjectHandles.get(objectId);
      const ownsHandle = !authoredHandle;
      if (ownsHandle && !descriptor.targetId?.trim()) {
        throw new Error(`Runtime shadow object must reference an authored policy target: ${objectId}`);
      }
      const authoredSnapshot = authoredHandle?.snapshot();
      if (authoredSnapshot && descriptor.targetId && descriptor.targetId !== authoredSnapshot.targetId) {
        throw new Error(`Runtime shadow claim target mismatch: ${descriptor.targetId} !== ${authoredSnapshot.targetId}`);
      }
      const inner = authoredHandle ?? shadows.bindObject({
          ...descriptor,
          objectId,
          targetId: descriptor.targetId!,
          bindingNodeIds: descriptor.bindingNodeIds ?? [objectId],
          requireAuthoredPolicy: true,
        });
      const bindingNodeIds = authoredSnapshot?.bindingNodeIds
        ?? descriptor.bindingNodeIds
        ?? [objectId];
      if (authoredSnapshot && descriptor.bindingNodeIds
        && !areStringBindingsEqual(descriptor.bindingNodeIds, authoredSnapshot.bindingNodeIds)) {
        throw new Error(`Runtime shadow claim binding mismatch: ${objectId}`);
      }
      let previousMeshes = new Map<string, readonly unknown[]>(
        bindingNodeIds.map(nodeId => [nodeId, bindings.getNodeMeshes(nodeId)]),
      );
      let previousRootEnabled = root.isEnabled();
      let previousMeshVisibility = new Map(collectTransformNodeMeshes(root).map(mesh => [mesh, mesh.isVisible]));
      let baselineActive = authoredSnapshot?.active ?? previousRootEnabled;
      let baselineVisible = authoredSnapshot?.visible
        ?? [...previousMeshVisibility.values()].every(visible => visible);
      const previousContributions = new Map(Object.keys(descriptor.contributions ?? {}).map(id => [
        id,
        authoredSnapshot?.contributions[id],
      ]));
      const rememberContribution = (id: string): void => {
        if (!ownsHandle && !previousContributions.has(id)) {
          previousContributions.set(id, inner.snapshot().contributions[id]);
        }
      };
      try {
        const runtimeMeshes = collectTransformNodeMeshes(root);
        bindings.batch(() => {
          for (const nodeId of bindingNodeIds) bindings.setNodeMeshes(nodeId, runtimeMeshes as never);
        });
        if (descriptor.active !== undefined) inner.setActive(descriptor.active);
        if (descriptor.visible !== undefined) inner.setVisible(descriptor.visible);
        if (descriptor.active !== undefined) root.setEnabled(descriptor.active);
        if (descriptor.visible !== undefined) {
          for (const mesh of collectTransformNodeMeshes(root)) mesh.isVisible = descriptor.visible;
        }
        for (const [id, contribution] of Object.entries(descriptor.contributions ?? {})) {
          inner.setContribution(id, contribution);
        }
      } catch (error) {
        bindings.batch(() => {
          for (const [nodeId, meshes] of previousMeshes) bindings.setNodeMeshes(nodeId, meshes as never);
        });
        root.setEnabled(previousRootEnabled);
        for (const [mesh, visible] of previousMeshVisibility) {
          if (!mesh.isDisposed()) mesh.isVisible = visible;
        }
        if (ownsHandle) inner.dispose();
        throw error;
      }
      let handleDisposed = false;
      const assertHandleActive = (): void => {
        if (handleDisposed) throw new Error(`Runtime shadow claim is disposed: ${objectId}`);
      };
      const runtimeHandle: FpsShadowObjectHandle = Object.freeze({
        ref: inner.ref,
        setActive(active: boolean) {
          assertHandleActive();
          root.setEnabled(active);
          inner.setActive(active);
        },
        setVisible(visible: boolean) {
          assertHandleActive();
          for (const mesh of collectTransformNodeMeshes(root)) mesh.isVisible = visible;
          inner.setVisible(visible);
        },
        setContribution(id: string, contribution: FpsShadowContributionDescriptor) {
          assertHandleActive();
          rememberContribution(id);
          inner.setContribution(id, contribution);
        },
        removeContribution(id: string) {
          assertHandleActive();
          rememberContribution(id);
          inner.removeContribution(id);
        },
        notifyTransformRevision(revision: number) {
          assertHandleActive();
          inner.notifyTransformRevision(revision);
        },
        notifyCompositionRevision(revision: number) {
          assertHandleActive();
          const next = collectTransformNodeMeshes(root);
          bindings.batch(() => {
            for (const nodeId of bindingNodeIds) {
              const previous = bindings.getNodeMeshes(nodeId);
              if (!areMeshBindingsEqual(previous, next)) bindings.setNodeMeshes(nodeId, next as never);
            }
          });
          inner.notifyCompositionRevision(revision);
        },
        notifyMaterialRevision(revision: number) {
          assertHandleActive();
          inner.notifyMaterialRevision(revision);
        },
        requestReevaluate(reason: FpsShadowDirtyReason) {
          assertHandleActive();
          inner.requestReevaluate(reason);
        },
        snapshot() {
          assertHandleActive();
          return inner.snapshot();
        },
        dispose() {
          if (handleDisposed) return;
          handleDisposed = true;
          if (ownsHandle) {
            bindings.batch(() => {
              for (const nodeId of bindingNodeIds) bindings.setNodeMeshes(nodeId, []);
            });
            inner.dispose();
          } else {
            if (authoredSnapshot) {
              inner.setActive(baselineActive);
              inner.setVisible(baselineVisible);
              for (const [id, previous] of previousContributions) {
                if (previous) inner.setContribution(id, previous);
                else inner.removeContribution(id);
              }
              root.setEnabled(previousRootEnabled);
              for (const [mesh, visible] of previousMeshVisibility) {
                if (!mesh.isDisposed()) mesh.isVisible = visible;
              }
            }
            bindings.batch(() => {
              for (const [nodeId, meshes] of previousMeshes) bindings.setNodeMeshes(nodeId, meshes as never);
            });
            // The binding ids stay stable across a rebuilt authored node, so
            // publish a monotonic composition revision to reattach the World
            // projection to the newly committed Babylon meshes.
            inner.notifyCompositionRevision(inner.snapshot().compositionRevision + 1);
          }
          if (runtimeShadowObjectHandles.get(objectId) === runtimeHandle) runtimeShadowObjectHandles.delete(objectId);
          runtimeShadowObjectBindings.delete(objectId);
          authoredClaimBaselineRefreshers.delete(objectId);
        },
      });
      runtimeShadowObjectHandles.set(objectId, runtimeHandle);
      runtimeShadowObjectBindings.set(objectId, { root, bindingNodeIds });
      if (authoredSnapshot) {
        authoredClaimBaselineRefreshers.set(objectId, (node, authoredBindings) => {
          baselineActive = node.active !== false;
          baselineVisible = node.visible !== false;
          previousRootEnabled = baselineActive;
          const latestAuthoredMeshes = bindingNodeIds.flatMap(nodeId => (
            Array.from(authoredBindings.meshes.get(nodeId) ?? []) as unknown as AbstractMesh[]
          ));
          previousMeshes = new Map<string, readonly unknown[]>(bindingNodeIds.map(nodeId => [
            nodeId,
            authoredBindings.meshes.get(nodeId) ?? [],
          ]));
          previousMeshVisibility = new Map(
            [...new Set([
              ...latestAuthoredMeshes,
              ...collectTransformNodeMeshes(root),
            ])]
              .filter(mesh => !mesh.isDisposed())
              .map(mesh => [mesh, baselineVisible]),
          );
        });
      }
      return runtimeHandle;
    },
    update() {
      if (!acceptingUpdates || disposed) {
        return Promise.reject(new Error('Project renderer session is disposed.'));
      }
      const nextData = createInput();
      const authoredNextBindings = createProjectBindingsSnapshot(scene, sceneBuilder, nextData.scene.nodes);
      const nextBindings = overlayRuntimeObjectBindings(
        authoredNextBindings,
        runtimeShadowObjectBindings.values(),
      );
      const nextArtifact = configService.getStaticShadowArtifact() as StaticProjectedShadowArtifact | null;
      const operation = host.renderer.update(nextData, {
        bindings: nextBindings as never,
        staticShadowArtifact: nextArtifact,
      });
      const trackedOperation = operation.then(async () => {
        syncShadowObjects(nextData.scene.nodes, authoredNextBindings);
        await shadows.whenSettled();
      });
      pendingUpdates.add(trackedOperation);
      void trackedOperation.then(
        () => pendingUpdates.delete(trackedOperation),
        () => pendingUpdates.delete(trackedOperation),
      );
      return trackedOperation;
    },
    async dispose() {
      if (disposed) return;
      acceptingUpdates = false;
      const errors: unknown[] = [];
      if (unsubscribeBindings) {
        try { unsubscribeBindings(); unsubscribeBindings = null; } catch (error) { errors.push(error); }
      }
      for (const handle of runtimeShadowObjectHandles.values()) handle.dispose();
      for (const handle of authoredShadowObjectHandles.values()) handle.dispose();
      authoredShadowObjectHandles.clear();
      runtimeShadowObjectHandles.clear();
      runtimeShadowObjectBindings.clear();
      authoredClaimBaselineRefreshers.clear();
      const shadowSettlement = shadows.whenSettled().catch(error => { errors.push(error); });
      const hadPendingUpdates = pendingUpdates.size > 0;
      let hostDisposalError: unknown;
      let hostDisposalFailed = false;
      // Drain handle retire commands before disposing the World whenever no
      // renderer update needs Host cancellation. Starting both concurrently
      // can turn a normal retire flush into an AbortError from World disposal.
      if (!hadPendingUpdates) await shadowSettlement;
      const hostDisposal = !hostDisposed
        ? disposeRendererHost(host).catch(error => { hostDisposalFailed = true; hostDisposalError = error; })
        : null;
      await Promise.allSettled([...pendingUpdates]);
      if (hadPendingUpdates) await shadowSettlement;
      if (!hostDisposed) {
        await hostDisposal;
        if (!hostDisposalFailed) hostDisposed = true;
        else errors.push(hostDisposalError);
      }
      if (hostDisposed && !bindingsCleared) {
        try { bindings.clear(); bindingsCleared = true; } catch (error) { errors.push(error); }
      }
      if (!unsubscribeBindings && hostDisposed && bindingsCleared) disposed = true;
      if (errors.length > 0) {
        throw Object.assign(new Error('Project renderer session disposal failed.'), { cause: errors[0], errors });
      }
    },
  };
  try {
    unsubscribeBindings = sceneBuilder.subscribeRuntimeBindings((change: SceneBuilderRuntimeBindingChange) => {
      if (!acceptingUpdates || disposed) return;
      try {
        applyProjectBindingChange(
          bindings,
          sceneBuilder,
          change,
          authoredShadowObjectHandles,
          shadows,
          retireAuthoredShadowObject,
        );
      } catch (error) {
        console.error('[ProjectRendererSession] binding delta failed', error);
        return;
      }
      void shadows.whenSettled().catch(error => {
        if ((error as { name?: unknown })?.name === 'AbortError') return;
        console.error('[ProjectRendererSession] shadow delta failed', error);
      });
    });
  } catch (error) {
    acceptingUpdates = false;
    const retryCleanup = async (): Promise<void> => {
      const cleanupErrors: unknown[] = [];
      for (const handle of authoredShadowObjectHandles.values()) handle.dispose();
      for (const handle of runtimeShadowObjectHandles.values()) handle.dispose();
      authoredShadowObjectHandles.clear();
      runtimeShadowObjectHandles.clear();
      authoredClaimBaselineRefreshers.clear();
      try { await shadows.whenSettled(); } catch (cleanupError) { cleanupErrors.push(cleanupError); }
      if (!hostDisposed) {
        try { await host.dispose(); hostDisposed = true; } catch (cleanupError) { cleanupErrors.push(cleanupError); }
      }
      if (hostDisposed && !bindingsCleared) {
        try { bindings.clear(); bindingsCleared = true; } catch (cleanupError) { cleanupErrors.push(cleanupError); }
      }
      if (cleanupErrors.length > 0) {
        throw Object.assign(new Error('Project renderer session initialization cleanup failed.'), { cleanupErrors });
      }
    };
    try {
      await retryCleanup();
    } catch (cleanupFailure) {
      if (error && typeof error === 'object') {
        Object.assign(error, {
          cleanupErrors: (cleanupFailure as { cleanupErrors?: unknown[] }).cleanupErrors ?? [cleanupFailure],
          retryCleanup,
        });
      }
    }
    throw error;
  }
  return session;
}

function applyProjectBindingChange(
  bindings: ReturnType<typeof createFpsBabylonSceneBindings>,
  sceneBuilder: SceneBuilder,
  change: SceneBuilderRuntimeBindingChange,
  handles: Map<string, FpsShadowObjectHandle>,
  shadows: FpsShadowRendererService,
  retireAuthoredShadowObject: (nodeId: string) => void,
): void {
  if (change.kind === 'node-removed') {
    retireAuthoredShadowObject(change.nodeId);
    return;
  }
  if (change.kind === 'node-added') {
    bindings.setNodeMeshes(change.nodeId, collectSceneNodeMeshes(sceneBuilder, change.nodeId) as never);
    if (!handles.has(change.nodeId)) {
      handles.set(change.nodeId, shadows.bindObject({
        objectId: change.nodeId,
        targetId: change.nodeId,
        bindingNodeIds: [change.nodeId],
      }));
    }
    return;
  }
  if (change.kind === 'light-changed') {
    const lightId = configService.getSceneDirectionalLightNode()?.id ?? 'sun_light';
    bindings.notifyNodeChanged(lightId, 'light', change.revision);
    return;
  }
  const handle = handles.get(change.nodeId);
  if (change.kind === 'material-changed') handle?.notifyMaterialRevision(change.revision);
  else handle?.notifyTransformRevision(change.revision);
}

function collectSceneNodeMeshes(sceneBuilder: SceneBuilder, nodeId: string): AbstractMesh[] {
  const root = sceneBuilder.getSceneNodeRuntime(nodeId);
  if (!root) return [];
  const entries = root.getChildMeshes(false) as AbstractMesh[];
  if (isAbstractMesh(root)) entries.unshift(root as unknown as AbstractMesh);
  return entries.filter(mesh => !mesh.isDisposed());
}

function collectTransformNodeMeshes(root: TransformNode): AbstractMesh[] {
  const entries = root.getChildMeshes(false) as AbstractMesh[];
  if (isAbstractMesh(root)) entries.unshift(root as unknown as AbstractMesh);
  return entries.filter(mesh => !mesh.isDisposed());
}

function areMeshBindingsEqual(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((mesh, index) => mesh === right[index]);
}

function areStringBindingsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function disposeRendererHost(host: FpsBabylonRendererHost): Promise<void> {
  await host.dispose();
}

function createProjectBindingsSnapshot(
  scene: Scene,
  sceneBuilder: SceneBuilder,
  runtimeNodes: readonly { id: string; shadowPlan?: unknown }[],
): FpsBabylonSceneBindingsSnapshot {
  const meshes = new Map<string, readonly AbstractMesh[]>();
  for (const node of runtimeNodes) {
    const root = sceneBuilder.getSceneNodeRuntime(node.id);
    if (!root) continue;
    const entries = root.getChildMeshes(false) as AbstractMesh[];
    if (isAbstractMesh(root)) entries.unshift(root as unknown as AbstractMesh);
    meshes.set(node.id, entries.filter(mesh => !mesh.isDisposed()));
  }

  const lights = new Map<string, NonNullable<ReturnType<SceneBuilder['getRuntimeDirectionalLight']>>>();
  const directionalLight = sceneBuilder.getRuntimeDirectionalLight();
  if (directionalLight?.isEnabled()) {
    const configuredId = configService.getSceneDirectionalLightNode()?.id ?? 'sun_light';
    lights.set(configuredId, directionalLight);
  }
  return {
    meshes: meshes as never,
    lights: lights as never,
    activeCamera: scene.activeCamera as never,
  };
}

function overlayRuntimeObjectBindings(
  snapshot: FpsBabylonSceneBindingsSnapshot,
  claims: Iterable<Readonly<{ root: TransformNode; bindingNodeIds: readonly string[] }>>,
): FpsBabylonSceneBindingsSnapshot {
  const meshes = new Map(snapshot.meshes);
  for (const claim of claims) {
    const runtimeMeshes = collectTransformNodeMeshes(claim.root);
    for (const nodeId of claim.bindingNodeIds) meshes.set(nodeId, runtimeMeshes as never);
  }
  return {
    meshes: meshes as never,
    lights: new Map(snapshot.lights) as never,
    activeCamera: snapshot.activeCamera,
  };
}

function isAbstractMesh(value: unknown): value is AbstractMesh {
  return !!value && typeof value === 'object'
    && typeof (value as { getClassName?: unknown }).getClassName === 'function'
    && String((value as { getClassName(): string }).getClassName()).includes('Mesh');
}
