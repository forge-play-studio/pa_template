/**
 * Runtime camera debug panel.
 * Last updated: 2026-07-05.
 *
 * This file remains in `src/debug` because it renders dev-only camera controls
 * against the live game runtime. It does not own editor scene persistence:
 * saving camera authoring data composes the SDK patch helper with the
 * product scene-source services below.
 */
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import {
  cloneEditorSceneCameraDebugSnapshot,
  createEditorSceneCameraDebugSnapshot,
  createEditorSceneCameraPanMovement,
  mountEditorRuntimeCameraDebugPanel,
  patchEditorSceneRuntimeCameraRig,
  readEditorSceneRuntimeCameraBinding,
  toEditorSceneCameraRig,
  type EditorRuntimeCameraDebugPanel,
  type EditorRuntimeCameraDebugPanInput,
  type EditorSceneCameraDebugSnapshot,
  type EditorSceneCameraRig,
  type EditorSceneRuntimeCameraBinding,
  type EditorSceneVec3,
} from '@fps-games/editor/playable-sdk';
import type { SceneCameraRigConfig } from '../config';
import type { GameWorld } from '../runtime/GameWorld';
import { patchEditorSceneGameObjectField } from '../services/fps-game-editor/scene-feature';
import { loadSceneMainSource, saveSceneMainSource } from '../services/fps-game-editor/scene-feature';
import { mountRuntimeDebugPanelContainer } from './framework/panel-layout';

export interface CameraDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => GameWorld | null;
}

export type CameraDebugPanel = EditorRuntimeCameraDebugPanel;

type CameraDebugSnapshot = EditorSceneCameraDebugSnapshot & {
  binding: EditorSceneRuntimeCameraBinding;
};

async function saveRuntimeCameraRigToEditorScene(
  binding: EditorSceneRuntimeCameraBinding,
  cameraRig: SceneCameraRigConfig,
) {
  const loaded = await loadSceneMainSource();
  const patched = patchEditorSceneRuntimeCameraRig(
    loaded.document,
    binding,
    cameraRig as unknown as EditorSceneCameraRig,
    { expectedSourceId: loaded.source.ref.sourceId, patchCameraField: patchEditorSceneGameObjectField },
  );
  const saved = await saveSceneMainSource(patched.document, { mode: 'local-commit-save' });
  return { ...patched, document: saved.document, saved };
}

const CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET = 0.32;
const CAMERA_DEBUG_TARGET_MARKER_ARM_LENGTH = 0.16;
const CAMERA_DEBUG_TARGET_MARKER_ARM_GAP = 0.02;
const CAMERA_DEBUG_TARGET_MARKER_ARM_HEIGHT = 0.2;
const CAMERA_DEBUG_STORAGE_KEY = 'pa-template.camera-debug.open';
const CAMERA_DEBUG_LANGUAGE_STORAGE_KEY = 'pa-template.camera-debug.language';

export function mountCameraDebugPanel(options: CameraDebugPanelOptions): CameraDebugPanel {
  const root = options.root ?? document.body;
  const host = root.ownerDocument.createElement('div');
  host.id = 'runtime-camera-debug-panel';
  host.setAttribute('aria-label', 'Camera');
  const unmountHost = mountRuntimeDebugPanelContainer(root, host, { placement: 'right-rail' });
  let targetMarker: TransformNode | null = null;

  const panel = mountEditorRuntimeCameraDebugPanel({
    root: host,
    panelMode: 'managed',
    storageKey: CAMERA_DEBUG_STORAGE_KEY,
    languageStorageKey: CAMERA_DEBUG_LANGUAGE_STORAGE_KEY,
    readSnapshot: () => readSnapshot(options.getGame()),
    applyRig: (snapshot, target) => applyRig(options.getGame(), snapshot, target),
    translateCameraOnPlane: input => translateCameraOnPlane(options.getGame(), input),
    saveRig: (binding, rig) => saveRuntimeCameraRigToEditorScene(binding, rig as unknown as SceneCameraRigConfig),
    getCanvas: () => getCameraRenderingCanvas(options.getGame()),
    getViewportRect: () => getCameraViewportRect(options.getGame()),
    projectTargetToScreen: target => projectTargetToScreen(options.getGame(), target),
    createTargetMarker: target => {
      const scene = options.getGame()?.getScene();
      if (!scene) return;
      if (!targetMarker) targetMarker = createTargetMarker(scene);
      targetMarker.position.set(target.x, target.y, target.z);
    },
    disposeTargetMarker: () => {
      targetMarker?.dispose();
      targetMarker = null;
    },
    reloadAfterSave: true,
    placement: {
      width: '100%',
    },
  } as Parameters<typeof mountEditorRuntimeCameraDebugPanel>[0] & { panelMode: 'managed' });

  return {
    dispose() {
      panel.dispose();
      targetMarker?.dispose();
      targetMarker = null;
      unmountHost();
    },
  };
}

