# Gameplay Builder Guide

本文档定义 `gameplay-builder` agent 的实现流程。该 agent 负责根据 `gameplay.md` 开发 first playable gameplay，并持续检查实现是否覆盖文档。

## 快速索引

| 主题 | 位置 | 用途 |
| --- | --- | --- |
| 启动前读取清单 | 3. 启动前读取清单 | 确认必须读取的 gameplay、wiki、项目和 binding 输入 |
| Binding readiness | 4.1 Binding Readiness Gate | 开发前检查 gameplay 对象、scene/config 和 binding 是否足够 |
| Wiki 模块/系统发现 | 4.2 Wiki Module/System Discovery Gate | 从 wiki MCP/catalog 建立模块/系统索引和依赖图 |
| 阶段验收定义 | 4.3 Phase Acceptance Gate | 为每个阶段写清楚验收来源、步骤、预期和证据 |
| 系统验收清单 | 4.3.1 System Acceptance Checklist Gate | 逐系统跟踪实现状态、验收状态、证据和 blocker |
| 开发计划文档 | 4.4 Development Plan Document Gate | 写入 `.opencode/plans/gameplay-builder-development-plan.md` 并作为执行记录 |
| 模块拆分计划 | 4.5 Module Breakdown Plan | 把 gameplay responsibility 映射到文件和分层 |
| Coverage checklist | 5. Gameplay Coverage Checklist | 跟踪 gameplay.md 覆盖状态和 gap |
| 默认 fallback 顺序 | 6. 默认模块顺序 | 只在 wiki 没有更具体依赖时使用 |
| Babylon 分层参考 | 6.1 Babylon Gameplay Architecture Reference | 决定 systems/entities/services/ui/config 归属 |
| Gap 报告 | 9. Gap 报告 | 统一 Gameplay Doc Gap / Binding Gap / Asset Gap 格式 |
| 验证要求 | 12. 验证要求 | 完成实现后的命令、运行时和人工验收要求 |

## 1. 目标

`gameplay-builder` 的目标不是重新设计玩法，而是把已经写清楚的 `gameplay.md` 落到项目代码中。

`gameplay.md` 和用户最新明确表达的意图是 gameplay 合同。实现过程中不得为了降低难度、赶进度、规避缺失 runtime、规避 binding 缺口或复用方便而自行简化、缩小、替换、合并或省略已写清楚的玩法。

如果 `gameplay.md`、用户意图、`scene.json`、当前代码或可用资产之间存在矛盾，或者实现路径不清楚，必须暂停被阻塞的流程并向用户提出具体问题。不要把 AI 推测、临时妥协或简化版实现当作确认过的设计。

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

如果后续发现信息不足，输出 Gameplay Doc Gap / Binding Gap / Asset Gap，并说明阻塞影响和需要用户确认的问题；不要把“不清楚”解释成“可以做一个简化版”。

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
.opencode/docs/BINDING_CHECK_GUIDE.md
.opencode/docs/GAMEPLAY_BUILDER_GUIDE.md
.opencode/docs/GAMEPLAY_IMPLEMENTATION_CODE_RULES.md
wiki MCP catalog / local wiki catalog if available
wiki gameplay templates: READINESS_CHECK_TEMPLATE.md and ACCEPTANCE_TEST_TEMPLATE.md when available
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
src/gameplay/createProjectGameplay.ts / GameplayModule composition hook
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

## 4.1 Binding Readiness Gate

实现前必须先按 `BINDING_CHECK_GUIDE.md` 做一次 binding 检查。检查输入至少包括：

```text
gameplay.md
src/config/scene.json
src/config/types.ts
src/services/GameplayBindingService.ts
src/services/ConfigValidator.ts
```

必须输出 Binding Coverage Checklist：

```md
| gameplay requirement | expected binding / zone | current config | status | impact | question |
| --- | --- | --- | --- | --- | --- |
```

