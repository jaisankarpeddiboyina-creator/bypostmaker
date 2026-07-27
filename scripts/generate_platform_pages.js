const fs = require('fs');
const path = require('path');

// Existing 8 handcrafted platform pages
const HANDCRAFTED_PAGES = [
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
    heroSubheading: 'Write engaging captions with clean spacing, active hooks, and smart hashtag groups.',
    introText: 'Instagram is a visual-first platform, but the caption is what drives saves, comments, and shares. Captions with messy layouts or blocks of hashtags mixed in the text hurt engagement. PostMaker formats clean, readable spacing, integrates context-aware emojis, and appends a clean hashtag block separated from your main message to maximize your reach and visibility.',
    audienceDescription: 'Content creators, influencer marketers, brand managers, and ecommerce shops looking to grow their following.',
    formattingTip: 'Put the hook in the first 125 characters (before the "more" button), use clean line breaks (no periods for spacing needed), use emojis to break up sections, and place hashtags at the very end.',
    postMakerVsGeneric: {
      platformSpecific: 'A structured caption with an immediate hook, bulleted details, clean space, and a separate hashtag block.',
      genericCrossPost: 'A block of unformatted text with no line breaks and hashtags scattered everywhere.',
      explanation: 'Instagram hides captions after two lines. PostMaker ensures your hook is fully visible and the rest of the text is structured for clean reading.'
    },
    features: [
      {
        title: 'Instant Hook Placement',
        description: 'Puts the most engaging hook line at the very front to capture scrolling users.'
      },
      {
        title: 'Perfect Caption Line Breaks',
        description: 'Formats your caption with clean visual spaces without requiring arbitrary symbol dividers.'
      },
      {
        title: 'Contextual Emoji Layout',
        description: 'Adds brand-aligned, modern emojis naturally to drive readability and interaction.'
      }
    ],
    faqs: [
      {
        question: 'Do Instagram captions affect search SEO?',
        answer: 'Yes! Instagram uses caption keywords for search results. PostMaker naturally weaves primary topic keywords into your captions to help you rank in search.'
      },
      {
        question: 'How many hashtags should I include?',
        answer: 'While the limit is 30, highly engaged captions usually perform best with 5 to 15 targeted, relevant hashtags placed at the bottom.'
      }
    ],
    ctaText: 'Write Instagram Caption'
  },
  {
    slug: 'twitter',
    platformId: 'twitter',
    platformName: 'X / Twitter',
    title: 'AI Twitter (X) Tweet & Thread Generator | PostMaker',
    description: 'Write high-impact tweets and viral threads optimized for the X / Twitter algorithm. Boost impressions, bookmarks, and retweets.',
    h1: 'AI X / Twitter Post Generator',
    heroSubheading: 'Craft punchy, high-signal tweets and structured threads that hook readers and go viral.',
    introText: 'X (formerly Twitter) is fast-paced and demands maximum signal in minimum characters. Standard marketing copy gets scrolled past. PostMaker compresses your ideas into punchy, high-impact tweets under the 280-character limit, or structures multi-part threads with high-converting hook setups to maximize replies, bookmarks, and retweets.',
    audienceDescription: 'Tech founders, creators, journalists, and brand strategists looking to grow an active audience.',
    formattingTip: 'Open with an interesting statistic or polarizing question, keep the first line under 100 characters, avoid heavy emoji usage, and end threads with a clear call-to-action.',
    postMakerVsGeneric: {
      platformSpecific: 'A clean, high-signal tweet presenting a single key insight, followed by an optimized thread link if necessary.',
      genericCrossPost: 'A long paragraph copied from a blog post that gets cut off or looks awkward in a tweet box.',
      explanation: 'X rewards brevity and conversation. PostMaker outputs single-concept ideas that naturally invite replies, bookmarks, and thread clicks.'
    },
    features: [
      {
        title: 'Signal-to-Noise Compression',
        description: 'Removes filler words to write concise, impactful tweets under the character limit.'
      },
      {
        title: 'Thread Hook Formulation',
        description: 'Structures the opening tweet of threads to promise high value, forcing users to click and read.'
      },
      {
        title: 'Algorithm-Friendly Layout',
        description: 'Avoids external links in main tweets when possible to ensure maximum reach.'
      }
    ],
    faqs: [
      {
        question: 'What length is best for a tweet on X?',
        answer: 'Even with premium long-form tweets, short posts (between 100 and 200 characters) generate the highest click-through and reply rates.'
      },
      {
        question: 'Should I use hashtags on X / Twitter?',
        answer: 'Keep them to a minimum (1 or 2 at most). Flooding tweets with hashtags reduces engagement and looks spammy to the current algorithm.'
      }
    ],
    ctaText: 'Write Tweet / Thread'
  },
  {
    slug: 'tiktok',
    platformId: 'tiktok',
    platformName: 'TikTok',
    title: 'AI TikTok Caption & Video Script Generator | PostMaker',
    description: 'Generate high-hook TikTok captions, trending hashtags, and video script outlines. Optimize your content for the TikTok FYP search algorithm.',
    h1: 'AI TikTok Video Copy Writer',
    heroSubheading: 'Draft attention-grabbing captions and quick video outlines optimized for viral reach.',
    introText: 'TikTok is driven by video hooks and keywords. The caption is crucial for TikTok SEO, helping the algorithm categorize your video for the FYP (For You Page) search engine. PostMaker creates short, high-energy captions with highly relevant, high-traffic hashtags, along with quick visual hooks that keep viewers watching past the critical 3-second mark.',
    audienceDescription: 'Creators, video editors, and brands seeking organic reach on mobile video feeds.',
    formattingTip: 'Include your main target keyword in the first sentence, keep captions short, use popular tag clusters, and write video title cards that immediately establish the benefit.',
    postMakerVsGeneric: {
      platformSpecific: 'A punchy, interactive caption that asks a question to drive comments, accompanied by trending keyword tags.',
      genericCrossPost: 'A dry, formal paragraph with no energy or visual cues.',
      explanation: 'TikTok comments drive virality. PostMaker structures captions to ask engaging questions that encourage immediate viewer replies.'
    },
    features: [
      {
        title: 'TikTok SEO Keyword Targeter',
        description: 'Naturally weaves searchable terms into the caption to help your video appear in search results.'
      },
      {
        title: 'Engagement Prompters',
        description: 'Drafts conversational, polarizing, or open-ended prompts to boost comment velocity.'
      },
      {
        title: 'Hook-Oriented Structure',
        description: 'Optimized for high-retention video formats to stop users from swiping away.'
      }
    ],
    faqs: [
      {
        question: 'How long should a TikTok caption be?',
        answer: 'Keep it brief (under 150 characters) so it doesn\'t block the video screen, but make sure to include your primary search keywords.'
      },
      {
        question: 'How does TikTok search SEO work?',
        answer: 'TikTok ranks videos based on keywords in the video caption, the video sound, and the text on screen. PostMaker optimizes caption text for these search bots.'
      }
    ],
    ctaText: 'Write TikTok Copy'
  },
  {
    slug: 'facebook',
    platformId: 'facebook',
    platformName: 'Facebook',
    title: 'AI Facebook Post & Ad Copy Generator | PostMaker',
    description: 'Write engaging Facebook posts and high-converting ad copy. Build community, increase post shares, and drive organic link clicks.',
    h1: 'AI Facebook Post Creator',
    heroSubheading: 'Write conversational posts and social ad copy that spark discussions and drive shares.',
    introText: 'Facebook groups and pages reward community discussions and family-style sharing. Corporate jargon or dry links get buried. PostMaker optimizes your ideas into warm, conversational updates that prompt comments, invite reactions, and structure links to maintain high organic reach and engagement on both profiles and business pages.',
    audienceDescription: 'Local businesses, community managers, and social media marketers building brand loyalty.',
    formattingTip: 'Open with a friendly question, break text into short readable paragraphs, keep calls-to-action conversational, and limit hashtags to 1-2 relevant tags.',
    postMakerVsGeneric: {
      platformSpecific: 'A friendly, community-first update ending with an open question, formatted with clean spacing.',
      genericCrossPost: 'A copy-paste of a long, dry press release with a wall of text.',
      explanation: 'Facebook\'s algorithm ranks posts higher when friends and family interact in the comment section. PostMaker builds comments in mind.'
    },
    features: [
      {
        title: 'Discussion Starters',
        description: 'Designs prompts that encourage followers to share their own experiences in the comments.'
      },
      {
        title: 'Clean Link Formatting',
        description: 'Optimizes paragraph placement around external links to maximize click-through rate.'
      },
      {
        title: 'Friendly Brand Tone',
        description: 'Maintains an approachable, helpful tone that builds community trust.'
      }
    ],
    faqs: [
      {
        question: 'Do hashtags work on Facebook?',
        answer: 'Yes, but sparingly. 1 or 2 relevant hashtags can help discoverability in groups and search, but more than that reduces engagement.'
      },
      {
        question: 'What is the best post format for Facebook engagement?',
        answer: 'Posts that ask an open-ended question or share a short, authentic story with clean paragraph breaks generate the highest reach.'
      }
    ],
    ctaText: 'Write Facebook Post'
  },
  {
    slug: 'pinterest',
    platformId: 'pinterest',
    platformName: 'Pinterest',
    title: 'AI Pinterest Pin Description & Board Optimizer | PostMaker',
    description: 'Generate keyword-rich Pinterest Pin descriptions and board titles. Drive continuous, long-term referral traffic to your blog or shop.',
    h1: 'AI Pinterest Pin Writer',
    heroSubheading: 'Draft search-optimized Pin descriptions that drive clicks, saves, and long-term website traffic.',
    introText: 'Pinterest is a visual search engine, not a social feed. Pins can drive traffic to your website for months or even years, but only if they are properly indexed. PostMaker generates descriptive, keyword-rich Pin descriptions that naturally incorporate target search queries while providing clear call-to-actions to encourage users to click through to your link.',
    audienceDescription: 'Bloggers, Shopify stores, recipe creators, and design brands looking for referral traffic.',
    formattingTip: 'Put the primary keyword in the first sentence, write descriptive text explaining the benefit, use up to 4 relevant tags, and include a clear call-to-action.',
    postMakerVsGeneric: {
      platformSpecific: 'A keyword-dense description that reads naturally and includes a clear, compelling reason to click the link.',
      genericCrossPost: 'A short, one-word caption like "Nice!" or a generic title with no search value.',
      explanation: 'Pinterest rely on text descriptions to understand and index images. PostMaker provides the necessary context for search bots.'
    },
    features: [
      {
        title: 'Visual SEO Targeter',
        description: 'Weaves highly searched visual keywords naturally into descriptions to rank in Pinterest Search.'
      },
      {
        title: 'Click-Through Prompters',
        description: 'Includes a clear, compelling reason for users to click the Pin to visit your blog or store.'
      },
      {
        title: 'Board Alignment SEO',
        description: 'Optimizes copy to match board categories, improving categorization and indexing.'
      }
    ],
    faqs: [
      {
        question: 'How long should a Pin description be?',
        answer: 'While the limit is 500 characters, search algorithms prioritize the first 100 to 200 characters. Keep your main keywords up front.'
      },
      {
        question: 'Should I use hashtags on Pinterest?',
        answer: 'Pinterest has moved away from hashtags in search. Focus instead on descriptive keywords and natural phrasing in the caption.'
      }
    ],
    ctaText: 'Write Pin Description'
  },
  {
    slug: 'youtube',
    platformId: 'youtube',
    platformName: 'YouTube',
    title: 'AI YouTube Video Description & Outline Generator | PostMaker',
    description: 'Write search-optimized YouTube video descriptions, video tags, and chapters to boost your CTR and rank higher in search results.',
    h1: 'AI YouTube Video Optimizer',
    heroSubheading: 'Generate keyword-dense descriptions, video chapters, and script outlines that rank.',
    introText: 'YouTube is the second largest search engine in the world. Uploading videos without descriptions, metadata, or timestamps prevents you from ranking in search and suggestion algorithms. PostMaker generates detailed, search-friendly video descriptions, constructs timestamps/chapters, and structures social links to maximize subscriber growth and traffic.',
    audienceDescription: 'YouTubers, video creators, video editors, and brands using video marketing.',
    formattingTip: 'Put your primary keyword in the first 2 lines, include timestamps for video navigation, add links to your website, and list related video playlists.',
    postMakerVsGeneric: {
      platformSpecific: 'A detailed video description structured with a summary, timestamps, social links, and targeted keyword tags.',
      genericCrossPost: 'A blank description box or a simple link with no context.',
      explanation: 'YouTube\'s search bot reads video descriptions to index and recommend content. PostMaker ensures you never miss a search opportunity.'
    },
    features: [
      {
        title: 'Timestamp & Chapter Builders',
        description: 'Helps structure video chapters to satisfy search engines and improve user watch times.'
      },
      {
        title: 'Above-the-Fold Optimization',
        description: 'Ensures the first 200 characters are highly click-worthy before the "Show More" line.'
      },
      {
        title: 'Video SEO Meta Tags',
        description: 'Suggests high-relevance video tags and search keywords to improve recommendations.'
      }
    ],
    faqs: [
      {
        question: 'Does the YouTube description affect views?',
        answer: 'Absolutely. A detailed, keyword-rich description helps YouTube understand your video, leading to higher rankings and more recommendations.'
      },
      {
        question: 'How many keywords should I target in the description?',
        answer: 'Target 1 primary keyword in the title and first paragraph, and 3-5 secondary keywords throughout the rest of the description.'
      }
    ],
    ctaText: 'Optimize Video Description'
  },
  {
    slug: 'threads',
    platformId: 'threads',
    platformName: 'Threads',
    title: 'AI Threads Post & Conversation Generator | PostMaker',
    description: 'Create engaging, text-first posts optimized for Meta\'s Threads algorithm. Grow your followers with conversational, high-engagement updates.',
    h1: 'AI Threads Post Generator',
    heroSubheading: 'Draft conversational, text-first posts that spark immediate replies and grow your reach.',
    introText: 'Threads is a text-first, community-driven social feed built by Meta. It prioritizes authentic, personal updates that read like messaging a smart colleague. Rigid marketing copy, external links, and walls of hashtags fail to perform. PostMaker crafts highly conversational, human posts optimized to generate replies and rank well in the Threads recommendation feed.',
    audienceDescription: 'Creators, personal brands, and social managers looking to establish a presence on Threads.',
    formattingTip: 'Keep it casual and text-first, ask questions that require short answers, avoid hashtags completely, and respond quickly to replies.',
    postMakerVsGeneric: {
      platformSpecific: 'A casual, personal observation or thought that reads like a real-time update and invites replies.',
      genericCrossPost: 'A corporate press release with a link and 10 hashtags copied from Instagram.',
      explanation: 'Threads rewards authentic conversations. PostMaker ensures your copy feels native and conversational, fitting the platform\'s culture.'
    },
    features: [
      {
        title: 'Conversational Tone Tuning',
        description: 'Writes casual, text-first posts that read like a real human update, not a marketing team.'
      },
      {
        title: 'Reply-Driven Hooks',
        description: 'Structures statements to naturally invite replies, boosting your reach in the feed.'
      },
      {
        title: 'No-Hashtag Clean Layout',
        description: 'Keeps posts clean and readable by completely avoiding hashtags, aligning with Threads culture.'
      }
    ],
    faqs: [
      {
        question: 'Does the Threads algorithm favor link posts?',
        answer: 'No. The Threads algorithm prioritizes text-first posts that spark discussions. PostMaker focuses on formatting text updates that keep users talking.'
      },
      {
        question: 'Can I add hashtags on Threads?',
        answer: 'Threads uses tags rather than traditional hashtags. It is best to use clean text updates and add one single tag if necessary, but keep the copy clean.'
      }
    ],
    ctaText: 'Write Threads Post'
  }
];

