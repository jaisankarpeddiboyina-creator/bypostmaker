// ============================================================
// Promo Code Route — validate and apply at checkout
// ============================================================

import type { Env } from '../../../config/ai'

export async function handlePromos(
  request: Request,
  env: Env,
  _userId: string
): Promise<Response> {
  const url = new URL(request.url)

  // ── POST /api/promos/validate ─────────────────────────────
  if (url.pathname === '/api/promos/validate' && request.method === 'POST') {
    const { code } = await request.json() as { code: string }
    if (!code) return jsonError('Code required', 400)

    const promo = await env.DB.prepare(
      `SELECT code, description, discount_pct, max_uses, uses, valid_until, active
       FROM promo_codes WHERE code = ? AND active = 1`
    ).bind(code.toUpperCase()).first<{
      code: string; description: string; discount_pct: number
      max_uses: number | null; uses: number; valid_until: number | null; active: number
    }>()

    if (!promo) return jsonError('Invalid or expired promo code', 404)

    const now = Math.floor(Date.now() / 1000)
    if (promo.valid_until && promo.valid_until < now) {
      return jsonError('This promo code has expired', 410)
    }
    if (promo.max_uses !== null && promo.uses >= promo.max_uses) {
      return jsonError('This promo code has reached its usage limit', 410)
    }

    return new Response(JSON.stringify({
      valid: true,
      code: promo.code,
      description: promo.description,
      discount_pct: promo.discount_pct,
    }), { headers: { 'Content-Type': 'application/json' } })
  }

  return jsonError('Not found', 404)
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
