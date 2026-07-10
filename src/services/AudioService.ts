/**
 * Config-driven runtime audio service.
 *
 * Audio assets come from the generated sound asset catalog. Gameplay code refers
 * only to stable sound ids declared in src/config/gameplay.json: audio.
 */

import { Scene } from '@babylonjs/core/scene';
import {
  getProjectAudioConfig,
  type ProjectAudioConfig,
  type ProjectAudioSoundConfig,
} from '../config';
import { resolveSoundAssetUrl } from '../assets';

export type AudioSoundId = string;

export interface AudioPlayOptions {
  active?: boolean;
  volume?: number;
  playbackRate?: number;
}

export interface AudioDebugSoundState {
  id: string;
  assetId: string;
  mode: ProjectAudioSoundConfig['mode'];
  hasAsset: boolean;
  active: boolean;
  activeVoices: number;
  lastPlayTimeMs: number | null;
}

export interface AudioDebugState {
  enabled: boolean;
  unlocked: boolean;
  masterVolume: number;
  bgm: {
    assetId: string;
    hasAsset: boolean;
    ready: boolean;
    playing: boolean;
    volume: number;
  };
  sounds: AudioDebugSoundState[];
}

type WebAudioCtor = new (contextOptions?: AudioContextOptions) => AudioContext;

type PlayOneShotOptions = AudioPlayOptions & {
  ignoreCooldown?: boolean;
};

const DEFAULT_ACTIVE_LOOP_INTERVAL_MS = 900;

export class AudioService {
  private readonly config: ProjectAudioConfig = getProjectAudioConfig();
  private readonly soundConfigById = new Map<AudioSoundId, ProjectAudioSoundConfig>();
  private readonly htmlSounds = new Map<AudioSoundId, HTMLAudioElement>();
  private readonly sfxBuffers = new Map<AudioSoundId, AudioBuffer>();
  private readonly sfxLoadPromises = new Map<AudioSoundId, Promise<void>>();
  private readonly activeSources = new Map<AudioSoundId, AudioBufferSourceNode[]>();
  private readonly activeLoopTimers = new Map<AudioSoundId, number>();
  private readonly activeLoopLastPlayTime = new Map<AudioSoundId, number>();
  private readonly lastPlayTime = new Map<AudioSoundId, number>();
  private readonly previewSoundParams = new Map<AudioSoundId, Partial<ProjectAudioSoundConfig>>();

  private bgmAudio: HTMLAudioElement | null = null;
  private sfxContext: AudioContext | null = null;
  private sfxMasterGain: GainNode | null = null;
  private sfxContextPrimed = false;
  private audioUnlocked = false;
  private bgmReady = false;
  private runtimeSfxReady = false;
  private masterVolume = this.config.masterVolume;
  private bgmVolume = this.config.bgm.volume;

  constructor(scene: Scene) {
    scene.audioEnabled = true;
    for (const sound of this.config.sounds) {
      this.soundConfigById.set(sound.id, sound);
    }
  }

  async preload(): Promise<void> {
    this.initHtmlAudio();
    await this.preloadRuntimeSfxBuffers();
    this.runtimeSfxReady = this.htmlSounds.size > 0 || this.sfxBuffers.size > 0;
  }

  setupUnlockListener(): void {
    window.addEventListener('pointerdown', this.handleUnlockPointerDown, { capture: true });
    window.addEventListener('touchstart', this.handleUnlockTouchStart, { capture: true });
    window.addEventListener('click', this.handleUnlockClick, { capture: true });
    window.addEventListener('keydown', this.handleUnlockKeyDown, { capture: true });
  }

  unlockFromInteraction(): void {
    if (!this.audioUnlocked) this.audioUnlocked = true;
    this.requestSfxContextResumeFromGesture();
    this.playBgm();
  }

  play(soundId: AudioSoundId, options: AudioPlayOptions = {}): void {
    if (!this.config.enabled) return;
    const sound = this.getRuntimeSoundConfig(soundId);
    if (!sound) return;

    if (sound.mode === 'activeLoop') {
      if (typeof options.active !== 'boolean') {
        if (import.meta.env.DEV) {
          console.warn(`[AudioService] activeLoop "${soundId}" requires play(id, { active: boolean })`);
        }
        return;
      }
      if (options.active) {
        this.startActiveLoop(soundId, options);
      } else {
        this.stop(soundId);
      }
      return;
    }

    if (typeof options.active === 'boolean' && import.meta.env.DEV) {
      console.warn(`[AudioService] oneShot "${soundId}" ignores the active option`);
    }
    this.playOneShot(sound, options);
  }

