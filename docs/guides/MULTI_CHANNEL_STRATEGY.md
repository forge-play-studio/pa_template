# 多渠道策略与实现说明

## 文档状态

本文档是从具体 playable 项目沉淀出的多渠道投放参考策略，不是当前 `pa_template` 已完整内置的能力清单。

当前 pa_template 已具备：

- `LOCALE`
- `CHANNEL`
- `__LOCALE__`
- `__CHANNEL__`
- 最小 HTML `lang/dir` 注入

当前 pa_template 尚未内置：

- `appConfig.i18n.channels`
- `TRACKING`
- `analyticsPlugin`
- `molocoCtaPlugin`
- `src/i18n/index.ts`
- `Game.openUrlLikeSsd()`

如果项目需要完整多渠道投放体系，应把本文作为接入参考，并按项目实际渠道矩阵迁入对应配置、Vite 插件和 CTA 桥接入口。

## 1. 目的

本文档整理 playable 项目在 `multi-channel playable` 场景下的渠道策略，不关注“怎么执行打包命令”，而关注：

- 不同渠道的差异点是什么
- 这些差异在项目里落在哪一层实现
- 新增渠道时应该按什么思路接入

完整多渠道项目的策略本质上是：

- 用同一套游戏逻辑
- 在构建阶段按渠道注入不同的宿主兼容、埋点能力和局部 HTML 行为
- 将渠道差异收敛在 `Vite 插件 + 运行时 CTA 桥接` 两层

---

## 2. 参考渠道矩阵

参考配置可来源于 `package.json` 的 `appConfig.i18n.channels`。

### 2.1 tracked 渠道

- `applovin`
- `unity`

策略：

- 构建时注入渠道 SDK
- 产物命名为 `tracked`
- 运行时允许调用 `window.playableAnalytics`

### 2.2 untracked 渠道

- `applovin`
- `facebook`
- `google`
- `moloco`
- `tiktok`
- `unity`
- `snapchat`

策略：

- 默认不注入 analytics SDK
- 主要依赖平台宿主能力或只满足平台校验要求
- 产物命名为 `untracked`

### 2.3 语言矩阵

参考项目实际构建语言：

- `EN`
- `KR`
- `VN`

其中：

- `EN` 是多语言合包默认入口
- `KR`、`VN` 是独立单语言包

---

## 3. 渠道差异的四个核心维度

参考项目里，渠道差异主要集中在以下四个维度。

### 3.1 埋点策略

问题：

- 这个渠道是否需要在构建时注入 SDK？
- 是否允许游戏代码主动调用统一埋点接口？

参考项目实现：

- 在 `vite.config.ts` 中通过 `TRACKING` 控制是否启用 `analyticsPlugin`
- 在 `vite-plugins/analytics/index.ts` 中按 `adNetwork` 选择 SDK 文件

实现结论：

- `tracked` 渠道：构建时注入 SDK
- `untracked` 渠道：默认不注入 SDK

### 3.2 CTA 打开策略

问题：

- 点击 CTA 后，应该由谁来跳转商店？
- 是直接 `window.open`，还是走宿主桥接 API？

参考项目实现：

- `src/core/Game.ts` 中统一通过 `openUrlLikeSsd()` 处理
- 调用顺序是：
  1. `super_html.download(url)`
  2. `mraid.open(url)`
  3. `window.open(url, '_blank')`

实现结论：

- 游戏逻辑层不针对每个渠道分别写一套 CTA
- 统一走宿主桥接优先、浏览器兜底的策略

### 3.3 宿主兼容策略

问题：

- 某些渠道会要求 HTML 中存在固定的全局函数或对象
- 这些要求往往不是玩法逻辑，而是“平台校验要求”

参考项目实现：

- 放在 Vite 插件层处理，而不是写进游戏逻辑
- 例如：Moloco 要求 `FbPlayableAd.onCTAClick()`

实现结论：

- 宿主兼容属于 `HTML 注入策略`
- 不应污染 `Game` 业务层

### 3.4 区域商店链接策略

问题：

- 不同语言/地区可能要跳转不同商店链接
- 某些渠道可能要求固定打开方式

参考项目实现：

