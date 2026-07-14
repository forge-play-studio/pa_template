import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Static token/structure guard only. Behavioral correctness belongs to the
// fps-3d-harness conformance and real-page runtime acceptance suites.

const root = resolve('src/debug/runtime-inspector');
const schema = read('schema.ts');
const runtime = read('runtime.ts');
const providers = read('providers.ts');
const logicalProvider = read('logical-object-provider.ts');
const templateProviders = read('template-providers.ts');
const inspectorIndex = read('index.ts');
const runtimeNodeService = read('../../services/RuntimeNodeService.ts');
const threeC = read('../../systems/ThreeCSystem.ts');
const vfxDirector = read('../../systems/ProjectVfxDirector.ts');
const bootstrap = read('../runtime-debug-bootstrap.ts');
const projectRuntimeEntry = read('../../project-runtime-entry.ts');
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
expect(schema, 'RuntimeInspectorMetadataQueryPredicate', 'metadata query predicate type');
expect(schema, 'RuntimeInspectorLogicalQuerySpec', 'logical query spec type');
expect(schema, 'RuntimeInspectorLogicalObjectRecord', 'logical object record type');
expect(schema, 'RuntimeInspectorHierarchyResult', 'bounded hierarchy result type');
expect(schema, 'RuntimeInspectorMutationPatchSpec', 'mutation patch spec type');
expect(schema, 'RuntimeInspectorMutationRestoreResult', 'mutation restore result type');
expect(schema, 'RuntimeInspectorSnapshotRecord', 'snapshot record type');
expect(schema, 'RuntimeInspectorSnapshotDiffResult', 'snapshot diff result type');
expect(schema, 'RuntimeInspectorPixelDiffResult', 'pixel diff result type');
expect(schema, 'RuntimeInspectorTraceSummary', 'trace summary type');
expect(schema, 'RuntimeInspectorTraceReadResult', 'trace paged read type');
expect(schema, 'RuntimeInspectorRenderExplainResult', 'render explain result type');
expect(schema, 'RuntimeInspectorVfxCatalogResult', 'VFX catalog result type');

