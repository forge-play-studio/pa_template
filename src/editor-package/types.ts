import type { ColorRGB, Position3D, Scale3D } from '../config';

export type ProjectPersistentBinding = {
  kind: 'sceneNode';
  nodeId: string;
  rootNode: any;
};

export type ProjectPersistentBindingSnapshot = {
  kind: 'sceneNode';
  nodeId: string;
};

export type ProjectRuntimeProp = 'position' | 'rotation' | 'scaling';

export type ProjectMaterialRuntimeKind = 'pbr' | 'standard' | 'unknown';

export type ProjectMaterialProp =
  | 'material.albedoColor'
  | 'material.emissiveColor'
  | 'material.metallic'
  | 'material.roughness'
  | 'material.alpha'
  | 'material.backFaceCulling'
  | 'material.albedoTexture.url'
  | 'material.normalTexture.url'
  | 'material.metallicTexture.url'
  | 'material.pbr.albedoColor'
  | 'material.pbr.baseWeight'
  | 'material.pbr.reflectivityColor'
  | 'material.pbr.microSurface'
  | 'material.pbr.emissiveColor'
  | 'material.pbr.ambientColor'
  | 'material.pbr.lightFalloff'
  | 'material.standard.diffuseColor'
  | 'material.standard.specularColor'
  | 'material.standard.specularPower'
  | 'material.standard.emissiveColor'
  | 'material.standard.ambientColor'
  | 'material.standard.useSpecularOverAlpha';

export type ProjectMaterialValue =
  | ColorRGB
  | number
  | boolean
  | string
  | null;

export type ProjectOutlineProp =
  | 'outline.renderOutline'
  | 'outline.outlineWidth'
  | 'outline.outlineColor';

export type ProjectOutlineValue =
  | ColorRGB
  | number
  | boolean
  | null;

export interface ProjectRotation3D {
  x: number;
  y: number;
  z: number;
}

export interface ProjectEditorDocumentExport {
  sceneJsonText: string;
  expectedVersion?: number;
  version?: number;
}

export interface ProjectEditorDocumentCommitArgs {
  version?: number;
  updatedAt?: string;
  sceneJsonText?: string;
  scenePath?: string;
}

export interface ProjectEditorDuplicateResult {
  rootNode?: any;
}

export interface ProjectEditorRuntimeApi {
  active?: boolean;
  init(scene: any): void;
  showInspector(): Promise<void> | void;
  hideInspector(): void;
  setTool?(tool: 'pick' | 'move' | 'rotate' | 'scale'): void;
  getSelectedEntity?(): any | null;
  selectEntity?(entity: any | null, syncInspector?: boolean): void;
  duplicateSelected?(): Promise<boolean> | boolean;
  undo(): boolean;
  redo(): boolean;
  exportDocument(): ProjectEditorDocumentExport | null;
  commitSavedDocument(args: ProjectEditorDocumentCommitArgs): boolean;
}

export interface ProjectEditRuntimeApi {
  active?: boolean;
  enter(): Promise<void>;
  exit(save?: boolean): Promise<void>;
  _focusSelected(): void;
  isViewportNavigationActive(): boolean;
}

export interface ProjectEditorRuntime {
  owner?: 'project' | 'legacy' | 'unknown';
  Editor: ProjectEditorRuntimeApi;
  Edit: ProjectEditRuntimeApi;
  handleCommand(name: string, params: Record<string, any>): Promise<void> | void;
}

export interface ProjectSelectionController {
  createV2SelectionBridge?(v2: any): any;
  bindSelectionSourceTracking?(): void;
  unbindSelectionSourceTracking?(): void;
  enablePicking?(): void;
  reset?(): void;
  getSelectedEntity?(): any | null;
  getSelectedEntities?(): any[];
  selectEntity?(
    entity: any | null,
    syncInspector?: boolean,
    options?: { additive?: boolean; toggle?: boolean },
  ): void;
}

export type ProjectEditorRuntimeChange =
  | {
    kind: 'transform';
    binding: ProjectPersistentBindingSnapshot;
    prop: ProjectRuntimeProp;
    value: Position3D | Scale3D | ProjectRotation3D;
    rootNode?: any;
    selectedRootNode?: any | null;
  }
  | {
    kind: 'material';
    binding: ProjectPersistentBindingSnapshot;
    prop: ProjectMaterialProp;
    value: ProjectMaterialValue;
    ownerNodePath: string;
    rootNode?: any;
    selectedRootNode?: any | null;
  }
  | {
    kind: 'outline';
    binding: ProjectPersistentBindingSnapshot;
    prop: ProjectOutlineProp;
    value: ProjectOutlineValue;
    ownerNodePath: string;
    rootNode?: any;
    selectedRootNode?: any | null;
  }
  | {
    kind: 'selection';
    selectedRootNode?: any | null;
  };

export interface ProjectEditorPluginContext {
  scene: any | null;
  game: any | null;
}

export interface ProjectEditorPlugin {
  id: string;
  normalizeSelection?(args: {
    source: 'viewport' | 'tree' | 'programmatic' | 'unknown';
    rawEntity: any;
    context: ProjectEditorPluginContext;
  }): any | null;
  resolvePersistentBinding?(node: any, context: ProjectEditorPluginContext): ProjectPersistentBinding | null;
  applyDocumentChange?(args: {
    binding: ProjectPersistentBinding;
    node: any;
    prop: string;
    context: ProjectEditorPluginContext;
    oldValue?: unknown;
    newValue?: unknown;
  }): boolean;
  duplicateSelection?(args: {
    binding: ProjectPersistentBinding;
    node: any;
    context: ProjectEditorPluginContext;
  }): ProjectEditorDuplicateResult | Promise<ProjectEditorDuplicateResult | null> | null;
  isDirty?(): boolean;
  canUndo?(): boolean;
  canRedo?(): boolean;
  undoDocumentChange?(context: ProjectEditorPluginContext): ProjectEditorRuntimeChange | null;
  redoDocumentChange?(context: ProjectEditorPluginContext): ProjectEditorRuntimeChange | null;
  exportDocument?(): ProjectEditorDocumentExport | null;
  commitSavedDocument?(args: ProjectEditorDocumentCommitArgs, context: ProjectEditorPluginContext): boolean;
}

declare global {
  interface Window {
    __bridge?: {
      registerEditorPlugin?: (plugin: ProjectEditorPlugin) => void;
      registerEditorRuntime?: (runtime: ProjectEditorRuntime) => void;
      messenger?: {
        event?: (eventName: string, payload: Record<string, any>) => void;
        send?: (type: string, payload: Record<string, any>) => void;
      };
      editor?: any;
    };
    __pendingEditorPlugin?: ProjectEditorPlugin;
    __pendingEditorRuntime?: ProjectEditorRuntime;
    __bridgeLegacyEditorRuntime?: ProjectEditorRuntime;
    __bridgeProjectSelectionController?: ProjectSelectionController;
  }
}
