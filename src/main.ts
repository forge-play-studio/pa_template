import { Engine } from '@babylonjs/core/Engines/engine';
import { Game } from './game';
import { attachResize } from './utils/resize';
import { mountCTA } from './ui/cta';
import { mountEndCard } from './ui/end-card';

const CTA_URL = 'https://play.google.com/store/apps/details?id=YOUR_APP';

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
if (!canvas) throw new Error('renderCanvas not found');

const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
  adaptToDeviceRatio: true,
});

const game = new Game(engine, canvas);
game.scene.whenReadyAsync().then(() => game.start());

const cta = mountCTA({ url: CTA_URL });
const endCard = mountEndCard({
  ctaUrl: CTA_URL,
  onRetry: () => game.reset(),
});

game.events.on('win', () => endCard.show('success'));
game.events.on('lose', () => endCard.show('fail'));

engine.runRenderLoop(() => game.scene.render());

attachResize(engine, canvas);

cta.attach(document.getElementById('app')!);
endCard.attach(document.getElementById('app')!);
