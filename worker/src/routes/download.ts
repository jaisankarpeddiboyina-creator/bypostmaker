// ============================================================
// Download Route — @cf-wasm/photon for free image resizing
// ============================================================

import type { Env } from '../../../config/ai'
import { PLATFORM_MAP } from '../../../config/platforms'
import JSZip from 'jszip'

const ZIP_VIDEO_THRESHOLD = 80 * 1024 * 1024 // 80MB — if ZIP would exceed this, exclude video

export async function handleDownload(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const url = new URL(request.url)
  const campaignId = url.searchParams.get('campaign')
  const platformId = url.searchParams.get('platform') ?? undefined

  if (!campaignId) return jsonError('Missing campaign ID', 400)

  const campaign = await env.DB.prepare(
    `SELECT id, prompt, platforms, has_image, has_video, video_filename
     FROM campaigns WHERE id = ? AND user_id = ? AND status = 'completed'`
  ).bind(campaignId, userId).first<{
    id: string; prompt: string; platforms: string
    has_image: number; has_video: number; video_filename: string | null
  }>()
  if (!campaign) return jsonError('Campaign not found', 404)

  const postsQuery = platformId
    ? env.DB.prepare(
        `SELECT platform_id, content, extra_fields
         FROM generated_posts WHERE campaign_id = ? AND user_id = ? AND platform_id = ?`
      ).bind(campaignId, userId, platformId)
    : env.DB.prepare(
        `SELECT platform_id, content, extra_fields
         FROM generated_posts WHERE campaign_id = ? AND user_id = ?`
      ).bind(campaignId, userId)

  const { results: posts } = await postsQuery.all<{
    platform_id: string; content: string; extra_fields: string | null
  }>()
  if (!posts?.length) return jsonError('No content found', 404)

  let imageBuffer: ArrayBuffer | null = null
  let imageMimeType = 'image/jpeg'
  let videoBuffer: ArrayBuffer | null = null
  let videoFileName = campaign.video_filename ?? 'your_video.mp4'

  if (request.method === 'POST') {
    try {
      const formData = await request.formData()
      const imageFile = formData.get('image') as File | null
      const videoFile = formData.get('video') as File | null
      if (imageFile) {
        imageBuffer = await imageFile.arrayBuffer()
        imageMimeType = imageFile.type || 'image/jpeg'
      }
      if (videoFile) {
        videoBuffer = await videoFile.arrayBuffer()
        videoFileName = videoFile.name
      }
    } catch { /* no media */ }
  }

  // Guard: if video is large, exclude from ZIP, send separate link
  const videoTooLarge = videoBuffer && videoBuffer.byteLength > ZIP_VIDEO_THRESHOLD
  const includeVideo = videoBuffer && !videoTooLarge

  const zip = new JSZip()
  const selectedPlatformIds = platformId
    ? [platformId]
    : (JSON.parse(campaign.platforms) as string[])

  zip.file('prompt.txt', campaign.prompt)
  zip.file('README.txt', buildReadme(selectedPlatformIds, campaign.prompt))

  if (includeVideo && videoBuffer) {
    zip.file(videoFileName, videoBuffer)
  }

  for (const post of posts) {
    const platform = PLATFORM_MAP[post.platform_id]
    if (!platform) continue

    const folder = zip.folder(sanitize(platform.name))!
    folder.file('post.txt', post.content)

    // Extra fields (subreddit, url etc) saved with the post
    let extraFields: Record<string, string> = {}
    if (post.extra_fields) {
      try { extraFields = JSON.parse(post.extra_fields) } catch { /* ignore */ }
    }

    const shareUrl = platform.shareUrl(post.content, extraFields)
    folder.file('share_url.txt', `Share on ${platform.name}:\n${shareUrl}`)

    // Image resizing via @cf-wasm/photon — free, runs in Workers
    if (imageBuffer && platform.imageDimensions.length > 0) {
      for (const dim of platform.imageDimensions) {
        try {
          const resized = await resizeWithPhoton(imageBuffer, dim.width, dim.height)
          const ext = imageMimeType.includes('png') ? 'png' : 'jpg'
          folder.file(`image_${dim.width}x${dim.height}_${sanitize(dim.label)}.${ext}`, resized)
        } catch {
          folder.file('image_note.txt',
            `Could not resize image for ${dim.label} (${dim.width}×${dim.height}). Please resize manually.`)
        }
      }
    }

    if (videoBuffer) {
      const note = videoTooLarge
        ? `Your video is too large to include in the ZIP (>${ZIP_VIDEO_THRESHOLD / 1024 / 1024}MB).\nUpload "${videoFileName}" directly to ${platform.name}.`
        : `Your video "${videoFileName}" is at the root of this kit.\nUpload it directly to ${platform.name}.`
      folder.file('video_note.txt', note)
    }
  }

  const zipBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const kitName = platformId
    ? `${sanitize(PLATFORM_MAP[platformId]?.name ?? platformId)}_kit.zip`
    : 'postmaker_kit.zip'

  return new Response(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${kitName}"`,
      'X-Video-Excluded': videoTooLarge ? '1' : '0',
    },
  })
}

// ── @cf-wasm/photon image resize ──────────────────────────────
async function resizeWithPhoton(
  buffer: ArrayBuffer,
  width: number,
  height: number
): Promise<ArrayBuffer> {
  // Dynamic import — photon is WASM, lazy load to save cold start
  const { PhotonImage, resize, SamplingFilter } = await import('@cf-wasm/photon')

  const uint8 = new Uint8Array(buffer)
  const image = PhotonImage.new_from_byteslice(uint8)

  const resized = resize(image, width, height, SamplingFilter.Lanczos3)
  const output = resized.get_bytes_jpeg(90)

  image.free()
  resized.free()

  return output.buffer as ArrayBuffer
}

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '_').toLowerCase()
}

function buildReadme(platformIds: string[], prompt: string): string {
  const names = platformIds.map(id => PLATFORM_MAP[id]?.name ?? id)
  return `PostMaker Kit
=============
Prompt: "${prompt}"

Platforms (${names.length}):
${names.map(n => `  · ${n}`).join('\n')}

Each folder contains:
  post.txt         Copy-paste ready content
  share_url.txt    Click to share directly
  image_WxH.jpg    Resized for this platform (if image uploaded)
  video_note.txt   Video instructions (if video uploaded)

Video: included at root level if under 80MB, otherwise upload directly.

Generated by PostMaker · bypostmaker.com`
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { 'Content-Type': 'application/json' },
  })
}
