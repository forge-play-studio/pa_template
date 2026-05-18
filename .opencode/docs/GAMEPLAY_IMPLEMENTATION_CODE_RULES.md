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

`gameplay-builder` 必须按 `pa_template` 的 TypeScript/Babylon 分层实现 gameplay。背包、采集、区域解锁、队列、工人、HUD、引导、VFX 等责任应尽量保持独立，不要把多个 gameplay 责任塞进一个大文件。

## 4. pa_template 文件拆分规则

`pa_template` 的默认 gameplay 接线入口是：

```text
src/gameplay/createProjectGameplay.ts
```

这个文件只负责创建和组合项目 gameplay modules。它不得承载具体玩法规则、UI 逻辑、资源结算、节点动画细节或大量场景节点查询。

项目 gameplay 代码按下面边界拆分：

```text
src/core/
  Game.ts：模板 runtime 总控，只做初始化、依赖接线、update、dispose。

src/gameplay/
  createProjectGameplay.ts：项目 gameplay composition root，只创建和连接模块。
  types.ts：模板级 GameplayModule / GameplayRuntimeContext 类型。

src/systems/
  规则推进和 runtime 状态，例如 inventory、resource collection、container transfer、
  processor、sell/order、pay area、upgrade、unlock、worker、stage、end condition。

src/entities/
  单体对象行为，例如 player、worker、customer、vehicle、machine actor。
  Entity 不拥有全局经济、阶段推进或跨对象规则。

src/services/
  可复用 runtime 能力，例如 scene node 查询封装、binding 查询封装、model pooling、
  flying item、animation/audio/vfx helper、object lifecycle helper。
  Service 不主动推进项目 gameplay 规则。

src/ui/
  HUD、joystick、guide、progress、floating text、CTA、endcard。
  UI 读取状态或订阅事件，不作为 gameplay 状态真源。

src/config/
  authored data、tuning constants、id mapping、类型声明。
  运行时可变状态不放在 config。
```

文件必须拆分的条件：

```text
一个文件拥有多个主要 gameplay 责任。
一个文件同时包含规则状态和 UI/DOM/canvas 表现。
一个文件同时包含 scene node/binding 查询和 gameplay 规则推进。
一个文件同时管理 inventory、collection、processing、selling、payment、unlock、guide、HUD 等独立状态。
一个 first playable 文件预计超过约 250-300 行，且可以按责任自然拆分。
```

禁止模式：

```text
src/gameplay/LumberOrderGameplay.ts 同时负责玩家移动、背包、采集、加工、卡车订单、
支付、解锁、HUD、摇杆、引导、飞物品和节点动画。
```

推荐模式：

```text
src/gameplay/createProjectGameplay.ts
src/config/projectGameplayConfig.ts
src/entities/ProjectPlayer.ts
src/systems/InventorySystem.ts
src/systems/ResourceCollectionSystem.ts
src/systems/ContainerTransferSystem.ts
src/systems/ProcessorSystem.ts
src/systems/SellOrderSystem.ts
src/systems/PayAreaSystem.ts
src/systems/UnlockSystem.ts
src/services/RuntimeNodeService.ts
src/services/FlyingItemService.ts
src/ui/ProjectHud.ts
src/ui/JoystickControl.ts
src/ui/GuideArrowView.ts
```

以上是默认拆分形态，不是固定文件清单。只创建 `gameplay.md` 闭环需要的文件，但不能把无关责任合并成一个大文件。

## 5. Gameplay 结构落地原则

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

## 6. 资源链规则

资源链是 first playable gameplay 的主干，实现时必须保证：

```text
资源从哪里来是明确的。
资源存在哪里是明确的。
资源如何转移或转换是明确的。
资源如何变成钱、进度、订单完成或解锁条件是明确的。
容量满、资源不足、目标不可用时有明确处理。
```

飞物品、堆叠、弹跳、粒子和音效属于表现，不能替代资源数量和状态结算。

默认状态所有权：

```text
InventorySystem 是玩家携带资源、容量、增减扣除的状态真源。
ResourceCollectionSystem 只负责资源来源、采集条件、刷新和产出。
ContainerTransferSystem 只负责从背包到容器、从容器到容器的转移规则。
ProcessorSystem 只负责输入消耗、加工计时、输出产物。
SellOrderSystem 只负责出售、订单、顾客/车辆提交和收益。
PayAreaSystem 只负责站立支付、支付进度和支付完成事件。
UnlockSystem 只负责区域/能力/阶段解锁后的状态变化。
FlyingItemService 只负责表现动画，不作为资源状态真源。
HUD 只展示状态，不结算资源。
```

