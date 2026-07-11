import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('src/debug/runtime-inspector');
const schema = read('schema.ts');
const runtime = read('runtime.ts');
const providers = read('providers.ts');
const templateProviders = read('template-providers.ts');
const bootstrap = read('../runtime-debug-bootstrap.ts');
const main = read('../../main.ts');
const productionScan = readFileSync(resolve('scripts/check-production-debug-surface.mjs'), 'utf8');

const failures = [];

expect(schema, "FP3D_PROTOCOL_VERSION = '0.1'", 'protocol version');
expect(schema, "FP3D_OBSERVATION_VERSION = 'fp3d-observation.v0.1'", 'observation version');
for (const code of ['RUNTIME_MISMATCH', 'SCENE_MISMATCH', 'STALE_HANDLE', 'AMBIGUOUS', 'INVALID_LEASE', 'LEASE_CONFLICT']) {
  expect(schema, `'${code}'`, `error code ${code}`);
}
for (const field of ['runtimeSessionId', 'sceneGeneration', 'engineId', 'objectGeneration']) {
  expect(schema, field, `handle field ${field}`);
}

for (const method of ['discover()', 'query(spec', 'inspect(handle', 'relations(handle']) {
  expect(runtime, method, `runtime method ${method}`);
}
for (const method of ['acquire(acquireOptions', 'focus(leaseId', 'occlusion(leaseId', 'patch(leaseId', 'restore(leaseId', 'current()']) {
  expect(runtime, method, `camera method ${method}`);
}
expect(runtime, 'returning handles for every match', 'duplicate-name ambiguity warning');
expect(runtime, "throw new RuntimeInspectorCommandError('STALE_HANDLE'", 'stale handle rejection');
expect(runtime, "throw new RuntimeInspectorCommandError('LEASE_CONFLICT'", 'camera lease conflict');
expect(runtime, "restoreActiveCameraLease('timeout')", 'camera timeout restore');
expect(runtime, "restoreActiveCameraLease('pagehide')", 'camera pagehide restore');
expect(runtime, "camera.target.copyFrom(center)", 'orthographic-safe target focus');
expect(runtime, 'multiPickWithRay', 'raycast occlusion');
expect(runtime, 'restoreCameraVisibilityPatches', 'visibility patch restore');
for (const mode of ["'hide'", "'ghost'", "'isolate'"]) {
  expect(runtime, mode, `visibility patch mode ${mode}`);
}
expect(runtime, 'coverage:', 'observation coverage');
forbid(runtime, 'getMeshByName(', 'silent name lookup');
forbid(runtime, 'getTransformNodeByName(', 'silent transform-node lookup');
forbid(runtime, 'frameMs', 'performance counter');
forbid(runtime, 'drawCalls', 'performance counter');

expect(providers, 'registerRuntimeInspectorProviders', 'provider registry');
expect(providers, 'RuntimeInspectorCameraControlProvider', 'camera owner provider contract');
expect(templateProviders, '__FPS_EDITOR_AGENT_SESSION_METADATA__', 'live git/worktree metadata');
forbid(bootstrap, 'mountTemplateRuntimeInspector', 'runtime inspector tied to panel lifetime');
expect(main, 'ensureRuntimeInspectorForDev', 'page-lifetime runtime inspector mount');
expect(main, 'runtimeInspector?.beforeSceneChange()', 'scene replacement camera lease cleanup');
expect(main, 'disposeRuntimeInspector();', 'page-lifetime runtime inspector cleanup');
for (const token of ['__fp3d', 'fp3d-observation', 'pa-template-runtime-inspector', 'runtime-inspector']) {
  expect(productionScan, `'${token}'`, `production token scan ${token}`);
}

if (failures.length > 0) {
  console.error('[check-runtime-inspector-logic] FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[check-runtime-inspector-logic] OK');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function expect(content, token, label) {
  if (!content.includes(token)) failures.push(`${label}: missing ${JSON.stringify(token)}`);
}

function forbid(content, token, label) {
  if (content.includes(token)) failures.push(`${label}: found forbidden ${JSON.stringify(token)}`);
}