function readSnapshot(game: GameWorld | null): CameraDebugSnapshot | null {
  const camera = game?.getCamera();
  if (!camera) return null;
  const binding = readEditorSceneRuntimeCameraBinding(camera.metadata) as EditorSceneRuntimeCameraBinding | null;
  if (!binding) return null;
  const cameraRig = game?.getSceneBuilder()?.getSelectedCameraRig();
  const snapshot = createEditorSceneCameraDebugSnapshot({
    camera: {
      mode: camera.mode,
      alpha: camera.alpha,
      beta: camera.beta,
      radius: camera.radius,
      fov: camera.fov,
      minZ: camera.minZ,
      maxZ: camera.maxZ,
      lowerBetaLimit: camera.lowerBetaLimit,
      upperBetaLimit: camera.upperBetaLimit,
      lowerRadiusLimit: camera.lowerRadiusLimit,
      upperRadiusLimit: camera.upperRadiusLimit,
      inertia: camera.inertia,
      targetScreenOffset: camera.targetScreenOffset,
      orthoTop: camera.orthoTop,
      orthoBottom: camera.orthoBottom,
      target: camera.target,
    },
    selectedRig: cameraRig as EditorSceneCameraRig | null | undefined,
    binding,
  });
  return snapshot?.binding ? snapshot as CameraDebugSnapshot : null;
}

function applyRig(
  game: GameWorld | null,
  snapshot: EditorSceneCameraDebugSnapshot,
  target?: EditorSceneVec3,
): void {
  const camera = game?.getCamera();
  const sceneBuilder = game?.getSceneBuilder();
  if (!camera || !sceneBuilder) return;
  sceneBuilder.applyCameraRig(
    camera,
    toEditorSceneCameraRig(snapshot) as unknown as SceneCameraRigConfig,
    target ? new Vector3(target.x, target.y, target.z) : undefined,
  );
}

function translateCameraOnPlane(
  game: GameWorld | null,
  input: EditorRuntimeCameraDebugPanInput,
): EditorSceneCameraDebugSnapshot | null {
  const camera = game?.getCamera();
  const sceneBuilder = game?.getSceneBuilder();
  if (!camera || !sceneBuilder) return null;
  const cameraRig = sceneBuilder.getSelectedCameraRig();
  const movement = createEditorSceneCameraPanMovement({
    pressedKeys: input.pressedKeys,
    cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    cameraTarget: { x: camera.target.x, y: camera.target.y, z: camera.target.z },
    projection: cameraRig.projection === 'perspective' ? 'perspective' : 'orthographic',
    radius: cameraRig.radius ?? input.snapshot.radius,
    orthoSize: cameraRig.orthoSize ?? input.snapshot.orthoSize,
    deltaSeconds: input.deltaSeconds,
  });
  if (!movement) return null;
  const movementVector = new Vector3(movement.x, movement.y, movement.z);
  camera.position.addInPlace(movementVector);
  camera.target.addInPlace(movementVector);
  const nextTarget = camera.target.clone();
  sceneBuilder.setSelectedCameraTargetOffset(nextTarget);
  const snapshot = readSnapshot(game);
  return snapshot ? cloneEditorSceneCameraDebugSnapshot(snapshot) : null;
}

function getCameraRenderingCanvas(game: GameWorld | null): HTMLCanvasElement | null {
  const canvas = game?.getScene()?.getEngine?.()?.getRenderingCanvas?.() as HTMLCanvasElement | null | undefined;
  return canvas ?? null;
}

function getCameraViewportRect(game: GameWorld | null): { left: number; top: number; width: number; height: number } | null {
  const scene = game?.getScene();
  const camera = game?.getCamera() ?? scene?.activeCamera ?? null;
  const engine = scene?.getEngine?.();
  const canvas = engine?.getRenderingCanvas?.() as HTMLCanvasElement | null | undefined;
  const renderWidth = Math.max(1, Number(engine?.getRenderWidth?.() ?? canvas?.width ?? 0));
  const renderHeight = Math.max(1, Number(engine?.getRenderHeight?.() ?? canvas?.height ?? 0));
  const viewport = camera?.viewport?.toGlobal?.(renderWidth, renderHeight);
  if (!camera || !canvas || !viewport) return null;
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / renderWidth;
  const scaleY = rect.height / renderHeight;
  return {
    left: rect.left + Number(viewport.x ?? 0) * scaleX,
    top: rect.top + Number(viewport.y ?? 0) * scaleY,
    width: Math.max(0, Number(viewport.width ?? renderWidth) * scaleX),
    height: Math.max(0, Number(viewport.height ?? renderHeight) * scaleY),
  };
}

