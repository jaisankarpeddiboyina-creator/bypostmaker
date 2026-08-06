import type { Env } from '../../../config/ai'
import { generateId } from '../utils/id'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'

const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]

/**
 * Native Direct Upload Route (POST /api/upload/direct)
 * Accepts raw binary image payload in request.body.
 * Writes directly to env.BUCKET (Workers R2 binding) without AWS S3 SDK.
 */
export async function handleDirectUploadRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  try {
    const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ?? ''
    if (!allowedTypes.includes(contentType)) {
      return jsonError('Invalid file type. Only JPEG, PNG, WEBP, GIF, and SVG are allowed.', 400)
    }

    const contentLengthHeader = request.headers.get('Content-Length')
    if (contentLengthHeader) {
      const parsedLength = parseInt(contentLengthHeader, 10)
      if (!isNaN(parsedLength) && parsedLength > MAX_IMAGE_SIZE_BYTES) {
        return jsonError('File size exceeds the 15MB limit.', 400)
      }
    }

    const body = await request.arrayBuffer()
    if (body.byteLength === 0) {
      return jsonError('Empty file payload.', 400)
    }
    if (body.byteLength > MAX_IMAGE_SIZE_BYTES) {
      return jsonError('File size exceeds the 15MB limit.', 400)
    }

    let ext = contentType.split('/')[1] ?? 'bin'
    if (ext === 'jpeg') ext = 'jpg'
    if (ext === 'svg+xml') ext = 'svg'

    const objectKey = `uploads/${userId}/${generateId()}.${ext}`

    await env.BUCKET.put(objectKey, body, {
      httpMetadata: { contentType },
    })

    return new Response(
      JSON.stringify({
        success: true,
        uploadUrl: `/api/upload/direct`, // For backward compatibility
        objectKey,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    console.error('Direct R2 upload failed:', err)
    return jsonError('Failed to save image to storage', 500)
  }
}

// Backward compatibility alias for single file presign route
export async function handlePresignRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  return handleDirectUploadRoute(request, env, userId)
}

// Backward compatibility alias for batch presign route
export async function handlePresignBatchRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  return handleDirectUploadRoute(request, env, userId)
}

/**
 * Cleanup Route (POST /api/upload/cleanup)
 * Deletes orphaned R2 objects on partial upload or generation failure
 */
export async function handleCleanupRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  try {
    const { keys } = (await request.json()) as { keys?: string[] }
    if (!Array.isArray(keys) || keys.length === 0) {
      return new Response(JSON.stringify({ ok: true, cleaned: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Security boundary: filter keys to strictly enforce user ownership prefix
    const userPrefix = `uploads/${userId}/`
    const validKeys = keys.filter((k) => typeof k === 'string' && k.startsWith(userPrefix))

    let cleaned = 0
    await Promise.all(
      validKeys.map(async (key) => {
        try {
          await env.BUCKET.delete(key)
          cleaned++
        } catch (err) {
          console.error(`[upload cleanup] Failed to delete R2 key ${key}:`, err)
        }
      })
    )

    return new Response(JSON.stringify({ ok: true, cleaned }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Upload cleanup failed:', err)
    return jsonError('Cleanup failed', 500)
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
