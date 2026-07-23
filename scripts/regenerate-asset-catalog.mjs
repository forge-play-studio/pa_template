/**
 * Rewrites the generated TypeScript catalog from the canonical manifest using
 * the playable SDK. This is intentionally the only local migration path for
 * generated fields such as `format`; never edit generated output by hand.
 */
import fs from 'node:fs/promises';
import {
  generatePlayableEditorAssetCatalogModule,
  loadPlayableEditorAssetManifest,
} from '@fps-games/editor/playable-sdk/vite';
import { projectAssetCatalogConfig } from './asset-registry/project-asset-catalog-config.mjs';

const manifest = await loadPlayableEditorAssetManifest(projectAssetCatalogConfig);
const moduleText = generatePlayableEditorAssetCatalogModule(manifest);
await fs.writeFile(projectAssetCatalogConfig.registryPath, moduleText);
console.log(`Regenerated ${projectAssetCatalogConfig.registryPath} from ${manifest.length} canonical asset entries.`);
