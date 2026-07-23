// ============================================================
// PostMaker — @ailink/sdk Configuration
// ============================================================

import { AILink } from '@ailink/sdk'
import { streamText, generateText } from 'ai'
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
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  CLOUDFLARE_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
  VISION_MODEL: string
  DOMAIN: string
  ENVIRONMENT: 'development' | 'staging' | 'production'
  GROQ_LIMITER?: DurableObjectNamespace
  // Test-only mock flags — hard-gated to non-production in analyzeImage() / generate.ts
  STAGE1_MOCK_FAIL?: string
  STAGE1_MOCK_SUCCESS?: string
  STAGE2_MOCK_FAIL_GROUP?: string
  STAGE2_MOCK_SUCCESS?: string
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

// ── Stage 1: Vision Analysis (called exactly once per generation) ─────────────
// Sends the image to Gemini once and returns a structured plain-text description.
// This description is stored on the campaign and reused for retries — Gemini is
// never called again for the same campaign after this returns non-null.
//
// Returns null on:
//   - Timeout (15s AbortController fires)
//   - Gemini API error (including 429 — caller distinguishes via logged message)
//   - Empty or malformed/too-short response from Gemini
//
// MOCK GUARD: STAGE1_MOCK_FAIL is only respected when env.ENVIRONMENT !== 'production'.
// This prevents test flags from ever affecting real users regardless of what
// environment variables exist in the production Worker binding.
export async function analyzeImage(
  env: Env,
  images: { buffer: ArrayBuffer; contentType: string } | Array<{ buffer: ArrayBuffer; contentType: string }>
): Promise<{ description: string | null; errorType: 'timeout' | 'rate_limit' | 'error' | null }> {
  // Hard gate: test mock only runs in development/staging
  if (env.ENVIRONMENT !== 'production' && env.STAGE1_MOCK_FAIL === 'true') {
    console.log('[analyzeImage] STAGE1_MOCK_FAIL active — returning null (test mode)')
    return { description: null, errorType: 'error' }
  }

  if (env.ENVIRONMENT !== 'production' && env.STAGE1_MOCK_SUCCESS === 'true') {
    console.log('[analyzeImage] STAGE1_MOCK_SUCCESS active — returning mock description (test mode)')
    return {
      description: JSON.stringify({
        subjects: "Re-analyzed collection of 4 images via Gemini Vision",
        mood: "Restored on retry",
        colors: "Vibrant collection",
        composition: "Grid of 4 images"
      }),
      errorType: null
    }
  }

  const imageList = Array.isArray(images) ? images : [images]
  if (imageList.length === 0 || imageList.length > 4) {
    console.error('[analyzeImage] Invalid image count:', imageList.length)
    return { description: null, errorType: 'error' }
  }

  const geminiProvider = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY })
  const model = geminiProvider(env.VISION_MODEL)

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), 15_000)

  const promptText = imageList.length === 1
    ? `Analyze this image and return a structured description as valid JSON only — no markdown fences, no explanation.

Format:
{
  "subjects": "primary subjects or people (expression, activity, approximate age if visible)",
  "setting": "location or environment (indoor/outdoor, context clues)",
  "mood": "emotional tone or atmosphere of the image",
  "colors": "dominant colors and overall palette",
  "composition": "framing, perspective, notable visual structure",
  "notable_details": "text, logos, products, objects, or specific details visible",
  "style": "photographic style (candid, portrait, product shot, landscape, graphic, etc.)"
}

Be specific — this description will be used by another AI to write platform captions without seeing the image.`
    : `Analyze these ${imageList.length} images together as a collection and return a structured description as valid JSON only — no markdown fences, no explanation.

Format:
{
  "subjects": "primary subjects or people across all images (expressions, activities, items)",
  "setting": "locations or environments depicted across images",
  "mood": "overall emotional tone, theme, or atmosphere of the collection",
  "colors": "dominant colors and overall palette across images",
  "composition": "framing, perspectives, and visual relationships between images",
  "notable_details": "key text, logos, products, objects, or specific details visible across images",
  "style": "photographic or visual styles presented"
}

Be specific — this description will be used by another AI to write platform captions without seeing the images.`

  const contentParts: any[] = [
    { type: 'text', text: promptText },
    ...imageList.map(img => ({
      type: 'image',
      image: img.buffer,
      mediaType: img.contentType,
    }))
  ]

  try {
    const result = await generateText({
      model,
      abortSignal: abortController.signal,
      maxOutputTokens: 512,
      messages: [
        {
          role: 'user',
          content: contentParts,
        },
      ],
    })

    const raw = result.text?.trim() ?? ''
    if (!raw) {
      console.error('[analyzeImage] Gemini returned empty response')
      return { description: null, errorType: 'error' }
    }

    // Validate and normalise the response.
    // Two acceptable forms:
    //   1. Valid JSON object with at least one expected field → return as compact JSON string.
    //   2. Non-JSON prose longer than 80 chars → accept as fallback (Groq can still use it).
    //   3. Anything else (short, nonsense, refusal) → reject.
    try {
      const clean = raw.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      if (typeof parsed === 'object' && parsed !== null && (parsed.mood || parsed.subjects || parsed.setting)) {
        return { description: JSON.stringify(parsed), errorType: null }
      }
      // JSON parsed but missing all expected fields — treat as malformed
      console.error('[analyzeImage] Gemini returned JSON missing expected fields:', clean.slice(0, 200))
      return { description: null, errorType: 'error' }
    } catch {
      // Not valid JSON — check if it's usable prose
      if (raw.length > 80) {
        console.warn('[analyzeImage] Gemini returned prose (non-JSON) — using as fallback description')
        return { description: raw, errorType: null }
      }
      console.error('[analyzeImage] Gemini response too short or unrecognisable:', raw.slice(0, 100))
      return { description: null, errorType: 'error' }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.error('[analyzeImage] Stage 1 timed out after 15s')
      return { description: null, errorType: 'timeout' }
    }
    // Check for Gemini 429 rate limit
    const status = err?.status ?? err?.response?.status ?? 0
    if (status === 429 || String(err?.message ?? '').includes('429')) {
      console.error('[analyzeImage] Gemini 429 rate limit hit')
      return { description: null, errorType: 'rate_limit' }
    }
    console.error('[analyzeImage] Gemini vision call failed:', err?.message ?? err)
    return { description: null, errorType: 'error' }
  } finally {
    clearTimeout(timeoutId)
  }
}

