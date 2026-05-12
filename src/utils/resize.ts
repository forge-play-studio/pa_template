import type { Engine } from '@babylonjs/core/Engines/engine';

/**
 * Keep the WebGL canvas in sync with its CSS box and the device DPR.
 * Handles desktop window resize, mobile orientation change, and the iOS
 * URL bar collapse/expand.
 */
export function attachResize(engine: Engine, canvas: HTMLCanvasElement): () => void {
  const apply = () => {
    canvas.width = canvas.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.clientHeight * window.devicePixelRatio;
    engine.resize();
  };

  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);

  const ro = new ResizeObserver(apply);
  ro.observe(canvas);

  return () => {
    window.removeEventListener('resize', apply);
    window.removeEventListener('orientationchange', apply);
    ro.disconnect();
  };
}
