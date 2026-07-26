// config/platformPages.ts
//
// Data source for PostMaker's platform-specific landing pages (/tools/:slug).
// Follows the exact extension-point pattern of vsPages.ts and forPages.ts.

export interface PlatformFeature {
  title: string
  description: string
}

export interface PlatformFAQ {
  question: string
  answer: string
}

export interface PlatformPageEntry {
  /** URL slug, resolves to /tools/:slug */
  slug: string
  /** References the platform.id from config/platforms.ts */
  platformId: string
  /** Clean name for display, e.g. "LinkedIn" */
  platformName: string
  /** <title> tag content */
  title: string
  /** Meta description */
  description: string
  /** H1 displayed on the page */
  h1: string
  /** Subheading displayed under the H1 */
  heroSubheading: string
  /** Multi-sentence descriptive introduction */
  introText: string
  /** Targeted audience for this platform */
  audienceDescription: string
  /** Formatting tip specific to the platform */
  formattingTip: string
  /** Contrast details of platform-optimized vs lazy cross-posts */
  postMakerVsGeneric: {
    platformSpecific: string
    genericCrossPost: string
    explanation: string
  }
  /** Unique platform features provided by PostMaker */
  features: PlatformFeature[]
  /** FAQs for visible accordion and FAQPage schema injection */
  faqs: PlatformFAQ[]
  /** Tailored CTA button text */
  ctaText: string
  ogImage?: string
}

