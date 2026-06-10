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
12. 默认 Vite plugin 初始化链：`bridge / inspector / glb / modelCache / stripBabylon / viteSingleFile`
13. 可直接启用的构建增强插件：`thirdPartyWhitelist / locale / optimizePng / visualizer`
14. `ZoneSystem`：消费当前 `SceneConfig` 中的 `gameplay.zones`，并维护 enter/tick/leave 区域状态
15. 标准 first playable gameplay 骨架：3C、Resources、Backpack、Area、Queue、Economy、Upgrade、Guide、EndCondition
16. 默认调试入口：`DebugActionRegistry`，用于项目侧 debug 面板或 console quick action 触发
17. 默认运行时节点查询封装：`RuntimeNodeService`，用于从 gameplay binding / scene node 稳定拿 runtime node

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

流程 0 完成后，新项目才能进入流程 1。模板现在默认提供标准 first playable gameplay 骨架，但这些系统只承载通用状态、接口、配置入口和最小可运行链路；具体资源类型、区域、队列、升级、引导目标、结束条件、表现动画和项目规则仍需要由项目按 `gameplay.md` 补齐。

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
5. `projectGameplayConfig.ts`：标准 first playable 系统的资源、背包、区域、队列、升级、引导、结束条件和 tuning 入口

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

这层只负责“把项目侧 gameplay 模块接起来”，不负责承载具体玩法规则。项目规则应落在 `systems/`，运行时查询和表现能力落在 `services/`，HUD/摇杆/引导表现落在 `ui/`。

默认阶段顺序：

1. 3C + Resources + 左上角 HUD：`ThreeCSystem`、`ResourcesSystem`
2. Backpack：`BackpackSystem`，资源动效和区域摆放表现由 `ResourcesSystem` / 表现服务承接
3. Area：`AreaSystem`
4. Queue + Economy：`QueueSystem`、`EconomySystem`
5. Upgrade + Guide + EndCondition：`UpgradeSystem`、`GuideSystem`、`EndConditionSystem`

推荐协作方式是滚动推进：`gameplay.md` 先建立五阶段全局 Draft，再把当前要开发的阶段补到 `Ready for Builder`；builder 只开发 Ready 阶段，后续 Draft 阶段由用户和 gameplay 文档 AI 继续细化。

具体项目开发 first playable 时，推荐做法是：

1. 优先在 `src/config/projectGameplayConfig.ts` 填资源、背包容量、区域、队列、升级、引导目标和结束条件。
2. 如果标准 system 职责足够，扩展现有 system 的项目规则；如果 gameplay.md 明确需要新责任，再新增采集、加工、售卖、解锁、工人、机器 actor 等模块。
3. 在 `src/entities/` 新增 NPC、工人、顾客、车辆、机器 actor 等单体行为。
4. 在 `src/services/` 新增飞物品、资源堆放、动画/audio/vfx helper、binding helper 等可复用能力。
5. 在 `src/ui/` 扩展 HUD、debug 面板入口、引导、进度、CTA、Endcard 等界面。
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
3. `DebugActionRegistry`：dev-only debug action 注册入口，供 debug 面板、console 或测试触发系统动作。

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
2. `InventorySystem`：通用 container/resource 数量和容量。
3. `EconomySystem`：现金状态和扣费能力。
4. `ResourcesSystem`：资源 catalog、资源绑定查询和资源链表现扩展入口。
5. `BackpackSystem`：玩家背包 container、debug fill/clear 和 HUD 数据。
6. `AreaSystem`：基于 `ZoneSystem` 的区域分类、active 状态和 debug bounds 数据。
7. `ThreeCSystem`：输入源接入、相机目标、玩家 zone actor 和右手坐标系 readiness。
8. `QueueSystem`：队列/售卖最小规则入口和 debug sell action。
9. `UpgradeSystem`：升级状态、站立支付和完成事件。
10. `GuideSystem`：引导目标选择。
11. `EndConditionSystem`：结束条件检测。

这些系统是默认骨架，不代表项目玩法已经完成。项目应按 `gameplay.md` 补足资源来源、加工、队列行为、升级效果、引导表现和最终验收。

#### 标准 Gameplay 系统使用说明

这些模块的设计目标是让新项目默认有一条可接线、可调试、可分阶段验收的 first playable 主链。推荐先改 `src/config/projectGameplayConfig.ts`，再按 `gameplay.md` 扩展对应 system；不要为同一职责再建一套平行 system。

