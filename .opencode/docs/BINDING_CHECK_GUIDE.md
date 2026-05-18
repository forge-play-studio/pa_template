# Binding Check Guide

本文档定义现有 `gameplay` 和 `gameplay-builder` 工作流中的 binding 检查功能。

## 1. 目标

Binding 检查的目标是把 first playable gameplay 中所有依赖美术、地编或场景配置的对象显式列出来，并确认它们已经能被实现代码稳定查询。

检查必须回答：

```text
gameplay.md 里哪些玩法对象需要 binding？
当前 scene/config 里哪些已经有明确 binding？
哪些只是普通 scene node，还不能作为玩法 binding 使用？
哪些完全缺失？
缺失项会阻塞哪条 gameplay 流程？
需要问用户什么问题才能继续？
```

## 2. 检查输入

默认读取：

```text
gameplay.md
src/config/scene.json
src/config/types.ts
src/services/GameplayBindingService.ts
src/services/ConfigValidator.ts
```

如果项目拆出了额外配置，也应读取：

```text
src/config/projectGameplayConfig.ts
gameplay_binding.json
readiness check 文档
地编交付说明
```

## 3. 必查对象

从 `gameplay.md` 中抽取下列对象。只要它参与 first playable 闭环，就必须有明确 binding、zone 或可说明的 runtime 查询方式。

```text
玩家出生点 / 玩家主体
资源来源
可拾取资源 / 掉落物 / runtime spawn root
背包、容器、堆放点
加工点、机器、输入点、输出点
出售点、提交点、订单点、顾客或车辆
PayArea / UpgradeArea / UnlockableArea
阶段解锁后新增、隐藏、显示或启用的对象
NPC / worker / customer / enemy
路径点、等待点、离开点
引导目标、箭头目标、HUD 依赖对象
结束条件、CTA、Endcard 触发对象
```

## 4. Ready 标准

一个 gameplay 对象只有满足下面条件，才算 binding ready：

```text
有稳定 id。
有明确 logicType 或等价类型语义。
如果绑定场景节点，entityId 能在 scene.nodes 中找到。
如果绑定区域，zone id 能在 gameplay.zones 中找到。
需要资源规则时，resourceType / acceptsResourceTypes / producesResourceTypes / cost / capacity 等字段足够实现。
需要 runtime 生成时，spawnRootId 或 runtimeParent 足够定位。
需要路径时，pathPointIds 指向明确节点或路径点。
需要解锁依赖时，dependsOn / unlocks 或项目等价配置足够表达。
```

仅有“名字看起来像”不算 ready。普通 decoration 节点不能自动视为 gameplay binding。

## 5. Checklist 格式

输出 Binding Coverage Checklist 时使用：

```md
| gameplay requirement | expected binding / zone | current config | status | impact | question |
| --- | --- | --- | --- | --- | --- |
```

状态只能使用：

```text
Ready
Missing binding
Missing zone
Ambiguous binding
Incomplete fields
Scene node missing
Gameplay Doc Gap
Confirmed fallback
Not needed
```

## 6. Gap 格式

Binding Gap 必须使用：

```md
## Binding Gap

- 缺失 / 模糊项：
- 期望 binding 类型：
- 期望字段：
- 影响的 gameplay 流程：
- 当前可见的 scene/config 证据：
- 是否阻塞实现：
- 可选临时 fallback：
- 需要用户确认的问题：
```

## 7. 询问用户规则

缺少 binding、zone 或关键字段时，必须问用户。问题要短，且能让用户做决定。

推荐问题格式：

```text
`wood_source` 采集点目前没有对应 gameplay binding。你希望美术先补 binding，还是允许开发临时用 scene node `tree_01` 作为 fallback？
```

如果有多个缺口，按阻塞 first playable 主路径的顺序问。不要一次抛出无关长列表；可以先列 checklist，再把阻塞问题集中到 `User Questions`。

## 8. 与 gameplay agent 的关系

`gameplay` agent 产出或更新 `gameplay.md` 时，必须包含 Binding 需求清单。该清单描述“需要绑定什么”，不要求直接修改 `scene.json`。

如果用户提供的需求无法判断某个对象是否需要 binding，`gameplay` agent 必须追问，或在草稿中标为待确认。最终版 `gameplay.md` 不应留下阻塞实现的 binding 待确认项。

## 9. 与 gameplay-builder 的关系

`gameplay-builder` 开始实现前必须先做 binding check。存在阻塞 Binding Gap 时，不应继续实现相关模块。

允许实现不依赖该缺口的独立模块，但必须明确说明：

```text
哪些模块可以继续。
哪些模块被 Binding Gap 阻塞。
需要用户确认什么。
```

实现过程中发现新缺口时，也必须暂停对应流程并询问用户，不能静默 fallback。
