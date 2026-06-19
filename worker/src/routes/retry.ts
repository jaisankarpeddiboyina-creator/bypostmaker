import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import { createStreamingClient, detectLanguage, buildGroupSystemPrompt, parseGroupResponse } from '../../../config/ai'
import { PLATFORM_MAP } from '../../../config/platforms'
import { generateId } from '../utils/id'

export async function handleRetry(
  request: Request,
  env: Env,
  userId: string,
  _userPlan: PlatformTier
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

  // Verify campaign belongs to this user and fetch the original prompt
  const campaign = await env.DB.prepare(
    'SELECT id, prompt FROM campaigns WHERE id = ? AND user_id = ?'
  ).bind(campaignId, userId).first<{ id: string; prompt: string }>()
  if (!campaign) return jsonError('Campaign not found', 404)

  const platform = PLATFORM_MAP[platformId]
  if (!platform) return jsonError('Unknown platform', 400)

  try {
    const { streamGenerate } = createStreamingClient(env)
    const language = detectLanguage(campaign.prompt)
    const systemPrompt = buildGroupSystemPrompt([platform], language)
    const userPrompt = `User's content: "${campaign.prompt}"\n\nGenerate a post for: ${platform.name}. Return only JSON.`

    const stream = await streamGenerate({ systemPrompt, userPrompt })
    let fullText = ''
    for await (const chunk of stream.textStream) fullText += chunk

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

    return new Response(JSON.stringify({ content, platformId }), {
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
