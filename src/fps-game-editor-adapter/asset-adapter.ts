import {
  EDITOR_COMMAND_NAME,
  EDITOR_EVENT_NAME,
  EDITOR_POST_MESSAGE,
  type AssetAdapter,
  type EditorAdapterContext,
} from '@fps-games/editor';

import {
  ASSET_MANAGER_ERROR_CODES,
  planAssetRegistration,
  planAssetUnregistration,
} from '../services/AssetManager';
import {
  createPlayableBridgeEventPayload,
  executePlayableAssetTransportPlan,
  readPlayableAssetImportInput,
  readPlayableAssetRegistrationPlanInput,
  readPlayableAssetUnregistrationPlanInput,
  readPlayableBridgeRequestId,
  readPlayableSceneNodeCreateInput,
  readPlayableSceneNodePatchInput,
  readPlayableSceneNodeRemoveInput,
  resolvePlayablePlatformAssetRegistrationResult,
  toPlayableBridgeCommandError,
  type PlayablePlatformAssetExternal,
} from '@fps-games/editor/playable-sdk';
import type { AssetExternalRef } from '../config';
import {
  createAssetInstance,
  removeAssetInstance,
} from '../services/SceneAssetPlacement';
import { assertSceneAssetUnused } from '../services/SceneAssetUsage';
import {
  addProjectEditorSceneNode,
  canRedoProjectEditorDocumentChange,
  canUndoProjectEditorDocumentChange,
  ensureProjectEditorDocumentLoaded,
  isProjectEditorDocumentDirty,
  patchProjectEditorSceneNode,
  PROJECT_EDITOR_SCENE_NODE_ERROR_CODES,
  ProjectEditorSceneNodeError,
  removeProjectEditorSceneNode,
} from './document';

const LOCAL_EDITOR_ASSET_BRIDGE_ACTIVE_FLAG = '__projectLocalEditorAssetBridgeActive';

type CanonicalAssetRegistration = {
  guid?: string;
  assetId: string;
  assetUrl?: string;
  external?: AssetExternalRef;
};

export interface ProjectFpsGameEditorAssetAdapterOptions {
  selectRuntimeNode?: (node: unknown | null) => void;
  publishDocumentStatus?: () => void;
}

function emitBridgeEvent(name: string, payload: Record<string, unknown>): void {
  window.__bridge?.messenger?.event?.(name, payload);
}

function sendBridgeMessage(type: string, payload: Record<string, unknown>): void {
  window.__bridge?.messenger?.send?.(type, payload);
}

function publishDocumentStatus(): void {
  sendBridgeMessage(EDITOR_POST_MESSAGE.CONTEXT_CHANGE, {
    changes: [],
    documentStatus: {
      dirty: isProjectEditorDocumentDirty(),
      canUndo: canUndoProjectEditorDocumentChange(),
      canRedo: canRedoProjectEditorDocumentChange(),
    },
  });
}

function isLocalEditorAssetBridgeActive(): boolean {
  return Boolean((globalThis as any)[LOCAL_EDITOR_ASSET_BRIDGE_ACTIVE_FLAG]);
}

