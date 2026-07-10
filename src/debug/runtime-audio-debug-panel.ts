import type { Game } from '../core/Game';
import {
  getProjectAudioConfig,
  type ProjectAudioConfig,
  type ProjectAudioSoundConfig,
} from '../config';
import { ASSET_CATALOG, isSoundAssetRegistered } from '../assets';
import type { AudioService } from '../services';
import { saveAudioDebugConfig } from './audio/audio-debug-config-client';
import { mountRuntimeDebugPanel } from './framework/panel-layout';
import type { Disposable } from './framework/disposables';

export interface RuntimeAudioDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => Game | null;
}

export type RuntimeAudioDebugPanel = Disposable;

type NumberFieldOptions = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
};

const PANEL_ID = 'runtime-audio-debug-panel';
const SAVE_RELOAD_DELAY_MS = 180;

export function mountRuntimeAudioDebugPanel(options: RuntimeAudioDebugPanelOptions): RuntimeAudioDebugPanel {
  return mountRuntimeDebugPanel({
    root: options.root,
    id: PANEL_ID,
    title: 'Audio',
    phase: 'presentation',
    render(content) {
      return renderAudioDebugPanel(content, options);
    },
  });
}

function renderAudioDebugPanel(content: HTMLElement, options: RuntimeAudioDebugPanelOptions): Disposable {
  const ownerDocument = content.ownerDocument;
  const win = ownerDocument.defaultView ?? window;
  let draft = cloneAudioConfig(getProjectAudioConfig());
  let disposed = false;

  const shell = ownerDocument.createElement('div');
  shell.style.cssText = [
    'display:grid',
    'gap:10px',
    'width:340px',
    'max-width:calc(100vw - 32px)',
    'max-height:min(72vh, 720px)',
    'overflow:auto',
    'box-sizing:border-box',
    'padding:10px',
    'color:#e5eefb',
    'font:12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';');

  const status = ownerDocument.createElement('div');
  status.style.cssText = 'min-height:16px;color:#a5b4fc;font-size:11px;line-height:1.35;';
  shell.append(status);

  const controlsRoot = ownerDocument.createElement('div');
  controlsRoot.style.cssText = 'display:grid;gap:10px;';
  shell.append(controlsRoot);
  content.append(shell);

  const setStatus = (message: string): void => {
    status.textContent = message;
  };

  const getAudio = (): AudioService | null => options.getGame()?.getAudioService() ?? null;
  const applyPreview = (): void => {
    const audio = getAudio();
    audio?.setMasterVolume(draft.masterVolume);
    audio?.setBgmVolume(draft.bgm.volume);
    for (const sound of draft.sounds) {
      audio?.setPreviewParams(sound.id, {
        volume: sound.volume,
        cooldownMs: sound.cooldownMs,
        maxVoices: sound.maxVoices,
        intervalMs: sound.intervalMs,
      });
    }
  };

  const render = (): void => {
    controlsRoot.replaceChildren();
    controlsRoot.append(createSection(ownerDocument, 'Master', [
      createInfoRow(ownerDocument, 'Enabled', draft.enabled ? 'Yes' : 'No'),
      createNumberField(ownerDocument, {
        label: 'Master volume',
        value: draft.masterVolume,
        min: 0,
        max: 1,
        step: 0.01,
        onChange(value) {
          draft.masterVolume = value;
          getAudio()?.setMasterVolume(value);
        },
      }),
    ]));

    const bgmEntry = draft.bgm.assetId ? ASSET_CATALOG[draft.bgm.assetId] : undefined;
    controlsRoot.append(createSection(ownerDocument, 'BGM', [
      createInfoRow(ownerDocument, 'Asset', formatAssetLabel(draft.bgm.assetId, bgmEntry?.displayName)),
      createInfoRow(ownerDocument, 'Asset status', draft.bgm.assetId && isSoundAssetRegistered(draft.bgm.assetId) ? 'Ready' : 'Not set'),
      createNumberField(ownerDocument, {
        label: 'BGM volume',
        value: draft.bgm.volume,
        min: 0,
        max: 1,
        step: 0.01,
        onChange(value) {
          draft.bgm.volume = value;
          getAudio()?.setBgmVolume(value);
        },
      }),
    ]));

    if (draft.sounds.length === 0) {
      controlsRoot.append(createSection(ownerDocument, 'Sounds', [
        createInfoRow(ownerDocument, 'Configured', 'No sounds in gameplay.json: audio.sounds'),
      ]));
    } else {
      for (const sound of draft.sounds) {
        controlsRoot.append(createSoundSection(ownerDocument, sound, getAudio, setStatus));
      }
    }

    const actions = ownerDocument.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    const saveButton = createButton(ownerDocument, 'Save', async () => {
      try {
        applyPreview();
        await saveAudioDebugConfig(draft);
        setStatus('Saved. Reloading...');
        win.setTimeout(() => win.location.reload(), SAVE_RELOAD_DELAY_MS);
      } catch (error) {
        console.warn('[RuntimeAudioDebugPanel] Save failed', error);
        setStatus(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
    const resetButton = createButton(ownerDocument, 'Reset', () => {
      draft = cloneAudioConfig(getProjectAudioConfig());
      getAudio()?.clearPreviewParams();
      applyPreview();
      render();
      setStatus('Reset to source config');
    });
    actions.append(saveButton, resetButton);
    controlsRoot.append(actions);
  };

  const refreshStatus = (): void => {
    if (disposed) return;
    const state = getAudio()?.getDebugState();
    if (!state) {
      setStatus('Audio service unavailable');
      return;
    }
    const activeCount = state.sounds.filter((sound) => sound.active).length;
    setStatus(`Unlocked: ${state.unlocked ? 'yes' : 'no'} | BGM: ${state.bgm.playing ? 'playing' : 'idle'} | active loops: ${activeCount}`);
  };

  render();
  applyPreview();
  const statusTimer = win.setInterval(refreshStatus, 600);
  refreshStatus();

  return {
    dispose() {
      disposed = true;
      win.clearInterval(statusTimer);
      shell.remove();
    },
  };
}

function createSoundSection(
  ownerDocument: Document,
  sound: ProjectAudioSoundConfig,
  getAudio: () => AudioService | null,
  setStatus: (message: string) => void,
): HTMLElement {
  const entry = ASSET_CATALOG[sound.assetId];
  const rows: HTMLElement[] = [
    createInfoRow(ownerDocument, 'Id', sound.id),
    createInfoRow(ownerDocument, 'Mode', sound.mode),
    createInfoRow(ownerDocument, 'Asset', formatAssetLabel(sound.assetId, entry?.displayName)),
    createInfoRow(ownerDocument, 'Asset status', isSoundAssetRegistered(sound.assetId) ? 'Ready' : 'Missing'),
    createNumberField(ownerDocument, {
      label: 'Volume',
      value: sound.volume,
      min: 0,
      max: 1,
      step: 0.01,
      onChange(value) {
        sound.volume = value;
        getAudio()?.setPreviewParams(sound.id, { volume: value });
      },
    }),
    createNumberField(ownerDocument, {
      label: 'Cooldown ms',
      value: sound.cooldownMs,
      min: 0,
      max: 5000,
      step: 10,
      onChange(value) {
        sound.cooldownMs = value;
        getAudio()?.setPreviewParams(sound.id, { cooldownMs: value });
      },
    }),
    createNumberField(ownerDocument, {
      label: 'Max voices',
      value: sound.maxVoices,
      min: 1,
      max: 16,
      step: 1,
      onChange(value) {
        sound.maxVoices = Math.max(1, Math.floor(value));
        getAudio()?.setPreviewParams(sound.id, { maxVoices: sound.maxVoices });
      },
    }),
  ];

  if (sound.mode === 'activeLoop') {
    rows.push(createNumberField(ownerDocument, {
      label: 'Interval ms',
      value: sound.intervalMs,
      min: 16,
      max: 10000,
      step: 10,
      onChange(value) {
        sound.intervalMs = Math.max(16, Math.floor(value));
        getAudio()?.setPreviewParams(sound.id, { intervalMs: sound.intervalMs });
      },
    }));
  }

  const actions = ownerDocument.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  if (sound.mode === 'activeLoop') {
    actions.append(
      createButton(ownerDocument, 'Start', () => {
        getAudio()?.unlockFromInteraction();
        getAudio()?.play(sound.id, { active: true });
        setStatus(`Started ${sound.id}`);
      }),
      createButton(ownerDocument, 'Stop', () => {
        getAudio()?.play(sound.id, { active: false });
        setStatus(`Stopped ${sound.id}`);
      }),
    );
  } else {
    actions.append(createButton(ownerDocument, 'Play', () => {
      getAudio()?.unlockFromInteraction();
      getAudio()?.play(sound.id);
      setStatus(`Played ${sound.id}`);
    }));
  }
  rows.push(actions);

  return createSection(ownerDocument, sound.id, rows);
}

function createSection(ownerDocument: Document, title: string, children: HTMLElement[]): HTMLElement {
  const section = ownerDocument.createElement('section');
  section.style.cssText = [
    'display:grid',
    'gap:8px',
    'padding:10px',
    'border:1px solid rgba(148,163,184,.28)',
    'border-radius:8px',
    'background:rgba(15,23,42,.92)',
  ].join(';');
  const heading = ownerDocument.createElement('div');
  heading.textContent = title;
  heading.style.cssText = 'font-weight:800;color:#f8fafc;font-size:12px;';
  section.append(heading, ...children);
  return section;
}

function createInfoRow(ownerDocument: Document, label: string, value: string): HTMLElement {
  const row = ownerDocument.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:center;color:#cbd5e1;';
  const labelElement = ownerDocument.createElement('span');
  labelElement.textContent = label;
  labelElement.style.cssText = 'color:#94a3b8;';
  const valueElement = ownerDocument.createElement('span');
  valueElement.textContent = value || '-';
  valueElement.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  valueElement.title = value;
  row.append(labelElement, valueElement);
  return row;
}

function createNumberField(ownerDocument: Document, options: NumberFieldOptions): HTMLElement {
  const row = ownerDocument.createElement('label');
  row.style.cssText = 'display:grid;grid-template-columns:92px 1fr;gap:8px;align-items:center;color:#cbd5e1;';
  const label = ownerDocument.createElement('span');
  label.textContent = options.label;
  label.style.cssText = 'color:#94a3b8;';
  const input = ownerDocument.createElement('input');
  input.type = 'number';
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);
  input.style.cssText = [
    'height:28px',
    'box-sizing:border-box',
    'width:100%',
    'border:1px solid rgba(148,163,184,.38)',
    'border-radius:6px',
    'background:rgba(15,23,42,.9)',
    'color:#f8fafc',
    'padding:0 8px',
    'font:12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';');
  input.addEventListener('input', () => {
    const value = clamp(readNumber(input.value, options.value), options.min, options.max);
    options.onChange(value);
  });
  row.append(label, input);
  return row;
}

function createButton(ownerDocument: Document, label: string, onClick: () => void | Promise<void>): HTMLButtonElement {
  const button = ownerDocument.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = [
    'height:28px',
    'padding:0 10px',
    'border:1px solid rgba(148,163,184,.36)',
    'border-radius:6px',
    'background:rgba(51,65,85,.9)',
    'color:#f8fafc',
    'font:700 11px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'cursor:pointer',
  ].join(';');
  button.addEventListener('click', () => {
    void onClick();
  });
  return button;
}

function cloneAudioConfig(source: ProjectAudioConfig): ProjectAudioConfig {
  return {
    enabled: source.enabled,
    masterVolume: source.masterVolume,
    bgm: { ...source.bgm },
    sounds: source.sounds.map((sound) => ({ ...sound })),
  };
}

function formatAssetLabel(assetId: string, displayName?: string): string {
  if (!assetId) return 'Not set';
  return displayName ? `${displayName} (${assetId})` : assetId;
}

function readNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
