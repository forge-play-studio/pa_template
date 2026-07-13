import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { Scene } from '@babylonjs/core/scene';

type AnimationRuntimeState = {
  groupId: string;
  isStarted: boolean;
  isPlaying: boolean;
  currentFrame: number;
  speedRatio: number;
  loopAnimation: boolean;
};

export function captureAnimationRuntimeState(scene: Scene | null, groupId: string): AnimationRuntimeState | null {
  const group = findGroup(scene, groupId);
  if (!group) return null;
  return {
    groupId,
    isStarted: Boolean(group.isStarted),
    isPlaying: Boolean(group.isPlaying),
    currentFrame: finite(group.getCurrentFrame(), group.from),
    speedRatio: finite(group.speedRatio, 1),
    loopAnimation: Boolean(group.loopAnimation),
  };
}

export function previewAnimationRuntimeState(
  scene: Scene | null,
  groupId: string,
  set: { paused?: boolean; currentFrame?: number; speedRatio?: number },
): boolean {
  const group = findGroup(scene, groupId);
  if (!group) return false;
  if (set.speedRatio !== undefined) group.speedRatio = set.speedRatio;
  if (set.currentFrame !== undefined) group.goToFrame(set.currentFrame);
  if (set.paused === true) group.pause();
  else if (set.paused === false && !group.isPlaying) group.play(group.loopAnimation);
  return true;
}

export function restoreAnimationRuntimeState(scene: Scene | null, state: unknown): boolean {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  const record = state as AnimationRuntimeState;
  const group = typeof record.groupId === 'string' ? findGroup(scene, record.groupId) : null;
  if (!group) return false;
  group.speedRatio = record.speedRatio;
  group.loopAnimation = record.loopAnimation;
  if (!record.isStarted) {
    group.stop();
    return true;
  }
  if (!group.isPlaying) group.play(record.loopAnimation);
  group.goToFrame(record.currentFrame);
  if (!record.isPlaying) group.pause();
  return true;
}

function findGroup(scene: Scene | null, groupId: string): AnimationGroup | null {
  if (!scene) return null;
  return scene.animationGroups.find(group => String(group.uniqueId) === groupId) ?? null;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
