# record-replay -> pa_template 集成实施报告

Status: PASSED

Commit: `e466f38 feat(debug): add record replay integration`

## 改动文件清单

- `src/core/Game.ts`: 增加 frame counter、`stepFrame(dt)`、`setDtOverride()`、当前/上一帧 dt 读取、paused 状态读取、determinism context 注入。
- `src/core/determinism.ts`, `src/core/index.ts`: 增加 `createSeededRandom(seed)` / `DeterminismContext`。
- `src/services/InputService.ts`: 增加 `getMovementSource()` 和 `isEnabled()`，用于录制/回放后恢复项目自己的 movement source。
- `src/gameplay/types.ts`, `src/gameplay/ShadowFixtureAnimationModule.ts`: gameplay context 增加 determinism；ShadowFixture 默认使用 context random，保留 `options.random` 和无 context 时 `Math.random` 兼容。
- `src/debug/record-replay/schema.ts`: `DemoRecording` envelope、frame/event/visual 类型、schema 校验、input 归一化。
- `src/debug/record-replay/RecorderSource.ts`: movement source 装饰器，逐帧记录 input 和 Game 当前实际 dt，按 frame 去重。
- `src/debug/record-replay/ReplaySource.ts`: 按录制帧提供 replay input。
- `src/debug/record-replay/verify.ts`: player/input/snapshot L1 state hash、stable stringify、field diff。
- `src/debug/record-replay/self-test.ts`: dev browser selfTest，重启到干净初始态后录制 scripted drag，再重启回放并比对逐帧 hash/dt。
- `src/debug/example-drag-source.ts`: dev-only scripted movement source。
- `src/debug/runtime-record-replay-panel.ts`: Record Replay debug panel 和 `window.__rr` agent API。
- `src/debug/runtime-debug-bootstrap.ts`: 经 #143 后的 bootstrap 挂载 record-replay 面板；未直接改 `main.ts` 加 feature import。
- `scripts/check-production-debug-surface.mjs`: 新增 `__rr` / `runtime-record-replay-panel` / `record-replay` forbidden tokens。
- `scripts/check-record-replay-logic.mjs`, `package.json`: 新增 Node 逻辑检查脚本 `pnpm test:record-replay-logic`。
- `README.md`: 增加 Record Replay 使用说明、新项目接入 checklist、gameplay determinism contract。

## 与 plan 的偏离及原因

- `main.ts` 未改：当前分支已合入 #143，dev debug 入口已迁移到 `src/debug/runtime-debug-bootstrap.ts`。按当前代码改为在 bootstrap 中挂载 `mountRuntimeRecordReplayPanel()`。
- `dt` 未做 4 位小数压缩：input 仍做 4 位归一化，但 `dt` 保留录制时 Game 实际消费的有限数值。原因是参考实现明确踩坑：回放必须喂录制 dt；如果录制 hash 来自未 rounded dt 的 update，而回放喂 rounded dt，长录制会引入漂移。
- 增加了 `InputService.getMovementSource()` / `isEnabled()`：这是恢复原 movement source 和 state hash 覆盖 input enabled 所必需的薄接口，避免录制/回放结束后破坏项目自己的输入源。
- 增加了 `scripts/check-record-replay-logic.mjs`：仓里没有 vitest/tsx/ts-node，也没有 lint script；用本地 `tsc` 临时编译纯逻辑模块到 `/tmp` 后由 Node 断言 Recorder/Replay/schema 行为。
- L2 readPixels 只保留 `visual` schema 槽，未默认启用像素比对。plan 中 L2 为可选护栏，本次 v1 先完成 L1 state hash。

## 锚点差异记录

- Plan §1 的 `main.ts` dev import 锚点已过期。当前真实路径是 `src/main.ts` 动态 import `./debug/runtime-debug-bootstrap`，再由 `src/debug/runtime-debug-bootstrap.ts` 统一挂载 debug 面板。
- #143 "isolate debug preload tooling" 后，record-replay 必须经 bootstrap 挂载；本次只改 `runtime-debug-bootstrap.ts`，没有在 `main.ts` 增加 record-replay import。
- 生产剥离扫描仍在 `scripts/check-production-debug-surface.mjs`，已按当前脚本结构追加新 token。

## 自测结果

- 写入探针：`touch .codex-write-test && rm .codex-write-test` PASS。
- `pnpm typecheck` PASS。
- lint script：`package.json` 当前没有 lint script，未运行。
- `pnpm test:record-replay-logic` PASS，输出 `[check-record-replay-logic] OK`。
- `pnpm build:single` PASS；该命令内部已跑 typecheck、Vite production build、`check:prod-debug`。npm 输出了已有 unknown env config warnings，非失败。
- `pnpm check:prod-debug` PASS，输出 `[check-production-debug-surface] OK`。
- `rg -n "record-replay|__rr|runtime-record-replay-panel" dist` 无输出，exit code 1，表示 dist 内无命中。
- `git diff --check` PASS。

## 留给验收方的注意事项

- 启 dev server：在本 worktree 运行 `pnpm dev:editor-local`，默认 `0.0.0.0:3011 --strictPort`；或按需要运行 `pnpm dev -- --port <free-port>`。
- 页面加载并保持 visible 后，agent/console 可用：

```js
window.__rr.startRec({ label: 'demo' });
const rec = window.__rr.stopRec();
await window.__rr.replay(rec);
await window.__rr.stepTo(rec, 60);
await window.__rr.selfTest();
const json = window.__rr.export();
window.__rr.import(json);
```

- `window.__rr.replay(rec)` 默认会调用 `__restartProjectGame` 重启到干净初始态，然后 pause 并逐帧 `stepFrame(recordedDt)`；seed 或 `startStateHash` 不匹配会 loud fail。
- `window.__rr.selfTest()` 会重启两次：一次用于 scripted recording，一次用于 replay。它验证逐帧 state hash 和 recorded dt；本轮没有跑浏览器实机 T1/T3/T5，主会话可用该 API 做可视化验收。
- v1 只录 movement input；click/discrete events/world snapshot/存量项目 backport 均未做，`events` 字段仅保留 schema 槽。
