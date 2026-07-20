#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const supportedExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const enforceFinal = process.env.EDITOR_PRODUCT_BUDGET_ENFORCE === '1'
  || process.argv.includes('--enforce-final');
const standardMode = process.env.EDITOR_PRODUCT_STANDARD === '1'
  || process.argv.includes('--standard');

const migrationCaps = {
  adapterLines: readPositiveIntegerEnv('EDITOR_PRODUCT_CURRENT_ADAPTER_MAX_LINES', 1100),
  movedServiceLines: readPositiveIntegerEnv('EDITOR_PRODUCT_CURRENT_MOVED_SERVICE_MAX_LINES', 400),
  combinedLegacyLines: readPositiveIntegerEnv('EDITOR_PRODUCT_CURRENT_LEGACY_MAX_LINES', 1500),
};
const finalCaps = {
  standardLines: readPositiveIntegerEnv('EDITOR_PRODUCT_STANDARD_MAX_LINES', 300),
  customLines: readPositiveIntegerEnv('EDITOR_PRODUCT_CUSTOM_MAX_LINES', 800),
  sdkFailureLines: readPositiveIntegerEnv('EDITOR_PRODUCT_FAILURE_THRESHOLD_LINES', 1500),
};
const devEditorBootstrapTarget = { minLines: 80, maxLines: 120 };
const devEditorBootstrapPath = 'src/services/fps-game-editor/local-editor.ts';
const standardFixtureRoot = path.join(projectRoot, 'scripts/fixtures/editor-standard-product');

const legacyImplementationRoots = [
  {
    label: 'adapter root',
    relativePath: 'src/fps-game-editor-adapter',
    maxLines: migrationCaps.adapterLines,
    finalAllowed: false,
    direction: 'Move standard editor implementation into package-visible SDK APIs; pa_template should not keep src/fps-game-editor-adapter as a long-term implementation root.',
  },
  {
    label: 'moved editor services',
    relativePath: 'src/services',
    servicePrefix: 'editor-',
    maxLines: migrationCaps.movedServiceLines,
    finalAllowed: false,
    direction: 'Do not fake adapter slimming by moving editor implementation into src/services/editor-*; project-only feature hooks should live in explicit product config/feature files.',
  },
];

const finalProductSurfacePaths = [
  'main.ts',
  'src/main.ts',
  'vite.config.ts',
  'fps.config.ts',
  'src/editor.config.ts',
  'src/fps-game-editor.config.ts',
  'src/services/fps-game-editor/runtime-plugin-host.ts',
  'src/editor',
  'src/services/fps-game-editor',
  'src/fps-editor',
];
// Exact-path stats bucket only. Adding files here requires architecture review:
// this is for game/runtime code that consumes editor-authored config, not a
// general exemption for editor host, save, document authoring, or adapter glue.
const runtimeAuthoredConfigConsumerPaths = new Set([
  // Runtime lifecycle owners expose mode-transition ports without owning the
  // Editor Entry controller, Editor Host, document authoring, or adapters.
  'src/project-runtime-entry.ts',
  'src/debug/runtime-debug-bootstrap.ts',
  'src/dev/DevHost.ts',
  // Development-only entry invokes the project-owned runtime host.
  'src/dev/dev-entry.ts',
  'src/config/ConfigService.ts',
  'src/config/types.ts',
  'src/rendering/rendering-profile.ts',
  'src/services/RenderingService.ts',
  'src/services/SceneBuilder.ts',
  'src/debug/camera-debug-panel.ts',
  'src/debug/runtime-lighting-debug-panel.ts',
]);
const runtimeIntegrationConsumerPrefixes = [
  // Production runtime imports the public SDK through this explicit adapter
  // seam; it is not editor host/product assembly code and should not consume
  // the project's editor integration line budget.
  'src/runtime/integrations/fps-runtime/',
];
const editorSignalScanRoots = [
  'fps.config.ts',
  'vite.config.ts',
  'src/main.ts',
  'src',
  'vite-plugins',
];
const ignoredSignalPathParts = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
]);
const ignoredSignalPathPrefixes = [
  'src/assets/generated/',
  'src/assets/imported/',
  'src/assets/vfx/',
];
const editorIntegrationSignals = [
  /@fps-games\/editor/,
  /\bfps-game-editor\b/,
  /\bFpsGameEditor\b/,
  /\bdefineFpsGameEditorProject\b/,
  /\bcreateFpsGameEditorAdapter\b/,
  /\bcreateFpsGameEditorViteAdapter\b/,
  /\bgroundDecalFeature\b/,
  /\bcreatePlayableLocalEditorHost\b/,
  /\bPlayableLocalEditor\b/,
  /\bLocalEditor\b/,
  /\bEditorScene\b/,
  /\bEditorAdapter\b/,
];

