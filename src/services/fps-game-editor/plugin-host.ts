import { createFpsEditorPluginHostFromEnvironmentModule } from '@fps-games/editor';
import * as editorPluginModule from 'virtual:fps-plugins/editor';

// Project-side plugin host ownership stays behind the fps-game-editor service boundary.
// Application-scoped ownership lets individual editor harness mounts acquire
// and release leases without rebuilding the configured Plugin graph.
export const editorPluginHost = createFpsEditorPluginHostFromEnvironmentModule({
  module: editorPluginModule,
  report: diagnostic => {
    const method = diagnostic.severity === 'error' ? 'error' : diagnostic.severity === 'warning' ? 'warn' : 'info';
    console[method](`[Plugin:${diagnostic.pluginId ?? 'host'}] ${diagnostic.code}: ${diagnostic.message}`);
  },
});

await editorPluginHost.start();