- `package.json` 中 `appConfig.i18n.storeLinks` 按 `region` 分组
- `src/i18n/index.ts` 中 locale 元数据带有 `region`
- `vite-plugins/locale.ts` 会把对应商店信息注入到 HTML

实现结论：

- 商店链接本质上属于 `locale/region` 策略，不是纯渠道策略
- 但 `unity` 这类渠道会直接消费它

---

## 4. 推荐渠道实现分层

建议把完整多渠道项目的实现理解为三层。

### 4.1 配置层

位置：`package.json`

负责：

- 定义语言列表
- 定义 tracked / untracked 渠道集合
- 定义商店链接
- 定义命名规则

这一层决定“构建矩阵是什么”。

### 4.2 构建适配层

位置：`vite.config.ts` + `vite-plugins/*`

负责：

- 按 `CHANNEL` 和 `TRACKING` 启用不同插件
- 注入 analytics SDK
- 注入 locale 相关 HTML 行为
- 注入 Moloco 这类渠道兼容代码

这一层决定“HTML 和运行时环境长什么样”。

### 4.3 运行时桥接层

位置：`src/core/Game.ts`

负责：

- 调用统一 CTA 接口
- 尝试桥接宿主 API
- 做浏览器 fallback

这一层决定“游戏点击 CTA 时如何落到宿主环境”。

---

## 5. 参考渠道策略总结

以下是参考项目中每类渠道的实际策略。

### 5.1 AppLovin

策略：

- 支持 `tracked` 和 `untracked` 两类产物
- `tracked` 时注入 AppLovin analytics SDK
- `untracked` 时不注入 SDK，但仍保留统一 CTA 桥接能力

实现位置：

- `vite-plugins/analytics/index.ts`
- `src/core/Game.ts`

适用场景：

- 同一渠道需要同时支持“带埋点版”和“纯素材版”

### 5.2 Unity

策略：

- 支持 `tracked` 和 `untracked` 两类产物
- `tracked` 时注入 Unity SDK
- HTML 中额外注入 `window.__STORE_LINKS__` 和 `window.openStore`
- 商店链接根据 `locale.region` 选择 global / vn

实现位置：

- `vite-plugins/analytics/index.ts`
- `vite-plugins/locale.ts`
- `src/core/Game.ts`

关键点：

- Unity 不只是埋点差异，还带有渠道特定的商店打开方式

### 5.3 Moloco

策略：

- 当前作为 `untracked` 渠道构建
- 默认不注入 analytics SDK
- 但需要满足宿主校验要求：HTML 中必须存在 `FbPlayableAd.onCTAClick()`
- 同时需要提供 `super_html.download`，使 CTA 流程能对齐可通过版本

实现位置：

- `vite-plugins/molocoCta.ts`
- `vite.config.ts`
- `src/core/Game.ts`

关键点：

- Moloco 的差异重点不在“游戏逻辑”，而在“HTML 全局函数兼容”
- 这是典型的渠道校验适配场景

### 5.4 Facebook / Google / TikTok / Snapchat

策略：

- 当前都作为 `untracked` 渠道构建
- 不注入 SDK
- 依然复用统一 CTA 桥接逻辑

实现位置：

- `src/core/Game.ts`
- `vite.config.ts`

参考项目当前状态：

- 这些渠道在项目里主要还是“命名和构建分流”
- 还没有像 Moloco 那样单独的 HTML 宿主兼容插件

---

## 6. 完整多渠道项目中“渠道策略”如何落地

### 6.1 构建时通过环境变量切换

构建侧统一使用：

- `LOCALE`
- `CHANNEL`
- `TRACKING`

这些变量会进入 `vite.config.ts`，从而影响：

- 是否注入 analytics
- 是否启用 Moloco CTA 插件
- 是否注入 Unity store script
- locale alias 走 global 还是 single 资源

### 6.2 运行时通过 compile-time 常量读取当前渠道

在 `vite.config.ts` 中通过 `define` 注入：

- `__CHANNEL__`
- `__LOCALE__`

在 `src/i18n/index.ts` 中统一暴露：

- `CURRENT_CHANNEL`
- `BUILD_LOCALE`

这样运行时逻辑只消费统一常量，不直接读环境变量。

### 6.3 CTA 统一入口

运行时 CTA 不是按渠道散落在各处，而是集中在：

