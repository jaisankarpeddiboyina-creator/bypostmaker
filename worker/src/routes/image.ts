// ============================================================
// image.ts — GET /api/image/:campaignId
//
// Serves a single R2 image object to the authenticated owner
// of the campaign it belongs to.
//
// Access control: D1 ownership query (WHERE id = ? AND user_id = ?)
// runs before any R2 call. A request for another user's campaignId
// returns 404 — not 403 — to avoid leaking whether the campaignId exists.
//
// R2 access: uses env.BUCKET (Workers R2 binding), NOT env.R2_BUCKET_NAME
// and NOT the S3-compat SDK. This matches generate.ts/retry.ts/cron.ts.
// ============================================================

import type { Env } from '../../../config/ai'

export async function handleImageRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  // Extract campaignId from path: /api/image/:campaignId
  const url = new URL(request.url)
  const segments = url.pathname.split('/')
  // pathname = /api/image/<campaignId> → segments = ['', 'api', 'image', '<campaignId>']
  const campaignId = segments[3]?.trim()

  if (!campaignId) {
    return jsonError('Missing campaign ID', 400)
  }

  // ── Ownership check ─────────────────────────────────────────
  // Query D1 with both id AND user_id. A user querying another
  // user's campaignId gets 0 rows → 404 (not 403), which does
  // not reveal whether that campaignId exists at all.
  const row = await env.DB.prepare(
    'SELECT image_key FROM campaigns WHERE id = ? AND user_id = ?'
  ).bind(campaignId, userId).first<{ image_key: string | null }>()

  if (!row) {
    return jsonError('Campaign not found', 404)
  }

  if (!row.image_key) {
    // image_key is NULL: retention has run, or no image was ever uploaded.
    // Either way, the image is not available. Return 404 — the frontend
    // uses this as the canonical signal to show the "Image expired" placeholder.
    return jsonError('Image not available', 404)
  }

  const imageKey = row.image_key

  // ── Defensive sanity check ──────────────────────────────────
  // The key should always start with 'uploads/' (set by upload.ts).
  // This is an internal assertion — never user-supplied.
  // If this fires, something has gone badly wrong in how keys are stored.
  if (!imageKey.startsWith('uploads/')) {
    console.error(`[image] Unexpected image_key format for campaign ${campaignId}: ${imageKey}`)
    return jsonError('Image not available', 404)
  }

  // ── R2 fetch ────────────────────────────────────────────────
  // Uses env.BUCKET — the Workers R2 binding. Not the S3-compat SDK.
  const object = await env.BUCKET.get(imageKey)

  if (!object) {
    // R2 object is gone (retention race: DB row not yet nulled but object
    // already deleted). Treat the same as a null image_key.
    console.warn(`[image] R2 object missing for campaign ${campaignId}, key ${imageKey}`)
    return jsonError('Image not available', 404)
  }

  // ── Stream response ─────────────────────────────────────────
  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream'

  return new Response(object.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // private: must not be cached by CDN/edge proxies (image is user-private)
      // max-age=3600: browser can cache for 1 hour; image bytes are immutable
      // for their lifetime — if retention deletes the object, the key NULLs
      // in D1 and future /api/history calls return image_fetch_url: null.
      'Cache-Control': 'private, max-age=3600',
      'Content-Length': String(object.size),
      // Prevents MIME-sniffing — serve the declared content type only
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
