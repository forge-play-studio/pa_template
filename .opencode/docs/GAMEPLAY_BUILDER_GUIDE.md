# Gameplay Builder Guide

本文档定义 `gameplay-builder` agent 的实现流程。该 agent 负责根据 `gameplay.md` 开发 first playable gameplay，并持续检查实现是否覆盖文档。

## 1. 目标

`gameplay-builder` 的目标不是重新设计玩法，而是把已经写清楚的 `gameplay.md` 落到项目代码中。

它必须同时完成两件事：

```text
实现 first playable gameplay
维护 gameplay.md coverage
```

## 2. 当前假设

当前阶段先假设：

```text
gameplay.md 已经包含 first playable 开发所需的全部信息。
```

暂时不强制拆分：

```text
FIRST_PLAYABLE_SPEC.md
gameplay_config.json
gameplay_binding.json
acceptance_tests.md
```

如果项目以后拆出这些文件，agent 可以读取它们；但当前应以 `gameplay.md` 作为核心输入。

## 3. 启动前读取清单

开始实现前，必须先读取：

```text
gameplay.md
package.json
项目入口和主循环文件
配置类型和场景配置
已有 gameplay binding 或等价场景绑定
已有 systems / services / entities / ui / assets
```

如果是 `pa_template` 形态，重点读取：

```text
src/core/Game.ts
src/config/types.ts
src/config/scene.json
src/services/GameplayBindingService.ts
src/services/ConfigValidator.ts
src/systems/
src/entities/
src/services/
src/ui/
src/assets/
```

`pa_template` 已经提供的基础能力不要重复创建：

```text
Game / SceneBuilder / AssetLoader / ModelPool / InputService
BaseSystem / BaseEntity / SimplePlayer
GameplayBindingService / ConfigValidator
editor-package / scene document / runtime node 查询链路
```

builder 的职责是接入和补齐项目 gameplay 系统。只有当 `gameplay.md` 需要且模板没有现成实现时，才新增项目侧 system / service / entity。

如果不是 `pa_template`，先识别等价结构，不要强行套用目录名。

## 4. 初始项目判断

实现前需要判断：

```text
当前项目使用什么引擎或框架？
是否已有玩家控制？
是否已有系统调度入口？
是否已有资源、背包、升级、队列、工人、引导等模块？
是否已有 scene/config/binding contract？
是否有可复用能力或旧模块可以沿用？
```

不得在不了解现有结构的情况下直接新增一套平行架构。

## 5. Gameplay Coverage Checklist

从 `gameplay.md` 提取 coverage 条目，至少包括：

```text
完整玩家路径
资源列表
资源来源
资源存放和容量
资源转换链
交互触发规则
升级 / 解锁规则
阶段开始和完成条件
NPC / 顾客 / 工人 / 机器规则
引导规则
结束条件
CTA / Endcard / SDK 事件
```

每个条目使用下面状态：

```text
Not started
Implemented
Partially implemented
Blocked
Skipped with reason
Doc gap
Binding gap
Asset gap
```

## 6. 默认模块顺序

默认按下面顺序实现：

```text
1. Runtime state / system runner，若项目已有则接入已有入口
2. Player input and movement
3. Resource model and inventory / backpack
4. Interaction detection
5. Resource source / collection
6. Containers and transfer
7. Processor / machine conversion
8. Sell / submit / customer queue
9. PayArea / UpgradeArea / UnlockableArea
10. Worker / NPC / automation
11. Guide / tutorial
12. End condition / CTA / Endcard / SDK events
```

模块顺序必须服从 `gameplay.md` 的最小完整路径。不要为了套模板强行实现文档里没有的系统。

## 7. 模块完成规则

每完成一个模块，必须确认：

```text
模块能运行。
模块和已有模块的资源链路能接上。
没有破坏之前已经完成的模块。
对应 gameplay.md 条目已更新 coverage 状态。
发现的 Doc / Binding / Asset 缺口已经报告。
```

建议输出类似：

```text
模块：资源采集

覆盖 gameplay.md：
- 3.2 可收集资源来源：Implemented
- 3.7 资源数量规则：Partially implemented，缺少容量上限表现
- 3.8 资源交互触发规则：Implemented

发现问题：
- Binding Gap：wood_source_01 未找到对应场景节点
- Gameplay Doc Gap：没有说明树是否会枯竭
```

## 8. 流程级检查

除了模块检查，还必须检查完整玩家路径是否闭环：

```text
开局
-> 引导
-> 首次采集
-> 首次交付
-> 首次收益
-> 首次升级 / 解锁
-> 自动化 / 队列 / 新区域
-> 结束条件
-> CTA / Endcard
```

如果项目没有某些环节，以 `gameplay.md` 为准，不要强行补齐。

## 9. Gap 报告

如果 `gameplay.md` 不足以指导开发，输出：

```md
## Gameplay Doc Gap

- 缺失 / 模糊条目：
- 影响的实现模块：
- 当前无法确定的问题：
- 建议由美术或程序补充的信息：
- 是否阻塞继续开发：
- 是否可以临时使用默认规则：
```

如果是绑定问题，输出：

```md
## Binding Gap

- 缺失 binding：
- 期望 logicType：
- 影响的 gameplay 流程：
- 需要补充的场景节点 / 字段：
- 临时 fallback：
```

如果是资产问题，输出：

```md
## Asset Gap

- 缺失资产：
- 影响的 gameplay 流程：
- 可临时占位方案：
- 是否阻塞：
```

## 10. 最终输出

完成时必须说明：

```text
修改了哪些文件。
实现了哪些 gameplay.md 流程。
哪些流程仍未覆盖。
有哪些 Gameplay Doc Gap / Binding Gap / Asset Gap。
运行了哪些检查或测试。
是否达到 first playable 闭环。
```
