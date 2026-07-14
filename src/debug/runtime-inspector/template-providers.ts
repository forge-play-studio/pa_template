import type { Game } from '../../core/Game';
import { registerRuntimeInspectorProviders } from './providers';
import { createGameplayLogicalObjectProvider } from './logical-object-provider';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import usagesDocument from '../../assets/vfx/usages.json';
import { configService } from '../../config/ConfigService';
import {
  captureMaterialRuntimeState,
  previewMaterialRuntimeState,
  restoreMaterialRuntimeState,
} from './material-control-provider';
import {
  captureAnimationRuntimeState,
  previewAnimationRuntimeState,
  restoreAnimationRuntimeState,
} from './animation-control-provider';

type AgentSessionMetadata = Record<string, unknown>;

type TemplateCameraOwnerState = {
  followEnabled: boolean;
};

export function registerTemplateRuntimeInspectorProviders(
  getGame: () => Game | null,
): () => void {
  const readCameraOwnerState = (): TemplateCameraOwnerState => {
    const threeC = getGame()?.getProjectGameplayRuntime()?.systems.threeC ?? null;
    return { followEnabled: threeC?.isCameraFollowEnabled ?? false };
  };

  return registerRuntimeInspectorProviders({
    buildIdentity: () => {
      const metadata = readAgentSessionMetadata();
      const commit = readString(metadata.projectGitSha);
      const branch = readString(metadata.projectBranch);
      const worktree = readString(metadata.projectRoot) ?? readString(metadata.paTemplateRoot);
      return {
        mode: import.meta.env.MODE,
        commit,
        branch,
        worktree,
        buildId: readString(import.meta.env.VITE_BUILD_ID) ?? commit,
        dirty: readBoolean(metadata.projectDirty),
      };
    },
    cameraControl: {
      id: 'pa-template-three-c-camera-owner',
      acquire() {
        const threeC = getGame()?.getProjectGameplayRuntime()?.systems.threeC ?? null;
        if (!threeC) throw new Error('ThreeC camera owner is unavailable');
        const stateBefore = readCameraOwnerState();
        threeC.setCameraFollowEnabled(false);
        return { restoreState: stateBefore, stateBefore };
      },
      restore(restoreState) {
        const threeC = getGame()?.getProjectGameplayRuntime()?.systems.threeC ?? null;
        if (!threeC) throw new Error('ThreeC camera owner is unavailable during restore');
        const state = restoreState as TemplateCameraOwnerState;
        threeC.setCameraFollowEnabled(state.followEnabled);
      },
      readState: readCameraOwnerState,
    },
    logicalObjects: createGameplayLogicalObjectProvider(getGame),
    snapshot: {
      id: 'pa-template-gameplay',
      capture() {
        const game = getGame();
        const gameplayRuntime = game?.getProjectGameplayRuntime() ?? null;
        return {
          data: {
            gameAvailable: Boolean(game),
            gameplayRuntimeAvailable: Boolean(gameplayRuntime),
            cameraOwner: readCameraOwnerState(),
          },
          observed: [
            'project.pa-template.game',
            'project.pa-template.gameplayRuntime',
            'project.pa-template.cameraOwner',
          ],
        };
      },
    },
    vfx: {
      id: 'pa-template-vfx',
      listEffects() {
        const packages = getGame()?.getSceneVfxService()?.getEffectPackages?.() ?? [];
        return packages.map(effectPackage => ({
          id: effectPackage.id,
          name: effectPackage.nameZh || effectPackage.id,
          placement: effectPackage.placement ?? 'world',
          geometrySpace: effectPackage.geometrySpace ?? null,
          requiredInputs: [...(effectPackage.requiredInputs ?? [])],
          optionalInputs: [...(effectPackage.optionalInputs ?? [])],
          defaultParams: effectPackage.defaultParams,
          paramDefinitions: [...effectPackage.debugParams],
          metadata: effectPackage.manifest ?? null,
          source: 'SceneVfxService.getEffectPackages',
        }));
      },
      listUsages() {
        const director = readTemplateVfxDirector(getGame());
        const runtimeUsages = director?.getVfxUsageTargets?.() ?? [];
        const runtimeById = new Map(runtimeUsages.map(usage => [usage.id, usage]));
        const authored = readAuthoredVfxUsages(usagesDocument);
        const usages = [...authored, ...runtimeUsages.filter(usage => !authored.some(item => item.id === usage.id))];
        return usages.map(authoredUsage => {
          const usage = runtimeById.get(authoredUsage.id) ?? authoredUsage;
          return {
            id: usage.id,
            label: usage.label || usage.id,
            effectId: usage.effectId,
            placement: usage.placement,
            lifecycle: usage.lifecycle,
            binding: usage.positionSource,
            params: usage.params,
            offset: usage.offset ?? null,
            ...(director?.getVfxUsageRoot ? { root: director.getVfxUsageRoot(usage.id) } : {}),
            source: runtimeById.has(usage.id)
              ? 'authored usages + ProjectVfxDirector effective overlay'
              : 'authored usages',
          };
        });
      },
      captureUsageState(usageId) {
        return readTemplateVfxDirector(getGame())?.captureVfxUsageRuntimeState?.(usageId) ?? null;
      },
      previewUsage(usageId, params) {
        return readTemplateVfxDirector(getGame())?.previewVfxUsageParams?.(usageId, params) ?? false;
      },
      restoreUsageState(_usageId, state) {
        return readTemplateVfxDirector(getGame())?.restoreVfxUsageRuntimeState?.(state) ?? false;
      },
    },
    materials: {
      id: 'pa-template-materials',
      listAssets() {
        const assets = configService.getSceneDocument().scene?.materialAssets ?? [];
        return assets.map(asset => ({
          id: asset.id,
          name: asset.name,
          kind: asset.materialKind ?? 'unspecified',
          profile: asset.profile,
          readonly: asset.system?.readonly === true,
          origin: asset.origin ?? null,
          metadata: {
            guid: asset.guid ?? null,
            system: asset.system ?? null,
          },
          source: 'ConfigService.getSceneDocument.scene.materialAssets',
        }));
      },
      listInstances() {
        const materials = getGame()?.getScene()?.materials ?? [];
        return materials.map(material => ({
          id: String(material.uniqueId),
          material,
          source: 'Game.getScene.materials',
        }));
      },
      captureInstanceState(instanceId) {
        return captureMaterialRuntimeState(getGame()?.getScene() ?? null, instanceId);
      },
      previewInstance(instanceId, set) {
        return previewMaterialRuntimeState(getGame()?.getScene() ?? null, instanceId, set);
      },
      restoreInstanceState(_instanceId, state) {
        return restoreMaterialRuntimeState(getGame()?.getScene() ?? null, state);
      },
    },
    animations: {
      id: 'pa-template-animations',
      listGroups() {
        return (getGame()?.getScene()?.animationGroups ?? []).map(group => ({
          id: String(group.uniqueId),
          group,
          source: 'Game.getScene.animationGroups',
        }));
      },
      captureGroupState(groupId) {
        return captureAnimationRuntimeState(getGame()?.getScene() ?? null, groupId);
      },
      previewGroup(groupId, set) {
        return previewAnimationRuntimeState(getGame()?.getScene() ?? null, groupId, set);
      },
      restoreGroupState(_groupId, state) {
        return restoreAnimationRuntimeState(getGame()?.getScene() ?? null, state);
      },
    },
  });
}

