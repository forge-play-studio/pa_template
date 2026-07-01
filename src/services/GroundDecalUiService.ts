import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import type { Scene } from '@babylonjs/core/scene';
import { ASSET_IDS, resolveTextureAssetUrl } from '../assets';
import type {
  GroundDecalUiColor,
  GroundDecalUiConfig,
  GroundDecalUiKind,
  GroundDecalUiLayer,
  GroundDecalUiRect,
  GroundDecalUiTextLayer,
  GroundDecalUiTextureLayer,
} from '../config';

const ASSET_ID_MAP = ASSET_IDS as Record<string, string | undefined>;

const TEXTURE_IDS = {
  borderWhite: ASSET_ID_MAP.ground_decal_border_reference ?? '',
  conveyor: ASSET_ID_MAP.ground_decal_conveyor_reference ?? '',
  moneyLarge: ASSET_ID_MAP.ground_decal_money_reference ?? '',
} as const;

const BASE_COLOR: GroundDecalUiColor = { r: 0.08, g: 0.08, b: 0.08, a: 0.56 };
const PROGRESS_COLOR: GroundDecalUiColor = { r: 0.16, g: 0.56, b: 1, a: 0.88 };
const DEFAULT_TEXTURE_SIZE = 512;
const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
export const GROUND_DECAL_UI_DELIVERY_PAIR_MAX = 2;

const DELIVERY_PAIR_LAYER_IDS = [
  { subLogoId: 'subLogo', amountId: 'amount' },
  { subLogoId: 'subLogo2', amountId: 'amount2' },
] as const;

export interface GroundDecalUiDeliveryPair {
  index: 1 | 2;
  subLogoLayer: GroundDecalUiTextureLayer;
  amountLayer: GroundDecalUiTextLayer;
}

export function isGroundDecalUiConfig(value: unknown): value is GroundDecalUiConfig {
  return !!value
    && typeof value === 'object'
    && !Array.isArray(value)
    && ((value as { uiKind?: unknown }).uiKind === 'operation' || (value as { uiKind?: unknown }).uiKind === 'delivery')
    && Array.isArray((value as { layers?: unknown }).layers);
}

export function createDefaultGroundDecalUiConfig(uiKind: GroundDecalUiKind): GroundDecalUiConfig {
  const common: Pick<GroundDecalUiConfig, 'uiKind' | 'size' | 'aspectSourceLayerId' | 'lockAspectToBorder' | 'mask' | 'rendering'> = {
    uiKind,
    size: { width: 1.8, depth: 1.8 },
    aspectSourceLayerId: 'border',
    lockAspectToBorder: true,
    mask: {
      enabled: true,
      source: 'roundedRect',
      cornerRadius: 0.18,
      padding: 0.02,
    },
    rendering: {
      textureWidth: 512,
      textureHeight: 512,
      alphaIndex: 100,
      diffuseTextureLevel: 1,
      emissiveTextureLevel: 0,
    },
  };

  if (uiKind === 'operation') {
    return {
      ...common,
      layers: [
        createBaseLayer(),
        {
          id: 'mainLogo',
          role: 'mainLogo',
          kind: 'texture',
          textureId: TEXTURE_IDS.moneyLarge,
          zOrder: 20,
          rect: { x: 0, z: 0, width: 1, depth: 1 },
        },
        createBorderLayer(),
      ],
    };
  }

  return {
    ...common,
    layers: [
      createBaseLayer(),
      {
        id: 'progressFill',
        role: 'progressFill',
        kind: 'progress',
        value: 0.65,
        direction: 'bottomToTop',
        color: PROGRESS_COLOR,
        zOrder: 10,
        rect: { x: 0, z: 0, width: 1, depth: 1 },
      },
      {
        id: 'mainLogo',
        role: 'mainLogo',
        kind: 'texture',
        textureId: TEXTURE_IDS.conveyor,
        zOrder: 20,
        rect: { x: 0, z: 0, width: 1, depth: 1 },
      },
      {
        id: 'subLogo',
        role: 'subLogo',
        kind: 'texture',
        textureId: TEXTURE_IDS.moneyLarge,
        zOrder: 25,
        rect: { x: -0.25, z: -0.25, width: 0.5, depth: 0.5 },
      },
      {
        id: 'amount',
        role: 'amount',
        kind: 'text',
        text: {
          value: '30',
          fontFamily: 'system-ui, Arial, sans-serif',
          fontSize: 96,
          fontWeight: '800',
          color: { r: 1, g: 1, b: 1, a: 1 },
          strokeColor: { r: 0, g: 0, b: 0, a: 0.45 },
          strokeWidth: 8,
          align: 'center',
          baseline: 'middle',
        },
        zOrder: 30,
        rect: { x: 0.2, z: -0.25, width: 0.28, depth: 0.22 },
      },
      createBorderLayer(),
    ],
  };
}

