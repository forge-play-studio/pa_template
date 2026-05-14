# 新项目快速创建完整指南

这份文档描述如何基于当前 `pa_template` 创建一个新的 playable game PA 项目。

目标不是讲“架构为什么这样设计”，而是给出一套可以直接照着执行的起盘流程。

## 先说结论

当前 `pa_template` 的正确使用方式是：

1. 以 `pa_template/` 作为新项目起点
2. 先完成编辑器闭环
3. 再按需从 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities) 或旧项目中接入能力
4. 不要直接从 `sword_craft_story`、`train_oil`、`lumber_order` 整仓复制

`pa_template` 现在更像：

1. 新项目标准底座
2. 模板文档和规范入口
3. 项目侧 editor/runtime 起点

它不是“一条命令自动生成完整业务项目”的项目生成器。

## 适用场景

适用于：

1. 新开一个全新的 playable game 项目
2. 需要保留当前平台 `bridge/editor` 接入能力
3. 希望项目从一开始就按当前 `scene json + editor-package` 主线组织

不适用于：

1. 只是想在旧项目上换皮
2. 已经有成熟仓库，只需要补一个局部功能
3. 想直接复刻某个旧项目的全部玩法和资源

## 起盘前先做 5 个决定

在复制 `pa_template/` 之前，先明确下面几件事：

1. 新项目是完全新玩法，还是某个老项目的变体
2. 第一版最小玩法是什么
3. 第一版是否需要 zone / ground UI / joystick / debug HUD
4. 第一版是否需要多语言
5. 第一版是否需要多渠道投放

原因很简单：

- `pa_template` 只提供基础骨架
- 可选能力默认不内置
- 多语言和多渠道目前属于参考策略，不是默认完整成品

## 标准起盘流程

### 1. 新建仓库

先创建一个新的空项目目录或新仓库。

推荐结果应该长成这样：

```text
my_new_game/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
  vite-plugins/
```

### 2. 复制 `pa_template/` 作为项目根

把 `pa_template/` 的内容复制到新项目根目录。

核心原则：

1. 复制的是 `pa_template/` 内部内容
2. 不是把整个 `pa_template/` 复制过去
3. 可选能力从 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities) 读取；模板规范留在本仓 `docs/`

### 3. 完成项目级最小改名

复制完成后，先做最小改名和身份调整：

1. 改 `package.json` 的 `name`
2. 改 `index.html` 的标题
3. 改项目根 `README.md`
4. 按需要调整产物命名规则

这一步只处理“项目身份”，先不要急着改业务代码。

### 4. 跑通基础环境

