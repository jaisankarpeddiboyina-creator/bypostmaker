// ============================================================
// PostMaker — Platform Configuration
// Single source of truth for all 33 platforms.
// Adding a platform = adding one object here. Nothing else.
// ============================================================

export type PlatformTier = 'free' | 'starter' | 'pro' | 'business'
export type PlatformGroup =
  | 'shortform'
  | 'professional'
  | 'community'
  | 'longform'
  | 'video'
  | 'audio'
  | 'design'
  | 'messaging'

export interface ImageDimension {
  width: number
  height: number
  label: string
}

export interface Platform {
  id: string
  name: string
  icon: string                    // lucide icon name or custom svg id
  group: PlatformGroup
  tier: PlatformTier              // Informational/display only — access control is handled
                                  // by FREE_PLATFORM_IDS in isPlatformAccessible(), not this field.
  charLimit: number | null        // null = no hard limit
  hashtagStyle: 'inline' | 'block' | 'none'
  maxHashtags: number
  imageDimensions: ImageDimension[]
  supportsVideo: boolean
  shareUrl: (content: string, extra?: Record<string, string>) => string
  tone: string                    // AI system prompt tone instruction
  outputFormat: string            // what the AI should output
  extraFields?: string[]          // e.g. ['subreddit'] for Reddit
  maxImages: number       // real platform upload limit; 0 means no image support
  brandColor: string      // hex color for platform chrome accent
  imagePosition: 'above' | 'below' | 'none'  // where image appears in the card
}