export function getGroundDecalUiDeliveryPairs(decal: GroundDecalUiConfig): GroundDecalUiDeliveryPair[] {
  if (decal.uiKind !== 'delivery') return [];
  const pairs: GroundDecalUiDeliveryPair[] = [];
  for (let index = 1; index <= GROUND_DECAL_UI_DELIVERY_PAIR_MAX; index += 1) {
    const pair = getGroundDecalUiDeliveryPair(decal, index as 1 | 2);
    if (pair) pairs.push(pair);
  }
  return pairs;
}

export function canAddGroundDecalUiDeliveryPair(decal: GroundDecalUiConfig): boolean {
  if (decal.uiKind !== 'delivery') return false;
  return !!getGroundDecalUiDeliveryPair(decal, 1) && !getGroundDecalUiDeliveryPair(decal, 2);
}

export function canRemoveGroundDecalUiDeliveryPair(decal: GroundDecalUiConfig): boolean {
  if (decal.uiKind !== 'delivery') return false;
  return !!getGroundDecalUiDeliveryPair(decal, 2);
}

export function addGroundDecalUiDeliveryPair(decal: GroundDecalUiConfig): GroundDecalUiConfig | null {
  if (!canAddGroundDecalUiDeliveryPair(decal)) return null;
  const primaryPair = getGroundDecalUiDeliveryPair(decal, 1);
  if (!primaryPair) return null;
  const secondaryLayers = createGroundDecalUiDeliveryPairLayers(2, primaryPair);
  const borderIndex = decal.layers.findIndex(layer => layer.id === 'border');
  const insertIndex = borderIndex >= 0 ? borderIndex : decal.layers.length;
  return {
    ...decal,
    layers: [
      ...decal.layers.slice(0, insertIndex),
      ...secondaryLayers,
      ...decal.layers.slice(insertIndex),
    ],
  };
}

export function removeGroundDecalUiDeliveryPair(decal: GroundDecalUiConfig): GroundDecalUiConfig | null {
  if (!canRemoveGroundDecalUiDeliveryPair(decal)) return null;
  const idsToRemove = new Set<string>(['subLogo2', 'amount2']);
  return {
    ...decal,
    layers: decal.layers.filter(layer => !idsToRemove.has(layer.id)),
  };
}

function createBaseLayer(): GroundDecalUiConfig['layers'][number] {
  return {
    id: 'base',
    role: 'base',
    kind: 'color',
    color: BASE_COLOR,
    zOrder: 0,
    rect: { x: 0, z: 0, width: 1, depth: 1 },
  };
}

function getGroundDecalUiDeliveryPair(
  decal: GroundDecalUiConfig,
  index: 1 | 2,
): GroundDecalUiDeliveryPair | null {
  const ids = DELIVERY_PAIR_LAYER_IDS[index - 1];
  const subLogoLayer = decal.layers.find((layer): layer is GroundDecalUiTextureLayer => (
    layer.id === ids.subLogoId
    && layer.role === 'subLogo'
    && layer.kind === 'texture'
  ));
  const amountLayer = decal.layers.find((layer): layer is GroundDecalUiTextLayer => (
    layer.id === ids.amountId
    && layer.role === 'amount'
    && layer.kind === 'text'
  ));
  if (!subLogoLayer || !amountLayer) return null;
  return { index, subLogoLayer, amountLayer };
}

function createGroundDecalUiDeliveryPairLayers(
  index: 2,
  sourcePair: GroundDecalUiDeliveryPair,
): [GroundDecalUiTextureLayer, GroundDecalUiTextLayer] {
  const ids = DELIVERY_PAIR_LAYER_IDS[index - 1];
  return [
    {
      ...structuredClone(sourcePair.subLogoLayer),
      id: ids.subLogoId,
      zOrder: Math.max(26, sourcePair.subLogoLayer.zOrder + 1),
      rect: { x: -0.25, z: 0.25, width: 0.5, depth: 0.5 },
    },
    {
      ...structuredClone(sourcePair.amountLayer),
      id: ids.amountId,
      zOrder: Math.max(31, sourcePair.amountLayer.zOrder + 1),
      rect: { x: 0.2, z: 0.25, width: 0.28, depth: 0.22 },
    },
  ];
}

function createBorderLayer(): GroundDecalUiConfig['layers'][number] {
  return {
    id: 'border',
    role: 'border',
    kind: 'texture',
    textureId: TEXTURE_IDS.borderWhite,
    zOrder: 100,
    rect: { x: 0, z: 0, width: 1, depth: 1 },
  };
}

