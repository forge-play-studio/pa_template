# pa_template Distribution Guide

## Goal

`pa_template` should behave like a normal playable project:

- Install one public editor package: `@fps-games/editor`.
- Import editor integration contracts from `@fps-games/editor/playable-sdk`.
- Keep project-owned gameplay, compiler, assets, Babylon runtime services, and debug DOM panels in the project.
- Avoid direct project dependencies on editor internal packages such as `@fps-games/editor-core`, `@fps-games/editor-babylon`, or `@fps-games/babylon-renderer`.

The local lab branch may use source aliases for SDK development, but those aliases are development tooling only. They are not part of the distributed project contract.

## Modes

### Mode 1: Managed SDK Development

Used by this repository through `.local/pa_template`.

`package.json` keeps only the public editor dependency:

```json
{
  "dependencies": {
    "@fps-games/editor": "link:../../packages/editor"
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

`tsconfig.fps-editor-local.json` is the focused local-source verification config. It may point editor internal package ids at `../../packages/*/src` so the lab can typecheck against the current source tree. This file is not a template distribution contract.

### Mode 2: Standalone Project

Used by real projects copied from `pa_template`.

Use a versioned public dependency:

```json
{
  "dependencies": {
    "@fps-games/editor": "^0.1.3-beta.4"
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
2. Keep imports on the new local editor path limited to `@fps-games/editor/playable-sdk`.
3. Remove `tsconfig.fps-editor-local.json` unless the project intentionally participates in source-linked SDK development.
4. Ensure normal `tsconfig.json` does not point to `../../packages/*` or nested `node_modules/@fps-games/editor/node_modules/*`.
5. Keep legacy `src/fps-game-editor-adapter/runtime.ts` disabled unless a compatibility build explicitly opts into `VITE_ENABLE_LEGACY_RUNTIME_EDITOR=true`.

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

For source-linked SDK development only:

```bash
pnpm exec tsc -p tsconfig.fps-editor-local.json --noEmit
```

## Common Issues

### `Cannot find module '@fps-games/babylon-renderer'`

Project code should not import this package directly. Use `@fps-games/editor/playable-sdk` facade exports or keep the Babylon/runtime-specific implementation inside project runtime services.

### `@fps-games/editor/playable-sdk` cannot be resolved

Install a package version that exposes the `./playable-sdk` export, or use `FPS_GAME_EDITOR_REPO` source-link mode during local SDK development.

### Legacy runtime bridge activates unexpectedly

The legacy runtime bridge should only be enabled through:

```bash
VITE_ENABLE_LEGACY_RUNTIME_EDITOR=true
```

New local editor integration should use `createPlayableLocalEditorHost()` from `@fps-games/editor/playable-sdk`.
