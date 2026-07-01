// VFX registry barrel —— 消费 @fps-games/vfx 包(plan §16 模型 C)。
// glob 扫本地 effects 桩;runtime/类型来自 @fps-games/vfx。装进来的特效全部进构建(dev 与 prod 一致)。
import { buildRegistry, type VfxRegistry } from '@fps-games/vfx';

// 把库的类型/导出透传给项目(消费方按 '../assets/vfx' 取 VFX 类型)
export * from '@fps-games/vfx';

const modules = import.meta.glob('./effects/*/index.ts', { eager: true }) as Record<string, Record<string, unknown>>;
const params = import.meta.glob('./effects/*/vfx-params.json', { eager: true }) as Record<string, { default: unknown }>;

export const VFX_REGISTRY: VfxRegistry = buildRegistry({ modules, params });
