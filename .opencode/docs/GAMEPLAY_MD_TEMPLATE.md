# Gameplay MD Template

本文档定义项目级 `gameplay.md` 的默认输出结构。

生成或更新 `gameplay.md` 时，应先根据 `QUESTION_FRAMEWORK.md` 收集必答问题的答案，再把答案整理到下面结构中。

权威模板维护在 `wiki/sources/docs/guides/gameplay/GAMEPLAY_MD_TEMPLATE.md`。本文件只是 `.opencode` 兼容副本。

```md
# Gameplay

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

### 3.4 资源转换链条

### 3.5 转换节点、执行者与钱的产生

### 3.6 HUD 显示资源

### 3.7 资源数量规则

### 3.8 资源交互触发规则

## 4. 核心循环

### 4.1 阶段总览

### 4.2 阶段详情

### 4.3 升级列表

### 4.4 升级消耗、触发方式与完成效果

### 4.5 阶段完成规则与阶段级变化

### 4.6 失败条件

### 4.7 初版完整游玩路径

## 5. Binding 需求清单

本节列出 first playable 实现前必须由场景、地编、binding 或等价配置明确提供的对象。每一项至少写清楚期望 id、对象类型、用途、所需字段和是否阻塞主路径。

```md
| gameplay object | expected binding / zone | logic type | required fields | gameplay flow | blocking |
| --- | --- | --- | --- | --- | --- |
```

必须覆盖：

1. 玩家主体和出生点。
2. 资源来源、资源掉落或 runtime spawn root。
3. 背包、容器、加工点、出售点、提交点。
4. PayArea、UpgradeArea、UnlockableArea 和其他站立交互区域。
5. NPC、顾客、工人、敌人、车辆、路径点和等待点。
6. 阶段解锁后会显示、隐藏、启用或生成的对象。
7. 引导目标、结束条件、CTA / Endcard 触发对象。

如果当前还不知道具体 scene node 或 binding id，应标记为 `待确认`，并写出需要向用户确认的问题。最终版 `gameplay.md` 不应留下阻塞 first playable 主路径的 binding 待确认项。

## 6. 假设项
```
