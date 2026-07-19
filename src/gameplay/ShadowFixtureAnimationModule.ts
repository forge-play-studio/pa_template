import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { GameplayModule, GameplayRuntimeContext } from './types';

export interface ShadowFixtureAnimationModuleOptions {
  playerNodeId?: string;
  workerNodeId?: string;
  playerMoveRadius?: number;
  playerMoveSpeed?: number;
  playerIdleMinSec?: number;
  playerIdleMaxSec?: number;
  random?: () => number;
}

type ShadowFixturePlayerState = 'moving' | 'idle';

const DEFAULT_PLAYER_NODE_ID = 'shadow_fixture_player';
const DEFAULT_WORKER_NODE_ID = 'shadow_fixture_worker';
const DEFAULT_MOVE_RADIUS = 2.4;
const DEFAULT_MOVE_SPEED = 1.25;
const DEFAULT_IDLE_MIN_SEC = 0.8;
const DEFAULT_IDLE_MAX_SEC = 1.8;
const MIN_TARGET_DISTANCE = 0.35;
const PLAYER_IDLE_ANIMATION_CANDIDATES = ['idle', '待机', 'stand', 'wait'];
const PLAYER_MOVE_ANIMATION_CANDIDATES = ['run', '跑', 'walk', 'move'];
const WORKER_LOOP_ANIMATION_CANDIDATES = ['run', '跑', 'walk', 'move', 'idle', '待机'];

export class ShadowFixtureAnimationModule implements GameplayModule {
  private readonly playerNodeId: string;
  private readonly workerNodeId: string;
  private readonly moveRadius: number;
  private readonly moveSpeed: number;
  private readonly idleMinSec: number;
  private readonly idleMaxSec: number;
  private readonly random: () => number;

  private playerNode: TransformNode | null = null;
  private playerHome = Vector3.Zero();
  private playerMoveStart = Vector3.Zero();
  private playerMoveTarget = Vector3.Zero();
  private playerState: ShadowFixturePlayerState = 'idle';
  private playerMoveElapsed = 0;
  private playerMoveDuration = 1;
  private playerIdleRemaining = 0;
  private playerAnimations: AnimationGroup[] = [];
  private workerAnimations: AnimationGroup[] = [];
  private playerIdleClipName: string | null = null;
  private playerMoveClipName: string | null = null;
  private workerLoopClipName: string | null = null;
  private currentPlayerAnimationName: string | null = null;
  private currentWorkerAnimationName: string | null = null;
  private paused = false;
  private disposed = false;

  constructor(
    private readonly context: Pick<GameplayRuntimeContext, 'sceneBuilder' | 'modelAnimationService'>,
    options: ShadowFixtureAnimationModuleOptions = {},
  ) {
    this.playerNodeId = options.playerNodeId ?? DEFAULT_PLAYER_NODE_ID;
    this.workerNodeId = options.workerNodeId ?? DEFAULT_WORKER_NODE_ID;
    this.moveRadius = Math.max(0.1, options.playerMoveRadius ?? DEFAULT_MOVE_RADIUS);
    this.moveSpeed = Math.max(0.1, options.playerMoveSpeed ?? DEFAULT_MOVE_SPEED);
    this.idleMinSec = Math.max(0, options.playerIdleMinSec ?? DEFAULT_IDLE_MIN_SEC);
    this.idleMaxSec = Math.max(this.idleMinSec, options.playerIdleMaxSec ?? DEFAULT_IDLE_MAX_SEC);
    this.random = options.random ?? Math.random;
  }

  init(): void {
    if (this.disposed) throw new Error('shadowFixtureAnimation.moduleDisposed');
    this.playerNode = this.context.sceneBuilder.getSceneNodeRuntime(this.playerNodeId) ?? null;
    this.playerAnimations = this.context.sceneBuilder.getSceneNodeAnimationGroups(this.playerNodeId);
    this.playerIdleClipName = resolveFirstClipName(this.playerAnimations, PLAYER_IDLE_ANIMATION_CANDIDATES);
    this.playerMoveClipName = resolveFirstClipName(this.playerAnimations, PLAYER_MOVE_ANIMATION_CANDIDATES);
    if (this.playerNode) {
      this.playerHome.copyFrom(this.playerNode.position);
      this.beginNextPlayerMove();
    }

    this.workerAnimations = this.context.sceneBuilder.getSceneNodeAnimationGroups(this.workerNodeId);
    this.workerLoopClipName = resolveFirstClipName(this.workerAnimations, WORKER_LOOP_ANIMATION_CANDIDATES);
    this.playWorkerLoop();
  }

