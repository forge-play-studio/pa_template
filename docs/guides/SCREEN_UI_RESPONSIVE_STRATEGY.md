# Screen UI Responsive Strategy

## 文档状态

本文档总结 `sword_craft_story` 中屏幕 UI 自适应的实现方式，作为 `pa_template` 新项目处理 HUD、按钮、摇杆、世界悬浮 UI 时的参考策略。

它不是当前 `pa_template/` 已完整内置的 UI 框架。当前 pa_template 只提供基础运行时和相机 resize 规则；具体屏幕 UI 布局仍应按项目需求接入。

## 1. 核心结论

`sword_craft_story` 有屏幕 UI 自适应能力，但它不是单独封装成一个通用服务。

实际方案由四层组成：

1. DOM UI 直接挂到 `document.body`
2. CSS 使用 `vw / vh / clamp / media query / CSS variables`
3. 关键 UI 用 JS 根据 `window.innerWidth / innerHeight` 动态计算缩放
4. 世界空间 UI 用 Babylon 投影到屏幕坐标

同时，渲染层通过 `engine.resize()`、DPR 限制和正交相机视锥重算，保证 canvas 本身在比例切换时正确。

## 2. UI 类型划分

参考项目中的屏幕 UI 大致分成四类：

1. 固定屏幕 HUD
2. 品牌区和 CTA 按钮
3. 触摸输入 UI
4. 世界对象悬浮 UI

### 固定屏幕 HUD

代表实现：

1. `src/ui/Hud.ts`
2. `src/ui/styles.css`

包含：

1. 金币显示
2. 满载提示
3. idle 操作引导
4. 特定 locale 的合规图片

### 品牌区和 CTA 按钮

代表实现：

1. `Hud.updateBrandingLayout()`
2. `.hud-branding`
3. `.play-now-btn`

它根据 logo 原始宽高、视口宽高和按钮比例动态计算容器宽度。

### 触摸输入 UI

代表实现：

1. `src/ui/VirtualJoystick.ts`
2. `.joystick`

摇杆不固定在某个角落，而是在 `pointerdown` 的位置出现，因此天然适配不同屏幕尺寸和手指落点。

### 世界对象悬浮 UI

代表实现：

1. `src/ui/CustomerBubble.ts`
2. `src/ui/DamageNumberManager.ts`

这类 UI 不固定在屏幕某处，而是把 3D 世界坐标投影到当前相机 viewport 的 CSS 像素坐标。

## 3. DOM UI 基础策略

项目没有使用 Babylon GUI 作为主要屏幕 UI，而是使用 DOM。

典型创建方式：

```ts
const el = document.createElement('div');
document.body.appendChild(el);
```

优点：

1. CSS 适合做响应式布局
2. 图片按钮和文案样式容易控制
3. 多语言图片和 RTL 可以直接走浏览器布局能力
4. 不需要把所有 HUD 都塞进 Babylon scene

需要注意：

1. DOM UI 要自己处理 z-index
2. DOM UI 与 canvas 的坐标对齐需要使用 CSS 像素
3. 世界空间 UI 必须在每帧或状态变化时重新投影

## 4. CSS 自适应策略

`src/ui/styles.css` 使用了多种响应式手段。

### 视口单位

典型用法：

```css
.hud-branding {
  left: 3vw;
  top: 2vh;
}
```

适合：

1. 边距随屏幕变化
2. 品牌区和 CTA 不写死像素位置

### `clamp`

典型用法：

```css
.kr-prob {
  width: clamp(120px, 20vw, 220px);
}
```

以及：

```css
:root {
  --damage-font-size: clamp(18px, calc(1.5vw + 2.86vh), 34px);
}
```

适合：

1. 给字体和图片设置最小/最大尺寸
2. 避免小屏过小、大屏过大

### media query

项目对 customer bubble 做了桌面/移动端分支：

```css
@media (max-width: 768px) {
  :root {
    --bubble-width: clamp(64px, 14vw, 96px);
    --bubble-height: clamp(48px, 10.5vw, 72px);
    --bubble-font-size: clamp(11px, 3.2vw, 16px);
  }
}
```

