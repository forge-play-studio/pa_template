# Camera Resize Standard

本文档定义 playable 项目里**所有相机**在窗口尺寸变化、平台比例切换、设备切换时的标准行为。

目标是：

1. 所有相机在 `desktop -> 9:16 -> 4:3 -> tablet` 等比例切换时都要正确响应 resize。
2. 透视相机不能出现错误视口、裁剪异常或交互错位。
3. 正交相机除了响应 resize，还必须避免画面被拉伸形变。

## 1. 背景

在平台 workspace 中，预览区域会因为设备按钮切换而改变 iframe / canvas 尺寸，例如：

1. 桌面端
2. 手机 `9:16`
3. 平板 `3:4`

这意味着项目运行时至少会经历：

1. canvas 尺寸变化
2. engine render size 变化
3. 相机视口/投影条件变化

如果项目没有把相机响应 resize 当作标准能力，就会出现：

1. 画面显示区域错误
2. HUD / picking / gizmo 对齐异常
3. 正交相机内容被拉伸
4. 不同比例下 framing 完全失控

## 2. 总规则

对于所有 playable 项目中的相机，都必须遵守以下规则：

1. `engine.resize()` 只是基础动作，不是完整方案。
2. 相机相关的尺寸依赖逻辑必须在 resize 后重新生效。
3. 任何依赖画布宽高比的相机参数，都不能只在初始化时计算一次。

换句话说：

- 所有相机都要有 resize 行为
- 正交相机只是比透视相机多一层“必须重算视锥”的要求

## 3. 透视相机的要求

对于透视相机，通常最少要保证：

1. engine resize 正常执行
2. active camera 保持有效
3. 依赖屏幕尺寸的交互或 framing 不会失效

一般情况下，透视相机不会像正交相机那样直接出现“拉伸”问题，因为透视投影主要由：

1. `fov`
2. canvas 实际宽高比

共同决定。

但透视相机仍然需要正确处理 resize，否则仍可能出现：

1. picking 错位
2. UI / world overlay 错位
3. camera framing 与实际设备比例不一致

## 4. 正交相机的额外要求

正交相机比透视相机多一个关键要求：

1. 每次 resize 后，都必须重算：
   - `orthoLeft`
   - `orthoRight`
   - `orthoTop`
   - `orthoBottom`

原因是：

1. 透视相机主要受 `fov` 影响
2. 正交相机主要受正交视锥边界影响
3. 如果这些边界只在初始化时按某一次宽高比计算一次，后续尺寸变化时就会失真

典型错误表现：

1. 画面被横向或纵向拉伸
2. 原本应该“变窄并裁切更多内容”的场景，变成“同样内容被挤压/拉长”

## 5. 参考项目现象

### 5.1 `train_oil`

`train_oil` 中的正交相机不会在设备比例切换时拉伸。

原因是：

1. 它在正交模式下，会根据当前 canvas 宽高比重算正交视锥
2. 并且把这套计算挂在 resize 链路上

因此：

1. 切到手机比例时，画面是裁切
2. 不会发生内容形变

### 5.2 `lumber_order` / `pa_template pa_template`

`lumber_order` 早期曾在平台切到 `9:16` 时出现拉伸；当前 `lumber_order` 和 `pa_template` 都已经采用 resize 后重算正交视锥的方式。

这个历史问题的根因是：

1. 它在创建相机时按当时的渲染尺寸计算了一次：
   - `orthoLeft`
   - `orthoRight`
   - `orthoTop`
   - `orthoBottom`
2. 但后续 iframe / canvas 尺寸变化时，没有重新计算

因此：

1. 平台虽然把预览区域变成了竖屏
2. 但项目仍然在使用旧横屏时计算出的正交视锥
3. 最终表现为拉伸，而不是裁切

当前标准实现应保持：

1. `SceneBuilder` 提供 `updateCameraProjection(camera)`
2. `Game` 在 window resize 后先执行 `engine.resize()`
3. 再调用 `sceneBuilder.updateCameraProjection(camera)`
4. 不把初始化时的正交视锥当作永久值

