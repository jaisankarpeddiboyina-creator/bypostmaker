import type { Env } from '../../../config/ai'
import { generateId } from '../utils/id'

type PaidPlan = 'starter' | 'pro' | 'business'
type Currency = 'usd' | 'inr'

export async function handlePayments(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // ── GET /api/payments/currency ────────────────────────────
  // Detect default currency from IP
  if (path === '/api/payments/currency') {
    const country = request.headers.get('CF-IPCountry') ?? 'US'
    const currency = country === 'IN' ? 'inr' : 'usd'
    return json({ currency, country })
  }

  // ── POST /api/payments/subscribe ─────────────────────────
  if (path === '/api/payments/subscribe' && request.method === 'POST') {
    let body: { plan: string; currency: string }
    try {
      body = await request.json() as { plan: string; currency: string }
    } catch {
      return jsonError('Invalid request', 400)
    }

    const { plan, currency, promoCode } = body as { plan: PaidPlan; currency: Currency; promoCode?: string }
    if (!['starter','pro','business'].includes(plan)) return jsonError('Invalid plan', 400)
    if (!['usd','inr'].includes(currency)) return jsonError('Invalid currency', 400)

    const planId = getRazorpayPlanId(env, plan, currency)
    if (!planId) return jsonError(`Missing Razorpay plan ID for ${plan}/${currency}`, 500)

    const existingSub = await env.DB.prepare(
      `SELECT id, razorpay_sub_id, plan FROM subscriptions 
       WHERE user_id = ? AND status IN ('active','authenticated','created')`
    ).bind(userId).first<{ id: string; razorpay_sub_id: string; plan: string }>()

    const PLAN_ORDER = ['starter', 'pro', 'business']
    if (existingSub) {
      const currentIndex = PLAN_ORDER.indexOf(existingSub.plan)
      const newIndex = PLAN_ORDER.indexOf(plan)
      if (newIndex <= currentIndex) {
        return jsonError('Already on this plan or higher', 409)
      }
      // Cancel existing subscription immediately before creating new one
      const rzpCredentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)
      await fetch(`https://api.razorpay.com/v1/subscriptions/${existingSub.razorpay_sub_id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${rzpCredentials}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel_at_cycle_end: 0 }),
      })
      await env.DB.prepare(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = unixepoch() WHERE id = ?`
      ).bind(existingSub.id).run()
    }

    // Create Razorpay subscription
    const rzpCredentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)
    const rzpRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${rzpCredentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plan_id: planId,
        quantity: 1,
        total_count: 120,  // 10 years = effectively continuous
        customer_notify: 1,
      }),
    })

    if (!rzpRes.ok) {
      const err = await rzpRes.json()
      console.error('Razorpay error:', err)
      return jsonError('Failed to create subscription', 500)
    }

    const rzpSub = await rzpRes.json() as { id: string; short_url: string }

    // Save subscription to D1
    const user = await env.DB.prepare(
      'SELECT email, name FROM users WHERE id = ?'
    ).bind(userId).first<{ email: string; name: string }>()

    await env.DB.prepare(
      `INSERT INTO subscriptions (id, user_id, razorpay_sub_id, plan, currency, status, promo_code)
       VALUES (?, ?, ?, ?, ?, 'created', ?)`
    ).bind(generateId(), userId, rzpSub.id, plan, currency, promoCode ?? null).run()

    // Update user currency preference
    await env.DB.prepare(
      'UPDATE users SET currency = ?, updated_at = unixepoch() WHERE id = ?'
    ).bind(currency, userId).run()

    return json({
      subscriptionId: rzpSub.id,
      keyId: env.RAZORPAY_KEY_ID,
      plan,
      currency,
    })
  }

  // ── POST /api/payments/cancel ─────────────────────────────
  if (path === '/api/payments/cancel' && request.method === 'POST') {
    const sub = await env.DB.prepare(
      `SELECT razorpay_sub_id FROM subscriptions WHERE user_id = ? AND status = 'active'`
    ).bind(userId).first<{ razorpay_sub_id: string }>()

    if (!sub) return jsonError('No active subscription', 404)

    const rzpCredentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)
    await fetch(`https://api.razorpay.com/v1/subscriptions/${sub.razorpay_sub_id}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${rzpCredentials}` },
      body: JSON.stringify({ cancel_at_cycle_end: 1 }), // cancel at period end, not immediately
    })

    return json({ ok: true, message: 'Subscription will cancel at end of billing period' })
  }

  // ── GET /api/payments/status ──────────────────────────────
  if (path === '/api/payments/status') {
    const user = await env.DB.prepare(
      'SELECT plan, plan_status, currency FROM users WHERE id = ?'
    ).bind(userId).first<{ plan: string; plan_status: string; currency: string }>()

    const sub = await env.DB.prepare(
      `SELECT plan, status, current_period_end, currency FROM subscriptions
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ).bind(userId).first<{
      plan: string; status: string; current_period_end: number; currency: string
    }>()

    return json({ user, subscription: sub })
  }

  return jsonError('Not found', 404)
}

function getRazorpayPlanId(env: Env, plan: PaidPlan, currency: Currency): string {
  const planIds: Record<PaidPlan, Record<Currency, string>> = {
    starter: {
      usd: env.RAZORPAY_PLAN_STARTER_USD,
      inr: env.RAZORPAY_PLAN_STARTER_INR,
    },
    pro: {
      usd: env.RAZORPAY_PLAN_PRO_USD,
      inr: env.RAZORPAY_PLAN_PRO_INR,
    },
    business: {
      usd: env.RAZORPAY_PLAN_BUSINESS_USD,
      inr: env.RAZORPAY_PLAN_BUSINESS_INR,
    },
  }
  return planIds[plan][currency]
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Helper export for promo-aware subscribe — patches the existing subscribe handler
export async function applyPromoToSubscribe(
  db: D1Database,
  promoCode: string | undefined
): Promise<number> {
  if (!promoCode) return 0
  const promo = await db.prepare(
    `SELECT discount_pct, max_uses, uses FROM promo_codes
     WHERE code = ? AND active = 1 AND (valid_until IS NULL OR valid_until > unixepoch())`
  ).bind(promoCode.toUpperCase()).first<{ discount_pct: number; max_uses: number | null; uses: number }>()
  if (!promo) return 0
  if (promo.max_uses !== null && promo.uses >= promo.max_uses) return 0
  // Increment use count
  await db.prepare('UPDATE promo_codes SET uses = uses + 1 WHERE code = ?')
    .bind(promoCode.toUpperCase()).run()
  return promo.discount_pct
}
