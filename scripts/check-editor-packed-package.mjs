import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createServer } from 'vite';
import { isExactPortableSemver } from './lib/exact-portable-semver.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.env.FPS_GAME_EDITOR_REFERENCE_ROOT
  ? path.resolve(process.env.FPS_GAME_EDITOR_REFERENCE_ROOT)
  : path.resolve(scriptDir, '..');
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const editorDependency = packageJson.dependencies?.['@fps-games/editor'];

if (!isExactPortableSemver(editorDependency)) {
  throw new Error(
    `Expected @fps-games/editor to keep a portable exact package version, got ${JSON.stringify(editorDependency)}.`,
  );
}

const tarballPath = resolvePackedTarballPath();
if (!fs.existsSync(tarballPath)) {
  throw new Error(
    [
      `Missing local packed @fps-games/editor tarball: ${tarballPath}`,
      'Rebuild it from the editor worktree before installing pa_template:',
      '  npm run build --workspace @fps-games/editor-core',
      '  npm run build --workspace @fps-games/editor-playable-sdk',
      '  npm run build --workspace @fps-games/editor',
      '  npm pack --workspace @fps-games/editor --pack-destination .local/packed-editor',
    ].join('\n'),
  );
}

const editorPackageRoot = path.join(projectRoot, 'node_modules/@fps-games/editor');
if (process.env.FPS_GAME_EDITOR_SKIP_PACKED_LOCK_INTEGRITY_CHECK === '1') {
  console.log('skipped packed editor lock integrity check for an ephemeral reference-consumer install');
} else {
  assertLockIntegrityMatchesTarball(tarballPath, editorDependency);
}
assertInstalledPackageMatchesTarball(tarballPath, editorPackageRoot);
assertProductLocalEditorHardCut(editorPackageRoot);
const playableSdk = await import('@fps-games/editor/playable-sdk');
assertProductWorldContract(editorPackageRoot, playableSdk);
const playableSdkVite = await import('@fps-games/editor/playable-sdk/vite');
const editorRoot = await import('@fps-games/editor');
const editorVite = await import('@fps-games/editor/vite');
await assertPackedPluginManifestModule(editorRoot, editorVite);
await assertRetiredSubpathIsUnavailable('@fps-games/editor/playable-sdk/legacy-compat');
const requiredFunctions = [
  'assertPlayableEditorRuntimeSceneConfig',
  'normalizeEditorSceneMarkerGraph',
  'reduceEditorSceneMarkerGraph',
  'getEditorSceneMarkerTypeCatalogFromGraph',
  'createDefaultPbrEditorSceneMaterialAsset',
  'createEditorScenePrefabDefinitionFromAsset',
  'deleteDefaultEditorSceneMaterialAsset',
  'createPlayableEditorManagedAssetFacade',
  'planPlayableEditorAssetRegistrationCore',
  'createRuntimeSceneCompiledArtifact',
  'createUniquePlayableEditorRuntimeAssetNodeId',
  'createPlayableEditorRuntimeAssetInstanceNode',
  'createPlayableEditorManagedRuntimeAssetInstance',
  'removePlayableEditorManagedRuntimeAssetInstance',
  'findPlayableEditorRuntimeSceneAssetUsageByAssetId',
  'addEditorScenePrefabAsset',
  'patchEditorScenePrefabAssetField',
  'replaceEditorScenePrefabAsset',
  'normalizeEditorScenePrefabAssetFieldValue',
  'validateEditorScenePrefabAssetFieldValue',
  'validatePlayableEditorRuntimeSceneConfig',
  'cleanupEditorScenePrefabDefaultShadow',
  'syncEditorScenePrefabRootNodeFields',
  'addEditorSceneMaterialAssetAndBindPrefabOverride',
  'normalizeEditorSceneRootTransformDocument',
  'createEditorSceneLightInspectorProperties',
  'createEditorSceneDirectionalLightShadowSummaryInspectorSection',
  'getEditorSceneLightInspectorLanguage',
  'getEditorSceneLightInspectorText',
  'isEditorSceneLightDirectionAnglePath',
  'normalizeEditorSceneLightDirectionAngleValue',
  'createEditorScenePlayableFieldInspectorExtraValidator',
  'normalizeEditorScenePlayableInspectorValue',
  'createPlayableEditorSceneHierarchyFacade',
  'createPlayableEditorSceneSessionFacade',
  'createPlayableEditorSceneObjectCommandFacade',
  'createPlayableEditorSceneFieldMutationOptions',
  'createPlayableEditorSceneInspectorMultiObject',
  'createPlayableEditorSceneInspectorObject',
  'createPlayableEditorSceneInspectorSections',
  'createEditorSceneRuntimeInspectorSectionsForDocument',
  'createEditorSceneCameraInspectorSection',
  'createEditorSceneLightInspectorSections',
  'createPlayableEditorSceneOutlineInspectorSection',
  'createPlayableEditorSceneInspectorPropertyPatch',
  'createEditorSceneGameObjectGuid',
  'createEditorSceneTransformPatchFromRuntimePatch',
  'patchEditorSceneGameObjectTransform',
  'createUniqueEditorSceneGameObjectId',
  'ensureEditorSceneGameObjectGuids',
  'findEditorSceneGameObject',
  'createPlayableBridgeCommandAssetAdapter',
  'createPlayableProjectAssetBridgeAdapter',
  'createBabylonPrimitiveProjectionInstancingController',
  'createFpsGameEditorLocalEditorHost',
  'createFpsGameEditorProductHostAssembly',
  'createFpsGameEditorProductSceneHostOptions',
  'mountFpsGameEditorProductLocalEditor',
  'createPlayableGroundDecalInspectorProperties',
  'createPlayableGroundDecalDocumentBridge',
  'createPlayableGroundDecalDocumentServices',
  'createPlayableGroundDecalInspectorServices',
  'createPlayableGroundDecalMultiInspectorSection',
  'canPatchPlayableEditorSceneGroundDecalMultiField',
  'mergePlayableGroundDecalDefaults',
  'normalizePlayableGroundDecalLayoutRect',
  'normalizePlayableGroundDecalUiScales',
  'parsePlayableGroundDecalLayerPatchPath',
  'patchPlayableEditorSceneGroundDecalInspectorField',
  'patchPlayableGroundDecalLayer',
  'describePlayableEditorAgentObject',
  'describePlayableEditorAgentObjectSet',
  'describePlayableEditorAgentRegionBinding',
  'ensurePlayableEditorSceneEnvironmentDefaultsCore',
  'isBlockedPlayableEditorSceneSystemFieldPatch',
  'patchPlayableEditorSceneDirectionalLightAngleField',
  'patchPlayableEditorSceneGameObjectFieldWithServices',
  'patchPlayableEditorSceneGameObjectsFieldWithServices',
  'reducePlayableEditorSceneDocumentCore',
  'resolveEditorSceneAssetMeshSelectionTarget',
  'isEditorSceneAssetMeshWritablePath',
  'isDefaultReadonlyEditorSceneMaterialAsset',
  'resolveDefaultEditorSceneMaterialAssetDeleteState',
  'createPlayableBabylonRenderingAlphaIndexMigrationPatch',
  'defineFpsGameEditorProject',
  'createFpsGameEditorAdapter',
  'createFpsGameEditorManagedAssetServices',
  'createFpsGameEditorStandardSceneAssembly',
  'createFpsGameEditorSceneSourceServices',
  'groundDecalFeature',
];

