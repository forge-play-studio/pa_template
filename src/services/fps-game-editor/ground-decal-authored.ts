import type { GroundDecalUiColor, GroundDecalUiConfig, GroundDecalUiKind, GroundDecalUiTextLayer, GroundDecalUiTextureLayer } from '../../config';

// Node-safe project configuration must not import the browser asset catalog because it
// contains Vite `?url` modules. The authoring check keeps these canonical IDs in sync
// with the generated catalog entries for their corresponding code keys.
const GROUND_DECAL_DEFAULT_TEXTURE_ASSET_IDS = {
  ground_decal_border_reference: 'texture_969907ee4a1d453ea7b0ee3247cb6bb1',
  ground_decal_conveyor_reference: 'texture_ee97d50a7eb442b5905add9aaae74f2c',
  ground_decal_money_reference: 'texture_331e16209e8c47cc94217508d719cbbb',
  ground_decal_custom_progress_normal: 'texture_9c7041dec3d745aeb20d692ba518017d',
  ground_decal_custom_progress_active: 'texture_2f4cdfe94dff4487b2a4f172b59f57fe',
  ground_decal_custom_progress_fill: 'texture_97b07a11a0a0463585406c360c8bd1ca',
} as const;
const texture = (key: keyof typeof GROUND_DECAL_DEFAULT_TEXTURE_ASSET_IDS) => (
  GROUND_DECAL_DEFAULT_TEXTURE_ASSET_IDS[key]
);
const textures = {
  border: texture('ground_decal_border_reference'),
  conveyor: texture('ground_decal_conveyor_reference'),
  money: texture('ground_decal_money_reference'),
  customProgressNormal: texture('ground_decal_custom_progress_normal'),
  customProgressActive: texture('ground_decal_custom_progress_active'),
  customProgressFill: texture('ground_decal_custom_progress_fill'),
};
const baseColor: GroundDecalUiColor = { r: 0.08, g: 0.08, b: 0.08, a: 0.56 };
const progressColor: GroundDecalUiColor = { r: 0.16, g: 0.56, b: 1, a: 0.88 };
const pairIds = [{ subLogoId: 'subLogo', amountId: 'amount' }, { subLogoId: 'subLogo2', amountId: 'amount2' }] as const;

export interface GroundDecalUiDeliveryPair {
  index: 1 | 2;
  subLogoLayer: GroundDecalUiTextureLayer;
  amountLayer: GroundDecalUiTextLayer;
}

export const GROUND_DECAL_UI_DELIVERY_PAIR_MAX = 2;
export const isGroundDecalUiConfig = (value: unknown): value is GroundDecalUiConfig => !!value
  && typeof value === 'object'
  && !Array.isArray(value)
  && (
    (value as any).uiKind === 'operation'
    || (value as any).uiKind === 'delivery'
    || (value as any).uiKind === 'customProgress'
  )
  && Array.isArray((value as any).layers);

export function createDefaultGroundDecalUiConfig(uiKind: GroundDecalUiKind): GroundDecalUiConfig {
  if (uiKind === 'customProgress') {
    return {
      uiKind,
      size: { width: 1.8, depth: 1.8 },
      aspectSourceLayerId: 'normalBackground',
      lockAspectToBorder: true,
      editorPreviewActive: false,
      mask: { enabled: false },
      rendering: { textureWidth: 512, textureHeight: 512, alphaIndex: 100, diffuseTextureLevel: 1, emissiveTextureLevel: 0 },
      layers: [
        { id: 'normalBackground', role: 'normalBackground', kind: 'texture', textureId: textures.customProgressNormal, tint: whiteTint(), zOrder: 0, rect: unitRect() },
        { id: 'activeBackground', role: 'activeBackground', kind: 'texture', textureId: textures.customProgressActive, tint: whiteTint(), zOrder: 10, rect: unitRect() },
        { id: 'progressImage', role: 'progressImage', kind: 'textureProgress', textureId: textures.customProgressFill, tint: whiteTint(), value: 0, editorPreviewPercent: 50, direction: 'bottomToTop', zOrder: 20, rect: unitRect() },
        { id: 'mainLogo', role: 'mainLogo', kind: 'texture', textureId: textures.conveyor, zOrder: 30, rect: unitRect() },
        { id: 'subLogo', role: 'subLogo', kind: 'texture', textureId: textures.money, zOrder: 40, rect: { x: -0.25, z: -0.25, width: 0.5, depth: 0.5 } },
        { id: 'amount', role: 'amount', kind: 'text', text: { value: '30', fontFamily: 'system-ui, Arial, sans-serif', fontSize: 96, fontWeight: '800', color: { r: 1, g: 1, b: 1, a: 1 }, strokeColor: { r: 0, g: 0, b: 0, a: 0.45 }, strokeWidth: 8, align: 'center', baseline: 'middle' }, zOrder: 50, rect: { x: 0.2, z: -0.25, width: 0.28, depth: 0.22 } },
      ],
    } as GroundDecalUiConfig;
  }
  const common = {
    uiKind, size: { width: 1.8, depth: 1.8 }, aspectSourceLayerId: 'border', lockAspectToBorder: true,
    mask: { enabled: true, source: 'roundedRect', cornerRadius: 0.18, padding: 0.02 },
    rendering: { textureWidth: 512, textureHeight: 512, alphaIndex: 100, diffuseTextureLevel: 1, emissiveTextureLevel: 0 },
  } as const;
  if (uiKind === 'operation') return {
    ...common,
    layers: [baseLayer(), { id: 'mainLogo', role: 'mainLogo', kind: 'texture', textureId: textures.money, zOrder: 20, rect: unitRect() }, borderLayer()],
  } as GroundDecalUiConfig;
  return {
    ...common,
    layers: [
      baseLayer(),
      { id: 'progressFill', role: 'progressFill', kind: 'progress', value: 0, direction: 'bottomToTop', color: progressColor, zOrder: 10, rect: unitRect() },
      { id: 'mainLogo', role: 'mainLogo', kind: 'texture', textureId: textures.conveyor, zOrder: 20, rect: unitRect() },
      { id: 'subLogo', role: 'subLogo', kind: 'texture', textureId: textures.money, zOrder: 25, rect: { x: -0.25, z: -0.25, width: 0.5, depth: 0.5 } },
      { id: 'amount', role: 'amount', kind: 'text', text: { value: '30', fontFamily: 'system-ui, Arial, sans-serif', fontSize: 96, fontWeight: '800', color: { r: 1, g: 1, b: 1, a: 1 }, strokeColor: { r: 0, g: 0, b: 0, a: 0.45 }, strokeWidth: 8, align: 'center', baseline: 'middle' }, zOrder: 30, rect: { x: 0.2, z: -0.25, width: 0.28, depth: 0.22 } },
      borderLayer(),
    ],
  } as GroundDecalUiConfig;
}

