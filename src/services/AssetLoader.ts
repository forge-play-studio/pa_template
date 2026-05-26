/**
 * AssetLoader - 资源加载服务
 *
 * 职责：统一管理 GLB 模型的加载，支持预加载和缓存
 */

import { Scene } from '@babylonjs/core/scene';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { AssetContainer } from '@babylonjs/core/assetContainer';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import {
  getModelAssetIds,
  getModelPathAndFileAsync,
  resolveModelAssetUrl,
  type ModelPathInfo,
} from '../assets';

/**
 * 加载进度回调
 */
export interface LoadProgress {
  loaded: number;
  total: number;
  currentAsset: string;
}

/**
 * AssetLoader 服务
 */
export class AssetLoader {
  private scene: Scene;

  // AssetContainer 缓存
  private containers = new Map<string, AssetContainer>();

  // 正在加载的 Promise（防止重复加载）
  private loadingPromises = new Map<string, Promise<AssetContainer>>();

  // 路径信息缓存
  private pathInfoCache = new Map<string, ModelPathInfo>();

  // 编辑期动态注册的模型 URL。正式持久化后以 asset catalog 为准。
  private runtimeModelUrls = new Map<string, string>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * 预加载多个模型
   *
   * ⚠️ 重要：调用此方法前必须确保场景中已有灯光！
   * 否则材质着色器不会包含光照代码，导致模型显示为黑色。
   */
  async preload(
    assetIds: string[],
    onProgress?: (progress: LoadProgress) => void
  ): Promise<void> {
    // 开发模式下检查灯光是否存在
    if (import.meta.env.DEV) {
      this.assertLightsExist();
    }

    const total = assetIds.length;
    let loaded = 0;

    for (const assetId of assetIds) {
      onProgress?.({ loaded, total, currentAsset: assetId });

      try {
        await this.loadAssetContainer(assetId);
        loaded++;
      } catch (error) {
        loaded++;
      }

      onProgress?.({ loaded, total, currentAsset: assetId });
    }
  }

  /**
   * 加载模型为 AssetContainer（用于多次实例化）
   */
  async loadAssetContainer(assetId: string): Promise<AssetContainer> {
    const normalizedId = this.normalizeModelAssetId(assetId);

    // 已缓存
    if (this.containers.has(normalizedId)) {
      return this.containers.get(normalizedId)!;
    }

    // 正在加载中
    if (this.loadingPromises.has(normalizedId)) {
      return this.loadingPromises.get(normalizedId)!;
    }

    // 开始加载
    const promise = this.doLoadContainer(normalizedId);
    this.loadingPromises.set(normalizedId, promise);

    try {
      const container = await promise;
      this.containers.set(normalizedId, container);
      return container;
    } finally {
      this.loadingPromises.delete(normalizedId);
    }
  }

  /**
   * 加载模型为 TransformNode（一次性使用）
   */
  async loadModel(assetId: string): Promise<TransformNode> {
    const pathInfo = await this.getPathInfo(assetId);

    const result = await SceneLoader.ImportMeshAsync(
      '',
      pathInfo.path,
      pathInfo.filename,
      this.scene,
      undefined,
      pathInfo.isDataUrl || pathInfo.isCompressed ? '.glb' : undefined
    );

    if (result.meshes.length > 0) {
      return result.meshes[0] as TransformNode;
    }

    throw new Error(`[AssetLoader] No meshes found in model asset: ${assetId}`);
  }

  /**
   * 同步获取已缓存的 AssetContainer
   */
  getContainerSync(assetId: string): AssetContainer | undefined {
    const normalizedId = this.normalizeModelAssetId(assetId);
    return this.containers.get(normalizedId);
  }

  /**
   * 检查模型是否已加载
   */
  isLoaded(assetId: string): boolean {
    const normalizedId = this.normalizeModelAssetId(assetId);
    return this.containers.has(normalizedId);
  }

