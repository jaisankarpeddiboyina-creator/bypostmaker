// ============================================================
// Admin Dashboard Route — /api/admin/*
// Protected: role = 'admin' only
// ============================================================

import type { Env } from '../../../config/ai'

export async function handleAdmin(
  request: Request,
  env: Env,
  userId: string,
  userRole: string
): Promise<Response> {
  if (userRole !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(request.url)
  const path = url.pathname

  // ── GET /api/admin/stats ──────────────────────────────────
  if (path === '/api/admin/stats') {
    const [users, subs, campaigns, usage] = await Promise.all([
      env.DB.prepare(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END) as free,
        SUM(CASE WHEN plan = 'starter' THEN 1 ELSE 0 END) as starter,
        SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) as pro,
        SUM(CASE WHEN plan = 'business' THEN 1 ELSE 0 END) as business,
        SUM(CASE WHEN role = 'beta' THEN 1 ELSE 0 END) as beta,
        SUM(CASE WHEN disabled = 1 THEN 1 ELSE 0 END) as disabled,
        SUM(CASE WHEN created_at > unixepoch() - 86400 THEN 1 ELSE 0 END) as new_today,
        SUM(CASE WHEN created_at > unixepoch() - 604800 THEN 1 ELSE 0 END) as new_week
        FROM users`).first(),
      env.DB.prepare(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN currency = 'usd' THEN 1 ELSE 0 END) as usd,
        SUM(CASE WHEN currency = 'inr' THEN 1 ELSE 0 END) as inr
        FROM subscriptions`).first(),
      env.DB.prepare(`SELECT
        COUNT(*) as total,
        SUM(CASE WHEN created_at > unixepoch() - 86400 THEN 1 ELSE 0 END) as today
        FROM campaigns WHERE status = 'completed'`).first(),
      env.DB.prepare(`SELECT COALESCE(SUM(generations), 0) as total
        FROM usage WHERE period_start > unixepoch() - 2592000`).first(),
    ])

    return json({ users, subscriptions: subs, campaigns, usage })
  }

  // ── GET /api/admin/users ──────────────────────────────────
  if (path === '/api/admin/users') {
    const page = parseInt(url.searchParams.get('page') ?? '1')
    const search = url.searchParams.get('search') ?? ''
    const limit = 50
    const offset = (page - 1) * limit

    const { results } = search
      ? await env.DB.prepare(
          `SELECT id, email, name, plan, role, disabled, currency, created_at
           FROM users WHERE email LIKE ? OR name LIKE ?
           ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(`%${search}%`, `%${search}%`, limit, offset).all()
      : await env.DB.prepare(
          `SELECT id, email, name, plan, role, disabled, currency, created_at
           FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`
        ).bind(limit, offset).all()

    const count = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM users ${search ? 'WHERE email LIKE ? OR name LIKE ?' : ''}`
    ).bind(...(search ? [`%${search}%`, `%${search}%`] : [])).first<{ total: number }>()

    return json({ users: results, total: count?.total ?? 0, page, limit })
  }

  // ── PATCH /api/admin/users/:id ────────────────────────────
  if (path.startsWith('/api/admin/users/') && request.method === 'PATCH') {
    const targetId = path.split('/').pop()
    const body = await request.json() as { role?: string; plan?: string; disabled?: boolean }

    const updates: string[] = []
    const values: unknown[] = []

    if (body.role && ['user','beta','admin'].includes(body.role)) {
      updates.push('role = ?'); values.push(body.role)
    }
    if (body.plan && ['free','starter','pro','business'].includes(body.plan)) {
      updates.push('plan = ?'); values.push(body.plan)
    }
    if (typeof body.disabled === 'boolean') {
      updates.push('disabled = ?'); values.push(body.disabled ? 1 : 0)
    }

    if (updates.length === 0) return jsonError('Nothing to update', 400)

    updates.push('updated_at = unixepoch()')
    values.push(targetId)

    await env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run()

    return json({ ok: true })
  }

  // ── GET /api/admin/promos ─────────────────────────────────
  if (path === '/api/admin/promos') {
    const { results } = await env.DB.prepare(
      `SELECT * FROM promo_codes ORDER BY created_at DESC`
    ).all()
    return json({ promos: results })
  }

  // ── POST /api/admin/promos ────────────────────────────────
  if (path === '/api/admin/promos' && request.method === 'POST') {
    const body = await request.json() as {
      code: string; description: string
      discount_pct: number; max_uses?: number; valid_until?: number
    }

    if (!body.code || !body.discount_pct) return jsonError('Missing fields', 400)

    await env.DB.prepare(
      `INSERT INTO promo_codes (code, description, discount_pct, max_uses, valid_until)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      body.code.toUpperCase(), body.description ?? '',
      body.discount_pct, body.max_uses ?? null, body.valid_until ?? null
    ).run()

    return json({ ok: true, code: body.code.toUpperCase() })
  }

  // ── DELETE /api/admin/promos/:code ────────────────────────
  if (path.startsWith('/api/admin/promos/') && request.method === 'DELETE') {
    const code = path.split('/').pop()?.toUpperCase()
    await env.DB.prepare('UPDATE promo_codes SET active = 0 WHERE code = ?').bind(code).run()
    return json({ ok: true })
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
    status, headers: { 'Content-Type': 'application/json' },
  })
}
