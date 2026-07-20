# fps-game-editor 项目侧接入

这个目录承载 `pa_template` 对 `fps-game-editor` 的项目侧接入。项目配置和薄
adapter 与其他项目服务统一放在 `services` 下，但不会因此把游戏 runtime
语义迁入编辑器包。

## 职责

- `editor-entry.ts`：只装配 SDK Editor Entry，提供 `enterEditorMode / enterPlayMode` 模式实现与 editor module；GameApplication、world 和 runtime debug 由 `src/dev/DevHost.ts` 拥有。
- `local-editor.ts`：声明项目 scene/asset/feature 装配，并通过 environment-module helper 挂载产品化 local editor；Editor Plugin Host 生命周期和标准 Prefab Stage adapters 由 SDK 拥有。
- `runtime-plugin-host.ts`：持有项目级 runtime plugin graph 生命周期并注入最终配置。
- `scene-feature.ts`：连接 authored scene 读写、编译、资产和项目 feature contribution。
- `scene-types.ts`：将 SDK editor document 类型特化为 `pa_template` 项目类型。
- `ground-decal-*.ts`：声明项目拥有的 GroundDecal authoring policy。

标准 document、asset、session、history、Inspector、compiler 和 host 实现仍由
`@fps-games/editor/playable-sdk` 提供。

不要在项目侧恢复 Editor Entry controller/backend、入口按钮、诊断全局、Plugin Host、
默认 loading 文案、Babylon viewport picking 或标准 Prefab Stage adapter 转发；这些都属于 SDK 产品装配。

## 边界

不要把项目 runtime 服务、项目 schema、`SceneBuilder` runtime 行为、资产 runtime
状态机或具体 gameplay 语义迁入这个目录。runtime 服务可以消费编辑器产出的配置，
但仍与 editor integration 保持分离。