export interface GroundDecalUiDynamicTextureResult {
  texture: DynamicTexture;
  ready: Promise<void>;
}

export function createGroundDecalUiDynamicTexture(
  name: string,
  scene: Scene,
  decal: GroundDecalUiConfig,
): GroundDecalUiDynamicTextureResult {
  const size = resolveGroundDecalUiTextureSize(decal);
  const texture = new DynamicTexture(name, size, scene, false);
  texture.hasAlpha = true;
  const ready = renderGroundDecalUiDynamicTexture(texture, decal);
  return { texture, ready };
}

export async function renderGroundDecalUiDynamicTexture(
  texture: DynamicTexture,
  decal: GroundDecalUiConfig,
): Promise<void> {
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  const size = texture.getSize();
  await drawGroundDecalUi(ctx, decal, size.width, size.height);
  texture.update(false);
}

async function drawGroundDecalUi(
  ctx: CanvasRenderingContext2D,
  decal: GroundDecalUiConfig,
  width: number,
  height: number,
): Promise<void> {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  applyMask(ctx, decal, width, height);
  const layers = [...decal.layers]
    .filter(layer => layer.enabled !== false)
    .sort((left, right) => left.zOrder - right.zOrder);
  for (const layer of layers) {
    await drawLayer(ctx, layer, width, height);
  }
  ctx.restore();
}

function applyMask(
  ctx: CanvasRenderingContext2D,
  decal: GroundDecalUiConfig,
  width: number,
  height: number,
): void {
  if (decal.mask?.enabled === false) return;
  const radius = Math.max(0, Math.min(width, height) * (decal.mask?.cornerRadius ?? 0.18));
  const padding = Math.max(0, Math.min(width, height) * (decal.mask?.padding ?? 0));
  roundedRectPath(ctx, padding, padding, width - padding * 2, height - padding * 2, radius);
  ctx.clip();
}

async function drawLayer(
  ctx: CanvasRenderingContext2D,
  layer: GroundDecalUiLayer,
  textureWidth: number,
  textureHeight: number,
): Promise<void> {
  ctx.save();
  ctx.globalAlpha = layer.opacity ?? 1;
  if (layer.kind === 'color') {
    const rect = resolveLayerPixelRect(layer.rect, textureWidth, textureHeight);
    ctx.fillStyle = colorToCss(layer.color);
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  } else if (layer.kind === 'progress') {
    drawProgressLayer(ctx, layer, textureWidth, textureHeight);
  } else if (layer.kind === 'texture') {
    await drawTextureLayer(ctx, layer, textureWidth, textureHeight);
  } else if (layer.kind === 'text') {
    drawTextLayer(ctx, layer, textureWidth, textureHeight);
  }
  ctx.restore();
}

function drawProgressLayer(
  ctx: CanvasRenderingContext2D,
  layer: Extract<GroundDecalUiLayer, { kind: 'progress' }>,
  textureWidth: number,
  textureHeight: number,
): void {
  const rect = resolveLayerPixelRect(layer.rect, textureWidth, textureHeight);
  const value = Math.max(0, Math.min(1, layer.value));
  const direction = layer.direction ?? 'bottomToTop';
  ctx.fillStyle = colorToCss(layer.color);
  if (direction === 'leftToRight') {
    ctx.fillRect(rect.x, rect.y, rect.width * value, rect.height);
  } else if (direction === 'rightToLeft') {
    const width = rect.width * value;
    ctx.fillRect(rect.x + rect.width - width, rect.y, width, rect.height);
  } else if (direction === 'topToBottom') {
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height * value);
  } else {
    const height = rect.height * value;
    ctx.fillRect(rect.x, rect.y + rect.height - height, rect.width, height);
  }
}

