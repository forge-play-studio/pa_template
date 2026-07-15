/**
 * ModelAnimationService - GLB / glTF model clip playback entry.
 *
 * The project only triggers play/stop. Babylon advances AnimationGroup state
 * during Scene.render(); runtime transform motion belongs to gameplay systems.
 */

import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';

export interface ModelAnimationPlayOptions {
  /** Whether the clip loops. */
  loop?: boolean;
  /** Babylon animation speed ratio. */
  speedRatio?: number;
  /** Optional authored start frame. */
  from?: number;
  /** Optional authored end frame. */
  to?: number;
}

export interface ModelAnimationPlayer {
  play(
    animations: readonly AnimationGroup[],
    clipName: string,
    options?: ModelAnimationPlayOptions,
  ): AnimationGroup | null;
  stop(animations: readonly AnimationGroup[], clipName?: string): void;
}

interface ClipIndex {
  readonly byExactName: Map<string, AnimationGroup | null>;
}

const clipIndexes = new WeakMap<readonly AnimationGroup[], ClipIndex>();

function normalizeClipName(name: string): string {
  return name.trim().toLowerCase();
}

function getClipIndex(animations: readonly AnimationGroup[]): ClipIndex {
  const cached = clipIndexes.get(animations);
  if (cached) return cached;

  const byExactName = new Map<string, AnimationGroup | null>();
  for (const animation of animations) {
    const key = normalizeClipName(animation.name);
    if (!key) continue;
    if (byExactName.has(key)) {
      byExactName.set(key, null);
    } else {
      byExactName.set(key, animation);
    }
  }

  const index = { byExactName };
  clipIndexes.set(animations, index);
  return index;
}

function findExactClip(
  animations: readonly AnimationGroup[],
  clipName: string,
): AnimationGroup | null {
  const key = normalizeClipName(clipName);
  if (!key || animations.length === 0) return null;
  return getClipIndex(animations).byExactName.get(key) ?? null;
}

function finiteOrUndefined(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

function resetClip(animation: AnimationGroup): void {
  if (animation.isStarted) animation.stop(true);
  animation.weight = -1;
  animation.speedRatio = 1;
  animation.loopAnimation = false;
}

/**
 * Stateless project-facing adapter for independently instantiated model clips.
 * Its public surface intentionally contains only play and stop.
 */
export class ModelAnimationService implements ModelAnimationPlayer {
  play(
    animations: readonly AnimationGroup[],
    clipName: string,
    options: ModelAnimationPlayOptions = {},
  ): AnimationGroup | null {
    const animation = findExactClip(animations, clipName);
    if (!animation) return null;

    for (const other of animations) {
      if (other !== animation) resetClip(other);
    }

    const loop = options.loop ?? true;
    const speedRatio = options.speedRatio !== undefined && Number.isFinite(options.speedRatio)
      ? options.speedRatio
      : 1;
    const from = finiteOrUndefined(options.from);
    const to = finiteOrUndefined(options.to);

    animation.weight = -1;
    animation.speedRatio = speedRatio;

    if (animation.isStarted && (from !== undefined || to !== undefined)) {
      animation.stop(true);
    }

    if (animation.isStarted) {
      animation.loopAnimation = loop;
      if (!animation.isPlaying) animation.play(loop);
      return animation;
    }

    animation.start(loop, speedRatio, from, to);
    return animation;
  }

  stop(animations: readonly AnimationGroup[], clipName?: string): void {
    if (clipName !== undefined) {
      const animation = findExactClip(animations, clipName);
      if (animation) resetClip(animation);
      return;
    }

    for (const animation of animations) resetClip(animation);
  }
}
