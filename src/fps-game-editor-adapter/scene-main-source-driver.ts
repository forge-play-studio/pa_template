import type {
  AuthoringSourceDescriptor,
  AuthoringSourceDriver,
  AuthoringSourceSaveResult,
  CompiledArtifact,
  CompiledArtifactProvenance,
} from '@fps-games/editor/playable-sdk';
import {
  createSceneMainSourceDriver as createPlayableSceneMainSourceDriver,
  loadEditorAssetLibrary as loadPlayableEditorAssetLibrary,
  loadSceneMainSource as loadPlayableSceneMainSource,
  saveSceneMainSource as savePlayableSceneMainSource,
  validateSceneMainDocument,
  type SceneMainSourceCompanionConfigs,
  type SceneMainSourceDriverLoadResult as PlayableSceneMainSourceDriverLoadResult,
  type SceneMainSourceSaveMode,
  type SceneMainSourceSaveOptions as PlayableSceneMainSourceSaveOptions,
  type SceneSourceFetchJson,
} from '@fps-games/editor/playable-sdk';
import baseSceneConfig from '../config/scene.json';
import type { SceneConfig } from '../config/types';
import type { EditorSceneAssetLibraryItem, EditorSceneDocument } from './editor-scene-document';
import {
  EDITOR_SCENE_COMPILER_ID,
  EDITOR_SCENE_COMPILER_VERSION,
  compileEditorSceneDocumentToSceneConfig,
} from './editor-scene-compiler';
import {
  getActiveRenderingConfig,
  isRenderingProfileDirty,
  markActiveRenderingConfigSaved,
  setActiveRenderingConfigError,
} from '../rendering/editor-rendering-profile-store';
import {
  getActiveStaticShadowArtifact,
  isStaticShadowArtifactDirty,
  markActiveStaticShadowArtifactSaved,
} from './editor-rendering-profile';
import type { EditorSceneRuntimeInputDrift } from './editor-authoring-source';
import { configService } from '../config/ConfigService';

export type { SceneMainSourceSaveMode };
export { validateSceneMainDocument };

export interface SceneMainSourceDriverLoadResult extends
  PlayableSceneMainSourceDriverLoadResult<EditorSceneDocument> {
  drift: EditorSceneRuntimeInputDrift | null;
}

export interface SceneMainSourceDriverOptions {
  endpointBase?: string;
  fetchJson?: SceneSourceFetchJson;
}

export interface SceneMainSourceSaveOptions extends PlayableSceneMainSourceSaveOptions {
}

export interface SceneMainSourceSaveResult extends AuthoringSourceSaveResult<EditorSceneDocument> {
  compiledArtifact?: CompiledArtifact;
  companionConfigs?: SceneMainSourceCompanionConfigs;
  expectedVersion?: number;
  renderingConfig?: Record<string, unknown>;
  sceneJsonText?: string;
}

type SceneMainSourceSaveContext = {
  renderingConfig: Record<string, unknown> | null;
  staticShadowArtifactDirty: boolean;
  staticShadowArtifact: unknown;
};

type SceneMainSourceDiagnostic = {
  severity: 'warning';
  message: string;
  source: AuthoringSourceDescriptor['ref'];
  code: string;
};

type SceneMainSourceClientRuntimeOptions = {
  endpointBase?: string;
  fetchJson: SceneSourceFetchJson;
};

type SceneMainSourcePreparedSave = {
  saveOptions?: PlayableSceneMainSourceSaveOptions;
  context?: unknown;
};