async function drawTextureLayer(
  ctx: CanvasRenderingContext2D,
  layer: Extract<GroundDecalUiLayer, { kind: 'texture' }>,
  textureWidth: number,
  textureHeight: number,
): Promise<void> {
  const rect = resolveLayerPixelRect(layer.rect, textureWidth, textureHeight);
  const url = resolveTextureAssetUrl(layer.textureId);
  const image = url ? await loadImage(url) : null;
  if (!image) {
    drawMissingTexturePlaceholder(ctx, rect);
    return;
  }
  if (layer.tint) {
    drawTintedImage(ctx, image, rect, layer.tint);
    return;
  }
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

function drawTintedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: ReturnType<typeof resolveLayerPixelRect>,
  tint: GroundDecalUiColor,
): void {
  const inheritedAlpha = ctx.globalAlpha;
  const tintAlpha = Math.max(0, Math.min(1, tint.a ?? 1));
  const totalAlpha = inheritedAlpha * tintAlpha;
  if (isWhiteTint(tint)) {
    ctx.globalAlpha = totalAlpha;
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    ctx.globalAlpha = inheritedAlpha;
    return;
  }
  const ownerDocument = ctx.canvas.ownerDocument;
  const canvas = ownerDocument.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rect.width));
  canvas.height = Math.max(1, Math.round(rect.height));
  const tintContext = canvas.getContext('2d');
  if (!tintContext) {
    ctx.globalAlpha = totalAlpha;
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    ctx.globalAlpha = inheritedAlpha;
    return;
  }
  try {
    tintContext.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = tintContext.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const r = Math.max(0, Math.min(1, tint.r));
    const g = Math.max(0, Math.min(1, tint.g));
    const b = Math.max(0, Math.min(1, tint.b));
    for (let index = 0; index < data.length; index += 4) {
      data[index] = Math.round(data[index] * r);
      data[index + 1] = Math.round(data[index + 1] * g);
      data[index + 2] = Math.round(data[index + 2] * b);
      data[index + 3] = Math.round(data[index + 3] * totalAlpha);
    }
    tintContext.putImageData(imageData, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height);
    ctx.globalAlpha = inheritedAlpha;
  } catch {
    ctx.globalAlpha = totalAlpha;
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    ctx.globalAlpha = inheritedAlpha;
  }
}

function isWhiteTint(tint: GroundDecalUiColor): boolean {
  return tint.r >= 0.999 && tint.g >= 0.999 && tint.b >= 0.999;
}

function drawTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: Extract<GroundDecalUiLayer, { kind: 'text' }>,
  textureWidth: number,
  textureHeight: number,
): void {
  const rect = resolveLayerPixelRect(layer.rect, textureWidth, textureHeight);
  const fontSize = layer.text.fontSize ?? Math.floor(rect.height * 0.72);
  const fontWeight = layer.text.fontWeight ?? '800';
  const fontFamily = layer.text.fontFamily ?? 'system-ui, Arial, sans-serif';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = layer.text.align ?? 'center';
  ctx.textBaseline = layer.text.baseline ?? 'middle';
  const x = resolveTextX(rect, ctx.textAlign);
  const y = resolveTextY(rect, ctx.textBaseline);
  if (layer.text.strokeColor && layer.text.strokeWidth) {
    ctx.lineWidth = layer.text.strokeWidth;
    ctx.strokeStyle = colorToCss(layer.text.strokeColor);
    ctx.strokeText(layer.text.value, x, y);
  }
  ctx.fillStyle = colorToCss(layer.text.color);
  ctx.fillText(layer.text.value, x, y);
}

function resolveLayerPixelRect(rect: GroundDecalUiRect, textureWidth: number, textureHeight: number) {
  const width = rect.width * textureWidth;
  const height = rect.depth * textureHeight;
  const centerX = textureWidth * (0.5 + rect.x);
  const centerY = textureHeight * (0.5 - rect.z);
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
  };
}

function resolveTextX(
  rect: ReturnType<typeof resolveLayerPixelRect>,
  align: CanvasTextAlign,
): number {
  if (align === 'left' || align === 'start') return rect.x;
  if (align === 'right' || align === 'end') return rect.x + rect.width;
  return rect.x + rect.width / 2;
}

function resolveTextY(
  rect: ReturnType<typeof resolveLayerPixelRect>,
  baseline: CanvasTextBaseline,
): number {
  if (baseline === 'top' || baseline === 'hanging') return rect.y;
  if (baseline === 'bottom' || baseline === 'alphabetic' || baseline === 'ideographic') return rect.y + rect.height;
  return rect.y + rect.height / 2;
}

function drawMissingTexturePlaceholder(
  ctx: CanvasRenderingContext2D,
  rect: ReturnType<typeof resolveLayerPixelRect>,
): void {
  ctx.fillStyle = 'rgba(255,0,80,0.55)';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function colorToCss(color: GroundDecalUiColor): string {
  const r = Math.round(Math.max(0, Math.min(1, color.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b)) * 255);
  const a = color.a ?? 1;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
  imageCache.set(url, promise);
  return promise;
}

function resolveGroundDecalUiTextureSize(decal: GroundDecalUiConfig): { width: number; height: number } {
  return {
    width: readPositiveInteger(decal.rendering?.textureWidth) ?? DEFAULT_TEXTURE_SIZE,
    height: readPositiveInteger(decal.rendering?.textureHeight) ?? DEFAULT_TEXTURE_SIZE,
  };
}

function readPositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.round(value))
    : null;
}
