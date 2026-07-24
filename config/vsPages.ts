// config/vsPages.ts
//
// Data source for PostMaker's "vs" comparison pages (/vs/:slug).
// Mirrors config/blog.ts's shape and extension-point pattern so this stays
// consistent with the rest of the marketing-content system: a typed array
// today, swappable for a D1-backed lookup later with zero URL/SEO changes.

export interface ComparisonRow {
  /** The capability/dimension being compared, e.g. "AI content generation". */
  feature: string
  /** What PostMaker offers for this row. Use a short phrase, not a full sentence. */
  postmaker: string
  /** What the competitor offers for this row, in the same short-phrase style. */
  competitor: string
  /** Whether PostMaker has the edge on this specific row. Drives a visual indicator only — keep the row text itself factual either way. */
  postmakerWins: boolean
}

export interface VsPageEntry {
  /** URL slug, resolves to /vs/:slug */
  slug: string
  /** Display name of the competitor, e.g. "Buffer" */
  competitorName: string
  /** <title> tag content */
  title: string
  /** Meta description */
  description: string
  /** Short intro paragraph shown at the top of the page */
  intro: string
  /** Row-by-row feature comparison */
  features: ComparisonRow[]
  /** Bullet list: where PostMaker is the better fit */
  postmakerAdvantages: string[]
  /** Bullet list: where the competitor is genuinely the better fit — keeping this honest is what makes the page credible (and defensible) rather than a thin marketing page Google discounts */
  competitorStrengths: string[]
  /** Closing takeaway / recommendation */
  verdict: string
  ogImage?: string
}