```css
@media (min-width: 769px) {
  :root {
    --bubble-width: clamp(72px, 8vw, 110px);
    --bubble-height: clamp(54px, 6vw, 84px);
    --bubble-font-size: clamp(12px, 1.6vw, 18px);
  }
}
```

适合：

1. 同一 UI 在手机和桌面上使用不同视觉尺寸
2. 保持世界悬浮 UI 在不同屏幕上的可读性

## 5. JS 动态缩放策略

`Hud.ts` 中有三类动态布局计算。

### HUD 缩放

`updateHudScale()` 使用视口短边计算 HUD 缩放：

```ts
const vmin = Math.min(window.innerWidth, window.innerHeight);
const baseScale = Math.min(2.5, Math.max(1.0, vmin * 0.0035));
this.container.style.setProperty('--hud-scale', `${baseScale}`);
```

特点：

1. 以短边为基准
2. 设置最小值和最大值
3. 通过 CSS variable 驱动实际 transform

### 品牌区布局

`updateBrandingLayout()` 根据视口和 logo 原始比例计算宽度：

1. 最大宽度是 `viewportWidth * 0.35`
2. 最大高度是 `viewportHeight / 4`
3. 同时考虑 logo 和 button 的比例
4. 最终写入 `brandingContainer.style.width`

这个方案解决的问题是：

1. logo 和 CTA 作为一组整体缩放
2. 不让品牌区超过屏幕高度上限
3. 不让宽屏下品牌区过大

### Idle Hint 缩放

`updateIdleHintScale()` 根据 hint 轨迹图和文字图整体尺寸计算 scale。

核心约束：

1. 最大宽度是 `viewportWidth * 0.35`
2. 最大高度是 `viewportHeight / 4`
3. 基础尺寸包含轨迹图、文字图和间距

这保证操作引导在不同屏幕上不会遮挡太多游戏区域。

## 6. Resize 触发链

`Hud` 在构造时注册 window resize：

```ts
window.addEventListener('resize', this.brandingResizeHandler);
```

resize 时更新：

1. branding layout
2. HUD scale
3. idle hint scale

销毁时移除监听：

```ts
window.removeEventListener('resize', this.brandingResizeHandler);
```

这个模式适合所有 DOM HUD：

1. 初始化时算一次
2. 图片加载完成后再算一次
3. window resize 后重新算
4. dispose 时清理 listener

## 7. 世界坐标投屏 UI

`CustomerBubble` 和 `DamageNumberManager` 都使用 Babylon 投影。

关键步骤：

1. 获取 active camera
2. 获取 canvas CSS 尺寸
3. 用 `camera.viewport.toGlobal(cssWidth, cssHeight)` 得到 viewport
4. 用 `Vector3.Project(...)` 投影世界坐标
5. 把结果写入 DOM 的 `left / top`

示意：

```ts
const cssWidth = canvas?.clientWidth ?? engine.getRenderWidth();
const cssHeight = canvas?.clientHeight ?? engine.getRenderHeight();
const viewport = camera.viewport.toGlobal(cssWidth, cssHeight);
const projected = Vector3.Project(position, Matrix.Identity(), scene.getTransformMatrix(), viewport);
```

注意点：

1. 使用 `clientWidth / clientHeight`，不是只用 render buffer 尺寸
2. 投影结果是 CSS 像素，适合直接写 DOM
3. `projected.z` 不在可见范围时隐藏 UI

这类 UI 会跟随相机、canvas 尺寸和设备比例变化。

## 8. 摇杆适配策略

`VirtualJoystick` 的自适应来自交互设计：

1. 监听全屏 `pointerdown`
2. 在用户按下的位置创建摇杆 base
3. thumb 在固定半径内移动
4. `pointerup / pointercancel` 后隐藏

它不依赖固定屏幕角落，因此：

