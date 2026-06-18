// ============================================================
// Generate Route — SSE streaming, 8 parallel group calls
// ============================================================

import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import { createStreamingClient, detectLanguage, buildGroupSystemPrompt, parseGroupResponse } from '../../../config/ai'
import { PLATFORM_MAP, isPlatformAccessible, TIER_LIMITS } from '../../../config/platforms'
import { generateId } from '../utils/id'
import { checkUsageLimit, incrementUsage } from '../services/usage'

const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

export async function handleGenerate(
  request: Request,
  env: Env,
  userId: string,
  userPlan: PlatformTier,
  ctx: ExecutionContext
): Promise<Response> {
  let prompt: string
  let platformIds: string[]
  let imageFile: File | null = null
  let videoFile: File | null = null

  try {
    const formData = await request.formData()
    prompt = ((formData.get('prompt') as string) ?? '').trim()
    platformIds = JSON.parse((formData.get('platforms') as string) ?? '[]')
    imageFile = formData.get('image') as File | null
    videoFile = formData.get('video') as File | null
  } catch {
    return jsonError('Invalid request body', 400)
  }

  if (!prompt || prompt.length < 3) return jsonError('Prompt is too short', 400)
  if (prompt.length > 2000) return jsonError('Prompt too long. Max 2000 characters.', 400)
  if (!Array.isArray(platformIds) || platformIds.length === 0) return jsonError('Select at least one platform', 400)
  if (videoFile && videoFile.size > MAX_VIDEO_SIZE) return jsonError('Video too large. Maximum size is 100MB.', 400)
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

  const campaignId = generateId()

  // `campaigns.original_prompt` is required by schema. For now we store the same value
  // as `prompt` (refinements can overwrite `prompt` later, while preserving original).
  await env.DB.prepare(
    `INSERT INTO campaigns (id, user_id, prompt, original_prompt, platforms, has_image, has_video, video_filename, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'generating')`
  ).bind(
    campaignId,
    userId,
    prompt,
    prompt,
    JSON.stringify(accessibleIds),
    imageFile ? 1 : 0,
    videoFile ? 1 : 0,
    videoFile?.name ?? null
  ).run()

  const language = detectLanguage(prompt)

  // Read files into memory before streaming (can't read in background)
  const imageBuffer = imageFile ? await imageFile.arrayBuffer() : null
  const videoBuffer = videoFile ? await videoFile.arrayBuffer() : null
  const videoName = videoFile?.name ?? 'your_video.mp4'

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const send = async (event: string, data: unknown) => {
    await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  }

  ctx.waitUntil((async () => {
    try {
      await send('start', { campaignId, platformCount: accessibleIds.length })

      // Mark all selected platforms as generating
      const initialPosts: Record<string, string> = {}
      for (const id of accessibleIds) initialPosts[id] = 'generating'
      await send('init', { posts: initialPosts })

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
                await send('error', { platformId: id, message: 'No content generated. Click retry.' })
              }
            }
          } catch (err) {
            console.error(`Group ${group} failed:`, err)
            for (const id of ids) {
              await send('error', { platformId: id, message: 'Generation failed. Click retry.' })
            }
          }
        })
      )

      await env.DB.prepare(
        `UPDATE campaigns SET status = 'completed', generated_count = ?, updated_at = unixepoch() WHERE id = ?`
      ).bind(accessibleIds.length, campaignId).run()

      await incrementUsage(env.DB, userId)

      // Send video reference if present (stored by worker memory, included in ZIP on download)
      await send('done', {
        campaignId,
        hasVideo: !!videoBuffer,
        videoName: videoName,
      })
    } catch (err) {
      console.error('Generate fatal error:', err)
      await send('fatal', { message: 'AI service temporarily unavailable. Your prompt is saved — try again in a moment.' })
      await env.DB.prepare(
        `UPDATE campaigns SET status = 'failed', updated_at = unixepoch() WHERE id = ?`
      ).bind(campaignId).run()
    } finally {
      await writer.close()
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
