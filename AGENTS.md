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

该命令会构建 editor、生成本地 tarball、把 packed `@fps-games/editor` 安装到本模板，再启动 `dev:editor-local`。不要添加 `FPS_GAME_EDITOR_REPO` 或 editor internal source aliases；reference consumer 必须验证真实 public package surface。

主 README 面向模板使用者，不要在里面加入大量 `fps-game-editor` 内部联调说明。维护者/agent 专用说明放在本文件，完整 runbook 放在 `fps-game-editor` 仓库。

## Runtime Debug Panel 规范

新项目从本模板启动后，AI 新增或修改 runtime debug 面板时必须遵守下面规则。README 的 `debug/` 章节是面向使用者的说明，本节是 agent 执行约束。

1. 统一入口：runtime debug UI 只能通过 `src/debug/debug-panel-layout.ts` 暴露的接口接入。标准面板使用 `mountRuntimeDebugPanel()`；外部 SDK 或复杂自绘容器使用 `mountRuntimeDebugPanelContainer()`；全局显隐使用 `installDebugPanelLayout()` / `readDebugHudVisible()`。
2. 不要自建 dock：不要在 feature、system、service、UI 或编辑器适配文件里自行创建 fixed 全局 dock、全局 Debug toggle、独立 z-index 层或散落按钮。不要恢复或复制历史 `runtime-debug-dock.ts`。
3. 面板位置：玩法、VFX、调参、diagnostics、quick action 面板默认注册到底部 dock；Camera / Lighting 这类 editor SDK 工具注册到 `right-rail`，按钮保持在右下角，面板打开时悬在按钮上方。
4. 视觉样式：debug 入口按钮的马卡龙配色、圆角、间距、打开状态和顺序由 `RuntimeDebugPanelManager` 管理。外部容器只提供稳定 `id`、`aria-label` / title 和内容，不要覆盖 manager 的按钮样式。
5. 阶段面板：builder 生成的 gameplay 阶段面板放在 `src/debug/runtime-<feature>-debug-panel.ts`，descriptor 注册到 `src/debug/panel-manifest.ts`，由 `src/debug/runtime-gameplay-debug-panels.ts` 统一 mount。
6. dev-only：debug 面板只能通过 `src/main.ts` 的 dev-only dynamic import 链路加载。production-owned 文件不得静态 import debug module 的值；正式 gameplay 逻辑不得依赖 debug-only API、DOM 或 `window.__paDebugActions`。
7. 职责边界：debug 面板只负责调参、diagnostics、preview、Reset、Save 和 quick action UI。业务规则留在 `systems/`、`services/` 或 `entities/`；quick action 调正式 runtime API 或 dev-only `RuntimeDebugActionRegistry` action。
8. 数值调参：numeric tuning 必须 live preview；可持久化数值必须 Save 回 checked-in source config，默认优先 `src/config/gameplay.json`，不能把 gameplay tuning 持久化到 browser storage。

## 3D Runtime Inspector 规范

`src/debug/runtime-inspector/` 是 `window.__fp3d` 的游戏内模板实现；外部契约、case、oracle 和 runner 在 `fps-3d-harness`。新增或修改该能力时必须遵守：

1. **模板承载通用 core**：identity、stable handle、query、inspect、relations、CameraLease/focus/occlusion/visibility-patch/restore、Babylon adapter、provider registry 和 production stripping 落在本仓。真实项目里跑通的通用修改要当轮回拉本目录。
2. **项目只注册事实**：逻辑 ID、camera owner、VFX registry、marker/socket 等通过 provider/adapter 显式注册；core 不扫描具体 gameplay system 名称，也不猜项目字段。
3. **禁止 name 单选**：name 只用于 query 和展示。不能用 `getMeshByName()` / `getTransformNodeByName()` 静默选择第一个对象；跨调用必须使用带 runtime/scene/object generation 的 handle。
4. **观测必须声明覆盖**：所有结果带 `coverage.observed` / `coverage.unavailable`。未接 provider、节点类型不支持或 effect 未激活时要明确 unavailable，不能返回空值后声称没有变化。
5. **控制必须可恢复**：camera/patch/watch 能力必须通过 lease/transaction/ProbeManager 管理；相机与 visibility patch 必须覆盖显式、超时、pagehide、dispose 和 `beforeSceneChange()` 恢复，不能留下 observer、RAF loop、monkey patch 或场景修改。visibility patch 不得通过共享材质变更实现 ghost。
6. **页面与 Scene 生命周期分离**：inspector 由 `src/main.ts` 独立挂载并跟随 page document，debug panels 跟随 Game；无刷新换 Game/Scene 前必须先调用 `beforeSceneChange()`。同一 runtime 内 scene generation 必须前进，旧 handle 返回 `SCENE_MISMATCH`。
7. **严格 dev-only**：只从 `src/main.ts` 的 DEV dynamic import 链加载；production gameplay 不得依赖 `window.__fp3d`。每次新增 token 都同步 `check-production-debug-surface.mjs`。
8. **跨仓同步验收**：API/schema 变更同时更新 `fps-3d-harness/docs/07-runtime-perception-control.md`、schema 和 conformance case；模板 typecheck/logic/build 通过不等于外部契约通过。
9. **范围隔离**：本能力不包含性能运行时计数或 Performance Provider，也不修改人类示教/record-replay 模块。

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
