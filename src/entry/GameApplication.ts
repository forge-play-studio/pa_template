import { GameWorld } from '../runtime/GameWorld';
import { playableAnalyticsService } from '../services';
import { LoadingScreen } from '../ui';

type SceneWalkthroughHandle = { dispose(): void };

/** Production-safe owner for one complete gameplay application session. */
export class GameApplication {
  private loadingScreen: LoadingScreen | null = null;
  private worldValue: GameWorld | null = null;
  private sceneWalkthrough: SceneWalkthroughHandle | null = null;

  get world(): GameWorld | null {
    return this.worldValue;
  }

  async start(): Promise<GameWorld> {
    if (this.worldValue) throw new Error('GameApplication has already started.');

    playableAnalyticsService.resetForNewSession();
    playableAnalyticsService.reportInitPlayable();
    this.loadingScreen = new LoadingScreen();

    const world = new GameWorld({
      canvasId: 'renderCanvas',
      enableAudio: true,
    });
    this.worldValue = world;

    try {
      await world.init();
      playableAnalyticsService.reportLoaded();
      this.loadingScreen.hide();
      world.start();

      window.requestAnimationFrame(() => {
        playableAnalyticsService.reportDisplay();
        playableAnalyticsService.reportProgressMilestone(0);
      });

      if (__SCENE_WALKTHROUGH_BUILD__) {
        const { mountSceneWalkthrough } = await import('../test-build/scene-walkthrough');
        this.sceneWalkthrough = mountSceneWalkthrough(world);
      }
      return world;
    } catch (error) {
      try {
        await this.destroy();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'GameApplication startup and cleanup failed.',
        );
      }
      throw error;
    }
  }

  async destroy(): Promise<void> {
    const errors: unknown[] = [];

    const walkthrough = this.sceneWalkthrough;
    this.sceneWalkthrough = null;
    try {
      walkthrough?.dispose();
    } catch (error) {
      errors.push(error);
    }

    const world = this.worldValue;
    this.worldValue = null;
    try {
      await world?.destroy();
    } catch (error) {
      errors.push(error);
    }

    const loadingScreen = this.loadingScreen;
    this.loadingScreen = null;
    try {
      loadingScreen?.dispose();
    } catch (error) {
      errors.push(error);
    }

    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'GameApplication cleanup failed.');
  }
}
