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
}

interface ProjectVfxParamsDocument {
  effectId?: unknown;
  params?: unknown;
}

interface ProjectVfxParameterDocument {
  parameters?: Record<string, unknown>;
}

const effectModules = import.meta.glob('./effects/*/index.ts', { eager: true }) as Record<string, ProjectVfxEffectModule>;
const runtimeDocuments = import.meta.glob('./effects/*/vfx-runtime.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const paramsDocuments = import.meta.glob('./effects/*/vfx-params.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const parameterDocuments = import.meta.glob('./effects/*/effect.vfx.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export const PROJECT_VFX_BUDGET = budgetDocument as VfxBudgetConfig;
export const PROJECT_VFX_REGISTRATIONS = collectProjectVfxRegistrations(
  effectModules,
  runtimeDocuments,
  paramsDocuments,
  parameterDocuments,
);

function collectProjectVfxRegistrations(
  modules: Record<string, ProjectVfxEffectModule>,
  runtimes: Record<string, unknown>,
  params: Record<string, unknown>,
  parameterSchemas: Record<string, unknown>,
): VfxEffectRegistration[] {
  const runtimeByDirectory = mapDocumentsByDirectory(runtimes);
  const paramsByDirectory = mapDocumentsByDirectory(params);
  const parameterSchemasByDirectory = mapDocumentsByDirectory(parameterSchemas);
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
      debugParameters: readDebugParameters(parameterSchemasByDirectory.get(directory), modulePath),
    });
  }

  const orphanRuntimeDirectories = [...runtimeByDirectory.keys()]
    .filter(directory => !consumedRuntimeDirectories.has(directory));
  if (orphanRuntimeDirectories.length > 0) {
    throw new Error(`VFX runtime config has no effect module: ${orphanRuntimeDirectories.join(', ')}`);
  }
  return registrations;
}

function readDebugParameters(value: unknown, modulePath: string): VfxDebugParameterDefinition[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${modulePath} is missing effect.vfx.json.`);
  }
  const parameters = (value as ProjectVfxParameterDocument).parameters;
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new Error(`${modulePath} effect.vfx.json must declare a parameters object.`);
  }
  return Object.entries(parameters).map(([key, definition]) => {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      throw new Error(`${modulePath} effect.vfx.json parameter "${key}" must be an object.`);
    }
    const source = definition as Record<string, unknown>;
    const kind = source.type;
    if (kind !== 'number' && kind !== 'boolean' && kind !== 'color' && kind !== 'text' && kind !== 'json' && kind !== 'select') {
      throw new Error(`${modulePath} effect.vfx.json parameter "${key}" has unsupported type "${String(kind)}".`);
    }
    const options = readParameterOptions(source.options);
    if (kind === 'select' && options.length === 0) {
      throw new Error(`${modulePath} effect.vfx.json select parameter "${key}" requires options.`);
    }
    const min = readFiniteNumber(source.min);
    const max = readFiniteNumber(source.max);
    const step = readFiniteNumber(source.step);
    return {
      key,
      ...(typeof source.label === 'string' ? { label: source.label } : {}),
      kind,
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
      ...(step !== undefined ? { step } : {}),
      ...(options.length > 0 ? { options } : {}),
    } satisfies VfxDebugParameterDefinition;
  });
}

function readParameterOptions(value: unknown): Array<{ value: string; label?: string }> {
  if (!Array.isArray(value)) return [];
  return value.map((option, index) => {
    if (typeof option === 'string') return { value: option };
    if (!option || typeof option !== 'object' || Array.isArray(option)) {
      throw new Error(`effect.vfx.json options[${index}] must be a string or an object.`);
    }
    const source = option as Record<string, unknown>;
    if (typeof source.value !== 'string') throw new Error(`effect.vfx.json options[${index}].value must be a string.`);
    return { value: source.value, ...(typeof source.label === 'string' ? { label: source.label } : {}) };
  });
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
