// ============================================================
// Razorpay Webhook — HMAC-SHA256 Signature Verified
// Every event verified before any action is taken.
// ============================================================

import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import { generateId } from '../utils/id'
import { sendEmail } from '../services/email'
import { getCurrentPeriod } from '../utils/period'

export async function handleWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  // ── Signature Verification (REQUIRED — prevents fake events) ──
  if (!signature) {
    console.error('Webhook missing signature')
    return new Response('Unauthorized', { status: 401 })
  }

  const isValid = await verifyRazorpaySignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET)
  if (!isValid) {
    console.error('Webhook signature mismatch')
    return new Response('Unauthorized', { status: 401 })
  }

  let event: RazorpayWebhookEvent
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Process async so we can return 200 immediately to Razorpay
  ctx.waitUntil(processWebhookEvent(event, env))

  return new Response('OK', { status: 200 })
}

async function processWebhookEvent(event: RazorpayWebhookEvent, env: Env): Promise<void> {
  const entity = event.payload?.subscription?.entity ?? event.payload?.payment?.entity

  switch (event.event) {
    // ── Subscription activated ───────────────────────────────
    case 'subscription.activated': {
      const sub = event.payload.subscription!.entity
      const userId = await getUserByRazorpaySubId(env.DB, sub.id)
      if (!userId) break

      const plan = getPlanFromRazorpayPlanId(sub.plan_id, env)
      const now = Math.floor(Date.now() / 1000)
      const periodEnd = sub.current_end ?? now + 30 * 24 * 60 * 60
      const { periodStart, periodEnd: calendarPeriodEnd } = getCurrentPeriod()

      await env.DB.batch([
        env.DB.prepare(
          `UPDATE users SET plan = ?, plan_status = 'active', updated_at = unixepoch() WHERE id = ?`
        ).bind(plan, userId),
        env.DB.prepare(
          `UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, updated_at = unixepoch()
           WHERE razorpay_sub_id = ?`
        ).bind(now, periodEnd, sub.id),
        // Reset usage for new billing period
        env.DB.prepare(
          `INSERT INTO usage (id, user_id, period_start, period_end, generations)
           VALUES (?, ?, ?, ?, 0)
           ON CONFLICT(user_id, period_start) DO UPDATE SET generations = 0, updated_at = unixepoch()`
        ).bind(generateId(), userId, periodStart, calendarPeriodEnd),
      ])

      const user = await getUser(env.DB, userId)
      if (user) {
        await sendEmail(env, 'upgrade_success', user.email, user.name, { plan })
      }
      break
    }

    // ── Payment captured (monthly renewal) ───────────────────
    case 'subscription.charged': {
      const sub = event.payload.subscription!.entity
      const userId = await getUserByRazorpaySubId(env.DB, sub.id)
      if (!userId) break

      const plan = getPlanFromRazorpayPlanId(sub.plan_id, env)
      const now = Math.floor(Date.now() / 1000)
      const periodEnd = sub.current_end ?? now + 30 * 24 * 60 * 60
      const { periodStart, periodEnd: calendarPeriodEnd } = getCurrentPeriod()

      await env.DB.batch([
        env.DB.prepare(
          `UPDATE users SET plan = ?, plan_status = 'active', updated_at = unixepoch() WHERE id = ?`
        ).bind(plan, userId),
        env.DB.prepare(
          `UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, updated_at = unixepoch()
           WHERE razorpay_sub_id = ?`
        ).bind(now, periodEnd, sub.id),
        // Reset usage for new billing period
        env.DB.prepare(
          `INSERT INTO usage (id, user_id, period_start, period_end, generations)
           VALUES (?, ?, ?, ?, 0)
           ON CONFLICT(user_id, period_start) DO UPDATE SET generations = 0, updated_at = unixepoch()`
        ).bind(generateId(), userId, periodStart, calendarPeriodEnd),
      ])
      break
    }

    // ── Subscription cancelled ───────────────────────────────
    case 'subscription.cancelled': {
      const sub = event.payload.subscription!.entity
      const userId = await getUserByRazorpaySubId(env.DB, sub.id)
      if (!userId) break

      const cancelledAt = Math.floor(Date.now() / 1000)

      await env.DB.batch([
        env.DB.prepare(
          `UPDATE users SET plan = 'free', plan_status = 'cancelled', updated_at = unixepoch() WHERE id = ?`
        ).bind(userId),
        env.DB.prepare(
          `UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = unixepoch()
           WHERE razorpay_sub_id = ?`
        ).bind(cancelledAt, sub.id),
      ])

      const user = await getUser(env.DB, userId)
      if (user) {
        await sendEmail(env, 'subscription_cancelled', user.email, user.name, {})
      }
      break
    }

    // ── Payment failed ────────────────────────────────────────
    case 'subscription.halted': {
      const sub = event.payload.subscription!.entity
      const userId = await getUserByRazorpaySubId(env.DB, sub.id)
      if (!userId) break

      await env.DB.prepare(
        `UPDATE users SET plan_status = 'past_due', updated_at = unixepoch() WHERE id = ?`
      ).bind(userId).run()

      await env.DB.prepare(
        `UPDATE subscriptions SET status = 'halted', updated_at = unixepoch() WHERE razorpay_sub_id = ?`
      ).bind(sub.id).run()

      const user = await getUser(env.DB, userId)
      if (user) {
        await sendEmail(env, 'payment_failed', user.email, user.name, {})
      }
      break
    }

    default:
      // Unhandled event — log and ignore
      console.log(`Unhandled webhook event: ${event.event}`)
  }
}

// ── HMAC-SHA256 Signature Verification ───────────────────────
async function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return expectedSignature === signature
}

// ── DB Helpers ────────────────────────────────────────────────
async function getUserByRazorpaySubId(db: D1Database, subId: string): Promise<string | null> {
  const result = await db.prepare(
    'SELECT user_id FROM subscriptions WHERE razorpay_sub_id = ?'
  ).bind(subId).first<{ user_id: string }>()
  return result?.user_id ?? null
}

async function getUser(db: D1Database, userId: string): Promise<{ email: string; name: string } | null> {
  return db.prepare(
    'SELECT email, name FROM users WHERE id = ?'
  ).bind(userId).first<{ email: string; name: string }>()
}

function getPlanFromRazorpayPlanId(planId: string, env: Env): PlatformTier {
  const planMap: Record<string, PlatformTier> = {
    [env.RAZORPAY_PLAN_STARTER_USD]: 'starter',
    [env.RAZORPAY_PLAN_STARTER_INR]: 'starter',
    [env.RAZORPAY_PLAN_PRO_USD]: 'pro',
    [env.RAZORPAY_PLAN_PRO_INR]: 'pro',
    [env.RAZORPAY_PLAN_BUSINESS_USD]: 'business',
    [env.RAZORPAY_PLAN_BUSINESS_INR]: 'business',
  }
  return planMap[planId] ?? 'starter'
}

// ── Types ─────────────────────────────────────────────────────
interface RazorpayWebhookEvent {
  event: string
  payload: {
    subscription?: {
      entity: {
        id: string
        plan_id: string
        status: string
        current_start?: number
        current_end?: number
      }
    }
    payment?: {
      entity: {
        id: string
        subscription_id?: string
      }
    }
  }
}
