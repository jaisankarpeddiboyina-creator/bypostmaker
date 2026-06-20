import type { PlatformTier } from '../../../config/platforms'
import { TIER_LIMITS } from '../../../config/platforms'
import { generateId } from '../utils/id'

interface UsageCheckResult {
  allowed: boolean
  used: number
  limit: number
  remaining: number
}

export async function checkUsageLimit(
  db: D1Database,
  userId: string,
  plan: PlatformTier
): Promise<UsageCheckResult> {
  const limit = TIER_LIMITS[plan].generations

  // Business plan = unlimited
  if (limit === Infinity || limit >= 1000) {
    return { allowed: true, used: 0, limit: -1, remaining: -1 }
  }

  const { periodStart } = getCurrentPeriod()

  const usage = await db.prepare(
    `SELECT generations FROM usage WHERE user_id = ? AND period_start = ?`
  ).bind(userId, periodStart).first<{ generations: number }>()

  const used = usage?.generations ?? 0

  // If no usage record yet, create it
  if (!usage) {
    const { periodEnd } = getCurrentPeriod()
    await db.prepare(
      `INSERT INTO usage (id, user_id, period_start, period_end, generations)
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(user_id, period_start) DO NOTHING`
    ).bind(generateId(), userId, periodStart, periodEnd).run()
  }

  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  }
}

export async function incrementUsage(db: D1Database, userId: string): Promise<void> {
  const { periodStart, periodEnd } = getCurrentPeriod()

  await db.prepare(
    `INSERT INTO usage (id, user_id, period_start, period_end, generations)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(user_id, period_start) DO UPDATE
     SET generations = generations + 1, updated_at = unixepoch()`
  ).bind(generateId(), userId, periodStart, periodEnd).run()
}

export async function getUsageSummary(db: D1Database, userId: string): Promise<{
  generations: number
  periodStart: number
  periodEnd: number
}> {
  const { periodStart, periodEnd } = getCurrentPeriod()

  const usage = await db.prepare(
    `SELECT generations, period_start, period_end FROM usage
     WHERE user_id = ? AND period_start = ?`
  ).bind(userId, periodStart).first<{
    generations: number
    period_start: number
    period_end: number
  }>()

  return {
    generations: usage?.generations ?? 0,
    periodStart: usage?.period_start ?? periodStart,
    periodEnd: usage?.period_end ?? periodEnd,
  }
}

function getCurrentPeriod(): { periodStart: number; periodEnd: number } {
  const now = new Date()
  const periodStart = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  )
  const periodEnd = Math.floor(
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000
  )
  return { periodStart, periodEnd }
}