for (const exportName of requiredFunctions) {
  if (typeof playableSdk[exportName] !== 'function') {
    throw new Error(`Expected @fps-games/editor/playable-sdk runtime export ${exportName} to be a function.`);
  }
}

const packedRuntimeSceneValidation = playableSdk.validatePlayableEditorRuntimeSceneConfig({
  schemaVersion: 3,
  gameplay: { opaqueProjectExtension: true },
  scene: {
    rootId: 'root',
    assets: [],
    nodes: [],
    materialAssets: [],
    materials: [],
    textures: [],
  },
});
if (!packedRuntimeSceneValidation.ok || packedRuntimeSceneValidation.errors.length !== 0) {
  throw new Error('Expected packed canonical runtime SceneArtifact validator to accept a minimal v3 artifact.');
}

const forbiddenRootFunctions = [
  'createPlayableLegacySceneNodeDuplicateFacade',
  'createPlayableLegacyRuntimeNodeFacade',
];
for (const exportName of forbiddenRootFunctions) {
  if (exportName in playableSdk) {
    throw new Error(`Expected legacy-compat export ${exportName} to stay out of @fps-games/editor/playable-sdk root.`);
  }
}

const requiredViteFunctions = [
  'createFpsGameEditorAssetAuthoringServices',
  'createFpsGameEditorViteAdapter',
  'createFpsGameEditorProjectAuthoringApiPlugin',
  'createFpsGameEditorProjectSceneAuthoringServices',
  'createFpsGameEditorRenderingAuthoringServices',
  'invalidateFpsGameEditorViteFileModules',
  'createPlayableEditorViteAgentSessionMetadata',
  'createPlayableAuthoringTransportPathNormalizer',
  'createPlayableEditorAssetAuthoringHandlers',
  'readPlayableAuthoringJsonBody',
  'sendPlayableAuthoringHttpResponse',
  'setPlayableAuthoringCorsHeaders',
  'registerPlayableEditorAsset',
  'unregisterPlayableEditorAsset',
  'loadPlayableEditorAssetManifest',
  'generatePlayableEditorAssetCatalogModule',
  'resolvePlayableEditorAssetMetadata',
  'extractPlayableEditorGltfMaterialSlots',
  'createPlayableEditorAssetGuid',
  'createPlayableEditorAssetId',
  'guidToPlayableEditorAssetStableToken',
  'normalizePlayableEditorAssetKind',
  'normalizePlayableEditorAssetCodeKey',
  'normalizePlayableEditorAssetDisplayName',
  'stripKnownPlayableEditorAssetExtension',
  'toPlayableEditorAssetImportName',
  'runPlayableEditorAssetRegistryCli',
];

