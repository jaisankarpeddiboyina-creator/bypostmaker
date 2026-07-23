import type { Env } from '../../config/ai'
import { withAuth } from './middleware/auth'
import { withRateLimit, withIpRateLimit, withPresignRateLimit } from './middleware/rateLimit'
import { withCors } from './middleware/cors'
import { handleAuth } from './routes/auth'
import { handleGenerate } from './routes/generate'
import { handleRetry } from './routes/retry'
import { handleRefinement } from './routes/refinement'
import { handlePayments } from './routes/payments'
import { handleWebhook } from './routes/webhook'
import { handleUser } from './routes/user'
import { handleHistory } from './routes/history'
import { handleHealth } from './routes/health'
import { handleAdmin } from './routes/admin'
import { handlePromos } from './routes/promos'
import { handlePresignRoute, handlePresignBatchRoute, handleCleanupRoute } from './routes/upload'
import { handleImageRoute } from './routes/image'
import { handleBrandKit } from './routes/brand-kit'
import { runCronJobs, runDataRetention } from './services/cron'


import { blogPosts } from '../../config/blog'
import { vsPages } from '../../config/vsPages'
import { forPages } from '../../config/forPages'
import { faqEntries } from '../../config/faq'
import { findMatchingRoute, ROUTE_REGISTRY } from '../../config/routeRegistry'
import { snapshotAssetPathForRoute, SNAPSHOT_MANIFEST_ASSET_PATH } from '../../config/publicRoutes'
export { GroqRateLimiter } from './services/limiter'

class MetaRewriter {
  private title: string
  private description: string
  private url: string
  private ogImage: string

  constructor(title: string, description: string, url: string, ogImage: string) {
    this.title = title
    this.description = description
    this.url = url
    this.ogImage = ogImage
  }

  element(element: any) {
    const name = element.getAttribute('name')
    const property = element.getAttribute('property')
    const rel = element.getAttribute('rel')

    if (element.tagName === 'title') {
      element.setInnerContent(this.title)
    } else if (name === 'description') {
      element.setAttribute('content', this.description)
    } else if (property === 'og:title') {
      element.setAttribute('content', this.title)
    } else if (property === 'og:description') {
      element.setAttribute('content', this.description)
    } else if (property === 'og:url') {
      element.setAttribute('content', this.url)
    } else if (rel === 'canonical') {
      element.setAttribute('href', this.url)
    } else if (property === 'og:image') {
      element.setAttribute('content', this.ogImage)
    } else if (name === 'twitter:image') {
      element.setAttribute('content', this.ogImage)
    } else if (name === 'twitter:title') {
      element.setAttribute('content', this.title)
    } else if (name === 'twitter:description') {
      element.setAttribute('content', this.description)
    }
  }
}

// Injector for HTMLRewriter — appends JSON-LD structured data script tags into <head>
class HeadInjector {
  private schemas: string[]

  constructor(path: string, domain: string) {
    this.schemas = []

    // 1. Organization schema
    const orgSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'PostMaker',
      'url': domain,
      'logo': `${domain}/favicon.svg`,
      'description': 'AI-powered social media content generator for all 30+ platforms'
    }
    this.schemas.push(JSON.stringify(orgSchema))

    // 2. BreadcrumbList schema
    const breadcrumbs = this.generateBreadcrumbs(path, domain)
    this.schemas.push(JSON.stringify(breadcrumbs))

    // 3. SoftwareApplication (homepage only)
    if (path === '/') {
      const appSchema = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        'name': 'PostMaker',
        'applicationCategory': 'BusinessApplication',
        'description': 'AI-powered social media content generator for all 30+ platforms',
        'url': domain
      }
      this.schemas.push(JSON.stringify(appSchema))

