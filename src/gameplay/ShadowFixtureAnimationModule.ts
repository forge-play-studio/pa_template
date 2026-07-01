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

  constructor(
    private readonly context: Pick<GameplayRuntimeContext, 'sceneBuilder' | 'animationService'>,
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
    this.playerNode = this.context.sceneBuilder.getSceneNodeRuntime(this.playerNodeId) ?? null;
    this.playerAnimations = this.context.sceneBuilder.getSceneNodeAnimationGroups(this.playerNodeId);
    if (this.playerNode) {
      this.playerHome.copyFrom(this.playerNode.position);
      this.beginNextPlayerMove();
    }

    this.workerAnimations = this.context.sceneBuilder.getSceneNodeAnimationGroups(this.workerNodeId);
    this.playWorkerLoop();
  }

  update(deltaTime: number): void {
    if (!this.playerNode || !Number.isFinite(deltaTime) || deltaTime <= 0) return;
    if (this.playerState === 'moving') {
      this.updatePlayerMove(deltaTime);
      return;
    }

    this.playerIdleRemaining -= deltaTime;
    if (this.playerIdleRemaining <= 0) {
      this.beginNextPlayerMove();
    }
  }

  dispose(): void {
    if (this.playerAnimations.length > 0) {
      this.context.animationService.stop(this.playerAnimations);
    }
    if (this.workerAnimations.length > 0) {
      this.context.animationService.stop(this.workerAnimations);
    }
    if (this.playerNode) {
      this.playerNode.position.copyFrom(this.playerHome);
    }
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
      currentPlayerAnimationName: this.context.animationService.getCurrentAnimationName(this.playerAnimations),
      currentWorkerAnimationName: this.context.animationService.getCurrentAnimationName(this.workerAnimations),
    };
  }

  private playWorkerLoop(): void {
    this.playFirstAvailable(this.workerAnimations, WORKER_LOOP_ANIMATION_CANDIDATES, 1);
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
    this.playFirstAvailable(this.playerAnimations, PLAYER_MOVE_ANIMATION_CANDIDATES, 1);
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
      this.playFirstAvailable(this.playerAnimations, PLAYER_IDLE_ANIMATION_CANDIDATES, 1);
    }
  }

  private playFirstAvailable(animations: AnimationGroup[], names: readonly string[], speed: number): AnimationGroup | null {
    if (animations.length === 0) return null;
    for (const name of names) {
      const animation = this.context.animationService.findAnimation(animations, name);
      if (!animation) continue;
      return this.context.animationService.play(animations, animation.name, {
        loop: true,
        speed,
        restart: false,
      });
    }
    const fallback = animations[0] ?? null;
    if (!fallback) return null;
    return this.context.animationService.play(animations, fallback.name, {
      loop: true,
      speed,
      restart: false,
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
