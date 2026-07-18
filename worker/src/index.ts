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
import { handlePresignRoute } from './routes/upload'
import { runCronJobs, runDataRetention } from './services/cron'
import { blogPosts } from '../../config/blog'
import { findMatchingRoute } from '../../config/routeRegistry'
import { snapshotKeyForPath } from '../../config/publicRoutes'

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

    // NOTE: ROUTE_REGISTRY entries (/pricing, /vs, /vs/*, /for, /for/*) are
    // intentionally NOT added to the sitemap yet. /pricing currently
    // redirects client-side to /#pricing (see frontend/src/App.tsx) rather
    // than rendering a real page — it has a snapshotKey in the registry,
    // suggesting a real static page is planned, at which point it should
    // be added. /vs and /for are dynamic prefix patterns with no concrete
    // page instances yet. Revisit once real pages exist for any of these.

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
  //    crawlers that don't execute JS). Falls back to the empty SPA
  //    shell below on ANY miss or error — this must never be fatal.
  let assetResponse: Response | null = null

  if (!is404) {
    try {
      const snapshotKey = snapshotKeyForPath(path)
      const snapshotObject = await env.SNAPSHOTS.get(snapshotKey)
      if (snapshotObject) {
        assetResponse = new Response(snapshotObject.body, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      }
    } catch (err) {
      // Snapshot bucket unavailable or object read failed — not fatal,
      // just fall through to the SPA shell like before.
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

      if (path === '/api/generate' && request.method === 'POST')
        return withCors(await handleGenerate(request, env, userId, userPlan, ctx), env)

      if (path === '/api/generate/retry' && request.method === 'POST')
        return withCors(await handleRetry(request, env, userId, userPlan), env)

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