  /** Advances only the fixture root transform; Babylon advances model clips. */
  update(deltaTime: number): void {
    if (this.paused || this.disposed || !this.playerNode || !Number.isFinite(deltaTime) || deltaTime <= 0) return;
    if (this.playerState === 'moving') {
      this.updatePlayerMove(deltaTime);
      return;
    }

    this.playerIdleRemaining -= deltaTime;
    if (this.playerIdleRemaining <= 0) {
      this.beginNextPlayerMove();
    }
  }

  pause(): void {
    if (this.paused || this.disposed) return;
    const errors: unknown[] = [];
    try { this.context.modelAnimationService.pause(this.playerAnimations); }
    catch (error) { errors.push(error); }
    try { this.context.modelAnimationService.pause(this.workerAnimations); }
    catch (error) { errors.push(error); }
    if (errors.length > 0) {
      const rollbackErrors: unknown[] = [];
      try { this.context.modelAnimationService.resume(this.playerAnimations); }
      catch (error) { rollbackErrors.push(error); }
      try { this.context.modelAnimationService.resume(this.workerAnimations); }
      catch (error) { rollbackErrors.push(error); }
      throwCollectedErrors('pause', errors, rollbackErrors);
    }
    this.paused = true;
  }

  resume(): void {
    if (!this.paused || this.disposed) return;
    const errors: unknown[] = [];
    try { this.context.modelAnimationService.resume(this.playerAnimations); }
    catch (error) { errors.push(error); }
    try { this.context.modelAnimationService.resume(this.workerAnimations); }
    catch (error) { errors.push(error); }
    if (errors.length > 0) {
      const rollbackErrors: unknown[] = [];
      try { this.context.modelAnimationService.pause(this.playerAnimations); }
      catch (error) { rollbackErrors.push(error); }
      try { this.context.modelAnimationService.pause(this.workerAnimations); }
      catch (error) { rollbackErrors.push(error); }
      throwCollectedErrors('resume', errors, rollbackErrors);
    }
    this.paused = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    if (this.playerAnimations.length > 0) {
      try { this.context.modelAnimationService.stop(this.playerAnimations); }
      catch (error) { errors.push(error); }
    }
    if (this.workerAnimations.length > 0) {
      try { this.context.modelAnimationService.stop(this.workerAnimations); }
      catch (error) { errors.push(error); }
    }
    this.currentPlayerAnimationName = null;
    this.currentWorkerAnimationName = null;
    if (this.playerNode) {
      try { this.playerNode.position.copyFrom(this.playerHome); }
      catch (error) { errors.push(error); }
    }
    throwCollectedErrors('dispose', errors);
  }

  getDebugState(): {
    playerState: ShadowFixturePlayerState;
    playerNodeId: string;
    workerNodeId: string;
    playerAnimationCount: number;
    workerAnimationCount: number;
    currentPlayerAnimationName: string | null;
    currentWorkerAnimationName: string | null;
  } {
    return {
      playerState: this.playerState,
      playerNodeId: this.playerNodeId,
      workerNodeId: this.workerNodeId,
      playerAnimationCount: this.playerAnimations.length,
      workerAnimationCount: this.workerAnimations.length,
      currentPlayerAnimationName: this.currentPlayerAnimationName,
      currentWorkerAnimationName: this.currentWorkerAnimationName,
    };
  }

  private playWorkerLoop(): void {
    const animation = this.playClip(this.workerAnimations, this.workerLoopClipName, 1);
    this.currentWorkerAnimationName = animation?.name ?? null;
  }

