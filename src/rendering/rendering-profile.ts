import type { PlanarShadowOptions } from '@fps-games/babylon-renderer';

export interface RenderingVec3 {
  x: number;
  y: number;
  z: number;
}

export interface RenderingColorRgb {
  r: number;
  g: number;
  b: number;
}

export interface RenderingColorRgba extends RenderingColorRgb {
  a: number;
}

export interface NormalizedPlanarShadowProfile {
  enabled: boolean;
  plane: {
    normal: RenderingVec3;
    height: number;
    heightMode: 'fixed' | 'receiver';
    bias: number;
  };
  appearance: {
    color: RenderingColorRgba;
  };
  projection: {
    footprintScale: number;
  };
  stencil: {
    enabled: boolean;
    receiverRenderingGroup: number;
    shadowRenderingGroup: number;
  };
  casters: {
    autoDetectAll: boolean;
    includePatterns: string[];
    excludePatterns: string[];
    rootBoundaryPatterns: string[];
    minVolume: number;
  };
  receivers: {
    patterns: string[];
  };
}

export interface NormalizedRenderingProfile {
  shadows: {
    enabled: boolean;
    useCsm: boolean;
    useBlobShadow: boolean;
    settings: {
      mapSize: number;
      darkness: number;
      blurKernel: number;
      bias: number;
      normalBias: number;
      useBlurExponentialShadowMap: boolean;
      shadowMinZ: number;
      shadowMaxZ: number;
      shadowColor: RenderingColorRgb;
    };
    blobSettings: {
      opacity: number;
      yOffset: number;
      sizeMultiplier: number;
      minSize: number;
    };
    shadowRange: {
      minZ: number;
      maxZ: number;
    };
    shadowOrtho: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
    csm: {
      numCascades: number;
      lambda: number;
      cascadeBlendPercentage: number;
      stabilizeCascades: boolean;
    };
    planar: NormalizedPlanarShadowProfile;
  };
  shadowMeshes: {
    shadowReceivers: string[];
    shadowCasters: string[];
    excludeFromShadow: string[];
  };
}

export interface PlanarShadowOptionsFromRenderingProfileInput {
  enabled?: boolean;
  autoDetectAllCasters?: boolean;
  additionalCasterIncludePatterns?: readonly string[];
  additionalExcludePatterns?: readonly string[];
  additionalReceiverPatterns?: readonly string[];
  additionalRootBoundaryPatterns?: readonly string[];
}

export interface RenderingProfilePatchResult {
  config: Record<string, unknown>;
  changedPaths: string[];
  normalized: NormalizedRenderingProfile;
}

export const DEFAULT_PLANAR_SHADOW_RECEIVER_PATTERNS = ['ground', 'Ground', 'plane', 'Plane', '地面', '地块', '地台'] as const;
export const DEFAULT_PLANAR_SHADOW_EXCLUDE_PATTERNS = [
  'editor',
  'grid',
  'gizmo',
  'helper',
  'camera',
  'light',
  'decal',
  'texture',
  'trigger',
  'collision',
  'ui',
  '_shadow',
  '_planarShadow',
] as const;

export const EDITOR_RENDERING_PROFILE_ALLOWED_PATCH_PATHS = [
  'shadows.planar.enabled',
  'shadows.planar.appearance.color',
  'shadows.planar.appearance.color.a',
  'shadows.planar.plane.height',
  'shadows.planar.plane.bias',
  'shadows.planar.projection.footprintScale',
  'shadows.planar.stencil.enabled',
  'shadows.planar.casters.excludePatterns',
  'shadows.planar.casters.rootBoundaryPatterns',
  'shadows.planar.receivers.patterns',
] as const;

export type EditorRenderingProfileAllowedPatchPath = typeof EDITOR_RENDERING_PROFILE_ALLOWED_PATCH_PATHS[number];

