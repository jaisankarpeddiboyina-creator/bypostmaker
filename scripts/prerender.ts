// scripts/prerender.ts
//
// Build-time static pre-rendering for PostMaker's public marketing/blog
// pages. Runs AFTER `npm run build` (frontend/dist must already exist —
// this script ADDS files into it, it does not replace the build).
//
// What it does:
//   1. Serves frontend/dist locally via `vite preview`.
//   2. Visits every route from config/publicRoutes.ts in headless Chrome
//      (real browser, not react-dom/server — the app touches Sentry,
//      PostHog, and window/localStorage at module scope, so rendering
//      in an actual browser context is the only way to get correct HTML
//      without hand-guarding every side effect for a Node environment).
//   3. Waits for the SPA to actually render content into #root.
//   4. Writes each page's full HTML directly into
//      frontend/dist/__snapshots__/<...>.html — a REAL static file that
//      gets uploaded automatically by the existing `wrangler deploy`
//      step, same as any file in frontend/public/. No separate cloud
//      bucket, no extra credentials, no new infrastructure.
//   5. Writes frontend/dist/__snapshots__/manifest.json listing which
//      routes were successfully rendered, so the Worker can cheaply know
//      whether to look for a snapshot before fetching it.
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
const PREVIEW_HOST = `http://127.0.0.1:${PREVIEW_PORT}`
const DIST_DIR = path.resolve(__dirname, '../frontend/dist')
const SNAPSHOTS_DIR = path.join(DIST_DIR, '__snapshots__')
const STARTUP_TIMEOUT_MS = 30_000
const PAGE_TIMEOUT_MS = 15_000

function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url)
        if (res.ok || res.status === 404) {
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
  // Serves the ALREADY-BUILT dist/ as-is. Run before this script writes
  // any snapshot files into dist/, so the server never serves its own
  // in-progress output back to itself.
  return spawn(
    'npx',
    ['-y', 'vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: frontendDir, stdio: 'inherit', shell: true }
  )
}

async function main() {
  const routes = getPublicRoutes()
  console.log(`Prerendering ${routes.length} public route(s)...`)

  await mkdir(SNAPSHOTS_DIR, { recursive: true })

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
  const manifestEntries: string[] = [] // snapshotAssetPath values that succeeded

  for (const route of routes) {
    try {
      const response = await page.goto(`${PREVIEW_HOST}${route.path}`, {
        waitUntil: 'domcontentloaded',
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

      // route.snapshotAssetPath is a leading-slash asset path like
      // '/__snapshots__/blog/my-post.html' — write it under DIST_DIR,
      // stripping the leading '/' for a valid filesystem join.
      const outPath = path.join(DIST_DIR, route.snapshotAssetPath.replace(/^\//, ''))
      await mkdir(path.dirname(outPath), { recursive: true })
      await writeFile(outPath, html, 'utf-8')

      manifestEntries.push(route.snapshotAssetPath)
      console.log(`  ✓ ${route.path} -> ${route.snapshotAssetPath}`)
      succeeded++
    } catch (err) {
      // Log and skip — one bad route must not take down the whole build.
      console.error(`  ✗ ${route.path} failed, skipping:`, (err as Error).message)
      failed++
    }
  }

  await browser.close()
  cleanup()

  // Manifest lets the Worker know, cheaply, which routes actually got a
  // snapshot — written even on partial failure so it always reflects
  // exactly what's really on disk.
  const manifestPath = path.join(SNAPSHOTS_DIR, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify({ routes: manifestEntries }, null, 2), 'utf-8')

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
