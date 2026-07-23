// config/faq.ts
//
// Single source of truth for PostMaker's homepage FAQ. Consumed by BOTH:
//   - frontend/src/pages/LandingPage.tsx (renders the visible accordion)
//   - worker/src/index.ts's HeadInjector (emits matching FAQPage JSON-LD)
// Keeping this in one file means the visible FAQ and the structured data
// describing it can never drift out of sync — a requirement for FAQPage
// rich results, since Google penalizes schema that doesn't match visible
// on-page content.

export interface FaqEntry {
  /** Stable id for React keys — not used in any URL. */
  id: string
  question: string
  /** Plain text only (no markdown/HTML) — this is emitted directly into
   * JSON-LD, so it must be safe as a literal string. */
  answer: string
}

export const faqEntries: FaqEntry[] = [
  {
    id: 'what-is-postmaker',
    question: 'What is PostMaker?',
    answer: 'PostMaker is an AI-powered content generator that turns a single prompt into platform-perfect social media posts for 30+ networks at once, packaged into a ready-to-post content kit.',
  },
  {
    id: 'which-platforms',
    question: 'Which platforms does PostMaker support?',
    answer: 'PostMaker supports 30+ platforms including X/Twitter, LinkedIn, Instagram, TikTok, Facebook, Threads, Reddit, YouTube, Pinterest, Discord, Medium, Substack, and many more. Each post is automatically tailored to that platform\'s format and conventions, not just copy-pasted.',
  },
  {
    id: 'is-there-free-plan',
    question: 'Is there a free plan?',
    answer: 'Yes. The Free plan includes 5 generations per month across 7 platforms, the full content kit download, and beta image resizing, with no credit card required to get started.',
  },
  {
    id: 'how-much-does-it-cost',
    question: 'How much does PostMaker cost?',
    answer: 'Beyond the free plan, Starter is $9/month for 50 generations across all 30+ platforms, Pro is $19/month for 200 generations with priority generation, and Business is $49/month for 1,000 generations. All paid plans include every platform and the full feature set — higher tiers unlock more volume, not more features.',
  },
  {
    id: 'one-prompt-every-platform',
    question: 'Do I need to write a separate post for each platform?',
    answer: 'No. You write one prompt describing your idea, and PostMaker generates a tailored version for every platform you select, automatically adjusting tone, length, and formatting to fit each one.',
  },
  {
    id: 'is-there-an-api',
    question: 'Does PostMaker offer an API?',
    answer: 'API access is planned for the Business plan and is coming soon. It is not yet available.',
  },
  {
    id: 'how-to-get-support',
    question: 'How do I contact support?',
    answer: 'You can reach the PostMaker team directly at support@bypostamaker.com, or use the contact page for other inquiries.',
  },
]

/**
 * ── EXTENSION POINT FOR FUTURE DATABASE/CMS MIGRATION ────────────────────────
 * Same migration path as config/blog.ts, config/vsPages.ts, and
 * config/forPages.ts: back this with a D1 table and an `/api/faq` route,
 * and swap the direct array import in LandingPage.tsx and
 * worker/src/index.ts for a fetch/query call. The visible accordion and
 * the FAQPage JSON-LD will stay in sync automatically either way, since
 * both read from this same function.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getFaqRegistry(): Promise<FaqEntry[]> {
  return faqEntries
}