1. 横屏/竖屏都可用
2. 不需要单独适配安全区
3. 玩家手指在哪里，摇杆就在哪里

限制：

1. 半径固定为 `60`
2. 摇杆视觉尺寸固定为 `140px`
3. 如果项目需要小屏/大屏不同手感，需要进一步把半径和尺寸参数化

## 9. RTL 布局支持

UI 自适应还包含 RTL 方向适配。

`styles.css` 使用：

```css
[dir="rtl"] .hud {
  right: auto;
  left: 16px;
  transform-origin: top left;
}
```

以及：

```css
[dir="rtl"] .hud-branding {
  left: auto;
  right: 3vw;
}
```

含义：

1. locale 系统设置 `<html dir="rtl">`
2. CSS 根据 `dir` 自动切换 HUD 和 branding 方向
3. 不需要业务代码判断 Arabic

## 10. 和相机 resize 的关系

屏幕 UI 自适应不只看 DOM。

`sword_craft_story` 还做了 canvas 和相机 resize：

1. `Game.setupResizeHandler()` 中执行 `handleDevicePixelRatio()` 和 `engine.resize()`
2. `SceneBuilder.createCamera()` 中注册 `engine.onResizeObservable`
3. resize 后重新计算正交相机的 `orthoLeft / orthoRight / orthoTop / orthoBottom`

这保证：

1. 3D 场景不会拉伸
2. 世界坐标投屏 UI 的投影基础正确
3. DOM 悬浮 UI 和 canvas CSS 尺寸一致

如果只做 DOM 响应式，不处理相机 resize，世界悬浮 UI 仍可能错位。

## 11. 当前方案的边界

这套方案没有做成完整通用 UI Layout System。

当前没有看到：

1. 统一 safe-area inset 管理
2. 统一 UI anchor schema
3. 统一 breakpoint 配置文件
4. 统一 UI layout service
5. 所有 UI 组件的可配置化布局

它更像是项目级响应式实践：

1. 通用规则放 CSS
2. 复杂比例计算放组件内部
3. 世界 UI 用投影
4. 相机 resize 保证基础坐标正确

## 12. 新项目接入建议

如果要把这套能力迁入新项目，建议按以下顺序：

1. 先确认 canvas resize 和相机 resize 正确
2. 用 DOM 实现屏幕 HUD，而不是一开始就做复杂 Babylon GUI
3. 把全局 UI 样式集中到 `src/ui/styles.css`
4. 固定屏幕 UI 优先用 `vw / vh / clamp`
5. 复杂成组 UI 用 JS 计算 scale 并写 CSS variable
6. 世界悬浮 UI 使用 `Vector3.Project` 投影到 CSS 像素
7. 多语言方向适配使用 `[dir="rtl"]` CSS override
8. 所有 resize listener 必须在 dispose 时清理

## 13. 验收清单

最少验证：

1. 桌面横屏下 HUD、logo、CTA 不超出屏幕
2. 手机竖屏下 HUD、logo、CTA 不遮挡核心玩法区域
3. 平板比例下 idle hint 不过大
4. 世界悬浮 UI 在相机 resize 后仍对齐目标
5. damage number 投屏位置和世界目标一致
6. 虚拟摇杆在任意触摸点能正确出现和隐藏
7. Arabic / RTL 包下 HUD 方向切换正确
8. resize 多次后没有重复 listener 或残留 DOM

## 14. 适合沉淀的能力

后续如果要把这套能力沉淀到 `pa_template`，建议不要直接复制整个 `Hud`。

更适合抽象的是：

1. `ResponsiveHudScale`：根据 viewport 计算 CSS scale
2. `WorldToScreenDomAnchor`：把世界坐标投影为 DOM 坐标
3. `ResponsiveBrandingLayout`：按 logo/button 比例计算品牌区尺寸
4. `RtlLayoutRules`：统一约定 `[dir="rtl"]` override
5. `FloatingJoystick`：把摇杆半径、尺寸、deadzone 参数化

这些能力可以先作为项目内工具，复用稳定后再进入 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities)。
