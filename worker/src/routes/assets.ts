import type { Env } from '../../../config/ai'
import { generateId } from '../utils/id'
import { ASSET_PROVIDERS, findProviders, RateLimitError } from '../services/asset-providers'
import { consumeAssetSlot } from '../services/limiter'

interface RequestAttribution {
  authorName?: string
  authorUrl?: string
  sourceUrl?: string
  providerName?: string
}

export async function handleAssetsRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  // Helper for JSON error responses
  const jsonError = (message: string, status = 400) => {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  };

  const jsonSuccess = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  };

  try {
    // ── GET /api/assets/free-media ──────────────────────────────
    if (path === '/api/assets/free-media' && method === 'GET') {
      let q = url.searchParams.get('q') || ''
      if (!q || q.trim() === '' || q.trim() === 'null') {
        q = 'trending'
      }
      // Normalise query — trim only, never append extra words that corrupt provider searches
      q = q.trim()

      const orientation = (url.searchParams.get('orientation') || 'all') as 'all' | 'landscape' | 'portrait' | 'square'
      const type = (url.searchParams.get('type') || 'image') as 'image' | 'video' | 'icon' | 'font'
      const page = parseInt(url.searchParams.get('page') || '1', 10)

      const providers = findProviders(type)
      if (providers.length === 0) {
        return jsonSuccess({ results: [], total: 0, providerError: false })
      }

      const rateLimiter = {
        async consume(key: string, limitPerMinute: number): Promise<boolean> {
          const [providerId] = key.split(':')
          const res = await consumeAssetSlot(env, userId, providerId, limitPerMinute)
          return res.allowed
        },
      }

      // Query all matching providers concurrently.
      // Track whether any provider returned a real error (vs. simply 0 results)
      // so the frontend can distinguish "genuine zero" from "upstream failure".
      let hadProviderError = false

      const resultsArray = await Promise.all(
        providers.map(async (provider) => {
          try {
            return await provider.search(q, type, page, orientation, env, rateLimiter, userId)
          } catch (err: any) {
            console.error(`[free-media] Provider ${provider.id} search failed:`, err)
            if (err instanceof RateLimitError) {
              throw err
            }
            hadProviderError = true
            return []
          }
        })
      )

      const flattened = resultsArray.flat()
      return jsonSuccess({ results: flattened, total: flattened.length, providerError: hadProviderError && flattened.length === 0 })
    }

    // ── GET /api/assets/folders ──────────────────────────────────
    if (path === '/api/assets/folders' && method === 'GET') {
      const folders = await env.DB.prepare(
        'SELECT id, name, created_at FROM asset_folders WHERE user_id = ? ORDER BY name ASC'
      ).bind(userId).all()
      return jsonSuccess({ folders: folders.results || [] })
    }

    // ── POST /api/assets/folders ─────────────────────────────────
    if (path === '/api/assets/folders' && method === 'POST') {
      const body = await request.json() as { name?: string }
      if (!body.name || body.name.trim() === '') {
        return jsonError('Folder name is required')
      }

      const folderId = generateId()
      await env.DB.prepare(
        'INSERT INTO asset_folders (id, user_id, name, created_at) VALUES (?, ?, ?, unixepoch())'
      ).bind(folderId, userId, body.name.trim()).run()

      return jsonSuccess({ success: true, folder: { id: folderId, name: body.name.trim() } })
    }

    // ── DELETE /api/assets/folders/:id ───────────────────────────
    if (path.startsWith('/api/assets/folders/') && method === 'DELETE') {
      const folderId = path.split('/').pop()
      if (!folderId) return jsonError('Folder ID is required')

      // Verify folder owner
      const folder = await env.DB.prepare(
        'SELECT id FROM asset_folders WHERE id = ? AND user_id = ?'
      ).bind(folderId, userId).first()

      if (!folder) {
        return jsonError('Folder not found or unauthorized', 404)
      }

      // Explicitly nullify folder_id for assets inside the folder before delete
      await env.DB.prepare(
        'UPDATE assets SET folder_id = NULL WHERE folder_id = ? AND user_id = ?'
      ).bind(folderId, userId).run()

      // Delete the folder
      await env.DB.prepare(
        'DELETE FROM asset_folders WHERE id = ? AND user_id = ?'
      ).bind(folderId, userId).run()

      return jsonSuccess({ success: true })
    }

    // ── GET /api/assets/serve ────────────────────────────────────
    if (path === '/api/assets/serve' && method === 'GET') {
      const id = url.searchParams.get('id')
      if (!id) return jsonError('Asset ID is required')

      const row = await env.DB.prepare(
        'SELECT r2_key, mime_type FROM assets WHERE id = ? AND user_id = ?'
      ).bind(id, userId).first<{ r2_key: string | null, mime_type: string | null }>()

      if (!row || !row.r2_key) {
        return jsonError('Asset not found', 404)
      }

      const object = await env.BUCKET.get(row.r2_key)
      if (!object) {
        return jsonError('File not found in storage', 404)
      }

      const contentType = row.mime_type || object.httpMetadata?.contentType || 'application/octet-stream'
      return new Response(object.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
          'Content-Length': String(object.size),
        },
      })
    }

    // ── GET /api/assets/proxy ────────────────────────────────────
    // Secure CORS media proxy endpoint for downloading external stock assets
    if (path === '/api/assets/proxy' && method === 'GET') {
      const targetUrl = url.searchParams.get('url')
      if (!targetUrl) return jsonError('URL parameter is required')

      try {
        const parsed = new URL(targetUrl)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return jsonError('Invalid protocol', 400)
        }

        const externalRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'PostMaker/1.0',
          },
        })

        if (!externalRes.ok) {
          return jsonError(`Failed to fetch external resource (${externalRes.status})`, 502)
        }

        const contentType = externalRes.headers.get('Content-Type') || 'application/octet-stream'

        return new Response(externalRes.body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (err: any) {
        return jsonError(`Proxy error: ${err.message}`, 500)
      }
    }

    // ── GET /api/assets ──────────────────────────────────────────
    if (path === '/api/assets' && method === 'GET') {
      const type = url.searchParams.get('type')
      const folderId = url.searchParams.get('folder_id')
      const favorite = url.searchParams.get('favorite')
      const trashed = url.searchParams.get('trashed') ?? '0' // default to not trashed
      const q = url.searchParams.get('q')
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const limit = parseInt(url.searchParams.get('limit') || '20', 10)
      const offset = (page - 1) * limit

      let query = 'SELECT * FROM assets WHERE user_id = ?'
      let countQuery = 'SELECT COUNT(*) as total FROM assets WHERE user_id = ?'
      const params: any[] = [userId]

      if (type) {
        query += ' AND type = ?'
        countQuery += ' AND type = ?'
        params.push(type)
      }

      if (folderId) {
        if (folderId === 'root' || folderId === 'null') {
          query += ' AND folder_id IS NULL'
          countQuery += ' AND folder_id IS NULL'
        } else {
          query += ' AND folder_id = ?'
          countQuery += ' AND folder_id = ?'
          params.push(folderId)
        }
      }

      if (favorite !== null && favorite !== undefined) {
        query += ' AND is_favorite = ?'
        countQuery += ' AND is_favorite = ?'
        params.push(parseInt(favorite, 10))
      }

      if (trashed !== null && trashed !== undefined) {
        query += ' AND is_trashed = ?'
        countQuery += ' AND is_trashed = ?'
        params.push(parseInt(trashed, 10))
      }

      if (q && q.trim() !== '') {
        query += ' AND name LIKE ?'
        countQuery += ' AND name LIKE ?'
        params.push(`%${q.trim()}%`)
      }

      // Add order and limit
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
      const selectParams = [...params, limit, offset]

      const [assetsResult, countResult, usageResult] = await Promise.all([
        env.DB.prepare(query).bind(...selectParams).all<any>(),
        env.DB.prepare(countQuery).bind(...params).first<{ total: number }>(),
        env.DB.prepare(
          'SELECT SUM(file_size) as total_bytes FROM assets WHERE user_id = ? AND provider = ?'
        ).bind(userId, 'upload').first<{ total_bytes: number | null }>(),
      ])

      const total = countResult?.total ?? 0
      const totalUploadedBytes = usageResult?.total_bytes ?? 0

      // Map DB columns to Frontend API model structure
      const formatted = (assetsResult.results || []).map(row => ({
        id: row.id,
        user_id: row.user_id,
        folder_id: row.folder_id,
        type: row.type,
        name: row.name,
        r2_key: row.r2_key,
        external_url: row.external_url,
        provider: row.provider,
        mime_type: row.mime_type,
        file_size: row.file_size,
        width: row.width,
        height: row.height,
        is_favorite: row.is_favorite,
        is_trashed: row.is_trashed,
        created_at: row.created_at,
        updated_at: row.updated_at,
        attribution: row.attr_author ? {
          authorName: row.attr_author,
          authorUrl: row.attr_author_url,
          sourceUrl: row.attr_source_url,
          providerName: row.attr_provider_name,
        } : null,
      }))

      return jsonSuccess({
        assets: formatted,
        total_uploaded_bytes: totalUploadedBytes,
        pagination: { page, limit, total },
      })
    }

    // ── POST /api/assets ─────────────────────────────────────────
    if (path === '/api/assets' && method === 'POST') {
      const body = await request.json() as {
        type?: string
        name?: string
        r2_key?: string
        external_url?: string
        provider?: string
        mime_type?: string
        file_size?: number
        width?: number
        height?: number
        folder_id?: string
        attribution?: RequestAttribution | null
      }

      if (!body.type || !body.name) {
        return jsonError('Type and Name are required fields')
      }

      const assetId = generateId()
      const attr = body.attribution

      await env.DB.prepare(
        `INSERT INTO assets (
          id, user_id, folder_id, type, name, r2_key, external_url, provider,
          mime_type, file_size, width, height,
          attr_author, attr_author_url, attr_source_url, attr_provider_name,
          is_favorite, is_trashed, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, unixepoch(), unixepoch())`
      ).bind(
        assetId,
        userId,
        body.folder_id || null,
        body.type,
        body.name,
        body.r2_key || null,
        body.external_url || null,
        body.provider || 'upload',
        body.mime_type || null,
        body.file_size || null,
        body.width || null,
        body.height || null,
        attr?.authorName || null,
        attr?.authorUrl || null,
        attr?.sourceUrl || null,
        attr?.providerName || null
      ).run()

      return jsonSuccess({
        success: true,
        asset: {
          id: assetId,
          type: body.type,
          name: body.name,
          r2_key: body.r2_key || null,
          external_url: body.external_url || null,
          provider: body.provider || 'upload',
        },
      })
    }

    // ── PATCH /api/assets/:id ────────────────────────────────────
    if (path.startsWith('/api/assets/') && method === 'PATCH') {
      const assetId = path.split('/').pop()
      if (!assetId) return jsonError('Asset ID is required')

      const body = await request.json() as {
        name?: string
        is_favorite?: number
        is_trashed?: number
        folder_id?: string | null
      }

      // Verify ownership
      const asset = await env.DB.prepare(
        'SELECT id FROM assets WHERE id = ? AND user_id = ?'
      ).bind(assetId, userId).first()

      if (!asset) {
        return jsonError('Asset not found or unauthorized', 404)
      }

      const updates: string[] = []
      const bindParams: any[] = []

      if (body.name !== undefined) {
        updates.push('name = ?')
        bindParams.push(body.name.trim())
      }
      if (body.is_favorite !== undefined) {
        updates.push('is_favorite = ?')
        bindParams.push(body.is_favorite)
      }
      if (body.is_trashed !== undefined) {
        updates.push('is_trashed = ?')
        bindParams.push(body.is_trashed)
      }
      if (body.folder_id !== undefined) {
        updates.push('folder_id = ?')
        bindParams.push(body.folder_id)
      }

      if (updates.length === 0) {
        return jsonError('No valid updates provided')
      }

      updates.push('updated_at = unixepoch()')
      const query = `UPDATE assets SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
      await env.DB.prepare(query).bind(...bindParams, assetId, userId).run()

      return jsonSuccess({ success: true })
    }

    // ── DELETE /api/assets/:id ───────────────────────────────────
    if (path.startsWith('/api/assets/') && method === 'DELETE') {
      const assetId = path.split('/').pop()
      if (!assetId) return jsonError('Asset ID is required')

      // Verify ownership & get R2 key
      const asset = await env.DB.prepare(
        'SELECT r2_key FROM assets WHERE id = ? AND user_id = ?'
      ).bind(assetId, userId).first<{ r2_key: string | null }>()

      if (!asset) {
        return jsonError('Asset not found or unauthorized', 404)
      }

      // Delete database row
      await env.DB.prepare(
        'DELETE FROM assets WHERE id = ? AND user_id = ?'
      ).bind(assetId, userId).run()

      // If R2 key is populated, delete from R2 bucket
      if (asset.r2_key && asset.r2_key.startsWith('uploads/')) {
        try {
          await env.BUCKET.delete(asset.r2_key)
        } catch (err) {
          console.error(`[assets] Failed to delete object ${asset.r2_key} from R2:`, err)
        }
      }

      return jsonSuccess({ success: true })
    }

    return jsonError('Not found', 404)
  } catch (err: any) {
    console.error('Assets route handler failed:', err)
    if (err instanceof RateLimitError) {
      return jsonError('Search limit reached, try again in a moment', 429)
    }
    return jsonError(err.message || 'Internal server error', 500)
  }
}
