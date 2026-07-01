import type { Disposable } from './disposables';
import {
  acquireRuntimeDebugPanelManager,
  createRuntimeDebugPanelButton,
  readRuntimeDebugPanelsVisible,
  type RuntimeDebugPanelManager,
  type RuntimeDebugPanelPlacement,
} from './panel-manager';

export interface RuntimeDebugPanelLayoutController extends Disposable {
  isVisible(): boolean;
  setVisible(visible: boolean): void;
}

export interface RuntimeDebugPanelOptions {
  id: string;
  title: string;
  phase?: number | 'presentation' | 'framework';
  root?: HTMLElement;
  render(content: HTMLElement): Disposable | void;
}

export function installDebugPanelLayout(root: HTMLElement = document.body): RuntimeDebugPanelLayoutController {
  const acquired = acquireRuntimeDebugPanelManager(root);
  return {
    dispose: acquired.release,
    isVisible: () => acquired.manager.isVisible(),
    setVisible: (visible: boolean) => acquired.manager.setVisible(visible),
  };
}

export function mountRuntimeDebugPanel(options: RuntimeDebugPanelOptions): Disposable {
  const root = options.root ?? document.body;
  const acquired = acquireRuntimeDebugPanelManager(root);
  const registration = acquired.manager.registerPanel({
    id: options.id,
    title: options.title,
    phase: options.phase,
    render: options.render,
  });
  return {
    dispose() {
      registration.dispose();
      acquired.release();
    },
  };
}

export function mountRuntimeDebugPanelContainer(
  root: HTMLElement,
  container: HTMLElement,
  options: { placement?: RuntimeDebugPanelPlacement } = {},
): () => void {
  const acquired = acquireRuntimeDebugPanelManager(root);
  const id = container.id || `panel_${Math.random().toString(36).slice(2)}`;
  const title = container.getAttribute('aria-label') || container.getAttribute('data-runtime-debug-panel-title') || 'Debug Panel';
  const registration = acquired.manager.registerContainer({
    id,
    title,
    placement: options.placement,
    container,
  });
  return () => {
    registration.dispose();
    acquired.release();
  };
}

export function readDebugHudVisible(ownerDocument: Document = document): boolean {
  return readRuntimeDebugPanelsVisible(ownerDocument);
}

export { createRuntimeDebugPanelButton };
export type { RuntimeDebugPanelManager, RuntimeDebugPanelPlacement };
