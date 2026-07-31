# Decision Record (ADR) Template

Use for any significant technical or product decision worth remembering — why we picked X over Y, why a constraint exists, or why we rejected an approach. One file per decision stored under `docs/decisions/`. Never bury ADRs inside feature docs — link to them instead.

```markdown
---
id: ADR-YYYY-XXX
title: [Short Decision Title]
date: YYYY-MM-DD
owner: [Author / Team Lead]
status: [Active | Superseded] (Link to replacement if Superseded)
---

## Context
What problem or operational limitation forced this decision? (2-4 sentences)

## Decision Detail
What was actually decided and implemented?

## Alternatives Considered
- **Option A**: Why rejected
- **Option B**: Why rejected

## Deciding Reason
The primary deciding factor (cost, latency, rate limits, platform cap, or architecture risk).

## Consequences
What does this lock in? What becomes harder or requires strict guardrails as a result?
```

---

## Real Example (From PostMaker History)

```markdown
---
id: ADR-2026-001
title: Two-Stage AI Generation Pipeline (Gemini Vision Once, Groq Text Parallel)
date: 2026-07-22
owner: System Architect
status: Active
---

## Context
Original architecture called Gemini vision once per platform group, which multiplied a rate-limited free-tier API call by platform count, causing Cloudflare Worker 30s wall-clock timeouts and production generation failures under load.

## Decision Detail
Gemini vision analyzes the uploaded image exactly once per generation request, producing a cached text description (`campaigns.image_description`). Groq (`llama-3.3-70b-versatile`) generates per-platform captions concurrently from that single stored text description.

## Alternatives Considered
- **Call Gemini per platform**: Rejected; caused production rate-limit errors and 30s Worker timeouts.
- **Cache descriptions client-side**: Rejected; does not solve first-generation cost or security.

## Deciding Reason
Gemini API is free-tier and rate-limited; executing one vision call per generation request is mandatory to keep generation latency under 15s and protect quota.

## Consequences
Any change to the post generation pipeline MUST preserve "one Gemini call per request regardless of platform count" as a non-negotiable invariant.
```
