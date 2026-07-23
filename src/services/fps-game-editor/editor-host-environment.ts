export interface PaTemplateEditorHostEnvironment {
  readonly bootMode: 'edit' | 'play' | null;
  readonly initialModeIntent: 'fresh' | 'retained';
  readonly hostedSandbox: boolean;
}

interface PaTemplateEditorHostWindow {
  readonly location: Pick<Location, 'href'>;
  readonly performance?: {
    getEntriesByType(type: string): ArrayLike<unknown>;
  };
  readonly parent?: unknown;
  readonly __FPS_EDITOR_HOSTED_SANDBOX__?: boolean;
  readonly __BOOT_MODE?: 'edit' | 'play';
}

/** Resolve host signals before asynchronous editor setup starts. */
export function readPaTemplateEditorHostEnvironment(
  windowValue: PaTemplateEditorHostWindow = window,
): PaTemplateEditorHostEnvironment {
  const bootMode = windowValue.__BOOT_MODE === 'edit' || windowValue.__BOOT_MODE === 'play'
    ? windowValue.__BOOT_MODE
    : null;
  const navigationType = readPaTemplateNavigationType(
    windowValue.performance?.getEntriesByType('navigation')[0],
  );
  return Object.freeze({
    bootMode,
    initialModeIntent: bootMode === 'edit' && navigationType === 'reload'
      ? 'retained'
      : 'fresh',
    // Prefer the explicit host contract. The remaining signals preserve
    // compatibility with srcdoc and directly-navigated iframe sandboxes.
    hostedSandbox: windowValue.__FPS_EDITOR_HOSTED_SANDBOX__ === true
      || bootMode !== null
      || /^about:srcdoc(?:#|$)/.test(windowValue.location.href)
      || (windowValue.parent !== undefined && windowValue.parent !== windowValue),
  });
}

function readPaTemplateNavigationType(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('type' in value)) return null;
  return typeof value.type === 'string' ? value.type : null;
}
