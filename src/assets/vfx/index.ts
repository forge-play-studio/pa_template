// VFX registry barrel —— 消费 @fps/vfx 包(plan §16 模型 C)。
// glob 在项目侧扫本地 effects 桩;runtime/类型全部来自 @fps/vfx。
import { buildRegistry, type VfxRegistry } from '@fps/vfx';

// 把库的类型/导出透传给项目(消费方按 '../assets/vfx' 取 VFX 类型)
export * from '@fps/vfx';

// prod 构建只保留这些 production 目录(等价旧 index.production.ts)
const PRODUCTION_EFFECT_DIRS = new Set<string>([
  // vfx add 后把要进 prod 的目录名加这里
]);

const modules = import.meta.glob('./effects/*/index.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const params = import.meta.glob('./effects/*/vfx-params.json', { eager: true }) as Record<string, { default: unknown }>;

export const VFX_REGISTRY: VfxRegistry = buildRegistry({
  modules,
  params,
  prod: __PROD_BUILD__,
  isDebugOnly: (dir) => !PRODUCTION_EFFECT_DIRS.has(dir),
});
