// ============================================================
// PostMaker — @ailink/sdk Configuration
// ============================================================

import { AILink } from '@ailink/sdk'
import { streamText } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { PLATFORM_MAP, PLATFORMS_BY_GROUP, type PlatformGroup } from './platforms'

export interface Env {
  GROQ_API_KEY: string
  GEMINI_API_KEY: string
  GROQ_MODEL: string
  RAZORPAY_KEY_ID: string
  RAZORPAY_KEY_SECRET: string
  RAZORPAY_WEBHOOK_SECRET: string
  RAZORPAY_PLAN_STARTER_USD: string
  RAZORPAY_PLAN_STARTER_INR: string
  RAZORPAY_PLAN_PRO_USD: string
  RAZORPAY_PLAN_PRO_INR: string
  RAZORPAY_PLAN_BUSINESS_USD: string
  RAZORPAY_PLAN_BUSINESS_INR: string
  RESEND_API_KEY: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  JWT_SECRET: string
  DB: D1Database
  BUCKET: R2Bucket
  // Dedicated bucket for build-time pre-rendered route snapshots (SEO).
  // Deliberately separate from BUCKET (user uploads) so a bad prerender
  // deploy can never collide with or overwrite real user data.
  SNAPSHOTS: R2Bucket
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  CLOUDFLARE_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
  VISION_MODEL: string
  DOMAIN: string
  ENVIRONMENT: 'development' | 'staging' | 'production'
}

// ── AILink Instance Factory ───────────────────────────────────
export function createAIClient(env: Env) {
  const ai = new AILink({
    provider: 'groq',
    providerKey: env.GROQ_API_KEY,
    providerKeys: { gemini: env.GEMINI_API_KEY },
    fallback: ['gemini'],
    retries: 3,
    retryDelay: 1000,
    environment: env.ENVIRONMENT,
  })

  const GROUPS: PlatformGroup[] = [
    'shortform', 'professional', 'community', 'longform',
    'video', 'audio', 'design', 'messaging',
  ]

  for (const group of GROUPS) {
    const platforms = PLATFORMS_BY_GROUP[group] ?? []
    if (platforms.length === 0) continue

    ai.register(
      `generate_${group}`,
      async ({ prompt, selectedPlatformIds, language }: {
        prompt: string
        selectedPlatformIds: string[]
        language: string
      }) => {
        const targets = platforms.filter(p => selectedPlatformIds.includes(p.id))
        if (targets.length === 0) return {}
        const systemPrompt = buildGroupSystemPrompt(targets, language)
        const userPrompt = `User's content prompt: "${prompt}"\n\nGenerate posts for each platform. Return only JSON.`
        // Prepend system context via conversationHistory (RunOptions doesn't have systemPrompt)
        // Inline system prompt into user prompt (conversationHistory 'system' role not supported)
        const combinedPrompt = systemPrompt + '\n\n' + userPrompt
        const result = await ai.run(combinedPrompt)
        return parseGroupResponse(result.response, targets.map(p => p.id))
      },
      {
        description: `Generate posts for ${group} platforms`,
        parameters: {
          type: 'object' as const,
          properties: {
            prompt: { type: 'string' },
            selectedPlatformIds: { type: 'array', items: { type: 'string' } },
            language: { type: 'string' },
          },
          required: ['prompt', 'selectedPlatformIds', 'language'],
        },
        group: 'generation',
      }
    )
  }

  return ai
}

