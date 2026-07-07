/**
 * SceneVfxService - 场景视觉特效服务 (Scaffold)
 *
 * 职责：从 scene.json 的 tuning.sceneVfx 读取配置，创建粒子系统。
 *
 * 说明：
 * - 这是简化版本，提供“可运行”的最小实现
 * - 具体游戏可以把粒子参数（颜色/生命周期/速度等）扩展到配置中
 */

import { Scene } from '@babylonjs/core/scene';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';

import { configService, type SceneVfxEffectConfig, type SceneVfxParticleSystemConfig } from '../config';
import { UIImages } from '../assets';
import {
  VFX_REGISTRY,
  type VfxDebugAnchor,
  type VfxEffectHandle,
  type VfxEffectPackage,
  type VfxParamValues,
  type VfxSpawnTransform,
} from '../assets/vfx';
import usagesDocument from '../assets/vfx/usages.json';
import { EffectPackageService } from '@fps-games/vfx';

export interface SceneVfxWarmupEntry {
  effectId: string;
  params?: Partial<VfxParamValues>;
  spawnTransform?: VfxSpawnTransform | Vector3;
}

export interface SceneVfxServiceOptions {
  getDebugAnchorPosition?: (anchor: VfxDebugAnchor) => Vector3 | null;
}

interface SceneVfxWarmupUsageConfig {
  effect?: unknown;
  params?: unknown;
}

interface SceneVfxWarmupUsagesDocument {
  usages?: SceneVfxWarmupUsageConfig[];
}

export class SceneVfxService {
  private scene: Scene;
  private effectPackageService: EffectPackageService;
  private particleSystems: ParticleSystem[] = [];
  private emitters: TransformNode[] = [];

  constructor(scene: Scene, options: SceneVfxServiceOptions = {}) {
    this.scene = scene;
    this.effectPackageService = new EffectPackageService(scene, {
      registry: VFX_REGISTRY,
      getDebugAnchorPosition: options.getDebugAnchorPosition,
    });
  }

  getEffectPackageService(): EffectPackageService {
    return this.effectPackageService;
  }

  getEffectPackages(): VfxEffectPackage[] {
    return this.effectPackageService.getEffectPackages();
  }

  getMergedParams(effectId: string, explicitParams?: Partial<VfxParamValues>): VfxParamValues | null {
    return this.effectPackageService.getMergedParams(effectId, explicitParams);
  }

  playEffectPackage(
    effectId: string,
    params: Partial<VfxParamValues> = {},
    spawnTransform?: VfxSpawnTransform | Vector3,
  ): VfxEffectHandle | null {
    return this.effectPackageService.playEffectPackage(effectId, params, spawnTransform);
  }

  async warmupEffectPackages(entries: SceneVfxWarmupEntry[]): Promise<void> {
    await Promise.all(entries.map((entry) => this.warmupEffectPackage(entry)));
  }

  async warmupRegisteredEffectPackages(): Promise<void> {
    const entries = this.createRegisteredEffectWarmupEntries();
    if (entries.length === 0) return;
    await this.warmupEffectPackages(entries);
  }

  /** 从配置初始化所有场景特效 */
  initFromConfig(): void {
    const cfg = configService.getSceneVfxConfig();
    if (!cfg) return;

    for (const [effectId, effect] of Object.entries(cfg.effects)) {
      if (effect.enabled === false) continue;
      this.createEffect(effectId, effect);
    }
  }

  private createEffect(effectId: string, effect: SceneVfxEffectConfig): void {
    const emitter = new TransformNode(`vfx_${effectId}_emitter`, this.scene);
    emitter.position.set(effect.position.x, effect.position.y, effect.position.z);

    if (effect.rotationDeg) {
      emitter.rotation.set(
        (effect.rotationDeg.x * Math.PI) / 180,
        (effect.rotationDeg.y * Math.PI) / 180,
        (effect.rotationDeg.z * Math.PI) / 180
      );
    }

    this.emitters.push(emitter);

    for (const [systemId, sysCfg] of Object.entries(effect.systems)) {
      if (sysCfg.enabled === false) continue;
      this.createParticleSystem(effectId, systemId, sysCfg, emitter);
    }
  }