| 模块 | 主要作用 | 当前功能 | 推荐用法 |
| --- | --- | --- | --- |
| `GameplayStateSystem` | 全局 gameplay 状态真源 | 记录 stage、milestone、completed upgrades、blocker、complete | 让 Queue / Upgrade / Guide / EndCondition 写入或读取阶段状态；不要把资源数量或 UI 状态放进这里 |
| `InventorySystem` | 通用资源容器 | 管理 container 内 resource 数量、容量、add/remove/clear、change event | 作为 Backpack、机器输入/输出、场景容器的底层数量服务；项目不应直接用 UI 改它 |
| `EconomySystem` | 现金状态真源 | 管理 cash、add、spend、canAfford、cash change event | Queue 售卖加钱、Upgrade 支付扣钱、HUD 订阅展示；不要把木头、石头等普通资源放这里 |
| `ResourcesSystem` | 资源 catalog 和资源表现入口 | 管理资源 id、displayName、tags，按 binding/node 查询资源节点 | 在这里扩展资源飞行动画、身后背负、场景摆放、资源模型映射；数量结算仍交给 Inventory / Economy |
| `BackpackSystem` | 玩家背包规则 | 连接 backpack container，提供 add/remove/clear/snapshot，注册 `backpack.fill` / `backpack.clear` debug action | 项目采集、拾取、提交时通过它操作玩家携带资源；身后视觉堆叠由 ResourcesSystem 或表现服务订阅处理 |
| `AreaSystem` | 区域交互入口 | 从 `ZoneSystem` 接 enter/leave，维护 active area，按 category 查询区域，注册 `area.toggleBounds` | 把 `gameplay.zones` 映射成 resource / backpack / queue / upgrade / guide / end 区域；业务规则交给 Queue / Upgrade / 项目 system |
| `ThreeCSystem` | 3C 接线和 readiness | 接入输入源、设置 player zone actor、同步 camera target、检查右手坐标系 | 第一阶段先验收移动、镜头、区域 actor 和左上角 HUD；不要在这里写采集、售卖、升级规则 |
| `QueueSystem` | 队列/售卖规则入口 | 提供 completeSale、记录 sale count、给 Economy 加 cash，注册 `queue.sellOnce` debug action | 先用 debug action 验收现金链路；项目需要顾客、车辆、定位点移动时在此扩展或新增 actor/system |
| `UpgradeSystem` | 升级支付和完成规则 | 根据 active area 按秒扣 cash、推进 paidCash、完成 upgrade、写入 milestone，注册 `upgrade.complete` | 把升级费用、前置升级、解锁 milestone 写进 config；实际开门、显示机器等表现订阅完成状态 |
| `GuideSystem` | 引导目标选择 | 根据 milestone / upgrade 状态选择目标 binding，输出 source/target position | 只决定“指向哪里”；箭头、地面光圈、手指提示等表现放 UI 或 VFX |
| `EndConditionSystem` | 结束条件检测 | 根据 completed upgrade 或 milestone 触发 complete | 用于 first playable 闭环结束、CTA/Endcard 前置触发；不要把结算 UI 写在这里 |
| `ZoneSystem` | 几何区域检测 | 从 `gameplay.zones` 检测 enter/tick/leave | 保持为底层几何能力；不要把付款、售卖、升级、加工等规则写进 ZoneSystem |

服务和 UI 的推荐职责：

| 模块 | 主要作用 | 推荐用法 |
| --- | --- | --- |
| `RuntimeNodeService` | binding id / logicType / scene node 到 runtime node 的查询封装 | system 需要 scene node 时通过它查；缺 binding 时输出 readiness issue，不静默猜节点 |
| `DebugActionRegistry` | dev-only debug action 注册入口 | debug 面板或 console 统一调用 `window.__paDebugActions`；生产逻辑不要依赖它 |
| `GameHud` | 左上角最小 HUD | 展示 cash 和 backpack snapshot；项目可扩展资源图标、容量、阶段信息 |
| `VirtualJoystick` | 移动输入源 | 默认接入 `InputService`；项目如替换输入 UI，保持 `MovementInputSource` 接口即可 |
| `GuideArrowView` | 最小引导箭头表现 | 订阅 `GuideSystem` snapshot；复杂引导表现可替换该 UI，不改 GuideSystem 规则 |

推荐接入顺序：

1. 在 `projectGameplayConfig.ts` 填 resource、backpack capacity、area、queue、upgrade、guide target、end condition。
2. 用左上角 HUD 和 `ThreeCSystem.getSnapshot()` 验收移动、镜头、右手坐标系和资源 catalog。
3. 用 `window.__paDebugActions['backpack.fill']()` 验收背包数量、容量和 HUD 更新。
4. 用 `window.__paDebugActions['area.toggleBounds']()` 验收区域分类和 bounds 数据。
5. 用 `window.__paDebugActions['queue.sellOnce']()` 验收 Queue -> Economy -> HUD 的现金链路。
6. 用 `window.__paDebugActions['upgrade.complete']({ id: '<upgradeId>' })` 或站在 upgrade area 验收升级状态、milestone、Guide 和 EndCondition。

### `ui/`

放脚手架默认视觉 UI。

适合放：

1. 加载页
2. HUD
3. 摇杆
4. 引导箭头
5. 其他默认内置 UI

当前默认包含：

1. `GameHud`：左上角 cash / backpack 最小 HUD。
2. `VirtualJoystick`：移动输入源。
3. `GuideArrowView`：基于 `GuideSystem` 的最小引导箭头。

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
