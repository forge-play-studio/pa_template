// Project tool ownership: project-only | Reviewed: 2026-07-08 | Purpose: pa_template asset directory, generated output, and URL mapping config. | Migration: stays beside asset registry scripts; reusable registry behavior lives in @fps-games/editor/playable-sdk/vite.
import path from 'node:path';
import {
  resolvePlayableEditorAssetMetadata as resolveAssetMetadata,
} from '@fps-games/editor/playable-sdk/vite';

const cwd = process.cwd();
const assetsDir = path.resolve(cwd, 'src/assets');
const importedDir = path.resolve(cwd, 'src/assets/imported');
const generatedDir = path.resolve(cwd, 'src/assets/generated');

export const projectAssetCatalogConfig = {
  cwd,
  assetsDir,
  importedDir,
  generatedDir,
  manifestPath: path.join(generatedDir, 'asset-catalog.manifest.json'),
  registryPath: path.join(generatedDir, 'asset-catalog.generated.ts'),
  scenePath: path.resolve(cwd, 'src/config/scene.json'),
  supportedExtensions: [
    '.glb', '.gltf',
    '.png', '.jpg', '.jpeg', '.webp',
    '.env', '.hdr', '.dds', '.ktx', '.ktx2',
    '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
  ],
  commands: {
    register: 'npm run asset:register',
    unregister: 'npm run asset:unregister',
  },
  async resolveAssetMetadata({ kind, sourcePath, existingMetadata, payloadMetadata, guid, assetId }) {
    return resolveAssetMetadata({
      kind,
      sourcePath,
      existingMetadata,
      payloadMetadata,
      guid,
      assetId,
      cwd,
      assetsDir,
    });
  },
  relativeImportedPath(kind, fileName) {
    if (kind === 'model') return `../imported/${fileName}`;
    if (kind === 'sound') return `../imported/sounds/${fileName}`;
    return `../imported/textures/${fileName}`;
  },
  publicUrlForImportedAsset(kind, fileName) {
    if (kind === 'model') return `/src/assets/imported/${fileName}`;
    if (kind === 'sound') return `/src/assets/imported/sounds/${fileName}`;
    return `/src/assets/imported/textures/${fileName}`;
  },
  publicUrlForCatalogRelativePath(relativePath) {
    const targetPath = path.resolve(generatedDir, relativePath);
    const relativeToCwd = path.relative(cwd, targetPath).split(path.sep).join('/');
    return `/${relativeToCwd}`;
  },
};

export const projectAssetRegistryConfig = projectAssetCatalogConfig;
export const projectTextureRegistryConfig = projectAssetCatalogConfig;
