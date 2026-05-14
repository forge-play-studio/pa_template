# Project Directory Standard

这份文档定义新项目在 `pa_template` 体系下的目录约定。

目标只有两个：

1. 让新项目复制 `pa_template` 后，知道代码应该放在哪里
2. 让通用能力、项目代码、编辑器代码三者边界稳定

这不是某个具体项目的玩法文档，也不是 `scene.json` 字段规范文档。

## Scope

这份文档回答：

1. 仓库根目录应该如何组织
2. `pa_template/src` 下各目录分别负责什么
3. 什么代码应该进入 `pa_abilities`
4. 新项目扩展时优先改哪些地方
5. 常见的目录职责混用应该如何避免

不包含：

1. `scene.json` schema 细节
2. 某个具体项目的玩法实现
3. 平台侧 bridge/editor 的实现细节
4. 某个具体 ability 的内部设计

## Repo Layout

`pa_template` 仓库根目录建议长期保持这几层：

1. `src/`
2. `vite-plugins/`
3. `docs/`
4. 项目入口文件，例如 `index.html`、`package.json`、`vite.config.ts`

### `src/`

这是新项目复制起步后的主要 runtime / editor 源码目录。

它应包含：

1. Babylon/Vite 项目骨架
2. 默认配置体系
3. 默认 runtime 架构
4. 项目侧 `editor-package`
5. 新项目最早期验证编辑器闭环所需的基础结构

它不应承载：

1. 某个具体项目的玩法逻辑
2. 只服务于单一项目的表现能力
3. 过多可选能力的默认内置实现

### `vite-plugins/`

这是模板内置的构建插件目录。

适合放：

1. 平台 bridge 注入
2. inspector 注入
3. GLB / 模型缓存 / 单文件构建相关插件
4. locale / channel 等构建期能力

### `docs/`

放模板级规范文档。

适合放：

1. 架构规范
2. 目录规范
3. 编辑器接入规范
4. `scene.json` 规范
5. 起盘和验收指南

不适合放：

1. 某个项目的临时开发笔记
2. 与模板级规则无关的局部说明

### `pa_abilities`

这是独立的可选能力库，不是 `pa_template` 仓库内目录。仓库地址见 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities)。

适合放：

1. 可复用的玩法能力
2. 可复用的表现能力
3. 可复用的 UI 能力
4. 可复用的编辑器增强能力
5. 配套示例和接入说明

不适合放：

1. 只在某个项目里成立的业务逻辑
2. 强依赖某个项目目录结构的实现
3. 没有抽象边界的项目临时代码

## Template Src Layout

新项目复制 `pa_template` 后，`src/` 下默认采用下面的职责划分。

### `assets/`

放项目使用的静态资源和资源入口。

适合放：

1. 图片
2. 贴图
3. 模型
4. 音频
5. 占位资源
6. 资源导出入口

不要在这里放：

1. 资源加载逻辑
2. 运行时状态
3. 与资源无关的配置

### `config/`

放配置文件、配置类型和配置访问层。

适合放：

1. `scene.json`
2. `game.json`
3. 其他 JSON 配置
4. `types.ts`
5. `ConfigService.ts`

这层的职责是：

1. 提供静态配置
2. 提供类型定义
3. 提供统一读取入口
4. 构建基础索引

不要在这里放：

1. Babylon 节点操作
2. 场景构建逻辑
3. 具体玩法推进逻辑

### `core/`

放 runtime 总控。

当前默认是：

1. `Game`

它负责：

1. 创建模块
2. 连接模块
3. 驱动主循环
4. 提供项目级 runtime hook

不要把这些内容继续堆进 `Game`：

1. 具体玩法规则
2. 单体对象行为
3. 大量技术细节实现

### `editor-package/`

放项目侧编辑器能力和对平台暴露的接口。

适合放：

1. `adapter`
2. `document`
3. `runtime`
4. `runtime-core`
5. plugin/runtime 注册入口
6. export/commit/duplicate/undo/redo 主链

