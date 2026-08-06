// ============================================================
// Monitoring — Self-Hosted Log Batcher & Scrubbing Queue
// ============================================================

interface LogPayload {
  type: 'error' | 'event' | 'info';
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  context?: Record<string, any>;
  userId?: string;
  timestamp: number;
}

let logQueue: LogPayload[] = []
let activeUserId: string | undefined = undefined
let immediateFlushCount = 0
let immediateWindowStart = Date.now()
let timerId: any = null

// Helper to recursively scrub sensitive values
function scrubObject(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(scrubObject)
  }

  const scrubbed: Record<string, any> = {}
  const sensitiveKeys = ['password', 'token', 'authorization', 'credit_card', 'secret']

  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = sensitiveKeys.some(sk => key.toLowerCase().includes(sk))
    if (isSensitive) {
      scrubbed[key] = '[REDACTED]'
    } else if (typeof val === 'object') {
      scrubbed[key] = scrubObject(val)
    } else {
      scrubbed[key] = val
    }
  }

  return scrubbed
}

async function flushQueue() {
  if (logQueue.length === 0) return
  const batch = [...logQueue]
  logQueue = []

  try {
    const response = await fetch('/api/monitoring/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })
    if (!response.ok) {
      console.warn('[Monitoring] Failed to upload logs batch:', response.statusText)
    }
  } catch (err) {
    console.warn('[Monitoring] Network error uploading logs batch:', err)
  }
}

// Client circuit breaker for immediate flushes (max 5/min)
function checkCircuitBreaker(): boolean {
  const now = Date.now()
  if (now - immediateWindowStart >= 60000) {
    immediateWindowStart = now
    immediateFlushCount = 0
  }

  if (immediateFlushCount >= 5) {
    return false // Circuit breaker is open (fallback to batch queue)
  }

  immediateFlushCount++
  return true // Circuit breaker is closed (allowed)
}

function queueLog(
  type: 'error' | 'event' | 'info',
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  message: string,
  context?: Record<string, any>
) {
  const scrubbedContext = context ? scrubObject(context) : undefined
  const logItem: LogPayload = {
    type,
    level,
    message: message.substring(0, 500),
    context: scrubbedContext,
    userId: activeUserId,
    timestamp: Date.now()
  }

  // Prevent client memory overflow (cap queue at 100)
  if (logQueue.length >= 100) {
    logQueue.shift()
  }
  logQueue.push(logItem)

  const isCritical = level === 'error' || level === 'fatal'
  if (isCritical && checkCircuitBreaker()) {
    flushQueue()
  } else if (logQueue.length >= 10) {
    flushQueue()
  }
}

export function initMonitoring() {
  if (timerId) clearInterval(timerId)
  timerId = setInterval(() => {
    flushQueue()
  }, 10000)

  // Flush on page exit/visibility change
  window.addEventListener('beforeunload', () => {
    if (logQueue.length > 0) {
      const payload = JSON.stringify(logQueue)
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/monitoring/batch', payload)
      } else {
        fetch('/api/monitoring/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        })
      }
      logQueue = []
    }
  })
}

export function identifyUser(userId: string, email: string, plan: string) {
  activeUserId = userId
  queueLog('event', 'info', `User identified: ${email}`, { userId, plan })
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  queueLog('event', 'info', event, properties)
}

export function trackError(error: Error, context?: Record<string, any>) {
  queueLog('error', 'error', error.message || String(error), {
    stack: error.stack || '',
    ...context
  })
}
