import { Color3 } from '@babylonjs/core/Maths/math.color';

import type { MaterialOverrideConfig } from '../config';

type MaterialColorSlot = 'albedoColor' | 'diffuseColor' | null;

type MaterialDebugBaseState = {
  colorSlot: MaterialColorSlot;
  baseColor: Color3 | null;
  emissiveColor: Color3 | null;
  metallic?: number;
  roughness?: number;
  alpha?: number;
  alphaCutOff?: number;
  transparencyMode?: number;
};

const MATERIAL_DEBUG_BASE_STATE_KEY = '__materialDebugBaseState';

export function applyMaterialDebugAdjustments(material: any, override: MaterialOverrideConfig): void {
  if (!material || typeof material !== 'object') return;

  const baseState = ensureMaterialDebugBaseState(material);
  if (baseState.colorSlot && baseState.baseColor) {
    assignColor(material, baseState.colorSlot, transformColor(baseState.baseColor, override));
  }
  if (baseState.emissiveColor && 'emissiveColor' in material) {
    assignColor(material, 'emissiveColor', transformColor(baseState.emissiveColor, override));
  }

  if ('metallic' in material) {
    material.metallic = typeof override.metallic === 'number' ? override.metallic : (baseState.metallic ?? material.metallic);
  }
  if ('roughness' in material) {
    material.roughness = typeof override.roughness === 'number' ? override.roughness : (baseState.roughness ?? material.roughness);
  }
  if ('alpha' in material) {
    material.alpha = typeof override.alpha === 'number' ? override.alpha : (baseState.alpha ?? material.alpha);
  }
  if ('transparencyMode' in material) {
    material.transparencyMode = typeof override.transparencyMode === 'number'
      ? override.transparencyMode
      : (baseState.transparencyMode ?? material.transparencyMode);
  }
  if ('alphaCutOff' in material) {
    material.alphaCutOff = typeof override.alphaCutOff === 'number'
      ? override.alphaCutOff
      : (baseState.alphaCutOff ?? material.alphaCutOff);
  }
}

function ensureMaterialDebugBaseState(material: any): MaterialDebugBaseState {
  const metadata = material.metadata && typeof material.metadata === 'object' ? material.metadata : {};
  const existing = metadata[MATERIAL_DEBUG_BASE_STATE_KEY] as MaterialDebugBaseState | undefined;
  if (existing) return existing;

  const colorSlot = resolveColorSlot(material);
  const nextState: MaterialDebugBaseState = {
    colorSlot,
    baseColor: colorSlot ? cloneColor3(material[colorSlot]) : null,
    emissiveColor: cloneColor3(material.emissiveColor),
    ...(typeof material.metallic === 'number' ? { metallic: material.metallic } : {}),
    ...(typeof material.roughness === 'number' ? { roughness: material.roughness } : {}),
    ...(typeof material.alpha === 'number' ? { alpha: material.alpha } : {}),
    ...(typeof material.alphaCutOff === 'number' ? { alphaCutOff: material.alphaCutOff } : {}),
    ...(typeof material.transparencyMode === 'number' ? { transparencyMode: material.transparencyMode } : {}),
  };

  material.metadata = {
    ...metadata,
    [MATERIAL_DEBUG_BASE_STATE_KEY]: nextState,
  };
  return nextState;
}

function resolveColorSlot(material: any): MaterialColorSlot {
  if ('albedoColor' in material) return 'albedoColor';
  if ('diffuseColor' in material) return 'diffuseColor';
  return null;
}

function cloneColor3(value: any): Color3 | null {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.clone === 'function') {
    return value.clone();
  }
  if (typeof value.r === 'number' && typeof value.g === 'number' && typeof value.b === 'number') {
    return new Color3(value.r, value.g, value.b);
  }
  return null;
}

function assignColor(material: any, property: 'albedoColor' | 'diffuseColor' | 'emissiveColor', color: Color3): void {
  const current = material[property];
  if (current?.copyFrom) {
    current.copyFrom(color);
    return;
  }
  material[property] = color.clone();
}

function transformColor(source: Color3, override: MaterialOverrideConfig): Color3 {
  const contrast = typeof override.contrast === 'number' ? override.contrast : 1;
  const brightness = typeof override.brightness === 'number' ? override.brightness : 1;
  const saturation = typeof override.saturation === 'number' ? override.saturation : 0;
  const hue = typeof override.hue === 'number' ? override.hue : 0;
  const colorDensity = typeof override.colorDensity === 'number' ? override.colorDensity : 0;

  let r = clamp01(source.r * brightness);
  let g = clamp01(source.g * brightness);
  let b = clamp01(source.b * brightness);

  r = clamp01((r - 0.5) * contrast + 0.5);
  g = clamp01((g - 0.5) * contrast + 0.5);
  b = clamp01((b - 0.5) * contrast + 0.5);

  const hsl = rgbToHsl(r, g, b);
  hsl.h = normalizeHue(hsl.h + hue);
  hsl.s = clamp01(hsl.s * Math.max(0, 1 + saturation / 100));
  let next = hslToRgb(hsl.h, hsl.s, hsl.l);

  const densityFactor = clamp(colorDensity / 100, -1, 1);
  if (densityFactor > 0) {
    next = lerpColor(next, normalizeColor(next), densityFactor);
  } else if (densityFactor < 0) {
    next = lerpColor(next, toGray(next), -densityFactor);
  }

  return new Color3(clamp01(next.r), clamp01(next.g), clamp01(next.b));
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  if (s === 0) return { r: l, g: l, b: l };

  const hueToRgb = (p: number, q: number, t: number): number => {
    let nextT = t;
    if (nextT < 0) nextT += 1;
    if (nextT > 1) nextT -= 1;
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT;
    if (nextT < 1 / 2) return q;
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6;
    return p;
  };

  const normalizedHue = normalizeHue(h) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgb(p, q, normalizedHue + 1 / 3),
    g: hueToRgb(p, q, normalizedHue),
    b: hueToRgb(p, q, normalizedHue - 1 / 3),
  };
}

function normalizeHue(value: number): number {
  const result = value % 360;
  return result < 0 ? result + 360 : result;
}

function normalizeColor(color: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  const max = Math.max(color.r, color.g, color.b);
  if (max <= 0) return { ...color };
  return {
    r: clamp01(color.r / max),
    g: clamp01(color.g / max),
    b: clamp01(color.b / max),
  };
}

function toGray(color: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  const gray = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
  return { r: gray, g: gray, b: gray };
}

function lerpColor(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
