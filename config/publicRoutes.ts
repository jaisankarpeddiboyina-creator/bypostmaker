// config/publicRoutes.ts
//
// Single source of truth for "which concrete URLs are public, indexable,
// and eligible for a build-time pre-rendered HTML snapshot".
//
// Used by BOTH:
//   - scripts/prerender.ts (build time: renders + uploads snapshots)
//   - worker/src/index.ts   (request time: looks up a snapshot by key)
//
// Keeping this in one file means the two can never drift out of sync —
// add a static page here once and both sides pick it up automatically.

import { blogPosts } from './blog'

export interface PublicRoute {
  /** Concrete path, e.g. '/blog/my-post'. Never a pattern/wildcard. */
  path: string
  /** R2 object key under the SNAPSHOTS bucket for this route's HTML. */
  snapshotKey: string
}

// Static public pages with fixed content (not user/DB driven).
// NOTE: '/pricing' is intentionally excluded — it's a client-side
// redirect to '/#pricing' in App.tsx, not a real page. Pre-rendering
// it would hand search engines a redirect stub instead of content.
const STATIC_PUBLIC_PATHS = [
  '/',
  '/blog',
  '/privacy',
  '/terms',
  '/refund',
  '/cookies',
  '/shipping',
  '/contact',
] as const

/**
 * Deterministic R2 key for a given concrete path.
 * '/'                -> 'snapshots/index.html'
 * '/blog'             -> 'snapshots/blog.html'
 * '/blog/my-post'     -> 'snapshots/blog/my-post.html'
 */
export function snapshotKeyForPath(path: string): string {
  const clean = path === '/' ? '/index' : path.replace(/\/+$/, '')
  return `snapshots${clean}.html`
}

/**
 * Full list of concrete public routes eligible for pre-rendering.
 * Expands blog slugs from config/blog.ts so new posts are picked up
 * automatically on the next build — nothing to hand-maintain.
 */
export function getPublicRoutes(): PublicRoute[] {
  const routes: PublicRoute[] = STATIC_PUBLIC_PATHS.map(path => ({
    path,
    snapshotKey: snapshotKeyForPath(path),
  }))

  for (const post of blogPosts) {
    const path = `/blog/${post.slug}`
    routes.push({ path, snapshotKey: snapshotKeyForPath(path) })
  }

  return routes
}
