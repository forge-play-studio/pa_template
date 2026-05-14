# Game Architecture Standard

这份文档描述当前 pa_template 的通用架构约束。

## Core Layers

推荐结构：

1. `core`
2. `services`
3. `systems`
4. `entities`
5. `editor-package`

### `core`

`Game` 只负责总控：

1. 初始化
2. 连接 services / systems / entities
3. 驱动 update / render
4. 暴露少量 runtime hook 给编辑器

不要把具体玩法规则重新堆回 `Game`。

### `services`

`services` 负责技术能力：

1. 资源加载
2. 模型池
3. 场景构建
4. 渲染 / 阴影 / 材质
5. 音频 / 动画 / VFX

### `systems`

`systems` 负责规则和状态推进。

### `entities`

`entities` 负责单体对象行为和表现。

## Scene Architecture Contract

当前 pa_template 的场景主线固定为：

1. 当前 `scene json`
2. `SceneBuilder` 负责 authored -> runtime replay
3. `ConfigService` 负责 scene normalization

运行时不应再自行发明另一套 `modelRegistry + sceneInstances` 主链。

## Replay Contract

`SceneBuilder` 的回放顺序固定为：

1. asset defaults transform
2. shared material
3. node-scoped / independent material
4. shared outline
5. node override material
6. node override outline

shared / override 如果不按这个顺序回放，save/reload 一定错位。

## Material / Outline Contract

当前标准里：

1. shared material authored 数据在 `scene.materials`
2. shared outline authored 数据在 `scene.assets[*].defaults`
3. instance override authored 数据在 `scene.nodes[*].overrides`

运行时必须支持：

1. shared material / instance override 分流
2. shared outline / instance override 分流
3. shared asset 命中 override 时脱离 shared

## Editor Contract

项目侧 `editor-package` 是项目语义层，不是平台通用层。

它负责：

1. binding
2. document
3. runtime bridge
4. selection / inspector / monitor 集成

当前编辑标准必须支持：

1. transform save
2. material save
3. outline save
4. duplicate
5. undo / redo

## Selection Highlight Contract

当前标准要求：

1. selection highlight 不能污染 authored outline
2. `renderOutline / outlineWidth / outlineColor` 只能作为 authored 数据对待
3. 临时高亮必须独立实现

## Coordinate System Contract

如果项目使用 Babylon 且直接接入 `glb/glTF`，当前 pa_template 固定采用右手坐标系。

这不是建议项，而是基础约束。

## Validation Order

新项目或大改动之后，至少按下面顺序验收：

1. `npm run typecheck`
2. `npm run build`
3. 进入 `Edit`
4. 选中对象
5. 修改 transform
6. 修改 material
7. 修改 outline
8. undo / redo
9. save
10. reload 后结果仍在