// Helper to generate pages for the remaining 25 platforms programmatically
function generateRemainingPages() {
  const allPlatforms = [
    { id: 'twitter', name: 'X / Twitter', group: 'shortform' },
    { id: 'threads', name: 'Threads', group: 'shortform' },
    { id: 'bluesky', name: 'Bluesky', group: 'shortform' },
    { id: 'mastodon', name: 'Mastodon', group: 'shortform' },
    { id: 'snapchat', name: 'Snapchat', group: 'shortform' },
    { id: 'linkedin', name: 'LinkedIn', group: 'professional' },
    { id: 'facebook', name: 'Facebook', group: 'professional' },
    { id: 'reddit', name: 'Reddit', group: 'community' },
    { id: 'hackernews', name: 'Hacker News', group: 'developer' },
    { id: 'producthunt', name: 'Product Hunt', group: 'developer' },
    { id: 'indiehackers', name: 'Indie Hackers', group: 'developer' },
    { id: 'betalist', name: 'BetaList', group: 'developer' },
    { id: 'discord', name: 'Discord', group: 'community' },
    { id: 'medium', name: 'Medium', group: 'longform' },
    { id: 'substack', name: 'Substack', group: 'longform' },
    { id: 'quora', name: 'Quora', group: 'community' },
    { id: 'devto', name: 'dev.to', group: 'developer' },
    { id: 'hashnode', name: 'Hashnode', group: 'developer' },
    { id: 'github', name: 'GitHub', group: 'developer' },
    { id: 'stackoverflow', name: 'Stack Overflow', group: 'developer' },
    { id: 'instagram', name: 'Instagram', group: 'design' },
    { id: 'tiktok', name: 'TikTok', group: 'video' },
    { id: 'youtube', name: 'YouTube', group: 'video' },
    { id: 'youtubeshorts', name: 'YouTube Shorts', group: 'video' },
    { id: 'pinterest', name: 'Pinterest', group: 'design' },
    { id: 'twitch', name: 'Twitch', group: 'video' },
    { id: 'clubhouse', name: 'Clubhouse', group: 'audio' },
    { id: 'dribbble', name: 'Dribbble', group: 'design' },
    { id: 'behance', name: 'Behance', group: 'design' },
    { id: 'telegram', name: 'Telegram', group: 'messaging' },
    { id: 'slack', name: 'Slack', group: 'messaging' },
    { id: 'whatsapp', name: 'WhatsApp', group: 'messaging' },
    { id: 'lemon8', name: 'Lemon8', group: 'shortform' }
  ];

  const generatedPages = [];

  for (const plat of allPlatforms) {
    // Skip if already in handcrafted pages
    if (HANDCRAFTED_PAGES.some(hp => hp.platformId === plat.id)) {
      continue;
    }

    const name = plat.name;
    const id = plat.id;
    const slug = id;

    let title = '';
    let description = '';
    let h1 = '';
    let heroSubheading = '';
    let introText = '';
    let audienceDescription = '';
    let formattingTip = '';
    let postMakerVsGeneric = { platformSpecific: '', genericCrossPost: '', explanation: '' };
    let features = [];
    let faqs = [];
    const ctaText = `Generate ${name} Post`;

    if (plat.group === 'developer') {
      title = `Free AI ${name} Post & Launch Copy Generator | PostMaker`;
      description = `Write high-converting launch copy, technical updates, and posts for ${name}. Speak directly to developers, founders, and early adopters.`;
      h1 = `AI ${name} Post Generator`;
      heroSubheading = `Draft clear, high-value launch copy and technical updates for the ${name} community.`;
      introText = `The ${name} community values technical depth, transparency, and authenticity. Marketing hype, fluff, and generic buzzwords fail completely on this platform. PostMaker structures your copy to present clear features, stack choices, metrics, or repository links, ensuring your launch or update stands out to fellow developers and makers.`;
      audienceDescription = `Founders, software developers, technical product managers, and builders launching products.`;
      formattingTip = `Lead with real features or data, format lists clearly, provide links for deep dives, and avoid hard sales copy.`;
      postMakerVsGeneric = {
        platformSpecific: `A detail-oriented update sharing key features, stack decisions, performance data, and a repository link.`,
        genericCrossPost: `A generic "So excited to announce our tool!" marketing blast with 15 tags and zero details.`,
        explanation: `Builders scroll past vague claims. Sharing exact specs and metrics builds trust and increases CTR on ${name}.`
      };
      features = [
        { title: 'Authentic Tech Tone', description: `Communicates in a clean, professional developer-friendly voice, avoiding typical corporate marketing fluff.` },
        { title: 'Product Launch Formatting', description: `Structures product updates, features, and links into high-scannability blocks ideal for product launches.` },
        { title: 'Clear Value Hooks', description: `Highlights performance specs, repo statistics, or Stack details in the opening sentences to hold attention.` }
      ];
      faqs = [
        { question: `How should I write a launch post for ${name}?`, answer: `Focus on the problem you are solving, detail your stack and how it works, share real numbers, and invite constructive feedback from the community.` },
        { question: `Does PostMaker format code snippets?`, answer: `Yes. PostMaker structures and spaces your technical descriptions, making them clean and readable for platforms like ${name}.` }
      ];
    } else if (plat.group === 'shortform') {
      title = `AI ${name} Caption & Short Post Writer | PostMaker`;
      description = `Craft high-impact, short-form posts and captions for ${name}. Drive replies, retweets, and follower growth with clean copy.`;
      h1 = `AI ${name} Post Creator`;
      heroSubheading = `Generate punchy, high-engagement updates and short posts optimized for ${name}.`;
      introText = `Short-form feeds require writing that is concise, impactful, and immediately conversational. PostMaker translates your core ideas into punchy, scroll-stopping updates that fit within the platform limitations of ${name}, boosting impressions, likes, and shares.`;
      audienceDescription = `Content creators, personal brands, and social media managers posting updates on the go.`;
      formattingTip = `Make the first line punchy, use spacing to break up phrases, keep the tone casual, and place tags neatly at the end if applicable.`;
      postMakerVsGeneric = {
        platformSpecific: `A short, high-signal observation or question that reads naturally and invites immediate replies.`,
        genericCrossPost: `A copy-paste of a long blog paragraph that gets cut off or looks too formal for a quick feed.`,
        explanation: `${name} users browse quickly. Short, conversational thoughts generate far more interaction than generic copy.`
      };
      features = [
        { title: 'Concise Compression', description: `Compresses ideas into high-signal sentences that deliver maximum impact in minimal characters.` },
        { title: 'Interactive Prompters', description: `Finishes updates with natural prompts or questions to stimulate the comment section.` },
        { title: 'Native Feed Styling', description: `Outputs formatting, emojis, and hashtags that match the exact visual style and limits of ${name}.` }
      ];
      faqs = [
        { question: `What is the character limit for ${name}?`, answer: `PostMaker automatically respects ${name}'s exact character and media limit rules so your post is always ready to publish.` },
        { question: `How do I get more reach on ${name}?`, answer: `Keep posts short, spark comments with open-ended questions, and write posts that invite users to bookmark or share.` }
      ];
    } else if (plat.group === 'longform') {
      title = `AI ${name} Headline & Hook Generator | PostMaker`;
      description = `Generate engaging headlines, newsletter hooks, and article structures for ${name}. Convert casual readers into subscribers.`;
      h1 = `AI ${name} Article Hook Writer`;
      heroSubheading = `Craft scroll-stopping titles and introduction hooks that double your ${name} read rates.`;
      introText = `Writing on ${name} requires capturing readers in the first two sentences and structuring content for deep reading. PostMaker generates high-CTR headlines, drafts compelling intro hooks, and maps readable outlines to ensure your publication grows its subscriber base.`;
      audienceDescription = `Writers, journalists, bloggers, and companies sharing newsletters or long-form thought leadership.`;
      formattingTip = `Use a curiosity-driven or metric-backed headline, establish the benefit in the first paragraph, and keep subheadings descriptive.`;
      postMakerVsGeneric = {
        platformSpecific: `A curiosity-inducing headline combined with a clear, benefit-driven introductory paragraph.`,
        genericCrossPost: `A title like "New Blog Post" with no description or hook to encourage reading.`,
        explanation: `Long-form readers have high expectations. PostMaker helps you hook them instantly in the feed and lead them to the full article.`
      };
      features = [
        { title: 'High-CTR Headlining', description: `Generates multiple headline options optimized to stand out in email inboxes and article feeds.` },
        { title: 'Intro Hook Structuring', description: `Crafts intro paragraphs that promise high value to keep readers scrolling down the page.` },
        { title: 'Descriptive Outlining', description: `Suggests structural outlines and subheadings to break up long essays into readable blocks.` }
      ];
      faqs = [
        { question: `How can I grow my subscribers on ${name}?`, answer: `Focus on delivering specific, actionable insights, write scroll-stopping headlines, and use clear newsletter signup prompts inside the text.` },
        { question: `What types of hooks work best for long-form?`, answer: `Hooks that share a surprising statistic, a personal realization, or a contrarian view generate the highest read rates.` }
      ];
    } else if (plat.group === 'community') {
      title = `AI ${name} Post & Answer Formatter | PostMaker`;
      description = `Format engaging posts, sub-community threads, and detailed answers for ${name}. Speak with authenticity and drive upvotes.`;
      h1 = `AI ${name} Content Formatter`;
      heroSubheading = `Write detailed, community-centric posts and answers that gain upvotes and spark discussions.`;
      introText = `Community forums like ${name} reject standard marketing copy immediately. To get upvotes and visibility, you must share genuine, helpful, and highly detailed answers. PostMaker formats your copy to fit the specific culture of ${name}, prioritizing authentic story-telling, formatting markdown lists cleanly, and structuring questions to invite discussion.`;
      audienceDescription = `Niche marketers, community builders, and experts sharing knowledge in specific forums.`;
      formattingTip = `Be helpful first, format with bold headers and lists for scannability, share personal experiences, and avoid direct sales pitches.`;
      postMakerVsGeneric = {
        platformSpecific: `A detailed, helpful answer sharing step-by-step guides with clean formatting, mentioning your product only if relevant.`,
        genericCrossPost: `A short "Buy my product here" spam post with a direct affiliate link.`,
        explanation: `${name} algorithms and moderators block spam. PostMaker builds reputation-friendly, helpful posts that drive organic upvotes.`
      };
      features = [
        { title: 'Sub-Community Adaptability', description: `Adjusts the copy tone to match the specific rules and culture of different community forums.` },
        { title: 'Markdown Spacing', description: `Applies clean bold text, headers, and bullet points to make long answers highly readable.` },
        { title: 'Authenticity Filter', description: `Rewrites promotional claims into honest, value-first sharing that drives upvotes.` }
      ];
      faqs = [
        { question: `How do I drive traffic from ${name} without getting banned?`, answer: `Always focus on answering the question completely and helping the reader. Only link to your resource if it directly adds deep value to the discussion.` },
        { question: `Does formatting affect upvotes?`, answer: `Yes! Properly spaced posts with bold headers, bullet lists, and clear paragraphs get read more and receive significantly more upvotes.` }
      ];
    } else if (plat.group === 'video' || plat.group === 'audio') {
      title = `AI ${name} Script Outline & Video Description Writer | PostMaker`;
      description = `Write high-retention video hooks, script outlines, and descriptions for ${name}. Grow subscribers and video views.`;
      h1 = `AI ${name} Script & Promo Writer`;
      heroSubheading = `Generate attention-grabbing video scripts, hooks, and descriptions designed to keep viewers watching.`;
      introText = `Video and audio platforms are driven by watch time and retention. If your video hook is slow or boring, viewers swipe away in 3 seconds. PostMaker drafts quick, high-retention video script outlines, hooks, titles, and descriptions for ${name} to maximize CTR and keep viewers watching.`;
      audienceDescription = `Video creators, podcasters, stream hosts, and video editors seeking viral growth.`;
      formattingTip = `State the payoff in the first 3 seconds, structure scripts into hook-value-cta, and keep descriptions keyword-rich for search.`;
      postMakerVsGeneric = {
        platformSpecific: `A structured script outline starting with a strong visual hook, followed by 3 key points and a quick CTA.`,
        genericCrossPost: `A dry, wordy script read that sounds like a textbook outline.`,
        explanation: `Online video feeds require conversational, fast-paced language. PostMaker drafts outlines that sound natural and high-energy.`
      };
      features = [
        { title: '3-Second Hook Optimizer', description: `Creates powerful visual and verbal openings that stop users from scrolling past your video.` },
        { title: 'Visual Cue Prompts', description: `Includes script suggestions for overlay text and visual shifts to maintain high viewer retention.` },
        { title: 'SEO Description Sync', description: `Optimizes video captions and search terms to match algorithm category search queries.` }
      ];
      faqs = [
        { question: `How do I write a script hook that stops the scroll?`, answer: `Start in the middle of the action, address a major pain point immediately, or show the end result first to create curiosity.` },
        { question: `What is the optimal script structure for short video?`, answer: `Use the Hook (0-3s) -> Core Value/Story (3-45s) -> Call to Action (45-60s) layout for maximum retention.` }
      ];
    } else if (plat.group === 'design') {
      title = `AI ${name} Project Description & Tag Generator | PostMaker`;
      description = `Write search-optimized project descriptions and tag sets for ${name}. Showcase your design portfolio and attract clients.`;
      h1 = `AI ${name} Description Writer`;
      heroSubheading = `Generate keyword-dense project descriptions that showcase your design work and attract clients.`;
      introText = `Visual portfolios on ${name} require descriptions that explain the "why" and "how" behind the project to rank in search and showcase your expertise. PostMaker structures your design process, tool stacks, and credits into clear, scannable case studies that look premium and attract high-value clients.`;
      audienceDescription = `UI/UX designers, illustrators, branding experts, and creative studios building their portfolio.`;
      formattingTip = `Share the client brief, explain your creative solutions, detail the tools and fonts used, and add clean credits.`;
      postMakerVsGeneric = {
        platformSpecific: `A detailed project case study sharing the client challenge, stack, design solutions, and clear links for inquiries.`,
        genericCrossPost: `A simple title like "Logo Design" with no description or tags to explain the project.`,
        explanation: `Clients look for design thinking, not just final images. PostMaker helps you frame your design project as a professional case study.`
      };
      features = [
        { title: 'Case Study Outlining', description: `Structures your project description into a mini case study: Brief -> Challenge -> Creative Solution.` },
        { title: 'Tool & Credit Formatting', description: `Cleanly lists the tools, fonts, colors, and team credits used in the design project.` },
        { title: 'Creative Tag Suggesting', description: `Generates high-traffic, relevant search tags to help your project rank in the platform directory.` }
      ];
      faqs = [
        { question: `How can I attract design clients on ${name}?`, answer: `Explain your process in detail in the description. Show how your design solved a real business problem for the client, and include contact details.` },
        { question: `What should I include in my project description?`, answer: `Include the project brief, key design decisions, software/tools used, team credits, and a call-to-action for new client inquiries.` }
      ];
    } else {
      // Default to messaging template (for messaging, audio, and fallback)
      title = `AI ${name} Message & Broadcast Formatter | PostMaker`;
      description = `Format clear, conversion-optimized messages and broadcast updates for ${name}. Boost announcement click-through rates.`;
      h1 = `AI ${name} Message Writer`;
      heroSubheading = `Format clean message broadcasts and community updates that drive clicks and responses.`;
      introText = `Broadcast messaging on ${name} must be scannable, clear, and highly visual. Wall-of-text messages get ignored or muted. PostMaker structures your updates with clean bullet points, bold key phrases, and spaced emoji visual anchors to ensure your announcement is read and clicked immediately.`;
      audienceDescription = `Group administrators, brand managers, and community managers broadcasting updates.`;
      formattingTip = `Start with a clear, bold headline, use bullet points for announcement details, add double spaces, and place the CTA link on its own line.`;
      postMakerVsGeneric = {
        platformSpecific: `A spaced message update starting with a bold headline, using bullet points, and placing the link clearly at the bottom.`,
        genericCrossPost: `A massive, single-paragraph text block with no spacing, making it difficult to read on a mobile screen.`,
        explanation: `Messaging apps are read on mobile screens. PostMaker applies visual spacing and emoji bullet points to drive message readability.`
      };
      features = [
        { title: 'Mobile Spacing Optimization', description: `Applies double-line spaces and short sentences to prevent text blocks from looking dense on mobile.` },
        { title: 'Emoji Visual Bullet Anchoring', description: `Uses clear, professional emojis as bullet points to guide the reader\'s eye down to the link.` },
        { title: 'CTA Link Isolation', description: `Places call-to-action links on their own line with arrow pointers to maximize tap rates.` }
      ];
      faqs = [
        { question: `How do I prevent users from muting my channel on ${name}?`, answer: `Keep updates short, highly scannable, deliver direct value (promotions, updates), and avoid spamming too many messages in a single day.` },
        { question: `What is the best layout for message broadcasts?`, answer: `Use a bold hook header -> 3 bullet points of details -> 1 direct action link on its own line.` }
      ];
    }

    generatedPages.push({
      slug,
      platformId: id,
      platformName: name,
      title,
      description,
      h1,
      heroSubheading,
      introText,
      audienceDescription,
      formattingTip,
      postMakerVsGeneric,
      features,
      faqs,
      ctaText
    });
  }

  return generatedPages;
}

const allPages = [...HANDCRAFTED_PAGES, ...generateRemainingPages()];

// Write out to config/platformPages.ts
const fileContent = `// config/platformPages.ts
//
// Data source for PostMaker's platform-specific landing pages (/tools/:slug).
// Auto-generated by scripts/generate_platform_pages.ts to support all 33 platforms.
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

export const platformPages: PlatformPageEntry[] = ${JSON.stringify(allPages, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '../config/platformPages.ts'), fileContent, 'utf8');
console.log('Successfully generated platformPages.ts with ' + allPages.length + ' entries!');
