import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const [mode, artifact = mode === '--disabled' ? 'dist/index.html' : 'dist/scene-walkthrough/index.html'] = process.argv.slice(2);
if (mode !== '--enabled' && mode !== '--disabled') {
  throw new Error('Usage: node check-scene-walkthrough-build.mjs <--enabled|--disabled> [artifact]');
}

const disabled = mode === '--disabled';
const resolvedArtifactPath = resolve(artifact);
const marker = 'data-scene-walkthrough-build';

if (!existsSync(resolvedArtifactPath)) {
  throw new Error(`Missing build artifact: ${resolvedArtifactPath}`);
}

const content = readFileSync(resolvedArtifactPath, 'utf8');
const searchableContent = `${content}\n${readGzipInlinedModule(content) ?? ''}`;
const containsWalkthrough = searchableContent.includes(marker);

if (disabled && containsWalkthrough) {
  throw new Error(`Test-only walkthrough leaked into regular artifact: ${resolvedArtifactPath}`);
}
if (!disabled && !containsWalkthrough) {
  throw new Error(`Expected test-only walkthrough is missing: ${resolvedArtifactPath}`);
}

console.log(`[check-scene-walkthrough-build] ${disabled ? 'regular build is clean' : 'walkthrough build is enabled'}: ${resolvedArtifactPath}`);

function readGzipInlinedModule(html) {
  const encoded = html.match(/Uint8Array\.from\(atob\("([A-Za-z0-9+/=]+)"\)/)?.[1];
  if (!encoded) return null;
  return gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
}
