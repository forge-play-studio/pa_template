import { Matrix } from '@babylonjs/core/Maths/math.vector';
import type { Position3D, SceneAssetConfig } from '../../../config';
import type { ProjectEditorPluginContext } from '../../../fps-game-editor-adapter/types';

export interface RuntimeDropInput {
  dropSurfaceName?: string;
  clientX?: number;
  clientY?: number;
  position?: Position3D;
}

export interface RuntimeAssetAdapter {
  resolveDropPosition(input: RuntimeDropInput, context?: ProjectEditorPluginContext): Position3D;
  prepareRuntimeAsset(
    asset: SceneAssetConfig,
    assetUrl: string | undefined,
    context?: ProjectEditorPluginContext,
  ): Promise<void>;
}

export const babylonRuntimeAssetAdapter: RuntimeAssetAdapter = {
  resolveDropPosition(input, context) {
    const explicit = readPosition(input.position);
    if (explicit) return explicit;

    const clientX = readNumber(input.clientX);
    const clientY = readNumber(input.clientY);
    const scene = (context?.scene as any) ?? (context?.game as any)?.scene ?? null;
    if (scene && clientX != null && clientY != null) {
      const pointer = normalizePointerCoordinates(scene, clientX, clientY);
      const picked = scene.pick?.(pointer.x, pointer.y, (mesh: any) => isPlaceablePickMesh(mesh, input));
      if (picked?.hit && picked.pickedPoint) {
        return { x: picked.pickedPoint.x, y: picked.pickedPoint.y, z: picked.pickedPoint.z };
      }

      const camera = scene.activeCamera;
      const ray = camera ? scene.createPickingRay?.(pointer.x, pointer.y, Matrix.Identity(), camera) : null;
      if (ray && Math.abs(ray.direction.y) > 0.00001) {
        const distance = -ray.origin.y / ray.direction.y;
        const point = ray.origin.add(ray.direction.scale(distance));
        return { x: point.x, y: 0, z: point.z };
      }
    }

    return { x: 0, y: 0, z: 0 };
  },

  async prepareRuntimeAsset(asset, assetUrl, context) {
    const sceneBuilder = getSceneBuilder(context);
    if (!sceneBuilder) return;
    if (assetUrl) {
      sceneBuilder.registerRuntimeModelUrl?.(asset.id, assetUrl);
    }
    if (sceneBuilder.preloadSceneAsset) {
      await sceneBuilder.preloadSceneAsset(asset);
    }
  },
};

function getSceneBuilder(context?: ProjectEditorPluginContext): any | null {
  const game = context?.game as any;
  return game?.getSceneBuilder?.() ?? game?.sceneBuilder ?? null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readPosition(value: unknown): Position3D | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const x = readNumber(record.x);
  const y = readNumber(record.y);
  const z = readNumber(record.z);
  if (x == null || y == null || z == null) return null;
  return { x, y, z };
}

function normalizePointerCoordinates(scene: any, clientX: number, clientY: number): { x: number; y: number } {
  const canvas = scene?.getEngine?.()?.getRenderingCanvas?.() ?? null;
  const rect = canvas?.getBoundingClientRect?.();
  if (!rect) return { x: clientX, y: clientY };
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function isPlaceablePickMesh(mesh: any, input: RuntimeDropInput): boolean {
  if (!mesh) return false;
  const metadata = mesh.metadata ?? {};
  if (metadata.nonPlaceable === true || metadata.editorOnly === true) return false;
  if (input.dropSurfaceName) return mesh.name === input.dropSurfaceName || mesh.id === input.dropSurfaceName;
  if (metadata.placeable === true || metadata.dropSurface === true) return true;
  const name = String(mesh.name ?? mesh.id ?? '').toLowerCase();
  return name.includes('ground')
    || name.includes('floor')
    || name.includes('plane')
    || name.includes('diban')
    || name.includes('surface');
}
