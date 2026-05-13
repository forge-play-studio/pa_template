import { ProjectEditorInput } from './input-controller';
import type { RuntimeCamera, RuntimeNode, RuntimeScene } from './types';

const DEFAULT_VIEWPORT_CAMERA_SPEED = 4;
const MIN_VIEWPORT_CAMERA_SPEED = 0.5;
const MAX_VIEWPORT_CAMERA_SPEED = 32;
const WHEEL_DOLLY_STEP = 1.2;
const MMB_PAN_SENSITIVITY = 0.01;

export interface ProjectViewportCameraCtx {
  camera: RuntimeCamera;
  canvas: HTMLCanvasElement | null;
  renderObs: any;
  onContextMenu: ((e: Event) => void) | null;
  onWheel: ((e: WheelEvent) => void) | null;
  speed: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function removeWheelInput(camera: any): void {
  const attached = camera?.inputs?.attached;
  if (!attached || !camera?.inputs?.remove) return;
  for (const input of Object.values(attached) as any[]) {
    const name = input?.getClassName?.() || input?.constructor?.name || '';
    if (!/wheel/i.test(String(name))) continue;
    try { camera.inputs.remove(input); } catch {}
  }
}

function getCameraForward(camera: any, scene: RuntimeScene | null | undefined, Vector3Ctor: any): any | null {
  if (!camera?.getDirection || !Vector3Ctor) return null;
  const forwardZ = scene?.useRightHandedSystem ? -1 : 1;
  return camera.getDirection(new Vector3Ctor(0, 0, forwardZ));
}

export async function createProjectViewportCamera(
  scene: RuntimeScene,
  sourceCamera: RuntimeCamera | null,
): Promise<ProjectViewportCameraCtx | null> {
  let UniversalCamera: any;
  let Vector3: any;
  if ((window as any).BABYLON?.UniversalCamera) {
    ({ UniversalCamera, Vector3 } = (window as any).BABYLON);
  }
  if (!UniversalCamera || !Vector3) return null;

  const canvas = scene?.getEngine?.()?.getRenderingCanvas?.() ?? null;
  const src = sourceCamera as any;
  const startPos = src?.globalPosition?.clone?.()
    || src?.position?.clone?.()
    || new Vector3(0, 5, -10);
  const startTarget = src?.getTarget?.()
    || src?.target?.clone?.()
    || new Vector3(0, 0, 0);

  const camera = new UniversalCamera('ProjectEditorCamera', startPos, scene) as RuntimeCamera & any;
  camera.setTarget(startTarget);
  camera.fov = src?.fov ?? camera.fov;
  camera.minZ = src?.minZ ?? camera.minZ;
  camera.maxZ = src?.maxZ ?? camera.maxZ;
  camera.inertia = 0;
  camera.angularSensibility = 1000;
  camera.speed = DEFAULT_VIEWPORT_CAMERA_SPEED;

  const kbInput = camera.inputs?.attached?.keyboard;
  if (kbInput) camera.inputs.remove(kbInput);
  removeWheelInput(camera);
  const mouseInput = camera.inputs?.attached?.mouse;
  if (mouseInput) mouseInput.buttons = [2];

  let onContextMenu: ((e: Event) => void) | null = null;
  let onWheel: ((e: WheelEvent) => void) | null = null;
  const ctx: ProjectViewportCameraCtx = {
    camera,
    canvas,
    renderObs: null,
    onContextMenu,
    onWheel,
    speed: DEFAULT_VIEWPORT_CAMERA_SPEED,
  };

  if (canvas) {
    camera.attachControl(canvas, true);
    onContextMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', onContextMenu);
    onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const Vector3Ctor = (window as any).BABYLON?.Vector3;
      if (!Vector3Ctor) return;
      const activeButton = ProjectEditorInput.activeViewportNavigationButton();
      if (activeButton === 'right') {
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        ctx.speed = clamp(ctx.speed * factor, MIN_VIEWPORT_CAMERA_SPEED, MAX_VIEWPORT_CAMERA_SPEED);
        camera.speed = ctx.speed;
        return;
      }
      const forward = getCameraForward(camera, scene, Vector3Ctor);
      if (!forward || !camera.position) return;
      const direction = e.deltaY < 0 ? 1 : -1;
      camera.position.x += forward.x * WHEEL_DOLLY_STEP * direction;
      camera.position.y += forward.y * WHEEL_DOLLY_STEP * direction;
      camera.position.z += forward.z * WHEEL_DOLLY_STEP * direction;
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    ctx.onContextMenu = onContextMenu;
    ctx.onWheel = onWheel;
  }

  return ctx;
}

export function attachProjectViewportMovement(scene: RuntimeScene, ctx: ProjectViewportCameraCtx): any {
  if (ctx.renderObs) return ctx.renderObs;
  const camera = ctx.camera as any;
  const Vector3 = (window as any).BABYLON?.Vector3;
  if (!camera || !Vector3) return null;

  ctx.renderObs = scene.onBeforeRenderObservable.add(() => {
    const activeButton = ProjectEditorInput.activeViewportNavigationButton();
    const pointerDelta = ProjectEditorInput.consumeViewportPointerDelta();
    if (activeButton === 'middle' && (pointerDelta.dx || pointerDelta.dy)) {
      const right = camera.getDirection?.(new Vector3(1, 0, 0));
      const up = camera.getDirection?.(new Vector3(0, 1, 0));
      if (right && up) {
        camera.position.x += (-pointerDelta.dx * MMB_PAN_SENSITIVITY) * right.x + (-pointerDelta.dy * MMB_PAN_SENSITIVITY) * up.x;
        camera.position.y += (-pointerDelta.dx * MMB_PAN_SENSITIVITY) * right.y + (-pointerDelta.dy * MMB_PAN_SENSITIVITY) * up.y;
        camera.position.z += (-pointerDelta.dx * MMB_PAN_SENSITIVITY) * right.z + (-pointerDelta.dy * MMB_PAN_SENSITIVITY) * up.z;
      }
    }

    const pressed = ProjectEditorInput.pressedViewportMovementKeys();
    if (!ProjectEditorInput.isViewportNavigationActive() || !pressed.size) return;
    const dt = scene.getEngine().getDeltaTime() / 1000;
    const step = ctx.speed * dt;
    let lx = 0;
    let ly = 0;
    let lz = 0;
    for (const key of pressed) {
      if (key === 'w') lz += 1;
      else if (key === 's') lz -= 1;
      else if (key === 'a') lx -= 1;
      else if (key === 'd') lx += 1;
      else if (key === 'q') ly -= 1;
      else if (key === 'e') ly += 1;
    }
    if (!lx && !ly && !lz) return;
    const len = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
    lx = lx / len * step;
    ly = ly / len * step;
    lz = lz / len * step;
    const fwd = getCameraForward(camera, scene, Vector3);
    const right = camera.getDirection?.(new Vector3(1, 0, 0));
    if (!fwd || !right) return;
    camera.position.x += right.x * lx + fwd.x * lz;
    camera.position.y += right.y * lx + fwd.y * lz + ly;
    camera.position.z += right.z * lx + fwd.z * lz;
  });
  return ctx.renderObs;
}

export function disposeProjectViewportCamera(scene: RuntimeScene, ctx: ProjectViewportCameraCtx | null): void {
  if (!ctx) return;
  if (ctx.renderObs) {
    scene.onBeforeRenderObservable.remove(ctx.renderObs);
    ctx.renderObs = null;
  }
  if (ctx.canvas && ctx.onContextMenu) {
    ctx.canvas.removeEventListener('contextmenu', ctx.onContextMenu);
  }
  if (ctx.canvas && ctx.onWheel) {
    ctx.canvas.removeEventListener('wheel', ctx.onWheel);
  }
  ctx.onContextMenu = null;
  ctx.onWheel = null;
  try { (ctx.camera as any)?.detachControl?.(); } catch {}
  try { (ctx.camera as any)?.dispose?.(); } catch {}
}

export function focusProjectViewportSelection(camera: RuntimeCamera | null, node: RuntimeNode | null): boolean {
  const editorCamera = camera as any;
  if (!editorCamera || !node) return false;
  try {
    let cx: number;
    let cy: number;
    let cz: number;
    let radius: number;
    const hbv = (node as any).getHierarchyBoundingVectors?.();
    if (hbv) {
      cx = (hbv.min.x + hbv.max.x) / 2;
      cy = (hbv.min.y + hbv.max.y) / 2;
      cz = (hbv.min.z + hbv.max.z) / 2;
      const dx = hbv.max.x - hbv.min.x;
      const dy = hbv.max.y - hbv.min.y;
      const dz = hbv.max.z - hbv.min.z;
      radius = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2;
    } else if ((node as any).absolutePosition || (node as any).position) {
      const p = (node as any).absolutePosition || (node as any).position;
      cx = p.x;
      cy = p.y;
      cz = p.z;
      radius = 2;
    } else {
      return false;
    }

    const Vector3 = (window as any).BABYLON?.Vector3;
    const dist = Math.max(radius * 2.5, 2);
    const scene = (editorCamera.getScene?.() as RuntimeScene | undefined) ?? ((node as any).getScene?.() as RuntimeScene | undefined);
    const dir = Vector3 ? getCameraForward(editorCamera, scene, Vector3) : null;
    if (dir && editorCamera.position) {
      editorCamera.position.x = cx - dir.x * dist;
      editorCamera.position.y = cy - dir.y * dist;
      editorCamera.position.z = cz - dir.z * dist;
    }
    if (typeof editorCamera.setTarget === 'function' && Vector3) {
      editorCamera.setTarget(new Vector3(cx, cy, cz));
      return true;
    }
    if (editorCamera.target?.copyFromFloats) editorCamera.target.copyFromFloats(cx, cy, cz);
    else if (editorCamera.target) {
      editorCamera.target.x = cx;
      editorCamera.target.y = cy;
      editorCamera.target.z = cz;
    }
    editorCamera.radius = dist;
    return true;
  } catch {}
  return false;
}