这层的目标是：

1. 处理项目对象与持久化 binding 的映射
2. 维护编辑器 document 主链
3. 向平台暴露项目编辑器能力

不要在这里放：

1. 具体玩法规则
2. 与编辑器无关的 runtime 功能
3. 只服务于某个单体对象的行为代码

### `entities/`

放单体对象行为封装。

适合放：

1. player
2. NPC
3. 可交互对象
4. 其他单对象生命周期封装

这层偏对象自身，不负责全局规则推进。

### `services/`

放运行时技术能力模块。

适合放：

1. 资源加载
2. 对象池
3. 场景构建
4. 渲染
5. 阴影
6. 材质
7. 音频
8. VFX
9. 动画
10. 输入服务

这层更接近 Babylon/runtime 基础设施。

如果某个能力具备跨项目复用价值，应优先考虑沉淀到独立的 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities)，而不是默认固化在 `src/services`。

### `systems/`

放全局规则和状态推进逻辑。

适合放：

1. 游戏流程
2. 规则计算
3. 全局状态更新
4. 广播型逻辑

这层偏系统，不负责单体对象封装。

### `ui/`

放项目默认 UI。

适合放：

1. 加载页
2. HUD
3. 默认弹层
4. 其他项目内建 UI

如果是明显可复用的 UI 能力，优先沉淀到 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities)。

### `utils/`

放无状态工具函数。

适合放：

1. 纯函数
2. 小型转换工具
3. 与 Babylon runtime 无关的 helper

不要把这些内容放进 `utils`：

1. 依赖 `Scene` / `Engine` 的模块
2. 持有状态的服务
3. 需要生命周期管理的逻辑

## Directory Decision Rules

遇到“代码应该放哪”的问题，优先按这套顺序判断：

1. 是配置数据还是运行时代码
2. 是单体对象行为还是全局规则
3. 是技术能力还是业务玩法
4. 是项目特有还是跨项目复用

可以简单套这几个判断：

1. 配置进 `config`
2. 总控进 `core`
3. 编辑器相关进 `editor-package`
4. 单体对象行为进 `entities`
5. 技术基础设施进 `services`
6. 全局规则推进进 `systems`
7. 默认项目 UI 进 `ui`
8. 纯工具进 `utils`
9. 可复用能力优先上沉到仓库根 `pa_abilities`

## Anti-Patterns

这些情况应尽量避免：

1. 把玩法规则塞进 `Game`
2. 把 Babylon 操作写进 `config`
3. 把项目业务规则直接塞进 `editor-package`
4. 把带状态的 runtime 模块塞进 `utils`
5. 把单项目临时代码沉到 `pa_abilities`
6. 把 ability 示例代码误当成 pa_template 默认实现

## New Project Extension Priority

新项目初始化后，优先扩展这些地方：

1. `src/config/types.ts`
2. `src/config/*.json`
3. `src/config/ConfigService.ts`
4. `src/editor-package/adapter.ts`
5. `src/services/SceneBuilder.ts`
6. `src/core/Game.ts`

不建议一开始就优先改这些地方：

1. 平台协议
2. bridge 注入方式
3. `editor-package` 的通用 document 主链
4. 仓库级规范文档本身

## Relationship To Other Docs

目录规范之外，相关内容继续看这些文档：

1. [GAME_ARCHITECTURE_STANDARD.md](./GAME_ARCHITECTURE_STANDARD.md)
2. [EDITOR_PACKAGE_INTEGRATION.md](./EDITOR_PACKAGE_INTEGRATION.md)
3. [SCENE_EDITING_INTEGRATION.md](./SCENE_EDITING_INTEGRATION.md)
4. [SCENE_JSON_STANDARD.md](./SCENE_JSON_STANDARD.md)

这份文档只负责回答：

- 代码该放在哪里
- 哪一层应承担什么职责
