---
name: project-vfx-usage-mount
description: Add, list, validate, or remove project VFX mount usages by updating src/assets/vfx/usages.json through scripts/manage-vfx-usage.mjs.
---

# Project VFX Usage Mount Skill

Use this skill when the user asks to add, tune, list, validate, or delete a VFX mount in this project. The persisted artifact is `src/assets/vfx/usages.json`.

This skill manages VFX usage instances only. It must not delete scene nodes, meshes, runtime objects, effect package files, or effect default `vfx-params.json` files.

Run add/remove commands sequentially. Do not execute multiple writes to `src/assets/vfx/usages.json` in parallel, because each command reads the current file and then writes the full document.

## Ownership

- `src/assets/vfx/usages.json` owns project-level VFX mount instances.
- Each usage points at one effect and one mount target through `positionSource`.
- `positionSource.kind: "socket"` is for authored `effect-socket` scene nodes.
- `positionSource.kind: "node"` is for runtime scene nodes registered by code through `RuntimeNodeService`.
- Per-instance tuned params belong in `usage.params`.
- Per-instance local offsets belong in `usage.offset`.
- Effect package defaults stay in `src/assets/vfx/effects/<effectId>/vfx-params.json`.

## Commands

List current usages:

```bash
pnpm vfx:usage -- list
```

Validate `src/assets/vfx/usages.json`:

```bash
pnpm vfx:usage -- validate
```

Add an effect to an authored effect-socket:

```bash
pnpm vfx:usage -- add \
  --effect energy-shield \
  --socket marker-4 \
  --id marker-4-energy-shield \
  --label "Marker 4 / Energy Shield" \
  --lifecycle follow
```

Add an effect to a runtime node:

```bash
pnpm vfx:usage -- add \
  --effect thruster-flame \
  --node runtime_effect_host \
  --id runtime-effect-host-flame \
  --label "Runtime Host / Flame" \
  --lifecycle follow \
  --position "0,0,-1.1" \
  --no-validate-target
```

Delete a usage instance:

```bash
pnpm vfx:usage -- remove --id runtime-effect-host-flame
```

Dry-run before writing:

```bash
pnpm vfx:usage -- add --effect thruster-flame --node runtime_effect_host --dry-run --no-validate-target
```

## Options

- `--socket <nodeId>` creates `positionSource.kind: "socket"` and validates the node is an `effect-socket` when it can be found in `scene.json` or `editor-scene.json`.
- `--node <nodeId>` creates `positionSource.kind: "node"` for runtime nodes. Static validation is best effort because runtime nodes may be registered by code.
- `--id <usageId>` should be stable and descriptive. Without it, the script derives an id from `<nodeId>-<effectId>`.
- `--replace` updates an existing usage with the same id.
- `--position "x,y,z"`, `--rotation "x,y,z"`, and `--scale <number|"x,y,z">` write local offsets under the mount node. Rotation is stored in radians.
- `--params-json '{...}'` or `--params-file <path>` seeds `usage.params`.
- `--no-validate-target` bypasses static target validation only when the target is known to be created at runtime.
- `--allow-missing-effect` bypasses effect directory validation only when the effect package stub will be added separately.

## Verification

After adding or removing a usage, run:

```bash
jq empty src/assets/vfx/usages.json
pnpm vfx:usage -- validate
pnpm typecheck
```

Refresh the running preview after a usage add/remove. The runtime director imports `usages.json` as module data, so a browser refresh is the reliable way to see structural usage changes.
