import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const disabled = args[0] === '--disabled';
const artifactPath = args.find((arg) => arg !== '--disabled')
  ?? (disabled ? 'dist/index.html' : 'dist/scene-walkthrough/index.html');
const resolvedArtifactPath = resolve(artifactPath);
const marker = 'data-scene-walkthrough-build';

if (!existsSync(resolvedArtifactPath)) {
  console.error(`[check-scene-walkthrough-build] Missing build artifact: ${resolvedArtifactPath}`);
  process.exit(1);
}

const content = readFileSync(resolvedArtifactPath, 'utf8');
const searchableContent = `${content}\n${readGzipInlinedModule(content) ?? ''}`;
const containsWalkthrough = searchableContent.includes(marker);

if (disabled && containsWalkthrough) {
  console.error(`[check-scene-walkthrough-build] Test-only walkthrough leaked into regular artifact: ${resolvedArtifactPath}`);
  process.exit(1);
}

if (!disabled && !containsWalkthrough) {
  console.error(`[check-scene-walkthrough-build] Expected test-only walkthrough is missing: ${resolvedArtifactPath}`);
  process.exit(1);
}

console.log(`[check-scene-walkthrough-build] ${disabled ? 'regular build is clean' : 'walkthrough build is enabled'}: ${resolvedArtifactPath}`);

function readGzipInlinedModule(html) {
  const encoded = html.match(/Uint8Array\.from\(atob\("([A-Za-z0-9+/=]+)"\)/)?.[1];
  if (!encoded) return null;
  try {
    return gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
  } catch (error) {
    console.error('[check-scene-walkthrough-build] Failed to inspect gzip-inlined JavaScript.', error);
    process.exit(1);
  }
}
