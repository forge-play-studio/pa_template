# Scene Editing Integration

这份文档只讨论一件事：

1. 项目如何接入当前的场景编辑闭环

这里的“场景编辑”指：

1. 进入 `Edit`
2. 选中对象
3. 改 transform / material / outline
4. undo / redo
5. save
6. reload 后结果仍在

## Current Standard

当前编辑闭环只支持当前 `scene json`：

1. binding 主体是 `sceneNode`
2. document 主链写回 `scene.nodes / scene.materials / scene.assets[*].defaults`
3. 不再走 `sceneInstance` 协议

## Core Rule

一个对象要进入保存链，至少同时满足：

1. `scene.json` 里有 authored record
2. 运行时里有稳定 root
3. adapter 能把选中对象映射回 `{ kind: "sceneNode", nodeId }`
4. document 能按 binding 找到 authored location

只要缺一层，就会出现“能选中、不能保存”。

## Binding Standard

当前 binding 固定为：

```ts
{ kind: 'sceneNode', nodeId: string }
```

含义：

1. `nodeId` 指向 `scene.nodes[*].id`
2. runtime root 由 `SceneBuilder` 注册和暴露
3. `Game.getSceneNodeRuntime(id)` 能找回 runtime root

## Supported Authored Paths

### 1. Transform

写回位置：

1. `scene.nodes[i].transform`

适用：

1. `kind: "instance"`
2. `kind: "transform"`

### 2. Shared Material

写回位置：

1. `scene.materials[*]`

触发条件：

1. 当前 node 是 `kind: "instance"`
2. 对应 asset `materialMode === "shared"`
3. 当前改动没有落到 instance override

### 3. Instance Material Override

写回位置：

1. `scene.nodes[i].overrides.material`
2. `scene.nodes[i].overrides.childMaterials[path]`

### 4. Shared Outline

写回位置：

1. `scene.assets[*].defaults.outline`
2. `scene.assets[*].defaults.childOutlines[path]`

### 5. Instance Outline Override

写回位置：

1. `scene.nodes[i].overrides.outline`
2. `scene.nodes[i].overrides.childOutlines[path]`

## Runtime Responsibilities

### `SceneBuilder`

必须负责：

1. 用 `scene.nodes[*].id` 注册 runtime root
2. 实例化 `scene.assets`
3. 按固定顺序 replay shared / override
4. 暴露 `addSceneNodeFromConfig(...)`
5. 暴露 `removeSceneNode(...)`
6. 暴露 `getSceneNodeRuntime(id)`

### `adapter.ts`

必须负责：

1. 把选中的 mesh / transform 归一到 scene node root
2. 返回稳定 binding
3. duplicate 时把 binding 交给 document 主链

### `document.ts`

必须负责：

1. `transform`
2. `transformBatch`
3. `duplicate`
4. `material`
5. `outline`

并且要提供：

1. `applyProjectDocumentChange(...)`
2. `applyProjectMaterialDocumentChange(...)`
3. `applyProjectOutlineDocumentChange(...)`

### `monitor.ts`

必须负责：

1. transform batching
2. material pending 聚合
3. outline pending 聚合
4. single-history-per-drag

### `selection-controller.ts`

必须负责：

1. viewport / tree 选择归一
2. 多选状态同步
3. 不污染 authored outline 的高亮

当前标准要求：

1. 只能使用非 authored 的临时高亮
2. 不能再把 selection highlight 写进 `renderOutline / outlineWidth / outlineColor`

## Duplicate Standard

当前 duplicate 只针对 `scene.nodes[*].kind === "instance"`。

duplicate 的保存语义：

1. 在 `scene.nodes` 里插入新 node
2. 复用原 `assetId`
3. 复制原 node 的 transform 和 overrides
4. 给新 node 生成新 `id`
5. runtime 里同步创建新 root

## Save / Reload Contract

当前闭环必须满足：

1. inspector 改 transform 后，document 写回 `scene.nodes[*].transform`
2. inspector 改 material 后，document 写回 shared 或 override authored 位置
3. inspector 改 outline 后，document 写回 shared 或 override authored 位置
4. commit 后 `configService.replaceSceneConfig(...)`
5. reload 后 replay 结果与保存前一致

## Validation Order

最少按这个顺序验收：

1. 进入 `Edit`
2. 选中一个 `sceneNode`
3. 改 transform
4. undo / redo transform
5. 改 material
6. undo / redo material
7. 改 outline
8. undo / redo outline
9. save
10. reload 后确认结果仍在
