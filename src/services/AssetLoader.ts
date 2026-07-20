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

interface RuntimeModelUrlRegistration {
  url: string;
  owner: object | null;
}

type ImportedMeshResult = Awaited<ReturnType<typeof SceneLoader.ImportMeshAsync>>;

/**
 * AssetLoader 服务
 */
export class AssetLoader {
  private scene: Scene;

  // AssetContainer 缓存
  private containers = new Map<string, AssetContainer>();

  // 清理失败的旧资源仍由 AssetLoader 持有，后续 clearCache 会重试。
  private pendingContainerDisposals = new Set<AssetContainer>();
  private pendingImportedMeshDisposals = new Set<ImportedMeshResult>();

  // 正在加载的 Promise（防止重复加载）
  private loadingPromises = new Map<string, Promise<AssetContainer>>();

  // 资产 URL 变化时递增；防止旧的异步加载结果重新写回缓存。
  private sourceRevisions = new Map<string, number>();

  // clearCache 时递增；旧任务必须清理并结束，不能自动重载或复活缓存。
  private cacheGeneration = 0;

  // 路径信息缓存
  private pathInfoCache = new Map<string, ModelPathInfo>();

  // 编辑期动态注册的模型 URL。正式持久化后以 asset catalog 为准。
  private runtimeModelUrls = new Map<string, RuntimeModelUrlRegistration>();

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
    const cacheGeneration = this.cacheGeneration;
    // 开发模式下检查灯光是否存在
    if (import.meta.env.DEV) {
      this.assertLightsExist();
    }

    const total = assetIds.length;
    let loaded = 0;
    const assertCurrentCacheGeneration = (assetId: string): void => {
      if (this.cacheGeneration !== cacheGeneration) {
        throw this.createCacheInvalidatedError(assetId);
      }
    };

