import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import {
  createStreamingClient,
  detectLanguage,
  buildGroupSystemPrompt,
  parseGroupResponse,
  buildImageContext,
  analyzeImage,
} from '../../../config/ai'
import {
  PLATFORM_MAP,
  isPlatformAccessible,
  TIER_LIMITS,
} from '../../../config/platforms'
import { generateId } from '../utils/id'
import {
  refundUsageCredit,
  reserveUsageCredit,
} from '../services/usage'
import { getCurrentPeriod } from '../utils/period'
import { acquireGroqSlot, releaseGroqSlot, GROQ_RATE_LIMITS } from '../services/limiter'

export async function handleRetry(
  request: Request,
  env: Env,
  userId: string,
  userPlan: PlatformTier,
  ctx: ExecutionContext
): Promise<Response> {
  let body: {
    campaignId: string
    platformId: string
  }

  try {
    body = (await request.json()) as {
      campaignId: string
      platformId: string
    }
  } catch {
    return jsonError('Invalid request body', 400)
  }

  const { campaignId, platformId } = body

  if (!campaignId || !platformId) {
    return jsonError('Missing required fields', 400)
  }

  if (!env.GROQ_API_KEY || !env.GEMINI_API_KEY) {
    return jsonError('Missing AI keys', 500)
  }

  const campaign = await env.DB.prepare(
    `SELECT id, prompt, status, platforms, image_description, image_key
     FROM campaigns
     WHERE id = ? AND user_id = ?`
  )
    .bind(campaignId, userId)
    .first<{
      id: string
      prompt: string
      status: string
      platforms: string
      image_description: string | null
      image_key: string | null
    }>()

  if (!campaign) {
    return jsonError('Campaign not found', 404)
  }

  let campaignPlatforms: string[]

  try {
    campaignPlatforms = JSON.parse(campaign.platforms)
  } catch {
    return jsonError('Invalid campaign data', 500)
  }

  if (!campaignPlatforms.includes(platformId)) {
    return jsonError('Platform not part of this campaign', 400)
  }

  const platform = PLATFORM_MAP[platformId]

  if (!platform) {
    return jsonError('Unknown platform', 400)
  }

  if (!isPlatformAccessible(platformId, userPlan)) {
    return jsonError('Forbidden: platform not accessible on your plan', 403)
  }

  if (campaign.status !== 'failed' && campaign.status !== 'completed') {
    return jsonError('Campaign is not ready for retry', 409)
  }

  let imageDescription = campaign.image_description

  if (!imageDescription || imageDescription === 'null') {
    imageDescription = null
    const imgRows = await env.DB.prepare(
      `SELECT image_key FROM campaign_images WHERE campaign_id = ? ORDER BY sort_order ASC`
    ).bind(campaignId).all<{ image_key: string }>()

    let keys: string[] = []
    if (imgRows.results && imgRows.results.length > 0) {
      keys = imgRows.results.map(r => r.image_key)
    } else if (campaign.image_key) {
      keys = [campaign.image_key]
    }

    if (keys.length > 0) {
      // Phase 1: Fetch all R2 objects in parallel
      const objs = await Promise.all(keys.map(k => env.BUCKET.get(k)))
      const payloads: Array<{ buffer: ArrayBuffer; contentType: string }> = []

      // Phase 2: Read buffers in parallel (only for objects that exist)
      const validObjs = objs.filter((o): o is NonNullable<typeof o> => o !== null)
      if (validObjs.length > 0) {
        const buffers = await Promise.all(
          validObjs.map(async (obj) => ({
            buffer: await obj.arrayBuffer(),
            contentType: obj.httpMetadata?.contentType ?? 'image/jpeg',
          }))
        )
        payloads.push(...buffers)
      }

      if (payloads.length > 0) {
        const visionResult = await analyzeImage(env, payloads)
        if (visionResult.description) {
          imageDescription = visionResult.description
          await env.DB.prepare(
            `UPDATE campaigns SET image_description = ? WHERE id = ?`
          ).bind(imageDescription, campaignId).run()
        }
      }
    }
  }

  const shouldChargeForRetry =
    campaign.status === 'failed' && imageDescription === null

  let reserved = false

  try {
    if (shouldChargeForRetry) {
      const reservation = await reserveUsageCredit(env.DB, userId, userPlan)

      if (!reservation.allowed) {
        return jsonError(
          `You've used all ${TIER_LIMITS[userPlan].generations} generations this month. Upgrade to continue.`,
          429
        )
      }

      reserved = true
    }

    const { streamGenerate } = createStreamingClient(env)
    const language = detectLanguage(campaign.prompt)
    const systemPrompt = buildGroupSystemPrompt([platform], language)

    const imageContext = buildImageContext(imageDescription)
    const userPrompt = `User's content: "${campaign.prompt}"${imageContext}\n\nGenerate a post for: ${platform.name}.\nReturn only JSON.`

    const estimatedTokens = imageDescription
      ? GROQ_RATE_LIMITS.ESTIMATED_TOKENS_IMAGE
      : GROQ_RATE_LIMITS.ESTIMATED_TOKENS_TEXT

    // Global Groq Rate Limiter acquisition (Fix 1)
    const waitMs = await acquireGroqSlot(env, estimatedTokens)
    if (waitMs > 0) {
      console.log(`[retry] Platform ${platformId} queued for ${waitMs}ms by global rate limiter`)
    }

    let fullText = ''
    try {
      const stream = await streamGenerate({ systemPrompt, userPrompt })
      for await (const chunk of stream.textStream) {
        fullText += chunk
      }
    } finally {
      await releaseGroqSlot(env)
    }

    const parsed = parseGroupResponse(fullText, [platformId])
    const content = parsed[platformId]

    if (!content) {
      throw new Error('Could not generate content')
    }

    const updateResult = await env.DB.prepare(
      `UPDATE generated_posts
       SET content = ?,
           edited = 0,
           updated_at = unixepoch()
       WHERE campaign_id = ?
       AND platform_id = ?
       AND user_id = ?`
    )
      .bind(content, campaignId, platformId, userId)
      .run()

    if (updateResult.meta.changes === 0) {
      await env.DB.prepare(
        `INSERT INTO generated_posts
        (id, campaign_id, user_id, platform_id, content, edited)
        VALUES (?, ?, ?, ?, ?, 0)`
      )
        .bind(generateId(), campaignId, userId, platformId, content)
        .run()
    }

    // Return the content immediately — don't block the response on the
    // housekeeping campaign status update. Defer it to waitUntil() so the
    // Worker's request lifecycle ends as soon as the client has its data.
    const response = new Response(
      JSON.stringify({ content, platformId }),
      { headers: { 'Content-Type': 'application/json' } }
    )

    ctx.waitUntil(
      env.DB.prepare(
        `UPDATE campaigns
         SET status = 'completed',
             generated_count = (
               SELECT COUNT(*)
               FROM generated_posts
               WHERE campaign_id = ?
             ),
             updated_at = unixepoch()
         WHERE id = ?`
      )
        .bind(campaignId, campaignId)
        .run()
        .catch(err => console.error('[retry] Campaign status update failed:', err))
    )

    return response
  } catch (err) {
    if (reserved) {
      const { periodStart } = getCurrentPeriod()

      await refundUsageCredit(env.DB, userId, periodStart).catch((error) => {
        console.error('Refund retry credit error:', error)
      })
    }

    console.error('Retry error:', err)

    if (err instanceof Error && err.message === 'Could not generate content') {
      return jsonError('Could not generate content — please try again.', 500)
    }

    return jsonError('AI was busy — please try again in a moment.', 500)
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      error: message,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}