import type { Env } from '../../../config/ai'
import { getJwtSecret, signJWT } from '../middleware/auth'
import { generateId } from '../utils/id'
import { sendEmail } from '../services/email'
import { getCurrentPeriod } from '../utils/period'

export async function handleAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // ── GET /api/auth/dev ──────────────────────────────────────
  // Local-only demo login so the app can be tested without Google OAuth.
  if (path === '/api/auth/dev' && request.method === 'GET') {
    if (env.ENVIRONMENT !== 'development') {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }

    const userId = await upsertDevUser(env.DB)
    const token = await signJWT(
      {
        sub: userId,
        email: 'dev@localhost.test',
        plan: 'business',
      },
      getJwtSecret(env)
    )

    return new Response(null, {
      status: 302,
      headers: {
        'Location': getAppUrl(env),
        'Set-Cookie': [
          `pm_session=${token}`,
          'HttpOnly',
          'SameSite=Lax',
          'Path=/',
          `Max-Age=${60 * 60 * 24 * 30}`,
        ].join('; '),
      },
    })
  }

  // ── GET /api/auth/google ───────────────────────────────────
  // Redirect to Google OAuth
  if (path === '/api/auth/google' && request.method === 'GET') {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: getRedirectUri(env),
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      state: crypto.randomUUID(),
    })
    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
  }

  // ── GET /api/auth/callback ────────────────────────────────
  // Handle Google OAuth callback
  if (path === '/api/auth/callback' && request.method === 'GET') {
    const code = url.searchParams.get('code')
    if (!code) {
      return redirectWithError(env, 'oauth_failed')
    }

    try {
      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: getRedirectUri(env),
          grant_type: 'authorization_code',
        }),
      })

      const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
      if (!tokenData.access_token) {
        return redirectWithError(env, 'token_exchange_failed')
      }

      // Get user profile
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const profile = await profileRes.json() as {
        id: string; email: string; name: string; picture?: string
      }

      // Upsert user in D1
      const { userId, isNew } = await upsertUser(env.DB, profile)

      if (isNew) {
        await sendEmail(env, 'welcome', profile.email, profile.name, {})
      }

      // Get user's current plan
      const user = await env.DB.prepare(
        'SELECT plan FROM users WHERE id = ?'
      ).bind(userId).first<{ plan: string }>()

      // Sign JWT
      const token = await signJWT(
        { sub: userId, email: profile.email, plan: user?.plan ?? 'free' },
        getJwtSecret(env)
      )

      const isProduction = env.ENVIRONMENT === 'production'
      const domain = env.DOMAIN

      // Set httpOnly cookie and redirect to app
      return new Response(null, {
        status: 302,
        headers: {
          'Location': getAppUrl(env),
          'Set-Cookie': [
            `pm_session=${token}`,
            'HttpOnly',
            'SameSite=Lax',
            `Path=/`,
            isProduction ? 'Secure' : '',
            isProduction ? `Domain=${domain}` : '',
            `Max-Age=${60 * 60 * 24 * 30}`,
          ].filter(Boolean).join('; '),
        },
      })
    } catch (err) {
      console.error('Auth callback error:', err)
      return redirectWithError(env, 'server_error')
    }
  }

  // ── POST /api/auth/logout ─────────────────────────────────
  if (path === '/api/auth/logout' && request.method === 'POST') {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': 'pm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0',
      },
    })
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
}

async function upsertDevUser(db: D1Database): Promise<string> {
  const googleId = 'local-dev-user'
  const existing = await db.prepare(
    'SELECT id FROM users WHERE google_id = ?'
  ).bind(googleId).first<{ id: string }>()

  if (existing) {
    await db.prepare(
      `UPDATE users
       SET email = ?, name = ?, avatar_url = ?, plan = 'business', role = 'admin',
           plan_status = 'active', disabled = 0, updated_at = unixepoch()
       WHERE id = ?`
    ).bind('dev@localhost.test', 'Local Developer', null, existing.id).run()

    await ensureUsageRecord(db, existing.id)
    return existing.id
  }

  const id = generateId()
  await db.prepare(
    `INSERT INTO users
      (id, email, name, avatar_url, google_id, plan, plan_status, currency, role)
     VALUES (?, ?, ?, ?, ?, 'business', 'active', 'usd', 'admin')`
  ).bind(id, 'dev@localhost.test', 'Local Developer', null, googleId).run()

  await ensureUsageRecord(db, id)
  return id
}

async function ensureUsageRecord(db: D1Database, userId: string): Promise<void> {
  const { periodStart, periodEnd } = getCurrentPeriod()
  await db.prepare(
    `INSERT OR IGNORE INTO usage (id, user_id, period_start, period_end, generations)
     VALUES (?, ?, ?, ?, 0)`
  ).bind(generateId(), userId, periodStart, periodEnd).run()
}

async function upsertUser(
  db: D1Database,
  profile: { id: string; email: string; name: string; picture?: string }
): Promise<{ userId: string; isNew: boolean }> {
  // Check if user exists
  const existing = await db.prepare(
    'SELECT id FROM users WHERE google_id = ?'
  ).bind(profile.id).first<{ id: string }>()

  if (existing) {
    // Update name/avatar in case they changed
    await db.prepare(
      'UPDATE users SET name = ?, avatar_url = ?, updated_at = unixepoch() WHERE id = ?'
    ).bind(profile.name, profile.picture ?? null, existing.id).run()
    return { userId: existing.id, isNew: false }
  }

  // New user
  const id = generateId()
  await db.prepare(
    `INSERT INTO users (id, email, name, avatar_url, google_id, plan, plan_status, currency)
     VALUES (?, ?, ?, ?, ?, 'free', 'active', 'usd')`
  ).bind(id, profile.email, profile.name, profile.picture ?? null, profile.id).run()

  // Create initial usage record for this period
  const { periodStart, periodEnd } = getCurrentPeriod()
  await db.prepare(
    `INSERT INTO usage (id, user_id, period_start, period_end, generations)
     VALUES (?, ?, ?, ?, 0)`
  ).bind(generateId(), id, periodStart, periodEnd).run()

  return { userId: id, isNew: true }
}


function getRedirectUri(env: Env): string {
  return env.ENVIRONMENT === 'development'
    ? 'http://localhost:8787/api/auth/callback'
    : `https://${env.DOMAIN}/api/auth/callback`
}

function getAppUrl(env: Env): string {
  return env.ENVIRONMENT === 'development'
    ? 'http://localhost:5173/app'
    : `https://${env.DOMAIN}/app`
}

function redirectWithError(env: Env, error: string): Response {
  const base = env.ENVIRONMENT === 'development' ? 'http://localhost:5173' : `https://${env.DOMAIN}`
  return Response.redirect(`${base}?error=${error}`, 302)
}