export function getGroundDecalUiDeliveryPairs(decal: GroundDecalUiConfig): GroundDecalUiDeliveryPair[] {
  if (decal.uiKind !== 'delivery') return [];
  return ([1, 2] as const).flatMap(index => {
    const pair = getPair(decal, index);
    return pair ? [pair] : [];
  });
}
export const canAddGroundDecalUiDeliveryPair = (decal: GroundDecalUiConfig) => decal.uiKind === 'delivery' && !!getPair(decal, 1) && !getPair(decal, 2);
export const canRemoveGroundDecalUiDeliveryPair = (decal: GroundDecalUiConfig) => decal.uiKind === 'delivery' && !!getPair(decal, 2);

export function addGroundDecalUiDeliveryPair(decal: GroundDecalUiConfig): GroundDecalUiConfig | null {
  const source = getPair(decal, 1);
  if (!source || !canAddGroundDecalUiDeliveryPair(decal)) return null;
  const layers = [
    { ...structuredClone(source.subLogoLayer), id: 'subLogo2', zOrder: Math.max(26, source.subLogoLayer.zOrder + 1), rect: { x: -0.25, z: 0.25, width: 0.5, depth: 0.5 } },
    { ...structuredClone(source.amountLayer), id: 'amount2', zOrder: Math.max(31, source.amountLayer.zOrder + 1), rect: { x: 0.2, z: 0.25, width: 0.28, depth: 0.22 } },
  ];
  const index = decal.layers.findIndex(layer => layer.id === 'border');
  const at = index < 0 ? decal.layers.length : index;
  return { ...decal, layers: [...decal.layers.slice(0, at), ...layers, ...decal.layers.slice(at)] };
}
export const removeGroundDecalUiDeliveryPair = (decal: GroundDecalUiConfig): GroundDecalUiConfig | null => canRemoveGroundDecalUiDeliveryPair(decal)
  ? { ...decal, layers: decal.layers.filter(layer => layer.id !== 'subLogo2' && layer.id !== 'amount2') }
  : null;

function getPair(decal: GroundDecalUiConfig, index: 1 | 2): GroundDecalUiDeliveryPair | null {
  const target = pairIds[index - 1];
  const subLogoLayer = decal.layers.find((layer): layer is GroundDecalUiTextureLayer => layer.id === target.subLogoId && layer.role === 'subLogo' && layer.kind === 'texture');
  const amountLayer = decal.layers.find((layer): layer is GroundDecalUiTextLayer => layer.id === target.amountId && layer.role === 'amount' && layer.kind === 'text');
  return subLogoLayer && amountLayer ? { index, subLogoLayer, amountLayer } : null;
}
const unitRect = () => ({ x: 0, z: 0, width: 1, depth: 1 });
const whiteTint = (): GroundDecalUiColor => ({ r: 1, g: 1, b: 1, a: 1 });
const baseLayer = (): GroundDecalUiConfig['layers'][number] => ({ id: 'base', role: 'base', kind: 'color', color: baseColor, zOrder: 0, rect: unitRect() });
const borderLayer = (): GroundDecalUiConfig['layers'][number] => ({ id: 'border', role: 'border', kind: 'texture', textureId: textures.border, zOrder: 100, rect: unitRect() });
