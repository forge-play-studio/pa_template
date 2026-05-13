/**
 * AudioService - 音频服务
 *
 * 职责：统一管理 BGM 和音效播放，处理 iOS/IAB 音频解锁。
 *
 * 设计原则：
 * - 不依赖 Babylon Audio，避免与生产包 Babylon 裁剪链冲突。
 * - loading 阶段创建 HTMLAudio，并预解码 SFX 到 WebAudio buffer。
 * - 运行时优先用已解码的 WebAudio buffer 播放 SFX，失败再回退 HTMLAudio。
 */

import { Scene } from '@babylonjs/core/scene';
import { SoundAssets } from '../assets';

/**
 * 音效 ID
 *
 * 新增音效时：
 * 1. 在 SoundAssets.sfx 中注册资源
 * 2. 业务层使用同一个字符串 ID 调用 play()
 * 3. 如有需要，在 SFX_VOLUME_MULTIPLIERS / SFX_COOLDOWN_MS / SFX_MAX_VOICES 中补充同名配置
 */
export type SfxId = string;

type SfxPlaybackOptions = {
  playbackRate?: number;
  volume?: number;
};

type WebAudioCtor = new (contextOptions?: AudioContextOptions) => AudioContext;
type HtmlSfxMap = Record<SfxId, HTMLAudioElement | null>;

const DEFAULT_SFX_VOLUME_MULTIPLIER = 1.0;
const DEFAULT_SFX_COOLDOWN_MS = 300;
const DEFAULT_SFX_MAX_VOICES = 4;

const SFX_VOLUME_MULTIPLIERS: Partial<Record<SfxId, number>> = {};
const SFX_COOLDOWN_MS: Partial<Record<SfxId, number>> = {};
const SFX_MAX_VOICES: Partial<Record<SfxId, number>> = {};

/**
 * AudioService 服务
 */
export class AudioService {
  private bgmAudio: HTMLAudioElement | null = null;
  private htmlSfx: HtmlSfxMap = {};

  private sfxContext: AudioContext | null = null;
  private sfxMasterGain: GainNode | null = null;
  private sfxBuffers = new Map<SfxId, AudioBuffer>();
  private sfxLoadPromises = new Map<SfxId, Promise<void>>();
  private activeSfxSources = new Map<SfxId, AudioBufferSourceNode[]>();
  private sfxContextPrimed = false;

  // 状态
  private audioUnlocked = false;
  private bgmReady = false;
  private runtimeSfxReady = false;
  private bgmVolume = 0.35;
  private sfxVolume = 0.6;

  // 音效冷却，避免高频 one-shot 在 iOS/IAB 里打爆音频调度。
  private sfxLastPlayTime = new Map<SfxId, number>();

  constructor(scene: Scene) {
    scene.audioEnabled = true;
  }

  /**
   * 预加载音频。
   *
   * 这里会在黑屏 loading 阶段完成两件事：
   * - 创建 HTMLAudio 并调用 load()，作为 BGM 和 fallback。
   * - 创建 WebAudio context，预解码全部 SFX 到 AudioBuffer。
   */
  async preload(): Promise<void> {
    this.initHtmlAudio();
    this.runtimeSfxReady = this.hasRuntimeSfxSources();
    await this.preloadRuntimeSfxBuffers();
  }

  /**
   * 设置音频解锁监听器。
   *
   * iOS/Safari/IAB 要求 resume AudioContext 和 play() 尽量在用户手势回调内同步发起。
   */
  setupUnlockListener(): void {
    window.addEventListener('pointerdown', this.handleUnlockPointerDown, { capture: true });
    window.addEventListener('touchstart', this.handleUnlockTouchStart, { capture: true });
    window.addEventListener('click', this.handleUnlockClick, { capture: true });
    window.addEventListener('keydown', this.handleUnlockKeyDown, { capture: true });
  }

  unlockFromInteraction(): void {
    if (!this.audioUnlocked) {
      this.audioUnlocked = true;
    }

    this.requestSfxContextResumeFromGesture();
    this.playBGM();
  }

