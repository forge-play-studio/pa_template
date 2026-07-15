/**
 * AnimationService - GLB / glTF model clip playback owner.
 *
 * Transform motion (item flight, pop/scale tweens, conveyor transfer) belongs
 * to the corresponding gameplay/presentation owner. This service only owns
 * Babylon AnimationGroup playback and centrally-updated clip transitions.
 */

import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';

export interface PlayOptions {
  /** Whether the clip loops. */
  loop?: boolean;
  /** Babylon animation speed ratio. */
  speed?: number;
  /** Restart even when the same clip is already active. */
  restart?: boolean;
}

export interface CrossFadeOptions {
  /** Whether the destination clip loops. */
  loop?: boolean;
  /** Destination clip speed ratio. */
  speed?: number;
  /** Restart the destination clip from its first frame. */
  restartTarget?: boolean;
}

export interface AnimationServiceDiagnostics {
  activeTransitions: number;
}

interface AnimationSetState {
  current: AnimationGroup | null;
  transition: ActiveTransition | null;
}

interface ActiveTransition {
  state: AnimationSetState;
  from: AnimationGroup;
  to: AnimationGroup;
  elapsedSeconds: number;
  durationSeconds: number;
}

const DEFAULT_CROSS_FADE_DURATION_MS = 200;

/**
 * Owns skeletal/model clip playback for independently instantiated model sets.
 *
 * State is keyed by the actual AnimationGroup objects. Two pooled actors may
 * contain clips with identical names without sharing playback state.
 */
export class AnimationService {
  private readonly statesByGroup = new WeakMap<AnimationGroup, AnimationSetState>();
  private readonly activeTransitions = new Set<ActiveTransition>();

  play(
    animations: readonly AnimationGroup[],
    name: string,
    options: PlayOptions = {},
  ): AnimationGroup | null {
    const animation = this.findAnimation(animations, name);
    if (!animation) return null;

    const state = this.getOrCreateState(animations);
    if (!state) return null;

    const { loop = true, speed = 1, restart = false } = options;
    if (state.current === animation && animation.isStarted && !restart) {
      animation.loopAnimation = loop;
      animation.speedRatio = speed;
      if (!animation.isPlaying) animation.restart();
      return animation;
    }

    this.cancelTransition(state);
    this.stopGroups(animations);
    this.startUnweighted(animation, loop, speed);
    state.current = animation;
    return animation;
  }

  stop(animations: readonly AnimationGroup[], name?: string): void {
    const state = this.findState(animations);
    if (!name) {
      if (state) this.cancelTransition(state);
      this.stopGroups(animations);
      if (state) state.current = null;
      return;
    }

    const animation = this.findAnimation(animations, name);
    if (!animation) return;

    if (state?.transition && (state.transition.from === animation || state.transition.to === animation)) {
      const other = state.transition.from === animation
        ? state.transition.to
        : state.transition.from;
      this.cancelTransition(state);
      animation.stop(true);
      state.current = other.isStarted ? other : null;
      return;
    }

    animation.stop(true);
    animation.weight = -1;
    if (state?.current === animation) state.current = null;
  }

  stopAll(animations: readonly AnimationGroup[]): void {
    this.stop(animations);
  }

  pause(animations: readonly AnimationGroup[], name?: string): void {
    if (name) {
      const animation = this.findAnimation(animations, name);
      if (animation?.isStarted && animation.isPlaying) animation.pause();
      return;
    }

    for (const animation of animations) {
      if (animation.isStarted && animation.isPlaying) animation.pause();
    }
  }

  resume(animations: readonly AnimationGroup[], name?: string): void {
    if (name) {
      const animation = this.findAnimation(animations, name);
      if (animation?.isStarted && !animation.isPlaying) animation.restart();
      return;
    }

    for (const animation of animations) {
      if (animation.isStarted && !animation.isPlaying) animation.restart();
    }
  }

  setSpeed(animations: readonly AnimationGroup[], speed: number, name?: string): void {
    if (name) {
      const animation = this.findAnimation(animations, name);
      if (animation) animation.speedRatio = speed;
      return;
    }

    for (const animation of animations) animation.speedRatio = speed;
  }

