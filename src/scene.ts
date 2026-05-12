import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import type { Engine } from '@babylonjs/core/Engines/engine';

export function buildScene(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.08, 0.12, 1);

  const camera = new ArcRotateCamera(
    'camera',
    -Math.PI / 2,
    Math.PI / 3,
    8,
    Vector3.Zero(),
    scene,
  );
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 20;

  new HemisphericLight('hemi', new Vector3(0, 1, 0), scene).intensity = 0.6;
  const dir = new DirectionalLight('dir', new Vector3(-0.5, -1, -0.5), scene);
  dir.intensity = 0.8;

  // 占位舞台：地面 + 主角立方体。替换成你的游戏内容。
  const ground = MeshBuilder.CreateGround('ground', { width: 20, height: 20 }, scene);
  const groundMat = new StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = new Color3(0.15, 0.2, 0.28);
  ground.material = groundMat;

  const hero = MeshBuilder.CreateBox('hero', { size: 1.5 }, scene);
  hero.position.y = 0.75;
  const heroMat = new StandardMaterial('heroMat', scene);
  heroMat.diffuseColor = new Color3(0.9, 0.4, 0.2);
  hero.material = heroMat;

  return scene;
}