如果 first playable 主路径上的 gameplay 对象缺少 binding、zone、spawn point、path point 或关键字段，必须先问用户。不得静默使用相似节点名、资产名或 Decoration 作为 fallback。

允许继续实现不依赖缺失 binding 的独立模块，但必须明确：

```text
哪些模块可以继续。
哪些模块被 Binding Gap 阻塞。
需要用户回答什么问题。
```

## 4.2 Wiki Module/System Discovery Gate

实现前必须先根据 wiki MCP/catalog 建立模块/系统索引。这里的目标不是照抄 wiki 代码，而是让实现拆分和顺序优先服从团队已有模块、能力和系统边界。

默认流程：

```text
1. 使用 wiki MCP 加载 catalog。
2. 根据 gameplay.md 的玩法对象、系统名、资源链和完整路径检索相关 wiki 模块/系统。
3. 读取相关模块/系统页面，提取职责、输入、输出、依赖、事件/API、配置字段、适用边界。
4. 把结果整理为 Wiki Module/System Index。
5. 根据依赖关系生成 Dependency Graph。
6. 从 wiki gameplay templates、ability README/REFERENCE 和项目 gameplay.md 中提取验收标准。
7. 根据 Dependency Graph 输出 Wiki-Driven Phase Plan 和每阶段验收定义。
8. 写入持久化开发计划文档，默认路径为 `.opencode/plans/gameplay-builder-development-plan.md`。
```

如果 wiki MCP 不可用：

```text
优先读取本地 wiki/catalog，例如 wiki/wiki/index.md 和相关 wiki/sources/abilities 文档。
如果本地 catalog 也不可用，必须说明 wiki/catalog 缺失。
对 gameplay.md 明确要求必须基于 wiki 的系统，标记为 Gameplay Doc Gap 或 External Knowledge Gap。
不要把缺少 wiki 依据解释成可以随意重建模块边界。
```

Wiki Module/System Index 必须使用下面格式：

```md
| module/system | wiki/catalog source | responsibility | lower-level dependencies | depends on it | gameplay.md coverage | implementation note |
| --- | --- | --- | --- | --- | --- | --- |
```

字段要求：

```text
module/system：wiki MCP/catalog 中的模块、系统、ability 或明确机制名称。
wiki/catalog source：wiki 页面、source 文档或 catalog 条目。
responsibility：该模块/系统拥有的单一职责。
lower-level dependencies：它运行前必须先存在的更底层模块、服务、数据结构或配置。
depends on it：哪些更上层 gameplay 流程依赖它。
gameplay.md coverage：它覆盖 gameplay.md 的哪些条目或流程。
implementation note：复用、改写、项目内实现、或仅作为边界参考。
```

Dependency Graph 规则：

```text
如果 A 需要 B 的状态、API、事件或配置才能工作，则 A depends on B。
如果 A 只是把事件通知给 B，通常 B depends on A 的事件契约，但不一定依赖 A 的内部实现。
如果两个模块互相需要彼此的具体实现才能成立，它们是循环依赖，应放入同一阶段。
如果两个模块只共享事件或接口，先定义共享 contract，再按底层到上层拆阶段。
配置、runtime node lookup、event bus、inventory/economy state、resource model 通常比采集、加工、售卖、支付、引导更底层。
表现层、HUD、引导箭头、VFX 通常依赖规则系统，不应先于规则状态实现，除非 wiki 明确指出某个表现服务是底层能力。
```

必须输出 Wiki-Driven Phase Plan：

```md
| phase | wiki modules/systems | dependency reason | gameplay coverage target | target files/layers | acceptance source | verification / evidence | pass criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |
```

阶段排序规则：

