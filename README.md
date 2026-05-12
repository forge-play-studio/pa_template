# Babylon.js 3D 试玩广告模板

基于 Babylon.js 的 3D playable ad 起步项目。构建产物是**单文件 HTML**，可直接投放到主流广告平台。

## 快速开始

```bash
pnpm install      # 或 npm install / yarn
pnpm dev          # 本地开发，自动打开浏览器
pnpm build        # 构建 → dist/index.html（单文件，所有资源 inline）
```

## 你需要改的地方

- `src/main.ts` — 顶部 `CTA_URL` 改成你的应用商店链接
- `src/scene.ts` — 替换占位舞台为你的资产与场景
- `src/game.ts` — 替换占位玩法为真实的胜负判定
- `src/ui/cta.ts` / `src/ui/end-card.ts` — CTA 文案与端卡样式
- `index.html` `<title>` 与 meta 信息

## 结构

```text
src/
├── main.ts            入口，串场景 / UI / 主循环
├── scene.ts           Babylon 场景：相机、光照、地面、主角
├── game.ts            玩法逻辑骨架 + 事件 (win/lose/progress/cta)
├── ui/
│   ├── cta.ts         屏底常驻 CTA 按钮
│   └── end-card.ts    成功 / 失败结算页
└── utils/
    ├── resize.ts      响应窗口尺寸 + DPR
    └── emitter.ts     轻量事件总线
scripts/
└── check-bundle-size.mjs   构建后检查产物体积 (> 5MB 告警)
```

## 体积约束

主流 playable ad 平台对单文件大小有限制：

| 平台 | 限制 |
| --- | --- |
| Meta (Facebook) | 5 MB |
| Google Ads | 5 MB |
| TikTok | 5 MB |
| Unity Ads | 5 MB |

构建命令会在产物超过 5 MB 时告警（不阻断构建）。要真正过审需要进一步压缩：

- 启用 Babylon 的 tree-shaking（按需 import 子模块，已示范）
- 纹理走 KTX2 / Basis，几何走 Draco
- 移除调试用的 Inspector 模块

## 横竖屏适配

`src/utils/resize.ts` 同时监听 `resize` / `orientationchange` / `ResizeObserver`，覆盖：

- 桌面浏览器窗口拖拽
- 移动端旋转
- iOS Safari URL 栏收起 / 展开导致的可视高度变化
