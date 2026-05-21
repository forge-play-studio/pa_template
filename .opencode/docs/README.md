# Gameplay Guide

本目录收纳 `gameplay` 模式相关文档，用于帮助新项目先产出可执行的 `gameplay.md`，再交给后续实现流程。

权威流程和标准已经迁移到 `wiki/sources/docs`：

1. First Playable Workflow: https://github.com/forge-play-studio/wiki/blob/main/sources/docs/guides/gameplay/FIRST_PLAYABLE_WORKFLOW.md
2. Gameplay docs index: https://github.com/forge-play-studio/wiki/blob/main/sources/docs/guides/gameplay/README.md
3. Gameplay Object / Binding / Naming standards: https://github.com/forge-play-studio/wiki/tree/main/sources/docs/standards

本目录只保留 `.opencode` 兼容入口，不作为新的权威标准来源。

## 文档列表

1. [QUESTION_FRAMEWORK.md](./QUESTION_FRAMEWORK.md)：定义生成 `gameplay.md` 前必须回答的问题、可选问题和 gameplay 模式约束。
2. [GAMEPLAY_MD_TEMPLATE.md](./GAMEPLAY_MD_TEMPLATE.md)：定义项目级 `gameplay.md` 的默认输出结构。
3. [ARTIST_GAMEPLAY_MD_GUIDE.md](./ARTIST_GAMEPLAY_MD_GUIDE.md)：定义美术如何配合 agent 描述目标流程、资产关系、地编意图和遗漏流程修正。
4. [BINDING_CHECK_GUIDE.md](./BINDING_CHECK_GUIDE.md)：定义现有 `gameplay` / `gameplay-builder` 工作流里的 binding readiness 检查、gap 报告和用户追问规则。
5. [GAMEPLAY_BUILDER_GUIDE.md](./GAMEPLAY_BUILDER_GUIDE.md)：定义 `gameplay-builder` agent 的实现流程、wiki 模块/系统索引、阶段拆分、开发计划文档、coverage 检查、阶段验收和 gap 报告。
6. [GAMEPLAY_IMPLEMENTATION_CODE_RULES.md](./GAMEPLAY_IMPLEMENTATION_CODE_RULES.md)：定义 gameplay 实现代码的设计边界和模块划分规则。
7. [../agents/gameplay.md](../agents/gameplay.md)：定义 `gameplay` agent 的职责、边界和输出契约。
8. [../agents/gameplay-builder.md](../agents/gameplay-builder.md)：定义 `gameplay-builder` agent 的职责、边界和输出契约。

## Agent 提示词结构

`../agents/gameplay.md` 和 `../agents/gameplay-builder.md` 只保留指导性内容，至少包含下面几类高层信息：

| 结构 | 作用 |
| --- | --- |
| Global Goal And Introduction | 说明 agent 的全局目标和角色简介 |
| Available Tools | 说明允许使用的工具类别和边界 |
| Core Running Logic | 说明 agent 的核心执行顺序 |
| Exception Handling And Recovery | 说明阻塞、冲突、失败验收和恢复路径 |
| Scope / Boundaries | 说明读写范围、禁止事项和交付边界 |

## 使用顺序

1. 先确认 `wiki/sources/docs/guides/gameplay/FIRST_PLAYABLE_WORKFLOW.md` 的流程 0 已完成。
2. 再用 `QUESTION_FRAMEWORK.md` 收集并确认必答问题。
3. 当美术提供场景、资产、地编或遗漏修正信息时，按 `ARTIST_GAMEPLAY_MD_GUIDE.md` 整理。
4. 按 `GAMEPLAY_MD_TEMPLATE.md` 组织项目级 `gameplay.md`，并写清楚 Binding 需求清单。
5. 用 `BINDING_CHECK_GUIDE.md` 对比 `gameplay.md` 与当前 `scene.json` / binding 状态；缺少 binding、zone 或关键字段时，先向用户追问。
6. 地编和 binding 完成后，按 `wiki/sources/docs/guides/gameplay/templates/READINESS_CHECK_TEMPLATE.md` 做开发前 Gate。
7. 开发 first playable gameplay 时，按 `BINDING_CHECK_GUIDE.md`、`GAMEPLAY_BUILDER_GUIDE.md` 和 `GAMEPLAY_IMPLEMENTATION_CODE_RULES.md` 执行。

## `gameplay-builder` 细节索引

`../agents/gameplay-builder.md` 只保留 agent 角色、边界和高层门禁；具体执行细节统一索引到下面文档：

| 需求 | 文档 |
| --- | --- |
| Binding readiness、缺口格式、用户追问规则 | [BINDING_CHECK_GUIDE.md](./BINDING_CHECK_GUIDE.md) |
| wiki MCP/catalog 模块/系统索引、依赖图、阶段拆分 | [GAMEPLAY_BUILDER_GUIDE.md](./GAMEPLAY_BUILDER_GUIDE.md#42-wiki-modulesystem-discovery-gate) |
| 每阶段如何验收、验收来源和证据格式 | [GAMEPLAY_BUILDER_GUIDE.md](./GAMEPLAY_BUILDER_GUIDE.md#43-phase-acceptance-gate) |
| 每个系统的实现状态、验收状态、证据和 blocker checklist | [GAMEPLAY_BUILDER_GUIDE.md](./GAMEPLAY_BUILDER_GUIDE.md#431-system-acceptance-checklist-gate) |
| 开发计划文档路径、模板和更新规则 | [GAMEPLAY_BUILDER_GUIDE.md](./GAMEPLAY_BUILDER_GUIDE.md#44-development-plan-document-gate) |
| 模块拆分和文件分层计划 | [GAMEPLAY_BUILDER_GUIDE.md](./GAMEPLAY_BUILDER_GUIDE.md#45-module-breakdown-plan) |
| gameplay 代码分层、禁止模式、生命周期和验证要求 | [GAMEPLAY_IMPLEMENTATION_CODE_RULES.md](./GAMEPLAY_IMPLEMENTATION_CODE_RULES.md) |
