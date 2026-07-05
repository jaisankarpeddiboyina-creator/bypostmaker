import type { Env } from '../../config/ai'
import { withAuth } from './middleware/auth'
import { withRateLimit, withIpRateLimit, withPresignRateLimit } from './middleware/rateLimit'
import { withCors } from './middleware/cors'
import { handleAuth } from './routes/auth'
import { handleGenerate } from './routes/generate'
import { handleRetry } from './routes/retry'
import { handleRefinement } from './routes/refinement'
import { handlePayments } from './routes/payments'
import { handleWebhook } from './routes/webhook'
import { handleUser } from './routes/user'
import { handleHistory } from './routes/history'
import { handleHealth } from './routes/health'
import { handleAdmin } from './routes/admin'
import { handlePromos } from './routes/promos'
import { handlePresignRoute } from './routes/upload'
import { runCronJobs, runDataRetention } from './services/cron'


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), env)

    try {
      // ── Public routes ───────────────────────────────────────
      if (path.startsWith('/api/auth')) {
        // Scoped IP rate limiting for sensitive email routes
        if (
          path === '/api/auth/email/signup' ||
          path === '/api/auth/email/login' ||
          path === '/api/auth/email/forgot-password' ||
          path === '/api/auth/email/reset-password'
        ) {
          const limit = path === '/api/auth/email/signup' ? 10 : 5
          const ipRl = await withIpRateLimit(request, env, limit)
          if (!ipRl.ok) {
            return withCors(new Response(JSON.stringify({ error: 'Too many requests' }), {
              status: 429,
              headers: { 'Content-Type': 'application/json', 'Retry-After': String(ipRl.retryAfter ?? 60) },
            }), env)
          }
        }
        return withCors(await handleAuth(request, env), env)
      }
      if (path === '/api/webhooks/razorpay') return withCors(await handleWebhook(request, env, ctx), env)
      if (path === '/api/health') return withCors(await handleHealth(env), env)
      if (path === '/api/test/retention' && env.ENVIRONMENT === 'development') {
        await runDataRetention(env)
        return withCors(new Response(JSON.stringify({ ok: true, message: 'Retention completed' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }), env)
      }

      // ── Auth guard ──────────────────────────────────────────
      const auth = await withAuth(request, env)
      if (!auth.ok) {
        return withCors(new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json' },
        }), env)
      }
      const { userId, userPlan, userRole, emailVerified } = auth

      // ── Email verification guard ────────────────────────────
      if (!emailVerified && path !== '/api/user/me' && path !== '/api/user/resend-verification') {
        return withCors(new Response(JSON.stringify({ error: 'Email not verified' }), {
          status: 403, headers: { 'Content-Type': 'application/json' },
        }), env)
      }

      // ── Rate limit ──────────────────────────────────────────
      const rl = await withRateLimit(request, env, userId)
      if (!rl.ok) {
        return withCors(new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter ?? 60) },
        }), env)
      }

      // ── Protected routes ────────────────────────────────────
      if (path === '/api/upload/presign' && request.method === 'POST') {
        const presignRl = await withPresignRateLimit(request, env, userId)
        if (!presignRl.ok) {
          return withCors(new Response(JSON.stringify({ error: 'Too many upload requests. Wait a moment.' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': String(presignRl.retryAfter ?? 60) },
          }), env)
        }
        return withCors(await handlePresignRoute(request, env, userId), env)
      }

      if (path === '/api/generate' && request.method === 'POST')
        return withCors(await handleGenerate(request, env, userId, userPlan, ctx), env)

      if (path === '/api/generate/retry' && request.method === 'POST')
        return withCors(await handleRetry(request, env, userId, userPlan), env)

      if (path.startsWith('/api/refine'))
        return withCors(await handleRefinement(request, env, userId, userPlan), env)

      if (path.startsWith('/api/payments'))
        return withCors(await handlePayments(request, env, userId), env)

      if (path.startsWith('/api/promos'))
        return withCors(await handlePromos(request, env, userId), env)

      if (path.startsWith('/api/user'))
        return withCors(await handleUser(request, env, userId), env)

      if (path.startsWith('/api/history'))
        return withCors(await handleHistory(request, env, userId), env)

      if (path.startsWith('/api/admin'))
        return withCors(await handleAdmin(request, env, userId, userRole), env)

      return withCors(new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      }), env)
    } catch (err) {
      console.error('Worker unhandled error:', err)
      return withCors(new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      }), env)
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCronJobs(controller.cron, env))
  },
} satisfies ExportedHandler<Env>
