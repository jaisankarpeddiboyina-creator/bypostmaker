import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Env } from '../../../config/ai'
import { generateId } from '../utils/id'
import { MAX_IMAGE_SIZE_BYTES, MAX_BATCH_IMAGE_SIZE_BYTES, MAX_CAMPAIGN_IMAGES } from '../../../config/limits'

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function createS3Client(env: Env) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

// Single File Presigned URL Route (Legacy / Backward Compatibility)
export async function handlePresignRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  try {
    const { contentType, contentLength } = await request.json() as {
      contentType: string
      contentLength: number
    }

    if (!contentType || typeof contentLength !== 'number') {
      return jsonError('Invalid request body', 400)
    }

    if (!allowedTypes.includes(contentType)) {
      return jsonError('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.', 400)
    }

    if (contentLength <= 0 || contentLength > MAX_IMAGE_SIZE_BYTES) {
      return jsonError('File size exceeds the 15MB limit.', 400)
    }

    const ext = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1]
    const objectKey = `uploads/${userId}/${generateId()}.${ext}`

    const s3 = createS3Client(env)
    const command = new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: contentLength,
    })

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 })

    return new Response(JSON.stringify({ uploadUrl, objectKey }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Presigned URL generation failed:', err)
    return jsonError('Failed to generate upload URL', 500)
  }
}

// Batch Presigned URL Route (Multi-Image Support up to 4 files, 30MB max total)
export async function handlePresignBatchRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  try {
    const { files } = await request.json() as {
      files?: Array<{ contentType: string; contentLength: number }>
    }

    if (!Array.isArray(files) || files.length === 0) {
      return jsonError('Select at least one image file.', 400)
    }

    if (files.length > MAX_CAMPAIGN_IMAGES) {
      return jsonError(`Maximum ${MAX_CAMPAIGN_IMAGES} images allowed per campaign.`, 400)
    }

    let totalBatchSize = 0
    for (const f of files) {
      if (!f.contentType || typeof f.contentLength !== 'number') {
        return jsonError('Invalid file metadata in batch request.', 400)
      }
      if (!allowedTypes.includes(f.contentType)) {
        return jsonError('Invalid file type in batch. Only JPEG, PNG, WEBP, and GIF are allowed.', 400)
      }
      if (f.contentLength <= 0 || f.contentLength > MAX_IMAGE_SIZE_BYTES) {
        return jsonError('Individual file size exceeds the 15MB limit.', 400)
      }
      totalBatchSize += f.contentLength
    }

    if (totalBatchSize > MAX_BATCH_IMAGE_SIZE_BYTES) {
      return jsonError('Total batch image size exceeds the 30MB limit.', 400)
    }

    const s3 = createS3Client(env)
    const items: Array<{ uploadUrl: string; objectKey: string; sortOrder: number }> = []

    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext = f.contentType.split('/')[1] === 'jpeg' ? 'jpg' : f.contentType.split('/')[1]
      const objectKey = `uploads/${userId}/${generateId()}.${ext}`

      const command = new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: objectKey,
        ContentType: f.contentType,
        ContentLength: f.contentLength,
      })

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 })
      items.push({ uploadUrl, objectKey, sortOrder: i })
    }

    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('Batch presigned URL generation failed:', err)
    return jsonError('Failed to generate batch upload URLs', 500)
  }
}

// Cleanup Route (Deletes orphaned R2 objects on partial upload failure)
export async function handleCleanupRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonError('Method not allowed', 405)
  }

  try {
    const { keys } = await request.json() as { keys?: string[] }
    if (!Array.isArray(keys) || keys.length === 0) {
      return new Response(JSON.stringify({ ok: true, cleaned: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Security: Filter keys to strictly enforce user ownership boundary
    const userPrefix = `uploads/${userId}/`
    const validKeys = keys.filter(k => typeof k === 'string' && k.startsWith(userPrefix))

    let cleaned = 0
    await Promise.all(
      validKeys.map(async key => {
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
