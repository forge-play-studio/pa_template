#!/usr/bin/env node

/**
 * Thin asset registry CLI wrapper.
 * Last updated: 2026-07-05.
 *
 * Keep this file as the stable npm-script entry point. The registry workflow,
 * SDK facade lives in `@fps-games/editor/playable-sdk/vite`; pa_template only
 * supplies project catalog config under `scripts/asset-registry`.
 */
import { runPlayableEditorAssetRegistryCli as runAssetRegistryCli } from '@fps-games/editor/playable-sdk/vite';
import { projectAssetCatalogConfig } from './asset-registry/project-asset-catalog-config.mjs';

await runAssetRegistryCli(projectAssetCatalogConfig);
