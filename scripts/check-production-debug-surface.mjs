import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const distRoot = resolve('dist');
const ignoredReportFiles = new Set([
  'stats.html',
  'stats.json',
]);
const forbiddenTokens = [
  '__paDebugActions',
  '__paDebugActionRegistry',
  '__rr',
  '__debug_panel_config',
  '__vfx_debug_overrides',
  '__vfx_usage_overrides',
  '@babylonjs/inspector',
  'ensureInspectorReady',
  'INSPECTOR_READY',
  'vite-plugin-babylon-inspector',
  'debug-panel-config-api',
  'vfx-debug-overrides-api',
  'vfx-usage-overrides-api',
  'runtime-debug-panel',
  'runtime-vfx-debug-panel',
  'runtime-record-replay-panel',
  'runtime-debug-bootstrap',
  'debug-panel-layout',
  'record-replay',
  'RuntimeDebugActionRegistry',
];

if (!existsSync(distRoot)) {
  console.error('[check-production-debug-surface] Missing dist directory. Run vite build first.');
  process.exit(1);
}

const failures = [];

for (const file of walkFiles(distRoot)) {
  const relativePath = relative(distRoot, file);
  if (ignoredReportFiles.has(relativePath)) continue;
  if (!isTextLikeFile(file)) continue;
  const content = readFileSync(file, 'utf8');
  for (const token of forbiddenTokens) {
    if (content.includes(token)) {
      failures.push(`${relativePath} contains "${token}"`);
    }
  }
}

if (failures.length > 0) {
  console.error('[check-production-debug-surface] Debug-only surface leaked into production build:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[check-production-debug-surface] OK');

function* walkFiles(root) {
  for (const entry of readdirSync(root)) {
    const file = join(root, entry);
    const stat = statSync(file);
    if (stat.isDirectory()) {
      yield* walkFiles(file);
    } else if (stat.isFile()) {
      yield file;
    }
  }
}

function isTextLikeFile(file) {
  return /\.(html|js|css|json|svg|txt|map)$/i.test(file);
}
