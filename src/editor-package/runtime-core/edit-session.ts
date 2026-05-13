import {
  attachProjectViewportMovement,
  createProjectViewportCamera,
  disposeProjectViewportCamera,
  focusProjectViewportSelection,
  type ProjectViewportCameraCtx,
} from './camera-controller';
import { activateProjectEventGuard, deactivateProjectEventGuard } from './event-guard';
import { ProjectEditorInput, type ProjectEditorTool } from './input-controller';
import { createProjectToolController } from './tool-controller';
import type { RuntimeCamera, RuntimeNode, RuntimeScene } from './types';

type ProjectGameLike = {
  scene?: RuntimeScene | null;
  pause?: () => void;
  resume?: () => void;
  isPausedState?: () => boolean;
  enterPreview?: () => Promise<void> | void;
  exitPreview?: (save?: boolean) => Promise<void> | void;
  onEditEnter?: () => Promise<void> | void;
  onEditExit?: () => Promise<void> | void;
};

type ProjectEditSessionOptions = {
  getScene: () => RuntimeScene | null;
  getGame: () => ProjectGameLike | null;
  getSelectedEntity?: () => RuntimeNode | null;
  emitModeChange: (mode: 'edit' | 'play') => void;
  onSetTool?: (tool: ProjectEditorTool) => void;
  onEnablePicking?: () => void;
  onFocusSelected?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onDuplicateSelected?: () => void | Promise<void>;
};

type ProjectEditState = {
  active: boolean;
  editorCamera: RuntimeCamera | null;
  savedCam: RuntimeCamera | null;
  savedActiveCams: RuntimeCamera[];
  detachedCams: RuntimeCamera[];
  resizeObs: any;
  viewportCtx: ProjectViewportCameraCtx | null;
  wasPausedBeforeEnter: boolean;
  savedPointerCam: any;
  savedAnimEnabled: boolean;
  pausedAnimGroups: Array<{ pause?: () => void; play?: () => void }>;
  frozenBeforeObs: any[] | null;
  frozenKeyboardObs: any[] | null;
  tools: ReturnType<typeof createProjectToolController> | null;
};

function setSceneActiveCamera(scene: RuntimeScene, camera: RuntimeCamera | null): void {
  if (!scene || !camera) return;
  scene.activeCamera = camera;
  scene.activeCameras = [camera];
}

function getRenderCanvas(scene: RuntimeScene): HTMLCanvasElement | null {
  return scene?.getEngine?.()?.getRenderingCanvas?.() ?? null;
}

