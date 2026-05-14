# Runtime Audio Strategy

## 文档状态

本文档总结 `sword_craft_story` 中音频处理的通用经验，并说明当前 `pa_template/` 中音频能力的设计边界。

音频能力属于 pa_template 的通用运行时基础设施，默认放在 `src/services/AudioService.ts`。它不是具体游戏 ability，也不应该内置 `coin / harvest / unlock` 这类玩法语义。

## 1. 核心结论

`pa_template` 应内置一套通用音频服务，负责：

1. BGM 播放和暂停
2. SFX one-shot 播放
3. 浏览器用户交互解锁
4. BGM 与 SFX 分组音量
5. SFX 冷却，避免高频重复触发
6. SFX 并发声道上限，避免同类音效堆叠失控
7. WebAudio 播放失败时回退到 HTMLAudio
8. 游戏销毁时清理音频状态

它不负责：

1. 定义具体游戏有哪些音效
2. 决定哪个 gameplay 事件触发哪个音效
3. 把音频和某个实体、系统或 UI 强绑定
4. 依赖 Babylon Audio 子模块

## 2. Template 当前接口

音频资源入口在 `pa_template/src/assets/index.ts`：

```ts
export const SoundAssets = {
  bgm: silentWav,
  sfx: {},
};
```

项目接入真实音频时，应注册任意业务自定义 SFX ID：

```ts
import bgm from './sound/bgm.mp3?url';
import tap from './sound/tap.mp3?url';
import hit from './sound/hit.mp3?url';

export const SoundAssets = {
  bgm,
  sfx: {
    tap,
    hit,
  },
};
```

业务层播放时使用同一个字符串 ID：

```ts
audioService.play('tap');
audioService.play('hit', { playbackRate: 1.1, volume: 0.8 });
```

这样 pa_template 保持通用，具体项目只在资源映射和业务触发点中引入自己的命名。

## 3. 为什么不使用具体 SFX union

不要在 pa_template 中写：

```ts
export type SfxType = 'coin' | 'harvest' | 'unlock';
```

原因：

1. 这些名字来自具体游戏，不是通用脚手架能力
2. 每个项目都要改 union、列表、音量、冷却和并发配置，扩展成本高
3. pa_template 会暗示新项目必须沿用旧项目音效语义
4. 音频服务的职责是播放，不是定义玩法事件

推荐使用：

```ts
export type SfxId = string;
```

并通过 `SoundAssets.sfx` 控制哪些 ID 实际可播放。

## 4. 用户交互解锁

Web 游戏必须处理音频解锁。移动 Safari、iOS 内嵌浏览器和部分广告容器要求音频播放必须由用户手势触发。

`AudioService` 应监听：

1. `pointerdown`
2. `touchstart`
3. `click`
4. `keydown`

首次交互后执行：

1. 标记 `audioUnlocked = true`
2. resume WebAudio `AudioContext`
3. prime 一次静音 buffer，降低后续首次 SFX 延迟
4. 尝试播放 BGM

业务层不应该绕过 `AudioService` 自己调用 `new Audio().play()`，否则会重新遇到解锁和兼容性问题。

## 5. BGM 策略

BGM 适合用 `HTMLAudioElement`：

1. `loop = true`
2. `preload = 'auto'`
3. 独立 `bgmVolume`
4. `playBGM()` 只在已解锁后执行
5. `stopBGM()` 只暂停，不销毁

默认 pa_template 提供静音 BGM 占位，目的是让启用音频时不会因为缺资源而报错。真实项目应替换为实际 BGM，或者显式设置为空字符串并接受无 BGM。

## 6. SFX 策略

SFX 适合优先使用 WebAudio buffer：

1. loading 阶段加载和解码 SFX
2. 运行时用 `AudioBufferSourceNode` 播放 one-shot
3. 每次播放都创建新的 source
4. 每个 source 接一个 gain node，用于单次音量倍率
5. WebAudio 不可用或播放失败时回退 HTMLAudio

HTMLAudio fallback 的作用：

1. 兼容 WebAudio 初始化失败的浏览器
2. 支持低要求项目直接播放
3. 避免音频能力因为一个平台限制完全失效

## 7. 冷却和并发

从 `sword_craft_story` 的经验看，短音效很容易因为玩法事件高频触发而叠爆。

常见高频来源：

1. 挖矿、打击、攻击
2. 连续拾取
3. 多对象同时触发碰撞
4. UI 连点

pa_template 应提供默认保护：

1. 同一个 SFX ID 默认冷却 `300ms`
2. 同一个 SFX ID 默认最多 `4` 个并发 source
3. 超过并发上限时停止最旧 source，优先保证新反馈即时播放

项目如果需要更密集的打击音，可以按 ID 调整冷却和并发上限，但不要默认让所有音效无限叠加。

## 8. 播放参数

`AudioService.play()` 支持单次播放参数：

```ts
audioService.play('hit', {
  playbackRate: 1.2,
  volume: 0.7,
});
```

适合：

1. 升级后调整打击节奏
2. 同一个音效做轻微 pitch 变化
3. 按事件强度调整单次音量
4. 避免为每个力度准备一份资源

注意：

1. `volume` 是相对 SFX 主音量的倍率
2. HTMLAudio 的最终音量会被限制在 `0..1`
3. 改变 `playbackRate` 时应关闭 pitch preserve，让音高跟随速度变化

## 9. 业务接入边界

推荐边界：

1. `AudioService` 只提供通用播放能力
2. `SoundAssets` 只注册资源 URL
3. `Game / Controller` 决定业务事件到 SFX ID 的映射
4. `Entity / System` 尽量暴露事件，不直接持有音频服务

例如 Sword 中玩家锤击不是在 Player 内直接播放音频，而是由 Player 暴露 callback，再由 Game 调用音频服务。这个模式更适合复用：

```ts
player.setOnActionLoop(() => {
  audioService.play('action_loop', { volume: 0.8 });
});
```

这样实体逻辑不会依赖具体音频系统，也方便项目替换声音或禁用音频。

## 10. 生命周期

`AudioService.dispose()` 必须处理：

1. 移除解锁监听器
2. 暂停 BGM
3. 暂停 HTMLAudio fallback
4. 停止活跃 WebAudio sources
5. 清空 buffer 和加载 promise
6. 断开 gain node
7. 关闭 AudioContext

Playable 广告和内嵌容器经常会复用页面或重复初始化，如果不清理，容易出现切换后仍有声音、重复监听、内存泄漏等问题。

## 11. 从 Sword 提炼的可复用点

`sword_craft_story` 中值得保留为通用策略的点：

1. 统一服务管理 BGM 和 SFX
2. 资源统一从 assets 入口导出
3. 用户交互后再播放
4. BGM 与 SFX 分离音量
5. 高频短音效做冷却
6. 高频音效使用并发声道池或 WebAudio source 上限
7. 单次播放支持 `playbackRate` 和 `volume`
8. gameplay 事件和音频播放解耦
9. dispose 时主动停止和释放

不应该带入 pa_template 的点：

1. 具体音效名
2. 某个玩法的音量倍率
3. 某个角色动作的音效频率
4. 某个项目的资源文件名

## 12. 总结

pa_template 的音频能力应该是“可播放任意注册音效”的基础设施，而不是“某个游戏的音效列表”。

正确边界是：

1. pa_template 内置通用 `AudioService`
2. pa_template 提供 `SoundAssets.sfx` 空注册表
3. 项目自己注册 SFX ID 和资源
4. 业务 controller 决定何时播放哪个 ID
5. 音频服务统一处理解锁、冷却、并发、fallback 和 dispose
