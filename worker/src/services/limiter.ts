// ============================================================
// PostMaker — Global Groq Rate Limiter Service
// Durable Object + In-Memory Fallback for distributed rate pacing
// ============================================================

import type { Env } from '../../../config/ai'

// Named configuration constants for Groq rate limits
export const GROQ_RATE_LIMITS = {
  MAX_RPM: 30,             // Groq Free Tier: 30 requests per minute
  MAX_TPM: 5500,           // Groq Free Tier: 6,000 TPM limit (using 5,500 safety margin)
  MAX_CONCURRENT: 2,       // Max 2 concurrent active calls to Groq
  WINDOW_MS: 60_000,       // 1 minute sliding window
  ESTIMATED_TOKENS_IMAGE: 1100, // Token estimate for group request with image context
  ESTIMATED_TOKENS_TEXT: 400,   // Token estimate for text-only group request
}

// ── Durable Object Implementation ────────────────────────────
export class GroqRateLimiter {
  private state: DurableObjectState
  private windowStart: number = Date.now()
  private tokensInWindow: number = 0
  private requestsInWindow: number = 0
  private activeCalls: number = 0

  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/acquire') {
      const body = await request.json() as { estimatedTokens?: number }
      const cost = body.estimatedTokens ?? GROQ_RATE_LIMITS.ESTIMATED_TOKENS_IMAGE
      const waitMs = await this.acquireSlot(cost)
      return new Response(JSON.stringify({ allowed: true, waitMs }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.pathname === '/release') {
      this.releaseSlot()
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404 })
  }

  private async acquireSlot(cost: number): Promise<number> {
    let totalWait = 0

    while (true) {
      const now = Date.now()
      if (now - this.windowStart >= GROQ_RATE_LIMITS.WINDOW_MS) {
        this.windowStart = now
        this.tokensInWindow = 0
        this.requestsInWindow = 0
      }

      const hasConcurrentSlot = this.activeCalls < GROQ_RATE_LIMITS.MAX_CONCURRENT
      const hasRpmSlot = this.requestsInWindow + 1 <= GROQ_RATE_LIMITS.MAX_RPM
      const hasTpmSlot = this.tokensInWindow + cost <= GROQ_RATE_LIMITS.MAX_TPM

      if (hasConcurrentSlot && hasRpmSlot && hasTpmSlot) {
        this.activeCalls++
        this.requestsInWindow++
        this.tokensInWindow += cost
        return totalWait
      }

      const timeRemaining = Math.max(100, GROQ_RATE_LIMITS.WINDOW_MS - (now - this.windowStart))
      const sleepTime = hasConcurrentSlot ? Math.min(timeRemaining, 1000) : 400
      totalWait += sleepTime
      await new Promise(resolve => setTimeout(resolve, sleepTime))
    }
  }

  private releaseSlot() {
    if (this.activeCalls > 0) {
      this.activeCalls--
    }
  }
}

// ── Local Fallback (for non-DO environments) ──────────────────
let fallbackWindowStart = Date.now()
let fallbackTokensInWindow = 0
let fallbackRequestsInWindow = 0
let fallbackActiveCalls = 0

async function acquireFallbackSlot(cost: number): Promise<number> {
  let totalWait = 0
  while (true) {
    const now = Date.now()
    if (now - fallbackWindowStart >= GROQ_RATE_LIMITS.WINDOW_MS) {
      fallbackWindowStart = now
      fallbackTokensInWindow = 0
      fallbackRequestsInWindow = 0
    }

    const hasConcurrentSlot = fallbackActiveCalls < GROQ_RATE_LIMITS.MAX_CONCURRENT
    const hasRpmSlot = fallbackRequestsInWindow + 1 <= GROQ_RATE_LIMITS.MAX_RPM
    const hasTpmSlot = fallbackTokensInWindow + cost <= GROQ_RATE_LIMITS.MAX_TPM

    if (hasConcurrentSlot && hasRpmSlot && hasTpmSlot) {
      fallbackActiveCalls++
      fallbackRequestsInWindow++
      fallbackTokensInWindow += cost
      return totalWait
    }

    const timeRemaining = Math.max(100, GROQ_RATE_LIMITS.WINDOW_MS - (now - fallbackWindowStart))
    const sleepTime = hasConcurrentSlot ? Math.min(timeRemaining, 1000) : 400
    totalWait += sleepTime
    await new Promise(resolve => setTimeout(resolve, sleepTime))
  }
}

function releaseFallbackSlot() {
  if (fallbackActiveCalls > 0) {
    fallbackActiveCalls--
  }
}

// ── Public Helper Functions ──────────────────────────────────
export async function acquireGroqSlot(env: Env, estimatedTokens: number): Promise<number> {
  if (env.GROQ_LIMITER) {
    try {
      const id = env.GROQ_LIMITER.idFromName('global_groq_limiter')
      const stub = env.GROQ_LIMITER.get(id)
      const res = await stub.fetch('http://do/acquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimatedTokens }),
      })
      if (res.ok) {
        const data = await res.json() as { waitMs: number }
        return data.waitMs
      }
    } catch (err) {
      console.warn('[Limiter] Durable Object acquire failed, using fallback:', err)
    }
  }
  return acquireFallbackSlot(estimatedTokens)
}

export async function releaseGroqSlot(env: Env): Promise<void> {
  if (env.GROQ_LIMITER) {
    try {
      const id = env.GROQ_LIMITER.idFromName('global_groq_limiter')
      const stub = env.GROQ_LIMITER.get(id)
      await stub.fetch('http://do/release', { method: 'POST' })
      return
    } catch (err) {
      console.warn('[Limiter] Durable Object release failed, using fallback:', err)
    }
  }
  releaseFallbackSlot()
}
