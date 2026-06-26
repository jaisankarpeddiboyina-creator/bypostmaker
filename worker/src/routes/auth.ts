import type { Env } from '../../../config/ai'
import { getJwtSecret, signJWT } from '../middleware/auth'
import { generateId } from '../utils/id'
import { sendEmail } from '../services/email'
import { getCurrentPeriod } from '../utils/period'
import { hashPassword, verifyPassword } from '../utils/crypto'

export async function handleAuth(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname

  // ── POST /api/auth/test/upsert ─────────────────────────────
  if (path === '/api/auth/test/upsert' && request.method === 'POST') {
    if (env.ENVIRONMENT !== 'development') {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }
    const profile = await request.json() as { id: string; email: string; name: string; picture?: string }
    const result = await upsertUser(env.DB, profile)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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
        await sendEmail(env, 'welcome', profile.email.toLowerCase(), profile.name, {})
      }

      // Get user's current plan
      const user = await env.DB.prepare(
        'SELECT plan FROM users WHERE id = ?'
      ).bind(userId).first<{ plan: string }>()

      // Sign JWT
      const token = await signJWT(
        { sub: userId, email: profile.email.toLowerCase(), plan: user?.plan ?? 'free' },
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

  // ── POST /api/auth/email/signup ────────────────────────────
  if (path === '/api/auth/email/signup' && request.method === 'POST') {
    const { email, password, name } = await request.json() as { email?: string, password?: string, name?: string }
    if (!email || !password || !name) {
      return jsonError('Missing required fields', 400)
    }

    const trimmedEmail = email.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmedEmail)) {
      return jsonError('Invalid email format', 400)
    }

    const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}/
    if (password.length < 8 || !passwordRegex.test(password)) {
      return jsonError('Password does not meet complexity requirements', 400)
    }

    const existing = await env.DB.prepare(
      'SELECT id, password_hash FROM users WHERE email = ?'
    ).bind(trimmedEmail).first<{ id: string; password_hash: string | null }>()

    if (existing) {
      if (existing.password_hash) {
        return jsonError('An account with this email already exists.', 400)
      } else {
        return jsonError('This email is registered via Google OAuth. Please sign in with Google.', 400)
      }
    }

    const userId = crypto.randomUUID()
    const passwordHash = await hashPassword(password)
    const googleId = `email:${userId}`

    // Insert user
    await env.DB.prepare(
      `INSERT INTO users (id, email, name, avatar_url, google_id, password_hash, email_verified, plan, plan_status, currency)
       VALUES (?, ?, ?, NULL, ?, ?, 0, 'free', 'active', 'usd')`
    ).bind(userId, trimmedEmail, name, googleId, passwordHash).run()

    // Create initial usage record
    const { periodStart, periodEnd } = getCurrentPeriod()
    await env.DB.prepare(
      `INSERT OR IGNORE INTO usage (id, user_id, period_start, period_end, generations)
       VALUES (?, ?, ?, ?, 0)`
    ).bind(crypto.randomUUID(), userId, periodStart, periodEnd).run()

    // Create email verification token
    const token = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600 // 24 hours
    await env.DB.prepare(
      'INSERT OR REPLACE INTO email_verifications (email, token, expires_at) VALUES (?, ?, ?)'
    ).bind(trimmedEmail, token, expiresAt).run()

    // Send verification email
    await sendEmail(env, 'verify_email', trimmedEmail, name, { token, email: trimmedEmail })

    // Sign JWT
    const jwtToken = await signJWT(
      { sub: userId, email: trimmedEmail, plan: 'free' },
      getJwtSecret(env)
    )

    const isProduction = env.ENVIRONMENT === 'production'
    const domain = env.DOMAIN

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': [
          `pm_session=${jwtToken}`,
          'HttpOnly',
          'SameSite=Lax',
          'Path=/',
          isProduction ? 'Secure' : '',
          isProduction ? `Domain=${domain}` : '',
          `Max-Age=${60 * 60 * 24 * 30}`,
        ].filter(Boolean).join('; '),
      },
    })
  }

  // ── POST /api/auth/email/login ─────────────────────────────
  if (path === '/api/auth/email/login' && request.method === 'POST') {
    const { email, password } = await request.json() as { email?: string, password?: string }
    if (!email || !password) {
      return jsonError('Missing email or password', 400)
    }

    const trimmedEmail = email.trim().toLowerCase()
    const user = await env.DB.prepare(
      'SELECT id, email, name, password_hash, plan FROM users WHERE email = ?'
    ).bind(trimmedEmail).first<{ id: string; email: string; name: string; password_hash: string | null; plan: string }>()

    if (!user) {
      return jsonError('Invalid email or password', 400)
    }

    if (!user.password_hash) {
      return jsonError('This account was created using Google Sign-in. Please log in with Google.', 400)
    }

    const isValid = await verifyPassword(password, user.password_hash)
    if (!isValid) {
      return jsonError('Invalid email or password', 400)
    }

    // Sign JWT
    const jwtToken = await signJWT(
      { sub: user.id, email: user.email, plan: user.plan ?? 'free' },
      getJwtSecret(env)
    )

    const isProduction = env.ENVIRONMENT === 'production'
    const domain = env.DOMAIN

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': [
          `pm_session=${jwtToken}`,
          'HttpOnly',
          'SameSite=Lax',
          'Path=/',
          isProduction ? 'Secure' : '',
          isProduction ? `Domain=${domain}` : '',
          `Max-Age=${60 * 60 * 24 * 30}`,
        ].filter(Boolean).join('; '),
      },
    })
  }

  // ── GET /api/auth/email/verify ─────────────────────────────
  if (path === '/api/auth/email/verify' && request.method === 'GET') {
    const token = url.searchParams.get('token')
    const email = url.searchParams.get('email')

    const base = env.ENVIRONMENT === 'development' ? 'http://localhost:5173' : `https://${env.DOMAIN}`

    if (!token || !email) {
      return Response.redirect(`${base}/login?error=invalid_token`, 302)
    }

    const trimmedEmail = email.trim().toLowerCase()
    const verification = await env.DB.prepare(
      'SELECT token, expires_at FROM email_verifications WHERE email = ?'
    ).bind(trimmedEmail).first<{ token: string; expires_at: number }>()

    if (!verification || verification.token !== token || Math.floor(Date.now() / 1000) > verification.expires_at) {
      return Response.redirect(`${base}/login?error=invalid_token`, 302)
    }

    // Verify user
    await env.DB.prepare(
      'UPDATE users SET email_verified = 1, updated_at = unixepoch() WHERE email = ?'
    ).bind(trimmedEmail).run()

    // Delete token
    await env.DB.prepare(
      'DELETE FROM email_verifications WHERE email = ?'
    ).bind(trimmedEmail).run()

    return Response.redirect(`${base}/login?verified=true`, 302)
  }

  // ── POST /api/auth/email/forgot-password ───────────────────
  if (path === '/api/auth/email/forgot-password' && request.method === 'POST') {
    const { email } = await request.json() as { email?: string }
    if (!email) {
      return jsonError('Missing email address', 400)
    }

    const trimmedEmail = email.trim().toLowerCase()
    const user = await env.DB.prepare(
      'SELECT id, name, password_hash FROM users WHERE email = ?'
    ).bind(trimmedEmail).first<{ id: string; name: string; password_hash: string | null }>()

    const genericSuccess = new Response(JSON.stringify({ ok: true, message: 'If the email is registered, a password reset link has been sent.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

    if (!user || !user.password_hash) {
      return genericSuccess
    }

    const token = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 3600 // 1 hour

    await env.DB.prepare(
      'INSERT OR REPLACE INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)'
    ).bind(trimmedEmail, token, expiresAt).run()

    await sendEmail(env, 'reset_password', trimmedEmail, user.name, { token, email: trimmedEmail })

    return genericSuccess
  }

  // ── POST /api/auth/email/reset-password ────────────────────
  if (path === '/api/auth/email/reset-password' && request.method === 'POST') {
    const { email, token, password } = await request.json() as { email?: string, token?: string, password?: string }
    if (!email || !token || !password) {
      return jsonError('Missing required fields', 400)
    }

    const trimmedEmail = email.trim().toLowerCase()
    const reset = await env.DB.prepare(
      'SELECT token, expires_at FROM password_resets WHERE email = ?'
    ).bind(trimmedEmail).first<{ token: string; expires_at: number }>()

    if (!reset || reset.token !== token || Math.floor(Date.now() / 1000) > reset.expires_at) {
      return jsonError('Invalid or expired password reset link.', 400)
    }

    const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}/
    if (password.length < 8 || !passwordRegex.test(password)) {
      return jsonError('Password does not meet complexity requirements', 400)
    }

    const passwordHash = await hashPassword(password)

    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE email = ?'
    ).bind(passwordHash, trimmedEmail).run()

    await env.DB.prepare(
      'DELETE FROM password_resets WHERE email = ?'
    ).bind(trimmedEmail).run()

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
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
           plan_status = 'active', disabled = 0, email_verified = 1, updated_at = unixepoch()
       WHERE id = ?`
    ).bind('dev@localhost.test', 'Local Developer', null, existing.id).run()

    await ensureUsageRecord(db, existing.id)
    return existing.id
  }

  const id = generateId()
  await db.prepare(
    `INSERT INTO users
      (id, email, name, avatar_url, google_id, email_verified, plan, plan_status, currency, role)
     VALUES (?, ?, ?, ?, ?, 1, 'business', 'active', 'usd', 'admin')`
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
  const googleId = profile.id
  const email = profile.email.trim().toLowerCase()

  // 1. Check if user exists by google_id
  const existingByGoogle = await db.prepare(
    'SELECT id FROM users WHERE google_id = ?'
  ).bind(googleId).first<{ id: string }>()

  if (existingByGoogle) {
    await db.prepare(
      'UPDATE users SET name = ?, avatar_url = ?, email_verified = 1, updated_at = unixepoch() WHERE id = ?'
    ).bind(profile.name, profile.picture ?? null, existingByGoogle.id).run()
    return { userId: existingByGoogle.id, isNew: false }
  }

  // 2. Check if user exists by email (Account Linking)
  const existingByEmail = await db.prepare(
    'SELECT id, google_id FROM users WHERE email = ?'
  ).bind(email).first<{ id: string; google_id: string }>()

  if (existingByEmail) {
    await db.prepare(
      'UPDATE users SET google_id = ?, name = ?, avatar_url = ?, email_verified = 1, updated_at = unixepoch() WHERE id = ?'
    ).bind(googleId, profile.name, profile.picture ?? null, existingByEmail.id).run()
    return { userId: existingByEmail.id, isNew: false }
  }

  // 3. Truly new user
  const id = generateId()
  await db.prepare(
    `INSERT INTO users (id, email, name, avatar_url, google_id, email_verified, plan, plan_status, currency)
     VALUES (?, ?, ?, ?, ?, 1, 'free', 'active', 'usd')`
  ).bind(id, email, profile.name, profile.picture ?? null, googleId).run()

  // Create initial usage record
  const { periodStart, periodEnd } = getCurrentPeriod()
  await db.prepare(
    `INSERT OR IGNORE INTO usage (id, user_id, period_start, period_end, generations)
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
  return Response.redirect(`${base}/login?error=${error}`, 302)
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
