import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { Env } from '../../../config/ai'
import { generateId } from '../utils/id'
import { MAX_IMAGE_SIZE_BYTES } from '../../../config/limits'

export async function handlePresignRoute(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { contentType, contentLength } = await request.json() as {
      contentType: string
      contentLength: number
    }

    if (!contentType || typeof contentLength !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 1. Validate MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(contentType)) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 2. Validate content length (Max 15MB)
    if (contentLength <= 0 || contentLength > MAX_IMAGE_SIZE_BYTES) {
      return new Response(JSON.stringify({ error: 'File size exceeds the 15MB limit.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Generate key
    const ext = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1]
    const objectKey = `uploads/${userId}/${generateId()}.${ext}`

    // 4. Instantiate S3Client
    // requestChecksumCalculation / responseChecksumValidation: AWS SDK v3 defaults
    // to adding CRC32 checksums automatically. R2 validates the actual file checksum
    // against the placeholder in the presigned URL — they never match — so R2
    // rejects with 403. Setting both to 'when_required' disables this behaviour.
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    })

    // 5. Generate presigned URL (valid for 10 minutes) using R2_BUCKET_NAME from wrangler.toml
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
    return new Response(JSON.stringify({ error: 'Failed to generate upload URL' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
