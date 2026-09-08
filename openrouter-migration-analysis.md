OpenRouter vs Cloudflare AI Gateway — PostMaker Migration Analysis
Current Architecture (What You Actually Have)
PostMaker runs a two-stage AI pipeline on a Cloudflare Worker:

Stage	Provider	Model	Purpose
Stage 1	Gemini (Google AI Studio)	gemini-2.5-flash	Vision analysis — runs once per campaign when images are uploaded
Stage 2	Groq (primary) → Gemini (fallback)	llama-3.1-8b-instant / llama-3.3-70b-versatile	Caption writing — streamed, parallel per platform batch
Refinement	Groq via AILink session	same text model	Chat-style post refinement
Cloudflare AI Gateway's role today is a proxy layer that sits in front of both Groq and Google AI Studio. It's purely optional — the code checks for CLOUDFLARE_API_TOKEN and if it's missing, hits the providers directly. The Gateway is enabled in production but disabled in dev. It adds:

Request logging/observability in your CF dashboard
Caching of identical requests (reduces cost on repeated prompts)
A single billing view across providers
A fallback/retry UI in the dashboard
What OpenRouter Actually Is
OpenRouter is a unified API router that proxies to 200+ models (Groq, OpenAI, Anthropic, Mistral, Gemini, etc.) under a single OpenAI-compatible API endpoint. You pay OpenRouter per-token, and they handle provider routing.

Key difference: OpenRouter replaces the provider credentials (your GROQ_API_KEY, GEMINI_API_KEY), not just a monitoring layer. You'd call api.openrouter.ai instead of api.groq.com and generativelanguage.googleapis.com.

What Changes in Code — File-by-File
config/ai.ts
 — Major surgery required
This is the core impact file. Three things are affected:

1. createStreamingClient() (lines 357–534) — Currently uses @ai-sdk/groq and @ai-sdk/google. OpenRouter uses @ai-sdk/openrouter or the openai SDK with a custom base URL. The provider instantiation changes completely:

diff

- const groqProvider = createGroq({ apiKey: env.GROQ_API_KEY, ... })
- const geminiProvider = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY, ... })
+ const openRouterProvider = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })
+ // Model names change too: 'groq/llama-3.1-8b-instant', 'google/gemini-2.5-flash'
2. analyzeImage() (lines 196–350) — The Gemini vision call uses binary file content parts (raw ArrayBuffer → multipart). OpenRouter does not support binary file uploads. It only accepts base64-encoded images in the OpenAI chat format. The current code:

ts

{ type: 'file', data: img.buffer, mediaType: img.contentType }
Would need to change to:

ts

{ type: 'image_url', image_url: { url: `data:${img.contentType};base64,${base64encode(img.buffer)}` } }
This also changes token counting because base64 bloats payload size ~33%.

3. getProviderBaseURL() (lines 113–124) — The CF AI Gateway URL construction logic becomes obsolete. Replaced by OpenRouter's single endpoint.

4. Env interface (lines 11–77) — GROQ_API_KEY, GEMINI_API_KEY, CLOUDFLARE_API_TOKEN, CF_AIG_GATEWAY_NAME all go away. OPENROUTER_API_KEY comes in.

worker/src/routes/generate.ts
 — Logic change, medium risk
Line 310 has a hardcoded direct-Groq detection gate for the Durable Object rate limiter:

ts

const isDirectGroq = !env.CLOUDFLARE_API_TOKEN && ((env.TEXT_MODEL || env.GROQ_MODEL || '').toLowerCase().includes('groq'))
With OpenRouter, this condition changes. Calls still go to Groq models through OpenRouter, so you need to decide: do you still need the DO rate limiter? OpenRouter has its own rate limiting per model, so the DO limiter's purpose changes.

worker/src/services/limiter.ts
 — Potentially obsolete
The entire GroqRateLimiter Durable Object was built specifically because Groq's free tier has hard rate limits (30 RPM, 6K TPM). OpenRouter handles rate limiting at their end. The DO may no longer be needed — or it needs repurposing for OpenRouter limits, which are different per model.

wrangler.toml
 — Secrets change
diff

# Remove from secrets:
- GROQ_API_KEY
- GEMINI_API_KEY
- CLOUDFLARE_API_TOKEN (maybe)
- CF_AIG_GATEWAY_NAME
# Add:
+ OPENROUTER_API_KEY
The GROQ_LIMITER Durable Object binding may also become unnecessary.

worker/src/routes/refinement.ts
 — Indirect, low risk
Uses createAIClient() from config/ai.ts. If that's updated correctly, refinement should just work. The AILink session logic is not provider-specific.

worker/src/routes/retry.ts
 — Indirect, low risk
Uses createStreamingClient() and analyzeImage() — both affected by migration. Same changes flow through.

