# pa_template

这是 PA 项目的独立模板仓库。

当前模板内容直接位于仓库根目录。
如果后续要从这里起新 playable ad 项目，可以直接复制整个 `pa_template` 仓库作为项目起点。

## 目标

1. 作为新项目起点
2. 默认接入当前平台 `bridge/editor`
3. 默认接入 `@fps-games/editor` 本地编辑器模式
4. 默认提供 GUID asset catalog / canonical asset adapter / scene authoring 主链

注意：

- 这不等于新项目已经完成具体 gameplay、素材和平台 workspace 最终验收
- 新项目仍需要按自己的玩法、资源和平台环境完成验收

## 当前包含

1. Babylon/Vite 项目骨架
2. Vite 应用壳层（`index.html`）
3. 最小 `scene.json` 与 `ConfigService`
4. Gameplay Binding contract 类型、默认入口、查询服务和基础校验
5. Project gameplay composition hook：`src/gameplay/createProjectGameplay.ts`
6. 项目侧 `src/fps-game-editor-adapter`
7. dev-only `src/debug/local-editor-mode-switcher.ts`
8. GUID asset catalog 与 `src/assets/imported` 资产落地目录
9. document/history/export/commit 主链
10. `sceneNode` adapter 与 duplicate 主链
11. 新项目尽早验证编辑器闭环所需的基础结构
12. 默认 Vite plugin 初始化链：`bridge / inspector / glb / modelCache / stripBabylon / locale / analytics / molocoCta / viteSingleFile / optimizePng / gzipBundle`
13. 可直接启用的构建增强插件：`thirdPartyWhitelist / visualizer`
14. `ZoneSystem`：消费当前 `SceneConfig` 中的 `gameplay.zones`，并维护 enter/tick/leave 区域状态
15. 标准 first playable gameplay 骨架：3C、Resources、Backpack、Area、Queue、Economy、Upgrade、Guide、EndCondition
16. dev-only runtime debug bootstrap：`src/debug/runtime-debug-bootstrap.ts`，统一挂载模板基础调试工具和玩法阶段面板
17. 默认运行时节点查询封装：`RuntimeNodeService`，用于从 gameplay binding / scene node 稳定拿 runtime node
18. 默认 debug 面板基础设施：`src/debug/framework/*`、`src/debug/panel-manifest.ts` 和 `src/debug/runtime-gameplay-debug-panels.ts`
19. 默认 loading 链路：`Game.init` 在 gameplay modules 初始化前 preload `scene.assets`，按 `warmupCount` 通过 `ModelPool` 做 runtime asset warmup，并在 loading 结束前按 VFX registry / `assets/vfx/usages.json` 预热可 spawn 的特效首用路径
20. 基础输入抽象：`InputService` / `MovementInputSource`，供项目按 `gameplay.md` 接入 joystick、键盘、点击移动或其他控制 UI

当前不应默认假设已经完整包含：

1. platform workspace 页面上的最终验收结果
2. 所有项目零改造即可直接跑通的最终平台接入

换句话说，`pa_template` 当前提供的是“带本地编辑器和 canonical asset 边界的项目模板”，不是“所有项目复制后零改造即可直接上线”的成品项目。
新项目复制后，仍需要按自己的 gameplay、资源和平台环境完成验收。

## 目录结构

模板根目录就是 Vite/Babylon 项目根：

1. `index.html`
2. `package.json`
3. `vite.config.ts`
4. `vite-plugins/`
5. `src/`

其中 `src/` 放项目 runtime 与项目侧编辑器接入代码，`vite-plugins/` 放平台桥接、inspector 注入、模型缓存、单文件构建等构建插件。

## 团队级文档

`pa_template` 不再保留 `docs/` 目录。团队级 First Playable Workflow、Gameplay Object / Binding / Naming 标准、Readiness 和 Acceptance 模板统一维护在 `wiki/sources/docs`：

