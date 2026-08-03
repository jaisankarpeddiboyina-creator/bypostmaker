// ============================================================
// Generate Route — Two-stage pipeline:
//   Stage 1: Gemini vision analysis (exactly once per request, image path only)
//   Stage 2: Groq caption writing (per platform group, parallel, text-only)
// ============================================================

import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import {
  createStreamingClient,
  detectLanguage,
  buildGroupSystemPrompt,
  parseGroupResponse,
  analyzeImage,
  buildImageContext,
  getModelCapabilities,
  getLanguageTokenMultiplier,
} from '../../../config/ai'
import { PLATFORM_MAP, PLATFORM_BATCH_MAP, isPlatformAccessible, TIER_LIMITS } from '../../../config/platforms'
import { generateId } from '../utils/id'
import { reserveUsageCredit, refundUsageCredit } from '../services/usage'
import { sendEmail } from '../services/email'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'
import { getCurrentPeriod } from '../utils/period'
import { acquireGroqSlot, releaseGroqSlot } from '../services/limiter'


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
  let imageKeys: string[] = []
  let hasVideo = false
  let videoName: string | null = null
  let useBrandKit = false
  let mockFailStage1 = false
  let mockFailStage2Group: string | null = null

  try {
    const body = await request.json() as {
      prompt?: string
      platforms?: string[]
      imageKey?: string | null
      imageKeys?: string[]
      hasVideo?: boolean
      videoName?: string | null
      useBrandKit?: boolean
      mockFailStage1?: boolean
      mockFailStage2Group?: string
    }
    prompt = (body.prompt ?? '').trim()
    platformIds = body.platforms ?? []
    if (Array.isArray(body.imageKeys) && body.imageKeys.length > 0) {
      imageKeys = body.imageKeys.filter(k => typeof k === 'string' && k.length > 0)
    } else if (body.imageKey) {
      imageKeys = [body.imageKey]
    }
    hasVideo = body.hasVideo ?? false
    videoName = body.videoName ?? null
    useBrandKit = body.useBrandKit ?? false
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
  if (imageKeys.length > 4) return jsonError('Maximum 4 images allowed per campaign', 400)

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

  for (const key of imageKeys) {
    if (!key.startsWith(`uploads/${userId}/`)) {
      return jsonError('Forbidden: image key does not belong to this user', 403)
    }
  }

  const campaignId = generateId()
  const primaryImageKey = imageKeys.length > 0 ? imageKeys[0] : null

  await env.DB.prepare(
    `INSERT INTO campaigns (id, user_id, prompt, original_prompt, platforms, has_image, image_key, has_video, video_filename, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'generating')`
  ).bind(
    campaignId,
    userId,
    prompt,
    prompt,
    JSON.stringify(accessibleIds),
    imageKeys.length > 0 ? 1 : 0,
    primaryImageKey,
    hasVideo ? 1 : 0,
    videoName
  ).run()

  // Write multi-image records to campaign_images child table
  for (let i = 0; i < imageKeys.length; i++) {
    await env.DB.prepare(
      `INSERT INTO campaign_images (id, campaign_id, user_id, image_key, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(generateId(), campaignId, userId, imageKeys[i], i).run()
  }

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

      const initialPosts: Record<string, string> = {}
      for (const id of accessibleIds) initialPosts[id] = 'generating'
      await send('init', { posts: initialPosts })

      let imagePayloads: Array<{ buffer: ArrayBuffer; contentType: string }> | undefined = undefined
      if (imageKeys.length > 0) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        let totalSize = 0

        // Phase 1: Fetch all R2 object metadata in parallel (no sequential await-in-loop)
        const objects = await Promise.all(imageKeys.map(key => env.BUCKET.get(key)))

        // Phase 2: Validate sequentially — preserves per-image fatal event semantics
        // (first failing image sends the fatal event and throws, same as before)
        for (let i = 0; i < objects.length; i++) {
          const object = objects[i]
          if (!object) {
            await send('fatal', { message: 'Uploaded image not found in storage. Please try again.' })
            throw new FatalAlreadySentError()
          }
          if (object.size > MAX_IMAGE_SIZE_BYTES) {
            await send('fatal', { message: 'Individual image file size exceeds the 15MB limit.' })
            throw new FatalAlreadySentError()
          }
          totalSize += object.size
          const contentType = object.httpMetadata?.contentType ?? ''
          if (!allowedTypes.includes(contentType)) {
            await send('fatal', { message: 'Unsupported image type. Please upload JPEG, PNG, WEBP, or GIF.' })
            throw new FatalAlreadySentError()
          }
        }

        if (totalSize > 30 * 1024 * 1024) {
          await send('fatal', { message: 'Total combined image size exceeds the 30MB limit.' })
          throw new FatalAlreadySentError()
        }

        // Phase 3: Read all buffers in parallel
        imagePayloads = await Promise.all(
          objects.map(async (obj) => ({
            buffer: await obj!.arrayBuffer(),
            contentType: obj!.httpMetadata?.contentType ?? '',
          }))
        )
      }

      // ── Stage 1: Vision Analysis (Gemini, single call) ────────────────────
      let imageDescription: string | null = null
      if (imagePayloads && imagePayloads.length > 0) {
        await send('vision', { message: `Analyzing ${imagePayloads.length} ${imagePayloads.length === 1 ? 'image' : 'images'}...` })
        let result: { description: string | null; errorType: 'timeout' | 'rate_limit' | 'error' | null }
        if (env.ENVIRONMENT !== 'production' && mockFailStage1) {
          result = { description: null, errorType: 'error' }
        } else {
          result = await analyzeImage(env, imagePayloads)
        }
        const { description, errorType } = result

        // Immediately release image buffers for GC before parallel Groq calls start
        imagePayloads = undefined

        if (description === null) {
          let msg: string
          if (errorType === 'rate_limit') {
            msg = 'Image analysis is temporarily unavailable (Gemini rate limit reached). Wait 30–60 seconds and try again, or remove images for text-only captions.'
          } else if (errorType === 'timeout') {
            msg = 'Could not analyze your images in time — Gemini may be under load. Try again in a moment, or remove images to generate text-only captions.'
          } else {
            msg = 'Could not analyze the images. Please try again, or remove images to generate text-only captions.'
          }
          await send('fatal', { message: msg })
          throw new FatalAlreadySentError()
        }

        imageDescription = description

        await env.DB.prepare(
          `UPDATE campaigns SET image_description = ? WHERE id = ?`
        ).bind(imageDescription, campaignId).run()
      }

      // ── Stage 2: Caption Writing (Groq, per group, parallel) ───────────────
      // Fetch Brand Kit rules from D1 if user toggled useBrandKit
      let brandKitContext = ''
      if (useBrandKit) {
        try {
          const brandRow = await env.DB.prepare(
            `SELECT name, voice, products_services, target_audience, competitors, brand_guidelines
             FROM brand_kits WHERE user_id = ?`
          ).bind(userId).first<any>()

          if (brandRow) {
            let voiceObj: any = null
            if (brandRow.voice) {
              try {
                voiceObj = typeof brandRow.voice === 'string' ? JSON.parse(brandRow.voice) : brandRow.voice
              } catch {}
            }
            const rules: string[] = []
            if (brandRow.name) rules.push(`- Brand Name: ${brandRow.name}`)
            if (voiceObj?.tone) rules.push(`- Tone of Voice: ${voiceObj.tone}`)
            if (voiceObj?.dos) rules.push(`- Tone Do's: ${voiceObj.dos}`)
            if (voiceObj?.donts) rules.push(`- Tone Don'ts: ${voiceObj.donts}`)
            if (brandRow.target_audience) rules.push(`- Target Audience: ${brandRow.target_audience}`)
            if (brandRow.products_services) rules.push(`- Products / Services: ${brandRow.products_services}`)
            if (brandRow.competitors) rules.push(`- Competitors / Positioning: ${brandRow.competitors}`)
            if (brandRow.brand_guidelines) {
              if (brandRow.brand_guidelines.length > 1500) {
                console.warn(`[generate] Brand Kit guidelines truncated from ${brandRow.brand_guidelines.length} to 1500 chars for user ${userId}`)
              }
              rules.push(`- Brand Guidelines: ${brandRow.brand_guidelines.slice(0, 1500)}`)
            }

            if (rules.length > 0) {
              brandKitContext = `\n\n[BRAND KIT & IDENTITY RULES]:\n${rules.join('\n')}\n(Ensure all generated posts strictly adhere to this brand identity, voice, and guidelines).`
            }
          }
        } catch (brandErr) {
          console.error('[generate] Failed to fetch brand kit rules:', brandErr)
        }
      }

      // ── Stage 2: Caption Writing (Per Batch / Chunk, Parallel) ───────────
      const caps = getModelCapabilities(env)
      const langMultiplier = getLanguageTokenMultiplier(language)
      const batches = groupAndChunkPlatforms(accessibleIds, caps)
      const { streamGenerate } = createStreamingClient(env)

      // Run all batch chunks in parallel — stream results as each finishes
      await Promise.all(
        batches.map(async (batch) => {
          const ids = batch.platforms
          const platforms = ids.map(id => PLATFORM_MAP[id]).filter(Boolean) as typeof PLATFORM_MAP[string][]
          const systemPrompt = buildGroupSystemPrompt(platforms, language)

          // Inject Stage 1 image description & Brand Kit context into user prompt
          const imageContext = buildImageContext(imageDescription)
          const userPrompt = `User's content: "${prompt}"${imageContext}${brandKitContext}\n\nGenerate posts for: ${platforms.map(p => p.name).join(', ')}. Return only JSON.`

          // 1. Output token calculation: min(caps.maxOutputTokens - 256, max(512, rawTokens))
          const rawOutputTokens = Math.ceil(ids.length * caps.avgTokensPerPlatform * langMultiplier)
          const outputTokenLimit = Math.min(
            caps.maxOutputTokens - 256,
            Math.max(512, rawOutputTokens)
          )

          // 2. Script-aware input token estimation: charsPerTokenInput = 3.5 / langMultiplier
          const charsPerTokenInput = 3.5 / langMultiplier
          const exactInputTokens = Math.ceil(
            (systemPrompt.length + userPrompt.length + (imageDescription?.length ?? 0)) / charsPerTokenInput
          )

          // 3. Total estimated tokens reserved in global rate limiter
          const totalEstimatedTokens = exactInputTokens + outputTokenLimit

          const waitMs = await acquireGroqSlot(env, totalEstimatedTokens)
          if (waitMs > 0) {
            console.log(`[generate] Batch ${batch.id} queued for ${waitMs}ms by rate limiter`)
          }

          try {
            // STAGE2_MOCK_FAIL_GROUP: test-only failure simulation
            if (env.ENVIRONMENT !== 'production' && (env.STAGE2_MOCK_FAIL_GROUP === batch.groupName || mockFailStage2Group === batch.groupName)) {
              console.log(`[generate] STAGE2_MOCK_FAIL_GROUP="${batch.groupName}" active — simulating failure (test mode)`)
              throw new Error('Simulated Stage 2 group failure (STAGE2_MOCK_FAIL_GROUP)')
            }

            const stream = await streamGenerate({ systemPrompt, userPrompt, maxTokens: outputTokenLimit })
            let fullText = ''
            for await (const chunk of stream.textStream) {
              fullText += chunk
            }

            // 2-Stage Fail-Soft JSON Extractor
            const parsed = parseGroupResponse(fullText, ids)

            for (const [platformId, content] of Object.entries(parsed)) {
              const platformObj = PLATFORM_MAP[platformId]
              const displayGroup = platformObj?.group ?? batch.groupName
              await send('platform', { platformId, content, group: displayGroup })
              await env.DB.prepare(
                `INSERT OR REPLACE INTO generated_posts (id, campaign_id, user_id, platform_id, content, edited)
                 VALUES (?, ?, ?, ?, ?, 0)`
              ).bind(generateId(), campaignId, userId, platformId, content).run()
            }

            // Any platforms in this batch that failed BOTH JSON.parse and fail-soft regex extractor get explicit error event
            for (const id of ids) {
              if (!parsed[id]) {
                await send('error', { platformId: id, message: 'This platform needs a quick refresh — tap retry to generate it!' })
              }
            }
          } catch (err) {
            console.error(`[generate] Batch ${batch.id} failed:`, err)
            // Only this batch's platforms receive an error — other batches are unaffected.
            for (const id of ids) {
              await send('error', { platformId: id, message: 'This platform needs a quick refresh — tap retry to generate it!' })
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
      if (imageKeys.length > 0 && !success) {
        for (const key of imageKeys) {
          await env.BUCKET.delete(key).catch(err => {
            console.error('Failed to delete R2 object:', key, err)
          })
        }
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

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

export function groupAndChunkPlatforms(
  platformIds: string[],
  caps: ReturnType<typeof getModelCapabilities>
): Array<{ id: string; groupName: string; platforms: string[] }> {
  const baseGroups: Record<string, string[]> = {}
  for (const id of platformIds) {
    const platform = PLATFORM_MAP[id]
    if (!platform) continue
    const batchKey = PLATFORM_BATCH_MAP[id] ?? 'social'
    if (!baseGroups[batchKey]) baseGroups[batchKey] = []
    baseGroups[batchKey].push(id)
  }

  const finalBatches: Array<{ id: string; groupName: string; platforms: string[] }> = []
  let counter = 1

  for (const [groupName, ids] of Object.entries(baseGroups)) {
    const chunks = chunkArray(ids, caps.maxPlatformsPerBatch)
    for (const chunk of chunks) {
      finalBatches.push({
        id: `${groupName}_${counter++}`,
        groupName,
        platforms: chunk,
      })
    }
  }

  return finalBatches
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
