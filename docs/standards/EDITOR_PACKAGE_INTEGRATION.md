# Editor Package Integration

这份文档说明新项目如何接入当前平台编辑器。

当前默认目标不是“能打开 inspector”。

而是：

1. inspector 能打开
2. project editor plugin 已注册
3. `scene json` document 主链已生效
4. transform / material / outline 能保存

## Minimum Project-Side Checklist

### 1. `main.ts`

项目初始化完成后，必须注册：

1. `registerProjectEditorPlugin()`
2. `registerProjectEditorRuntimeBridge()`

### 2. `editor-package/index.ts`

必须负责：

1. `ensureProjectEditorDocumentLoaded()`
2. 向 `window.__bridge.registerEditorPlugin` 注册项目 plugin
3. 向 `window.__bridge.registerEditorRuntime` 注册项目 runtime bridge

### 3. `editor-package/types.ts`

必须以 `sceneNode` 为唯一 persistent binding 主线：

```ts
{ kind: 'sceneNode', nodeId: string, rootNode: any }
```

并补齐：

1. material prop 类型
2. outline prop 类型
3. runtime change 类型

### 4. `editor-package/adapter.ts`

必须负责：

1. runtime node -> `sceneNode` binding
2. viewport 选择归一
3. duplicate 调 document 主链

### 5. `editor-package/document.ts`

必须具备：

1. `original / workingCopy`
2. dirty 判断
3. undo / redo history
4. export
5. commit save
6. transform history
7. material history
8. outline history
9. duplicate history

### 6. `editor-package/runtime.ts`

必须把这些东西串起来：

1. selection controller
2. inspector host
3. runtime monitor
4. edit session
5. export / commit / undo / redo

### 7. `runtime-core`

当前标准至少需要这些文件：

1. `material-property-adapter.ts`
2. `outline-adapter.ts`
3. `monitor.ts`
4. `inspector-host.ts`
5. `selection-controller.ts`

## Config / Game Requirements

### `ConfigService`

必须：

1. 正式消费当前 `scene json`
2. 支持 `replaceSceneConfig(sceneConfig)`
3. 正式暴露 `getSceneRootId()`
4. 正式暴露 `getSceneAssets()`
5. 正式暴露 `getSceneNodes()`
6. 正式暴露 `getSceneDocument()` 或等价入口，用于访问 `scene.materials / scene.textures` 等完整 authored domain

### `Game`

至少要暴露：

1. `getScene()`
2. `getSceneBuilder()`
3. `getSceneNodeRuntime(id)`
4. `onEditorDocumentCommitted(sceneConfig)`

### `SceneBuilder`

至少要暴露：

1. `loadSceneFromDocument()`
2. `addSceneNodeFromConfig(...)`
3. `removeSceneNode(...)`
4. `getSceneNodeRuntime(id)`

## Inspector Requirement

仅有 document 主链，不代表 workspace 点击 `Edit` 就一定成功。

项目侧仍然要补齐本地 inspector 链：

1. `vite-plugins/inspector/index.ts`
2. `vite-plugins/inspector/init.ts`
3. `vite.config.ts` 接入 inspector plugin
4. `main.ts` 中的 inspector preload / bridge patch

最关键的目标是：

1. workspace 点击 `Edit` 后，inspector 能在项目运行时里被拉起
2. 不是只在本地独立 dev 页里偶然可用

## Acceptance Standard

一个新项目接入 `editor-package` 后，最少要完成这条验收链：

1. `typecheck`
2. `build`
3. 进入 `Edit`
4. inspector 正常打开
5. 选中 `sceneNode`
6. 修改 transform
7. 修改 material
8. 修改 outline
9. undo / redo
10. save
11. reload 后结果仍在

如果只做到“inspector 能打开”，那还不算接入完成。
