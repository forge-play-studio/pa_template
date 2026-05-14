# Multi Language Strategy

## 文档状态

本文档总结 `sword_craft_story` 的多语言能力设计，作为 `pa_template` 新项目接入多语言时的参考策略。

它不是当前 `pa_template/` 已完整内置的能力清单。当前 pa_template 只保留最小的 `LOCALE / CHANNEL` 构建常量和 HTML `lang / dir` 注入能力。

如果项目需要完整多语言能力，应按本文从 `package.json`、`vite.config.ts`、`src/i18n`、本地化图片资源和渠道商店链接几个层面组合接入。

## 1. 核心目标

`sword_craft_story` 的多语言能力解决四类问题：

1. 构建时决定当前产物语言
2. 多语言合包时按浏览器语言运行时选择 locale
3. 文案和图片资源按 locale 切换
4. HTML `lang / dir` 和渠道商店链接按 locale/region 注入

它不是只做文本翻译表，而是一套 `build-time + runtime` 混合方案。

## 2. 配置入口

多语言主配置放在 `package.json` 的 `appConfig.i18n`。

关键字段：

1. `buildVersions`
2. `locales`
3. `storeLinks`
4. `channels`

### `buildVersions`

`buildVersions` 决定构建矩阵。

参考项目中：

```json
["EN", "KR", "VN"]
```

约定：

1. 第一项是默认构建，也是多语言合包入口
2. 后续项是独立单语言包
3. 参考项目里 `EN` 是 global 合包，`KR / VN` 是独立包

### `locales`

`locales` 定义每个 locale 的元数据：

1. `htmlLang`
2. `isRTL`
3. `region`

参考项目支持：

1. `EN`
2. `KR`
3. `VN`
4. `RU`
5. `JP`
6. `AR`
7. `FR`
8. `DE`
9. `ES`
10. `TW`

其中 `AR` 标记为 RTL，`VN` 使用 `vn` region，其它大多使用 `global` region。

### `storeLinks`

`storeLinks` 按 region 分组，而不是按 locale 逐个重复配置。

参考项目使用：

1. `global`
2. `vn`

这样 `VN` 可以使用越南专用商店链接，其它语言复用 global 链接。

## 3. 构建时注入

`vite.config.ts` 从环境变量和 `package.json` 计算当前构建。

输入环境变量：

1. `LOCALE`
2. `CHANNEL`
3. `TRACKING`

多语言相关 compile-time 常量：

1. `__LOCALE__`
2. `__CHANNEL__`
3. `__RTL__`
4. `__MULTI_LOCALE__`
5. `__BUNDLED_LOCALES__`

构建规则：

1. `LOCALE` 默认是 `EN`
2. `LOCALE === buildVersions[0]` 时视为多语言合包
3. 多语言合包包含所有非 dedicated locale
4. dedicated locale 只包含自身

参考项目中：

1. `EN` 合包包含 `EN / RU / JP / AR / FR / DE / ES / TW`
2. `KR` 单独构建
3. `VN` 单独构建

## 4. 运行时 Locale 解析

`src/i18n/index.ts` 是运行时主入口。

它提供：

1. `BUILD_LOCALE`
2. `CURRENT_CHANNEL`
3. `RESOLVED_LOCALE`
4. `CURRENT_LOCALE`
5. `i18nMeta()`
6. `i18nText()`

### 多语言合包

当 `__MULTI_LOCALE__ === true` 时，运行时会读取：

1. `navigator.languages`
2. `navigator.language`

然后按 `LOCALE_META[*].htmlLang` 匹配当前浏览器语言。

匹配顺序：

1. 完整匹配，例如 `zh-TW`
2. primary subtag 匹配，例如 `ja-JP -> ja`
3. script subtag 归一化，例如 `zh-Hant -> zh-TW`
4. fallback 到 `BUILD_LOCALE`

### 单语言包

当 `__MULTI_LOCALE__ === false` 时：

1. 不做浏览器语言检测
2. `RESOLVED_LOCALE === BUILD_LOCALE`

这保证 `KR / VN` 这类 dedicated 包不会被用户浏览器语言改写。

## 5. 文案系统

文案集中在 `src/i18n/index.ts`：

1. `TextStrings`
2. `TEXT_STRINGS`

业务代码通过 `i18nText()` 读取文案。

典型用法：

```ts
const message = i18nText().needUpgrade;
```

这种方式的优点：

1. 文案 key 是类型约束的
2. 不需要业务模块关心当前 locale
3. 多语言合包和单语言包使用同一套调用方式

## 6. 图片资源系统

参考项目把 UI 图片也纳入多语言体系。

核心入口：

1. `src/assets/localeAssets.global.ts`
2. `src/assets/localeAssets.single.ts`
3. `@locale-assets`
4. `@locale-img`

