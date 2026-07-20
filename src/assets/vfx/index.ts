import type {
  AnyProjectVfxEffectDefinition,
  VfxBudgetConfig,
  VfxDebugParameterDefinition,
  VfxEffectRegistration,
  VfxEffectRuntimeConfig,
  VfxParams,
} from '../../services/vfx';
import budgetDocument from './budget.json';

interface ProjectVfxEffectModule {
  vfxEffectDefinition?: AnyProjectVfxEffectDefinition;
  default?: AnyProjectVfxEffectDefinition;
  vfxDebugParameters?: VfxDebugParameterDefinition[];
}

interface ProjectVfxParamsDocument {
  effectId?: unknown;
  params?: unknown;
}

const effectModules = import.meta.glob('./effects/*/index.ts', { eager: true }) as Record<string, ProjectVfxEffectModule>;
const runtimeDocuments = import.meta.glob('./effects/*/vfx-runtime.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const paramsDocuments = import.meta.glob('./effects/*/vfx-params.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export const PROJECT_VFX_BUDGET = budgetDocument as VfxBudgetConfig;
export const PROJECT_VFX_REGISTRATIONS = collectProjectVfxRegistrations(
  effectModules,
  runtimeDocuments,
  paramsDocuments,
);

function collectProjectVfxRegistrations(
  modules: Record<string, ProjectVfxEffectModule>,
  runtimes: Record<string, unknown>,
  params: Record<string, unknown>,
): VfxEffectRegistration[] {
  const runtimeByDirectory = mapDocumentsByDirectory(runtimes);
  const paramsByDirectory = mapDocumentsByDirectory(params);
  const registrations: VfxEffectRegistration[] = [];
  const consumedRuntimeDirectories = new Set<string>();

  for (const [modulePath, module] of Object.entries(modules)) {
    const directory = readEffectDirectory(modulePath);
    const definition = module.vfxEffectDefinition ?? module.default;
    if (!definition || typeof definition !== 'object' || typeof definition.id !== 'string') {
      throw new Error(`${modulePath} must export vfxEffectDefinition (or a default definition).`);
    }
    const runtime = readRuntimeConfig(runtimeByDirectory.get(directory), modulePath);
    const paramsDocument = readParamsDocument(paramsByDirectory.get(directory), definition.id);
    consumedRuntimeDirectories.add(directory);
    registrations.push({
      definition,
      config: runtime,
      defaultParams: paramsDocument,
      debugParameters: module.vfxDebugParameters ?? [],
    });
  }

  const orphanRuntimeDirectories = [...runtimeByDirectory.keys()]
    .filter(directory => !consumedRuntimeDirectories.has(directory));
  if (orphanRuntimeDirectories.length > 0) {
    throw new Error(`VFX runtime config has no effect module: ${orphanRuntimeDirectories.join(', ')}`);
  }
  return registrations;
}

function mapDocumentsByDirectory(documents: Record<string, unknown>): Map<string, unknown> {
  return new Map(Object.entries(documents).map(([filePath, document]) => [readEffectDirectory(filePath), document]));
}

function readEffectDirectory(filePath: string): string {
  const match = filePath.match(/\.\/effects\/([^/]+)\//);
  if (!match?.[1]) throw new Error(`Invalid project VFX path: ${filePath}`);
  return match[1];
}

function readRuntimeConfig(value: unknown, modulePath: string): VfxEffectRuntimeConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${modulePath} is missing vfx-runtime.json.`);
  }
  return value as VfxEffectRuntimeConfig;
}

function readParamsDocument(value: unknown, effectId: string): VfxParams {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const document = value as ProjectVfxParamsDocument;
  if (typeof document.effectId === 'string' && document.effectId !== effectId) {
    throw new Error(`VFX params effectId "${document.effectId}" does not match "${effectId}".`);
  }
  if (!document.params || typeof document.params !== 'object' || Array.isArray(document.params)) return {};
  return { ...(document.params as VfxParams) };
}

export type {
  ProjectVfxEffectDefinition,
  VfxEffectRegistration,
  VfxParams,
  VfxPlacement,
  VfxPlaybackHandle,
  VfxPlayResult,
} from '../../services/vfx';
