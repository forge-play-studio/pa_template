import fs from 'node:fs/promises';
import path from 'node:path';
import {
  resolveAssetMetadata,
} from './core.mjs';

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
  rulesPath: path.resolve(cwd, 'src/config/scene-json-v2-rules.json'),
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
  async loadRules() {
    return JSON.parse(await fs.readFile(this.rulesPath, 'utf8'));
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