export function normalizeRenderingProfile(config: unknown): NormalizedRenderingProfile {
  const root = readRecord(config);
  const shadows = readRecord(root.shadows);
  const settings = readRecord(shadows.settings);
  const blobSettings = readRecord(shadows.blobSettings);
  const shadowRange = readRecord(shadows.shadowRange);
  const shadowOrtho = readRecord(shadows.shadowOrtho);
  const csm = readRecord(shadows.csm);
  const shadowMeshes = readRecord(root.shadowMeshes);
  return {
    shadows: {
      enabled: readBoolean(shadows.enabled, false),
      useCsm: readBoolean(shadows.useCsm, false),
      useBlobShadow: readBoolean(shadows.useBlobShadow, false),
      settings: {
        mapSize: readNonNegativeNumber(settings.mapSize, 1024),
        darkness: readNonNegativeNumber(settings.darkness, 0.3),
        blurKernel: readNonNegativeNumber(settings.blurKernel, 16),
        bias: readNonNegativeNumber(settings.bias, 0.00005),
        normalBias: readNonNegativeNumber(settings.normalBias, 0.02),
        useBlurExponentialShadowMap: readBoolean(settings.useBlurExponentialShadowMap, true),
        shadowMinZ: readNonNegativeNumber(settings.shadowMinZ, 1),
        shadowMaxZ: readNonNegativeNumber(settings.shadowMaxZ, 60),
        shadowColor: readRgb(settings.shadowColor, { r: 0, g: 0, b: 0 }),
      },
      blobSettings: {
        opacity: readClampedNumber(blobSettings.opacity, 0.2, 0, 1),
        yOffset: readNonNegativeNumber(blobSettings.yOffset, 0.02),
        sizeMultiplier: readNonNegativeNumber(blobSettings.sizeMultiplier, 1),
        minSize: readNonNegativeNumber(blobSettings.minSize, 0.25),
      },
      shadowRange: {
        minZ: readNonNegativeNumber(shadowRange.minZ, 1),
        maxZ: readNonNegativeNumber(shadowRange.maxZ, 60),
      },
      shadowOrtho: {
        left: readFiniteNumber(shadowOrtho.left, -20),
        right: readFiniteNumber(shadowOrtho.right, 20),
        top: readFiniteNumber(shadowOrtho.top, 20),
        bottom: readFiniteNumber(shadowOrtho.bottom, -20),
      },
      csm: {
        numCascades: readNonNegativeNumber(csm.numCascades, 2),
        lambda: readClampedNumber(csm.lambda, 0.5, 0, 1),
        cascadeBlendPercentage: readClampedNumber(csm.cascadeBlendPercentage, 0.1, 0, 1),
        stabilizeCascades: readBoolean(csm.stabilizeCascades, true),
      },
      planar: normalizePlanarShadowProfile(shadows.planar),
    },
    shadowMeshes: {
      shadowReceivers: readStringList(shadowMeshes.shadowReceivers),
      shadowCasters: readStringList(shadowMeshes.shadowCasters),
      excludeFromShadow: readStringList(shadowMeshes.excludeFromShadow),
    },
  };
}

