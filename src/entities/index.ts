/**
 * Entities 模块导出 (Scaffold)
 *
 * 脚手架只保留通用基类 + 最小示例实体。
 * 具体游戏实体请在此目录下按项目需求新增，并在本文件集中导出。
 */

// 基类
export { BaseEntity } from './BaseEntity';
export type { EntityConfig, EntityState } from './BaseEntity';

// 示例实体（不依赖 GLB，方便开箱即跑）
export { SimplePlayer } from './SimplePlayer';
export type { SimplePlayerConfig } from './SimplePlayer';
