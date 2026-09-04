import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initMonitoring } from './lib/monitoring'
import { onCLS, onLCP, onFCP, onTTFB, onINP } from 'web-vitals'
import { markWebVital } from './lib/performance'
import './styles/globals.css'

// Initialise Sentry + PostHog before anything renders
initMonitoring()

// Register Core Web Vitals report listeners
const reportVitals = (metric: any) => {
  markWebVital(metric.name, metric.value, metric.id)
}

onCLS(reportVitals)
onLCP(reportVitals)
onFCP(reportVitals)
onTTFB(reportVitals)
onINP(reportVitals)

// Auto-recover from stale Vite chunk dynamic import failures (single attempt per session)
window.addEventListener('vite:preloadError', (event) => {
  console.warn('[Vite] Preload error detected on dynamic chunk import:', event)
  const reloadKey = 'pm_chunk_reload_attempted'
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, 'true')
    window.location.reload()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)