禁止把资源链写成单个巨大 manager。即使 first playable 很小，也必须至少区分“规则状态”和“表现动画”。

## 7. Binding / Config 优先

如果项目存在 gameplay binding 或等价场景绑定，必须优先使用。

```text
优先通过 GameplayBindingService 或等价服务查询 gameplay object。
优先从 ConfigService、scene.json、gameplayBindings 或项目配置读取规则。
不要把节点名、资源名、价格、容量、阶段条件散落硬编码在多个脚本里。
```

如果 binding 缺失，应报告 Binding Gap。允许临时 fallback，但必须在最终说明里标记。

## 8. 规则与表现分离

先保证规则成立，再接表现。

```text
资源数量变化、升级完成、队列推进、阶段结束属于规则。
飞物品、金币动画、弹跳、粒子、音效属于表现。
```

表现失败时，不应导致核心状态不可恢复或资源链断掉。

实现要求：

```text
资源扣除、容量判断、升级完成、阶段推进必须先在 system 中完成。
飞物品、节点弹跳、粒子、音效、飘字只能订阅或响应规则结果。
如果表现目标节点缺失，应报告 Binding Gap 或使用可说明的 fallback，不能阻塞资源结算。
如果音频/VFX 服务不可用，核心玩法仍必须可运行。
```

## 8.1 Zone / Area 交互规则

`ZoneSystem` 只负责几何检测和 `enter/tick/leave` 分发。它不拥有支付、升级、售卖、加工、解锁、引导或 UI 状态。

区域类 gameplay 应按下面边界实现：

```text
ZoneSystem
  -> 检测 player / actor 是否进入区域，维护 stayTimeSec。

PayAreaSystem
  -> 监听 zone tick，按时间间隔扣资源，推进支付进度。

UnlockSystem
  -> 接收支付完成事件，激活区域、能力、机器、敌人、阶段或路线。

SellOrderSystem / ProcessorSystem
  -> 监听对应 zone 或 container 状态，处理出售、提交、加工。

Progress / Guide / HUD UI
  -> 展示区域高亮、进度、数量、箭头和提示。
```

如果 `gameplay.md` 描述“玩家站在某处持续交付资源”，默认不要新增一套碰撞检测；优先使用 `gameplay.zones` 和 `ZoneSystem`，再由项目 system 承接领域规则。

## 9. 通信和状态边界

系统之间应通过明确 API、事件或共享状态服务连接。

对于跨系统广播，可以使用项目内明确的 event bus、typed callbacks 或 system API。事件名和 payload 应集中定义，避免字符串散落。

避免多个模块互相深度查找节点并直接修改内部字段。跨模块状态变化应有清楚的入口和所有权。

## 9.1 Lifecycle and Cleanup

每个 gameplay module 都必须遵循 `GameplayModule` 生命周期：

```text
init：查询 binding、创建 runtime 对象、注册事件。
update：只推进该模块拥有的运行时状态。
dispose：注销事件、zone listener、DOM listener、计时器，释放临时 mesh / UI / VFX。
```

要求：

```text
ZoneSystem.onEnter/onTick/onLeave 返回的 unsubscribe 必须保存，并在 dispose 调用。
window/document/canvas 事件监听必须在 dispose 移除。
临时 Babylon mesh、material、texture、particle system 必须有明确释放路径。
system 不应在 dispose 后继续持有 scene node、mesh、DOM 或 service 的强引用。
```

## 10. Coverage 对应

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

## 11. Gap 处理

遇到缺口时按类型报告：

```text
玩法规则缺失 -> Gameplay Doc Gap
场景或 binding 缺失 -> Binding Gap
资产缺失 -> Asset Gap
实现风险或引擎限制 -> Implementation Risk
```

不要把 AI 推测直接写成确定实现。可以使用临时 fallback，但必须说明。

## 12. 验证要求

每次完成主要实现后，应尽量运行项目已有检查：

```text
typecheck
build
单元测试或项目已有测试
本地运行和核心路径手动验证
```

如果无法运行检查，必须说明原因。

## 13. 默认改动范围

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
