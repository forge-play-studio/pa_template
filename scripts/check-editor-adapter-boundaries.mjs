#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
// This checker owns retired adapter-root regression guards. Current product
// entrypoint imports are checked by the editor repository's reference-consumer
// doctor, while check-editor-product-budget owns the final product surface.
const adapterRoot = path.join(projectRoot, 'src', 'fps-game-editor-adapter');
const editorServiceRoot = path.join(projectRoot, 'src', 'services');
const supportedExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const activeAdapterMaxLines = readPositiveIntegerEnv('EDITOR_ADAPTER_MAX_LINES', 5000);
const activeMovedServiceMaxLines = readPositiveIntegerEnv('EDITOR_ADAPTER_MOVED_SERVICE_MAX_LINES', 3300);
const adapterSizeBudget = {
  maxLines: activeAdapterMaxLines,
  targetMaxLines: 5000,
  enforceTarget: process.env.EDITOR_ADAPTER_ENFORCE_TARGET === '1',
  extensions: new Set(['.ts', '.tsx', '.mts', '.cts', '.mjs']),
  direction: 'Keep src/fps-game-editor-adapter at or below 5,000 TypeScript/module lines. Reduce duplicated adapter implementation through SDK/core downshift rather than moving code to project services.',
};
const movedEditorServiceBudget = {
  maxLines: activeMovedServiceMaxLines,
  targetMaxLines: 1000,
  enforceTarget: process.env.EDITOR_ADAPTER_ENFORCE_TARGET === '1',
  extensions: new Set(['.ts', '.tsx', '.mts', '.cts', '.mjs']),
  direction: 'Do not reduce adapter size by moving generic adapter implementation into src/services/editor-*; project-only services should stay small and explicit.',
};
const ownershipLabels = new Set([
  'project-only',
  'playable-sdk candidate',
  'editor-core candidate',
  'editor-babylon candidate',
  'legacy-compat',
]);
const forbiddenReintroducedFiles = [
  'assets/adapters/ProjectAssetCatalogAdapter.ts',
  'assets/adapters/ProjectSceneDocumentAdapter.ts',
  'scene/session/editor-scene-session-core.ts',
  'scene/session/property-patches.ts',
  'scene/session/reducer-core.ts',
  'scene/session/hierarchy-commands.ts',
  'scene/session/serialized-multi-property.ts',
  'scene/session/serialized-object-session.ts',
  'scene/inspector/inspector-object.ts',
  'scene/inspector/inspector-fields.ts',
  'scene/inspector/runtime-inspector.ts',
  'scene/editor-scene-marker-graph.ts',
  'scene/marker/marker-catalog.ts',
  'host/local-editor-mode-switcher.ts',
  'host/document-patch-adapter.ts',
  'authoring/editor-authoring-source.ts',
  'authoring/editor-asset-library.ts',
  'authoring/editor-scene-compiler.ts',
  'authoring/runtime-camera-rig-save.ts',
  'authoring/runtime-lighting-save.ts',
  'authoring/vite-rendering-config.ts',
];
const forbiddenReintroducedAdapterRoots = [
  'legacy',
  'assets',
];
const forbiddenReintroducedProjectPaths = [
  'src/services/editor-legacy',
  'src/services/editor-marker',
  'src/services/editor-scene-defaults',
  'src/services/editor-host',
  'src/services/AssetManager.ts',
  'src/services/SceneAssetPlacement.ts',
  'src/services/SceneAssetUsage.ts',
  'src/services/assets/core/AssetManagerCore.ts',
  'src/services/assets/adapters/BabylonRuntimeAssetAdapter.ts',
];
const lineBudgetFiles = [
  {
    file: 'scene/editor-scene-session.ts',
    maxLines: 20,
    direction: 'Keep scene/editor-scene-session.ts as a tiny public façade; move implementation into owned scene modules.',
  },
];
const violations = [];
const packedPackageConsumerScripts = [
  'scripts/check-editor-prefab-stage-fixture.mjs',
  'scripts/check-editor-ground-decal-authoring.mjs',
  'scripts/sync-editor-live-fixtures.mjs',
  'scripts/check-asset-manager-guid-external.mjs',
];

for (const relativePath of packedPackageConsumerScripts) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  if (/FPS_GAME_EDITOR_REPO|packages\/editor\/dist\/playable-sdk\.js|node_modules\/@fps-games\/editor\/node_modules\/@fps-games\//.test(source)) {
    violations.push({
      file: relativePath,
      importSource: '(source-checkout SDK bypass)',
      resolvedTarget: relativePath,
      direction: 'Consumer checks must import @fps-games/editor/playable-sdk from the installed packed package.',
    });
  }
}

