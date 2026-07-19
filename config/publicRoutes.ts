// config/publicRoutes.ts
//
// Single source of truth for "which concrete URLs are public, indexable,
// and eligible for a build-time pre-rendered HTML snapshot".
//
// Used by BOTH:
//   - scripts/prerender.ts (build time: renders pages, writes them as real
//     static files directly into frontend/dist/__snapshots__/, which get
//     uploaded automatically by the normal `wrangler deploy` — no separate
//     cloud bucket, no extra auth step, no new infrastructure)
//   - worker/src/index.ts   (request time: looks up a snapshot by asset path
//     via the existing ASSETS binding)
//
// Keeping this in one file means the two can never drift out of sync —
// add a static page here once and both sides pick it up automatically.

import { blogPosts } from './blog'

export interface PublicRoute {
  /** Concrete path, e.g. '/blog/my-post'. Never a pattern/wildcard. */
  path: string
  /** Static asset path (under frontend/dist) this route's snapshot lives at. */
  snapshotAssetPath: string
}

// Static public pages with fixed content (not user/DB driven).
const STATIC_PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/blog',
  '/privacy',
  '/terms',
  '/refund',
  '/cookies',
  '/shipping',
  '/contact',
] as const

/**
 * Deterministic static-asset path for a given concrete route path.
 * '/'                -> '/__snapshots__/index.html'
 * '/blog'             -> '/__snapshots__/blog.html'
 * '/blog/my-post'     -> '/__snapshots__/blog/my-post.html'
 *
 * Lives under a dedicated '__snapshots__' folder so it can never collide
 * with a real route or an existing static asset.
 */
export function snapshotAssetPathForRoute(path: string): string {
  const clean = path === '/' ? '/index' : path.replace(/\/+$/, '')
  return `/__snapshots__${clean}.html`
}

/**
 * Full list of concrete public routes eligible for pre-rendering.
 * Expands blog slugs from config/blog.ts so new posts are picked up
 * automatically on the next build — nothing to hand-maintain.
 */
export function getPublicRoutes(): PublicRoute[] {
  const routes: PublicRoute[] = STATIC_PUBLIC_PATHS.map(path => ({
    path,
    snapshotAssetPath: snapshotAssetPathForRoute(path),
  }))

  for (const post of blogPosts) {
    const path = `/blog/${post.slug}`
    routes.push({ path, snapshotAssetPath: snapshotAssetPathForRoute(path) })
  }

  return routes
}

/** Where the build-time manifest of successfully-rendered snapshots lives. */
export const SNAPSHOT_MANIFEST_ASSET_PATH = '/__snapshots__/manifest.json'