  private beginNextPlayerMove(): void {
    if (!this.playerNode) return;
    this.playerState = 'moving';
    this.playerMoveElapsed = 0;
    this.playerMoveStart.copyFrom(this.playerNode.position);
    this.playerMoveTarget.copyFrom(this.createRandomPlayerTarget(this.playerMoveStart));
    const distance = Vector3.Distance(this.playerMoveStart, this.playerMoveTarget);
    this.playerMoveDuration = Math.max(0.35, distance / this.moveSpeed);
    this.facePlayerMoveTarget();
    const animation = this.playClip(this.playerAnimations, this.playerMoveClipName, 1);
    this.currentPlayerAnimationName = animation?.name ?? null;
  }

  private updatePlayerMove(deltaTime: number): void {
    if (!this.playerNode) return;
    this.playerMoveElapsed += deltaTime;
    const progress = Math.min(1, this.playerMoveElapsed / this.playerMoveDuration);
    const eased = progress * progress * (3 - 2 * progress);
    this.playerNode.position.set(
      lerp(this.playerMoveStart.x, this.playerMoveTarget.x, eased),
      lerp(this.playerMoveStart.y, this.playerMoveTarget.y, eased),
      lerp(this.playerMoveStart.z, this.playerMoveTarget.z, eased),
    );
    this.facePlayerMoveTarget();

    if (progress >= 1) {
      this.playerState = 'idle';
      this.playerIdleRemaining = this.idleMinSec + (this.idleMaxSec - this.idleMinSec) * this.randomUnit();
      const animation = this.playClip(this.playerAnimations, this.playerIdleClipName, 1);
      this.currentPlayerAnimationName = animation?.name ?? null;
    }
  }

  private playClip(
    animations: readonly AnimationGroup[],
    clipName: string | null,
    speedRatio: number,
  ): AnimationGroup | null {
    if (!clipName) return null;
    return this.context.modelAnimationService.play(animations, clipName, {
      loop: true,
      speedRatio,
    });
  }

  private createRandomPlayerTarget(current: Vector3): Vector3 {
    const angle = this.randomUnit() * Math.PI * 2;
    const distance = this.moveRadius * (0.45 + this.randomUnit() * 0.55);
    const target = new Vector3(
      this.playerHome.x + Math.cos(angle) * distance,
      this.playerHome.y,
      this.playerHome.z + Math.sin(angle) * distance,
    );
    if (Vector3.Distance(current, target) >= MIN_TARGET_DISTANCE) return target;
    return new Vector3(this.playerHome.x + this.moveRadius, this.playerHome.y, this.playerHome.z);
  }

  private facePlayerMoveTarget(): void {
    if (!this.playerNode) return;
    const dx = this.playerMoveTarget.x - this.playerNode.position.x;
    const dz = this.playerMoveTarget.z - this.playerNode.position.z;
    if (dx * dx + dz * dz < 0.0001) return;
    this.playerNode.rotationQuaternion = null;
    this.playerNode.rotation.y = Math.atan2(dx, dz);
  }

  private randomUnit(): number {
    const value = this.random();
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function throwCollectedErrors(
  operation: string,
  errors: readonly unknown[],
  rollbackErrors: readonly unknown[] = [],
): void {
  if (errors.length === 0) return;
  const failure = errors.length === 1
    ? errors[0]
    : Object.assign(new Error(`Shadow fixture animation ${operation} failed.`), { errors: [...errors] });
  if (rollbackErrors.length > 0 && failure && typeof failure === 'object') {
    try { Object.assign(failure, { rollbackErrors: [...rollbackErrors] }); }
    catch { /* Preserve the primary lifecycle failure. */ }
  }
  throw failure;
}

function resolveFirstClipName(
  animations: readonly AnimationGroup[],
  candidates: readonly string[],
): string | null {
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase();
    const exact = animations.find(animation => animation.name.toLowerCase() === normalizedCandidate);
    if (exact) return exact.name;
  }
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase();
    const partial = animations.find(animation => animation.name.toLowerCase().includes(normalizedCandidate));
    if (partial) return partial.name;
  }
  return animations[0]?.name ?? null;
}
