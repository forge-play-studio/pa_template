import { statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const WARN_BYTES = 5 * 1024 * 1024;

function findHtmlBundle() {
  return readdirSync(DIST)
    .filter((f) => f.endsWith('.html'))
    .map((f) => join(DIST, f));
}

const files = findHtmlBundle();
if (files.length === 0) {
  console.error(`[check-bundle-size] no .html in ${DIST}/`);
  process.exit(1);
}

let warned = false;
for (const f of files) {
  const size = statSync(f).size;
  const kb = (size / 1024).toFixed(1);
  const mb = (size / 1024 / 1024).toFixed(2);
  if (size > WARN_BYTES) {
    console.error(`[check-bundle-size] ⚠ ${f}: ${mb} MB (> 5 MB)`);
    warned = true;
  } else {
    console.log(`[check-bundle-size] ✓ ${f}: ${kb} KB`);
  }
}

// Build succeeds either way; > 5MB only warns. Flip to process.exit(1) below
// if you want CI to fail on oversize bundles.
if (warned) {
  console.error('[check-bundle-size] consider trimming assets / dependencies');
}