### `@locale-assets`

`vite.config.ts` 按构建类型切换 `@locale-assets`：

1. 多语言合包指向 `localeAssets.global.ts`
2. 单语言包指向 `localeAssets.single.ts`

业务侧只从统一入口读取：

```ts
import { localeImages } from '@locale-assets';
```

### 多语言合包图片

`localeAssets.global.ts` 会显式 import 合包内所有 locale 图片变体，并根据 `RESOLVED_LOCALE` 在运行时选择。

适合：

1. 默认 global 包
2. 需要运行时跟随浏览器语言变化的图片

### 单语言包图片

`localeAssets.single.ts` 使用 `@locale-img/xxx.png`。

`localePlugin` 会按当前构建 locale 解析图片：

1. 优先找 `src/ui/img/<locale>/<filename>`
2. 找不到则 fallback 到 `src/ui/img/<filename>`

适合：

1. `KR`
2. `VN`
3. 其它不需要合包的单语言产物

## 7. HTML `lang / dir`

`localePlugin` 在构建阶段注入：

1. `<html lang="...">`
2. `dir="rtl"`

运行时在多语言合包中还会根据 `RESOLVED_LOCALE` 再更新一次：

1. `document.documentElement.lang`
2. `document.documentElement.dir`

这样可以同时满足：

1. 单语言包构建时 HTML 元数据正确
2. 多语言合包运行时 HTML 元数据跟随实际浏览器语言

## 8. RTL 支持

RTL 能力由 `isRTL` 驱动。

参考项目中 `AR` 的配置是：

```json
{ "htmlLang": "ar", "isRTL": true, "region": "global" }
```

构建阶段：

1. `__RTL__` 被注入
2. HTML 会带上 `dir="rtl"`

运行时：

1. 多语言合包检测到 `AR` 后设置 `document.documentElement.dir = 'rtl'`

注意：这只解决页面方向元数据和基础布局方向，不等于自动完成所有 UI 镜像。具体游戏 UI 是否要镜像，仍应由项目实现决定。

## 9. Store Link 和 Region

多语言系统同时承担 region 分流。

`i18nMeta()` 返回当前 locale 的 region。

`storeLinks.ts` 根据 region 返回：

1. Android 链接
2. iOS 链接

Unity 渠道比较特殊：

1. 构建时 `localePlugin` 会向 HTML 注入 `window.__STORE_LINKS__`
2. 同时注入 `window.openStore()`
3. 运行时也可以通过 `getStoreUrl()` 获取当前平台链接

原则：

1. locale 决定文案、图片、HTML 语言和 region
2. region 决定商店链接
3. channel 决定是否需要把商店链接硬写进 HTML 宿主兼容层

## 10. 新项目接入步骤

如果要把这套能力迁入新项目，建议按这个顺序：

1. 在 `package.json` 增加 `appConfig.i18n`
2. 在 `vite.config.ts` 读取 `LOCALE / CHANNEL` 并注入 compile-time 常量
3. 增加 `src/i18n/index.ts`
4. 按项目需要增加 `src/i18n/storeLinks.ts`
5. 增加 `vite-plugins/locale.ts`
6. 建立 `src/ui/img/<locale>/` 图片目录
7. 增加 `localeAssets.global.ts / localeAssets.single.ts`
8. 在资源入口统一从 `@locale-assets` 读取本地化图片
9. 业务代码统一通过 `i18nText()` 读取文案
10. 验证多语言合包、单语言包和 RTL 语言

## 11. 验收清单

最少验证：

1. `LOCALE=EN` 构建后能按浏览器语言切换到 global 包内 locale
2. `LOCALE=KR` 构建后不会被浏览器语言改写
3. `LOCALE=VN` 构建后使用 `vn` region 商店链接
4. `AR` 在合包里能设置 `dir="rtl"`
5. 本地化图片优先读取 locale 目录，缺失时 fallback 到根目录
6. `i18nText()` 在所有 locale 下 key 完整
7. Unity 渠道能拿到正确 store link
8. 非 Unity 渠道不强行写死商店跳转逻辑

## 12. 和多渠道文档的关系

[MULTI_CHANNEL_STRATEGY.md](./MULTI_CHANNEL_STRATEGY.md) 关注渠道差异。

本文关注语言和 region 差异。

两者有交集：

1. `CHANNEL` 决定渠道宿主和 analytics
2. `LOCALE` 决定语言、图片和 region
3. `region` 决定商店链接
4. Unity 这类渠道会同时消费 `CHANNEL` 和 `region`

不要把语言和渠道混成同一个维度。新项目应保持：

1. locale 管文案、图片、HTML 语言、region
2. channel 管宿主兼容、埋点、平台校验
3. region 管 store link
