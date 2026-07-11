// config/blog.ts

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  readingTime: string
  author: string
  content: string
  tags: string[]
  ogImage?: string
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'why-multi-platform-posting-is-essential-for-creators',
    title: 'Why Multi-Platform Posting is Essential for Creators in 2026',
    description: 'Discover how publishing your content across Twitter, LinkedIn, Instagram, and TikTok can multiply your reach and how to do it efficiently.',
    date: '2026-07-10',
    readingTime: '5 min read',
    author: 'PostMaker Team',
    tags: ['Social Media', 'Content Strategy', 'Growth'],
    content: `# Why Multi-Platform Posting is Essential for Creators in 2026

In today's fragmented social media landscape, relying on a single platform is a risky strategy. Algorithm shifts can wipe out your reach overnight. To build a resilient brand, you must distribute your message everywhere your audience hangs out.

## The Power of Omni-channel Distribution

Each social platform caters to a different audience and consumption style:
- **LinkedIn** is professional, value-driven, and relies on text and carousels.
- **Twitter/X** is fast-paced, concise, and relies on threads and hot takes.
- **Instagram/TikTok** are highly visual, relying on short-form video and engaging captions.

By tailoring your message to each platform, you can reach distinct user groups without starting from scratch.

## The Challenge: Context is King

You can't just copy-paste the exact same text across platforms. A long-form LinkedIn post looks weird on Twitter, and a Twitter thread doesn't translate directly to an Instagram caption.

This is where AI-powered formatting comes in. By converting your core idea into platform-perfect formats, you get the best of both worlds: maximum distribution with minimal effort.

## How to Get Started

1. **Start with a single prompt or idea.**
2. **Translate it for each platform's culture.**
3. **Schedule and publish consistently.**

Try using PostMaker to automate this entire workflow in one click!`
  },
  {
    slug: 'how-to-write-social-media-prompts-that-convert',
    title: 'How to Write Social Media Prompts that Convert',
    description: 'Learn the exact prompting formulas to generate highly engaging, platform-perfect social posts using AI.',
    date: '2026-07-08',
    readingTime: '4 min read',
    author: 'PostMaker Team',
    tags: ['AI Prompting', 'Copywriting', 'Social Media'],
    content: `# How to Write Social Media Prompts that Convert

Writing prompts for AI is an art. If your prompts are too generic, the generated posts will sound robotic and boring. To write prompts that produce engaging, platform-specific posts, you need a structured approach.

## The Context-Action-Format (CAF) Framework

When writing prompts, always include three components:
1. **Context**: Who are you, and who is your audience?
2. **Action**: What is the core message or story you want to share?
3. **Format**: What platforms are you targeting and what tone should they have?

## Example of a Bad Prompt
> "Write a post about my new SaaS app for launching social media posts."

## Example of a Great Prompt
> "I am a solo founder launching PostMaker, an AI tool that creates social media posts for 30+ platforms from a single prompt. Write an engaging post highlighting the time-saving benefits for busy creators, focusing on a friendly but professional tone."

## Tailoring for Different Platforms

PostMaker handles the formatting details for you automatically, adjusting line breaks, hashtags, and formatting styles to fit each platform's best practices.`
  }
]

/**
 * ── EXTENSION POINT FOR FUTURE DATABASE/CMS MIGRATION ────────────────────────
 * When the blog grows past 100+ posts, or you want to edit posts via a dashboard,
 * migrate this system by doing the following:
 * 1. Create a `blog_posts` table in D1 (schema.sql).
 * 2. Write a Worker migration API (`/api/blog` and `/api/blog/:slug`) that queries D1.
 * 3. Replace direct imports of `blogPosts` in the Worker (`index.ts`) with a DB query
 *    inside the path matching helper.
 * 4. Replace direct imports of `blogPosts` in the React frontend (`BlogPage.tsx`)
 *    with a standard standard `useEffect` + `fetch` from `/api/blog`.
 * 
 * Since all post paths (/blog/:slug) and markdown parsing logic will remain identical,
 * migrating to a database will require zero changes to SEO headers or URL patterns.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function getBlogPostsRegistry(): Promise<BlogPost[]> {
  // Currently, we return the hardcoded array directly.
  // In the future, this function can query a D1 Database or fetch from R2 storage.
  return blogPosts
}
