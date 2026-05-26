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
  type AssetTransportPlan,
} from '../services/AssetManager';
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

const PROJECT_AUTHORING_API_BASE = '/__fps_editor_authoring';
const LOCAL_EDITOR_ASSET_BRIDGE_ACTIVE_FLAG = '__projectLocalEditorAssetBridgeActive';

type CanonicalAssetRegistration = {
  guid?: string;
  assetId: string;
  assetUrl?: string;
  external?: {
    platformAssetId?: string;
    assetPath?: string;
    assetUrl?: string;
  };
};

export interface ProjectFpsGameEditorAssetAdapterOptions {
  selectRuntimeNode?: (node: unknown | null) => void;
  publishDocumentStatus?: () => void;
}

async function executeTransportPlan(plan: AssetTransportPlan): Promise<Record<string, unknown>> {
  for (const write of plan.writes) {
    const response = await fetch(`${PROJECT_AUTHORING_API_BASE}/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: write.path, content: write.content }),
    });
    if (!response.ok) throw new Error(`asset transport write failed: HTTP ${response.status}`);
  }
  let lastResult: Record<string, unknown> = {};
  for (const command of plan.commands) {
    const response = await fetch(`${PROJECT_AUTHORING_API_BASE}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: command.cmd, cwd: command.cwd }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof json.error === 'string' ? json.error : `asset transport command failed: HTTP ${response.status}`);
    }
    const result = readRecord(json.result);
    lastResult = Object.keys(result).length > 0 ? result : readRecord(json);
  }
  return lastResult;
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

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readExternalRef(value: unknown): CanonicalAssetRegistration['external'] {
  const record = readRecord(value);
  const platformAssetId = optionalString(record.platformAssetId);
  const assetPath = optionalString(record.assetPath);
  const assetUrl = optionalString(record.assetUrl);
  if (!platformAssetId && !assetPath && !assetUrl) return undefined;
  return {
    ...(platformAssetId ? { platformAssetId } : {}),
    ...(assetPath ? { assetPath } : {}),
    ...(assetUrl ? { assetUrl } : {}),
  };
}

function resolveCanonicalRegistration(
  plan: ReturnType<typeof planAssetRegistration>,
  registered: Record<string, unknown> | null,
  fallbackAssetUrl: string | undefined,
): CanonicalAssetRegistration {
  return {
    guid: optionalString(registered?.guid) ?? plan.guid,
    assetId: optionalString(registered?.assetId) ?? plan.assetId,
    assetUrl: optionalString(registered?.assetUrl) ?? fallbackAssetUrl,
    external: readExternalRef(registered?.external) ?? plan.external,
  };
}

function toEditorCommandError(error: unknown, fallbackCode: string): { code: string; error: string; details?: Record<string, unknown> } {
  if (error instanceof ProjectEditorSceneNodeError) {
    return {
      code: error.code,
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }
  return {
    code: fallbackCode,
    error: error instanceof Error ? error.message : String(error),
  };
}

function toEventPayload(value: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...value };
  delete payload.rootNode;
  return payload;
}

