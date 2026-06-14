import type { GameplayModule } from '../gameplay';
import type { ProjectQueueConfig } from '../config/projectGameplayConfig';

export interface QueueSnapshot {
  queueIds: string[];
  queueCount: number;
}

export class QueueSystem implements GameplayModule {
  constructor(private readonly queues: ProjectQueueConfig[]) {}

  getSnapshot(): QueueSnapshot {
    return {
      queueIds: this.queues.map((queue) => queue.id),
      queueCount: this.queues.length,
    };
  }

  getQueueConfigs(): ProjectQueueConfig[] {
    return this.queues.map((queue) => ({ ...queue }));
  }

  dispose(): void {
  }
}
