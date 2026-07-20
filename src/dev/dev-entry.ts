import { playableAnalyticsService } from '../services';
import { mountPaTemplateDevHost } from './DevHost';

const host = mountPaTemplateDevHost();

const reportCompleted = (): void => playableAnalyticsService.reportCompleted();
window.addEventListener('beforeunload', reportCompleted);
window.addEventListener('pagehide', reportCompleted);

import.meta.hot?.dispose(() => {
  window.removeEventListener('beforeunload', reportCompleted);
  window.removeEventListener('pagehide', reportCompleted);
  void host.dispose().catch(error => console.warn('[PaTemplateEditorEntry] hot-dispose failed', error));
});
