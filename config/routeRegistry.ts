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
  // Comparison pages (dynamic under /vs/*)
  {
    pattern: '/vs',
    title: 'Product comparisons — PostMaker',
    description: 'Compare PostMaker with other products and platforms.',
    indexable: true,
    dynamic: true
  },
  {
    pattern: '/vs/*',
    title: 'Product comparisons — PostMaker',
    description: 'Compare PostMaker with other products and platforms.',
    indexable: true,
    dynamic: true
  },
  // Platform pages (dynamic under /for/*)
  {
    pattern: '/for',
    title: 'Platform pages — PostMaker',
    description: 'Platform-specific landing pages (LinkedIn, Instagram, etc.)',
    indexable: true,
    dynamic: true
  },
  {
    pattern: '/for/*',
    title: 'Platform pages — PostMaker',
    description: 'Platform-specific landing pages (LinkedIn, Instagram, etc.)',
    indexable: true,
    dynamic: true
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
