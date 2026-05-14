# Template Implementation Status

本文档记录当前 `pa_template/` 的能力矩阵。

它不是规范本身；规范仍以 [docs/README.md](../README.md) 中的 `Current Template Standards` 为入口。

## Status Legend

| 状态 | 含义 |
| --- | --- |
| Built-in | pa_template 默认内置，新项目复制后应直接具备 |
| Partial | pa_template 有基础入口，但还不是完整产品化能力 |
| Reference | docs 有参考策略，pa_template 不默认内置完整实现 |
| Ability | [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities) 有可选能力，项目按需接入 |
| Not Included | 当前没有正式内置，也没有作为默认接入要求 |

## Capability Matrix

| 能力 | 状态 | 当前说明 | 主要文档 |
| --- | --- | --- | --- |
| 当前 `scene json` 主结构 | Built-in | 已包含 `scene.assets / scene.nodes / scene.materials / scene.textures` | [SCENE_JSON_STANDARD.md](../standards/SCENE_JSON_STANDARD.md) |
| scene config normalization | Built-in | `ConfigService` 会补齐和规范基础 scene 结构 | [SCENE_JSON_STANDARD.md](../standards/SCENE_JSON_STANDARD.md) |
| `sceneNode` persistent binding | Built-in | 编辑器主线不再使用 `sceneInstance` | [SCENE_EDITING_INTEGRATION.md](../standards/SCENE_EDITING_INTEGRATION.md) |
| transform 保存 | Built-in | document 主链支持写回、undo、redo、reload | [SCENE_EDITING_INTEGRATION.md](../standards/SCENE_EDITING_INTEGRATION.md) |
| material 保存 | Built-in | 支持 shared material 和 instance override 分流 | [SCENE_EDITING_INTEGRATION.md](../standards/SCENE_EDITING_INTEGRATION.md) |
| outline 保存 | Built-in | 支持 shared outline 和 instance override 分流 | [SCENE_EDITING_INTEGRATION.md](../standards/SCENE_EDITING_INTEGRATION.md) |
| duplicate / undo / redo | Built-in | `scene.nodes` 写回和 runtime 同步已有主链 | [EDITOR_PACKAGE_INTEGRATION.md](../standards/EDITOR_PACKAGE_INTEGRATION.md) |
| 本地 inspector 注入链 | Built-in | pa_template 有本地 inspector 接入，但仍需 workspace 验证 | [EDITOR_PACKAGE_INTEGRATION.md](../standards/EDITOR_PACKAGE_INTEGRATION.md) |
| 正交相机 resize 重算 | Built-in | window resize 后重算正交视锥 | [CAMERA_RESIZE_STANDARD.md](../standards/CAMERA_RESIZE_STANDARD.md) |
| runtime audio service | Built-in | 通用 BGM/SFX、用户交互解锁、SFX 注册表、WebAudio + HTMLAudio fallback | [RUNTIME_AUDIO_STRATEGY.md](../guides/RUNTIME_AUDIO_STRATEGY.md) |
| input abstraction | Built-in | `InputService` 只提供 `MovementInputSource` 抽象，不内置 joystick UI | [GAME_ARCHITECTURE_STANDARD.md](../standards/GAME_ARCHITECTURE_STANDARD.md) |
| animation service | Built-in | 通用 `AnimationGroup` 播放、停止、速度和基础别名匹配 | [GAME_ARCHITECTURE_STANDARD.md](../standards/GAME_ARCHITECTURE_STANDARD.md) |
| scene VFX service | Built-in | 空配置默认不产生特效，可通过 `gameplay.tuning.sceneVfx` 创建最小粒子系统 | [SCENE_JSON_STANDARD.md](../standards/SCENE_JSON_STANDARD.md) |
| `LOCALE / CHANNEL` 常量 | Partial | 有基础构建常量和最小 HTML `lang / dir` 注入 | [MULTI_LANGUAGE_STRATEGY.md](../guides/MULTI_LANGUAGE_STRATEGY.md) |
| 多语言完整体系 | Reference | 参考 `sword_craft_story`，包含合包、运行时 locale、本地化图片、region store link | [MULTI_LANGUAGE_STRATEGY.md](../guides/MULTI_LANGUAGE_STRATEGY.md) |
| 多渠道完整体系 | Reference | 参考项目策略，包含渠道矩阵、analytics、Moloco/Unity 宿主兼容和 CTA bridge | [MULTI_CHANNEL_STRATEGY.md](../guides/MULTI_CHANNEL_STRATEGY.md) |
| basic economy runtime | Ability | 不内置，按项目从 `pa_abilities/basic-economy` 接入 | [pa_abilities](https://github.com/forge-play-studio/pa_abilities) |
| zone interaction runtime | Ability | 不内置，按项目从 `pa_abilities/zone-interaction` 接入 | [pa_abilities](https://github.com/forge-play-studio/pa_abilities) |
| ground UI runtime | Ability | 不内置，按项目从 `pa_abilities/ground-ui` 接入 | [pa_abilities](https://github.com/forge-play-studio/pa_abilities) |
| virtual joystick runtime wiring | Ability | 不内置，按项目从 `pa_abilities/virtual-joystick` 接入 | [pa_abilities](https://github.com/forge-play-studio/pa_abilities) |
| debug HUD | Ability | 不内置，按项目从 `pa_abilities/debug-hud` 接入 | [pa_abilities](https://github.com/forge-play-studio/pa_abilities) |
| runtime selective outline service | Ability | 不内置，按项目从 `pa_abilities/runtime-selective-outline` 接入 | [pa_abilities](https://github.com/forge-play-studio/pa_abilities) |

## Built-in Scope

pa_template 默认内置的范围应该保持克制：

1. 新项目起步必需的 runtime 骨架
2. 当前 `scene json` 主结构
3. 编辑器保存闭环
4. 基础 resize / render / asset loading 能力
5. 通用 runtime audio 能力
6. 最小构建常量

不要把具体项目玩法、完整投放矩阵或可选 UI/interaction 能力默认塞进 pa_template。

## Project Extension Scope

项目按需扩展时优先选择：

1. `docs/` 的 Reference Strategy
2. [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities) 的可选能力
3. 项目自己的 `src/config / src/services / src/systems / src/ui`

如果某个能力连续在多个项目复用，再考虑沉淀进 [`pa_abilities`](https://github.com/forge-play-studio/pa_abilities)，不应直接默认并入 pa_template。

## Validation

当前最小验证命令：

```bash
cd pa_template
pnpm typecheck
pnpm build
```

完整编辑能力还需要在平台 workspace 中验证：

1. 进入 `Edit`
2. inspector 正常打开
3. 选中 `sceneNode`
4. 修改 transform / material / outline
5. undo / redo
6. save
7. reload 后结果仍在
