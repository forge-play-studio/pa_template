import type {
  AuthoringDiagnostic,
  AuthoringSourceDescriptor,
  AuthoringSourceDriver,
  AuthoringSourceSaveResult,
  CompiledArtifact,
  CompiledArtifactProvenance,
} from '@fps-games/editor-core';
import baseSceneConfig from '../config/scene.json';
import type { SceneConfig } from '../config/types';
import type { EditorSceneAssetLibraryItem, EditorSceneDocument } from './editor-scene-document';
import {
  createEditorSceneAuthoringSourceDescriptor,
  ensureEditorSceneAuthoringSource,
  type EditorSceneRuntimeInputDrift,
} from './editor-authoring-source';
import { compileEditorSceneDocumentToSceneConfig } from './editor-scene-compiler';

const PROJECT_AUTHORING_API_BASE = '/__fps_editor_authoring';

export interface SceneMainSourceDriverLoadResult {
  source: AuthoringSourceDescriptor;
  document: EditorSceneDocument;
  drift: EditorSceneRuntimeInputDrift | null;
  summary?: string;
}

export interface SceneMainSourceDriverOptions {
  fetchJson?: (url: string, init?: RequestInit) => Promise<Record<string, unknown>>;
}

export type SceneMainSourceSaveMode = 'local-commit-save' | 'prepare-platform-save';

export interface SceneMainSourceSaveOptions {
  mode?: SceneMainSourceSaveMode;
}

export interface SceneMainSourceSaveResult extends AuthoringSourceSaveResult<EditorSceneDocument> {
  compiledArtifact?: CompiledArtifact;
  expectedVersion?: number;
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
      const saved = await saveSceneMainSource(request, document);
      lastCompiledArtifact = saved.compiledArtifact ?? null;
      return {
        source: saved.source,
        document: saved.document,
        summary: saved.summary,
      };
    },
    compile({ source, document }) {
      if (lastCompiledArtifact && isCompiledArtifactForSource(lastCompiledArtifact, source)) {
        const artifact = lastCompiledArtifact;
        lastCompiledArtifact = null;
        return [artifact];
      }
      return [compileSceneMainRuntimeArtifact(source, document)];
    },
  };
}

export async function loadSceneMainSource(
  request: (url: string, init?: RequestInit) => Promise<Record<string, unknown>> = fetchJson,
): Promise<SceneMainSourceDriverLoadResult> {
  const json = await request(`${PROJECT_AUTHORING_API_BASE}/editor-scene`);
  const editorScene = readEditorScene(json.editorScene);
  if (!editorScene) throw new Error('project authoring endpoint did not return editorScene');
  const document = ensureEditorSceneAuthoringSource(editorScene);
  const drift = readRuntimeInputDrift(json.drift);
  return {
    source: createEditorSceneAuthoringSourceDescriptor(document, readString(json.editorScenePath)),
    document,
    drift,
    summary: summarizeEditorSceneSource(document, drift),
  };
}

export async function saveSceneMainSource(
  editorScene: EditorSceneDocument,
  options?: SceneMainSourceSaveOptions,
): Promise<SceneMainSourceSaveResult>;
export async function saveSceneMainSource(
  request: (url: string, init?: RequestInit) => Promise<Record<string, unknown>>,
  editorScene: EditorSceneDocument,
  options?: SceneMainSourceSaveOptions,
): Promise<SceneMainSourceSaveResult>;
export async function saveSceneMainSource(
  requestOrEditorScene: ((url: string, init?: RequestInit) => Promise<Record<string, unknown>>) | EditorSceneDocument = fetchJson,
  editorSceneOrOptions?: EditorSceneDocument | SceneMainSourceSaveOptions,
  maybeOptions: SceneMainSourceSaveOptions = {},
): Promise<SceneMainSourceSaveResult> {
  const request = typeof requestOrEditorScene === 'function' ? requestOrEditorScene : fetchJson;
  const editorScene = typeof requestOrEditorScene === 'function'
    ? editorSceneOrOptions as EditorSceneDocument
    : requestOrEditorScene;
  const options = typeof requestOrEditorScene === 'function'
    ? maybeOptions
    : editorSceneOrOptions as SceneMainSourceSaveOptions | undefined;
  const saved = await request(`${PROJECT_AUTHORING_API_BASE}/save-editor-scene`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      editorScene,
      mode: options?.mode ?? 'local-commit-save',
    }),
  });
  const document = readEditorScene(saved.editorScene) ?? editorScene;
  const source = createEditorSceneAuthoringSourceDescriptor(document, readString(saved.editorScenePath));
  return {
    source,
    document,
    summary: summarizeSaveResult(saved),
    compiledArtifact: readCompiledRuntimeSceneArtifact(saved, source),
    expectedVersion: typeof saved.expectedVersion === 'number' ? saved.expectedVersion : undefined,
    sceneJsonText: typeof saved.sceneJsonText === 'string' ? saved.sceneJsonText : undefined,
  };
}

