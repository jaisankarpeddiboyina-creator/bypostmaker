// ============================================================
// history.ts
// ============================================================
import type { Env } from '../../../config/ai'

export async function handleHistory(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get('page') ?? '1')
  const limit = 20
  const offset = (page - 1) * limit

  const { results: campaigns } = await env.DB.prepare(
    `SELECT id, prompt, platforms, has_image, has_video, status, generated_count, created_at
     FROM campaigns WHERE user_id = ? AND status = 'completed'
     ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(userId, limit, offset).all()

  // For each campaign, get its generated posts
  const enriched = await Promise.all(
    (campaigns ?? []).map(async (c: any) => {
      const { results: posts } = await env.DB.prepare(
        'SELECT platform_id, content, edited FROM generated_posts WHERE campaign_id = ?'
      ).bind(c.id).all()

      return {
        ...c,
        platforms: JSON.parse(c.platforms as string),
        posts: posts ?? [],
      }
    })
  )

  const { results: countResult } = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM campaigns WHERE user_id = ? AND status = 'completed'`
  ).bind(userId).all()

  const total = (countResult?.[0] as any)?.total ?? 0

  return new Response(JSON.stringify({
    campaigns: enriched,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
