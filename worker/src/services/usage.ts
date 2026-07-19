import type { PlatformTier } from '../../../config/platforms'
import { TIER_LIMITS } from '../../../config/platforms'
import { generateId } from '../utils/id'
import { getCurrentPeriod } from '../utils/period'

interface UsageCheckResult {
  allowed: boolean
  used: number
  limit: number
  remaining: number
}

export async function reserveUsageCredit(
  db: D1Database,
  userId: string,
  plan: PlatformTier
): Promise<UsageCheckResult> {
  const limit = TIER_LIMITS[plan].generations
  const { periodStart, periodEnd } = getCurrentPeriod()

  // Business plan = unlimited
  if (limit === Infinity || limit >= 1000) {
    const result = await db.prepare(
      `INSERT INTO usage (id, user_id, period_start, period_end, generations)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(user_id, period_start) DO UPDATE
       SET generations = generations + 1, updated_at = unixepoch()
       RETURNING generations`
    ).bind(generateId(), userId, periodStart, periodEnd).first<{ generations: number }>()
    const used = result?.generations ?? 1
    return { allowed: true, used, limit: -1, remaining: -1 }
  }

  // Atomically check and reserve a credit
  const result = await db.prepare(
    `INSERT INTO usage (id, user_id, period_start, period_end, generations)
     SELECT ?, ?, ?, ?, 1
     WHERE ? > 0
     ON CONFLICT(user_id, period_start) DO UPDATE
     SET generations = generations + 1, updated_at = unixepoch()
     WHERE generations < ?
     RETURNING generations`
  ).bind(generateId(), userId, periodStart, periodEnd, limit, limit).first<{ generations: number }>()

  if (!result) {
    const current = await db.prepare(
      `SELECT generations FROM usage WHERE user_id = ? AND period_start = ?`
    ).bind(userId, periodStart).first<{ generations: number }>()
    const used = current?.generations ?? limit
    return {
      allowed: false,
      used,
      limit,
      remaining: 0,
    }
  }

  const used = result.generations
  return {
    allowed: true,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  }
}

export async function refundUsageCredit(
  db: D1Database,
  userId: string,
  periodStart: number
): Promise<void> {
  await db.prepare(
    `UPDATE usage
     SET generations = MAX(0, generations - 1), updated_at = unixepoch()
     WHERE user_id = ? AND period_start = ?`
  ).bind(userId, periodStart).run()
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

