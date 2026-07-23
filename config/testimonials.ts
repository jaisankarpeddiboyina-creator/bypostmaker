// config/testimonials.ts
//
// Single source of truth for homepage customer testimonials.
//
// INTENTIONALLY EMPTY as shipped. Do not populate with placeholder or
// fabricated quotes — presenting invented feedback as real customer
// testimonials is misleading and a real credibility/legal liability.
//
// The homepage's <TestimonialsSection> only renders when this array is
// non-empty, so leaving it empty means no testimonials section appears
// on the live site at all (rather than showing a broken/fake-looking
// section) until real quotes are added here.
//
// To add a real testimonial once you have one: get explicit permission
// from the person to quote them publicly, then add an entry below.

export interface TestimonialEntry {
  /** Stable id for React keys. */
  id: string
  /** The quote itself, in the customer's own words. Keep it verbatim — do not embellish or paraphrase into marketing copy. */
  quote: string
  /** Real name of the person being quoted. Never use a placeholder or invented name. */
  authorName: string
  /** Their role/title and company, e.g. "Social Media Manager, Acme Co." — omit company if they'd rather not disclose it. */
  authorRole: string
  /** Optional avatar image URL. Fine to omit — the component falls back to initials. */
  avatarUrl?: string
}

export const testimonials: TestimonialEntry[] = []

/**
 * ── EXTENSION POINT FOR FUTURE DATABASE/CMS MIGRATION ────────────────────────
 * Same migration path as config/blog.ts, config/vsPages.ts, config/forPages.ts,
 * and config/faq.ts: back this with a D1 table once you're collecting
 * testimonials regularly, and swap the direct array import in LandingPage.tsx
 * for a fetch/query call.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getTestimonialsRegistry(): Promise<TestimonialEntry[]> {
  return testimonials
}
