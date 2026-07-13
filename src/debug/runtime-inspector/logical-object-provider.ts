import type { Game } from '../../core/Game';
import { gameplayBindingService } from '../../services';
import type {
  RuntimeInspectorLogicalObjectDescriptor,
  RuntimeInspectorLogicalObjectProvider,
} from './providers';

export function createGameplayLogicalObjectProvider(
  getGame: () => Game | null,
): RuntimeInspectorLogicalObjectProvider {
  return {
    id: 'pa-template-gameplay-logical-objects',
    list() {
      const runtimeNodes = getGame()?.getProjectGameplayRuntime()?.services.runtimeNodes ?? null;
      if (!runtimeNodes) return [];

      const descriptors = new Map<string, RuntimeInspectorLogicalObjectDescriptor>();
      for (const binding of gameplayBindingService.getAll()) {
        const root = runtimeNodes.getRuntimeNode(binding.id);
        if (!root) continue;
        descriptors.set(binding.id, {
          id: binding.id,
          name: binding.entityName?.trim() || binding.id,
          kind: binding.logicType?.trim() || 'GameplayBinding',
          root,
          tags: binding.tags ?? [],
          metadata: { binding },
          source: 'gameplay-binding',
        });
      }

      for (const registration of runtimeNodes.getRegisteredRuntimeNodes()) {
        if (descriptors.has(registration.id)) continue;
        descriptors.set(registration.id, {
          id: registration.logicalId?.trim() || registration.id,
          name: registration.label?.trim() || String(registration.node.name ?? registration.id),
          kind: registration.logicalKind?.trim() || 'RuntimeNode',
          root: registration.node,
          members: registration.logicalMembers ?? [],
          tags: registration.logicalTags ?? [],
          metadata: registration.logicalMetadata ?? { source: registration.source ?? 'runtime' },
          source: 'runtime-registration',
        });
      }

      return [...descriptors.values()];
    },
  };
}
