import type { PluginOption } from 'vite';
import {
  createFpsGameEditorRenderingAuthoringServices,
  createFpsGameEditorViteAdapter,
  type FpsGameEditorProjectAuthoringApiPluginOptions,
} from '@fps-games/editor/playable-sdk/vite';

type ProductViteAdapter = ReturnType<typeof createFpsGameEditorViteAdapter>;

declare const adapter: ProductViteAdapter;
declare const renderingServices: ReturnType<typeof createFpsGameEditorRenderingAuthoringServices>;

const handleRenderingProfileRoute: NonNullable<
  FpsGameEditorProjectAuthoringApiPluginOptions['handleRenderingProfileRoute']
> = renderingServices.handleRoute;

const plugins: PluginOption[] = [
  adapter.playableEditorVitePlugin(),
  adapter.projectAuthoringApiPlugin(),
];

void plugins;
void handleRenderingProfileRoute;