Real Risks — Graded
🔴 HIGH RISK: Image Vision (Binary Payloads)
This is the biggest technical blocker. Your current Gemini vision call sends raw ArrayBuffer binary data using the @ai-sdk/google multipart format. OpenRouter only supports base64-encoded image URLs in OpenAI chat format.

Why it matters: You're doing multi-image analysis (up to 4 images, up to 30MB combined). Base64 encoding 30MB = 40MB+ in the request body. Cloudflare Workers have a 128MB memory limit and a 100MB request body limit. This is tight and needs profiling. Gemini through OpenRouter also has lower image resolution caps vs direct API access.

🟡 MEDIUM RISK: Streaming on Cloudflare Workers
Your Stage 2 uses SSE streaming (TransformStream + writable.getWriter()). OpenRouter supports streaming but you'd need to verify the @ai-sdk/openrouter package handles ReadableStream correctly inside a CF Worker (edge runtime, not Node.js). The current @ai-sdk/groq is battle-tested in this setup.

🟡 MEDIUM RISK: Model Availability & Consistency
OpenRouter is a proxy — model availability depends on their upstream. If Groq (their upstream) has issues, or if a specific model version is deprecated on OpenRouter but not yet on Groq direct, you could have silent behavior changes. Right now your fallback is groq → gemini at your own code level. With OpenRouter, model routing becomes their responsibility.

🟡 MEDIUM RISK: Rate Limiter Durable Object
The GroqRateLimiter DO was purpose-built for Groq's specific free-tier limits. OpenRouter rate limits are per-model and per-plan and are handled server-side. If you migrate and leave the DO limiter in place without updating its constants, it will either over-throttle (slowing you down) or under-throttle (causing 429s from OpenRouter). Either way, you'd need to update or remove the DO logic.

🟢 LOW RISK: Caption Writing (Stage 2)
This is the easiest part to migrate. Stage 2 is text-only, uses streaming, and any OpenAI-compatible endpoint works. This is the cleanest win case for OpenRouter.

🟢 LOW RISK: Refinement Chat
Same — text-only, session-based. Clean migration path.

🟢 LOW RISK: Cost Accounting
OpenRouter gives per-token billing in one place. Currently you have two bills (Groq + Google). OpenRouter consolidates this. That's a genuine improvement.

What You Lose vs Cloudflare AI Gateway
Feature	CF AI Gateway	OpenRouter
Request caching	✅ Built-in, dashboard toggle	❌ None
Request logging	✅ CF dashboard, native	⚠️ OpenRouter dashboard only
Stays in CF network	✅ Low latency (same infra)	❌ Adds one more network hop
Billing consolidation	⚠️ View-only, still pay providers	✅ Single bill
Model fallback control	✅ You control in code	⚠️ OpenRouter can do it but less transparent
Binary multipart uploads	✅ Supported via direct provider	❌ Base64 only
Free tier bonus	✅ CF Gateway is free on Workers plans	💲 OpenRouter charges markup per token
What You Gain
Single API key instead of managing Groq + Gemini keys separately
Model switching without code changes (just change model name string)
Access to more models — can A/B test claude-3-haiku, mistral-7b, etc. without SDK changes
Automatic fallback — OpenRouter can failover to another provider if one is down
No rate limiter DO needed for basic use cases — OpenRouter manages queuing
My Recommendation
Don't do a full switch right now. Do a partial migration for Stage 2 only.

Here's why:

Stage 1 (vision) is too risky to move. The binary payload issue is real and the performance implications of base64-encoding large images in a CF Worker are not negligible. Direct Gemini API gives you the best latency and reliability for multipart vision calls. Keep Gemini on direct API.

Stage 2 (caption writing) is a clean win for OpenRouter. The text-only streaming batches are exactly what OpenRouter excels at. You'd also get the ability to swap models trivially, which is valuable as Groq's free tier models change frequently.

The Durable Object rate limiter becomes mostly obsolete for Stage 2 if you're on a paid OpenRouter plan. On free, OpenRouter still has limits — but you'd update the constants, not the architecture.

Concrete path if you do move Stage 2:

Add OPENROUTER_API_KEY as a new secret
In createStreamingClient(), add a branch: if TEXT_PROVIDER === 'openrouter', use @ai-sdk/openrouter
Keep Groq direct as fallback
Update isDirectGroq check in generate.ts to handle the new provider
Update DO limiter constants or gate it behind TEXT_PROVIDER !== 'openrouter'
Test on staging with 1 platform, confirm streaming works end-to-end
Keep Stage 1 on direct Gemini API — it's working, it's fast, and the binary upload path is a solved problem there.

IMPORTANT

Before any migration: Check whether you're on Groq's free tier or paid. If you're already on a paid Groq plan, you lose the biggest OpenRouter advantage (rate limit relief) and the economics change significantly since OpenRouter adds a markup.

WARNING

Do not migrate production in one shot. Staging → 10% traffic → 100% is the only safe path given the streaming + DO + vision complexity in this codebase.