      // 4. FAQPage schema — mainEntity is built from the same config/faq.ts
      // array the visible homepage accordion renders from, so this can
      // never drift out of sync with what's actually shown on the page.
      const faqSchema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        'mainEntity': faqEntries.map(entry => ({
          '@type': 'Question',
          'name': entry.question,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': entry.answer
          }
        }))
      }
      this.schemas.push(JSON.stringify(faqSchema))
    }
  }

  private generateBreadcrumbs(path: string, domain: string) {
    const segments = path.split('/').filter(Boolean)
    const items: any[] = [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': domain
      }
    ]

    let currentPath = ''
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      items.push({
        '@type': 'ListItem',
        'position': index + 2,
        'name': segment.charAt(0).toUpperCase() + segment.slice(1),
        'item': `${domain}${currentPath}`
      })
    })

    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': items
    }
  }

  element(element: any) {
    if (element.tagName === 'head') {
      for (const schema of this.schemas) {
        element.append(`<script type="application/ld+json">${schema}</script>`, { html: true })
      }
    }
  }
}

async function handleSitemap(request: Request, env: Env): Promise<Response> {
  try {
    const domain = 'https://bypostamaker.com'
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${domain}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${domain}/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${domain}/signup</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${domain}/privacy</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${domain}/terms</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${domain}/refund</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${domain}/cookies</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${domain}/shipping</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${domain}/contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${domain}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`

    // Add registry routes (indexable entries)
    for (const entry of ROUTE_REGISTRY) {
      if (entry.indexable !== false) {
        const priority = entry.priority ?? 0.5
        const changefreq = entry.dynamic ? 'weekly' : 'monthly'
        xml += `
  <url>
    <loc>${domain}${entry.pattern}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
      }
    }

    // Add blog posts
    for (const post of blogPosts) {
      xml += `
  <url>
    <loc>${domain}/blog/${post.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <lastmod>${post.date}</lastmod>
  </url>`
    }

    // Add comparison pages (concrete slugs — see config/vsPages.ts)
    for (const entry of vsPages) {
      xml += `
  <url>
    <loc>${domain}/vs/${entry.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    }

    // Add audience/use-case pages (concrete slugs — see config/forPages.ts)
    for (const entry of forPages) {
      xml += `
  <url>
    <loc>${domain}/for/${entry.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    }

    xml += '\n</urlset>'

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (err) {
    console.error('Sitemap generation failed:', err)
    return new Response('Internal Server Error', { status: 500 })
  }
}

