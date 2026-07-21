// config/forPages.ts
//
// Data source for PostMaker's audience landing pages (/for/:slug).
// Mirrors config/blog.ts and config/vsPages.ts's shape and extension-point
// pattern: a typed array today, swappable for a D1-backed lookup later
// with zero URL/SEO changes.

export interface AudienceBenefit {
  title: string
  description: string
}

export interface ForPageEntry {
  /** URL slug, resolves to /for/:slug */
  slug: string
  /** Short audience name used in copy, e.g. "Social Media Managers" */
  audienceName: string
  /** <title> tag content */
  title: string
  /** Meta description */
  description: string
  /** One-line hero subheading shown under the H1 */
  heroSubheading: string
  /** The specific pains this audience has, in their own language */
  painPoints: string[]
  /** How PostMaker addresses those pains, paired title + description */
  benefits: AudienceBenefit[]
  /** CTA button text, tailored to the audience */
  ctaText: string
  ogImage?: string
}

export const forPages: ForPageEntry[] = [
  {
    slug: 'social-media-managers',
    audienceName: 'Social Media Managers',
    title: 'PostMaker for Social Media Managers — One Prompt, Every Platform',
    description: 'Manage multiple brand accounts without rewriting the same post five times. PostMaker generates platform-perfect content from one prompt.',
    heroSubheading: 'Stop rewriting the same post five different ways. Write it once, publish it everywhere it needs to look native.',
    painPoints: [
      'Rewriting the same announcement for LinkedIn, X, Instagram, and Facebook, each with different tone and length limits.',
      'Context-switching between brand voices across multiple client or department accounts.',
      'Losing hours per week to formatting instead of strategy.',
    ],
    benefits: [
      { title: 'One prompt, every platform', description: 'Describe the post once. Get tailored, platform-native versions for 30+ networks instantly, no manual reformatting.' },
      { title: 'Consistent brand voice at scale', description: 'Keep tone consistent across every account you manage without holding every platform\'s quirks in your head.' },
      { title: 'More time for strategy', description: 'Spend less time on execution and more on the calendar, campaigns, and reporting that actually move the needle.' },
    ],
    ctaText: 'Start managing smarter →',
  },
  {
    slug: 'small-businesses',
    audienceName: 'Small Businesses',
    title: 'PostMaker for Small Businesses — Social Media Without a Marketing Team',
    description: 'Run your social presence without hiring a marketer. PostMaker turns one idea into ready-to-post content for every platform your customers use.',
    heroSubheading: 'You don\'t have a marketing department. You shouldn\'t need one to show up consistently online.',
    painPoints: [
      'No dedicated marketing hire, so social media competes with running the actual business.',
      'Uncertainty about what to post or how to adapt it per platform.',
      'Inconsistent posting because it always gets deprioritized.',
    ],
    benefits: [
      { title: 'No marketing background required', description: 'Describe what\'s happening in your business in plain language. PostMaker turns it into platform-ready posts.' },
      { title: 'Show up everywhere your customers are', description: 'Reach customers across the platforms they actually use, without learning each one\'s best practices yourself.' },
      { title: 'Built for tight schedules', description: 'Generate a week of content in minutes, not hours you don\'t have.' },
    ],
    ctaText: 'Get your time back →',
  },
  {
    slug: 'content-creators',
    audienceName: 'Content Creators',
    title: 'PostMaker for Content Creators — Grow Everywhere, Not Just One Platform',
    description: 'Cross-post your content to every major platform without manually reformatting each version. Built for creators growing across channels.',
    heroSubheading: 'Your best idea deserves to exist everywhere, not just on the one platform you had time to post it to.',
    painPoints: [
      'Algorithm dependency on a single platform is risky for reach and income.',
      'Reformatting one idea for every platform\'s format and audience eats creative time.',
      'Inconsistent posting cadence because cross-posting is tedious.',
    ],
    benefits: [
      { title: 'Platform-native, not copy-pasted', description: 'Get content that reads like it was written for each platform, not an obvious cross-post.' },
      { title: 'Reduce single-platform risk', description: 'Diversify your reach across networks so one algorithm change doesn\'t sink your growth.' },
      { title: 'More output, same creative energy', description: 'Turn one idea into a full content spread without spending your creative hours on reformatting.' },
    ],
    ctaText: 'Grow everywhere →',
  },
  {
    slug: 'marketing-agencies',
    audienceName: 'Marketing Agencies',
    title: 'PostMaker for Marketing Agencies — Scale Content Across Every Client',
    description: 'Produce on-brand, platform-tailored content across every client account without scaling headcount at the same rate.',
    heroSubheading: 'More clients shouldn\'t mean linearly more hours spent formatting the same content five different ways.',
    painPoints: [
      'Every new client account multiplies the manual formatting workload.',
      'Maintaining distinct brand voices across many clients simultaneously.',
      'Margin pressure from labor-intensive content production.',
    ],
    benefits: [
      { title: 'Scale output without scaling headcount', description: 'Generate platform-tailored content across many client accounts without a proportional increase in staff time.' },
      { title: 'Protect margins', description: 'Reduce the manual-labor cost of content production per client, improving account profitability.' },
      { title: 'Consistent quality across accounts', description: 'Keep every client\'s content platform-appropriate without your team relearning each platform\'s conventions per account.' },
    ],
    ctaText: 'Scale your client work →',
  },
  {
    slug: 'ecommerce-brands',
    audienceName: 'Ecommerce Brands',
    title: 'PostMaker for Ecommerce Brands — Launches and Promos, Every Platform, Fast',
    description: 'Turn product launches and promotions into platform-ready posts across every channel your customers shop on.',
    heroSubheading: 'Launches and promos move fast. Your content should keep up, on every platform your customers browse.',
    painPoints: [
      'Product launches and flash promos need content fast, across many platforms at once.',
      'Promotional cadence is high, but the team writing it is small.',
      'Inconsistent messaging across platforms during time-sensitive campaigns.',
    ],
    benefits: [
      { title: 'Launch-ready content, fast', description: 'Turn a new product or promo into platform-tailored posts in minutes, matching your promotional timeline instead of lagging it.' },
      { title: 'Consistent messaging under time pressure', description: 'Keep pricing, offers, and messaging aligned across every platform even during high-cadence promo periods.' },
      { title: 'More campaigns, same team size', description: 'Run more frequent promotional content without needing a bigger content team.' },
    ],
    ctaText: 'Speed up your launches →',
  },
]

/**
 * ── EXTENSION POINT FOR FUTURE DATABASE/CMS MIGRATION ────────────────────────
 * Same migration path as config/blog.ts and config/vsPages.ts: when this
 * list needs to be edited without a deploy, back it with a D1 table and a
 * `/api/for/:slug` route, and swap the direct array import in ForPage.tsx
 * and worker/src/index.ts for a fetch/query call. URL patterns (/for/:slug)
 * and SEO headers stay identical.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getForPagesRegistry(): Promise<ForPageEntry[]> {
  return forPages
}
