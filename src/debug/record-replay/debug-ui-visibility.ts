import type { Disposable } from '../framework/disposables';

/**
 * DEV-only overlays that must not appear in a human demo recording.
 *
 * **Built-ins cover only what the template itself renders.** A game that adds its own overlays
 * (FPS monitor, stats panel, editor workbench, …) registers them via `registerDebugUiSelectors()`
 * from its wiring layer — this file must never learn a specific game's DOM.
 *
 * ⚠️ Historical trap (found in qy-blade-goldrush, 2026-07-09): the list shipped before this refactor
 * was mostly `[data-runtime-debug-panel-*]` attributes that **no element ever carried** — not in the
 * game, and not in the template either. `collapseDebugUiForRecording()` therefore silently hid
 * nothing, and a human recorded a screen full of panels. Two lessons, both encoded here:
 *
 *   1. Only list selectors verified against a **live DOM**, never against source intent.
 *   2. A selector matching zero elements must be loud, not silent — `findUnmatchedDebugUiSelectors()`.
 */
const BUILT_IN_DEBUG_UI_SELECTORS: readonly string[] = [
  // `debug/framework/panel-manager.ts` identifies its roots by element id, not by data attributes.
  '#runtime-debug-panel-manager-root',
  '#runtime-debug-panel-manager-bottom-dock',
  '[data-runtime-debug-panel-container]',
];

const HIDDEN_STYLE_ELEMENT_ID = 'rr-human-demo-hidden-debug-ui';

const NOOP_RESTORE = (): void => undefined;

let collapseEnabled = true;
let nextRegistrationId = 1;
const registeredSelectors: Array<{ id: number; selectors: readonly string[] }> = [];

/**
 * A game declares the DEV overlays only it knows about. Call during startup wiring, **before**
 * `installHiddenDebugUiStyle()` — the stylesheet snapshots the selector list when it is installed.
 */
export function registerDebugUiSelectors(...selectors: readonly string[]): Disposable {
  const id = nextRegistrationId++;
  const cleaned = selectors.map((selector) => selector.trim()).filter((selector) => selector.length > 0);
  if (cleaned.length > 0) registeredSelectors.push({ id, selectors: cleaned });
  return {
    dispose: () => {
      for (let index = registeredSelectors.length - 1; index >= 0; index -= 1) {
        if (registeredSelectors[index]?.id === id) registeredSelectors.splice(index, 1);
      }
    },
  };
}

export function clearRegisteredDebugUiSelectors(): void {
  registeredSelectors.length = 0;
}

/** Built-ins first, then whatever the game registered. Deduplicated, order-stable. */
export function getDebugUiSelectors(): readonly string[] {
  const all = [...BUILT_IN_DEBUG_UI_SELECTORS];
  for (const registered of registeredSelectors) all.push(...registered.selectors);
  return [...new Set(all)];
}

/**
 * Selectors that currently match nothing. A non-empty result while the game is up means either the
 * overlay has not been built yet, or someone listed a selector that does not exist — the exact
 * failure that let a human record a screen full of debug panels. Callers should surface it.
 */
export function findUnmatchedDebugUiSelectors(doc: Document): string[] {
  return getDebugUiSelectors().filter((selector) => {
    try {
      return doc.querySelector(selector) === null;
    } catch {
      return true; // an invalid selector is worse than an unmatched one
    }
  });
}

/**
 * `?rrPanels=1` escape hatch. Disables the per-session collapse for *every* call site
 * (startRec / replay / playback / trail / samples / benchmark), so an agent debugging a
 * replay keeps its panels on screen.
 */
export function setDebugUiCollapseEnabled(enabled: boolean): void {
  collapseEnabled = enabled;
}

/**
 * Per-element inline hide, restored when the recording session ends.
 * Used by `startRec()` so a tape's frames never contain debug chrome.
 */
export function collapseDebugUiForRecording(doc: Document): () => void {
  if (!collapseEnabled) return NOOP_RESTORE;
  const hidden = new Map<HTMLElement, {
    display: string;
    visibility: string;
    pointerEvents: string;
    ariaHidden: string | null;
  }>();
  for (const selector of getDebugUiSelectors()) {
    for (const element of doc.querySelectorAll<HTMLElement>(selector)) {
      if (hidden.has(element)) continue;
      hidden.set(element, {
        display: element.style.display,
        visibility: element.style.visibility,
        pointerEvents: element.style.pointerEvents,
        ariaHidden: element.getAttribute('aria-hidden'),
      });
      element.style.setProperty('display', 'none', 'important');
      element.style.setProperty('visibility', 'hidden', 'important');
      element.style.setProperty('pointer-events', 'none', 'important');
      element.setAttribute('aria-hidden', 'true');
    }
  }
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    for (const [element, previous] of hidden) {
      element.style.display = previous.display;
      element.style.visibility = previous.visibility;
      element.style.pointerEvents = previous.pointerEvents;
      if (previous.ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', previous.ariaHidden);
    }
    hidden.clear();
  };
}

/**
 * Persistent stylesheet hide for the whole human-demo session (`?rrAutoStart=1`).
 *
 * Deliberately a stylesheet rather than inline styles: `collapseDebugUiForRecording()`'s restore
 * pass clears inline styles when recording stops, and a stylesheet rule keeps the chrome hidden
 * afterwards instead of letting every panel pop back into frame. It also covers elements created
 * *later* (a game's stats overlay is often built after `game.start()`), so the panels never flash
 * on screen at all.
 *
 * Dispose to bring the panels back (the HUD's `⋯` button and `?rrPanels=1` both rely on this).
 */
export function installHiddenDebugUiStyle(doc: Document): Disposable {
  const existing = doc.getElementById(HIDDEN_STYLE_ELEMENT_ID);
  if (existing) return { dispose: () => existing.remove() };

  const style = doc.createElement('style');
  style.id = HIDDEN_STYLE_ELEMENT_ID;
  style.textContent = `${getDebugUiSelectors().join(',\n')} {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}`;
  (doc.head ?? doc.documentElement).append(style);
  return { dispose: () => style.remove() };
}

export function isDebugUiHidden(doc: Document): boolean {
  return !!doc.getElementById(HIDDEN_STYLE_ELEMENT_ID);
}