export function createProjectEditSession(options: ProjectEditSessionOptions) {
  const state: ProjectEditState = {
    active: false,
    editorCamera: null,
    savedCam: null,
    savedActiveCams: [],
    detachedCams: [],
    resizeObs: null,
    viewportCtx: null,
    wasPausedBeforeEnter: false,
    savedPointerCam: null,
    savedAnimEnabled: true,
    pausedAnimGroups: [],
    frozenBeforeObs: null,
    frozenKeyboardObs: null,
    tools: null,
  };

  function disposeTools(): void {
    state.tools?.dispose();
    state.tools = null;
  }

  function movePostProcessPipelines(
    scene: RuntimeScene,
    fromCamera: RuntimeCamera | null,
    toCamera: RuntimeCamera | null,
  ): void {
    if (!scene || !fromCamera || !toCamera || fromCamera === toCamera) return;
    const ppm = (scene as any).postProcessRenderPipelineManager;
    const pipelines = ppm?.supportedPipelines || [];
    for (const pipeline of pipelines) {
      const name = pipeline?._name || pipeline?.name;
      if (!name) continue;
      try {
        ppm.detachCamerasFromRenderPipeline(name, fromCamera);
        ppm.attachCamerasToRenderPipeline(name, toCamera);
      } catch {}
    }
  }

  async function enter(): Promise<void> {
    if (state.active) {
      options.emitModeChange('edit');
      return;
    }

    const game = options.getGame();
    const scene = options.getScene() ?? game?.scene ?? null;
    if (!scene) {
      options.emitModeChange('play');
      return;
    }

    state.wasPausedBeforeEnter = !!game?.isPausedState?.();

    if (game && typeof game.enterPreview === 'function') {
      try {
        await game.enterPreview();
        state.active = true;
        options.emitModeChange('edit');
        return;
      } catch {}
    }

    game?.pause?.();

    state.savedCam = scene.activeCamera ?? null;
    state.savedActiveCams = scene.activeCameras ? [...scene.activeCameras] : [];
    state.detachedCams = [];

    const kbObs = (scene as any).onKeyboardObservable;
    if (kbObs?._observers?.length) {
      state.frozenKeyboardObs = kbObs._observers.splice(0);
    }

    const canvas = getRenderCanvas(scene);
    for (const cam of scene.cameras || []) {
      if (cam?.detachControl) {
        cam.detachControl();
        state.detachedCams.push(cam);
      }
    }

    state.viewportCtx = await createProjectViewportCamera(scene, state.savedCam);
    state.editorCamera = state.viewportCtx?.camera ?? null;
    if (state.editorCamera) {
      setSceneActiveCamera(scene, state.editorCamera);
      movePostProcessPipelines(scene, state.savedCam, state.editorCamera);
    }

    if (canvas && scene.getEngine) {
      const engine = scene.getEngine();
      state.resizeObs = scene.onAfterRenderObservable?.add?.(() => {
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
          engine.resize();
        }
      }) ?? null;
      activateProjectEventGuard(canvas);
    }

    state.savedAnimEnabled = (scene as any).animationsEnabled !== false;
    (scene as any).animationsEnabled = false;

    state.pausedAnimGroups = (scene.animationGroups || []).filter((ag: any) => ag?.isPlaying);
    for (const ag of state.pausedAnimGroups) {
      try { ag?.pause?.(); } catch {}
    }

    state.savedPointerCam = (scene as any).cameraToUseForPointers ?? null;
    if (state.editorCamera) {
      (scene as any).cameraToUseForPointers = state.editorCamera;
    }

    const beforeObs = (scene as any).onBeforeRenderObservable;
    if (beforeObs?._observers?.length) {
      const keep: any[] = [];
      const freeze: any[] = [];
      for (const obs of beforeObs._observers) {
        const cbStr = obs.callback?.toString?.() || '';
        const ctx = obs.scope ?? obs.callback?.__this;
        const ctxName = ctx?.constructor?.name || '';
        const isRendering = /ShadowGenerator|GlowLayer|HighlightLayer|ReflectionProbe|RenderTargetTexture|EffectLayer/i.test(ctxName)
          || /shadowMap|renderTarget|glowLayer|highlightLayer|reflectionProbe/i.test(cbStr);
        (isRendering ? keep : freeze).push(obs);
      }
      beforeObs._observers = keep;
      state.frozenBeforeObs = freeze;
    }

    state.active = true;

    state.tools = createProjectToolController({
      getScene: () => scene,
      getSelectedEntity: () => options.getSelectedEntity?.() ?? null,
      enablePicking: () => options.onEnablePicking?.(),
    });

    ProjectEditorInput.init({
      getCanvas: () => getRenderCanvas(scene),
      isEditActive: () => state.active,
      onSetTool: (tool) => {
        const handled = state.tools?.setTool(tool) ?? false;
        if (!handled) {
          options.onSetTool?.(tool);
        }
      },
      onFocusSelected: () => options.onFocusSelected?.(),
      onUndo: () => options.onUndo?.(),
      onRedo: () => options.onRedo?.(),
      onDuplicateSelected: () => options.onDuplicateSelected?.(),
    });

    if (state.viewportCtx && !state.viewportCtx.renderObs) {
      attachProjectViewportMovement(scene, state.viewportCtx);
    }

    if (game?.onEditEnter) {
      try { await game.onEditEnter(); } catch {}
    }

    options.emitModeChange('edit');
  }

  async function exit(save = true): Promise<void> {
    if (!state.active) {
      options.emitModeChange('play');
      return;
    }

    ProjectEditorInput.dispose();
    ProjectEditorInput.resetViewportNavigation();
    disposeTools();
    deactivateProjectEventGuard();

    const game = options.getGame();
    const scene = options.getScene() ?? game?.scene ?? null;
    if (game && typeof game.exitPreview === 'function') {
      try {
        await game.exitPreview(save);
      } catch {}
      state.active = false;
      options.emitModeChange('play');
      return;
    }
    if (!scene) {
      state.active = false;
      state.viewportCtx = null;
      state.editorCamera = null;
      state.savedCam = null;
      state.savedActiveCams = [];
      state.detachedCams = [];
      state.resizeObs = null;
      state.savedPointerCam = null;
      state.savedAnimEnabled = true;
      state.pausedAnimGroups = [];
      state.frozenBeforeObs = null;
      state.frozenKeyboardObs = null;
      disposeTools();
      options.emitModeChange('play');
      return;
    }

    if (state.resizeObs) {
      scene.onAfterRenderObservable?.remove?.(state.resizeObs);
      state.resizeObs = null;
    }

    disposeProjectViewportCamera(scene, state.viewportCtx);
    state.viewportCtx = null;
    const editorCamera = state.editorCamera;
    state.editorCamera = null;
    if (state.savedCam) {
      movePostProcessPipelines(scene, editorCamera, state.savedCam);
      scene.activeCamera = state.savedCam;
      scene.activeCameras = state.savedActiveCams;
    }
    state.savedCam = null;
    state.savedActiveCams = [];

    const canvas = getRenderCanvas(scene);
    if (canvas) {
      for (const cam of state.detachedCams) {
        if (cam?.attachControl) cam.attachControl(canvas, true);
      }
    }
    state.detachedCams = [];

    const beforeObs = (scene as any).onBeforeRenderObservable;
    if (state.frozenBeforeObs && beforeObs?._observers) {
      beforeObs._observers.unshift(...state.frozenBeforeObs);
      state.frozenBeforeObs = null;
    }

    const kbObs = (scene as any).onKeyboardObservable;
    if (state.frozenKeyboardObs && kbObs?._observers) {
      kbObs._observers.unshift(...state.frozenKeyboardObs);
      state.frozenKeyboardObs = null;
    }

    (scene as any).cameraToUseForPointers = state.savedPointerCam;
    state.savedPointerCam = null;

    if (state.savedAnimEnabled) {
      (scene as any).animationsEnabled = true;
    }
    state.savedAnimEnabled = true;
    for (const ag of state.pausedAnimGroups) {
      try { ag?.play?.(); } catch {}
    }
    state.pausedAnimGroups = [];
    disposeTools();

    if (game?.onEditExit) {
      try { await game.onEditExit(); } catch {}
    }

    if (!state.wasPausedBeforeEnter) {
      game?.resume?.();
    }
    state.wasPausedBeforeEnter = false;

    state.active = false;
    options.emitModeChange('play');
  }

  function isViewportNavigationActive(): boolean {
    return ProjectEditorInput.isViewportNavigationActive();
  }

  function focusSelected(node: RuntimeNode | null): boolean {
    return focusProjectViewportSelection(state.editorCamera, node);
  }

  function syncSelection(node: RuntimeNode | null): void {
    state.tools?.syncSelection(node ?? null);
  }

  function currentTool(): ProjectEditorTool {
    return state.tools?.currentTool?.() ?? 'pick';
  }

  return {
    get active() {
      return state.active;
    },
    enter,
    exit,
    isViewportNavigationActive,
    focusSelected,
    syncSelection,
    currentTool,
  };
}