function projectTargetToScreen(
  game: GameWorld | null,
  target: EditorSceneVec3,
): { x: number; y: number; depth: number } | null {
  const scene = game?.getScene();
  const camera = game?.getCamera() ?? scene?.activeCamera ?? null;
  const engine = scene?.getEngine?.();
  const canvas = engine?.getRenderingCanvas?.() as HTMLCanvasElement | null | undefined;
  const viewport = camera?.viewport?.toGlobal?.(
    engine?.getRenderWidth?.() ?? canvas?.width ?? 0,
    engine?.getRenderHeight?.() ?? canvas?.height ?? 0,
  );
  if (!scene || !camera || !canvas || !viewport) return null;

  const rect = canvas.getBoundingClientRect();
  const renderWidth = Math.max(1, Number(engine?.getRenderWidth?.() ?? canvas.width ?? rect.width));
  const renderHeight = Math.max(1, Number(engine?.getRenderHeight?.() ?? canvas.height ?? rect.height));
  const transformMatrix = camera.getViewMatrix(true).multiply(camera.getProjectionMatrix(true));
  const projected = Vector3.Project(
    new Vector3(target.x, target.y, target.z),
    Matrix.Identity(),
    transformMatrix,
    viewport,
  );
  const x = rect.left + Number(projected?.x) * (rect.width / renderWidth);
  const y = rect.top + Number(projected?.y) * (rect.height / renderHeight);
  const depth = Number(projected?.z);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(depth) ? { x, y, depth } : null;
}

function createTargetMarker(scene: NonNullable<ReturnType<GameWorld['getScene']>>): TransformNode {
  const rootNode = new TransformNode('cameraDebugTargetMarker', scene);
  rootNode.metadata = {
    ...(rootNode.metadata && typeof rootNode.metadata === 'object' ? rootNode.metadata : {}),
    disableBlobShadow: true,
    disableStaticProjectedShadow: true,
    disablePlanarShadow: true,
  };
  const material = new StandardMaterial('cameraDebugTargetMarker.material', scene);
  material.diffuseColor = new Color3(1, 0.04, 0.03);
  material.emissiveColor = new Color3(1, 0.04, 0.03);
  material.specularColor = new Color3(0.35, 0.02, 0.02);
  material.disableLighting = true;

  const armDiameter = 0.048;
  const createArm = (name: string, position: Vector3, rotation: Vector3, height = CAMERA_DEBUG_TARGET_MARKER_ARM_LENGTH): void => {
    const arm = MeshBuilder.CreateCylinder(name, {
      height,
      diameter: armDiameter,
      tessellation: 8,
    }, scene);
    arm.parent = rootNode;
    arm.position.copyFrom(position);
    arm.rotation.copyFrom(rotation);
    arm.material = material;
    arm.isPickable = false;
    arm.renderingGroupId = 2;
    arm.metadata = {
      ...(arm.metadata && typeof arm.metadata === 'object' ? arm.metadata : {}),
      disableBlobShadow: true,
      disableStaticProjectedShadow: true,
      disablePlanarShadow: true,
    };
  };

  const centerDistance = CAMERA_DEBUG_TARGET_MARKER_ARM_GAP + CAMERA_DEBUG_TARGET_MARKER_ARM_LENGTH / 2;
  createArm('cameraDebugTargetMarker.arm.x.positive', new Vector3(centerDistance, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, 0), new Vector3(0, 0, Math.PI / 2));
  createArm('cameraDebugTargetMarker.arm.x.negative', new Vector3(-centerDistance, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, 0), new Vector3(0, 0, Math.PI / 2));
  createArm('cameraDebugTargetMarker.arm.z.positive', new Vector3(0, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, centerDistance), new Vector3(Math.PI / 2, 0, 0));
  createArm('cameraDebugTargetMarker.arm.z.negative', new Vector3(0, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, -centerDistance), new Vector3(Math.PI / 2, 0, 0));
  createArm('cameraDebugTargetMarker.arm.y', new Vector3(0, CAMERA_DEBUG_TARGET_MARKER_Y_OFFSET, 0), new Vector3(0, 0, 0), CAMERA_DEBUG_TARGET_MARKER_ARM_HEIGHT);

  return rootNode;
}