function readPositiveIntegerEnv(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue == null || rawValue === '') return defaultValue;
  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0 || String(parsedValue) !== rawValue.trim()) {
    fail(`${name} must be a positive integer, got ${JSON.stringify(rawValue)}`);
  }
  return parsedValue;
}

for (const relativePath of forbiddenReintroducedFiles) {
  const filePath = path.join(adapterRoot, relativePath);
  if (fs.existsSync(filePath)) {
    violations.push({
      file: relativePath,
      importSource: '(file exists)',
      resolvedTarget: relativePath,
      direction: 'Project asset document/catalog adapters must stay out of assets/adapters.',
    });
  }
}

for (const relativePath of forbiddenReintroducedAdapterRoots) {
  const filePath = path.join(adapterRoot, relativePath);
  if (fs.existsSync(filePath)) {
    violations.push({
      file: `src/fps-game-editor-adapter/${relativePath}`,
      importSource: '(retired legacy adapter root exists)',
      resolvedTarget: `src/fps-game-editor-adapter/${relativePath}`,
      direction: 'The pa_template adapter legacy tree has been retired; use productized SDK host/config APIs instead of recreating src/fps-game-editor-adapter/legacy/**.',
    });
  }
}

for (const relativePath of forbiddenReintroducedProjectPaths) {
  const filePath = path.join(projectRoot, relativePath);
  if (fs.existsSync(filePath)) {
    violations.push({
      file: relativePath,
      importSource: '(retired legacy path exists)',
      resolvedTarget: relativePath,
      direction: 'The pa_template legacy runtime/document/plugin bridge has been retired; use productized SDK host/config APIs instead of recreating src/services/editor-legacy.',
    });
  }
}

const adapterFiles = fs.existsSync(adapterRoot)
  ? walkFiles(adapterRoot).filter(filePath => supportedExtensions.includes(path.extname(filePath))).sort()
  : [];

for (const filePath of adapterFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceRelativePath = toProjectPath(path.relative(adapterRoot, filePath));
  checkOwnershipAnnotation(sourceRelativePath, content);
  checkSdkCompatibilityProbes(sourceRelativePath, content);
  for (const importRef of collectImportSources(content)) {
    const resolved = resolveImport(filePath, importRef.source);
    if (!resolved) continue;
    const targetRelativePath = toProjectPath(path.relative(adapterRoot, resolved));
    if (targetRelativePath.startsWith('..')) continue;
    const violation = getBoundaryViolation({
      sourceRelativePath,
      importSource: importRef.source,
      targetRelativePath,
    });
    if (violation) violations.push(violation);
  }
}

checkLineBudgets();
checkAdapterSizeBudget();
checkMovedEditorServiceBudget();

if (violations.length > 0) {
  console.error('editor adapter boundary check failed:');
  for (const violation of violations) {
    console.error(`- file: ${violation.file}`);
    console.error(`  import: ${violation.importSource}`);
    console.error(`  resolvesTo: ${violation.resolvedTarget}`);
    console.error(`  fix: ${violation.direction}`);
  }
  process.exit(1);
}

const adapterSizeSummary = measureLines(adapterFiles, adapterSizeBudget.extensions);
const movedServiceSizeSummary = measureMovedEditorServices();
console.log(`editor adapter boundary check passed (adapter ${adapterSizeSummary.totalLines} lines; moved editor services ${movedServiceSizeSummary.totalLines} lines)`);

function checkSdkCompatibilityProbes(relativePath, content) {
  if (relativePath === '../scripts/check-editor-adapter-boundaries.mjs') return;
  const probeTypes = new Set();

  for (const match of content.matchAll(/\b([A-Z][$_\w]*Sdk(?:Compatibility)?Exports)\b/g)) {
    probeTypes.add(match[1]);
  }

  for (const probeType of probeTypes) {
    violations.push({
      file: relativePath,
      importSource: `(SDK compatibility probe ${probeType})`,
      resolvedTarget: relativePath,
      direction: 'Do not add optional SDK export probes. The local packed package baseline must consume package-visible helpers through direct @fps-games/editor/playable-sdk imports.',
    });
  }
}

