import type { Game } from '../../core/Game';
import {
  registerRecordReplayProviders,
  type MilestoneDetector,
  type RecordReplayMilestoneEvent,
  type RecordReplayObservation,
} from './providers';

export function registerTemplateRecordReplayProviders(getGame: () => Game | null): () => void {
  return registerRecordReplayProviders({
    snapshotProviders: [
      {
        name: 'template.simplePlayer',
        getSnapshot() {
          const player = getGame()?.getPlayer();
          if (!player) return null;
          return {
            position: {
              x: player.position.x,
              y: player.position.y,
              z: player.position.z,
            },
            radius: player.radius,
          };
        },
      },
      {
        name: 'template.exampleFacts',
        getSnapshot() {
          return {
            recordReplay: {
              facts: {
                ready: true,
              },
            },
          };
        },
      },
    ],
    playerPosition() {
      const player = getGame()?.getPlayer();
      return player ? { x: player.position.x, y: player.position.y, z: player.position.z } : null;
    },
    milestoneDetectors: [createTemplateExampleMilestoneDetector()],
  });
}

function createTemplateExampleMilestoneDetector(): MilestoneDetector {
  return {
    kind: 'custom',
    detect(previous, next) {
      return diffFactChanges(previous, next)
        .filter((event) => String(event.detail.id).startsWith('template.exampleFacts.'));
    },
    isSatisfied(milestone, observation) {
      const id = typeof milestone.detail.id === 'string' ? milestone.detail.id : null;
      if (!id) return false;
      const expected = milestone.detail.to;
      return String(observation.facts[id]) === String(expected);
    },
    getIdentity(milestone) {
      return typeof milestone.detail.id === 'string' ? milestone.detail.id : null;
    },
  };
}

function diffFactChanges(
  previous: RecordReplayObservation,
  next: RecordReplayObservation,
): RecordReplayMilestoneEvent[] {
  const events: RecordReplayMilestoneEvent[] = [];
  const keys = new Set([...Object.keys(previous.facts), ...Object.keys(next.facts)]);
  for (const key of [...keys].sort()) {
    const before = previous.facts[key];
    const after = next.facts[key];
    if (before === after || after === undefined) continue;
    events.push({
      kind: 'custom',
      detail: {
        id: key,
        from: before === undefined ? '[missing]' : String(before),
        to: String(after),
      },
    });
  }
  return events;
}