type SceneMainSourceDriverLifecycleOptions<TDocument extends EditorSceneDocument> = SceneMainSourceDriverOptions & {
  compile?: (input: {
    source: AuthoringSourceDescriptor;
    document: TDocument;
  }) => CompiledArtifact[] | Promise<CompiledArtifact[]>;
  afterLoad?: (input: { loaded: PlayableSceneMainSourceDriverLoadResult<TDocument> }) => void | Promise<void>;
  prepareSave?: (input: {
    source: AuthoringSourceDescriptor;
    document: TDocument;
  }) => SceneMainSourcePreparedSave | PlayableSceneMainSourceSaveOptions | null | undefined
    | Promise<SceneMainSourcePreparedSave | PlayableSceneMainSourceSaveOptions | null | undefined>;
  afterSave?: (input: {
    source: AuthoringSourceDescriptor;
    document: TDocument;
    saved: SceneMainSourceSaveResult;
    context?: unknown;
  }) => void | Promise<void>;
  onSaveError?: (input: {
    source: AuthoringSourceDescriptor;
    document: TDocument;
    error: unknown;
    context?: unknown;
  }) => void | Promise<void>;
  onRuntimeSceneArtifact?: (input: {
    source: AuthoringSourceDescriptor;
    document: TDocument;
    artifact: CompiledArtifact;
    phase: 'save' | 'compile';
  }) => void | Promise<void>;
};

type SceneMainSourceDriverLifecycleFactory = {
  <TDocument extends EditorSceneDocument>(
    options: SceneMainSourceDriverLifecycleOptions<TDocument>,
  ): AuthoringSourceDriver<TDocument>;
  sceneMainSourceDriverLifecycleHooks?: true;
};

export function createSceneMainSourceDriver(
  options: SceneMainSourceDriverOptions = {},
): AuthoringSourceDriver<EditorSceneDocument> {
  const request = options.fetchJson ?? fetchJson;
  const clientOptions = {
    endpointBase: options.endpointBase,
    fetchJson: request,
  };
  const lifecycleOptions = createProjectSceneMainSourceDriverLifecycleOptions(clientOptions);
  const lifecycleFactory = createPlayableSceneMainSourceDriver as unknown as SceneMainSourceDriverLifecycleFactory;
  if (lifecycleFactory.sceneMainSourceDriverLifecycleHooks === true) {
    return lifecycleFactory<EditorSceneDocument>(lifecycleOptions);
  }
  return createPublishedSceneMainSourceDriverCompatibility(clientOptions);
}

function createProjectSceneMainSourceDriverLifecycleOptions(
  clientOptions: SceneMainSourceClientRuntimeOptions,
): SceneMainSourceDriverLifecycleOptions<EditorSceneDocument> {
  return {
    endpointBase: clientOptions.endpointBase,
    fetchJson: clientOptions.fetchJson,
    afterLoad: handleProjectSceneMainSourceLoaded,
    prepareSave: prepareProjectSceneMainSourceSave,
    onSaveError: handleProjectSceneMainSourceSaveError,
    afterSave: handleProjectSceneMainSourceSaved,
    compile({ source, document }) {
      return [compileSceneMainRuntimeArtifact(source, document)];
    },
    onRuntimeSceneArtifact: handleProjectRuntimeSceneArtifact,
  };
}

function createPublishedSceneMainSourceDriverCompatibility(
  clientOptions: SceneMainSourceClientRuntimeOptions,
): AuthoringSourceDriver<EditorSceneDocument> {
  let lastCompiledArtifact: CompiledArtifact | null = null;
  return {
    sourceType: 'scene',
    async load() {
      const loaded = await loadPlayableSceneMainSource<EditorSceneDocument>(clientOptions);
      await handleProjectSceneMainSourceLoaded({ loaded });
      return {
        source: loaded.source,
        document: loaded.document,
        summary: loaded.summary,
        diagnostics: loaded.drift?.detected
          ? [createRuntimeInputDriftDiagnostic(loaded.source, loaded.drift)]
          : [],
      };
    },
    validate({ source, document }) {
      return validateSceneMainDocument(document, source);
    },
    async save({ source, document }) {
      const prepared = prepareProjectSceneMainSourceSave({ source, document });
      const saveOptions = createProjectSceneMainSourceSaveOptions(clientOptions, prepared.saveOptions);
      let saved;
      try {
        saved = await savePlayableSceneMainSource<EditorSceneDocument>(document, saveOptions);
      } catch (error) {
        await handleProjectSceneMainSourceSaveError({ source, document, error, context: prepared.context });
        throw error;
      }
      await handleProjectSceneMainSourceSaved({ source, document, saved, context: prepared.context });
      lastCompiledArtifact = saved.compiledArtifact ?? null;
      await emitProjectRuntimeSceneArtifact({
        phase: 'save',
        source: saved.source,
        document: saved.document,
        artifact: lastCompiledArtifact,
      });
      return {
        source: saved.source,
        document: saved.document,
        summary: saved.summary,
      };
    },
    async compile({ source, document }) {
      if (lastCompiledArtifact && isCompiledArtifactForSource(lastCompiledArtifact, source)) {
        const artifact = lastCompiledArtifact;
        lastCompiledArtifact = null;
        return [artifact];
      }
      const artifact = compileSceneMainRuntimeArtifact(source, document);
      await emitProjectRuntimeSceneArtifact({
        phase: 'compile',
        source,
        document,
        artifact,
      });
      return [artifact];
    },
  };
}