export async function loadEditorAssetLibrary(
  request: (url: string, init?: RequestInit) => Promise<Record<string, unknown>> = fetchJson,
): Promise<EditorSceneAssetLibraryItem[]> {
  const json = await request(`${PROJECT_AUTHORING_API_BASE}/editor-asset-library`);
  return readEditorAssetLibrary(json.assets);
}

export function validateSceneMainDocument(
  document: EditorSceneDocument,
  source: AuthoringSourceDescriptor,
): AuthoringDiagnostic[] {
  const diagnostics: AuthoringDiagnostic[] = [];
  if (document.schemaVersion !== 1) {
    diagnostics.push({
      severity: 'error',
      message: 'editor-scene schemaVersion must be 1',
      path: 'schemaVersion',
      source: source.ref,
    });
  }
  if (!Array.isArray(document.assets)) {
    diagnostics.push({
      severity: 'error',
      message: 'editor-scene assets must be an array',
      path: 'assets',
      source: source.ref,
    });
  }
  if (!Array.isArray(document.scene?.gameObjects)) {
    diagnostics.push({
      severity: 'error',
      message: 'editor-scene scene.gameObjects must be an array',
      path: 'scene.gameObjects',
      source: source.ref,
    });
  }
  return diagnostics;
}

async function fetchJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : `HTTP ${response.status}`);
  }
  return json as Record<string, unknown>;
}

function readEditorScene(value: unknown): EditorSceneDocument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<EditorSceneDocument>;
  if (candidate.schemaVersion !== 1) return null;
  if (!Array.isArray(candidate.assets)) return null;
  if (!Array.isArray(candidate.scene?.gameObjects)) return null;
  return candidate as EditorSceneDocument;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readEditorAssetLibrary(value: unknown): EditorSceneAssetLibraryItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const candidate = entry as Partial<EditorSceneAssetLibraryItem>;
    if (candidate.type !== 'glb' && candidate.type !== 'texture') return [];
    if (typeof candidate.assetId !== 'string' || !candidate.assetId.trim()) return [];
    const assetId = candidate.assetId.trim();
    return [{
      id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : assetId,
      guid: typeof candidate.guid === 'string' && candidate.guid.trim() ? candidate.guid : undefined,
      assetId,
      type: candidate.type,
      kind: candidate.type === 'texture' ? 'texture' : 'model',
      displayName: typeof candidate.displayName === 'string' && candidate.displayName.trim()
        ? candidate.displayName
        : assetId,
      category: typeof candidate.category === 'string' && candidate.category.trim()
        ? candidate.category
        : undefined,
      materialMode: candidate.materialMode === 'shared' || candidate.materialMode === 'instance'
        ? candidate.materialMode
        : undefined,
      defaults: candidate.defaults,
      metadata: candidate.metadata && typeof candidate.metadata === 'object' && !Array.isArray(candidate.metadata)
        ? candidate.metadata
        : undefined,
      external: candidate.external && typeof candidate.external === 'object' && !Array.isArray(candidate.external)
        ? candidate.external
        : undefined,
      origin: 'project',
      dedupeKey: typeof candidate.dedupeKey === 'string' && candidate.dedupeKey.trim()
        ? candidate.dedupeKey
        : (typeof candidate.guid === 'string' && candidate.guid.trim() ? candidate.guid : assetId),
      placeable: candidate.placeable !== false,
    }];
  });
}

