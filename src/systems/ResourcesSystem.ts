import type { GameplayModule } from '../gameplay';
import type {
  ProjectResourceConfig,
  ProjectResourceVisualStackConfig,
  ProjectResourceVisualStackLayoutConfig,
  ProjectVector3Config,
} from '../config/projectGameplayConfig';
import type { RuntimeNodeService } from '../services';

export interface ResourceSnapshot {
  resources: ProjectResourceConfig[];
  visualStacks: ProjectResourceVisualStackConfig[];
}

export class ResourcesSystem implements GameplayModule {
  private readonly resources = new Map<string, ProjectResourceConfig>();
  private readonly visualStacks = new Map<string, ProjectResourceVisualStackConfig>();

  constructor(
    configs: ProjectResourceConfig[],
    private readonly runtimeNodes: RuntimeNodeService,
    visualStackConfigs: ProjectResourceVisualStackConfig[] = [],
  ) {
    for (const config of configs) this.resources.set(config.id, { ...config });
    for (const config of visualStackConfigs) this.visualStacks.set(config.id, cloneVisualStackConfig(config));
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
      resources: [...this.resources.values()].map(cloneResourceConfig),
      visualStacks: this.getResourceVisualStacks(),
    };
  }

  getResourceNode(bindingOrNodeId: string) {
    return this.runtimeNodes.getRuntimeNode(bindingOrNodeId);
  }

  getResourceVisualStack(stackId: string): ProjectResourceVisualStackConfig | undefined {
    const stack = this.visualStacks.get(stackId);
    return stack ? cloneVisualStackConfig(stack) : undefined;
  }

  getResourceVisualStacks(): ProjectResourceVisualStackConfig[] {
    return [...this.visualStacks.values()].map(cloneVisualStackConfig);
  }

  dispose(): void {
    this.resources.clear();
    this.visualStacks.clear();
  }
}

function cloneResourceConfig(resource: ProjectResourceConfig): ProjectResourceConfig {
  return {
    ...resource,
    tags: [...(resource.tags ?? [])],
  };
}

function cloneVisualStackConfig(config: ProjectResourceVisualStackConfig): ProjectResourceVisualStackConfig {
  return {
    ...config,
    layout: config.layout ? cloneVisualStackLayout(config.layout) : undefined,
  };
}

function cloneVisualStackLayout(
  layout: ProjectResourceVisualStackLayoutConfig,
): ProjectResourceVisualStackLayoutConfig {
  return {
    ...layout,
    spacing: layout.spacing ? cloneVector3(layout.spacing) : undefined,
    origin: layout.origin ? cloneVector3(layout.origin) : undefined,
    rotation: layout.rotation ? cloneVector3(layout.rotation) : undefined,
    scale: layout.scale ? cloneVector3(layout.scale) : undefined,
  };
}

function cloneVector3(vector: ProjectVector3Config): ProjectVector3Config {
  return { ...vector };
}
