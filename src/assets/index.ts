/**
 * 资源管理模块 (Scaffold)
 *
 * 目的：
 * - 统一管理静态资源 (models / textures / ui / sounds)
 * - 提供“modelId → URL” 的唯一映射入口
 * - 保持与架构文档一致：业务代码只使用 modelId，不直接写资源路径
 *
 * 注意：这是脚手架版本，已剔除与具体游戏强绑定的资源。
 * 你可以按需新增资源：
 * 1) 将资源文件放进 src/assets/**
 * 2) 在本文件使用 ?url 引入
 * 3) 写入 MODEL_URL_MAP / TextureAssets / SoundAssets 等映射
 */

// ============================================================
// Placeholders (可替换)
// ============================================================

import blankPng from './placeholders/blank.png?url';
import silentWav from './placeholders/silent.wav?url';
import gasStationGlb from './加油站.glb?url';
import gasCarGlb from './加油废车.glb?url';
import oilWellGlb from './油井.glb?url';
import containerGlb from './集装箱.glb?url';
import container3Glb from './集装箱3.glb?url';
import cargoShipGlb from './货船.glb?url';
import craneGlb from './吊机.glb?url';
import railSegmentGlb from './火车轨道.glb?url';
import trainGlb from './火车.glb?url';
import youtongGlb from './YOUTong.glb?url';
import pineTreeGlb from './低多边形卡通风格松树_TREE.glb?url';
import grassGlb from './低多边形卡通风格绿色植被_SM_SM_cao.glb?url';

// ============================================================
// Models
// ============================================================

/**
 * modelId → 资源 URL 的映射
 *
 * 这是唯一定义 modelId 和实际资源路径对应关系的地方。
 *
 * Scaffold 默认不内置任何具体模型，你可以在此处逐步注册：
 * ```ts
 * import heroModel from './models/hero.glb?url';
 * export const MODEL_URL_MAP = { hero: heroModel };
 * ```
 */
export const MODEL_URL_MAP: Record<string, string> = {
  gas_station: gasStationGlb,
  gas_car: gasCarGlb,
  oil_well: oilWellGlb,
  container: containerGlb,
  container_3: container3Glb,
  cargo_ship: cargoShipGlb,
  crane: craneGlb,
  rail_segment: railSegmentGlb,
  train: trainGlb,
  youtong: youtongGlb,
  pine_tree: pineTreeGlb,
  grass: grassGlb,
};

/** 根据 modelId 获取资源 URL */
export function resolveModelUrl(modelId: string): string | undefined {
  return MODEL_URL_MAP[modelId];
}

/** 运行时注册模型 URL（例如拖入页面的 GLB data URL） */
export function registerModelUrl(modelId: string, url: string): void {
  if (!modelId || !url) return;
  MODEL_URL_MAP[modelId] = url;
}

/** 获取所有已注册的模型 ID */
export function getAllModelIds(): string[] {
  return Object.keys(MODEL_URL_MAP);
}

/** 检查模型 ID 是否已注册 */
export function isModelRegistered(modelId: string): boolean {
  return modelId in MODEL_URL_MAP;
}

// ============================================================
// UI Images (可选)
// ============================================================

/**
 * UIImages
 *
 * 用于 UI、粒子特效等需要图片纹理 URL 的场景。
 * Scaffold 默认全部指向 blank 占位图。
 */
export const UIImages: Record<string, string> = {
  blank: blankPng,
  gameLogo: blankPng,
  particleSpark: blankPng,
  particleSoft: blankPng,
};

// ============================================================
// Sounds (可选)
// ============================================================

/**
 * SoundAssets
 *
 * Scaffold 默认只提供静音 BGM 占位，不内置任何具体玩法音效。
 * 项目可以按需在 `sfx` 注册任意音效 ID。
 *
 * 你可以替换为实际的 mp3/wav：
 * ```ts
 * import bgm from './Sound/bgm.mp3?url';
 * import tap from './Sound/tap.mp3?url';
 *
 * export const SoundAssets = {
 *   bgm,
 *   sfx: {
 *     tap,
 *   },
 * };
 * ```
 */
export const SoundAssets: {
  bgm: string;
  sfx: Record<string, string>;
} = {
  bgm: silentWav,
  sfx: {},
};

// ============================================================
// Textures (可选)
// ============================================================

/**
 * TextureAssets
 *
 * 用于 Babylon GUI 或其他材质贴图等。
 */
export const TextureAssets = {
  ui: {
    gameLogo: blankPng,
  },
};

// ============================================================
// GLB Path Helper
// ============================================================

import { isCompressedGlb, getUsableGlbUrl } from '../utils/glbDecompress';

/** getModelPathAndFileAsync 的返回类型 */
export interface ModelPathInfo {
  path: string;
  filename: string;
  isDataUrl: boolean;
  /** 是否为压缩的 GLB（需要运行时解压） */
  isCompressed: boolean;
}

/**
 * 从完整 URL 中提取 path 和 filename
 * 用于 Babylon SceneLoader.ImportMeshAsync / LoadAssetContainerAsync
 */
export async function getModelPathAndFileAsync(url: string): Promise<ModelPathInfo> {
  // 1) 压缩 GLB（例如单文件构建产出的 data:application/x-glb-brotli;base64,...）
  if (isCompressedGlb(url)) {
    const usableUrl = await getUsableGlbUrl(url);
    return splitUrlToPathAndFile(usableUrl, true);
  }

  // 2) data: / blob: URLs — both lack a real file extension in the URL,
  //    so babylon can't sniff the plugin. Mark as data-url style so the
  //    AssetLoader passes `.glb` as an explicit pluginExtension hint.
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return {
      path: '',
      filename: url,
      isDataUrl: true,
      isCompressed: false,
    };
  }

  // 3) 普通 URL
  return splitUrlToPathAndFile(url, false);
}

function splitUrlToPathAndFile(url: string, isCompressed: boolean): ModelPathInfo {
  const idx = url.lastIndexOf('/');
  if (idx === -1) {
    return {
      path: '',
      filename: url,
      isDataUrl: false,
      isCompressed,
    };
  }

  return {
    path: url.slice(0, idx + 1),
    filename: url.slice(idx + 1),
    isDataUrl: false,
    isCompressed,
  };
}
