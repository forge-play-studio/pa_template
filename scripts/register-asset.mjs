#!/usr/bin/env node

import { runAssetRegistryCli } from './asset-registry/core.mjs';
import { projectAssetCatalogConfig } from './asset-registry/project-asset-catalog-config.mjs';

await runAssetRegistryCli(projectAssetCatalogConfig);