```text
优先做更底层的模块或系统。
如果模块/系统之间存在依赖关系，被依赖者必须在更早阶段完成。
如果互相依赖，必须放在同一阶段，并先实现 shared contract / event / config，再实现各自内部。
如果多个模块没有依赖关系，可以放在同一阶段，但必须有明确的共同验收路径，且不混合不相关职责。
每个阶段必须能给出一个可验证结果；不能只是“写一些文件”。
每个阶段完成后，更新 Gameplay Coverage Checklist 和 Binding Coverage Checklist，再进入下一阶段。
```

## 4.3 Phase Acceptance Gate

每个实现阶段都必须写清楚“如何验收”。验收标准优先来自 wiki MCP/catalog，而不是 agent 自己临时发明。

验收来源优先级：

```text
1. gameplay.md 中对应完整路径、数值、绑定、反馈和边界要求。
2. wiki gameplay templates：
   - READINESS_CHECK_TEMPLATE.md：开发前 gating、P0/P1/P2、结构/链路/实现完整性。
   - ACCEPTANCE_TEST_TEMPLATE.md：核心闭环、可选系统、负向与边界用例、通过标准。
3. wiki ability README / REFERENCE：
   - ability-specific validation / checklist / performance verification。
   - ability README 中的接入结果要求，例如目录结构一致、配置一致、引用清楚、typecheck/build 通过。
4. 项目本地 README / AGENTS / package scripts 里的验证要求。
5. 如果以上都没有覆盖，才允许定义项目内临时验收，但必须标记为 Project-specific fallback acceptance。
```

每个 phase 必须输出 Phase Acceptance Definition：

```md
| phase | acceptance source | test case / check | steps or command | expected result | evidence | status |
| --- | --- | --- | --- | --- | --- | --- |
```

规则：

```text
acceptance source 必须指向 wiki 页面、ability README/REFERENCE、gameplay.md 条目或项目文档。
steps or command 必须具体，例如 pnpm typecheck、进入某 zone、完成一车订单、检查 scene.json 中字段、观察现金数值变化。
expected result 必须能判定 Pass / Fail，不能写“看起来正常”。
evidence 必须说明交付时怎么证明：命令输出、coverage checklist 状态、截图/录屏、运行时行为、文件回读或人工验收项。
不能自动验证的表现项必须明确列为 Manual-only check，并说明谁需要人工验收。
如果某阶段依赖 binding gap、asset gap 或 doc gap，phase status 必须是 Blocked，不能写成 Partially pass。
```

阶段通过标准：

```text
1. 该阶段所有 P0/P1 blocker 已处理，或明确停在 Blocked。
2. 该阶段对应 gameplay coverage 条目不再是 Not started。
3. 该阶段用到的 binding coverage 条目不是 Missing / Ambiguous，除非用户确认 fallback。
4. 该阶段所有 applies = Yes 的 wiki acceptance 用例有结果。
5. 该阶段规定的命令或运行时检查已经执行；无法执行时必须写原因。
```

### 4.3.1 System Acceptance Checklist Gate

`gameplay-builder` 必须维护 System Acceptance Checklist。它用于回答用户验收时最关心的问题：每个系统是否已经实现、是否已经验收、证据是什么、还缺什么。

System Acceptance Checklist 必须在写 source code 或 gameplay config 前生成初版，并在每个 phase/module 完成后更新。它不能等到最终报告时才补。

清单来源优先级：

```text
1. wiki MCP/catalog 中识别出的模块、系统、ability 或机制。
2. gameplay.md 中明确要求的玩法系统、资源链、交互对象、阶段目标和 UI/反馈。
3. 项目本地 README / AGENTS / package scripts 中的实现或验收要求。
4. 仅当以上来源不足时，才允许 Project-specific fallback system，并必须标记来源。
```

System Acceptance Checklist 必须使用下面格式：

