import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';

/**
 * 从根到叶强制重算 `node` 及其**全部祖先**的世界矩阵。
 *
 * 确定性护栏(第 9 类非确定源,见 fps-3d-harness `docs/06-record-replay-dual-mode.md` §3)。
 *
 * 在 `update()` 里读一个节点的 `getAbsolutePosition()` / `getWorldMatrix()` /
 * `getBoundingInfo().boundingBox.minimumWorld`,而它的**祖先**在同一 tick 里刚被改过 local
 * transform —— 读到的值取决于 Babylon 的 `_currentRenderId` 缓存,也就是「自上次以来跑过几趟
 * 渲染」这种**渲染管线记账**,不属于仿真状态。实时 render loop 与 `Game.stepFrame()` 落在这个
 * 缓存判断的两侧,于是同一 tick 在录制与回放里给出不同的世界坐标。
 *
 * ⚠️ **只对节点自身 `computeWorldMatrix(true)` 是不够的** —— 它内部仍然通过
 * `parent.getWorldMatrix()` 取父矩阵,而那个调用是**非 force** 的,拿到的还是缓存值。
 * 必须自根向下逐级 force。这是 qy-last-stand `8f5593a4` 用一条 8895 帧 tape 换来的教训:
 * 弹丸出生点(挂在炮管下的炮口)在回放里滞后整整一帧,一直是纯视觉偏移,直到撞上一个
 * dt=98.9ms 的卡顿帧,0.356 的 y 偏移翻转了球形命中判定 —— Mode A 在 frame 5945 分歧。
 *
 * **什么时候必须调**:`update()` 内,读任何「祖先在本 tick 被写过 transform」的节点的世界坐标之前。
 * 纯视觉的读也建议调 —— 今天纯视觉的偏移,明天就可能被一个卡顿帧喂进命中判定。
 *
 * 代价 O(depth),链很短;不改变录制路径本就读到的新鲜值。
 */
export function refreshWorldMatrixChain(node: TransformNode | null | undefined): void {
  if (!node) return;
  const chain: TransformNode[] = [];
  let current: TransformNode | null = node;
  while (current) {
    chain.push(current);
    const parent = current.parent as TransformNode | null;
    current = parent && typeof parent.computeWorldMatrix === 'function' ? parent : null;
  }
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    chain[index]?.computeWorldMatrix(true);
  }
}

/** 批量版本。祖先链重复的部分会被重复刷新,但链很短,不值得为此建缓存。 */
export function refreshWorldMatrixChains(nodes: Iterable<TransformNode | null | undefined>): void {
  for (const node of nodes) refreshWorldMatrixChain(node);
}