const violations = [];

const legacySummaries = legacyImplementationRoots.map(measureLegacyRoot);
const productSurfaceSummary = measureProductSurface();
const editorSignalSummary = measureEditorSignalSurface();
const outsideProductSignalSummary = measureOutsideProductSignalSurface(productSurfaceSummary.files, legacySummaries);
const runtimeConsumerSignalSummary = measureRuntimeConsumerSignalSurface();
const productEditorSignalLineSummary = measureEditorSignalLines(productSurfaceSummary.files);
const standardFixtureSummary = measureStandardFixture();
const combinedLegacyLines = legacySummaries.reduce((sum, summary) => sum + summary.totalLines, 0);
const devEditorBootstrapLines = countLines(fs.readFileSync(
  path.join(projectRoot, devEditorBootstrapPath),
  'utf8',
));

if (!enforceFinal) {
  for (const summary of legacySummaries) {
    if (summary.totalLines > summary.root.maxLines) {
      violations.push({
        path: summary.root.relativePath,
        detail: `${summary.totalLines} TypeScript/module lines exceeds migration cap ${summary.root.maxLines}`,
        fix: summary.root.direction,
      });
    }
  }
  if (combinedLegacyLines > migrationCaps.combinedLegacyLines) {
    violations.push({
      path: 'src/fps-game-editor-adapter + src/services/editor-*',
      detail: `${combinedLegacyLines} TypeScript/module lines exceeds migration cap ${migrationCaps.combinedLegacyLines}`,
      fix: 'Keep shrinking by SDK/core downshift. Do not let temporary productization work increase the legacy implementation footprint.',
    });
  }
} else {
  for (const summary of legacySummaries) {
    if (summary.totalLines > 0 || summary.files.length > 0) {
      violations.push({
        path: summary.root.relativePath,
        detail: `${summary.files.length} files / ${summary.totalLines} TypeScript/module lines remain in a retired editor implementation root`,
        fix: summary.root.direction,
      });
    }
  }

  const finalMaxLines = standardMode ? finalCaps.standardLines : finalCaps.customLines;
  const finalLabel = standardMode ? 'standard project integration' : 'custom project integration';
  const budgetSummary = standardMode ? standardFixtureSummary : productSurfaceSummary;
  if (outsideProductSignalSummary.files.length > 0) {
    violations.push({
      path: 'editor signal files outside final product surface',
      detail: `${outsideProductSignalSummary.files.length} files / ${outsideProductSignalSummary.totalLines} TypeScript/module lines still contain editor integration signals outside the allowed product entrypoints`,
      fix: `Move editor assembly into SDK factories and keep project code under ${finalProductSurfacePaths.join(', ')}. Largest outside signal files: ${formatTopFiles(outsideProductSignalSummary.files)}`,
    });
  }
  if (budgetSummary.totalLines > finalMaxLines) {
    violations.push({
      path: standardMode ? 'standard product integration fixture' : productSurfaceSummary.label,
      detail: `${budgetSummary.totalLines} TypeScript/module lines exceeds ${finalLabel} budget ${finalMaxLines}`,
      fix: `Keep main.ts/vite.config.ts/fps.config.ts as project declarations and feature hooks; move editor assembly into SDK factories. Largest editor-signal files: ${formatTopFiles(productSurfaceSummary.files)}`,
    });
  }
  if (budgetSummary.totalLines > finalCaps.sdkFailureLines) {
    violations.push({
      path: productSurfaceSummary.label,
      detail: `${budgetSummary.totalLines} TypeScript/module lines exceeds SDK productization failure threshold ${finalCaps.sdkFailureLines}`,
      fix: `A project needing more than 1,500 lines of editor integration means standard editor capability is still missing from the SDK. Largest editor-signal files: ${formatTopFiles(productSurfaceSummary.files)}`,
    });
  }
  if (standardFixtureSummary.files.length !== 3 || standardFixtureSummary.totalLines > finalCaps.standardLines) {
    violations.push({
      path: 'standard product integration fixture',
      detail: `${standardFixtureSummary.files.length} files / ${standardFixtureSummary.totalLines} non-empty TypeScript/module lines; expected exactly 3 files and <= ${finalCaps.standardLines} lines`,
      fix: 'Keep the standard integration expressible through main.ts, vite.config.ts, and fps.config.ts only.',
    });
  }
  if (
    devEditorBootstrapLines < devEditorBootstrapTarget.minLines
    || devEditorBootstrapLines > devEditorBootstrapTarget.maxLines
  ) {
    violations.push({
      path: devEditorBootstrapPath,
      detail: `${devEditorBootstrapLines} non-empty lines is outside the ${devEditorBootstrapTarget.minLines}-${devEditorBootstrapTarget.maxLines} target`,
      fix: 'Keep project-specific ports and features here; move lifecycle, Plugin Host, diagnostics, loading copy and Babylon projection into @fps-games/editor.',
    });
  }
}