function createProjectSceneMainSourceSaveOptions(
  clientOptions: SceneMainSourceClientRuntimeOptions,
  saveOptions: PlayableSceneMainSourceSaveOptions | undefined,
): PlayableSceneMainSourceSaveOptions {
  return {
    endpointBase: clientOptions.endpointBase,
    fetchJson: clientOptions.fetchJson,
    ...saveOptions,
  };
}

function handleProjectSceneMainSourceLoaded(input: {
  loaded: PlayableSceneMainSourceDriverLoadResult<EditorSceneDocument>;
}): void {
  markActiveStaticShadowArtifactSaved(input.loaded.companionConfigs?.staticShadows ?? null);
}

function prepareProjectSceneMainSourceSave(
  _input: {
    source: AuthoringSourceDescriptor;
    document: EditorSceneDocument;
  },
): SceneMainSourcePreparedSave {
  const renderingConfig = isRenderingProfileDirty() ? getActiveRenderingConfig() : null;
  const staticShadowArtifactDirty = isStaticShadowArtifactDirty();
  const staticShadowArtifact = staticShadowArtifactDirty ? getActiveStaticShadowArtifact() : null;
  const context: SceneMainSourceSaveContext = {
    renderingConfig,
    staticShadowArtifactDirty,
    staticShadowArtifact,
  };
  return {
    saveOptions: renderingConfig || staticShadowArtifactDirty
      ? {
          companionConfigs: {
            ...(renderingConfig ? { rendering: renderingConfig } : {}),
            ...(staticShadowArtifactDirty ? { staticShadows: staticShadowArtifact } : {}),
          },
        }
      : undefined,
    context,
  };
}

function handleProjectSceneMainSourceSaveError(input: {
  source?: AuthoringSourceDescriptor;
  document?: EditorSceneDocument;
  error: unknown;
  context?: unknown;
}): void {
  const saveContext = input.context as SceneMainSourceSaveContext | undefined;
  if (saveContext?.renderingConfig) setActiveRenderingConfigError(input.error);
}

function handleProjectSceneMainSourceSaved(input: {
  source?: AuthoringSourceDescriptor;
  document?: EditorSceneDocument;
  saved: SceneMainSourceSaveResult;
  context?: unknown;
}): void {
  const saveContext = input.context as SceneMainSourceSaveContext | undefined;
  if (saveContext?.renderingConfig) {
    markActiveRenderingConfigSaved(input.saved.renderingConfig ?? saveContext.renderingConfig);
  }
  if (saveContext?.staticShadowArtifactDirty) {
    markActiveStaticShadowArtifactSaved(input.saved.companionConfigs?.staticShadows ?? saveContext.staticShadowArtifact);
  }
}

function handleProjectRuntimeSceneArtifact(input: {
  artifact: CompiledArtifact;
}): void {
  syncRuntimeSceneConfigForCurrentTab(input.artifact.data);
}

async function emitProjectRuntimeSceneArtifact(input: {
  phase: 'save' | 'compile';
  source: AuthoringSourceDescriptor;
  document: EditorSceneDocument;
  artifact: CompiledArtifact | null | undefined;
}): Promise<void> {
  if (!input.artifact || input.artifact.artifactType !== 'runtime-scene') return;
  await handleProjectRuntimeSceneArtifact({ artifact: input.artifact });
}

function isCompiledArtifactForSource(
  artifact: CompiledArtifact,
  source: AuthoringSourceDescriptor,
): boolean {
  return artifact.provenance?.sourceId === source.ref.sourceId
    && artifact.provenance.sourceType === source.ref.sourceType
    && artifact.provenance.revision === source.ref.revision;
}