  /**
   * Cross-fades between two clips using AnimationGroup weights.
   *
   * `durationMs` remains milliseconds for backwards compatibility. The blend
   * itself is advanced by the single AnimationService.update() call in Game.
   */
  crossFade(
    animations: readonly AnimationGroup[],
    fromName: string,
    toName: string,
    durationMs: number = DEFAULT_CROSS_FADE_DURATION_MS,
    options: CrossFadeOptions = {},
  ): AnimationGroup | null {
    const requestedFrom = this.findAnimation(animations, fromName);
    const to = this.findAnimation(animations, toName);
    if (!to) return null;

    const state = this.getOrCreateState(animations);
    if (!state) return null;

    const from = requestedFrom?.isStarted
      ? requestedFrom
      : state.current?.isStarted
        ? state.current
        : null;
    const normalizedDurationMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
    const { loop = true, speed = 1, restartTarget = true } = options;

    if (!from || from === to || normalizedDurationMs === 0) {
      return this.play(animations, to.name, { loop, speed, restart: restartTarget });
    }

    this.cancelTransition(state);
    for (const animation of animations) {
      if (animation !== from && animation !== to && animation.isStarted) animation.stop(true);
    }

    from.weight = 1;
    if (restartTarget && to.isStarted) to.stop(true);
    to.weight = 0;
    to.speedRatio = speed;
    to.loopAnimation = loop;
    if (!to.isStarted) to.play(loop);
    else if (!to.isPlaying) to.restart();

    const transition: ActiveTransition = {
      state,
      from,
      to,
      elapsedSeconds: 0,
      durationSeconds: normalizedDurationMs / 1000,
    };
    state.current = to;
    state.transition = transition;
    this.activeTransitions.add(transition);
    return to;
  }

  /** Advance all active clip blends once from the project update loop. */
  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || this.activeTransitions.size === 0) return;

    for (const transition of this.activeTransitions) {
      transition.elapsedSeconds += deltaSeconds;
      const progress = Math.min(1, transition.elapsedSeconds / transition.durationSeconds);
      transition.from.weight = 1 - progress;
      transition.to.weight = progress;

      if (progress < 1) continue;

      transition.from.stop(true);
      transition.from.weight = -1;
      transition.to.weight = -1;
      transition.state.transition = null;
      this.activeTransitions.delete(transition);
    }
  }

  findAnimation(animations: readonly AnimationGroup[], name: string): AnimationGroup | null {
    if (animations.length === 0) return null;

    const nameLower = name.toLowerCase();
    let found = animations.find(animation => animation.name.toLowerCase() === nameLower);
    if (found) return found;

    found = animations.find(animation => animation.name.toLowerCase().includes(nameLower));
    if (found) return found;

    const aliases: Readonly<Record<string, readonly string[]>> = {
      idle: ['idle', 'stand', 'wait', 'default'],
      walk: ['walk', 'run', 'move', 'locomotion'],
      action: ['action', 'attack', 'hit', 'work', 'interact'],
      carry: ['carry', 'hold', 'pickup'],
    };

    for (const alias of aliases[nameLower] ?? []) {
      found = animations.find(animation => animation.name.toLowerCase().includes(alias));
      if (found) return found;
    }
    return null;
  }

  isPlaying(animations: readonly AnimationGroup[], name: string): boolean {
    return this.findAnimation(animations, name)?.isPlaying ?? false;
  }

  getCurrentAnimationName(animations: readonly AnimationGroup[]): string | null {
    const current = this.findState(animations)?.current;
    return current?.isStarted ? current.name : null;
  }

  listAnimations(animations: readonly AnimationGroup[]): string[] {
    return animations.map(animation => animation.name);
  }

  getDiagnostics(): AnimationServiceDiagnostics {
    return { activeTransitions: this.activeTransitions.size };
  }

  dispose(): void {
    for (const transition of this.activeTransitions) {
      transition.from.stop(true);
      transition.to.stop(true);
      transition.from.weight = -1;
      transition.to.weight = -1;
      transition.state.current = null;
      transition.state.transition = null;
    }
    this.activeTransitions.clear();
  }

  private getOrCreateState(animations: readonly AnimationGroup[]): AnimationSetState | null {
    if (animations.length === 0) return null;
    const existing = this.findState(animations);
    const state = existing ?? { current: null, transition: null };
    for (const animation of animations) this.statesByGroup.set(animation, state);
    return state;
  }

  private findState(animations: readonly AnimationGroup[]): AnimationSetState | null {
    for (const animation of animations) {
      const state = this.statesByGroup.get(animation);
      if (state) return state;
    }
    return null;
  }

  private startUnweighted(animation: AnimationGroup, loop: boolean, speed: number): void {
    animation.weight = -1;
    animation.speedRatio = speed;
    animation.loopAnimation = loop;
    animation.play(loop);
  }

  private stopGroups(animations: readonly AnimationGroup[]): void {
    for (const animation of animations) {
      if (animation.isStarted) animation.stop(true);
      animation.weight = -1;
    }
  }

  private cancelTransition(state: AnimationSetState): void {
    const transition = state.transition;
    if (!transition) return;
    transition.from.weight = -1;
    transition.to.weight = -1;
    this.activeTransitions.delete(transition);
    state.transition = null;
  }
}
