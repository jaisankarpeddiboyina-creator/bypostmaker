import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import { createStreamingClient, detectLanguage, buildGroupSystemPrompt, parseGroupResponse } from '../../../config/ai'
import { PLATFORM_MAP, isPlatformAccessible } from '../../../config/platforms'
import { generateId } from '../utils/id'

export async function handleRetry(
  request: Request,
  env: Env,
  userId: string,
  userPlan: PlatformTier
): Promise<Response> {
  let body: { campaignId: string; platformId: string }
  try {
    body = await request.json() as { campaignId: string; platformId: string }
  } catch {
    return jsonError('Invalid request body', 400)
  }

  const { campaignId, platformId } = body
  if (!campaignId || !platformId) return jsonError('Missing required fields', 400)
  if (!env.GROQ_API_KEY || !env.GEMINI_API_KEY) return jsonError('Missing AI keys', 500)

  // Verify campaign belongs to this user and fetch the original prompt + image metadata.
  // image_key and has_image are required to reconstruct the original vision context.
  const campaign = await env.DB.prepare(
    'SELECT id, prompt, image_key, has_image FROM campaigns WHERE id = ? AND user_id = ?'
  ).bind(campaignId, userId).first<{ id: string; prompt: string; image_key: string | null; has_image: number }>()
  if (!campaign) return jsonError('Campaign not found', 404)

  const platform = PLATFORM_MAP[platformId]
  if (!platform) return jsonError('Unknown platform', 400)

  if (!isPlatformAccessible(platformId, userPlan)) {
    return jsonError('Forbidden: platform not accessible on your plan', 403)
  }

  // ── Resolve image for vision retry ────────────────────────────────────────
  // Three cases:
  //   1. image_key is NULL in DB → retention already cleaned it up. Do text-only
  //      retry and signal the caller with imageDropped: true.
  //   2. image_key is non-null and the R2 object exists → pass to Gemini (vision retry).
  //   3. image_key is non-null but R2 object is gone → retention partial race or
  //      manual deletion. Return 410 Gone — do NOT silently fall back to text-only.
  let imagePayload: { buffer: ArrayBuffer; contentType: string } | undefined = undefined
  let imageDropped = false

  if (campaign.has_image && campaign.image_key) {
    // Case 2 or 3: image was part of the original campaign
    const object = await env.BUCKET.get(campaign.image_key)
    if (!object) {
      // Case 3: key in DB but object gone from R2
      console.error(`Retry: R2 object missing for campaign ${campaignId}, key ${campaign.image_key}`)
      return new Response(
        JSON.stringify({ error: 'Original image is no longer available (storage expired). Remove the image and try again.' }),
        { status: 410, headers: { 'Content-Type': 'application/json' } }
      )
    }
    // Case 2: object exists — build image payload for vision call
    imagePayload = {
      buffer: await object.arrayBuffer(),
      contentType: object.httpMetadata?.contentType ?? 'image/jpeg',
    }
  } else if (campaign.has_image && !campaign.image_key) {
    // Case 1: campaign had an image but retention nullified image_key in DB
    imageDropped = true
  }
  // If has_image is 0: original was text-only, proceed with no image (normal case)

  try {
    const { streamGenerate } = createStreamingClient(env)
    const language = detectLanguage(campaign.prompt)
    const systemPrompt = buildGroupSystemPrompt([platform], language)
    const userPrompt = `User's content: "${campaign.prompt}"\n\nGenerate a post for: ${platform.name}. Return only JSON.`

    const stream = await streamGenerate({ systemPrompt, userPrompt, image: imagePayload })
    let fullText = ''
    for await (const chunk of stream.textStream) fullText += chunk

    // Release buffer reference after streaming completes
    imagePayload = undefined

    const parsed = parseGroupResponse(fullText, [platformId])
    const content = parsed[platformId]
    if (!content) return jsonError('Could not generate content — please try again.', 500)

    // Update existing record if it exists, otherwise insert
    const updateResult = await env.DB.prepare(
      `UPDATE generated_posts SET content = ?, edited = 0, updated_at = unixepoch()
       WHERE campaign_id = ? AND platform_id = ? AND user_id = ?`
    ).bind(content, campaignId, platformId, userId).run()

    if (updateResult.meta.changes === 0) {
      await env.DB.prepare(
        `INSERT INTO generated_posts (id, campaign_id, user_id, platform_id, content, edited)
         VALUES (?, ?, ?, ?, ?, 0)`
      ).bind(generateId(), campaignId, userId, platformId, content).run()
    }

    return new Response(JSON.stringify({ content, platformId, imageDropped }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Retry error:', err)
    return jsonError('AI was busy — please try again in a moment.', 500)
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
