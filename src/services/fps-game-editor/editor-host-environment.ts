export type PaTemplateEditorBootMode = 'edit' | 'play' | null;

interface PaTemplateEditorHostWindow {
  readonly location: Pick<Location, 'href'>;
  readonly __BOOT_MODE?: 'edit' | 'play';
}

/** Resolve the host-owned initial mode before asynchronous editor setup starts. */
export function readPaTemplateEditorBootMode(
  windowValue: PaTemplateEditorHostWindow = window,
): PaTemplateEditorBootMode {
  if (windowValue.__BOOT_MODE === 'edit' || windowValue.__BOOT_MODE === 'play') {
    return windowValue.__BOOT_MODE;
  }
  // Forge Play's persistent editor frame is an about:srcdoc document. Keep
  // this compatibility fallback until every deployed host injects __BOOT_MODE.
  return /^about:srcdoc(?:#|$)/.test(windowValue.location.href) ? 'edit' : null;
}