在新项目根目录执行：

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
```

这里的目标只有一个：确认复制出来的是一个可运行、可构建、可检查的干净起点。

如果这一步都不稳定，后面所有业务接入都会放大问题。

## 第一批必须改的文件

新项目第一轮初始化，优先只改下面这些文件：

1. `src/config/types.ts`
2. `src/config/scene.json`
3. `src/config/ConfigService.ts`
4. `src/core/Game.ts`
5. `src/editor-package/adapter.ts`

视项目需要，再考虑：

1. `src/services/SceneBuilder.ts`
2. `src/assets/index.ts`
3. `src/entities/SimplePlayer.ts`
4. `src/ui/*`

### 这些文件分别干什么

`src/config/types.ts`

- 定义当前项目真正需要的配置类型
- 给 `scene.json`、`ConfigService` 和运行时提供统一类型边界

`src/config/scene.json`

- 作为场景 authored 数据入口
- 放 `scene.assets / scene.nodes / scene.materials / scene.textures`
- 不要把大量场景数据重新硬编码回 TS

`src/config/ConfigService.ts`

- 负责 scene normalization 和统一读取
- 新项目必须正式消费当前 `scene json`

`src/core/Game.ts`

- 负责把 services / systems / entities 串起来
- 只做总控，不要直接塞满具体玩法细节

`src/editor-package/adapter.ts`

- 负责 runtime node 和 `sceneNode` 的绑定
- 这是编辑器闭环能否稳定保存的关键位置之一

## 新项目第一阶段真正该完成什么

不要把“起项目”理解成先把所有玩法都补齐。

第一阶段只需要完成下面 4 件事：

1. 项目能跑
2. 最小场景能正确回放
3. 编辑器主链能工作
4. 最小玩法骨架能挂进去

换句话说，新项目第一阶段不要求：

1. 完整玩法
2. 完整 UI
3. 完整多语言
4. 完整多渠道
5. 所有能力都接入

## 编辑器闭环是第一道硬门槛

基于当前 `pa_template`，新项目不能只做到“页面能跑”。

至少要做完下面这条验收链：

1. `pnpm typecheck`
2. `pnpm build`
3. 进入 workspace
4. 点击 `Edit`
5. inspector 正常打开
6. 选中 `sceneNode`
7. 修改 transform
8. 修改 material
9. 修改 outline
10. undo / redo
11. save
12. reload 后结果仍在

如果只做到“能打开 inspector”，还不算接入完成。

## 新项目需要重点确认的编辑器接入点

### `src/main.ts`

必须确认项目初始化后注册了：

1. `registerProjectEditorPlugin()`
2. `registerProjectEditorRuntimeBridge()`

### `src/editor-package/`

至少要保留并理解这些部分：

1. `index.ts`
2. `types.ts`
3. `adapter.ts`
4. `document.ts`
5. `runtime.ts`
6. `runtime-core/*`

### `vite-plugins/inspector/`

本地 inspector 注入链不能随手删掉。

即使某个项目第一天还没完全跑通 workspace 闭环，也应保留：

1. `vite-plugins/inspector/index.ts`
2. `vite-plugins/inspector/init.ts`
3. `vite.config.ts` 中的 inspector plugin 接入

## 能力接入的正确顺序

新项目稳定后，再按需补能力。

推荐顺序：

1. 先补输入和最小主循环
2. 再补玩法相关 `system / service / entity`
3. 再补 zone / ground UI / joystick / debug HUD
4. 最后再补多语言、多渠道、投放细节

如果需要接已有能力，标准读取顺序是：

1. 先读目标 ability 的 `README.md`
2. 再读它的 `core/`
3. 再看 `examples/`
4. 最后结合当前项目结构决定怎么迁入

不要机械照搬 ability 的目录结构。

## 什么时候参考旧项目

当前更建议这样看待已有项目：

### `train_oil`

更接近当前 `pa_template` 主线落地后的项目形态。

适合参考：

1. `scene json` 的实际扩展方式
2. `editor-package` 的项目化调整
3. 较复杂 runtime / service / system 的拆法

### `lumber_order`

也比较接近当前 `pa_template` 思路。

适合参考：

1. `SceneBuilder` 的项目扩展
2. ground decal / outline / 编辑器保存链相关落地

### `sword_craft_story`

更像较早期的通用脚手架沉淀。

适合参考：

1. 目录组织
2. 基础玩法骨架
3. 早期通用模块

不建议把它当作当前标准模板直接复制。

## 最常见的错误起盘方式

### 错误 1：直接复制旧项目整仓

问题：

1. 会把旧业务逻辑一起带进来
2. 会把旧配置和临时代码一起带进来
3. 会让新项目从第一天就背负无关历史包袱

### 错误 2：先堆玩法，后补编辑器

问题：

1. 业务代码越多，后补编辑器越难
2. `sceneNode` binding 和 document 主链越晚补，返工越大

### 错误 3：把所有可选能力都预装

问题：

1. 初始复杂度过高
2. 很难区分 pa_template 自带问题和接入能力的问题
3. 排错成本急剧上升

### 错误 4：把场景数据重新硬编码回 TS

问题：

1. 会破坏当前 `scene json` authored 主线
2. 编辑器保存和 reload 容易错位

### 错误 5：改 Babylon 坐标系

当前如果项目直接接 `glb/glTF`，应继续保持右手坐标系。

这不是偏好问题，而是基础约束。

## 推荐的 Day 1 清单

如果今天要从 0 起一个新项目，建议只完成下面这些事：

1. 建新仓库
2. 复制 `pa_template/`
3. 改项目名和标题
4. 跑通 `install / dev / typecheck / build`
5. 调整 `scene.json` 为最小目标场景
6. 调整 `Game.ts` 让最小玩法骨架能跑
7. 完成一次编辑器闭环验证

做到这里，这个项目就已经是一个合格的新 PA 项目起点了。

## 推荐的 Day 2 到 Day 5 节奏

### Day 2

1. 接入最小必要输入
2. 接入第一个业务 system / service
3. 整理 `scene.json` 和资源映射

### Day 3

1. 接入 zone / ground UI 或其他核心交互能力
2. 补充关键 UI
3. 继续验证 save / reload

### Day 4

1. 收敛项目专属能力边界
2. 判断哪些能力值得回沉淀到 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities)

### Day 5

1. 再考虑多语言
2. 再考虑多渠道
3. 再考虑投放和宿主兼容细节

## 一份最短可执行版本

如果只想记住最短版本，可以直接按下面做：

1. 复制 `pa_template` 到新仓库根目录
2. 跑 `pnpm install && pnpm dev`
3. 先改 `scene.json`、`ConfigService.ts`、`Game.ts`、`adapter.ts`
4. 先打通 `Edit -> transform/material/outline -> save -> reload`
5. 再从 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities) 和旧项目摘能力

这就是当前 `pa_template` 下新开项目的标准姿势。

## 相关文档

1. [PROJECT_DIRECTORY_STANDARD.md](../standards/PROJECT_DIRECTORY_STANDARD.md)
2. [GAME_ARCHITECTURE_STANDARD.md](../standards/GAME_ARCHITECTURE_STANDARD.md)
3. [SCENE_JSON_STANDARD.md](../standards/SCENE_JSON_STANDARD.md)
4. [EDITOR_PACKAGE_INTEGRATION.md](../standards/EDITOR_PACKAGE_INTEGRATION.md)
5. [SCENE_EDITING_INTEGRATION.md](../standards/SCENE_EDITING_INTEGRATION.md)
6. [TEMPLATE_IMPLEMENTATION_STATUS.md](../notes/TEMPLATE_IMPLEMENTATION_STATUS.md)
7. [pa_abilities](https://github.com/forge-play-studio/pa_abilities)
