# Gameplay Implementation Code Rules

本文档定义 `gameplay-builder` 写 gameplay 代码时的指导性原则。它不是通用代码风格规范，也不规定固定目录、类名或系统数量。

## 1. 核心原则

实现代码只服务于 `gameplay.md` 中的 first playable 闭环。

```text
复用现有项目架构。
复用 pa_template 已有基础能力。
优先使用 scene / config / gameplay binding。
优先跑通最小完整玩法路径。
不要为了套模板新增文档中没有的系统。
不要做与 first playable 无关的长期重构。
```

## 2. 与 pa_template 配合

如果项目基于 `pa_template`，以下能力默认已经存在，应优先接入，不要重新创建平行版本：

```text
Game / SceneBuilder / AssetLoader / ModelPool / InputService
BaseSystem / BaseEntity / SimplePlayer
GameplayBindingService / ConfigValidator
editor-package / scene document / runtime node 查询链路
```

builder 的职责是补齐项目侧 gameplay 实现。只有当 `gameplay.md` 需要、且模板没有具体业务实现时，才新增项目侧 system / service / entity。

## 3. 模块划分原则

模块划分应来自 gameplay 责任，而不是来自视觉对象数量。

成熟 PA 项目通常会形成这些责任边界：

```text
入口总控：初始化、连接模块、驱动循环。
规则系统：资源、背包、采集、加工、售卖、升级、队列、阶段推进。
单体对象：玩家、NPC、顾客、车辆、工人、机器、敌人。
通用服务：资源加载、binding 查询、对象池、配置读取、事件通信。
表现层：飞物品、金币、粒子、音效、动画反馈。
UI 层：HUD、引导、进度、结算、CTA。
配置层：数值、资源类型、binding、阶段条件。
```

这些是职责归属，不代表必须新增同名文件或目录。已有模块能清楚承载职责时，应复用已有模块。

## 4. Gameplay 结构落地原则

实现时要能从代码追溯回 `gameplay.md` 的核心结构：

```text
3C：玩家主体、输入、镜头各自有清楚职责。
资源链：资源来源、存放、转换、消耗、收益必须可追踪。
交互：触发检测和触发后的领域规则要边界清楚。
升级/解锁：消耗、触发、进度、完成效果要可追踪。
队列/订单：队列推进和单个顾客/车辆行为要区分。
NPC/自动化：单体行为和全局工作分配要区分。
阶段/结束：阶段推进、胜利条件、CTA/Endcard 不应散落在多个无关脚本里。
```

这不是要求固定拆出这些系统，而是要求实现后能解释这些 gameplay 责任分别由哪些代码承担。

## 5. 资源链规则

资源链是 first playable gameplay 的主干，实现时必须保证：

```text
资源从哪里来是明确的。
资源存在哪里是明确的。
资源如何转移或转换是明确的。
资源如何变成钱、进度、订单完成或解锁条件是明确的。
容量满、资源不足、目标不可用时有明确处理。
```

飞物品、堆叠、弹跳、粒子和音效属于表现，不能替代资源数量和状态结算。

## 6. Binding / Config 优先

如果项目存在 gameplay binding 或等价场景绑定，必须优先使用。

```text
优先通过 GameplayBindingService 或等价服务查询 gameplay object。
优先从 ConfigService、scene.json、gameplayBindings 或项目配置读取规则。
不要把节点名、资源名、价格、容量、阶段条件散落硬编码在多个脚本里。
```

如果 binding 缺失，应报告 Binding Gap。允许临时 fallback，但必须在最终说明里标记。

## 7. 规则与表现分离

先保证规则成立，再接表现。

```text
资源数量变化、升级完成、队列推进、阶段结束属于规则。
飞物品、金币动画、弹跳、粒子、音效属于表现。
```

表现失败时，不应导致核心状态不可恢复或资源链断掉。

## 8. 通信和状态边界

系统之间应通过明确 API、事件或共享状态服务连接。

成熟 Cocos 项目常见 `EventBus / GameEvents` 模式；其他引擎可以使用等价机制。

避免多个模块互相深度查找节点并直接修改内部字段。跨模块状态变化应有清楚的入口和所有权。

## 9. Coverage 对应

每个主要实现都应能对应回 `gameplay.md` 的具体内容。

实现完成时，至少能说明：

```text
哪些 gameplay.md 流程已经实现。
哪些流程只是部分实现。
哪些流程还未覆盖。
哪些未覆盖项是 Doc Gap / Binding Gap / Asset Gap。
哪些代码是临时 fallback。
```

如果代码实现了 `gameplay.md` 中没有的功能，应说明原因。默认不保留范围外功能。

## 10. Gap 处理

遇到缺口时按类型报告：

```text
玩法规则缺失 -> Gameplay Doc Gap
场景或 binding 缺失 -> Binding Gap
资产缺失 -> Asset Gap
实现风险或引擎限制 -> Implementation Risk
```

不要把 AI 推测直接写成确定实现。可以使用临时 fallback，但必须说明。

## 11. 验证要求

每次完成主要实现后，应尽量运行项目已有检查：

```text
typecheck
build
单元测试或项目已有测试
本地运行和核心路径手动验证
```

如果无法运行检查，必须说明原因。

## 12. 默认改动范围

默认允许修改 gameplay 实现相关文件，例如：

```text
src/core/
src/systems/
src/services/
src/entities/
src/ui/
src/config/
src/assets/index.ts
```

谨慎修改：

```text
package.json
vite.config.ts
src/editor-package/
构建插件
```

默认不修改：

```text
.opencode/
gameplay.md
README.md
docs/
```

除非用户明确要求。
