/**
 * ConfigValidator - 配置校验服务 (Scaffold)
 *
 * 职责：在开发模式下做“非阻塞”的配置一致性检查。
 * - 输出 warnings/errors 到 console
 * - 不影响运行（Playable 业务更希望可跑，而不是直接 crash）
 *
 * 注意：脚手架版本只做最基础校验，你可以按项目扩展：
 * - 业务 ID 引用检查
 * - 数值范围检查
 * - 资源存在性检查
 */

import { configService } from '../config';
import { isModelRegistered } from '../assets';

interface ValidationResult {
  warnings: string[];
  errors: string[];
}

class ConfigValidator {
  validate(): ValidationResult {
    const result: ValidationResult = { warnings: [], errors: [] };
    const sceneConfig = configService.getSceneConfig();
    const sceneDocument = sceneConfig.scene;

    console.log('[ConfigValidator] 开始配置校验（Scaffold）...');

    // 1) worldBounds 合法性
    const b = configService.getWorldBounds();
    if (b.minX >= b.maxX) result.errors.push('worldBounds.minX 必须 < worldBounds.maxX');
    if (b.minZ >= b.maxZ) result.errors.push('worldBounds.minZ 必须 < worldBounds.maxZ');

    if (!sceneDocument) {
      result.errors.push('scene 文档缺失');
      return result;
    }

    const assetIds = new Set<string>();
    const nodeIds = new Set<string>();

    // 2) scene.assets[*] 基础校验
    for (const asset of configService.getSceneAssets()) {
      if (!asset.id) {
        result.errors.push('scene.assets[*].id 不能为空');
        continue;
      }
      if (assetIds.has(asset.id)) {
        result.errors.push(`scene.assets[${asset.id}] 存在重复 id`);
      }
      assetIds.add(asset.id);

      if (!asset.sourceId) {
        result.errors.push(`scene.assets[${asset.id}] 缺少 sourceId`);
        continue;
      }
      if (!isModelRegistered(asset.sourceId)) {
        result.warnings.push(
          `scene.assets[${asset.id}] 引用了未注册的 sourceId "${asset.sourceId}"（请在 src/assets/index.ts 的 MODEL_URL_MAP 中注册）`
        );
      }
    }

    // 3) scene.nodes[*] 基础校验
    for (const node of configService.getSceneNodes()) {
      if (!node.id) {
        result.errors.push('scene.nodes[*].id 不能为空');
        continue;
      }
      if (nodeIds.has(node.id)) {
        result.errors.push(`scene.nodes[${node.id}] 存在重复 id`);
      }
      nodeIds.add(node.id);

      const kind = (node as { kind?: unknown }).kind;
      if (kind !== 'group' && kind !== 'transform' && kind !== 'instance') {
        result.errors.push(`scene.nodes[${node.id}] kind "${String(kind)}" 非法`);
      }

      if (node.kind === 'transform' && node.transformType && !['plain', 'light', 'camera'].includes(node.transformType)) {
        result.errors.push(`scene.nodes[${node.id}] transformType "${node.transformType}" 非法`);
      }

      if (node.kind === 'instance') {
        const assetId = node.instance?.assetId;
        if (!assetId) {
          result.errors.push(`scene.nodes[${node.id}] 缺少 instance.assetId`);
        } else if (!assetIds.has(assetId)) {
          result.errors.push(`scene.nodes[${node.id}] 引用了不存在的 assetId "${assetId}"`);
        }
      }
    }

    // 4) rootId / parentId 一致性校验
    const rootId = configService.getSceneRootId();
    if (!rootId) {
      result.errors.push('scene.rootId 不能为空');
    }
    if (nodeIds.has(rootId)) {
      result.errors.push(`scene.rootId "${rootId}" 不能与 scene.nodes[*].id 冲突`);
    }

    for (const node of configService.getSceneNodes()) {
      if (!node.parentId) continue;
      if (node.parentId === node.id) {
        result.errors.push(`scene.nodes[${node.id}] 不能将自己作为 parentId`);
        continue;
      }
      if (node.parentId !== rootId && !nodeIds.has(node.parentId)) {
        result.errors.push(`scene.nodes[${node.id}] 引用了不存在的 parentId "${node.parentId}"`);
      }
    }

    // 输出
    if (result.errors.length > 0) {
      console.error('[ConfigValidator] Errors:\n' + result.errors.map(e => `- ${e}`).join('\n'));
    }
    if (result.warnings.length > 0) {
      console.warn('[ConfigValidator] Warnings:\n' + result.warnings.map(w => `- ${w}`).join('\n'));
    }
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('[ConfigValidator] OK');
    }

    return result;
  }
}

export const configValidator = new ConfigValidator();
