# Scene JSON Standard

这份文档定义 `scene.json` 的当前标准主线。

目标很明确：

1. 不再使用 `modelRegistry + sceneInstances`
2. 不同时维护两套 scene schema
3. 默认采用当前 `scene json`
4. 新项目直接以这套结构作为 authored source of truth

相关文档：

1. 编辑闭环见 [SCENE_EDITING_INTEGRATION.md](./SCENE_EDITING_INTEGRATION.md)
2. 项目接入见 [EDITOR_PACKAGE_INTEGRATION.md](./EDITOR_PACKAGE_INTEGRATION.md)

## Core Principles

### 1. `scene.json` 是 authored source of truth

运行时节点只是 `scene.json` 的展开结果。

可保存的 transform、material、outline，必须先有 authored 位置，再谈 inspector 编辑和 save。

### 2. 主结构固定为 `scene`

当前标准只认这一条主线：

1. `scene.rootId`
2. `scene.assets`
3. `scene.nodes`
4. `scene.materials`
5. `scene.textures`

### 3. node / material / texture 必须分域

当前标准里：

1. 资产默认值放 `scene.assets[*].defaults`
2. shared material 和 independent material 都放 `scene.materials[*]`
3. texture authored 数据放 `scene.textures[*]`
4. `scene.nodes[*].overrides` 只用于 shared material 的局部差异，以及 node 级 outline / child override

### 4. authored outline 不能再被 selection highlight 污染

`renderOutline / outlineWidth / outlineColor` 已属于 authored 数据。

编辑器高亮必须与 authored outline 解耦。

## Recommended Top-Level Structure

```json
{
  "schemaVersion": 2,
  "meta": {},
  "gameplay": {},
  "scene": {
    "rootId": "root",
    "assets": [],
    "nodes": [],
    "materials": [],
    "textures": []
  },
  "render": {}
}
```

## Top-Level Fields

### `schemaVersion`

当前标准固定为：

```json
{
  "schemaVersion": 2
}
```

### `meta`

用途：

1. 记录说明性元数据
2. 放与场景相关但不直接参与 runtime replay 的补充信息

### `gameplay`

用途：

1. 放场景级玩法配置
2. 放世界边界和场景级 tuning

常见内容：

1. `worldBounds`
2. `tuning.sceneVfx`
3. 其他场景级 gameplay 数据

### `scene`

这是当前 authored 主线。

只要对象要进入保存链，优先考虑是否应该进入这里。

### `render`

用途：

1. 放场景渲染相关配置
2. 放不属于 gameplay、但又需要和场景一起管理的渲染参数

## `scene.assets`

用途：

1. 定义可实例化资产
2. 定义 asset 级 defaults
3. 定义 material shared/instance 语义

示例：

```json
{
  "scene": {
    "assets": [
      {
        "id": "asset_tree_lv1",
        "type": "glb",
        "sourceId": "tree_lv1",
        "materialMode": "shared",
        "defaults": {
          "transform": {
            "scale": 0.5
          },
          "outline": {
            "renderOutline": true,
            "outlineWidth": 0.03
          }
        }
      }
    ]
  }
}
```

关键字段：

1. `id`
2. `type`
3. `sourceId`
4. `displayName`
5. `warmupCount`
6. `singleton`
7. `materialMode`
8. `defaults`

### `materialMode`

只有两种：

1. `shared`
2. `instance`

语义：

1. `shared` 表示 shared material 默认共享，instance override 时再脱离 shared
2. `instance` 表示实例天然走独立材质语义

默认规则：

1. 未写 `materialMode` 时，默认按 `shared` 处理
2. 只有显式写 `materialMode`: `"instance"` 时，才表示默认独立材质

### `defaults`

当前标准支持：

1. `defaults.transform`
2. `defaults.outline`
3. `defaults.childOutlines`

## `scene.nodes`

用途：

1. 定义场景树
2. 定义 authored transform
3. 承载 node authored 数据
4. 在需要 shared material 局部差异时承载 node override

节点类型只有三种：

1. `group`
2. `transform`
3. `instance`

### `group`

只负责树结构分组。

### `transform`

用于纯 transform authored 节点。

示例：

```json
{
  "scene": {
    "nodes": [
      {
        "id": "water_root",
        "kind": "transform",
        "parentId": "root",
        "transform": {
          "position": { "x": 0, "y": 0, "z": 0 }
        }
      }
    ]
  }
}
```

### `instance`

用于实例化 `scene.assets[*]`。

