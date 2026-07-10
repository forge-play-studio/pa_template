import type { Scene } from '@babylonjs/core/scene';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { getModelPathAndFileAsync } from '../assets';

function getPluginExtension(pathInfo: { isDataUrl: boolean; isCompressed: boolean }): '.glb' | undefined {
  return pathInfo.isDataUrl || pathInfo.isCompressed ? '.glb' : undefined;
}

export async function importGlbMeshesFromUrlAsync(scene: Scene, url: string) {
  const pathInfo = await getModelPathAndFileAsync(url);
  return SceneLoader.ImportMeshAsync(
    '',
    pathInfo.path,
    pathInfo.filename,
    scene,
    undefined,
    getPluginExtension(pathInfo),
  );
}

export async function loadGlbContainerFromUrlAsync(scene: Scene, url: string) {
  const pathInfo = await getModelPathAndFileAsync(url);
  return SceneLoader.LoadAssetContainerAsync(
    pathInfo.path,
    pathInfo.filename,
    scene,
    undefined,
    getPluginExtension(pathInfo),
  );
}
