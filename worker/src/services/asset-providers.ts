// ============================================================
// PostMaker — Asset Provider Abstraction Layer (Phase 2)
// ============================================================
// Design: One interface, one registry. Swap or add providers by
// editing ASSET_PROVIDERS only — zero changes to route handlers.
//
// Attribution fields sourced from live Unsplash API docs:
//   photo.user.name           → authorName
//   photo.user.links.html     → authorUrl  (verified: user object has links.html)
//   photo.links.html          → sourceUrl  (verified: photo object has links.html)
// Pexels: photographer, photographer_url, url (photo page)
// Pixabay: user, pageURL (no per-item author profile link in free API)
// Iconify: no attribution required — set to null
// Google Fonts: no attribution required — set to null
// ============================================================

import type { Env } from '../../../config/ai'

// ── Attribution ───────────────────────────────────────────────
// Populated from real provider response fields (verified from docs).
// null = this provider does not require attribution display.
export interface Attribution {
  authorName: string
  authorUrl: string   // link to creator profile page
  sourceUrl: string   // link to original asset on provider site
  providerName: string // internal label only — never sent to frontend UI
}

// ── MediaItem ─────────────────────────────────────────────────
// Normalised shape returned by all providers.
// Frontend never sees provider-specific fields.
export interface MediaItem {
  id: string               // provider-scoped unique ID
  type: 'image' | 'video' | 'icon' | 'font'
  title: string
  previewUrl: string       // thumbnail for picker grid
  downloadUrl: string      // full-resolution usable URL
  width?: number
  height?: number
  attribution: Attribution | null
}

// ── Rate Limiter Interface ────────────────────────────────────
// The Durable Object implementation is Phase 3 scope.
// Here we define the interface providers call against, plus a
// no-op stub so this module compiles and is independently testable.
export interface RateLimiter {
  // Returns true if the request is allowed; false if rate limit exceeded.
  // key format: "{providerId}:{userId}" — allows per-provider per-user tracking.
  consume(key: string, limitPerMinute: number): Promise<boolean>
}

// No-op stub: always allows. Used in Phase 2 before DO is wired in Phase 3.
export const noopRateLimiter: RateLimiter = {
  async consume(_key: string, _limitPerMinute: number): Promise<boolean> {
    return true
  },
}

// ── AssetProvider Interface ──────────────────────────────────
export interface AssetProvider {
  id: string                          // internal — never exposed to frontend
  types: MediaItem['type'][]
  rateLimitPerUserPerMinute: number   // enforced by route handler via RateLimiter
  search(
    query: string,
    type: MediaItem['type'],
    page: number,
    orientation: 'all' | 'landscape' | 'portrait' | 'square',
    env: Env,
    rateLimiter: RateLimiter,
    userId: string
  ): Promise<MediaItem[]>
}

// ── Raw response types (internal — not exported) ──────────────
// Typed from actual API response shapes per provider docs.

interface PexelsPhoto {
  id: number
  width: number
  height: number
  alt: string
  photographer: string
  photographer_url: string
  url: string             // photo page URL
  src: { medium: string; original: string }
}

interface PexelsVideo {
  id: number
  width: number
  height: number
  url: string
  user: { name: string; url: string }
  video_files: { quality: string; link: string; width: number; height: number }[]
  image: string           // thumbnail
}

interface PixabayImageHit {
  id: number
  pageURL: string
  tags: string
  previewURL: string
  webformatURL: string
  largeImageURL: string
  imageWidth: number
  imageHeight: number
  user: string            // username only — no profile URL in free API response
  userImageURL: string
}

// Unsplash photo shape — fields verified from https://unsplash.com/documentation
interface UnsplashPhoto {
  id: string
  description: string | null
  alt_description: string | null
  width: number
  height: number
  urls: {
    thumb: string         // ~200px thumbnail
    small: string         // ~400px
    regular: string       // ~1080px — used as previewUrl
    full: string          // max quality
    raw: string           // base URL for custom sizing
  }
  links: {
    html: string          // photo page URL on unsplash.com — used as sourceUrl
  }
  user: {
    name: string          // photographer display name — used as authorName
    links: {
      html: string        // author profile page on unsplash.com — used as authorUrl
    }
  }
}

