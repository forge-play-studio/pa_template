/**
 * AnimationService - 动画播放服务
 *
 * 职责：统一管理动画的播放、停止、混合
 */

import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';

/**
 * 动画播放选项
 */
export interface PlayOptions {
  /** 是否循环 */
  loop?: boolean;
  /** 播放速度 */
  speed?: number;
  /** 从头开始 */
  restart?: boolean;
}

/**
 * AnimationService 服务
 */
export class AnimationService {
  // 当前播放的动画缓存：node name -> animation name
  private currentAnimations = new Map<string, string>();

  /**
   * 播放动画
   * @param animations 动画组数组
   * @param name 动画名称（支持模糊匹配）
   * @param options 播放选项
   * @returns 匹配到的动画组，或 null
   */
  play(
    animations: AnimationGroup[],
    name: string,
    options: PlayOptions = {}
  ): AnimationGroup | null {
    const anim = this.findAnimation(animations, name);
    if (!anim) {
      return null;
    }

    const { loop = true, speed = 1, restart = false } = options;

    // 检查是否已在播放相同动画
    const cacheKey = this.getCacheKey(animations);
    const currentAnim = this.currentAnimations.get(cacheKey);

    if (currentAnim === anim.name && anim.isPlaying && !restart) {
      // 已在播放，只更新速度
      anim.speedRatio = speed;
      return anim;
    }

    // 停止当前动画
    this.stopAll(animations);

    // 播放新动画
    anim.speedRatio = speed;
    anim.loopAnimation = loop;
    anim.play(loop);

    // 缓存当前动画
    this.currentAnimations.set(cacheKey, anim.name);

    return anim;
  }

  /**
   * 停止指定动画
   * @param animations 动画组数组
   * @param name 动画名称，不指定则停止所有
   */
  stop(animations: AnimationGroup[], name?: string): void {
    if (name) {
      const anim = this.findAnimation(animations, name);
      anim?.stop();
    } else {
      this.stopAll(animations);
    }

    // 清除缓存
    const cacheKey = this.getCacheKey(animations);
    this.currentAnimations.delete(cacheKey);
  }

  /**
   * 停止所有动画
   */
  stopAll(animations: AnimationGroup[]): void {
    for (const anim of animations) {
      if (anim.isPlaying) {
        anim.stop();
      }
    }
  }

  /**
   * 暂停动画
   */
  pause(animations: AnimationGroup[], name?: string): void {
    if (name) {
      const anim = this.findAnimation(animations, name);
      anim?.pause();
    } else {
      animations.forEach(a => a.pause());
    }
  }

  /**
   * 恢复动画
   */
  resume(animations: AnimationGroup[], name?: string): void {
    if (name) {
      const anim = this.findAnimation(animations, name);
      if (anim && !anim.isPlaying) {
        anim.play(anim.loopAnimation);
      }
    } else {
      animations.forEach(a => {
        if (!a.isPlaying) {
          a.play(a.loopAnimation);
        }
      });
    }
  }

  /**
   * 设置播放速度
   */
  setSpeed(animations: AnimationGroup[], speed: number, name?: string): void {
    if (name) {
      const anim = this.findAnimation(animations, name);
      if (anim) {
        anim.speedRatio = speed;
      }
    } else {
      animations.forEach(a => {
        a.speedRatio = speed;
      });
    }
  }

  /**
   * 交叉淡入淡出（简化版：直接切换）
   * @param animations 动画组数组
   * @param fromName 当前动画名称
   * @param toName 目标动画名称
   * @param _duration 过渡时间（暂未实现真正的混合）
   */
  crossFade(
    animations: AnimationGroup[],
    fromName: string,
    toName: string,
    _duration: number = 200
  ): void {
    const fromAnim = this.findAnimation(animations, fromName);
    const toAnim = this.findAnimation(animations, toName);

    if (fromAnim) {
      fromAnim.stop();
    }

    if (toAnim) {
      toAnim.play(true);

      const cacheKey = this.getCacheKey(animations);
      this.currentAnimations.set(cacheKey, toAnim.name);
    }
  }

  /**
   * 查找动画（支持模糊匹配）
   * @param animations 动画组数组
   * @param name 动画名称
   * @returns 匹配的动画组
   */
  findAnimation(animations: AnimationGroup[], name: string): AnimationGroup | null {
    if (!animations || animations.length === 0) {
      return null;
    }

    const nameLower = name.toLowerCase();

    // 精确匹配
    let found = animations.find(a => a.name.toLowerCase() === nameLower);
    if (found) return found;

    // 包含匹配
    found = animations.find(a => a.name.toLowerCase().includes(nameLower));
    if (found) return found;

    // 常见别名匹配
    const aliases: Record<string, string[]> = {
      idle: ['idle', 'stand', 'wait', 'default'],
      walk: ['walk', 'run', 'move', 'locomotion'],
      action: ['action', 'attack', 'hit', 'work', 'interact'],
      carry: ['carry', 'hold', 'pickup'],
    };

    const aliasNames = aliases[nameLower];
    if (aliasNames) {
      for (const alias of aliasNames) {
        found = animations.find(a => a.name.toLowerCase().includes(alias));
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * 检查动画是否正在播放
   */
  isPlaying(animations: AnimationGroup[], name: string): boolean {
    const anim = this.findAnimation(animations, name);
    return anim?.isPlaying ?? false;
  }

  /**
   * 获取当前播放的动画名称
   */
  getCurrentAnimationName(animations: AnimationGroup[]): string | null {
    const cacheKey = this.getCacheKey(animations);
    return this.currentAnimations.get(cacheKey) || null;
  }

  /**
   * 列出所有可用动画（调试用）
   */
  listAnimations(animations: AnimationGroup[]): string[] {
    return animations.map(a => a.name);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(animations: AnimationGroup[]): string {
    if (animations.length === 0) return '';
    // 使用第一个动画的名称前缀作为键
    const firstAnim = animations[0];
    const parts = firstAnim.name.split('_');
    return parts.slice(0, 2).join('_');
  }
}