```md
| system/module | source | responsibility | dependencies | phase | target files | implementation status | acceptance status | evidence | gaps / blockers | next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

字段要求：

```text
system/module：wiki MCP/catalog 中的系统名，或 gameplay.md 中明确的玩法系统。
source：wiki 页面、catalog 条目、ability 文档、gameplay.md 章节或项目文档。
responsibility：该系统的单一主要职责。
dependencies：依赖哪些底层系统；互相依赖时标记 same phase。
phase：系统属于 Wiki-Driven Phase Plan 的哪个阶段。
target files：该系统落到哪些文件；实现前可以是 planned files。
implementation status：Not started / In progress / Implemented / Blocked / Deferred。
acceptance status：Not checked / Passed / Failed / Manual-only / Blocked。
evidence：命令输出、运行时行为、截图/录屏、人工验收说明、文件检查结果或计划中的证据类型。
gaps / blockers：Binding Gap、Asset Gap、Gameplay Doc Gap、Wiki Gap、Verification Gap。
next action：下一步要做什么，或为什么不继续。
```

状态规则：

```text
Implemented 不等于 Verified。
没有 evidence 的系统不能标记为 Passed。
acceptance status = Passed 只表示该系统的验收检查通过；最终是否可交付仍取决于 phase 和 gameplay coverage。
Manual-only 必须说明需要谁验收、看什么、通过标准是什么。
Blocked 必须说明 blocker 类型、影响范围和需要用户或外部输入的决策。
Deferred 必须说明为什么不属于 first playable，或是谁批准了延期。
```

更新规则：

```text
规划完成后：每个 planned gameplay system 必须出现在 checklist 中。
每个 phase 开始前：该 phase 的系统必须有 target files、acceptance source 和 next action。
每个 phase 完成后：更新 implementation status、acceptance status、evidence、gaps / blockers。
最终报告前：所有系统状态必须是 Passed、Manual-only、Blocked 或 Deferred；不能停在 Not started / In progress，除非明确说明任务中断原因。
```

## 4.4 Development Plan Document Gate

`gameplay-builder` 不能只在对话里给计划。开始写 source code 或 gameplay config 前，必须先在项目内写入一个开发计划文档。

默认路径：

```text
.opencode/plans/gameplay-builder-development-plan.md
```

如果用户指定了其他路径，可以使用用户指定路径；否则使用默认路径。如果目录不存在，先创建目录。

开发计划文档必须包含：

```md
# Gameplay Builder Development Plan

## 1. Source Analysis

- gameplay.md:
- wiki MCP/catalog:
- project docs:
- scene/config/assets:
- binding/readiness evidence:

## 2. Gameplay Contract Summary

## 3. Wiki Module/System Index

| module/system | wiki/catalog source | responsibility | lower-level dependencies | depends on it | gameplay.md coverage | implementation note |
| --- | --- | --- | --- | --- | --- | --- |

## 4. Dependency Graph

## 5. Wiki-Driven Phase Plan

| phase | wiki modules/systems | dependency reason | gameplay coverage target | target files/layers | acceptance source | verification / evidence | pass criteria |
| --- | --- | --- | --- | --- | --- | --- | --- |

## 6. Phase Acceptance Definitions

| phase | acceptance source | test case / check | steps or command | expected result | evidence | status |
| --- | --- | --- | --- | --- | --- | --- |

## 7. System Acceptance Checklist

| system/module | source | responsibility | dependencies | phase | target files | implementation status | acceptance status | evidence | gaps / blockers | next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## 8. Module Breakdown Plan

| gameplay responsibility | wiki module/system source | target file | layer | reason | depends on |
| --- | --- | --- | --- | --- | --- |

## 9. Step-by-Step Implementation Checklist

| step | phase | task | target files | acceptance check | status |
| --- | --- | --- | --- | --- | --- |

## 10. Gaps, Risks, and Questions