interface IconifyIconSet {
  // Iconify API returns icons list differently — we use the /search endpoint
  icons: string[]
  total: number
  collections?: Record<string, { name: string }>
}

// ── Pexels Provider ───────────────────────────────────────────
// Photos + Videos. Attribution populated (not legally required but consistent shape).
// Face/people filtering: Pexels has no dedicated face-exclusion param. We rely on
// Pixabay's safesearch and Openverse's CC licensing to provide cleaner results.
const pexelsProvider: AssetProvider = {
  id: 'pexels',
  types: ['image', 'video'],
  rateLimitPerUserPerMinute: 50,

  async search(query, type, page, orientation, env, rateLimiter, userId) {
    const allowed = await rateLimiter.consume(`pexels:${userId}`, this.rateLimitPerUserPerMinute)
    if (!allowed) throw new RateLimitError('pexels')

    const apiKey = env.PEXELS_API_KEY
    if (!apiKey) return []

    const perPage = 20
    // Pexels orientation values: landscape | portrait | square
    const oriParam = orientation !== 'all' ? `&orientation=${orientation}` : ''

    const endpoint = type === 'video'
      ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}${oriParam}`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}${oriParam}`

    const res = await fetch(endpoint, {
      headers: { Authorization: apiKey },
    })

    if (!res.ok) {
      throw new Error(`[pexels] API error ${res.status}`)
    }

    if (type === 'video') {
      const data = await res.json() as { videos: PexelsVideo[] }
      return (data.videos ?? []).map(v => {
        const bestFile = v.video_files
          .filter(f => f.quality === 'hd' || f.quality === 'sd')
          .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]
        return {
          id: `pexels_v_${v.id}`,
          type: 'video' as const,
          title: `Video by ${v.user.name}`,
          previewUrl: v.image,
          downloadUrl: bestFile?.link ?? v.image,
          width: v.width,
          height: v.height,
          attribution: {
            authorName: v.user.name,
            authorUrl: v.user.url,
            sourceUrl: v.url,
            providerName: 'Pexels',
          },
        }
      })
    }

    const data = await res.json() as { photos: PexelsPhoto[] }
    return (data.photos ?? []).map(p => ({
      id: `pexels_${p.id}`,
      type: 'image' as const,
      title: p.alt || `Photo by ${p.photographer}`,
      previewUrl: p.src.medium,
      downloadUrl: p.src.original,
      width: p.width,
      height: p.height,
      attribution: {
        authorName: p.photographer,
        authorUrl: p.photographer_url,
        sourceUrl: p.url,
        providerName: 'Pexels',
      },
    }))
  },
}