async function handleStaticPageSEO(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const domain = 'https://bypostamaker.com'
  const canonicalUrl = `${domain}${path}`

  // 1. Resolve metadata for the route (defaults + registry override + existing fallbacks)
  let title = 'PostMaker — One prompt. Every platform. Download your kit.'
  let description = 'Write one prompt. PostMaker generates platform-perfect posts for all 30+ social platforms and packages them into a ready-to-post content kit.'
  let ogImage = `${domain}/og-image.svg`
  let is404 = false

  // Registry override: prefer ROUTE_REGISTRY when it matches the path.
  const registryMatch = findMatchingRoute(path)
  if (registryMatch) {
    if (registryMatch.title) title = registryMatch.title
    if (registryMatch.description) description = registryMatch.description
    if (registryMatch.ogImage) ogImage = registryMatch.ogImage
  } else {
    // Existing behavior: blog-specific resolution, then exact staticRoutes table.
    if (path.startsWith('/blog/')) {
      const slug = path.substring(6)
      const post = blogPosts.find(p => p.slug === slug)
      if (post) {
        title = `${post.title} | PostMaker Blog`
        description = post.description
        ogImage = post.ogImage || `${domain}/og-image.svg`
      } else {
        title = 'Post Not Found | PostMaker Blog'
        description = 'The blog post you are looking for does not exist or has been moved.'
        is404 = true
      }
    } else if (path.startsWith('/vs/')) {
      const slug = path.substring(4)
      const entry = vsPages.find(p => p.slug === slug)
      if (entry) {
        title = entry.title
        description = entry.description
        ogImage = entry.ogImage || `${domain}/og-image.svg`
      } else {
        title = 'Comparison Not Found | PostMaker'
        description = 'The comparison you are looking for does not exist or has been moved.'
        is404 = true
      }
    } else if (path.startsWith('/for/')) {
      const slug = path.substring(5)
      const entry = forPages.find(p => p.slug === slug)
      if (entry) {
        title = entry.title
        description = entry.description
        ogImage = entry.ogImage || `${domain}/og-image.svg`
      } else {
        title = 'Page Not Found | PostMaker'
        description = 'The page you are looking for does not exist or has been moved.'
        is404 = true
      }
    } else {
      const staticRoutes: Record<string, { title: string; description: string }> = {
        '/blog': {
          title: 'PostMaker Blog — Social Media Tips, AI & Creation Strategy',
          description: 'Learn how to multiply your reach, write perfect AI prompts, and optimize your social media strategy with PostMaker.'
        },
        '/privacy': {
          title: 'Privacy Policy | PostMaker',
          description: 'Read our privacy policy to understand how we collect, use, and protect your personal information.'
        },
        '/terms': {
          title: 'Terms of Service | PostMaker',
          description: 'Read our terms of service to understand your rights and responsibilities when using PostMaker.'
        },
        '/refund': {
          title: 'Refund Policy | PostMaker',
          description: 'Read our refund policy. We offer clear guidelines on refunds for our subscription plans.'
        },
        '/cookies': {
          title: 'Cookie Policy | PostMaker',
          description: 'Read our cookie policy to understand how we use cookies to improve your user experience.'
        },
        '/shipping': {
          title: 'Shipping Policy | PostMaker',
          description: 'Read our shipping policy details.'
        },
        '/contact': {
          title: 'Contact Us | PostMaker',
          description: 'Have questions or need help? Contact the PostMaker support team. We\'re here to assist you.'
        }
      }

      const routeMeta = staticRoutes[path]
      if (routeMeta) {
        title = routeMeta.title
        description = routeMeta.description
      }
    }
  }

  // Use registry-provided canonical if present; otherwise use domain+path (canonicalUrl).
  let finalCanonicalUrl = canonicalUrl
  if (registryMatch && registryMatch.canonical) finalCanonicalUrl = registryMatch.canonical

  // 2. Try a build-time pre-rendered snapshot first (real content for
  //    crawlers that don't execute JS). These are plain static files
  //    bundled into the same asset deploy as everything else — no
  //    separate bucket, no extra credentials. Falls back to the empty
  //    SPA shell below on ANY miss or error — this must never be fatal.
  let assetResponse: Response | null = null

  if (!is404) {
    try {
      const manifestRequest = new Request(new URL(SNAPSHOT_MANIFEST_ASSET_PATH, request.url))
      const manifestResponse = await env.ASSETS.fetch(manifestRequest)

      if (manifestResponse.ok) {
        const manifest = JSON.parse(await manifestResponse.text()) as { routes?: string[] }
        const snapshotAssetPath = snapshotAssetPathForRoute(path)

        if (Array.isArray(manifest.routes) && manifest.routes.includes(snapshotAssetPath)) {
          const snapshotRequest = new Request(new URL(snapshotAssetPath, request.url))
          const snapshotResponse = await env.ASSETS.fetch(snapshotRequest)

          if (snapshotResponse.ok) {
            const snapshotBody = await snapshotResponse.text()
            // Sanity check: a real snapshot is a full rendered page, not
            // the ~3KB empty SPA shell. Guards against the rare case the
            // manifest lists a file that's somehow missing at request
            // time (asset fallback would otherwise silently hand back
            // the shell disguised as a 200).
            if (snapshotBody.length > 1500) {
              assetResponse = new Response(snapshotBody, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              })
            }
          }
        }
      }
    } catch (err) {
      // Manifest missing/malformed (e.g. JSON.parse on the SPA shell's
      // HTML when the manifest itself doesn't exist yet) or snapshot
      // fetch failed — not fatal, just fall through to the shell.
      console.error('Snapshot lookup failed, falling back to SPA shell:', err)
    }
  }

  // 2b. Fetch the SPA shell index.html from static assets (fallback path,
  // and also the path for unknown-blog-post 404s which never had a snapshot).
  if (!assetResponse) {
    try {
      // Constraint #2: construct a new request pointing explicitly to /index.html
      const indexRequest = new Request(new URL('/index.html', request.url))
      assetResponse = await env.ASSETS.fetch(indexRequest)

      if (!assetResponse.ok) {
        throw new Error(`ASSETS.fetch returned status ${assetResponse.status}`)
      }
    } catch (err) {
      console.error('Failed to fetch SPA shell index.html:', err)
      return new Response('Asset Not Found', { status: 404 })
    }
  }

  // 3. Apply HTMLRewriter transformations (meta tags + structured data)
  try {
    const headInjector = new HeadInjector(path, domain)
    const rewriter = new HTMLRewriter()
      .on('title', new MetaRewriter(title, description, finalCanonicalUrl, ogImage))
      .on('meta', new MetaRewriter(title, description, finalCanonicalUrl, ogImage))
      .on('link', new MetaRewriter(title, description, finalCanonicalUrl, ogImage))
      .on('head', headInjector)

    const transformedResponse = rewriter.transform(assetResponse)

    // Constraint #3: Unknown blog post returns 404 status but serves the SPA shell
    const status = is404 ? 404 : 200
    
    const newHeaders = new Headers(transformedResponse.headers)
    newHeaders.set('Cache-Control', is404 ? 'no-cache' : 'public, max-age=3600')

    return new Response(transformedResponse.body, {
      status,
      headers: newHeaders
    })
  } catch (err) {
    console.error('HTMLRewriter failed:', err)
    return assetResponse
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), env)

    try {
      // ── Constraint #1: Public page and sitemap routes ───────────────────────
      // Must be intercepted BEFORE auth guards and rate limiters.
      if (path === '/sitemap.xml') {
        return handleSitemap(request, env)
      }
      if (
        !path.startsWith('/api/') &&
        (path.startsWith('/blog') ||
         path === '/vs' || path.startsWith('/vs/') ||
         // Exact/subpath match only — NOT startsWith('/for'), which would
         // also incorrectly match the existing /forgot-password route.
         path === '/for' || path.startsWith('/for/') ||
         findMatchingRoute(path) ||
         path === '/privacy' ||
         path === '/terms' ||
         path === '/refund' ||
         path === '/cookies' ||
         path === '/shipping' ||
         path === '/contact')
      ) {
        return handleStaticPageSEO(request, env)
      }

      // ── Public routes ───────────────────────────────────────
      if (path.startsWith('/api/auth')) {
        // Scoped IP rate limiting for sensitive email routes
        if (
          path === '/api/auth/email/signup' ||
          path === '/api/auth/email/login' ||
          path === '/api/auth/email/forgot-password' ||
          path === '/api/auth/email/reset-password'
        ) {
          const limit = path === '/api/auth/email/signup' ? 10 : 5
          const ipRl = await withIpRateLimit(request, env, limit)
          if (!ipRl.ok) {
            return withCors(new Response(JSON.stringify({ error: 'Too many requests' }), {
              status: 429,
              headers: { 'Content-Type': 'application/json', 'Retry-After': String(ipRl.retryAfter ?? 60) },
            }), env)
          }
        }
        return withCors(await handleAuth(request, env), env)
      }
      if (path === '/api/webhooks/razorpay') return withCors(await handleWebhook(request, env, ctx), env)
      if (path === '/api/health') return withCors(await handleHealth(env), env)
      if (path === '/api/test/retention' && env.ENVIRONMENT === 'development') {
        await runDataRetention(env)
        return withCors(new Response(JSON.stringify({ ok: true, message: 'Retention completed' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }), env)
      }
      if (path === '/api/test/upload' && env.ENVIRONMENT === 'development') {
        const url = new URL(request.url)
        const key = url.searchParams.get('key')
        if (!key) {
          return withCors(new Response(JSON.stringify({ error: 'Missing key' }), {
            status: 400, headers: { 'Content-Type': 'application/json' },
          }), env)
        }
        const contentType = request.headers.get('Content-Type') ?? 'image/jpeg'
        const body = await request.arrayBuffer()
        await env.BUCKET.put(key, body, {
          httpMetadata: { contentType }
        })
        return withCors(new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }), env)
      }
      if (path === '/api/test/token' && env.ENVIRONMENT !== 'production') {
        const { signJWT, getJwtSecret } = await import('./middleware/auth')
        const token = await signJWT(
          { sub: '20493641-4030-4fa3-bbe6-b377d4661f87', plan: 'business' },
          getJwtSecret(env)
        )
        return withCors(new Response(JSON.stringify({ token }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }), env)
      }

      // ── Auth guard ──────────────────────────────────────────
      const auth = await withAuth(request, env)
      if (!auth.ok) {
        return withCors(new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { 'Content-Type': 'application/json' },
        }), env)
      }
      const { userId, userPlan, userRole, emailVerified } = auth

      // ── Email verification guard ────────────────────────────
      if (!emailVerified && path !== '/api/user/me' && path !== '/api/user/resend-verification') {
        return withCors(new Response(JSON.stringify({ error: 'Email not verified' }), {
          status: 403, headers: { 'Content-Type': 'application/json' },
        }), env)
      }

      // ── Rate limit ──────────────────────────────────────────
      const rl = await withRateLimit(request, env, userId)
      if (!rl.ok) {
        return withCors(new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter ?? 60) },
        }), env)
      }

      // ── Protected routes ────────────────────────────────────
      if (path === '/api/upload/presign' && request.method === 'POST') {
        const presignRl = await withPresignRateLimit(request, env, userId)
        if (!presignRl.ok) {
          return withCors(new Response(JSON.stringify({ error: 'Too many upload requests. Wait a moment.' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': String(presignRl.retryAfter ?? 60) },
          }), env)
        }
        return withCors(await handlePresignRoute(request, env, userId), env)
      }

      if (path === '/api/upload/presign-batch' && request.method === 'POST') {
        const presignRl = await withPresignRateLimit(request, env, userId)
        if (!presignRl.ok) {
          return withCors(new Response(JSON.stringify({ error: 'Too many upload requests. Wait a moment.' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': String(presignRl.retryAfter ?? 60) },
          }), env)
        }
        return withCors(await handlePresignBatchRoute(request, env, userId), env)
      }

      if (path === '/api/upload/cleanup' && request.method === 'POST') {
        return withCors(await handleCleanupRoute(request, env, userId), env)
      }


      if (path === '/api/generate' && request.method === 'POST')
        return withCors(await handleGenerate(request, env, userId, userPlan, ctx), env)

      if (path === '/api/generate/retry' && request.method === 'POST')
        return withCors(await handleRetry(request, env, userId, userPlan, ctx), env)

      if (path.startsWith('/api/refine'))
        return withCors(await handleRefinement(request, env, userId, userPlan), env)

      if (path.startsWith('/api/payments'))
        return withCors(await handlePayments(request, env, userId), env)

      if (path.startsWith('/api/promos'))
        return withCors(await handlePromos(request, env, userId), env)

      if (path.startsWith('/api/user'))
        return withCors(await handleUser(request, env, userId), env)

      if (path.startsWith('/api/history'))
        return withCors(await handleHistory(request, env, userId), env)

      if (path.startsWith('/api/brand-kit'))
        return withCors(await handleBrandKit(request, env, userId), env)

      if (path.startsWith('/api/image/') && request.method === 'GET')

        return withCors(await handleImageRoute(request, env, userId), env)

      if (path.startsWith('/api/admin'))
        return withCors(await handleAdmin(request, env, userId, userRole), env)

      return withCors(new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      }), env)
    } catch (err) {
      console.error('Worker unhandled error:', err)
      return withCors(new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      }), env)
    }
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCronJobs(controller.cron, env))
  },
} satisfies ExportedHandler<Env>
