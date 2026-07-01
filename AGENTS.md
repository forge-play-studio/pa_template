# Agent Notes

`pa_template` 是 `fps-game-editor` 的真实 starter / integration baseline。新 playable ad 项目预期从这个模板出发，所以 editor contract、transform、hierarchy、asset、save、compiler 行为应优先在这里验证，再考虑历史 fixture。

资产系统职责现在以 `@fps-games/editor/playable-sdk` 为权威：hash / guid / assetId / manifest / generated catalog / metadata extraction / authoring asset endpoint / base scene compiler 都由 editor SDK 提供。`pa_template` 只保留路径配置、URL 映射、Vite host 装配、runtime wrapper 和 project companion config。不要在本仓库重新实现 registry 或 compiler 核心算法，也不要手写 generated catalog、manifest 或 runtime `scene.json` 来导入资产；需要改标准规则时先改 `fps-game-editor/packages/editor-playable-sdk`。

开发 `fps-game-editor` 源码时，优先使用 editor 仓库下的专用 `pa_template` git worktree：

```text
/path/to/fps-game-editor/.local/pa_template
```

从 `fps-game-editor` 根目录启动本地联调：

```bash
npm run dev:pa-template
```

该命令会设置 `FPS_GAME_EDITOR_REPO` 并启动本模板的 `dev:editor-local`。当 `FPS_GAME_EDITOR_REPO` 存在时，`vite.config.ts` 会把 `@fps-games/editor*` 包 alias 到 editor 仓库的 `packages/*/src`，包括 `@fps-games/editor-babylon/legacy-runtime`。

主 README 面向模板使用者，不要在里面加入大量 `fps-game-editor` 内部联调说明。维护者/agent 专用说明放在本文件，完整 runbook 放在 `fps-game-editor` 仓库。

如果这个 worktree 位于 `fps-game-editor` 下面，安装依赖时使用：

```bash
pnpm install --ignore-workspace --frozen-lockfile
```

直接运行 `pnpm install` 可能向上找到父级 `fps-game-editor` workspace。

保存测试可能修改：

```text
src/config/editor-scene.json
src/config/scene.json
```

除非任务明确要求更新模板基线场景，否则这些文件里的保存结果都应视为本地测试数据。
