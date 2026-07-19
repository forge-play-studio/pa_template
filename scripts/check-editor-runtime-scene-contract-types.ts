import type {
  PlayableEditorRuntimeGroundDecalConfig,
  PlayableEditorRuntimeSceneAssetConfig,
  PlayableEditorRuntimeSceneAssetConfigV2,
  PlayableEditorRuntimeSceneAssetConfigV3,
  PlayableEditorRuntimeSceneConfig,
  PlayableEditorRuntimeSceneConfigV2,
  PlayableEditorRuntimeSceneConfigV3,
  PlayableEditorRuntimeSceneDocument,
  PlayableEditorRuntimeSceneNode,
  PlayableEditorRuntimeTransformConfig,
  PlayableEditorSceneRuntimeSourceBinding,
} from '@fps-games/editor/playable-sdk';
import type {
  SceneAssetConfig,
  SceneConfig,
  SceneDocumentScene,
  SceneDocumentSceneV2,
  SceneDocumentSceneV3,
  GroundDecalUiConfig,
  SceneMarkerTargetRefConfig,
  SceneNodeConfig,
  SceneRuntimeSourceBinding,
  TransformConfig,
} from '../src/config/types';

type Assert<T extends true> = T;
type Extends<TValue, TContract> = TValue extends TContract ? true : false;
type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends (<T>() => T extends TRight ? 1 : 2)
    ? (<T>() => T extends TRight ? 1 : 2) extends (<T>() => T extends TLeft ? 1 : 2)
      ? true
      : false
    : false;

type SceneConfigUsesSdkContract = Assert<Extends<SceneConfig, PlayableEditorRuntimeSceneConfig>>;
type SceneDocumentUsesSdkContract = Assert<Extends<SceneDocumentScene, PlayableEditorRuntimeSceneDocument>>;
type SceneAssetUsesSdkContract = Assert<Extends<SceneAssetConfig, PlayableEditorRuntimeSceneAssetConfig>>;
type SceneNodeUsesSdkContract = Assert<Extends<SceneNodeConfig, PlayableEditorRuntimeSceneNode>>;
type TransformUsesSdkContract = Assert<Equal<TransformConfig, PlayableEditorRuntimeTransformConfig>>;
type SourceUsesSdkContract = Assert<Equal<SceneRuntimeSourceBinding, PlayableEditorSceneRuntimeSourceBinding>>;
type MarkerTargetKindIsCanonical = Assert<Equal<SceneMarkerTargetRefConfig['kind'], 'marker' | 'scene-object'>>;
type GroundDecalUsesSdkContract = Assert<Equal<GroundDecalUiConfig, PlayableEditorRuntimeGroundDecalConfig>>;
type SceneV2UsesSdkContract = Assert<Extends<Extract<SceneConfig, { schemaVersion: 2 }>, PlayableEditorRuntimeSceneConfigV2<SceneDocumentSceneV2>>>;
type SceneV3UsesSdkContract = Assert<Extends<Extract<SceneConfig, { schemaVersion: 3 }>, PlayableEditorRuntimeSceneConfigV3<SceneDocumentSceneV3>>>;

// @ts-expect-error canonical artifacts require schemaVersion and scene
const missingRuntimeRoot: PlayableEditorRuntimeSceneConfig = {};
// @ts-expect-error canonical scene documents require every runtime array
const missingRuntimeArrays: PlayableEditorRuntimeSceneConfig = { schemaVersion: 3, scene: { rootId: 'root', assets: [], nodes: [], materials: [], textures: [] } };
// @ts-expect-error runtime schema v3 does not permit v2-only display fields
const v2OnlyAssetFieldInV3: PlayableEditorRuntimeSceneConfig = { schemaVersion: 3, scene: { rootId: 'root', assets: [{ id: 'asset', type: 'glb', displayName: 'legacy' }], nodes: [], materialAssets: [], materials: [], textures: [] } };
const namedV2Asset: PlayableEditorRuntimeSceneAssetConfigV2 = { id: 'legacy', type: 'glb', displayName: 'Legacy' };
// @ts-expect-error named v2 assets remain incompatible with the v3 asset contract
const namedV2AssetInV3: PlayableEditorRuntimeSceneAssetConfigV3 = namedV2Asset;
// @ts-expect-error spreading a v2 asset cannot erase its v2-only contract
const spreadV2AssetInV3: PlayableEditorRuntimeSceneAssetConfigV3 = { ...namedV2Asset };

void missingRuntimeRoot;
void missingRuntimeArrays;
void v2OnlyAssetFieldInV3;
void namedV2AssetInV3;
void spreadV2AssetInV3;

export type RuntimeSceneContractTypeAssertions =
  | SceneConfigUsesSdkContract
  | SceneDocumentUsesSdkContract
  | SceneAssetUsesSdkContract
  | SceneNodeUsesSdkContract
  | TransformUsesSdkContract
  | SourceUsesSdkContract
  | MarkerTargetKindIsCanonical
  | GroundDecalUsesSdkContract
  | SceneV2UsesSdkContract
  | SceneV3UsesSdkContract;
