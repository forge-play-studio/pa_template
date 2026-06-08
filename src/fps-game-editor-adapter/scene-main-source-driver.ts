import type {
  AuthoringSourceDescriptor,
  AuthoringSourceDriver,
  AuthoringSourceSaveResult,
  CompiledArtifact,
  CompiledArtifactProvenance,
} from '@fps-games/editor/playable-sdk';
import {
  loadEditorAssetLibrary as loadPlayableEditorAssetLibrary,
  loadSceneMainSource as loadPlayableSceneMainSource,
  saveSceneMainSource as savePlayableSceneMainSource,
  validateSceneMainDocument,
  type SceneMainSourceDriverLoadResult as PlayableSceneMainSourceDriverLoadResult,
  type SceneMainSourceSaveMode,
  type SceneMainSourceSaveOptions as PlayableSceneMainSourceSaveOptions,
  type SceneSourceFetchJson,
} from '@fps-games/editor/playable-sdk';
import baseSceneConfig from '../config/scene.json';
import type { SceneConfig } from '../config/types';
import type { EditorSceneAssetLibraryItem, EditorSceneDocument } from './editor-scene-document';
import { compileEditorSceneDocumentToSceneConfig } from './editor-scene-compiler';
import {
  getActiveRenderingConfig,
  isRenderingProfileDirty,
  markActiveRenderingConfigSaved,
  setActiveRenderingConfigError,
} from '../rendering/editor-rendering-profile-store';
import type { EditorSceneRuntimeInputDrift } from './editor-authoring-source';

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
  expectedVersion?: number;
  renderingConfig?: Record<string, unknown>;
  sceneJsonText?: string;
}

export function createSceneMainSourceDriver(
  options: SceneMainSourceDriverOptions = {},
): AuthoringSourceDriver<EditorSceneDocument> {
  const request = options.fetchJson ?? fetchJson;
  let lastCompiledArtifact: CompiledArtifact | null = null;
  return {
    sourceType: 'scene',
    async load() {
      const loaded = await loadSceneMainSource(request);
      return {
        source: loaded.source,
        document: loaded.document,
        summary: loaded.summary,
        diagnostics: loaded.drift?.detected
          ? [{
              severity: 'warning',
              message: `runtime input drift detected (${loaded.drift.reason ?? 'unknown'})`,
              source: loaded.source.ref,
              code: 'runtime_input_drift',
            }]
          : [],
      };
    },
    validate({ source, document }) {
      return validateSceneMainDocument(document, source);
    },
    async save({ document }) {
      const renderingConfig = isRenderingProfileDirty() ? getActiveRenderingConfig() : null;
      let saved: SceneMainSourceSaveResult;
      try {
        saved = await saveSceneMainSource(request, document, {
          ...(renderingConfig
            ? { companionConfigs: { rendering: renderingConfig } }
            : {}),
        });
      } catch (error) {
        if (renderingConfig) setActiveRenderingConfigError(error);
        throw error;
      }
      if (renderingConfig) markActiveRenderingConfigSaved(saved.renderingConfig ?? renderingConfig);
      lastCompiledArtifact = saved.compiledArtifact ?? null;
      return {
        source: saved.source,
        document: saved.document,
        summary: saved.summary,
      };
    },
    compile({ source, document }) {
      if (lastCompiledArtifact) {
        const artifact = lastCompiledArtifact;
        lastCompiledArtifact = null;
        return [artifact];
      }
      return [compileSceneMainRuntimeArtifact(source, document)];
    },
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
    compilerId: 'pa_template.editor-scene.compiler',
    compilerVersion: '1',
    compiledAt: new Date().toISOString(),
  };
}

function summarizeSceneConfig(sceneConfig: SceneConfig): string {
  const version = (sceneConfig as { version?: unknown }).version ?? 'n/a';
  const assets = sceneConfig.scene?.assets.length ?? 0;
  const nodes = sceneConfig.scene?.nodes.length ?? 0;
  return `version=${version}, assets=${assets}, nodes=${nodes}`;
}
