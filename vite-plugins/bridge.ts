import type { Plugin } from 'vite';

export interface BridgePluginOptions {
  port?: number;
  enabled?: boolean;
  delay?: number;
}

export function bridgePlugin(opts: BridgePluginOptions = {}): Plugin {
  const port = opts.port ?? 8080;
  const enabled = opts.enabled ?? true;
  const delay = opts.delay ?? 2000;

  return {
    name: 'vite-plugin-game-bridge',
    apply: 'serve',

    transformIndexHtml(html) {
      if (!enabled) return html;

      const script = `
<script>
(function() {
  setTimeout(function() {
    var e2b = location.href.match(/https?:\\/\\/\\d+-([a-z0-9]+)\\.e2b\\.(app|dev)/);
    var url = e2b
      ? 'https://${port}-' + e2b[1] + '.e2b.app/script/bridge.js'
      : 'http://localhost:${port}/script/bridge.js';
    var s = document.createElement('script');
    s.src = url; s.async = true;
    s.onerror = function() { console.log('[GameBridge] MCP Server not available'); };
    document.head.appendChild(s);
  }, ${delay});
})();
</script>`;
      return html.replace('</head>', `${script}\n</head>`);
    },
  };
}
