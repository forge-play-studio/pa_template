export function createDebugPanelElement(ownerDocument: Document, title: string): HTMLElement {
  const panel = ownerDocument.createElement('section');
  panel.style.cssText = [
    'width:300px',
    'max-width:calc(100vw - 32px)',
    'background:rgba(15,23,42,.94)',
    'border:1px solid rgba(148,163,184,.32)',
    'border-radius:8px',
    'box-shadow:0 18px 48px rgba(0,0,0,.32)',
    'color:#f8fafc',
    'font:12px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'overflow:hidden',
  ].join(';');

  const header = ownerDocument.createElement('header');
  header.textContent = title;
  header.style.cssText = [
    'padding:8px 10px',
    'font-weight:700',
    'border-bottom:1px solid rgba(148,163,184,.22)',
    'background:rgba(30,41,59,.72)',
  ].join(';');
  panel.append(header);
  return panel;
}

export function createDebugPanelSection(ownerDocument: Document, title?: string): HTMLElement {
  const section = ownerDocument.createElement('div');
  section.style.cssText = 'display:grid;gap:6px;padding:10px';
  if (title) {
    const heading = ownerDocument.createElement('div');
    heading.textContent = title;
    heading.style.cssText = 'font-weight:700;color:#cbd5e1';
    section.append(heading);
  }
  return section;
}

export function createDebugButton(ownerDocument: Document, label: string, onClick: () => void): HTMLButtonElement {
  const button = ownerDocument.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = [
    'height:28px',
    'padding:0 10px',
    'border:1px solid rgba(148,163,184,.35)',
    'border-radius:6px',
    'background:rgba(51,65,85,.9)',
    'color:#f8fafc',
    'font:700 11px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'cursor:pointer',
  ].join(';');
  button.addEventListener('click', onClick);
  return button;
}

export function createDebugStatusLine(ownerDocument: Document, initialText = ''): HTMLDivElement {
  const status = ownerDocument.createElement('div');
  status.textContent = initialText;
  status.style.cssText = 'min-height:18px;color:#cbd5e1;font-size:11px;line-height:1.4';
  return status;
}

export function createDebugButtonRow(ownerDocument: Document, buttons: HTMLButtonElement[]): HTMLElement {
  const row = ownerDocument.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
  row.append(...buttons);
  return row;
}