export function createPlanarShadowOptionsFromRenderingProfile(
  profile: NormalizedRenderingProfile,
  input: PlanarShadowOptionsFromRenderingProfileInput = {},
): Partial<PlanarShadowOptions> {
  const planar = profile.shadows.planar;
  return {
    enabled: planar.enabled && (input.enabled ?? true),
    plane: {
      normal: planar.plane.normal,
      height: planar.plane.height,
      heightMode: planar.plane.heightMode,
      bias: planar.plane.bias,
    },
    appearance: {
      color: planar.appearance.color,
    },
    projection: {
      footprintScale: planar.projection.footprintScale,
    },
    direction: { mode: 'follow-light' },
    stencil: {
      enabled: planar.stencil.enabled,
      receiverRenderingGroup: planar.stencil.receiverRenderingGroup,
      shadowRenderingGroup: planar.stencil.shadowRenderingGroup,
    },
    casters: {
      autoDetectAll: input.autoDetectAllCasters ?? planar.casters.autoDetectAll,
      includePatterns: [
        ...(input.additionalCasterIncludePatterns ?? []),
        ...planar.casters.includePatterns,
      ],
      excludePatterns: [
        ...DEFAULT_PLANAR_SHADOW_EXCLUDE_PATTERNS,
        ...(input.additionalExcludePatterns ?? []),
        ...planar.casters.excludePatterns,
      ],
      rootBoundaryPatterns: [
        ...(input.additionalRootBoundaryPatterns ?? []),
        ...planar.casters.rootBoundaryPatterns,
      ],
      minVolume: planar.casters.minVolume,
    },
    receivers: {
      patterns: [
        ...DEFAULT_PLANAR_SHADOW_RECEIVER_PATTERNS,
        ...(input.additionalReceiverPatterns ?? []),
        ...planar.receivers.patterns,
      ],
    },
  };
}

export function applyEditorRenderingProfilePatch(
  config: unknown,
  changes: Record<string, unknown>,
): RenderingProfilePatchResult {
  const draft = cloneRecord(config);
  const changedPaths: string[] = [];
  for (const [path, value] of Object.entries(changes)) {
    if (!isAllowedEditorRenderingPatchPath(path)) continue;
    applyAllowedRenderingPatch(draft, path, value);
    changedPaths.push(path);
  }
  return {
    config: draft,
    changedPaths,
    normalized: normalizeRenderingProfile(draft),
  };
}

export function isAllowedEditorRenderingPatchPath(path: string): path is EditorRenderingProfileAllowedPatchPath {
  return (EDITOR_RENDERING_PROFILE_ALLOWED_PATCH_PATHS as readonly string[]).includes(path);
}

function normalizePlanarShadowProfile(value: unknown): NormalizedPlanarShadowProfile {
  const planar = readRecord(value);
  const plane = readRecord(planar.plane);
  const appearance = readRecord(planar.appearance);
  const projection = readRecord(planar.projection);
  const stencil = readRecord(planar.stencil);
  const casters = readRecord(planar.casters);
  const receivers = readRecord(planar.receivers);
  return {
    enabled: readBoolean(planar.enabled, true),
    plane: {
      normal: readVec3(plane.normal, { x: 0, y: 1, z: 0 }),
      height: readFiniteNumber(plane.height, 0),
      heightMode: readPlaneHeightMode(plane.heightMode, 'receiver'),
      bias: readNonNegativeNumber(plane.bias, 0.4),
    },
    appearance: {
      color: readRgba(appearance.color, { r: 0, g: 0, b: 0, a: 0.35 }),
    },
    projection: {
      footprintScale: readClampedNumber(projection.footprintScale, 1, 0, 2),
    },
    stencil: {
      enabled: readBoolean(stencil.enabled, true),
      receiverRenderingGroup: readNonNegativeNumber(stencil.receiverRenderingGroup, 0),
      shadowRenderingGroup: readNonNegativeNumber(stencil.shadowRenderingGroup, 1),
    },
    casters: {
      autoDetectAll: readBoolean(casters.autoDetectAll, true),
      includePatterns: readStringList(casters.includePatterns),
      excludePatterns: readStringList(casters.excludePatterns),
      rootBoundaryPatterns: readStringList(casters.rootBoundaryPatterns),
      minVolume: readNonNegativeNumber(casters.minVolume, 0.001),
    },
    receivers: {
      patterns: readStringList(receivers.patterns),
    },
  };
}