for (const method of ['discover()', 'query(spec', 'inspect(handle', 'relations(handle', 'spatial(handle']) {
  expect(runtime, method, `runtime method ${method}`);
}
expect(runtime, 'hierarchy(handle, hierarchyOptions = {})', 'bounded hierarchy API');
expect(runtime, "hierarchy: '0.1'", 'bounded hierarchy capability 0.1');
expect(runtime, 'validateHierarchyOptions(', 'strict hierarchy options');
expect(runtime, "reasons.add('maxDepth')", 'hierarchy depth truncation evidence');
expect(runtime, "reasons.add('maxNodes')", 'hierarchy node-budget truncation evidence');
expect(runtime, "reasons.add('maxBytes')", 'hierarchy byte-budget truncation evidence');
expect(runtime, 'hierarchy root and ancestor chain exceed maxBytes', 'hierarchy hard byte-budget failure');
expect(runtime, 'safeSerialize(node.metadata, metadataOptions)', 'bounded hierarchy metadata serialization');
expect(runtime, 'spatialQuery(spec)', 'spatial query API');
expect(runtime, 'logicalQuery(spec = {})', 'logical query API');
expect(runtime, "logicalObjects: '0.1'", 'logical object capability 0.1');
expect(runtime, 'provider-logical-objects-v1', 'logical provider query method');
expect(runtime, 'expandLogicalMembers', 'logical root/member expansion');
expect(runtime, "throw new RuntimeInspectorCommandError('AMBIGUOUS'", 'duplicate logical id rejection');
expect(runtime, "mutation: '0.1'", 'safe runtime mutation capability 0.1');
for (const method of ['acquireMutationLease(', 'patchRuntimeNode(', 'restoreMutationByLeaseId(', 'restoreActiveMutationLease(', 'readMutationNodeSnapshot(']) {
  expect(runtime, method, `mutation method ${method}`);
}
expect(runtime, "restoreActiveMutationLease('timeout')", 'mutation timeout restore');
expect(runtime, "restoreActiveMutationLease('pagehide')", 'mutation pagehide restore');
expect(runtime, "restoreActiveMutationLease('dispose')", 'mutation dispose restore');
expect(runtime, "restoreActiveMutationLease('scene-change')", 'mutation scene replacement restore fallback');
expect(runtime, "new Set(['position', 'rotation', 'rotationQuaternion', 'scaling', 'isVisible', 'visibility'])", 'mutation strict field whitelist');
expect(runtime, "snapshot: '0.1'", 'runtime snapshot capability 0.1');
for (const method of ['captureRuntimeSnapshot(', 'listRuntimeSnapshots(', 'getRuntimeSnapshot(', 'diffRuntimeSnapshots(', 'releaseRuntimeSnapshot(']) {
  expect(runtime, method, `snapshot method ${method}`);
}
expect(runtime, 'collectSnapshotDifferences', 'field-level snapshot diff');
expect(runtime, 'snapshots.size > 16', 'bounded snapshot store');
expect(runtime, 'snapshot.nodes.readiness', 'readiness unavailable coverage');
expect(runtime, 'snapshot.nodes.thinInstanceMatrices', 'thin-instance matrix unavailable coverage');
for (const channel of ['snapshot.particles', 'snapshot.vfx', 'snapshot.shader', 'snapshot.textures', 'snapshot.physics']) {
  expect(runtime, channel, `explicit unavailable ${channel}`);
}
expect(runtime, "pixelDiff: '0.1'", 'pixel diff capability 0.1');
for (const method of ['capturePixels(', 'selfCheckPixels(', 'listPixelCaptures(', 'getPixelCapture(', 'diffPixelCaptures(', 'releasePixelCapture(']) {
  expect(runtime, method, `pixel method ${method}`);
}
expect(runtime, 'readDefaultFramebufferTwiceAfterRender', 'same-frame pixel noise floor');
expect(runtime, 'bottom-left-inverted', 'GL-to-screen Y semantics');
expect(runtime, 'measurePixelDifference', 'inside/outside pixel metrics');
expect(runtime, 'buildPixelHeatmap', 'bounded tile heatmap');
expect(runtime, 'pixelCaptures.size > 4', 'bounded raw pixel store');
expect(runtime, 'pixels.domComposite', 'DOM composite unavailable coverage');
expect(runtime, 'pixels.objectId', 'object-id unavailable coverage');
expect(runtime, "trace: '0.1'", 'runtime trace capability 0.1');
for (const method of ['startRuntimeTrace(', 'listRuntimeTraces(', 'getRuntimeTrace(', 'triggerRuntimeTrace(', 'stopRuntimeTrace(', 'releaseRuntimeTrace(']) {
  expect(runtime, method, `trace method ${method}`);
}
expect(runtime, 'scene.onAfterRenderObservable.add', 'after-render trace sampling');
expect(runtime, 'preSamples + postSamples + 1 > 120', 'bounded trace sample ring');
expect(runtime, 'all four trace slots are active', 'bounded trace store');
expect(runtime, "stopActiveTraces('pagehide'", 'pagehide trace cleanup');
expect(runtime, "stopActiveTraces('dispose'", 'dispose trace cleanup');
expect(runtime, "stopActiveTraces('scene-change'", 'scene replacement trace cleanup');
expect(runtime, 'trace.beforeUpdate', 'explicit unavailable trace phase');
expect(runtime, 'trace.callStack', 'explicit unavailable trace call stack');
expect(runtime, 'trace.gameplayPause', 'explicit unavailable trace pause');
expect(runtime, "renderExplain: '0.1'", 'render explain capability 0.1');
expect(runtime, 'explainRenderPath(', 'passive render explanation');
expect(runtime, 'scene.getActiveMeshes()', 'active mesh membership evidence');
expect(runtime, 'scene.frustumPlanes', 'frustum gate evidence');
expect(runtime, 'subMesh.effect', 'existing submesh effect evidence');
expect(runtime, 'renderPassMembership(', 'render target and shadow membership evidence');
expect(runtime, 'Passive explain does not call material/mesh isReady', 'readiness non-contamination boundary');
expect(runtime, 'Active-mesh membership is a CPU candidate fact', 'active candidate limitation');
expect(runtime, "vfxProvider: '0.1'", 'VFX provider capability 0.1');
expect(runtime, 'readVfxCatalog(', 'VFX catalog command');
expect(runtime, 'provider-vfx-catalog-v1', 'VFX catalog method');
expect(runtime, "state: 'unavailable'", 'VFX instance unavailable tri-state');
expect(runtime, "state: 'inactive'", 'VFX instance inactive tri-state');
expect(runtime, "state: 'active'", 'VFX instance active tri-state');
expect(runtime, 'vfx.particleInternals', 'VFX particle internals unavailable coverage');
expect(runtime, 'vfx.gpuContribution', 'VFX GPU contribution unavailable coverage');
expect(runtime, 'VFX Provider 0.1 is observation-only', 'VFX observation-only boundary');
expect(runtime, 'effectAvailable: effectIds.has(usage.effectId)', 'VFX effect availability cross-check');
expect(runtime, 'references missing effect', 'VFX missing effect warning');
expect(runtime, "vfxControl: '0.1'", 'VFX control capability 0.1');
for (const method of ['acquireVfxLease(', 'previewVfxUsage(', 'restoreVfxByLeaseId(', 'restoreActiveVfxLease(', 'readVfxLeaseRecord(']) {
  expect(runtime, method, `VFX control method ${method}`);
}
expect(runtime, 'validateVfxParamPatch', 'catalog-driven VFX parameter validation');
expect(runtime, "restoreActiveVfxLease('timeout')", 'VFX timeout restore');
expect(runtime, "restoreActiveVfxLease('pagehide')", 'VFX pagehide restore');
expect(runtime, "restoreActiveVfxLease('scene-change')", 'VFX scene replacement restore');
expect(runtime, "restoreActiveVfxLease('dispose')", 'VFX dispose restore');
expect(runtime, 'readMaterialCatalog(', 'material catalog command');
expect(runtime, 'sharedAcrossSceneNodes: boundNodes.length > 1', 'material sharing derives from actual runtime bindings');
expect(runtime, "spatialQuery: '0.1'", 'spatial query capability 0.1');
expect(runtime, 'bounds-sphere-v1', 'sphere bounds query method');
expect(runtime, 'bounds-aabb-v1', 'aabb bounds query method');
expect(runtime, 'mesh-ray-v1', 'mesh ray query method');
expect(runtime, 'new Ray(origin, direction, spec.length)', 'bounded Babylon ray');
for (const method of ['acquire(acquireOptions', 'focus(leaseId', 'view(leaseId', 'adjust(leaseId', 'occlusion(leaseId', 'visualOcclusion(leaseId', 'visualAttribution(leaseId', 'visualOcclusionBounds(leaseId', 'patch(leaseId', 'restore(leaseId', 'current()', 'lastRestore()']) {
  expect(runtime, method, `camera method ${method}`);
}
expect(runtime, 'returning handles for every match', 'duplicate-name ambiguity warning');
expect(runtime, "query: '0.2'", 'query capability 0.2');
expect(runtime, "camera: '0.4'", 'camera capability 0.4');
expect(runtime, "cameraOcclusion: '0.2'", 'camera occlusion capability 0.2');
expect(runtime, "cameraReference: '0.1'", 'camera reference capability 0.1');
expect(runtime, "cameraVisual: '0.1'", 'camera visual capability 0.1');
expect(runtime, "cameraVisualAttribution: '0.1'", 'camera visual attribution capability 0.1');
expect(runtime, "cameraVisualBounds: '0.1'", 'camera visual bounds capability 0.1');
expect(runtime, "spatial: '0.1'", 'semantic spatial capability 0.1');
expect(runtime, 'viewCamera(', 'absolute camera view');
expect(runtime, 'adjustCamera(', 'relative camera adjustment');
expect(runtime, 'resolveCameraReferenceFrame(', 'camera reference frame resolution');
expect(runtime, "['sceneMarker', 'semanticFrame']", 'explicit marker semantic frame');
expect(schema, 'referenceHandle?: RuntimeInspectorObjectHandle', 'separate camera reference handle');
expect(runtime, 'matchesMetadataPredicates', 'metadata predicate matching');
expect(runtime, 'readSpatialGeometry(', 'resolved marker spatial geometry');
for (const kind of ["kind: 'point'", "kind: 'box'", "kind: 'polyhedron'", "kind: 'object-bounds'"]) {
  expect(runtime, kind, `semantic spatial ${kind}`);
}
expect(runtime, 'Object.getOwnPropertyDescriptor', 'metadata getter-safe traversal');
expect(runtime, "new Set(['__proto__', 'prototype', 'constructor'])", 'metadata prototype-path rejection');
expect(runtime, "throw new RuntimeInspectorCommandError('STALE_HANDLE'", 'stale handle rejection');
expect(runtime, "throw new RuntimeInspectorCommandError('LEASE_CONFLICT'", 'camera lease conflict');
expect(runtime, "restoreActiveCameraLease('timeout')", 'camera timeout restore');
expect(runtime, "restoreActiveCameraLease('pagehide')", 'camera pagehide restore');
expect(runtime, "camera.target.copyFrom(center)", 'orthographic-safe target focus');
expect(runtime, 'scaleOrthographicCamera(camera, lease.scene, spec.dollyFactor)', 'orthographic dolly scales projection extents');
expect(runtime, 'camera.orthoLeft = centerX + ((left - centerX) * factor)', 'orthographic dolly preserves projection center');
expect(runtime, 'multiPickWithRay', 'raycast occlusion');
expect(runtime, 'raycast-screen-grid-v2', 'screen-grid occlusion version');
expect(runtime, 'createPickingRay', 'screen-space ray construction');
expect(runtime, 'adaptiveOddGridCount', 'adaptive screen grid');
expect(runtime, 'gpu-depth-grid-v1', 'GPU depth visibility method');
expect(runtime, 'new DepthRenderer(', 'transient GPU depth renderer');
expect(runtime, 'renderTransientDepthMap(lease.scene, sceneRenderer, sceneMap, targetMeshes', 'render-pass-scoped scene depth warm-up');
expect(runtime, 'renderTransientDepthMap(lease.scene, targetRenderer, targetMap, targetMeshes', 'render-pass-scoped target depth warm-up');
expect(runtime, 'depthMap.onBeforeRenderObservable.add', 'depth readiness runs inside RTT render pass');
expect(runtime, 'gpu-depth-match-raycast-candidates-v1', 'GPU depth candidate attribution method');
expect(runtime, 'gpu-depth-transparency-bounds-v1', 'GPU depth transparency bounds method');
expect(runtime, 'disposeTransientDepthRenderer(targetRenderer)', 'transient target depth map disposal');
expect(runtime, 'disposeTransientDepthRenderer(sceneRenderer)', 'transient scene depth map disposal');
expect(runtime, 'disposeTransientDepthRenderer(renderer)', 'transient candidate depth map disposal');
expect(runtime, 'restoreCameraVisibilityPatches', 'visibility patch restore');
expect(runtime, 'camera lease belongs to another scene', 'camera lease scene consistency guard');
expect(runtime, 'renderOutline: false', 'ghost disables Babylon opaque outline rendering');
expect(runtime, 'nullableColorEqual(after.outlineColor', 'visibility patch restores optional mesh outline color');
expect(runtime, 'after.outlineWidth', 'visibility patch restores mesh outline width');
for (const mode of ["'hide'", "'ghost'", "'isolate'"]) {
  expect(runtime, mode, `visibility patch mode ${mode}`);
}
expect(runtime, 'coverage:', 'observation coverage');
forbid(runtime, 'getMeshByName(', 'silent name lookup');
forbid(runtime, 'getTransformNodeByName(', 'silent transform-node lookup');
forbid(runtime, 'getNodeByName(', 'silent generic-node lookup');
forbid(runtime, 'getMeshById(', 'silent mesh-id lookup');
forbid(runtime, 'frameMs', 'performance counter');
forbid(runtime, 'drawCalls', 'performance counter');

