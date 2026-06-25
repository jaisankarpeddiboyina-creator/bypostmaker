import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/react'
import { useAppStore } from './store/app'
import { api } from './lib/api'
import { identifyUser } from './lib/monitoring'
import { Navbar } from './components/Navbar'
import { Toasts } from './components/Toasts'
import AppPage from './pages/AppPage'
import LandingPage from './pages/LandingPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import LegalPage from './pages/LegalPage'
import { UpgradeModal } from './components/UpgradeModal'

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes)

function UpgradeModalWrapper() {
  const showUpgradeModal = useAppStore(s => s.showUpgradeModal)
  return showUpgradeModal ? <UpgradeModal /> : null
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <div style={{ flex: 1, overflow: 'hidden' }}>{children}</div>
      <Toasts />
      <UpgradeModalWrapper />
    </div>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore()
  const authReady = useAuthReady()
  if (!authReady) return <AppLoading />
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAppStore()
  const authReady = useAuthReady()
  if (!authReady) return <AppLoading />
  if (!user) return <Navigate to="/" replace />
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
  const { setUser, setUsage, setCurrency } = useAppStore()

  useEffect(() => {
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
  }, [])

  return (
    <SentryRoutes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/app" element={
        <AuthGuard><AppShell><AppPage /></AppShell></AuthGuard>
      } />
      <Route path="/app/history" element={
        <AuthGuard><AppShell><HistoryPage /></AppShell></AuthGuard>
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
      <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </SentryRoutes>
  )
}