function resolveProjectPluginContext(context: EditorAdapterContext) {
  const game = context.game ?? (window as any).gameInstance ?? null;
  const scene = context.scene ?? game?.scene ?? null;
  return { scene, game };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toProjectAssetExternalRef(value: PlayablePlatformAssetExternal | undefined): AssetExternalRef | undefined {
  return value ? { ...value } : undefined;
}

function resolveCanonicalRegistration(
  plan: ReturnType<typeof planAssetRegistration>,
  registered: Record<string, unknown> | null,
  fallbackAssetUrl: string | undefined,
): CanonicalAssetRegistration {
  const canonical = resolvePlayablePlatformAssetRegistrationResult({
    result: registered,
    fallback: {
      guid: plan.guid,
      assetId: plan.assetId,
      assetUrl: fallbackAssetUrl,
      external: plan.external,
    },
  });
  return {
    ...canonical,
    external: toProjectAssetExternalRef(canonical.external),
  };
}

function toEditorCommandError(error: unknown, fallbackCode: string): { code: string; error: string; details?: Record<string, unknown> } {
  return toPlayableBridgeCommandError(error, fallbackCode, {
    readProjectError: value => value instanceof ProjectEditorSceneNodeError ? {
      code: value.code,
      error: value.message,
      ...(value.details ? { details: value.details } : {}),
    } : null,
  });
}

export function createProjectFpsGameEditorAssetAdapter(
  options: ProjectFpsGameEditorAssetAdapterOptions = {},
): AssetAdapter {
  const notifyDocumentStatus = options.publishDocumentStatus ?? publishDocumentStatus;

  return {
    async handleCommand(name, params, context) {
      if (name === EDITOR_COMMAND_NAME.ASSET_REGISTRATION_PLAN) {
        try {
          const planInput = readPlayableAssetRegistrationPlanInput(params);
          const plan = planAssetRegistration(planInput as any);
          emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_REGISTRATION_PLANNED, plan as unknown as Record<string, unknown>);
        } catch (error) {
          emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_REGISTRATION_FAILED, {
            requestId: readPlayableBridgeRequestId(params),
            ok: false,
            ...toPlayableBridgeCommandError(error, ASSET_MANAGER_ERROR_CODES.assetRegistrationPlanFailed),
          });
        }
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.ASSET_UNREGISTRATION_PLAN) {
        try {
          const planInput = readPlayableAssetUnregistrationPlanInput(params);
          if (planInput.assetId) assertSceneAssetUnused(planInput.assetId);
          const plan = planAssetUnregistration(planInput);
          emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_UNREGISTRATION_PLANNED, plan as unknown as Record<string, unknown>);
        } catch (error) {
          emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_UNREGISTRATION_FAILED, {
            requestId: readPlayableBridgeRequestId(params),
            ok: false,
            ...toPlayableBridgeCommandError(error, ASSET_MANAGER_ERROR_CODES.assetUnregistrationPlanFailed),
          });
        }
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.ASSET_IMPORT) {
        if (isLocalEditorAssetBridgeActive()) return true;
        ensureProjectEditorDocumentLoaded();
        const importInput = readPlayableAssetImportInput(params);
        const inferredAssetUrl = optionalString(params.assetUrl)?.trim()
          || (importInput.inferredAssetPath ? `/@fs${importInput.inferredAssetPath}` : '');
        const registrationPlan = planAssetRegistration({
          ...importInput,
          assetName: importInput.rawAssetName || undefined,
          assetPath: importInput.inferredAssetPath,
          assetUrl: inferredAssetUrl,
        } as any);
        const registered = importInput.inferredAssetPath
          ? await executePlayableAssetTransportPlan(registrationPlan.transportPlan)
          : null;
        const canonical = resolveCanonicalRegistration(registrationPlan, registered, inferredAssetUrl);

        const result = await createAssetInstance({
          requestId: importInput.requestId,
          guid: canonical.guid,
          assetId: canonical.assetId,
          external: canonical.external,
          assetUrl: canonical.assetUrl,
          assetName: importInput.rawAssetName || undefined,
          displayName: importInput.displayName,
          category: importInput.category,
          materialMode: importInput.materialMode as any,
          scale: importInput.scale as any,
          defaultScale: importInput.defaultScale as any,
          instanceScale: importInput.instanceScale as any,
          metadata: importInput.metadata,
          dropSurfaceName: importInput.dropSurfaceName,
          clientX: importInput.clientX,
          clientY: importInput.clientY,
          position: importInput.position as any,
        }, resolveProjectPluginContext(context));

        if (result.ok) {
          if (result.rootNode) options.selectRuntimeNode?.(result.rootNode);
          notifyDocumentStatus();
        }

        emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_IMPORT_RESULT, createPlayableBridgeEventPayload(result as unknown as Record<string, unknown>));
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.ASSET_REMOVE) {
        ensureProjectEditorDocumentLoaded();
        const result = typeof params.nodeId === 'string'
          ? removeAssetInstance(params.nodeId, resolveProjectPluginContext(context))
          : {
              ok: false,
              assetId: '',
              code: ASSET_MANAGER_ERROR_CODES.missingNodeId,
              error: ASSET_MANAGER_ERROR_CODES.missingNodeId,
            };
        if (result.ok) {
          options.selectRuntimeNode?.(null);
          notifyDocumentStatus();
        }
        emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_REMOVE_RESULT, {
          requestId: readPlayableBridgeRequestId(params),
          ...result,
        });
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.SCENE_NODE_CREATE) {
        ensureProjectEditorDocumentLoaded();
        try {
          const createInput = readPlayableSceneNodeCreateInput(params);
          const created = addProjectEditorSceneNode({
            id: createInput.id,
            name: createInput.name,
            kind: createInput.kind as any,
            parentId: createInput.parentId,
            enabled: createInput.enabled,
            transform: createInput.transform as any,
            instance: createInput.instance as any,
            primitive: createInput.primitive as any,
            transformType: createInput.transformType as any,
            groundDecal: createInput.groundDecal as any,
            camera: createInput.camera as any,
            light: createInput.light as any,
          }, resolveProjectPluginContext(context));
          if (created.rootNode) options.selectRuntimeNode?.(created.rootNode);
          notifyDocumentStatus();
          emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_CREATE_RESULT, {
            requestId: createInput.requestId,
            ok: true,
            nodeId: created.node.id,
            node: created.node as unknown as Record<string, unknown>,
          });
        } catch (error) {
          emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_CREATE_RESULT, {
            requestId: readPlayableBridgeRequestId(params),
            ok: false,
            ...toEditorCommandError(error, PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.sceneNodeCreateFailed),
          });
        }
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.SCENE_NODE_PATCH) {
        ensureProjectEditorDocumentLoaded();
        try {
          const patchInput = readPlayableSceneNodePatchInput(params);
          const patched = patchProjectEditorSceneNode({
            nodeId: patchInput.nodeId,
            patches: patchInput.patches as any,
          }, resolveProjectPluginContext(context));
          if (patched.rootNode) options.selectRuntimeNode?.(patched.rootNode);
          notifyDocumentStatus();
          emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_PATCH_RESULT, {
            requestId: patchInput.requestId,
            ok: true,
            nodeId: patched.node.id,
            node: patched.node as unknown as Record<string, unknown>,
          });
        } catch (error) {
          emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_PATCH_RESULT, {
            requestId: readPlayableBridgeRequestId(params),
            ok: false,
            nodeId: readPlayableSceneNodePatchInput(params).nodeId,
            ...toEditorCommandError(error, PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.sceneNodePatchFailed),
          });
        }
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.SCENE_NODE_REMOVE) {
        ensureProjectEditorDocumentLoaded();
        const removeInput = readPlayableSceneNodeRemoveInput(params);
        const removed = removeInput.nodeId ? removeProjectEditorSceneNode(removeInput.nodeId, resolveProjectPluginContext(context)) : null;
        if (removed) {
          options.selectRuntimeNode?.(null);
          notifyDocumentStatus();
        }
        emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_REMOVE_RESULT, {
          requestId: removeInput.requestId,
          ok: Boolean(removed),
          nodeId: removeInput.nodeId,
          ...(removed
            ? { removedNodeId: removed.node.id }
            : {
                code: PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.nodeNotFound,
                error: PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.nodeNotFound,
              }),
        });
        return true;
      }

      return false;
    },
  };
}