export const platformPages: PlatformPageEntry[] = [
  {
    slug: 'linkedin',
    platformId: 'linkedin',
    platformName: 'LinkedIn',
    title: 'Free AI LinkedIn Post Generator & Formatter | PostMaker',
    description: 'Generate properly formatted, high-engagement LinkedIn posts with a structured hook-story-takeaway layout. Elevate your professional personal brand.',
    h1: 'AI LinkedIn Post Generator',
    heroSubheading: 'Format professional, story-driven posts that build connections and drive B2B engagement.',
    introText: 'LinkedIn is the premier network for professional thought leadership, but writing there requires a balance of story-telling and clean typography. Walls of text are ignored. PostMaker shapes your ideas into standard hook-story-takeaway layouts with proper white space, bullet points, and high-context hashtags to ensure your personal brand stands out in the feed.',
    audienceDescription: 'Founders, executives, product managers, and B2B marketers looking to build professional authority.',
    formattingTip: 'Start with a single-line hook, separate paragraphs with double line-breaks, keep paragraphs under three lines, use bullet lists for scannability, and restrict hashtags to 3-5 relevant ones at the bottom.',
    postMakerVsGeneric: {
      platformSpecific: 'An engaging story-led post structured with a hook, narrative progression, clear takeaway bullets, and 3 clean hashtags at the end.',
      genericCrossPost: 'A raw link preview or a short sentence with irrelevant hashtags copied from Twitter.',
      explanation: 'LinkedIn\'s algorithm demotes lazy link dumps and promotes text posts that retain user attention through readable formatting and professional storytelling.'
    },
    features: [
      {
        title: 'Hook-Story-Takeaway Structure',
        description: 'Builds authority by structuring your professional lessons and insights logically.'
      },
      {
        title: 'Whitespace Optimization',
        description: 'Injects readable line breaks so readers stay on your post without eye strain.'
      },
      {
        title: 'B2B Tone Adaptation',
        description: 'Maintains a professional, humble, yet authoritative voice that resonates with peers.'
      }
    ],
    faqs: [
      {
        question: 'How long should a LinkedIn post be?',
        answer: 'While the character limit is 3,000, the highest-performing posts range between 1,000 to 2,000 characters, formatted with abundant white space.'
      },
      {
        question: 'Where should I place hashtags on LinkedIn?',
        answer: 'Always place them in a clean block at the very bottom of the post. Mixing them inline breaks readability and reduces user engagement.'
      }
    ],
    ctaText: 'Generate LinkedIn Post'
  },
  {
    slug: 'instagram',
    platformId: 'instagram',
    platformName: 'Instagram',
    title: 'AI Instagram Caption Generator & Formatter | PostMaker',
    description: 'Create scroll-stopping Instagram captions with natural emoji placement, clean line breaks, and optimized hashtag blocks to boost your organic reach.',
    h1: 'AI Instagram Caption Generator',
    heroSubheading: 'Generate engaging, aesthetic captions with clean line breaks and optimized hashtag blocks.',
    introText: 'Instagram is a visual-first platform, but the caption is what turns impressions into comments and saves. PostMaker solves the notorious Instagram formatting issue by rendering clean, predictable line breaks. It weaves emojis naturally into your story and packages up to 30 relevant hashtags in a separate block below the text to preserve a clean, premium brand aesthetic.',
    audienceDescription: 'E-commerce brands, creators, lifestyle coaches, and visual artists looking to tell engaging stories.',
    formattingTip: 'Write a compelling first line to prevent truncation behind the \'more\' button. Use emojis to guide the reader\'s eye, and hide your hashtag block under a line break to keep the caption clean.',
    postMakerVsGeneric: {
      platformSpecific: 'A structured story-based caption with interactive emojis, clean line breaks, and a separated block of 15-20 relevant hashtags.',
      genericCrossPost: 'A short sentence with a dump of inline hashtags and no spacing, causing the paragraph to collapse into a single text wall.',
      explanation: 'Clean captions look more professional and increase read-through rates, leading to higher engagement signals in the Instagram algorithm.'
    },
    features: [
      {
        title: 'Smart Emojis',
        description: 'Embeds visual cues relevant to your topic without spamming or cluttering the layout.'
      },
      {
        title: 'Clean Line Breaks',
        description: 'Ensures your caption formatting never collapses in the mobile app feed.'
      },
      {
        title: 'Hashtag Organizer',
        description: 'Separates your tag block from the main copy so your brand presentation remains polished.'
      }
    ],
    faqs: [
      {
        question: 'Why do my Instagram captions collapse?',
        answer: 'Instagram collapses consecutive empty lines. PostMaker pre-formats the text block so that it renders with proper spacing in the mobile feed.'
      },
      {
        question: 'How many hashtags should I use on Instagram?',
        answer: 'Instagram allows up to 30, but highly relevant tags placed at the bottom deliver the best balance of reach and presentation.'
      }
    ],
    ctaText: 'Create Instagram Caption'
  },
  {
    slug: 'twitter',
    platformId: 'twitter',
    platformName: 'Twitter/X',
    title: 'AI Twitter & X Post Generator | PostMaker',
    description: 'Generate punchy, high-signal tweets that fit perfectly within the 280-character limit. Maximize your visibility in the algorithm.',
    h1: 'AI Twitter / X Post Maker',
    heroSubheading: 'Write high-signal, concise posts that capture attention in real-time feeds.',
    introText: 'Writing for X (Twitter) is about speed, clarity, and density. With a 280-character limit for standard users, you have seconds to deliver value. PostMaker strips away marketing fluff to write high-density, conversational tweets. It places up to 2 high-impact hashtags inline only if they provide search value, keeping your message focused and shareable.',
    audienceDescription: 'Software engineers, indie makers, crypto builders, and tech founders sharing updates.',
    formattingTip: 'Lead with your strongest statement, keep the length under 250 characters to leave room for quote-retweets, and limit hashtags to a maximum of two.',
    postMakerVsGeneric: {
      platformSpecific: 'A single-sentence declaration or a clean 2-line tip with a maximum of one or two inline hashtags.',
      genericCrossPost: 'A long narrative paragraph truncated with a broken link or a wall of text that gets cut off.',
      explanation: 'X is a fast-paced conversation. Users ignore text blocks that look like they were cross-posted from longer platforms.'
    },
    features: [
      {
        title: 'Character Constraint Guard',
        description: 'Ensures every output fits cleanly within the standard 280-character limit.'
      },
      {
        title: 'Hype-Free Phrasing',
        description: 'Removes generic adjectives to deliver high-density, authoritative copy.'
      },
      {
        title: 'Inline Hashtag Smart Placement',
        description: 'Integrates tags naturally into the sentence structure instead of grouping them at the end.'
      }
    ],
    faqs: [
      {
        question: 'What is the character limit on X?',
        answer: 'Standard accounts have a limit of 280 characters. PostMaker optimizes all outputs to fit within this constraint by default.'
      },
      {
        question: 'Should I use hashtags on X/Twitter?',
        answer: 'Yes, but sparingly. One or two highly specific hashtags inline can help you get discovered in search without looking like spam.'
      }
    ],
    ctaText: 'Write Tweet'
  },
  {
    slug: 'tiktok',
    platformId: 'tiktok',
    platformName: 'TikTok',
    title: 'AI TikTok Caption & Script Outline Generator | PostMaker',
    description: 'Generate high-retention TikTok video captions and spoken script outlines structured to hook viewers in the first 3 seconds.',
    h1: 'AI TikTok Script & Caption Maker',
    heroSubheading: 'Structure your video concepts with a 3-second hook and high-engagement captions.',
    introText: 'TikTok is driven by visual retention. The first 3 seconds of your video determine if viewers stay or swipe. PostMaker approaches TikTok differently: it generates both a spoken script outline (hook → payoff → CTA) to guide your recording, and a short, curiosity-driven caption with 3-5 relevant hashtags to optimize for TikTok SEO search indexing.',
    audienceDescription: 'Short-form creators, direct-to-consumer brands, and video educators growing an organic following.',
    formattingTip: 'Start your video script with a visual or verbal pattern interrupt. Keep your written caption under 150 characters but include keyword-rich phrases for TikTok Search optimization.',
    postMakerVsGeneric: {
      platformSpecific: 'A script structured for speech (hook, body, payoff) paired with a short, SEO-optimized caption and 3-5 tags.',
      genericCrossPost: 'A static marketing description that does not translate to spoken video content.',
      explanation: 'TikTok is a video platform; captions must support search discovery while scripts must capture immediate physical attention.'
    },
    features: [
      {
        title: '3-Second Hook Architect',
        description: 'Generates verbal hooks to maximize immediate video retention and prevent scroll-past.'
      },
      {
        title: 'TikTok Search Optimization',
        description: 'Weaves key search terms into your caption so your videos rank in TikTok search.'
      },
      {
        title: 'Short-Form Script Structure',
        description: 'Provides a clear, step-by-step roadmap to record your video content efficiently.'
      }
    ],
    faqs: [
      {
        question: 'Does TikTok care about captions?',
        answer: 'Yes, TikTok is increasingly used as a search engine. Keyword-rich captions are essential for getting your videos indexed correctly.'
      },
      {
        question: 'How long should my TikTok video hook be?',
        answer: 'Your hook must land in under 3 seconds, verbally or visually, to prevent the user from scrolling past.'
      }
    ],
    ctaText: 'Generate TikTok Script'
  },
  {
    slug: 'facebook',
    platformId: 'facebook',
    platformName: 'Facebook',
    title: 'AI Facebook Post Generator for Business & Pages | PostMaker',
    description: 'Write warm, conversational Facebook posts optimized to drive comments, shares, and high feed algorithm visibility for your business.',
    h1: 'AI Facebook Post Generator',
    heroSubheading: 'Format posts that build community and drive organic comment section engagement.',
    introText: 'The Facebook feed algorithm prioritizes meaningful social interactions, especially comments and shares. Broadcasting a link doesn\'t work. PostMaker formats warm, conversational updates that read like a friend sharing a recommendation. It places 2-3 inline hashtags naturally and always concludes with a question to start a conversation in the comments.',
    audienceDescription: 'Local businesses, service providers, community leaders, and brand pages looking to connect.',
    formattingTip: 'Avoid posting bare links; instead, write an engaging text summary and ask a question at the end to invite discussion.',
    postMakerVsGeneric: {
      platformSpecific: 'A 2-3 paragraph conversational post that builds context, uses friendly emojis, and ends with a question to invite responses.',
      genericCrossPost: 'An automated link preview without text, or a dry corporate press release.',
      explanation: 'The Facebook algorithm penalizes links that pull users off-site unless the post generates active comment engagement.'
    },
    features: [
      {
        title: 'Comment Triggers',
        description: 'Concludes posts with conversational questions that encourage readers to reply.'
      },
      {
        title: 'Community Tone',
        description: 'Balances business announcements with a warm, personal touch to build affinity.'
      },
      {
        title: 'Visual Scannability',
        description: 'Uses emojis and short paragraph blocks to make posts easy to read on mobile devices.'
      }
    ],
    faqs: [
      {
        question: 'Do hashtags work on Facebook?',
        answer: 'Yes, but they are less critical than on Instagram. Limit yourself to 2 or 3 relevant hashtags to aid in search without cluttering the text.'
      },
      {
        question: 'How do I get more organic reach on Facebook?',
        answer: 'Create posts that prompt people to write comments. The algorithm ranks posts higher when friends and followers engage in discussions under them.'
      }
    ],
    ctaText: 'Write Facebook Post'
  },
  {
    slug: 'pinterest',
    platformId: 'pinterest',
    platformName: 'Pinterest',
    title: 'AI Pinterest Pin Description Generator | PostMaker',
    description: 'Create search-optimized Pin titles and descriptions rich in keywords to drive consistent long-term traffic to your site.',
    h1: 'AI Pinterest Pin Generator',
    heroSubheading: 'Generate search-optimized descriptions and titles that drive visual discoveries.',
    introText: 'Pinterest is not a social network; it is a visual search engine. Pins can drive traffic to your website for months or even years after posting, but only if they are properly indexed. PostMaker generates descriptive titles and keyword-rich Pin descriptions that match what users are actively searching for, alongside 10-15 relevant hashtags to maximize visual search discoverability.',
    audienceDescription: 'E-commerce sellers, bloggers, designers, and visual creators seeking passive web traffic.',
    formattingTip: 'Include your primary search keywords in both the title and the first sentence of your description. Use a clear call-to-action urging users to click the link.',
    postMakerVsGeneric: {
      platformSpecific: 'An inspirational description that details what the user will find, woven with organic keywords and followed by visual hashtags.',
      genericCrossPost: 'A short sentence like "Check out this product!" copied from a direct sales page.',
      explanation: 'Pinterest users look for ideas, tutorials, and inspiration. Descriptions must sell the value of the destination link.'
    },
    features: [
      {
        title: 'Pinterest SEO Keywords',
        description: 'Weaves search terms into the description to improve visual search indexing.'
      },
      {
        title: 'Click-Through CTAs',
        description: 'Crafts compelling calls-to-action to encourage users to click through to your website.'
      },
      {
        title: 'Aspirational Copywriting',
        description: 'Drafts text matching the inspirational and planning mindset of Pinterest users.'
      }
    ],
    faqs: [
      {
        question: 'How long should a Pin description be?',
        answer: 'Pinterest allows up to 500 characters, and it is best to use as much of this space as possible to include keywords and context.'
      },
      {
        question: 'Do hashtags matter on Pinterest?',
        answer: 'Yes, hashtags help new Pins get indexed in chronological search feeds. Using 5 to 10 relevant hashtags at the bottom is highly recommended.'
      }
    ],
    ctaText: 'Generate Pin Details'
  },
  {
    slug: 'youtube',
    platformId: 'youtube',
    platformName: 'YouTube',
    title: 'AI YouTube Video Description & Title Generator | PostMaker',
    description: 'Generate optimized video titles and structured, keyword-rich descriptions to improve your video search rankings and click-through rates.',
    h1: 'AI YouTube Video Generator',
    heroSubheading: 'Write search-friendly titles and structured descriptions that rank in YouTube search.',
    introText: 'YouTube is the second largest search engine in the world. Getting views requires an engaging title that drives click-throughs, and a description that tells the algorithm exactly what your video is about. PostMaker generates compelling titles under 70 characters and structured descriptions that include an opening hook, value summary, and relevant search tags.',
    audienceDescription: 'Vloggers, educators, reviewers, and brand video teams publishing longer content.',
    formattingTip: 'Place your primary keyword near the beginning of your title. Use the first 2 lines of your description to pitch the video, as this is what shows in search results.',
    postMakerVsGeneric: {
      platformSpecific: 'An optimized title (under 70 characters) paired with a multi-section description (hook, outline, links, and hashtags).',
      genericCrossPost: 'A single sentence description or a dry transcript dump.',
      explanation: 'A structured description helps YouTube index your video for relevant search queries, while a clean title improves click-through rate.'
    },
    features: [
      {
        title: 'CTR-Optimized Titles',
        description: 'Creates titles designed to capture curiosity without using deceptive clickbait.'
      },
      {
        title: 'Algorithmic Indexing',
        description: 'Weaves search keywords into the description to assist YouTube\'s ranking systems.'
      },
      {
        title: 'Structured Outlines',
        description: 'Organizes description content with clear sections for easy reading.'
      }
    ],
    faqs: [
      {
        question: 'How long should a YouTube title be?',
        answer: 'Keep titles under 70 characters. Longer titles will be truncated in search listings and mobile feeds.'
      },
      {
        question: 'How many hashtags should I use on YouTube?',
        answer: 'Use 3 to 5 highly relevant hashtags at the very bottom. If you use more than 15, YouTube will ignore all hashtags on your video.'
      }
    ],
    ctaText: 'Generate Video Details'
  },
  {
    slug: 'threads',
    platformId: 'threads',
    platformName: 'Threads',
    title: 'AI Threads Post Generator (No Hashtags) | PostMaker',
    description: 'Create natural, conversational Threads posts that fit the platform\'s unique culture. Text-first formatting optimized for engagement.',
    h1: 'AI Threads Post Maker',
    heroSubheading: 'Format casual, text-first updates designed for community discussions.',
    introText: 'Threads is built for conversation, not broadcasting. It has a culture that values authenticity, humor, and personal reflections. Corporate announcements feel out of place. PostMaker writes Threads posts in a casual, conversational tone—like texting a smart friend. It enforces the platform\'s character limit and excludes conventional hashtag symbols completely, as Threads uses custom tag topics instead.',
    audienceDescription: 'Writers, creators, professionals, and brands seeking authentic engagement on Threads.',
    formattingTip: 'Write in first-person, keep the tone relaxed, and invite conversation. Do not use hashtags; instead, rely on clean, unadorned text.',
    postMakerVsGeneric: {
      platformSpecific: 'A personal, conversational text update of 2-3 sentences with clean spacing and zero hashtag characters.',
      genericCrossPost: 'A promo post littered with hashtags and sales-pitch vocabulary.',
      explanation: 'Threads users are highly sensitive to corporate cross-posting. Clean, human-sounding text is the only format that builds trust.'
    },
    features: [
      {
        title: 'Hashtag-Free Output',
        description: 'Automatically strips out hash symbols to match the platform\'s native aesthetic.'
      },
      {
        title: 'Conversational Tone',
        description: 'Writes in a relaxed, friendly, first-person voice to invite comments.'
      },
      {
        title: 'Thread Spacing',
        description: 'Ensures paragraph divisions feel natural and readable on mobile screens.'
      }
    ],
    faqs: [
      {
        question: 'Can you use hashtags on Threads?',
        answer: 'Threads does not use conventional hashtags. Instead, you can tag topics. PostMaker avoids hashtag symbols to keep posts looking native.'
      },
      {
        question: 'What is the character limit on Threads?',
        answer: 'Threads has a limit of 500 characters per post, which is plenty of room for an engaging statement.'
      }
    ],
    ctaText: 'Write Threads Post'
  }
]

export async function getPlatformPagesRegistry(): Promise<PlatformPageEntry[]> {
  return platformPages
}
