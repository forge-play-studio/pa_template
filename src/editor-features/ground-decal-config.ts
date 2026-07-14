import {
  type PlayableGroundDecalDocumentServices,
  type PlayableGroundDecalInspectorServices,
  type PlayableGroundDecalUiLayer,
} from '@fps-games/editor/playable-sdk';

import type { GroundDecalUiConfig, GroundDecalUiKind, GroundDecalUiLayer } from '../config';
import {
  canAddGroundDecalUiDeliveryPair,
  canRemoveGroundDecalUiDeliveryPair,
  createDefaultGroundDecalUiConfig,
  getGroundDecalUiDeliveryPairs,
  isGroundDecalUiConfig,
} from './ground-decal-authored';

export const PA_TEMPLATE_GROUND_DECAL_DEFAULT_UI_KIND = 'operation';
export const PA_TEMPLATE_GROUND_DECAL_LAYER_PAIR_ACTIONS = {
  addActionId: 'ground-decal-ui.delivery-pair.add', removeActionId: 'ground-decal-ui.delivery-pair.remove',
  addPath: 'groundDecal.deliveryPairs.add', removePath: 'groundDecal.deliveryPairs.remove',
  addLabel: 'Add Sub Logo + Number', removeLabel: 'Remove Sub Logo + Number',
  addTooltip: 'Add a second delivery logo and number pair.', removeTooltip: 'Remove the second delivery logo and number pair.',
} as const;

export function isPaTemplateGroundDecalUiKind(value: string): value is GroundDecalUiKind {
  return value === 'operation' || value === 'delivery';
}

export function isPaTemplateProjectEditableGroundDecalLayer(layer: GroundDecalUiLayer): boolean {
  return layer.role !== 'base';
}

export function isPaTemplateGroundDecalLayoutEditableLayer(layer: GroundDecalUiLayer): boolean {
  return layer.role === 'mainLogo' || layer.role === 'subLogo' || layer.role === 'amount';
}

export function isPaTemplateGroundDecalEditableTextureLayer(
  layer: GroundDecalUiLayer,
): layer is Extract<GroundDecalUiLayer, { kind: 'texture' }> {
  return layer.kind === 'texture' && (layer.role === 'mainLogo' || layer.role === 'subLogo' || layer.role === 'border');
}

export function isPaTemplateGroundDecalEditableColorLayer(
  layer: GroundDecalUiLayer,
): layer is Extract<GroundDecalUiLayer, { kind: 'color' | 'progress' }> {
  return layer.kind === 'progress' && layer.role === 'progressFill';
}

export function isPaTemplateGroundDecalEditableTextLayer(
  layer: GroundDecalUiLayer,
): layer is Extract<GroundDecalUiLayer, { kind: 'text' }> {
  return layer.kind === 'text' && layer.role === 'amount';
}

export function shouldUsePaTemplateGroundDecalUniformLayoutScaleMode(layer: GroundDecalUiLayer): boolean {
  return layer.role === 'mainLogo' || layer.role === 'subLogo';
}

export function createPaTemplateGroundDecalLayerLabel(layer: GroundDecalUiLayer): string {
  if (layer.role === 'mainLogo') return 'Main Logo';
  if (layer.role === 'subLogo') return layer.id === 'subLogo2' ? 'Sub Logo 2' : 'Sub Logo';
  if (layer.role === 'amount') return layer.id === 'amount2' ? 'Amount 2' : 'Amount';
  if (layer.role === 'progressFill') return 'Progress Fill';
  return layer.role.charAt(0).toUpperCase() + layer.role.slice(1);
}

export function createPaTemplateGroundDecalUiKindLabel(uiKind: string): string {
  if (uiKind === 'delivery') return 'Delivery';
  if (uiKind === 'operation') return 'Operation';
  return uiKind;
}

export const paTemplateGroundDecalDocumentPolicy = {
  defaultUiKind: PA_TEMPLATE_GROUND_DECAL_DEFAULT_UI_KIND,
  isKnownUiKind: isPaTemplateGroundDecalUiKind,
  isProjectEditableLayer: (layer: PlayableGroundDecalUiLayer) => (
    isPaTemplateProjectEditableGroundDecalLayer(layer as GroundDecalUiLayer)
  ),
  isLayoutEditableLayer: (layer: PlayableGroundDecalUiLayer) => (
    isPaTemplateGroundDecalLayoutEditableLayer(layer as GroundDecalUiLayer)
  ),
  createDefaultGroundDecal: (uiKind: string) => createDefaultGroundDecalUiConfig(uiKind as GroundDecalUiKind),
  isGroundDecalConfig: isGroundDecalUiConfig,
} satisfies Pick<
  PlayableGroundDecalDocumentServices<GroundDecalUiConfig, any>,
  | 'defaultUiKind'
  | 'isKnownUiKind'
  | 'isProjectEditableLayer'
  | 'isLayoutEditableLayer'
  | 'createDefaultGroundDecal'
  | 'isGroundDecalConfig'
>;

export const paTemplateGroundDecalInspectorPolicy = {
  ...paTemplateGroundDecalDocumentPolicy,
  isEditableTextureLayer: (layer): layer is Extract<PlayableGroundDecalUiLayer, { kind: 'texture' }> => (
    isPaTemplateGroundDecalEditableTextureLayer(layer as GroundDecalUiLayer)
  ),
  isEditableColorLayer: (layer): layer is Extract<PlayableGroundDecalUiLayer, { kind: 'color' | 'progress' }> => (
    isPaTemplateGroundDecalEditableColorLayer(layer as GroundDecalUiLayer)
  ),
  isEditableTextLayer: (layer): layer is Extract<PlayableGroundDecalUiLayer, { kind: 'text' }> => (
    isPaTemplateGroundDecalEditableTextLayer(layer as GroundDecalUiLayer)
  ),
  useUniformLayoutScaleMode: (layer) => shouldUsePaTemplateGroundDecalUniformLayoutScaleMode(layer as GroundDecalUiLayer),
  createLayerLabel: (layer) => createPaTemplateGroundDecalLayerLabel(layer as GroundDecalUiLayer),
  createUiKindLabel: createPaTemplateGroundDecalUiKindLabel,
  getLayerPairs: (decal) => getGroundDecalUiDeliveryPairs(decal as unknown as GroundDecalUiConfig),
  canAddLayerPair: (decal) => canAddGroundDecalUiDeliveryPair(decal as unknown as GroundDecalUiConfig),
  canRemoveLayerPair: (decal) => canRemoveGroundDecalUiDeliveryPair(decal as unknown as GroundDecalUiConfig),
  canShowLayerPairActions: (decal) => (decal as GroundDecalUiConfig).uiKind === 'delivery',
  createLayerPairDisabledReason: ({ action, pairCount }) => {
    if (action === 'add') {
      return pairCount >= 2
        ? 'Delivery decal already has two pairs.'
        : 'Delivery decal is missing the primary pair.';
    }
    return 'Delivery decal must keep at least one pair.';
  },
  layerPairActions: PA_TEMPLATE_GROUND_DECAL_LAYER_PAIR_ACTIONS,
} satisfies Partial<PlayableGroundDecalInspectorServices<unknown, unknown, unknown>>;

export const paTemplateGroundDecalFeatureConfig = {
  uiKinds: ['operation', 'delivery'],
  documentPolicy: paTemplateGroundDecalDocumentPolicy,
  inspectorPolicy: paTemplateGroundDecalInspectorPolicy,
  createHierarchyLabel: (kind: string) => `${kind === 'delivery' ? 'Delivery' : 'Operation'} Ground Decal UI`,
};