function getBoundaryViolation({ sourceRelativePath, importSource, targetRelativePath }) {
  const sourceArea = sourceRelativePath.split('/')[0] ?? '';
  const targetArea = targetRelativePath.split('/')[0] ?? '';
  const base = {
    file: sourceRelativePath,
    importSource,
    resolvedTarget: targetRelativePath,
  };

  if (sourceArea === 'assets' && targetArea === 'legacy') {
    return {
      ...base,
      direction: 'Keep asset ports owned by assets; implement legacy-backed adapters under legacy and inject them at composition points.',
    };
  }

  if (sourceArea === 'scene' && ['authoring', 'rendering', 'legacy'].includes(targetArea)) {
    return {
      ...base,
      direction: 'Scene may depend on scene contracts/config/runtime services, but not authoring orchestration, rendering stores, or legacy compatibility.',
    };
  }

  if (
    sourceArea === 'scene'
    && sourceRelativePath !== 'scene/editor-scene-session.ts'
    && targetRelativePath === 'scene/editor-scene-session.ts'
  ) {
    return {
      ...base,
      direction: 'Scene implementation modules must depend on split scene modules/contracts, not the editor-scene-session.ts façade.',
    };
  }

  if (
    targetRelativePath === 'scene/session/editor-scene-session-core.ts'
    && sourceRelativePath !== 'scene/editor-scene-session.ts'
  ) {
    return {
      ...base,
      direction: 'Only scene/editor-scene-session.ts may re-export editor-scene-session-core.ts; split implementation modules must depend on owned helpers/contracts.',
    };
  }

  if (sourceArea === 'rendering' && targetRelativePath === 'scene/editor-scene-session.ts') {
    return {
      ...base,
      direction: 'Rendering must depend on scene contracts/document helpers, not editor-scene-session.ts implementation.',
    };
  }

  if (sourceArea === 'rendering' && ['authoring', 'legacy'].includes(targetArea)) {
    return {
      ...base,
      direction: 'Rendering owns profile/draft/shadow preview logic and must not couple to authoring orchestration or legacy bridge code.',
    };
  }

  if (
    sourceRelativePath.startsWith('legacy/document/')
    && targetRelativePath === 'legacy/document.ts'
  ) {
    return {
      ...base,
      direction: 'legacy/document/** modules are implementation internals and must depend on sibling owned modules, not the public legacy/document.ts façade.',
    };
  }

  if (
    targetRelativePath.startsWith('legacy/document/')
    && sourceRelativePath !== 'legacy/document.ts'
    && !sourceRelativePath.startsWith('legacy/document/')
  ) {
    return {
      ...base,
      direction: 'Only legacy/document.ts may expose legacy/document/** internals; external legacy consumers must import the public legacy/document.ts façade.',
    };
  }

  return null;
}

function checkOwnershipAnnotation(relativePath, content) {
  const ownershipMatch = content.match(/Adapter ownership:\s*([^|\r\n*]+)/);
  if (!ownershipMatch) {
    violations.push({
      file: relativePath,
      importSource: '(ownership annotation missing)',
      resolvedTarget: relativePath,
      direction: 'Add a file header with one ownership label: project-only, playable-sdk candidate, editor-core candidate, editor-babylon candidate, or legacy-compat.',
    });
    return;
  }

  const ownership = ownershipMatch[1].trim();
  if (!ownershipLabels.has(ownership)) {
    violations.push({
      file: relativePath,
      importSource: `(ownership ${ownership})`,
      resolvedTarget: relativePath,
      direction: 'Use one supported ownership label: project-only, playable-sdk candidate, editor-core candidate, editor-babylon candidate, or legacy-compat.',
    });
  }

  if (!/Reviewed:\s*\d{4}-\d{2}-\d{2}/.test(content)) {
    violations.push({
      file: relativePath,
      importSource: '(ownership review date missing)',
      resolvedTarget: relativePath,
      direction: 'Add a Reviewed: YYYY-MM-DD line next to the Adapter ownership header so SDK-downshift audits stay time-stamped.',
    });
  }
}

function checkLegacySceneNodeFieldSchema() {
  const relativePath = 'legacy/scene-node-field-schema.ts';
  const filePath = path.join(adapterRoot, relativePath);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const reExportSources = collectReExportSources(content);
  const imports = collectImportSources(content);
  const resolvedTargets = imports
    .map(importRef => ({
      importSource: importRef.source,
      resolved: resolveImport(filePath, importRef.source),
    }))
    .filter(importRef => importRef.resolved);

  for (const importRef of resolvedTargets) {
    const targetRelativePath = toProjectPath(path.relative(adapterRoot, importRef.resolved));
    if (targetRelativePath !== 'scene/editor-scene-field-schema.ts') {
      violations.push({
        file: relativePath,
        importSource: importRef.importSource,
        resolvedTarget: targetRelativePath,
        direction: 'legacy/scene-node-field-schema.ts is only a compatibility re-export of scene/editor-scene-field-schema.ts.',
      });
    }
  }

  const hasSceneSchemaReExport = reExportSources.some(importRef => {
    const resolved = resolveImport(filePath, importRef.source);
    return resolved && toProjectPath(path.relative(adapterRoot, resolved)) === 'scene/editor-scene-field-schema.ts';
  });

  const structuralContent = stripComments(content)
    .replace(/\bexport\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*\s+as\s+[$_\w]+|\*)\s+from\s+['"][^'"]+['"]\s*;?/g, '')
    .trim();

  if (structuralContent.length > 0 || !hasSceneSchemaReExport) {
    violations.push({
      file: relativePath,
      importSource: '(file body)',
      resolvedTarget: relativePath,
      direction: 'Keep this legacy file as a thin compatibility re-export; move schema ownership to scene/editor-scene-field-schema.ts.',
    });
  }
}