## 11. Status Log
```

计划文档规则：

```text
Source Analysis 必须说明已经完整分析 gameplay.md 和 wiki MCP/catalog；如果无法访问 wiki MCP，必须说明本地 fallback 或缺口。
System Acceptance Checklist 必须在计划文档中列出所有 planned gameplay systems。
Step-by-Step Implementation Checklist 必须写清楚每一步“做什么”和“怎么验收”。
每个 step 的 acceptance check 必须能追溯到 Phase Acceptance Definitions。
每个 step 必须能追溯到 System Acceptance Checklist 中的一个或多个系统。
源码实现必须按计划中的 phase / step 顺序推进。
如果需要改变 phase 顺序、目标文件、实现范围或验收标准，必须先更新开发计划文档，再继续编码。
每完成一个 phase 或重要 step，必须更新 Status Log、coverage 状态、System Acceptance Checklist、验收 evidence 和 blocker。
如果阶段被 Binding Gap / Asset Gap / Gameplay Doc Gap 阻塞，计划文档中该阶段必须标记 Blocked，不得继续实现被阻塞流程。
```

开发计划文档不是一次性产物。它是开发期间的执行记录。最终报告必须引用该计划中的完成状态和验收 evidence。

如果 wiki MCP/catalog 给出的模块边界与 `gameplay.md` 冲突：

```text
gameplay.md 和用户最新意图仍是 gameplay 合同。
wiki 模块/系统作为实现边界和复用依据。
冲突必须显式列为 Gameplay Doc Gap / Implementation Risk / Wiki Conflict。
不要自行改变 gameplay scope，也不要因为 wiki 中没有完全匹配模块就简化玩法。
```

## 4.5 Module Breakdown Plan

实现前必须先输出 Module Breakdown Plan。该计划必须建立在 Wiki Module/System Index、Wiki-Driven Phase Plan、Phase Acceptance Definitions、System Acceptance Checklist 和 Development Plan Document 之后，用于防止把 first playable 全部塞进一个大文件。

格式：

```md
| gameplay responsibility | wiki module/system source | target file | layer | reason | depends on |
| --- | --- | --- | --- | --- | --- |
```

要求：

```text
每个 gameplay responsibility 必须有明确目标文件。
每个 gameplay responsibility 必须能追溯到 gameplay.md 条目，优先追溯到 wiki MCP/catalog 中的模块或系统。
每个目标文件只能有一个主要责任。
src/gameplay/createProjectGameplay.ts 只能组合模块，不写业务规则。
src/core/Game.ts 只能接入 composition hook，不写项目 gameplay 规则。
如果某个目标文件会混合 UI、规则、节点查询、表现动画或多个系统，必须在计划阶段拆分。
Module Breakdown Plan 的 depends on 必须与 Wiki-Driven Phase Plan 的依赖顺序一致。
```

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

默认模块顺序只在 wiki MCP/catalog 没有给出更具体模块或依赖关系时使用。只要 wiki MCP/catalog 提供了相关模块、系统或 ability，优先使用 Wiki-Driven Phase Plan。

fallback 顺序如下：

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

如果是 `pa_template` 项目，默认落地形态通常类似：

```text
src/gameplay/createProjectGameplay.ts：创建并连接项目 gameplay modules。
src/config/projectGameplayConfig.ts：项目 tuning、成本、容量、资源类型、稳定 id 映射。
src/entities/ProjectPlayer.ts：玩家主体、移动、形态或角色表现。
src/systems/InventorySystem.ts：背包/携带资源/容量。
src/systems/ResourceCollectionSystem.ts：ResourceSource 采集、刷新、掉落规则。
src/systems/ContainerTransferSystem.ts：InputContainer / OutputContainer 转移规则。
src/systems/ProcessorSystem.ts：Processor 输入、加工计时、输出。
src/systems/SellOrderSystem.ts：售卖、订单、顾客或车辆提交。
src/systems/PayAreaSystem.ts：PayArea 支付、进度、完成回调。
src/systems/UnlockSystem.ts：UnlockableArea、阶段状态、能力解锁。
src/systems/GuideSystem.ts：引导目标选择和流程推进。
src/systems/EndConditionSystem.ts：结束条件、CTA / Endcard 触发。
src/services/RuntimeNodeService.ts：scene node / binding 查询封装。
src/services/FlyingItemService.ts：飞物品、金币、资源表现。
src/ui/ProjectHud.ts：HUD / resource counters / progress。
src/ui/JoystickControl.ts：项目侧摇杆，如未复用 InputService。
src/ui/GuideArrowView.ts：引导箭头表现。
```

这不是固定清单。只创建 `gameplay.md` 需要的文件。实现必须落在 `pa_template` 的 TypeScript/Babylon 分层里，不要迁移其他引擎或旧项目的运行时形态。

## 6.1 Babylon Gameplay Architecture Reference

实现时优先使用下面的 Babylon 项目责任映射。该映射是代码架构规则，不是固定文件清单。

```text
玩法组合入口
  -> src/gameplay/createProjectGameplay.ts
  -> 只创建模块、注入依赖、返回 GameplayModule[]

