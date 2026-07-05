// ============================================================
// Generate Route — SSE streaming, 8 parallel group calls
// ============================================================

import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import { createStreamingClient, detectLanguage, buildGroupSystemPrompt, parseGroupResponse } from '../../../config/ai'
import { PLATFORM_MAP, isPlatformAccessible, TIER_LIMITS } from '../../../config/platforms'
import { generateId } from '../utils/id'
import { checkUsageLimit, incrementUsage } from '../services/usage'
import { sendEmail } from '../services/email'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'


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

  try {
    const body = await request.json() as {
      prompt?: string
      platforms?: string[]
      imageKey?: string | null
      hasVideo?: boolean
      videoName?: string | null
    }
    prompt = (body.prompt ?? '').trim()
    platformIds = body.platforms ?? []
    imageKey = body.imageKey ?? null
    hasVideo = body.hasVideo ?? false
    videoName = body.videoName ?? null
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

  const usageCheck = await checkUsageLimit(env.DB, userId, userPlan)
  if (!usageCheck.allowed) {
    return jsonError(
      `You've used all ${TIER_LIMITS[userPlan].generations} generations this month. Upgrade to continue.`,
      429
    )
  }

  if (imageKey) {
    // Security: verify the key belongs to the authenticated user.
    // Keys are structured as uploads/{userId}/{id}.{ext} by the presign route.
    if (!imageKey.startsWith(`uploads/${userId}/`)) {
      return jsonError('Forbidden: image key does not belong to this user', 403)
    }
    const imageMeta = await env.BUCKET.head(imageKey)
    if (!imageMeta) return jsonError('Uploaded image not found', 404)
    if (imageMeta.size > MAX_IMAGE_SIZE_BYTES) {
      ctx.waitUntil(env.BUCKET.delete(imageKey).catch(() => {}))
      return jsonError('Image file size exceeds the 15MB limit.', 400)
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

      // Fetch image from R2 if present
      let imagePayload: { buffer: ArrayBuffer; contentType: string } | undefined = undefined
      if (imageKey) {
        const object = await env.BUCKET.get(imageKey)
        if (!object) {
          await send('fatal', { message: 'Uploaded image not found in storage. Please try again.' })
          throw new FatalAlreadySentError()
        }
        imagePayload = {
          buffer: await object.arrayBuffer(),
          contentType: object.httpMetadata?.contentType ?? 'image/jpeg'
        }
      }

      // Group platforms
      const grouped = groupByGroup(accessibleIds)
      const { streamGenerate } = createStreamingClient(env)

      // Run all groups in parallel — stream results as each finishes
      await Promise.all(
        Object.entries(grouped).map(async ([group, ids]) => {
          const platforms = ids.map(id => PLATFORM_MAP[id]).filter(Boolean) as typeof PLATFORM_MAP[string][]
          const systemPrompt = buildGroupSystemPrompt(platforms, language)
          const userPrompt = `User's content: "${prompt}"\n\nGenerate posts for: ${platforms.map(p => p.name).join(', ')}. Return only JSON.`

          try {
            const stream = await streamGenerate({ systemPrompt, userPrompt, useGroq: true, image: imagePayload })
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
            console.error(`Group ${group} failed:`, err)
            const message = imagePayload
              ? 'Vision analysis failed — try without image'
              : 'AI was momentarily busy handling all platforms at once — tap retry!'
            for (const id of ids) {
              await send('error', { platformId: id, message })
            }
          }
        })
      )

      await env.DB.prepare(
        `UPDATE campaigns SET status = 'completed', generated_count = ?, updated_at = unixepoch() WHERE id = ?`
      ).bind(accessibleIds.length, campaignId).run()

      const newUsed = await incrementUsage(env.DB, userId)

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
