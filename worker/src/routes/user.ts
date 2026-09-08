import type { Env } from '../../../config/ai'
import { sendEmail } from '../services/email'
import { hashPassword, verifyPassword } from '../utils/crypto'

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
      `SELECT id, email, name, avatar_url, plan, plan_status, currency, role, email_verified, created_at, updated_at FROM users WHERE id = ?`
    ).bind(userId).first()

    if (!user) return jsonError('User not found', 404)

    const usage = await env.DB.prepare(
      `SELECT generations, period_start, period_end FROM usage
       WHERE user_id = ? ORDER BY period_start DESC LIMIT 1`
    ).bind(userId).first<{ generations: number; period_start: number; period_end: number }>()

    return json({ user, usage })
  }

  // ── GET /api/user/avatar ──────────────────────────────────
  if (path === '/api/user/avatar' && request.method === 'GET') {
    const user = await env.DB.prepare(
      'SELECT avatar_url FROM users WHERE id = ?'
    ).bind(userId).first<{ avatar_url: string | null }>()

    if (!user || !user.avatar_url) {
      return jsonError('Avatar not found', 404)
    }

    if (user.avatar_url.startsWith('http://') || user.avatar_url.startsWith('https://')) {
      return Response.redirect(user.avatar_url, 302)
    }

    const expectedUserPrefix = `uploads/${userId}/`
    if (!user.avatar_url.startsWith(expectedUserPrefix)) {
      return jsonError('Invalid avatar key', 403)
    }

    const object = await env.BUCKET.get(user.avatar_url)
    if (!object) {
      return jsonError('Avatar image not found in storage', 404)
    }

    const contentType = object.httpMetadata?.contentType || 'image/jpeg'
    return new Response(object.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': String(object.size),
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  // ── DELETE /api/user/avatar ───────────────────────────────
  if (path === '/api/user/avatar' && request.method === 'DELETE') {
    const user = await env.DB.prepare(
      'SELECT avatar_url FROM users WHERE id = ?'
    ).bind(userId).first<{ avatar_url: string | null }>()

    if (user?.avatar_url) {
      const expectedUserPrefix = `uploads/${userId}/`
      if (user.avatar_url.startsWith(expectedUserPrefix)) {
        await env.BUCKET.delete(user.avatar_url).catch((err: any) => {
          console.error(`Failed to delete avatar from R2: ${user.avatar_url}`, err)
        })
      }
    }

    await env.DB.prepare(
      'UPDATE users SET avatar_url = NULL, updated_at = unixepoch() WHERE id = ?'
    ).bind(userId).run()

    const updatedUser = await env.DB.prepare(
      `SELECT id, email, name, avatar_url, plan, plan_status, currency, role, email_verified, created_at, updated_at FROM users WHERE id = ?`
    ).bind(userId).first()

    return json({ ok: true, user: updatedUser })
  }

  // ── PUT /api/user/profile ─────────────────────────────────
  if (path === '/api/user/profile' && request.method === 'PUT') {
    const body = await request.json() as { name?: string; avatar_url?: string | null }
    const name = body.name !== undefined && body.name !== null ? body.name.trim().slice(0, 100) : undefined
    const rawAvatar = body.avatar_url
    const avatar_url = rawAvatar !== undefined && rawAvatar !== null ? rawAvatar.trim() : (rawAvatar === null ? null : undefined)

    if (name !== undefined && name.length === 0) {
      return jsonError('Name cannot be empty', 400)
    }

    if (avatar_url !== undefined && avatar_url !== null && avatar_url !== '') {
      const isHttp = avatar_url.startsWith('https://') || avatar_url.startsWith('http://')
      const expectedUserPrefix = `uploads/${userId}/`
      const isUserUpload = avatar_url.startsWith(expectedUserPrefix)
      if (!isHttp && !isUserUpload) {
        return jsonError('Invalid avatar key. Avatar must be uploaded directly by this account.', 403)
      }
    }

    // Fetch previous avatar to clean up orphaned R2 object if replacing/removing
    let oldAvatarUrl: string | null = null
    if (avatar_url !== undefined) {
      const currentUser = await env.DB.prepare(
        'SELECT avatar_url FROM users WHERE id = ?'
      ).bind(userId).first<{ avatar_url: string | null }>()
      oldAvatarUrl = currentUser?.avatar_url ?? null
    }

    const newAvatarVal = avatar_url === '' ? null : avatar_url

    if (name !== undefined && avatar_url !== undefined) {
      await env.DB.prepare(
        'UPDATE users SET name = ?, avatar_url = ?, updated_at = unixepoch() WHERE id = ?'
      ).bind(name, newAvatarVal, userId).run()
    } else if (name !== undefined) {
      await env.DB.prepare(
        'UPDATE users SET name = ?, updated_at = unixepoch() WHERE id = ?'
      ).bind(name, userId).run()
    } else if (avatar_url !== undefined) {
      await env.DB.prepare(
        'UPDATE users SET avatar_url = ?, updated_at = unixepoch() WHERE id = ?'
      ).bind(newAvatarVal, userId).run()
    }

    // If avatar was replaced with a different value, delete the old R2 object
    if (
      avatar_url !== undefined &&
      oldAvatarUrl &&
      oldAvatarUrl !== newAvatarVal &&
      oldAvatarUrl.startsWith(`uploads/${userId}/`)
    ) {
      await env.BUCKET.delete(oldAvatarUrl).catch((err: any) => {
        console.error(`Failed to delete replaced avatar from R2: ${oldAvatarUrl}`, err)
      })
    }

    const updatedUser = await env.DB.prepare(
      `SELECT id, email, name, avatar_url, plan, plan_status, currency, role, email_verified, created_at, updated_at FROM users WHERE id = ?`
    ).bind(userId).first()

    return json({ ok: true, user: updatedUser })
  }

  // ── POST /api/user/change-password ────────────────────────
  if (path === '/api/user/change-password' && request.method === 'POST') {
    const { currentPassword, newPassword } = await request.json() as {
      currentPassword?: string
      newPassword?: string
    }

    if (!currentPassword || !newPassword) {
      return jsonError('Current password and new password are required', 400)
    }

    const user = await env.DB.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    ).bind(userId).first<{ password_hash: string | null }>()

    if (!user) return jsonError('User not found', 404)

    if (!user.password_hash) {
      return jsonError('This account was created with Google Sign-in and does not have a password.', 400)
    }

    const isValid = await verifyPassword(currentPassword, user.password_hash)
    if (!isValid) {
      return jsonError('Current password is incorrect', 400)
    }

    const passwordRegex = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}/
    if (newPassword.length < 8 || !passwordRegex.test(newPassword)) {
      return jsonError('Password does not meet complexity requirements', 400)
    }

    const passwordHash = await hashPassword(newPassword)

    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ?'
    ).bind(passwordHash, userId).run()

    return json({ ok: true, message: 'Password updated successfully' })
  }

  // ── POST /api/user/resend-verification ────────────────────
  if (path === '/api/user/resend-verification' && request.method === 'POST') {
    const user = await env.DB.prepare(
      'SELECT email, name, email_verified FROM users WHERE id = ?'
    ).bind(userId).first<{ email: string; name: string; email_verified: number }>()

    if (!user) return jsonError('User not found', 404)
    if (user.email_verified === 1) {
      return json({ ok: true, message: 'Email already verified' })
    }

    const token = crypto.randomUUID()
    const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600 // 24 hours

    await env.DB.prepare(
      'INSERT OR REPLACE INTO email_verifications (email, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.email, token, expiresAt).run()

    await sendEmail(env, 'verify_email', user.email, user.name, { token, email: user.email })

    return json({ ok: true })
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

    // Step 2 — Purge user R2 objects
    try {
      const legacyKeys = await env.DB.prepare(
        `SELECT image_key FROM campaigns WHERE user_id = ? AND image_key IS NOT NULL`
      ).bind(userId).all<{ image_key: string }>()

      const multiKeys = await env.DB.prepare(
        `SELECT image_key FROM campaign_images WHERE user_id = ?`
      ).bind(userId).all<{ image_key: string }>()

      const allKeysToDelete = new Set<string>()
      if (legacyKeys.results) legacyKeys.results.forEach(r => allKeysToDelete.add(r.image_key))
      if (multiKeys.results) multiKeys.results.forEach(r => allKeysToDelete.add(r.image_key))

      for (const key of allKeysToDelete) {
        await env.BUCKET.delete(key).catch(err => {
          console.error('Failed to delete R2 object on account delete:', key, err)
        })
      }
    } catch (err) {
      console.error('Error querying/deleting user R2 objects during account deletion:', err)
    }

    // Step 3 — Delete all user data (order respects foreign keys)
    await env.DB.batch([
      env.DB.prepare('DELETE FROM generated_posts WHERE user_id = ?').bind(userId),
      env.DB.prepare('DELETE FROM campaign_images WHERE user_id = ?').bind(userId),
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
