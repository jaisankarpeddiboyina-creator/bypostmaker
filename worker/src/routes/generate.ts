// ============================================================
// Generate Route — Two-stage pipeline:
//   Stage 1: Gemini vision analysis (exactly once per request, image path only)
//   Stage 2: Groq caption writing (per platform group, parallel, text-only)
// ============================================================

import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import { createStreamingClient, detectLanguage, buildGroupSystemPrompt, parseGroupResponse, analyzeImage, buildImageContext } from '../../../config/ai'
import { PLATFORM_MAP, isPlatformAccessible, TIER_LIMITS } from '../../../config/platforms'
import { generateId } from '../utils/id'
import { reserveUsageCredit, refundUsageCredit } from '../services/usage'
import { sendEmail } from '../services/email'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'
import { getCurrentPeriod } from '../utils/period'
import { acquireGroqSlot, releaseGroqSlot, GROQ_RATE_LIMITS } from '../services/limiter'


// Sentinel: thrown when a 'fatal' SSE event has already been sent to the client
// inside the waitUntil block. The outer catch checks for this instance to avoid
// sending a duplicate fatal event that the frontend would receive twice.
class FatalAlreadySentError extends Error {
  constructor() { super('FATAL_ALREADY_SENT'); this.name = 'FatalAlreadySentError' }
}


