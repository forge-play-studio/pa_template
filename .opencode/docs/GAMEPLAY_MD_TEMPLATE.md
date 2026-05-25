# Gameplay MD Template

本文档定义项目级 `gameplay.md` 的默认输出结构。

生成或更新 `gameplay.md` 时，应先根据 `QUESTION_FRAMEWORK.md` 收集必答问题的答案，再把答案整理到下面结构中。

权威模板维护在 `wiki/sources/docs/guides/gameplay/GAMEPLAY_MD_TEMPLATE.md`。本文件只是 `.opencode` 兼容副本。

```md
# Gameplay

本文档用于让当前项目按照已经确认的玩法规则、场景配置和美术资产关系构建 first playable gameplay。

文档只描述玩家规则、数值、流程、引导、反馈、场景/资产绑定和边界，不描述具体代码结构或实现方式。凡是没有形成明确玩法规则、场景依据或用户确认的内容，必须列在“未定义或不作为 first playable 目标”或“已知缺口 / 待确认问题”里，不能靠猜测补充。

## 重要 Rules

- 开发过程中必须严格遵守本文档的美术资产对应关系，优先绑定已列出的场景节点、资产 ID、zone、spawn point、path point、runtime parent 和配置字段，不得随意替换、猜测或新建语义不一致的资产绑定。
- 开发过程中必须严格遵守 wiki MCP 或本地 wiki/catalog fallback，以 wiki/catalog 提供的信息作为 gameplay 系统边界、能力复用和验收核对依据。
- 在根据本文档设计或实施 gameplay 前，必须先使用 wiki MCP 加载 catalog；如果 wiki MCP 不可用，必须读取本地 wiki/catalog fallback。
- 对本文档中提到的任何 gameplay 系统，必须先根据 catalog 内容进行索引，明确该系统在资料中的规则、对象、数值、流程、依赖和边界。
- 设计和实施必须基于本文档和 catalog 索引结果推进；如果 catalog、场景配置、资产清单或本文档没有依据，必须标记为缺口并向用户确认。
- 如果找不到 wiki、catalog，或 catalog 中找不到某个 gameplay 系统的索引内容，必须明确告诉用户找不到对应依据；不得在没有依据的情况下自行扩展系统行为。
- 禁止在没有资料依据或用户确认的情况下猜想玩法规则、补充系统行为、推断 binding、替换资产、增加胜利/失败/CTA/Endcard、增加容量限制或自作主张扩展 gameplay。
- 如果允许临时 fallback，必须在本文档中明确写出 fallback 对象、适用范围、确认来源和后续需要替换或补齐的正式绑定。

## 1. 游戏定位

## 2. 3C

### 2.1 Character

### 2.2 Control

### 2.3 Camera

## 3. 资源链路

### 3.1 资源列表

资源、容器、加工、出售、升级、队列和工人对象应能映射到 `wiki/sources/docs/standards/GAMEPLAY_OBJECT_STANDARD.md` 中定义的 Gameplay Object 类型。场景节点与玩法字段的对应关系应在 `gameplay.gameplayBindings` 或等价 binding 表中记录。

### 3.2 可收集资源来源

### 3.3 资源存放与容量

### 3.4 角色身后背负资源

本节必须由用户明确确认。列出哪些资源可以被玩家可视化背在角色身后，以及哪些资源只能进入数值库存、容器、机器、订单进度或其他非身后背负状态。不得根据资源名、背包名、资产名或通用 inventory 规则自行推断。

```md
| resource | can be carried behind character | visual stack / attach expectation | capacity rule | confirmed by |
| --- | --- | --- | --- | --- |
```

最终版 `gameplay.md` 不应留下阻塞 first playable 主路径的身后背负资源待确认项。

### 3.5 资源转换链条

### 3.6 转换节点、执行者与钱的产生

### 3.7 HUD 显示资源

### 3.8 资源数量规则

### 3.9 资源交互触发规则

## 4. 核心循环

### 4.1 阶段总览

### 4.2 阶段详情

### 4.3 升级列表

### 4.4 升级消耗、触发方式与完成效果

### 4.5 阶段完成规则与阶段级变化

### 4.6 失败条件

### 4.7 初版完整游玩路径

## 5. 场景节点和美术资产绑定

这一节是给 gameplay builder 使用的绑定索引。玩法对象必须优先绑定到现有场景节点、资产 ID、zone、spawn point、path point、runtime parent 或等价配置，不应重新猜一套区域或美术命名。

### 5.1 可复用美术资产

列出 first playable 主路径和关键表现需要使用的资产。资产可以来自 `src/assets/`、`scene.json` asset id、GLB 文件、贴图、音效或项目约定资源入口。

```md
| gameplay object | asset id / file | asset role | usage rule | source / confirmed by | gap |
| --- | --- | --- | --- | --- | --- |
```

### 5.2 玩法对象到场景节点

列出每个 gameplay object 应绑定的场景节点、zone 或配置入口。普通 decoration 不能自动视为 gameplay object；如果某个对象参与 first playable 主路径，必须写出它的玩法用途。

```md
| gameplay object | scene node / zone / config id | gameplay purpose | trigger / query rule | required fields | status |
| --- | --- | --- | --- | --- | --- |
```

`status` 只允许使用：`Ready`、`Missing binding`、`Missing zone`、`Ambiguous binding`、`Incomplete fields`、`Scene node missing`、`Confirmed fallback`、`Not needed`。

### 5.3 区域、锚点、路径点和 runtime parent

列出所有用于触发、生成、飞行、队列、路径、等待、离开、堆放、解锁、引导或结束判定的空间引用。

```md
| reference | id / node | type | position / bounds rule | used by flow | fallback allowed |
| --- | --- | --- | --- | --- | --- |
```

`type` 示例：`spawn point`、`pickup area`、`pay area`、`upgrade area`、`unlock area`、`input anchor`、`output anchor`、`stack anchor`、`path point`、`wait point`、`exit point`、`runtime parent`、`guide target`。

### 5.4 堆放、携带、高度和排列

列出所有会影响资源飞行目标、玩家身后背负、场景堆叠、机器输入/输出、支付现金、订单装载或售卖队列的摆放规则。

```md
| stack / placement area | binding or center | height rule | arrangement / size rule | gameplay use | gap |
| --- | --- | --- | --- | --- | --- |
```

本节必须覆盖角色身后背负资源的挂点、堆叠顺序、容量/无容量规则、资源取出顺序，以及场景中关键资源堆的触发区和摆放区差异。

### 5.5 Binding 需求清单

本节列出 first playable 实现前必须由场景、地编、binding 或等价配置明确提供的对象。每一项至少写清楚期望 id、对象类型、用途、所需字段、当前状态、是否允许 fallback 和是否阻塞主路径。

```md
| gameplay object | expected id | binding kind | logic type | required fields | gameplay flow | fallback allowed | status | blocking question |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
```

必须覆盖：

1. 玩家主体和出生点。
2. 资源来源、资源掉落或 runtime spawn root。
3. 身后背负资源的可视化挂点、堆叠规则或等价 runtime parent。
4. 背包、容器、加工点、出售点、提交点。
5. PayArea、UpgradeArea、UnlockableArea 和其他站立交互区域。
6. NPC、顾客、工人、敌人、车辆、路径点和等待点。
7. 阶段解锁后会显示、隐藏、启用或生成的对象。
8. 引导目标、结束条件、CTA / Endcard 触发对象。

如果当前还不知道具体 scene node 或 binding id，应标记为 `待确认`，并写出需要向用户确认的问题。最终版 `gameplay.md` 不应留下阻塞 first playable 主路径的 binding 待确认项。

### 5.6 绑定还原要求

- 明确哪些对象必须按节点 ID 绑定，哪些可以按 asset id 动态生成，哪些只能作为视觉参考。
- 明确哪些看起来相似的节点或资产不能替代正式玩法绑定。
- 明确当前场景与还原目标不一致时的处理规则，例如数量不足、节点缺失、价格贴图和实际费用不一致、展示资产不参与 gameplay 等。
- 明确 fallback 的确认来源和适用范围；未确认 fallback 不得进入最终版 `gameplay.md` 的 Ready 状态。

## 6. 假设项

```md
| item | source | status | blocks builder | question to resolve |
| --- | --- | --- | --- | --- |
```

## 7. 未定义或不作为 first playable 目标

列出没有明确规则、没有用户确认、没有场景/资产依据，或明确不属于 first playable 的内容。Gameplay builder 不应自行实现本节内容。

## 8. 已知缺口 / 待确认问题

```md
| gap | type | impact | blocks builder | owner | question / next action |
| --- | --- | --- | --- | --- | --- |
```
```
