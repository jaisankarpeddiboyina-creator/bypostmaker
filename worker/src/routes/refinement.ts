import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import { createAIClient } from '../../../config/ai'
import { PLATFORM_MAP } from '../../../config/platforms'

interface RefineRequest {
  campaignId: string
  platformId: string
  message: string
  currentContent: string
}

export async function handleRefinement(
  request: Request,
  env: Env,
  userId: string,
  _userPlan: PlatformTier
): Promise<Response> {
  let body: RefineRequest
  try {
    body = await request.json() as RefineRequest
  } catch {
    return jsonError('Invalid request body', 400)
  }

  const { campaignId, platformId, message, currentContent } = body
  if (!campaignId || !platformId || !message?.trim()) {
    return jsonError('Missing required fields', 400)
  }
  if (!env.GROQ_API_KEY || !env.GEMINI_API_KEY) {
    return jsonError('Missing AI keys. Add GROQ_API_KEY and GEMINI_API_KEY to .dev.vars, then restart npm run dev.', 500)
  }

  const campaign = await env.DB.prepare(
    'SELECT id FROM campaigns WHERE id = ? AND user_id = ?'
  ).bind(campaignId, userId).first()
  if (!campaign) return jsonError('Campaign not found', 404)

  const platform = PLATFORM_MAP[platformId]
  if (!platform) return jsonError('Unknown platform', 400)

  try {
    const ai = createAIClient(env)

    // Use per-platform session for refinement history
    // Session id = campaignId:platformId ensures isolation between platforms
    const session = ai.createSession(`${campaignId}:${platformId}`, 20)

    // On first turn, inject platform context + current content into the prompt
    // so AI has full context. Subsequent turns use session history automatically.
    const isFirstTurn = session.turns === 0
    const fullPrompt = isFirstTurn
      ? `[Context: You are refining a ${platform.name} post. Tone: ${platform.tone}${platform.charLimit ? `. Max ${platform.charLimit} chars` : ''}. Return ONLY the post text, no labels.]\n\nCurrent post: "${currentContent}"\n\nRefinement request: ${message}`
      : message

    const result = await session.run(fullPrompt)

    // AILinkResult.response is the string
    const refined = (result as { response?: string })?.response?.trim() ?? ''
    if (!refined) return jsonError('Refinement produced no output', 500)

    await env.DB.prepare(
      `UPDATE generated_posts
       SET content = ?, edited = 1, updated_at = unixepoch()
       WHERE campaign_id = ? AND platform_id = ? AND user_id = ?`
    ).bind(refined, campaignId, platformId, userId).run()

    return new Response(JSON.stringify({ content: refined, platformId }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Refinement error:', err)
    return jsonError('Refinement failed. Please try again.', 500)
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
