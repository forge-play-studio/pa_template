import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isExactPortableSemver } from './lib/exact-portable-semver.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.FPS_GAME_EDITOR_REFERENCE_ROOT
  ? path.resolve(process.env.FPS_GAME_EDITOR_REFERENCE_ROOT)
  : path.resolve(scriptDir, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const editorDependency = packageJson.dependencies?.['@fps-games/editor'];

if (!isExactPortableSemver(editorDependency)) {
  throw new Error(`Expected a portable exact @fps-games/editor version, got ${JSON.stringify(editorDependency)}.`);
}

const tarballPath = resolvePackedTarballPath();
if (!fs.existsSync(tarballPath)) {
  throw new Error(`Missing local packed @fps-games/editor tarball: ${tarballPath}`);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-template-packed-editor-'));
const extractedRoot = path.join(tempRoot, 'package');
const installedRoot = path.join(projectRoot, 'node_modules', '@fps-games', 'editor');

try {
  execFileSync('tar', ['-xzf', tarballPath, '-C', tempRoot], { stdio: 'inherit' });
  const packedPackageJson = JSON.parse(fs.readFileSync(path.join(extractedRoot, 'package.json'), 'utf8'));
  if (packedPackageJson.name !== '@fps-games/editor' || typeof packedPackageJson.version !== 'string') {
    throw new Error(
      `Packed editor identity mismatch: expected @fps-games/editor, got ${packedPackageJson.name}@${packedPackageJson.version}.`,
    );
  }

  fs.rmSync(installedRoot, { force: true, recursive: true });
  fs.mkdirSync(path.dirname(installedRoot), { recursive: true });
  fs.cpSync(extractedRoot, installedRoot, { recursive: true });
  fs.writeFileSync(path.join(installedRoot, '.fps-editor-packed-baseline.json'), `${JSON.stringify({
    declaredVersion: editorDependency,
    installedVersion: packedPackageJson.version,
  }, null, 2)}\n`);
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

console.log(`installed packed @fps-games/editor baseline: ${path.relative(projectRoot, tarballPath)}`);

function resolvePackedTarballPath() {
  if (process.env.FPS_GAME_EDITOR_PACKED_TARBALL) {
    return path.resolve(projectRoot, process.env.FPS_GAME_EDITOR_PACKED_TARBALL);
  }
  const directory = path.resolve(projectRoot, '../packed-editor');
  const matches = fs.existsSync(directory)
    ? fs.readdirSync(directory).filter(file => file.startsWith('fps-games-editor-') && file.endsWith('.tgz'))
    : [];
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one local packed editor tarball in ${directory}, found ${matches.length}.`);
  }
  return path.join(directory, matches[0]);
}