  stop(soundId: AudioSoundId): void {
    const timer = this.activeLoopTimers.get(soundId);
    if (timer != null) {
      window.clearInterval(timer);
      this.activeLoopTimers.delete(soundId);
    }
    this.activeLoopLastPlayTime.delete(soundId);
    this.stopActiveSources(soundId);
    const audio = this.htmlSounds.get(soundId);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  stopAllActiveLoops(): void {
    for (const soundId of [...this.activeLoopTimers.keys()]) {
      this.stop(soundId);
    }
  }

  setPreviewParams(soundId: AudioSoundId, params: Partial<ProjectAudioSoundConfig>): void {
    const base = this.soundConfigById.get(soundId);
    if (!base) return;
    const current = this.previewSoundParams.get(soundId) ?? {};
    this.previewSoundParams.set(soundId, { ...current, ...params });
    this.syncHtmlSoundVolume(soundId);
    if (this.activeLoopTimers.has(soundId) && params.intervalMs != null) {
      this.restartActiveLoop(soundId);
    }
  }

  clearPreviewParams(soundId?: AudioSoundId): void {
    if (soundId) {
      this.previewSoundParams.delete(soundId);
      this.syncHtmlSoundVolume(soundId);
      if (this.activeLoopTimers.has(soundId)) this.restartActiveLoop(soundId);
      return;
    }
    this.previewSoundParams.clear();
    for (const id of this.soundConfigById.keys()) this.syncHtmlSoundVolume(id);
    for (const id of [...this.activeLoopTimers.keys()]) this.restartActiveLoop(id);
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = clamp01(volume);
    if (this.sfxMasterGain) {
      this.sfxMasterGain.gain.value = this.masterVolume;
    }
    this.syncBgmVolume();
    for (const id of this.soundConfigById.keys()) this.syncHtmlSoundVolume(id);
  }

  setBgmVolume(volume: number): void {
    this.bgmVolume = clamp01(volume);
    this.syncBgmVolume();
  }

  get isUnlocked(): boolean {
    return this.audioUnlocked;
  }

  get isSfxReady(): boolean {
    return this.runtimeSfxReady;
  }

  get isBgmReady(): boolean {
    return this.bgmReady;
  }

  getDebugState(): AudioDebugState {
    return {
      enabled: this.config.enabled,
      unlocked: this.audioUnlocked,
      masterVolume: this.masterVolume,
      bgm: {
        assetId: this.config.bgm.assetId,
        hasAsset: Boolean(this.getBgmUrl()),
        ready: this.bgmReady,
        playing: Boolean(this.bgmAudio && !this.bgmAudio.paused),
        volume: this.bgmVolume,
      },
      sounds: this.config.sounds.map((sound) => ({
        id: sound.id,
        assetId: sound.assetId,
        mode: sound.mode,
        hasAsset: Boolean(resolveSoundAssetUrl(sound.assetId)),
        active: this.activeLoopTimers.has(sound.id),
        activeVoices: this.activeSources.get(sound.id)?.length ?? 0,
        lastPlayTimeMs: this.lastPlayTime.get(sound.id) ?? null,
      })),
    };
  }

  dispose(): void {
    this.teardownUnlockListener();
    this.stopAllActiveLoops();
    for (const id of this.soundConfigById.keys()) this.stop(id);
    this.bgmAudio?.pause();
    this.bgmAudio = null;
    this.htmlSounds.clear();
    this.sfxBuffers.clear();
    this.sfxLoadPromises.clear();
    this.sfxMasterGain?.disconnect();
    this.sfxMasterGain = null;
    if (this.sfxContext && this.sfxContext.state !== 'closed') {
      void this.sfxContext.close();
    }
    this.sfxContext = null;
    this.sfxContextPrimed = false;
    this.audioUnlocked = false;
    this.bgmReady = false;
    this.runtimeSfxReady = false;
  }

  private initHtmlAudio(): void {
    const bgmUrl = this.getBgmUrl();
    if (bgmUrl) {
      this.bgmAudio = new Audio(bgmUrl);
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = 'auto';
      this.syncBgmVolume();
      this.requestHtmlAudioLoad(this.bgmAudio);
    } else {
      this.bgmReady = true;
    }

    for (const sound of this.config.sounds) {
      const sourceUrl = resolveSoundAssetUrl(sound.assetId);
      if (!sourceUrl) continue;
      const audio = new Audio(sourceUrl);
      audio.preload = 'auto';
      audio.loop = false;
      this.htmlSounds.set(sound.id, audio);
      this.syncHtmlSoundVolume(sound.id);
      this.requestHtmlAudioLoad(audio);
    }
  }

  private getBgmUrl(): string | undefined {
    return this.config.bgm.assetId ? resolveSoundAssetUrl(this.config.bgm.assetId) : undefined;
  }

  private requestHtmlAudioLoad(audio: HTMLAudioElement): void {
    try {
      audio.load();
    } catch {
      // Loading is best-effort before the first trusted gesture.
    }
  }

  private async preloadRuntimeSfxBuffers(): Promise<void> {
    if (this.config.sounds.length === 0) return;
    this.createSfxContextSync();
    if (!this.sfxContext) return;
    await Promise.allSettled(this.config.sounds.map((sound) => this.ensureSfxBufferLoaded(sound.id)));
  }

  private createSfxContextSync(): void {
    if (this.sfxContext) return;
    const AudioContextCtor = this.getAudioContextCtor();
    if (!AudioContextCtor) return;

    try {
      this.sfxContext = new AudioContextCtor();
      this.sfxMasterGain = this.sfxContext.createGain();
      this.sfxMasterGain.gain.value = this.masterVolume;
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
      void this.sfxContext.resume()
        .then(() => this.primeSfxContext())
        .catch(() => undefined);
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
      // Ignore prime failures.
    }
  }

  private ensureSfxBufferLoaded(soundId: AudioSoundId): Promise<void> {
    if (this.sfxBuffers.has(soundId)) return Promise.resolve();
    const existingPromise = this.sfxLoadPromises.get(soundId);
    if (existingPromise) return existingPromise;

    const sound = this.soundConfigById.get(soundId);
    const sourceUrl = sound ? resolveSoundAssetUrl(sound.assetId) : undefined;
    if (!sourceUrl || !this.sfxContext) return Promise.resolve();

    const loadPromise = this.loadAudioArrayBuffer(sourceUrl)
      .then(async (arrayBuffer) => {
        const audioBuffer = await this.sfxContext!.decodeAudioData(arrayBuffer.slice(0));
        this.sfxBuffers.set(soundId, audioBuffer);
      })
      .catch(() => undefined)
      .finally(() => {
        this.sfxLoadPromises.delete(soundId);
      });

    this.sfxLoadPromises.set(soundId, loadPromise);
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
    if (commaIndex < 0) throw new Error('Invalid data URL');
    const metadata = sourceUrl.slice(0, commaIndex);
    const data = sourceUrl.slice(commaIndex + 1);
    if (metadata.includes(';base64')) {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes.buffer;
    }
    const decoded = decodeURIComponent(data);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
      bytes[index] = decoded.charCodeAt(index);
    }
    return bytes.buffer;
  }