type TemplateVfxUsage = {
  id: string;
  label: string;
  effectId: string;
  placement: string;
  lifecycle: string;
  positionSource: unknown;
  params: unknown;
  offset?: unknown;
};

type AuthoredVfxUsage = TemplateVfxUsage;

type TemplateVfxDirector = {
  getVfxUsageTargets?(): TemplateVfxUsage[];
  getVfxUsageRoot?(usageId: string): TransformNode | null;
  captureVfxUsageRuntimeState?(usageId: string): unknown;
  previewVfxUsageParams?(usageId: string, params: Record<string, unknown>): boolean;
  restoreVfxUsageRuntimeState?(state: unknown): boolean;
};

function readTemplateVfxDirector(game: Game | null): TemplateVfxDirector | null {
  const runtime = game?.getProjectGameplayRuntime?.();
  return (runtime?.systems.vfxDirector ?? null) as TemplateVfxDirector | null;
}

function readAuthoredVfxUsages(document: unknown): AuthoredVfxUsage[] {
  if (!document || typeof document !== 'object' || Array.isArray(document)) return [];
  const usages = (document as { usages?: unknown }).usages;
  if (!Array.isArray(usages)) return [];
  return usages.flatMap(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const usage = raw as Record<string, unknown>;
    const id = readString(usage.id);
    const effectId = readString(usage.effect);
    const placement = readString(usage.placement);
    const lifecycle = readString(usage.lifecycle);
    if (!id || !effectId || !placement || !lifecycle) return [];
    return [{
      id,
      label: readString(usage.label) ?? id,
      effectId,
      placement,
      lifecycle,
      positionSource: usage.positionSource ?? null,
      params: usage.params ?? null,
      offset: usage.offset ?? null,
    }];
  });
}

function readAgentSessionMetadata(): AgentSessionMetadata {
  if (
    typeof __FPS_EDITOR_AGENT_SESSION_METADATA__ === 'object'
    && __FPS_EDITOR_AGENT_SESSION_METADATA__ !== null
  ) {
    return __FPS_EDITOR_AGENT_SESSION_METADATA__;
  }
  return {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
