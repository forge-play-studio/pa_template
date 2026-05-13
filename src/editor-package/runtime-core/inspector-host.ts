import type { ProjectSelectionController } from '../types';
import type { ProjectEditorTool } from './input-controller';
import { adaptMaterialPropertyChange, type CanonicalMaterialChange } from './material-property-adapter';
import type { RuntimeScene } from './types';
import { applyOutlinePropertyChange, isOutlinePropertyKey } from './outline-adapter';
import { syncInspectorToolState } from './inspector-adapter';

const INSPECTOR_V2_URL = 'https://preview.babylonjs.com/inspector/babylon.inspector-v2.bundle.js';
const CONTEXT_SELECTION = 'context:selection';

type InspectorToken = { dispose(): void; isDisposed?: boolean } | null;

type InspectorV2 = {
  ShowInspector?: (scene: RuntimeScene, options?: Record<string, unknown>) => InspectorToken;
  ConvertOptions?: (options: Record<string, unknown>) => Record<string, unknown>;
  SelectionServiceIdentity?: unknown;
};

type CreateProjectInspectorHostOptions = {
  getScene: () => RuntimeScene | null;
  getSelectionController: () => ProjectSelectionController | null;
  getSelectedEntity: () => any | null;
  getCurrentTool?: () => ProjectEditorTool;
  resolveBinding?: (node: any) => any | null;
  onMaterialPropertyChanged?: (change: CanonicalMaterialChange) => void;
};

const INSPECTOR_HIGHLIGHT_SETTING_KEY = 'Babylon/Inspector/HighlightSelectedEntity';

function patchSelection(): void {
  const proto = Selection.prototype as Selection & { __forgeProjectPatched?: boolean };
  if ((proto as any).__forgeProjectPatched) return;
  const original = Selection.prototype.addRange;
  Selection.prototype.addRange = function patchedAddRange(range: Range) {
    original.call(this, range);
    if (this.toString()) return;

    let node: Node = range.startContainer;
    if (node.nodeType === Node.ELEMENT_NODE && range.startOffset < node.childNodes.length) {
      node = node.childNodes[range.startOffset];
    }
    const element = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
    if (!element) return;
    element.style.setProperty('user-select', 'text', 'important');
    original.call(this, range);
  };
  (proto as any).__forgeProjectPatched = true;
}