// ── Streaming via ai.wrap() ───────────────────────────────────
export function createStreamingClient(env: Env) {
  const ai = new AILink({
    provider: 'groq',
    providerKey: env.GROQ_API_KEY,
    providerKeys: { gemini: env.GEMINI_API_KEY },
    fallback: ['gemini'],
    environment: env.ENVIRONMENT,
  })

  const groqProvider = createGroq({ apiKey: env.GROQ_API_KEY })
  const geminiProvider = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY })

  const streamGenerate = ai.wrap(
    async ({ systemPrompt, userPrompt, useGroq = true, image }: {
      systemPrompt: string
      userPrompt: string
      useGroq?: boolean
      image?: { buffer: ArrayBuffer; contentType: string }
    }) => {
      const model = useGroq && !image
        ? groqProvider(env.GROQ_MODEL)
        : geminiProvider(env.VISION_MODEL)

      const messages: any[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt }
          ]
        }
      ]

      if (image) {
        messages[0].content.push({
          type: 'image',
          image: image.buffer,
          mimeType: image.contentType
        })
      }

      return streamText({
        model,
        system: systemPrompt,
        messages,
        maxOutputTokens: 4096,
      })
    },
    { toolName: 'StreamGenerate' }
  )

  return { ai, streamGenerate }
}

// ── Per-Platform Refinement Session ──────────────────────────
export function createRefinementSession(
  ai: ReturnType<typeof createAIClient>,
  platformId: string,
  campaignId: string,
  existingContent: string
) {
  const sessionId = `${campaignId}:${platformId}`
  // 20 turn history limit per session
  const session = ai.createSession(sessionId, 20)
  const platform = PLATFORM_MAP[platformId]

  // Seed session history with system context using conversationHistory
  const systemContext = `You are refining a ${platform?.name ?? platformId} post.
${platform ? `Platform tone: ${platform.tone}` : ''}
Current post: "${existingContent}"
Return ONLY the refined post text. No labels, no explanation, no quotes.`

  return { session, sessionId, systemContext }
}

// ── Language Detection ────────────────────────────────────────
export function detectLanguage(prompt: string): string {
  const scripts: Array<{ regex: RegExp; lang: string }> = [
    { regex: /[\u0900-\u097F]/, lang: 'Hindi' },
    { regex: /[\u0600-\u06FF]/, lang: 'Arabic' },
    { regex: /[\u4E00-\u9FFF]/, lang: 'Chinese' },
    { regex: /[\u3040-\u30FF]/, lang: 'Japanese' },
    { regex: /[\uAC00-\uD7A3]/, lang: 'Korean' },
    { regex: /[\u0400-\u04FF]/, lang: 'Russian' },
    { regex: /[\u0370-\u03FF]/, lang: 'Greek' },
  ]
  for (const { regex, lang } of scripts) {
    if (regex.test(prompt)) return lang
  }
  return 'auto'
}

// ── Prompt Builders ───────────────────────────────────────────
export function buildGroupSystemPrompt(
  platforms: Array<{
    id: string; name: string; tone: string; outputFormat: string
    charLimit: number | null; maxHashtags: number
  }>,
  language: string
): string {
  const instructions = platforms.map(p => `
## ${p.name} [id: "${p.id}"]
Tone: ${p.tone}
Output: ${p.outputFormat}
${p.charLimit ? `Limit: ${p.charLimit} chars` : ''}
${p.maxHashtags > 0 ? `Max ${p.maxHashtags} hashtags` : 'No hashtags'}
`).join('\n---\n')

  return `You are PostMaker — you write platform-perfect social content.

OUTPUT RULES:
- Respond ONLY with valid JSON: { "platform_id": "content" }
- No markdown fences. No explanations. JSON only.
- Write in ${language === 'auto' ? "the same language as the user's prompt" : language}
- Never mention the platform name inside the content
- Never exceed character limits

PLATFORMS:
${instructions}`
}

export function parseGroupResponse(text: string, platformIds: string[]): Record<string, string> {
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    const result: Record<string, string> = {}
    for (const id of platformIds) {
      if (parsed[id] && typeof parsed[id] === 'string') {
        result[id] = parsed[id].trim()
      }
    }
    return result
  } catch {
    const result: Record<string, string> = {}
    for (const id of platformIds) {
      const match = text.match(new RegExp(`"${id}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's'))
      if (match) result[id] = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
    }
    return result
  }
}