// ── Pixabay Provider ──────────────────────────────────────────
// Photos + Videos. safesearch=true filters adult content (including nudity/explicit).
// Pixabay does NOT have a dedicated face-exclusion parameter in the free API.
// authorUrl falls back to a Pixabay search URL for the username.
const pixabayProvider: AssetProvider = {
  id: 'pixabay',
  types: ['image', 'video'],
  rateLimitPerUserPerMinute: 50,

  async search(query, type, page, orientation, env, rateLimiter, userId) {
    const allowed = await rateLimiter.consume(`pixabay:${userId}`, this.rateLimitPerUserPerMinute)
    if (!allowed) throw new RateLimitError('pixabay')

    const apiKey = env.PIXABAY_API_KEY
    if (!apiKey) return [] // key not configured — skip silently, other providers handle it

    const perPage = 20
    // Pixabay orientation values: horizontal | vertical (no square option)
    const oriMap: Record<string, string> = { landscape: 'horizontal', portrait: 'vertical' }
    const oriParam = orientation !== 'all' && oriMap[orientation] ? `&orientation=${oriMap[orientation]}` : ''
    const imageType = type === 'video' ? '' : '&image_type=photo'

    const endpoint = type === 'video'
      ? `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&safesearch=true`
      : `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}${imageType}${oriParam}&safesearch=true`

    const res = await fetch(endpoint)
    if (!res.ok) throw new Error(`[pixabay] API error ${res.status}`)

    if (type === 'video') {
      const data = await res.json() as { hits: Array<{
        id: number; pageURL: string; tags: string
        videos: { medium: { url: string; width: number; height: number }; tiny: { url: string } }
        picture_id: string; user: string
      }> }
      return (data.hits ?? []).map(v => ({
        id: `pixabay_v_${v.id}`,
        type: 'video' as const,
        title: v.tags.split(',')[0]?.trim() || 'Free video',
        previewUrl: `https://i.vimeocdn.com/video/${v.picture_id}_295x166.jpg`,
        downloadUrl: v.videos.medium.url,
        width: v.videos.medium.width,
        height: v.videos.medium.height,
        attribution: {
          authorName: v.user,
          authorUrl: `https://pixabay.com/users/${encodeURIComponent(v.user)}/`,
          sourceUrl: v.pageURL,
          providerName: 'Pixabay',
        },
      }))
    }

    const data = await res.json() as { hits: PixabayImageHit[] }
    return (data.hits ?? []).map(p => ({
      id: `pixabay_${p.id}`,
      type: 'image' as const,
      title: p.tags.split(',')[0]?.trim() || 'Free image',
      previewUrl: p.previewURL,
      downloadUrl: p.largeImageURL,
      width: p.imageWidth,
      height: p.imageHeight,
      attribution: {
        authorName: p.user,
        authorUrl: `https://pixabay.com/users/${encodeURIComponent(p.user)}/`,
        sourceUrl: p.pageURL,
        providerName: 'Pixabay',
      },
    }))
  },
}

// ── Unsplash Provider ─────────────────────────────────────────
// Photos only. Attribution is LEGALLY REQUIRED by Unsplash API terms.
// Field mapping verified from https://unsplash.com/documentation:
//   authorName  ← photo.user.name
//   authorUrl   ← photo.user.links.html
//   sourceUrl   ← photo.links.html
// UTM params appended to authorUrl/sourceUrl per Unsplash guidelines.
const unsplashProvider: AssetProvider = {
  id: 'unsplash',
  types: ['image'],
  rateLimitPerUserPerMinute: 60,

  async search(query, _type, page, orientation, env, rateLimiter, userId) {
    const allowed = await rateLimiter.consume(`unsplash:${userId}`, this.rateLimitPerUserPerMinute)
    if (!allowed) throw new RateLimitError('unsplash')

    const accessKey = env.UNSPLASH_ACCESS_KEY
    if (!accessKey) return []

    // Unsplash orientation values: landscape | portrait | squarish
    const oriMap: Record<string, string> = { landscape: 'landscape', portrait: 'portrait', square: 'squarish' }
    const oriParam = orientation !== 'all' && oriMap[orientation] ? `&orientation=${oriMap[orientation]}` : ''
    const perPage = 20
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}${oriParam}`,
      {
        headers: {
          Authorization: `Client-ID ${accessKey}`,
          'Accept-Version': 'v1',
        },
      }
    )
    if (!res.ok) throw new Error(`[unsplash] API error ${res.status}`)

    const data = await res.json() as { results: UnsplashPhoto[] }
    const UTM = '?utm_source=postmaker&utm_medium=referral'
    return (data.results ?? []).map(p => ({
      id: `unsplash_${p.id}`,
      type: 'image' as const,
      title: p.alt_description || p.description || 'Photo',
      previewUrl: p.urls.regular,
      downloadUrl: p.urls.full || p.urls.regular,
      width: p.width,
      height: p.height,
      attribution: {
        authorName: p.user.name,
        authorUrl: `${p.user.links.html}${UTM}`,
        sourceUrl: `${p.links.html}${UTM}`,
        providerName: 'Unsplash',
      },
    }))
  },
}

// ── Iconify Provider ──────────────────────────────────────────
// Icons and SVGs. Iconify API is free, no key required, no attribution needed.
const iconifyProvider: AssetProvider = {
  id: 'iconify',
  types: ['icon'],
  rateLimitPerUserPerMinute: 100,

  async search(query, _type, page, _orientation, env, rateLimiter, userId) {
    const allowed = await rateLimiter.consume(`iconify:${userId}`, this.rateLimitPerUserPerMinute)
    if (!allowed) throw new RateLimitError('iconify')

    const limit = 50
    const start = (page - 1) * limit
    const iconQuery = (query === 'trending' || query === 'business' || query === 'all' || !query.trim()) ? 'ui' : query
    const res = await fetch(
      `https://api.iconify.design/search?query=${encodeURIComponent(iconQuery)}&limit=${limit}&start=${start}`
    )
    if (!res.ok) throw new Error(`[iconify] API error ${res.status}`)

    const data = await res.json() as IconifyIconSet
    return (data.icons ?? []).map(iconId => {
      // iconId format: "prefix:icon-name" e.g. "mdi:home"
      const [prefix, name] = iconId.split(':')
      const svgUrl = `https://api.iconify.design/${prefix}/${name}.svg`
      return {
        id: `iconify_${iconId.replace(':', '_')}`,
        type: 'icon' as const,
        title: name ?? iconId,
        previewUrl: svgUrl,
        downloadUrl: svgUrl,
        attribution: null, // no attribution required
      }
    })
  },
}