示例：

```json
{
  "scene": {
    "nodes": [
      {
        "id": "tree_01",
        "kind": "instance",
        "parentId": "root",
        "instance": {
          "assetId": "asset_tree_lv1"
        },
        "transform": {
          "position": { "x": 4, "y": 0, "z": 6 }
        },
        "overrides": {
          "material": {
            "albedoColor": { "r": 0.4, "g": 0.8, "b": 0.3 }
          },
          "outline": {
            "renderOutline": true,
            "outlineWidth": 0.02
          }
        }
      }
    ]
  }
}
```

### `overrides`

当前标准支持：

1. `material`
2. `childMaterials`
3. `childTransforms`
4. `outline`
5. `childOutlines`

规则：

1. 这部分当前主要属于 instance node
2. `material / childMaterials` 不表示普通材质本体存储
3. 普通 shared material 和 independent material 都进入 `scene.materials`
4. `material / childMaterials` 只用于 node 已引用 shared material，但当前 node 需要局部差异时
5. `outline / childOutlines` 仍然属于 node override authored 数据

补充：

1. 某些 `transform` 节点如果拥有独立 visual/material 语义，其材质参数也应优先进入 `scene.materials`
2. 不应把普通材质参数直接降格写入 node 自身业务字段

### 编辑目标分域

当前标准下，编辑器语义应至少区分四类目标：

1. `asset defaults`
2. `node`
3. `material`
4. `texture`

写回原则：

1. `asset defaults` 写 `scene.assets[*].defaults`
2. `node` authored 数据写 `scene.nodes[*]`
3. 普通材质本体写 `scene.materials[*]`
4. 纹理 authored 数据写 `scene.textures[*]`
5. 只有 shared material 的局部节点差异，才写 `scene.nodes[*].overrides.material / childMaterials`

## `scene.materials`

用途：

1. 存储 material domain 的 authored 数据
2. 作为 shared material 的正式保存位置
3. 作为 independent / node-scoped material 的正式保存位置

示例：

```json
{
  "scene": {
    "materials": [
      {
        "id": "sharedmat_asset_tree_lv1_leaf",
        "assetId": "asset_tree_lv1",
        "materialName": "leaf",
        "properties": {
          "albedoColor": { "r": 0.3, "g": 0.7, "b": 0.2 },
          "roughness": 0.8
        }
      }
    ]
  }
}
```

也可以是 node-scoped material：

```json
{
  "scene": {
    "materials": [
      {
        "id": "nodemat_collect_table_sell_decal_root",
        "scope": "nodeMaterial",
        "nodeId": "collect_table_sell_decal",
        "ownerNodePath": "collect_table_sell_decal_mesh",
        "materialName": "collect_table_sell_decal_mat",
        "type": "StandardMaterial",
        "properties": {
          "standard": {
            "diffuseColor": { "r": 0.8, "g": 0.2, "b": 0.2 }
          }
        }
      }
    ]
  }
}
```

规则：

1. `scene.materials` 不再只表示 shared material
2. shared material 和 independent material 都属于 material domain
3. `scene.nodes[*].overrides.material / childMaterials` 不保存普通材质本体
4. node override 只用于 shared material 的局部节点差异
5. `instance` 和 `transform` 都可以拥有 `scene.materials` 中的 authored 材质数据
6. transform-owned visual node 的材质 authored 数据，同样优先进入 `scene.materials`
7. 不应把普通材质参数直接写回 node 自身业务字段

## `scene.textures`

当前标准保留这个 authored 入口。

用途：

1. 存储 texture domain 的 authored 数据
2. 承接独立纹理实体或纹理引用配置
3. 与 `scene.materials` 分域，不把 texture 变化混写到 node 字段里

即使项目暂时没用到，也要保留在结构里，避免后续再改顶层 schema。

## Validation Rules

最少应满足：

1. `schemaVersion === 2`
2. `scene.rootId` 非空
3. `scene.assets[*].id` 唯一
4. `scene.nodes[*].id` 唯一
5. `scene.nodes[*].parentId` 要么指向 `rootId`，要么指向已有 node
6. `scene.nodes[*].kind === "instance"` 时，`instance.assetId` 必须存在且可解析

## Replay Order

当前运行时 replay 语义固定为：

1. asset defaults transform
2. shared material
3. node-scoped / independent material
4. shared outline
5. node override material
6. node override outline

如果运行时顺序和这里不一致，save/reload 语义就会错位。