  /**
   * 播放音效
   */
  play(sfxId: SfxId, options?: SfxPlaybackOptions): void {
    if (!this.audioUnlocked || !this.runtimeSfxReady) return;
    if (!this.isRegisteredSfx(sfxId)) return;

    const now = performance.now();
    const lastTime = this.sfxLastPlayTime.get(sfxId) ?? 0;
    const cooldownMs = this.getSfxCooldownMs(sfxId);
    if (now - lastTime < cooldownMs) return;
    this.sfxLastPlayTime.set(sfxId, now);

    if (this.sfxBuffers.has(sfxId)) {
      void this.playWebAudioSfx(sfxId, options);
      return;
    }

    this.playHtmlSfx(sfxId, options);
  }

  /**
   * 播放 BGM
   */
  playBGM(): void {
    if (!this.audioUnlocked || !this.bgmAudio) return;
    if (!this.bgmAudio.paused && !this.bgmAudio.ended && this.bgmAudio.currentTime > 0) {
      this.bgmReady = true;
      return;
    }

    this.bgmAudio.currentTime = 0;
    const playPromise = this.bgmAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          this.bgmReady = true;
        })
        .catch(() => {
          this.bgmReady = false;
        });
    }
  }

  /**
   * 停止 BGM
   */
  stopBGM(): void {
    this.bgmAudio?.pause();
  }

  /**
   * 设置 BGM 音量
   */
  setBGMVolume(volume: number): void {
    this.bgmVolume = volume;
    if (this.bgmAudio) {
      this.bgmAudio.volume = volume;
    }
  }

  /**
   * 设置音效音量
   */
  setSfxVolume(volume: number): void {
    this.sfxVolume = volume;
    if (this.sfxMasterGain) {
      this.sfxMasterGain.gain.value = volume;
    }
    this.getRegisteredSfxIds().forEach((sfxId) => {
      const audio = this.htmlSfx[sfxId];
      if (audio) {
        audio.volume = Math.min(1.0, volume * this.getSfxVolumeMultiplier(sfxId));
      }
    });
  }

  /**
   * 音频是否已解锁
   */
  get isUnlocked(): boolean {
    return this.audioUnlocked;
  }

  get isSfxReady(): boolean {
    return this.runtimeSfxReady;
  }

  get isBgmReady(): boolean {
    return this.bgmReady;
  }

  /**
   * 清理
   */
  dispose(): void {
    this.teardownUnlockListener();
    this.audioUnlocked = false;
    this.bgmReady = false;
    this.runtimeSfxReady = false;
    this.bgmAudio?.pause();
    this.bgmAudio = null;
    Object.values(this.htmlSfx).forEach((audio) => audio?.pause());
    this.htmlSfx = {};

    this.activeSfxSources.forEach((sources) => {
      sources.forEach((source) => {
        try {
          source.stop();
        } catch {
          // ignore stopped sources
        }
      });
    });
    this.activeSfxSources.clear();
    this.sfxBuffers.clear();
    this.sfxLoadPromises.clear();
    this.sfxMasterGain?.disconnect();
    this.sfxMasterGain = null;
    if (this.sfxContext && this.sfxContext.state !== 'closed') {
      void this.sfxContext.close();
    }
    this.sfxContext = null;
    this.sfxContextPrimed = false;
  }

  // === 私有方法 ===

  private initHtmlAudio(): void {
    if (SoundAssets.bgm.trim()) {
      this.bgmAudio = new Audio(SoundAssets.bgm);
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = 'auto';
      this.bgmAudio.volume = this.bgmVolume;
      this.requestHtmlAudioLoad(this.bgmAudio);
    } else {
      this.bgmReady = true;
    }

    this.getRegisteredSfxIds().forEach((sfxId) => {
      const sourceUrl = SoundAssets.sfx[sfxId]?.trim();
      if (!sourceUrl) return;

      const audio = new Audio(sourceUrl);
      audio.preload = 'auto';
      audio.volume = Math.min(1.0, this.sfxVolume * this.getSfxVolumeMultiplier(sfxId));
      this.requestHtmlAudioLoad(audio);
      this.htmlSfx[sfxId] = audio;
    });
  }

  private requestHtmlAudioLoad(audio: HTMLAudioElement): void {
    try {
      audio.load();
    } catch {
      // Loading is best-effort on iOS/IAB before the first trusted gesture.
    }
  }

  private hasRuntimeSfxSources(): boolean {
    return this.getRegisteredSfxIds().some((sfxId) => Boolean(this.htmlSfx[sfxId]));
  }

  private async preloadRuntimeSfxBuffers(): Promise<void> {
    const sfxIds = this.getRegisteredSfxIds().filter((sfxId) => Boolean(SoundAssets.sfx[sfxId]?.trim()));
    if (sfxIds.length === 0) return;

    await this.initWebAudio();
    if (!this.sfxContext) return;

    await Promise.allSettled(sfxIds.map((sfxId) => this.ensureSfxBufferLoaded(sfxId)));
    this.runtimeSfxReady = this.hasRuntimeSfxSources() || this.sfxBuffers.size > 0;
  }

  private async initWebAudio(): Promise<void> {
    if (this.sfxContext) return;
    this.createSfxContextSync();
  }

  private createSfxContextSync(): void {
    if (this.sfxContext) return;
    const AudioContextCtor = this.getAudioContextCtor();
    if (!AudioContextCtor) return;

    try {
      this.sfxContext = new AudioContextCtor();
      this.sfxMasterGain = this.sfxContext.createGain();
      this.sfxMasterGain.gain.value = this.sfxVolume;
      this.sfxMasterGain.connect(this.sfxContext.destination);
    } catch {
      this.sfxMasterGain?.disconnect();
      this.sfxMasterGain = null;
      this.sfxContext = null;
    }
  }

  private getAudioContextCtor(): WebAudioCtor | null {
    return (window.AudioContext ??
      (window as Window & { webkitAudioContext?: WebAudioCtor }).webkitAudioContext ??
      null);
  }

  private requestSfxContextResumeFromGesture(): void {
    this.createSfxContextSync();
    if (!this.sfxContext) return;

    if (this.sfxContext.state !== 'suspended') {
      this.primeSfxContext();
      return;
    }

    try {
      const resumePromise = this.sfxContext.resume();
      resumePromise
        .then(() => {
          this.primeSfxContext();
        })
        .catch(() => {
          // HTMLAudio fallback remains available.
        });
    } catch {
      // HTMLAudio fallback remains available.
    }
  }

  private primeSfxContext(): void {
    if (!this.sfxContext || !this.sfxMasterGain || this.sfxContextPrimed) return;
    try {
      const buffer = this.sfxContext.createBuffer(1, 1, this.sfxContext.sampleRate);
      const source = this.sfxContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.sfxMasterGain);
      source.start(0);
      this.sfxContextPrimed = true;
    } catch {
      // ignore prime failures
    }
  }

  private ensureSfxBufferLoaded(sfxId: SfxId): Promise<void> {
    if (this.sfxBuffers.has(sfxId)) return Promise.resolve();
    const existingPromise = this.sfxLoadPromises.get(sfxId);
    if (existingPromise) return existingPromise;

    const sourceUrl = SoundAssets.sfx[sfxId]?.trim();
    if (!sourceUrl || !this.sfxContext) return Promise.resolve();

    const loadPromise = this.loadAudioArrayBuffer(sourceUrl)
      .then(async (arrayBuffer) => {
        const audioBuffer = await this.sfxContext!.decodeAudioData(arrayBuffer.slice(0));
        this.sfxBuffers.set(sfxId, audioBuffer);
      })
      .catch(() => {
        // HTMLAudio fallback remains available.
      })
      .finally(() => {
        this.sfxLoadPromises.delete(sfxId);
      });

    this.sfxLoadPromises.set(sfxId, loadPromise);
    return loadPromise;
  }

  private async loadAudioArrayBuffer(sourceUrl: string): Promise<ArrayBuffer> {
    if (sourceUrl.startsWith('data:')) {
      return this.decodeDataUrlToArrayBuffer(sourceUrl);
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.status}`);
    }
    return response.arrayBuffer();
  }

  private decodeDataUrlToArrayBuffer(sourceUrl: string): ArrayBuffer {
    const commaIndex = sourceUrl.indexOf(',');
    if (commaIndex < 0) {
      throw new Error('Invalid data URL');
    }

    const metadata = sourceUrl.slice(0, commaIndex);
    const data = sourceUrl.slice(commaIndex + 1);

    if (metadata.includes(';base64')) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }

    const decoded = decodeURIComponent(data);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i += 1) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async playWebAudioSfx(sfxId: SfxId, options?: SfxPlaybackOptions): Promise<void> {
    if (!this.sfxContext || !this.sfxMasterGain || this.sfxContext.state !== 'running') {
      this.playHtmlSfx(sfxId, options);
      return;
    }

    const buffer = this.sfxBuffers.get(sfxId);
    if (!buffer) {
      this.playHtmlSfx(sfxId, options);
      return;
    }

    try {
      const source = this.sfxContext.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = options?.playbackRate ?? 1.0;

      const gainNode = this.sfxContext.createGain();
      const volumeMultiplier = options?.volume ?? this.getSfxVolumeMultiplier(sfxId);
      gainNode.gain.value = Math.max(0, volumeMultiplier);
      source.connect(gainNode);
      gainNode.connect(this.sfxMasterGain);

      const activeSources = this.activeSfxSources.get(sfxId) ?? [];
      const maxVoices = this.getSfxMaxVoices(sfxId);
      if (activeSources.length >= maxVoices) {
        const stolenSource = activeSources.shift();
        if (stolenSource) {
          try {
            stolenSource.stop();
          } catch {
            // ignore stopped sources
          }
        }
      }
      activeSources.push(source);
      this.activeSfxSources.set(sfxId, activeSources);

      source.onended = () => {
        const currentSources = this.activeSfxSources.get(sfxId);
        if (!currentSources) return;
        const nextSources = currentSources.filter((currentSource) => currentSource !== source);
        if (nextSources.length > 0) {
          this.activeSfxSources.set(sfxId, nextSources);
        } else {
          this.activeSfxSources.delete(sfxId);
        }
        source.disconnect();
        gainNode.disconnect();
      };

      source.start(0);
    } catch {
      this.playHtmlSfx(sfxId, options);
    }
  }

  private playHtmlSfx(sfxId: SfxId, options?: SfxPlaybackOptions): void {
    const audio = this.htmlSfx[sfxId];
    if (!audio) return;

    audio.currentTime = 0;
    audio.playbackRate = options?.playbackRate ?? 1.0;
    audio.preservesPitch = !options?.playbackRate || options.playbackRate === 1.0;
    (audio as HTMLAudioElement & { mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }).mozPreservesPitch = audio.preservesPitch;
    (audio as HTMLAudioElement & { mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }).webkitPreservesPitch = audio.preservesPitch;
    const volumeMultiplier = options?.volume ?? this.getSfxVolumeMultiplier(sfxId);
    audio.volume = Math.min(1.0, this.sfxVolume * volumeMultiplier);
    void audio.play().catch(() => {
      // Audio may still be locked in some embedded browsers.
    });
  }

  private getRegisteredSfxIds(): SfxId[] {
    return Object.keys(SoundAssets.sfx).filter((sfxId) => Boolean(SoundAssets.sfx[sfxId]?.trim()));
  }

  private isRegisteredSfx(sfxId: SfxId): boolean {
    return Boolean(SoundAssets.sfx[sfxId]?.trim());
  }

  private getSfxVolumeMultiplier(sfxId: SfxId): number {
    return SFX_VOLUME_MULTIPLIERS[sfxId] ?? DEFAULT_SFX_VOLUME_MULTIPLIER;
  }

  private getSfxCooldownMs(sfxId: SfxId): number {
    return SFX_COOLDOWN_MS[sfxId] ?? DEFAULT_SFX_COOLDOWN_MS;
  }

  private getSfxMaxVoices(sfxId: SfxId): number {
    return SFX_MAX_VOICES[sfxId] ?? DEFAULT_SFX_MAX_VOICES;
  }

  private teardownUnlockListener(): void {
    window.removeEventListener('pointerdown', this.handleUnlockPointerDown, { capture: true });
    window.removeEventListener('touchstart', this.handleUnlockTouchStart, { capture: true });
    window.removeEventListener('click', this.handleUnlockClick, { capture: true });
    window.removeEventListener('keydown', this.handleUnlockKeyDown, { capture: true });
  }

  private readonly handleUnlockPointerDown = (): void => {
    this.unlockFromInteraction();
  };

  private readonly handleUnlockTouchStart = (): void => {
    this.unlockFromInteraction();
  };

  private readonly handleUnlockClick = (): void => {
    this.unlockFromInteraction();
  };

  private readonly handleUnlockKeyDown = (): void => {
    this.unlockFromInteraction();
  };
}