export const vsPages: VsPageEntry[] = [
  {
    slug: 'buffer',
    competitorName: 'Buffer',
    title: 'PostMaker vs Buffer — AI Content Generation vs Manual Scheduling',
    description: 'Compare PostMaker and Buffer on AI content generation, platform coverage, and pricing to find the right tool for your workflow.',
    intro: 'Buffer is a well-established scheduler known for its clean interface and generous free plan. PostMaker takes a different starting point: instead of scheduling content you\'ve already written, it generates the platform-perfect post for you from a single prompt.',
    features: [
      { feature: 'AI content generation from a prompt', postmaker: 'Built-in, core feature', competitor: 'Not available natively', postmakerWins: true },
      { feature: 'Platform-specific formatting', postmaker: 'Automatic for 30+ platforms', competitor: 'Manual per-platform editing', postmakerWins: true },
      { feature: 'Visual scheduling calendar', postmaker: 'Available', competitor: 'Strong, mature calendar UI', postmakerWins: false },
      { feature: 'Free plan', postmaker: 'Free tier available', competitor: 'Free forever plan for up to 3 channels', postmakerWins: false },
      { feature: 'Browser extension for content curation', postmaker: 'Not available', competitor: 'Available', postmakerWins: false },
    ],
    postmakerAdvantages: [
      'You want one prompt to become a ready post for every platform, not a blank box you fill in per-platform.',
      'You publish to a wide platform mix beyond the mainstream few.',
      'Content creation, not just scheduling, is your actual bottleneck.',
    ],
    competitorStrengths: [
      'You already have finished content and just need reliable scheduling.',
      'You want the most mature, battle-tested calendar interface on the market.',
      'You rely on Buffer\'s browser extension for on-the-fly content curation.',
    ],
    verdict: 'If writing and adapting content is the slow part of your workflow, PostMaker removes that step. If you already write your own posts and just need them scheduled reliably, Buffer\'s calendar is hard to beat.',
  },
  {
    slug: 'hootsuite',
    competitorName: 'Hootsuite',
    title: 'PostMaker vs Hootsuite — Simple AI Workflow vs Enterprise Suite',
    description: 'See how PostMaker compares to Hootsuite on ease of use, AI content generation, pricing, and team features.',
    intro: 'Hootsuite is one of the longest-running social media management platforms, built for larger teams that need deep analytics and multi-client management. PostMaker is built for speed: describe your post once, get every platform version back in seconds.',
    features: [
      { feature: 'AI content generation from a prompt', postmaker: 'Built-in, core feature', competitor: 'AI caption assistant (OwlyWriter)', postmakerWins: true },
      { feature: 'Setup time to first post', postmaker: 'Minutes', competitor: 'Longer — more configuration surface', postmakerWins: true },
      { feature: 'Enterprise analytics & reporting', postmaker: 'Basic analytics', competitor: 'Deep, mature reporting suite', postmakerWins: false },
      { feature: 'Multi-client/team management', postmaker: 'Growing', competitor: 'Purpose-built for agencies', postmakerWins: false },
      { feature: 'Pricing for solo users', postmaker: 'Affordable, usage-based', competitor: 'Enterprise-oriented pricing', postmakerWins: true },
    ],
    postmakerAdvantages: [
      'You\'re a solo creator, founder, or small team, not a large agency needing enterprise reporting.',
      'You want to go from idea to published post in minutes, not manage a complex dashboard.',
      'AI-generated, platform-tailored copy matters more to you than social listening features.',
    ],
    competitorStrengths: [
      'You manage many client accounts and need deep, exportable analytics.',
      'Your team needs granular approval workflows and role permissions at scale.',
      'You need social listening and inbox management alongside scheduling.',
    ],
    verdict: 'Hootsuite is built for agencies managing complexity at scale. PostMaker is built for anyone who wants great platform-native content without the overhead — pick based on which problem you actually have.',
  },
  {
    slug: 'later',
    competitorName: 'Later',
    title: 'PostMaker vs Later — Cross-Platform AI Content vs Visual Planning',
    description: 'Compare PostMaker and Later on platform coverage, AI content generation, and visual content planning.',
    intro: 'Later is built around visual-first planning, especially for Instagram and TikTok. PostMaker is platform-agnostic by design — one prompt becomes tailored content for 30+ networks, visual or text-first.',
    features: [
      { feature: 'AI content generation from a prompt', postmaker: 'Built-in, core feature', competitor: 'Limited AI caption tools', postmakerWins: true },
      { feature: 'Platform coverage', postmaker: '30+ platforms', competitor: 'Strongest on Instagram & TikTok', postmakerWins: true },
      { feature: 'Visual drag-and-drop calendar', postmaker: 'Available', competitor: 'Best-in-class for visual planning', postmakerWins: false },
      { feature: 'Linkin.bio-style link pages', postmaker: 'Not available', competitor: 'Available (Linkin.bio)', postmakerWins: false },
      { feature: 'Text-first platforms (LinkedIn, X)', postmaker: 'Fully supported, AI-tailored', competitor: 'Secondary focus', postmakerWins: true },
    ],
    postmakerAdvantages: [
      'Your content mix spans text-first platforms like LinkedIn and X, not just Instagram/TikTok.',
      'You want AI to write and adapt the post, not just help you plan visuals.',
      'You publish broadly across 30+ platforms rather than a visual-first subset.',
    ],
    competitorStrengths: [
      'Your strategy is genuinely Instagram/TikTok-first and visual planning is your priority.',
      'You rely on a Linkin.bio-style landing page for Instagram traffic.',
      'You want the most refined drag-and-drop visual calendar available.',
    ],
    verdict: 'Later wins if your world is visual-first and Instagram/TikTok-centric. PostMaker wins if your content needs to work everywhere, including text-first platforms Later treats as secondary.',
  },
  {
    slug: 'postmaker-io',
    competitorName: 'Postmaker.io',
    title: 'PostMaker vs Postmaker.io: Which Social Media Post Generator is Better?',
    description: 'PostMaker (bypostamaker.com) and Postmaker.io are separate, unrelated products. Here\'s how they differ so you land on the right one.',
    intro: 'PostMaker (at bypostamaker.com) and Postmaker.io share a similar name and category — social content creation — but are separate, independently operated products. If you searched for one and found the other, here\'s a clear comparison to help you pick the right fit.',
    features: [
      { feature: 'AI-generated platform-tailored posts', postmaker: 'Core feature, 30+ platforms', competitor: 'Spintax-based content variation', postmakerWins: true },
      { feature: 'Content variation approach', postmaker: 'AI generation per platform', competitor: 'Spintax templating', postmakerWins: true },
      { feature: 'Ease of use for beginners', postmaker: 'One prompt, done', competitor: 'Requires spintax familiarity', postmakerWins: true },
    ],
    postmakerAdvantages: [
      'You want AI to generate genuinely platform-tailored copy, not variations of a single template.',
      'You\'d rather describe your idea once than learn a templating syntax.',
    ],
    competitorStrengths: [
      'You specifically want spintax-style content variation and already have a workflow built around it.',
    ],
    verdict: 'These are two different products solving similar problems differently. If you want AI to write and adapt content per platform, that\'s PostMaker. If you\'re specifically looking for spintax-based variation, that\'s Postmaker.io.',
  },
]

/**
 * ── EXTENSION POINT FOR FUTURE DATABASE/CMS MIGRATION ────────────────────────
 * Same migration path as config/blog.ts: when this list needs to be edited
 * without a deploy, back it with a D1 table and a `/api/vs/:slug` route, and
 * swap the direct array import in VsPage.tsx and worker/src/index.ts for a
 * fetch/query call. URL patterns (/vs/:slug) and SEO headers stay identical.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getVsPagesRegistry(): Promise<VsPageEntry[]> {
  return vsPages
}
