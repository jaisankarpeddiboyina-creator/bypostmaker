import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import * as Sentry from '@sentry/react'
import { useAppStore } from './store/app'
import { api } from './lib/api'
import { identifyUser } from './lib/monitoring'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { Toasts } from './components/Toasts'
import { UpgradeModal } from './components/UpgradeModal'
import { VerifyEmailScreen } from './components/VerifyEmailScreen'

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
const PricingPage = lazy(() => import('./pages/PricingPage'))


const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes)

function UpgradeModalWrapper() {
  const showUpgradeModal = useAppStore(s => s.showUpgradeModal)
  return showUpgradeModal ? <UpgradeModal /> : null
}

function AppShell({ children }: { children: React.ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Sidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
        <Topbar onMenuClick={() => setIsMobileSidebarOpen(true)} />
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {children}
        </main>
      </div>
      <UpgradeModalWrapper />
    </div>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore()
  const authReady = useAuthReady()
  if (!authReady) return <AppLoading />
  if (!user) return <Navigate to="/" replace />
  if (user.email_verified === 0) return <VerifyEmailScreen />
  return <>{children}</>
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore()
  const authReady = useAuthReady()
  if (!authReady) return <AppLoading />
  if (!user) return <Navigate to="/" replace />
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
        // Beta users get business access
        if (user.role === 'beta' && user.plan === 'free') {
          setUser({ ...user, plan: 'business' })
        }
      })
      .catch(() => setUser(null))
      .finally(() => setAuthReadySnapshot(true))

    // Force INR for now since USD plan IDs are not configured
    setCurrency('inr')
  }, [addToast])

  return (
    <>
      <Suspense fallback={<AppLoading />}>
        <SentryRoutes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPage />} />
          
          {/* Auth routes */}
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/app" element={
            <AuthGuard><Navigate to="/app/create" replace /></AuthGuard>
          } />
          <Route path="/app/create" element={
            <AuthGuard><AppShell><AppPage /></AppShell></AuthGuard>
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
          <Route path="/pricing" element={<PricingPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </SentryRoutes>
      </Suspense>
      <Toasts />
    </>
  )
}

