// config/routeRegistry.ts
// Registry of public, indexable marketing routes to drive Worker routing and CI snapshot generation.

export type RoutePattern = string // exact path or pattern like '/vs/*' or '/for/*'

export interface RouteEntry {
  pattern: RoutePattern
  title?: string
  description?: string
  canonical?: string
  ogImage?: string
  indexable?: boolean
  snapshotKey?: string
  dynamic?: boolean
  priority?: number
}

export const ROUTE_REGISTRY: RouteEntry[] = [
  {
    pattern: '/pricing',
    title: 'Pricing — PostMaker',
    description: 'Choose a plan that fits your creator workflow.',
    indexable: true,
    snapshotKey: 'snapshots/pricing.html',
    priority: 0.8
  },
  // Comparison list page. NOTE: no '/vs/*' wildcard entry here — that
  // pattern was being emitted literally into sitemap.xml as an invalid
  // '.../vs/*' URL (findMatchingRoute only needs exact entries; concrete
  // /vs/:slug pages are matched via an explicit path prefix check in the
  // Worker and listed individually in the sitemap from config/vsPages.ts,
  // the same way /blog/:slug already works).
  {
    pattern: '/vs',
    title: 'Compare PostMaker — See How We Stack Up',
    description: 'Compare PostMaker with other social media content tools.',
    indexable: true
  },
  // Audience/use-case list page. Same reasoning as '/vs' above — no
  // '/for/*' wildcard entry; concrete /for/:slug pages come from
  // config/forPages.ts.
  {
    pattern: '/for',
    title: 'PostMaker For Every Team — Find Your Use Case',
    description: 'See how PostMaker fits your specific workflow.',
    indexable: true
  }
]

/**
 * Find a matching route entry for a given request path.
 * Supports exact matches and prefix patterns ending with '/*'.
 */
export function findMatchingRoute(path: string): RouteEntry | undefined {
  // Normalize path: ensure it starts with '/'
  if (!path.startsWith('/')) path = '/' + path

  for (const entry of ROUTE_REGISTRY) {
    const p = entry.pattern
    if (p.endsWith('/*')) {
      const prefix = p.slice(0, -1) // '/vs/*' => '/vs/'
      // Match /vs (exact) or any subpath /vs/... 
      if (path === prefix.slice(0, -1) || path.startsWith(prefix)) return entry
    } else {
      // exact match
      if (p === path) return entry
    }
  }
  return undefined
}
