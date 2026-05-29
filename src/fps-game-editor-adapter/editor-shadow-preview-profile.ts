import renderingConfig from '../config/rendering.json';
import type { EditorSceneDocument } from './editor-scene-document';
import {
  EDITOR_SCENE_SUN_LIGHT_ID,
} from './editor-scene-session';

const DEFAULT_RECEIVER_PATTERNS = ['ground', 'Ground', 'plane', 'Plane', '地面', '地块', '地台'];
const DEFAULT_EXCLUDE_PATTERNS = [
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
];

export function resolveEditorWorldRenderingProfile(
  document: EditorSceneDocument,
) {
  const planar = readPlanarShadowConfig(renderingConfig);
  const sunObject = document.scene.gameObjects.find(gameObject => gameObject.id === EDITOR_SCENE_SUN_LIGHT_ID);
  const enabled = planar.enabled && sunObject?.active !== false;
  return {
    shadowPreview: {
      planar: {
        enabled,
        directionalLightNodeId: EDITOR_SCENE_SUN_LIGHT_ID,
        plane: {
          normal: planar.plane.normal,
          height: planar.plane.height,
          bias: planar.plane.bias,
        },
        appearance: {
          color: planar.appearance.color,
        },
        direction: { mode: 'follow-light' },
        stencil: {
          enabled: planar.stencil.enabled,
          receiverRenderingGroup: planar.stencil.receiverRenderingGroup,
          shadowRenderingGroup: planar.stencil.shadowRenderingGroup,
        },
        casters: {
          autoDetectAll: true,
          excludePatterns: [...DEFAULT_EXCLUDE_PATTERNS, ...planar.casters.excludePatterns],
          rootBoundaryPatterns: planar.casters.rootBoundaryPatterns,
          minVolume: planar.casters.minVolume,
        },
        receivers: {
          patterns: [...DEFAULT_RECEIVER_PATTERNS, ...planar.receivers.patterns],
        },
      },
    },
  };
}

function readPlanarShadowConfig(config: unknown) {
  const shadows = readRecord(readRecord(config).shadows);
  const planar = readRecord(shadows.planar);
  const plane = readRecord(planar.plane);
  const appearance = readRecord(planar.appearance);
  const stencil = readRecord(planar.stencil);
  const casters = readRecord(planar.casters);
  const receivers = readRecord(planar.receivers);
  return {
    enabled: readBoolean(planar.enabled, true),
    plane: {
      normal: readVec3(plane.normal, { x: 0, y: 1, z: 0 }),
      height: readNumber(plane.height, 0.05),
      bias: readNumber(plane.bias, 0.4),
    },
    appearance: {
      color: readRgba(appearance.color, { r: 0, g: 0, b: 0, a: 0.35 }),
    },
    stencil: {
      enabled: readBoolean(stencil.enabled, true),
      receiverRenderingGroup: readNumber(stencil.receiverRenderingGroup, 0),
      shadowRenderingGroup: readNumber(stencil.shadowRenderingGroup, 1),
    },
    casters: {
      excludePatterns: readStringList(casters.excludePatterns),
      rootBoundaryPatterns: readStringList(casters.rootBoundaryPatterns),
      minVolume: readNumber(casters.minVolume, 0.001),
    },
    receivers: {
      patterns: readStringList(receivers.patterns),
    },
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readVec3(value: unknown, fallback: { x: number; y: number; z: number }) {
  const record = readRecord(value);
  return {
    x: readNumber(record.x, fallback.x),
    y: readNumber(record.y, fallback.y),
    z: readNumber(record.z, fallback.z),
  };
}

function readRgba(value: unknown, fallback: { r: number; g: number; b: number; a: number }) {
  const record = readRecord(value);
  return {
    r: readNumber(record.r, fallback.r),
    g: readNumber(record.g, fallback.g),
    b: readNumber(record.b, fallback.b),
    a: readNumber(record.a, fallback.a),
  };
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
