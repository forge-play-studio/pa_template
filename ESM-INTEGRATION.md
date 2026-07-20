# ESM Integration Guide

## Overview

This document explains how `pa_template` integrates with the `fps-game-editor` SDK and how the ESM (ECMAScript Modules) compatibility is maintained.

## One Package Contract

### SDK Development Mode

**Location**: `.local/pa_template` within the `fps-game-editor` repository

**Purpose**: Test and validate SDK changes during development

**Configuration**:
- `package.json` keeps an exact public package version:
  ```json
  {
    "@fps-games/editor": "0.1.8-beta.1"
  }
  ```
- `vite.config.ts` imports from the public API:
  ```typescript
  import { ... } from '@fps-games/editor/playable-sdk';
  ```
- The editor repository builds, packs, and installs the current package before starting Vite.

**How to run**:
```bash
# From fps-game-editor root
npm run dev:pa-template
```

### User Project Mode

**Location**: Copied out as a standalone project

**Purpose**: Real playable ad projects based on this template

**Configuration**:
- `package.json` uses version numbers:
  ```json
  {
    "@fps-games/editor": "0.1.8-beta.1"
  }
  ```
- `vite.config.ts` remains unchanged (uses public API)
- No `FPS_GAME_EDITOR_REPO` env var, so Vite uses bundled packages from `node_modules`

**How to run**:
```bash
npm install
npm run dev
```

## ESM Compatibility Solution

### The Problem

TypeScript with `moduleResolution: "Bundler"` compiles imports without `.js` extensions:
```typescript
// Source: import { foo } from './bar'
// Compiled: import { foo } from './bar'  ❌ Missing .js
```

Node.js ESM requires explicit extensions:
```typescript
import { foo } from './bar.js'  ✅
```

### The Solution

**Automated Post-Build Fix**: `scripts/fix-esm-imports.mjs`

This script runs after `tsc -b` and:
1. Finds all `.js` files in `packages/*/dist`
2. Detects relative imports (`./xxx` or `../xxx`)
3. Resolves whether the import points to a file or directory
4. Adds `.js` for files, `/index.js` for directories
5. Also fixes `@babylonjs/core` subpath imports

**Integration**:
```json
{
  "scripts": {
    "build": "tsc -b && node scripts/fix-esm-imports.mjs"
  }
}
```

### Why This Works

1. **SDK Development**: the locally packed package contains the current fixed dist files
2. **User Projects**: npm packages are published with fixed dist files
3. **vite.config.ts**: Uses public API path, which is properly exported
4. **Runtime Code**: Vite handles module resolution during bundling

## Decoupling Analysis

### ✅ Low Coupling (Good)

- **Runtime code** (22 files in `src/`) imports from `@fps-games/editor/playable-sdk`
- Uses documented public APIs
- Safe for SDK upgrades (semantic versioning)

### ✅ No Editor Coupling (Good)

- **vite-plugins/** directory has no editor SDK dependencies
- Portable and reusable

### ✅ Proper Coupling (By Design)

- **vite.config.ts** imports from `@fps-games/editor/playable-sdk`
- Uses stable public APIs for package resolution and authoring server
- No direct source imports (`../../packages/...`)

## Upgrade Path

When a new SDK version is released:

### For SDK Developers (pa_template in .local/)
```bash
# Automatic - always uses latest local build
npm run build
npm run dev:pa-template
```

### For User Projects
```bash
# Update package.json
npm install @fps-games/editor@0.1.8-beta.1

# Or use npm update
npm update @fps-games/editor
```

## Verification

To verify ESM compatibility:

```bash
# From the editor repository, build and install the local public tarball
npm run prepare:pa-template-packed-package

# From pa_template, verify the installed package matches that tarball
pnpm --ignore-workspace run test:editor-packed-package

# Start pa_template
npm run dev:pa-template
# Should start without ESM errors
```

## Troubleshooting

### Error: "Cannot find module './xxx'"

**Cause**: Missing `.js` extension in dist files

**Fix**: Run `npm run build` to trigger the fix-esm-imports script

### Error: "Cannot find module '@babylonjs/core/Engines/constants'"

**Cause**: `@babylonjs/core` subpath imports missing `.js`

**Fix**: The fix-esm-imports script now handles this automatically

### Error: "Port 3011 is already in use"

**Fix**: Kill the existing process:
```bash
lsof -ti:3011 | xargs kill -9
```

## Architecture Benefits

1. **Stable Routine Upgrades**: User projects use standard npm packages and the `@fps-games/editor/playable-sdk` facade
2. **Reliable Development**: SDK developers refresh one local tarball and exercise the public package contract
3. **Type Safety**: TypeScript paths work in both modes
4. **ESM Compliant**: All dist files work in Node.js ESM strict mode
5. **Maintainable**: Single source of truth for public APIs
