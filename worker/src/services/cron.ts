import type { Env } from '../../../config/ai'
import { generateId } from '../utils/id'

export async function runCronJobs(cron: string, env: Env): Promise<void> {
  console.log(`Cron triggered: ${cron}`)

  try {
    // 9AM UTC — data retention + DB health
    if (cron === '0 9 * * *') {
      await Promise.all([
        runDataRetention(env),
        runDBHealthCheck(env),
      ])
    }

  
  
  } catch (err) {
    console.error('Cron job error:', err)
  }
}

// ── Data Retention ────────────────────────────────────────────
// Free: 7 days, Starter: 30 days, Pro: 90 days, Business: 1 year
export async function runDataRetention(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  // 1. Fetch retention limits from settings table (fallback if not seeded)
  let daysFree = 7
  let daysPaid = 30

  try {
    const settings = await env.DB.prepare(
      "SELECT key, value FROM system_settings WHERE key IN ('retention_days_free', 'retention_days_paid')"
    ).all<{ key: string; value: string }>()

    for (const row of settings.results ?? []) {
      if (row.key === 'retention_days_free') daysFree = parseInt(row.value, 10)
      if (row.key === 'retention_days_paid') daysPaid = parseInt(row.value, 10)
    }
  } catch (err) {
    console.error('Failed to read retention settings from DB, using fallbacks:', err)
  }

  const cutoffFree = now - daysFree * 24 * 60 * 60
  const cutoffPaid = now - daysPaid * 24 * 60 * 60

  // 2. Find campaigns with non-null image keys that are past their plan's retention window
  const { results: expiredCampaigns } = await env.DB.prepare(
    `SELECT c.id, c.image_key FROM campaigns c
     JOIN users u ON c.user_id = u.id
     WHERE c.image_key IS NOT NULL AND (
       (u.plan = 'free' AND c.created_at < ?) OR
       (u.plan != 'free' AND c.created_at < ?)
     )`
  ).bind(cutoffFree, cutoffPaid).all<{ id: string; image_key: string }>()

  if (!expiredCampaigns?.length) {
    console.log('Retention: no expired media assets found.')
    return
  }

  console.log(`Retention: found ${expiredCampaigns.length} expired media assets. Starting cleanup...`)

  // 3. Process expired campaigns: delete from R2 and set DB column to NULL
  for (const campaign of expiredCampaigns) {
    // Delete from R2
    try {
      await env.BUCKET.delete(campaign.image_key)
      console.log(`Retention: deleted R2 object for campaign ${campaign.id}: ${campaign.image_key}`)
    } catch (err) {
      console.error(`Retention: failed to delete R2 object ${campaign.image_key} for campaign ${campaign.id}:`, err)
    }

    // Nullify image_key and has_image in DB
    try {
      await env.DB.prepare(
        'UPDATE campaigns SET image_key = NULL, has_image = 0, updated_at = unixepoch() WHERE id = ?'
      ).bind(campaign.id).run()
    } catch (err) {
      console.error(`Retention: failed to nullify image_key/has_image in D1 for campaign ${campaign.id}:`, err)
    }
  }

  console.log(`Retention: media assets cleanup finished for ${expiredCampaigns.length} campaigns.`)
}

// ── DB Health Check ───────────────────────────────────────────
// Check row counts and alert if anything looks wrong
async function runDBHealthCheck(env: Env): Promise<void> {
  const tables = ['users', 'campaigns', 'generated_posts', 'subscriptions', 'usage']
  const now = Math.floor(Date.now() / 1000)

  for (const table of tables) {
    const result = await env.DB.prepare(
      `SELECT COUNT(*) as count FROM ${table}`
    ).first<{ count: number }>()

    await env.DB.prepare(
      `INSERT INTO db_health_log (id, table_name, row_count, checked_at)
       VALUES (?, ?, ?, ?)`
    ).bind(generateId(), table, result?.count ?? 0, now).run()
  }

  // Alert if users table grows unusually fast (possible abuse)
  const recentUsers = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM users WHERE created_at > ?`
  ).bind(now - 24 * 60 * 60).first<{ count: number }>()

  if ((recentUsers?.count ?? 0) > 500) {
    console.warn(`ALERT: ${recentUsers?.count} new users in last 24h — possible abuse`)
  }
}

