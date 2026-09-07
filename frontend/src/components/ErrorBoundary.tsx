import React, { Component, ErrorInfo, ReactNode } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

const CHUNK_RELOAD_KEY = 'pm_chunk_reload_attempted'

/**
 * Checks whether an error is caused by a failed dynamic import or stale JS chunk.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const errStr = (
    (typeof error === 'object' && error !== null && 'message' in error
      ? String((error as any).message)
      : '') +
    ' ' +
    String(error)
  ).toLowerCase()

  return (
    errStr.includes('failed to fetch dynamically imported module') ||
    errStr.includes('importing a module script failed') ||
    errStr.includes('error loading dynamically imported module') ||
    errStr.includes('loading chunk') ||
    errStr.includes("unexpected token '<'") ||
    errStr.includes('unexpected token <')
  )
}

/**
 * Attempts a single automatic reload on chunk load failure.
 * Returns true if a reload was triggered, false if already reloaded in this session.
 */
export function handleChunkLoadFailure(error: unknown): boolean {
  if (typeof window === 'undefined') return false
  if (isChunkLoadError(error)) {
    const alreadyAttempted = sessionStorage.getItem(CHUNK_RELOAD_KEY)
    if (!alreadyAttempted) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true')
      window.location.reload()
      return true
    }
  }
  return false
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo)

    // Attempt auto-recovery if the failure is due to a stale chunk
    const reloaded = handleChunkLoadFailure(error)
    if (reloaded) {
      return
    }

    // Optional: report to Sentry if available on window
    const win = window as any
    if (win?.Sentry && typeof win.Sentry.captureException === 'function') {
      win.Sentry.captureException(error, { extra: errorInfo })
    }
  }

  private handleReload = () => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    } catch {
      // Ignore storage errors
    }
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: '#F8FAFC',
            backgroundImage:
              'radial-gradient(circle at 15% 15%, rgba(56, 189, 248, 0.35) 0%, transparent 45%), radial-gradient(circle at 85% 15%, rgba(255, 75, 145, 0.18) 0%, transparent 40%), radial-gradient(circle at 50% 80%, rgba(114, 9, 183, 0.22) 0%, transparent 60%), linear-gradient(135deg, #FFF5F7 0%, #F5F3FF 45%, #F0FDFA 100%)',
            color: 'var(--color-text-primary, #0F172A)',
            fontFamily: "var(--font-body, 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: '460px',
              width: '100%',
              backgroundColor: 'var(--color-surface, rgba(255, 255, 255, 0.55))',
              border: '1px solid var(--color-border, rgba(255, 255, 255, 0.75))',
              borderRadius: 'var(--radius-card, 24px)',
              padding: '40px 32px',
              boxShadow: 'var(--shadow-card, inset 0 1px 1px rgba(255, 255, 255, 0.9), 0 20px 40px -10px rgba(31, 38, 135, 0.08))',
              backdropFilter: 'var(--backdrop-blur, blur(30px) saturate(180%))',
              WebkitBackdropFilter: 'var(--backdrop-blur, blur(30px) saturate(180%))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                backgroundColor: 'var(--color-nav-active-bg, rgba(255, 75, 145, 0.08))',
                border: '1px solid rgba(255, 75, 145, 0.20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: 'var(--color-primary-start, #FF4B91)',
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h1
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--color-text-primary, #0F172A)',
                margin: '0 0 10px 0',
                letterSpacing: '-0.02em',
                fontFamily: "var(--font-display, 'Plus Jakarta Sans', sans-serif)",
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: 'var(--color-text-secondary, #475569)',
                margin: '0 0 28px 0',
              }}
            >
              A new update or temporary network disruption interrupted the app.
              Reloading the page usually resolves this immediately.
            </p>

            <button
              onClick={this.handleReload}
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                height: '44px',
                padding: '0 24px',
                borderRadius: 'var(--radius, 12px)',
                fontSize: '14px',
                fontWeight: 600,
                color: '#FFFFFF',
                background: 'var(--gradient-primary, linear-gradient(135deg, #FF4B91, #7209B7))',
                border: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.2s ease, transform 0.1s ease',
                boxShadow: 'var(--shadow-btn, 0 10px 24px rgba(247, 37, 133, 0.25))',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <RefreshCw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
