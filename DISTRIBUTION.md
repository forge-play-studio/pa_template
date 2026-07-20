# pa_template Distribution Guide

## Goal

`pa_template` should behave like a normal playable project:

- Install one public editor package: `@fps-games/editor`.
- Import editor integration contracts from `@fps-games/editor/playable-sdk`.
- Keep project-owned gameplay, compiler, assets, Babylon runtime services, and debug DOM panels in the project.
- Avoid direct project dependencies on editor internal packages such as `@fps-games/editor-core`, `@fps-games/editor-babylon`, or `@fps-games/babylon-renderer`.

The local lab consumes a locally packed `@fps-games/editor` tarball so development and distribution exercise the same public package contract.

## Modes

### Mode 1: Managed SDK Development

Used by this repository through `.local/pa_template`.

`package.json` keeps only the exact public editor dependency:

```json
{
  "dependencies": {
    "@fps-games/editor": "0.1.8-beta.1"
  }
}
```

The normal `tsconfig.json` should only keep project-local aliases. Do not add a
path mapping for `@fps-games/editor/playable-sdk`; TypeScript should resolve it
through the package export from `@fps-games/editor`.

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

The editor repository prepares a local tarball and installs it into this worktree before local development. Do not add a source-only tsconfig or editor-internal path mappings; package smoke and normal typecheck must observe the same exported declarations.

### Mode 2: Standalone Project

Used by real projects copied from `pa_template`.

Use a versioned public dependency:

```json
{
  "dependencies": {
    "@fps-games/editor": "0.1.8-beta.1"
  }
}
```

Do not add direct dependencies or TypeScript paths for:

- `@fps-games/babylon-renderer`
- `@fps-games/editor-core`
- `@fps-games/editor-babylon`
- `@fps-games/editor-browser`
- `@fps-games/editor-forge-play`
- `@fps-games/editor-protocol`

Those are editor package implementation details. If project code needs a stable editor contract, expose it through `@fps-games/editor/playable-sdk` first.

## Conversion Checklist

When preparing a standalone project:

1. Replace any local editor link with a versioned `@fps-games/editor`.
2. Use `@fps-games/editor/playable-sdk` for runtime code,
   `@fps-games/editor/playable-sdk/vite` for Vite integration, and the Node-only
   `@fps-games/editor/playable-sdk/upgrade-doctor` only from root project scripts.
3. Keep editor-internal TypeScript path aliases out of the project.
4. Ensure normal `tsconfig.json` does not point to `../../packages/*` or nested `node_modules/@fps-games/editor/node_modules/*`.
5. Do not restore the retired legacy runtime bridge; editor integration should use the productized SDK host/config APIs.

## Verification

In the `fps-game-editor` repository:

```bash
npm run check:reference-consumer
npm run check:package-consumer
npm run pack:dry-run
```

In the project:

```bash
pnpm exec tsc --noEmit
pnpm run build
```

For local SDK development, rebuild and install the real packed package baseline:

```bash
pnpm run prepare:editor-packed-package
pnpm run test:editor-packed-package
pnpm run typecheck
```
## Common Issues

### `Cannot find module '@fps-games/babylon-renderer'`

Project code should not import this package directly. Use `@fps-games/editor/playable-sdk` facade exports or keep the Babylon/runtime-specific implementation inside project runtime services.

### `@fps-games/editor/playable-sdk` cannot be resolved

Install a package version that exposes the `./playable-sdk` export. In the companion worktree, rerun `npm run prepare:pa-template-packed-package` from the editor repository to refresh the local package.

### Legacy runtime bridge imports are missing

That is expected. The project-side legacy runtime bridge has been retired. Use
the productized `defineFpsGameEditorProject()` / `createFpsGameEditorAdapter()`
path from `@fps-games/editor/playable-sdk`.