// ── Streaming via ai.wrap() ───────────────────────────────────
// Used for Stage 2 (Groq text-only caption writing) and for the retry route.
// The image parameter is kept in the signature for backward-compat with the
// retry route's fallback path (when image_description is null and the R2 object
// still exists — rare, legacy campaigns only).
export function createStreamingClient(env: Env) {
  if (env.ENVIRONMENT !== 'production' && env.STAGE2_MOCK_SUCCESS === 'true') {
    return {
      streamGenerate: async () => {
        return {
          textStream: (async function* () {
            yield JSON.stringify({ twitter: "Successfully regenerated post content for Twitter on retry!" })
          })()
        }
      }
    }
  }

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

      // Stage 2 timeout: 10 seconds per Groq group call.
      // Reasoning: Stage 2 is text-only (Groq llama-3.3-70b-versatile).
      // Typical response time: 1–4s for 100–300 tokens. 10s is 2.5–10× headroom.
      // Combined ceiling with Stage 1's 15s cap: 15 + 10 = 25s max total, safely
      // under Cloudflare's ~30s wall-clock limit with a 5s buffer for I/O.
      // The image path (legacy retry fallback) is a Gemini call and gets the same
      // 10s limit — Gemini is faster for single-platform retries than multi-platform
      // generation, so this is still sufficient.
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort(), 10_000)

      const stream = streamText({
        model,
        system: systemPrompt,
        messages,
        maxOutputTokens: 4096,
        abortSignal: abortController.signal,
      })

      return {
        ...stream,
        textStream: (async function* () {
          try {
            for await (const chunk of stream.textStream) {
              yield chunk
            }
          } finally {
            // clearTimeout runs after stream is fully consumed (success or error).
            // The AbortSignal remains live throughout iteration — it fires if the
            // 10s window expires before the loop exits. clearTimeout only prevents
            // an already-completed call from triggering an unnecessary abort.
            clearTimeout(timeoutId)
          }
        })()
      }
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

export function buildImageContext(imageDescription: string | null): string {
  if (!imageDescription) return ''
  return `\n\nImage context (the user's uploaded photo — use this to write visuals-informed captions):\n${imageDescription}`
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