expect(providers, 'registerRuntimeInspectorProviders', 'provider registry');
expect(providers, 'RuntimeInspectorCameraControlProvider', 'camera owner provider contract');
expect(providers, 'RuntimeInspectorLogicalObjectProvider', 'logical object provider contract');
expect(providers, 'readRuntimeInspectorLogicalObjectProviders', 'logical object provider registry read');
expect(providers, 'RuntimeInspectorSnapshotProvider', 'snapshot provider contract');
expect(providers, 'readRuntimeInspectorSnapshotProviders', 'snapshot provider registry read');
expect(providers, 'RuntimeInspectorVfxProvider', 'VFX provider contract');
expect(providers, 'readRuntimeInspectorVfxProviders', 'VFX provider registry read');
expect(logicalProvider, 'gameplayBindingService.getAll()', 'authored gameplay binding logical adapter');
expect(logicalProvider, 'getRegisteredRuntimeNodes()', 'dynamic runtime logical adapter');
expect(runtimeNodeService, 'logicalKind?: string', 'runtime logical kind registration seam');
expect(runtimeNodeService, 'logicalId?: string', 'runtime registration to business identity seam');
expect(runtimeNodeService, 'logicalMembers?: TransformNode[]', 'out-of-tree logical member seam');
expect(templateProviders, '__FPS_EDITOR_AGENT_SESSION_METADATA__', 'live git/worktree metadata');
expect(templateProviders, "id: 'pa-template-three-c-camera-owner'", 'template camera owner provider');
expect(templateProviders, 'setCameraFollowEnabled(false)', 'camera follow suspension');
expect(templateProviders, 'createGameplayLogicalObjectProvider(getGame)', 'template logical object provider');
expect(templateProviders, "id: 'pa-template-gameplay'", 'template snapshot provider');
expect(templateProviders, "id: 'pa-template-vfx'", 'template VFX provider');
expect(templateProviders, 'getEffectPackages', 'template VFX effect adapter');
expect(templateProviders, 'getVfxUsageTargets', 'template VFX usage adapter');
expect(templateProviders, 'getVfxUsageRoot', 'template VFX instance adapter');
expect(templateProviders, 'readAuthoredVfxUsages', 'authored VFX usage preservation');
expect(templateProviders, 'ProjectVfxDirector effective overlay', 'runtime VFX effective overlay provenance');
expect(templateProviders, 'captureVfxUsageRuntimeState', 'template VFX exact state capture');
expect(templateProviders, 'restoreVfxUsageRuntimeState', 'template VFX exact state restore');
expect(inspectorIndex, 'runtime.mutation.current()', 'scene replacement mutation cleanup query');
expect(inspectorIndex, 'runtime.mutation.restore(mutation.data.id)', 'scene replacement mutation cleanup restore');
expect(inspectorIndex, 'runtime.vfx.restore(vfx.data.id)', 'scene replacement VFX cleanup restore');
expect(threeC, 'setCameraFollowEnabled(enabled', 'ThreeC camera follow seam');
expect(threeC, 'this.cameraFollowEnabled', 'ThreeC follow gate');
expect(vfxDirector, 'captureVfxUsageRuntimeState', 'VFX director state capture seam');
expect(vfxDirector, 'restoreVfxUsageRuntimeState', 'VFX director state restore seam');
expect(vfxDirector, 'this.previewParams.has(usageId)', 'VFX director preview provenance capture');
forbid(bootstrap, 'mountTemplateRuntimeInspector', 'runtime inspector tied to panel lifetime');
expect(projectRuntimeEntry, 'ensureRuntimeInspectorForDev', 'page-lifetime runtime inspector mount');
expect(projectRuntimeEntry, 'runtimeInspector?.beforeSceneChange()', 'scene replacement camera lease cleanup');
expect(projectRuntimeEntry, "import.meta.hot?.accept('./debug/runtime-inspector/template'", 'runtime inspector HMR accept boundary');
expect(projectRuntimeEntry, 'disposeRuntimeInspector();', 'page-lifetime runtime inspector cleanup');
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
