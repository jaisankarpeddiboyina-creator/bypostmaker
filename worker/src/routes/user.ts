import type { Env } from '../../../config/ai'
import { sendEmail } from '../services/email'

export async function handleUser(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // ── GET /api/user/me ──────────────────────────────────────
  if (path === '/api/user/me') {
    const user = await env.DB.prepare(
      `SELECT id, email, name, avatar_url, plan, plan_status, currency, role, created_at FROM users WHERE id = ?`
    ).bind(userId).first()

    if (!user) return jsonError('User not found', 404)

    const usage = await env.DB.prepare(
      `SELECT generations, period_start, period_end FROM usage
       WHERE user_id = ? ORDER BY period_start DESC LIMIT 1`
    ).bind(userId).first<{ generations: number; period_start: number; period_end: number }>()

    return json({ user, usage })
  }

  // ── PUT /api/user/currency ────────────────────────────────
  if (path === '/api/user/currency' && request.method === 'PUT') {
    const { currency } = await request.json() as { currency: string }
    if (!['usd','inr'].includes(currency)) return jsonError('Invalid currency', 400)

    await env.DB.prepare(
      'UPDATE users SET currency = ?, updated_at = unixepoch() WHERE id = ?'
    ).bind(currency, userId).run()

    return json({ ok: true })
  }

  // ── DELETE /api/user/account ──────────────────────────────
  // Step 1: Cancel active subscription with Razorpay
  // Step 2: Delete all user data in correct order
  // Step 3: Send confirmation email
  if (path === '/api/user/account' && request.method === 'DELETE') {
    const { confirmation } = await request.json() as { confirmation: string }

    // Require explicit confirmation string
    if (confirmation !== 'DELETE MY ACCOUNT') {
      return jsonError('Invalid confirmation', 400)
    }

    const user = await env.DB.prepare(
      'SELECT email, name FROM users WHERE id = ?'
    ).bind(userId).first<{ email: string; name: string }>()

    if (!user) return jsonError('User not found', 404)

    // Step 1 — Cancel active Razorpay subscription
    const activeSub = await env.DB.prepare(
      `SELECT razorpay_sub_id FROM subscriptions WHERE user_id = ? AND status = 'active'`
    ).bind(userId).first<{ razorpay_sub_id: string }>()

    if (activeSub?.razorpay_sub_id) {
      try {
        const rzpCredentials = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)
        await fetch(`https://api.razorpay.com/v1/subscriptions/${activeSub.razorpay_sub_id}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${rzpCredentials}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cancel_at_cycle_end: 0 }), // immediate cancel on delete
        })
      } catch (err) {
        console.error('Failed to cancel Razorpay sub on account delete:', err)
        // Continue with deletion even if Razorpay cancel fails
      }
    }

    // Step 2 — Delete all user data (order respects foreign keys)
    await env.DB.batch([
      env.DB.prepare('DELETE FROM generated_posts WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM campaigns WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM usage WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM api_keys WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
    ])

    // Step 3 — Confirmation email
    await sendEmail(env, 'account_deleted', user.email, user.name, {})

    // Clear session cookie
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'pm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
      },
    })
  }

  return jsonError('Not found', 404)
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
