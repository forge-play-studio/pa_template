import type { GameWorld } from '../runtime/GameWorld';
import type { VfxPlaybackHandle, VfxService } from '../services';
import { mountRuntimeDebugPanel } from './debug-panel-layout';
import {
  createDebugButton,
  createDebugButtonRow,
  createDebugPanelElement,
  createDebugPanelSection,
  createDebugStatusLine,
} from './framework/controls';
import type { Disposable } from './framework/disposables';

export interface RuntimeVfxDebugPanelOptions {
  root?: HTMLElement;
  getGame: () => GameWorld | null;
}

export function mountRuntimeVfxDebugPanel(options: RuntimeVfxDebugPanelOptions): Disposable {
  return mountRuntimeDebugPanel({
    id: 'runtime-vfx-debug-panel',
    title: 'VFX Pools',
    phase: 'presentation',
    root: options.root,
    render(content) {
      return renderRuntimeVfxDebugPanel(content, options);
    },
  });
}

function renderRuntimeVfxDebugPanel(content: HTMLElement, options: RuntimeVfxDebugPanelOptions): Disposable {
  const doc = content.ownerDocument;
  const panel = createDebugPanelElement(doc, 'VFX Pool / Warmup Diagnostics');
  panel.style.width = 'min(620px, calc(100vw - 32px))';
  content.append(panel);

  const statusSection = createDebugPanelSection(doc, 'Service');
  const status = createDebugStatusLine(doc, 'Waiting for VFX service…');
  const budget = createDebugStatusLine(doc);
  statusSection.append(status, budget);
  panel.append(statusSection);

  const controls = createDebugPanelSection(doc, 'Effect preview (uses the production pool)');
  const effectSelect = doc.createElement('select');
  effectSelect.setAttribute('aria-label', 'VFX effect');
  styleInput(effectSelect);
  const ownerInput = doc.createElement('input');
  ownerInput.value = 'vfx-debug-preview';
  ownerInput.placeholder = 'owner id';
  ownerInput.setAttribute('aria-label', 'VFX debug owner');
  styleInput(ownerInput);
  const paramsInput = doc.createElement('textarea');
  paramsInput.rows = 5;
  paramsInput.spellcheck = false;
  paramsInput.setAttribute('aria-label', 'VFX params JSON');
  styleInput(paramsInput);
  paramsInput.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  const actionStatus = createDebugStatusLine(doc);
  controls.append(effectSelect, ownerInput, paramsInput);
  panel.append(controls);

  let lastHandle: VfxPlaybackHandle | null = null;
  const stressOwners = new Set<string>();
  const getService = (): VfxService | null => options.getGame()?.getVfxService() ?? null;

  const playOne = () => {
    const service = getService();
    const effectId = effectSelect.value;
    if (!service || !effectId) {
      actionStatus.textContent = 'VFX service/effect is unavailable.';
      return;
    }
    const params = readParams(paramsInput.value, actionStatus);
    if (!params) return;
    const result = service.play(effectId, {
      owner: readOwner(ownerInput.value),
      params,
      source: 'debug',
      placement: { position: { x: 0, y: 0, z: 0 } },
    });
    if (!result.ok) {
      actionStatus.textContent = `${result.code}: ${result.message}`;
      return;
    }
    lastHandle = result.handle;
    actionStatus.textContent = `lease ${result.handle.leaseId} acquired${result.handle.active ? '' : ' and already completed'}.`;
  };

  const releaseLast = () => {
    const released = lastHandle?.release() ?? false;
    actionStatus.textContent = released ? 'Last lease recycled.' : 'No active last lease.';
    lastHandle = null;
  };

  const releaseOwner = () => {
    const service = getService();
    const owner = readOwner(ownerInput.value);
    const released = service?.releaseByOwner(owner) ?? 0;
    actionStatus.textContent = `Released ${released} lease(s) for owner "${owner}".`;
  };

  const runCapacityTest = (overflow: boolean) => {
    const service = getService();
    const effectId = effectSelect.value;
    const effect = service?.getRegisteredEffects().find(entry => entry.effectId === effectId);
    if (!service || !effect) {
      actionStatus.textContent = 'Select a registered effect first.';
      return;
    }
    const params = readParams(paramsInput.value, actionStatus);
    if (!params) return;
    const owner = `vfx-debug-stress:${effectId}:${Date.now()}`;
    stressOwners.add(owner);
    const requested = effect.config.poolSize + (overflow ? 1 : 0);
    const results = Array.from({ length: requested }, (_, index) => service.play(effectId, {
      owner,
      params,
      source: 'debug',
      placement: { position: { x: index * 0.5, y: 0, z: 0 } },
    }));
    const accepted = results.filter(result => result.ok).length;
    const rejected = results.length - accepted;
    actionStatus.textContent = `${overflow ? 'capacity+1' : 'capacity'} test: ${accepted} accepted, ${rejected} rejected. Release stress leases when inspected.`;
  };

  const releaseStress = () => {
    const service = getService();
    let released = 0;
    for (const owner of stressOwners) released += service?.releaseByOwner(owner) ?? 0;
    stressOwners.clear();
    actionStatus.textContent = `Released ${released} stress lease(s).`;
  };

  const buttonRow = createDebugButtonRow(doc, [
    createDebugButton(doc, 'Play', playOne),
    createDebugButton(doc, 'Release last', releaseLast),
    createDebugButton(doc, 'Release owner', releaseOwner),
    createDebugButton(doc, 'Fill capacity', () => runCapacityTest(false)),
    createDebugButton(doc, 'Capacity + 1', () => runCapacityTest(true)),
    createDebugButton(doc, 'Release stress', releaseStress),
  ]);
  controls.append(buttonRow, actionStatus);

  const diagnosticsSection = createDebugPanelSection(doc, 'Per-effect diagnostics');
  const diagnosticsTable = doc.createElement('div');
  diagnosticsTable.style.cssText = 'overflow:auto;max-height:300px';
  diagnosticsSection.append(diagnosticsTable);
  panel.append(diagnosticsSection);

  let previousEffectIds = '';
  const refresh = () => {
    const service = getService();
    if (!service) {
      status.textContent = 'VFX service unavailable.';
      budget.textContent = '';
      diagnosticsTable.replaceChildren(createEmptyLine(doc, 'No service diagnostics.'));
      return;
    }
    const snapshot = service.getDiagnostics();
    status.textContent = `state=${snapshot.state} · registry=${snapshot.registryFrozen ? 'frozen' : 'collecting'}`;
    budget.textContent = [
      `global active ${snapshot.budget.active}/${snapshot.budget.globalActiveLimit}`,
      `peak ${snapshot.budget.peakActive}`,
      `expected ${snapshot.budget.expectedGlobalPeak}`,
      `rejected ${snapshot.budget.rejected}`,
      `decision ${snapshot.budget.status}`,
      snapshot.budget.conflict ?? '',
    ].filter(Boolean).join(' · ');
    budget.style.color = snapshot.budget.conflict || snapshot.budget.status !== 'confirmed' ? '#fbbf24' : '#86efac';
    refreshEffectOptions(service, effectSelect, paramsInput, previousEffectIds);
    previousEffectIds = service.getRegisteredEffects().map(effect => effect.effectId).join('|');
    renderDiagnosticsTable(doc, diagnosticsTable, snapshot.effects);
  };

  effectSelect.addEventListener('change', () => {
    const effect = getService()?.getRegisteredEffects().find(entry => entry.effectId === effectSelect.value);
    paramsInput.value = JSON.stringify(effect?.defaultParams ?? {}, null, 2);
    refresh();
  });
  const unsubscribe = getService()?.subscribeDiagnostics(refresh) ?? (() => undefined);
  const refreshTimer = window.setInterval(refresh, 250);
  refresh();

  return {
    dispose() {
      window.clearInterval(refreshTimer);
      unsubscribe();
      lastHandle?.release();
      const service = getService();
      for (const owner of stressOwners) service?.releaseByOwner(owner);
      stressOwners.clear();
      panel.remove();
    },
  };
}