export function createProjectFpsGameEditorAssetAdapter(
  options: ProjectFpsGameEditorAssetAdapterOptions = {},
): AssetAdapter {
  const notifyDocumentStatus = options.publishDocumentStatus ?? publishDocumentStatus;

  return {
    async handleCommand(name, params, context) {
      if (name === EDITOR_COMMAND_NAME.ASSET_REGISTRATION_PLAN) {
        try {
          const plan = planAssetRegistration({
            requestId: optionalString(params.requestId),
            assetName: optionalString(params.assetName),
            assetPath: optionalString(params.assetPath),
            assetUrl: optionalString(params.assetUrl),
            guid: optionalString(params.guid),
            assetId: optionalString(params.projectAssetId),
            kind: optionalString(params.assetType),
            platformAssetId: optionalString(params.platformAssetId) ?? optionalString(params.assetId),
            displayName: optionalString(params.displayName),
            category: optionalString(params.category),
            materialMode: params.materialMode as any,
            scale: params.scale as any,
            defaultScale: params.defaultScale as any,
            metadata: params.metadata as Record<string, unknown> | undefined,
            payloadPath: optionalString(params.payloadPath),
          });
          emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_REGISTRATION_PLANNED, plan as unknown as Record<string, unknown>);
        } catch (error) {
          emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_REGISTRATION_FAILED, {
            requestId: optionalString(params.requestId),
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            code: (error as any)?.code ?? ASSET_MANAGER_ERROR_CODES.assetRegistrationPlanFailed,
          });
        }
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.ASSET_UNREGISTRATION_PLAN) {
        try {
          const assetId = optionalString(params.projectAssetId) ?? optionalString(params.assetId);
          if (assetId) assertSceneAssetUnused(assetId);
          const plan = planAssetUnregistration({
            requestId: optionalString(params.requestId),
            guid: optionalString(params.guid),
            assetId,
            payloadPath: optionalString(params.payloadPath),
            deleteFile: typeof params.deleteFile === 'boolean' ? params.deleteFile : undefined,
          });
          emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_UNREGISTRATION_PLANNED, plan as unknown as Record<string, unknown>);
        } catch (error) {
          emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_UNREGISTRATION_FAILED, {
            requestId: optionalString(params.requestId),
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            code: (error as any)?.code ?? ASSET_MANAGER_ERROR_CODES.assetUnregistrationPlanFailed,
          });
        }
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.ASSET_IMPORT) {
        if (isLocalEditorAssetBridgeActive()) return true;
        ensureProjectEditorDocumentLoaded();
        const rawAssetName = optionalString(params.assetName) ?? '';
        const inferredAssetUrl = optionalString(params.assetUrl)?.trim()
          || (optionalString(params.assetPath)?.trim() ? `/@fs${params.assetPath}` : '');
        const inferredAssetPath = optionalString(params.assetPath)?.trim();
        const registrationPlan = planAssetRegistration({
          requestId: optionalString(params.requestId),
          guid: optionalString(params.guid),
          assetId: optionalString(params.projectAssetId),
          assetName: rawAssetName || undefined,
          assetPath: inferredAssetPath,
          assetUrl: inferredAssetUrl,
          kind: optionalString(params.assetType) ?? 'model',
          platformAssetId: optionalString(params.platformAssetId) ?? optionalString(params.assetId),
          displayName: optionalString(params.displayName),
          category: optionalString(params.category),
          materialMode: params.materialMode as any,
          scale: params.scale as any,
          defaultScale: params.defaultScale as any,
          metadata: params.metadata as Record<string, unknown> | undefined,
        });
        const registered = inferredAssetPath
          ? await executeTransportPlan(registrationPlan.transportPlan)
          : null;
        const canonical = resolveCanonicalRegistration(registrationPlan, registered, inferredAssetUrl);

        const result = await createAssetInstance({
          requestId: optionalString(params.requestId),
          guid: canonical.guid,
          assetId: canonical.assetId,
          external: canonical.external,
          assetUrl: canonical.assetUrl,
          assetName: rawAssetName || undefined,
          displayName: optionalString(params.displayName),
          category: optionalString(params.category),
          materialMode: params.materialMode as any,
          scale: params.scale as any,
          defaultScale: params.defaultScale as any,
          instanceScale: params.instanceScale as any,
          metadata: params.metadata as Record<string, unknown> | undefined,
          dropSurfaceName: optionalString(params.dropSurfaceName),
          clientX: typeof params.clientX === 'number' ? params.clientX : undefined,
          clientY: typeof params.clientY === 'number' ? params.clientY : undefined,
          position: params.position as any,
        }, resolveProjectPluginContext(context));

        if (result.ok) {
          if (result.rootNode) options.selectRuntimeNode?.(result.rootNode);
          notifyDocumentStatus();
        }

        emitBridgeEvent(EDITOR_EVENT_NAME.ASSET_IMPORT_RESULT, toEventPayload(result as unknown as Record<string, unknown>));
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
          requestId: optionalString(params.requestId),
          ...result,
        });
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.SCENE_NODE_CREATE) {
        ensureProjectEditorDocumentLoaded();
        try {
          const created = addProjectEditorSceneNode({
            id: optionalString(params.id),
            name: optionalString(params.name),
            kind: params.kind as any,
            parentId: optionalString(params.parentId),
            enabled: typeof params.enabled === 'boolean' ? params.enabled : undefined,
            transform: params.transform as any,
            instance: params.instance as any,
            primitive: params.primitive as any,
            transformType: params.transformType as any,
            groundDecal: params.groundDecal as any,
            camera: params.camera as any,
            light: params.light as any,
          }, resolveProjectPluginContext(context));
          if (created.rootNode) options.selectRuntimeNode?.(created.rootNode);
          notifyDocumentStatus();
          emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_CREATE_RESULT, {
            requestId: optionalString(params.requestId),
            ok: true,
            nodeId: created.node.id,
            node: created.node as unknown as Record<string, unknown>,
          });
        } catch (error) {
          emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_CREATE_RESULT, {
            requestId: optionalString(params.requestId),
            ok: false,
            ...toEditorCommandError(error, PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.sceneNodeCreateFailed),
          });
        }
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.SCENE_NODE_PATCH) {
        ensureProjectEditorDocumentLoaded();
        try {
          const patches = Array.isArray(params.patches)
            ? params.patches
            : (typeof params.path === 'string' ? [{ path: params.path, value: params.value }] : []);
          const patched = patchProjectEditorSceneNode({
            nodeId: optionalString(params.nodeId) ?? '',
            patches: patches as any,
          }, resolveProjectPluginContext(context));
          if (patched.rootNode) options.selectRuntimeNode?.(patched.rootNode);
          notifyDocumentStatus();
          emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_PATCH_RESULT, {
            requestId: optionalString(params.requestId),
            ok: true,
            nodeId: patched.node.id,
            node: patched.node as unknown as Record<string, unknown>,
          });
        } catch (error) {
          emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_PATCH_RESULT, {
            requestId: optionalString(params.requestId),
            ok: false,
            nodeId: optionalString(params.nodeId),
            ...toEditorCommandError(error, PROJECT_EDITOR_SCENE_NODE_ERROR_CODES.sceneNodePatchFailed),
          });
        }
        return true;
      }

      if (name === EDITOR_COMMAND_NAME.SCENE_NODE_REMOVE) {
        ensureProjectEditorDocumentLoaded();
        const nodeId = optionalString(params.nodeId);
        const removed = nodeId ? removeProjectEditorSceneNode(nodeId, resolveProjectPluginContext(context)) : null;
        if (removed) {
          options.selectRuntimeNode?.(null);
          notifyDocumentStatus();
        }
        emitBridgeEvent(EDITOR_EVENT_NAME.SCENE_NODE_REMOVE_RESULT, {
          requestId: optionalString(params.requestId),
          ok: Boolean(removed),
          nodeId,
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