1. [First Playable Workflow](https://github.com/forge-play-studio/wiki/blob/main/sources/docs/guides/gameplay/FIRST_PLAYABLE_WORKFLOW.md)
2. [Gameplay docs index](https://github.com/forge-play-studio/wiki/blob/main/sources/docs/guides/gameplay/README.md)
3. [Gameplay Object Standard](https://github.com/forge-play-studio/wiki/blob/main/sources/docs/standards/GAMEPLAY_OBJECT_STANDARD.md)
4. [Gameplay Binding Standard](https://github.com/forge-play-studio/wiki/blob/main/sources/docs/standards/GAMEPLAY_BINDING_STANDARD.md)
5. [pa_template docs archive](https://github.com/forge-play-studio/wiki/tree/main/sources/docs/templates/pa_template)

流程 0 完成后，新项目才能进入流程 1。模板现在默认提供标准 first playable gameplay 骨架，但这些系统只承载薄 owner、通用状态、接口、配置入口和最小可运行链路；具体资源类型、区域业务、背包装填、售卖结算、升级支付、引导选择、结束条件、表现动画和项目规则都需要由项目按 `gameplay.md`、wiki ability 或用户要求补齐。

## PA gameplay 合同规则

新项目的 first playable 开发以项目根目录 `gameplay.md` 为权威合同。`pa_template` 提供默认系统、服务和 loading 链路；具体玩法状态、binding、动态资产和验收仍必须由项目文档确认。

### Gameplay State / Core Loop State

`GameplayStateSystem` 是模板默认的游戏流程状态真源。`UpgradeSystem` 只保留升级声明和完成状态入口；升级支付、进度、完成触发和完成后具体发生什么必须来自 `gameplay.md` 的 Upgrade Completion Effects 合同，并由 builder 按 wiki / 项目需求实现。升级完成后导致的阶段变化、里程碑、解锁、blocker、引导目标变化和结束条件，应写入或读取 `GameplayStateSystem` 或项目等价系统。

不要把游戏流程状态散落在 UI、debug 面板、`QueueSystem`、`GuideSystem` 或多个项目脚本里。玩家背包、经济、队列、升级和引导的具体规则从对应 wiki ability / 阶段标准生成；模板内同名 system 只是默认 owner 和接线位置，不代表已实现该能力。

### Config Discipline / No Hardcoded Gameplay Numbers

所有 gameplay、balance 和 presentation tuning 数值必须进入 checked-in authored config，再由 runtime typed adapter 消费。`pa_template` 默认使用 `src/config/gameplay.json` 作为 first playable 的配置真源，`src/config/projectGameplayConfig.ts` 只负责类型定义和 runtime adapter。

必须放进 config 的常见值包括：容量、价格、奖励、速度、距离、半径、阈值、间隔、持续时间、spacing、offset、scale、概率、倍率、阶段条件、相机参数、背包堆叠参数、区域摆放参数、队列参数、升级参数、引导参数、飞行动效参数、音效和 VFX 调参。代码中只允许保留 `0` / `1` / `-1`、数组下标、循环步进、数学换算、API 技术参数或短生命周期计算中间值这类不承载玩法调参意义的实现常量。

`gameplay-builder` 开发任何阶段前都应建立 Config Surface Audit：列出本阶段新增或修改的数值、稳定 id、source config path、runtime reader、debug live preview / Save 路径和 hardcode 状态。缺少关键数值、单位、范围或平衡意图时，先报告 Gameplay Doc Gap；不要把默认值藏在系统、实体、UI、debug 面板或服务代码里。

### Upgrade Completion Effects

`pa_template` 不默认提供固定的 `LumberSceneVisibilitySystem`、`UnlockVisibilitySystem` 或项目专属解锁系统。每个项目必须在 `gameplay.md` 中说明每个升级完成后的具体效果；没有某类效果时应写 `None`，builder 不应从参考项目、scene node 名称或模板默认行为中猜测。

常见升级完成效果包括：

1. 标记 gameplay state / milestone。
2. 显示、隐藏、启用或禁用 scene node / scene group。
3. 开放或关闭 area、pay area、queue、machine、resource chain。
4. 改变容量、速度、产量、范围、价格或冷却。
5. 改变 Guide 目标。
6. 改变 EndCondition。
7. 播放 required presentation，例如 VFX、镜头、动画或音效。

`UpgradeSystem` 默认只负责保存升级声明、暴露完成状态入口并写入 completed upgrade / milestone。支付、进度、完成触发、场景显隐、区域开放、资源链变化、容量 / 速度 / 产量变化、Guide 变化、EndCondition 变化和 required presentation 应由 `gameplay.md` 指定 owner system，再由项目侧 system、service 或 view 承接。

### Binding Contract

场景节点和美术资产绑定由用户通过 gameplay 文档 AI 确认，并写入 `gameplay.md` 的 Binding Contract。`gameplay-builder` 负责消费该合同，把确认过的 binding 落到项目配置，使用 `GameplayBindingService` / `RuntimeNodeService` 查询，并输出 readiness gap。

builder 不应自行决定某个相似 scene node、decoration 或 asset 就是目标绑定；缺失或模糊时应报告 Binding Gap，让用户或文档 AI 补齐。

### Runtime Asset Contract / Loading

所有运行时动态生成、clone、pool、飞行、堆叠、区域摆放、场景资源堆叠、奖励掉落或重复出现的可见对象，都应在 `gameplay.md` 的 Runtime Asset Contract 中声明。常见对象包括队列 NPC / vehicle、玩家背包可视化资源模型、非玩家 actor / worker / vehicle carry 模型、资源飞行动效对象、区域摆放物、depot / 货架 / 机器输出 / 现金堆 / 车辆货斗等场景资源堆叠模型、现金掉落、worker / automation actor 和 VFX 模型。

项目实现时应把这些 runtime asset 加入 `scene.assets` 或项目等价 asset config。模板当前 loading 顺序是：

```text
LoadingScreen 显示
-> Game.init
-> AssetLoader preload scene.assets
-> SceneBuilder 构建场景
-> ModelPool 按 warmupCount warmup
-> gameplay modules init
-> VFX registry/usages 首用预热
-> LoadingScreen 隐藏
```

因此，QueueSystem、BackpackSystem、AreaSystem、ResourcesSystem 等业务系统不应临时拼路径加载模型来绕过 loading；VFX 调用也应优先通过项目 VFX registry / usages 接入，让模板 loading 阶段能覆盖首用预热。缺少 asset id/file、loading path、runtime parent/spawn root、placement root、layout、VFX usage 或 warmup/max-active 假设时，先按 Asset Gap 或 Gameplay Doc Gap 处理。

### Analytics / CTA Contract

模板默认提供与已落地 PA 项目一致的埋点和 CTA 行为。具体项目只需要在真实玩法节点里调用对应接口；不同项目的商店链接通过 `scene.json.meta.playableAdInfo.ctaUrl` 配置。

模板已接入的通用生命周期：

1. `reportInitPlayable()`：入口初始化开始。
2. `reportLoaded()`：`Game.init()` 完成。
3. `reportDisplay()`：loading 隐藏并启动渲染后的下一帧；同一帧上报 `challenge_progress` 的 `progress: 0`。
4. `reportCompleted()`：`beforeunload` / `pagehide` 兜底。

模板提供的项目侧接口：

1. `context.analytics.reportProgressMilestone(progress)`：发送 `challenge_progress`，内部去重。具体 `25/50/75/100` 对应哪个玩法节点由项目实现决定。
2. `context.analytics.reportEndCardShown()`：发送 `onShowEndCard`，内部去重。
3. `context.cta.handleCtaClick(source)`：`source === 'fail'` 时先 `onRetry()`，随后 `onInstall('Global')` 并打开 CTA。
4. `context.cta.openCtaUrlInNewPage()`：结束页展示后的自动跳转；`CHANNEL=unity` 时不自动跳转。

CTA 链接默认读取 `scene.json.meta.playableAdInfo.ctaUrl`。打开顺序统一为 `super_html.download` -> `mraid.open` -> `window.open('_blank')` -> `location.href`。按钮点击不拦 `unity`，只有结束页自动跳转路径拦 `unity`。

### Build Matrix Contract

模板默认提供与已落地 PA 项目一致的多渠道打包入口。`package.json` 的 `appConfig` 控制语言版本、tracked / untracked 渠道列表、analytics 初始化字段和产物命名字段。

默认命令：

1. `npm run build`：构建 `EN + applovin` 的有埋点和无埋点版本。
2. `npm run build:all`：按 `appConfig.i18n.buildVersions` 构建全部语言和全部渠道矩阵。
3. `npm run build:single`：只做普通单产物构建，输出到 `dist/index.html`。
4. `npm run build:scene-walkthrough`：只用于场景地编巡查，输出到 `dist/scene-walkthrough/index.html`。该包启用 WASD 驱动模板 `SimplePlayer`，由相机跟随观察场景；常规 `dev`、`build` 和 `build:single` 都不会挂载或打入该控制路径。

矩阵构建输出到 `dist/<LOCALE>/tracked` 和 `dist/<LOCALE>/untracked`。`TRACKING=false` 时不会注入 analytics SDK；Moloco 渠道会额外注入与落地项目一致的 CTA shim。

## `src/` 目录说明

当前 `src/` 下固定包含这些目录：

### `assets/`

放项目使用的所有美术和声音资产，以及对应的资源入口。

适合放：

1. 图片
2. 2D 贴图
3. 3D 模型
4. 音频资源
5. 占位资源
6. 资源导出入口

### `config/`

放项目配置和配置访问层。

适合放：

1. `scene.json`
2. 其他 JSON 配置
3. 配置类型定义
4. `ConfigService`

这层保留模板默认需要的基础配置。当前默认包含：

1. 场景配置
2. 基础游戏配置
3. `gameplay.gameplayBindings` contract 入口
4. 基于 `gameplay.zones` 的 zone runtime 配置
5. `gameplay.json`：标准 first playable 系统的资源、背包、区域、队列、升级、引导、结束条件和 tuning source of truth；其中 `flightTuning` 是项目道具飞行调参的默认 Save 落点
6. `projectGameplayConfig.ts`：`gameplay.json` 的类型定义和 runtime typed adapter
7. `projectFlightTuning.ts`：道具飞行调参读取、缺失报错和 dev-only runtime preview helper，供项目 system 和 debug 面板共用
8. `scene.assets`：runtime asset 的 asset id / url / type / warmupCount 入口，供 loading preload 和 `ModelPool` warmup 使用

zone 检测能力默认内置，但只负责矩形区域几何检测和 `enter/tick/leave` 事件分发。区域上的付款、升级、售卖、背包、经济、解锁等规则由对应 project gameplay system 承接。ground UI、资源飞行、堆放动画等表现能力仍按项目或 ability 接入。

#### Zone 存储结构

每个 zone 默认存储在 `gameplay.zones`。模板初始化时由 `Game` 把当前 `SceneConfig` 显式传给 `ZoneSystem`；ZoneSystem 不从 `gameplayBindings` 派生区域。

```json
{
  "gameplay": {
    "zones": [
      {
        "id": "pay_area_unlock_forest",
        "location": { "x": 2, "z": 1 },
        "size": { "width": 2, "depth": 1.5 },
        "rotationDeg": 0,
        "meta": "玩家站在这里时，由项目业务系统处理解锁森林的资源提交。"
      }
    ]
  }
}
```

字段分工：

1. `id` 是 zone runtime id。
2. `location.x/z` 是矩形中心点。
3. `size.width/depth` 是矩形区域尺寸。
4. `rotationDeg` 是区域绕 Y 轴的旋转角度，单位为度。
5. `meta` 只放说明性文字，方便 AI 和开发者理解区域用途；ZoneSystem 不解释它。

### `core/`

放 runtime 总控。

当前主要是：

1. `Game`

它负责：

1. 创建和连接各模块
2. 驱动主循环
3. 提供运行时接入点
4. 强制固定使用 Babylon 右手坐标系

这不是可选项，强烈建议不要修改。

原因：

1. `glb/glTF` 资产链路默认遵循右手坐标系
2. 项目会直接使用 `glb` 模型
3. 如果改成左手系，模型朝向、旋转、变换和后续能力接入都会变复杂
4. 编辑器、运行时节点、模型资源三者统一使用一套坐标规则，更稳定

### `fps-game-editor-adapter/`

放项目侧编辑器能力和对 `@fps-games/editor` 暴露的接口。

适合放：

1. document
2. canonical asset adapter
3. editor scene compiler / session
4. editor plugin / runtime bridge
5. export / commit / duplicate / undo / redo 主链

### `debug/`

放 dev-only 调试入口、调参面板、runtime diagnostics、quick action 面板和源码配置保存辅助。

当前默认包含：

1. `camera-debug-panel.ts`：编辑器相机 runtime 调试面板。
2. `runtime-lighting-debug-panel.ts`：编辑器灯光 runtime 调试面板。
3. `local-editor-mode-switcher.ts`：本地编辑器/游戏模式切换入口。
4. `runtime-debug-bootstrap.ts`：dev-only debug 总入口；只由 `src/main.ts` 的 dev dynamic import 加载。
5. `framework/`：debug 面板基础能力，包括统一 panel manager、controls、config client、overlay、action registry 和 disposable helpers。
6. `panel-manifest.ts`：玩法阶段面板注册 manifest。模板默认不注册具体玩法面板，builder 按阶段生成。
7. `runtime-gameplay-debug-panels.ts`：读取 panel manifest 并通过统一 manager mount 玩法阶段 debug 面板。

runtime debug UI 由 `src/debug/framework/panel-manager.ts` 统一管理。全局 Debug 显隐、底部 dock、右侧 rail、面板顺序、折叠状态、底部面板独立打开状态和 `RuntimeDebugActionRegistry` 生命周期都由 manager 持有；新面板不应自行创建 fixed 全局 dock、全局 toggle 或独立 z-index 层。标准面板使用 `mountRuntimeDebugPanel()` 创建；外部 SDK 或复杂自绘面板使用 `mountRuntimeDebugPanelContainer()` 注册容器，由 manager 接管布局、顺序、显隐和入口按钮样式。Camera / Lighting 这类 editor SDK 面板挂入右侧 rail，VFX 和玩法阶段面板挂入底部 dock。debug 面板入口按钮统一使用按面板标题稳定 hash 的马卡龙色；底部 dock 面板点击按钮打开或关闭对应面板内容，外部 editor SDK 容器按钮由 manager 做布局和样式适配。`src/debug/` 之外需要 debug 面板能力时，不应直接创建 DOM 面板，应通过 `src/debug/debug-panel-layout.ts` 暴露的统一接口接入。

具体玩法阶段的 debug 面板不在模板里默认写死。开发 Ready phase 时，builder 应按项目 `gameplay.md` 的 `Debug & Tuning` 合同，先使用 `debug-panel` skill，再在 `src/debug/runtime-<feature>-debug-panel.ts` 生成面板，并把 descriptor 注册到 `src/debug/panel-manifest.ts`。

阶段 debug coverage 应默认来自 wiki ability / 阶段标准，而不是要求用户设计调试按钮。builder 应根据项目 `gameplay.md` 中的玩法事实、binding、asset 和 owner system 自动生成标准面板项；用户只需要确认玩法事实和默认面板之外的项目专属表现或调试修改需求。Phase 2 Backpack 项目应按 `backpack-system` 默认 debug coverage 生成玩家背包数据、容量、可视化堆叠、endpoint preview 和 fill / clear actions；只有 `gameplay.md` 明确声明非玩家 actor carry 时，才按 `actor-carry-stack` 生成对应 debug coverage。Phase 4 Queue + Economy 项目应按 `customer-queue`、`sell-system`、`basic-economy` 和相关 visual ability 的默认 debug coverage 生成队列拓扑、成员状态、订单进度、付款结算、经济/HUD 读数和 quick actions。

当项目实现 item flight、resource flight、payment flight、money stack collect flight 或 upgrade pay flight 时，`runtime-flight-debug-panel.ts` 或项目等价面板是该飞行功能的默认随附交付。用户不需要命名 `effectId` 或理解飞行算法；builder 根据 `gameplay.md` 的 Flight Tuning Contract 自动生成不重复的 effect id，参数写入 `src/config/gameplay.json` 的 `flightTuning` 或项目等价源码配置，运行系统通过 `projectFlightTuning.ts` 读取，debug 面板提供 live preview、Reset 和 Save。

Pure presentation debug 默认不阻塞 core gameplay。模板默认内置通用 audio debug 面板，用于调 `src/config/gameplay.json` 的 audio 参数；lighting / VFX 等现有面板是编辑器或模板工具，不代表所有 PA gameplay 都 required。water、shadow、halo、material、animation、camera sequence 或地贴排序等表现面板只有在 `gameplay.md` 写成 required presentation，或用户明确要求还原参考项目表现时，builder 才按 `debug-panel` skill 和项目 presentation pattern 生成。即使表现面板 required，用户也只确认表现目标、asset / binding、验收观感和特殊修改需求，不逐项设计标准 controls。

debug 面板职责边界：

1. 面板只负责调参、诊断、preview、Reset、Save 和 quick action UI。
2. 业务规则留在对应 `systems/`、`services/` 或 `entities/`。
3. quick action 通过 dev-only `RuntimeDebugActionRegistry` 或正式 system/service runtime API 调用，不在面板里复制玩法逻辑。
4. numeric tuning 的持久化应写回源码配置。当前 dev server 已提供 `/__debug_panel_config`，允许读写 `src/config/*.json`；标准 gameplay tuning 默认写回 `src/config/gameplay.json`。
5. 面板必须由 `src/main.ts` 的 dev-only dynamic import 链路加载，不要在 production-owned 文件里静态 import debug module 的值。
6. production / package build 不得 mount runtime debug panel、注册 `window.__paDebugActions`、暴露 debug HUD / tuning UI，正式 gameplay 逻辑也不得依赖 debug-only API。

#### Record Replay

模板在 dev 模式默认挂载 `Record Replay` debug 面板，并暴露 `window.__rr` 给 agent 或浏览器控制台使用。production build 会通过 `check:prod-debug` 校验，不允许 `record-replay`、`__rr`、`__demoRec`、`tape-sink` 等 token 进入 `dist/`。

方法论与判读契约在 `fps-3d-harness/docs/06-record-replay-dual-mode.md`（本节只讲模板怎么用）。

##### 两种回放

- **Mode A（逐帧）**：按录制 dt 逐帧 `stepFrame()`，比对每帧 state hash。它是**诊断仪器与回归探测器，不是准入门槛**——新游戏必有未收编的非确定源。输出 `firstDivergence = N` 即「前 N 帧逐帧可信」（determinism horizon）。
- **Mode B（语义）**：沿录制航迹跟踪 + 里程碑闭环推进。业务真正的达标线。

##### 常用 API

1. `window.__rr.startRec()` / `stopRec('label')`：录制。dense 记录输入、实际消费的 `dt`、state hash、稀疏 `stateSamples`、玩家 `trail`，以及**逐帧跑 detector 得到的 `events`**。
   - `stateSamples` 每 60 帧一份；一个完整发生在两次采样之间的 `false → true → false`（短命事件）**只有 `events` 看得见**。语义提取优先用 `events`，老 tape 没有它才退回基于采样的提取。
   - 录制超过 `maxFrames` 会环形丢弃最早的帧，此时 `envelope.truncated = true`：**Mode A 直接拒绝**（起点已不在 tape 里，逐帧比对必然从第 0 帧就发散），Mode B 仍可用但会带一条 warning。
2. `window.__rr.peekRec(fromIndex)`：非破坏性增量读取，录制生命线用它做增量落盘。
3. `await window.__rr.replay(recording)`：Mode A。
4. `window.__rr.extractSemantic(recording)` / `await window.__rr.semanticReplay(script, opts)`：Mode B。
5. `await window.__rr.semanticReplayMajority(script, opts)`：**双跑定档**；档位分裂自动第三跑取多数，抖动结果标 `flaky`。
6. `await window.__rr.runBenchmark(opts)` / `runBenchmarkMajority(opts)`：语义回放 + 性能采样。
7. `await window.__rr.replayValidateSamples()`、`reconstructTrail()`、`playback()`、`stepTo(rec, n)`、`selfTest()`、`export()` / `import(json)`。

##### 读 verdict：四档 grade

`SemanticVerdict` 保留原有的 `ok` / `quality`，另加一维 `grade`：

| grade | 判据 | 用途门槛 |
|---|---|---|
| `clean` | 全部里程碑 matched + 无 extra 终局态 + 经济全过 + 零绕路 + **至少 1 个 critical 里程碑** | 正本基线 / 素材生成 |
| `good` | critical 全中，optional 缺失 ≤ 20%，无 terminal divergence | 回归门禁默认门槛 |
| `degraded` | critical 全中，但绕路/重试显著、经济超容差、或 stage 没走完 | 冒烟可接受，提示排查 |
| `failed` | critical 缺失 / terminal divergence / 标定失败 / 空剧本拒绝 | 真失败 |

- **登记基线的必要条件是 `grade ≥ good`**；判档细节读 `verdict.grading.reason`。
- 一条**不断言任何 critical 里程碑**的剧本（纯导航 tape）最高只能拿 `good` —— 它的 clean 判据全是空真，不能当正本基线。
- 传 `semanticReplay(script, { determinismHorizon })`（帧号或 `'green-full'`）会得到 `verdict.determinism`：失败点落在 horizon 内 = 高置信真失败；落在 horizon 外 = 先怀疑世界漂移，回头跑 Mode A 定性。不传则该字段为 `null`。

##### 录制生命线（真人示教）

`?rrAutoStart=1` 进入真人示教模式：boot 到 settled 后自动 arm 录制，隐藏全部 debug 面板，只留一个浮动 HUD（`⇧S` 停止）。`?rrPanels=1` 是逃生口，强制显示面板。

tape 不再只活在内存里：

- dev server 插件 `tapeServerPlugin` 提供 `/__demo-tape/*`，录制中**增量落盘**到 `.rr-tapes/`（已 gitignore）。
- CTA 跳转、页面卸载都有钩子（`registerBeforeCta` / `pagehide`）做 best-effort 尾部 flush（`sendBeacon`）。
- 浏览器一崩、玩家一点 CTA，最坏只丢一个 checkpoint 间隔，不是整条 tape。

##### 游戏接入 checklist

1. 项目自己的触摸、摇杆或 AI 输入必须实现 `MovementInputSource`，并通过 `InputService.setMovementSource()` 接入。
2. 在 dev-only 代码里调用 `registerRecordReplayProviders({ snapshotProviders, milestoneDetectors, playerPosition, inputAuthority })`。不要在正式 gameplay 文件里静态 import debug 模块。示例见 `src/debug/record-replay/template-providers.ts`。
3. ⚠️ **`playerPosition` 必须指向玩法真正消费的实体**。模板默认注册 scaffold 的 `SimplePlayer`；真实项目往往另有角色控制器，指错了 Mode B 会驾着一个「幽灵身体」跑，里程碑一个都碰不到，而且不报错。
4. ⚠️ **必须注册终局态里程碑**（`kind: 'outcome'`，通关 / 死亡）。没有它，失败表现为一堆莫名超时；有了它，示教中不存在的终局态 = terminal divergence，立即判负。
5. **里程碑分层**：`MilestoneDetector.critical` 决定它在不在主线因果链上。不写就走默认表 `['outcome', 'stage'] = critical`，其余 optional。
6. ⚠️ **`inputAuthority` 必须是所有输入夺权路径的合取**。过场动画、剧情自动移动、输入锁往往是**互相独立**的几条路径，只查一条会让标定矩阵在过场期间被投毒。
7. ⚠️ **布尔 fact 必须 latch（一旦 true 永远 true），数值 fact 必须单调**。随走位翻转的 `gatePassed` 会产出一串伪里程碑；回落的 `stageOrdinal` 会让 `>=` 门被误判已满足。**录制期会逐帧校验并 `console.warn`**。天生来回翻转的状态观测（「此刻在罩内吗」）在快照里用 `recordReplay.observationOnlyFacts: [...]` 报备豁免——否则告警天天响，等于没有告警。
8. Provider snapshot 的通用经济 / facts 用 `{ recordReplay: { economy: { cash, totalEarned, totalSpent }, facts: { ... } } }`；facts 以 `providerName.key` 进入 observation，milestone `detail.id` 用同一稳定 id。
9. 需要「事件已触发、继续等经济阈值」的 gate，在 milestone 上填 `economyAtGate`。
10. 快照走 O(1) getter；连续量放在不产 milestone 的 provider 里（防刷屏）。
11. 游戏自己的 DEV 浮层（FPS 计、stats 面板、编辑器工具条）用 `registerDebugUiSelectors()` 报备，否则真人示教时它们会留在画面里。**只登记你在 live DOM 里验证过的选择器** —— `findUnmatchedDebugUiSelectors()` 可以体检。
12. 录制 HUD 的游戏专属警告条用 `createTemplateRecordingBanner()` 那个形状实现（例：「快死了，死后点重试会 reload」）。
13. 新项目先跑 `pnpm test:record-replay` 和 `await window.__rr.selfTest()`；再录 30s demo，验证 `replay()`、`extractSemantic()` 和 `semanticReplayMajority()`。

##### 可复现的 baseline / CI

- **基线中心库**:`fps-3d-harness/benchmarks/` —— 每条基线指向「某游戏 × 某 commit」,
  语义剧本与认证 verdict 入仓,原始 tape 外置 GCS(meta 记 URI)。生命周期与录制 SOP 见该目录 README。
- **跑基线**:`fps-3d-harness/tools/run-benchmark.py`(Playwright 驱动 → 读 verdict → 退出码)。
- **判读契约**:`fps-3d-harness/docs/06-record-replay-dual-mode.md`(Mode A horizon / Mode B 四档 grade)。
- **登记门槛**:Mode B `grade ≥ good`;Mode A 记 horizon 即可,不作准入门槛。

> 本仓的实现细节与验收证据不再另写报告 —— 活文档就是这一节 + 上面的契约。

##### 确定性接缝（模板内建）

- `stepFrame(dt)` + `pinEngineDeltaTimeForFrame()`：引擎 dt 被钉在录制值上。
- **Babylon 动画时钟**：`Scene._animate()` 自己读 `PrecisionDate.Now`，`engine._deltaTime` 够不着它。模板装了 `installDeterministicAnimationClock()` 把模拟 dt 喂进去，并让动画时钟**从构造起冻结**到 `start()/resume()`——否则 boot 期的 VFX warmup / 阴影预热 render 会按墙钟老化动画组，`frame-0` 的动画相位不可复现。**任何由动画驱动的玩法事件**（动画播完 → 结算）都依赖这两件事。
- `isBootSettled()`：settled 屏障必须在**不推进帧**的前提下变 true，否则 `waitForGameplaySettled` 死锁。

v1 → v2 破坏性变更：

1. 旧 tape 没有 `hashVersion`、`anchorFrame`、`settledMarker`、`stateSamples` 或 `trail`；可以导入，但不保证与 v4 hash 逐帧兼容，推荐重录。
2. 框架不再自动扫描 `ProjectGameplayRuntime.systems` 或任何固定 scene node id；游戏状态必须通过 Provider 注册。
3. Mode B 的 milestone 不再由模板内置业务字段推导；项目必须提供 Detector。
4. 录制从 post-update/pre-finalizer 单一路径 dense 捕获；依赖「输入被轮询才记录」的旧行为会被视为非 dense tape。
5. Replay 期间会 pin Babylon engine dt，并在 paused step replay 时抑制额外 RAF render；调试代码不要依赖 paused RAF render 的副作用。

#### Determinism Contract

gameplay runtime 代码禁止直接使用 `Math.random()`、`Date.now()` 或 `performance.now()` 推进游戏状态。随机数统一通过 `GameplayRuntimeContext.determinism.random` 注入；时间统一使用 `update(deltaTime)` 传入的 `dt` 累计。直接读取 wall-clock 或全局随机源会破坏 record-replay 的确定性。

dev/editor/VFX/audio 工具代码不受这条 gameplay determinism contract 约束；但只要某段代码会改变 gameplay state hash 或影响玩家位置、资源、队列、升级等可回放状态，就必须走注入的 deterministic source。

**世界矩阵缓存(第 9 类非确定源)。** 在 `update()` 里读某节点的 `getAbsolutePosition()` /
`getWorldMatrix()` / `getBoundingInfo().boundingBox.minimumWorld`，而它的**祖先**在同一 tick 里刚被写过
local transform —— 读到的值取决于 Babylon 的 `_currentRenderId` 渲染缓存，也就是「自上次以来跑过几趟渲染」。
实时 render loop 与 `Game.stepFrame()` 落在这个缓存判断的两侧，于是同一 tick 在录制与回放里给出**不同的世界坐标**。

- **读之前必须调 `refreshWorldMatrixChain(node)`**（`src/core/world-matrix.ts`）。
- ⚠️ **只对节点自身 `computeWorldMatrix(true)` 不够** —— 它内部仍通过 `parent.getWorldMatrix()` 取缓存父矩阵，
  必须自根向下逐级 force。这是 qy-last-stand 用一条 8895 帧 tape 换来的教训：弹丸出生点（挂在炮管下的炮口）
  在回放里滞后整整一帧，一直是纯视觉偏移，直到撞上一个 `dt=98.9ms` 的卡顿帧，`0.356` 的 y 偏移翻转了命中判定。
- 纯视觉的读也建议调：今天纯视觉的偏移，明天就可能被一个卡顿帧喂进命中判定。

### `entities/`

放单体对象行为封装。

适合放：

1. player
2. NPC
3. 其他单对象 runtime 封装

这里偏 `Entity`，不负责全局规则推进。

### `gameplay/`

放项目 gameplay 的 composition 入口和模板级 gameplay module 类型。

当前默认包含：

1. `types.ts`：`GameplayModule` 和 `GameplayRuntimeContext`
2. `createProjectGameplay.ts`：项目 gameplay module composition root，默认创建并连接标准 first playable gameplay 骨架
3. `index.ts`：导出入口

这层只负责“把项目侧 gameplay 模块接起来”，不负责承载具体玩法规则或具体 UI 表现。项目规则应落在 `systems/`，运行时查询和表现能力落在 `services/`；HUD、摇杆、引导箭头、CTA、Endcard 等 UI 必须由项目按 `gameplay.md`、wiki ability 或用户要求在 `src/ui/` 中新增。

强制阶段顺序：

1. 3C + Resources + 项目资源 HUD：`ThreeCSystem`、`ResourcesSystem`，项目 HUD 和输入 UI 由项目生成
2. Backpack：`BackpackSystem`，模板只提供玩家背包 owner 和 snapshot 入口；容量、装填 / 取出、玩家背包可视化和 debug coverage 由 `backpack-system` / `item-visual-effects` 生成
3. Area：`AreaSystem`、`ResourcesSystem`
4. Queue + Economy：`QueueSystem`、`EconomySystem`，模板不预置售卖、钱堆或现金规则；具体实现由 `customer-queue`、`sell-system`、`basic-economy` 等 ability 生成
5. GameplayState + Upgrade + Upgrade Completion Effects + Guide + EndCondition：`GameplayStateSystem`、`UpgradeSystem`、`GuideSystem`、`EndConditionSystem`，以及 `gameplay.md` 指定的项目侧 owner；模板不预置升级支付、引导选择或完成条件触发

协作方式是强制滚动推进：`gameplay.md` 先建立五阶段全局 Draft，再只把最早未 `Verified` 的阶段补到 `Ready for Builder`；builder 只开发这个阶段。后续阶段可以继续细化 Draft，但必须等前一阶段完成并验收为 `Verified` 后，才能进入 `Ready for Builder`。

Phase 1 需要在 `gameplay.md` 中明确主控对象模型。模板默认只提供单一 player actor 的 3C 骨架；如果项目需要切换到载具、机器或其他 controlled actor，应作为项目侧 3C extension 实现，并在文档中先写清 control subjects、切换触发、mount / anchor、相机目标、输入 / 碰撞差异和资源 holder 规则。模板不默认提供 `VehicleSystem`。

模板不默认提供 `ActorCarryStackSystem`。玩家背包可视化属于 `BackpackSystem`；非玩家 actor、worker、NPC、vehicle 或 controlled actor 的 carry stack 是项目扩展，只有 `gameplay.md` 明确写出 actor id、container/resource truth、asset、carry root / actor root、容量和 endpoint rule 时，builder 才应按 wiki `actor-carry-stack` ability 接入项目侧 adapter / service。

具体项目开发 first playable 时，推荐做法是：

1. 优先在 `src/config/gameplay.json` 填资源、背包容量、区域、队列、升级、引导目标、结束条件和 tuning；`src/config/projectGameplayConfig.ts` 只作为 typed adapter。
2. 如果标准薄 owner 适合承接当前阶段，按 wiki ability 扩展现有 system；如果 gameplay.md 明确需要新责任，再新增采集、加工、售卖、解锁、工人、机器 actor 等模块。
3. 在 `src/entities/` 新增 NPC、工人、顾客、车辆、机器 actor 等单体行为。
4. 在 `src/services/` 新增飞物品、资源堆放、动画/audio/vfx helper、binding helper 等可复用能力。
5. 在 `src/ui/` 按项目需求新增 HUD、输入 UI、引导、进度、CTA、Endcard 等界面；模板不预置具体 gameplay UI。
6. 在 `src/gameplay/createProjectGameplay.ts` 中只做模块创建、依赖注入和返回 `GameplayModule[]`。

不要把完整 first playable 写成一个宽泛的 `src/gameplay/<Project>Gameplay.ts` 大文件。

### `services/`

放运行时能力模块。

适合放：

1. 资源加载
2. 对象池
3. 场景构建
4. 渲染/阴影/材质
5. 音频/VFX/动画等通用能力
6. 输入服务与输入抽象
7. Gameplay Binding 查询和 runtime node 映射

这层更接近 Babylon/runtime 侧。

当前默认包含：

1. `GameplayBindingService`：只负责 authored gameplay binding 查询，不拥有具体 gameplay 规则。
2. `RuntimeNodeService`：把 binding id、logicType、scene node id 映射到 runtime node，并输出 binding readiness issue。

如果某个服务只服务于特定玩法或表现能力，例如轨迹动画、资源计数等，优先参考 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities) 的形态沉淀，而不是默认留在模板基础层。

#### `services/` 与 `systems/` 的判断标准

`Service` 是能力提供者：通常提供接口、资源、查询、适配或基础设施能力，被 `Game`、`System`、`Entity` 调用，但不主动推进玩法规则。

`System` 是规则推进者：负责持有并推进一段游戏世界状态，通常参与 `Game.update(deltaTime)`，也可以响应事件推进状态。

常见判断：

1. 如果模块主要被别人调用，例如 `load`、`acquire`、`getInput`、`getSceneNodes`，优先放在 `services/`。
2. 如果模块主要推进规则状态，例如 zone enter/tick/leave、worker 队列、资源生产、解锁流程，优先放在 `systems/`。
3. `services/` 可以监听 Babylon/runtime 事件来维护自身能力，但不应承载玩法规则。
4. `systems/` 可以依赖 `services/`，但 `services/` 不应依赖具体 `systems/`。

### `systems/`

放全局规则和状态推进逻辑。

适合放：

1. 游戏流程
2. 规则计算
3. 广播型状态更新

这层偏 `System`，不负责单体对象生命周期。

模板当前默认内置标准 first playable 系统骨架：

1. `GameplayStateSystem`：阶段、里程碑、升级完成和 blocker 状态。
2. `BackpackSystem`：玩家背包 owner、container 配置和 snapshot 入口；具体 add/remove/visual stack 由 `backpack-system` 生成。
3. `EconomySystem`：经济 owner 占位和 readiness snapshot；具体现金余额、add/spend/listener 由 `basic-economy` 生成。
4. `ResourcesSystem`：资源 catalog、资源绑定查询和资源链表现扩展入口。
5. `AreaSystem`：基于 `ZoneSystem` 的区域分类、active 状态和 bounds / diagnostics 数据。
6. `ThreeCSystem`：输入源接入、相机目标、玩家 zone actor 和右手坐标系 readiness。
7. `QueueSystem`：队列 owner 和 config snapshot；具体排队、售卖、pending 钱堆结算由 `customer-queue` / `sell-system` 生成。
8. `UpgradeSystem`：升级声明和 completed upgrade / milestone 入口；具体支付、进度和完成触发由项目生成。
9. `GuideSystem`：引导目标 owner 和手动 target snapshot；具体目标选择和表现由 `target-guide` / 项目 UI 生成。
10. `EndConditionSystem`：结束条件 owner 和 config snapshot；具体检测规则由项目生成。

这些系统是默认骨架，不代表项目玩法已经完成。项目应按 `gameplay.md` 补足资源来源、加工、队列行为、升级效果、引导表现和最终验收。

模板不把 `actor-carry-stack` 做成默认系统。它只作为项目侧非玩家携带物表现扩展使用；默认玩家背包不要另建平行 carry system。

#### 标准 Gameplay 系统使用说明

这些模块的设计目标是让新项目默认有一条可接线、可调试、可分阶段验收的 first playable 主链。推荐先改 `src/config/gameplay.json`，再按 `gameplay.md` 扩展对应 system；`src/config/projectGameplayConfig.ts` 只保留类型和 runtime export，不要为同一职责再建一套平行 system。

| 模块 | 主要作用 | 当前功能 | 推荐用法 |
| --- | --- | --- | --- |
| `GameplayStateSystem` | 全局 gameplay 状态真源 | 记录 stage、milestone、completed upgrades、blocker、complete | 让 Queue / Upgrade / Guide / EndCondition 写入或读取阶段状态；不要把资源数量或 UI 状态放进这里 |
| `EconomySystem` | 经济 owner | 只提供 readiness snapshot | 具体 cash、add、spend、listener 和 HUD 同步按 `basic-economy` ability 生成；模板不预置现金规则 |
| `ResourcesSystem` | 资源 catalog 和资源表现入口 | 管理资源 id、displayName、tags，按 binding/node 查询资源节点，读取 `resourceVisualStacks` 配置 | 在这里扩展资源飞行动画、场景摆放、资源视觉堆叠、资源模型映射；数量结算仍交给 Backpack / Economy / 项目 resource owner；非玩家 actor carry 只在 gameplay.md 明确声明时接项目 adapter |
| `BackpackSystem` | 玩家背包 owner | 配置 backpack container，并暴露 snapshot / onChange | 具体容量、装填、取出、玩家身后视觉堆叠和 preview action 按 `backpack-system` / `item-visual-effects` 生成 |
| `AreaSystem` | 区域交互入口 | 从 `ZoneSystem` 接 enter/leave，维护 active area，按 category 查询区域，输出 bounds diagnostics | 把 `gameplay.zones` 映射成 resource / backpack / queue / upgrade / guide / end 区域；业务规则交给 Queue / Upgrade / 项目 system |
| `ThreeCSystem` | 3C 接线和 readiness | 可接入项目输入源、设置 player zone actor、同步 camera target、检查右手坐标系 | 第一阶段先按项目需求接入输入 UI，再验收移动、镜头、区域 actor、主控对象模型和项目资源 HUD；如果项目有可控载具/机器，只在 `gameplay.md` 写清后扩展主控切换，不要在这里写采集、售卖、升级规则 |
| `QueueSystem` | 队列 owner | 暴露 queue config snapshot | 具体排队、售卖、订单和 payment settlement 按 `customer-queue` / `sell-system` 生成 |
| `UpgradeSystem` | 升级 owner | 保存 upgrade config、completed state 和 `complete(id)` 入口 | 具体升级支付、进度和完成触发按 Phase 5 合同生成；完成效果必须来自 `gameplay.md` |
| `GuideSystem` | 引导 owner | 暴露 guide target config 和手动 target snapshot | 具体目标选择、箭头/地面表现按 `target-guide` 或项目 UI 生成 |
| `EndConditionSystem` | 结束条件 owner | 暴露 condition config snapshot | 具体结束检测、CTA/Endcard 触发由项目按 `gameplay.md` 生成 |
| `ZoneSystem` | 几何区域检测 | 从 `gameplay.zones` 检测 enter/tick/leave | 保持为底层几何能力；不要把付款、售卖、升级、加工等规则写进 ZoneSystem |

服务和 UI 的推荐职责：

| 模块 | 主要作用 | 推荐用法 |
| --- | --- | --- |
| `RuntimeNodeService` | binding id / logicType / scene node 到 runtime node 的查询封装 | system 需要 scene node 时通过它查；缺 binding 时输出 readiness issue，不静默猜节点 |
| `src/debug/framework/*` | dev-only debug 基础能力 | builder 生成阶段 debug 面板时复用 layout、controls、config client、overlay 和 action registry；生产逻辑不要静态 import |
| `InputService` / `MovementInputSource` | 基础移动输入抽象 | 模板只提供接口和 idle fallback；具体 joystick、键盘、点击移动或拖拽控制由项目按阶段生成 |
| `src/ui/` | 项目 UI 放置位置 | 模板只保留 loading 入口；HUD、摇杆、引导箭头、CTA、Endcard 等具体 UI 由 wiki ability 或用户需求驱动生成 |

推荐接入顺序：

1. 在 `src/config/gameplay.json` 填 resource、resource visual stacks、backpack capacity、area、queue、upgrade、guide target、end condition。
2. 用项目资源 HUD 和 `ThreeCSystem.getSnapshot()` 验收移动、镜头、右手坐标系和资源 catalog。
3. 用 Phase 2 生成的 Backpack debug 面板验收背包数量、容量、preview fill/clear；如果本项目已生成 HUD，再验收 HUD 更新。
4. 用 Phase 3 生成的 Area / Flight / Placement debug 面板验收区域分类、bounds、飞行动效和摆放参数。
5. 用 Phase 4 生成的 Queue + Economy debug 面板验收订单、pending 钱堆、收取、Economy 和 HUD 链路；这些具体 runtime API 由该阶段实现补齐。
6. 用 Phase 5 生成的 Upgrade + Guide debug 面板验收升级支付/完成、milestone、Upgrade Completion Effects、Guide 和 EndCondition；模板不预置这些规则。

任何阶段如果要使用 runtime/dynamic 可见对象，先把对象写入 `gameplay.md` 的 Runtime Asset Contract，再加入 `scene.assets` 或项目等价 asset config，并确认 `warmupCount` 或项目约定的 warmup/max-active 假设。业务 system 只消费已声明资产，不临时绕过 loading 链路。

Phase 3 的区域资源摆放 / 场景库存堆叠按以下边界处理：

1. `AreaSystem` 只负责区域分类、active 状态和 bounds debug。
2. `BackpackSystem` / `EconomySystem` / 项目 resource owner 保存真实数量。
3. `ResourcesSystem` 或项目 presentation service 读取 `resourceVisualStacks` 和 `flightTuning`，负责资源飞行动效、自动分配后的 effect id 消费、摆放 root、可见堆叠刷新和调参入口。
4. `resourceVisualStacks` 应来自 `gameplay.md` 的 Resource Visual Stack / Area Placement Contract，至少写清 `containerId`、`resourceId`、`assetId`、`areaId` / `bindingId` / `rootNodeId`、`maxVisible`、layout、update timing 和 ability 默认 debug coverage；只有默认覆盖之外的项目专属调试修改需求才需要用户额外确认。
5. depot、货架、机器输入/输出、现金堆、车辆货斗、售卖台等用模型表达库存的场景，都使用这类配置或项目等价配置；不要为每个场景默认新增固定命名的 system。
6. 移动的非玩家 actor / vehicle carry 不属于默认玩家背包，也不应塞进 `AreaSystem`；项目需要时按 `actor-carry-stack` 或项目 visual adapter 接入，真实数量仍由项目 resource/container owner 保存。
7. 道具飞行调参不是 optional polish；只要项目使用飞行表现，就必须由 builder 生成对应 debug coverage，并通过 `runtime-gameplay-debug-panels.ts` 挂载。

Phase 4 的 Payment Settlement 不在模板中预置实现，默认按以下边界生成：

1. `sell-system` 或项目 settlement owner 表示订单 / 售卖完成；是否写入 pending 钱堆、背包、HUD 目标或 instant cash 必须来自 `gameplay.md` 的 Payment Settlement Contract。
2. `EconomySystem` 在模板里只是薄 owner；具体 `addCash` / `spendCash` / listener 由 `basic-economy` 生成。默认建议仍是“订单完成后不提前加钱，收取完成后才到账”。
3. 钱堆可见堆叠继续走 `resourceVisualStacks` / presentation service；模板不内置固定 `MoneyDropSystem` 或 money stack container。
4. 付款飞行、钱堆模型、收取飞行模型和 money stack binding / collect area 都必须来自 `gameplay.md` 的 Payment Settlement Contract、Binding Contract 和 Runtime Asset Contract。
5. 模板自带 `QueueSystem` 只是薄 queue owner，不内置静态售卖、动态 `QueueMember`、`CustomerQueueController` 或模型池生命周期。
6. 如果项目有动态顾客、车辆、NPC 或其他 queue member，`gameplay.md` 必须先写 Queue Member / Runtime Spawn Contract，覆盖 member asset、spawn / wait / service / exit 点位、runtime parent、pool / warmup / max-active、movement owner 和 service trigger；项目 `QueueSystem` 或 queue actor system 再按 `customer-queue` wiki ability 扩展 debug snapshot、点位 overlay 和 queue quick actions。

阶段需要 runtime debug 面板时：

1. `gameplay.md` 必须先写清 `Debug & Tuning`：面板名、owner system/service、controls、quick actions、diagnostics、source config save path 和验收用途。标准 controls、quick actions 和 diagnostics 由文档 AI 按 wiki ability / 阶段标准填入，不要求用户逐项设计。
2. builder 必须先使用 `debug-panel` skill。
3. 具体面板放在 `src/debug/runtime-<feature>-debug-panel.ts`。
4. 多个面板共用 `src/debug/framework/panel-layout.ts`，不要各自写固定坐标。
5. 面板统一注册到 `src/debug/panel-manifest.ts`，由 `runtime-gameplay-debug-panels.ts` mount，并通过 `src/main.ts` 的 dev-only dynamic import 加载。
6. 面板调业务动作时优先调用正式 system/service runtime API；需要 console quick action 时，只在 dev-only 面板侧注册 `RuntimeDebugActionRegistry` action；需要调 runtime 数值时，系统或配置模块应提供 preview setter。
7. 道具飞行面板应复用 `projectFlightTuning.ts` 的 runtime preview helper；完整面板由 builder 根据项目 Flight Tuning Contract 生成，不在模板里预置项目 effect id。

### `ui/`

放项目侧视觉 UI。

适合放：

1. 加载页
2. HUD
3. 摇杆
4. 引导箭头
5. 其他项目 UI

当前默认包含：

1. `LoadingScreen`：基础 loading 入口。

模板不预置 `GameHud`、`VirtualJoystick`、`GuideArrowView` 或其他 gameplay UI 实现。具体 UI 应由 `gameplay.md`、wiki ability 或用户要求确认后再生成；项目如需要移动输入 UI，应实现 `MovementInputSource` 并注入 `InputService` / `ThreeCSystem`。

可选 UI 能力优先沉淀到 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities)。

### `utils/`

放无状态辅助函数。

适合放：

1. 小型工具函数
2. 转换逻辑
3. 纯函数 helper

如果一个模块需要持有 runtime 状态或依赖 `Scene/Engine`，优先放到 `services/`，而不是 `utils/`。

## Quick Start

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm typecheck
pnpm build
```

如果要启用完整图片优化链，额外安装本机工具：

```bash
brew install webp optipng
```

## 从这里起新项目

优先扩展：

1. `src/config/types.ts`
2. `src/config/scene.json`
3. `src/config/ConfigService.ts`
4. `src/fps-game-editor-adapter/`
5. `src/core/Game.ts`

新项目初始化后，建议尽早完成一次编辑器闭环验证：

1. 进入平台 workspace
2. 进入编辑模式
3. 选中对象
4. 修改 transform / material / outline
5. 保存并刷新确认结果仍在

如果项目要宣称“编辑器已接好”，至少还要额外确认：

1. 本地编辑器模式可进入、保存、退出并回到游戏
2. 中文或任意文件名资源导入后只显示 canonical project asset
3. 场景保存后 `src/config/editor-scene.json` 与 `src/config/scene.json` 都符合预期

如果项目需要额外能力：

1. 先看 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities)
2. 读取目标 ability 的 `README.md`
3. 结合项目结构决定如何接入

## 相关规范

模板规范维护在团队 wiki：

1. [First Playable Workflow](https://github.com/forge-play-studio/wiki/blob/main/sources/docs/guides/gameplay/FIRST_PLAYABLE_WORKFLOW.md)
2. [Gameplay docs index](https://github.com/forge-play-studio/wiki/blob/main/sources/docs/guides/gameplay/README.md)
3. [Gameplay Object Standard](https://github.com/forge-play-studio/wiki/blob/main/sources/docs/standards/GAMEPLAY_OBJECT_STANDARD.md)
4. [Gameplay Binding Standard](https://github.com/forge-play-studio/wiki/blob/main/sources/docs/standards/GAMEPLAY_BINDING_STANDARD.md)

可选 ability 的通用规则维护在 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities) 根 README。
