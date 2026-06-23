import type { Plugin } from 'vite';

/**
 * Moloco 校验要求 HTML 中存在 `FbPlayableAd.onCTAClick()`。
 *
 * 这里注入兼容 shim（对齐可通过版本的写法）：
 * - 显式定义 `window.FbPlayableAd.onCTAClick`
 * - 补充 `window.super_html.download`，默认转发到 `FbPlayableAd.onCTAClick()`
 * - 若环境未注入 Moloco 对象，则回退到 `window.open(url)`
 */
export function molocoCtaPlugin(): Plugin {
  const injectedScript = `<script>
(function () {
  var runtime = window;

  runtime.FbPlayableAd = runtime.FbPlayableAd || {};
  if (typeof runtime.FbPlayableAd.onCTAClick !== 'function') {
    runtime.FbPlayableAd.onCTAClick = function () {
      runtime.playableAnalytics?.onInstall?.('Global');
    };
  }

  runtime.super_html = runtime.super_html || {};
  if (typeof runtime.super_html.download !== 'function') {
    runtime.super_html.download = function (url) {
      if (runtime.FbPlayableAd && typeof runtime.FbPlayableAd.onCTAClick === 'function') {
        runtime.FbPlayableAd.onCTAClick();
        return;
      }

      if (typeof url === 'string' && url) {
        runtime.open(url, '_blank');
      }
    };
  }
})();
</script>`;

  return {
    name: 'vite-plugin-moloco-cta',
    transformIndexHtml(html) {
      return html.replace('</head>', `${injectedScript}\n</head>`);
    },
  };
}