function checkLineBudgets() {
  for (const budget of lineBudgetFiles) {
    const filePath = path.join(adapterRoot, budget.file);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lineCount = countLines(content);
    if (lineCount > budget.maxLines) {
      violations.push({
        file: budget.file,
        importSource: `(line budget ${budget.maxLines})`,
        resolvedTarget: `${budget.file} (${lineCount} lines)`,
        direction: budget.direction,
      });
    }
  }
}

function checkAdapterSizeBudget() {
  const { totalLines } = measureLines(adapterFiles, adapterSizeBudget.extensions);
  const activeMaxLines = adapterSizeBudget.enforceTarget
    ? adapterSizeBudget.targetMaxLines
    : adapterSizeBudget.maxLines;
  if (totalLines > activeMaxLines) {
    violations.push({
      file: 'src/fps-game-editor-adapter',
      importSource: `(adapter size budget ${activeMaxLines})`,
      resolvedTarget: `src/fps-game-editor-adapter (${totalLines} TypeScript/module lines)`,
      direction: adapterSizeBudget.direction,
    });
  }
}

function checkMovedEditorServiceBudget() {
  const { totalLines, files } = measureMovedEditorServices();
  const activeMaxLines = movedEditorServiceBudget.enforceTarget
    ? movedEditorServiceBudget.targetMaxLines
    : movedEditorServiceBudget.maxLines;
  if (totalLines > activeMaxLines) {
    violations.push({
      file: 'src/services/editor-*',
      importSource: `(moved editor service budget ${activeMaxLines})`,
      resolvedTarget: `src/services/editor-* (${totalLines} TypeScript/module lines across ${files.length} files)`,
      direction: movedEditorServiceBudget.direction,
    });
  }
}

function measureMovedEditorServices() {
  if (!fs.existsSync(editorServiceRoot)) {
    return { files: [], totalLines: 0 };
  }
  const files = walkFiles(editorServiceRoot)
    .filter(filePath => movedEditorServiceBudget.extensions.has(path.extname(filePath)))
    .filter(filePath => toProjectPath(path.relative(editorServiceRoot, filePath)).startsWith('editor-'))
    .sort();
  return measureLines(files, movedEditorServiceBudget.extensions);
}

function measureLines(files, extensions) {
  const measuredFiles = files.filter(filePath => extensions.has(path.extname(filePath)));
  const totalLines = measuredFiles.reduce((sum, filePath) => sum + countLines(fs.readFileSync(filePath, 'utf8')), 0);
  return { files: measuredFiles, totalLines };
}

function countLines(content) {
  if (content.length === 0) return 0;
  return content.split(/\r\n|\r|\n/).length - (content.endsWith('\n') ? 1 : 0);
}

function collectImportSources(content) {
  const sources = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:\*\s+as\s+[$_\w]+|\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const source = match[1];
      if (typeof source === 'string' && isResolvableSource(source)) {
        sources.push({ source });
      }
    }
  }

  return sources;
}

function collectReExportSources(content) {
  const sources = [];
  const pattern = /\bexport\s+(?:type\s+)?(?:\*\s+as\s+[$_\w]+|\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g;

  for (const match of content.matchAll(pattern)) {
    const source = match[1];
    if (typeof source === 'string' && isResolvableSource(source)) {
      sources.push({ source });
    }
  }

  return sources;
}

function resolveImport(importerPath, source) {
  const basePath = resolveImportBasePath(importerPath, source);
  if (!basePath) return null;
  const candidates = [
    basePath,
    ...supportedExtensions.map(extension => `${basePath}${extension}`),
    ...supportedExtensions.map(extension => path.join(basePath, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return fs.realpathSync(candidate);
    }
  }

  return null;
}

function resolveImportBasePath(importerPath, source) {
  if (source.startsWith('.')) {
    return path.resolve(path.dirname(importerPath), source);
  }
  if (source.startsWith('@/')) {
    return path.join(projectRoot, 'src', source.slice(2));
  }
  if (source.startsWith('/src/')) {
    return path.join(projectRoot, source.slice(1));
  }
  return null;
}

function isResolvableSource(source) {
  return source.startsWith('.') || source.startsWith('@/') || source.startsWith('/src/');
}

function walkFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root)) {
    const filePath = path.join(root, entry);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      files.push(...walkFiles(filePath));
    } else if (stats.isFile()) {
      files.push(filePath);
    }
  }
  return files;
}

function stripComments(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function toProjectPath(filePath) {
  return filePath.split(path.sep).join('/');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
