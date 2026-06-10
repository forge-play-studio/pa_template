import type { GameplayModule } from '../gameplay';
import type { ProjectResourceConfig } from '../config/projectGameplayConfig';
import type { RuntimeNodeService } from '../services';

export interface ResourceSnapshot {
  resources: ProjectResourceConfig[];
}

export class ResourcesSystem implements GameplayModule {
  private readonly resources = new Map<string, ProjectResourceConfig>();

  constructor(
    configs: ProjectResourceConfig[],
    private readonly runtimeNodes: RuntimeNodeService,
  ) {
    for (const config of configs) this.resources.set(config.id, { ...config });
  }

  init(): void {}

  hasResource(resourceId: string): boolean {
    return this.resources.has(resourceId);
  }

  getResource(resourceId: string): ProjectResourceConfig | undefined {
    const resource = this.resources.get(resourceId);
    return resource ? { ...resource, tags: [...(resource.tags ?? [])] } : undefined;
  }

  getResourceIds(): string[] {
    return [...this.resources.keys()];
  }

  getBackpackResourceIds(): string[] {
    return this.getResourceIds().filter((id) => !(this.resources.get(id)?.tags ?? []).includes('currency'));
  }

  getSnapshot(): ResourceSnapshot {
    return {
      resources: [...this.resources.values()].map((resource) => ({
        ...resource,
        tags: [...(resource.tags ?? [])],
      })),
    };
  }

  getResourceNode(bindingOrNodeId: string) {
    return this.runtimeNodes.getRuntimeNode(bindingOrNodeId);
  }

  dispose(): void {
    this.resources.clear();
  }
}