if (violations.length > 0) {
  console.error('editor product budget check failed:');
  for (const violation of violations) {
    console.error(`- path: ${violation.path}`);
    console.error(`  detail: ${violation.detail}`);
    console.error(`  fix: ${violation.fix}`);
  }
  process.exit(1);
}

const mode = enforceFinal
  ? (standardMode ? 'final-standard' : 'final-custom')
  : 'migration';
console.log(`editor product budget check passed (${mode})`);
for (const summary of legacySummaries) {
console.log(`- ${summary.root.label}: ${summary.files.length} files / ${summary.totalLines} TypeScript/module lines`);
  if (summary.files.length > 0) {
    console.log(`  by directory: ${formatDirectoryBreakdown(summary.files, summary.root.relativePath, summary.root.servicePrefix)}`);
  }
}
console.log(`- legacy implementation total: ${combinedLegacyLines} TypeScript/module lines`);
console.log(`- final product surface: ${productSurfaceSummary.files.length} files / ${productSurfaceSummary.totalLines} TypeScript/module lines`);
if (productSurfaceSummary.files.length > 0) {
  console.log(`  largest product files: ${formatTopFiles(productSurfaceSummary.files)}`);
}
console.log(`- final product editor signal lines: ${productEditorSignalLineSummary.totalSignalLines} matching lines`);
if (productEditorSignalLineSummary.files.length > 0) {
  console.log(`  product editor signal files: ${formatSignalLineFiles(productEditorSignalLineSummary.files)}`);
}
console.log(`- standard product fixture: ${standardFixtureSummary.files.length} files / ${standardFixtureSummary.totalLines} non-empty TypeScript/module lines`);
console.log(`- dev editor bootstrap: ${devEditorBootstrapLines} non-empty lines (target ${devEditorBootstrapTarget.minLines}-${devEditorBootstrapTarget.maxLines})`);
console.log(`- editor signal surface: ${editorSignalSummary.files.length} files / ${editorSignalSummary.totalLines} TypeScript/module lines`);
if (editorSignalSummary.files.length > 0) {
  console.log(`  largest signal files: ${formatTopFiles(editorSignalSummary.files)}`);
}
console.log(`- runtime authored-config consumers: ${runtimeConsumerSignalSummary.files.length} files / ${runtimeConsumerSignalSummary.totalLines} TypeScript/module lines`);
if (runtimeConsumerSignalSummary.files.length > 0) {
  console.log(`  largest runtime consumer files: ${formatTopFiles(runtimeConsumerSignalSummary.files)}`);
}
console.log(`- outside final product surface signals: ${outsideProductSignalSummary.files.length} files / ${outsideProductSignalSummary.totalLines} TypeScript/module lines`);
if (outsideProductSignalSummary.files.length > 0) {
  console.log(`  largest outside signal files: ${formatTopFiles(outsideProductSignalSummary.files)}`);
}
console.log(`- targets: standard <= ${finalCaps.standardLines}, custom <= ${finalCaps.customLines}, SDK failure threshold > ${finalCaps.sdkFailureLines}`);

