import { Engine, Scene } from '@babylonjs/core';
import {
  createBabylonEnvironmentTextureController,
  createPlayableAssetResourceResolver,
} from '@fps-games/editor/playable-sdk';
import photoStudioUrl from '../fixtures/photoStudio.env?url';

const expected = Object.freeze({ format: '.env', intensity: 0.73, rotationY: 0.21 });
const fixtureAssetId = 'texture_issue565_photo_studio_env';
const evidenceElement = document.querySelector<HTMLPreElement>('#inline-environment-texture-evidence');
const canvas = document.querySelector<HTMLCanvasElement>('#smoke-canvas');

if (!evidenceElement || !canvas) {
  throw new Error('Inline environment texture smoke page is missing its required DOM elements.');
}

function publish(evidence: Record<string, unknown>): void {
  evidenceElement.textContent = JSON.stringify(evidence);
  document.documentElement.dataset.inlineEnvironmentTextureStatus = String(evidence.status ?? 'unknown');
}

async function run(): Promise<void> {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true });
  const scene = new Scene(engine);

  try {
    // This uses the public packed editor contract, matching the production
    // route that obtains Data-URL format from the generated catalog rather
    // than guessing it from the URL.
    const resolution = createPlayableAssetResourceResolver({
      [fixtureAssetId]: {
        assetId: fixtureAssetId,
        url: photoStudioUrl,
        format: expected.format,
        relativePath: '../fixtures/photoStudio.env',
        originalFileName: 'photoStudio.env',
      },
    }).resolve({ assetId: fixtureAssetId });
    if (!resolution.ok) throw new Error(`Resource resolution failed: ${resolution.diagnostic.code}`);
    const resource = resolution.resource;
    const environment = createBabylonEnvironmentTextureController(scene);
    await environment.applyProfile({
      texture: resource,
      intensity: expected.intensity,
      rotationY: expected.rotationY,
    });
    const texture = environment.getTexture();
    if (!texture) throw new Error('Babylon environment texture controller committed no texture.');
    publish({
      status: 'ready', transport: resource.transport, format: resource.format, forcedExtension: texture.forcedExtension,
      environmentTexturePresent: scene.environmentTexture !== null, ready: texture.isReady(),
      size: texture.getSize().width, intensity: texture.level, rotationY: texture.rotationY,
    });
  } catch (error) {
    publish({
      status: 'failed', transport: photoStudioUrl.startsWith('data:') ? 'data-url' : 'path-url', format: expected.format,
      error: error instanceof Error ? error.message.slice(0, 240) : 'Unknown environment texture error.',
    });
  }
}

void run();
