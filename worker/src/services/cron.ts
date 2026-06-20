import type { Env } from '../../../config/ai'
import { sendEmail } from './email'
import { generateId } from '../utils/id'

export async function runCronJobs(cron: string, env: Env): Promise<void> {
  console.log(`Cron triggered: ${cron}`)

  try {
    // 9AM UTC — data retention + DB health + usage alerts
    if (cron === '0 9 * * *') {
      await Promise.all([
        runDataRetention(env),
        runDBHealthCheck(env),
        runUsageAlerts(env),
      ])
    }

    // Midnight UTC — usage period reset check
    if (cron === '0 0 * * *') {
      await runPeriodResetCheck(env)
    }
  } catch (err) {
    console.error('Cron job error:', err)
  }
}

// ── Data Retention ────────────────────────────────────────────
// Free: 7 days, Starter: 30 days, Pro: 90 days, Business: 1 year
async function runDataRetention(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000)

  const retentionDays: Record<string, number> = {
    free:     7,
    starter:  30,
    pro:      90,
    business: 365,
  }

  for (const [plan, days] of Object.entries(retentionDays)) {
    const cutoff = now - days * 24 * 60 * 60

    // Find campaigns older than retention window for this plan
    const { results: expiredCampaigns } = await env.DB.prepare(
      `SELECT c.id FROM campaigns c
       JOIN users u ON c.user_id = u.id
       WHERE u.plan = ? AND c.created_at < ?`
    ).bind(plan, cutoff).all<{ id: string }>()

    if (!expiredCampaigns?.length) continue

    // Delete in batches of 50
    const ids = expiredCampaigns.map(c => c.id)
    for (let i = 0; i < ids.length; i += 50) {
      const batch = ids.slice(i, i + 50)
      const placeholders = batch.map(() => '?').join(',')

      await env.DB.batch([
        env.DB.prepare(`DELETE FROM generated_posts WHERE campaign_id IN (${placeholders})`).bind(...batch),
        env.DB.prepare(`DELETE FROM campaigns WHERE id IN (${placeholders})`).bind(...batch),
      ])
    }

    console.log(`Retention: deleted ${ids.length} campaigns for ${plan} plan`)
  }
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

// ── Usage Alerts ──────────────────────────────────────────────
// Email users at 80% and 100% usage
async function runUsageAlerts(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const periodStart = Math.floor(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000
  )

  // Get all users with their usage and limits
  const { results: usageData } = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.plan,
            COALESCE(us.generations, 0) as generations
     FROM users u
     LEFT JOIN usage us ON u.id = us.user_id AND us.period_start = ?
     WHERE u.plan != 'business'`  // business = high limit, skip alerts
  ).bind(periodStart).all<{
    id: string
    email: string
    name: string
    plan: string
    generations: number
  }>()

  const limits: Record<string, number> = { free: 5, starter: 50, pro: 200 }

  for (const user of usageData ?? []) {
    const limit = limits[user.plan] ?? 5
    const pct = user.generations / limit

    // 80% alert — send once (check if already sent via simple heuristic)
    if (pct >= 0.8 && pct < 1.0) {
      await sendEmail(env, 'usage_80', user.email, user.name, {
        used: user.generations,
        limit,
      })
    }

    // 100% alert
    if (pct >= 1.0) {
      await sendEmail(env, 'usage_100', user.email, user.name, { limit })
    }
  }
}

// ── Period Reset Check ────────────────────────────────────────
// Ensure usage records exist for current period for all users
async function runPeriodResetCheck(env: Env): Promise<void> {
  const now = new Date()
  // Only run on the 1st of the month
  if (now.getDate() !== 1) return

  const periodStart = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  )
  const periodEnd = Math.floor(
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000
  )

  // Create fresh usage records for all users for new period
  const { results: users } = await env.DB.prepare(
    'SELECT id FROM users'
  ).all<{ id: string }>()

  for (const user of users ?? []) {
    await env.DB.prepare(
      `INSERT INTO usage (id, user_id, period_start, period_end, generations)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(user_id, period_start) DO NOTHING`
    ).bind(generateId(), user.id, periodStart, periodEnd).run()
  }

  console.log(`Period reset: created usage records for ${users?.length ?? 0} users`)
}
