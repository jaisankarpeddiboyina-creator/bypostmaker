import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
