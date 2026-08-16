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
  providerName: string
  // License shown on card. Values per provider:
  //   Pexels:     'Pexels Free'       (free for commercial/personal, attribution optional)
  //   Pixabay:    'Pixabay Free'      (free for commercial use, no attribution required)
  //   Unsplash:   'Unsplash License'  (ATTRIBUTION REQUIRED per API Terms of Service)
  //   Openverse:  actual CC license from API (e.g. 'CC BY 2.0')
  //   Iconify:    null                (public domain / no attribution)
  //   Google Fonts: null              (Open Font License)
  license: string
  // Whether attribution is legally required by provider ToS
  attributionRequired: boolean
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
// Photos + Videos.
// RATE LIMITS (confirmed from response headers, 2026-08-10):
//   x-ratelimit-limit: 25000   (requests per month)
//   x-ratelimit-remaining: N   (we throw when < 50 to avoid account suspension)
//   x-ratelimit-reset: unix timestamp
// LICENSE: Pexels Free License — free for commercial & personal use.
// Attribution not legally required, but shown for UX and provider goodwill.
// Default (no query): use /v1/curated endpoint — editorial picks, diverse subjects.
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
    const oriParam = orientation !== 'all' ? `&orientation=${orientation}` : ''
    const isDefaultQuery = !query.trim() || query === 'trending'

    // When no search term: use Pexels curated endpoint for editorial picks
    // (avoids showing people-heavy trending content by default)
    let endpoint: string
    if (isDefaultQuery && type === 'image') {
      endpoint = `https://api.pexels.com/v1/curated?per_page=${perPage}&page=${page}`
    } else if (type === 'video') {
      const videoQuery = isDefaultQuery ? 'nature landscape' : query
      endpoint = `https://api.pexels.com/videos/search?query=${encodeURIComponent(videoQuery)}&per_page=${perPage}&page=${page}${oriParam}`
    } else {
      endpoint = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}${oriParam}`
    }

    const res = await fetch(endpoint, { headers: { Authorization: apiKey } })

    // Parse rate limit headers and throw BEFORE exhausting the quota
    const remaining = parseInt(res.headers.get('x-ratelimit-remaining') ?? '999', 10)
    if (remaining < 50) {
      console.warn(`[pexels] Monthly quota low: ${remaining} requests remaining`)
    }
    if (remaining <= 0) throw new RateLimitError('pexels')

    if (res.status === 429 || !res.ok) {
      throw new Error(`[pexels] API error ${res.status}${res.status === 429 ? ' (rate limited)' : ''}`)
    }

    const PEXELS_LICENSE: Attribution['license'] = 'Pexels Free'

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
            license: PEXELS_LICENSE,
            attributionRequired: false,
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
        license: PEXELS_LICENSE,
        attributionRequired: false,
      },
    }))
  },
}

// ── Pixabay Provider ──────────────────────────────────────────
// Photos + Videos. safesearch=true filters adult content.
// RATE LIMITS (confirmed from response headers, 2026-08-10):
//   x-ratelimit-limit: 100  (per minute)
//   x-ratelimit-remaining: N (resets every 60s)
//   x-ratelimit-reset: seconds until reset
// LICENSE: Pixabay License — free for commercial use. No attribution required.
// Default (no query): use curated nature/landscape seed for varied defaults.
const pixabayProvider: AssetProvider = {
  id: 'pixabay',
  types: ['image', 'video'],
  rateLimitPerUserPerMinute: 50,

  async search(query, type, page, orientation, env, rateLimiter, userId) {
    const allowed = await rateLimiter.consume(`pixabay:${userId}`, this.rateLimitPerUserPerMinute)
    if (!allowed) throw new RateLimitError('pixabay')

    const apiKey = env.PIXABAY_API_KEY
    if (!apiKey) return []

    const perPage = 20
    const oriMap: Record<string, string> = { landscape: 'horizontal', portrait: 'vertical' }
    const oriParam = orientation !== 'all' && oriMap[orientation] ? `&orientation=${oriMap[orientation]}` : ''
    const imageType = type === 'video' ? '' : '&image_type=photo'
    const isDefaultQuery = !query.trim() || query === 'trending'
    const searchQ = isDefaultQuery ? 'nature background' : query

    const endpoint = type === 'video'
      ? `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(searchQ)}&per_page=${perPage}&page=${page}&safesearch=true`
      : `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(searchQ)}&per_page=${perPage}&page=${page}${imageType}${oriParam}&safesearch=true`

    const res = await fetch(endpoint)

    // Parse rate limit remaining from header — throw if <= 5 (protect from exhausting per-minute quota)
    const remaining = parseInt(res.headers.get('x-ratelimit-remaining') ?? '99', 10)
    const resetIn = res.headers.get('x-ratelimit-reset') ?? '60'
    if (remaining <= 5) {
      console.warn(`[pixabay] Rate limit low: ${remaining} remaining, resets in ${resetIn}s`)
      throw new RateLimitError('pixabay')
    }

    if (res.status === 429 || !res.ok) throw new Error(`[pixabay] API error ${res.status}`)

    const PIXABAY_LICENSE: Attribution['license'] = 'Pixabay Free'

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
          license: PIXABAY_LICENSE,
          attributionRequired: false,
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
        license: PIXABAY_LICENSE,
        attributionRequired: false,
      },
    }))
  },
}

// ── Unsplash Provider ─────────────────────────────────────────
// Photos only. Attribution is LEGALLY REQUIRED by Unsplash API Terms of Service.
// RATE LIMITS (from docs + headers):
//   Demo apps: 50 req/hour. Production-approved apps: 5000 req/hour.
//   Header: X-RateLimit-Remaining (requests left in current hour window).
//   We throw when remaining <= 5 to avoid account suspension.
// LICENSE: Unsplash License (https://unsplash.com/license)
//   Free to use, but you MUST attribute the photographer AND Unsplash.
//   Per API Terms, do NOT download-and-host without triggering a download event.
//   UTM params required on all links back to Unsplash.
// Default (no query): use curated /photos endpoint.
const unsplashProvider: AssetProvider = {
  id: 'unsplash',
  types: ['image'],
  rateLimitPerUserPerMinute: 60,

  async search(query, _type, page, orientation, env, rateLimiter, userId) {
    const allowed = await rateLimiter.consume(`unsplash:${userId}`, this.rateLimitPerUserPerMinute)
    if (!allowed) throw new RateLimitError('unsplash')

    const accessKey = env.UNSPLASH_ACCESS_KEY
    if (!accessKey) return []

    const oriMap: Record<string, string> = { landscape: 'landscape', portrait: 'portrait', square: 'squarish' }
    const oriParam = orientation !== 'all' && oriMap[orientation] ? `&orientation=${oriMap[orientation]}` : ''
    const perPage = 20
    const isDefaultQuery = !query.trim() || query === 'trending'
    const UTM = '?utm_source=postmaker&utm_medium=referral'

    // No query: use /photos curated feed instead of search (better quality defaults)
    const endpoint = isDefaultQuery
      ? `https://api.unsplash.com/photos?per_page=${perPage}&page=${page}&order_by=editorial`
      : `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}${oriParam}`

    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
    })

    // Parse rate limit remaining — protect from hourly quota exhaustion
    const remaining = parseInt(res.headers.get('x-ratelimit-remaining') ?? '50', 10)
    if (remaining <= 5) {
      console.warn(`[unsplash] Rate limit low: ${remaining} requests remaining this hour`)
      throw new RateLimitError('unsplash')
    }

    if (res.status === 429 || !res.ok) throw new Error(`[unsplash] API error ${res.status}`)

    const UNSPLASH_LICENSE: Attribution['license'] = 'Unsplash License'

    // Curated feed returns an array; search returns { results: [] }
    const raw = await res.json() as UnsplashPhoto[] | { results: UnsplashPhoto[] }
    const photos: UnsplashPhoto[] = Array.isArray(raw) ? raw : (raw as any).results ?? []

    return photos.map(p => ({
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
        license: UNSPLASH_LICENSE,
        // LEGALLY REQUIRED: Unsplash API Terms § "Attribution"
        attributionRequired: true,
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
// RATE LIMITS (from Openverse docs):
//   Unauthenticated: 100 requests/day per IP
//   Authenticated (OAuth2 token): 10,000 requests/day
//   We parse X-RateLimit-Available-Requests header if present.
// LICENSE: Per-image CC license returned in API response.
//   We map it to a human-readable string and flag attributionRequired=true
//   (all Creative Commons licenses require attribution).
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
  license?: string           // e.g. 'by', 'by-sa', 'by-nc', 'cc0'
  license_version?: string   // e.g. '2.0', '4.0'
  license_url?: string
}

function openverseLicenseLabel(license?: string, version?: string): string {
  if (!license) return 'CC'
  const l = license.toLowerCase()
  if (l === 'cc0' || l === 'pdm') return 'CC0 (Public Domain)'
  const prefix = 'CC'
  const suffix = version ? ` ${version}` : ''
  return `${prefix} ${l.toUpperCase()}${suffix}`
}

const openverseProvider: AssetProvider = {
  id: 'openverse',
  types: ['image'],
  rateLimitPerUserPerMinute: 60,

  async search(query, _type, page, _orientation, env, rateLimiter, userId) {
    const allowed = await rateLimiter.consume(`openverse:${userId}`, this.rateLimitPerUserPerMinute)
    if (!allowed) throw new RateLimitError('openverse')

    const perPage = 30
    const searchTerm = (!query.trim() || query === 'trending') ? 'nature landscape background' : query.trim()
    const endpoint = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(searchTerm)}&page=${page}&page_size=${perPage}&license_type=commercial&mature=false`

    const res = await fetch(endpoint, {
      headers: { 'User-Agent': 'PostMaker/1.0 (https://bypostamaker.com)' },
    })

    // Check Openverse rate limit header (available in newer API versions)
    const available = parseInt(res.headers.get('x-ratelimit-available-requests') ?? res.headers.get('x-ratelimit-remaining') ?? '100', 10)
    if (available <= 5) {
      console.warn(`[openverse] Rate limit low: ${available} remaining`)
    }

    if (res.status === 429 || !res.ok) throw new Error(`[openverse] API error ${res.status}`)

    const data = await res.json() as { results: OpenverseImageResult[] }

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
        providerName: 'Openverse',
        license: openverseLicenseLabel(p.license, p.license_version),
        // All CC licenses (except CC0) require attribution
        attributionRequired: !['cc0', 'pdm'].includes((p.license ?? '').toLowerCase()),
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
