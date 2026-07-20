import type { VfxBudgetConfig, VfxEffectRegistration } from './types.ts';

export interface VfxBudgetValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  conflict: string | null;
}

export function validateVfxBudget(
  registrations: readonly VfxEffectRegistration[],
  budget: VfxBudgetConfig,
): VfxBudgetValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let maximumEffectPeak = 0;

  if (budget.schemaVersion !== 'project-vfx-budget/1.0') {
    errors.push(`Unsupported VFX budget schema: ${String(budget.schemaVersion)}`);
  }
  if (!Number.isInteger(budget.globalActiveLimit) || budget.globalActiveLimit < 0) {
    errors.push('globalActiveLimit must be a non-negative integer.');
  }
  if (!Number.isInteger(budget.expectedGlobalPeak) || budget.expectedGlobalPeak < 0) {
    errors.push('expectedGlobalPeak must be a non-negative integer.');
  }
  if (registrations.length > 0 && budget.status !== 'confirmed') {
    errors.push('VFX budget must be user-confirmed before registering production effects.');
  }
  if (registrations.length > 0 && budget.globalActiveLimit < 1) {
    errors.push('globalActiveLimit must be at least 1 when production effects are registered.');
  }

  for (const registration of registrations) {
    const { definition, config } = registration;
    if (!definition.id.trim()) errors.push('VFX definition id must not be empty.');
    if (definition.id !== config.effectId) {
      errors.push(`Definition id "${definition.id}" does not match runtime config "${config.effectId}".`);
    }
    for (const method of ['prepare', 'createInstance', 'warmup', 'play', 'recycle', 'destroy', 'dispose'] as const) {
      if (typeof definition[method] !== 'function') {
        errors.push(`Effect "${config.effectId}" definition is missing ${method}().`);
      }
    }
    if (seen.has(config.effectId)) errors.push(`Duplicate VFX effect id: ${config.effectId}.`);
    seen.add(config.effectId);
    if (config.schemaVersion !== 'project-vfx-runtime/1.0') {
      errors.push(`Effect "${config.effectId}" has unsupported runtime schema.`);
    }
    if (!Number.isInteger(config.poolSize) || config.poolSize < 1) {
      errors.push(`Effect "${config.effectId}" poolSize must be a positive integer.`);
    }
    if (!Number.isInteger(config.expectedPeak) || config.expectedPeak < 0) {
      errors.push(`Effect "${config.effectId}" expectedPeak must be a non-negative integer.`);
    }
    if (config.expectedPeak > config.poolSize) {
      errors.push(`Effect "${config.effectId}" expectedPeak exceeds poolSize.`);
    }
    if (budget.globalActiveLimit > 0 && config.poolSize > budget.globalActiveLimit) {
      errors.push(`Effect "${config.effectId}" poolSize exceeds the global active limit.`);
    }
    if (config.expectedPeak === config.poolSize) {
      warnings.push(`Effect "${config.effectId}" has no burst margin above expectedPeak.`);
    }
    maximumEffectPeak = Math.max(maximumEffectPeak, config.expectedPeak);
  }

  if (budget.expectedGlobalPeak < maximumEffectPeak) {
    errors.push(`expectedGlobalPeak ${budget.expectedGlobalPeak} is lower than an individual effect expectedPeak ${maximumEffectPeak}.`);
  }

  const conflict = budget.expectedGlobalPeak > budget.globalActiveLimit
    ? `VFX Global Budget Conflict: expected peak ${budget.expectedGlobalPeak} exceeds global active limit ${budget.globalActiveLimit}.`
    : null;
  if (conflict) errors.push(conflict);

  return { valid: errors.length === 0, errors, warnings, conflict };
}
