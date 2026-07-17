// config/routeRegistry.ts
//
// Central registry for routes that need SEO metadata overrides but aren't
// (yet) simple static pages handled by the staticRoutes table in
// worker/src/index.ts. Supports exact paths and prefix patterns ("/vs/*").
//
// Consumed by worker/src/index.ts via findMatchingRoute(path) to:
//   1. decide whether a request should be routed to handleStaticPageSEO()
//   2. resolve title/description/ogImage/canonical overrides for that route

export interface RouteEntry {
  /** Exact path ("/pricing") or prefix pattern ending in "/*" ("/vs/*") */
  path: string
  title?: string
  description?: string
  ogImage?: string
  /** Overrides the default domain+path canonical URL when set */
  canonical?: string
  /**
   * Identifier for a pre-rendered static snapshot of this route, once one
   * exists. Not yet consumed anywhere — reserved for when /pricing (or
   * others) gets a real server-rendered page instead of the current
   * client-side redirect to /#pricing.
   */
  snapshotKey?: string
}

export const ROUTE_REGISTRY: RouteEntry[] = [
  {
    path: '/pricing',
    title: 'Pricing | PostMaker',
    description: 'Plans from Free (5 generations/month, 6 platforms) to Business ($49/mo, 1,000 generations, all 30+ platforms). Start free, no card needed.',
    snapshotKey: 'pricing'
  },
  {
    path: '/vs/*',
    title: 'PostMaker Comparison | PostMaker',
    description: 'See how PostMaker compares for AI-powered social media content generation across 30+ platforms.'
  },
  {
    path: '/for/*',
    title: 'PostMaker for Your Use Case | PostMaker',
    description: 'See how PostMaker helps you generate platform-perfect social content for your specific use case.'
  }
]

/**
 * Returns the matching registry entry for a given path, or undefined.
 * Exact paths match first. Prefix entries ("/vs/*") match only the exact
 * prefix itself or the prefix followed by "/", so "/for" never matches
 * unrelated paths like "/forgot-password".
 */
export function findMatchingRoute(path: string): RouteEntry | undefined {
  const exact = ROUTE_REGISTRY.find(entry => !entry.path.endsWith('/*') && entry.path === path)
  if (exact) return exact

  for (const entry of ROUTE_REGISTRY) {
    if (!entry.path.endsWith('/*')) continue
    const prefix = entry.path.slice(0, -2) // strip trailing "/*"
    if (path === prefix || path.startsWith(prefix + '/')) {
      return entry
    }
  }

  return undefined
}