function measureLegacyRoot(root) {
  const absoluteRoot = path.join(projectRoot, root.relativePath);
  let files = [];
  if (fs.existsSync(absoluteRoot)) {
    files = walkFiles(absoluteRoot)
      .filter(filePath => supportedExtensions.has(path.extname(filePath)))
      .filter(filePath => {
        if (!root.servicePrefix) return true;
        const relativePath = toProjectPath(path.relative(absoluteRoot, filePath));
        return relativePath.startsWith(root.servicePrefix);
      })
      .sort();
  }
  return {
    root,
    files,
    totalLines: countFileLines(files),
  };
}

function measureProductSurface() {
  const files = new Set();
  for (const relativePath of finalProductSurfacePaths) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const stats = fs.statSync(absolutePath);
    if (stats.isFile() && supportedExtensions.has(path.extname(absolutePath))) {
      files.add(absolutePath);
    }
    if (stats.isDirectory()) {
      for (const filePath of walkFiles(absolutePath)) {
        if (supportedExtensions.has(path.extname(filePath))) files.add(filePath);
      }
    }
  }
  const sortedFiles = [...files].sort();
  return {
    label: 'editor final product surface',
    files: sortedFiles,
    totalLines: countFileLines(sortedFiles),
  };
}

function measureStandardFixture() {
  const files = fs.existsSync(standardFixtureRoot)
    ? walkFiles(standardFixtureRoot).filter(filePath => supportedExtensions.has(path.extname(filePath))).sort()
    : [];
  return { files, totalLines: countFileLines(files) };
}

function measureEditorSignalSurface() {
  const files = collectEditorSignalFiles();
  return {
    files,
    totalLines: countFileLines(files),
  };
}

function measureOutsideProductSignalSurface(productSurfaceFiles, summaries) {
  const productSurfaceFileSet = new Set(productSurfaceFiles.map(filePath => path.resolve(filePath)));
  const legacyFileSet = new Set(
    summaries.flatMap(summary => summary.files.map(filePath => path.resolve(filePath))),
  );
  const files = editorSignalSummary.files
    .filter(filePath => !productSurfaceFileSet.has(path.resolve(filePath)))
    .filter(filePath => !legacyFileSet.has(path.resolve(filePath)))
    .filter(filePath => !isRuntimeAuthoredConfigConsumer(filePath))
    .sort();
  return {
    files,
    totalLines: countFileLines(files),
  };
}

function measureRuntimeConsumerSignalSurface() {
  const files = editorSignalSummary.files
    .filter(isRuntimeAuthoredConfigConsumer)
    .sort();
  return {
    files,
    totalLines: countFileLines(files),
  };
}

function measureEditorSignalLines(files) {
  const entries = files
    .map(filePath => {
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r\n|\r|\n/);
      const matchingLineNumbers = [];
      lines.forEach((line, index) => {
        if (hasEditorIntegrationSignal(line)) matchingLineNumbers.push(index + 1);
      });
      return {
        filePath,
        signalLines: matchingLineNumbers.length,
        firstLine: matchingLineNumbers[0] ?? null,
        lastLine: matchingLineNumbers[matchingLineNumbers.length - 1] ?? null,
      };
    })
    .filter(entry => entry.signalLines > 0)
    .sort((left, right) => right.signalLines - left.signalLines || left.filePath.localeCompare(right.filePath));
  return {
    files: entries,
    totalSignalLines: entries.reduce((sum, entry) => sum + entry.signalLines, 0),
  };
}