function refreshEffectOptions(
  service: VfxService,
  select: HTMLSelectElement,
  paramsInput: HTMLTextAreaElement,
  previousEffectIds: string,
): void {
  const effects = service.getRegisteredEffects();
  const nextEffectIds = effects.map(effect => effect.effectId).join('|');
  if (nextEffectIds === previousEffectIds) return;
  const selected = select.value;
  select.replaceChildren(...effects.map(effect => {
    const option = select.ownerDocument.createElement('option');
    option.value = effect.effectId;
    option.textContent = `${effect.displayName} (${effect.effectId})`;
    return option;
  }));
  select.value = effects.some(effect => effect.effectId === selected) ? selected : effects[0]?.effectId ?? '';
  const current = effects.find(effect => effect.effectId === select.value);
  paramsInput.value = JSON.stringify(current?.defaultParams ?? {}, null, 2);
}

function renderDiagnosticsTable(
  doc: Document,
  root: HTMLElement,
  effects: ReturnType<VfxService['getDiagnostics']>['effects'],
): void {
  if (effects.length === 0) {
    root.replaceChildren(createEmptyLine(doc, 'No project VFX effects registered.'));
    return;
  }
  const table = doc.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font:11px ui-monospace,SFMono-Regular,Menlo,monospace';
  const headers = ['effect', 'status', 'cap', 'active', 'free', 'peak', 'warm', 'recycle', 'reject', 'timing'];
  const head = doc.createElement('tr');
  for (const header of headers) head.append(createCell(doc, header, true));
  table.append(head);
  for (const effect of effects) {
    const row = doc.createElement('tr');
    const values = [
      effect.effectId,
      effect.status,
      `${effect.effectiveCapacity}/${effect.configuredCapacity}`,
      String(effect.active),
      String(effect.available),
      String(effect.peakActive),
      `${effect.warmed}/${effect.created}`,
      String(effect.recycled),
      effect.lastRejection ? `${effect.rejected}:${effect.lastRejection}` : String(effect.rejected),
      `${effect.prepareMs.toFixed(1)}+${effect.warmupMs.toFixed(1)}ms`,
    ];
    for (const value of values) row.append(createCell(doc, value, false));
    if (effect.lastError) row.title = effect.lastError;
    table.append(row);
  }
  root.replaceChildren(table);
}

function createCell(doc: Document, text: string, heading: boolean): HTMLElement {
  const cell = doc.createElement(heading ? 'th' : 'td');
  cell.textContent = text;
  cell.style.cssText = `padding:4px 6px;border-bottom:1px solid rgba(148,163,184,.18);text-align:left;white-space:nowrap;${heading ? 'color:#cbd5e1' : ''}`;
  return cell;
}

function createEmptyLine(doc: Document, text: string): HTMLElement {
  const line = doc.createElement('div');
  line.textContent = text;
  line.style.color = '#94a3b8';
  return line;
}

function readParams(value: string, status: HTMLElement): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Params must be a JSON object.');
    return parsed as Record<string, unknown>;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
    return null;
  }
}

function readOwner(value: string): string {
  return value.trim() || 'vfx-debug-preview';
}

function styleInput(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): void {
  element.style.cssText = [
    'width:100%',
    'box-sizing:border-box',
    'padding:6px 8px',
    'border:1px solid rgba(148,163,184,.35)',
    'border-radius:6px',
    'background:rgba(15,23,42,.8)',
    'color:#f8fafc',
    'font:11px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  ].join(';');
}
