import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArcRotateCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import ts from 'typescript';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(projectRoot, 'src/test-build/scene-walkthrough.ts');
const source = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`;
const { KeyboardWalkthroughInput } = await import(moduleUrl);

const playerSourcePath = resolve(projectRoot, 'src/entities/SimplePlayer.ts');
const playerSource = await readFile(playerSourcePath, 'utf8');
const playerTranspiled = ts.transpileModule(playerSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: playerSourcePath,
});
const playerOutput = playerTranspiled.outputText.replace(
  "import { Vector3 } from '@babylonjs/core/Maths/math.vector';",
  'const { Vector3 } = globalThis.__sceneWalkthroughTestBabylon;',
);
assert.notEqual(playerOutput, playerTranspiled.outputText, 'SimplePlayer Vector3 import replacement failed');
globalThis.__sceneWalkthroughTestBabylon = { Vector3 };
const playerModuleUrl = `data:text/javascript;base64,${Buffer.from(playerOutput).toString('base64')}`;
const { SimplePlayer } = await import(playerModuleUrl);

function checkKeyboardContract(InputType) {
  const ownerWindow = new FakeEventTarget();
  const ownerDocument = new FakeEventTarget();
  ownerDocument.visibilityState = 'visible';
  const input = new InputType(ownerWindow, ownerDocument);

  assert.equal(ownerWindow.listenerCount('keydown'), 1, 'keydown listener must be installed');
  assert.equal(ownerWindow.listenerCount('keyup'), 1, 'keyup listener must be installed');

  let event = dispatchKey(ownerWindow, 'keydown', 'a');
  assertMovement(input, { x: -1, y: 0, active: true }, 'A must mean screen-left');
  assert.equal(event.defaultPrevented, true, 'handled A must prevent the browser default');
  dispatchKey(ownerWindow, 'keyup', 'a');

  dispatchKey(ownerWindow, 'keydown', 'd');
  assertMovement(input, { x: 1, y: 0, active: true }, 'D must mean screen-right');
  dispatchKey(ownerWindow, 'keyup', 'd');

  dispatchKey(ownerWindow, 'keydown', 'w');
  assertMovement(input, { x: 0, y: 1, active: true }, 'W must mean screen-forward');
  dispatchKey(ownerWindow, 'keyup', 'w');

  dispatchKey(ownerWindow, 'keydown', 's');
  assertMovement(input, { x: 0, y: -1, active: true }, 'S must mean screen-backward');
  dispatchKey(ownerWindow, 'keyup', 's');

  event = dispatchKey(ownerWindow, 'keydown', 'w', new FakeInputElement());
  assertMovement(input, { x: 0, y: 0, active: false }, 'editable targets must ignore WASD');
  assert.equal(event.defaultPrevented, false, 'ignored editable input must keep its browser default');

  dispatchKey(ownerWindow, 'keydown', 'd');
  ownerWindow.dispatch('blur');
  assertMovement(input, { x: 0, y: 0, active: false }, 'window blur must clear pressed keys');

  dispatchKey(ownerWindow, 'keydown', 'w');
  ownerDocument.visibilityState = 'hidden';
  ownerDocument.dispatch('visibilitychange');
  assertMovement(input, { x: 0, y: 0, active: false }, 'hidden document must clear pressed keys');

  input.dispose();
  assert.equal(ownerWindow.listenerCount('keydown'), 0, 'dispose must remove keydown listener');
  assert.equal(ownerWindow.listenerCount('keyup'), 0, 'dispose must remove keyup listener');
  dispatchKey(ownerWindow, 'keydown', 'd');
  assertMovement(input, { x: 0, y: 0, active: false }, 'disposed input must remain inactive');
}

function checkDevServeGate() {
  const viteCli = resolve(projectRoot, 'node_modules/vite/bin/vite.js');
  const result = spawnSync(process.execPath, [
    viteCli,
    '--host',
    '127.0.0.1',
    '--port',
    '41739',
    '--strictPort',
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 5000,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BUILD_MATRIX: 'false',
      SCENE_WALKTHROUGH_BUILD: 'true',
    },
  });

  assert.notEqual(result.error?.code, 'ETIMEDOUT', 'spoofed production dev server started instead of being rejected');
  assert.notEqual(result.status, 0, 'spoofed production dev server must fail');
  assert.match(
    `${result.stdout}\n${result.stderr}`,
    /SCENE_WALKTHROUGH_BUILD is only valid for the dedicated non-matrix production build command/,
    'dev rejection must come from the scene walkthrough build gate',
  );
}

function checkPlayerCameraMapping(PlayerType) {
  const engine = new NullEngine({ renderWidth: 1, renderHeight: 1 });
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;

  try {
    for (const alpha of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const camera = new ArcRotateCamera('walkthrough-contract-camera', alpha, Math.PI / 3, 10, Vector3.Zero(), scene);
      scene.activeCamera = camera;
      const cameraRight = camera.getDirection(Vector3.Right());
      cameraRight.y = 0;
      cameraRight.normalize();

      const dPlayer = createPlayer(PlayerType, scene, 1);
      dPlayer.update(1);
      assert.ok(
        Vector3.Dot(dPlayer.position, cameraRight) > 0.999,
        `D must move toward camera-right at alpha ${alpha}`,
      );

      const aPlayer = createPlayer(PlayerType, scene, -1);
      aPlayer.update(1);
      assert.ok(
        Vector3.Dot(aPlayer.position, cameraRight) < -0.999,
        `A must move toward camera-left at alpha ${alpha}`,
      );

      camera.dispose();
    }
  } finally {
    scene.dispose();
    engine.dispose();
  }
}

function createPlayer(PlayerType, scene, screenX) {
  return new PlayerType(scene, {
    getInput() {
      return { x: screenX, y: 0, magnitude: 1, isActive: true };
    },
  }, {
    position: Vector3.Zero(),
    speed: 1,
  });
}

function assertMovement(input, expected, message) {
  const actual = input.getInput();
  assert.equal(actual.x, expected.x, `${message}: unexpected x`);
  assert.equal(actual.y, expected.y, `${message}: unexpected y`);
  assert.equal(actual.isActive, expected.active, `${message}: unexpected active state`);
}

function dispatchKey(target, type, key, eventTarget = null) {
  const event = {
    key,
    target: eventTarget,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  target.dispatch(type, event);
  return event;
}

function installDomTypeStubs() {
  globalThis.HTMLElement = FakeHTMLElement;
  globalThis.HTMLInputElement = FakeInputElement;
  globalThis.HTMLTextAreaElement = FakeTextAreaElement;
  globalThis.HTMLSelectElement = FakeSelectElement;
}

class FakeEventTarget {
  listeners = new Map();

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event);
      else listener.handleEvent(event);
    }
  }

  listenerCount(type) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

class FakeHTMLElement {
  isContentEditable = false;
}

class FakeInputElement extends FakeHTMLElement {}
class FakeTextAreaElement extends FakeHTMLElement {}
class FakeSelectElement extends FakeHTMLElement {}

installDomTypeStubs();
checkKeyboardContract(KeyboardWalkthroughInput);
checkPlayerCameraMapping(SimplePlayer);
checkDevServeGate();

console.log('[check-scene-walkthrough-contract] keyboard, camera movement, and build-gate contracts passed');
