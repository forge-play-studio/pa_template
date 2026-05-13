/**
 * materialUtils - 材质工具函数
 *
 * 提供材质相关的工具函数，如材质去重
 */

import { Scene } from '@babylonjs/core/scene';
import { Material } from '@babylonjs/core/Materials/material';
import { MultiMaterial } from '@babylonjs/core/Materials/multiMaterial';

/**
 * 按名称去重材质
 *
 * GLB 模型加载时可能会创建重复的材质（同名但不同实例）
 * 此函数将重复的材质合并为一个，节省内存并保持材质一致性
 *
 * @param scene Babylon.js 场景
 * @param names 要去重的材质名称列表
 * @returns 被去重并销毁的材质数量
 */
export function dedupeMaterialsByName(scene: Scene, names: string[]): number {
  const targetNames = new Set(names);
  const nameToMaterial = new Map<string, Material>();
  const duplicates: Material[] = [];

  // 遍历场景中的所有材质
  for (const material of scene.materials) {
    // 跳过不在目标列表中的材质
    if (!targetNames.has(material.name)) continue;

    const existing = nameToMaterial.get(material.name);
    if (!existing) {
      // 第一次遇到此名称的材质，记录下来
      nameToMaterial.set(material.name, material);
      continue;
    }

    // 找到重复的材质，替换所有引用
    for (const mesh of scene.meshes) {
      // 替换直接引用
      if (mesh.material === material) {
        mesh.material = existing;
      }

      // 替换 MultiMaterial 中的子材质引用
      const meshMaterial = mesh.material;
      if (meshMaterial instanceof MultiMaterial) {
        let changed = false;
        const updated = meshMaterial.subMaterials.map((sub) => {
          if (sub === material) {
            changed = true;
            return existing;
          }
          return sub;
        });
        if (changed) {
          meshMaterial.subMaterials = updated;
        }
      }
    }

    // 标记为待销毁
    duplicates.push(material);
  }

  // 销毁重复的材质
  for (const material of duplicates) {
    material.dispose(false, false);
  }

  if (duplicates.length > 0) {
  }

  return duplicates.length;
}

/**
 * 获取场景中所有材质名称（调试用）
 *
 * @param scene Babylon.js 场景
 * @returns 材质名称数组
 */
export function getAllMaterialNames(scene: Scene): string[] {
  return scene.materials.map(m => m.name);
}

/**
 * 查找重复的材质名称（调试用）
 *
 * @param scene Babylon.js 场景
 * @returns 重复的材质名称及其数量
 */
export function findDuplicateMaterials(scene: Scene): Map<string, number> {
  const nameCounts = new Map<string, number>();

  for (const material of scene.materials) {
    const count = nameCounts.get(material.name) || 0;
    nameCounts.set(material.name, count + 1);
  }

  // 只返回重复的
  const duplicates = new Map<string, number>();
  for (const [name, count] of nameCounts) {
    if (count > 1) {
      duplicates.set(name, count);
    }
  }

  return duplicates;
}