  private createParticleSystem(
    effectId: string,
    systemId: string,
    cfg: SceneVfxParticleSystemConfig,
    emitter: TransformNode
  ): void {
    const system = new ParticleSystem(`vfx_${effectId}_${systemId}`, cfg.capacity ?? 64, this.scene);

    const textureUrl = (cfg.textureId && UIImages[cfg.textureId]) || UIImages.particleSpark || UIImages.blank;
    system.particleTexture = new Texture(textureUrl, this.scene);
    system.particleTexture.hasAlpha = true;

    system.emitter = emitter as any;

    // ---- 最小默认参数（可按需扩展进配置） ----
    system.minEmitBox = new Vector3(-0.2, 0, -0.2);
    system.maxEmitBox = new Vector3(0.2, 0, 0.2);

    system.color1 = new Color4(1, 1, 1, 1);
    system.color2 = new Color4(1, 1, 1, 1);
    system.colorDead = new Color4(1, 1, 1, 0);

    system.minSize = 0.08;
    system.maxSize = 0.18;

    system.minLifeTime = 0.35;
    system.maxLifeTime = 0.9;

    system.emitRate = 18;
    system.blendMode = ParticleSystem.BLENDMODE_STANDARD;

    system.direction1 = new Vector3(-0.2, 1.0, -0.2);
    system.direction2 = new Vector3(0.2, 1.2, 0.2);

    system.minEmitPower = 0.35;
    system.maxEmitPower = 0.8;

    system.updateSpeed = 0.02;

    system.start();

    this.particleSystems.push(system);
  }

  private async warmupEffectPackage(entry: SceneVfxWarmupEntry): Promise<void> {
    let handle: VfxEffectHandle | null = null;
    try {
      handle = this.playEffectPackage(entry.effectId, entry.params ?? {}, entry.spawnTransform);
      if (!handle) return;
      await handle.ready;
      await this.waitForAnimationFrames(2);
    } catch (error) {
      console.warn(`[SceneVfxService] Failed to warm up effect package "${entry.effectId}".`, error);
    } finally {
      handle?.dispose();
    }
  }

  private createRegisteredEffectWarmupEntries(): SceneVfxWarmupEntry[] {
    const usageParamsByEffect = readUsageWarmupParams();
    return this.getEffectPackages()
      .filter(shouldWarmupEffectPackage)
      .map((effectPackage) => ({
        effectId: effectPackage.id,
        params: usageParamsByEffect.get(effectPackage.id) ?? {},
        spawnTransform: createVfxWarmupSpawnTransform(),
      }));
  }

  private async waitForAnimationFrames(frameCount: number): Promise<void> {
    for (let i = 0; i < frameCount; i += 1) {
      await new Promise<void>((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve());
          return;
        }
        window.setTimeout(resolve, 0);
      });
    }
  }

  dispose(): void {
    this.effectPackageService.dispose();

    for (const ps of this.particleSystems) {
      ps.stop();
      ps.dispose();
    }
    this.particleSystems = [];

    for (const e of this.emitters) {
      e.dispose();
    }
    this.emitters = [];
  }
}

function readUsageWarmupParams(): Map<string, Partial<VfxParamValues>> {
  const result = new Map<string, Partial<VfxParamValues>>();
  const usages = (usagesDocument as SceneVfxWarmupUsagesDocument).usages ?? [];
  for (const usage of usages) {
    if (typeof usage.effect !== 'string' || result.has(usage.effect)) continue;
    result.set(usage.effect, cloneVfxParams(usage.params));
  }
  return result;
}

function cloneVfxParams(value: unknown): Partial<VfxParamValues> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Partial<VfxParamValues>) };
}

function shouldWarmupEffectPackage(effectPackage: VfxEffectPackage): boolean {
  if (effectPackage.placement === 'target') return false;
  return !(effectPackage.requiredInputs ?? []).includes('target');
}

function createVfxWarmupSpawnTransform(): VfxSpawnTransform {
  const position = createVfxWarmupPosition();
  const aim = position.add(new Vector3(0, 0, 2));
  return {
    position,
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
    renderingGroupId: 3,
    offsetIsLocal: false,
    inputs: {
      reference: () => position.clone(),
      aim: () => aim.clone(),
      normal: () => Vector3.Up(),
      endpoints: [
        () => position.clone(),
        () => aim.clone(),
      ],
    },
  };
}

function createVfxWarmupPosition(): Vector3 {
  return new Vector3(100000, -1000, 100000);
}
