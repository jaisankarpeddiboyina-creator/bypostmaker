import type { Env } from '../../../config/ai'

// Simple in-memory rate limiter using Workers Cache API
// Limits: 60 req/min per user, 20 req/min per IP for unauthenticated

interface RateLimitResult {
  ok: boolean
  retryAfter?: number
}

const WINDOW_MS = 60 * 1000  // 1 minute
const MAX_REQUESTS_USER = 60
const MAX_REQUESTS_IP = 20
const MAX_REQUESTS_PRESIGN = 10  // tighter limit for /api/upload/presign

// In-memory store (per Worker isolate, resets on cold start)
// For production scale, swap with Cloudflare Durable Objects
const requestCounts = new Map<string, { count: number; resetAt: number }>()

export async function withRateLimit(
  request: Request,
  env: Env,
  userId: string
): Promise<RateLimitResult> {
  const now = Date.now()
  const key = `user:${userId}`

  let entry = requestCounts.get(key)

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS }
    requestCounts.set(key, entry)
  }

  entry.count++

  if (entry.count > MAX_REQUESTS_USER) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { ok: false, retryAfter }
  }

  return { ok: true }
}

export async function withIpRateLimit(
  request: Request,
  env: Env,
  maxRequests: number = MAX_REQUESTS_IP
): Promise<RateLimitResult> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  const now = Date.now()
  const key = `ip:${ip}`

  let entry = requestCounts.get(key)

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS }
    requestCounts.set(key, entry)
  }

  entry.count++

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { ok: false, retryAfter }
  }

  return { ok: true }
}

// withPresignRateLimit — 10 req/min per user for /api/upload/presign.
// Uses a separate key namespace ("presign:") so this limit is independent
// of the general withRateLimit counter ("user:").
export async function withPresignRateLimit(
  _request: Request,
  _env: Env,
  userId: string
): Promise<RateLimitResult> {
  const now = Date.now()
  const key = `presign:${userId}`

  let entry = requestCounts.get(key)

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS }
    requestCounts.set(key, entry)
  }

  entry.count++

  if (entry.count > MAX_REQUESTS_PRESIGN) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { ok: false, retryAfter }
  }

  return { ok: true }
}

export async function checkIpRateLimitDurable(
  request: Request,
  env: Env,
  maxRequests: number = 10
): Promise<RateLimitResult> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
  if (env.GROQ_LIMITER) {
    try {
      const id = env.GROQ_LIMITER.idFromName(`ip:${ip}`)
      const stub = env.GROQ_LIMITER.get(id)
      const res = await stub.fetch('http://do/check-ip-limit', { method: 'POST' })
      if (res.status === 429) {
        const data = await res.json() as { retryAfter: number }
        return { ok: false, retryAfter: data.retryAfter }
      }
      if (res.ok) {
        return { ok: true }
      }
    } catch (err) {
      console.warn('[RateLimit] Durable Object IP rate check failed, using fallback:', err)
    }
  }

  // Fallback to isolate-local rate limit
  return withIpRateLimit(request, env, maxRequests)
}



