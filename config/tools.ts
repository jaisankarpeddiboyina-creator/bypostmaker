export interface StudioTool {
  id: string
  name: string
  description: string
  category: 'all' | 'content' | 'image' | 'video' | 'audio' | 'design' | 'edit' | 'strategy' | 'utility'
  iconName: string
  group: string // AILink SDK group namespace
  route: string
  badge?: string
  isNew?: boolean
  popular?: boolean
}

export const STUDIO_TOOLS: StudioTool[] = [
  {
    id: 'thumbnail-maker',
    name: 'AI Thumbnail Maker',
    description: 'Generate high-converting, brand-aligned YouTube and social media thumbnails with scored concept evaluations.',
    category: 'design',
    iconName: 'Image',
    group: 'thumbnail-maker',
    route: '/app/studio/thumbnail',
    badge: 'Popular',
    isNew: true,
    popular: true,
  },
  {
    id: 'ai-writer',
    name: 'AI Writer',
    description: 'Write engaging posts, long-form articles, and social copy in seconds.',
    category: 'content',
    iconName: 'Edit3',
    group: 'ai-writer',
    route: '/app/create',
    popular: true,
  },
  {
    id: 'image-generator',
    name: 'AI Image Generator',
    description: 'Create custom social graphics, visual assets, and illustration concepts.',
    category: 'image',
    iconName: 'Sparkles',
    group: 'image-gen',
    route: '/app/studio/thumbnail',
  },
  {
    id: 'video-generator',
    name: 'AI Video Generator',
    description: 'Turn ideas and text scripts into short-form promo video concepts.',
    category: 'video',
    iconName: 'Video',
    group: 'video-gen',
    route: '/app/studio',
    badge: 'Coming Soon',
  },
  {
    id: 'caption-generator',
    name: 'AI Caption Generator',
    description: 'Generate platform-optimized social captions with relevant hashtag sets.',
    category: 'content',
    iconName: 'MessageSquare',
    group: 'caption-gen',
    route: '/app/create',
    popular: true,
  },
  {
    id: 'brand-kit-tool',
    name: 'Brand Identity Hub',
    description: 'Manage logos, brand colors, typography rules, and brand voice guidelines.',
    category: 'strategy',
    iconName: 'Palette',
    group: 'brand-identity',
    route: '/app/brand-kit',
  },
]
