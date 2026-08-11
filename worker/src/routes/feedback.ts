import type { Env } from '../../../config/ai'
import { withAuth } from '../middleware/auth'
import { withIpRateLimit } from '../middleware/rateLimit'

export async function handleFeedbackSubmit(
  request: Request,
  env: Env
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 1. Rate Limit check: 5 requests per minute per IP
  const rateLimit = await withIpRateLimit(request, env, 5)
  if (!rateLimit.ok) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rateLimit.retryAfter ?? 60),
      },
    })
  }

  try {
    const body = await request.json() as {
      category?: string
      rating?: number | null
      message?: string
      email?: string | null
    }

    const { category, rating, message, email } = body

    // 2. Server-side Validation
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    if (message.length > 1000) {
      return new Response(JSON.stringify({ error: 'Message cannot exceed 1000 characters' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    const allowedCategories = ['bug', 'feature-request', 'general']
    if (!category || !allowedCategories.includes(category)) {
      return new Response(JSON.stringify({ error: 'Valid category is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    if (rating !== undefined && rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return new Response(JSON.stringify({ error: 'Rating must be an integer between 1 and 5' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Auth-Optional Context check
    const auth = await withAuth(request, env)
    let userId: string | null = null
    let userEmail: string | null = null

    if (auth.ok) {
      userId = auth.userId
      // Resolve email from D1 users table
      const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
        .bind(userId)
        .first<{ email: string }>()
      if (user) {
        userEmail = user.email
      }
    } else {
      // For guest, use provided email if valid format
      if (email && typeof email === 'string' && email.includes('@')) {
        userEmail = email.trim().slice(0, 255)
      }
    }

    const id = crypto.randomUUID()

    // 4. Save to D1 database
    await env.DB.prepare(
      `INSERT INTO feedback (id, user_id, user_email, category, rating, message)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, userId, userEmail, category, rating || null, message.trim()).run()

    return new Response(JSON.stringify({ ok: true, id }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Feedback submit handler failed:', err)
    return new Response(JSON.stringify({ error: 'Failed to submit feedback' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}
