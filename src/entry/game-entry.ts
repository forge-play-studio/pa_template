import { GameApplication } from './GameApplication';
import { playableAnalyticsService } from '../services';

let application: GameApplication | null = null;
let startPromise: Promise<void> | null = null;

function hasRenderCanvas(): boolean {
  return document.getElementById('renderCanvas') instanceof HTMLCanvasElement;
}

async function startApplication(): Promise<void> {
  const nextApplication = new GameApplication();
  application = nextApplication;
  try {
    await nextApplication.start();
  } catch (error) {
    if (application === nextApplication) application = null;
    console.error('[GameEntry] Failed to initialize gameplay:', error);
  }
}

function startOnce(): Promise<void> {
  if (startPromise) return startPromise;
  if (!hasRenderCanvas()) return Promise.resolve();
  startPromise = startApplication();
  return startPromise;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void startOnce(), { once: true });
  queueMicrotask(() => void startOnce());
} else {
  void startOnce();
}

const reportCompleted = (): void => playableAnalyticsService.reportCompleted();
window.addEventListener('beforeunload', reportCompleted);
window.addEventListener('pagehide', reportCompleted);
