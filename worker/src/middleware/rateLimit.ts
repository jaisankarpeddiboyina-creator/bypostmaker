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