export const PLATFORMS: Platform[] = [
  // ──────────────────────────────────────────────────────────
  // SHORT FORM
  // ──────────────────────────────────────────────────────────
  {
    id: 'twitter',
    name: 'X / Twitter',
    icon: 'twitter',
    group: 'shortform',
    tier: 'free',
    charLimit: 280,
    hashtagStyle: 'inline',
    maxHashtags: 2,
    imageDimensions: [
      { width: 1200, height: 675, label: 'Landscape' },
      { width: 1080, height: 1080, label: 'Square' },
    ],
    supportsVideo: true,
    shareUrl: (c) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(c)}`,
    tone: 'One sharp, confident line. Maximum signal, zero fluff. Under 280 characters. Write like you know something others don\'t. Max 2 hashtags inline — only if they genuinely add context. No emojis unless essential. Never use "I am excited to share".',
    outputFormat: 'Single tweet text, ready to post. No labels or explanations.',
    maxImages: 4,
    brandColor: '#1D9BF0',
    imagePosition: 'below',
  },
  {
    id: 'threads',
    name: 'Threads',
    icon: 'at-sign',
    group: 'shortform',
    tier: 'free',
    charLimit: 500,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [
      { width: 1080, height: 1080, label: 'Square' },
      { width: 1080, height: 1350, label: 'Portrait' },
    ],
    supportsVideo: true,
    shareUrl: () => 'https://www.threads.net',
    tone: 'Casual and conversational. Feels like a personal thought, not a brand post. Like texting a smart friend. No hashtags — Threads doesn\'t use them. Authentic, a little vulnerable, real.',
    outputFormat: 'One short paragraph or 2–3 sentence post. No hashtags.',
    maxImages: 10,
    brandColor: '#000000',
    imagePosition: 'below',
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    icon: 'cloud',
    group: 'shortform',
    tier: 'free',
    charLimit: 300,
    hashtagStyle: 'inline',
    maxHashtags: 2,
    imageDimensions: [
      { width: 1200, height: 628, label: 'Landscape' },
      { width: 1080, height: 1080, label: 'Square' },
    ],
    supportsVideo: false,
    shareUrl: (c) => `https://bsky.app/intent/compose?text=${encodeURIComponent(c)}`,
    tone: 'Friendly and authentic. Short, smart, personal. Zero brand voice. Feels like talking to someone you actually like. Thoughtful, never hype.',
    outputFormat: 'Under 300 characters. Punchy and genuine.',
    maxImages: 4,
    brandColor: '#0085FF',
    imagePosition: 'below',
  },
  {
    id: 'mastodon',
    name: 'Mastodon',
    icon: 'globe',
    group: 'shortform',
    tier: 'starter',
    charLimit: 500,
    hashtagStyle: 'block',
    maxHashtags: 4,
    imageDimensions: [
      { width: 1200, height: 628, label: 'Landscape' },
      { width: 1080, height: 1080, label: 'Square' },
    ],
    supportsVideo: false,
    shareUrl: (c) => `https://mastodon.social/share?text=${encodeURIComponent(c)}`,
    tone: 'Thoughtful, no-hype, community-aware. Feels like talking to peers, not broadcasting to an audience. Decentralised ethos — never marketing speak. Hashtags at the bottom, used for discoverability not decoration.',
    outputFormat: 'Short post with 2–4 relevant hashtags on a new line at the end.',
    maxImages: 4,
    brandColor: '#6364FF',
    imagePosition: 'below',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    icon: 'zap',
    group: 'shortform',
    tier: 'starter',
    charLimit: 250,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [
      { width: 1080, height: 1920, label: 'Story (9:16)' },
    ],
    supportsVideo: true,
    shareUrl: () => 'https://www.snapchat.com',
    tone: 'Ultra casual. One punchy line. Like texting a friend. Maximum energy, minimum words. Fun, irreverent.',
    outputFormat: 'One or two short lines. Casual and energetic. No hashtags.',
    maxImages: 1,
    brandColor: '#FFFC00',
    imagePosition: 'above',
  },

  // ──────────────────────────────────────────────────────────
  // PROFESSIONAL
  // ──────────────────────────────────────────────────────────
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'linkedin',
    group: 'professional',
    tier: 'free',
    charLimit: 3000,
    hashtagStyle: 'block',
    maxHashtags: 5,
    imageDimensions: [
      { width: 1200, height: 628, label: 'Landscape' },
      { width: 1080, height: 1080, label: 'Square' },
    ],
    supportsVideo: true,
    shareUrl: (c) => `https://www.linkedin.com/sharing/share-offsite/?url=&summary=${encodeURIComponent(c)}`,
    tone: 'Open with a one-line personal hook — a lesson, a question, a realisation. Build with a short story or observation. Close with a takeaway. Professional but human. Never use "Excited to announce". Max 5 hashtags at the very end.',
    outputFormat: '3–5 short paragraphs. Hook → Story → Takeaway. Hashtags on the last line.',
    maxImages: 9,
    brandColor: '#0A66C2',
    imagePosition: 'below',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'facebook',
    group: 'professional',
    tier: 'free',
    charLimit: 63206,
    hashtagStyle: 'inline',
    maxHashtags: 3,
    imageDimensions: [
      { width: 1200, height: 628, label: 'Landscape' },
      { width: 1080, height: 1080, label: 'Square' },
    ],
    supportsVideo: true,
    shareUrl: (c) => `https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(c)}`,
    tone: 'Conversational and friendly. Slightly longer than Twitter. Light use of emojis where natural. Invites comments or reactions — end with a question or prompt. Feels like a friend sharing something interesting, not a brand posting.',
    outputFormat: '2–3 short paragraphs. End with a question. Light emojis optional.',
    maxImages: 10,
    brandColor: '#1877F2',
    imagePosition: 'below',
  },

  // ──────────────────────────────────────────────────────────
  // COMMUNITY
  // ──────────────────────────────────────────────────────────
  {
    id: 'reddit',
    name: 'Reddit',
    icon: 'message-circle',
    group: 'community',
    tier: 'free',
    charLimit: 40000,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [
      { width: 1200, height: 628, label: 'Landscape' },
      { width: 1080, height: 1080, label: 'Square' },
    ],
    supportsVideo: false,
    shareUrl: (c, extra) =>
      `https://reddit.com/submit?title=${encodeURIComponent(extra?.title ?? '')}&text=${encodeURIComponent(c)}${extra?.subreddit ? `&sr=${encodeURIComponent(extra.subreddit)}` : ''}`,
    tone: 'Sounds like a community member, not a brand. Honest, direct, self-aware. No marketing language ever. If you\'re sharing something you built, be upfront about it. Reddit hates stealth promotion. Use the community\'s tone — they can tell when you\'re faking it.',
    outputFormat: 'Title on first line. Body below. No hashtags. Conversational.',
    extraFields: ['subreddit', 'title'],
    maxImages: 20,
    brandColor: '#FF4500',
    imagePosition: 'below',
  },
  {
    id: 'hackernews',
    name: 'Hacker News',
    icon: 'terminal',
    group: 'community',
    tier: 'starter',
    charLimit: null,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [],
    supportsVideo: false,
    shareUrl: (c, extra) =>
      `https://news.ycombinator.com/submitlink?t=${encodeURIComponent(extra?.title ?? '')}&u=${encodeURIComponent(extra?.url ?? '')}`,
    tone: 'Technical, specific, humble. The HN audience is elite engineers and founders. No marketing words — ever. No buzzwords. Show the technical insight or the real story. If you\'re the builder, say Show HN: and be genuinely honest about what it does and what it doesn\'t.',
    outputFormat: 'HN post title (under 80 chars) on first line. Optional short description below. No hype, no adjectives like "revolutionary" or "amazing".',
    extraFields: ['title', 'url'],
    maxImages: 0,
    brandColor: '#FF6600',
    imagePosition: 'none',
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    icon: 'rocket',
    group: 'community',
    tier: 'starter',
    charLimit: null,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [
      { width: 1270, height: 760, label: 'Gallery' },
      { width: 240, height: 240, label: 'Logo' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://www.producthunt.com/posts/new',
    tone: 'Benefit-first. Launch energy without hype. Clear one-liner on what it does. Short tagline that makes someone stop scrolling. The maker comment should be personal — why you built it, what problem you had.',
    outputFormat: 'Tagline (under 60 chars) on line 1. Description (2–3 sentences) below. Then a short maker comment paragraph.',
    maxImages: 5,
    brandColor: '#DA552F',
    imagePosition: 'below',
  },
  {
    id: 'indiehackers',
    name: 'Indie Hackers',
    icon: 'code-2',
    group: 'community',
    tier: 'starter',
    charLimit: null,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [],
    supportsVideo: false,
    shareUrl: () => 'https://www.indiehackers.com/post',
    tone: 'Builder story. Raw and real. If there are metrics, share them — IH loves numbers. What you tried, what failed, what you learned. Never polished PR speak. The audience is other indie founders who will see through anything fake.',
    outputFormat: 'Post title on line 1. Story-style body with context, what happened, and what you learned. Numbers if available.',
    maxImages: 0,
    brandColor: '#0E2150',
    imagePosition: 'none',
  },
  {
    id: 'betalist',
    name: 'BetaList',
    icon: 'flask-conical',
    group: 'community',
    tier: 'pro',
    charLimit: 300,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [
      { width: 1200, height: 628, label: 'Landscape' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://betalist.com/startups/new',
    tone: 'Early-adopter energy. Lead with what\'s new and different. Crystal-clear one-liner on what the product does. The audience wants to discover something before everyone else does.',
    outputFormat: 'One-line product description. Short paragraph on what makes it early/new. CTA for beta signup.',
    maxImages: 1,
    brandColor: '#1C1C1C',
    imagePosition: 'below',
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: 'hash',
    group: 'community',
    tier: 'pro',
    charLimit: 2000,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [],
    supportsVideo: false,
    shareUrl: () => 'https://discord.com',
    tone: 'Community-first. Casual but clear. Feels like a message to a server you actually care about. Conversational, uses formatting (bold, code blocks) where it helps. Never sounds like a newsletter.',
    outputFormat: 'Short message format. Use **bold** for emphasis. Conversational and warm.',
    maxImages: 0,
    brandColor: '#5865F2',
    imagePosition: 'none',
  },

  // ──────────────────────────────────────────────────────────
  // LONG FORM
  // ──────────────────────────────────────────────────────────
  {
    id: 'medium',
    name: 'Medium',
    icon: 'book-open',
    group: 'longform',
    tier: 'starter',
    charLimit: null,
    hashtagStyle: 'block',
    maxHashtags: 5,
    imageDimensions: [
      { width: 1400, height: 787, label: 'Feature Image' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://medium.com/new-story',
    tone: 'Long-form narrative. Educational, thoughtful, thought leadership. Personal voice — write in first person. Assume smart readers who are busy. Strong hook sentence. Subheadings every 3–4 paragraphs. End with a genuine takeaway.',
    outputFormat: 'Title on line 1. Subtitle on line 2. Opening hook paragraph. Then 3–4 section headers with content. Closing paragraph. 5 tags at the end.',
    maxImages: 1,
    brandColor: '#000000',
    imagePosition: 'below',
  },
  {
    id: 'substack',
    name: 'Substack',
    icon: 'mail',
    group: 'longform',
    tier: 'pro',
    charLimit: null,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [
      { width: 1200, height: 628, label: 'Cover' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://substack.com',
    tone: 'Newsletter voice. Personal, warm, essay-like. Assumes an intelligent audience who subscribed because they trust you. Reads like a letter, not an article. First person. Opinion is welcome.',
    outputFormat: 'Subject line on line 1. Preview text on line 2. Then the newsletter body — personal opener, main idea, close with a call to reflect or reply.',
    maxImages: 1,
    brandColor: '#FF6719',
    imagePosition: 'below',
  },
  {
    id: 'quora',
    name: 'Quora',
    icon: 'help-circle',
    group: 'longform',
    tier: 'pro',
    charLimit: null,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [],
    supportsVideo: false,
    shareUrl: () => 'https://www.quora.com',
    tone: 'Question-answer format. Authoritative but conversational. Never promotional. Sounds like the most helpful person in the room, not someone with an agenda. Use personal experience where relevant.',
    outputFormat: 'Direct answer in first sentence. Then explanation with examples. No self-promotion.',
    maxImages: 0,
    brandColor: '#B92B27',
    imagePosition: 'none',
  },

  // ──────────────────────────────────────────────────────────
  // DEVELOPER
  // ──────────────────────────────────────────────────────────
  {
    id: 'devto',
    name: 'dev.to',
    icon: 'code',
    group: 'community',
    tier: 'starter',
    charLimit: null,
    hashtagStyle: 'block',
    maxHashtags: 4,
    imageDimensions: [
      { width: 1000, height: 420, label: 'Cover' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://dev.to/new',
    tone: 'Developer perspective. Technical accuracy matters more than polish. Educational opener. Code-friendly. Assumes a developer audience — don\'t over-explain basic concepts but do explain your specific choices.',
    outputFormat: 'Title on line 1. 4 tags on line 2 (no #). Article body with code examples if relevant. Conversational and educational.',
    maxImages: 1,
    brandColor: '#0A0A0A',
    imagePosition: 'below',
  },
  {
    id: 'hashnode',
    name: 'Hashnode',
    icon: 'hash',
    group: 'community',
    tier: 'starter',
    charLimit: null,
    hashtagStyle: 'block',
    maxHashtags: 5,
    imageDimensions: [
      { width: 1200, height: 630, label: 'Cover' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://hashnode.com',
    tone: 'Developer-first. Technical depth valued. Tutorial or explainer style. Show your reasoning, not just the answer. Hashnode readers are devs looking to learn something real.',
    outputFormat: 'Title. Subtitle. Introduction paragraph. Body with sections. Code blocks where relevant. Conclusion.',
    maxImages: 1,
    brandColor: '#2962FF',
    imagePosition: 'below',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: 'github',
    group: 'community',
    tier: 'pro',
    charLimit: null,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [
      { width: 1280, height: 640, label: 'Social Preview' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://github.com',
    tone: 'Technical, factual, no fluff. README quality. Explains what it does, why it exists, how to use it. Respects the reader\'s time. Links and code examples are welcome.',
    outputFormat: 'README-style. What it is → Why → Quick start → Links. Markdown formatting.',
    maxImages: 1,
    brandColor: '#24292E',
    imagePosition: 'below',
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow',
    icon: 'layers',
    group: 'community',
    tier: 'business',
    charLimit: null,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [],
    supportsVideo: false,
    shareUrl: () => 'https://stackoverflow.com',
    tone: 'Precise and technical. Community-appropriate — SO has strict quality standards. No marketing language at all. Answer the question directly with working code. Cite sources.',
    outputFormat: 'Direct answer first. Code block. Explanation. No promotional content.',
    maxImages: 0,
    brandColor: '#F48024',
    imagePosition: 'none',
  },

  // ──────────────────────────────────────────────────────────
  // VIDEO
  // ──────────────────────────────────────────────────────────
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'instagram',
    group: 'video',
    tier: 'free',
    charLimit: 2200,
    hashtagStyle: 'block',
    maxHashtags: 30,
    imageDimensions: [
      { width: 1080, height: 1080, label: 'Square' },
      { width: 1080, height: 1350, label: 'Portrait' },
      { width: 1080, height: 608, label: 'Landscape' },
      { width: 1080, height: 1920, label: 'Stories / Reels' },
    ],
    supportsVideo: true,
    shareUrl: () => 'https://www.instagram.com',
    tone: 'Visual-first language. Short punchy opening line. Emojis used naturally, not forced. Hashtags in a block after 2 line breaks — never inline. The caption should make someone stop scrolling. Emotional, aspirational, or curious hook.',
    outputFormat: 'Hook line. 2–3 sentences. Line break. Hashtag block (15–20 relevant hashtags).',
    maxImages: 10,
    brandColor: '#E1306C',
    imagePosition: 'above',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'music',
    group: 'video',
    tier: 'starter',
    charLimit: 2200,
    hashtagStyle: 'inline',
    maxHashtags: 5,
    imageDimensions: [
      { width: 1080, height: 1920, label: 'Vertical (9:16)' },
      { width: 1080, height: 1080, label: 'Square' },
    ],
    supportsVideo: true,
    shareUrl: () => 'https://www.tiktok.com',
    tone: 'Hook in the first 3 words — the viewer decides in 1 second. Script-style, written to be read aloud. Energetic and direct. Trending language is fine but don\'t force it. 3-act: hook → payoff → CTA.',
    outputFormat: 'Script format. Line 1: hook (under 8 words). Then short punchy lines. End with CTA. Caption with 3–5 hashtags after.',
    maxImages: 10,
    brandColor: '#FE2C55',
    imagePosition: 'above',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'youtube',
    group: 'video',
    tier: 'starter',
    charLimit: 5000,
    hashtagStyle: 'block',
    maxHashtags: 15,
    imageDimensions: [
      { width: 1280, height: 720, label: 'Thumbnail (HD)' },
      { width: 2560, height: 1440, label: 'Channel Art' },
    ],
    supportsVideo: true,
    shareUrl: () => 'https://studio.youtube.com',
    tone: 'Descriptive and keyword-rich for SEO. Strong opening sentence that sells the video. Educational or curiosity-driven. Description should give real value — timestamps, links, context. Not just a summary.',
    outputFormat: 'Title (under 70 chars) on line 1. Description with hook paragraph, then body, then hashtags at end. Thumbnail text suggestion on last line.',
    maxImages: 1,
    brandColor: '#FF0000',
    imagePosition: 'below',
  },
  {
    id: 'youtubeshorts',
    name: 'YouTube Shorts',
    icon: 'clapperboard',
    group: 'video',
    tier: 'pro',
    charLimit: 100,
    hashtagStyle: 'inline',
    maxHashtags: 3,
    imageDimensions: [
      { width: 1080, height: 1920, label: 'Vertical (9:16)' },
    ],
    supportsVideo: true,
    shareUrl: () => 'https://studio.youtube.com',
    tone: 'Ultra short script. Hook + payoff in under 60 seconds of speech. Vertical video context. High energy opening.',
    outputFormat: 'Title (under 100 chars). Script (hook → content → punch). 3 hashtags.',
    maxImages: 1,
    brandColor: '#FF0000',
    imagePosition: 'above',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    icon: 'pin',
    group: 'video',
    tier: 'starter',
    charLimit: 500,
    hashtagStyle: 'inline',
    maxHashtags: 20,
    imageDimensions: [
      { width: 1000, height: 1500, label: 'Standard Pin (2:3)' },
      { width: 1000, height: 1000, label: 'Square Pin' },
      { width: 2000, height: 3000, label: 'Long Pin' },
    ],
    supportsVideo: true,
    shareUrl: () => 'https://www.pinterest.com',
    tone: 'Discovery-focused and descriptive. Keyword-rich for Pinterest SEO. Aspirational and visual language. People pin things they want to save for later — write to that intent.',
    outputFormat: 'Title. Description with keywords naturally woven in. 10–15 hashtags.',
    maxImages: 1,
    brandColor: '#E60023',
    imagePosition: 'above',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    icon: 'tv-2',
    group: 'video',
    tier: 'pro',
    charLimit: 300,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [
      { width: 1920, height: 1080, label: 'Offline Banner' },
      { width: 440, height: 248, label: 'Preview' },
    ],
    supportsVideo: true,
    shareUrl: () => 'https://www.twitch.tv',
    tone: 'Community-first. Feels like a streamer talking to their chat, not an announcement. Casual, hype where warranted. Short and punchy for stream titles.',
    outputFormat: 'Stream title (under 140 chars). Short panel description. Chat announcement message.',
    maxImages: 1,
    brandColor: '#9146FF',
    imagePosition: 'above',
  },

  // ──────────────────────────────────────────────────────────
  // AUDIO
  // ──────────────────────────────────────────────────────────
  {
    id: 'clubhouse',
    name: 'Clubhouse',
    icon: 'mic',
    group: 'audio',
    tier: 'business',
    charLimit: 500,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [],
    supportsVideo: false,
    shareUrl: () => 'https://www.clubhouse.com',
    tone: 'Audio context — written as a room description. Topic clearly stated upfront. 3–5 talking points as bullet structure. Inviting tone that makes someone want to join and listen.',
    outputFormat: 'Room title. What will be discussed (3–5 bullets). Who should join.',
    maxImages: 0,
    brandColor: '#F1EFE7',
    imagePosition: 'none',
  },

  // ──────────────────────────────────────────────────────────
  // DESIGN
  // ──────────────────────────────────────────────────────────
  {
    id: 'dribbble',
    name: 'Dribbble',
    icon: 'figma',
    group: 'design',
    tier: 'pro',
    charLimit: 1200,
    hashtagStyle: 'inline',
    maxHashtags: 10,
    imageDimensions: [
      { width: 800, height: 600, label: 'Shot (4:3)' },
      { width: 1600, height: 1200, label: 'Shot 2x' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://dribbble.com/shots/new',
    tone: 'Visual-first language. Focus on design decisions, color choices, typographic reasoning, and craft. Brief and confident. Designers appreciate specificity over vagueness.',
    outputFormat: 'Short description of design intent and key decisions. Tags relevant to the craft.',
    maxImages: 4,
    brandColor: '#EA4C89',
    imagePosition: 'above',
  },
  {
    id: 'behance',
    name: 'Behance',
    icon: 'layout-dashboard',
    group: 'design',
    tier: 'business',
    charLimit: null,
    hashtagStyle: 'inline',
    maxHashtags: 15,
    imageDimensions: [
      { width: 1400, height: 1050, label: 'Project Cover' },
      { width: 808, height: 606, label: 'Project Image' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://www.behance.net',
    tone: 'Portfolio voice. Describes creative process, intent, and outcome. What was the brief, what were the constraints, what decisions were made and why. Thoughtful and articulate.',
    outputFormat: 'Project title. Overview paragraph. Process section. Outcome section.',
    maxImages: 10,
    brandColor: '#1769FF',
    imagePosition: 'above',
  },

  // ──────────────────────────────────────────────────────────
  // MESSAGING
  // ──────────────────────────────────────────────────────────
  {
    id: 'telegram',
    name: 'Telegram',
    icon: 'send',
    group: 'messaging',
    tier: 'pro',
    charLimit: 4096,
    hashtagStyle: 'inline',
    maxHashtags: 3,
    imageDimensions: [
      { width: 1280, height: 720, label: 'Media' },
    ],
    supportsVideo: true,
    shareUrl: (c) => `https://t.me/share/url?text=${encodeURIComponent(c)}`,
    tone: 'Direct and concise. Reads well in a channel context. Clear and actionable. Slightly more formal than WhatsApp but not corporate.',
    outputFormat: 'Short channel message. Clear, direct. Optional 1–3 hashtags.',
    maxImages: 10,
    brandColor: '#26A5E4',
    imagePosition: 'below',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: 'hash',
    group: 'messaging',
    tier: 'business',
    charLimit: 40000,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [],
    supportsVideo: false,
    shareUrl: () => 'https://slack.com',
    tone: 'Professional-casual. Clear, short, action-oriented. Slack messages are read fast — get to the point. Use formatting (*bold*, _italic_, `code`) where it helps clarity. No corporate speak.',
    outputFormat: 'Short message. Key info up front. Action or next steps at end. Markdown formatting.',
    maxImages: 0,
    brandColor: '#4A154B',
    imagePosition: 'none',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: 'message-square',
    group: 'messaging',
    tier: 'business',
    charLimit: 65536,
    hashtagStyle: 'none',
    maxHashtags: 0,
    imageDimensions: [
      { width: 1600, height: 900, label: 'Status' },
    ],
    supportsVideo: true,
    shareUrl: (c) => `https://api.whatsapp.com/send?text=${encodeURIComponent(c)}`,
    tone: 'Personal, warm, like a message to a group you actually know. Conversational. Emojis used naturally. Never sounds like a press release.',
    outputFormat: 'Short warm message. Friendly opener. Core info. Natural close.',
    maxImages: 1,
    brandColor: '#25D366',
    imagePosition: 'below',
  },

  // ──────────────────────────────────────────────────────────
  // LIFESTYLE
  // ──────────────────────────────────────────────────────────
  {
    id: 'lemon8',
    name: 'Lemon8',
    icon: 'sparkles',
    group: 'shortform',
    tier: 'business',
    charLimit: 2200,
    hashtagStyle: 'block',
    maxHashtags: 20,
    imageDimensions: [
      { width: 1080, height: 1350, label: 'Portrait' },
      { width: 1080, height: 1080, label: 'Square' },
    ],
    supportsVideo: false,
    shareUrl: () => 'https://www.lemon8-app.com',
    tone: 'Lifestyle-forward, visually descriptive, hashtag-friendly. Instagram-adjacent but warmer and more community-driven. Feels like sharing with friends who care about the same aesthetic.',
    outputFormat: 'Warm lifestyle caption. Short hook. 2–3 descriptive sentences. Hashtag block.',
    maxImages: 9,
    brandColor: '#FFE043',
    imagePosition: 'above',
  },
]

// ──────────────────────────────────────────────────────────
// FREE TIER PLATFORM WHITELIST
// ──────────────────────────────────────────────────────────
// Any paid plan (starter / pro / business) unlocks ALL platforms.
// Only free-tier users are restricted to this explicit whitelist.
// To add/remove a free platform, edit this array — nowhere else.

export const FREE_PLATFORM_IDS: readonly string[] = [
  'twitter',
  'threads',
  'bluesky',
  'linkedin',
  'facebook',
  'reddit',
  'instagram',
] as const

// ⚠️  SYNC REQUIRED
// This file is duplicated at frontend/src/config/platforms.ts
// Any change here MUST be reflected there too.
// Both files must always be identical in their access-control logic.

// ──────────────────────────────────────────────────────────
// DERIVED HELPERS
// ──────────────────────────────────────────────────────────

export const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map(p => [p.id, p]))

export const PLATFORMS_BY_TIER: Record<PlatformTier, Platform[]> = {
  free:     PLATFORMS.filter(p => FREE_PLATFORM_IDS.includes(p.id)),
  starter:  PLATFORMS,
  pro:      PLATFORMS,
  business: PLATFORMS,
}

export const PLATFORMS_BY_GROUP = PLATFORMS.reduce((acc, p) => {
  if (!acc[p.group]) acc[p.group] = []
  acc[p.group].push(p)
  return acc
}, {} as Record<PlatformGroup, Platform[]>)

export const TIER_LIMITS: Record<PlatformTier, { generations: number; platforms: number }> = {
  free:     { generations: 5,    platforms: FREE_PLATFORM_IDS.length },
  starter:  { generations: 50,   platforms: PLATFORMS.length },
  pro:      { generations: 200,  platforms: PLATFORMS.length },
  business: { generations: 1000, platforms: PLATFORMS.length },
}

export function getPlatformsForTier(tier: PlatformTier): Platform[] {
  return PLATFORMS_BY_TIER[tier]
}

export function isPlatformAccessible(platformId: string, tier: PlatformTier): boolean {
  if (!PLATFORM_MAP[platformId]) return false
  // Any paid plan gets full access to all platforms.
  // Only free tier is restricted to the FREE_PLATFORM_IDS whitelist.
  if (tier !== 'free') return true
  return FREE_PLATFORM_IDS.includes(platformId)
}
// Platform config version — bump when any platform's limits or tones change
export const PLATFORM_CONFIG_VERSION = '1.0.0'