  private playBgm(): void {
    if (!this.config.enabled || !this.audioUnlocked || !this.bgmAudio) return;
    if (!this.bgmAudio.paused && !this.bgmAudio.ended && this.bgmAudio.currentTime > 0) {
      this.bgmReady = true;
      return;
    }

    this.bgmAudio.currentTime = 0;
    const playPromise = this.bgmAudio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      void playPromise
        .then(() => {
          this.bgmReady = true;
        })
        .catch(() => {
          this.bgmReady = false;
        });
    }
  }

  private playOneShot(sound: ProjectAudioSoundConfig, options: PlayOneShotOptions = {}): void {
    if (!this.config.enabled || !this.audioUnlocked || !this.isSoundPlayable(sound.id)) return;

    const now = performance.now();
    const cooldownMs = Math.max(0, sound.cooldownMs);
    const previousPlay = this.lastPlayTime.get(sound.id) ?? 0;
    if (!options.ignoreCooldown && now - previousPlay < cooldownMs) return;
    this.lastPlayTime.set(sound.id, now);

    if (this.sfxBuffers.has(sound.id)) {
      void this.playWebAudioSound(sound, options);
      return;
    }
    this.playHtmlSound(sound, options);
  }

  private async playWebAudioSound(sound: ProjectAudioSoundConfig, options: AudioPlayOptions): Promise<void> {
    if (!this.sfxContext || !this.sfxMasterGain || this.sfxContext.state !== 'running') {
      this.playHtmlSound(sound, options);
      return;
    }
    const buffer = this.sfxBuffers.get(sound.id);
    if (!buffer) {
      this.playHtmlSound(sound, options);
      return;
    }

    try {
      const source = this.sfxContext.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = options.playbackRate ?? 1;

      const gainNode = this.sfxContext.createGain();
      gainNode.gain.value = this.getSoundVolume(sound, options);
      source.connect(gainNode);
      gainNode.connect(this.sfxMasterGain);

      const active = this.activeSources.get(sound.id) ?? [];
      const maxVoices = Math.max(1, Math.floor(sound.maxVoices));
      if (active.length >= maxVoices) {
        const stolen = active.shift();
        try {
          stolen?.stop();
        } catch {
          // Ignore already stopped source.
        }
      }
      active.push(source);
      this.activeSources.set(sound.id, active);

      source.onended = () => {
        const current = this.activeSources.get(sound.id);
        if (!current) return;
        const next = current.filter((item) => item !== source);
        if (next.length > 0) {
          this.activeSources.set(sound.id, next);
        } else {
          this.activeSources.delete(sound.id);
        }
        source.disconnect();
        gainNode.disconnect();
      };

      source.start(0);
    } catch {
      this.playHtmlSound(sound, options);
    }
  }

  private playHtmlSound(sound: ProjectAudioSoundConfig, options: AudioPlayOptions): void {
    const audio = this.htmlSounds.get(sound.id);
    if (!audio) return;
    audio.currentTime = 0;
    audio.playbackRate = options.playbackRate ?? 1;
    audio.preservesPitch = !options.playbackRate || options.playbackRate === 1;
    (audio as HTMLAudioElement & { mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }).mozPreservesPitch = audio.preservesPitch;
    (audio as HTMLAudioElement & { mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean }).webkitPreservesPitch = audio.preservesPitch;
    audio.volume = this.masterVolume * this.getSoundVolume(sound, options);
    void audio.play().catch(() => undefined);
  }

  private startActiveLoop(soundId: AudioSoundId, options: AudioPlayOptions): void {
    if (this.activeLoopTimers.has(soundId)) return;
    const sound = this.getRuntimeSoundConfig(soundId);
    if (!sound || sound.mode !== 'activeLoop') return;
    const playNow = () => {
      const currentSound = this.getRuntimeSoundConfig(soundId);
      if (!currentSound || currentSound.mode !== 'activeLoop') return;
      this.activeLoopLastPlayTime.set(soundId, performance.now());
      this.playOneShot(currentSound, { ...options, ignoreCooldown: true });
    };
    playNow();
    const timer = window.setInterval(playNow, this.getActiveLoopIntervalMs(sound));
    this.activeLoopTimers.set(soundId, timer);
  }

  private restartActiveLoop(soundId: AudioSoundId): void {
    const wasActive = this.activeLoopTimers.has(soundId);
    if (!wasActive) return;
    this.stop(soundId);
    this.startActiveLoop(soundId, { active: true });
  }

  private getActiveLoopIntervalMs(sound: ProjectAudioSoundConfig): number {
    return Math.max(16, Math.floor(sound.intervalMs || DEFAULT_ACTIVE_LOOP_INTERVAL_MS));
  }

  private getRuntimeSoundConfig(soundId: AudioSoundId): ProjectAudioSoundConfig | undefined {
    const base = this.soundConfigById.get(soundId);
    if (!base) return undefined;
    const preview = this.previewSoundParams.get(soundId);
    return preview ? { ...base, ...preview } : base;
  }

  private isSoundPlayable(soundId: AudioSoundId): boolean {
    return Boolean(this.htmlSounds.get(soundId) || this.sfxBuffers.get(soundId));
  }

  private getSoundVolume(sound: ProjectAudioSoundConfig, options: AudioPlayOptions = {}): number {
    const runtimeSound = this.getRuntimeSoundConfig(sound.id) ?? sound;
    return clamp01(options.volume ?? runtimeSound.volume);
  }

  private syncBgmVolume(): void {
    if (this.bgmAudio) this.bgmAudio.volume = this.masterVolume * this.bgmVolume;
  }

  private syncHtmlSoundVolume(soundId: AudioSoundId): void {
    const audio = this.htmlSounds.get(soundId);
    const sound = this.getRuntimeSoundConfig(soundId);
    if (!audio || !sound) return;
    audio.volume = this.masterVolume * clamp01(sound.volume);
  }

  private stopActiveSources(soundId: AudioSoundId): void {
    const active = this.activeSources.get(soundId);
    if (!active) return;
    for (const source of active) {
      try {
        source.stop();
      } catch {
        // Ignore already stopped source.
      }
    }
    this.activeSources.delete(soundId);
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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
