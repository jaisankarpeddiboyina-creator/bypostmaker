import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import { createStreamingClient, detectLanguage, buildGroupSystemPrompt, parseGroupResponse, analyzeImage, buildImageContext } from '../../../config/ai'
import { PLATFORM_MAP, isPlatformAccessible } from '../../../config/platforms'
import { generateId } from '../utils/id'
import { acquireGroqSlot, releaseGroqSlot, GROQ_RATE_LIMITS } from '../services/limiter'

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

  // Verify campaign belongs to this user and fetch prompt + image metadata.
  // image_key, has_image, and image_description are all needed to reconstruct
  // the original vision context without making a redundant Gemini call.
  const campaign = await env.DB.prepare(
    'SELECT id, prompt, image_key, has_image, image_description FROM campaigns WHERE id = ? AND user_id = ?'
  ).bind(campaignId, userId).first<{
    id: string
    prompt: string
    image_key: string | null
    has_image: number
    image_description: string | null
  }>()
  if (!campaign) return jsonError('Campaign not found', 404)

  const platform = PLATFORM_MAP[platformId]
  if (!platform) return jsonError('Unknown platform', 400)

  if (!isPlatformAccessible(platformId, userPlan)) {
    return jsonError('Forbidden: platform not accessible on your plan', 403)
  }

  // ── Resolve image context for vision retry ─────────────────────────────────
  //
  // Four-case resolution (in priority order):
  //
  //   Case A: image_description is cached in DB (non-null)
  //           → Use it directly. Zero Gemini calls. (Happy path for all retries
  //             after the first successful generation.)
  //
  //   Case B: image_description is null AND has_image=1 AND R2 object exists
  //           → Re-run Stage 1 (analyzeImage). This covers old campaigns created
  //             before this migration, where image_description was never stored.
  //             Cache the result so future retries use Case A.
  //
  //   Case C: image_description is null AND has_image=1 AND image_key is null in DB
  //           → Retention cron has already cleaned up this image. Proceed text-only
  //             and signal the caller with imageDropped: true.
  //
  //   Case D: image_description is null AND has_image=1 AND image_key non-null but
  //           R2 object is gone (retention race or manual deletion)
  //           → Return 410 Gone. Do NOT silently fall back to text-only.
  //
  //   Case E: has_image=0 → text-only campaign, proceed normally (no image context).

  let imageDescriptionForRetry: string | null = campaign.image_description ?? null
  let imagePayload: { buffer: ArrayBuffer; contentType: string } | undefined = undefined
  let imageDropped = false

  if (!imageDescriptionForRetry && campaign.has_image) {
    if (!campaign.image_key) {
      // Case C: retention nulled the key
      imageDropped = true
    } else {
      // Case B or D: key exists in DB — check R2
      const object = await env.BUCKET.get(campaign.image_key)
      if (!object) {
        // Case D: key in DB but R2 object gone
        console.error(`Retry: R2 object missing for campaign ${campaignId}, key ${campaign.image_key}`)
        return new Response(
          JSON.stringify({ error: 'Original image is no longer available (storage expired). Remove the image and try again.' }),
          { status: 410, headers: { 'Content-Type': 'application/json' } }
        )
      }
      // Case B: object exists — re-run Stage 1
      imagePayload = {
        buffer: await object.arrayBuffer(),
        contentType: object.httpMetadata?.contentType ?? 'image/jpeg',
      }

      const { description } = await analyzeImage(env, imagePayload)
      imagePayload = undefined // release buffer

      if (description) {
        imageDescriptionForRetry = description
        // Cache for future retries (Case A path)
        await env.DB.prepare(
          'UPDATE campaigns SET image_description = ? WHERE id = ?'
        ).bind(imageDescriptionForRetry, campaignId).run()
      }
      // If Stage 1 fails here, imageDescriptionForRetry stays null.
      // Retry proceeds without image context — partial but still useful
      // (better than a hard failure on retry).
    }
  }
  // Case E (has_image=0): imageDescriptionForRetry remains null, no image lookup needed.

  try {
    const { streamGenerate } = createStreamingClient(env)
    const language = detectLanguage(campaign.prompt)
    const systemPrompt = buildGroupSystemPrompt([platform], language)

    // Inject image description context if available using shared helper.
    const imageContext = buildImageContext(imageDescriptionForRetry)
    const userPrompt = `User's content: "${campaign.prompt}"${imageContext}\n\nGenerate a post for: ${platform.name}. Return only JSON.`

    const estimatedTokens = imageDescriptionForRetry
      ? GROQ_RATE_LIMITS.ESTIMATED_TOKENS_IMAGE
      : GROQ_RATE_LIMITS.ESTIMATED_TOKENS_TEXT

    const waitMs = await acquireGroqSlot(env, estimatedTokens)
    if (waitMs > 0) {
      console.log(`[retry] Platform ${platformId} queued for ${waitMs}ms by global rate limiter`)
    }

    let fullText = ''
    try {
      // Text-only call — no image param. Stage 1 description is in the user prompt.
      const stream = await streamGenerate({ systemPrompt, userPrompt })
      for await (const chunk of stream.textStream) fullText += chunk
    } finally {
      await releaseGroqSlot(env)
    }

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
