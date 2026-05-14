# Gameplay Guide

本目录收纳 `gameplay` 模式相关文档，用于帮助新项目先产出可执行的 `gameplay.md`，再交给后续实现流程。

## 文档列表

1. [QUESTION_FRAMEWORK.md](./QUESTION_FRAMEWORK.md)：定义生成 `gameplay.md` 前必须回答的问题、可选问题和 gameplay 模式约束。
2. [GAMEPLAY_MD_TEMPLATE.md](./GAMEPLAY_MD_TEMPLATE.md)：定义项目级 `gameplay.md` 的默认输出结构。
3. [AGENT_PROMPT.md](./AGENT_PROMPT.md)：定义 `gameplay` agent 的职责、边界和输出契约。

## 使用顺序

1. 先用 `QUESTION_FRAMEWORK.md` 收集并确认必答问题。
2. 再按 `GAMEPLAY_MD_TEMPLATE.md` 组织项目级 `gameplay.md`。
3. 最后用 `AGENT_PROMPT.md` 约束平台里的 `gameplay` 模式，只生成或编辑目标 `gameplay.md`。