function applyAllowedRenderingPatch(
  draft: Record<string, unknown>,
  path: EditorRenderingProfileAllowedPatchPath,
  value: unknown,
): void {
  const planar = ensureObject(ensureObject(draft, 'shadows'), 'planar');
  if (path === 'shadows.planar.enabled') {
    planar.enabled = value === true;
    return;
  }
  if (path === 'shadows.planar.appearance.color') {
    const appearance = ensureObject(planar, 'appearance');
    const current = readRgba(readRecord(appearance.color), { r: 0, g: 0, b: 0, a: 0.35 });
    const next = readRecord(value);
    appearance.color = {
      r: readClampedNumber(next.r, current.r, 0, 1),
      g: readClampedNumber(next.g, current.g, 0, 1),
      b: readClampedNumber(next.b, current.b, 0, 1),
      a: readClampedNumber(next.a, current.a, 0, 1),
    };
    return;
  }
  if (path === 'shadows.planar.appearance.color.a') {
    const appearance = ensureObject(planar, 'appearance');
    const current = readRgba(readRecord(appearance.color), { r: 0, g: 0, b: 0, a: 0.35 });
    appearance.color = {
      ...current,
      a: readClampedNumber(value, current.a, 0, 1),
    };
    return;
  }
  if (path === 'shadows.planar.plane.height') {
    ensureObject(planar, 'plane').height = readFiniteNumber(value, 0);
    return;
  }
  if (path === 'shadows.planar.plane.bias') {
    ensureObject(planar, 'plane').bias = readNonNegativeNumber(value, 0.4);
    return;
  }
  if (path === 'shadows.planar.projection.footprintScale') {
    ensureObject(planar, 'projection').footprintScale = readClampedNumber(value, 1, 0, 2);
    return;
  }
  if (path === 'shadows.planar.stencil.enabled') {
    ensureObject(planar, 'stencil').enabled = value === true;
    return;
  }
  if (path === 'shadows.planar.casters.excludePatterns') {
    ensureObject(planar, 'casters').excludePatterns = readStringList(value);
    return;
  }
  if (path === 'shadows.planar.casters.rootBoundaryPatterns') {
    ensureObject(planar, 'casters').rootBoundaryPatterns = readStringList(value);
    return;
  }
  if (path === 'shadows.planar.receivers.patterns') {
    ensureObject(planar, 'receivers').patterns = readStringList(value);
  }
}

function cloneRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function ensureObject(target: Record<string, unknown>, key: string): Record<string, unknown> {
  const current = target[key];
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    const next: Record<string, unknown> = {};
    target[key] = next;
    return next;
  }
  return current as Record<string, unknown>;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readVec3(value: unknown, fallback: RenderingVec3): RenderingVec3 {
  const record = readRecord(value);
  return {
    x: readFiniteNumber(record.x, fallback.x),
    y: readFiniteNumber(record.y, fallback.y),
    z: readFiniteNumber(record.z, fallback.z),
  };
}

function readRgb(value: unknown, fallback: RenderingColorRgb): RenderingColorRgb {
  const record = readRecord(value);
  return {
    r: readClampedNumber(record.r, fallback.r, 0, 1),
    g: readClampedNumber(record.g, fallback.g, 0, 1),
    b: readClampedNumber(record.b, fallback.b, 0, 1),
  };
}

function readRgba(value: unknown, fallback: RenderingColorRgba): RenderingColorRgba {
  const record = readRecord(value);
  return {
    ...readRgb(record, fallback),
    a: readClampedNumber(record.a, fallback.a, 0, 1),
  };
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map(entry => typeof entry === 'string' ? entry.trim() : '')
        .filter((entry, index, list) => entry.length > 0 && list.indexOf(entry) === index)
    : [];
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readPlaneHeightMode(value: unknown, fallback: 'fixed' | 'receiver'): 'fixed' | 'receiver' {
  return value === 'fixed' || value === 'receiver' ? value : fallback;
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readNonNegativeNumber(value: unknown, fallback: number): number {
  const resolved = readFiniteNumber(value, fallback);
  return Math.max(0, resolved);
}

function readClampedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const resolved = readFiniteNumber(value, fallback);
  return Math.min(max, Math.max(min, resolved));
}