export async function handleGenerate(
  request: Request,
  env: Env,
  userId: string,
  userPlan: PlatformTier,
  ctx: ExecutionContext
): Promise<Response> {
  let prompt: string
  let platformIds: string[]
  let imageKey: string | null = null
  let hasVideo = false
  let videoName: string | null = null
  let mockFailStage1 = false
  let mockFailStage2Group: string | null = null

  try {

    const body = await request.json() as {
      prompt?: string
      platforms?: string[]
      imageKey?: string | null
      hasVideo?: boolean
      videoName?: string | null
      mockFailStage1?: boolean
      mockFailStage2Group?: string
    }
    prompt = (body.prompt ?? '').trim()
    platformIds = body.platforms ?? []
    imageKey = body.imageKey ?? null
    hasVideo = body.hasVideo ?? false
    videoName = body.videoName ?? null
    if (env.ENVIRONMENT !== 'production') {
      mockFailStage1 = body.mockFailStage1 ?? false
      mockFailStage2Group = body.mockFailStage2Group ?? null
    }
  } catch {
    return jsonError('Invalid request body', 400)
  }

  if (!prompt || prompt.length < 3) return jsonError('Prompt is too short', 400)
  if (prompt.length > 2000) return jsonError('Prompt too long. Max 2000 characters.', 400)
  if (!Array.isArray(platformIds) || platformIds.length === 0) return jsonError('Select at least one platform', 400)
  if (!env.GROQ_API_KEY || !env.GEMINI_API_KEY) {
    return jsonError('Missing AI keys. Add GROQ_API_KEY and GEMINI_API_KEY to .dev.vars, then restart npm run dev.', 500)
  }

  const accessibleIds = platformIds.filter(id => isPlatformAccessible(id, userPlan))
  if (accessibleIds.length === 0) return jsonError('No accessible platforms for your plan', 403)

  const { periodStart } = getCurrentPeriod()
  const usageCheck = await reserveUsageCredit(env.DB, userId, userPlan)
  if (!usageCheck.allowed) {
    return jsonError(
      `You've used all ${TIER_LIMITS[userPlan].generations} generations this month. Upgrade to continue.`,
      429
    )
  }

  if (imageKey) {
    // Security: verify the key belongs to the authenticated user.
    // Keys are structured as uploads/{userId}/{id}.{ext} by the presign route.
    // Existence, size, and MIME checks are deferred to the SSE block below so
    // that a single BUCKET.get() handles all validation — no separate head() call.
    if (!imageKey.startsWith(`uploads/${userId}/`)) {
      return jsonError('Forbidden: image key does not belong to this user', 403)
    }
  }

  const campaignId = generateId()

  // `campaigns.original_prompt` is required by schema. For now we store the same value
  // as `prompt` (refinements can overwrite `prompt` later, while preserving original).
  await env.DB.prepare(
    `INSERT INTO campaigns (id, user_id, prompt, original_prompt, platforms, has_image, image_key, has_video, video_filename, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'generating')`
  ).bind(
    campaignId,
    userId,
    prompt,
    prompt,
    JSON.stringify(accessibleIds),
    imageKey ? 1 : 0,
    imageKey,
    hasVideo ? 1 : 0,
    videoName
  ).run()

  const language = detectLanguage(prompt)


  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const send = async (event: string, data: unknown) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  }

  ctx.waitUntil((async () => {
    let success = false
    try {
      await send('start', { campaignId, platformCount: accessibleIds.length })

      // Mark all selected platforms as generating
      const initialPosts: Record<string, string> = {}
      for (const id of accessibleIds) initialPosts[id] = 'generating'
      await send('init', { posts: initialPosts })

      // Fetch image from R2 if present.
      // Single BUCKET.get() handles existence, size, and MIME checks — no separate
      // head() pre-check. This removes the TOCTOU window between two R2 calls and
      // saves one round-trip on every image generation request.
      let imagePayload: { buffer: ArrayBuffer; contentType: string } | undefined = undefined
      if (imageKey) {
        const object = await env.BUCKET.get(imageKey)
        if (!object) {
          await send('fatal', { message: 'Uploaded image not found in storage. Please try again.' })
          throw new FatalAlreadySentError()
        }

        // Size check (mirrors the presign-time validation in upload.ts)
        if (object.size > MAX_IMAGE_SIZE_BYTES) {
          await env.BUCKET.delete(imageKey).catch(() => {})
          await send('fatal', { message: 'Image file size exceeds the 15MB limit.' })
          throw new FatalAlreadySentError()
        }

        // MIME re-validation — defense-in-depth against clients that bypass
        // the presign route or set wrong Content-Type on their PUT.
        const contentType = object.httpMetadata?.contentType ?? ''
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!allowedTypes.includes(contentType)) {
          await send('fatal', { message: 'Unsupported image type. Please upload a JPEG, PNG, WEBP, or GIF.' })
          throw new FatalAlreadySentError()
        }

        imagePayload = {
          buffer: await object.arrayBuffer(),
          contentType,
        }
      }

       // ── Stage 1: Vision Analysis (Gemini, exactly once) ────────────────────
      // analyzeImage() is called here — before the Promise.all — ensuring the
      // image is sent to Gemini exactly ONE time regardless of how many platforms
      // or platform groups are selected. The Promise.all below is text-only.
      let imageDescription: string | null = null
      if (imagePayload) {
        await send('vision', { message: 'Analyzing image...' })
        let result: { description: string | null; errorType: 'timeout' | 'rate_limit' | 'error' | null }
        if (env.ENVIRONMENT !== 'production' && mockFailStage1) {
          result = { description: null, errorType: 'error' }
        } else {
          result = await analyzeImage(env, imagePayload)
        }
        const { description, errorType } = result

        // Release the image buffer immediately — Stage 2 is text-only.
        // Nulling the reference makes the ArrayBuffer (up to 15MB) GC-eligible
        // before the parallel Groq calls start.
        imagePayload = undefined

        if (description === null) {
          // Stage 1 failed — choose the right user-facing message by error type
          let msg: string
          if (errorType === 'rate_limit') {
            msg = 'Image analysis is temporarily unavailable (Gemini rate limit reached). Wait 30–60 seconds and try again, or remove the image for text-only captions.'
          } else if (errorType === 'timeout') {
            msg = 'Could not analyze your image in time — Gemini may be under load. Try again in a moment, or remove the image to generate text-only captions.'
          } else {
            msg = 'Could not analyze the image. Please try again, or remove the image to generate text-only captions.'
          }
          await send('fatal', { message: msg })
          throw new FatalAlreadySentError()
        }

        imageDescription = description

        // Persist the description on the campaign so retries can reuse it
        // without making another Gemini call.
        await env.DB.prepare(
          `UPDATE campaigns SET image_description = ? WHERE id = ?`
        ).bind(imageDescription, campaignId).run()
      }

      // ── Stage 2: Caption Writing (Groq, per group, parallel) ───────────────
      // groupByGroup() restores full per-platform-group failure isolation.
      // Each group's catch block only affects that group's platforms.
      // The image was sent to Gemini above exactly once — these calls are text-only.
      const grouped = groupByGroup(accessibleIds)
      const { streamGenerate } = createStreamingClient(env)

      // Run all groups in parallel — stream results as each finishes
      await Promise.all(
        Object.entries(grouped).map(async ([group, ids]) => {
          const platforms = ids.map(id => PLATFORM_MAP[id]).filter(Boolean) as typeof PLATFORM_MAP[string][]
          const systemPrompt = buildGroupSystemPrompt(platforms, language)

          // Inject the Stage 1 image description into the user prompt using shared helper.
          const imageContext = buildImageContext(imageDescription)
          const userPrompt = `User's content: "${prompt}"${imageContext}\n\nGenerate posts for: ${platforms.map(p => p.name).join(', ')}. Return only JSON.`

          const estimatedTokens = imageDescription
            ? GROQ_RATE_LIMITS.ESTIMATED_TOKENS_IMAGE
            : GROQ_RATE_LIMITS.ESTIMATED_TOKENS_TEXT

          const waitMs = await acquireGroqSlot(env, estimatedTokens)
          if (waitMs > 0) {
            console.log(`[generate] Group ${group} queued for ${waitMs}ms by global rate limiter`)
          }

          try {
            // STAGE2_MOCK_FAIL_GROUP: test-only failure simulation.
            // Hard-gated: only honoured in development/staging environments.
            if (env.ENVIRONMENT !== 'production' && (env.STAGE2_MOCK_FAIL_GROUP === group || mockFailStage2Group === group)) {
              console.log(`[generate] STAGE2_MOCK_FAIL_GROUP="${group}" active — simulating failure (test mode)`)
              throw new Error('Simulated Stage 2 group failure (STAGE2_MOCK_FAIL_GROUP)')
            }

            // No `image` param — Stage 2 is text-only. useGroq defaults to true,
            // which routes to Groq since no image is present (ai.ts line: useGroq && !image).
            const stream = await streamGenerate({ systemPrompt, userPrompt })
            let fullText = ''
            for await (const chunk of stream.textStream) {
              fullText += chunk
            }

            const parsed = parseGroupResponse(fullText, ids)

            for (const [platformId, content] of Object.entries(parsed)) {
              await send('platform', { platformId, content, group })
              await env.DB.prepare(
                `INSERT OR REPLACE INTO generated_posts (id, campaign_id, user_id, platform_id, content, edited)
                 VALUES (?, ?, ?, ?, ?, 0)`
              ).bind(generateId(), campaignId, userId, platformId, content).run()
            }

            // Any platforms in this group that got no content → error
            for (const id of ids) {
              if (!parsed[id]) {
                await send('error', { platformId: id, message: 'This one slipped through — tap retry to generate it!' })
              }
            }
          } catch (err) {
            console.error(`[generate] Group ${group} failed:`, err)
            // Only this group's platforms receive an error — other groups are unaffected.
            for (const id of ids) {
              await send('error', { platformId: id, message: 'AI was momentarily busy — tap retry!' })
            }
          } finally {
            await releaseGroqSlot(env)
          }
        })
      )

      await env.DB.prepare(
        `UPDATE campaigns SET status = 'completed', generated_count = ?, updated_at = unixepoch() WHERE id = ?`
      ).bind(accessibleIds.length, campaignId).run()

      // Credit was reserved up front
      const newUsed = usageCheck.used

      if (userPlan !== 'business') {
        const limit = TIER_LIMITS[userPlan].generations
        if (newUsed === Math.floor(limit * 0.8) || newUsed === limit) {
          const user = await env.DB.prepare(
            'SELECT email, name FROM users WHERE id = ?'
          ).bind(userId).first<{ email: string; name: string }>()
          if (user) {
            if (newUsed === Math.floor(limit * 0.8)) {
              await sendEmail(env, 'usage_80', user.email, user.name, { used: newUsed, limit })
            } else if (newUsed === limit) {
              await sendEmail(env, 'usage_100', user.email, user.name, { limit })
            }
          }
        }
      }

      await send('done', {
        campaignId,
        hasVideo,
        videoName: videoName ?? 'your_video.mp4',
      })
      success = true
    } catch (err) {
      console.error('Generate fatal error:', err)
      try {
        await refundUsageCredit(env.DB, userId, periodStart)
      } catch (refundErr) {
        console.error('Failed to refund usage credit:', refundErr)
      }
      if (!(err instanceof FatalAlreadySentError)) {
        await send('fatal', { message: 'AI service temporarily unavailable. Your prompt is saved — try again in a moment.' })
      }
      await env.DB.prepare(
        `UPDATE campaigns SET status = 'failed', updated_at = unixepoch() WHERE id = ?`
      ).bind(campaignId).run()
    } finally {
      if (imageKey && !success) {
        await env.BUCKET.delete(imageKey).catch(err => {
          console.error('Failed to delete R2 object:', err)
        })
      }
      try {
        await writer.close()
      } catch (err) {
        console.error('Failed to close SSE writer:', err)
      }
    }
  })())

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

function groupByGroup(platformIds: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {}
  for (const id of platformIds) {
    const platform = PLATFORM_MAP[id]
    if (!platform) continue
    if (!groups[platform.group]) groups[platform.group] = []
    groups[platform.group].push(id)
  }
  return groups
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