    for (const assetId of assetIds) {
      assertCurrentCacheGeneration(assetId);
      onProgress?.({ loaded, total, currentAsset: assetId });
      assertCurrentCacheGeneration(assetId);

      try {
        await this.loadAssetContainer(assetId);
        loaded++;
      } catch (error) {
        assertCurrentCacheGeneration(assetId);
        loaded++;
      }

      onProgress?.({ loaded, total, currentAsset: assetId });
      assertCurrentCacheGeneration(assetId);
    }
  }

  /**
   * 加载模型为 AssetContainer（用于多次实例化）
   */
  async loadAssetContainer(assetId: string): Promise<AssetContainer> {
    const normalizedId = this.normalizeModelAssetId(assetId);
    const sourceRevision = this.sourceRevisions.get(normalizedId) ?? 0;
    const cacheGeneration = this.cacheGeneration;

    // 已缓存
    const cachedContainer = this.containers.get(normalizedId);
    if (cachedContainer) {
      await Promise.resolve();
      if (this.cacheGeneration !== cacheGeneration) {
        throw this.createCacheInvalidatedError(normalizedId);
      }
      if ((this.sourceRevisions.get(normalizedId) ?? 0) !== sourceRevision) {
        return this.loadAssetContainer(normalizedId);
      }
      return cachedContainer;
    }

    // 正在加载中
    if (this.loadingPromises.has(normalizedId)) {
      return this.loadingPromises.get(normalizedId)!;
    }

    // 开始加载。URL 在加载期间变化时，丢弃旧结果并转接到当前 source。
    const isCurrentSource = (): boolean => (
      (this.sourceRevisions.get(normalizedId) ?? 0) === sourceRevision
    );
    const promise = this.doLoadContainer(
      normalizedId,
      sourceRevision,
      cacheGeneration,
    ).then(async container => {
      if (this.cacheGeneration !== cacheGeneration) {
        try {
          this.disposeContainer(container);
        } catch {
          // 保留在 pendingContainerDisposals，由下一次 clearCache 重试。
        }
        throw this.createCacheInvalidatedError(normalizedId);
      }
      if (!isCurrentSource()) {
        try {
          this.disposeContainer(container);
        } catch {
          // 保留在 pendingContainerDisposals；source 切换不能被旧资源清理失败阻塞。
        }
        return this.loadAssetContainer(normalizedId);
      }
      this.containers.set(normalizedId, container);
      return container;
    }, error => {
      if (this.cacheGeneration !== cacheGeneration) {
        throw this.createCacheInvalidatedError(normalizedId);
      }
      if (!isCurrentSource()) return this.loadAssetContainer(normalizedId);
      throw error;
    });
    this.loadingPromises.set(normalizedId, promise);

    try {
      return await promise;
    } finally {
      if (this.loadingPromises.get(normalizedId) === promise) {
        this.loadingPromises.delete(normalizedId);
      }
    }
  }

  /**
   * 加载模型为 TransformNode（一次性使用）
   */
  async loadModel(assetId: string): Promise<TransformNode> {
    const normalizedId = this.normalizeModelAssetId(assetId);
    const sourceRevision = this.sourceRevisions.get(normalizedId) ?? 0;
    const cacheGeneration = this.cacheGeneration;
    const pathInfo = await this.getPathInfo(normalizedId);
    if (this.cacheGeneration !== cacheGeneration) {
      throw this.createCacheInvalidatedError(normalizedId);
    }
    if ((this.sourceRevisions.get(normalizedId) ?? 0) !== sourceRevision) {
      return this.loadModel(normalizedId);
    }

    let result: ImportedMeshResult;
    try {
      result = await SceneLoader.ImportMeshAsync(
        '',
        pathInfo.path,
        pathInfo.filename,
        this.scene,
        undefined,
        pathInfo.isDataUrl || pathInfo.isCompressed ? '.glb' : undefined
      );
    } catch (error) {
      if (this.cacheGeneration !== cacheGeneration) {
        throw this.createCacheInvalidatedError(normalizedId);
      }
      if ((this.sourceRevisions.get(normalizedId) ?? 0) !== sourceRevision) {
        return this.loadModel(normalizedId);
      }
      throw error;
    }

    if (this.cacheGeneration !== cacheGeneration) {
      try {
        this.disposeImportedMeshResultWithRetryOwnership(result);
      } catch {
        // 保留在 pendingImportedMeshDisposals，由下一次 clearCache 重试。
      }
      throw this.createCacheInvalidatedError(normalizedId);
    }
    if ((this.sourceRevisions.get(normalizedId) ?? 0) !== sourceRevision) {
      try {
        this.disposeImportedMeshResultWithRetryOwnership(result);
      } catch {
        // 保留在 pendingImportedMeshDisposals；继续转接当前 source。
      }
      return this.loadModel(normalizedId);
    }

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
    return this.runtimeModelUrls.get(normalizedId)?.url ?? resolveModelAssetUrl(normalizedId);
  }

  registerRuntimeModelUrl(assetId: string, url: string): void {
    this.setRuntimeModelUrl(assetId, url, null);
  }

  registerOwnedRuntimeModelUrl(assetId: string, url: string, owner: object): void {
    this.setRuntimeModelUrl(assetId, url, owner);
  }

  private setRuntimeModelUrl(assetId: string, url: string, owner: object | null): void {
    const normalizedId = this.normalizeModelAssetId(assetId);
    const normalizedUrl = url.trim();
    if (!normalizedId || !normalizedUrl) return;
    const previousUrl = this.getModelUrl(normalizedId);
    this.runtimeModelUrls.set(normalizedId, { url: normalizedUrl, owner });
    if (previousUrl !== normalizedUrl) this.invalidateModelSource(normalizedId);
  }

  unregisterRuntimeModelUrl(assetId: string): void {
    const normalizedId = this.normalizeModelAssetId(assetId);
    if (!this.runtimeModelUrls.has(normalizedId)) return;
    const previousUrl = this.getModelUrl(normalizedId);
    this.runtimeModelUrls.delete(normalizedId);
    if (previousUrl !== this.getModelUrl(normalizedId)) this.invalidateModelSource(normalizedId);
  }

  unregisterOwnedRuntimeModelUrl(assetId: string, owner: object): boolean {
    const normalizedId = this.normalizeModelAssetId(assetId);
    const registration = this.runtimeModelUrls.get(normalizedId);
    if (!registration || registration.owner !== owner) return false;
    this.unregisterRuntimeModelUrl(normalizedId);
    return true;
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
    this.cacheGeneration += 1;
    this.loadingPromises.clear();
    const errors: unknown[] = [];
    const containers = new Set([
      ...this.containers.values(),
      ...this.pendingContainerDisposals,
    ]);
    this.containers.clear();
    for (const container of containers) {
      try {
        this.disposeContainer(container);
      } catch (error) {
        errors.push(error);
      }
    }
    for (const result of [...this.pendingImportedMeshDisposals]) {
      try {
        this.disposeImportedMeshResultWithRetryOwnership(result);
      } catch (error) {
        errors.push(error);
      }
    }
    this.pathInfoCache.clear();
    if (errors.length > 0) {
      throw new AggregateError(errors, '[AssetLoader] cache disposal failed');
    }
  }

  private invalidateModelSource(assetId: string): void {
    const cachedContainer = this.containers.get(assetId);
    this.containers.delete(assetId);
    this.pathInfoCache.delete(assetId);
    this.loadingPromises.delete(assetId);
    this.sourceRevisions.set(assetId, (this.sourceRevisions.get(assetId) ?? 0) + 1);
    if (cachedContainer) this.disposeContainer(cachedContainer);
  }

  private disposeContainer(container: AssetContainer): void {
    this.pendingContainerDisposals.add(container);
    container.dispose();
    this.pendingContainerDisposals.delete(container);
  }

  /**
   * 内部方法：执行实际加载
   *
   * 统一使用 LoadAssetContainerAsync 处理所有 URL 类型：
   * - 常规 URL: path + filename 分开传递
   * - Data URL: 需要指定 pluginExtension 告诉加载器文件类型
   */
  private async doLoadContainer(
    assetId: string,
    sourceRevision: number,
    cacheGeneration: number,
  ): Promise<AssetContainer> {
    const pathInfo = await this.getPathInfo(assetId);
    if (this.cacheGeneration !== cacheGeneration) {
      throw this.createCacheInvalidatedError(assetId);
    }
    if ((this.sourceRevisions.get(assetId) ?? 0) !== sourceRevision) {
      throw new Error(`[AssetLoader] Source changed during load: ${assetId}`);
    }


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
    const sourceRevision = this.sourceRevisions.get(normalizedId) ?? 0;
    const cacheGeneration = this.cacheGeneration;

    // 解析路径（处理压缩 GLB）
    const pathInfo = await this.resolvePathInfo(url);
    if (this.cacheGeneration !== cacheGeneration) return pathInfo;
    if (
      (this.sourceRevisions.get(normalizedId) ?? 0) !== sourceRevision
      || this.getModelUrl(normalizedId) !== url
    ) {
      return this.getPathInfo(normalizedId);
    }
    this.pathInfoCache.set(normalizedId, pathInfo);

    return pathInfo;
  }

  private resolvePathInfo(url: string): Promise<ModelPathInfo> {
    return getModelPathAndFileAsync(url);
  }

  private createCacheInvalidatedError(assetId: string): Error {
    return new Error(`[AssetLoader] Load invalidated by clearCache: ${assetId}`);
  }

  private disposeImportedMeshResultWithRetryOwnership(result: ImportedMeshResult): void {
    this.pendingImportedMeshDisposals.add(result);
    const errors: unknown[] = [];
    const attempt = (dispose: () => void): void => {
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    };
    for (const animationGroup of result.animationGroups) attempt(() => animationGroup.dispose());
    for (const particleSystem of result.particleSystems) attempt(() => particleSystem.dispose());
    for (const skeleton of result.skeletons) attempt(() => skeleton.dispose());
    for (const spriteManager of result.spriteManagers) attempt(() => spriteManager.dispose());
    for (const light of result.lights) {
      if (!light.isDisposed()) attempt(() => light.dispose());
    }
    for (const transformNode of result.transformNodes) {
      if (!transformNode.isDisposed()) attempt(() => transformNode.dispose(false, true));
    }
    for (const mesh of result.meshes) {
      if (!mesh.isDisposed()) attempt(() => mesh.dispose(false, true));
    }
    for (const geometry of result.geometries) {
      if (!geometry.isDisposed()) attempt(() => geometry.dispose());
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, '[AssetLoader] imported mesh disposal failed');
    }
    this.pendingImportedMeshDisposals.delete(result);
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
