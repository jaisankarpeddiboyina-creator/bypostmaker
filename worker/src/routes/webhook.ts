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
  ctx.waitUntil(processWebhookEvent(event, env, ctx))

  return new Response('OK', { status: 200 })
}

async function processWebhookEvent(event: RazorpayWebhookEvent, env: Env, ctx: ExecutionContext): Promise<void> {
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

      // Look for older active/authenticated subscriptions to cancel
      const oldSubs = await env.DB.prepare(
        `SELECT id, razorpay_sub_id FROM subscriptions
         WHERE user_id = ? AND status IN ('active', 'authenticated') AND razorpay_sub_id != ?`
      ).bind(userId, sub.id).all<{ id: string; razorpay_sub_id: string }>()

      if (oldSubs.results && oldSubs.results.length > 0) {
        for (const oldSub of oldSubs.results) {
          ctx.waitUntil((async () => {
            try {
              const rzpCredentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)
              const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${oldSub.razorpay_sub_id}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Basic ${rzpCredentials}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancel_at_cycle_end: 0 }),
              })
              if (response.ok) {
                await env.DB.prepare(
                  `UPDATE subscriptions SET status = 'cancelled', updated_at = unixepoch() WHERE id = ?`
                ).bind(oldSub.id).run()
              } else {
                const errText = await response.text()
                console.error(`[webhook] Failed to cancel old subscription on Razorpay (HTTP ${response.status}). User: ${userId}, Sub ID: ${oldSub.id}, RZP Sub ID: ${oldSub.razorpay_sub_id}, Error: ${errText}`)
              }
            } catch (e: any) {
              console.error(`[webhook] Error cancelling old subscription on Razorpay. User: ${userId}, Sub ID: ${oldSub.id}, RZP Sub ID: ${oldSub.razorpay_sub_id}, Error: ${e?.message || e}`)
            }
          })())
        }
      }

      const user = await getUser(env.DB, userId)
      if (user) {
        await sendEmail(env, 'upgrade_success', user.email, user.name, { plan })
      }
      break
    }

    // ── Payment captured (monthly renewal) ───────────────────
    // BUG-9: Also acts as a fallback activator if subscription.activated was missed.
    // Logs the transition so missed-activated events are observable in Cloudflare logs.
    case 'subscription.charged': {
      const sub = event.payload.subscription!.entity
      const userId = await getUserByRazorpaySubId(env.DB, sub.id)
      if (!userId) break

      const plan = getPlanFromRazorpayPlanId(sub.plan_id, env)
      const now = Math.floor(Date.now() / 1000)
      const periodEnd = sub.current_end ?? now + 30 * 24 * 60 * 60
      const { periodStart, periodEnd: calendarPeriodEnd } = getCurrentPeriod()

      // BUG-9: Detect if this charge is healing a missed 'activated' event.
      const prevStatus = await env.DB.prepare(
        `SELECT status FROM subscriptions WHERE razorpay_sub_id = ?`
      ).bind(sub.id).first<{ status: string }>()
      if (prevStatus?.status === 'authenticated') {
        console.warn(`[BUG-9 recovery] subscription.charged healing 'authenticated' sub ${sub.id} → 'active' for user ${userId}`)
      }

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
    // BUG-7: Guard against downgrading users for subscriptions that were only ever
    // 'created' (i.e. the checkout was abandoned). current_period_end is only set
    // by subscription.activated / subscription.charged, so a NULL value means no
    // payment was ever captured. This also makes the handler safe for the cancel
    // events generated by BUG-2's active cleanup of stale 'created' rows.
    case 'subscription.cancelled': {
      const sub = event.payload.subscription!.entity
      const userId = await getUserByRazorpaySubId(env.DB, sub.id)
      if (!userId) break

      const cancelledAt = Math.floor(Date.now() / 1000)

      // Check whether this subscription was ever activated (charged at least once)
      const subRecord = await env.DB.prepare(
        `SELECT current_period_end FROM subscriptions WHERE razorpay_sub_id = ?`
      ).bind(sub.id).first<{ current_period_end: number | null }>()

      const wasEverActivated = (subRecord?.current_period_end ?? 0) > 0

      if (!wasEverActivated) {
        // Abandoned checkout cancel — only mark the subscription row, do NOT
        // touch the users table. The user was never charged and is still on free.
        console.log(`[webhook] subscription.cancelled for never-activated sub ${sub.id} (user ${userId}) — skipping user downgrade`)
        await env.DB.prepare(
          `UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, updated_at = unixepoch()
           WHERE razorpay_sub_id = ?`
        ).bind(cancelledAt, sub.id).run()
        break
      }

      // Subscription was active — downgrade the user
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
// BUG-8: Added ORDER BY created_at DESC so the result is deterministic if multiple
// rows somehow share the same razorpay_sub_id (defensive — should not happen in practice).
async function getUserByRazorpaySubId(db: D1Database, subId: string): Promise<string | null> {
  const result = await db.prepare(
    'SELECT user_id FROM subscriptions WHERE razorpay_sub_id = ? ORDER BY created_at DESC'
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
