export interface PaTemplateEditorHostEnvironment {
  readonly bootMode: 'edit' | 'play' | null;
  readonly hostedSandbox: boolean;
}

interface PaTemplateEditorHostWindow {
  readonly location: Pick<Location, 'href'>;
  readonly __BOOT_MODE?: 'edit' | 'play';
}

/** Resolve host signals before asynchronous editor setup starts. */
export function readPaTemplateEditorHostEnvironment(
  windowValue: PaTemplateEditorHostWindow = window,
): PaTemplateEditorHostEnvironment {
  const bootMode = windowValue.__BOOT_MODE === 'edit' || windowValue.__BOOT_MODE === 'play'
    ? windowValue.__BOOT_MODE
    : null;
  return Object.freeze({
    bootMode,
    // srcdoc identifies a hosted sandbox, not its initial play/edit mode.
    hostedSandbox: bootMode !== null || /^about:srcdoc(?:#|$)/.test(windowValue.location.href),
  });
}
