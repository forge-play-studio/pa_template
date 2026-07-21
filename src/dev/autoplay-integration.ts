import type { GameWorld } from '../runtime/GameWorld';

const GENERATED_INTEGRATION_PATH = '/.game-replay/generated/integration.ts';
const AUTOPLAY_MODE_PARAMS = ['rrRecord', 'rrReplay', 'rrAuto'] as const;

export interface GeneratedAutoplayIntegrationHandle {
  dispose(): void | Promise<void>;
}

type GeneratedAutoplayIntegration = GeneratedAutoplayIntegrationHandle | (() => void | Promise<void>);

type GeneratedAutoplayIntegrationModule = {
  installGeneratedGameReplay(
    game: GameWorld,
  ): GeneratedAutoplayIntegration | Promise<GeneratedAutoplayIntegration>;
};

export function hasAutoplayMode(search: string): boolean {
  const params = new URLSearchParams(search);
  return AUTOPLAY_MODE_PARAMS.some(key => params.get(key) === '1');
}

export async function mountGeneratedAutoplayIntegration(
  game: GameWorld,
): Promise<GeneratedAutoplayIntegrationHandle | null> {
  if (!hasAutoplayMode(window.location.search)) return null;

  let generatedModule: GeneratedAutoplayIntegrationModule;
  try {
    generatedModule = await import(
      /* @vite-ignore */ GENERATED_INTEGRATION_PATH
    ) as GeneratedAutoplayIntegrationModule;
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(
      `Autoplay mode requires .game-replay/generated/integration.ts. Run the autoplay Skill before opening this URL.${detail}`,
    );
  }

  if (typeof generatedModule.installGeneratedGameReplay !== 'function') {
    throw new Error(
      'Generated autoplay integration must export installGeneratedGameReplay(game).',
    );
  }

  const installed = await generatedModule.installGeneratedGameReplay(game);
  if (typeof installed === 'function') return { dispose: installed };
  if (!installed || typeof installed.dispose !== 'function') {
    throw new Error('installGeneratedGameReplay(game) must return a disposable handle.');
  }
  return installed;
}
