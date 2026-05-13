# scaffold

这是 `pa_maker` 提供的新项目 base。

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
4. 项目侧 `editor-package`
5. project editor runtime / edit session / selection / inspector host 骨架
6. document/history/export/commit 主链
7. `sceneNode` adapter 与 duplicate 主链
8. 新项目尽早验证编辑器闭环所需的基础结构
9. dev-only 本地 inspector 注入链
10. `showInspector()` / `loadV2()` 前的 inspector preload patch
11. 默认 Vite plugin 初始化链：`bridge / inspector / glb / modelCache / stripBabylon / viteSingleFile`
12. 可直接启用的构建增强插件：`thirdPartyWhitelist / locale / optimizePng / visualizer`

当前不应默认假设已经完整包含：

1. platform workspace 页面上的最终验收结果
2. 所有项目零改造即可直接跑通的最终 inspector 适配

换句话说，`scaffold` 当前提供的是“带本地 inspector 注入链的完整编辑器框架模板”，不是“所有项目复制后零改造即可直接跑通”的成品接入。
新项目复制后，仍需要按自己的 runtime 和平台环境补齐适配层。

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

这层保留 scaffold 默认需要的基础配置。当前默认包含：

1. 场景配置
2. 基础游戏配置

zone、ground UI 等可选能力配置不默认内置，后续按 ability 接入。

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

### `services/`

放运行时能力模块。

适合放：

1. 资源加载
2. 对象池
3. 场景构建
4. 渲染/阴影/材质
5. 音频/VFX/动画等通用能力
6. 输入服务与输入抽象

这层更接近 Babylon/runtime 侧。

如果某个服务只服务于特定玩法或表现能力，例如轨迹动画、资源计数等，优先沉淀到仓库根的 `abilities/`，而不是默认留在 scaffold。

### `systems/`

放全局规则和状态推进逻辑。

适合放：

1. 游戏流程
2. 规则计算
3. 广播型状态更新

这层偏 `System`，不负责单体对象生命周期。

scaffold 当前只保留 `BaseSystem` 类型壳层，不默认初始化任何玩法 system。具体玩法系统优先通过 ability 或项目自身扩展接入。

### `ui/`

放脚手架默认视觉 UI。

适合放：

1. 加载页
2. 其他默认内置 UI

可选 UI 能力优先放仓库根的 `abilities/`。

### `utils/`

放无状态辅助函数。

适合放：

1. 小型工具函数
2. 转换逻辑
3. 纯函数 helper

如果一个模块需要持有 runtime 状态或依赖 `Scene/Engine`，优先放到 `services/`，而不是 `utils/`。

## Quick Start

```bash
cd scaffold
pnpm install
pnpm dev
```

常用命令：

```bash
cd scaffold
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

1. 先看 [../abilities](../abilities)
2. 读取目标 ability 的 `README.md`
3. 结合项目结构决定如何接入

## 相关规范

1. [../docs/standards/GAME_ARCHITECTURE_STANDARD.md](../docs/standards/GAME_ARCHITECTURE_STANDARD.md)
2. [../docs/standards/EDITOR_PACKAGE_INTEGRATION.md](../docs/standards/EDITOR_PACKAGE_INTEGRATION.md)
3. [../docs/standards/ABILITY_CREATION_STANDARD.md](../docs/standards/ABILITY_CREATION_STANDARD.md)
4. [../docs/guides/ABILITY_USAGE_GUIDE.md](../docs/guides/ABILITY_USAGE_GUIDE.md)
