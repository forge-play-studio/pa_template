import { ReplaySource } from './ReplaySource';
import {
  assertDemoRecording,
  getRecordingHashVersion,
  type DemoRecording,
  type DemoRecordingFrame,
  type RecordReplayHashVersion,
} from './schema';
import { stateHash, type StateHashResult } from './verify';

type RecordReplayHashGame = Parameters<typeof stateHash>[0];

interface UpdateHookTarget {
  update?: (deltaTime: number) => void;
}

export interface ReplayFrameStateGame extends RecordReplayHashGame {
  stepFrame(deltaTime: number): void;
  setDtOverride(override: (() => number) | null): void;
  /** replay 期间挂起 paused RAF render(保 Mode A「每 update 恰一次 render」的相机口径);可选,老 mock 兼容。 */
  setSuppressPausedRender?(flag: boolean): void;
}

const REPLAY_YIELD_INTERVAL_FRAMES = 25;

/** MessageChannel 宏任务 yield:不受后台 setTimeout 1s 钳制;让合成器上屏、CDP evaluate 可响应。 */
const yieldToEventLoop = (() => {
  let channel: MessageChannel | null = null;
  const resolvers: Array<() => void> = [];
  return (): Promise<void> => new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0);
      return;
    }
    if (!channel) {
      channel = new MessageChannel();
      channel.port1.onmessage = () => resolvers.shift()?.();
    }
    resolvers.push(resolve);
    channel.port2.postMessage(null);
  });
})();

interface ReplayMovementInputSource {
  getInput(): unknown;
}

export interface ReplayFrameStateInputService {
  getMovementSource(): ReplayMovementInputSource | null;
  setMovementSource(source: ReplayMovementInputSource | null): void;
}

export interface ReplayFrameState {
  frameIndex: number;
  frame: DemoRecordingFrame;
  hash: string;
  snapshot: StateHashResult['snapshot'];
  stableJson: string;
}

export interface PostUpdateStateCapture {
  frame: number;
  dt: number;
}

export interface ReplayRecordingFrameStatesOptions {
  game: ReplayFrameStateGame;
  inputService: ReplayFrameStateInputService;
  recording: DemoRecording;
  maxFrames?: number;
  hashVersion?: RecordReplayHashVersion;
  shouldAbort?: () => boolean;
  onBeforeFrame?: (frameIndex: number) => void;
  onFrameState?: (frameState: ReplayFrameState) => false | void;
}

export interface ReplayRecordingFrameStatesResult {
  aborted: boolean;
  frameStates: ReplayFrameState[];
  stateHashes: string[];
}

export function installPostUpdateStateCapture(
  game: RecordReplayHashGame,
  hashVersion: RecordReplayHashVersion,
  onCapture: (result: StateHashResult, update: PostUpdateStateCapture) => void,
): () => void {
  const updateTarget = game as unknown as UpdateHookTarget;
  const originalUpdate = updateTarget.update;
  if (typeof originalUpdate !== 'function') {
    throw new Error('Game.update hook is unavailable for record-replay.');
  }

  const wrappedUpdate = (deltaTime: number): void => {
    const frame = game.getFrameCount();
    originalUpdate.call(game, deltaTime);
    onCapture(stateHash(game, hashVersion), { frame, dt: deltaTime });
  };
  updateTarget.update = wrappedUpdate;
  return () => {
    if (updateTarget.update === wrappedUpdate) {
      updateTarget.update = originalUpdate;
    }
  };
}

export async function replayRecordingFrameStates(
  options: ReplayRecordingFrameStatesOptions,
): Promise<ReplayRecordingFrameStatesResult> {
  const { game, inputService, recording } = options;
  assertDemoRecording(recording);

  const maxFrames = Math.min(
    recording.frames.length,
    Math.max(0, Math.floor(options.maxFrames ?? recording.frames.length)),
  );
  const hashVersion = options.hashVersion ?? getRecordingHashVersion(recording);
  const originalSource = inputService.getMovementSource();
  const replaySource = new ReplaySource(recording.frames);
  const frameStates: ReplayFrameState[] = [];
  let captured: StateHashResult | null = null;

  const restoreUpdate = installPostUpdateStateCapture(game, hashVersion, (result) => {
    captured = result;
  });

  try {
    inputService.setMovementSource(replaySource);
    game.setSuppressPausedRender?.(true);
    for (let index = 0; index < maxFrames; index += 1) {
      if (options.shouldAbort?.()) {
        return {
          aborted: true,
          frameStates,
          stateHashes: frameStates.map((frameState) => frameState.hash),
        };
      }
      if (index > 0 && index % REPLAY_YIELD_INTERVAL_FRAMES === 0) {
        await yieldToEventLoop();
      }

      captured = null;
      options.onBeforeFrame?.(index);
      replaySource.setFrameIndex(index);
      game.stepFrame(recording.frames[index]?.dt ?? 0);
      const capturedState = requireCapturedFrameState(captured, index);

      const frameState: ReplayFrameState = {
        frameIndex: index,
        frame: recording.frames[index] ?? {
          frame: index,
          dt: 0,
          input: { x: 0, y: 0, magnitude: 0, isActive: false },
        },
        hash: capturedState.hash,
        snapshot: capturedState.snapshot,
        stableJson: capturedState.stableJson,
      };
      frameStates.push(frameState);

      if (options.onFrameState?.(frameState) === false) {
        break;
      }
    }

    return {
      aborted: false,
      frameStates,
      stateHashes: frameStates.map((frameState) => frameState.hash),
    };
  } finally {
    inputService.setMovementSource(originalSource);
    game.setDtOverride(null);
    game.setSuppressPausedRender?.(false);
    restoreUpdate();
  }
}

function requireCapturedFrameState(result: StateHashResult | null, frameIndex: number): StateHashResult {
  if (!result) {
    throw new Error(`Replay did not capture a state hash for frame ${frameIndex}.`);
  }
  return result;
}