## 6. 标准实现方式

### 6.1 所有相机的基础要求

每个项目都应当保证：

1. 窗口变化时触发 `engine.resize()`
2. resize 后相机和依赖相机的系统保持一致
3. 不把“初始化时算出来的尺寸相关参数”永久缓存

### 6.2 正交相机的标准实现

推荐做法：

1. 在创建相机时定义一个 `updateOrthoSizing()` 函数
2. 该函数内部读取当前宽高比
3. 按当前宽高比重新设置正交边界
4. 初始化时先调用一次
5. 再把它挂到项目的 resize 链路中

标准形式如下：

```ts
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;

const orthoSizeDesktop = camCfg.orthoSizeDesktop ?? camCfg.orthoSize ?? 12;
const orthoSizeMobile = camCfg.orthoSizeMobile ?? camCfg.orthoSize ?? 16;

const updateOrthoSizing = () => {
  const canvas = this.scene.getEngine().getRenderingCanvas();
  const width = canvas?.clientWidth ?? 1;
  const height = canvas?.clientHeight ?? 1;
  const aspect = width / Math.max(height, 1);
  const orthoSize = aspect < 1 ? orthoSizeMobile : orthoSizeDesktop;

  camera.orthoLeft = -orthoSize * aspect;
  camera.orthoRight = orthoSize * aspect;
  camera.orthoTop = orthoSize;
  camera.orthoBottom = -orthoSize;
};

updateOrthoSizing();

window.addEventListener('resize', () => {
  const engine = this.scene.getEngine();
  engine.resize();
  updateOrthoSizing();
});
```

## 7. 为什么要区分 desktop / mobile 两套 orthoSize

即使都使用正交相机，不同比例下通常也不适合完全复用同一个 `orthoSize`。

原因：

1. 横屏下可视范围更宽
2. 竖屏下如果继续用同样尺寸，可能显得过远或过近
3. 游戏 HUD / 交互区也可能需要不同的 framing

因此推荐：

1. `orthoSizeDesktop`
2. `orthoSizeMobile`

如果项目没有明确需求，也至少保留这个扩展位。

## 8. 对 pa_template 的要求

当前 `pa_template` 里的默认主相机是正交 `ArcRotateCamera`。

因此 pa_template 自身必须满足正交视锥 resize 重算规则：

1. 初始化相机时先计算一次正交视锥
2. window resize 后先执行 `engine.resize()`
3. 再按当前 canvas 尺寸重新设置 `orthoLeft / orthoRight / orthoTop / orthoBottom`

真正的项目标准应该是：

1. 所有项目都要有 camera resize 行为
2. 一旦项目使用正交主相机，就必须额外补上正交视锥重算逻辑

换句话说：

- 这不是某个具体项目的临时修复
- 这是所有 playable 项目都应遵守的相机标准

## 9. 验证标准

使用平台 workspace 做验证时，至少验证下面三组：

1. 桌面端
2. 手机 `9:16`
3. 平板 `3:4`

预期：

1. 相机能正确响应尺寸变化
2. UI / picking / viewport 不错位
3. 正交项目表现为裁切范围变化
4. 不应出现内容横向或纵向拉伸
5. 同一个圆形、正方形、角色比例不应在切换后变形

如果切换比例后看到：

1. 圆变椭圆
2. 物体明显变扁或变长
3. 场景看起来像被横向压缩/纵向拉伸

则说明项目没有正确处理相机 resize，或者正交视锥没有正确重算。

## 10. 结论

后续凡是：

1. 需要在平台 workspace 中切换预览比例
2. 需要兼容 desktop / mobile / tablet
3. 使用任意类型主相机

都必须把“camera resize 正确响应”视为必做项。

其中：

1. 透视相机至少要正确响应 engine / viewport resize
2. 正交相机还必须重算正交视锥

一句话总结：

- 所有相机都必须正确响应 resize
- 正交相机还必须避免把裁切问题做成拉伸问题
