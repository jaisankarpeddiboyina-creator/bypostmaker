// ============================================================
// share.ts — Public & Authenticated Share Endpoints
// ============================================================

import type { Env } from '../../../config/ai'
import { PLATFORM_MAP } from '../../../config/platforms'

const NANOID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'

export function generateShareId(size = 21): string {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < size; i++) {
    id += NANOID_ALPHABET[bytes[i] % NANOID_ALPHABET.length]
  }
  return id
}

interface SharePostInput {
  platformId: string
  content: string
  edited?: boolean
  extraFields?: Record<string, string>
}

interface CreateShareRequestBody {
  campaignId?: string
  posts?: SharePostInput[]
}

/**
 * POST /api/share (Authenticated)
 * Creates a public read-only snapshot from the client's current posts.
 */
export async function handleCreateShare(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  let body: CreateShareRequestBody
  try {
    body = await request.json() as CreateShareRequestBody
  } catch {
    return jsonError('Invalid request body', 400)
  }

  const { campaignId, posts } = body

  if (!campaignId || typeof campaignId !== 'string') {
    return jsonError('Missing or invalid campaignId', 400)
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    return jsonError('Posts must be a non-empty array', 400)
  }

  // 1. Verify campaign ownership and load campaign metadata
  const campaign = await env.DB.prepare(
    `SELECT id, user_id, platforms, image_key FROM campaigns WHERE id = ? AND user_id = ?`
  ).bind(campaignId, userId).first<{ id: string; user_id: string; platforms: string; image_key: string | null }>()

  if (!campaign) {
    return jsonError('Campaign not found', 404)
  }

  // 2. Validate that all post platformIds belong to this campaign's platforms list
  let campaignPlatforms: string[] = []
  try {
    campaignPlatforms = JSON.parse(campaign.platforms)
  } catch {
    campaignPlatforms = []
  }

  const campaignPlatformSet = new Set(campaignPlatforms)

  for (const post of posts) {
    if (!post.platformId || typeof post.platformId !== 'string') {
      return jsonError('Invalid platformId in posts array', 400)
    }
    if (!campaignPlatformSet.has(post.platformId)) {
      return jsonError(`Platform '${post.platformId}' is not part of this campaign`, 400)
    }
    if (!PLATFORM_MAP[post.platformId]) {
      return jsonError(`Unknown platform: ${post.platformId}`, 400)
    }
    if (typeof post.content !== 'string') {
      return jsonError(`Invalid content for platform '${post.platformId}'`, 400)
    }
  }

  // 3. Sanitize posts to strictly whitelisted fields (prompt/original_prompt/user info never included)
  const sanitizedPosts = posts.map(p => ({
    platformId: p.platformId,
    content: p.content,
    edited: Boolean(p.edited),
    extraFields: p.extraFields && typeof p.extraFields === 'object' ? p.extraFields : undefined,
  }))

  // 4. Fetch media keys for this campaign (supporting multi-image)
  const { results: imageRows } = await env.DB.prepare(
    `SELECT image_key FROM campaign_images WHERE campaign_id = ? AND user_id = ? ORDER BY sort_order ASC`
  ).bind(campaignId, userId).all<{ image_key: string }>()

  let mediaKeys: string[] = []
  if (imageRows && imageRows.length > 0) {
    mediaKeys = imageRows.map(r => r.image_key).filter(Boolean)
  } else if (campaign.image_key) {
    mediaKeys = [campaign.image_key]
  }

  // 5. Generate 21-character Nanoid and compute expiration (48 hours = 172800s)
  const shareId = generateShareId(21)
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + 172800

  // Generate a clean public title
  const platformNames = sanitizedPosts
    .map(p => PLATFORM_MAP[p.platformId]?.name || p.platformId)
    .slice(0, 3)
    .join(', ')
  const title = `Content Kit · ${platformNames}${sanitizedPosts.length > 3 ? ` +${sanitizedPosts.length - 3}` : ''}`

  await env.DB.prepare(
    `INSERT INTO shares (id, user_id, campaign_id, title, content_snapshot, media_keys, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    shareId,
    userId,
    campaignId,
    title,
    JSON.stringify(sanitizedPosts),
    mediaKeys.length > 0 ? JSON.stringify(mediaKeys) : null,
    now,
    expiresAt
  ).run()

  return new Response(JSON.stringify({
    success: true,
    shareId,
    shareUrl: `https://bypostamaker.com/share/${shareId}`,
    expiresAt,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * DELETE /api/share/:id (Authenticated)
 * Allows creator to revoke their share link early.
 */
export async function handleDeleteShare(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const shareId = segments[3]?.trim()

  if (!shareId) {
    return jsonError('Missing share ID', 400)
  }

  const result = await env.DB.prepare(
    `DELETE FROM shares WHERE id = ? AND user_id = ?`
  ).bind(shareId, userId).run()

  return new Response(JSON.stringify({ ok: true, deleted: result.meta?.changes ?? 0 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * GET /api/share/:id (Public, Unauthenticated)
 * Fetches the public content snapshot if active and not expired.
 */
export async function handleGetShare(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  const shareId = segments[3]?.trim()

  if (!shareId) {
    return jsonError('Missing share ID', 400)
  }

  const row = await env.DB.prepare(
    `SELECT id, title, content_snapshot, media_keys, created_at, expires_at
     FROM shares WHERE id = ? AND expires_at > unixepoch()`
  ).bind(shareId).first<{
    id: string
    title: string
    content_snapshot: string
    media_keys: string | null
    created_at: number
    expires_at: number
  }>()

  if (!row) {
    return jsonError('Share link not found or has expired', 404)
  }

  let posts: any[] = []
  try {
    posts = JSON.parse(row.content_snapshot)
  } catch {
    posts = []
  }

  let mediaKeysArray: string[] = []
  if (row.media_keys) {
    try {
      mediaKeysArray = JSON.parse(row.media_keys)
    } catch {
      mediaKeysArray = []
    }
  }

  const imageUrls = mediaKeysArray.map((_, i) => `/api/share/${shareId}/image/${i}`)

  return new Response(JSON.stringify({
    id: row.id,
    title: row.title,
    posts,
    imageUrls,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  })
}

/**
 * GET /api/share/:id/image/:index (Public, Unauthenticated)
 * Streams public media proxy for a shared link.
 */
export async function handleShareImage(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  // Path: /api/share/:id/image/:index
  const shareId = segments[3]?.trim()
  const indexStr = segments[5]?.trim() ?? '0'
  const index = parseInt(indexStr, 10)

  if (!shareId || isNaN(index) || index < 0) {
    return jsonError('Invalid image request', 400)
  }

  const row = await env.DB.prepare(
    `SELECT media_keys FROM shares WHERE id = ? AND expires_at > unixepoch()`
  ).bind(shareId).first<{ media_keys: string | null }>()

  if (!row || !row.media_keys) {
    return jsonError('Image not found or expired', 404)
  }

  let mediaKeys: string[] = []
  try {
    mediaKeys = JSON.parse(row.media_keys)
  } catch {
    return jsonError('Image not found', 404)
  }

  const imageKey = mediaKeys[index]
  if (!imageKey) {
    return jsonError('Image index out of range', 404)
  }

  // Defensive sanity check: key format
  if (!imageKey.startsWith('uploads/')) {
    console.error(`[share image] Unexpected image_key format for share ${shareId}: ${imageKey}`)
    return jsonError('Image not available', 404)
  }

  const object = await env.BUCKET.get(imageKey)
  if (!object) {
    return jsonError('Image not found in storage', 404)
  }

  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream'

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Content-Length': String(object.size),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
