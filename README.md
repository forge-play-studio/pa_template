# pa_template

这是 PA 项目的独立模板仓库。

当前模板内容直接位于仓库根目录。
如果后续要从这里起新 playable ad 项目，可以直接复制整个 `pa_template` 仓库作为项目起点。

## 目标

1. 作为新项目起点
2. 默认接入当前平台 `bridge/editor`
3. 默认提供项目侧完整 `editor-package` 框架
4. 默认覆盖 runtime bridge / selection / document / adapter / save 主链

注意：

- 这不等于新项目已经自动打通平台 workspace 的 inspector 链路
- 新项目仍需要按接入文档补齐本地 inspector 注入、版本对齐和 workspace 验收

## 当前包含

1. Babylon/Vite 项目骨架
2. Vite 应用壳层（`index.html`）
3. 最小 `scene.json` 与 `ConfigService`
4. Gameplay Binding contract 类型、默认入口、查询服务和基础校验
5. Project gameplay composition hook：`src/gameplay/createProjectGameplay.ts`
6. 项目侧 `editor-package`
7. project editor runtime / edit session / selection / inspector host 骨架
8. document/history/export/commit 主链
9. `sceneNode` adapter 与 duplicate 主链
10. 新项目尽早验证编辑器闭环所需的基础结构
11. dev-only 本地 inspector 注入链
12. `showInspector()` / `loadV2()` 前的 inspector preload patch
13. 默认 Vite plugin 初始化链：`bridge / inspector / glb / modelCache / stripBabylon / viteSingleFile`
14. 可直接启用的构建增强插件：`thirdPartyWhitelist / locale / optimizePng / visualizer`
15. `ZoneSystem`：消费当前 `SceneConfig` 中的 `gameplay.zones`，并维护 enter/tick/leave 区域状态

当前不应默认假设已经完整包含：

1. platform workspace 页面上的最终验收结果
2. 所有项目零改造即可直接跑通的最终 inspector 适配

换句话说，`pa_template` 当前提供的是“带本地 inspector 注入链的完整编辑器框架模板”，不是“所有项目复制后零改造即可直接跑通”的成品接入。
新项目复制后，仍需要按自己的 runtime 和平台环境补齐适配层。

## 目录结构

模板根目录就是 Vite/Babylon 项目根：

1. `index.html`
2. `package.json`
3. `vite.config.ts`
4. `vite-plugins/`
5. `src/`

其中 `src/` 放项目 runtime 与项目侧编辑器接入代码，`vite-plugins/` 放平台桥接、inspector 注入、模型缓存、单文件构建等构建插件。

## 团队级文档

`pa_template` 不再保留 `docs/` 目录。团队级 First Playable Workflow、Gameplay Object / Binding / Naming 标准、Readiness 和 Acceptance 模板统一维护在 `pa_maker/docs`：

1. [First Playable Workflow](https://github.com/forge-play-studio/pa_maker/blob/main/docs/guides/gameplay/FIRST_PLAYABLE_WORKFLOW.md)
2. [Gameplay docs index](https://github.com/forge-play-studio/pa_maker/blob/main/docs/guides/gameplay/README.md)
3. [Gameplay Object Standard](https://github.com/forge-play-studio/pa_maker/blob/main/docs/standards/GAMEPLAY_OBJECT_STANDARD.md)
4. [Gameplay Binding Standard](https://github.com/forge-play-studio/pa_maker/blob/main/docs/standards/GAMEPLAY_BINDING_STANDARD.md)
5. [pa_template docs archive](https://github.com/forge-play-studio/pa_maker/tree/main/docs/templates/pa_template)

流程 0 完成后，新项目才能进入流程 1。模板只承载 gameplay contract layer，不默认实现 Backpack、Upgrade、Queue、Worker 等具体 gameplay 系统。

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

zone 检测能力默认内置，但只负责矩形区域几何检测和 `enter/tick/leave` 事件分发，不内置付款、升级、背包、经济、解锁等具体业务逻辑。ground UI 等表现能力仍按 ability 接入。

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

### `editor-package/`

放项目侧编辑器能力和对平台暴露的接口。

适合放：

1. document
2. adapter
3. runtime / runtime-core
4. editor plugin / runtime 注册
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
2. `createProjectGameplay.ts`：项目 gameplay module 创建入口，默认返回空数组
3. `index.ts`：导出入口

这层只负责“把项目侧 gameplay 模块接起来”，不负责承载具体玩法规则。

具体项目开发 first playable 时，推荐做法是：

1. 在 `src/systems/` 新增资源、背包、采集、加工、售卖、升级、解锁、队列、阶段等规则模块。
2. 在 `src/entities/` 新增玩家、NPC、工人、顾客、车辆、机器 actor 等单体行为。
3. 在 `src/services/` 新增 runtime node 查询封装、binding helper、飞物品、表现 helper 等可复用能力。
4. 在 `src/ui/` 新增 HUD、摇杆、引导、进度、CTA、Endcard 等界面。
5. 在 `src/gameplay/createProjectGameplay.ts` 中创建这些模块并返回 `GameplayModule[]`。

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

模板当前默认内置最小 `ZoneSystem`，只负责矩形区域生命周期检测和 `enter/tick/leave` 状态推进。其他玩法 system 仍优先通过 ability 或项目自身扩展接入。

### `ui/`

放脚手架默认视觉 UI。

适合放：

1. 加载页
2. 其他默认内置 UI

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
4. `src/editor-package/adapter.ts`
5. `src/core/Game.ts`

新项目初始化后，建议尽早完成一次编辑器闭环验证：

1. 进入平台 workspace
2. 进入编辑模式
3. 选中对象
4. 修改 transform / material / outline
5. 保存并刷新确认结果仍在

如果项目要宣称“编辑器已接好”，至少还要额外确认：

1. 不只是本地开发页可用，而是平台 workspace 页点击 `Edit` 后 inspector 真正出现
2. `@babylonjs/core` 和 `@babylonjs/inspector` 使用同版本稳定版本
3. 项目侧本地 inspector 链不只依赖 `loadV2()`，还要覆盖 workspace 的真实入口

如果项目需要额外能力：

1. 先看 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities)
2. 读取目标 ability 的 `README.md`
3. 结合项目结构决定如何接入

## 相关规范

模板规范维护在本仓 [`docs`](./docs)：

1. [GAME_ARCHITECTURE_STANDARD.md](./docs/standards/GAME_ARCHITECTURE_STANDARD.md)
2. [EDITOR_PACKAGE_INTEGRATION.md](./docs/standards/EDITOR_PACKAGE_INTEGRATION.md)
3. [SCENE_EDITING_INTEGRATION.md](./docs/standards/SCENE_EDITING_INTEGRATION.md)
4. [SCENE_JSON_STANDARD.md](./docs/standards/SCENE_JSON_STANDARD.md)

可选 ability 的通用规则维护在 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities) 根 README。
