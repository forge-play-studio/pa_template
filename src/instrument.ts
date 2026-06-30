import { captureException as captureBrowserException } from '@sentry/core/browser';

const sentryEnabled = typeof __ENABLE_SENTRY__ !== 'undefined' && __ENABLE_SENTRY__;

type SentryBrowserSdk = {
  init(options?: Record<string, unknown>): unknown;
};

let initPromise: Promise<void> | null = null;
let sentryCaptureException: ((error: unknown) => void) | null = null;

export function initSentry(): Promise<void> {
  if (!sentryEnabled) return Promise.resolve();
  if (initPromise) return initPromise;

  // Use the browser SDK sidecar directly so the template does not bundle Replay/Feedback re-exports.
  // @ts-expect-error Sentry does not publish this internal sidecar in package exports.
  initPromise = import('../node_modules/@sentry/browser/build/npm/esm/prod/sdk.js').then((Sentry: SentryBrowserSdk) => {
    Sentry.init({
      dsn: __SENTRY_DSN__,
      environment: import.meta.env.MODE,
      release: __SENTRY_RELEASE__,
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications.',
      ],
      denyUrls: [
        /^chrome-extension:\/\//i,
        /^moz-extension:\/\//i,
        /^safari-extension:\/\//i,
        /^webkit-extension:\/\//i,
      ],
      initialScope: {
        tags: {
          channel: __CHANNEL__,
          locale: __LOCALE__,
        },
      },
    });

    sentryCaptureException = (error: unknown) => {
      captureBrowserException(error);
    };
  });

  return initPromise;
}

export function captureSentryException(error: unknown): void {
  sentryCaptureException?.(error);
}
