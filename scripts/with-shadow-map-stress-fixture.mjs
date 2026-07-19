#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const managedPaths = [
  path.join(projectRoot, 'src/config/editor-scene.json'),
  path.join(projectRoot, 'src/config/scene.json'),
];
const separatorIndex = process.argv.indexOf('--');
if (separatorIndex < 0 || separatorIndex === process.argv.length - 1) {
  throw new Error('Usage: node scripts/with-shadow-map-stress-fixture.mjs <fixture args> -- <command> [args...]');
}

const fixtureArgs = process.argv.slice(2, separatorIndex);
const [command, ...commandArgs] = process.argv.slice(separatorIndex + 1);
const originals = new Map();
for (const filePath of managedPaths) originals.set(filePath, await fs.readFile(filePath));
const originalHashes = hashFiles(originals);

let commandError = null;
try {
  await run(process.execPath, [path.join(projectRoot, 'scripts/manage-shadow-map-stress-fixture.mjs'), ...fixtureArgs]);
  await run(command, commandArgs);
} catch (error) {
  commandError = error;
} finally {
  const restoreErrors = [];
  for (const [filePath, bytes] of originals) {
    try { await fs.writeFile(filePath, bytes); } catch (error) { restoreErrors.push(error); }
  }
  const restored = new Map();
  for (const filePath of managedPaths) {
    try { restored.set(filePath, await fs.readFile(filePath)); } catch (error) { restoreErrors.push(error); }
  }
  const restoredHashes = hashFiles(restored);
  for (const [filePath, expectedHash] of originalHashes) {
    if (restoredHashes.get(filePath) !== expectedHash) {
      restoreErrors.push(new Error(`shadowMapStress.restoreHashMismatch:${path.relative(projectRoot, filePath)}`));
    }
  }
  if (restoreErrors.length > 0) {
    throw new AggregateError(
      commandError ? [commandError, ...restoreErrors] : restoreErrors,
      'shadowMapStress.transactionRestoreFailed',
    );
  }
}

if (commandError) throw commandError;
console.log(JSON.stringify({
  status: 'restored',
  hashes: Object.fromEntries([...originalHashes].map(([filePath, hash]) => [path.relative(projectRoot, filePath), hash])),
}));

function hashFiles(files) {
  return new Map([...files].map(([filePath, bytes]) => [
    filePath,
    createHash('sha256').update(bytes).digest('hex'),
  ]));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: projectRoot, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`shadowMapStress.commandFailed:${command}:${signal ?? code}`));
    });
  });
}