  /**
   * 获取模型的 URL
   */
  getModelUrl(assetId: string): string | undefined {
    const normalizedId = this.normalizeModelAssetId(assetId);
    return this.runtimeModelUrls.get(normalizedId) ?? resolveModelAssetUrl(normalizedId);
  }

  registerRuntimeModelUrl(assetId: string, url: string): void {
    const normalizedId = this.normalizeModelAssetId(assetId);
    const normalizedUrl = url.trim();
    if (!normalizedId || !normalizedUrl) return;
    this.runtimeModelUrls.set(normalizedId, normalizedUrl);
    this.pathInfoCache.delete(normalizedId);
  }

  unregisterRuntimeModelUrl(assetId: string): void {
    const normalizedId = this.normalizeModelAssetId(assetId);
    this.runtimeModelUrls.delete(normalizedId);
    this.pathInfoCache.delete(normalizedId);
  }

  /**
   * 获取所有可用的模型资产 ID
   */
  getAllModelAssetIds(): string[] {
    return [...new Set([...getModelAssetIds(), ...this.runtimeModelUrls.keys()])];
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    for (const container of this.containers.values()) {
      container.dispose();
    }
    this.containers.clear();
    this.pathInfoCache.clear();
  }

  /**
   * 内部方法：执行实际加载
   *
   * 统一使用 LoadAssetContainerAsync 处理所有 URL 类型：
   * - 常规 URL: path + filename 分开传递
   * - Data URL: 需要指定 pluginExtension 告诉加载器文件类型
   */
  private async doLoadContainer(assetId: string): Promise<AssetContainer> {
    const pathInfo = await this.getPathInfo(assetId);


    // 使用与旧系统相同的调用方式：path 和 filename 分开传递
    // 这样 BabylonJS 才能正确解析纹理的相对路径
    const container = await SceneLoader.LoadAssetContainerAsync(
      pathInfo.path,
      pathInfo.filename,
      this.scene,
      undefined,
      pathInfo.isDataUrl || pathInfo.isCompressed ? '.glb' : undefined
    );


    return container;
  }

  /**
   * 获取模型的路径信息
   */
  private async getPathInfo(assetId: string): Promise<ModelPathInfo> {
    const normalizedId = this.normalizeModelAssetId(assetId);

    // 检查缓存
    if (this.pathInfoCache.has(normalizedId)) {
      return this.pathInfoCache.get(normalizedId)!;
    }

    // 获取 URL
    const url = this.getModelUrl(normalizedId);
    if (!url) {
      throw new Error(`[AssetLoader] Unknown model assetId: ${assetId}`);
    }

    // 解析路径（处理压缩 GLB）
    const pathInfo = await getModelPathAndFileAsync(url);
    this.pathInfoCache.set(normalizedId, pathInfo);

    return pathInfo;
  }

  /**
   * 标准化模型资产 ID
   */
  private normalizeModelAssetId(assetId: string): string {
    return assetId.trim();
  }

  /**
   * 断言：检查场景中是否存在灯光
   *
   * BabylonJS 材质在创建时会根据场景灯光生成着色器 defines。
   * 如果预加载模型时场景没有灯光，着色器不会包含光照计算代码，
   * 导致模型显示为黑色。
   *
   * @throws 在开发模式下输出警告（不阻塞运行）
   */
  private assertLightsExist(): void {
    const lights = this.scene.lights;
    if (lights.length === 0) {
      console.error(
        '\n' +
        '╔════════════════════════════════════════════════════════════════╗\n' +
        '║  ⚠️  AssetLoader: 预加载模型前场景没有灯光！                    ║\n' +
        '╠════════════════════════════════════════════════════════════════╣\n' +
        '║  问题：材质着色器将不包含光照代码，模型可能显示为黑色。        ║\n' +
        '║                                                                ║\n' +
        '║  解决：确保在调用 assetLoader.preload() 前创建灯光：           ║\n' +
        '║        1. 先调用 sceneBuilder.buildSceneEnvironment()         ║\n' +
        '║        2. 再调用 assetLoader.preload()                        ║\n' +
        '╚════════════════════════════════════════════════════════════════╝\n'
      );
    }
  }
}
