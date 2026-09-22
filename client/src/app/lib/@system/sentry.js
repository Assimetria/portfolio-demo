// @system — Client-side Sentry error tracking initialization
// Mirrors the server ErrorTracking module pattern: lazy init, graceful fallback.
// Call initSentry() once at app startup (main.jsx) BEFORE React mounts.
//
// DSN resolution order:
//   1. VITE_ERROR_TRACKING_DSN env var (baked at build time by webpack DefinePlugin)
//   2. VITE_SENTRY_DSN env var (alias)
//   3. <meta name="sentry-dsn"> tag (injected at container startup by start.sh)
//
// In production Docker builds the VITE_* env vars are typically NOT available at
// build time. The meta tag fallback (#36046) ensures the DSN is injected at
// runtime by start.sh, so Sentry initializes without requiring a rebuild.

import * as Sentry from '@sentry/react'

let initialized = false

/**
 * Read Sentry DSN from the <meta name="sentry-dsn"> tag injected by start.sh.
 * Returns null if the tag is missing, empty, or still contains the __SENTRY_DSN__
 * placeholder (dev mode without start.sh).
 */
function getDsnFromMeta() {
  const content = document.querySelector('meta[name="sentry-dsn"]')?.getAttribute('content')
  if (!content || content === '__SENTRY_DSN__' || content.startsWith('__')) return null
  return content
}

/**
 * Initialize Sentry browser SDK.
 * Sets window.Sentry so the ErrorBoundary component can call captureException.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_ERROR_TRACKING_DSN
    || import.meta.env.VITE_SENTRY_DSN
    || getDsnFromMeta()

  if (!dsn) {
    return
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.PROD ? 'production' : 'development',
      release: import.meta.env.VITE_APP_VERSION || '0.0.0',
      enabled: import.meta.env.PROD,

      // Sample 10% of transactions in production
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

      // Replay disabled — opt-in only
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,

      integrations: [
        Sentry.browserTracingIntegration(),
      ],

      // Filter sensitive data before sending
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers['authorization']
          delete event.request.headers['cookie']
        }
        return event
      },
    })

    // Expose on window for ErrorBoundary compatibility (uses window.Sentry.captureException)
    window.Sentry = Sentry
    initialized = true
  } catch (err) {
    console.warn('[Sentry] Failed to initialize:', err.message)
  }
}

export function isSentryEnabled() {
  return initialized
}
