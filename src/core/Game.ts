/**
 * @deprecated Import GameWorld from ../runtime/GameWorld in new code.
 * Kept as a thin project compatibility surface while existing playables migrate.
 */
export { GameWorld, GameWorld as Game } from '../runtime/GameWorld';
export type {
  GameWorldOptions,
  GameWorldOptions as GameOptions,
  GameWorldState,
} from '../runtime/GameWorld';
