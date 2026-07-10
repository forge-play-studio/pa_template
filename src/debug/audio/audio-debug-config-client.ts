import type { ProjectAudioConfig } from '../../config';
import {
  assertGameplayDebugConfigReadback,
  saveGameplayDebugConfigChanges,
  type DebugConfigChanges,
} from '../framework/config-client';

export function createAudioDebugConfigChanges(audio: ProjectAudioConfig): DebugConfigChanges {
  const changes: DebugConfigChanges = {
    'audio.masterVolume': audio.masterVolume,
    'audio.bgm.volume': audio.bgm.volume,
  };

  audio.sounds.forEach((sound, index) => {
    changes[`audio.sounds.${index}.volume`] = sound.volume;
    changes[`audio.sounds.${index}.cooldownMs`] = sound.cooldownMs;
    changes[`audio.sounds.${index}.maxVoices`] = sound.maxVoices;
    if (sound.mode === 'activeLoop') {
      changes[`audio.sounds.${index}.intervalMs`] = sound.intervalMs;
    }
  });

  return changes;
}

export async function saveAudioDebugConfig(audio: ProjectAudioConfig): Promise<void> {
  const changes = createAudioDebugConfigChanges(audio);
  await saveGameplayDebugConfigChanges(changes);
  await assertGameplayDebugConfigReadback(changes);
}