规则状态和流程推进
  -> src/systems/
  -> inventory、collection、transfer、processor、sell/order、pay area、unlock、guide、end condition

单体对象行为
  -> src/entities/
  -> player、worker、customer、vehicle、machine actor、enemy

可复用运行时能力
  -> src/services/
  -> runtime node lookup、binding lookup、model pooling、flying item、animation/audio/vfx helpers、event bus

界面和屏幕表现
  -> src/ui/
  -> HUD、joystick、guide arrow、progress、floating text、CTA、endcard

配置和稳定 id
  -> src/config/
  -> resource types、costs、capacity、stage definitions、authored ids、binding ids、tuning constants
```

默认责任拆分建议：

```text
Game flow / state composition -> createProjectGameplay.ts + Stage/EndCondition systems
Player movement and actor behavior -> entities/ProjectPlayer.ts or existing SimplePlayer extension
Inventory and capacity -> systems/InventorySystem.ts
Resource source collection -> systems/ResourceCollectionSystem.ts
Container input/output transfer -> systems/ContainerTransferSystem.ts
Machine processing -> systems/ProcessorSystem.ts
Selling, order, customer queue -> systems/SellOrderSystem.ts
Standing payment / progress area -> systems/PayAreaSystem.ts
Area unlock and stage changes -> systems/UnlockSystem.ts
Guide target selection -> systems/GuideSystem.ts
Resource flight / pickup / delivery visuals -> services/FlyingItemService.ts
Scene node and binding access -> services/RuntimeNodeService.ts
HUD counters and progress views -> ui/ProjectHud.ts
CTA and endcard -> ui/EndcardView.ts or project-specific CTA UI
```

Use existing files when they already provide the responsibility clearly. Create a new file only when the gameplay needs that responsibility and no existing module owns it.

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
-> 首次移动
-> 首次采集
-> 首次背包/资源计数变化
-> 首次交付
-> 首次收益
-> 首次升级 / 解锁
-> 新区域 / 新机器 / 新敌人 / 新效率出现
-> 自动化 / 队列 / 新阶段
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
- 期望字段：
- 影响的 gameplay 流程：
- 需要补充的场景节点 / 字段：
- 临时 fallback：
- 需要询问用户的问题：
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
完整 System Acceptance Checklist，列出每个系统的实现状态、验收状态、证据、blocker 和 next action。
有哪些 Gameplay Doc Gap / Binding Gap / Asset Gap。
运行了哪些检查或测试。
是否达到 first playable 闭环。
```

还必须输出 Module Split Audit：

```text
每个新增/修改 gameplay 文件的单一责任。
src/core/Game.ts 是否只做接线。
src/gameplay/createProjectGameplay.ts 是否只做 composition。
是否存在把多个独立系统塞进同一个文件的情况。
是否存在 UI、配置解析、节点查询、规则推进混在一起的情况。
如果存在临时合并，说明原因和后续拆分点。
```
