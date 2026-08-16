import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { useAppStore } from './store/app'
import { api } from './lib/api'
import { identifyUser } from './lib/monitoring'
import { trackPageView, trackSignUp } from './lib/analytics'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Toasts } from './components/Toasts'
import { UpgradeModal } from './components/UpgradeModal'
import { VerifyEmailScreen } from './components/VerifyEmailScreen'
import { ExportModal } from './components/ExportModal'
import { AssetPickerModal } from './components/AssetPickerModal'

const AppPage = lazy(() => import('./pages/AppPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const LegalPage = lazy(() => import('./pages/LegalPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const VsPage = lazy(() => import('./pages/VsPage'))
const ForPage = lazy(() => import('./pages/ForPage'))
const BrandKitPage = lazy(() => import('./pages/BrandKitPage'))
const PlatformPage = lazy(() => import('./pages/PlatformPage'))
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'))
const AssetsPage = lazy(() => import('./pages/AssetsPage'))

const SentryRoutes = Routes

function UpgradeModalWrapper() {
  const showUpgradeModal = useAppStore(s => s.showUpgradeModal)
  return showUpgradeModal ? <UpgradeModal /> : null
}

function ExportModalWrapper() {
  const showExportModal = useAppStore(s => s.showExportModal)
  return showExportModal ? <ExportModal /> : null
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <div className="app-shell-container">
      <div className="app-fixed-bg-canvas" />
      <Sidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      <div className="app-shell-content">
        <Topbar onMenuClick={() => setIsMobileSidebarOpen(true)} />
        <main className="app-shell-main">
          {children}
        </main>
      </div>
      <UpgradeModalWrapper />
      <ExportModalWrapper />

      <style>{`
        .app-shell-container {
          display: flex;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background: transparent;
        }

        .app-shell-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          height: 100%;
          overflow: hidden;
          margin-left: var(--sidebar-width);
          transition: margin-left var(--transition);
        }

        .app-shell-main {
          flex: 1;
          overflow-y: auto;
          position: relative;
          height: calc(100vh - 64px);
        }

        @media (max-width: 768px) {
          .app-shell-content {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore()
  const authReady = useAuthReady()
  if (!authReady) return <AppLoading />
  if (!user) return <Navigate to="/signup" replace />
  if (user.email_verified === 0) return <VerifyEmailScreen />
  return <>{children}</>
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore()
  const authReady = useAuthReady()
  if (!authReady) return <AppLoading />
  if (!user) return <Navigate to="/signup" replace />
  if (user.email_verified === 0) return <VerifyEmailScreen />
  if (user.role !== 'admin') return <Navigate to="/app" replace />
  return <>{children}</>
}

let authReadySnapshot = false
const authReadyListeners = new Set<() => void>()

function setAuthReadySnapshot(value: boolean) {
  authReadySnapshot = value
  authReadyListeners.forEach(listener => listener())
}

function useAuthReady() {
  const [ready, setReady] = useState(authReadySnapshot)
  useEffect(() => {
    const listener = () => setReady(authReadySnapshot)
    authReadyListeners.add(listener)
    return () => { authReadyListeners.delete(listener) }
  }, [])
  return ready
}

function AppLoading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      placeItems: 'center',
      background: 'var(--bg)',
      color: 'var(--text-2)',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
    }}>
      Loading PostMaker...
    </div>
  )
}

export default function App() {
  const { setUser, setUsage, setCurrency, addToast } = useAppStore()
  const location = useLocation()

  // Track page views on navigation/pathname changes
  useEffect(() => {
    trackPageView(location.pathname + location.search)
  }, [location])

  useEffect(() => {
    // Parse query parameters for successful verification or error states
    const params = new URLSearchParams(window.location.search)
    const verified = params.get('verified')
    const error = params.get('error')

    if (verified === 'true') {
      addToast('Email verified successfully! Welcome to PostMaker.', 'success')
      const newUrl = window.location.pathname + window.location.search.replace(/[?&]verified=true/, '').replace(/^&/, '?')
      window.history.replaceState({}, '', newUrl)
    }

    if (error === 'invalid_token') {
      addToast('The email verification link is invalid or has expired.', 'error')
      const newUrl = window.location.pathname + window.location.search.replace(/[?&]error=invalid_token/, '').replace(/^&/, '?')
      window.history.replaceState({}, '', newUrl)
    }

    setAuthReadySnapshot(false)
    api.user.me()
      .then(({ user, usage }) => {
        setUser(user)
        if (user.currency) {
          setCurrency(user.currency)
        } else {
          api.payments.currency()
            .then(({ currency }) => setCurrency(currency))
            .catch(() => setCurrency('usd'))
        }
        if (usage) {
          const planLimits: Record<string, number> = { free: 5, starter: 50, pro: 200, business: -1 }
          const limit = planLimits[user.plan] ?? 5
          setUsage({
            generations: usage.generations ?? 0,
            periodStart: usage.period_start ?? 0,
            periodEnd: usage.period_end ?? 0,
            limit,
            remaining: limit === -1 ? -1 : Math.max(0, limit - (usage.generations ?? 0)),
          })
        }
        // Identify user in PostHog + Sentry
        identifyUser(user.id, user.email, user.plan)
        // Detect google signups: check if created_at is within the last 60 seconds
        if (user && (Date.now() / 1000) - user.created_at < 60) {
          trackSignUp('google', user.id)
        }
        // Beta users get business access
        if (user.role === 'beta' && user.plan === 'free') {
          setUser({ ...user, plan: 'business' })
        }
      })
      .catch(() => {
        setUser(null)
        api.payments.currency()
          .then(({ currency }) => setCurrency(currency))
          .catch(() => setCurrency('usd'))
      })
      .finally(() => setAuthReadySnapshot(true))
  }, [addToast])

  return (
    <>
      <div className="app-fixed-bg-canvas" />
      <Suspense fallback={<AppLoading />}>
        <SentryRoutes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPage />} />
          <Route path="/vs" element={<VsPage />} />
          <Route path="/vs/:slug" element={<VsPage />} />
          <Route path="/for" element={<ForPage />} />
          <Route path="/for/:slug" element={<ForPage />} />
          <Route path="/tools" element={<PlatformPage />} />
          <Route path="/tools/:slug" element={<PlatformPage />} />

          {/* Auth routes */}
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/app" element={
            <Navigate to="/app/create" replace />
          } />
          <Route path="/app/create" element={
            <AppShell><AppPage /></AppShell>
          } />
          <Route path="/app/history" element={
            <AuthGuard><AppShell><HistoryPage /></AppShell></AuthGuard>
          } />
          <Route path="/app/billing" element={
            <AuthGuard><AppShell><BillingPage /></AppShell></AuthGuard>
          } />
          <Route path="/app/settings" element={
            <AuthGuard><AppShell><SettingsPage /></AppShell></AuthGuard>
          } />
          <Route path="/app/brand-kit" element={
            <AuthGuard><AppShell><BrandKitPage /></AppShell></AuthGuard>
          } />
          <Route path="/app/connections" element={
            <AuthGuard><AppShell><ConnectionsPage /></AppShell></AuthGuard>
          } />
          <Route path="/app/assets" element={
            <AuthGuard><AppShell><AssetsPage /></AppShell></AuthGuard>
          } />

          <Route path="/admin" element={
            <AdminGuard><AppShell><AdminPage /></AppShell></AdminGuard>
          } />

          {/* Legal pages */}
          <Route path="/privacy"  element={<LegalPage page="privacy" />} />
          <Route path="/terms"    element={<LegalPage page="terms" />} />
          <Route path="/refund"   element={<LegalPage page="refund" />} />
          <Route path="/cookies"  element={<LegalPage page="cookies" />} />
          <Route path="/shipping" element={<LegalPage page="shipping" />} />
          <Route path="/contact"  element={<LegalPage page="contact" />} />
          <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </SentryRoutes>
      </Suspense>
      <Toasts />
      <AssetPickerModal />
    </>
  )
}