// ── Openverse Provider (Keyless Stock Images) ─────────────────
// Keyless image search using Creative Commons Openverse API.
// No API key required out-of-the-box.
interface OpenverseImageResult {
  id: string
  title: string
  url: string
  thumbnail?: string
  creator?: string
  creator_url?: string
  foreign_landing_url?: string
  width?: number
  height?: number
}

const openverseProvider: AssetProvider = {
  id: 'openverse',
  types: ['image'],
  rateLimitPerUserPerMinute: 60,

  async search(query, _type, page, _orientation, env, rateLimiter, userId) {
    const allowed = await rateLimiter.consume(`openverse:${userId}`, this.rateLimitPerUserPerMinute)
    if (!allowed) throw new RateLimitError('openverse')

    const perPage = 30
    // Use the search term as-is. Never append extra words — it corrupts the query.
    const searchTerm = (!query.trim() || query === 'trending') ? 'nature landscape background' : query.trim()
    // license_type=commercial ensures results are safe for commercial use
    const endpoint = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(searchTerm)}&page=${page}&page_size=${perPage}&license_type=commercial&mature=false`

    const res = await fetch(endpoint, {
      headers: {
        'User-Agent': 'PostMaker/1.0 (https://bypostamaker.com)',
      },
    })
    if (!res.ok) throw new Error(`[openverse] API error ${res.status}`)

    const data = await res.json() as { results: OpenverseImageResult[] }

    // Filter out low-quality or irrelevant results by title keywords
    const badKeywords = ['map', 'chart', 'trend', 'slide', 'diagram', 'presentation', 'graph', 'screenshot', 'agenda', 'forum', 'report', 'top ten', 'top 10']

    const filtered = (data.results ?? []).filter(p => {
      const titleLower = (p.title || '').toLowerCase()
      return !badKeywords.some(kw => titleLower.includes(kw))
    })

    return filtered.slice(0, 20).map(p => ({
      id: `openverse_${p.id}`,
      type: 'image' as const,
      title: p.title || 'Creative Commons Photo',
      previewUrl: p.thumbnail || p.url,
      downloadUrl: p.url,
      width: p.width,
      height: p.height,
      attribution: p.creator ? {
        authorName: p.creator,
        authorUrl: p.creator_url || p.foreign_landing_url || 'https://openverse.org',
        sourceUrl: p.foreign_landing_url || p.url,
        providerName: 'Openverse (CC)',
      } : null,
    }))
  },
}

// ── Google Fonts Provider ─────────────────────────────────────
// Fonts. No attribution required. Results don't paginate the same way —
// we filter the full list client-side after fetching once, then slice by page.
const googleFontsProvider: AssetProvider = {
  id: 'google_fonts',
  types: ['font'],
  rateLimitPerUserPerMinute: 100,

  async search(query, _type, page, _orientation, env, rateLimiter, userId) {
    const allowed = await rateLimiter.consume(`google_fonts:${userId}`, this.rateLimitPerUserPerMinute)
    if (!allowed) throw new RateLimitError('google_fonts')

    const apiKey = env.GOOGLE_FONTS_API_KEY
    if (apiKey) {
      const res = await fetch(
        `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`
      )
      if (res.ok) {
        const data = await res.json() as { items: Array<{ family: string; category: string }> }
        const q = query.toLowerCase()
        const filtered = (data.items ?? []).filter(f => f.family.toLowerCase().includes(q))
        const pageSize = 20
        const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)

        return pageItems.map(f => ({
          id: `gfont_${f.family.replace(/\s+/g, '_')}`,
          type: 'font' as const,
          title: f.family,
          previewUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family)}&display=swap`,
          downloadUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family)}&display=swap`,
          attribution: null,
        }))
      }
    }

    // Keyless Popular Open-Source Google Fonts List
    const popularFonts = [
      { family: 'Plus Jakarta Sans', category: 'sans-serif' },
      { family: 'Inter', category: 'sans-serif' },
      { family: 'Roboto', category: 'sans-serif' },
      { family: 'Outfit', category: 'sans-serif' },
      { family: 'Montserrat', category: 'sans-serif' },
      { family: 'Poppins', category: 'sans-serif' },
      { family: 'Playfair Display', category: 'serif' },
      { family: 'Lora', category: 'serif' },
      { family: 'Oswald', category: 'sans-serif' },
      { family: 'JetBrains Mono', category: 'monospace' },
      { family: 'Fira Code', category: 'monospace' },
      { family: 'Space Grotesk', category: 'sans-serif' },
    ]

    const q = query.toLowerCase()
    const perPage = 20
    const filtered = popularFonts.filter(f => f.family.toLowerCase().includes(q) || q === 'trending' || q === 'all')
    const sliced = filtered.slice((page - 1) * perPage, page * perPage)

    return sliced.map(f => ({
      id: `gfont_${f.family.replace(/\s+/g, '_').toLowerCase()}`,
      type: 'font' as const,
      title: f.family,
      previewUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family)}&display=swap`,
      downloadUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family)}&display=swap`,
      attribution: null,
    }))
  },
}

// ── Registry ─────────────────────────────────────────────────
// To add a provider: implement AssetProvider, add one entry here.
// To remove a provider: delete one entry here.
// Route handlers reference this array — no other file changes needed.
export const ASSET_PROVIDERS: AssetProvider[] = [
  openverseProvider, // Creative Commons & Wikimedia live media
  unsplashProvider,  // Unsplash photos
  pexelsProvider,    // Pexels media
  pixabayProvider,   // Pixabay stock media
  iconifyProvider,   // Keyless vector icons
  googleFontsProvider,// Google Fonts
]

// ── Registry helpers ─────────────────────────────────────────
export function findProviders(type: MediaItem['type']): AssetProvider[] {
  return ASSET_PROVIDERS.filter(p => p.types.includes(type))
}

export function findProviderById(id: string): AssetProvider | undefined {
  return ASSET_PROVIDERS.find(p => p.id === id)
}

// ── Error types ──────────────────────────────────────────────
export class RateLimitError extends Error {
  constructor(public readonly providerId: string) {
    super(`Rate limit exceeded for provider: ${providerId}`)
    this.name = 'RateLimitError'
  }
}