for (const exportName of requiredViteFunctions) {
  if (typeof playableSdkVite[exportName] !== 'function') {
    throw new Error(`Expected @fps-games/editor/playable-sdk/vite export ${exportName} to be a function.`);
  }
}

console.log(`editor packed package check passed: ${path.relative(projectRoot, tarballPath)}`);

async function assertPackedPluginManifestModule(editor, vite) {
  if (typeof editor.hierarchyPlugin !== 'function') {
    throw new Error('Packed editor must export hierarchyPlugin().');
  }
  const configServer = await createServer({
    configFile: false,
    root: projectRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  let references;
  try {
    const projectConfigModule = await configServer.ssrLoadModule('/fps.config.ts');
    references = projectConfigModule.fpsConfig?.plugins;
  } finally {
    await configServer.close();
  }
  if (!Array.isArray(references)) {
    throw new Error('pa_template fps.config.ts must export fpsConfig.plugins.');
  }
  const expectedPluginIds = [
    'fps.plugin.hierarchy',
    'fps.plugin.scene',
    'fps.plugin.assets',
    'fps.plugin.materials',
    'fps.plugin.rendering',
    'fps.plugin.shadows',
    'fps.plugin.markers',
    'fps.renderer.babylon',
  ];
  const configuredPluginIds = references.map(reference => reference.pluginId);
  if (JSON.stringify(configuredPluginIds) !== JSON.stringify(expectedPluginIds)) {
    throw new Error(
      `pa_template fps.config.ts Plugin order mismatch: expected ${expectedPluginIds.join(', ')}, got ${configuredPluginIds.join(', ') || 'none'}.`,
    );
  }
  const plugin = vite.createFpsConfiguredPluginManifestVitePlugin({
    apiVersion: 1,
    projectRoot,
    plugins: references,
  });
  const resolvedId = await plugin.resolveId('virtual:fps-plugins/editor');
  const source = plugin.load(resolvedId);
  if (typeof source !== 'string') throw new Error('Packed editor did not generate the editor Plugin virtual module.');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const generated = await import(moduleUrl);
  if (generated.manifests.length !== references.length) {
    throw new Error(`Packed editor Plugin manifest count mismatch: expected ${references.length}, got ${generated.manifests.length}.`);
  }
  if (generated.entries.length !== 1 || generated.entries[0]?.pluginId !== 'fps.plugin.hierarchy') {
    throw new Error(
      `Packed editor Plugin entry filtering mismatch: expected one fps.plugin.hierarchy editor entry, got ${generated.entries.map(entry => entry.pluginId).join(', ') || 'none'}.`,
    );
  }
  if (Object.keys(generated.pluginConfigs).length !== references.length) {
    throw new Error('Packed editor Plugin configs did not preserve every configured Plugin.');
  }
  if (!Object.isFrozen(generated.manifests) || !Object.isFrozen(generated.pluginConfigs)) {
    throw new Error('Packed editor Plugin virtual module must expose frozen inspection data.');
  }

  const hierarchyEntryPath = path.join(
    editorPackageRoot,
    'node_modules/@fps-games/plugin-hierarchy/dist/editor.js',
  );
  if (!fs.existsSync(hierarchyEntryPath)) {
    throw new Error('Packed editor tarball did not bundle the Hierarchy Editor entry.');
  }
  const hierarchyEntryModule = await import(pathToFileURL(hierarchyEntryPath).href);
  const environmentModule = {
    environment: generated.environment,
    manifests: generated.manifests,
    entries: generated.entries.map(entry => ({
      ...entry,
      load: async () => hierarchyEntryModule.pluginEntry,
    })),
    pluginConfigs: generated.pluginConfigs,
  };
  const host = editor.createFpsEditorPluginHostFromEnvironmentModule({ module: environmentModule });
  try {
    await host.start();
    const startedPlugins = host.inspect().plugins.filter(plugin => plugin.lifecycle === 'started');
    if (host.state !== 'started'
      || startedPlugins.length !== 1
      || startedPlugins[0]?.manifest.id !== 'fps.plugin.hierarchy') {
      throw new Error(
        `Packed editor Plugin Host activation mismatch: expected one active Hierarchy entry, got ${startedPlugins.map(plugin => plugin.manifest.id).join(', ') || 'none'}.`,
      );
    }
  } finally {
    await host.dispose();
  }
}

async function assertRetiredSubpathIsUnavailable(subpath) {
  const installedPackage = JSON.parse(fs.readFileSync(path.join(editorPackageRoot, 'package.json'), 'utf8'));
  const exportKey = `.${subpath.slice('@fps-games/editor'.length)}`;
  if (installedPackage.exports && Object.prototype.hasOwnProperty.call(installedPackage.exports, exportKey)) {
    throw new Error(`Retired editor package export must be absent: ${exportKey}`);
  }
  try {
    await import(subpath);
  } catch (error) {
    if (error?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') return;
    throw error;
  }
  throw new Error(`Retired editor package subpath must not resolve: ${subpath}`);
}

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

function assertLockIntegrityMatchesTarball(packedTarballPath, version) {
  const lockfilePath = path.join(projectRoot, 'pnpm-lock.yaml');
  const source = fs.readFileSync(lockfilePath, 'utf8');
  const integrity = `sha512-${createHash('sha512').update(fs.readFileSync(packedTarballPath)).digest('base64')}`;
  const escapedKey = `@fps-games/editor@${version}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const entryPattern = new RegExp(
    `^  '${escapedKey}':\\n    resolution: \\{integrity: ([^}]+)\\}`,
    'm',
  );
  const match = source.match(entryPattern);
  if (!match) {
    throw new Error(`Missing packed editor lock resolution for @fps-games/editor@${version}.`);
  }
  if (match[1] !== integrity) {
    throw new Error(
      `Packed editor lock integrity mismatch: expected ${integrity}, got ${match[1]}. Rebuild the packed baseline.`,
    );
  }
}

function assertInstalledPackageMatchesTarball(packedTarballPath, installedPackageRoot) {
  if (!fs.existsSync(installedPackageRoot)) {
    throw new Error(
      `Missing installed @fps-games/editor package. Run pnpm --ignore-workspace run prepare:editor-packed-package first.`,
    );
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pa-template-packed-editor-check-'));
  const packedRoot = path.join(tempRoot, 'package');
  const criticalFiles = [
    'package.json',
    'dist/playable-sdk.js',
    'dist/playable-sdk.d.ts',
    'dist/playable-sdk-vite.js',
    'dist/playable-sdk-vite.d.ts',
    'dist/playable-product-local-editor.js',
    'dist/playable-product-local-editor.d.ts',
    'dist/playable-local-editor-host.js',
    'dist/playable-local-editor-host.d.ts',
  ];
  try {
    execFileSync('tar', ['-xzf', packedTarballPath, '-C', tempRoot], { stdio: 'ignore' });
    for (const relativePath of criticalFiles) {
      const packedFile = path.join(packedRoot, relativePath);
      const installedFile = path.join(installedPackageRoot, relativePath);
      if (!fs.existsSync(packedFile) || !fs.existsSync(installedFile)) {
        throw new Error(`Packed editor baseline is missing critical file: ${relativePath}`);
      }
      if (!fs.readFileSync(packedFile).equals(fs.readFileSync(installedFile))) {
        throw new Error(
          [
            `Installed @fps-games/editor does not match the packed baseline at ${relativePath}.`,
            'Reinstall it with:',
            '  pnpm --ignore-workspace run prepare:editor-packed-package',
          ].join('\n'),
        );
      }
    }
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
}

function assertProductLocalEditorHardCut(installedPackageRoot) {
  const runtimePath = path.join(installedPackageRoot, 'dist/playable-product-local-editor.js');
  const declarationPath = path.join(installedPackageRoot, 'dist/playable-product-local-editor.d.ts');
  const runtime = fs.readFileSync(runtimePath, 'utf8');
  const declaration = fs.readFileSync(declarationPath, 'utf8');
  for (const retiredMember of ['installAssetCommandBypass', 'createHostOptions?:', 'hostAssembly?:']) {
    if (runtime.includes(retiredMember) || declaration.includes(retiredMember)) {
      throw new Error(`Packed product local editor still exposes retired member: ${retiredMember}`);
    }
  }
  if (!/hostAssembly:\s*\{/.test(declaration)) {
    throw new Error('Packed product local editor must require hostAssembly.');
  }
  if (!runtime.includes('options.hostAssembly.createHostOptions(context)')) {
    throw new Error('Packed product local editor must create host options through required hostAssembly.');
  }
  if (countOccurrences(declaration, 'createHostOptions') !== 1) {
    throw new Error('Packed product local editor declaration must expose createHostOptions only inside hostAssembly.');
  }
  if (countOccurrences(runtime, 'createHostOptions') !== 1) {
    throw new Error('Packed product local editor runtime must use only the hostAssembly createHostOptions path.');
  }
  if (/\boptions\s*\[/.test(runtime)) {
    throw new Error('Packed product local editor must not use computed option access.');
  }
}

function countOccurrences(source, value) {
  return source.split(value).length - 1;
}

function assertProductWorldContract(installedPackageRoot, sdk) {
  const declaration = fs.readFileSync(
    path.join(installedPackageRoot, 'dist/playable-local-editor-host.d.ts'),
    'utf8',
  );
  if (!declaration.includes('PLAYABLE_LOCAL_EDITOR_HOST_MANIFEST_VERSION: 2')) {
    throw new Error('Packed local editor host must expose manifest contract version 2.');
  }
  const sourceFile = ts.createSourceFile(
    'playable-local-editor-host.d.ts',
    declaration,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const worldInterfaces = sourceFile.statements.filter(statement => (
    ts.isInterfaceDeclaration(statement)
    && statement.name.text === 'PlayableLocalEditorWorldCapability'
  ));
  if (worldInterfaces.length !== 1) {
    throw new Error('Packed declaration must expose exactly one PlayableLocalEditorWorldCapability interface.');
  }
  const worldInterface = worldInterfaces[0];
  if ((worldInterface.heritageClauses?.length ?? 0) !== 0) {
    throw new Error('Packed PlayableLocalEditorWorldCapability must not inherit additional capability surfaces.');
  }
  const actualTypeParameters = (worldInterface.typeParameters ?? []).map(parameter => normalizeDeclaration(parameter.getText(sourceFile)));
  if (JSON.stringify(actualTypeParameters) !== JSON.stringify(['TAsset = unknown'])) {
    throw new Error(`Packed PlayableLocalEditorWorldCapability type parameters are not exact: ${JSON.stringify(actualTypeParameters)}`);
  }
  const actualMembers = worldInterface.members.map(member => normalizeDeclaration(member.getText(sourceFile)));
  const expectedMembers = [
    'disposeWorld(): PlayableLocalEditorMaybePromise<void>;',
    'getCanvas(): HTMLCanvasElement | null;',
    'loadPreviewEngine(): PlayableLocalEditorMaybePromise<Record<string, any>>;',
    'createPreviewEngine(engineModule: Record<string, any>, canvas: HTMLCanvasElement): any;',
    'importPreviewAsset(context: any): Promise<unknown | null>;',
    'resolveMaterialTextureUrl?(texture: ArtistMaterialTextureRef): string | null | undefined;',
    'toBrowserAssetItem?(asset: TAsset): unknown;',
    'resolveAssetId?(asset: TAsset): string;',
  ].map(normalizeDeclaration);
  if (JSON.stringify(actualMembers) !== JSON.stringify(expectedMembers)) {
    throw new Error([
      'Packed PlayableLocalEditorWorldCapability declaration is not exact.',
      `Expected: ${JSON.stringify(expectedMembers)}`,
      `Received: ${JSON.stringify(actualMembers)}`,
    ].join('\n'));
  }
  const expectedWorldContract = [
    'getCanvas',
    'disposeWorld',
    'loadPreviewEngine',
    'createPreviewEngine',
    'importPreviewAsset',
  ];
  if (JSON.stringify(sdk.PLAYABLE_LOCAL_EDITOR_HOST_REQUIRED_CONTRACT?.world?.direct) !== JSON.stringify(expectedWorldContract)) {
    throw new Error('Packed local editor host required world contract is not exact.');
  }
}

function normalizeDeclaration(source) {
  return source.replace(/\s+/g, ' ').trim();
}