function patchGizmoManagerPrototype(GizmoManager: any, marker: string) {
  const proto = GizmoManager?.prototype;
  if (!proto || proto[marker]) return;

  const applyRotationOverride = (manager: any) => {
    if (manager?.gizmos?.rotationGizmo) {
      manager.gizmos.rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    }
  };

  const rotationDesc = Object.getOwnPropertyDescriptor(proto, 'rotationGizmoEnabled');
  if (rotationDesc?.get && rotationDesc.set) {
    const setRotationGizmoEnabled = rotationDesc.set;
    Object.defineProperty(proto, 'rotationGizmoEnabled', {
      configurable: true,
      enumerable: rotationDesc.enumerable ?? false,
      get: rotationDesc.get,
      set(this: any, value: boolean) {
        setRotationGizmoEnabled.call(this, value);
        if (value) applyRotationOverride(this);
      },
    });
  }

  const coordinatesDesc = Object.getOwnPropertyDescriptor(proto, 'coordinatesMode');
  if (coordinatesDesc?.get && coordinatesDesc.set) {
    const setCoordinatesMode = coordinatesDesc.set;
    Object.defineProperty(proto, 'coordinatesMode', {
      configurable: true,
      enumerable: coordinatesDesc.enumerable ?? false,
      get: coordinatesDesc.get,
      set(this: any, value: number) {
        setCoordinatesMode.call(this, value);
        applyRotationOverride(this);
      },
    });
  }

  Object.defineProperty(proto, marker, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function patchRotationGizmoPrototype(RotationGizmo: any, marker: string) {
  const proto = RotationGizmo?.prototype;
  if (!proto || proto[marker]) return;

  const applyRotationOverride = (gizmo: any) => {
    if (!gizmo) return;
    if (gizmo.xGizmo) gizmo.xGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    if (gizmo.yGizmo) gizmo.yGizmo.updateGizmoRotationToMatchAttachedMesh = false;
    if (gizmo.zGizmo) gizmo.zGizmo.updateGizmoRotationToMatchAttachedMesh = false;
  };

  const updateDesc = Object.getOwnPropertyDescriptor(proto, 'updateGizmoRotationToMatchAttachedMesh');
  if (updateDesc?.get && updateDesc.set) {
    const setUpdateGizmoRotation = updateDesc.set;
    Object.defineProperty(proto, 'updateGizmoRotationToMatchAttachedMesh', {
      configurable: true,
      enumerable: updateDesc.enumerable ?? false,
      get: updateDesc.get,
      set(this: any, _value: boolean) {
        setUpdateGizmoRotation.call(this, false);
        applyRotationOverride(this);
      },
    });
  }

  const coordinatesDesc = Object.getOwnPropertyDescriptor(proto, 'coordinatesMode');
  if (coordinatesDesc?.set) {
    const setCoordinatesMode = coordinatesDesc.set;
    Object.defineProperty(proto, 'coordinatesMode', {
      configurable: true,
      enumerable: coordinatesDesc.enumerable ?? false,
      get: coordinatesDesc.get,
      set(this: any, value: number) {
        setCoordinatesMode.call(this, value);
        applyRotationOverride(this);
      },
    });
  }

  Object.defineProperty(proto, marker, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function patchPlaneRotationGizmoPrototype(PlaneRotationGizmo: any, marker: string) {
  const proto = PlaneRotationGizmo?.prototype;
  if (!proto || proto[marker]) return;

  const forceDisabled = function forceDisabled(this: any) {
    this._updateGizmoRotationToMatchAttachedMesh = false;
  };

  const baseProto = Object.getPrototypeOf(proto);
  const updateDesc = baseProto ? Object.getOwnPropertyDescriptor(baseProto, 'updateGizmoRotationToMatchAttachedMesh') : null;
  if (updateDesc?.get && updateDesc.set) {
    const getUpdateGizmoRotation = updateDesc.get;
    const setUpdateGizmoRotation = updateDesc.set;
    Object.defineProperty(proto, 'updateGizmoRotationToMatchAttachedMesh', {
      configurable: true,
      enumerable: updateDesc.enumerable ?? false,
      get(this: any) {
        return getUpdateGizmoRotation.call(this);
      },
      set(this: any, _value: boolean) {
        setUpdateGizmoRotation.call(this, false);
        forceDisabled.call(this);
      },
    });
  }

  const coordinatesDesc = baseProto ? Object.getOwnPropertyDescriptor(baseProto, 'coordinatesMode') : null;
  if (coordinatesDesc?.get && coordinatesDesc.set) {
    const getCoordinatesMode = coordinatesDesc.get;
    const setCoordinatesMode = coordinatesDesc.set;
    Object.defineProperty(proto, 'coordinatesMode', {
      configurable: true,
      enumerable: coordinatesDesc.enumerable ?? false,
      get(this: any) {
        return getCoordinatesMode.call(this);
      },
      set(this: any, value: number) {
        setCoordinatesMode.call(this, value);
        forceDisabled.call(this);
      },
    });
  }

  Object.defineProperty(proto, marker, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function patchBabylonGizmoClasses(source: any, markerPrefix: string) {
  if (!source) return;
  const root = window as any;
  if (source.GizmoManager && !root.__forgeGizmoManagerCtor) root.__forgeGizmoManagerCtor = source.GizmoManager;
  patchGizmoManagerPrototype(source.GizmoManager, `${markerPrefix}Manager`);
  patchRotationGizmoPrototype(source.RotationGizmo, `${markerPrefix}Rotation`);
  patchPlaneRotationGizmoPrototype(source.PlaneRotationGizmo, `${markerPrefix}Plane`);
}

function patchInstancedMeshOutlineProperties(source: any, marker: string) {
  const proto = source?.InstancedMesh?.prototype;
  if (!proto || proto[marker]) return;

  const defineForwardedProperty = (property: 'renderOutline' | 'outlineColor' | 'outlineWidth') => {
    Object.defineProperty(proto, property, {
      configurable: true,
      enumerable: true,
      get(this: any) {
        return this?.sourceMesh?.[property];
      },
      set(this: any, value: any) {
        if (this?.sourceMesh) {
          this.sourceMesh[property] = value;
          return;
        }
        Object.defineProperty(this, property, {
          value,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      },
    });
  };

  defineForwardedProperty('renderOutline');
  defineForwardedProperty('outlineColor');
  defineForwardedProperty('outlineWidth');

  Object.defineProperty(proto, marker, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}

function patchInspectorDefaults(): void {
  try {
    localStorage.setItem(INSPECTOR_HIGHLIGHT_SETTING_KEY, 'false');
  } catch {}

  const BABYLON = (window as any).BABYLON;
  patchInstancedMeshOutlineProperties(BABYLON, '__forgeInstancedOutlinePatched');
}

async function patchRotationGizmoDefaults() {
  try {
    patchInspectorDefaults();
    patchBabylonGizmoClasses((window as any).BABYLON, '__forgeWindow');

    const initRes = await fetch('/vite-plugins/inspector/init.ts', { cache: 'no-store' });
    if (initRes.ok) {
      const source = await initRes.text();
      const hashMatch = source.match(/\?v=([a-z0-9]+)/i);
      const version = hashMatch?.[1] || '';
      const directModule = version
        ? `/node_modules/.vite/deps/@babylonjs_core_Gizmos_gizmoManager.js?v=${version}`
        : '/node_modules/.vite/deps/@babylonjs_core_Gizmos_gizmoManager.js';
      try {
        const mod = await import(/* @vite-ignore */ directModule);
        patchBabylonGizmoClasses(mod as any, '__forgeDirectModule');
      } catch {}
    }

    const metadataRes = await fetch('/node_modules/.vite/deps/_metadata.json', { cache: 'no-store' });
    if (!metadataRes.ok) return;

    const meta = await metadataRes.json();
    const browserHash = typeof meta?.browserHash === 'string' ? meta.browserHash : '';
    const file = meta?.optimized?.['@babylonjs/core/Gizmos/gizmoManager']?.file;
    if (typeof file !== 'string' || !file) return;

    const base = `/node_modules/.vite/deps/${file}`;
    const url = browserHash ? `${base}?v=${browserHash}` : base;
    try {
      const mod = await import(/* @vite-ignore */ url);
      patchBabylonGizmoClasses(mod as any, '__forgeModule');
    } catch {}

    try {
      const sourceRes = await fetch(url, { cache: 'no-store' });
      if (!sourceRes.ok) return;
      const source = await sourceRes.text();
      const match = source.match(/from "\.\/(chunk-[A-Z0-9]+\.js)"/);
      if (!match?.[1]) return;
      const chunkBase = `/node_modules/.vite/deps/${match[1]}`;
      const chunkUrl = browserHash ? `${chunkBase}?v=${browserHash}` : chunkBase;
      const chunk = await import(/* @vite-ignore */ chunkUrl);
      patchBabylonGizmoClasses(chunk as any, '__forgeChunk');
    } catch {}
  } catch {}
}

function injectInspectorStyle(): void {
  if (document.getElementById('project-inspector-style')) return;
  const style = document.createElement('style');
  style.id = 'project-inspector-style';
  style.textContent = [
    '#inspector-host, #babylon-inspector-container { z-index: 99999 !important; }',
    '#inspector-host button.bridge-tool-inactive, #babylon-inspector-container button.bridge-tool-inactive {',
    '  background: transparent !important;',
    '  box-shadow: none !important;',
    '}',
    '#inspector-host button.bridge-tool-active, #babylon-inspector-container button.bridge-tool-active {',
    '  background: rgba(120, 120, 120, 0.22) !important;',
    '  box-shadow: inset 0 0 0 1px rgba(120, 120, 120, 0.55) !important;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

function tuneOutlineLayer(scene: RuntimeScene | null): void {
  const engine = scene?.getEngine?.() as any;
  if (!engine?._virtualScenes) return;
  for (const virtualScene of engine._virtualScenes) {
    for (const layer of virtualScene.effectLayers || []) {
      if (layer.name !== 'InspectorSelectionOutline') continue;
      layer.clearSelection?.();
      layer.outlineThickness = 0;
      layer.occlusionStrength = 0;
      layer.isEnabled = false;
    }
  }
}

function serializeNode(node: any | null) {
  if (!node) return null;
  const parent = node.parent ?? null;
  return {
    name: node.name ?? null,
    id: node.id ?? null,
    uniqueId: node.uniqueId ?? null,
    type: node.getClassName?.() || node.constructor?.name || 'Unknown',
    metadata: node.metadata ?? null,
    parent: parent ? {
      name: parent.name ?? null,
      id: parent.uniqueId ?? parent.id ?? null,
      type: parent.getClassName?.() || parent.constructor?.name || 'Unknown',
    } : null,
    transform: {
      position: node.position ? { x: node.position.x, y: node.position.y, z: node.position.z } : null,
      rotation: node.rotation ? { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z } : null,
      scaling: node.scaling ? { x: node.scaling.x, y: node.scaling.y, z: node.scaling.z } : null,
      rotationQuaternion: node.rotationQuaternion
        ? {
          x: node.rotationQuaternion.x,
          y: node.rotationQuaternion.y,
          z: node.rotationQuaternion.z,
          w: node.rotationQuaternion.w,
        }
        : null,
    },
    material: node.material ? {
      name: node.material.name ?? null,
      type: node.material.getClassName?.() || node.material.constructor?.name || 'Unknown',
    } : null,
  };
}

async function ensureProjectInspector(): Promise<InspectorV2 | null> {
  const ensureInspectorReady = (window as any).ensureInspectorReady;
  if (typeof ensureInspectorReady === 'function') {
    try {
      const localInspector = await ensureInspectorReady();
      if (localInspector?.ShowInspector) return localInspector as InspectorV2;
    } catch {}
  }

  const existing = (window as any).INSPECTOR as InspectorV2 | undefined;
  if (existing?.ShowInspector) return existing;

  const url = (window as any).BRIDGE_INSPECTOR_URL || INSPECTOR_V2_URL;
  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load: ${url}`));
      document.head.appendChild(script);
    });
    const loaded = (window as any).INSPECTOR as InspectorV2 | undefined;
    return loaded?.ShowInspector ? loaded : null;
  } catch {
    return null;
  }
}

export function createProjectInspectorHost(options: CreateProjectInspectorHostOptions) {
  let scene: RuntimeScene | null = null;
  let inspectorVisible = false;
  let inspectorToken: InspectorToken = null;
  let dblclickHandler: ((event: MouseEvent) => void) | null = null;
  let propertyChangedObservable: any = null;
  let propertyChangedObserver: any = null;

  function emitContextSelection(node: any | null): void {
    const messenger = window.__bridge?.messenger;
    messenger?.send?.(CONTEXT_SELECTION, serializeNode(node) as any);
  }

  function unbindDblclick(): void {
    if (!dblclickHandler) return;
    document.removeEventListener('dblclick', dblclickHandler);
    dblclickHandler = null;
  }

  function unbindPropertyChanged(): void {
    if (propertyChangedObservable && propertyChangedObserver) {
      try {
        propertyChangedObservable.remove?.(propertyChangedObserver);
      } catch {}
    }
    propertyChangedObservable = null;
    propertyChangedObserver = null;
  }

  function bindPropertyChanged(v2?: InspectorV2 | null): void {
    unbindPropertyChanged();
    const observable = (v2 as any)?.Inspector?.OnPropertyChangedObservable
      ?? (window as any).BABYLON?.Inspector?.OnPropertyChangedObservable
      ?? scene?.debugLayer?.onPropertyChangedObservable
      ?? null;
    if (!observable?.add) return;

    propertyChangedObservable = observable;
    propertyChangedObserver = observable.add((event: any) => {
      const property = typeof event?.property === 'string' ? event.property : '';
      const entity = event?.object ?? null;
      if (!entity) return;

      if (isOutlinePropertyKey(property)) {
        applyOutlinePropertyChange({
          entity,
          property,
          value: event?.value,
          initialValue: event?.initialValue,
        });
        return;
      }

      const materialChange = adaptMaterialPropertyChange({
        scene,
        selectedEntity: options.getSelectedEntity(),
        entity,
        propertyKey: property,
        oldValue: event?.initialValue,
        newValue: event?.value,
        resolveBinding: (node) => options.resolveBinding?.(node) ?? null,
      });
      if (materialChange) {
        options.onMaterialPropertyChanged?.(materialChange);
      }
    });
  }

  function bindDblclick(): void {
    unbindDblclick();
    dblclickHandler = (event: MouseEvent) => {
      const selected = options.getSelectedEntity();
      if (!selected) return;
      const rawTarget = event.target as EventTarget | null;
      const target = rawTarget instanceof HTMLElement ? rawTarget : null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;

      const canvas = scene?.getEngine?.()?.getRenderingCanvas?.() ?? null;
      if (rawTarget === canvas || target.closest?.('#inspector-host, #babylon-inspector-container')) {
        emitContextSelection(selected);
      }
    };
    document.addEventListener('dblclick', dblclickHandler);
  }

  function applyCurrentSelectionAndTool(): void {
    const selectionController = options.getSelectionController();
    const selectedEntity = options.getSelectedEntity();
    if (selectedEntity) {
      selectionController?.selectEntity?.(selectedEntity, true);
    }
    const tool = options.getCurrentTool?.();
    if (tool) syncInspectorToolState(tool);
  }

  return {
    init(nextScene: RuntimeScene | null): void {
      scene = nextScene;
      patchInspectorDefaults();
      patchSelection();
      void patchRotationGizmoDefaults();
    },

    async show(): Promise<void> {
      if (!scene) return;
      await patchRotationGizmoDefaults();
      const selectionController = options.getSelectionController();
      const v2 = await ensureProjectInspector();

      if (v2?.ShowInspector) {
        const selectionBridge = selectionController?.createV2SelectionBridge?.(v2);
        const serviceDefinitions = [selectionBridge].filter(Boolean);
        const inspectorOptions = {
          ...(typeof v2.ConvertOptions === 'function'
            ? v2.ConvertOptions({ embedMode: true })
            : { layoutMode: 'overlay' }),
          serviceDefinitions: serviceDefinitions.length ? serviceDefinitions : undefined,
        };
        inspectorToken = v2.ShowInspector(scene, inspectorOptions);
        inspectorVisible = true;
        injectInspectorStyle();
        bindPropertyChanged(v2);
        selectionController?.bindSelectionSourceTracking?.();
        selectionController?.enablePicking?.();
        bindDblclick();
        window.setTimeout(() => tuneOutlineLayer(scene), 200);
        applyCurrentSelectionAndTool();
        return;
      }

      if (scene.debugLayer?.show) {
        await scene.debugLayer.show({
          embedMode: true,
          initialTab: (window as any).BABYLON?.DebugLayerTab?.Properties ?? 0,
        });
        inspectorVisible = true;
        injectInspectorStyle();
        bindPropertyChanged();
        selectionController?.bindSelectionSourceTracking?.();
        selectionController?.enablePicking?.();
        bindDblclick();
        applyCurrentSelectionAndTool();
        return;
      }

      const Inspector = (window as any).BABYLON?.Inspector;
      if (Inspector?.Show) {
        Inspector.Show(scene, {
          embedMode: true,
          initialTab: (window as any).BABYLON?.DebugLayerTab?.Properties ?? 0,
        });
        inspectorVisible = true;
        injectInspectorStyle();
        bindPropertyChanged();
        selectionController?.bindSelectionSourceTracking?.();
        selectionController?.enablePicking?.();
        bindDblclick();
        applyCurrentSelectionAndTool();
      }
    },

    hide(): void {
      if (!inspectorVisible) return;
      unbindDblclick();
      unbindPropertyChanged();
      options.getSelectionController()?.reset?.();
      try {
        if (inspectorToken) {
          if (!inspectorToken.isDisposed) inspectorToken.dispose();
          inspectorToken = null;
        } else if (scene?.debugLayer) {
          scene.debugLayer.hide();
        } else {
          const Inspector = (window as any).BABYLON?.Inspector;
          if (Inspector?.Hide) Inspector.Hide();
        }
      } catch {}
      inspectorVisible = false;
    },

    isVisible(): boolean {
      return inspectorVisible;
    },

    syncTool(tool: ProjectEditorTool): void {
      syncInspectorToolState(tool);
    },

    tuneOutlineLayer(): void {
      tuneOutlineLayer(scene);
    },
  };
}