function createRuntimeInputDriftDiagnostic(
  source: AuthoringSourceDescriptor,
  drift: EditorSceneRuntimeInputDrift,
): SceneMainSourceDiagnostic {
  return {
    severity: 'warning',
    message: `runtime input drift detected (${drift.reason ?? 'unknown'})`,
    source: source.ref,
    code: 'runtime_input_drift',
  };
}

export async function loadSceneMainSource(
  request: SceneSourceFetchJson = fetchJson,
): Promise<SceneMainSourceDriverLoadResult> {
  return loadPlayableSceneMainSource<EditorSceneDocument>({ fetchJson: request });
}

export async function saveSceneMainSource(
  editorScene: EditorSceneDocument,
  options?: SceneMainSourceSaveOptions,
): Promise<SceneMainSourceSaveResult>;
export async function saveSceneMainSource(
  request: SceneSourceFetchJson,
  editorScene: EditorSceneDocument,
  options?: SceneMainSourceSaveOptions,
): Promise<SceneMainSourceSaveResult>;
export async function saveSceneMainSource(
  requestOrEditorScene: SceneSourceFetchJson | EditorSceneDocument,
  editorSceneOrOptions?: EditorSceneDocument | SceneMainSourceSaveOptions,
  maybeOptions: SceneMainSourceSaveOptions = {},
): Promise<SceneMainSourceSaveResult> {
  if (typeof requestOrEditorScene === 'function') {
    return savePlayableSceneMainSource<EditorSceneDocument>(
      requestOrEditorScene,
      editorSceneOrOptions as EditorSceneDocument,
      maybeOptions,
    );
  }
  return savePlayableSceneMainSource<EditorSceneDocument>(
    requestOrEditorScene,
    editorSceneOrOptions as SceneMainSourceSaveOptions | undefined,
  );
}

export async function loadEditorAssetLibrary(
  request: SceneSourceFetchJson = fetchJson,
): Promise<EditorSceneAssetLibraryItem[]> {
  return loadPlayableEditorAssetLibrary(request) as Promise<EditorSceneAssetLibraryItem[]>;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${response.status}`);
  }
  return json as Record<string, unknown>;
}

function compileSceneMainRuntimeArtifact(
  source: AuthoringSourceDescriptor,
  document: EditorSceneDocument,
): CompiledArtifact {
  const compiled = compileEditorSceneDocumentToSceneConfig(
    document,
    structuredClone(baseSceneConfig) as SceneConfig,
  );
  return {
    artifactType: 'runtime-scene',
    artifactId: 'scene.json',
    provenance: readCompiledArtifactProvenance(compiled.sceneConfig, source),
    summary: summarizeSceneConfig(compiled.sceneConfig),
    data: compiled.sceneConfig,
  };
}

function readCompiledArtifactProvenance(
  sceneConfig: SceneConfig,
  source: AuthoringSourceDescriptor,
): CompiledArtifactProvenance {
  const generatedFrom = sceneConfig.meta?.generatedFrom;
  if (generatedFrom) return generatedFrom;
  return {
    ...source.ref,
    compilerId: EDITOR_SCENE_COMPILER_ID,
    compilerVersion: EDITOR_SCENE_COMPILER_VERSION,
    compiledAt: new Date().toISOString(),
  };
}

function summarizeSceneConfig(sceneConfig: SceneConfig): string {
  const version = (sceneConfig as { version?: unknown }).version ?? 'n/a';
  const assets = sceneConfig.scene?.assets.length ?? 0;
  const nodes = sceneConfig.scene?.nodes.length ?? 0;
  return `version=${version}, assets=${assets}, nodes=${nodes}`;
}

function syncRuntimeSceneConfigForCurrentTab(value: unknown): void {
  if (!isSceneConfig(value)) return;
  configService.replaceSceneConfig(structuredClone(value) as SceneConfig);
}

function isSceneConfig(value: unknown): value is SceneConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<SceneConfig>;
  return record.schemaVersion === 2
    && !!record.scene
    && typeof record.scene === 'object'
    && Array.isArray(record.scene.nodes)
    && Array.isArray(record.scene.assets);
}