function collectEditorSignalFiles() {
  const files = new Set();
  for (const relativePath of editorSignalScanRoots) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const stats = fs.statSync(absolutePath);
    if (stats.isFile() && supportedExtensions.has(path.extname(absolutePath))) {
      files.add(absolutePath);
    }
    if (stats.isDirectory()) {
      for (const filePath of walkFiles(absolutePath)) {
        if (supportedExtensions.has(path.extname(filePath))) files.add(filePath);
      }
    }
  }
  return [...files]
    .filter(filePath => !isIgnoredSignalFile(filePath))
    .filter(filePath => hasEditorIntegrationSignal(fs.readFileSync(filePath, 'utf8')))
    .sort();
}

function isIgnoredSignalFile(filePath) {
  const relativePath = toProjectPath(path.relative(projectRoot, filePath));
  const parts = relativePath.split('/');
  if (parts.some(part => ignoredSignalPathParts.has(part))) return true;
  return ignoredSignalPathPrefixes.some(prefix => relativePath.startsWith(prefix));
}

function isRuntimeAuthoredConfigConsumer(filePath) {
  const relativePath = toProjectPath(path.relative(projectRoot, filePath));
  return runtimeAuthoredConfigConsumerPaths.has(relativePath)
    || runtimeIntegrationConsumerPrefixes.some(prefix => relativePath.startsWith(prefix));
}

function hasEditorIntegrationSignal(content) {
  return editorIntegrationSignals.some(signal => signal.test(content));
}

function formatTopFiles(files, maxFiles = 5) {
  if (files.length === 0) return '(none)';
  return files
    .map(filePath => ({
      filePath,
      lines: countLines(fs.readFileSync(filePath, 'utf8')),
    }))
    .sort((left, right) => right.lines - left.lines || left.filePath.localeCompare(right.filePath))
    .slice(0, maxFiles)
    .map(entry => `${toProjectPath(path.relative(projectRoot, entry.filePath))} (${entry.lines})`)
    .join(', ');
}

function formatSignalLineFiles(entries, maxFiles = 5) {
  if (entries.length === 0) return '(none)';
  return entries
    .slice(0, maxFiles)
    .map(entry => {
      const relativePath = toProjectPath(path.relative(projectRoot, entry.filePath));
      const range = entry.firstLine === entry.lastLine
        ? `line ${entry.firstLine}`
        : `lines ${entry.firstLine}-${entry.lastLine}`;
      return `${relativePath} (${entry.signalLines} matching lines, ${range})`;
    })
    .join(', ');
}

function formatDirectoryBreakdown(files, rootRelativePath, servicePrefix) {
  const rootPath = path.join(projectRoot, rootRelativePath);
  const buckets = new Map();
  for (const filePath of files) {
    const relativePath = toProjectPath(path.relative(rootPath, filePath));
    const parts = relativePath.split('/');
    const key = servicePrefix ? parts[0] : (parts[0] ?? '.');
    buckets.set(key, (buckets.get(key) ?? 0) + countLines(fs.readFileSync(filePath, 'utf8')));
  }
  return [...buckets.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([key, lines]) => `${key} ${lines}`)
    .join(', ');
}

function countFileLines(files) {
  return files.reduce((sum, filePath) => sum + countLines(fs.readFileSync(filePath, 'utf8')), 0);
}

function countLines(content) {
  if (content.length === 0) return 0;
  return content.split(/\r\n|\r|\n/).filter(line => line.trim().length > 0).length;
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

function readPositiveIntegerEnv(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue == null || rawValue === '') return defaultValue;
  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0 || String(parsedValue) !== rawValue.trim()) {
    console.error(`${name} must be a positive integer, got ${JSON.stringify(rawValue)}`);
    process.exit(1);
  }
  return parsedValue;
}

function toProjectPath(filePath) {
  return filePath.split(path.sep).join('/');
}
