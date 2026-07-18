// scripts/prerender.ts
//
// Build-time static pre-rendering for PostMaker's public marketing/blog
// pages. Runs AFTER `npm run build` (frontend/dist must already exist).
//
// What it does:
//   1. Serves frontend/dist locally via `vite preview`.
//   2. Visits every route from config/publicRoutes.ts in headless Chrome
//      (real browser, not react-dom/server — the app touches Sentry,
//      PostHog, and window/localStorage at module scope, so rendering
//      in an actual browser context is the only way to get correct HTML
//      without hand-guarding every side effect for a Node environment).
//   3. Waits for the SPA to actually render content into #root.
//   4. Writes each page's full HTML to ./snapshots-out/<key>, mirroring
//      the R2 key it will be uploaded under (see snapshotKeyForPath).
//
// Deliberately does NOT talk to R2/Cloudflare directly — it just
// produces local files. The CI workflow uploads them with `wrangler r2
// object put`, where the Cloudflare credentials already live. This
// keeps the script runnable and testable on any machine with no cloud
// access at all.
//
// Failure handling: a single route failing to render (timeout, JS
// error, etc.) is logged and skipped — it must NOT block the rest of
// the pages or fail the whole CI pipeline. Only a systemic failure
// (preview server never came up, or literally zero routes rendered)
// causes a non-zero exit.

import { chromium } from 'playwright'
import { spawn, ChildProcess } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getPublicRoutes } from '../config/publicRoutes'

const PREVIEW_PORT = 4173
const PREVIEW_HOST = `http://localhost:${PREVIEW_PORT}`
const OUT_DIR = path.resolve(__dirname, '../snapshots-out')
const STARTUP_TIMEOUT_MS = 30_000
const PAGE_TIMEOUT_MS = 15_000

function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url)
        if (res.ok || res.status === 404) {
          // Server is up and answering (404 is fine, just means SPA
          // fallback hasn't kicked in yet for this exact check — the
          // process is alive and responding).
          resolve()
          return
        }
      } catch {
        // Not up yet, keep polling.
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Preview server did not respond within ${timeoutMs}ms`))
        return
      }
      setTimeout(attempt, 500)
    }
    attempt()
  })
}

function startPreviewServer(): ChildProcess {
  const frontendDir = path.resolve(__dirname, '../frontend')
  return spawn(
    'npx',
    ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
    { cwd: frontendDir, stdio: 'inherit' }
  )
}

async function main() {
  const routes = getPublicRoutes()
  console.log(`Prerendering ${routes.length} public route(s)...`)

  await mkdir(OUT_DIR, { recursive: true })

  const server = startPreviewServer()
  let serverExited = false
  server.on('exit', () => { serverExited = true })

  const cleanup = () => {
    if (!serverExited && server.pid) {
      server.kill()
    }
  }

  try {
    await waitForServer(PREVIEW_HOST, STARTUP_TIMEOUT_MS)
  } catch (err) {
    cleanup()
    console.error('FATAL: preview server never came up:', err)
    process.exit(1)
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()

  let succeeded = 0
  let failed = 0

  for (const route of routes) {
    try {
      const response = await page.goto(`${PREVIEW_HOST}${route.path}`, {
        waitUntil: 'networkidle',
        timeout: PAGE_TIMEOUT_MS,
      })

      if (!response || !response.ok()) {
        throw new Error(`Bad response: ${response?.status()}`)
      }

      // Make sure React actually mounted real content, not just the
      // empty shell — a blank #root means something failed silently.
      await page.waitForFunction(
        () => {
          const root = document.getElementById('root')
          return !!root && root.childElementCount > 0
        },
        { timeout: PAGE_TIMEOUT_MS }
      )

      const html = await page.content()
      const outPath = path.join(OUT_DIR, route.snapshotKey)
      await mkdir(path.dirname(outPath), { recursive: true })
      await writeFile(outPath, html, 'utf-8')

      console.log(`  ✓ ${route.path} -> ${route.snapshotKey}`)
      succeeded++
    } catch (err) {
      // Log and skip — one bad route must not take down the whole build.
      console.error(`  ✗ ${route.path} failed, skipping:`, (err as Error).message)
      failed++
    }
  }

  await browser.close()
  cleanup()

  console.log(`Prerender complete: ${succeeded} succeeded, ${failed} failed.`)

  // Only fail the pipeline if NOTHING rendered — that's a systemic
  // problem (broken build, preview server misconfigured, etc.), not a
  // one-off page issue.
  if (succeeded === 0 && routes.length > 0) {
    console.error('FATAL: zero routes rendered successfully.')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Prerender script crashed:', err)
  process.exit(1)
})
