import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import {
  FPS_RENDERER_SHADOWS,
  createFpsBabylonRendererHost,
  createFpsBabylonSceneBindings,
  type FpsBabylonRendererHost,
  type FpsBabylonRendererContext,
  type FpsBabylonSceneBindingsSnapshot,
  type FpsShadowRendererService,
  type StaticProjectedShadowArtifact,
} from '@fps-games/editor/playable-runtime/babylon';
import { createFpsRuntimeDataFromCompiledScene } from '@fps-games/editor/playable-runtime';
import * as rendererPluginModule from 'virtual:fps-plugins/renderer';
import renderingConfig from '../../config/rendering.json';
import { configService } from '../../config';
import { resolveTextureAssetUrl } from '../../assets';
import type { SceneBuilder } from '../SceneBuilder';

export interface ProjectRendererSession {
  readonly shadows: FpsShadowRendererService;
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
  let acceptingUpdates = true;
  let disposed = false;
  let hostDisposed = false;
  let bindingsCleared = false;
  const pendingUpdates = new Set<Promise<void>>();
  let unsubscribeBindings: (() => void) | null = null;

  const session: ProjectRendererSession = {
    shadows,
    update() {
      if (!acceptingUpdates || disposed) {
        return Promise.reject(new Error('Project renderer session is disposed.'));
      }
      const nextData = createInput();
      const nextBindings = createProjectBindingsSnapshot(scene, sceneBuilder, nextData.scene.nodes);
      const nextArtifact = configService.getStaticShadowArtifact() as StaticProjectedShadowArtifact | null;
      const operation = host.renderer.update(nextData, {
        bindings: nextBindings as never,
        staticShadowArtifact: nextArtifact,
      });
      pendingUpdates.add(operation);
      void operation.then(
        () => pendingUpdates.delete(operation),
        () => pendingUpdates.delete(operation),
      );
      return operation;
    },
    async dispose() {
      if (disposed) return;
      acceptingUpdates = false;
      const errors: unknown[] = [];
      if (unsubscribeBindings) {
        try { unsubscribeBindings(); unsubscribeBindings = null; } catch (error) { errors.push(error); }
      }
      let hostDisposalError: unknown;
      let hostDisposalFailed = false;
      const hostDisposal = !hostDisposed
        ? disposeRendererHost(host).catch(error => { hostDisposalFailed = true; hostDisposalError = error; })
        : null;
      await Promise.allSettled([...pendingUpdates]);
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
        throw Object.assign(new Error('Project renderer session disposal failed.'), { errors });
      }
    },
  };
  try {
    unsubscribeBindings = sceneBuilder.subscribeRuntimeBindings(() => {
      if (!acceptingUpdates || disposed) return;
      void session.update().catch(error => {
        if ((error as { name?: unknown })?.name === 'AbortError') return;
        console.error('[ProjectRendererSession] binding update failed', error);
      });
    });
  } catch (error) {
    acceptingUpdates = false;
    const retryCleanup = async (): Promise<void> => {
      const cleanupErrors: unknown[] = [];
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

function isAbstractMesh(value: unknown): value is AbstractMesh {
  return !!value && typeof value === 'object'
    && typeof (value as { getClassName?: unknown }).getClassName === 'function'
    && String((value as { getClassName(): string }).getClassName()).includes('Mesh');
}
