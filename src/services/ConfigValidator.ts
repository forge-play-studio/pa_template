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
import { PROJECT_AUDIO_SOUND_MODES, PROJECT_AUDIO_CONFIG } from '../config/projectGameplayConfig';
import { isModelAssetRegistered, isSoundAssetRegistered } from '../assets';

interface ValidationResult {
  warnings: string[];
  errors: string[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
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

      if (!isModelAssetRegistered(asset.id)) {
        result.warnings.push(
          `scene.assets[${asset.id}] 引用了未注册的 model assetId（请确认该 id 存在于 asset catalog）`
        );
      }

      if (asset.warmupCount != null) {
        if (!Number.isInteger(asset.warmupCount) || asset.warmupCount < 0) {
          result.errors.push(`scene.assets[${asset.id}].warmupCount 必须是非负整数`);
        } else if (asset.singleton && asset.warmupCount > 0) {
          result.warnings.push(`scene.assets[${asset.id}] 是 singleton，warmupCount 会被忽略`);
        }
      }
    }

    // 3) scene.nodes[*] 基础校验
    const sceneNodes = configService.getSceneNodes();
    for (const node of sceneNodes) {
      if (!node.id) {
        result.errors.push('scene.nodes[*].id 不能为空');
        continue;
      }
      if (nodeIds.has(node.id)) {
        result.errors.push(`scene.nodes[${node.id}] 存在重复 id`);
      }
      nodeIds.add(node.id);

      const kind = (node as { kind?: unknown }).kind;
      if (kind !== 'group' && kind !== 'transform' && kind !== 'instance' && kind !== 'primitive') {
        result.errors.push(`scene.nodes[${node.id}] kind "${String(kind)}" 非法`);
      }

      if (node.kind === 'transform' && node.transformType && !['plain', 'light', 'camera', 'groundDecal'].includes(node.transformType)) {
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

      if (node.kind === 'primitive') {
        const shape = node.primitive?.shape;
        if (shape !== 'cube' && shape !== 'sphere' && shape !== 'plane' && shape !== 'capsule') {
          result.errors.push(`scene.nodes[${node.id}] primitive.shape "${String(shape)}" 非法`);
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

    for (const node of sceneNodes) {
      if (!node.parentId) continue;
      if (node.parentId === node.id) {
        result.errors.push(`scene.nodes[${node.id}] 不能将自己作为 parentId`);
        continue;
      }
      if (node.parentId !== rootId && !nodeIds.has(node.parentId)) {
        result.errors.push(`scene.nodes[${node.id}] 引用了不存在的 parentId "${node.parentId}"`);
      }
    }

    // 5) gameplay.gameplayBindings contract 基础校验
    const gameplayBindings = sceneConfig.gameplay?.gameplayBindings;
    if (gameplayBindings != null && !Array.isArray(gameplayBindings)) {
      result.errors.push('gameplay.gameplayBindings 必须是数组');
    } else if (Array.isArray(gameplayBindings)) {
      const bindingIds = new Set<string>();
      for (const binding of gameplayBindings) {
        if (!binding || typeof binding !== 'object') {
          result.errors.push('gameplay.gameplayBindings[*] 必须是对象');
          continue;
        }

        const id = typeof binding.id === 'string' ? binding.id.trim() : '';
        if (!id) {
          result.errors.push('gameplay.gameplayBindings[*].id 不能为空');
          continue;
        }
        if (bindingIds.has(id)) {
          result.errors.push(`gameplay.gameplayBindings[${id}] 存在重复 id`);
        }
        bindingIds.add(id);

        if (binding.entityId && !nodeIds.has(binding.entityId)) {
          result.warnings.push(`gameplay.gameplayBindings[${id}] entityId "${binding.entityId}" 未在 scene.nodes 中找到`);
        }
        if (binding.runtimeParent && !nodeIds.has(binding.runtimeParent)) {
          result.warnings.push(`gameplay.gameplayBindings[${id}] runtimeParent "${binding.runtimeParent}" 未在 scene.nodes 中找到`);
        }
        if (binding.spawnRootId && !nodeIds.has(binding.spawnRootId)) {
          result.warnings.push(`gameplay.gameplayBindings[${id}] spawnRootId "${binding.spawnRootId}" 未在 scene.nodes 中找到`);
        }
        if (binding.capacity != null && (!Number.isFinite(binding.capacity) || binding.capacity < 0)) {
          result.errors.push(`gameplay.gameplayBindings[${id}] capacity 必须是 >= 0 的数字`);
        }
        if (binding.processTimeSec != null && (!Number.isFinite(binding.processTimeSec) || binding.processTimeSec < 0)) {
          result.errors.push(`gameplay.gameplayBindings[${id}] processTimeSec 必须是 >= 0 的数字`);
        }

        if (Array.isArray(binding.cost)) {
          for (const cost of binding.cost) {
            if (!cost.resourceType || typeof cost.amount !== 'number' || !Number.isFinite(cost.amount) || cost.amount < 0) {
              result.errors.push(`gameplay.gameplayBindings[${id}] cost 必须包含合法的 resourceType 和 >= 0 的 amount`);
            }
          }
        }

      }
    }

    // 6) gameplay.zones 基础校验
    this.validateZones(result);

    // 7) gameplay.json audio 基础校验
    this.validateAudio(result);

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

  private validateZones(result: ValidationResult): void {
    const zones = configService.getSceneConfig().gameplay?.zones;
    if (zones == null) return;
    if (!Array.isArray(zones)) {
      result.errors.push('gameplay.zones 必须是数组');
      return;
    }

    const zoneIds = new Set<string>();
    for (const zone of zones) {
      if (!zone || typeof zone !== 'object') {
        result.errors.push('gameplay.zones[*] 必须是对象');
        continue;
      }

      const id = typeof zone.id === 'string' ? zone.id.trim() : '';
      if (!id) {
        result.errors.push('gameplay.zones[*].id 不能为空');
        continue;
      }
      if (zoneIds.has(id)) {
        result.errors.push(`gameplay.zones[${id}] 存在重复 id`);
      }
      zoneIds.add(id);

      if (!zone.location || !isFiniteNumber(zone.location.x) || !isFiniteNumber(zone.location.z)) {
        result.errors.push(`gameplay.zones[${id}] location 必须包含有限数字 x/z`);
      }

      if (zone.rotationDeg != null && !isFiniteNumber(zone.rotationDeg)) {
        result.errors.push(`gameplay.zones[${id}] rotationDeg 必须是有限数字`);
      }

      if (!isPositiveNumber(zone.size?.width) || !isPositiveNumber(zone.size?.depth)) {
        result.errors.push(`gameplay.zones[${id}] size 必须包含 > 0 的 width/depth`);
      }

      if (zone.meta != null && typeof zone.meta !== 'string') {
        result.errors.push(`gameplay.zones[${id}] meta 必须是字符串`);
      }
    }
  }

  private validateAudio(result: ValidationResult): void {
    const audio = PROJECT_AUDIO_CONFIG;
    if (audio.bgm.assetId && !isSoundAssetRegistered(audio.bgm.assetId)) {
      result.warnings.push(`audio.bgm.assetId "${audio.bgm.assetId}" 未在 sound asset catalog 中找到`);
    }

    const soundIds = new Set<string>();
    for (const sound of audio.sounds) {
      if (!sound.id) {
        result.errors.push('audio.sounds[*].id 不能为空');
        continue;
      }
      if (soundIds.has(sound.id)) {
        result.errors.push(`audio.sounds[${sound.id}] 存在重复 id`);
      }
      soundIds.add(sound.id);

      if (!sound.assetId) {
        result.warnings.push(`audio.sounds[${sound.id}].assetId 为空`);
      } else if (!isSoundAssetRegistered(sound.assetId)) {
        result.warnings.push(`audio.sounds[${sound.id}].assetId "${sound.assetId}" 未在 sound asset catalog 中找到`);
      }

      if (!(PROJECT_AUDIO_SOUND_MODES as readonly string[]).includes(sound.mode)) {
        result.errors.push(`audio.sounds[${sound.id}].mode "${String(sound.mode)}" 非法`);
      }
      if (!isFiniteNumber(sound.volume) || sound.volume < 0 || sound.volume > 1) {
        result.errors.push(`audio.sounds[${sound.id}].volume 必须在 0-1 之间`);
      }
      if (!Number.isInteger(sound.cooldownMs) || sound.cooldownMs < 0) {
        result.errors.push(`audio.sounds[${sound.id}].cooldownMs 必须是非负整数`);
      }
      if (!Number.isInteger(sound.maxVoices) || sound.maxVoices < 1) {
        result.errors.push(`audio.sounds[${sound.id}].maxVoices 必须是 >= 1 的整数`);
      }
      if (sound.mode === 'activeLoop' && (!Number.isInteger(sound.intervalMs) || sound.intervalMs < 16)) {
        result.errors.push(`audio.sounds[${sound.id}].intervalMs 必须是 >= 16 的整数`);
      }
    }
  }

}

export const configValidator = new ConfigValidator();
