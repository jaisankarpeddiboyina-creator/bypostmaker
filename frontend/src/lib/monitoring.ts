// ============================================================
// Monitoring — Sentry + PostHog
// Both initialised once at app start in main.tsx
// ============================================================

import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'

export function initMonitoring() {
  const isDev = import.meta.env.DEV

  // ── Sentry ─────────────────────────────────────────────────
  if (!isDev && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.2,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
    })
  }

  // ── PostHog ────────────────────────────────────────────────
  if (!isDev && import.meta.env.VITE_POSTHOG_KEY) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://app.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage',
    })
  }
}

export function identifyUser(userId: string, email: string, plan: string) {
  if (import.meta.env.DEV) return
  if (typeof posthog !== 'undefined') {
    posthog.identify(userId, { email, plan })
  }
  Sentry.setUser({ id: userId, email })
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (import.meta.env.DEV) return
  if (typeof posthog !== 'undefined') {
    posthog.capture(event, properties)
  }
}

export function trackError(error: Error, context?: Record<string, unknown>) {
  if (import.meta.env.DEV) { console.error(error); return }
  Sentry.captureException(error, { extra: context })
}
