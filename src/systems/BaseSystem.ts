/**
 * BaseSystem (Scaffold)
 *
 * System 的推荐形态：
 * - 纯逻辑（尽量少直接操作 UI/DOM）
 * - 持有自己的状态
 * - 通过事件/回调对外暴露
 */

export interface BaseSystem {
  update(deltaTime: number): void;
  dispose(): void;
}