- `Game.handleCtaClick()`
- `Game.openUrlLikeSsd()`

这是完整多渠道项目最重要的渠道隔离点之一。

---

## 7. 推荐的渠道接入策略

如果以后继续扩渠道，建议按下面顺序判断，而不是直接改游戏逻辑。

### 第一步：判断这个渠道属于哪一类

先问四个问题：

1. 这个渠道要不要内置 SDK？
2. 这个渠道有没有特殊 CTA 打开要求？
3. 这个渠道有没有固定的 HTML 全局函数校验？
4. 这个渠道是否需要特殊商店链接或地区跳转？

### 第二步：按差异类型决定落点

如果是以下差异，建议落点如下：

- `是否注入埋点` → `vite-plugins/analytics/index.ts`
- `HTML 全局函数要求` → 新增专用 Vite 插件
- `商店链接注入` → `vite-plugins/locale.ts`
- `CTA 调用顺序` → `src/core/Game.ts`
- `命名和矩阵归类` → `package.json`

### 第三步：不要让渠道逻辑污染玩法系统

不推荐的做法：

- 在 UI button 点击里硬编码渠道判断
- 在多个 manager 里到处写 `if (channel === 'xxx')`
- 把宿主接口要求直接写进 gameplay 逻辑

推荐的做法：

- 渠道差异优先收口到构建层和 CTA 桥接层

---

## 8. 新增渠道时的实现模板

新增渠道时，建议按以下步骤实现。

### 8.1 在配置层登记渠道

修改 `package.json`：

- 先决定它属于 `tracked` 还是 `untracked`
- 加到对应数组中

判断标准：

- 如果项目侧需要主动注入 SDK，放 `tracked`
- 如果平台自行处理或只要求素材结构，放 `untracked`

### 8.2 扩展 channel 类型

修改：

- `src/i18n/index.ts` 的 `Channel`
- `vite-plugins/analytics/index.ts` 的 `AdNetwork`（如果它需要 SDK）

### 8.3 判断是否需要专用 HTML 插件

以下情况建议新增 `vite-plugins/<channel>*.ts`：

- 平台要求固定全局函数
- 平台要求固定对象结构
- 平台要求预注入脚本桥接层

Moloco 就属于这一类。

### 8.4 判断是否要修改 CTA 桥接逻辑

如果新渠道要求 CTA 通过新的宿主对象打开，例如：

- `window.SomeSdk.openStore()`

则需要在 `Game.openUrlLikeSsd()` 中补入新的优先级分支。

原则：

- 只改统一入口，不要改各处按钮行为

### 8.5 验证方式

每个新渠道至少做两类验证：

- `静态验证`
  - 最终 HTML 是否包含要求的全局对象/函数
- `运行时验证`
  - 点击 CTA 是否实际命中平台要求的桥接 API

---

## 9. 完整多渠道项目最重要的实现约束

为了让多渠道继续可维护，建议保持以下约束。

### 9.1 渠道差异优先放构建层

优先考虑：

- Vite 插件注入
- HTML 兼容层

而不是改游戏逻辑。

### 9.2 运行时只保留一个 CTA 桥接入口

参考入口是：

- `src/core/Game.ts` 的 `openUrlLikeSsd()`

后续新增渠道时也应继续复用这个入口。

### 9.3 语言和渠道不要混成一个维度

参考项目做得比较清楚：

- `locale` 负责文案、图片、商店分区
- `channel` 负责宿主差异、埋点差异、HTML 校验差异

这个边界应继续保持。

### 9.4 平台校验要求要显式文档化

像 Moloco 这种要求：

- `FbPlayableAd.onCTAClick()`

必须写进渠道文档或专用插件注释里，避免下次被误删。

---

## 10. 总结

完整多渠道项目的策略可以概括为：

- 用 `package.json` 定义渠道矩阵
- 用 `vite.config.ts` 选择渠道能力
- 用 `vite-plugins/*` 处理 SDK 注入和 HTML 宿主兼容
- 用 `Game.openUrlLikeSsd()` 统一承接运行时 CTA

因此，多渠道实现不是“每个渠道写一份游戏”，而是：

- 相同玩法逻辑
- 不同构建期适配
- 少量运行时桥接

这是从参考项目中沉淀出的渠道架构策略。
