# Gameplay Guide

本目录收纳 `gameplay` 模式相关文档，用于帮助新项目先产出可执行的 `gameplay.md`，再交给后续实现流程。

权威流程和标准已经迁移到 `pa_maker/docs`：

1. First Playable Workflow: https://github.com/forge-play-studio/pa_maker/blob/main/docs/guides/gameplay/FIRST_PLAYABLE_WORKFLOW.md
2. Gameplay docs index: https://github.com/forge-play-studio/pa_maker/blob/main/docs/guides/gameplay/README.md
3. Gameplay Object / Binding / Naming standards: https://github.com/forge-play-studio/pa_maker/tree/main/docs/standards

本目录只保留 `.opencode` 兼容入口，不作为新的权威标准来源。

## 文档列表

1. [QUESTION_FRAMEWORK.md](./QUESTION_FRAMEWORK.md)：定义生成 `gameplay.md` 前必须回答的问题、可选问题和 gameplay 模式约束。
2. [GAMEPLAY_MD_TEMPLATE.md](./GAMEPLAY_MD_TEMPLATE.md)：定义项目级 `gameplay.md` 的默认输出结构。
3. [ARTIST_GAMEPLAY_MD_GUIDE.md](./ARTIST_GAMEPLAY_MD_GUIDE.md)：定义美术如何配合 agent 描述目标流程、资产关系、地编意图和遗漏流程修正。
4. [../agents/gameplay.md](../agents/gameplay.md)：定义 `gameplay` agent 的职责、边界和输出契约。

## 使用顺序

1. 先确认 `pa_maker/docs/guides/gameplay/FIRST_PLAYABLE_WORKFLOW.md` 的流程 0 已完成。
2. 再用 `QUESTION_FRAMEWORK.md` 收集并确认必答问题。
3. 当美术提供场景、资产、地编或遗漏修正信息时，按 `ARTIST_GAMEPLAY_MD_GUIDE.md` 整理。
4. 按 `GAMEPLAY_MD_TEMPLATE.md` 组织项目级 `gameplay.md`。
5. 地编和 binding 完成后，按 `pa_maker/docs/guides/gameplay/templates/READINESS_CHECK_TEMPLATE.md` 做开发前 Gate。
