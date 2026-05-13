import type { Plugin } from 'vite';

export interface LocalePluginOptions {
  locale: string;
  htmlLang?: string;
  isRTL?: boolean;
  imgRoot?: string;
}

/**
 * Minimal locale plugin for projects that only need build-time locale globals
 * and HTML lang/dir injection.
 */
export function localePlugin(options: LocalePluginOptions): Plugin {
  const lang = options.htmlLang || options.locale.toLowerCase();
  const dir = options.isRTL ? 'rtl' : 'ltr';

  return {
    name: 'locale-plugin',

    transformIndexHtml(html) {
      let nextHtml = html;

      if (/<html\b[^>]*\blang=/.test(nextHtml)) {
        nextHtml = nextHtml.replace(/(<html\b[^>]*\blang=)["'][^"']*(["'][^>]*>)/i, `$1"${lang}"$2`);
      } else {
        nextHtml = nextHtml.replace(/<html\b([^>]*)>/i, `<html$1 lang="${lang}">`);
      }

      if (/<html\b[^>]*\bdir=/.test(nextHtml)) {
        nextHtml = nextHtml.replace(/(<html\b[^>]*\bdir=)["'][^"']*(["'][^>]*>)/i, `$1"${dir}"$2`);
      } else {
        nextHtml = nextHtml.replace(/<html\b([^>]*)>/i, `<html$1 dir="${dir}">`);
      }

      return nextHtml;
    },
  };
}
