import type { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import type { Scene } from '@babylonjs/core/scene';
import type { CameraFollowController, GameplayModule } from '../gameplay';
import type { SimplePlayer } from '../entities';
import type { InputService, MovementInputSource } from '../services';
import type { ZoneSystem } from './ZoneSystem';
import type { GameplayStateSystem } from './GameplayStateSystem';

export interface ThreeCSnapshot {
  position: { x: number; y: number; z: number };
  inputEnabled: boolean;
  rightHanded: boolean;
}

export class ThreeCSystem implements GameplayModule, CameraFollowController {
  private cameraFollowEnabled = true;

  constructor(private readonly options: {
    scene: Scene;
    camera: ArcRotateCamera | null;
    player: SimplePlayer;
    inputService: InputService;
    movementSource?: MovementInputSource | null;
    zoneSystem: ZoneSystem;
    gameplayState: GameplayStateSystem;
  }) {}

  init(): void {
    if (this.options.movementSource) {
      this.options.inputService.setMovementSource(this.options.movementSource);
    }
    this.options.zoneSystem.setActorProvider(() => [{
      id: 'player',
      position: {
        x: this.options.player.position.x,
        z: this.options.player.position.z,
      },
      radius: this.options.player.radius,
    }]);
    if (!this.options.scene.useRightHandedSystem) {
      this.options.gameplayState.setBlockers([{
        type: 'implementation',
        id: 'scene_handedness',
        message: 'Scene must remain right-handed for pa_template gameplay systems.',
      }]);
    }
  }

  update(): void {
    if (this.options.camera && this.cameraFollowEnabled) {
      this.options.camera.target.copyFrom(this.options.player.position);
    }
  }

  get isCameraFollowEnabled(): boolean {
    return this.cameraFollowEnabled;
  }

  setCameraFollowEnabled(enabled: boolean): void {
    this.cameraFollowEnabled = enabled;
  }

  getSnapshot(): ThreeCSnapshot {
    const position = this.options.player.position;
    return {
      position: { x: position.x, y: position.y, z: position.z },
      inputEnabled: true,
      rightHanded: this.options.scene.useRightHandedSystem,
    };
  }

  dispose(): void {
    if (this.options.movementSource) {
      this.options.inputService.clearMovementSource();
    }
    this.options.zoneSystem.setActorProvider(null);
  }
}