function summarizeEditorScene(editorScene: EditorSceneDocument): string {
  return `editorScene assets=${editorScene.assets.length}, gameObjects=${editorScene.scene.gameObjects.length}`;
}

function summarizeEditorSceneSource(
  editorScene: EditorSceneDocument,
  drift: EditorSceneRuntimeInputDrift | null,
): string {
  const summary = summarizeEditorScene(editorScene);
  if (!drift?.detected) return summary;
  return `${summary} | runtime input drift detected (${drift.reason ?? 'unknown'})`;
}

function readRuntimeInputDrift(value: unknown): EditorSceneRuntimeInputDrift | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<EditorSceneRuntimeInputDrift>;
  if (typeof candidate.detected !== 'boolean') return null;
  return {
    detected: candidate.detected,
    sourceId: typeof candidate.sourceId === 'string' ? candidate.sourceId : 'scene.main',
    sourceType: typeof candidate.sourceType === 'string' ? candidate.sourceType : 'scene',
    sourceRevision: typeof candidate.sourceRevision === 'number' ? candidate.sourceRevision : null,
    generatedRevision: typeof candidate.generatedRevision === 'number' ? candidate.generatedRevision : null,
    reason: candidate.reason,
  };
}

function summarizeSaveResult(saved: Record<string, unknown>): string {
  const summary = saved.summary as any;
  const editorScene = summary?.editorScene;
  const compiled = summary?.compiled;
  if (editorScene || compiled) {
    return [
      `editorScene assets=${editorScene?.assets ?? 'n/a'}, gameObjects=${editorScene?.gameObjects ?? 'n/a'}`,
      `compiled assets=${compiled?.assetCount ?? 'n/a'}, nodes=${compiled?.nodeCount ?? 'n/a'}`,
    ].join(' | ');
  }
  const sceneJsonText = typeof saved.sceneJsonText === 'string' ? saved.sceneJsonText : '';
  return sceneJsonText ? summarizeSceneJson(sceneJsonText) : 'saved';
}

function readCompiledRuntimeSceneArtifact(
  saved: Record<string, unknown>,
  source: AuthoringSourceDescriptor,
): CompiledArtifact | undefined {
  const sceneJsonText = typeof saved.sceneJsonText === 'string' ? saved.sceneJsonText : '';
  if (!sceneJsonText.trim()) return undefined;
  try {
    const sceneConfig = JSON.parse(sceneJsonText) as SceneConfig;
    return {
      artifactType: 'runtime-scene',
      artifactId: readString(saved.scenePath) ?? 'scene.json',
      provenance: readCompiledArtifactProvenance(sceneConfig, source),
      summary: summarizeSceneConfig(sceneConfig),
      data: sceneConfig,
    };
  } catch {
    return undefined;
  }
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

function isCompiledArtifactForSource(
  artifact: CompiledArtifact,
  source: AuthoringSourceDescriptor,
): boolean {
  return artifact.provenance?.sourceId === source.ref.sourceId
    && artifact.provenance.sourceType === source.ref.sourceType
    && artifact.provenance.revision === source.ref.revision;
}

function summarizeSceneConfig(sceneConfig: SceneConfig): string {
  const version = (sceneConfig as { version?: unknown }).version ?? 'n/a';
  const assets = sceneConfig.scene?.assets.length ?? 0;
  const nodes = sceneConfig.scene?.nodes.length ?? 0;
  return `version=${version}, assets=${assets}, nodes=${nodes}`;
}

function summarizeSceneJson(sceneJsonText: string): string {
  try {
    const parsed = JSON.parse(sceneJsonText) as any;
    const assets = Array.isArray(parsed.scene?.assets) ? parsed.scene.assets.length : 0;
    const nodes = Array.isArray(parsed.scene?.nodes) ? parsed.scene.nodes.length : 0;
    return `version=${parsed.version ?? 'n/a'}, assets=${assets}, nodes=${nodes}`;
  } catch {
    return `invalid JSON, bytes=${sceneJsonText.length}`;
  }
}
